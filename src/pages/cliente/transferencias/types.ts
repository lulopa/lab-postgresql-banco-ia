import type { Cuenta } from '@/contracts';

export interface TransferForm {
  origen: string;
  destino: string;
  montoRaw: string;
  concepto: string;
}
export type TransferErrors = Partial<Record<'origen' | 'destino' | 'monto' | 'concepto', string>>;
export type Step = 1 | 2 | 3 | 4;
export type CuentaOrigen = Pick<Cuenta, 'id_cuenta' | 'numero_cuenta'>;
