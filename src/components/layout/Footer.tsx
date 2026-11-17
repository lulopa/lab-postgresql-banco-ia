import { useTranslation } from 'react-i18next';
import { BRAND_FULL } from '@/config/brand';

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="px-4 py-6 pb-24 text-center text-xs text-muted md:pb-6">
      {BRAND_FULL} · {t('Vigilado por la Superintendencia Financiera de Colombia')}
    </footer>
  );
}
