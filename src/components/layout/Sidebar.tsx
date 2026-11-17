import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NAV, ROLE_LABEL } from '@/config/routes';
import type { Rol } from '@/contracts';

export function Sidebar({ role }: { role: Rol }) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t(ROLE_LABEL[role])}
      className="hidden w-56 shrink-0 border-r border-line bg-card p-3 md:block"
    >
      <ul className="space-y-1">
        {NAV[role].map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium ${isActive ? 'bg-brand text-brand-on' : 'text-fg hover:bg-app'}`
              }
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
              {t(label)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
