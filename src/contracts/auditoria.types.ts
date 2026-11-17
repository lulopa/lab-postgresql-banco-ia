import type { CodigoMoneda, IsoDateTime, UUID } from './common.types';

export type OperacionAuditoria = 'INSERT' | 'UPDATE' | 'DELETE';
export type PayloadJsonb = Record<string, unknown> | null;

/** Fila de banco_audit.auditoria_operacion */
export interface BitacoraEntrada {
  id_auditoria: number | string;
  fecha: IsoDateTime;
  usuario: string;
  operacion: OperacionAuditoria;
  tabla: string;
  payload_anterior: PayloadJsonb;
  payload_nuevo: PayloadJsonb;
}

export interface BitacoraFiltros {
  desde?: string;
  hasta?: string;
  tabla?: string;
  usuario?: string;
  pagina?: number;
  tamano?: number;
}

export interface AnomaliaDivisa {
  id_auditoria: number | string;
  fecha: IsoDateTime;
  usuario: string;
  tabla: string;
  moneda: CodigoMoneda;
  monto: number;
  payload: PayloadJsonb;
}

export interface Rafaga {
  id_cuenta: UUID;
  numero_cuenta: string;
  cantidad: number;
  primera: IsoDateTime;
  ultima: IsoDateTime;
  monto_total: number;
  ids_transaccion: UUID[];
}

export interface RafagasResponse {
  ventana_segundos: number;
  items: Rafaga[];
}

/** Ventana normativa fija del documento §3.1 (< 300 s). */
export const VENTANA_RAFAGA_SEGUNDOS = 300;

export interface CuentaDurmiente {
  id_cuenta: UUID;
  numero_cuenta: string;
  ultima_actividad: IsoDateTime;
  dias_inactiva: number;
  estado: 'INACTIVA'; // cuentas en estado INACTIVA (sin movimientos > 6 meses)
}
