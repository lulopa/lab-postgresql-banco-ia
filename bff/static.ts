/**
 * Servidor de producción del SPA (mismo origen que la API: encaja con cookies SameSite=Strict).
 *  - Sirve dist/ con Brotli/Gzip precomprimidos (scripts/precompress.mjs).
 *  - CSP y demás cabeceras de seguridad como CABECERAS HTTP (en <meta> no funcionan frame-ancestors ni report).
 *  - Caché larga e inmutable para /assets (con hash), sin caché para index.html.
 *  - Fallback de SPA; las rutas privadas llevan X-Robots-Tag: noindex.
 * En un despliegue con nginx/CDN, replicar estas cabeceras allí.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { config } from './config';

const DIST = path.resolve(process.cwd(), process.env.STATIC_DIR ?? 'dist');
const MIME: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');
const PRIVATE = /^\/(cliente|auditoria|operativa)(\/|$)/;

function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  if (req.path.startsWith('/api') || req.path.startsWith('/dev-idp')) return next();
  res.set({
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  if (config.cookieSecure) res.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  if (PRIVATE.test(req.path)) res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
}

function cacheHeader(file: string): string {
  return file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
}

function sendPrecompressed(file: string, req: Request, res: Response): boolean {
  const type = MIME[path.extname(file)];
  if (!type) return false;
  const accept = req.get('accept-encoding') ?? '';
  for (const [enc, suffix] of [
    ['br', '.br'],
    ['gzip', '.gz'],
  ] as const) {
    if (accept.includes(enc) && existsSync(file + suffix)) {
      res.set({
        'Content-Encoding': enc,
        Vary: 'Accept-Encoding',
        'Content-Type': type,
        'Cache-Control': cacheHeader(file),
      });
      res.sendFile(file + suffix);
      return true;
    }
  }
  return false;
}

export function mountStatic(app: Express): void {
  if (!existsSync(DIST)) {
    console.warn(`SERVE_STATIC activo pero no existe ${DIST}. Ejecuta "npm run build" primero.`);
    return;
  }
  app.use(securityHeaders);
  app.use((req, res, next) => {
    if (
      (req.method !== 'GET' && req.method !== 'HEAD') ||
      req.path.startsWith('/api') ||
      req.path.includes('..')
    )
      return next();
    const rel = decodeURIComponent(req.path);
    const file = path.join(DIST, rel === '/' ? 'index.html' : rel);
    if (file.startsWith(DIST) && sendPrecompressed(file, req, res)) return;
    next();
  });
  app.use(
    express.static(DIST, {
      index: false,
      setHeaders: (res, file) => res.set('Cache-Control', cacheHeader(file)),
    }),
  );
  // Fallback del SPA: cualquier GET de navegación que no sea API.
  app.get(/^\/(?!api\/|dev-idp\/).*/, (req, res) => {
    const index = path.join(DIST, 'index.html');
    if (!sendPrecompressed(index, req, res)) res.set('Cache-Control', 'no-cache').sendFile(index);
  });
}
