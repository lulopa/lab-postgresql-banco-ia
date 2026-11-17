import { Languages, LogOut, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { ROLE_LABEL } from '@/config/routes';
import { BRAND } from '@/config/brand';
import { setLang } from '@/i18n';
import { Button } from '@/components/ui';

const LANG_NAME = { es: 'Español', en: 'English' } as const;

export function Header() {
  const { t, i18n } = useTranslation();
  const { usuario, activeRole, logout } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const next: 'es' | 'en' = i18n.language === 'en' ? 'es' : 'en';
  return (
    <header className="flex items-center justify-between bg-brand px-4 py-3 text-brand-on">
      <div>
        <p className="text-base font-bold">{BRAND}</p>
        {activeRole && <p className="text-xs font-medium">{t(ROLE_LABEL[activeRole])}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden text-sm font-medium sm:inline">{usuario?.nombre}</span>
        {/* El texto visible ES el nombre accesible (WCAG 2.5.3); `lang` hace que se pronuncie en su idioma. */}
        <button
          type="button"
          lang={next}
          onClick={() => setLang(next)}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-xs font-bold hover:bg-black/10"
        >
          <Languages className="h-5 w-5" strokeWidth={2} aria-hidden />
          {LANG_NAME[next]}
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === 'dark' ? t('Usar tema claro') : t('Usar tema oscuro')}
          className="min-h-[44px] min-w-[44px] rounded-lg p-2 hover:bg-black/10"
        >
          {theme === 'dark' ? (
            <Sun className="mx-auto h-5 w-5" strokeWidth={2} aria-hidden />
          ) : (
            <Moon className="mx-auto h-5 w-5" strokeWidth={2} aria-hidden />
          )}
        </button>
        <Button variant="secondary" onClick={() => void logout('usuario')}>
          <LogOut className="h-4 w-4" aria-hidden />
          {t('Salir')}
        </Button>
      </div>
    </header>
  );
}
