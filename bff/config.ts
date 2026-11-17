import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

// Variables desde bff/.env (opcional). La conexión a PostgreSQL usa las variables estándar PGHOST, PGPORT,
// PGDATABASE, PGUSER y PGPASSWORD, que la librería `pg` lee sola.
try {
  process.loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url)));
} catch {
  /* sin bff/.env */
}

const production = process.env.NODE_ENV === 'production';
const devLogin = process.env.DEV_LOGIN === 'true';
if (production && devLogin) throw new Error('DEV_LOGIN no puede activarse con NODE_ENV=production');
if (process.env.DEV_LOGIN_KEY && process.env.DEV_LOGIN_KEY.length < 8)
  throw new Error('DEV_LOGIN_KEY debe tener al menos 8 caracteres');
if (production && !process.env.JWT_SECRET) throw new Error('JWT_SECRET es obligatorio en producción');
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32)
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres');

export const config = {
  port: Number(process.env.BFF_PORT ?? 8080),
  production,
  devLogin,
  // Clave que se pide antes de mostrar los usuarios del login de desarrollo (obligatoria si se expone por túnel).
  devLoginKey: process.env.DEV_LOGIN_KEY ?? '',
  // Sin JWT_SECRET se genera uno al arrancar: las sesiones se pierden al reiniciar (aceptable solo en desarrollo).
  jwtSecret: process.env.JWT_SECRET ?? randomBytes(32).toString('hex'),
  clientId: process.env.OIDC_CLIENT_ID ?? 'banco-andino-web',
  redirectUri: process.env.OIDC_REDIRECT_URI ?? 'http://localhost:5173/auth/callback',
  cookieSecure: production || process.env.COOKIE_SECURE === 'true',
  serveStatic: production || process.env.SERVE_STATIC === 'true',
  accessTtlSeconds: 15 * 60,
  refreshIdleMs: 15 * 60 * 1000,
  otpTtlMs: 120_000,
  otpMaxTries: 5,
  statementTimeoutMs: 20_000,
} as const;
