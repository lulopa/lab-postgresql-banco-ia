import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useTransferir } from '@/hooks/useTransferir';
import { queryClient } from '@/services/queryClient';
import { request } from '@/services/apiClient';
import { isUuidV4 } from '@/utils/uuid';
import { createFakeBackend, loginAs } from './fakeBackend';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
const REQ = {
  id_cuenta_origen: 'c1',
  id_cuenta_destino: 'ABC-123456',
  monto: 50000,
  concepto: 'Arriendo',
  otp_token: '123456',
};
const PATH = '/api/v1/transacciones/transferir';

describe('Idempotencia de transferencias', () => {
  it('reintento tras fallo de red reutiliza la MISMA X-Idempotency-Key (UUID v4) y no duplica el efecto', async () => {
    const be = createFakeBackend();
    be.install();
    loginAs('CLIENTE');
    const { result } = renderHook(() => useTransferir(), { wrapper });

    be.state.networkFailures = 1;
    await act(async () => {
      await expect(result.current.transferir(REQ)).rejects.toMatchObject({
        problem: { codigo_error: 'NETWORK_ERROR' },
      });
    });
    await act(async () => {
      await result.current.transferir(REQ);
    });

    const [first, second] = be.callsTo(PATH);
    const k1 = first!.headers.get('X-Idempotency-Key')!;
    expect(isUuidV4(k1)).toBe(true);
    expect(second!.headers.get('X-Idempotency-Key')).toBe(k1);
    // El backend simulado aplica idempotencia: un solo asiento en la bitácora.
    expect(be.audit.filter((a) => a.tabla === 'banco_core.transaccion')).toHaveLength(1);
  });

  it('reintento tras 5xx también conserva la clave', async () => {
    const be = createFakeBackend();
    be.install();
    loginAs('CLIENTE');
    const { result } = renderHook(() => useTransferir(), { wrapper });
    be.state.nextProblem = { status: 503, body: { title: 'No disponible', status: 503 } };
    await act(async () => {
      await expect(result.current.transferir(REQ)).rejects.toBeDefined();
    });
    await act(async () => {
      await result.current.transferir(REQ);
    });
    const keys = be.callsTo(PATH).map((c) => c.headers.get('X-Idempotency-Key'));
    expect(new Set(keys).size).toBe(1);
  });

  it('error definitivo (4xx) o transferencia distinta usan una clave NUEVA', async () => {
    const be = createFakeBackend();
    be.install();
    loginAs('CLIENTE');
    const { result } = renderHook(() => useTransferir(), { wrapper });
    be.state.nextProblem = {
      status: 422,
      body: { title: 'OTP inválido', status: 422, codigo_error: 'OTP_INVALIDO' },
    };
    await act(async () => {
      await expect(result.current.transferir(REQ)).rejects.toBeDefined();
    });
    await act(async () => {
      await result.current.transferir({ ...REQ, otp_token: '654321' });
    });
    await act(async () => {
      await result.current.transferir({ ...REQ, monto: 1 });
    });
    const keys = be.callsTo(PATH).map((c) => c.headers.get('X-Idempotency-Key'));
    expect(new Set(keys).size).toBe(3);
  });

  it('doble clic: con una petición en vuelo solo se envía un POST y el botón queda deshabilitado (isPending)', async () => {
    const be = createFakeBackend();
    be.install();
    loginAs('CLIENTE');
    const { result } = renderHook(() => useTransferir(), { wrapper });
    let p1!: Promise<unknown>, p2!: Promise<unknown>;
    act(() => {
      p1 = result.current.transferir(REQ);
      p2 = result.current.transferir(REQ);
    });
    expect(result.current.isPending).toBe(true);
    await act(async () => {
      await Promise.all([p1, p2]);
    });
    expect(be.callsTo(PATH)).toHaveLength(1);
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('apiClient rechaza una clave que no sea UUID v4', async () => {
    createFakeBackend().install();
    loginAs('CLIENTE');
    await expect(request(PATH, { method: 'POST', body: {}, idempotencyKey: 'no-es-uuid' })).rejects.toThrow(
      /UUID v4/,
    );
  });
});
