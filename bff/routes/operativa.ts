import { Router } from 'express';
import type { PoolClient } from 'pg';
import { principal } from '../auth';
import { pool, withRole } from '../db';
import { remember, replay } from '../idem';
import { h, problem } from '../problem';
import { idempotencyKey, monto, numeroCuenta, texto } from '../validate';

export const operativaRouter = Router();

const operador = (res: Parameters<typeof principal>[0]) => {
  const id = principal(res).idUsuario;
  if (id === undefined)
    throw problem(403, 'SIN_USUARIO_INTERNO', 'Acceso denegado', 'Tu sesión no es de un usuario interno.');
  return id;
};

async function cuentaPorNumero(c: PoolClient, numero: string) {
  const r = await c.query(
    `SELECT cu.id_cuenta::text AS id, ec.codigo AS estado FROM banco_core.cuenta cu
       JOIN banco_core.estado_cuenta ec ON ec.id_estado_cuenta = cu.id_estado_cuenta WHERE cu.numero_cuenta = $1`,
    [numero],
  );
  if (!r.rows[0])
    throw problem(404, 'CUENTA_NO_ENCONTRADA', 'Cuenta no encontrada', 'Verifica el número de cuenta.');
  return r.rows[0] as { id: string; estado: string };
}

async function operacion(c: PoolClient, idTx: string) {
  const r = await c.query(
    `SELECT t.id_transaccion::text AS id_transaccion, t.fecha_transaccion AS fecha, tt.codigo AS tipo, t.monto,
            COALESCE(co.numero_cuenta, cd.numero_cuenta) AS id_cuenta
       FROM banco_core.transaccion t JOIN banco_core.tipo_transaccion tt ON tt.id_tipo_transaccion = t.id_tipo_transaccion
       LEFT JOIN banco_core.cuenta co ON co.id_cuenta = t.id_cuenta_origen
       LEFT JOIN banco_core.cuenta cd ON cd.id_cuenta = t.id_cuenta_destino WHERE t.id_transaccion = $1`,
    [idTx],
  );
  const x = r.rows[0];
  return {
    id_transaccion: x.id_transaccion,
    fecha: x.fecha,
    tipo: x.tipo,
    monto: Number(x.monto),
    id_cuenta: x.id_cuenta,
  };
}

