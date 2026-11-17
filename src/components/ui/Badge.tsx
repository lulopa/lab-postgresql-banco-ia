import type { ReactNode } from 'react';
import { cn } from './cn';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
// Amarillo SOLO con texto oscuro (documento §5.2).
const T: Record<Tone, string> = {
  success: 'bg-success text-success-on',
  warning: 'bg-warning text-warning-on',
  danger: 'bg-danger-solid text-danger-on',
  info: 'bg-brand text-brand-on',
  neutral: 'border border-line bg-card text-fg',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', T[tone])}
    >
      {children}
    </span>
  );
}
