import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePosicionGlobal } from '@/hooks/useClienteQueries';
import { useTransferir } from '@/hooks/useTransferir';
import { authService } from '@/services/authService';
import { ProblemModal, Skeleton } from '@/components/ui';
import { ProblemBanner } from '@/components/shared/ProblemBanner';
import { isIdCuentaDestino, isValidOtp, OTP_LENGTH, parseMonto } from '@/utils/validators';
import type { ComprobanteTransferencia } from '@/contracts';
import { Comprobante } from './transferencias/Comprobante';
import { StepDatos } from './transferencias/StepDatos';
import { StepOtp } from './transferencias/StepOtp';
import { StepRevision } from './transferencias/StepRevision';
import type { Step, TransferErrors, TransferForm } from './transferencias/types';

const EMPTY: TransferForm = { origen: '', destino: '', montoRaw: '', concepto: '' };

/** Flujo de 3 pasos (datos → revisión → OTP) + comprobante. Cada paso es un componente propio. */
export default function Transferencias() {
  const { t } = useTranslation();
  const { data, isLoading, error: loadError, refetch } = usePosicionGlobal();
  const { transferir, isPending, error, clearError } = useTransferir();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<TransferForm>(EMPTY);
  const [otp, setOtp] = useState('');
  const [otpMsg, setOtpMsg] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState<Error | null>(null);
  const [comprobante, setComprobante] = useState<ComprobanteTransferencia | null>(null);
  const [touched, setTouched] = useState(false);

  const cuentas = useMemo(
    () => data?.cuentas.filter((c) => c.estado === 'ACTIVA' && c.moneda === 'COP') ?? [],
    [data],
  );
  const monto = parseMonto(form.montoRaw);
  const cuentaOrigen = cuentas.find((c) => c.id_cuenta === form.origen);
  const errors: TransferErrors = {
    origen: form.origen ? undefined : t('Elige la cuenta de origen.'),
    destino: !isIdCuentaDestino(form.destino)
      ? t('Ingresa un identificador de cuenta válido.')
      : form.destino.trim() === cuentaOrigen?.numero_cuenta
        ? t('El destino debe ser distinto al origen.')
        : undefined,
    monto: !monto
      ? t('Ingresa un monto mayor a cero.')
      : cuentaOrigen && monto > cuentaOrigen.saldo_disponible
        ? t('El monto supera tu saldo disponible.')
        : undefined,
    concepto:
      form.concepto.trim().length < 3 ? t('Escribe un concepto de al menos 3 caracteres.') : undefined,
  };
  const valid = !errors.origen && !errors.destino && !errors.monto && !errors.concepto;

  if (isLoading) return <Skeleton className="h-64" />;
  if (loadError || !data) return <ProblemBanner error={loadError} onRetry={() => void refetch()} />;

  const requestOtp = async () => {
    setOtpBusy(true);
    try {
      const r = await authService.solicitarOtp('TRANSFERENCIA');
      setOtpMsg(
        t('Enviamos un código de {{n}} dígitos por {{canal}}.', {
          n: OTP_LENGTH,
          canal: r.canal === 'SMS' ? t('SMS') : t('correo'),
        }),
      );
      setStep(3);
    } catch (e) {
      setOtpMsg(null);
      setOtpError(e instanceof Error ? e : new Error(t('No pudimos enviar el código.')));
    } finally {
      setOtpBusy(false);
    }
  };
  const confirm = async () => {
    if (!monto || !isValidOtp(otp)) return;
    try {
      const c = await transferir({
        id_cuenta_origen: form.origen,
        id_cuenta_destino: form.destino.trim(),
        monto,
        concepto: form.concepto.trim(),
        otp_token: otp,
      });
      setOtp('');
      setComprobante(c);
      setStep(4);
    } catch {
      /* ProblemModal muestra el error RFC 7807 */
    }
  };
  const reset = () => {
    setStep(1);
    setComprobante(null);
    setForm(EMPTY);
    setTouched(false);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">{t('Transferir dinero')}</h1>
      <p className="num text-sm text-muted" aria-live="polite">
        {t('Paso {{n}} de 3', { n: Math.min(step, 3) })}
      </p>
      {step === 1 && (
        <StepDatos
          form={form}
          onChange={(p) => setForm((f) => ({ ...f, ...p }))}
          cuentas={cuentas}
          errors={errors}
          showErrors={touched}
          onNext={() => {
            setTouched(true);
            if (valid) setStep(2);
          }}
        />
      )}
      {step === 2 && monto && (
        <StepRevision
          form={form}
          numeroOrigen={cuentaOrigen?.numero_cuenta ?? ''}
          monto={monto}
          busy={otpBusy}
          onBack={() => setStep(1)}
          onRequestOtp={() => void requestOtp()}
        />
      )}
      {step === 3 && monto && (
        <StepOtp
          monto={monto}
          otp={otp}
          onOtp={setOtp}
          message={otpMsg}
          pending={isPending}
          onBack={() => {
            setOtp('');
            setStep(2);
          }}
          onConfirm={() => void confirm()}
        />
      )}
      {step === 4 && comprobante && <Comprobante data={comprobante} onNew={reset} />}
      <ProblemModal
        error={otpError ?? error}
        onClose={() => {
          setOtpError(null);
          clearError();
        }}
      />
    </div>
  );
}
