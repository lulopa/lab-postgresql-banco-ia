import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  args: { children: 'Confirmar' },
  argTypes: { variant: { control: 'select', options: ['primary', 'danger', 'secondary', 'ghost'] } },
  parameters: {
    docs: {
      description: {
        component:
          'Botón con área táctil de 44 px. `primary` = texto oscuro sobre azul (4.6:1); `danger` = texto blanco sobre rojo derivado (6:1). Los estados hover también cumplen 4.5:1.',
      },
    },
  },
} satisfies Meta<typeof Button>;
export default meta;
type S = StoryObj<typeof meta>;

export const Primary: S = {};
export const Danger: S = { args: { variant: 'danger', children: 'Registrar retiro' } };
export const Secondary: S = { args: { variant: 'secondary', children: 'Cancelar' } };
export const Ghost: S = { args: { variant: 'ghost', children: 'Ver más' } };
export const Loading: S = { args: { loading: true, children: 'Enviando' } };
export const Disabled: S = { args: { disabled: true } };
