import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'danger' | 'secondary' | 'ghost';
// Pares verificados (≥4.5:1): brand/on-brand, danger-solid/on-danger.
const V: Record<Variant, string> = {
  primary: 'bg-brand text-brand-on hover:bg-brand-hover',
  danger: 'bg-danger-solid text-danger-on hover:bg-danger-hover',
  secondary: 'border border-line bg-card text-fg hover:bg-app',
  ghost: 'text-brand-text hover:bg-app',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
        V[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />}
      {children}
    </button>
  );
}
