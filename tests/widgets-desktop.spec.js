// @ts-check
import { test, expect } from '@playwright/test'
import { loadDesktop, rect, sideSheet, SIDEBAR_WIDTH } from './desktop-helpers'

// `dashboard-ui` → *Desktop columns* and `design-system` → *Wide viewports*, on `/demo`.

const WIDGETS = ['data-weekly-top', 'data-spend-calendar', 'data-monthly-chart', 'data-distribution-chart']
const widgetOrder = (page) =>
  page.locator('[data-dashboard-widgets] [data-widget]').evaluateAll((nodes, widgets) => nodes.map((n) => widgets.find((a) => n.querySelector(`[${a}]`))), WIDGETS)

test('two columns on a laptop: the tiles above both, the widgets beside the cards, the content capped at 1120px', async ({ page }) => {
  await loadDesktop(page, { width: 1280 })
  const column = await rect(page, '[data-dashboard-page]')
  expect(column.left).toBeGreaterThanOrEqual(SIDEBAR_WIDTH)
  expect(column.width).toBeLessThanOrEqual(1120)
  const tiles = await rect(page, '[data-dashboard-tiles]')
  const main = await rect(page, '[data-dashboard-main]')
  const widgets = await rect(page, '[data-dashboard-widgets]')
  const firstCard = await rect(page, '[data-dashboard-main] [aria-controls^="category-panel-"]')
  expect(tiles.bottom).toBeLessThanOrEqual(main.top)
  expect(tiles.bottom).toBeLessThanOrEqual(widgets.top)
  expect(tiles.right).toBeGreaterThanOrEqual(widgets.right - 1)
  expect(widgets.left).toBeGreaterThan(firstCard.right)
  expect(widgets.width).toBeGreaterThanOrEqual(320)
  // The first widget starts level with "Próximos cobros", under the breakdown header, never beside it.
  const header = await rect(page, '[data-breakdown-controls]')
  const upcoming = await rect(page, '[data-dashboard-main] #category-cascade')
  expect(widgets.top).toBeGreaterThanOrEqual(header.bottom)
  expect(Math.abs(widgets.top - upcoming.top)).toBeLessThanOrEqual(1)
  expect(await widgetOrder(page)).toEqual(WIDGETS)
  // On a laptop the hero is a tile: no strip and no control; the donut's legend sits under it.
  await expect(page.locator('.hero-card [data-composition-strip]')).toHaveCount(0)
  await expect(page.locator('.hero-card').getByRole('button')).toHaveCount(0)
  const donut = await rect(page, '[data-donut]')
  const legend = await rect(page, '[data-distribution-chart] ul')
  expect(legend.top).toBeGreaterThanOrEqual(donut.bottom - 1)
  expect(legend.width).toBeGreaterThanOrEqual(donut.width)
  // At 1024px the content column keeps its 24px gutters and nothing overflows.
  await loadDesktop(page, { width: 1024, height: 768 })
  const narrow = await rect(page, '[data-dashboard-page]')
  expect(narrow.left).toBe(SIDEBAR_WIDTH)
  expect(narrow.width).toBe(1024 - SIDEBAR_WIDTH)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024)
})

test('one column on a phone and on a tablet, widgets after the last card in order', async ({ page }) => {
  for (const width of [390, 820]) {
    await loadDesktop(page, { width, height: 1000 })
    const column = await rect(page, '[data-dashboard-page]')
    expect(column.width).toBe(width === 820 ? 640 : 390)
    const position = await page.locator('[data-dashboard-widgets]').evaluate((el) => getComputedStyle(el).position)
    expect(position).toBe('static')
    const lastCard = await page.locator('[data-dashboard-main] [aria-controls^="category-panel-"]').last().evaluate((el) => el.getBoundingClientRect().bottom)
    const widgets = await rect(page, '[data-dashboard-widgets]')
    expect(widgets.top).toBeGreaterThanOrEqual(lastCard)
    expect(await widgetOrder(page)).toEqual(WIDGETS)
    const hero = await rect(page, '.hero-card')
    expect(hero.width).toBeLessThanOrEqual(column.width)
  }
})

test('reorder mode on a laptop dims the shell and the widget column, keeps the handle lane, and "Listo" restores the layout', async ({ page }) => {
  await loadDesktop(page, { width: 1280 })
  const before = await rect(page, '[data-dashboard-widgets]')
  await page.locator('[data-category-options="comida"]').click()
  await page.getByRole('button', { name: /^Reordenar/ }).evaluate((el) => /** @type {HTMLElement} */ (el).click())
  await page.waitForTimeout(600)
  const scrim = await rect(page, '.reorder-scrim')
  expect(scrim.width).toBe(1280)
  await expect(page.locator('[data-dashboard-widgets]')).toHaveAttribute('inert', '')
  await expect(page.locator('[data-desktop-sidebar]')).toHaveAttribute('inert', '')
  await expect(page.locator('[data-desktop-top-bar]')).toHaveAttribute('inert', '')
  await expect(page.locator('[data-dashboard-main] [aria-label^="Mover"]')).toHaveCount(7)
  // The shell sits under the pushed-back layer.
  expect(await page.locator('[data-desktop-sidebar]').evaluate((el) => Number(getComputedStyle(el).zIndex))).toBeLessThan(35)
  await page.getByRole('button', { name: 'Listo' }).click()
  await page.waitForTimeout(500)
  await expect(page.locator('.reorder-scrim')).toBeHidden()
  const after = await rect(page, '[data-dashboard-widgets]')
  expect(after.left).toBe(before.left)
  expect(after.width).toBe(before.width)
})

test('the entry sheet opens as a side panel at 1280px', async ({ page }) => {
  await loadDesktop(page, { width: 1280 })
  await page.locator('#category-panel-comida').getByRole('button', { name: 'Añadir gasto' }).click()
  const dialog = sideSheet(page)
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('data-presentation', 'side')
  const box = await rect(page, 'div[role="dialog"][data-open]')
  expect(1280 - box.right).toBeLessThanOrEqual(16)
  expect(box.width).toBeGreaterThanOrEqual(400)
})
