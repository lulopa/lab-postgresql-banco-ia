import { useTranslation } from 'react-i18next';
import { usePosicionGlobal } from '@/hooks/useClienteQueries';
import { Badge, Card, Skeleton } from '@/components/ui';
import { ProblemBanner } from '@/components/shared/ProblemBanner';
import { Money } from '@/components/shared/Money';
import { formatFecha, formatMoneda, maskLast4 } from '@/utils/format';
import { ESTADO_CUENTA, TIPO_CUENTA, TONO_CUENTA } from './Dashboard';

/** Las secciones de tarjetas, CDT y créditos solo aparecen si el BFF devuelve datos (la BD actual solo tiene cuentas). */
export default function Productos() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = usePosicionGlobal();
  if (isLoading) return <Skeleton className="h-64" />;
  if (error || !data) return <ProblemBanner error={error} onRetry={() => void refetch()} />;
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t('Tus productos')}</h1>
      <section aria-labelledby="h-cu" className="@container">
        <h2 id="h-cu" className="mb-3 text-lg font-semibold">
          {t('Cuentas')}
        </h2>
        {data.cuentas.length === 0 ? (
          <p className="text-sm text-muted">{t('Aún no tienes cuentas.')}</p>
        ) : (
          <ul className="grid gap-3 @lg:grid-cols-2">
            {data.cuentas.map((c) => (
              <li key={c.id_cuenta}>
                <Card>
                  <div className="flex justify-between">
                    <p className="font-medium">{t(TIPO_CUENTA[c.tipo] ?? c.tipo)}</p>
                    <Badge tone={TONO_CUENTA[c.estado]}>{t(ESTADO_CUENTA[c.estado])}</Badge>
                  </div>
                  <p className="num text-sm text-muted">{maskLast4(c.numero_cuenta)}</p>
                  <p className="num mt-2 text-xl font-semibold">
                    {formatMoneda(c.saldo_disponible, c.moneda)}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      {data.tarjetas_credito.length > 0 && (
        <section aria-labelledby="h-tc" className="@container">
          <h2 id="h-tc" className="mb-3 text-lg font-semibold">
            {t('Tarjetas de crédito')}
          </h2>
          <ul className="grid gap-3 @lg:grid-cols-2">
            {data.tarjetas_credito.map((tc) => (
              <li key={tc.id_tarjeta}>
                <Card>
                  <div className="flex justify-between">
                    <p className="font-medium">
                      {tc.franquicia} •••• {tc.ultimos_4}
                    </p>
                    <Badge tone={tc.estado === 'ACTIVA' ? 'success' : 'danger'}>
                      {tc.estado.toLowerCase()}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted">{t('Cupo disponible')}</p>
                  <p className="text-xl font-semibold">
                    <Money value={tc.cupo_disponible} />
                  </p>
                  <p className="text-xs text-muted">
                    {t('de')} <Money value={tc.cupo_total} />
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.inversiones_cdt.length > 0 && (
        <section aria-labelledby="h-cdt" className="@container">
          <h2 id="h-cdt" className="mb-3 text-lg font-semibold">
            {t('CDT')}
          </h2>
          <ul className="grid gap-3 @lg:grid-cols-2">
            {data.inversiones_cdt.map((c) => (
              <li key={c.id_cdt}>
                <Card>
                  <div className="flex justify-between">
                    <p className="text-xl font-semibold">
                      <Money value={c.monto_invertido} />
                    </p>
                    <Badge tone={c.estado === 'VIGENTE' ? 'info' : 'neutral'}>{c.estado.toLowerCase()}</Badge>
                  </div>
                  <p className="num text-sm text-muted">
                    {t('{{tasa}}% E.A. · vence {{fecha}}', {
                      tasa: c.tasa_ea,
                      fecha: formatFecha(c.fecha_vencimiento),
                    })}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!!data.prestamos?.length && (
        <section aria-labelledby="h-pr" className="@container">
          <h2 id="h-pr" className="mb-3 text-lg font-semibold">
            {t('Créditos')}
          </h2>
          <ul className="grid gap-3 @lg:grid-cols-2">
            {data.prestamos.map((p) => (
              <li key={p.id_prestamo}>
                <Card>
                  <div className="flex justify-between">
                    <p className="text-sm text-muted">{t('Saldo pendiente')}</p>
                    <Badge
                      tone={p.estado === 'EN_MORA' ? 'danger' : p.estado === 'PAGADO' ? 'neutral' : 'success'}
                    >
                      {p.estado.replace('_', ' ').toLowerCase()}
                    </Badge>
                  </div>
                  <p className="text-xl font-semibold">
                    <Money value={p.saldo_pendiente} />
                  </p>
                  <p className="text-sm text-muted">
                    {t('Cuota')} <Money value={p.cuota_mensual} /> · {t('próxima')}{' '}
                    {formatFecha(p.proxima_cuota)}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
