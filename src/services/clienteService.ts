import { request } from './apiClient';
import type {
  ComprobanteTransferencia,
  HistorialParams,
  Movimiento,
  Paginado,
  PosicionGlobal,
  TransferenciaRequest,
} from '@/contracts';

export const clienteService = {
  posicionGlobal: (signal?: AbortSignal) =>
    request<PosicionGlobal>('/api/v1/cliente/posicion-global', { signal }),
  historial: (params: HistorialParams, signal?: AbortSignal) =>
    request<Paginado<Movimiento>>('/api/v1/transacciones/historial', { query: { ...params }, signal }),
  transferir: (body: TransferenciaRequest, idempotencyKey: string) =>
    request<ComprobanteTransferencia>('/api/v1/transacciones/transferir', {
      method: 'POST',
      body,
      idempotencyKey,
    }),
};
