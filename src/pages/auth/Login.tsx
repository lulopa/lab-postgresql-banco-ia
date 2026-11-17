import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore, type LogoutReason } from '@/store/authStore';
import { ROLE_HOME } from '@/config/routes';
import { BRAND } from '@/config/brand';
import { Button } from '@/components/ui';

const MSG: Record<Exclude<LogoutReason, null | 'usuario'>, string> = {
  inactividad: 'Cerramos tu sesión por 15 minutos de inactividad.',
  sesion_expirada: 'Tu sesión expiró. Inicia sesión de nuevo.',
};

export default function Login() {
  const { t } = useTranslation();
  const { status, activeRole, logoutReason, startLogin } = useAuthStore();
  const [busy, setBusy] = useState(false);
  if (status === 'authenticated')
    return <Navigate to={activeRole ? ROLE_HOME[activeRole] : '/auth/portal'} replace />;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-app p-4 text-fg">
      <div className="w-full max-w-sm rounded-xl border border-line bg-card p-6">
        <Landmark className="h-8 w-8 text-brand-text" strokeWidth={1.5} aria-hidden />
        <h1 className="mt-3 text-2xl font-bold">{BRAND}</h1>
        <p className="mt-1 text-sm text-muted">{t('Ingresa con tu cuenta del banco.')}</p>
        {logoutReason && logoutReason !== 'usuario' && (
          <p role="status" className="mt-4 rounded-lg border border-line p-3 text-sm">
            {t(MSG[logoutReason])}
          </p>
        )}
        <Button
          className="mt-6 w-full"
          loading={busy}
          onClick={() => {
            setBusy(true);
            void startLogin();
          }}
        >
          {t('Iniciar sesión')}
        </Button>
      </div>
    </main>
  );
}
