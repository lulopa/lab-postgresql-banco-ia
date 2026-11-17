import pg from 'pg';
import { config } from './config';

/** Conexión de servicio (variables PG*). Solo para catálogo de usuarios del login de desarrollo y lecturas auxiliares. */
export const pool = new pg.Pool({ max: 10 });
pool.on('error', (e) => console.error('[bff] pool', (e as { code?: string }).code ?? ''));

export type DbRole = 'rol_consulta' | 'rol_operativo' | 'rol_auditor';
const ALLOWED: ReadonlySet<string> = new Set<DbRole>(['rol_consulta', 'rol_operativo', 'rol_auditor']);

/**
 * Ejecuta `fn` en una transacción con `SET LOCAL ROLE`, de modo que PostgreSQL aplique los permisos del rol
 * (rol_consulta / rol_operativo / rol_auditor) aunque el BFF tuviera un error de autorización.
 * Los roles no tienen LOGIN: el usuario de conexión debe ser miembro de ellos (ver README del BFF).
 */
export async function withRole<T>(
  role: DbRole,
  fn: (c: pg.PoolClient) => Promise<T>,
  actorUsuario?: number,
): Promise<T> {
  if (!ALLOWED.has(role)) throw new Error('rol no permitido');
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SET LOCAL ROLE ${role}`);
    await c.query(`SET LOCAL statement_timeout = ${Math.trunc(config.statementTimeoutMs)}`);
    // Atribución en la bitácora (la lee fn_trg_auditoria_generica).
    if (actorUsuario !== undefined)
      await c.query(`SELECT set_config('andino.usuario_interno', $1, true)`, [String(actorUsuario)]);
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}
