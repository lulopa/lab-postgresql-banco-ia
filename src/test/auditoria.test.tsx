import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import TerminalCaja from '@/pages/operativa/TerminalCaja';
import Bitacora from '@/pages/auditoria/Bitacora';
import { queryClient } from '@/services/queryClient';
import { createFakeBackend, loginAs } from './fakeBackend';

describe('Operación de caja ⇒ bitácora de auditoría', () => {
  it('una consignación registrada en caja aparece de inmediato en la bitácora (sin recargar)', async () => {
    const be = createFakeBackend();
    be.install();
    loginAs('OPERATIVO');
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <TerminalCaja />
        <Bitacora />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/no hay registros/i)).toBeInTheDocument(); // bitácora vacía

    await user.type(screen.getByLabelText(/número de cuenta/i), 'CUENTA-0001');
    await user.type(screen.getByLabelText(/monto en efectivo/i), '150000');
    await user.type(screen.getByLabelText('Concepto'), 'Depósito ventanilla');
    await user.click(screen.getByRole('button', { name: /registrar consignación/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText(/consignación registrada/i)).toBeInTheDocument();
    const call = be.callsTo('/api/v1/operativa/caja/consignacion')[0]!;
    expect(call.headers.get('X-Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);

    // La bitácora (misma sesión/caché) se refresca por invalidación y muestra transacción + asiento contable.
    await waitFor(() => expect(screen.getAllByText('banco_core.transaccion').length).toBeGreaterThan(0));
    expect(screen.getByText('banco_core.asiento_contable')).toBeInTheDocument();
    expect(be.audit).toHaveLength(2);
  });
});
