/**
 * PROVEEDOR DE IDENTIDAD DE DESARROLLO (OIDC Authorization Code + PKCE S256).
 * Solo se monta con DEV_LOGIN=true y nunca con NODE_ENV=production. No tiene contraseñas:
 * deja elegir un cliente o usuario interno REAL de la base de datos para probar los tres portales.
 * En producción debe reemplazarse por el IdP del banco.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Rol } from '../src/contracts';
import { config } from './config';
import { pool } from './db';
import { h, problem } from './problem';
import type { Principal } from './types';

interface Pending {
  p: Principal;
  challenge: string;
  redirectUri: string;
  exp: number;
}
const codes = new Map<string, Pending>();

export function consumePkceCode(code: string, verifier: string, redirectUri: string): Principal | null {
  const e = codes.get(code);
  codes.delete(code); // un solo uso
  if (
    !e ||
    Date.now() > e.exp ||
    e.redirectUri !== redirectUri ||
    !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)
  )
    return null;
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return challenge === e.challenge ? e.p : null;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
const ROL_INTERNO: Record<string, Rol> = { CAJERO: 'OPERATIVO', AUDITOR: 'AUDITOR' };

interface Params {
  state: string;
  nonce: string;
  challenge: string;
  redirectUri: string;
}

/**
 * redirect_uri permitido: el configurado (OIDC_REDIRECT_URI) o, en el login de desarrollo, la ruta /auth/callback
 * del MISMO host desde el que se está usando (localhost, túnel público...). Un enlace manipulado hacia otro
 * dominio sigue rechazado porque su host no coincide con el de esta petición.
 */
function redirectAllowed(uri: string, req: Request): boolean {
  if (uri === config.redirectUri) return true;
  try {
    const u = new URL(uri);
    return u.pathname === '/auth/callback' && !u.search && !u.hash && u.host === req.get('host');
  } catch {
    return false;
  }
}

