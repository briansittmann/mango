// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

function dialog(page) {
  return page.locator('div[role="dialog"][data-open]')
}

// See income-create.spec.js: totals are rolling counters, so the aria-hidden digit columns are
// stripped before matching the visible text.
function body(page) {
  return page.evaluate(() => {
    const copy = document.body.cloneNode(true)
    copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove())
    return copy.textContent.replace(/\s+/g, ' ')
  })
}

async function openIncomePanel(page) {
  await page.goto('/demo')
  await page.getByRole('button', { name: /^Ingresos/ }).click()
}

test('editing "Salario" moves the income total and the free margin', async ({ page }) => {
  await openIncomePanel(page)
  await page.locator('#summary-group-panel').getByRole('button', { name: /^Salario/ }).click()

  const sheet = dialog(page)
  await expect(sheet.getByText('Editar ingreso')).toBeVisible()
  await sheet.getByLabel('Importe').fill('2500')
  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(sheet).toBeHidden()

  await expect(page.locator('div[role="status"].sr-only')).toHaveText('Cambios guardados')
  await expect.poll(() => body(page)).toMatch(/Ingresos\s*2\.920\s?€/)
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*944\s?€/)
})

test('deleting "Freelance" from its sheet and undoing restores every figure', async ({ page }) => {
  await openIncomePanel(page)
  await page.locator('#summary-group-panel').getByRole('button', { name: /^Freelance/ }).click()

  const sheet = dialog(page)
  await sheet.getByRole('button', { name: 'Eliminar ingreso' }).click()
  await expect(sheet).toBeHidden()

  await expect(page.getByText('Ingreso eliminado')).toBeVisible()
  await expect.poll(() => body(page)).toMatch(/Ingresos\s*2\.400\s?€/)
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*424\s?€/)

  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect.poll(() => body(page)).toMatch(/Ingresos\s*2\.820\s?€/)
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*844\s?€/)
  await expect(page.locator('#summary-group-panel').getByText('Freelance')).toBeVisible()
})
