import { expect, test } from '@playwright/test';
import { lastOtp, login, pesos } from './helpers';

test('transferencia con OTP: se pierde la respuesta, el reintento reutiliza X-Idempotency-Key y se debita una sola vez', async ({
  page,
}) => {
  await login(page, 'Camila');
  const saldoAntes = pesos(
    await page.getByText('Saldo consolidado').locator('xpath=following-sibling::p[1]').innerText(),
  );

  // Intercepta el POST: la primera vez llega al servidor pero la respuesta "se pierde" (corte de red); la segunda pasa normal.
  const keys: string[] = [];
  await page.route('**/api/v1/transacciones/transferir', async (route) => {
    keys.push((await route.request().headerValue('x-idempotency-key')) ?? '');
    if (keys.length === 1) {
      await route.fetch();
      await route.abort('failed');
    } else {
      await route.continue();
    }
  });

  await page.getByRole('link', { name: 'Transferir dinero' }).click();
  await page.getByLabel('Cuenta de origen').selectOption({ index: 1 });
  await page.getByLabel('Número de cuenta de destino').fill('0011000002');
  await page.getByLabel('Monto').fill('50000');
  await page.getByLabel('Concepto').fill('Arriendo noviembre');
  await page.getByRole('button', { name: 'Revisar' }).click();
  await page.getByRole('button', { name: 'Enviar código de seguridad' }).click();
  await page.getByLabel('Código de 6 dígitos').fill(await lastOtp('cliente:1'));

  const confirmar = page.getByRole('button', { name: /Confirmar transferencia/ });
  await confirmar.click();
  // 1.er intento: el cliente ve "Sin conexión" (RFC 7807 sintético) y NO se pierde el OTP
  const modal = page.getByRole('dialog', { name: 'Sin conexión' });
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Entendido' }).click();
  await confirmar.click(); // reintento
  await expect(page.getByText('Transferencia exitosa')).toBeVisible();

  expect(keys).toHaveLength(2);
  expect(keys[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(keys[1]).toBe(keys[0]); // misma clave de idempotencia

  await page.goto('/cliente');
  const saldoDespues = pesos(
    await page.getByText('Saldo consolidado').locator('xpath=following-sibling::p[1]').innerText(),
  );
  expect(saldoAntes - saldoDespues).toBe(50000); // una sola vez, no dos

  await page.goto('/cliente/movimientos');
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: /Transferencia/ })
      .first(),
  ).toContainText('50.000');
});
