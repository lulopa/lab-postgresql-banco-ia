/**
 * OAuth 2.0 / OIDC Authorization Code + PKCE (S256).
 * El code_verifier / state / nonce se guardan en sessionStorage SOLO durante la redirección al IdP
 * (no son tokens) y se eliminan al leerlos (un solo uso).
 */
import { env } from '@/config/env';

const KEY = 'andino.pkce';

const b64url = (buf: ArrayBuffer | Uint8Array): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export function randomString(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function challengeS256(verifier: string): Promise<string> {
  return b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
}

export async function buildAuthorizationUrl(): Promise<string> {
  const verifier = randomString(64); // 86 caracteres, dentro de 43-128 (RFC 7636)
  const state = randomString(16);
  const nonce = randomString(16);
  sessionStorage.setItem(KEY, JSON.stringify({ verifier, state, nonce }));
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: env.oidcClientId,
    redirect_uri: env.oidcRedirectUri,
    scope: env.oidcScope,
    state,
    nonce,
    code_challenge: await challengeS256(verifier),
    code_challenge_method: 'S256',
  });
  return `${env.oidcAuthorizeUrl}?${p.toString()}`;
}

/** Lee y BORRA los parámetros PKCE. Devuelve el verifier solo si el state coincide. */
export function consumePkce(returnedState: string | null): string | null {
  const raw = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  if (!raw || !returnedState) return null;
  try {
    const s = JSON.parse(raw) as { verifier: string; state: string };
    return s.state === returnedState ? s.verifier : null;
  } catch {
    return null;
  }
}
