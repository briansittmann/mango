// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

/** The totals that roll, and the counter row inside each. */
const COUNTERS = {
  freeMargin: '.hero-value .counter-counter',
  income: '[aria-controls="summary-group-panel"]:nth-child(1) .counter-counter',
  expenses: '[aria-controls="summary-group-panel"]:nth-child(2) .counter-counter',
  savings: '[aria-controls="summary-group-panel"]:nth-child(3) .counter-counter',
  vivienda: '#category-amount-vivienda .counter-counter',
  transporte: '#category-amount-transporte .counter-counter',
}

/** The figure a counter is showing, as text: every column paints all ten digits, so the only
 * readable copy of the value is the accessible twin beside them. */
function value(page, key) {
  return page.locator(`${COUNTERS[key].replace(' .counter-counter', '')} .sr-only`)
}

/** Records every counter's digit offsets on each animation frame, from inside the page, the way
 * `recurring-motion-a11y.spec.js` does: sampling from the test side would pay a round trip per
 * read, and under parallel load two reads can straddle a whole roll. */
const RECORD = ({ counters, ms }) => {
  /** @type {Record<string, string[]>} */
  const series = {}
  for (const name of Object.keys(counters)) series[name] = []
  window.__counterFrames = series
  const deadline = performance.now() + ms
  const tick = () => {
    for (const [name, selector] of Object.entries(counters)) {
      const row = document.querySelector(selector)
      if (!row) continue
      series[name].push(
        Array.from(row.querySelectorAll('.counter-number'))
          .map((digit) => getComputedStyle(digit).transform)
          .join('|'),
      )
    }
    if (performance.now() < deadline) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/** Records from before the page's own scripts, which is the only way to catch the roll on mount. */
async function recordFromLoad(page, ms = 5000) {
  await page.addInitScript(RECORD, { counters: COUNTERS, ms })
}

/** Records from now — used around a mutation, once the mount roll has long settled. */
async function recordNow(page, ms = 4000) {
  await page.evaluate(RECORD, { counters: COUNTERS, ms })
}

async function collectFrames(page, ms = 1600) {
  await page.waitForTimeout(ms)
  return page.evaluate(() => window.__counterFrames)
}

const distinct = (values) => new Set(values).size

/** A counter that travelled paints its digits at three or more offsets; one that jumped paints two
 * (before and after) and one that never moved paints one. */
function expectRolled(frames, key) {
  expect(frames[key].length, `${key}: no frames recorded`).toBeGreaterThan(3)
  expect(distinct(frames[key]), `${key}: did not roll`).toBeGreaterThanOrEqual(3)
}

async function openTransporte(page) {
  await page.locator('button[aria-controls="category-panel-transporte"]').click()
  return page.locator('#category-panel-transporte')
}

const sheet = (page) => page.locator('div[role="dialog"][data-open]')

test('every total rolls on mount and settles on its figure', async ({ page }) => {
  await recordFromLoad(page)
  await page.goto('/demo')
  const frames = await collectFrames(page, 3000)

  for (const key of Object.keys(COUNTERS)) expectRolled(frames, key)

  await expect(value(page, 'freeMargin')).toHaveText(/^974/)
  await expect(value(page, 'income')).toHaveText(/^2\.820/)
  await expect(value(page, 'expenses')).toHaveText(/^1\.700/)
  await expect(value(page, 'savings')).toHaveText(/^146/)
  await expect(value(page, 'vivienda')).toHaveText(/^900/)
  // A budgeted category animates the spent half of "gastado de presupuesto"; the budget stays put.
  await expect(value(page, 'transporte')).toHaveText(/^130/)
  await expect(page.locator('#category-amount-transporte')).toContainText('de')
})

test('reduced motion renders the plain figure, with no counter at all', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await recordFromLoad(page)
  await page.goto('/demo')
  await page.waitForTimeout(2000)

  await expect(page.locator('.counter-container')).toHaveCount(0)
  await expect(page.locator('.hero-value')).toHaveText(/974/)
  await expect(page.locator('#category-amount-vivienda')).toHaveText(/900/)

  const frames = await collectFrames(page, 0)
  for (const key of Object.keys(COUNTERS)) expect(frames[key], `${key}: a counter was mounted`).toHaveLength(0)
})

test.describe('separators follow the locale', () => {
  for (const [locale, group, expected] of [
    ['es', '.', '1.700'],
    ['en', ',', '1,700'],
  ]) {
    test(`${locale} groups thousands with "${group}"`, async ({ page }) => {
      await page.context().addCookies([{ name: 'locale', value: locale, url: 'http://localhost:3000' }])
      await page.goto('/demo')
      await expect(value(page, 'expenses')).toContainText(expected)
      await expect(page.locator(`${COUNTERS.expenses} .counter-separator`)).toHaveText([group])
    })
  }
})

test('a created, edited and deleted expense each re-rolls the totals it moves', async ({ page }) => {
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
  expectRolled(frames, 'freeMargin')
  expectRolled(frames, 'expenses')
  expectRolled(frames, 'transporte')
  await expect(value(page, 'freeMargin')).toHaveText(/^739,50/)
  await expect(value(page, 'expenses')).toHaveText(/^1\.934,50/)
  await expect(value(page, 'transporte')).toHaveText(/^364,50/)
  await expect(page.locator(`${COUNTERS.expenses} .counter-separator`)).toHaveText(['.', ','])

  // Edit.
  await panel.getByRole('button', { name: /Peaje/ }).click()
  await sheet(page).locator('input[inputmode="decimal"]').first().fill('34,5')
  await recordNow(page)
  await sheet(page).getByRole('button', { name: 'Guardar', exact: true }).click()

  frames = await collectFrames(page)
  expectRolled(frames, 'freeMargin')
  expectRolled(frames, 'expenses')
  expectRolled(frames, 'transporte')
  await expect(value(page, 'freeMargin')).toHaveText(/^939,50/)
  await expect(value(page, 'expenses')).toHaveText(/^1\.734,50/)
  await expect(value(page, 'transporte')).toHaveText(/^164,50/)

  // Delete.
  await panel.getByRole('button', { name: /Peaje/ }).click()
  await recordNow(page)
  await sheet(page).getByRole('button', { name: 'Eliminar gasto' }).click()

  frames = await collectFrames(page)
  expectRolled(frames, 'freeMargin')
  expectRolled(frames, 'expenses')
  expectRolled(frames, 'transporte')
  await expect(value(page, 'freeMargin')).toHaveText(/^974/)
  await expect(value(page, 'expenses')).toHaveText(/^1\.700/)
  await expect(value(page, 'transporte')).toHaveText(/^130/)
})
