import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '@/router';
import { queryClient } from '@/services/queryClient';
import { createFakeBackend, loginAs } from './fakeBackend';
import type { Rol } from '@/contracts';

const Loc = () => <div data-testid="loc">{useLocation().pathname}</div>;
const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <Loc />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const HOME: Record<Rol, string> = { CLIENTE: '/cliente', AUDITOR: '/auditoria', OPERATIVO: '/operativa' };
const PORTAL_PATHS: Record<Rol, string[]> = {
  CLIENTE: [
    '/cliente',
    '/cliente/productos',
    '/cliente/transferencias',
    '/cliente/movimientos',
    '/cliente/perfil',
  ],
  AUDITOR: ['/auditoria', '/auditoria/bitacora', '/auditoria/anomalias'],
  OPERATIVO: ['/operativa', '/operativa/eventos', '/operativa/cierre'],
};
const ROLES = Object.keys(PORTAL_PATHS) as Rol[];

describe('RBAC en rutas', () => {
  for (const role of ROLES) {
    describe(`rol ${role}`, () => {
      for (const path of PORTAL_PATHS[role]) {
        it(`permite ${path}`, async () => {
          createFakeBackend().install();
          loginAs(role);
          renderAt(path);
          const shell = await screen.findByTestId('shell');
          expect(shell).toHaveAttribute('data-portal', role);
          expect(screen.getByTestId('loc')).toHaveTextContent(path);
        });
      }
      for (const other of ROLES.filter((r) => r !== role)) {
        for (const path of PORTAL_PATHS[other]) {
          it(`deniega ${path} y redirige a ${HOME[role]}`, async () => {
            createFakeBackend().install();
            loginAs(role);
            renderAt(path);
            await waitFor(() =>
              expect(screen.getByTestId('loc')).toHaveTextContent(new RegExp(`^${HOME[role]}$`)),
            );
            expect(screen.getByTestId('shell')).toHaveAttribute('data-portal', role);
            expect(await screen.findByRole('alert')).toHaveTextContent(/no tienes permiso/i);
          });
        }
      }
    });
  }

  it('sin sesión: cualquier portal redirige a /auth/login', async () => {
    createFakeBackend().install();
    for (const path of ['/cliente', '/auditoria/bitacora', '/operativa/cierre']) {
      const { unmount } = renderAt(path);
      await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/auth/login'));
      expect(screen.queryByTestId('shell')).toBeNull();
      unmount();
    }
  });

  it('usuario con varios roles debe elegir uno; mientras tanto no accede a ningún portal', async () => {
    createFakeBackend().install();
    loginAs(['CLIENTE', 'AUDITOR']);
    renderAt('/auditoria');
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/auth/portal'));
    expect(screen.queryByTestId('shell')).toBeNull();
  });
});
