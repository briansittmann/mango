// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

function dialog(page) {
  return page.locator('div[role="dialog"][data-open]')
}

// Totals are rolling counters (`AnimatedAmount`): reading `document.body.textContent` includes
// every digit column, animated or not, so the aria-hidden ones are stripped first (same pattern
// as recurring-create.spec.js).
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

test('adding an income entry moves the income total and the free margin', async ({ page }) => {
  await openIncomePanel(page)
  await page.locator('#summary-group-panel').getByRole('button', { name: 'Añadir ingreso' }).click()

  const sheet = dialog(page)
  await expect(sheet.getByText('Nuevo ingreso')).toBeVisible()
  await sheet.getByLabel('Importe').fill('300')
  await sheet.locator('input[type="text"]').first().fill('Bonus')
  await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(sheet).toBeHidden()

  await expect(page.locator('div[role="status"].sr-only')).toHaveText('Ingreso añadido')

  await expect.poll(() => body(page)).toMatch(/Ingresos\s*3\.120\s?€/)
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*1\.144\s?€/)
  await expect.poll(() => body(page)).toMatch(/Gastos\s*1\.700\s?€/)

  await expect(page.locator('#summary-group-panel').getByText('Bonus')).toBeVisible()
})
