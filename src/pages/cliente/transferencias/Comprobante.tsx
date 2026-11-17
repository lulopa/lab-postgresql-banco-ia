import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '@/components/ui';
import { Money } from '@/components/shared/Money';
import { formatFechaHora } from '@/utils/format';
import type { ComprobanteTransferencia } from '@/contracts';

/** Paso final: comprobante. */
export function Comprobante({ data, onNew }: { data: ComprobanteTransferencia; onNew: () => void }) {
  const { t } = useTranslation();
  return (
    <Card className="space-y-3">
      <CheckCircle2 className="h-8 w-8 text-success-text" strokeWidth={1.5} aria-hidden />
      <h2 className="text-lg font-semibold">{t('Transferencia exitosa')}</h2>
      <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted">{t('Comprobante')}</dt>
        <dd className="num break-all">{data.id_transaccion}</dd>
        <dt className="text-muted">{t('Fecha')}</dt>
        <dd className="num">{formatFechaHora(data.fecha)}</dd>
        <dt className="text-muted">{t('Monto')}</dt>
        <dd>
          <Money value={data.monto} />
        </dd>
      </dl>
      <Button onClick={onNew}>{t('Nueva transferencia')}</Button>
    </Card>
  );
}
