import type { CodigoMoneda, IsoDateTime, UUID } from './common.types';

/** Códigos reales de banco_core.estado_cuenta. */
export type EstadoCuenta =
  'PENDIENTE_ACTIVACION' | 'ACTIVA' | 'BLOQUEADA_PARCIAL' | 'BLOQUEADA_TOTAL' | 'INACTIVA' | 'CERRADA';

export interface Titular {
  id_persona: UUID;
  nombres: string;
  apellidos: string;
  tipo_documento: string;
  numero_documento: string; // el BFF debe enviarlo enmascarado; la UI vuelve a enmascarar
}

export interface Cuenta {
  id_cuenta: UUID;
  numero_cuenta: string;
  tipo: 'AHORROS' | 'CORRIENTE' | 'NOMINA';
  estado: EstadoCuenta;
  moneda: CodigoMoneda;
  saldo_disponible: number;
}

export interface TarjetaCredito {
  id_tarjeta: UUID;
  ultimos_4: string;
  franquicia: string;
  cupo_total: number;
  cupo_disponible: number;
  estado: 'ACTIVA' | 'BLOQUEADA' | 'CANCELADA';
}

export interface InversionCdt {
  id_cdt: UUID;
  monto_invertido: number;
  tasa_ea: number; // porcentaje efectivo anual
  fecha_apertura: IsoDateTime;
  fecha_vencimiento: IsoDateTime;
  estado: 'VIGENTE' | 'VENCIDO' | 'REDIMIDO';
}

export interface Prestamo {
  id_prestamo: UUID;
  monto_original: number;
  saldo_pendiente: number;
  cuota_mensual: number;
  proxima_cuota: IsoDateTime;
  estado: 'AL_DIA' | 'EN_MORA' | 'PAGADO';
}

export interface PosicionGlobal {
  titular: Titular;
  saldo_consolidado: number;
  cuentas: Cuenta[];
  tarjetas_credito: TarjetaCredito[];
  inversiones_cdt: InversionCdt[];
  prestamos?: Prestamo[];
}

export interface TransferenciaRequest {
  id_cuenta_origen: UUID;
  /** NÚMERO de cuenta de destino (banco_core.cuenta.numero_cuenta), no el id interno. */
  id_cuenta_destino: string;
  monto: number;
  /** Se valida pero la BD no tiene columna para guardarlo. */
  concepto: string;
  otp_token: string;
}

export interface ComprobanteTransferencia {
  id_transaccion: UUID;
  fecha: IsoDateTime;
  id_cuenta_origen: UUID;
  id_cuenta_destino: string;
  monto: number;
  concepto: string;
}

export interface Movimiento {
  id_transaccion: UUID;
  fecha: IsoDateTime;
  id_cuenta: UUID;
  tipo: 'DEBITO' | 'CREDITO';
  concepto: string;
  monto: number;
  moneda: CodigoMoneda;
}

export interface HistorialParams {
  pagina?: number;
  tamano?: number;
  id_cuenta?: UUID;
}
