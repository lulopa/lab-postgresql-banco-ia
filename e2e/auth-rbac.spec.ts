import { expect, test } from '@playwright/test';
import { captureCsp, login, newSession } from './helpers';

test.describe('Autenticación PKCE y RBAC (navegador real)', () => {
  test('el cliente entra por PKCE, ve solo su portal y no guarda tokens en el navegador', async ({
    page,
    context,
  }) => {
    const csp = await captureCsp(page);
    await login(page, 'Camila');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Hola, Camila');
    expect(new URL(page.url()).pathname).toBe('/cliente');

    // Token solo en memoria: nada tipo JWT en localStorage/sessionStorage
    const storage = await page.evaluate(
      () => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }),
    );
    expect(storage).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);

    // Refresh token: cookie HttpOnly + SameSite=Strict, invisible para JavaScript
    const cookie = (await context.cookies()).find((c) => c.name === 'andino_rt');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict' });
    expect(await page.evaluate(() => document.cookie)).not.toContain('andino_rt');
    expect(await csp()).toEqual([]); // la CSP no bloqueó nada de la app
  });

  test('el cliente no puede entrar a auditoría ni operativa: vuelve a su portal con aviso', async ({
    page,
  }) => {
    await login(page, 'Camila');
    for (const ruta of ['/auditoria', '/auditoria/bitacora', '/operativa', '/operativa/cierre']) {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/cliente$/);
      await expect(page.getByRole('alert')).toContainText('No tienes permiso');
    }
  });

  test('el auditor no entra a /cliente ni a /operativa; el cajero no entra a /auditoria', async ({
    browser,
  }) => {
    const a = await browser.newContext();
    const auditor = await newSession(a, 'auditor01');
    await auditor.goto('/cliente');
    await expect(auditor).toHaveURL(/\/auditoria$/);
    await auditor.goto('/operativa');
    await expect(auditor).toHaveURL(/\/auditoria$/);
    await a.close();

    const c = await browser.newContext();
    const cajero = await newSession(c, 'cajero01');
    await cajero.goto('/auditoria/bitacora');
    await expect(cajero).toHaveURL(/\/operativa$/);
    await c.close();
  });

  test('sin sesión cualquier portal redirige al login y cerrar sesión revoca el acceso', async ({ page }) => {
    await page.goto('/cliente/movimientos');
    await expect(page).toHaveURL(/\/auth\/login$/);
    await login(page, 'Camila');
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
    await page.goto('/cliente'); // la cookie de refresh fue revocada: no hay sesión silenciosa
    await expect(page).toHaveURL(/\/auth\/login$/);
  });
});
