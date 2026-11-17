import { EyeOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowBlur } from '@/hooks/useWindowBlur';

/** Desenfoca el contenido cuando la ventana pierde el foco (documento §5.3). */
export function PrivacyShield({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const obscured = useWindowBlur();
  return (
    <>
      <div
        className={obscured ? 'privacy-blur' : undefined}
        aria-hidden={obscured || undefined}
        data-obscured={obscured}
      >
        {children}
      </div>
      {obscured && (
        <div role="status" className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <p className="flex items-center gap-2 rounded-lg border border-line bg-card px-4 py-3 text-sm font-medium text-fg">
            <EyeOff className="h-5 w-5" strokeWidth={2} aria-hidden />{' '}
            {t('Contenido oculto por privacidad. Vuelve a esta ventana para continuar.')}
          </p>
        </div>
      )}
    </>
  );
}
