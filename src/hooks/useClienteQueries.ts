import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { clienteService } from '@/services/clienteService';
import type { HistorialParams } from '@/contracts';

export const usePosicionGlobal = () =>
  useQuery({
    queryKey: ['cliente', 'posicion'],
    queryFn: ({ signal }) => clienteService.posicionGlobal(signal),
  });

export const useHistorial = (params: HistorialParams) =>
  useQuery({
    queryKey: ['cliente', 'historial', params],
    queryFn: ({ signal }) => clienteService.historial(params, signal),
    placeholderData: keepPreviousData,
  });
