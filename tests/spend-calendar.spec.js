// @ts-check
import { test, expect } from '@playwright/test'
import { reveal, tokenColor } from './widgets-helpers'

test.use({ viewport: { width: 390, height: 844 } })

// `spend-insights` → *Spend calendar widget*, on `/demo` (September 2026, Europe/Dublin).

const cells = (page) => page.locator('[data-calendar-grid] [data-day]')

function luminance(rgb) {
  const [r, g, b] = rgb.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0]
  const channel = (v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/demo')
  await reveal(page, '[data-spend-calendar]')
})

test('30 cells in rows of seven, 1 September the darkest, 11 September the surface tone, today outlined', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Gasto por día' })).toBeVisible()
  await expect(cells(page)).toHaveCount(30)
  const rows = await cells(page).evaluateAll((nodes) => new Set(nodes.map((n) => Math.round(n.getBoundingClientRect().top))).size)
  expect(rows).toBe(5)
  const lastRow = await cells(page).evaluateAll((nodes) => {
    const tops = nodes.map((n) => Math.round(n.getBoundingClientRect().top))
    return tops.filter((t) => t === Math.max(...tops)).length
  })
  expect(lastRow).toBe(2)
  await expect(page.locator('[data-day="2026-09-01"]')).toHaveAttribute('data-step', '4')
  const steps = await cells(page).evaluateAll((nodes) => nodes.map((n) => Number(n.getAttribute('data-step'))))
  expect(steps.filter((s) => s === 4)).toHaveLength(1)
  await expect(page.locator('[data-day="2026-09-11"]')).toHaveAttribute('data-step', '0')
  await expect(page.locator('[data-day][data-today]')).toHaveCount(1)
  const shadow = await page.locator('[data-day][data-today]').evaluate((el) => getComputedStyle(el).boxShadow)
  expect(shadow).toContain('inset')
})

test('future days have no fill step and a muted number, and a pending charge adds nothing', async ({ page }) => {
  // The demo's gym charge (22 September) is pending: its day stays at step 0.
  await expect(page.locator('[data-day="2026-09-22"]')).toHaveAttribute('data-step', '0')
  const future = page.locator('[data-day][data-future]')
  const count = await future.count()
  const muted = await tokenColor(page, '--muted-foreground')
  for (let i = 0; i < count; i += 1) {
    await expect(future.nth(i)).toHaveAttribute('data-step', '0')
    const color = await future.nth(i).evaluate((el) => getComputedStyle(el).color)
    expect(color).not.toBe(await tokenColor(page, '--foreground'))
    expect(color === muted || color.includes('/') || color.startsWith('oklab') || color.startsWith('rgba')).toBeTruthy()
  }
})

test('the 3 September tooltip reads 287,40 € and three rows; 11 September says Sin gastos', async ({ page }) => {
  await page.locator('[data-day="2026-09-03"]').hover()
  const tooltip = page.locator('[data-spend-calendar] [role="tooltip"][data-open]')
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('287,40 €')
  await expect(tooltip).toContainText('3 de septiembre')
  await expect(tooltip).toContainText('3 movimientos')
  await page.locator('[data-day="2026-09-11"]').hover()
  await expect(tooltip).toContainText('Sin gastos')
  await expect(tooltip).toContainText('11 de septiembre')
  await page.mouse.move(2, 2)
  await expect(tooltip).toBeHidden()
  await page.locator('[data-day="2026-09-03"]').focus()
  await expect(page.locator('[data-spend-calendar] [role="tooltip"][data-open]')).toContainText('287,40 €')
})

test('the legend runs from the surface tone to the darkest step, which clears 3:1 on the card, in both themes', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme)
    await page.waitForTimeout(200)
    const legend = page.locator('[data-heat-legend]')
    await expect(legend).toContainText('menos')
    await expect(legend).toContainText('más')
    const swatches = await legend.locator('span[aria-hidden] > span').evaluateAll((nodes) => nodes.map((n) => getComputedStyle(n).backgroundColor))
    expect(swatches).toHaveLength(5)
    const card = await page.locator('[data-spend-calendar]').evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(contrast(swatches[4], card)).toBeGreaterThanOrEqual(3)
    const warning = await tokenColor(page, '--warning')
    const danger = await tokenColor(page, '--destructive')
    expect(swatches).not.toContain(warning)
    expect(swatches).not.toContain(danger)
  }
})

test('fits a phone: every cell at least 36px wide, seven columns, no horizontal scroll', async ({ page }) => {
  const widths = await cells(page).evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().width))
  expect(Math.min(...widths)).toBeGreaterThanOrEqual(36)
  const columns = await cells(page).evaluateAll((nodes) => new Set(nodes.slice(0, 7).map((n) => Math.round(n.getBoundingClientRect().left))).size)
  expect(columns).toBe(7)
  const scroll = await page.evaluate(() => ({
    widget: (() => {
      const el = document.querySelector('[data-spend-calendar]')
      return el ? el.scrollWidth > el.clientWidth : true
    })(),
    page: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }))
  expect(scroll).toEqual({ widget: false, page: false })
})

test('every day is available as text to assistive technology', async ({ page }) => {
  await expect(page.locator('[data-day="2026-09-03"]')).toHaveAttribute('aria-label', /3 de septiembre · 287,40\s€ · 3 movimientos/)
  await expect(page.locator('[data-day="2026-09-11"]')).toHaveAttribute('aria-label', /11 de septiembre · Sin gastos/)
  await expect(page.locator('[data-day][data-today]')).toHaveAttribute('aria-label', /\(hoy\)/)
  const labelled = await cells(page).evaluateAll((nodes) => nodes.filter((n) => n.getAttribute('aria-label')).length)
  expect(labelled).toBe(30)
})
