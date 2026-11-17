import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { clienteService } from '@/services/clienteService';
import { useIdempotentAction } from './useIdempotentAction';
import type { TransferenciaRequest } from '@/contracts';

export function useTransferir() {
  const qc = useQueryClient();
  const action = useCallback(
    (req: TransferenciaRequest, key: string) => clienteService.transferir(req, key),
    [],
  );
  const onSuccess = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['cliente'] });
    void qc.invalidateQueries({ queryKey: ['auditoria'] });
  }, [qc]);
  const { run, ...rest } = useIdempotentAction(action, onSuccess);
  return { transferir: run, ...rest };
}
