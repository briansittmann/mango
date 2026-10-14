// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

// "Eliminar presupuesto" only empties the budget field; Guardar removes the budget.

const sheet = (page) => page.locator('div[role="dialog"][data-open]')
const openComida = (page) => page.getByRole('button', { name: /^Opciones de Comida$/ }).click()

test('removes the budget on save, and the row is gone without one', async ({ page }) => {
  await page.goto('/demo')
  await expect(page.locator('#category-progress-comida > div')).not.toHaveAttribute('inert', '')

  await openComida(page)
  const remove = sheet(page).getByRole('button', { name: 'Eliminar presupuesto' })
  await remove.click()
  await expect(sheet(page).getByLabel('Presupuesto')).toHaveValue('')
  await expect(remove).toBeHidden()
  await expect(sheet(page).getByRole('button', { name: 'Guardar' })).toBeFocused()

  await sheet(page).getByRole('button', { name: 'Guardar' }).click()
  await expect(sheet(page)).toBeHidden()
  await expect(page.locator('#category-progress-comida')).toHaveCount(0)

  await openComida(page)
  await expect(sheet(page).getByLabel('Presupuesto')).toHaveValue('')
  await expect(sheet(page).getByRole('button', { name: 'Eliminar presupuesto' })).toHaveCount(0)
})

test('cancelling keeps the budget', async ({ page }) => {
  await page.goto('/demo')
  await openComida(page)
  const field = sheet(page).getByLabel('Presupuesto')
  const before = await field.inputValue()
  await sheet(page).getByRole('button', { name: 'Eliminar presupuesto' }).click()
  await sheet(page).getByRole('button', { name: 'Cancelar' }).click()
  const discard = page.getByRole('button', { name: /Descartar/ })
  if (await discard.isVisible().catch(() => false)) await discard.click()
  await expect(sheet(page)).toBeHidden()

  await openComida(page)
  await expect(sheet(page).getByLabel('Presupuesto')).toHaveValue(before)
})
