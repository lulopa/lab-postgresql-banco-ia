import { Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { Footer } from './Footer';
import { PrivacyShield } from './PrivacyShield';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

export function AppShell() {
  const { t } = useTranslation();
  const { activeRole, logout } = useAuthStore();
  const location = useLocation();
  const denied = (location.state as { accesoDenegado?: string } | null)?.accesoDenegado;
  useInactivityLogout(true, () => void logout('inactividad'));
  if (!activeRole) return null;
  return (
    <PrivacyShield>
      <div data-testid="shell" data-portal={activeRole} className="flex min-h-dvh flex-col bg-app text-fg">
        <Header />
        <div className="flex flex-1">
          <Sidebar role={activeRole} />
          <main id="contenido" className="min-w-0 flex-1 p-4 pb-24 md:p-8 md:pb-8">
            {denied && (
              <div
                role="alert"
                className="mb-4 flex items-center gap-2 rounded-xl border border-danger-text bg-card p-3 text-sm"
              >
                <ShieldAlert className="h-5 w-5 text-danger-text" aria-hidden />{' '}
                {t('No tienes permiso para acceder a esa sección.')}
              </div>
            )}
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
        <Footer />
        <BottomNav role={activeRole} />
      </div>
    </PrivacyShield>
  );
}
