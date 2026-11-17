import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBitacora, useDivisas, useDurmientes, useRafagas } from '@/hooks/useAuditoriaQueries';
import { Card, Skeleton } from '@/components/ui';
import { ProblemBanner } from '@/components/shared/ProblemBanner';
import { formatFechaHora } from '@/utils/format';

const Stat = ({ label, value, to }: { label: string; value: number | undefined; to: string }) => (
  <Link to={to} className="block">
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="num text-3xl font-bold">{value ?? '—'}</p>
    </Card>
  </Link>
);

export default function DashboardAudit() {
  const { t } = useTranslation();
  const bit = useBitacora({ pagina: 1, tamano: 5 });
  const div = useDivisas({ pagina: 1, tamano: 1 });
  const raf = useRafagas();
  const dur = useDurmientes({ pagina: 1, tamano: 1 });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('Resumen de auditoría')}</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('Eventos en bitácora')} value={bit.data?.total} to="/auditoria/bitacora" />
        <Stat
          label={t('Operaciones en divisa extranjera')}
          value={div.data?.total}
          to="/auditoria/anomalias"
        />
        <Stat label={t('Ráfagas (< 300 s)')} value={raf.data?.items.length} to="/auditoria/anomalias" />
        <Stat label={t('Cuentas inactivas')} value={dur.data?.total} to="/auditoria/anomalias" />
      </div>
      <section aria-labelledby="h-rec">
        <h2 id="h-rec" className="mb-3 text-lg font-semibold">
          {t('Últimos eventos')}
        </h2>
        {bit.isLoading ? (
          <Skeleton className="h-40" />
        ) : bit.error ? (
          <ProblemBanner error={bit.error} onRetry={() => void bit.refetch()} />
        ) : bit.data?.items.length === 0 ? (
          <p className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
            {t('Aún no hay eventos registrados.')}
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {bit.data?.items.map((e) => (
              <li key={e.id_auditoria} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{e.operacion}</span> {t('en')}{' '}
                  <span className="num">{e.tabla}</span> {t('por')} {e.usuario}
                </span>
                <span className="num text-muted">{formatFechaHora(e.fecha)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
