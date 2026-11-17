import { createHash, randomBytes } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import { Router } from 'express';
import type { Rol, TokenResponse } from '../src/contracts';
import { config } from './config';
import { h, problem } from './problem';
import { consumePkceCode } from './devIdp';
import { issueOtp } from './otp';
import type { Principal } from './types';

const key = new TextEncoder().encode(config.jwtSecret);
const ISS = 'banco-andino-bff';
const AUD = 'banco-andino-web';
const COOKIE = 'andino_rt';

export const signAccess = (p: Principal): Promise<string> =>
  new SignJWT({ roles: p.roles, nm: p.nombre, idc: p.idCliente, idu: p.idUsuario })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(p.sub)
    .setIssuer(ISS)
    .setAudience(AUD)
    .setIssuedAt()
    .setExpirationTime(`${config.accessTtlSeconds}s`)
    .sign(key);

async function verifyAccess(token: string): Promise<Principal> {
  const { payload } = await jwtVerify(token, key, { issuer: ISS, audience: AUD, algorithms: ['HS256'] });
  return {
    sub: String(payload.sub),
    nombre: String(payload.nm),
    roles: payload.roles as Rol[],
    idCliente: payload.idc as string | undefined,
    idUsuario: payload.idu as number | undefined,
  };
}

/** Exige Bearer válido Y el rol del portal. La autoridad final sigue siendo SET ROLE en PostgreSQL. */
export const requireRole =
  (role: Rol): RequestHandler =>
  async (req, res, next) => {
    try {
      const m = /^Bearer (.+)$/.exec(req.get('authorization') ?? '');
      if (!m?.[1]) throw problem(401, 'NO_AUTENTICADO', 'Sesión requerida', 'Inicia sesión para continuar.');
      let p: Principal;
      try {
        p = await verifyAccess(m[1]);
      } catch {
        throw problem(401, 'TOKEN_INVALIDO', 'Sesión expirada', 'Tu sesión expiró. Inicia sesión de nuevo.');
      }
      if (!p.roles.includes(role))
        throw problem(
          403,
          'ROL_INSUFICIENTE',
          'Acceso denegado',
          'Tu rol no permite acceder a este recurso.',
        );
      res.locals.principal = p;
      next();
    } catch (e) {
      next(e);
    }
  };
export const principal = (res: Response): Principal => res.locals.principal as Principal;

// ---- refresh tokens (memoria del proceso; en producción usar almacén compartido) ----
const refreshStore = new Map<string, { p: Principal; exp: number }>();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function cookieOf(req: Request): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return undefined;
}
const cookieAttrs = () =>
  `Path=/api/v1/auth; HttpOnly; SameSite=Strict${config.cookieSecure ? '; Secure' : ''}`;
function setRefresh(res: Response, p: Principal): void {
  const t = randomBytes(32).toString('base64url');
  refreshStore.set(sha(t), { p, exp: Date.now() + config.refreshIdleMs });
  res.append('Set-Cookie', `${COOKIE}=${t}; ${cookieAttrs()}; Max-Age=${config.refreshIdleMs / 1000}`);
}
const clearRefresh = (res: Response) => res.append('Set-Cookie', `${COOKIE}=; ${cookieAttrs()}; Max-Age=0`);

async function session(res: Response, p: Principal): Promise<TokenResponse> {
  setRefresh(res, p);
  return {
    access_token: await signAccess(p),
    expires_in: config.accessTtlSeconds,
    usuario: { id_usuario: p.sub, nombre: p.nombre, roles: p.roles },
  };
}

export const authRouter = Router();

authRouter.post(
  '/token',
  h(async (req, res) => {
    const { code, code_verifier, redirect_uri } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof code !== 'string' || typeof code_verifier !== 'string' || typeof redirect_uri !== 'string')
      throw problem(
        400,
        'SOLICITUD_INVALIDA',
        'Solicitud inválida',
        'Faltan datos para completar el inicio de sesión.',
      );
    const p = consumePkceCode(code, code_verifier, redirect_uri);
    if (!p)
      throw problem(
        401,
        'CODIGO_INVALIDO',
        'No pudimos verificar tu inicio de sesión',
        'El código expiró o no es válido. Inicia sesión de nuevo.',
      );
    res.json(await session(res, p));
  }),
);

authRouter.post(
  '/refresh',
  h(async (req, res) => {
    const t = cookieOf(req);
    const e = t ? refreshStore.get(sha(t)) : undefined;
    if (t) refreshStore.delete(sha(t)); // rotación: cada refresh token sirve una sola vez
    if (!e || Date.now() > e.exp) {
      clearRefresh(res);
      throw problem(401, 'REFRESH_INVALIDO', 'Sesión expirada', 'Inicia sesión de nuevo.');
    }
    res.json(await session(res, e.p));
  }),
);

authRouter.post(
  '/logout',
  h(async (req, res) => {
    const t = cookieOf(req);
    if (t) refreshStore.delete(sha(t));
    clearRefresh(res);
    res.status(204).end();
  }),
);

authRouter.post(
  '/otp/solicitar',
  requireRole('CLIENTE'),
  h(async (req, res) => {
    const proposito = (req.body as { proposito?: unknown } | undefined)?.proposito;
    if (proposito !== 'TRANSFERENCIA' && proposito !== 'CAMBIO_SEGURIDAD')
      throw problem(422, 'PROPOSITO_INVALIDO', 'Solicitud inválida', 'Propósito de OTP no válido.');
    res.json(issueOtp(principal(res).sub));
  }),
);
