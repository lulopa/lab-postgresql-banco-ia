import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NAV } from '@/config/routes';
import type { Rol } from '@/contracts';

export function BottomNav({ role }: { role: Rol }) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('Navegación móvil')}
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-card md:hidden"
    >
      {NAV[role].map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${isActive ? 'text-brand-text' : 'text-muted'}`
          }
        >
          <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
          {t(label)}
        </NavLink>
      ))}
    </nav>
  );
}
