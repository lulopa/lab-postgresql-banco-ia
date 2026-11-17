import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useConsignacion, useRetiro } from '@/hooks/useOperativa';
import { Button, Card, Input, Modal, MoneyInput, ProblemModal } from '@/components/ui';
import { Money } from '@/components/shared/Money';
import { isIdCuentaDestino, parseMonto } from '@/utils/validators';
import { formatFechaHora } from '@/utils/format';
import type { OperacionCajaResponse } from '@/contracts';

type Tipo = 'CONSIGNACION' | 'RETIRO';

export default function TerminalCaja() {
  const { t } = useTranslation();
  const [tipo, setTipo] = useState<Tipo>('CONSIGNACION');
  const [cuenta, setCuenta] = useState('');
  const [montoRaw, setMontoRaw] = useState('');
  const [concepto, setConcepto] = useState('');
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [recibo, setRecibo] = useState<OperacionCajaResponse | null>(null);
  const consignar = useConsignacion();
  const retirar = useRetiro();
  const act = tipo === 'CONSIGNACION' ? consignar : retirar;
  const monto = parseMonto(montoRaw);
  const errs = {
    cuenta: isIdCuentaDestino(cuenta) ? undefined : t('Ingresa un identificador de cuenta válido.'),
    monto: monto ? undefined : t('Ingresa un monto mayor a cero.'),
    concepto: concepto.trim().length >= 3 ? undefined : t('Escribe un concepto de al menos 3 caracteres.'),
  };
  const valid = !errs.cuenta && !errs.monto && !errs.concepto;
  const label = tipo === 'CONSIGNACION' ? t('consignación') : t('retiro');

  const submit = async () => {
    if (!monto) return;
    try {
      setRecibo(await act.run({ id_cuenta: cuenta.trim(), monto, concepto: concepto.trim() }));
      setConfirming(false);
      setCuenta('');
      setMontoRaw('');
      setConcepto('');
      setTouched(false);
    } catch {
      setConfirming(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">{t('Terminal de caja')}</h1>
      {/* Radios nativos (teclado y lector de pantalla gratis); el estilo viene de `peer`. */}
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">{t('Tipo de operación')}</legend>
        {(['CONSIGNACION', 'RETIRO'] as const).map((v) => (
          <label key={v} className="relative">
            <input
              type="radio"
              name="tipo-operacion"
              value={v}
              checked={tipo === v}
              onChange={() => {
                setTipo(v);
                setRecibo(null);
              }}
              className="peer sr-only"
            />
            <span className="flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border border-line bg-card px-3 text-sm font-semibold text-fg peer-checked:border-brand peer-checked:bg-brand peer-checked:text-brand-on peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
              {v === 'CONSIGNACION' ? t('Consignación') : t('Retiro')}
            </span>
          </label>
        ))}
      </fieldset>
      <Card className="space-y-4">
        <Input
          label={t('Número de cuenta')}
          value={cuenta}
          onChange={(e) => setCuenta(e.target.value)}
          autoComplete="off"
          error={touched ? errs.cuenta : undefined}
        />
        <MoneyInput
          label={t('Monto en efectivo')}
          value={montoRaw}
          onValueChange={setMontoRaw}
          error={touched ? errs.monto : undefined}
        />
        <Input
          label={t('Concepto')}
          value={concepto}
          maxLength={80}
          onChange={(e) => setConcepto(e.target.value)}
          error={touched ? errs.concepto : undefined}
        />
        <Button
          className="w-full"
          variant={tipo === 'RETIRO' ? 'danger' : 'primary'}
          onClick={() => {
            setTouched(true);
            if (valid) setConfirming(true);
          }}
        >
          {t('Registrar {{operacion}}', { operacion: label })}
        </Button>
      </Card>
      {recibo && (
        <Card role="status" className="space-y-1">
          <CheckCircle2 className="h-6 w-6 text-success-text" strokeWidth={1.5} aria-hidden />
          <p className="font-semibold">
            {recibo.tipo === 'CONSIGNACION' ? t('Consignación registrada') : t('Retiro registrado')}
          </p>
          <p className="text-sm">
            {t('Valor')}: <Money value={recibo.monto} />
          </p>
          <p className="num break-all text-sm text-muted">
            {t('Transacción {{id}} · {{fecha}}', {
              id: recibo.id_transaccion,
              fecha: formatFechaHora(recibo.fecha),
            })}
          </p>
        </Card>
      )}
      <Modal
        open={confirming}
        title={t('Confirmar {{operacion}}', { operacion: label })}
        onClose={() => !act.isPending && setConfirming(false)}
        footer={
          <>
            <Button variant="secondary" disabled={act.isPending} onClick={() => setConfirming(false)}>
              {t('Cancelar')}
            </Button>
            <Button
              variant={tipo === 'RETIRO' ? 'danger' : 'primary'}
              loading={act.isPending}
              onClick={() => void submit()}
            >
              {t('Confirmar')}
            </Button>
          </>
        }
      >
        <p>
          {tipo === 'CONSIGNACION' ? t('Recibe') : t('Entrega')}{' '}
          <strong>{monto && <Money value={monto} />}</strong> {t('en efectivo, cuenta')}{' '}
          <span className="num">{cuenta.trim()}</span>.
        </p>
      </Modal>
      <ProblemModal error={act.error} onClose={act.clearError} />
    </div>
  );
}
