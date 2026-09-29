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

async function openCreateSheet(page) {
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Añadir categoría' }).click()
  const sheet = dialog(page)
  await sheet.waitFor()
  return sheet
}

test.describe('creating a category', () => {
  test('lands last, collapsed and empty, and leaves every other figure unchanged', async ({ page }) => {
    const sheet = await openCreateSheet(page)

    await expect(sheet.getByText('Nueva categoría')).toBeVisible()
    await expect(sheet.getByRole('radio', { name: 'Rojo' })).toHaveAttribute('aria-checked', 'true')

    await sheet.getByLabel('Nombre').fill('Viajes')
    await sheet.getByText('Desde este mes en adelante').click()
    await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
    await expect(sheet).toBeHidden()

    await expect(page.locator('div[role="status"].sr-only')).toHaveText('Categoría creada')

    const viajesOptions = page.getByRole('button', { name: /^Opciones de Viajes$/ })
    const tile = page.getByRole('button', { name: 'Añadir categoría' })
    await expect(viajesOptions).toBeVisible()
    await expect(tile).toBeVisible()

    // Last card of the list, immediately before the tile.
    const [viajesBox, tileBox] = await Promise.all([viajesOptions.boundingBox(), tile.boundingBox()])
    if (!viajesBox || !tileBox) throw new Error('boxes not found')
    expect(tileBox.y).toBeGreaterThan(viajesBox.y)

    await expect(page.getByText('Viajes').first()).toBeVisible()
    // No budget was given, so the header shows a bare total and no "de X €" budget phrase follows it.
    await expect.poll(() => body(page)).toMatch(/Viajes\s*0\s?€(?!\s*de)/)

    // No other figure moves.
    await expect.poll(() => body(page)).toMatch(/Gastos\s*1\.700\s?€/)
    await expect.poll(() => body(page)).toMatch(/Margen libre\s*864\s?€/)
  })

  test('a budget given at creation shows its bar', async ({ page }) => {
    const sheet = await openCreateSheet(page)
    await sheet.getByLabel('Nombre').fill('Viajes')
    await sheet.getByLabel('Presupuesto').fill('200')
    await sheet.getByText('Desde este mes en adelante').click()
    await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
    await expect(sheet).toBeHidden()

    await expect.poll(() => body(page)).toMatch(/Viajes.*0\s?€\s*de\s*200\s?€/)
    // The new budget reserves its whole amount in the free margin.
    await expect.poll(() => body(page)).toMatch(/Margen libre\s*664\s?€/)
  })
})

test('a category created for this month only is gone the next month', async ({ page }) => {
  const sheet = await openCreateSheet(page)
  await sheet.getByLabel('Nombre').fill('Viajes')
  await sheet.getByLabel('Presupuesto').fill('200')
  await sheet.getByText('Solo este mes').click()
  await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('button', { name: /^Opciones de Viajes$/ })).toHaveCount(1)
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*664\s?€/)

  const title = page.locator('[data-month-picker-trigger]').last()
  const before = await title.textContent()
  await page.locator('button[aria-label="Ciclo siguiente"]').last().click()
  await expect(title).not.toHaveText(before ?? '')
  await expect(page.getByRole('button', { name: /^Opciones de Viajes$/ })).toHaveCount(0)
})

test.describe('creating a category: validation', () => {
  test('the primary action waits for a name and for how long the category lasts', async ({ page }) => {
    const sheet = await openCreateSheet(page)
    const submit = sheet.getByRole('button', { name: 'Añadir', exact: true })

    await expect(submit).toBeDisabled()
    await sheet.getByLabel('Nombre').fill('   ')
    await expect(submit).toBeDisabled()
    await sheet.getByLabel('Nombre').fill('Viajes')
    // Neither option is preselected.
    await expect(sheet.getByRole('radio', { name: 'Solo este mes' })).not.toBeChecked()
    await expect(sheet.getByRole('radio', { name: 'Desde este mes en adelante' })).not.toBeChecked()
    await expect(submit).toBeDisabled()
    await sheet.getByText('Solo este mes').click()
    await expect(submit).toBeEnabled()
  })

  test('a duplicate name reports in place and creates nothing', async ({ page }) => {
    const sheet = await openCreateSheet(page)
    await sheet.getByLabel('Nombre').fill('  comida  ')
    await sheet.getByText('Desde este mes en adelante').click()
    await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()

    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('Ya existe una categoría con este nombre')).toBeVisible()
    await expect(sheet.getByLabel('Nombre')).toHaveValue('  comida  ')
    await expect(page.locator('.toast, [data-toast]')).toHaveCount(0)

    await sheet.getByRole('button', { name: 'Cancelar' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('button', { name: /^Opciones de/ })).toHaveCount(7)
  })
})