function oidcParams(src: Record<string, unknown>, req: Request): Params {
  const s = (k: string) => (typeof src[k] === 'string' ? (src[k] as string) : '');
  if (
    s('response_type') !== 'code' ||
    s('client_id') !== config.clientId ||
    !redirectAllowed(s('redirect_uri'), req)
  )
    throw problem(
      400,
      'OIDC_PARAMETROS',
      'Parámetros OIDC inválidos',
      'client_id o redirect_uri no coinciden con la configuración.',
    );
  if (s('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(s('code_challenge')))
    throw problem(400, 'OIDC_PKCE', 'PKCE requerido', 'Se exige code_challenge S256.');
  if (!s('state') || s('state').length > 200)
    throw problem(400, 'OIDC_STATE', 'State requerido', 'Falta el parámetro state.');
  return {
    state: s('state'),
    nonce: s('nonce'),
    challenge: s('code_challenge'),
    redirectUri: s('redirect_uri'),
  };
}

async function lookupPersona(id: string): Promise<Principal | null> {
  const [kind, raw] = id.split(':');
  if (!raw || !/^\d{1,18}$/.test(raw)) return null;
  if (kind === 'c') {
    const r = await pool.query(
      `SELECT nombre_o_razon_social AS nombre FROM banco_core.vw_resumen_cliente WHERE id_cliente = $1`,
      [raw],
    );
    return r.rows[0]
      ? { sub: `cliente:${raw}`, nombre: String(r.rows[0].nombre), roles: ['CLIENTE'], idCliente: raw }
      : null;
  }
  if (kind === 'i') {
    const r = await pool.query(
      `SELECT u.id_usuario, u.username, r.nombre AS rol FROM banco_security.usuario_interno u
         JOIN banco_security.usuario_rol ur ON ur.id_usuario = u.id_usuario
         JOIN banco_security.rol r ON r.id_rol = ur.id_rol
        WHERE u.activo AND u.id_usuario = $1 AND r.nombre = ANY($2)`,
      [raw, Object.keys(ROL_INTERNO)],
    );
    const row = r.rows[0] as { id_usuario: number; username: string; rol: string } | undefined;
    const rol = row && ROL_INTERNO[row.rol];
    return row && rol
      ? { sub: `interno:${row.id_usuario}`, nombre: row.username, roles: [rol], idUsuario: row.id_usuario }
      : null;
  }
  return null;
}

const OIDC_FIELDS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge_method',
  'code_challenge',
  'state',
  'nonce',
] as const;
const hiddenFields = (src: Record<string, unknown>) =>
  OIDC_FIELDS.map((k) => `<input type="hidden" name="${k}" value="${esc(String(src[k] ?? ''))}">`).join('');

const CSS = `body{font:16px system-ui;background:#F8FAFC;color:#0F172A;max-width:560px;margin:2rem auto;padding:0 1rem}
.warn{background:#FFF51B;color:#0F172A;padding:.75rem 1rem;border-radius:8px;font-weight:600}.err{color:#B5360A;font-weight:600}h2{margin-top:1.5rem}
input[type=password]{width:100%;min-height:48px;padding:.6rem 1rem;border:1px solid #64748B;border-radius:8px;font:inherit;box-sizing:border-box}
button{display:flex;flex-direction:column;align-items:flex-start;width:100%;min-height:48px;margin:.4rem 0;padding:.6rem 1rem;border:1px solid #E2E8F0;border-radius:8px;background:#fff;color:#0F172A;font:inherit;cursor:pointer}
button span{font-size:.85rem;color:#475569}button:hover{border-color:#0087D5}`;
const page = (body: string) =>
  `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acceso de desarrollo</title><style>${CSS}</style>${body}</html>`;
const send = (res: Response, html: string, status = 200) =>
  res
    .status(status)
    .type('html')
    .set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'")
    .send(html);

// ---- Clave de acceso (DEV_LOGIN_KEY). Obligatoria si la app se expone por un túnel público. ----
const failures = new Map<string, { n: number; until: number }>();
const digest = (v: string) => createHash('sha256').update(v).digest();
const keyRequired = () => config.devLoginKey !== '';

function checkKey(given: unknown, ip: string): 'ok' | 'bad' | 'locked' {
  const f = failures.get(ip);
  const active = f && Date.now() < f.until ? f : undefined;
  if (active && active.n >= 8) return 'locked'; // 8 fallos => bloqueo de 10 minutos por IP
  if (typeof given === 'string' && timingSafeEqual(digest(given), digest(config.devLoginKey))) {
    failures.delete(ip);
    return 'ok';
  }
  failures.set(ip, { n: (active?.n ?? 0) + 1, until: Date.now() + 10 * 60_000 });
  return 'bad';
}

const unlockPage = (src: Record<string, unknown>, error?: string) =>
  page(`<p class="warn">Acceso de DESARROLLO protegido con clave.</p>
<form method="post" action="/dev-idp/unlock">${hiddenFields(src)}
<h2><label for="k">Clave de acceso</label></h2>
${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
<input id="k" type="password" name="access_key" autocomplete="off" required>
<button type="submit"><strong>Continuar</strong></button></form>`);

async function personasPage(src: Record<string, unknown>, accessKey?: string): Promise<string> {
  const clientes = await pool.query(
    `SELECT v.id_cliente::text AS id, v.nombre_o_razon_social AS nombre FROM banco_core.vw_resumen_cliente v
      WHERE v.tipo_cliente = 'NATURAL' AND EXISTS (SELECT 1 FROM banco_core.cuenta_titular ct JOIN banco_core.cuenta cu USING (id_cuenta)
            WHERE ct.id_cliente = v.id_cliente AND ct.activo AND cu.id_estado_cuenta = 2 AND cu.saldo_disponible > 0)
      ORDER BY v.id_cliente LIMIT 6`,
  );
  const internos = await pool.query(
    `(SELECT u.id_usuario::text AS id, u.username, r.nombre AS rol FROM banco_security.usuario_interno u JOIN banco_security.usuario_rol ur ON ur.id_usuario = u.id_usuario
        JOIN banco_security.rol r ON r.id_rol = ur.id_rol WHERE u.activo AND r.nombre = 'CAJERO' ORDER BY u.id_usuario LIMIT 3)
     UNION ALL
     (SELECT u.id_usuario::text, u.username, r.nombre FROM banco_security.usuario_interno u JOIN banco_security.usuario_rol ur ON ur.id_usuario = u.id_usuario
        JOIN banco_security.rol r ON r.id_rol = ur.id_rol WHERE u.activo AND r.nombre = 'AUDITOR' ORDER BY u.id_usuario LIMIT 3)`,
  );
  const btn = (id: string, label: string, sub: string) =>
    `<button name="persona" value="${esc(id)}"><strong>${esc(label)}</strong><span>${esc(sub)}</span></button>`;
  const keyField = accessKey ? `<input type="hidden" name="access_key" value="${esc(accessKey)}">` : '';
  return page(`<p class="warn">Acceso de DESARROLLO sin contraseña de usuario. No usar en producción.</p>
<form method="post" action="/dev-idp/login">${hiddenFields(src)}${keyField}
<h2>Portal Cliente</h2>${clientes.rows.map((r) => btn(`c:${r.id}`, r.nombre, `Cliente #${r.id}`)).join('') || '<p>No hay clientes con cuentas activas.</p>'}
<h2>Portal Operativo y Auditor</h2>${internos.rows.map((r) => btn(`i:${r.id}`, r.username, r.rol === 'CAJERO' ? 'Operativo (cajero)' : 'Auditor')).join('') || '<p>No hay usuarios internos con rol CAJERO o AUDITOR.</p>'}
</form>`);
}

export const devIdpRouter = Router();

devIdpRouter.get(
  '/authorize',
  h(async (req, res) => {
    oidcParams(req.query, req);
    send(res, keyRequired() ? unlockPage(req.query) : await personasPage(req.query));
  }),
);

devIdpRouter.post(
  '/unlock',
  h(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    oidcParams(body, req);
    if (!keyRequired()) return send(res, await personasPage(body));
    const r = checkKey(body.access_key, req.ip ?? 'desconocida');
    if (r === 'ok') return send(res, await personasPage(body, String(body.access_key)));
    if (r === 'locked') return send(res, unlockPage(body, 'Demasiados intentos. Espera 10 minutos.'), 429);
    send(res, unlockPage(body, 'Clave incorrecta.'), 401);
  }),
);

devIdpRouter.post(
  '/login',
  h(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const prm = oidcParams(body, req);
    if (keyRequired() && checkKey(body.access_key, req.ip ?? 'desconocida') !== 'ok')
      throw problem(401, 'CLAVE_INCORRECTA', 'Acceso denegado', 'La clave de acceso no es válida.');
    const p = typeof body.persona === 'string' ? await lookupPersona(body.persona) : null;
    if (!p) throw problem(400, 'PERSONA_INVALIDA', 'Usuario inválido', 'Elige un usuario de la lista.');
    const code = randomBytes(32).toString('base64url');
    codes.set(code, {
      p,
      challenge: prm.challenge,
      redirectUri: prm.redirectUri,
      exp: Date.now() + 60_000,
    });
    const url = new URL(prm.redirectUri);
    url.searchParams.set('code', code);
    url.searchParams.set('state', prm.state);
    res.redirect(303, url.toString());
  }),
);
