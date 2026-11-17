import type { Decorator, Preview } from '@storybook/react';
import '@fontsource-variable/inter';
import '../src/index.css';
import '../src/i18n';
import i18n from '../src/i18n';

/** Alterna tema claro/oscuro e idioma desde la barra de herramientas de Storybook. */
const withTheme: Decorator = (Story, ctx) => {
  document.documentElement.classList.toggle('dark', ctx.globals.theme === 'dark');
  void i18n.changeLanguage(ctx.globals.locale as string);
  return (
    <div className="min-h-[120px] bg-app p-4 text-fg">
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Tema',
      toolbar: { title: 'Tema', icon: 'circlehollow', items: ['light', 'dark'], dynamicTitle: true },
    },
    locale: {
      description: 'Idioma',
      toolbar: { title: 'Idioma', icon: 'globe', items: ['es', 'en'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light', locale: 'es' },
  parameters: { layout: 'fullscreen', a11y: { test: 'error' }, controls: { expanded: true } },
};
export default preview;
