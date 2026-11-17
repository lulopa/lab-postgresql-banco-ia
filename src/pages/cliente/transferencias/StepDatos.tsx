import { useTranslation } from 'react-i18next';
import { Button, Card, Input, MoneyInput, Select } from '@/components/ui';
import { maskLast4 } from '@/utils/format';
import type { CuentaOrigen, TransferErrors, TransferForm } from './types';

interface Props {
  form: TransferForm;
  onChange: (patch: Partial<TransferForm>) => void;
  cuentas: CuentaOrigen[];
  errors: TransferErrors;
  showErrors: boolean;
  onNext: () => void;
}

/** Paso 1: datos de la transferencia. */
export function StepDatos({ form, onChange, cuentas, errors, showErrors, onNext }: Props) {
  const { t } = useTranslation();
  const err = (k: keyof TransferErrors) => (showErrors ? errors[k] : undefined);
  return (
    <Card className="space-y-4">
      <Select
        label={t('Cuenta de origen')}
        value={form.origen}
        onChange={(e) => onChange({ origen: e.target.value })}
        error={err('origen')}
      >
        <option value="">{t('Selecciona…')}</option>
        {cuentas.map((c) => (
          <option key={c.id_cuenta} value={c.id_cuenta}>
            {maskLast4(c.numero_cuenta)}
          </option>
        ))}
      </Select>
      <Input
        label={t('Número de cuenta de destino')}
        value={form.destino}
        onChange={(e) => onChange({ destino: e.target.value })}
        autoComplete="off"
        error={err('destino')}
      />
      <MoneyInput
        label={t('Monto')}
        value={form.montoRaw}
        onValueChange={(v) => onChange({ montoRaw: v })}
        error={err('monto')}
      />
      <Input
        label={t('Concepto')}
        value={form.concepto}
        maxLength={80}
        onChange={(e) => onChange({ concepto: e.target.value })}
        error={err('concepto')}
      />
      <Button className="w-full" onClick={onNext}>
        {t('Revisar')}
      </Button>
    </Card>
  );
}
