import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui';

export function Pagination({
  pagina,
  totalPaginas,
  onChange,
}: {
  pagina: number;
  totalPaginas: number;
  onChange: (p: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('Paginación')} className="mt-4 flex items-center justify-between text-sm">
      <Button variant="secondary" disabled={pagina <= 1} onClick={() => onChange(pagina - 1)}>
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {t('Anterior')}
      </Button>
      <span className="num text-muted">
        {t('Página {{pagina}} de {{total}}', { pagina, total: Math.max(totalPaginas, 1) })}
      </span>
      <Button variant="secondary" disabled={pagina >= totalPaginas} onClick={() => onChange(pagina + 1)}>
        {t('Siguiente')}
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>
    </nav>
  );
}
