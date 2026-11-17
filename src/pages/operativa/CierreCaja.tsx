import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCierreResumen, useRegistrarCierre } from '@/hooks/useOperativa';
import { Badge, Button, Card, MoneyInput, ProblemModal, Skeleton, type Tone } from '@/components/ui';
import { ProblemBanner } from '@/components/shared/ProblemBanner';
import { Money } from '@/components/shared/Money';
import { parseMonto } from '@/utils/validators';
import { formatFecha } from '@/utils/format';

const TONO: Record<string, Tone> = { ABIERTA: 'info', CERRADA: 'success', DESCUADRADA: 'danger' };
const ESTADO: Record<string, string> = { ABIERTA: 'Abierta', CERRADA: 'Cerrada', DESCUADRADA: 'Descuadrada' };

export default function CierreCaja() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useCierreResumen();
  const { run, isPending, error: saveError, clearError } = useRegistrarCierre();
  const [raw, setRaw] = useState('');
  if (isLoading) return <Skeleton className="h-48" />;
  if (error || !data) return <ProblemBanner error={error} onRetry={() => void refetch()} />;
  const contado = parseMonto(raw);
  // Solo informativo: la validación contable definitiva es del servidor.
  const diff = contado === null ? null : contado - data.efectivo_esperado;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">{t('Cierre de caja')}</h1>
      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">{t('Fecha {{fecha}}', { fecha: formatFecha(data.fecha) })}</p>
          <Badge tone={TONO[data.estado] ?? 'neutral'}>{t(ESTADO[data.estado] ?? data.estado)}</Badge>
        </div>
        <dl className="grid grid-cols-[1fr,auto] gap-y-2 text-sm">
          <dt>{t('Operaciones')}</dt>
          <dd className="num text-right">{data.num_operaciones}</dd>
          <dt>{t('Consignaciones')}</dt>
          <dd className="text-right">
            <Money value={data.total_consignaciones} />
          </dd>
          <dt>{t('Retiros')}</dt>
          <dd className="text-right">
            <Money value={data.total_retiros} />
          </dd>
          <dt className="font-semibold">{t('Efectivo esperado')}</dt>
          <dd className="text-right font-semibold">
            <Money value={data.efectivo_esperado} />
          </dd>
        </dl>
      </Card>
      {data.estado === 'ABIERTA' && (
        <Card className="space-y-4">
          <MoneyInput label={t('Efectivo contado')} value={raw} onValueChange={setRaw} />
          {diff !== null && (
            <p role="status" className="text-sm">
              {t('Diferencia')}:{' '}
              <Money value={diff} className={diff === 0 ? 'text-success-text' : 'text-danger-text'} />
              {diff === 0 ? ` · ${t('cuadra')}` : ` · ${t('no cuadra')}`}
            </p>
          )}
          <Button
            className="w-full"
            disabled={contado === null}
            loading={isPending}
            onClick={() => contado !== null && void run({ efectivo_contado: contado }).catch(() => undefined)}
          >
            {t('Registrar cierre')}
          </Button>
        </Card>
      )}
      <ProblemModal error={saveError} onClose={clearError} />
    </div>
  );
}
