/**
 * i18n con i18next. Claves en lenguaje natural (español = idioma fuente): si falta una traducción se muestra el español.
 * La prueba src/test/i18n.test.ts exige que (1) no haya texto fijo en JSX y (2) toda clave t('...') exista en en.ts.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';

export const LANGS = ['es', 'en'] as const;
export type Lang = (typeof LANGS)[number];
const KEY = 'andino.lang';

function initial(): Lang {
  try {
    const s = localStorage.getItem(KEY);
    if (s === 'es' || s === 'en') return s;
  } catch {
    /* sin storage */
  }
  return 'es'; // banco colombiano: español por defecto
}

void i18n.use(initReactI18next).init({
  lng: initial(),
  fallbackLng: 'es',
  keySeparator: false,
  nsSeparator: false,
  resources: { es: { translation: {} }, en: { translation: en } },
  interpolation: { escapeValue: false }, // React ya escapa
  returnEmptyString: false,
});

const syncHtmlLang = (lng: string) => {
  document.documentElement.lang = lng === 'en' ? 'en' : 'es-CO';
};
syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* preferencia no crítica */
  }
  void i18n.changeLanguage(lang);
}

export default i18n;
