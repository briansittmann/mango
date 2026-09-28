// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

// `expense-editing` → *Moving an expense to another category*, on `/demo` in Spanish: "Cine"
// (45 €) is in "ocio" (130 €), "compras" holds 95 €, the expenses total is 1.700 €.

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

const title = (page) => page.locator('[data-month-picker-trigger]').last()

async function openRow(page, id, name) {
  await page.locator(`button[aria-controls="category-panel-${id}"]`).click()
  await page.locator(`#category-panel-${id}`).getByRole('button', { name: new RegExp(name) }).click()
  return dialog(page)
}

test('moving an expense to another category', async ({ page }) => {
  await page.goto('/demo')
  const sheet = await openRow(page, 'ocio', 'Cine')
  const chip = sheet.getByRole('button', { name: 'Categoría: Ocio. Cambiar' })
  await expect(chip).toHaveAttribute('aria-expanded', 'false')
  await chip.click()
  await expect(chip).toHaveAttribute('aria-expanded', 'true')
  await sheet.getByRole('radio', { name: 'Compras' }).click()
  await expect(sheet.getByRole('button', { name: 'Categoría: Compras. Cambiar' })).toBeFocused()

  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect(page.locator('#category-panel-ocio')).not.toContainText('Cine')
  await expect(page.locator('#category-amount-compras')).toContainText('140')
  await expect.poll(() => body(page)).toMatch(/Gastos\s*1\.700\s?€/)
})

test('the choice is not written before saving', async ({ page }) => {
  await page.goto('/demo')
  const sheet = await openRow(page, 'ocio', 'Cine')
  await sheet.getByRole('button', { name: 'Categoría: Ocio. Cambiar' }).click()
  await sheet.getByRole('radio', { name: 'Compras' }).click()
  await sheet.getByRole('button', { name: 'Cancelar' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.locator('#category-panel-ocio')).toContainText('Cine')
})

test('Escape closes the picker and leaves the sheet open', async ({ page }) => {
  await page.goto('/demo')
  const sheet = await openRow(page, 'ocio', 'Cine')
  const chip = sheet.getByRole('button', { name: 'Categoría: Ocio. Cambiar' })
  await chip.click()
  await page.keyboard.press('Escape')
  await expect(chip).toHaveAttribute('aria-expanded', 'false')
  await expect(chip).toBeFocused()
  await expect(sheet).toBeVisible()
})

test('a fixed charge moved from this month on takes its definition along', async ({ page }) => {
  await page.goto('/demo')
  const sheet = await openRow(page, 'salud', 'Gimnasio')
  await sheet.getByRole('button', { name: /Categoría: Salud/ }).click()
  await sheet.getByRole('radio', { name: 'Ocio' }).click()
  await sheet.getByText('Desde este mes en adelante').click()
  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect(page.locator('#category-panel-salud')).not.toContainText('Gimnasio')

  const before = await title(page).textContent()
  await page.locator('button[aria-label="Ciclo siguiente"]').last().click()
  await expect(title(page)).not.toHaveText(before ?? '')
  await page.locator('button[aria-controls="category-panel-ocio"]').click()
  await expect(page.locator('#category-panel-ocio')).toContainText('Gimnasio')
})
