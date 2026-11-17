import { useTranslation } from 'react-i18next';
import { Button, Card, Input } from '@/components/ui';
import { Money } from '@/components/shared/Money';
import { isValidOtp, OTP_LENGTH } from '@/utils/validators';

interface Props {
  monto: number;
  otp: string;
  onOtp: (v: string) => void;
  message: string | null;
  pending: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

/** Paso 3: OTP. El botón se deshabilita mientras la petición está en vuelo (documento §5.5). */
export function StepOtp({ monto, otp, onOtp, message, pending, onBack, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold">{t('Confirma con tu código')}</h2>
      {message && (
        <p role="status" className="text-sm text-muted">
          {message}
        </p>
      )}
      <Input
        label={t('Código de 6 dígitos')}
        value={otp}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        onChange={(e) => onOtp(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
        className="num tracking-widest"
      />
      <div className="flex gap-2">
        <Button variant="secondary" disabled={pending} onClick={onBack}>
          {t('Atrás')}
        </Button>
        <Button className="flex-1" loading={pending} disabled={!isValidOtp(otp)} onClick={onConfirm}>
          {t('Confirmar transferencia de')} <Money value={monto} />
        </Button>
      </div>
    </Card>
  );
}
