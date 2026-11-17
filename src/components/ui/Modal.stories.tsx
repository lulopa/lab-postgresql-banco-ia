import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';
import { Modal } from './Modal';
import { ProblemModal } from './ProblemModal';
import { ApiError } from '@/services/apiClient';

const meta = {
  title: 'UI/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Diálogo accesible: *focus trap* (Tab/Shift+Tab), Esc, `aria-modal`, fondo inerte y devolución del foco.',
      },
    },
  },
} satisfies Meta<typeof Modal>;
export default meta;
type S = StoryObj<typeof meta>;

function ConfirmacionDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div id="root">
      <Button onClick={() => setOpen(true)}>Abrir confirmación</Button>
      <Modal
        open={open}
        title="Confirmar retiro"
        onClose={() => setOpen(false)}
        footer={<Button onClick={() => setOpen(false)}>Confirmar</Button>}
      >
        <p>Entrega $ 100.000,00 en efectivo.</p>
      </Modal>
    </div>
  );
}

function ErrorDemo() {
  const [open, setOpen] = useState(false);
  const error = new ApiError({
    estado: 409,
    titulo: 'Saldo insuficiente',
    detalle: 'La cuenta de origen no tiene fondos suficientes para esta operación.',
    codigo_error: 'SALDO_INSUFICIENTE',
  });
  return (
    <div id="root">
      <Button variant="danger" onClick={() => setOpen(true)}>
        Simular error del banco
      </Button>
      <ProblemModal error={open ? error : null} onClose={() => setOpen(false)} />
    </div>
  );
}

const sinArgs = { open: false, title: '', onClose: () => {}, children: null };
export const Confirmacion: S = { args: sinArgs, render: () => <ConfirmacionDemo /> };
export const ErrorRFC7807: S = { args: sinArgs, render: () => <ErrorDemo /> };
