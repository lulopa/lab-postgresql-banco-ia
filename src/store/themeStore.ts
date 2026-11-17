import { create } from 'zustand';

type Theme = 'light' | 'dark';
const KEY = 'andino.theme'; // preferencia visual, no sensible: se permite en localStorage
const initial = (): Theme => {
  try {
    const s = localStorage.getItem(KEY);
    if (s === 'light' || s === 'dark') return s;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};
const apply = (t: Theme) => document.documentElement.classList.toggle('dark', t === 'dark');

export const useThemeStore = create<{ theme: Theme; toggle: () => void }>((set, get) => {
  const t = initial();
  apply(t);
  return {
    theme: t,
    toggle: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
      apply(next);
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignore */
      }
      set({ theme: next });
    },
  };
});
