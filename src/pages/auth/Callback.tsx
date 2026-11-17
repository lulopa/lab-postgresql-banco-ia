import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui';

/** Recibe ?code&state del IdP. El `state` debe coincidir con el guardado (anti-CSRF); el code se usa una sola vez. */
export default function Callback() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const completeLogin = useAuthStore((s) => s.completeLogin);
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  const code = params.get('code');

  useEffect(() => {
    if (started.current || !code) return;
    started.current = true;
    void completeLogin(code, params.get('state')).then((ok) =>
      ok ? nav('/', { replace: true }) : setFailed(true),
    );
  }, [code, params, completeLogin, nav]);

  if (!code || params.get('error')) return <Navigate to="/auth/login" replace />;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-app p-4 text-fg">
      {failed ? (
        <div role="alert" className="text-center">
          <p className="font-semibold">{t('No pudimos verificar tu inicio de sesión.')}</p>
          <Button className="mt-4" onClick={() => nav('/auth/login', { replace: true })}>
            {t('Volver a intentar')}
          </Button>
        </div>
      ) : (
        <p role="status">{t('Verificando tu identidad…')}</p>
      )}
    </main>
  );
}
