import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireRole, RoleRedirect } from '@/components/layout/RequireRole';
import { Skeleton } from '@/components/ui';
import Login from '@/pages/auth/Login';
import Callback from '@/pages/auth/Callback';
import SelectPortal from '@/pages/auth/SelectPortal';

// Code-splitting por portal: un cliente nunca descarga el código de auditoría/operativa.
const Dashboard = lazy(() => import('@/pages/cliente/Dashboard'));
const Transferencias = lazy(() => import('@/pages/cliente/Transferencias'));
const Productos = lazy(() => import('@/pages/cliente/Productos'));
const Movimientos = lazy(() => import('@/pages/cliente/Movimientos'));
const Perfil = lazy(() => import('@/pages/cliente/Perfil'));
const DashboardAudit = lazy(() => import('@/pages/auditoria/DashboardAudit'));
const Bitacora = lazy(() => import('@/pages/auditoria/Bitacora'));
const Anomalias = lazy(() => import('@/pages/auditoria/Anomalias'));
const TerminalCaja = lazy(() => import('@/pages/operativa/TerminalCaja'));
const EventosCuenta = lazy(() => import('@/pages/operativa/EventosCuenta'));
const CierreCaja = lazy(() => import('@/pages/operativa/CierreCaja'));

export function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <Skeleton className="h-40" />
        </div>
      }
    >
      <Routes>
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/callback" element={<Callback />} />
        <Route path="/auth/portal" element={<SelectPortal />} />

        <Route
          path="/cliente"
          element={
            <RequireRole role="CLIENTE">
              <AppShell />
            </RequireRole>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="productos" element={<Productos />} />
          <Route path="transferencias" element={<Transferencias />} />
          <Route path="movimientos" element={<Movimientos />} />
          <Route path="perfil" element={<Perfil />} />
        </Route>

        <Route
          path="/auditoria"
          element={
            <RequireRole role="AUDITOR">
              <AppShell />
            </RequireRole>
          }
        >
          <Route index element={<DashboardAudit />} />
          <Route path="bitacora" element={<Bitacora />} />
          <Route path="anomalias" element={<Anomalias />} />
        </Route>

        <Route
          path="/operativa"
          element={
            <RequireRole role="OPERATIVO">
              <AppShell />
            </RequireRole>
          }
        >
          <Route index element={<TerminalCaja />} />
          <Route path="eventos" element={<EventosCuenta />} />
          <Route path="cierre" element={<CierreCaja />} />
        </Route>

        <Route path="/" element={<RoleRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
