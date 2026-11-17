import { useTranslation } from 'react-i18next';
import { Button, Card } from '@/components/ui';
import { Money } from '@/components/shared/Money';
import { maskLast4 } from '@/utils/format';
import type { TransferForm } from './types';

interface Props {
  form: TransferForm;
  numeroOrigen: string;
  monto: number;
  busy: boolean;
  onBack: () => void;
  onRequestOtp: () => void;
}

/** Paso 2: revisión y solicitud del código de seguridad. */
export function StepRevision({ form, numeroOrigen, monto, busy, onBack, onRequestOtp }: Props) {
  const { t } = useTranslation();
  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">{t('Revisa los datos')}</h2>
      <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted">{t('Desde')}</dt>
        <dd className="num">{maskLast4(numeroOrigen)}</dd>
        <dt className="text-muted">{t('Hacia')}</dt>
        <dd className="num">{form.destino.trim()}</dd>
        <dt className="text-muted">{t('Monto')}</dt>
        <dd className="font-semibold">
          <Money value={monto} />
        </dd>
        <dt className="text-muted">{t('Concepto')}</dt>
        <dd>{form.concepto.trim()}</dd>
      </dl>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack}>
          {t('Editar')}
        </Button>
        <Button className="flex-1" loading={busy} onClick={onRequestOtp}>
          {t('Enviar código de seguridad')}
        </Button>
      </div>
    </Card>
  );
}
