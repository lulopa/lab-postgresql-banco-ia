import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { useTranslation } from 'react-i18next';
import { formatCOP } from '@/utils/format';
import { parseMonto } from '@/utils/validators';
import { cn } from './cn';

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
}
const base =
  'mt-1 block w-full rounded-lg border bg-card px-3 py-2 text-fg placeholder:text-muted min-h-[44px]';
const bd = (e?: string) => (e ? 'border-danger-text' : 'border-line');

function Field({ id, label, error, hint, children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-xs font-medium text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}
const aria = (id: string, error?: string, hint?: string) => ({
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-err` : hint ? `${id}-hint` : undefined,
});

export function Input({
  label,
  error,
  hint,
  className,
  ...rest
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <input id={id} className={cn(base, bd(error), className)} {...aria(id, error, hint)} {...rest} />
    </Field>
  );
}

/** Monto en texto (evita errores de coma flotante); muestra la vista previa formateada en COP. */
export function MoneyInput({
  label,
  error,
  value,
  onValueChange,
  ...rest
}: FieldProps & { value: string; onValueChange: (v: string) => void } & Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'type'
  >) {
  const { t } = useTranslation();
  const id = useId();
  const parsed = parseMonto(value);
  return (
    <Field
      id={id}
      label={label}
      error={error}
      hint={parsed ? formatCOP(parsed) : t('Solo números, hasta 2 decimales')}
    >
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onValueChange(e.target.value.replace(/[^\d.,]/g, ''))}
        className={cn(base, bd(error), 'num')}
        {...aria(id, error, parsed ? formatCOP(parsed) : 'x')}
        {...rest}
      />
    </Field>
  );
}

export function Select({
  label,
  error,
  hint,
  children,
  className,
  ...rest
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <select id={id} className={cn(base, bd(error), className)} {...aria(id, error, hint)} {...rest}>
        {children}
      </select>
    </Field>
  );
}

export function Textarea({
  label,
  error,
  hint,
  className,
  ...rest
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <textarea
        id={id}
        rows={3}
        className={cn(base, bd(error), className)}
        {...aria(id, error, hint)}
        {...rest}
      />
    </Field>
  );
}
