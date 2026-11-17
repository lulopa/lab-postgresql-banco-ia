import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '@/router';
import { PageMeta } from '@/components/shared/PageMeta';
import { queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/store/authStore';
import { createFakeBackend, loginAs } from './fakeBackend';

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <PageMeta />
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute('content');

describe('Login y callback OIDC', () => {
  it('el botón inicia el flujo PKCE', async () => {
    createFakeBackend().install();
    const startLogin = vi.fn(async () => {});
    useAuthStore.setState({ status: 'anonymous', startLogin });
    renderAt('/auth/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Iniciar sesión' }));
    expect(startLogin).toHaveBeenCalledTimes(1);
  });

  it('muestra el motivo cuando la sesión se cerró por inactividad', async () => {
    createFakeBackend().install();
    useAuthStore.setState({ status: 'anonymous', logoutReason: 'inactividad' });
    renderAt('/auth/login');
    expect(await screen.findByRole('status')).toHaveTextContent('15 minutos de inactividad');
  });

  it('callback con state que NO coincide: falla y no crea sesión (anti-CSRF)', async () => {
    createFakeBackend().install();
    useAuthStore.setState({ status: 'anonymous' });
    sessionStorage.setItem(
      'andino.pkce',
      JSON.stringify({ verifier: 'v'.repeat(60), state: 'esperado', nonce: 'n' }),
    );
    renderAt('/auth/callback?code=abc&state=otro');
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos verificar tu inicio de sesión.');
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('callback correcto: intercambia el código, abre sesión y entra al portal', async () => {
    const be = createFakeBackend();
    be.install();
    useAuthStore.setState({ status: 'anonymous' });
    sessionStorage.setItem(
      'andino.pkce',
      JSON.stringify({ verifier: 'v'.repeat(60), state: 'ok', nonce: 'n' }),
    );
    renderAt('/auth/callback?code=abc&state=ok');
    expect(await screen.findByTestId('shell')).toHaveAttribute('data-portal', 'CLIENTE');
    expect(be.callsTo('/api/v1/auth/token')[0]?.body).toMatchObject({
      code: 'abc',
      code_verifier: 'v'.repeat(60),
    });
    expect(sessionStorage.getItem('andino.pkce')).toBeNull(); // PKCE de un solo uso
  });
});

describe('Teclado en pestañas de anomalías (WAI-ARIA)', () => {
  it('flechas, Home y End mueven selección y foco', async () => {
    createFakeBackend().install();
    loginAs('AUDITOR');
    const user = userEvent.setup();
    renderAt('/auditoria/anomalias');
    const [divisas, rafagas, inactivas] = await Promise.all(
      ['Divisas', 'Ráfagas', 'Inactivas'].map((n) => screen.findByRole('tab', { name: n })),
    );
    divisas!.focus();
    await user.keyboard('{ArrowRight}');
    expect(rafagas).toHaveAttribute('aria-selected', 'true');
    expect(rafagas).toHaveFocus();
    await user.keyboard('{End}');
    expect(inactivas).toHaveFocus();
    await user.keyboard('{ArrowRight}'); // da la vuelta
    expect(divisas).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(inactivas).toHaveFocus();
    await user.keyboard('{Home}');
    expect(divisas).toHaveFocus();
    expect(divisas).toHaveAttribute('tabindex', '0');
    expect(rafagas).toHaveAttribute('tabindex', '-1'); // tabindex itinerante
  });
});

describe('i18n y metadatos por ruta', () => {
  it('cambia de idioma, actualiza <html lang> y vuelve a español', async () => {
    createFakeBackend().install();
    loginAs('CLIENTE');
    const user = userEvent.setup();
    renderAt('/cliente');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Hola, Camila');
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Hello, Camila');
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toMatch(/^Home/);
    await user.click(screen.getByRole('button', { name: 'Español' }));
    await waitFor(() => expect(document.documentElement.lang).toBe('es-CO'));
  });

  it('título único por ruta; el login es indexable y los portales noindex', async () => {
    createFakeBackend().install();
    useAuthStore.setState({ status: 'anonymous' });
    const { unmount } = renderAt('/auth/login');
    await screen.findByRole('button', { name: 'Iniciar sesión' });
    expect(document.title).toBe('Iniciar sesión · Banco Andino');
    expect(robots()).toBe('index, follow');
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toMatch(
      /segura/,
    );
    unmount();
    loginAs('CLIENTE');
    renderAt('/cliente/movimientos');
    await screen.findByTestId('shell');
    expect(document.title).toBe('Movimientos · Banco Andino');
    expect(robots()).toBe('noindex, nofollow');
  });
});
