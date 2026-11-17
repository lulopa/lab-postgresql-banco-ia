import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta = { title: 'UI/Card', component: Card, tags: ['autodocs'] } satisfies Meta<typeof Card>;
export default meta;

export const Default: StoryObj<typeof meta> = {
  render: () => (
    <Card className="max-w-sm">
      <p className="text-sm text-muted">Saldo consolidado</p>
      <p className="num text-3xl font-bold">$ 2.450.000,00</p>
    </Card>
  ),
};
