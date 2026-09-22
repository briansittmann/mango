// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

function dialog(page) {
  return page.locator('div[role="dialog"][data-open]')
}

// Totals are rolling counters (`AnimatedAmount`): reading `document.body.textContent` includes
// every digit column, animated or not, so the aria-hidden ones are stripped first (same pattern
// as income-create.spec.js).
function body(page) {
  return page.evaluate(() => {
    const copy = document.body.cloneNode(true)
    copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove())
    return copy.textContent.replace(/\s+/g, ' ')
  })
}

async function openSavingsPanel(page) {
  await page.goto('/demo')
  await page.getByRole('button', { name: /^Ahorro/ }).click()
}

async function openSavingsCreateSheet(page) {
  await openSavingsPanel(page)
  await page.locator('#summary-group-panel').getByRole('button', { name: 'Añadir movimiento de ahorro' }).click()
  const sheet = dialog(page)
  await expect(sheet.getByText('Nuevo movimiento de ahorro')).toBeVisible()
  return sheet
}

test('a deposit moves the savings total, the accumulated balance and the free margin', async ({ page }) => {
  const sheet = await openSavingsCreateSheet(page)

  await sheet.getByLabel('Importe').fill('50')
  await sheet.locator('input[type="text"]').first().fill('Bono')
  await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(sheet).toBeHidden()

  await expect(page.locator('div[role="status"].sr-only')).toHaveText('Movimiento de ahorro añadido')

  await expect.poll(() => body(page)).toMatch(/Ahorro\s*196\s?€/)
  await expect.poll(() => body(page)).toMatch(/Acumulado\s*2\.696\s?€/)
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*924\s?€/)
})

test('a withdrawal lists a typographic minus sign and moves the totals down', async ({ page }) => {
  const sheet = await openSavingsCreateSheet(page)

  await sheet.getByRole('radio', { name: 'Retiro' }).click()
  await sheet.getByLabel('Importe').fill('30')
  await sheet.locator('input[type="text"]').first().fill('Reparación')
  await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(sheet).toBeHidden()

  const panel = page.locator('#summary-group-panel')
  const withdrawalAmount = panel.getByText('−30 €')
  await expect(withdrawalAmount).toBeVisible()
  const text = await withdrawalAmount.textContent()
  expect(text).toContain('−')
  expect(text).not.toContain('-')

  await expect.poll(() => body(page)).toMatch(/Ahorro\s*116\s?€/)
  await expect.poll(() => body(page)).toMatch(/Acumulado\s*2\.616\s?€/)
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*1\.004\s?€/)
})

test('submitting with an empty amount keeps the sheet open, adds nothing and marks the amount field', async ({ page }) => {
  const sheet = await openSavingsCreateSheet(page)
  const rows = page.locator('[data-savings-movement-row]')
  const rowCountBefore = await rows.count()

  await sheet.locator('input[type="text"]').first().fill('Bono')
  await page.keyboard.press('Enter')

  await expect(sheet).toBeVisible()
  await expect(sheet.getByLabel('Importe')).toHaveAttribute('aria-invalid', 'true')
  await expect(rows).toHaveCount(rowCountBefore)

  await sheet.getByRole('button', { name: 'Cancelar' }).click()
  await expect(sheet).toBeHidden()

  await expect.poll(() => body(page)).toMatch(/Ahorro\s*146\s?€/)
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*974\s?€/)
})

test('a deposit does not persist across a reload', async ({ page }) => {
  const sheet = await openSavingsCreateSheet(page)

  await sheet.getByLabel('Importe').fill('50')
  await sheet.locator('input[type="text"]').first().fill('Bono')
  await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect.poll(() => body(page)).toMatch(/Ahorro\s*196\s?€/)

  await page.reload()
  await page.getByRole('button', { name: /^Ahorro/ }).click()

  await expect.poll(() => body(page)).toMatch(/Ahorro\s*146\s?€/)
  await expect.poll(() => body(page)).toMatch(/Acumulado\s*2\.646\s?€/)
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*974\s?€/)
})
