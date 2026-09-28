// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

// `category-editing` → *Deleting a category* and *A category lives from its first cycle to its
// last*, and `category-creation` from a projection, on `/demo` in Spanish. The sample (September
// 2026) holds "ocio" 130 € and "compras" 95 €; the expenses total is 1.700 €.

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
const card = (page, id) => page.locator(`button[aria-controls="category-panel-${id}"]`)

async function move(page, direction, times = 1) {
  for (let i = 0; i < times; i++) {
    const before = await title(page).textContent()
    await page.locator(`button[aria-label="${direction === 'next' ? 'Ciclo siguiente' : 'Ciclo anterior'}"]`).last().click()
    await expect(title(page)).not.toHaveText(before ?? '')
  }
}

async function openDelete(page, name) {
  await page.getByRole('button', { name: new RegExp(`^Opciones de ${name}$`) }).click()
  const sheet = dialog(page)
  await sheet.getByRole('button', { name: 'Eliminar categoría' }).click()
  return sheet
}

test('only this month hides the category in one cycle', async ({ page }) => {
  await page.goto('/demo')
  const sheet = await openDelete(page, 'Ocio')
  await sheet.getByText('Solo este mes').click()
  await sheet.locator('select').selectOption('compras')
  await sheet.getByRole('button', { name: 'Eliminar', exact: true }).click()
  await expect(sheet).toBeHidden()

  await expect(card(page, 'ocio')).toHaveCount(0)
  await expect(page.locator('#category-amount-compras')).toContainText('225')
  await expect.poll(() => body(page)).toMatch(/Gastos\s*1\.700\s?€/)

  await move(page, 'next')
  await expect(card(page, 'ocio')).toHaveCount(1)
})

test('the scope has to be chosen, and a receiving category when the scope reaches rows', async ({ page }) => {
  await page.goto('/demo')
  const sheet = await openDelete(page, 'Hogar')
  await expect(sheet.getByText('¿Eliminar Hogar? Tiene 2 gastos este ciclo y un gasto fijo.')).toBeVisible()
  const remove = sheet.getByRole('button', { name: 'Eliminar', exact: true })
  await expect(remove).toBeDisabled()

  await sheet.getByText('Desde este mes en adelante').click()
  // No category is named "Otros" on /demo, so nothing is preselected.
  await expect(remove).toBeDisabled()
  await sheet.locator('select').selectOption('compras')
  await expect(remove).toBeEnabled()
  await remove.click()
  await expect(sheet).toBeHidden()

  await expect(card(page, 'hogar')).toHaveCount(0)
  await move(page, 'next')
  await expect(card(page, 'hogar')).toHaveCount(0)
})

test('a category created in a projection lives from that month on', async ({ page }) => {
  await page.goto('/demo')
  await move(page, 'next', 2)
  await expect(title(page)).toContainText(/noviembre/i)
  await page.getByRole('button', { name: 'Añadir categoría' }).click()
  const sheet = dialog(page)
  await sheet.getByLabel('Nombre').fill('Viajes')
  await sheet.getByLabel('Presupuesto').fill('200')
  await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('button', { name: /^Opciones de Viajes$/ })).toHaveCount(1)

  await move(page, 'next')
  await expect(page.getByRole('button', { name: /^Opciones de Viajes$/ })).toHaveCount(1)
  await move(page, 'previous', 2)
  await expect(title(page)).toContainText(/octubre/i)
  await expect(page.getByRole('button', { name: /^Opciones de Viajes$/ })).toHaveCount(0)
})
