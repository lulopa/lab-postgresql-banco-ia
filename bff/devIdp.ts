/**
 * PROVEEDOR DE IDENTIDAD DE DESARROLLO (OIDC Authorization Code + PKCE S256).
 * Solo se monta con DEV_LOGIN=true y nunca con NODE_ENV=production. No tiene contraseñas:
 * deja elegir un cliente o usuario interno REAL de la base de datos para probar los tres portales.
 * En producción debe reemplazarse por el IdP del banco.
 */
import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
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
}
function oidcParams(src: Record<string, unknown>): Params {
  const s = (k: string) => (typeof src[k] === 'string' ? (src[k] as string) : '');
  if (
    s('response_type') !== 'code' ||
    s('client_id') !== config.clientId ||
    s('redirect_uri') !== config.redirectUri
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
  return { state: s('state'), nonce: s('nonce'), challenge: s('code_challenge') };
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

export const devIdpRouter = Router();

devIdpRouter.get(
  '/authorize',
  h(async (req, res) => {
    oidcParams(req.query);
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
    const hidden = [
      'response_type',
      'client_id',
      'redirect_uri',
      'code_challenge_method',
      'code_challenge',
      'state',
      'nonce',
    ]
      .map((k) => `<input type="hidden" name="${k}" value="${esc(String(req.query[k] ?? ''))}">`)
      .join('');
    const btn = (id: string, label: string, sub: string) =>
      `<button name="persona" value="${esc(id)}"><strong>${esc(label)}</strong><span>${esc(sub)}</span></button>`;
    const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Acceso de desarrollo</title><style>body{font:16px system-ui;background:#F8FAFC;color:#0F172A;max-width:560px;margin:2rem auto;padding:0 1rem}
.warn{background:#FFF51B;color:#0F172A;padding:.75rem 1rem;border-radius:8px;font-weight:600}h2{margin-top:1.5rem}
button{display:flex;flex-direction:column;align-items:flex-start;width:100%;min-height:48px;margin:.4rem 0;padding:.6rem 1rem;border:1px solid #E2E8F0;border-radius:8px;background:#fff;color:#0F172A;font:inherit;cursor:pointer}
button span{font-size:.85rem;color:#475569}button:hover{border-color:#0087D5}</style>
<p class="warn">Acceso de DESARROLLO sin contraseña. No usar en producción.</p>
<form method="post" action="/dev-idp/login">${hidden}
<h2>Portal Cliente</h2>${clientes.rows.map((r) => btn(`c:${r.id}`, r.nombre, `Cliente #${r.id}`)).join('') || '<p>No hay clientes con cuentas activas.</p>'}
<h2>Portal Operativo y Auditor</h2>${internos.rows.map((r) => btn(`i:${r.id}`, r.username, r.rol === 'CAJERO' ? 'Operativo (cajero)' : 'Auditor')).join('') || '<p>No hay usuarios internos con rol CAJERO o AUDITOR.</p>'}
</form></html>`;
    res
      .type('html')
      .set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'")
      .send(html);
  }),
);

devIdpRouter.post(
  '/login',
  h(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const prm = oidcParams(body);
    const p = typeof body.persona === 'string' ? await lookupPersona(body.persona) : null;
    if (!p) throw problem(400, 'PERSONA_INVALIDA', 'Usuario inválido', 'Elige un usuario de la lista.');
    const code = randomBytes(32).toString('base64url');
    codes.set(code, {
      p,
      challenge: prm.challenge,
      redirectUri: config.redirectUri,
      exp: Date.now() + 60_000,
    });
    const url = new URL(config.redirectUri);
    url.searchParams.set('code', code);
    url.searchParams.set('state', prm.state);
    res.redirect(303, url.toString());
  }),
);
