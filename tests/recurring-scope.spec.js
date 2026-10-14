// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

function dialog(page) {
  return page.locator('div[role="dialog"][data-open]')
}

function body(page) {
  return page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '))
}

/** Expands the card and unfolds its taken charges, which start folded (Alquiler and Seguro are taken). */
async function openUpcomingCharges(page) {
  await page.locator('button[aria-controls="upcoming-charges-panel"]').click()
  await expect(page.locator('button[aria-controls="upcoming-charges-panel"]')).toHaveAttribute('aria-expanded', 'true')
  await page.locator('#upcoming-charges-panel').evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
  const fold = page.locator('button[aria-controls="upcoming-charges-taken"]')
  await fold.click()
  await expect(fold).toHaveAttribute('aria-expanded', 'true')
  // The taken rows slide open; a press mid-transition can land beside the row.
  await page.locator('#upcoming-charges-panel').evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
}

/** Opens a "Próximos cobros" row's sheet, the same one its category card opens
 * (`unify-fixed-charge-sheet`). Expands the card first, so call it only when the card is still collapsed. */
async function openDefinition(page, name) {
  await openUpcomingCharges(page)
  await page.locator('#upcoming-charges-panel').getByRole('button', { name: new RegExp(`^${name} ·`) }).click()
  return dialog(page)
}

test.describe('recurring scope: touching a charge vs touching a definition', () => {
  test('editing a charge from its category card with "Solo este mes" leaves the definition alone', async ({ page }) => {
    await page.goto('/demo')
    await page.locator('button[aria-controls="category-panel-vivienda"]').click()
    await page.locator('#category-panel-vivienda').getByRole('button', { name: /Alquiler/ }).click()

    const sheet = dialog(page)
    await expect(sheet.getByText('Vivienda · Se repite cada mes')).toBeVisible()
    await sheet.getByLabel('Importe').fill('880')
    await sheet.getByText('Solo este mes').click()
    await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(sheet).toBeHidden()

    await expect(page.locator('#category-amount-vivienda')).toContainText('960')
    await expect.poll(() => body(page)).toMatch(/Margen libre\s*804\s?€/)

    const defSheet = await openDefinition(page, 'Alquiler')
    await expect(defSheet.getByLabel('Importe')).toHaveValue('880')
    await expect(defSheet.locator('[data-fixed-summary]')).toHaveText(/820\s?€ cada mes, el día 1/)
  })

  test('editing a pending definition moves the figures', async ({ page }) => {
    await page.goto('/demo')
    const sheet = await openDefinition(page, 'Gimnasio')
    await sheet.getByLabel('Importe').fill('45')
    await sheet.getByText('Desde este mes en adelante').click()
    await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(sheet).toBeHidden()

    await expect(page.locator('#category-amount-salud')).toContainText('45')
    await expect(page.locator('#upcoming-charges-panel')).toContainText(/1\.030/)
    await expect.poll(() => body(page)).toMatch(/Margen libre\s*859\s?€/)

    const gimnasioRow = page.locator('#upcoming-charges-panel').getByRole('button', { name: /^Gimnasio ·/ })
    await expect(gimnasioRow).not.toContainText('esperado')
  })

  test('a new expectation from next month keeps the charge and shows the difference', async ({ page }) => {
    await page.goto('/demo')
    const title = page.locator('[data-month-picker-trigger]').last()
    await page.locator('button[aria-label="Ciclo siguiente"]').last().click()
    await expect(title).toContainText(/octubre/i)
    // A projection has nothing taken, so no fold line to unfold.
    await page.locator('button[aria-controls="upcoming-charges-panel"]').click()
    await page.locator('#upcoming-charges-panel').getByRole('button', { name: /^Alquiler ·/ }).click()
    const sheet = dialog(page)
    await sheet.getByLabel('Importe').fill('880')
    await sheet.getByText('Desde este mes en adelante').click()
    await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(sheet).toBeHidden()
    await page.locator('button[aria-label="Ciclo anterior"]').last().click()
    await expect(title).toContainText(/septiembre/i)

    await expect(page.locator('#category-amount-vivienda')).toContainText('900')
    await expect(page.locator('#upcoming-charges-panel')).toContainText(/1\.025/)
    await expect.poll(() => body(page)).toMatch(/Margen libre\s*864\s?€/)

    const row = page.locator('#upcoming-charges-panel').getByRole('button', { name: /^Alquiler ·/ })
    await expect(row).toContainText(/820/)
    await expect(row).toContainText(/esperado\s*880/)
    // The difference is visible, but it must also reach assistive technology through the row's
    // own accessible name, not only the text a sighted user sees inside the button.
    await expect(page.locator('#upcoming-charges-panel').getByRole('button', { name: /esperado\s*880/ })).toHaveCount(1)
  })

  test('matching the expectation again removes the difference caption', async ({ page }) => {
    await page.goto('/demo')
    await page.locator('button[aria-controls="category-panel-vivienda"]').click()
    const editCharge = async (amount) => {
      await page.locator('#category-panel-vivienda').getByRole('button', { name: /Alquiler/ }).click()
      const sheet = dialog(page)
      await sheet.getByLabel('Importe').fill(amount)
      await sheet.getByText('Solo este mes').click()
      await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
      await expect(sheet).toBeHidden()
    }

    await editCharge('880')
    await openUpcomingCharges(page)
    const row = page.locator('#upcoming-charges-panel').getByRole('button', { name: /^Alquiler ·/ })
    await expect(row).toContainText(/esperado\s*820/)

    await editCharge('820')
    await expect(row).not.toContainText('esperado')
  })

  test('stopping a definition moves nothing and keeps the charge listed', async ({ page }) => {
    await page.goto('/demo')
    const sheet = await openDefinition(page, 'Gimnasio')
    await sheet.getByRole('button', { name: 'Dejar de repetir' }).click()
    await expect(sheet).toBeHidden()

    await expect(page.locator('#category-amount-salud')).toContainText('40')
    await expect(page.locator('#upcoming-charges-panel')).toContainText(/1\.025/)
    await expect.poll(() => body(page)).toMatch(/Margen libre\s*864\s?€/)
    await expect(page.locator('#upcoming-charges-panel').getByText('Gimnasio')).toBeVisible()
  })

  test('deleting a definition removes its charge and moves every figure', async ({ page }) => {
    await page.goto('/demo')
    const sheet = await openDefinition(page, 'Seguro')
    await sheet.getByRole('button', { name: 'Eliminar gasto' }).click()
    await sheet.getByText('Todos los meses, también los anteriores').click()
    await sheet.getByRole('button', { name: 'Eliminar', exact: true }).click()
    await expect(sheet).toBeHidden()

    await expect(page.locator('#category-amount-vivienda')).toContainText('865')
    await expect(page.locator('#upcoming-charges-panel')).toContainText(/990/)
    await expect.poll(() => body(page)).toMatch(/Margen libre\s*899\s?€/)
    await expect(page.locator('#upcoming-charges-panel').getByText('Seguro')).toHaveCount(0)
  })
})

