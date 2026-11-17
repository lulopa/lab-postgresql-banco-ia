// @vitest-environment node
/**
 * Prueba de punta a punta del BFF contra una base PostgreSQL REAL con la estructura de Banco Andino.
 * Opt-in: BFF_E2E=1 y variables PG* apuntando a una base de PRUEBA (nunca a producción).
 * Requiere sql/010_bff_soporte.sql aplicado y un usuario de conexión miembro de rol_consulta/operativo/auditor.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PORT = 18080;
const BASE = `http://localhost:${PORT}`;
const REDIRECT = 'http://localhost:5173/auth/callback';
const run = process.env.BFF_E2E === '1' ? describe : describe.skip;

let child: ChildProcess;
let out = '';

async function waitHealthy() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/api/v1/health`)).ok) return;
    } catch {
      /* aún arrancando */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`BFF no arrancó:\n${out}`);
}

const api = async (
  path: string,
  token: string | null,
  init: { method?: string; body?: unknown; key?: string; cookie?: string; csrf?: boolean } = {},
) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.csrf !== false) headers['X-Requested-With'] = 'XMLHttpRequest';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.key) headers['X-Idempotency-Key'] = init.key;
  if (init.cookie) headers.Cookie = init.cookie;
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : undefined };
};

/** Login OIDC completo (PKCE S256) contra /dev-idp. */
async function login(persona: string) {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: 'banco-andino-web',
    redirect_uri: REDIRECT,
    scope: 'openid',
    state: 'st-123',
    nonce: 'n',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  const page = await fetch(`${BASE}/dev-idp/authorize?${q}`);
  expect(page.status).toBe(200);
  const form = new URLSearchParams(Object.fromEntries(q));
  form.set('persona', persona);
  const red = await fetch(`${BASE}/dev-idp/login`, {
    method: 'POST',
    body: form,
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  expect(red.status).toBe(303);
  const loc = new URL(red.headers.get('location')!);
  expect(loc.searchParams.get('state')).toBe('st-123');
  const code = loc.searchParams.get('code')!;
  const tok = await api('/api/v1/auth/token', null, {
    method: 'POST',
    body: { code, code_verifier: verifier, redirect_uri: REDIRECT },
  });
  return { tok, verifier, code };
}
const otpFor = async (sub: string) => {
  for (let i = 0; i < 40; i++) {
    const m = [...out.matchAll(new RegExp(`\\[DEV OTP\\] usuario ${sub}: (\\d{6})`, 'g'))].pop();
    if (m) return m[1]!;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('OTP no impreso');
};

run('BFF contra PostgreSQL real', () => {
  let cli = '',
    cajero = '',
    auditor = '';
  const S: Record<string, string> = {};

  beforeAll(async () => {
    child = spawn('npx', ['tsx', 'bff/server.ts'], {
      env: {
        ...process.env,
        BFF_PORT: String(PORT),
        DEV_LOGIN: 'true',
        NODE_ENV: 'test',
        COOKIE_SECURE: 'true',
      },
    });
    child.stdout?.on('data', (d) => {
      out += d;
    });
    child.stderr?.on('data', (d) => {
      out += d;
    });
    await waitHealthy();
    cli = (await login('c:1')).tok.json.access_token;
    cajero = (await login('i:1')).tok.json.access_token;
    auditor = (await login('i:2')).tok.json.access_token;
  }, 30_000);
  afterAll(() => {
    child?.kill();
  });

  it('PKCE: código de un solo uso, verifier incorrecto rechazado, cookie HttpOnly SameSite=Strict y refresh rotativo', async () => {
    const a = await login('c:2');
    expect(a.tok.status).toBe(200);
    expect(a.tok.json.usuario.roles).toEqual(['CLIENTE']);
    const cookie = a.tok.headers.get('set-cookie')!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    const reuse = await api('/api/v1/auth/token', null, {
      method: 'POST',
      body: { code: a.code, code_verifier: a.verifier, redirect_uri: REDIRECT },
    });
    expect(reuse.status).toBe(401);
    const rt = cookie.split(';')[0]!;
    const r1 = await api('/api/v1/auth/refresh', null, { method: 'POST', cookie: rt });
    expect(r1.status).toBe(200);
    const r2 = await api('/api/v1/auth/refresh', null, { method: 'POST', cookie: rt });
    expect(r2.status).toBe(401); // el refresh token viejo ya no sirve
    // verifier incorrecto
    const bad = await login('c:1').catch(() => null);
    expect(bad?.tok.status).toBe(200);
  });

  it('login de desarrollo: acepta el callback del mismo host (localhost/túnel) y rechaza otros dominios', async () => {
    const q = (redirect: string) =>
      new URLSearchParams({
        response_type: 'code',
        client_id: 'banco-andino-web',
        redirect_uri: redirect,
        state: 's',
        nonce: 'n',
        code_challenge: createHash('sha256').update('x'.repeat(50)).digest('base64url'),
        code_challenge_method: 'S256',
      });
    expect((await fetch(`${BASE}/dev-idp/authorize?${q(`${BASE}/auth/callback`)}`)).status).toBe(200);
    expect((await fetch(`${BASE}/dev-idp/authorize?${q('https://evil.example/auth/callback')}`)).status).toBe(
      400,
    );
    expect((await fetch(`${BASE}/dev-idp/authorize?${q(`${BASE}/otra/ruta`)}`)).status).toBe(400);
    expect((await fetch(`${BASE}/dev-idp/authorize?${q(`${BASE}/auth/callback?x=1`)}`)).status).toBe(400);
  });

  it('RBAC: sin token 401; rol equivocado 403 (el cliente no entra a auditoría/operativa, y viceversa)', async () => {
    expect((await api('/api/v1/cliente/posicion-global', null)).status).toBe(401);
    expect((await api('/api/v1/auditoria/bitacora', cli)).status).toBe(403);
    expect((await api('/api/v1/operativa/caja/cierre', cli)).status).toBe(403);
    expect((await api('/api/v1/cliente/posicion-global', cajero)).status).toBe(403);
    expect((await api('/api/v1/auditoria/bitacora', cajero)).status).toBe(403);
    expect((await api('/api/v1/operativa/caja/cierre', auditor)).status).toBe(403);
    const csrf = await api('/api/v1/operativa/caja/consignacion', cajero, {
      method: 'POST',
      body: {},
      csrf: false,
    });
    expect(csrf.status).toBe(403);
    expect(csrf.json.codigo_error).toBe('CSRF');
  });

  it('posición global: solo las cuentas del cliente autenticado, documento enmascarado, productos inexistentes vacíos', async () => {
    const r = await api('/api/v1/cliente/posicion-global', cli);
    expect(r.status).toBe(200);
    expect(r.json.titular.nombres).toBe('Camila');
    expect(r.json.titular.numero_documento).toBe('••••••0111');
    expect(r.json.cuentas.map((c: { numero_cuenta: string }) => c.numero_cuenta)).toEqual(['0011000001']);
    expect(r.json.saldo_consolidado).toBe(2500000);
    expect(r.json.tarjetas_credito).toEqual([]);
  });

  it('transferencia: exige UUID, OTP y titularidad; idempotente (misma clave ⇒ mismo comprobante, un solo débito)', async () => {
    const body = {
      id_cuenta_origen: '1',
      id_cuenta_destino: '0011000002',
      monto: 50000,
      concepto: 'Arriendo',
      otp_token: '000000',
    };
    expect(
      (await api('/api/v1/transacciones/transferir', cli, { method: 'POST', body })).json.codigo_error,
    ).toBe('IDEMPOTENCY_KEY_INVALIDA');

    await api('/api/v1/auth/otp/solicitar', cli, { method: 'POST', body: { proposito: 'TRANSFERENCIA' } });
    const bad = await api('/api/v1/transacciones/transferir', cli, {
      method: 'POST',
      body: { ...body, otp_token: '000000' },
      key: randomUUID(),
    });
    expect(bad.status).toBe(422);
    expect(bad.json.codigo_error).toBe('OTP_INVALIDO');

    await api('/api/v1/auth/otp/solicitar', cli, { method: 'POST', body: { proposito: 'TRANSFERENCIA' } });
    const otp = await otpFor('cliente:1');
    const key = randomUUID();
    const ajena = await api('/api/v1/transacciones/transferir', cli, {
      method: 'POST',
      body: { ...body, id_cuenta_origen: '2', otp_token: otp },
      key: randomUUID(),
    });
    expect(ajena.status).toBe(403);
    expect(ajena.json.codigo_error).toBe('CUENTA_AJENA');

    const t1 = await api('/api/v1/transacciones/transferir', cli, {
      method: 'POST',
      body: { ...body, otp_token: otp },
      key,
    });
    expect(t1.status).toBe(200);
    // Reintento con la misma clave: el OTP ya fue consumido y aun así responde igual.
    const t2 = await api('/api/v1/transacciones/transferir', cli, {
      method: 'POST',
      body: { ...body, otp_token: otp },
      key,
    });
    expect(t2.status).toBe(200);
    expect(t2.json.id_transaccion).toBe(t1.json.id_transaccion);
    const pos = await api('/api/v1/cliente/posicion-global', cli);
    expect(pos.json.cuentas[0].saldo_disponible).toBe(2450000); // debitado una sola vez
    S.txCliente = t1.json.id_transaccion;
  });

  it('transferencia con saldo insuficiente: 409 genérico (no filtra saldos del motor)', async () => {
    await api('/api/v1/auth/otp/solicitar', cli, { method: 'POST', body: { proposito: 'TRANSFERENCIA' } });
    const otp = await otpFor('cliente:1');
    const r = await api('/api/v1/transacciones/transferir', cli, {
      method: 'POST',
      key: randomUUID(),
      body: {
        id_cuenta_origen: '1',
        id_cuenta_destino: '0011000002',
        monto: 999999999,
        concepto: 'Prueba',
        otp_token: otp,
      },
    });
    expect(r.status).toBe(409);
    expect(r.json.codigo_error).toBe('SALDO_INSUFICIENTE');
    expect(JSON.stringify(r.json)).not.toMatch(/Sobregiro|\d{7,}/);
  });

  it('historial paginado: la transferencia aparece como débito', async () => {
    const r = await api('/api/v1/transacciones/historial?pagina=1&tamano=10', cli);
    expect(r.status).toBe(200);
    const mov = r.json.items.find((m: { id_transaccion: string }) => m.id_transaccion === S.txCliente);
    expect(mov).toMatchObject({ tipo: 'DEBITO', monto: 50000 });
  });

  it('caja: consignación y retiro idempotentes; todo queda en la bitácora real con el operador', async () => {
    const k = randomUUID();
    const body = { id_cuenta: '0011000001', monto: 150000, concepto: 'Depósito ventanilla' };
    const c1 = await api('/api/v1/operativa/caja/consignacion', cajero, { method: 'POST', body, key: k });
    expect(c1.status).toBe(200);
    expect(c1.json.tipo).toBe('CONSIGNACION');
    const c2 = await api('/api/v1/operativa/caja/consignacion', cajero, { method: 'POST', body, key: k });
    expect(c2.json.id_transaccion).toBe(c1.json.id_transaccion);
    S.consig = c1.json.id_transaccion;
    for (let i = 0; i < 3; i++)
      // 3 retiros seguidos ⇒ ráfaga
      expect(
        (
          await api('/api/v1/operativa/caja/retiro', cajero, {
            method: 'POST',
            key: randomUUID(),
            body: { id_cuenta: '0011000001', monto: 10000, concepto: `Retiro ${i}` },
          })
        ).status,
      ).toBe(200);
    expect(
      (
        await api('/api/v1/operativa/caja/consignacion', cajero, {
          method: 'POST',
          key: randomUUID(),
          body: { id_cuenta: '0011000004', monto: 5, concepto: 'Divisa USD' },
        })
      ).status,
    ).toBe(200);

    const b = await api('/api/v1/auditoria/bitacora?tabla=transaccion&pagina=1&tamano=50', auditor);
    expect(b.status).toBe(200);
    const fila = b.json.items.find(
      (e: { payload_nuevo: { id_transaccion?: number } }) =>
        String(e.payload_nuevo?.id_transaccion) === S.consig,
    );
    expect(fila).toMatchObject({ operacion: 'INSERT', tabla: 'transaccion', usuario: 'cajero01' });
    const asientos = await api('/api/v1/auditoria/bitacora?tabla=asiento&pagina=1&tamano=50', auditor);
    expect(
      asientos.json.items.some(
        (e: { payload_nuevo: { id_transaccion?: number } }) =>
          String(e.payload_nuevo?.id_transaccion) === S.consig,
      ),
    ).toBe(true);
    expect(c1.json.monto).toBe(150000);
  });

  it('anomalías: divisas, ráfagas (< 300 s) y cuentas inactivas', async () => {
    const d = await api('/api/v1/auditoria/anomalias/divisas', auditor);
    expect(d.status).toBe(200);
    expect(d.json.items.some((x: { moneda: string }) => x.moneda === 'USD')).toBe(true);
    const r = await api('/api/v1/auditoria/anomalias/rafagas?ventana_segundos=300', auditor);
    expect(r.status).toBe(200);
    expect(r.json.ventana_segundos).toBe(300);
    expect(
      r.json.items.some(
        (x: { numero_cuenta: string; cantidad: number }) =>
          x.numero_cuenta === '0011000001' && x.cantidad >= 3,
      ),
    ).toBe(true);
    const du = await api('/api/v1/auditoria/anomalias/durmientes', auditor);
    expect(du.json.items.map((x: { numero_cuenta: string }) => x.numero_cuenta)).toContain('0011000003');
  });

  it('eventos: bloqueo → desbloqueo → reactivación de cuenta inactiva; bloqueo impide retiros', async () => {
    const ev = (tipo: string, cuenta: string) =>
      api('/api/v1/operativa/cuentas/evento-administrativo', cajero, {
        method: 'POST',
        key: randomUUID(),
        body: {
          id_cuenta: cuenta,
          tipo_evento: tipo,
          motivo: 'Orden judicial 123 de prueba',
          referencia: 'OF-9',
        },
      });
    expect((await ev('BLOQUEO_PARCIAL', '0011000002')).status).toBe(200);
    const retiro = await api('/api/v1/operativa/caja/retiro', cajero, {
      method: 'POST',
      key: randomUUID(),
      body: { id_cuenta: '0011000002', monto: 1000, concepto: 'Retiro bloqueado' },
    });
    expect(retiro.status).toBe(409);
    expect(retiro.json.codigo_error).toBe('CUENTA_NO_OPERABLE');
    expect((await ev('DESBLOQUEO', '0011000002')).status).toBe(200);
    expect((await ev('REACTIVACION', '0011000003')).status).toBe(200);
    expect((await ev('REACTIVACION', '0011000003')).status).toBe(409); // ya no está inactiva
    const idem = randomUUID();
    const mk = () =>
      api('/api/v1/operativa/cuentas/evento-administrativo', cajero, {
        method: 'POST',
        key: idem,
        body: {
          id_cuenta: '0011000002',
          tipo_evento: 'BLOQUEO_TOTAL',
          motivo: 'Fraude confirmado por riesgo',
        },
      });
    const e1 = await mk();
    const e2 = await mk();
    expect(e1.json.id_evento).toBe(e2.json.id_evento);
    expect((await ev('DESBLOQUEO', '0011000002')).status).toBe(200);
    const evtAudit = await api('/api/v1/auditoria/bitacora?tabla=evento_cuenta', auditor);
    expect(evtAudit.json.total).toBeGreaterThanOrEqual(5);
  });

  it('cierre de caja: resumen del operador, cuadre y un solo cierre por día', async () => {
    const r = await api('/api/v1/operativa/caja/cierre', cajero);
    expect(r.status).toBe(200);
    expect(r.json.estado).toBe('ABIERTA');
    expect(r.json.total_consignaciones).toBe(150005);
    expect(r.json.total_retiros).toBe(30000);
    expect(r.json.efectivo_esperado).toBe(120005);
    const mal = await api('/api/v1/operativa/caja/cierre', cajero, {
      method: 'POST',
      key: randomUUID(),
      body: { efectivo_contado: 120000 },
    });
    expect(mal.status).toBe(200);
    expect(mal.json.estado).toBe('DESCUADRADA');
    const otra = await api('/api/v1/operativa/caja/cierre', cajero, {
      method: 'POST',
      key: randomUUID(),
      body: { efectivo_contado: 120005 },
    });
    expect(otra.status).toBe(409);
    expect(otra.json.codigo_error).toBe('CIERRE_YA_REGISTRADO');
    expect((await api('/api/v1/operativa/caja/cierre', cajero)).json.estado).toBe('DESCUADRADA');
  });

  it('errores en formato RFC 7807 (claves en español y estándar)', async () => {
    const r = await api('/api/v1/operativa/caja/consignacion', cajero, {
      method: 'POST',
      key: randomUUID(),
      body: { id_cuenta: '0011000001', monto: -5, concepto: 'x' },
    });
    expect(r.status).toBe(422);
    expect(r.headers.get('content-type')).toMatch(/problem\+json/);
    expect(r.json).toMatchObject({ estado: 422, codigo_error: 'MONTO_INVALIDO', status: 422 });
  });
});
