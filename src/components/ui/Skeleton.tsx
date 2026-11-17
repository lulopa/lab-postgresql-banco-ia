import { useTranslation } from 'react-i18next';

export function Skeleton({ className = 'h-24' }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-label={t('Cargando')}
      className={`animate-pulse rounded-xl bg-line ${className}`}
    />
  );
}
