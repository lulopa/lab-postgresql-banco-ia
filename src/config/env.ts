export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  oidcAuthorizeUrl: import.meta.env.VITE_OIDC_AUTHORIZE_URL ?? '',
  oidcClientId: import.meta.env.VITE_OIDC_CLIENT_ID ?? '',
  oidcRedirectUri: import.meta.env.VITE_OIDC_REDIRECT_URI ?? `${window.location.origin}/auth/callback`,
  oidcScope: import.meta.env.VITE_OIDC_SCOPE ?? 'openid profile',
} as const;

/** Documento §2.3 y §5.3: access token 15 min; cierre por inactividad a los 15 min. */
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;
