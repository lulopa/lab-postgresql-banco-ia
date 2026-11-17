import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

// Las pruebas del BFF corren en entorno `node` (sin window): no cargar el frontend allí.
if (typeof window !== 'undefined') {
  const { default: i18n } = await import('@/i18n'); // español por defecto, como en la app
  const { cleanup } = await import('@testing-library/react');
  const { queryClient } = await import('@/services/queryClient');
  const { useAuthStore } = await import('@/store/authStore');
  afterEach(() => {
    cleanup();
    queryClient.clear();
    useAuthStore.setState({
      status: 'anonymous',
      accessToken: null,
      usuario: null,
      activeRole: null,
      logoutReason: null,
    });
    vi.unstubAllGlobals();
    vi.useRealTimers();
    void i18n.changeLanguage('es');
    localStorage.clear();
    sessionStorage.clear();
  });
}
