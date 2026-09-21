// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

function dialog(page) {
  return page.locator('div[role="dialog"][data-open]')
}

async function openCreateSheet(page) {
  await page.getByRole('button', { name: 'Añadir categoría' }).click()
  const sheet = dialog(page)
  await sheet.waitFor()
  return sheet
}

async function createViajes(page) {
  const sheet = await openCreateSheet(page)
  await sheet.getByLabel('Nombre').fill('Viajes')
  await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(sheet).toBeHidden()
}

test.describe('creating a category: motion', () => {
  test('the list does not jump — an unrelated card holds its position across the commit', async ({ page }) => {
    await page.goto('/demo')
    // Let the entrance cascade finish (up to ~0.48–0.73s delay plus a 0.3s tween) so "before" is
    // Comida's settled position, not a mid-entrance one — the other test below covers creating
    // inside that window instead.
    await page.waitForTimeout(1200)
    const comidaOptions = page.getByRole('button', { name: /^Opciones de Comida$/ })
    // Measured document-relative (not viewport-relative), so scrolling the off-screen tile into
    // view to open the sheet doesn't itself register as the card "moving".
    const documentY = () => comidaOptions.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
    const before = await documentY()

    const sheet = await openCreateSheet(page)
    await sheet.getByLabel('Nombre').fill('Viajes')
    await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
    await expect(sheet).toBeHidden()

    const after = await documentY()
    // "Comida" sits ahead of where the new category lands (the end of the list), so appending
    // never moves it — its position is the same invariant the design doc singles out as the
    // scenario a Flip mistake would break first. The tolerance absorbs sub-pixel rounding
    // differences between rendering engines, not an actual jump (which reads in tens of pixels).
    expect(Math.abs(after - before)).toBeLessThanOrEqual(2)
  })

  test('the new card settles below the tile, not above it', async ({ page }) => {
    await page.goto('/demo')
    await createViajes(page)

    const [viajesBox, tileBox] = await Promise.all([
      page.getByRole('button', { name: /^Opciones de Viajes$/ }).boundingBox(),
      page.getByRole('button', { name: 'Añadir categoría' }).boundingBox(),
    ])
    if (!viajesBox || !tileBox) throw new Error('boxes not found')
    expect(tileBox.y).toBeGreaterThan(viajesBox.y)
  })

  test('reduced motion creates without movement', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/demo')
    await createViajes(page)

    const transforms = await page.evaluate(() => {
      const viajesOptions = document.querySelector('[aria-label="Opciones de Viajes"]')
      const tile = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Añadir categoría')
      const cardWrapper = viajesOptions?.closest('.relative.scroll-mt-20')
      return {
        card: cardWrapper ? getComputedStyle(cardWrapper).transform : null,
        tile: tile ? getComputedStyle(tile.parentElement ?? tile).transform : null,
      }
    })

    expect(transforms.card === 'none' || transforms.card === '').toBeTruthy()
    expect(transforms.tile === 'none' || transforms.tile === '').toBeTruthy()

    // The new card and the tile still land in their final, correct order.
    const [viajesBox, tileBox] = await Promise.all([
      page.getByRole('button', { name: /^Opciones de Viajes$/ }).boundingBox(),
      page.getByRole('button', { name: 'Añadir categoría' }).boundingBox(),
    ])
    if (!viajesBox || !tileBox) throw new Error('boxes not found')
    expect(tileBox.y).toBeGreaterThan(viajesBox.y)
  })

  test('creating immediately after load does not misplace the list (cascade window)', async ({ page }) => {
    await page.goto('/demo')
    // No wait for the entrance cascade to settle — the tile and cards may still be mid-tween.
    await createViajes(page)

    const names = await page.evaluate(() =>
      [...document.querySelectorAll('[data-category-options]')].map((el) => el.getAttribute('data-category-options')),
    )
    expect(names[names.length - 1]).toBe('demo-category-1')
    const [lastCardBox, tileBox] = await Promise.all([
      page.getByRole('button', { name: /^Opciones de Viajes$/ }).boundingBox(),
      page.getByRole('button', { name: 'Añadir categoría' }).boundingBox(),
    ])
    if (!lastCardBox || !tileBox) throw new Error('boxes not found')
    expect(tileBox.y).toBeGreaterThan(lastCardBox.y)
  })
})
