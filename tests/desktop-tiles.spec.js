// @ts-check
import { test, expect } from '@playwright/test'
import { loadDesktop, rect, sideSheet, TOP_BAR_HEIGHT } from './desktop-helpers'

// `desktop-shell` → *Stat tiles* and *Desktop shell at wide viewports* (columns), and `dashboard-ui` →
// *Summary cards*, *Expense card states*, *Desktop columns*, on `/demo`.

const TILES = ['.hero-card', '[data-summary-column="income"]', '[data-summary-column="expenses"]', '[data-summary-column="savings"]']

test('four tiles in one row, equal height, the free margin the largest text, no strip and no accordion', async ({ page }) => {
  await loadDesktop(page)
  const boxes = []
  for (const selector of TILES) boxes.push(await rect(page, selector))
  for (const box of boxes) {
    expect(box.top).toBe(boxes[0].top)
    expect(box.height).toBe(boxes[0].height)
  }
  expect(boxes[1].left).toBeGreaterThan(boxes[0].right)
  expect(boxes[3].right).toBeLessThanOrEqual(1280 - 24)
  await expect(page.locator('.hero-card')).toContainText(/864\s?€/)
  await expect(page.locator('.hero-card [data-composition-strip]')).toHaveCount(0)
  await expect(page.locator('.hero-card button')).toHaveCount(0)
  const sizes = await page.evaluate(() => {
    const hero = parseFloat(getComputedStyle(/** @type {Element} */ (document.querySelector('.hero-value'))).fontSize)
    let max = 0
    for (const el of document.querySelectorAll('body *')) {
      if (!el.textContent?.trim() || el.children.length || el.closest('.sr-only, .hero-value')) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      max = Math.max(max, parseFloat(cs.fontSize))
    }
    return { hero, max }
  })
  expect(sizes.hero).toBeGreaterThan(sizes.max)
  await expect(page.locator('#summary-group-panel')).toHaveCount(0)
  await expect(page.locator('[aria-controls="summary-group-panel"]')).toHaveCount(0)
  // The strip lives in the sidebar's savings block, with its three labels.
  const strip = page.locator('[data-sidebar-figures] [data-composition-strip]')
  await expect(strip).toBeVisible()
  await expect(strip).toContainText('Gastado')
  await expect(strip).toContainText('Ahorrado')
  await expect(strip).toContainText('Libre')
  // Captions: one line of context under each total.
  await expect(page.locator('[data-summary-column="income"]')).toContainText('2 entradas')
  await expect(page.locator('[data-summary-column="expenses"]')).toContainText('7 categorías')
  await expect(page.locator('[data-summary-column="savings"]')).toContainText('Meta 300 € al mes')
})

test('at 1024px the tiles still fit in one row with nothing overflowing', async ({ page }) => {
  await loadDesktop(page, { width: 1024, height: 768 })
  const boxes = []
  for (const selector of TILES) boxes.push(await rect(page, selector))
  for (const box of boxes) expect(box.top).toBe(boxes[0].top)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024)
  // No caption wraps: each tile's text block stays within two lines of its label and amount.
  const heights = await page.locator('[data-summary-column] > span:last-of-type').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
  for (const height of heights) expect(height).toBeLessThanOrEqual(20)
})

