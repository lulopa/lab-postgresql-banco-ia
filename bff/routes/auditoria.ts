import { Router } from 'express';
import { pool, withRole } from '../db';
import { h } from '../problem';
import { fecha, pagina, paginado } from '../validate';

export const auditoriaRouter = Router();

async function usernames(ids: Array<number | null>): Promise<Map<number, string>> {
  const clean = [...new Set(ids.filter((x): x is number => x !== null))];
  if (!clean.length) return new Map();
  // rol_auditor no tiene acceso al esquema banco_security: se resuelve con la conexión de servicio (solo username).
  const r = await pool.query(
    'SELECT id_usuario, username FROM banco_security.usuario_interno WHERE id_usuario = ANY($1::int[])',
    [clean],
  );
  return new Map(r.rows.map((x) => [Number(x.id_usuario), String(x.username)]));
}
const quien = (id: number | null, m: Map<number, string>) =>
  id === null ? 'sistema' : (m.get(id) ?? `usuario #${id}`);

auditoriaRouter.get(
  '/bitacora',
  h(async (req, res) => {
    const pg = pagina(req.query);
    const desde = fecha(req.query.desde);
    const hasta = fecha(req.query.hasta);
    const tabla =
      typeof req.query.tabla === 'string' && /^[A-Za-z0-9_]{1,50}$/.test(req.query.tabla)
        ? `%${req.query.tabla}%`
        : null;
    let ids: number[] | null = null;
    if (typeof req.query.usuario === 'string' && req.query.usuario.trim()) {
      const u = req.query.usuario.trim();
      if (/^\d{1,9}$/.test(u)) ids = [Number(u)];
      else
        ids = (
          await pool.query('SELECT id_usuario FROM banco_security.usuario_interno WHERE username ILIKE $1', [
            `%${u.replace(/[%_\\]/g, '')}%`,
          ])
        ).rows.map((x) => Number(x.id_usuario));
    }
    const r = await withRole('rol_auditor', (c) =>
      c.query(
        `SELECT a.id_auditoria::text AS id_auditoria, a.fecha_hora AS fecha, a.id_usuario_interno AS uid, a.operacion,
            a.nombre_tabla AS tabla, a.datos_anteriores, a.datos_nuevos, count(*) OVER () AS total
       FROM banco_audit.auditoria_operacion a
      WHERE ($1::date IS NULL OR a.fecha_hora >= $1::date)
        AND ($2::date IS NULL OR a.fecha_hora < ($2::date + 1))
        AND ($3::text IS NULL OR a.nombre_tabla ILIKE $3)
        AND ($4::int[] IS NULL OR a.id_usuario_interno = ANY($4::int[]))
      ORDER BY a.fecha_hora DESC, a.id_auditoria DESC
      LIMIT $5 OFFSET $6`,
        [desde, hasta, tabla, ids, pg.tamano, pg.offset],
      ),
    );
    const names = await usernames(r.rows.map((x) => (x.uid === null ? null : Number(x.uid))));
    res.json(
      paginado(
        r.rows.map((x) => ({
          id_auditoria: x.id_auditoria,
          fecha: x.fecha,
          usuario: quien(x.uid === null ? null : Number(x.uid), names),
          operacion: x.operacion,
          tabla: x.tabla,
          payload_anterior: x.datos_anteriores,
          payload_nuevo: x.datos_nuevos,
        })),
        r.rows[0] ? Number(r.rows[0].total) : 0,
        pg,
      ),
    );
  }),
);

// Documento §3.1: payloads JSONB con moneda <> 'COP' (usa idx_auditoria_moneda_anomala).
auditoriaRouter.get(
  '/anomalias/divisas',
  h(async (req, res) => {
    const pg = pagina(req.query, 50);
    const r = await withRole('rol_auditor', (c) =>
      c.query(
        `SELECT a.id_auditoria::text AS id_auditoria, a.fecha_hora AS fecha, a.id_usuario_interno AS uid, a.nombre_tabla AS tabla,
            a.datos_nuevos ->> 'moneda' AS moneda,
            COALESCE((a.datos_nuevos ->> 'monto')::numeric, (a.datos_nuevos ->> 'saldo_disponible')::numeric, 0) AS monto,
            a.datos_nuevos AS payload, count(*) OVER () AS total
       FROM banco_audit.auditoria_operacion a
      WHERE (a.datos_nuevos ->> 'moneda') IS NOT NULL AND (a.datos_nuevos ->> 'moneda') <> 'COP'
      ORDER BY a.fecha_hora DESC, a.id_auditoria DESC LIMIT $1 OFFSET $2`,
        [pg.tamano, pg.offset],
      ),
    );
    const names = await usernames(r.rows.map((x) => (x.uid === null ? null : Number(x.uid))));
    res.json(
      paginado(
        r.rows.map((x) => ({
          id_auditoria: x.id_auditoria,
          fecha: x.fecha,
          usuario: quien(x.uid === null ? null : Number(x.uid), names),
          tabla: x.tabla,
          moneda: x.moneda,
          monto: Number(x.monto),
          payload: x.payload,
        })),
        r.rows[0] ? Number(r.rows[0].total) : 0,
        pg,
      ),
    );
  }),
);

