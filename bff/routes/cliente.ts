import { Router } from 'express';
import type { PoolClient } from 'pg';
import { principal } from '../auth';
import { withRole } from '../db';
import { consumeOtp } from '../otp';
import { h, problem } from '../problem';
import {
  bigintId,
  idempotencyKey,
  maskLast4,
  monto,
  numeroCuenta,
  pagina,
  paginado,
  texto,
} from '../validate';

export const clienteRouter = Router();
export const transaccionesRouter = Router();

const idCliente = (res: Parameters<typeof principal>[0]) => {
  const id = principal(res).idCliente;
  if (!id) throw problem(403, 'SIN_CLIENTE', 'Acceso denegado', 'Tu sesión no está asociada a un cliente.');
  return id;
};

// Productos que NO existen en la base de datos (tarjetas, CDT, préstamos): se devuelven vacíos a propósito.
clienteRouter.get(
  '/posicion-global',
  h(async (req, res) => {
    const idc = idCliente(res);
    void req;
    const out = await withRole('rol_consulta', async (c) => {
      const t = await c.query(
        `SELECT cl.tipo_cliente, pn.primer_nombre, pn.primer_apellido, td.codigo AS tipo_documento,
              COALESCE(pn.numero_documento, pj.nit) AS numero_documento, pj.razon_social
         FROM banco_core.cliente cl
         LEFT JOIN banco_core.persona_natural pn ON pn.id_cliente = cl.id_cliente
         LEFT JOIN banco_core.tipo_documento td ON td.id_tipo_documento = pn.id_tipo_documento
         LEFT JOIN banco_core.persona_juridica pj ON pj.id_cliente = cl.id_cliente
        WHERE cl.id_cliente = $1`,
        [idc],
      );
      const cu = await c.query(
        `SELECT cu.id_cuenta::text AS id_cuenta, cu.numero_cuenta, pr.tipo_producto AS tipo, ec.codigo AS estado, cu.moneda, cu.saldo_disponible
         FROM banco_core.cuenta cu
         JOIN banco_core.cuenta_titular ct ON ct.id_cuenta = cu.id_cuenta AND ct.activo AND ct.id_cliente = $1
         JOIN banco_core.estado_cuenta ec ON ec.id_estado_cuenta = cu.id_estado_cuenta
         JOIN banco_core.producto pr ON pr.id_producto = cu.id_producto
        ORDER BY cu.id_cuenta`,
        [idc],
      );
      return { t: t.rows[0], cuentas: cu.rows };
    });
    if (!out.t)
      throw problem(404, 'CLIENTE_NO_ENCONTRADO', 'Cliente no encontrado', 'No encontramos tu información.');
    const cuentas = out.cuentas.map((r) => ({ ...r, saldo_disponible: Number(r.saldo_disponible) }));
    res.json({
      titular: {
        id_persona: idc,
        nombres: out.t.primer_nombre ?? out.t.razon_social ?? '',
        apellidos: out.t.primer_apellido ?? '',
        tipo_documento: out.t.tipo_documento ?? 'NIT',
        numero_documento: maskLast4(String(out.t.numero_documento ?? '')),
      },
      saldo_consolidado: cuentas
        .filter((c) => c.moneda === 'COP' && c.estado !== 'CERRADA')
        .reduce((s, c) => s + c.saldo_disponible, 0),
      cuentas,
      tarjetas_credito: [],
      inversiones_cdt: [],
      prestamos: [],
    });
  }),
);

transaccionesRouter.get(
  '/historial',
  h(async (req, res) => {
    const idc = idCliente(res);
    const pg = pagina(req.query);
    const cuenta = req.query.id_cuenta ? bigintId(String(req.query.id_cuenta), 'id_cuenta') : null;
    const r = await withRole('rol_consulta', (c) =>
      c.query(
        `WITH mias AS (
        SELECT ct.id_cuenta FROM banco_core.cuenta_titular ct
         WHERE ct.id_cliente = $1 AND ct.activo AND ($2::bigint IS NULL OR ct.id_cuenta = $2::bigint))
     SELECT t.id_transaccion::text AS id_transaccion, t.fecha_transaccion AS fecha, tt.nombre AS concepto, t.monto, t.moneda,
            (t.id_cuenta_origen IN (SELECT id_cuenta FROM mias)) AS es_debito,
            (CASE WHEN t.id_cuenta_origen IN (SELECT id_cuenta FROM mias) THEN t.id_cuenta_origen ELSE t.id_cuenta_destino END)::text AS id_cuenta,
            count(*) OVER () AS total
       FROM banco_core.transaccion t
       JOIN banco_core.tipo_transaccion tt ON tt.id_tipo_transaccion = t.id_tipo_transaccion
      WHERE (t.id_cuenta_origen IN (SELECT id_cuenta FROM mias) OR t.id_cuenta_destino IN (SELECT id_cuenta FROM mias))
        AND t.id_estado_transaccion IN (2, 4)
      ORDER BY t.fecha_transaccion DESC, t.id_transaccion DESC
      LIMIT $3 OFFSET $4`,
        [idc, cuenta, pg.tamano, pg.offset],
      ),
    );
    const total = r.rows[0] ? Number(r.rows[0].total) : 0;
    res.json(
      paginado(
        r.rows.map((x) => ({
          id_transaccion: x.id_transaccion,
          fecha: x.fecha,
          id_cuenta: x.id_cuenta,
          tipo: x.es_debito ? 'DEBITO' : 'CREDITO',
          concepto: x.concepto,
          monto: Number(x.monto),
          moneda: x.moneda,
        })),
        total,
        pg,
      ),
    );
  }),
);

