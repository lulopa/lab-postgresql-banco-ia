import { expect, test } from '@playwright/test';
import { newSession } from './helpers';

test('una consignación hecha en caja aparece en la bitácora del auditor (triggers reales de PostgreSQL)', async ({
  browser,
}) => {
  const cajeroCtx = await browser.newContext();
  const auditorCtx = await browser.newContext();
  const cajero = await newSession(cajeroCtx, 'cajero01');
  const auditor = await newSession(auditorCtx, 'auditor01');

  const monto = String(100000 + Math.floor(Math.random() * 899) * 100 + 7); // monto único para identificar la fila
  await cajero.goto('/operativa');
  await cajero.getByLabel('Número de cuenta').fill('0011000001');
  await cajero.getByLabel('Monto en efectivo').fill(monto);
  await cajero.getByLabel('Concepto').fill('Depósito ventanilla E2E');
  await cajero.getByRole('button', { name: 'Registrar consignación' }).click();
  await cajero.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
  await expect(cajero.getByText('Consignación registrada')).toBeVisible();

  await auditor.goto('/auditoria/bitacora');
  await auditor.getByLabel('Tabla').fill('transaccion');
  await auditor.getByRole('button', { name: 'Filtrar' }).click();
  const fila = auditor.getByRole('row').filter({ hasText: 'cajero01' }).first();
  await expect(fila).toContainText('INSERT');
  await fila.getByRole('button', { name: 'Ver payload' }).click();
  await expect(auditor.getByText(`"monto": ${monto}`)).toBeVisible();
  await cajeroCtx.close();
  await auditorCtx.close();
});