/** Ráfagas: ≥ 3 débitos POSTED de una misma cuenta, cada uno a menos de `ventana_segundos` (por defecto 300) del anterior. */
auditoriaRouter.get(
  '/anomalias/rafagas',
  h(async (req, res) => {
    const ventana = Math.min(
      3600,
      Math.max(1, Number.parseInt(String(req.query.ventana_segundos ?? '300'), 10) || 300),
    );
    const r = await withRole('rol_auditor', (c) =>
      c.query(
        `WITH t AS (
        SELECT id_transaccion, id_cuenta_origen AS id_cuenta, fecha_transaccion AS f, monto,
               lag(fecha_transaccion) OVER (PARTITION BY id_cuenta_origen ORDER BY fecha_transaccion, id_transaccion) AS prev
          FROM banco_core.transaccion WHERE id_estado_transaccion = 2 AND id_cuenta_origen IS NOT NULL),
      m AS (
        SELECT *, sum(CASE WHEN prev IS NULL OR f - prev >= make_interval(secs => $1::int) THEN 1 ELSE 0 END)
                    OVER (PARTITION BY id_cuenta ORDER BY f, id_transaccion) AS grp FROM t)
     SELECT m.id_cuenta::text AS id_cuenta, cu.numero_cuenta, count(*)::int AS cantidad, min(m.f) AS primera, max(m.f) AS ultima,
            sum(m.monto) AS monto_total, array_agg(m.id_transaccion::text ORDER BY m.f, m.id_transaccion) AS ids
       FROM m JOIN banco_core.cuenta cu ON cu.id_cuenta = m.id_cuenta
      GROUP BY m.id_cuenta, cu.numero_cuenta, m.grp HAVING count(*) >= 3
      ORDER BY max(m.f) DESC LIMIT 100`,
        [ventana],
      ),
    );
    res.json({
      ventana_segundos: ventana,
      items: r.rows.map((x) => ({
        id_cuenta: x.id_cuenta,
        numero_cuenta: x.numero_cuenta,
        cantidad: x.cantidad,
        primera: x.primera,
        ultima: x.ultima,
        monto_total: Number(x.monto_total),
        ids_transaccion: x.ids,
      })),
    });
  }),
);

// "Durmientes" = cuentas en estado INACTIVA (id 5). Solo lectura: rol_auditor no puede modificar cuentas.
auditoriaRouter.get(
  '/anomalias/durmientes',
  h(async (req, res) => {
    const pg = pagina(req.query, 50);
    const r = await withRole('rol_auditor', (c) =>
      c.query(
        `SELECT cu.id_cuenta::text AS id_cuenta, cu.numero_cuenta, COALESCE(u.ultima, cu.fecha_apertura) AS ultima_actividad,
            floor(extract(epoch FROM (now() - COALESCE(u.ultima, cu.fecha_apertura))) / 86400)::int AS dias_inactiva,
            count(*) OVER () AS total
       FROM banco_core.cuenta cu
       LEFT JOIN LATERAL (SELECT max(t.fecha_transaccion) AS ultima FROM banco_core.transaccion t
                           WHERE t.id_cuenta_origen = cu.id_cuenta OR t.id_cuenta_destino = cu.id_cuenta) u ON true
      WHERE cu.id_estado_cuenta = 5
      ORDER BY ultima_actividad ASC LIMIT $1 OFFSET $2`,
        [pg.tamano, pg.offset],
      ),
    );
    res.json(
      paginado(
        r.rows.map((x) => ({
          id_cuenta: x.id_cuenta,
          numero_cuenta: x.numero_cuenta,
          ultima_actividad: x.ultima_actividad,
          dias_inactiva: x.dias_inactiva,
          estado: 'INACTIVA',
        })),
        r.rows[0] ? Number(r.rows[0].total) : 0,
        pg,
      ),
    );
  }),
);
