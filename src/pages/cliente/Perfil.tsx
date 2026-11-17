import { useTranslation } from 'react-i18next';
import { usePosicionGlobal } from '@/hooks/useClienteQueries';
import { useAuthStore } from '@/store/authStore';
import { Button, Card, Skeleton } from '@/components/ui';
import { ProblemBanner } from '@/components/shared/ProblemBanner';
import { maskLast4 } from '@/utils/format';

export default function Perfil() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = usePosicionGlobal();
  const logout = useAuthStore((s) => s.logout);
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">{t('Perfil y seguridad')}</h1>
      {isLoading ? (
        <Skeleton />
      ) : error || !data ? (
        <ProblemBanner error={error} onRetry={() => void refetch()} />
      ) : (
        <Card>
          <h2 className="text-lg font-semibold">{t('Tus datos')}</h2>
          <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted">{t('Nombre')}</dt>
            <dd>
              {data.titular.nombres} {data.titular.apellidos}
            </dd>
            <dt className="text-muted">{t('Documento')}</dt>
            <dd className="num">
              {data.titular.tipo_documento} {maskLast4(data.titular.numero_documento)}
            </dd>
          </dl>
        </Card>
      )}
      <Card>
        <h2 className="text-lg font-semibold">{t('Seguridad de la sesión')}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>{t('Cerramos tu sesión tras 15 minutos sin actividad.')}</li>
          <li>{t('Ocultamos la pantalla cuando cambias de ventana.')}</li>
          <li>{t('Las transferencias requieren un código de 6 dígitos.')}</li>
        </ul>
        <Button className="mt-4" variant="danger" onClick={() => void logout('usuario')}>
          {t('Cerrar sesión')}
        </Button>
      </Card>
    </div>
  );
}