test('the income tile opens its side panel with the dated entries and the add row, not the total', async ({ page }) => {
  await loadDesktop(page)
  await page.locator('[data-summary-column="income"]').click()
  const dialog = sideSheet(page)
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('data-presentation', 'side')
  await expect(dialog.locator('h2').first()).toHaveText('Ingresos')
  const box = await rect(page, 'div[role="dialog"][data-open]')
  expect(1280 - box.right).toBeLessThanOrEqual(16)
  // Every income entry is a dated row, newest first, then the add row.
  const rows = dialog.locator('[data-summary-panel]').getByRole('button').filter({ hasText: /sept/ })
  expect(await rows.count()).toBeGreaterThanOrEqual(2)
  await expect(dialog.getByRole('button', { name: 'Añadir ingreso' })).toHaveCount(1)
  expect(await dialog.evaluate((el) => (el.textContent?.match(/2\.820\s€/g) ?? []).length)).toBe(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('the savings tile opens the accumulated block, the movements and the add row; a new movement updates the tile', async ({ page }) => {
  await loadDesktop(page)
  await expect(page.locator('[data-summary-column="savings"]')).toContainText(/146\s?€/)
  await page.locator('[data-summary-column="savings"]').click()
  const dialog = sideSheet(page)
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Acumulado')).toHaveCount(1)
  await expect(dialog.getByRole('button', { name: 'Añadir movimiento de ahorro' })).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Añadir movimiento de ahorro' }).click()
  const sheet = page.locator('div[role="dialog"][data-open]').last()
  await expect(sheet.getByLabel('Importe')).toBeFocused()
  await sheet.getByLabel('Importe').fill('40')
  await sheet.getByLabel('Nombre').fill('Hucha')
  await sheet.locator('button[type="submit"]').click()
  await page.waitForTimeout(600)
  await expect(page.locator('[data-summary-column="savings"]')).toContainText(/186\s?€/)
})

test('the expenses tile scrolls to the breakdown and opens nothing', async ({ page }) => {
  await loadDesktop(page)
  await page.locator('[data-summary-column="expenses"]').click()
  await page.waitForTimeout(900)
  await expect(sideSheet(page)).toHaveCount(0)
  const first = await rect(page, '[data-dashboard-main] [aria-controls^="category-panel-"]')
  expect(first.top).toBeGreaterThanOrEqual(TOP_BAR_HEIGHT)
})

test('cards start open on a laptop; "Contraer todas" closes them and becomes "Expandir todas"; "Nueva categoría" opens the create sheet', async ({ page }) => {
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text())
  })
  await loadDesktop(page)
  const headers = page.locator('[data-dashboard-main] [aria-controls^="category-panel-"]')
  await expect(headers).toHaveCount(7)
  for (let i = 0; i < 7; i += 1) await expect(headers.nth(i)).toHaveAttribute('aria-expanded', 'true')
  expect(errors.filter((text) => /hydrat/i.test(text))).toEqual([])
  await page.getByRole('button', { name: 'Contraer todas' }).click()
  await page.waitForTimeout(300)
  for (let i = 0; i < 7; i += 1) await expect(headers.nth(i)).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('button', { name: 'Expandir todas' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Contraer todas' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Expandir todas' }).click()
  await page.waitForTimeout(300)
  for (let i = 0; i < 7; i += 1) await expect(headers.nth(i)).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: 'Nueva categoría' }).click()
  const dialog = sideSheet(page)
  await expect(dialog).toHaveAttribute('data-presentation', 'side')
  await expect(dialog.locator('h2').first()).toHaveText('Nueva categoría')
})

test('cards still start collapsed on a phone, with the phone\'s "collapse all" rule', async ({ page }) => {
  await loadDesktop(page, { width: 390, height: 844 })
  const headers = page.locator('[aria-controls^="category-panel-"]')
  for (let i = 0; i < 7; i += 1) await expect(headers.nth(i)).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('button', { name: 'Contraer todas' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Nueva categoría' })).toHaveCount(0)
  await headers.first().click()
  await expect(page.getByRole('button', { name: 'Colapsar todo' })).toBeVisible()
})

test('both columns scroll with the page: 800px moves the first widget and the first card alike, and nothing else scrolls', async ({ page }) => {
  await loadDesktop(page)
  const widgetBefore = await rect(page, '[data-weekly-top]')
  const cardBefore = await rect(page, '[data-dashboard-main] [aria-controls^="category-panel-"]')
  await page.evaluate(() => window.scrollBy(0, 800))
  await page.waitForTimeout(300)
  const widgetAfter = await rect(page, '[data-weekly-top]')
  const cardAfter = await rect(page, '[data-dashboard-main] [aria-controls^="category-panel-"]')
  expect(widgetBefore.top - widgetAfter.top).toBe(800)
  expect(cardBefore.top - cardAfter.top).toBe(800)
  const scrollers = await page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((el) => {
        const cs = getComputedStyle(el)
        return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1 && el.getClientRects().length > 0
      })
      .map((el) => el.tagName + '.' + el.className.toString().slice(0, 30)),
  )
  expect(scrollers).toEqual([])
  expect(await page.locator('[data-dashboard-widgets]').evaluate((el) => getComputedStyle(el).position)).toBe('static')
})
