// @ts-check
import { test, expect } from '@playwright/test'
import { loadDesktop, rect, sideSheet, visibleBackdrops } from './desktop-helpers'

// `desktop-shell` → *Sheets open as side panels*, *Anchored popovers stay on screen* and *Add an
// expense from the top bar*; `design-system` → *The shell yields to a side panel*, on `/demo`.

async function openEntrySheet(page, categoryId = 'comida') {
  await page.locator(`#category-panel-${categoryId}`).getByRole('button', { name: 'Añadir gasto' }).click()
  const dialog = sideSheet(page)
  await expect(dialog).toBeVisible()
  return dialog
}

test('the entry sheet is a panel docked right, full height minus the inset, amount focused, over a scrim', async ({ page }) => {
  await loadDesktop(page)
  const dialog = await openEntrySheet(page)
  await expect(dialog).toHaveAttribute('data-presentation', 'side')
  const box = await rect(page, 'div[role="dialog"][data-open]')
  expect(1280 - box.right).toBeLessThanOrEqual(16)
  expect(box.height).toBeGreaterThanOrEqual(900 - 32)
  expect(box.width).toBeGreaterThanOrEqual(400)
  await expect(dialog.getByLabel('Importe')).toBeFocused()
  await expect(page.locator('[data-sheet-backdrop][data-open]')).toBeVisible()
  // Dirty: an outside press is cancelled; Escape still closes.
  await dialog.getByLabel('Importe').fill('12')
  await page.mouse.click(200, 400)
  await page.waitForTimeout(400)
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  // Clean: the scrim closes it.
  await openEntrySheet(page)
  await page.mouse.click(200, 400)
  await expect(sideSheet(page)).toBeHidden()
})

test('the category and definition sheets open as side panels too', async ({ page }) => {
  await loadDesktop(page)
  await page.locator('[data-category-options="comida"]').click()
  let dialog = sideSheet(page)
  await expect(dialog).toHaveAttribute('data-presentation', 'side')
  expect(1280 - (await rect(page, 'div[role="dialog"][data-open]')).right).toBeLessThanOrEqual(16)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await page.locator('[aria-controls="upcoming-charges-panel"]').click()
  await page.waitForTimeout(300)
  const row = page.locator('#upcoming-charges-panel').getByRole('button', { name: /Parking/ }).first()
  await row.scrollIntoViewIfNeeded()
  await row.click()
  dialog = sideSheet(page)
  await expect(dialog).toHaveAttribute('data-presentation', 'side')
  expect(1280 - (await rect(page, 'div[role="dialog"][data-open]')).right).toBeLessThanOrEqual(16)
})

test('the category sheet from the last card, scrolled to the bottom of a 700px viewport, stays on screen', async ({ page }) => {
  await loadDesktop(page, { height: 700 })
  const options = page.locator('[data-category-options="compras"]')
  await options.evaluate((el) => el.scrollIntoView({ block: 'end' }))
  await page.waitForTimeout(400)
  expect((await rect(page, '[data-category-options="compras"]')).bottom).toBeGreaterThanOrEqual(600)
  await options.click()
  const dialog = sideSheet(page)
  await expect(dialog).toBeVisible()
  const box = await rect(page, 'div[role="dialog"][data-open]')
  expect(box.top).toBeGreaterThanOrEqual(0)
  expect(box.bottom).toBeLessThanOrEqual(700)
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeVisible()
  await expect(dialog.locator('button[type="submit"]')).toBeVisible()
})

test('with motion on the panel comes in from beyond the right edge over 400 ms and leaves in 250 ms', async ({ page }) => {
  await loadDesktop(page, { reduced: false })
  const xs = await page.evaluate(
    () =>
      new Promise((resolve) => {
        /** @type {HTMLElement} */ (document.querySelector('[data-category-options="comida"]')).click()
        const samples = []
        const tick = () => {
          const el = document.querySelector('div[role="dialog"][data-open]')
          // Geometry, not the `translate` value: mid-flight it reads as a calc() of percentages.
          if (el) samples.push(Math.round(el.getBoundingClientRect().left))
          if (samples.length < 40) requestAnimationFrame(tick)
          else resolve(samples)
        }
        requestAnimationFrame(tick)
      }),
  )
  const resting = xs[xs.length - 1]
  expect(Math.max(...xs)).toBeGreaterThan(resting + 100)
  expect(1280 - 16 - 440 - resting).toBeLessThanOrEqual(1)
  expect(new Set(xs).size).toBeGreaterThan(3)
  expect(await sideSheet(page).evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0.4s')
  await page.keyboard.press('Escape')
  // The leaving panel's own duration, read while it is still on its way out.
  await expect
    .poll(() => page.evaluate(() => { const el = document.querySelector('div[role="dialog"][data-presentation="side"][data-ending-style]'); return el ? getComputedStyle(el).transitionDuration : null }), { timeout: 400, intervals: [10, 20, 40] })
    .toBe('0.25s')
})

test('with reduced motion the panel is at its resting position in the first frame', async ({ page }) => {
  await loadDesktop(page)
  await page.locator('[data-category-options="comida"]').click()
  const first = await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => {
          const el = /** @type {Element} */ (document.querySelector('div[role="dialog"][data-open]'))
          resolve({ transform: getComputedStyle(el).translate, transition: getComputedStyle(el).transitionProperty })
        }),
      ),
  )
  expect(['none', '0px', '0px 0px']).toContain(first.transform)
  expect(first.transition).toBe('none')
})