async function comprobante(c: PoolClient, idTx: string, concepto: string) {
  const r = await c.query(
    `SELECT t.id_transaccion::text AS id_transaccion, t.fecha_transaccion AS fecha, t.id_cuenta_origen::text AS origen,
            cd.numero_cuenta AS destino, t.monto
       FROM banco_core.transaccion t LEFT JOIN banco_core.cuenta cd ON cd.id_cuenta = t.id_cuenta_destino
      WHERE t.id_transaccion = $1`,
    [idTx],
  );
  const x = r.rows[0];
  return {
    id_transaccion: x.id_transaccion,
    fecha: x.fecha,
    id_cuenta_origen: x.origen,
    id_cuenta_destino: x.destino,
    monto: Number(x.monto),
    concepto,
  };
}

/**
 * Transferencia iniciada por el cliente. Se ejecuta con rol_operativo porque sp_transferir escribe
 * (rol_consulta es de solo lectura); la autorización se hace aquí: titularidad + OTP + idempotencia.
 * `id_cuenta_destino` es el NÚMERO de cuenta. `concepto` se valida pero la tabla transaccion no tiene columna para guardarlo.
 */
transaccionesRouter.post(
  '/transferir',
  h(async (req, res) => {
    const p = principal(res);
    const idc = idCliente(res);
    const key = idempotencyKey(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const origen = bigintId(b.id_cuenta_origen, 'id_cuenta_origen');
    const destinoNum = numeroCuenta(b.id_cuenta_destino, 'id_cuenta_destino');
    const importe = monto(b.monto);
    const concepto = texto(b.concepto, 'concepto', 3, 80);

    const out = await withRole('rol_operativo', async (c) => {
      // Serializa reintentos concurrentes con la misma clave.
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
      const prev = await c.query(
        `SELECT t.id_transaccion::text AS id FROM banco_core.transaccion t
         JOIN banco_core.cuenta_titular ct ON ct.id_cuenta = t.id_cuenta_origen AND ct.activo AND ct.id_cliente = $2
        WHERE t.idempotency_key = $1`,
        [key, idc],
      );
      if (prev.rows[0]) return comprobante(c, prev.rows[0].id, concepto); // reintento idempotente: no exige OTP otra vez

      const own = await c.query(
        `SELECT 1 FROM banco_core.cuenta_titular WHERE id_cuenta = $1 AND id_cliente = $2 AND activo
          AND tipo_titularidad IN ('PRINCIPAL', 'COTITULAR_INDISTINTO')`,
        [origen, idc],
      );
      if (!own.rows[0])
        throw problem(403, 'CUENTA_AJENA', 'Cuenta no permitida', 'No puedes transferir desde esa cuenta.');
      const dest = await c.query(
        'SELECT id_cuenta::text AS id FROM banco_core.cuenta WHERE numero_cuenta = $1',
        [destinoNum],
      );
      if (!dest.rows[0])
        throw problem(
          404,
          'CUENTA_DESTINO_NO_ENCONTRADA',
          'Cuenta de destino no encontrada',
          'Verifica el número de la cuenta de destino.',
        );

      consumeOtp(p.sub, b.otp_token); // se consume antes de mover dinero; si la operación falla, hay que pedir otro código
      const r = await c.query(
        'CALL banco_core.sp_transferir($1::uuid, $2::bigint, $3::bigint, $4::numeric, NULL::integer, NULL::bigint)',
        [key, origen, dest.rows[0].id, importe],
      );
      return comprobante(c, String(r.rows[0].p_id_transaccion), concepto);
    });
    res.json(out);
  }),
);
