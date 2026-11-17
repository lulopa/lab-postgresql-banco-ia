import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Input, MoneyInput, Select, Textarea } from './Input';

const meta = {
  title: 'UI/Campos de formulario',
  component: Input,
  tags: ['autodocs'],
  args: { label: 'Concepto' },
  parameters: {
    docs: {
      description: {
        component:
          'Cada campo asocia `label`, ayuda y error con `aria-describedby`/`aria-invalid`. `MoneyInput` guarda texto (sin errores de coma flotante) y previsualiza en COP.',
      },
    },
  },
} satisfies Meta<typeof Input>;
export default meta;
type S = StoryObj<typeof meta>;

export const Texto: S = { args: { hint: 'Máximo 80 caracteres' } };
export const ConError: S = { args: { error: 'Escribe un concepto de al menos 3 caracteres.' } };
function MontoDemo() {
  const [v, setV] = useState('150000');
  return <MoneyInput label="Monto" value={v} onValueChange={setV} />;
}
export const Monto: S = { render: () => <MontoDemo /> };
export const Selector: S = {
  render: () => (
    <Select label="Tipo de evento" defaultValue="a">
      <option value="a">Bloqueo parcial</option>
      <option value="b">Desbloqueo</option>
    </Select>
  ),
};
export const AreaDeTexto: S = { render: () => <Textarea label="Motivo" hint="Mínimo 10 caracteres" /> };
