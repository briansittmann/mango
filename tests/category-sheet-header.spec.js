// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

function dialog(page) {
  return page.locator('div[role="dialog"][data-open]')
}

async function openCategorySheet(page, name) {
  await page.goto('/demo')
  await page.getByRole('button', { name: new RegExp(`^Opciones de ${name}$`) }).click()
  const sheet = dialog(page)
  await sheet.waitFor()
  return sheet
}

const headerDot = (sheet) => sheet.locator('header span[aria-hidden]').first()

test.describe('category sheet header', () => {
  test('the title carries the dot and the name, with no caption under it', async ({ page }) => {
    const sheet = await openCategorySheet(page, 'Comida')

    // One row: cancel, the title, save — and nothing below it. The grid's children sit flush
    // against each other in the DOM, so the header's text has no separators to match on.
    await expect(sheet.locator('header')).toHaveText('CancelarComidaGuardar')
    await expect(headerDot(sheet)).toBeVisible()
    // The caption was a `Drawer.Description`, which is what wires up aria-describedby.
    await expect(sheet).not.toHaveAttribute('aria-describedby', /./)
  })

  test("the title's dot follows the picker, not the saved colour", async ({ page }) => {
    const sheet = await openCategorySheet(page, 'Comida')
    const saved = await headerDot(sheet).evaluate((el) => getComputedStyle(el).backgroundColor)

    await sheet.getByRole('radio', { name: 'Turquesa' }).click()
    await expect
      .poll(() => headerDot(sheet).evaluate((el) => getComputedStyle(el).backgroundColor))
      .not.toBe(saved)

    // Nothing is written until "Guardar": the card behind still shows the colour it was saved with.
    const cardDot = page.locator('#category-name-comida').locator('xpath=preceding-sibling::span[1]')
    await expect(cardDot).toHaveCSS('background-color', saved)
  })

  test('a long name truncates instead of pushing the actions out of the panel', async ({ page }) => {
    const sheet = await openCategorySheet(page, 'Comida')
    await sheet.getByLabel('Nombre').fill('Supermercado y compras grandes del mes entero')

    const fits = await sheet.locator('header').evaluate((header) => {
      const panel = header.getBoundingClientRect()
      const [cancel, title, save] = [...header.children]
      // The clipping happens on the span holding the name, inside the dot-and-name flex row.
      const nameSpan = title.querySelector('span')?.lastElementChild
      return {
        cancelInside: cancel.getBoundingClientRect().left >= panel.left - 1,
        saveInside: save.getBoundingClientRect().right <= panel.right + 1,
        titleTruncated: nameSpan ? nameSpan.scrollWidth > nameSpan.clientWidth : false,
      }
    })
    expect(fits.cancelInside).toBe(true)
    expect(fits.saveInside).toBe(true)
    expect(fits.titleTruncated).toBe(true)
  })
})
