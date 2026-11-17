import { expect, test, type Page } from '@playwright/test';
import { captureCsp, login } from './helpers';

/** Observa LCP, CLS e interacciones (aprox. INP) desde el inicio de la página. */
async function observarVitals(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __v: { lcp: number; cls: number; inp: number } };
    w.__v = { lcp: 0, cls: 0, inp: 0 };
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__v.lcp = e.startTime))).observe({
      type: 'largest-contentful-paint',
      buffered: true,
    });
    new PerformanceObserver((l) =>
      l.getEntries().forEach((e) => {
        const ls = e as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!ls.hadRecentInput) w.__v.cls += ls.value;
      }),
    ).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) =>
      l.getEntries().forEach((e) => {
        if (e.duration > w.__v.inp) w.__v.inp = e.duration;
      }),
    ).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
  });
  return () =>
    page.evaluate(() => (window as unknown as { __v: { lcp: number; cls: number; inp: number } }).__v);
}

test.describe('Core Web Vitals (laboratorio) y entrega', () => {
  test('login: LCP < 2.5 s y CLS < 0.1', async ({ page }) => {
    const vitals = await observarVitals(page);
    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Iniciar sesión' }).waitFor();
    await page.waitForTimeout(1500);
    const v = await vitals();
    console.log(`login → LCP ${v.lcp.toFixed(0)} ms · CLS ${v.cls.toFixed(4)}`);
    expect(v.lcp).toBeGreaterThan(0);
    expect(v.lcp).toBeLessThan(2500);
    expect(v.cls).toBeLessThan(0.1);
  });

  test('interacciones en los portales: la latencia máxima (aprox. INP) es < 200 ms y CLS < 0.1', async ({
    page,
  }) => {
    const vitals = await observarVitals(page);
    await login(page, 'auditor01');
    await page.goto('/auditoria/anomalias');
    for (const t of ['Ráfagas', 'Inactivas', 'Divisas']) await page.getByRole('tab', { name: t }).click();
    await page.goto('/auditoria/bitacora');
    await page.getByLabel('Tabla').fill('transaccion');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await page.getByRole('button', { name: 'Usar tema oscuro' }).click();
    await page.waitForTimeout(800);
    const v = await vitals();
    console.log(`interacciones → INP≈ ${v.inp.toFixed(0)} ms · CLS ${v.cls.toFixed(4)}`);
    expect(v.inp).toBeLessThan(200);
    expect(v.cls).toBeLessThan(0.1);
  });

  test('los activos se sirven comprimidos con Brotli/Gzip, con caché inmutable', async ({ request }) => {
    const html = await (await request.get('/auth/login', { headers: { 'accept-encoding': 'br' } })).text();
    const js = /\/assets\/index-[\w-]+\.js/.exec(html)?.[0];
    expect(js, 'el index.html debe referenciar el bundle').toBeTruthy();
    const br = await request.get(js as string, { headers: { 'accept-encoding': 'br' } });
    expect(br.headers()['content-encoding']).toBe('br');
    expect(br.headers()['cache-control']).toContain('immutable');
    const gz = await request.get(js as string, { headers: { 'accept-encoding': 'gzip' } });
    expect(gz.headers()['content-encoding']).toBe('gzip');
    expect(Number(br.headers()['content-length'])).toBeLessThan(Number(gz.headers()['content-length']));
  });

  test('cabeceras de seguridad HTTP: CSP estricta sin unsafe-inline, anti-clickjacking y noindex en portales', async ({
    request,
  }) => {
    const r = await request.get('/auth/login');
    const h = r.headers();
    const csp = h['content-security-policy'] ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['permissions-policy']).toContain('camera=()');
    expect((await request.get('/cliente')).headers()['x-robots-tag']).toContain('noindex');
    expect((await request.get('/auth/login')).headers()['x-robots-tag']).toBeUndefined();
  });

  test('no hay violaciones de CSP al recorrer los tres portales', async ({ browser }) => {
    for (const [persona, ruta] of [
      ['Camila', '/cliente/transferencias'],
      ['auditor01', '/auditoria/anomalias'],
      ['cajero01', '/operativa/cierre'],
    ] as const) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const csp = await captureCsp(page);
      await login(page, persona);
      await page.goto(ruta);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.getByRole('button', { name: 'Usar tema oscuro' }).click();
      expect(await csp(), persona).toEqual([]);
      await ctx.close();
    }
  });
});

test.describe('SEO técnico', () => {
  test('login: título, descripción, Open Graph, JSON-LD válido y robots', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page).toHaveTitle(/Iniciar sesión · Banco Andino/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /segura/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Banco Andino/);
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Banco Andino Colombia',
    });
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-CO');
  });

  test('cada pantalla tiene un título distinto y los portales son noindex', async ({ page }) => {
    await login(page, 'Camila');
    const titulos = new Set<string>();
    for (const ruta of [
      '/cliente',
      '/cliente/productos',
      '/cliente/transferencias',
      '/cliente/movimientos',
      '/cliente/perfil',
    ]) {
      await page.goto(ruta);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      titulos.add(await page.title());
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    }
    expect(titulos.size).toBe(5);
  });

  test('robots.txt bloquea los portales', async ({ request }) => {
    const txt = await (await request.get('/robots.txt')).text();
    expect(txt).toContain('Disallow: /cliente');
    expect(txt).toContain('Disallow: /api/');
  });
});

test.describe('Responsivo', () => {
  for (const [nombre, ancho, alto] of [
    ['móvil', 375, 667],
    ['tablet', 768, 1024],
    ['escritorio', 1280, 800],
  ] as const) {
    test(`${nombre} (${ancho}px): sin desbordamiento horizontal y navegación adecuada`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: alto });
      await login(page, 'Camila');
      for (const ruta of ['/cliente', '/cliente/transferencias', '/cliente/movimientos']) {
        await page.goto(ruta);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(sobra, `${ruta} a ${ancho}px`).toBeLessThanOrEqual(0);
      }
      await expect(page.getByRole('navigation', { name: 'Navegación móvil' })).toBeVisible({
        visible: ancho < 768,
      });
      await expect(page.getByRole('navigation', { name: 'Portal Cliente' })).toBeVisible({
        visible: ancho >= 768,
      });
    });
  }
});
