import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type T = { id: number; text: string };
const Ctx = createContext<(text: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 5000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed bottom-20 right-4 z-50 space-y-2 md:bottom-4">
        {items.map((i) => (
          <div
            key={i.id}
            className="rounded-lg border border-line bg-card px-4 py-3 text-sm text-fg shadow-lg"
          >
            {i.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
