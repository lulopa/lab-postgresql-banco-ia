import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '@/components/ui';

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>abrir</button>
      <Modal
        open={open}
        title="Diálogo"
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        footer={<button>Aceptar</button>}
      >
        <input aria-label="campo" />
      </Modal>
    </>
  );
}
const mount = (ui: React.ReactElement) => {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
  return render(ui, { container: root });
};

describe('Modal accesible', () => {
  it('enfoca el primer control, atrapa Tab/Shift+Tab, cierra con Esc y devuelve el foco', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mount(<Harness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'abrir' });
    await user.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Diálogo' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.getElementById('root')).toHaveProperty('inert', true); // el fondo queda inerte

    const [cerrar, campo, aceptar] = [
      screen.getByRole('button', { name: 'Cerrar' }),
      screen.getByLabelText('campo'),
      screen.getByRole('button', { name: 'Aceptar' }),
    ];
    expect(cerrar).toHaveFocus();
    await user.tab();
    expect(campo).toHaveFocus();
    await user.tab();
    expect(aceptar).toHaveFocus();
    await user.tab();
    expect(cerrar).toHaveFocus(); // ciclo hacia adelante: no escapa del diálogo
    await user.tab({ shift: true });
    expect(aceptar).toHaveFocus(); // ciclo hacia atrás

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.getElementById('root')).toHaveProperty('inert', false);
    expect(opener).toHaveFocus();
  });
});
