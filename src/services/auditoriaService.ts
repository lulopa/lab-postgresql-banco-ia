import { request } from './apiClient';
import {
  VENTANA_RAFAGA_SEGUNDOS,
  type AnomaliaDivisa,
  type BitacoraEntrada,
  type BitacoraFiltros,
  type CuentaDurmiente,
  type Paginado,
  type PaginacionParams,
  type RafagasResponse,
} from '@/contracts';

export const auditoriaService = {
  bitacora: (f: BitacoraFiltros, signal?: AbortSignal) =>
    request<Paginado<BitacoraEntrada>>('/api/v1/auditoria/bitacora', { query: { ...f }, signal }),
  divisas: (p: PaginacionParams = {}, signal?: AbortSignal) =>
    request<Paginado<AnomaliaDivisa>>('/api/v1/auditoria/anomalias/divisas', { query: { ...p }, signal }),
  rafagas: (signal?: AbortSignal) =>
    request<RafagasResponse>('/api/v1/auditoria/anomalias/rafagas', {
      query: { ventana_segundos: VENTANA_RAFAGA_SEGUNDOS },
      signal,
    }),
  // No está en el documento §3.1; el BFF lo implementa sobre cuentas en estado INACTIVA (solo lectura).
  durmientes: (p: PaginacionParams = {}, signal?: AbortSignal) =>
    request<Paginado<CuentaDurmiente>>('/api/v1/auditoria/anomalias/durmientes', { query: { ...p }, signal }),
};
