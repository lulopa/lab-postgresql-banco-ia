/**
 * COMPARTIDO (Dev A + Dev B). Cliente HTTP base.
 *
 * Seguridad:
 *  - El access token vive solo en memoria (lo entrega un hook registrado por authStore).
 *  - credentials:'include' envía la cookie HttpOnly SameSite=Strict del refresh token (solo al BFF).
 *  - Errores normalizados a RFC 7807 (ApiError.problem).
 *  - 401 => un único intento de refresh (single-flight en authStore) y un reintento con LAS MISMAS
 *    cabeceras, incluida X-Idempotency-Key, para que el reintento sea idempotente.
 *  - Nada de lo enviado/recibido se escribe en logs ni en storage; cache:'no-store'.
 */
import { env } from '@/config/env';
import type { ProblemDetails } from '@/contracts';
import { isUuidV4 } from '@/utils/uuid';

export class ApiError extends Error {
  constructor(public readonly problem: ProblemDetails) {
    super(problem.detalle || problem.titulo);
    this.name = 'ApiError';
  }
  get status(): number {
    return this.problem.estado;
  }
  /** true cuando el resultado de la petición es desconocido (red caída, timeout, 5xx). */
  get outcomeUnknown(): boolean {
    return this.problem.estado === 0 || this.problem.estado === 408 || this.problem.estado >= 500;
  }
}

export interface AuthHooks {
  getAccessToken(): string | null;
  refresh(): Promise<string | null>;
  onSessionLost(): void;
}
let hooks: AuthHooks = { getAccessToken: () => null, refresh: async () => null, onSessionLost: () => {} };
export const configureAuthHooks = (h: AuthHooks): void => {
  hooks = h;
};

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** No adjuntar Authorization (login/refresh). */
  skipAuth?: boolean;
  /** No intentar refresh ante 401 (evita bucles). */
  skipRefresh?: boolean;
}

/** Normaliza cualquier cuerpo de error al formato del documento (acepta claves RFC 7807 en inglés). */
export function normalizeProblem(status: number, raw: unknown): ProblemDetails {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (...keys: string[]): string | undefined => {
    for (const k of keys) if (typeof o[k] === 'string' && o[k]) return o[k] as string;
    return undefined;
  };
  return {
    estado: typeof o.estado === 'number' ? o.estado : typeof o.status === 'number' ? o.status : status,
    titulo: str('titulo', 'title') ?? 'No se pudo completar la operación',
    detalle: str('detalle', 'detail') ?? 'Intenta de nuevo más tarde.',
    codigo_error: str('codigo_error', 'code') ?? `HTTP_${status}`,
    tipo: str('tipo', 'type'),
    instancia: str('instancia', 'instance'),
    errores: (o.errores as Record<string, string[]> | undefined) ?? undefined,
  };
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${env.apiBaseUrl}${path}`;
  if (!query) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query))
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

async function send(path: string, opts: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token && !opts.skipAuth) headers.Authorization = `Bearer ${token}`;
  if (opts.idempotencyKey !== undefined) {
    // Un UUID mal formado es un bug del cliente: fallar antes de enviar.
    if (!isUuidV4(opts.idempotencyKey)) throw new Error('X-Idempotency-Key debe ser un UUID v4');
    headers['X-Idempotency-Key'] = opts.idempotencyKey;
  }
  try {
    return await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'include',
      cache: 'no-store',
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError({
      estado: 0,
      titulo: 'Sin conexión',
      detalle: 'No pudimos comunicarnos con el banco. Verifica tu conexión e intenta de nuevo.',
      codigo_error: 'NETWORK_ERROR',
    });
  }
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await send(path, opts, hooks.getAccessToken());

  if (res.status === 401 && !opts.skipAuth && !opts.skipRefresh) {
    const fresh = await hooks.refresh();
    if (!fresh) {
      hooks.onSessionLost();
    } else {
      res = await send(path, opts, fresh);
    }
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    const err = new ApiError(normalizeProblem(res.status, body));
    if (res.status === 401 && !opts.skipAuth) hooks.onSessionLost();
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
