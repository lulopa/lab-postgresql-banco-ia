import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/services/apiClient';
import { Button } from '@/components/ui';

export function ProblemBanner({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const p = error instanceof ApiError ? error.problem : null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-danger-text bg-card p-4 text-fg"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-text" strokeWidth={2} aria-hidden />
      <div className="flex-1 text-sm">
        <p className="font-semibold">{p?.titulo ?? t('No se pudo cargar la información')}</p>
        <p className="text-muted">{p?.detalle ?? t('Intenta de nuevo en unos segundos.')}</p>
        {p && (
          <p className="num mt-1 text-xs text-muted">{t('Código {{codigo}}', { codigo: p.codigo_error })}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {t('Reintentar')}
        </Button>
      )}
    </div>
  );
}
