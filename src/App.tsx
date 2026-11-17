import { useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/store/authStore';
import { ToastProvider } from '@/components/shared/Toast';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { PageMeta } from '@/components/shared/PageMeta';
import { AppRoutes } from './router';

/** Restaura la sesión con la cookie de refresh, salvo durante el callback OIDC. */
function AuthBootstrap() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname.startsWith('/auth/callback')) useAuthStore.setState({ status: 'anonymous' });
    else void useAuthStore.getState().bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <AuthBootstrap />
            <PageMeta />
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
