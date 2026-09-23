// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

function dialog(page) {
  return page.locator('div[role="dialog"][data-open]')
}

function body(page) {
  return page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '))
}

async function openUpcomingCharges(page) {
  await page.locator('button[aria-controls="upcoming-charges-panel"]').click()
}

/** Opens the definition sheet for a "Próximos cobros" row. Expands the card first, so call it
 * only when the card is still collapsed. */
async function openDefinition(page, name) {
  await openUpcomingCharges(page)
  await page.locator('#upcoming-charges-panel').getByRole('button', { name: new RegExp(`^${name} ·`) }).click()
  return dialog(page)
}

test.describe('recurring scope: touching a charge vs touching a definition', () => {
  test('editing a charge from its category card leaves the definition alone', async ({ page }) => {
    await page.goto('/demo')
    await page.locator('button[aria-controls="category-panel-vivienda"]').click()
    await page.locator('#category-panel-vivienda').getByRole('button', { name: /Alquiler/ }).click()

    const sheet = dialog(page)
    await expect(sheet.getByText('Vivienda · Solo el cargo de este mes')).toBeVisible()
    await sheet.getByLabel('Importe').fill('880')
    await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(sheet).toBeHidden()

    await expect(page.locator('#category-amount-vivienda')).toContainText('960')
    await expect.poll(() => body(page)).toMatch(/Margen libre\s*804\s?€/)

    const defSheet = await openDefinition(page, 'Alquiler')
    await expect(defSheet.getByLabel('Monto esperado')).toHaveValue('820')
    await expect(defSheet.getByText(/Este mes se anotaron 880\s?€\./)).toBeVisible()
  })

  test('editing a pending definition moves the figures', async ({ page }) => {
    await page.goto('/demo')
    const sheet = await openDefinition(page, 'Gimnasio')
    await sheet.getByLabel('Monto esperado').fill('45')
    await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(sheet).toBeHidden()

    await expect(page.locator('#category-amount-salud')).toContainText('45')
    await expect(page.locator('#upcoming-charges-panel')).toContainText(/1\.030/)
    await expect.poll(() => body(page)).toMatch(/Margen libre\s*859\s?€/)

    const gimnasioRow = page.locator('#upcoming-charges-panel').getByRole('button', { name: /^Gimnasio ·/ })
    await expect(gimnasioRow).not.toContainText('esperado')
  })

  test('editing a charged definition keeps the charge and shows the difference', async ({ page }) => {
    await page.goto('/demo')
    const sheet = await openDefinition(page, 'Alquiler')
    await sheet.getByLabel('Monto esperado').fill('880')
    await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(sheet).toBeHidden()

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
    await sheet.getByRole('button', { name: 'Eliminar y borrar el historial' }).click()
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
    await expect(sheet.getByText('Quedan', { exact: false })).toHaveText('Quedan 6 pagos · 210 €')

    await sheet.getByLabel('Monto esperado').fill('40')
    await expect(sheet.getByText('Quedan', { exact: false })).toHaveText('Quedan 6 pagos · 240 €')
  })

  test('is absent for a definition with no end', async ({ page }) => {
    await page.goto('/demo')
    const sheet = await openDefinition(page, 'Alquiler')
    await expect(sheet.getByText('Quedan', { exact: false })).toHaveCount(0)
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
    await categorySheet.locator('select').selectOption('compras')
    await categorySheet.getByRole('button', { name: 'Eliminar', exact: true }).click()
    await expect(categorySheet).toBeHidden()

    const sheet = await openDefinition(page, 'Limpieza')
    await expect(sheet.getByText('Categoría').locator('xpath=..')).toContainText('Compras')
  })
})
