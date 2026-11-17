/**
 * DEV A. Estado de sesión. NO usa middleware persist: access token solo en memoria.
 * El refresh token nunca es visible para JS (cookie HttpOnly SameSite=Strict gestionada por el BFF).
 *
 * RBAC en el cliente es solo UX; la autorización real la impone el BFF/PostgreSQL (rol_consulta,
 * rol_operativo, rol_auditor). DECISIÓN CONSERVADORA: una sesión opera con UN rol activo a la vez
 * (segregación de funciones: un auditor no opera caja en la misma sesión).
 */
import { create } from 'zustand';
import { buildAuthorizationUrl, consumePkce } from '@/services/pkce';
import { authService } from '@/services/authService';
import { configureAuthHooks } from '@/services/apiClient';
import { queryClient } from '@/services/queryClient';
import { env } from '@/config/env';
import type { Rol, SesionUsuario, TokenResponse } from '@/contracts';

export type AuthStatus = 'checking' | 'anonymous' | 'authenticated';
export type LogoutReason = 'inactividad' | 'sesion_expirada' | 'usuario' | null;

interface AuthState {
  status: AuthStatus;
  accessToken: string | null;
  usuario: SesionUsuario | null;
  activeRole: Rol | null;
  logoutReason: LogoutReason;
  setSession: (t: TokenResponse) => void;
  selectRole: (r: Rol) => void;
  startLogin: () => Promise<void>;
  completeLogin: (code: string, state: string | null) => Promise<boolean>;
  bootstrap: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
  logout: (reason?: LogoutReason) => Promise<void>;
}

const EMPTY = { accessToken: null, usuario: null, activeRole: null } as const;
let inflightRefresh: Promise<string | null> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'checking',
  ...EMPTY,
  logoutReason: null,

  setSession: (t) => {
    const prev = get().activeRole;
    const roles = t.usuario.roles;
    const activeRole = prev && roles.includes(prev) ? prev : roles.length === 1 ? (roles[0] ?? null) : null;
    set({
      status: 'authenticated',
      accessToken: t.access_token,
      usuario: t.usuario,
      activeRole,
      logoutReason: null,
    });
  },

  selectRole: (r) => {
    if (get().usuario?.roles.includes(r)) set({ activeRole: r });
  },

  startLogin: async () => {
    window.location.assign(await buildAuthorizationUrl());
  },

  completeLogin: async (code, state) => {
    const verifier = consumePkce(state);
    if (!verifier) return false; // state inválido o ausente: posible CSRF/replay
    try {
      get().setSession(
        await authService.exchangeCode({ code, code_verifier: verifier, redirect_uri: env.oidcRedirectUri }),
      );
      return true;
    } catch {
      return false;
    }
  },

  bootstrap: async () => {
    const token = await get().refreshSession();
    if (!token) set({ status: 'anonymous' });
  },

  refreshSession: () => {
    inflightRefresh ??= (async () => {
      try {
        const t = await authService.refresh();
        get().setSession(t);
        return t.access_token;
      } catch {
        set({ ...EMPTY, status: 'anonymous' });
        return null;
      } finally {
        inflightRefresh = null;
      }
    })();
    return inflightRefresh;
  },

  logout: async (reason = 'usuario') => {
    const hadSession = get().accessToken !== null;
    set({ ...EMPTY, status: 'anonymous', logoutReason: reason });
    queryClient.clear(); // nada de datos bancarios en memoria tras salir
    if (hadSession) {
      try {
        await authService.logout();
      } catch {
        /* best-effort: el BFF revoca la cookie */
      }
    }
  },
}));

configureAuthHooks({
  getAccessToken: () => useAuthStore.getState().accessToken,
  refresh: () => useAuthStore.getState().refreshSession(),
  onSessionLost: () => {
    if (useAuthStore.getState().status === 'authenticated')
      void useAuthStore.getState().logout('sesion_expirada');
  },
});
