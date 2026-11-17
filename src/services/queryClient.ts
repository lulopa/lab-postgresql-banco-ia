import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './apiClient';

/** Datos bancarios: caché corta, sin reintentos sobre errores 4xx. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 2 * 60_000,
      refetchOnWindowFocus: false,
      retry: (n, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && n < 2,
    },
  },
});
