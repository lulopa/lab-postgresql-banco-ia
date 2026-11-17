// COMPARTIDO (Dev A + Dev B): cambios coordinados por PR a main.
// Todos los colores salen de variables CSS definidas en src/index.css, de modo que
// el modo oscuro y los pares verificados por contraste (src/test/contrast.test.ts)
// tengan una sola fuente de verdad.
import containerQueries from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter Variable', 'Inter', 'system-ui', '-apple-system', 'sans-serif'] },
      colors: {
        app: 'var(--bg-app)',
        card: 'var(--bg-card)',
        fg: 'var(--text-main)',
        muted: 'var(--text-muted)',
        line: 'var(--border)',
        brand: {
          DEFAULT: 'var(--color-calgar-blue)',
          text: 'var(--brand-text)',
          on: 'var(--on-brand)',
          hover: 'var(--brand-hover)',
        },
        danger: {
          solid: 'var(--danger-solid)',
          on: 'var(--on-danger)',
          text: 'var(--danger-text)',
          hover: 'var(--danger-hover)',
        },
        success: {
          DEFAULT: 'var(--color-krypton-green)',
          text: 'var(--success-text)',
          on: 'var(--on-success)',
        },
        warning: { DEFAULT: 'var(--color-sunny-yellow)', on: 'var(--on-warning)' },
      },
    },
  },
  plugins: [containerQueries],
};
