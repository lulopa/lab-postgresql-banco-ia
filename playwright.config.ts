import { defineConfig, devices } from '@playwright/test';

/**
 * E2E en navegador real contra el BFF + PostgreSQL DE PRUEBA.
 *  - Navegadores: Chromium, Firefox, WebKit y Safari iOS (emulado). En un entorno sin descargas se puede forzar
 *    un Chromium propio con PW_CHROMIUM_PATH / PW_CHROMIUM_ARGS (solo se corre ese proyecto).
 *  - Seguridad: se niega a correr si la base no tiene "e2e" o "test" en el nombre (las pruebas escriben datos).
 */
const db = process.env.E2E_PGDATABASE ?? process.env.PGDATABASE ?? 'banco_e2e';
if (!/(e2e|test)/i.test(db))
  throw new Error(`E2E_PGDATABASE="${db}" no parece una base de prueba (debe contener "e2e" o "test").`);

const chromiumPath = process.env.PW_CHROMIUM_PATH;
const launchOptions = chromiumPath
  ? { executablePath: chromiumPath, args: (process.env.PW_CHROMIUM_ARGS ?? '').split(' ').filter(Boolean) }
  : {};
const PORT = Number(process.env.E2E_PORT ?? 8080);

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1, // comparten la misma base de datos
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions } },
    ...(chromiumPath || process.env.PW_ONLY_CHROMIUM === '1'
      ? []
      : [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
          { name: 'safari-ios', use: { ...devices['iPhone 14'] } },
        ]),
  ],
  webServer: {
    command: 'npx tsx bff/server.ts',
    url: `http://localhost:${PORT}/api/v1/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...(process.env as Record<string, string>),
      PGDATABASE: db,
      BFF_PORT: String(PORT),
      SERVE_STATIC: 'true', // sirve dist/ con Brotli y CSP (requiere `npm run build`)
      DEV_LOGIN: 'true',
      OIDC_REDIRECT_URI: `http://localhost:${PORT}/auth/callback`,
      NODE_ENV: 'test',
      E2E_OTP_FILE: 'e2e/.otp.log',
    },
  },
});
