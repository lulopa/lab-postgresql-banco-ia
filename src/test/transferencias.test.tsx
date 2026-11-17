import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import Transferencias from '@/pages/cliente/Transferencias';
import { queryClient } from '@/services/queryClient';
import { createFakeBackend, loginAs } from './fakeBackend';

const PATH = '/api/v1/transacciones/transferir';
const setup = () => {
  const be = createFakeBackend();
  be.install();
  loginAs('CLIENTE');
  render(
    <QueryClientProvider client={queryClient}>
      <Transferencias />
    </QueryClientProvider>,
  );
  return { be, user: userEvent.setup() };
};

async function llenarPaso1(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(await screen.findByLabelText('Cuenta de origen'), 'c1');
  await user.type(screen.getByLabelText('Número de cuenta de destino'), '0011000002');
  await user.type(screen.getByLabelText('Monto'), '50000');
  await user.type(screen.getByLabelText('Concepto'), 'Arriendo');
}

describe('Transferencias: flujo de 3 pasos', () => {
  it('valida el paso 1 antes de avanzar', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Revisar' }));
    expect(screen.getByText('Elige la cuenta de origen.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa un monto mayor a cero.')).toBeInTheDocument();
    expect(screen.queryByText('Revisa los datos')).toBeNull();
  });

  it('rechaza un monto mayor al saldo y un destino igual al origen', async () => {
    const { user } = setup();
    await user.selectOptions(await screen.findByLabelText('Cuenta de origen'), 'c1');
    await user.type(screen.getByLabelText('Número de cuenta de destino'), '0012345678');
    await user.type(screen.getByLabelText('Monto'), '99999999');
    await user.type(screen.getByLabelText('Concepto'), 'Prueba');
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    expect(screen.getByText('El monto supera tu saldo disponible.')).toBeInTheDocument();
    expect(screen.getByText('El destino debe ser distinto al origen.')).toBeInTheDocument();
  });

  it('flujo completo: revisión → OTP → un solo POST con X-Idempotency-Key aunque se haga doble clic → comprobante', async () => {
    const { be, user } = setup();
    await llenarPaso1(user);
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    expect(await screen.findByText('Revisa los datos')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enviar código de seguridad' }));
    expect(await screen.findByText('Confirma con tu código')).toBeInTheDocument();

    const confirmar = screen.getByRole('button', { name: /Confirmar transferencia/ });
    expect(confirmar).toBeDisabled(); // sin OTP completo no se puede enviar
    await user.type(screen.getByLabelText('Código de 6 dígitos'), '12ab3456');
    expect(screen.getByLabelText('Código de 6 dígitos')).toHaveValue('123456'); // solo dígitos

    await user.dblClick(screen.getByRole('button', { name: /Confirmar transferencia/ }));
    expect(await screen.findByText('Transferencia exitosa')).toBeInTheDocument();

    const posts = be.callsTo(PATH);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.headers.get('X-Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(posts[0]?.body).toMatchObject({
      id_cuenta_origen: 'c1',
      id_cuenta_destino: '0011000002',
      monto: 50000,
      otp_token: '123456',
    });
  });

  it('un error del servidor (RFC 7807) se muestra en un modal con código, y permite reintentar', async () => {
    const { be, user } = setup();
    await llenarPaso1(user);
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    await user.click(await screen.findByRole('button', { name: 'Enviar código de seguridad' }));
    await user.type(await screen.findByLabelText('Código de 6 dígitos'), '654321');
    be.state.nextProblem = {
      status: 422,
      body: {
        estado: 422,
        titulo: 'Código inválido',
        detalle: 'El código es incorrecto.',
        codigo_error: 'OTP_INVALIDO',
      },
    };
    await user.click(screen.getByRole('button', { name: /Confirmar transferencia/ }));
    const modal = await screen.findByRole('dialog', { name: 'Código inválido' });
    expect(within(modal).getByText(/OTP_INVALIDO/)).toBeInTheDocument();
    await user.click(within(modal).getByRole('button', { name: 'Entendido' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: /Confirmar transferencia/ })).toBeEnabled();
  });
});
