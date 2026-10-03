// @ts-check
import { test, expect } from '@playwright/test'
import { BAR_HEIGHT } from './widgets-helpers'

// `dashboard-ui` → *Desktop layout* and `design-system` → *Wide viewports*, on `/demo`.

const rect = (page, selector) => page.locator(selector).first().evaluate((el) => {
  const r = el.getBoundingClientRect()
  return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), bottom: Math.round(r.bottom) }
})

async function load(page, width, height = 900) {
  // Geometry is read at rest: the entrance cascade would otherwise offset the cards mid-flight.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width, height })
  await page.goto('/demo')
  await page.waitForSelector('[data-weekly-top]', { state: 'attached' })
  await page.waitForTimeout(1200)
}

test('two columns on a laptop: 1120px page, widgets beside the cards, bar aligned with the page', async ({ page }) => {
  await load(page, 1280)
  const column = await rect(page, '[data-dashboard-page]')
  expect(column.width).toBe(1120)
  expect(column.left).toBe((1280 - 1120) / 2)
  const hero = await rect(page, '.hero-card')
  const weekly = await rect(page, '[data-weekly-top]')
  const widgets = await rect(page, '[data-dashboard-widgets]')
  expect(Math.abs(weekly.top - hero.top)).toBeLessThanOrEqual(2)
  expect(widgets.left).toBeGreaterThan(hero.right)
  expect(widgets.width).toBeGreaterThanOrEqual(360)
  const order = await page.locator('[data-dashboard-widgets] > div > div').evaluateAll((nodes) =>
    nodes.map((n) => ['data-weekly-top', 'data-spend-calendar', 'data-monthly-chart', 'data-distribution-chart'].find((a) => n.hasAttribute(a))),
  )
  expect(order).toEqual(['data-weekly-top', 'data-spend-calendar', 'data-monthly-chart', 'data-distribution-chart'])
  // The bar spans the page column: the logo's left edge by the hero's, the avatar's right by the widget column's.
  const logo = await rect(page, 'button[aria-label="Ir arriba"]')
  const avatar = await rect(page, '[aria-controls="account-menu"]')
  expect(Math.abs(logo.left - hero.left)).toBeLessThanOrEqual(14)
  expect(Math.abs(avatar.right - widgets.right)).toBeLessThanOrEqual(4)
  // On a laptop the composition strip is always shown and the card is not a control.
  await expect(page.locator('[data-composition-strip]')).toBeVisible()
  await expect(page.locator('.hero-card').getByRole('button')).toHaveCount(0)
  // The donut's legend sits beside it.
  const donut = await rect(page, '[data-donut]')
  const legend = await rect(page, '[data-distribution-chart] ul')
  expect(legend.left).toBeGreaterThanOrEqual(donut.right - 1)
})

test('the widget column sticks under the top bar while the cards scroll', async ({ page }) => {
  await load(page, 1280)
  const cards = page.locator('[data-dashboard-main] [aria-controls^="category-panel-"]')
  for (let i = 0; i < 3; i += 1) await cards.nth(i).click()
  await page.waitForTimeout(500)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.evaluate(() => window.scrollBy(0, 600))
  await page.waitForTimeout(500)
  const hero = await rect(page, '.hero-card')
  const weekly = await rect(page, '[data-weekly-top]')
  expect(hero.top).toBeLessThan(0)
  expect(weekly.top).toBeGreaterThanOrEqual(0)
  expect(weekly.top).toBeLessThanOrEqual(BAR_HEIGHT + 16)
})

test('one column on a phone and on a tablet, widgets after the last card in order', async ({ page }) => {
  for (const width of [390, 820]) {
    await load(page, width, 1000)
    const column = await rect(page, '[data-dashboard-page]')
    expect(column.width).toBe(width === 820 ? 640 : 390)
    const position = await page.locator('[data-dashboard-widgets]').evaluate((el) => getComputedStyle(el).position)
    expect(position).toBe('static')
    const lastCard = await page.locator('[data-dashboard-main] [aria-controls^="category-panel-"]').last().evaluate((el) => el.getBoundingClientRect().bottom)
    const widgets = await rect(page, '[data-dashboard-widgets]')
    expect(widgets.top).toBeGreaterThanOrEqual(lastCard)
    const order = await page.locator('[data-dashboard-widgets] > div > div').evaluateAll((nodes) =>
      nodes.map((n) => ['data-weekly-top', 'data-spend-calendar', 'data-monthly-chart', 'data-distribution-chart'].find((a) => n.hasAttribute(a))),
    )
    expect(order).toEqual(['data-weekly-top', 'data-spend-calendar', 'data-monthly-chart', 'data-distribution-chart'])
    const hero = await rect(page, '.hero-card')
    expect(hero.width).toBeLessThanOrEqual(column.width)
  }
})

test('reorder mode on a laptop dims the widget column, keeps the handle lane, and "Listo" restores the layout', async ({ page }) => {
  await load(page, 1280)
  const before = await rect(page, '[data-dashboard-widgets]')
  await page.locator('[data-category-options="comida"]').click()
  // The options sheet is anchored to its opener on a wide screen; the row may sit past the fold.
  await page.getByRole('button', { name: /^Reordenar/ }).evaluate((el) => /** @type {HTMLElement} */ (el).click())
  await page.waitForTimeout(600)
  const scrim = await rect(page, '.reorder-scrim')
  expect(scrim.width).toBe(1280)
  await expect(page.locator('[data-dashboard-widgets]')).toHaveAttribute('inert', '')
  await expect(page.locator('[aria-label^="Mover"]')).toHaveCount(7)
  await page.getByRole('button', { name: 'Listo' }).click()
  await page.waitForTimeout(500)
  await expect(page.locator('.reorder-scrim')).toBeHidden()
  const after = await rect(page, '[data-dashboard-widgets]')
  expect(after.left).toBe(before.left)
  expect(after.width).toBe(before.width)
})

test('the entry sheet opens centred over the page column at 1280px', async ({ page }) => {
  // Sheets anchored to their opener (category options) keep their anchor; the modal ones centre.
  await load(page, 1280)
  const header = page.locator('[aria-controls="category-panel-comida"]')
  await header.click()
  await page.locator('#category-panel-comida').getByRole('button', { name: 'Añadir gasto' }).click()
  const dialog = page.locator('div[role="dialog"][data-open]')
  await expect(dialog).toBeVisible()
  const box = await dialog.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }
  })
  expect(box.width).toBeLessThanOrEqual(520)
  expect(Math.abs(box.left - (1280 - box.right))).toBeLessThanOrEqual(2)
})
