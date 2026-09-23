// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

/** The totals that count up, and the `CountUp` span inside each. */
const COUNTERS = {
  freeMargin: '.hero-value .count-up',
  income: '[aria-controls="summary-group-panel"]:nth-child(1) .count-up',
  expenses: '[aria-controls="summary-group-panel"]:nth-child(2) .count-up',
  savings: '[aria-controls="summary-group-panel"]:nth-child(3) .count-up',
  vivienda: '#category-amount-vivienda .count-up',
  transporte: '#category-amount-transporte .count-up',
}

/** The figure a counter has settled on, as text: the count itself is aria-hidden, so the readable
 * copy of the value is the accessible twin beside it. */
function value(page, key) {
  return page.locator(`${COUNTERS[key].replace(' .count-up', '')} .sr-only`)
}

/** Records every counter's text on each animation frame, from inside the page, the way
 * `recurring-motion-a11y.spec.js` does: sampling from the test side would pay a round trip per
 * read, and under parallel load two reads can straddle a whole count. */
const RECORD = ({ counters, ms }) => {
  /** @type {Record<string, string[]>} */
  const series = {}
  for (const name of Object.keys(counters)) series[name] = []
  window.__counterFrames = series
  const deadline = performance.now() + ms
  const tick = () => {
    for (const [name, selector] of Object.entries(counters)) {
      const node = document.querySelector(selector)
      if (!node) continue
      series[name].push(node.textContent ?? '')
    }
    if (performance.now() < deadline) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/** Records from before the page's own scripts, which is the only way to catch the count on mount.
 * The window is long because the counters only mount once the page has hydrated. */
async function recordFromLoad(page, ms = 20000) {
  await page.addInitScript(RECORD, { counters: COUNTERS, ms })
}

/** Records from now — used around a mutation, once the mount count has long settled. */
async function recordNow(page, ms = 6000) {
  await page.evaluate(RECORD, { counters: COUNTERS, ms })
}

async function collectFrames(page, ms = 1600) {
  await page.waitForTimeout(ms)
  return page.evaluate(() => window.__counterFrames)
}

const distinct = (values) => new Set(values).size

/** A counter that travelled paints three or more different figures; one that jumped paints two
 * (before and after) and one that never moved paints one. */
function expectCounted(frames, key) {
  expect(frames[key].length, `${key}: no frames recorded`).toBeGreaterThan(3)
  expect(distinct(frames[key]), `${key}: did not count`).toBeGreaterThanOrEqual(3)
}

async function openTransporte(page) {
  await page.locator('button[aria-controls="category-panel-transporte"]').click()
  return page.locator('#category-panel-transporte')
}

const sheet = (page) => page.locator('div[role="dialog"][data-open]')

test('every total counts up on mount and settles on its figure', async ({ page }) => {
  await recordFromLoad(page)
  await page.goto('/demo')
  await expect(page.locator(COUNTERS.freeMargin)).toBeVisible()
  const frames = await collectFrames(page, 3000)

  // `CountUp` starts when the figure scrolls into view, so on mount only what is on screen counts;
  // `transporte` sits below the fold and waits its turn.
  for (const key of Object.keys(COUNTERS)) {
    if (key !== 'transporte') expectCounted(frames, key)
  }

  await recordNow(page)
  await page.locator(COUNTERS.transporte).scrollIntoViewIfNeeded()
  expectCounted(await collectFrames(page), 'transporte')

  await expect(value(page, 'freeMargin')).toHaveText(/^864/)
  await expect(value(page, 'income')).toHaveText(/^2\.820/)
  await expect(value(page, 'expenses')).toHaveText(/^1\.700/)
  await expect(value(page, 'savings')).toHaveText(/^146/)
  await expect(value(page, 'vivienda')).toHaveText(/^900/)
  // A budgeted category animates the spent half of "gastado de presupuesto"; the budget stays put.
  await expect(value(page, 'transporte')).toHaveText(/^130/)
  await expect(page.locator('#category-amount-transporte')).toContainText('de')

  // The count lands on the same figure the accessible twin reads — the spring's tail takes a few
  // seconds past the nominal duration to get there.
  await expect(page.locator(COUNTERS.expenses)).toHaveText('1.700', { timeout: 15000 })
})

test('reduced motion renders the plain figure, with no counter at all', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await recordFromLoad(page)
  await page.goto('/demo')
  await page.waitForTimeout(2000)

  await expect(page.locator('.count-up')).toHaveCount(0)
  await expect(page.locator('.hero-value')).toHaveText(/864/)
  await expect(page.locator('#category-amount-vivienda')).toHaveText(/900/)

  const frames = await collectFrames(page, 0)
  for (const key of Object.keys(COUNTERS)) expect(frames[key], `${key}: a counter was mounted`).toHaveLength(0)
})

test.describe('separators follow the locale', () => {
  for (const [locale, expected] of [
    ['es', '1.700'],
    ['en', '1,700'],
  ]) {
    test(`${locale} groups thousands as "${expected}"`, async ({ page }) => {
      await page.context().addCookies([{ name: 'locale', value: locale, url: 'http://localhost:3000' }])
      await page.goto('/demo')
      await expect(value(page, 'expenses')).toContainText(expected)
      await expect(page.locator(COUNTERS.expenses)).toHaveText(expected, { timeout: 15000 })
    })
  }
})

test('a created, edited and deleted expense each re-counts the totals it moves', async ({ page }) => {
  await page.goto('/demo')
  const panel = await openTransporte(page)
  await expect(value(page, 'transporte')).toHaveText(/^130/)

  // Create — 234,50 lands a decimal in every total it touches, and carries "Gastos" past a
  // thousands separator, so both of the locale's separators are on screen at once.
  await panel.getByRole('button', { name: 'Añadir gasto' }).click()
  await sheet(page).locator('input[inputmode="decimal"]').first().fill('234,5')
  await sheet(page).locator('input[type="text"]').first().fill('Peaje')
  await recordNow(page)
  await sheet(page).getByRole('button', { name: 'Añadir', exact: true }).click()

  let frames = await collectFrames(page)
  expectCounted(frames, 'freeMargin')
  expectCounted(frames, 'expenses')
  expectCounted(frames, 'transporte')
  await expect(value(page, 'freeMargin')).toHaveText(/^629,50/)
  await expect(value(page, 'expenses')).toHaveText(/^1\.934,50/)
  await expect(value(page, 'transporte')).toHaveText(/^364,50/)
  await expect(page.locator(COUNTERS.expenses)).toHaveText('1.934,50', { timeout: 15000 })

  // Edit.
  await panel.getByRole('button', { name: /Peaje/ }).click()
  await sheet(page).locator('input[inputmode="decimal"]').first().fill('34,5')
  await recordNow(page)
  await sheet(page).getByRole('button', { name: 'Guardar', exact: true }).click()

  frames = await collectFrames(page)
  expectCounted(frames, 'freeMargin')
  expectCounted(frames, 'expenses')
  expectCounted(frames, 'transporte')
  await expect(value(page, 'freeMargin')).toHaveText(/^829,50/)
  await expect(value(page, 'expenses')).toHaveText(/^1\.734,50/)
  await expect(value(page, 'transporte')).toHaveText(/^164,50/)

  // Delete.
  await panel.getByRole('button', { name: /Peaje/ }).click()
  await recordNow(page)
  await sheet(page).getByRole('button', { name: 'Eliminar gasto' }).click()

  frames = await collectFrames(page)
  expectCounted(frames, 'freeMargin')
  expectCounted(frames, 'expenses')
  expectCounted(frames, 'transporte')
  await expect(value(page, 'freeMargin')).toHaveText(/^864/)
  await expect(value(page, 'expenses')).toHaveText(/^1\.700/)
  await expect(value(page, 'transporte')).toHaveText(/^130/)
})
