import { useEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BRAND } from '@/config/brand';

/** Título único por ruta, descripción y robots (público solo el login; los portales son noindex). */
const ROUTES: Array<{ path: string; title: string; description?: string; index?: boolean }> = [
  {
    path: '/auth/login',
    title: 'Iniciar sesión',
    description: 'Ingresa a la banca en línea de Banco Andino Colombia de forma segura.',
    index: true,
  },
  { path: '/auth/callback', title: 'Verificando identidad' },
  { path: '/auth/portal', title: 'Elegir portal' },
  { path: '/cliente', title: 'Inicio' },
  { path: '/cliente/productos', title: 'Productos' },
  { path: '/cliente/transferencias', title: 'Transferir dinero' },
  { path: '/cliente/movimientos', title: 'Movimientos' },
  { path: '/cliente/perfil', title: 'Perfil y seguridad' },
  { path: '/auditoria', title: 'Resumen de auditoría' },
  { path: '/auditoria/bitacora', title: 'Bitácora de auditoría' },
  { path: '/auditoria/anomalias', title: 'Anomalías' },
  { path: '/operativa', title: 'Terminal de caja' },
  { path: '/operativa/eventos', title: 'Eventos de cuenta' },
  { path: '/operativa/cierre', title: 'Cierre de caja' },
];

function setMeta(name: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

export function PageMeta() {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  useEffect(() => {
    const r = ROUTES.find((x) => matchPath({ path: x.path, end: true }, pathname));
    document.title = r ? `${t(r.title)} · ${BRAND}` : `${BRAND} Colombia`;
    setMeta('description', r?.description ? t(r.description) : t('Banca en línea de Banco Andino Colombia.'));
    setMeta('robots', r?.index ? 'index, follow' : 'noindex, nofollow');
  }, [pathname, t, i18n.language]);
  return null;
}