test('while a side panel is open only the panel and its scrim blur, and the shell yields', async ({ page }) => {
  await loadDesktop(page)
  await page.evaluate(() => window.scrollTo(0, 200))
  await page.waitForTimeout(300)
  expect((await visibleBackdrops(page)).sort()).toEqual(['shell-material', 'shell-material'])
  await openEntrySheet(page)
  await page.waitForTimeout(300)
  expect((await visibleBackdrops(page)).sort()).toEqual(['popup:side', 'sheet-backdrop'])
  await expect(page.locator('[data-desktop-sidebar]')).toHaveAttribute('data-pushed-back', '')
})

test('the account menu and the month picker stay within a 700px-tall viewport', async ({ page }) => {
  await loadDesktop(page, { height: 700 })
  await page.locator('[data-sidebar-account]').click()
  const menu = await rect(page, '#account-menu')
  expect(menu.top).toBeGreaterThanOrEqual(0)
  expect(menu.bottom).toBeLessThanOrEqual(700)
  expect(await page.locator('#account-menu').evaluate((el) => getComputedStyle(el).transformOrigin)).toMatch(/^0px \d+px$/)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.locator('[data-desktop-top-bar] [data-month-picker-trigger]').click()
  const picker = await rect(page, '[data-desktop-top-bar] [role="dialog"][aria-label="Seleccionar mes"]')
  expect(picker.top).toBeGreaterThanOrEqual(0)
  expect(picker.bottom).toBeLessThanOrEqual(700)
})

test('on a tablet the category sheet from a card near the bottom is a popover placed inside the viewport', async ({ page }) => {
  await loadDesktop(page, { width: 820, height: 600 })
  const options = page.locator('[data-category-options="compras"]')
  await options.evaluate((el) => {
    el.scrollIntoView({ block: 'end' })
    window.scrollBy(0, -20)
  })
  await page.waitForTimeout(400)
  expect(600 - (await rect(page, '[data-category-options="compras"]')).bottom).toBeLessThanOrEqual(60)
  await options.click()
  const dialog = sideSheet(page)
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('data-presentation', 'anchored')
  await page.waitForTimeout(300)
  const box = await rect(page, 'div[role="dialog"][data-open]')
  expect(box.top).toBeGreaterThanOrEqual(0)
  expect(box.bottom).toBeLessThanOrEqual(600)
  expect(box.left).toBeGreaterThanOrEqual(0)
  expect(box.right).toBeLessThanOrEqual(820)
  // Flipped above the control: it scales from its bottom edge.
  expect(await dialog.evaluate((el) => getComputedStyle(el).transformOrigin)).toMatch(/px \d+px$/)
})

test('"Añadir gasto" from the bar: pick "ocio", save 15, and the card gains the row and the total', async ({ page }) => {
  await loadDesktop(page)
  const before = Number((await page.locator('#category-amount-ocio').innerText()).replace(/[^\d]/g, '').slice(0, 3))
  await page.locator('[data-add-expense]').click()
  const dialog = sideSheet(page)
  await expect(dialog).toHaveAttribute('data-presentation', 'side')
  await expect(dialog.getByLabel('Importe')).toBeFocused()
  await dialog.locator('button[aria-label*="Cambiar"]').click()
  await dialog.getByRole('radio', { name: /ocio/i }).click()
  await dialog.getByLabel('Importe').fill('15')
  await dialog.getByLabel('Descripción').fill('Cine')
  await dialog.locator('button[type="submit"]').click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('#category-panel-ocio').getByRole('button', { name: /^Cine/ }).first()).toBeVisible()
  await expect(page.locator('#category-amount-ocio')).toContainText(`${before + 15} €`)
  // Still available on a projected cycle.
  await page.locator('[data-desktop-top-bar]').getByRole('button', { name: 'Ciclo siguiente' }).click()
  await page.waitForTimeout(600)
  await expect(page.locator('[data-add-expense]')).toBeEnabled()
  await page.locator('[data-add-expense]').click()
  await expect(sideSheet(page)).toHaveAttribute('data-presentation', 'side')
})
