import { useEffect, useRef } from 'react';
import { INACTIVITY_LIMIT_MS } from '@/config/env';

const EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'] as const;

/** Dispara onTimeout tras `limitMs` sin actividad del usuario (documento §5.3). */
export function useInactivityLogout(
  enabled: boolean,
  onTimeout: () => void,
  limitMs = INACTIVITY_LIMIT_MS,
): void {
  const cb = useRef(onTimeout);
  cb.current = onTimeout;

  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const fire = () => cb.current();
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(fire, limitMs);
    };
    const onActivity = () => {
      const now = Date.now();
      if (now - last < 1000) return; // throttle
      last = now;
      arm();
    };
    // Los navegadores aplazan timers en pestañas ocultas: al volver, revisar con la hora real.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - last >= limitMs) fire();
    };
    arm();
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, limitMs]);
}
