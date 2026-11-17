import { expect, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

export type Persona = 'Camila' | 'cajero01' | 'auditor01';

/** Login completo: SPA → IdP de desarrollo (PKCE) → callback → portal. */
export async function login(page: Page, persona: Persona): Promise<void> {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByRole('button', { name: new RegExp(persona) }).click();
  await expect(page.getByTestId('shell')).toBeVisible();
}

export async function newSession(context: BrowserContext, persona: Persona): Promise<Page> {
  const page = await context.newPage();
  await login(page, persona);
  return page;
}

/** Último OTP emitido para un usuario (el BFF lo vuelca a e2e/.otp.log solo con NODE_ENV!=production). */
export async function lastOtp(sub: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    if (existsSync('e2e/.otp.log')) {
      const lines = readFileSync('e2e/.otp.log', 'utf8')
        .trim()
        .split('\n')
        .filter((l) => l.startsWith(`${sub} `));
      const last = lines.at(-1);
      if (last) return last.split(' ')[1] as string;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('No se emitió OTP');
}

/** "$ 2.450.000,00" → 2450000 */
export const pesos = (text: string): number => Number(text.replace(/[^\d,]/g, '').split(',')[0]);

/** Registra violaciones de CSP del navegador para afirmar que no hubo ninguna. */
export async function captureCsp(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  return () => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
}
