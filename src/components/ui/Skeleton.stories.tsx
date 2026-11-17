import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from './Skeleton';

const meta = { title: 'UI/Skeleton', component: Skeleton, tags: ['autodocs'] } satisfies Meta<
  typeof Skeleton
>;
export default meta;

export const Tarjeta: StoryObj<typeof meta> = { args: { className: 'h-32 max-w-sm' } };
