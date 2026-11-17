import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { auditoriaService } from '@/services/auditoriaService';
import type { BitacoraFiltros, PaginacionParams } from '@/contracts';

/** "Tiempo real": sondeo cada 15 s solo con la pestaña visible. */
export const useBitacora = (f: BitacoraFiltros) =>
  useQuery({
    queryKey: ['auditoria', 'bitacora', f],
    queryFn: ({ signal }) => auditoriaService.bitacora(f, signal),
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  });

export const useDivisas = (p: PaginacionParams = {}) =>
  useQuery({
    queryKey: ['auditoria', 'divisas', p],
    queryFn: ({ signal }) => auditoriaService.divisas(p, signal),
  });

export const useRafagas = () =>
  useQuery({ queryKey: ['auditoria', 'rafagas'], queryFn: ({ signal }) => auditoriaService.rafagas(signal) });

export const useDurmientes = (p: PaginacionParams = {}) =>
  useQuery({
    queryKey: ['auditoria', 'durmientes', p],
    queryFn: ({ signal }) => auditoriaService.durmientes(p, signal),
  });
