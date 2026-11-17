import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { operativaService } from '@/services/operativaService';
import { useIdempotentAction } from './useIdempotentAction';
import type { CierreCajaRequest, EventoAdministrativoRequest, OperacionCajaRequest } from '@/contracts';

/** Toda operación operativa invalida la bitácora: el auditor/operador ve el asiento sin recargar. */
function useRefreshAfterWrite() {
  const qc = useQueryClient();
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['auditoria'] });
    void qc.invalidateQueries({ queryKey: ['operativa'] });
  }, [qc]);
}

export function useConsignacion() {
  const done = useRefreshAfterWrite();
  const action = useCallback((r: OperacionCajaRequest, k: string) => operativaService.consignacion(r, k), []);
  return useIdempotentAction(action, done);
}
export function useRetiro() {
  const done = useRefreshAfterWrite();
  const action = useCallback((r: OperacionCajaRequest, k: string) => operativaService.retiro(r, k), []);
  return useIdempotentAction(action, done);
}
export function useEventoAdministrativo() {
  const done = useRefreshAfterWrite();
  const action = useCallback(
    (r: EventoAdministrativoRequest, k: string) => operativaService.eventoAdministrativo(r, k),
    [],
  );
  return useIdempotentAction(action, done);
}
export function useRegistrarCierre() {
  const done = useRefreshAfterWrite();
  const action = useCallback((r: CierreCajaRequest, k: string) => operativaService.registrarCierre(r, k), []);
  return useIdempotentAction(action, done);
}
export const useCierreResumen = () =>
  useQuery({
    queryKey: ['operativa', 'cierre'],
    queryFn: ({ signal }) => operativaService.cierreResumen(signal),
  });
