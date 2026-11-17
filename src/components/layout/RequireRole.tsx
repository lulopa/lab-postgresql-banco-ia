import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';
import { ROLE_HOME } from '@/config/routes';
import { Skeleton } from '@/components/ui';
import type { Rol } from '@/contracts';

/**
 * Guardia de ruta por rol.
 *  - sin sesión            => /auth/login
 *  - varios roles sin elegir => /auth/portal
 *  - rol distinto al exigido => portal propio del rol activo (documento §7.3.1), con aviso de acceso denegado.
 * Es control de UX: el BFF y PostgreSQL (RBAC G7) siguen siendo la autoridad.
 */
export function RequireRole({ role, children }: { role: Rol; children?: ReactNode }) {
  const { status, activeRole } = useAuthStore();
  const location = useLocation();
  if (status === 'checking')
    return (
      <div className="p-8">
        <Skeleton className="h-40" />
      </div>
    );
  if (status !== 'authenticated') return <Navigate to="/auth/login" replace />;
  if (!activeRole) return <Navigate to="/auth/portal" replace />;
  if (activeRole !== role)
    return <Navigate to={ROLE_HOME[activeRole]} replace state={{ accesoDenegado: location.pathname }} />;
  return <>{children ?? <Outlet />}</>;
}

export function RoleRedirect() {
  const { status, activeRole } = useAuthStore();
  if (status === 'checking') return null;
  if (status !== 'authenticated') return <Navigate to="/auth/login" replace />;
  return <Navigate to={activeRole ? ROLE_HOME[activeRole] : '/auth/portal'} replace />;
}
