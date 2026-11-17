import type { IsoDateTime, UUID } from './common.types';

export interface OperacionCajaRequest {
  /** Número de cuenta (banco_core.cuenta.numero_cuenta). */
  id_cuenta: string;
  monto: number;
  concepto: string;
}

export interface OperacionCajaResponse {
  id_transaccion: UUID;
  fecha: IsoDateTime;
  tipo: 'CONSIGNACION' | 'RETIRO';
  monto: number;
  id_cuenta: string;
}

/** Eventos que la BD soporta con procedimientos (REACTIVACION requiere sql/010_bff_soporte.sql). */
export type TipoEventoCuenta =
  'BLOQUEO_PARCIAL' | 'BLOQUEO_TOTAL' | 'DESBLOQUEO' | 'ACTIVACION' | 'REACTIVACION' | 'CIERRE';

export interface EventoAdministrativoRequest {
  id_cuenta: string;
  tipo_evento: TipoEventoCuenta;
  motivo: string;
  referencia?: string;
}

export interface EventoAdministrativoResponse {
  id_evento: UUID;
  fecha: IsoDateTime;
  tipo_evento: TipoEventoCuenta;
  id_cuenta: string;
}

export interface CierreCajaResumen {
  fecha: string;
  num_operaciones: number;
  total_consignaciones: number;
  total_retiros: number;
  efectivo_esperado: number;
  estado: 'ABIERTA' | 'CERRADA' | 'DESCUADRADA';
}

export interface CierreCajaRequest {
  efectivo_contado: number;
}
