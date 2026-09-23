// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

function dialog(page) {
  return page.locator('div[role="dialog"][data-open]')
}

function body(page) {
  return page.evaluate(() => {
    const copy = document.body.cloneNode(true)
    copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove())
    return copy.textContent.replace(/\s+/g, ' ')
  })
}

test('a recurring income entry produces one row and never becomes a charge', async ({ page }) => {
  await page.goto('/demo')

  // Collapsed "Próximos cobros" shows its next charge before anything is added.
  const chargesButton = page.locator('button[aria-controls="upcoming-charges-panel"]')
  await expect(chargesButton).toHaveAccessibleName(/Parking · día 15/)

  await page.getByRole('button', { name: /^Ingresos/ }).click()
  await page.locator('#summary-group-panel').getByRole('button', { name: 'Añadir ingreso' }).click()

  const sheet = dialog(page)
  await sheet.getByLabel('Importe').fill('1200')
  await sheet.locator('input[type="text"]').first().fill('Alquiler cobrado')
  await sheet.getByRole('switch', { name: 'Se repite todos los meses' }).click()
  const dayInput = sheet.getByLabel('Día del mes')
  await dayInput.fill('')
  await dayInput.fill('5')
  await sheet.getByRole('radio', { name: 'Un número de veces' }).click()
  const countInput = sheet.getByLabel('Número de pagos')
  await countInput.fill('')
  await countInput.fill('10')
  await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(sheet).toBeHidden()

  // One row, not two: the entry create and the definition create correlate into a single row.
  await expect(page.locator('#summary-group-panel').getByRole('button', { name: /^Alquiler cobrado/ })).toHaveCount(1)
  await expect.poll(() => body(page)).toMatch(/Ingresos\s*4\.020\s?€/)
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*2\.044\s?€/)

  // The recurrence never reaches "Próximos cobros", collapsed or open.
  await expect(chargesButton).toHaveAccessibleName(/Parking · día 15/)
  await chargesButton.click()
  const chargesPanel = page.locator('#upcoming-charges-panel')
  await expect(chargesPanel.getByText('Alquiler cobrado')).toHaveCount(0)
  await expect.poll(() => body(page)).toMatch(/1\.025/)
})
