import { useEffect, useState } from 'react';

/** true mientras la ventana no tiene foco o la pestaña está oculta (documento §5.3, "App Blur"). */
export function useWindowBlur(): boolean {
  const [obscured, setObscured] = useState(false);
  useEffect(() => {
    const hide = () => setObscured(true);
    const show = () => setObscured(false);
    const vis = () => setObscured(document.visibilityState === 'hidden');
    window.addEventListener('blur', hide);
    window.addEventListener('focus', show);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('blur', hide);
      window.removeEventListener('focus', show);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  return obscured;
}
