import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { ROLE_HOME, ROLE_LABEL } from '@/config/routes';
import { Button } from '@/components/ui';

export default function SelectPortal() {
  const { t } = useTranslation();
  const { status, usuario, activeRole, selectRole } = useAuthStore();
  const nav = useNavigate();
  if (status !== 'authenticated' || !usuario) return <Navigate to="/auth/login" replace />;
  if (activeRole) return <Navigate to={ROLE_HOME[activeRole]} replace />;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-app p-4 text-fg">
      <div className="w-full max-w-sm rounded-xl border border-line bg-card p-6">
        <h1 className="text-xl font-bold">{t('¿Con qué rol quieres ingresar?')}</h1>
        <p className="mt-1 text-sm text-muted">{t('Por seguridad, cada sesión usa un solo rol.')}</p>
        <div className="mt-4 space-y-2">
          {usuario.roles.map((r) => (
            <Button
              key={r}
              variant="secondary"
              className="w-full"
              onClick={() => {
                selectRole(r);
                nav(ROLE_HOME[r], { replace: true });
              }}
            >
              {t(ROLE_LABEL[r])}
            </Button>
          ))}
        </div>
      </div>
    </main>
  );
}
