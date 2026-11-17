import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCOP } from '@/utils/format';

export function Money({ value, className = '' }: { value: number; className?: string }) {
  return <span className={`num ${className}`}>{formatCOP(value)}</span>;
}

/** Débito/crédito: color + signo + icono (nunca solo color). */
export function Movement({ tipo, monto }: { tipo: 'DEBITO' | 'CREDITO'; monto: number }) {
  const { t } = useTranslation();
  const debit = tipo === 'DEBITO';
  const Icon = debit ? ArrowUpRight : ArrowDownLeft;
  return (
    <span
      className={`num inline-flex items-center gap-1 font-medium ${debit ? 'text-danger-text' : 'text-success-text'}`}
    >
      <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
      <span className="sr-only">{debit ? t('Débito') : t('Crédito')}</span>
      {debit ? '−' : '+'}
      {formatCOP(monto)}
    </span>
  );
}
