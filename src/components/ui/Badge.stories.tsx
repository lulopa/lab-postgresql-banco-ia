import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { children: 'Activa' },
  parameters: {
    docs: {
      description: {
        component: 'El amarillo `#FFF51B` se usa solo con texto oscuro `#0F172A` (documento §5.2).',
      },
    },
  },
} satisfies Meta<typeof Badge>;
export default meta;
type S = StoryObj<typeof meta>;

export const Success: S = { args: { tone: 'success' } };
export const Warning: S = { args: { tone: 'warning', children: 'Inactiva' } };
export const Danger: S = { args: { tone: 'danger', children: 'Bloqueo total' } };
export const Info: S = { args: { tone: 'info', children: 'Pendiente' } };
export const Neutral: S = { args: { tone: 'neutral', children: 'Cerrada' } };
