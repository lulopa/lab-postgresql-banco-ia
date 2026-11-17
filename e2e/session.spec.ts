import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Sesión y privacidad', () => {
  test('cierra la sesión tras 15 minutos de inactividad y avisa el motivo', async ({ page }) => {
    await page.clock.install();
    await login(page, 'Camila');
    await page.clock.fastForward('14:30'); // aún dentro del límite
    await expect(page.getByTestId('shell')).toBeVisible();
    await page.clock.fastForward('01:00'); // se pasa de 15 min
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole('status')).toContainText('15 minutos de inactividad');
  });

  test('la actividad del usuario reinicia el contador de inactividad', async ({ page }) => {
    await page.clock.install();
    await login(page, 'Camila');
    await page.clock.fastForward('12:00');
    await page.mouse.move(100, 120);
    await page.mouse.move(180, 220);
    await page.clock.fastForward('12:00'); // 24 min en total, pero con actividad a los 12
    await expect(page.getByTestId('shell')).toBeVisible();
  });

  test('desenfoca el contenido al perder el foco y lo restablece al volver', async ({ page }) => {
    await login(page, 'Camila');
    const contenido = page.locator('[data-obscured]');
    await expect(contenido).toHaveAttribute('data-obscured', 'false');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(contenido).toHaveAttribute('data-obscured', 'true');
    await expect(contenido).toHaveClass(/privacy-blur/);
    await expect(page.getByText('Contenido oculto por privacidad')).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(contenido).toHaveAttribute('data-obscured', 'false');
  });
});
