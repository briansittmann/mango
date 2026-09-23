// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

async function enterReorderMode(page, { failReorder = false } = {}) {
  await page.goto(failReorder ? '/demo?e2eFailReorder=1' : '/demo')
  await page.getByText('Comida').first().waitFor()
  await page.getByRole('button', { name: /^Opciones de Comida$/ }).click()
  await page.getByRole('button', { name: /^Reordenar/ }).click()
}

async function handleNames(page) {
  // The handle's only visible content is decorative bars; its name is the aria-label, not text.
  return page.getByRole('button', { name: /^Mover/ }).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
}

test.describe('reorder mode', () => {
  test('enters from the category sheet and leaves with Listo', async ({ page }) => {
    await page.goto('/demo')
    // Open the card first, per the spec's own scenario. Its disclosure is a full-header hit
    // target painted under the (pointer-events-none) visible content, so target it directly.
    await page.locator('button[aria-controls="category-panel-comida"]').click()
    await page.getByRole('button', { name: /^Opciones de Comida$/ }).click()
    await page.getByRole('button', { name: /^Reordenar/ }).click()

    await expect(page.getByRole('button', { name: /^Mover/ })).toHaveCount(7)
    await expect(page.getByRole('button', { name: 'Listo' })).toBeVisible()

    await page.getByRole('button', { name: 'Listo' }).click()

    await expect(page.getByRole('button', { name: /^Mover/ })).toHaveCount(0)
    // Leaving restores the card's own open state and its amount.
    await expect(page.getByText('310 €', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Opciones de Comida$/ })).toBeFocused()
  })

  test('moves a card with the keyboard and saves on every press', async ({ page }) => {
    await enterReorderMode(page)

    await page.getByRole('button', { name: /^Mover Comida, posición 4 de 7$/ }).focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('button', { name: /^Mover Comida, posición 5 de 7$/ })).toBeFocused()

    // An arrow at the end does nothing.
    await page.getByRole('button', { name: /^Mover Compras, posición 7 de 7$/ }).focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('button', { name: /^Mover Compras, posición 7 de 7$/ })).toBeVisible()
  })

  test('drags a card and drops it in a new position', async ({ page }) => {
    await enterReorderMode(page)

    const handle = page.getByRole('button', { name: /^Mover Vivienda/ })
    const box = await handle.boundingBox()
    if (!box) throw new Error('handle not found')

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 150, { steps: 8 })
    await page.mouse.up()

    const names = (await handleNames(page)).map((label) => label.replace(/^Mover /, '').split(',')[0])
    expect(names[0]).not.toBe('Vivienda')
    expect(names).toContain('Vivienda')
    expect(new Set(names).size).toBe(7)

    // A reorder never changes the figures the rest of the dashboard depends on.
    await page.getByRole('button', { name: 'Listo' }).click()
    await expect(page.locator('.hero-value')).toContainText(/864\s?€/)
  })

  test('a failed save reverts the card and shows a toast', async ({ page }) => {
    await enterReorderMode(page, { failReorder: true })

    await page.getByRole('button', { name: /^Mover Comida, posición 4 de 7$/ }).focus()
    await page.keyboard.press('ArrowDown')

    await expect(page.getByText('No se pudo guardar el orden').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /^Mover Comida, posición 4 de 7$/ })).toBeVisible()
    await expect(page.locator('.hero-value')).toContainText(/864\s?€/)
  })

  test('reduced motion still enters the mode and moves cards', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await enterReorderMode(page)

    await expect(page.getByRole('button', { name: /^Mover/ })).toHaveCount(7)

    await page.getByRole('button', { name: /^Mover Comida, posición 4 de 7$/ }).focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('button', { name: /^Mover Comida, posición 5 de 7$/ })).toBeFocused()
  })
})
