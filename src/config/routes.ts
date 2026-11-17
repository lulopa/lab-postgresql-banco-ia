import {
  ArrowLeftRight,
  BookOpen,
  ClipboardList,
  CreditCard,
  FileClock,
  Home,
  Landmark,
  ShieldAlert,
  UserRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Rol } from '@/contracts';

export const ROLE_HOME: Record<Rol, string> = {
  CLIENTE: '/cliente',
  AUDITOR: '/auditoria',
  OPERATIVO: '/operativa',
};

export const ROLE_LABEL: Record<Rol, string> = {
  CLIENTE: 'Portal Cliente',
  AUDITOR: 'Portal Auditor',
  OPERATIVO: 'Portal Operativo',
};

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export const NAV: Record<Rol, NavItem[]> = {
  CLIENTE: [
    { to: '/cliente', label: 'Inicio', icon: Home, end: true },
    { to: '/cliente/productos', label: 'Productos', icon: CreditCard },
    { to: '/cliente/transferencias', label: 'Transferir', icon: ArrowLeftRight },
    { to: '/cliente/movimientos', label: 'Movimientos', icon: FileClock },
    { to: '/cliente/perfil', label: 'Perfil', icon: UserRound },
  ],
  AUDITOR: [
    { to: '/auditoria', label: 'Resumen', icon: Home, end: true },
    { to: '/auditoria/bitacora', label: 'Bitácora', icon: BookOpen },
    { to: '/auditoria/anomalias', label: 'Anomalías', icon: ShieldAlert },
  ],
  OPERATIVO: [
    { to: '/operativa', label: 'Caja', icon: Wallet, end: true },
    { to: '/operativa/eventos', label: 'Eventos', icon: ClipboardList },
    { to: '/operativa/cierre', label: 'Cierre', icon: Landmark },
  ],
};