/** Consignación y retiro en ventanilla: llaman a sp_consignar / sp_retirar (idempotentes por UUID en la BD). */
function cajaHandler(tipo: 'CONSIGNACION' | 'RETIRO') {
  return h(async (req, res) => {
    const idu = operador(res);
    const key = idempotencyKey(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const numero = numeroCuenta(b.id_cuenta, 'id_cuenta');
    const importe = monto(b.monto);
    texto(b.concepto, 'concepto', 3, 80); // validado; la tabla transaccion no tiene columna de concepto
    const out = await withRole(
      'rol_operativo',
      async (c) => {
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
        const prev = await c.query(
          'SELECT id_transaccion::text AS id, id_usuario_operador AS op FROM banco_core.transaccion WHERE idempotency_key = $1',
          [key],
        );
        if (prev.rows[0]) {
          if (Number(prev.rows[0].op) !== idu)
            throw problem(
              409,
              'IDEMPOTENCY_CONFLICT',
              'Clave ya utilizada',
              'Esa clave de idempotencia pertenece a otra operación.',
            );
          return operacion(c, prev.rows[0].id);
        }
        const cu = await cuentaPorNumero(c, numero);
        const sp = tipo === 'CONSIGNACION' ? 'sp_consignar' : 'sp_retirar';
        const r = await c.query(
          `CALL banco_core.${sp}($1::uuid, $2::bigint, $3::numeric, $4::int, NULL::bigint)`,
          [key, cu.id, importe, idu],
        );
        return operacion(c, String(r.rows[0].p_id_transaccion));
      },
      idu,
    );
    res.json(out);
  });
}
operativaRouter.post('/caja/consignacion', cajaHandler('CONSIGNACION'));
operativaRouter.post('/caja/retiro', cajaHandler('RETIRO'));

// Eventos soportados por la BD (procedimientos existentes). REACTIVACION requiere sp_reactivar_cuenta (sql/010).
const EVENTOS = [
  'BLOQUEO_PARCIAL',
  'BLOQUEO_TOTAL',
  'DESBLOQUEO',
  'ACTIVACION',
  'REACTIVACION',
  'CIERRE',
] as const;
type Evento = (typeof EVENTOS)[number];

operativaRouter.post(
  '/cuentas/evento-administrativo',
  h(async (req, res) => {
    const idu = operador(res);
    const sub = principal(res).sub;
    const key = idempotencyKey(req);
    const prev = replay<unknown>(sub, key);
    if (prev) return res.json(prev);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const numero = numeroCuenta(b.id_cuenta, 'id_cuenta');
    const tipo = b.tipo_evento as Evento;
    if (!EVENTOS.includes(tipo))
      throw problem(
        422,
        'EVENTO_NO_SOPORTADO',
        'Evento no soportado',
        'Ese tipo de evento no existe en el banco.',
      );
    const motivo = texto(b.motivo, 'motivo', 10, 300);
    const ref =
      typeof b.referencia === 'string' && b.referencia.trim()
        ? ` [ref: ${texto(b.referencia, 'referencia', 1, 60)}]`
        : '';
    const full = motivo + ref;

    const out = await withRole(
      'rol_operativo',
      async (c) => {
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
        const cu = await cuentaPorNumero(c, numero);
        if (cu.estado === 'CERRADA' && tipo !== 'CIERRE')
          throw problem(
            409,
            'CUENTA_CERRADA',
            'Cuenta cerrada',
            'No se pueden registrar eventos sobre una cuenta cerrada.',
          );
        switch (tipo) {
          case 'BLOQUEO_PARCIAL':
            await c.query(`CALL banco_core.sp_bloquear_cuenta($1::bigint, 'PARCIAL', $2::int, $3)`, [
              cu.id,
              idu,
              full,
            ]);
            break;
          case 'BLOQUEO_TOTAL':
            await c.query(`CALL banco_core.sp_bloquear_cuenta($1::bigint, 'TOTAL', $2::int, $3)`, [
              cu.id,
              idu,
              full,
            ]);
            break;
          case 'DESBLOQUEO':
            await c.query('CALL banco_core.sp_desbloquear_cuenta($1::bigint, $2::int, $3)', [
              cu.id,
              idu,
              full,
            ]);
            break;
          case 'ACTIVACION':
            await c.query('CALL banco_core.sp_activar_cuenta($1::bigint, $2::int, $3)', [cu.id, idu, full]);
            break;
          case 'REACTIVACION':
            await c.query('CALL banco_core.sp_reactivar_cuenta($1::bigint, $2::int, $3)', [cu.id, idu, full]);
            break;
          case 'CIERRE':
            await c.query('CALL banco_core.sp_cerrar_cuenta($1::bigint, $2::int, $3)', [cu.id, idu, full]);
            break;
        }
        const e = await c.query(
          'SELECT id_evento::text AS id_evento, fecha_hora AS fecha FROM banco_core.evento_cuenta WHERE id_cuenta = $1 ORDER BY id_evento DESC LIMIT 1',
          [cu.id],
        );
        return {
          id_evento: e.rows[0].id_evento,
          fecha: e.rows[0].fecha,
          tipo_evento: tipo,
          id_cuenta: numero,
        };
      },
      idu,
    );
    remember(sub, key, out);
    res.json(out);
  }),
);

// ---- Cierre de caja: resumen del día del operador (zona America/Bogota) ----
const RESUMEN_SQL = `
  SELECT count(*)::int AS n,
         COALESCE(sum(t.monto) FILTER (WHERE t.id_tipo_transaccion = 1), 0) AS cons,
         COALESCE(sum(t.monto) FILTER (WHERE t.id_tipo_transaccion = 2), 0) AS ret
    FROM banco_core.transaccion t
   WHERE t.id_usuario_operador = $1 AND t.id_estado_transaccion = 2 AND t.id_tipo_transaccion IN (1, 2)
     AND (t.fecha_transaccion AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date`;

async function resumen(c: PoolClient, idu: number) {
  const r = (await c.query(RESUMEN_SQL, [idu])).rows[0];
  const cons = Number(r.cons),
    ret = Number(r.ret);
  // Sin fondo inicial de caja: el efectivo esperado es lo recibido menos lo entregado (supuesto documentado).
  return {
    num_operaciones: r.n as number,
    total_consignaciones: cons,
    total_retiros: ret,
    efectivo_esperado: cons - ret,
  };
}
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

operativaRouter.get(
  '/caja/cierre',
  h(async (_req, res) => {
    const idu = operador(res);
    const base = await withRole('rol_operativo', (c) => resumen(c, idu), idu);
    let estado: 'ABIERTA' | 'CERRADA' | 'DESCUADRADA' = 'ABIERTA';
    try {
      // la tabla cierre_caja es opcional (sql/010): si no existe, el cierre queda siempre ABIERTA
      const r = await pool.query(
        'SELECT estado FROM banco_core.cierre_caja WHERE id_usuario_interno = $1 AND fecha_cierre = $2::date',
        [idu, hoy()],
      );
      if (r.rows[0]) estado = r.rows[0].estado;
    } catch (e) {
      if ((e as { code?: string }).code !== '42P01') throw e;
    }
    res.json({ fecha: hoy(), ...base, estado });
  }),
);

operativaRouter.post(
  '/caja/cierre',
  h(async (req, res) => {
    const idu = operador(res);
    const sub = principal(res).sub;
    const key = idempotencyKey(req);
    const prev = replay<unknown>(sub, key);
    if (prev) return res.json(prev);
    const v = (req.body as { efectivo_contado?: unknown } | undefined)?.efectivo_contado;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1e12 || Math.round(v * 100) / 100 !== v)
      throw problem(
        422,
        'MONTO_INVALIDO',
        'Monto inválido',
        'El efectivo contado debe ser un número mayor o igual a cero con máximo 2 decimales.',
      );
    const out = await withRole(
      'rol_operativo',
      async (c) => {
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
        const base = await resumen(c, idu);
        const dif = Math.round((v - base.efectivo_esperado) * 100) / 100;
        const estado = dif === 0 ? 'CERRADA' : 'DESCUADRADA';
        try {
          await c.query(
            `INSERT INTO banco_core.cierre_caja (id_usuario_interno, fecha_cierre, efectivo_esperado, efectivo_contado, diferencia, estado)
         VALUES ($1, $2::date, $3, $4, $5, $6)`,
            [idu, hoy(), base.efectivo_esperado, v, dif, estado],
          );
        } catch (e) {
          if ((e as { code?: string }).code === '23505')
            throw problem(
              409,
              'CIERRE_YA_REGISTRADO',
              'Cierre ya registrado',
              'Ya registraste el cierre de caja de hoy.',
            );
          throw e;
        }
        return { fecha: hoy(), ...base, estado };
      },
      idu,
    );
    remember(sub, key, out);
    res.json(out);
  }),
);
