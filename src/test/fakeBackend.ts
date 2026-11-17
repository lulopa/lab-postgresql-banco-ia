/**
 * BFF simulado en memoria (fetch). Imita lo relevante del contrato:
 * exige Bearer, registra cada llamada, aplica idempotencia por X-Idempotency-Key y
 * escribe en una bitácora al registrar operaciones (como lo hacen los triggers de banco_audit).
 */
import { vi } from 'vitest';
import type { BitacoraEntrada, Rol, TokenResponse } from '@/contracts';
import { useAuthStore } from '@/store/authStore';

export const TEST_TOKEN = 'test-access-token';
export interface Call {
  method: string;
  path: string;
  headers: Headers;
  body: any;
}

const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': type } });

export function createFakeBackend() {
  const calls: Call[] = [];
  const audit: BitacoraEntrada[] = [];
  const byKey = new Map<string, unknown>();
  const state = {
    networkFailures: 0,
    rejectTokenOnce: false,
    nextProblem: null as null | { status: number; body: unknown },
  };
  let seq = 1;
  const now = () => new Date().toISOString();

  const addAudit = (tabla: string, usuario: string, payload: Record<string, unknown>) =>
    audit.unshift({
      id_auditoria: seq++,
      fecha: now(),
      usuario,
      operacion: 'INSERT',
      tabla,
      payload_anterior: null,
      payload_nuevo: payload,
    });

  const page = <T>(items: T[]) => ({ items, pagina: 1, tamano: 20, total: items.length, total_paginas: 1 });

  const handler = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname, headers, body });

    if (state.networkFailures > 0) {
      state.networkFailures--;
      throw new TypeError('Failed to fetch');
    }
    if (url.pathname === '/api/v1/auth/token') return json(200, session('CLIENTE'));
    if (url.pathname === '/api/v1/auth/refresh') return json(200, session('CLIENTE', 'refreshed-token'));
    if (url.pathname === '/api/v1/auth/logout') return new Response(null, { status: 204 });
    if (url.pathname === '/api/v1/auth/otp/solicitar') return json(200, { canal: 'SMS', ttl_segundos: 120 });

    if (state.rejectTokenOnce) {
      state.rejectTokenOnce = false;
      return json(401, { title: 'No autorizado', status: 401 }, 'application/problem+json');
    }
    if (
      headers.get('Authorization') !== `Bearer ${TEST_TOKEN}` &&
      headers.get('Authorization') !== 'Bearer refreshed-token'
    )
      return json(401, { title: 'No autorizado', status: 401 }, 'application/problem+json');
    if (state.nextProblem) {
      const p = state.nextProblem;
      state.nextProblem = null;
      return json(p.status, p.body, 'application/problem+json');
    }

    const key = headers.get('X-Idempotency-Key');
    const idem = <T>(make: () => T): T => {
      if (key && byKey.has(key)) return byKey.get(key) as T;
      const r = make();
      if (key) byKey.set(key, r);
      return r;
    };

    switch (`${method} ${url.pathname}`) {
      case 'GET /api/v1/cliente/posicion-global':
        return json(200, {
          titular: {
            id_persona: 'p1',
            nombres: 'Camila',
            apellidos: 'Restrepo',
            tipo_documento: 'CC',
            numero_documento: '1053000111',
          },
          saldo_consolidado: 2500000,
          cuentas: [
            {
              id_cuenta: 'c1',
              numero_cuenta: '0012345678',
              tipo: 'AHORROS',
              estado: 'ACTIVA',
              moneda: 'COP',
              saldo_disponible: 2500000,
            },
          ],
          tarjetas_credito: [],
          inversiones_cdt: [],
          prestamos: [],
        });
      case 'GET /api/v1/transacciones/historial':
        return json(200, page([]));
      case 'POST /api/v1/transacciones/transferir':
        return json(
          200,
          idem(() => {
            addAudit('banco_core.transaccion', 'cliente', { tipo: 'TRANSFERENCIA', monto: body.monto });
            return {
              id_transaccion: `tx-${seq}`,
              fecha: now(),
              id_cuenta_origen: body.id_cuenta_origen,
              id_cuenta_destino: body.id_cuenta_destino,
              monto: body.monto,
              concepto: body.concepto,
            };
          }),
        );
      case 'POST /api/v1/operativa/caja/consignacion':
        return json(
          200,
          idem(() => {
            addAudit('banco_core.transaccion', 'cajero01', {
              tipo: 'CONSIGNACION',
              monto: body.monto,
              id_cuenta: body.id_cuenta,
            });
            addAudit('banco_core.asiento_contable', 'cajero01', { tipo: 'PARTIDA_DOBLE', monto: body.monto });
            return {
              id_transaccion: `tx-${seq}`,
              fecha: now(),
              tipo: 'CONSIGNACION',
              monto: body.monto,
              id_cuenta: body.id_cuenta,
            };
          }),
        );
      case 'GET /api/v1/auditoria/bitacora':
        return json(200, page(audit));
      case 'GET /api/v1/auditoria/anomalias/divisas':
        return json(200, page([]));
      case 'GET /api/v1/auditoria/anomalias/rafagas':
        return json(200, { ventana_segundos: 300, items: [] });
      case 'GET /api/v1/auditoria/anomalias/durmientes':
        return json(200, page([]));
      case 'GET /api/v1/operativa/caja/cierre':
        return json(200, {
          fecha: now(),
          num_operaciones: 0,
          total_consignaciones: 0,
          total_retiros: 0,
          efectivo_esperado: 0,
          estado: 'ABIERTA',
        });
      default:
        return json(404, { title: 'No encontrado', status: 404 }, 'application/problem+json');
    }
  };

  return {
    calls,
    audit,
    state,
    handler,
    install: () => vi.stubGlobal('fetch', vi.fn(handler)),
    callsTo: (path: string, method = 'POST') => calls.filter((c) => c.path === path && c.method === method),
  };
}

export function session(role: Rol | Rol[], token = TEST_TOKEN): TokenResponse {
  const roles = Array.isArray(role) ? role : [role];
  return {
    access_token: token,
    expires_in: 900,
    usuario: { id_usuario: 'u1', nombre: 'Usuario Prueba', roles },
  };
}

export function loginAs(role: Rol | Rol[], active?: Rol) {
  useAuthStore.getState().setSession(session(role));
  if (active) useAuthStore.getState().selectRole(active);
}