test.describe('recurring instalments: the pending total', () => {
  test('shows how many payments remain and reacts live to the typed amount', async ({ page }) => {
    await page.goto('/demo')
    const sheet = await openDefinition(page, 'Seguro')
    const summary = sheet.locator('[data-fixed-summary]')
    await expect(summary).toContainText(/4 de 10 · quedan 6 pagos · 210\s?€/)

    await sheet.getByLabel('Importe').fill('40')
    await sheet.getByText('Desde este mes en adelante').click()
    await expect(summary).toContainText(/quedan 6 pagos · 240\s?€/)
  })

  test('is absent for a definition with no end', async ({ page }) => {
    await page.goto('/demo')
    const sheet = await openDefinition(page, 'Alquiler')
    await expect(sheet.locator('[data-fixed-summary]')).not.toContainText('quedan')
  })

  test("the row's progress reaches assistive technology, not only sighted users", async ({ page }) => {
    await page.goto('/demo')
    await openUpcomingCharges(page)
    await expect(page.locator('#upcoming-charges-panel').getByRole('button', { name: /4 de 10/ })).toHaveCount(1)
  })
})

test.describe('a deleted category carries its definition', () => {
  test("opening the moved charge's definition shows the receiving category", async ({ page }) => {
    await page.goto('/demo')
    await page.getByRole('button', { name: /^Opciones de Hogar$/ }).click()
    const categorySheet = dialog(page)
    await categorySheet.getByRole('button', { name: 'Eliminar categoría' }).click()
    await categorySheet.getByText('Desde este mes en adelante').click()
    await categorySheet.locator('select').selectOption('compras')
    await categorySheet.getByRole('button', { name: 'Eliminar', exact: true }).click()
    await expect(categorySheet).toBeHidden()

    const sheet = await openDefinition(page, 'Limpieza')
    await expect(sheet.getByText('Compras · Se repite cada mes')).toBeVisible()
  })
})
