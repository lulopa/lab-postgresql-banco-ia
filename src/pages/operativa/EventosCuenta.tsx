import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEventoAdministrativo } from '@/hooks/useOperativa';
import { Button, Card, Input, Modal, ProblemModal, Select, Textarea } from '@/components/ui';
import { useToast } from '@/components/shared/Toast';
import { isIdCuentaDestino } from '@/utils/validators';
import type { TipoEventoCuenta } from '@/contracts';

const TIPOS: { v: TipoEventoCuenta; l: string }[] = [
  { v: 'BLOQUEO_PARCIAL', l: 'Bloqueo parcial (solo débitos)' },
  { v: 'BLOQUEO_TOTAL', l: 'Bloqueo total (débitos y créditos)' },
  { v: 'DESBLOQUEO', l: 'Desbloqueo' },
  { v: 'ACTIVACION', l: 'Activar cuenta pendiente' },
  { v: 'REACTIVACION', l: 'Reactivar cuenta inactiva' },
  { v: 'CIERRE', l: 'Cierre definitivo (saldo en cero)' },
];

export default function EventosCuenta() {
  const { t } = useTranslation();
  const [cuenta, setCuenta] = useState('');
  const [tipo, setTipo] = useState<TipoEventoCuenta>('BLOQUEO_PARCIAL');
  const [motivo, setMotivo] = useState('');
  const [referencia, setReferencia] = useState('');
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { run, isPending, error, clearError } = useEventoAdministrativo();
  const toast = useToast();
  const errs = {
    cuenta: isIdCuentaDestino(cuenta) ? undefined : t('Ingresa un identificador de cuenta válido.'),
    motivo: motivo.trim().length >= 10 ? undefined : t('Describe el motivo en al menos 10 caracteres.'),
  };
  const valid = !errs.cuenta && !errs.motivo;
  const label = t(TIPOS.find((x) => x.v === tipo)?.l ?? tipo);

  const submit = async () => {
    try {
      await run({
        id_cuenta: cuenta.trim(),
        tipo_evento: tipo,
        motivo: motivo.trim(),
        referencia: referencia.trim() || undefined,
      });
      toast(t('{{evento}}: registrado.', { evento: label }));
      setCuenta('');
      setMotivo('');
      setReferencia('');
      setTouched(false);
    } catch {
      /* ProblemModal */
    }
    setConfirming(false);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">{t('Eventos de cuenta')}</h1>
      <Card className="space-y-4">
        <Input
          label={t('Número de cuenta')}
          value={cuenta}
          onChange={(e) => setCuenta(e.target.value)}
          autoComplete="off"
          error={touched ? errs.cuenta : undefined}
        />
        <Select
          label={t('Tipo de evento')}
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoEventoCuenta)}
        >
          {TIPOS.map((x) => (
            <option key={x.v} value={x.v}>
              {t(x.l)}
            </option>
          ))}
        </Select>
        <Textarea
          label={t('Motivo')}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          error={touched ? errs.motivo : undefined}
        />
        <Input
          label={t('Referencia (oficio, radicado)')}
          value={referencia}
          onChange={(e) => setReferencia(e.target.value)}
        />
        <Button
          className="w-full"
          variant="danger"
          onClick={() => {
            setTouched(true);
            if (valid) setConfirming(true);
          }}
        >
          {t('Registrar evento')}
        </Button>
      </Card>
      <Modal
        open={confirming}
        title={t('Confirmar evento')}
        onClose={() => !isPending && setConfirming(false)}
        footer={
          <>
            <Button variant="secondary" disabled={isPending} onClick={() => setConfirming(false)}>
              {t('Cancelar')}
            </Button>
            <Button variant="danger" loading={isPending} onClick={() => void submit()}>
              {t('Confirmar')}
            </Button>
          </>
        }
      >
        <p>
          {label} {t('sobre la cuenta')} <span className="num">{cuenta.trim()}</span>.{' '}
          {t('Queda registrado en la bitácora.')}
        </p>
      </Modal>
      <ProblemModal error={error} onClose={clearError} />
    </div>
  );
}
