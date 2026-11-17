import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { login, type Persona } from './helpers';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const PAGES: Array<[Persona, string[]]> = [
  [
    'Camila',
    ['/cliente', '/cliente/productos', '/cliente/transferencias', '/cliente/movimientos', '/cliente/perfil'],
  ],
  ['auditor01', ['/auditoria', '/auditoria/bitacora', '/auditoria/anomalias']],
  ['cajero01', ['/operativa', '/operativa/eventos', '/operativa/cierre']],
];

async function scan(page: Page, etiqueta: string) {
  const r = await new AxeBuilder({ page }).withTags(WCAG).analyze(); // incluye color-contrast real
  const resumen = r.violations.map(
    (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.html.slice(0, 120)}`,
  );
  expect(resumen, `axe en ${etiqueta}`).toEqual([]);
}

test.describe('Accesibilidad WCAG 2.2 AA con axe-core en el navegador (contraste real)', () => {
  test('login, en claro y en oscuro', async ({ page }) => {
    await page.goto('/auth/login');
    await scan(page, 'login claro');
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await scan(page, 'login oscuro');
  });

  for (const [persona, rutas] of PAGES) {
    test(`portal de ${persona}: todas las pantallas, en claro y en oscuro`, async ({ page }) => {
      await login(page, persona);
      for (const ruta of rutas) {
        await page.goto(ruta);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => document.documentElement.classList.remove('dark'));
        await scan(page, `${ruta} claro`);
        await page.evaluate(() => document.documentElement.classList.add('dark'));
        await scan(page, `${ruta} oscuro`);
      }
    });
  }

  test('estados interactivos: hover del botón primario y del botón de peligro cumplen 4.5:1', async ({
    page,
  }) => {
    await login(page, 'cajero01');
    for (const [nombre, selector] of [
      ['primario', 'button:has-text("Registrar consignación")'],
      ['peligro', 'a[href="/operativa/eventos"]'],
    ] as const) {
      if (nombre === 'peligro') await page.goto('/operativa/eventos');
      const boton = page
        .locator(nombre === 'peligro' ? 'button:has-text("Registrar evento")' : selector)
        .first();
      await boton.hover();
      const [fg, bg] = await boton.evaluate((el) => {
        const cs = getComputedStyle(el);
        return [cs.color, cs.backgroundColor];
      });
      const lum = (rgb: string) => {
        const [r, g, b] = (rgb.match(/\d+/g) ?? []).slice(0, 3).map((v) => {
          const c = Number(v) / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        }) as [number, number, number];
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const [hi, lo] = [lum(fg as string), lum(bg as string)].sort((a, b) => b - a) as [number, number];
      expect((hi + 0.05) / (lo + 0.05), `${nombre} en hover`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

test.describe('Teclado', () => {
  test('el foco es visible y el modal atrapa Tab/Shift+Tab y cierra con Esc devolviendo el foco', async ({
    page,
  }) => {
    await login(page, 'cajero01');
    await page.getByLabel('Número de cuenta').fill('0011000001');
    await page.getByLabel('Monto en efectivo').fill('1000');
    await page.getByLabel('Concepto').fill('Prueba teclado');
    const abrir = page.getByRole('button', { name: 'Registrar consignación' });
    await abrir.focus();
    await page.keyboard.press('Enter');
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();

    const dentro = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await dentro()).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await dentro()).toBe(true);
    }
    // foco visible: el elemento enfocado por teclado tiene contorno
    const outline = await page.evaluate(
      () => getComputedStyle(document.activeElement as Element).outlineStyle,
    );
    expect(outline).not.toBe('none');

    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(abrir).toBeFocused();
  });
});
