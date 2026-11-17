import { request } from './apiClient';
import type {
  CierreCajaRequest,
  CierreCajaResumen,
  EventoAdministrativoRequest,
  EventoAdministrativoResponse,
  OperacionCajaRequest,
  OperacionCajaResponse,
} from '@/contracts';

// DECISIÓN CONSERVADORA: el documento solo exige idempotencia en transferencias, pero todas las
// operaciones de caja que mueven dinero o estado también envían X-Idempotency-Key (el BFF puede ignorarla).
export const operativaService = {
  consignacion: (body: OperacionCajaRequest, key: string) =>
    request<OperacionCajaResponse>('/api/v1/operativa/caja/consignacion', {
      method: 'POST',
      body,
      idempotencyKey: key,
    }),
  eventoAdministrativo: (body: EventoAdministrativoRequest, key: string) =>
    request<EventoAdministrativoResponse>('/api/v1/operativa/cuentas/evento-administrativo', {
      method: 'POST',
      body,
      idempotencyKey: key,
    }),
  // No están en el documento §3.1 (retiro y cierre); los implementa el BFF sobre sp_retirar y la tabla cierre_caja:
  retiro: (body: OperacionCajaRequest, key: string) =>
    request<OperacionCajaResponse>('/api/v1/operativa/caja/retiro', {
      method: 'POST',
      body,
      idempotencyKey: key,
    }),
  cierreResumen: (signal?: AbortSignal) =>
    request<CierreCajaResumen>('/api/v1/operativa/caja/cierre', { signal }),
  registrarCierre: (body: CierreCajaRequest, key: string) =>
    request<CierreCajaResumen>('/api/v1/operativa/caja/cierre', {
      method: 'POST',
      body,
      idempotencyKey: key,
    }),
};
