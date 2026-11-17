import { Link } from 'react-router-dom';
import { ArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePosicionGlobal } from '@/hooks/useClienteQueries';
import { Badge, Card, Skeleton, type Tone } from '@/components/ui';
import { ProblemBanner } from '@/components/shared/ProblemBanner';
import { Money } from '@/components/shared/Money';
import { maskLast4 } from '@/utils/format';
import type { EstadoCuenta } from '@/contracts';

export const TONO_CUENTA: Record<EstadoCuenta, Tone> = {
  PENDIENTE_ACTIVACION: 'info',
  ACTIVA: 'success',
  BLOQUEADA_PARCIAL: 'warning',
  BLOQUEADA_TOTAL: 'danger',
  INACTIVA: 'warning',
  CERRADA: 'neutral',
};
export const TIPO_CUENTA: Record<string, string> = {
  AHORROS: 'Cuenta de ahorros',
  CORRIENTE: 'Cuenta corriente',
  NOMINA: 'Cuenta de nómina',
};
export const ESTADO_CUENTA: Record<EstadoCuenta, string> = {
  PENDIENTE_ACTIVACION: 'Pendiente de activación',
  ACTIVA: 'Activa',
  BLOQUEADA_PARCIAL: 'Bloqueo parcial',
  BLOQUEADA_TOTAL: 'Bloqueo total',
  INACTIVA: 'Inactiva',
  CERRADA: 'Cerrada',
};

export default function Dashboard() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = usePosicionGlobal();
  if (isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  if (error || !data) return <ProblemBanner error={error} onRetry={() => void refetch()} />;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('Hola, {{nombre}}', { nombre: data.titular.nombres })}</h1>
      <Card>
        <p className="text-sm text-muted">{t('Saldo consolidado')}</p>
        <p className="text-4xl font-bold">
          <Money value={data.saldo_consolidado} />
        </p>
        <Link
          to="/cliente/transferencias"
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-on hover:bg-brand-hover"
        >
          <ArrowLeftRight className="h-4 w-4" aria-hidden />
          {t('Transferir dinero')}
        </Link>
      </Card>
      <section aria-labelledby="h-cuentas" className="@container">
        <h2 id="h-cuentas" className="mb-3 text-lg font-semibold">
          {t('Tus cuentas')}
        </h2>
        {data.cuentas.length === 0 ? (
          <p className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
            {t('Aún no tienes cuentas.')}
          </p>
        ) : (
          <ul className="grid gap-3 @lg:grid-cols-2">
            {data.cuentas.map((c) => (
              <li key={c.id_cuenta}>
                <Card>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{t(TIPO_CUENTA[c.tipo] ?? c.tipo)}</p>
                    <Badge tone={TONO_CUENTA[c.estado]}>{t(ESTADO_CUENTA[c.estado])}</Badge>
                  </div>
                  <p className="num text-sm text-muted">{maskLast4(c.numero_cuenta)}</p>
                  <p className="mt-2 text-2xl font-semibold">
                    <Money value={c.saldo_disponible} />
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
