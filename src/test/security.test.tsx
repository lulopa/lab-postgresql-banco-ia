import { act, fireEvent, renderHook } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { useWindowBlur } from '@/hooks/useWindowBlur';
import { useAuthStore } from '@/store/authStore';
import { ApiError, request } from '@/services/apiClient';
import { challengeS256, consumePkce, randomString } from '@/services/pkce';
import { formatCOP } from '@/utils/format';
import { contrastRatio } from '@/utils/contrast';
import { INACTIVITY_LIMIT_MS } from '@/config/env';
import { createFakeBackend, loginAs, TEST_TOKEN } from './fakeBackend';

describe('Sesión', () => {
  it('cierra por inactividad a los 15 minutos y la actividad reinicia el contador', () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    renderHook(() => useInactivityLogout(true, onTimeout));
    vi.advanceTimersByTime(INACTIVITY_LIMIT_MS - 5_000);
    fireEvent.keyDown(window);
    vi.advanceTimersByTime(INACTIVITY_LIMIT_MS - 5_000);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(6_000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('desenfoca al perder el foco y se restablece al recuperarlo', () => {
    const { result } = renderHook(() => useWindowBlur());
    expect(result.current).toBe(false);
    act(() => {
      fireEvent.blur(window);
    });
    expect(result.current).toBe(true);
    act(() => {
      fireEvent.focus(window);
    });
    expect(result.current).toBe(false);
  });

  it('el access token nunca se escribe en localStorage/sessionStorage', () => {
    loginAs('CLIENTE');
    expect(useAuthStore.getState().accessToken).toBe(TEST_TOKEN);
    const dump = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(dump).not.toContain(TEST_TOKEN);
  });

  it('401 ⇒ un refresh y un reintento con la misma clave de idempotencia', async () => {
    const be = createFakeBackend();
    be.install();
    loginAs('CLIENTE');
    be.state.rejectTokenOnce = true;
    const key = crypto.randomUUID();
    await request('/api/v1/operativa/caja/consignacion', {
      method: 'POST',
      body: { monto: 1, id_cuenta: 'x' },
      idempotencyKey: key,
    });
    expect(be.callsTo('/api/v1/auth/refresh')).toHaveLength(1);
    const posts = be.callsTo('/api/v1/operativa/caja/consignacion');
    expect(posts).toHaveLength(2);
    expect(posts.map((p) => p.headers.get('X-Idempotency-Key'))).toEqual([key, key]);
    expect(posts[1]!.headers.get('Authorization')).toBe('Bearer refreshed-token');
  });

  it('si el refresh falla, la sesión se cierra y se limpia el token', async () => {
    const be = createFakeBackend();
    be.install();
    loginAs('CLIENTE');
    // Sin Bearer válido: forzamos que el refresh simulado responda 401
    useAuthStore.setState({ accessToken: 'viejo' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 401, headers: { 'Content-Type': 'application/json' } })),
    );
    await expect(request('/api/v1/cliente/posicion-global')).rejects.toBeInstanceOf(ApiError);
    await vi.waitFor(() => expect(useAuthStore.getState().status).toBe('anonymous'));
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

describe('PKCE', () => {
  it('genera challenge S256 conforme al vector de RFC 7636 y consume el state una sola vez', async () => {
    expect(await challengeS256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
    expect(randomString(64).length).toBeGreaterThanOrEqual(43);
    sessionStorage.setItem('andino.pkce', JSON.stringify({ verifier: 'v', state: 's', nonce: 'n' }));
    expect(consumePkce('otro')).toBeNull(); // state incorrecto
    sessionStorage.setItem('andino.pkce', JSON.stringify({ verifier: 'v', state: 's', nonce: 'n' }));
    expect(consumePkce('s')).toBe('v');
    expect(consumePkce('s')).toBeNull(); // un solo uso
  });
});

describe('Errores RFC 7807', () => {
  it('normaliza application/problem+json con claves en español', async () => {
    const be = createFakeBackend();
    be.install();
    loginAs('CLIENTE');
    be.state.nextProblem = {
      status: 409,
      body: {
        estado: 409,
        titulo: 'Saldo insuficiente',
        detalle: 'La cuenta no tiene fondos.',
        codigo_error: 'SALDO_INSUFICIENTE',
      },
    };
    const err = (await request('/api/v1/cliente/posicion-global').catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.problem).toMatchObject({
      estado: 409,
      titulo: 'Saldo insuficiente',
      codigo_error: 'SALDO_INSUFICIENTE',
    });
  });
  it('acepta claves estándar (title/detail/status) y respuestas sin cuerpo', async () => {
    const be = createFakeBackend();
    be.install();
    loginAs('CLIENTE');
    be.state.nextProblem = {
      status: 403,
      body: { title: 'Prohibido', detail: 'Rol insuficiente', status: 403 },
    };
    const err = (await request('/api/v1/cliente/posicion-global').catch((e: unknown) => e)) as ApiError;
    expect(err.problem).toMatchObject({
      estado: 403,
      titulo: 'Prohibido',
      detalle: 'Rol insuficiente',
      codigo_error: 'HTTP_403',
    });
  });
});

describe('Formato y accesibilidad', () => {
  it('formatea COP con Intl es-CO', () => {
    expect(formatCOP(1234567)).toMatch(/\$\s?1\.234\.567/);
  });

  it('todos los pares de color de texto/fondo cumplen WCAG AA (≥ 4.5:1) en claro y oscuro', () => {
    const css = readFileSync(resolvePath(process.cwd(), 'src/index.css'), 'utf8');
    const [rootCss, darkCss = ''] = css.split(/\.dark\s*\{/);
    const parse = (src: string) =>
      Object.fromEntries([...src.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
    const root = parse(rootCss!);
    const dark = { ...root, ...parse(darkCss) };
    const resolve = (vars: Record<string, string>, name: string): string => {
      let v = vars[name]!;
      while (v.startsWith('var(')) v = vars[v.slice(4, -1)]!;
      return v;
    };
    const PAIRS: Array<[string, string]> = [
      ['--text-main', '--bg-app'],
      ['--text-main', '--bg-card'],
      ['--text-muted', '--bg-app'],
      ['--text-muted', '--bg-card'],
      ['--brand-text', '--bg-app'],
      ['--brand-text', '--bg-card'],
      ['--danger-text', '--bg-app'],
      ['--danger-text', '--bg-card'],
      ['--success-text', '--bg-app'],
      ['--success-text', '--bg-card'],
      ['--on-brand', '--color-calgar-blue'],
      ['--on-success', '--color-krypton-green'],
      ['--on-warning', '--color-sunny-yellow'],
      ['--on-danger', '--danger-solid'],
      ['--on-brand', '--brand-hover'],
      ['--on-danger', '--danger-hover'], // estados hover
    ];
    for (const [label, vars] of [
      ['claro', root],
      ['oscuro', dark],
    ] as const) {
      for (const [fg, bg] of PAIRS) {
        const ratio = contrastRatio(resolve(vars, fg), resolve(vars, bg));
        expect(ratio, `${fg} sobre ${bg} (${label}) = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
