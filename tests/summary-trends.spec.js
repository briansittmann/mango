// @ts-check
import { test, expect } from '@playwright/test'
import { addExpense, reveal, tokenColor } from './widgets-helpers'

// `dashboard-ui` → *Summary cards* (trends), *Savings target in the data*, *Cycle header and free
// margin* (composition strip) and *Monthly spend chart* (caption), on `/demo` in Spanish.

const columns = (page) => page.locator('[data-summary-column]')

async function columnGeometry(page) {
  return columns(page).evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      const at = (selector) => Math.round((node.querySelector(selector)?.getBoundingClientRect().top ?? 0) - rect.top)
      return { height: Math.round(rect.height), label: at('.text-label-ui'), total: at('.count-up, [style*="tabular"]'), trend: at('[data-summary-trend]') }
    }),
  )
}

test.describe('summary trends', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/demo')
    await page.waitForSelector('[data-summary-column]')
    await page.waitForTimeout(800)
  })

  // The tile trends are built but hidden behind `SHOW_SUMMARY_TRENDS` (dashboard-template.tsx) since
  // 2026-10-03; the two tests that read them are skipped until the flag turns on.
  test('the tiles show no trend while the flag is off', async ({ page }) => {
    await expect(page.locator('[data-summary-trend]')).toHaveCount(0)
    await expect(page.locator('[data-summary-column] [data-sparkline]')).toHaveCount(0)
    await expect(page.locator('[data-summary-column="expenses"]')).toContainText('1.700 €')
  })

  test.skip('expenses show −3 % in the good colour, savings +6 %, income its delta, each with a sparkline', async ({ page }) => {
    const expenses = page.locator('[data-summary-column="expenses"]')
    await expect(expenses).toContainText('1.700 €')
    const delta = expenses.locator('[data-trend]')
    await expect(delta).toContainText('−3 %')
    await expect(delta).toHaveAttribute('data-trend', 'good')
    expect(await delta.evaluate((el) => getComputedStyle(el).color)).toBe(await tokenColor(page, '--positive'))
    await expect(page.locator('[data-summary-column="savings"] [data-trend]')).toContainText('+6 %')
    await expect(page.locator('[data-summary-column="savings"]')).toContainText('146 €')
    await expect(page.locator('[data-summary-column="income"] [data-trend]')).toContainText(/[+−]\d+ %/)
    for (const key of ['income', 'expenses', 'savings']) {
      const spark = page.locator(`[data-summary-column="${key}"] [data-sparkline]`)
      await expect(spark).toHaveAttribute('aria-hidden', 'true')
      await expect(spark.locator('polyline')).toHaveCount(1)
      const points = await spark.locator('polyline').getAttribute('points')
      expect(points?.split(' ')).toHaveLength(6)
    }
    // The delta is text for assistive technology, with its comparison.
    await expect(page.getByRole('button', { name: /Gastos.*−3 %.*vs ciclo anterior/ })).toBeVisible()
  })

  test.skip('the tile delta reads as flat in the muted colour when the change is under 1 %', async ({ page }) => {
    await addExpense(page, 'compras', { amount: '50', description: 'Regalo' })
    const delta = page.locator('[data-summary-column="expenses"] [data-trend]')
    await expect(delta).toHaveAttribute('data-trend', 'flat')
    await expect(delta).toContainText('Sin cambios')
    expect(await delta.evaluate((el) => getComputedStyle(el).color)).toBe(await tokenColor(page, '--muted-foreground'))
    expect(await delta.locator('svg').getAttribute('class')).toContain('lucide-minus')
  })

  test('the monthly caption reads as flat in the muted colour when the change is under 1 %', async ({ page }) => {
    await addExpense(page, 'compras', { amount: '50', description: 'Regalo' })
    await reveal(page, '[data-monthly-chart]')
    const caption = page.locator('[data-monthly-chart] [data-trend]')
    await expect(caption).toHaveAttribute('data-trend', 'flat')
    await expect(caption).toContainText('Sin cambios')
    expect(await caption.evaluate((el) => getComputedStyle(el).color)).toBe(await tokenColor(page, '--muted-foreground'))
    expect(await caption.locator('svg').getAttribute('class')).toContain('lucide-minus')
  })

  test('the three columns keep one shape at 390px and at 360px', async ({ page }) => {
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 })
      await page.waitForTimeout(300)
      const geometry = await columnGeometry(page)
      expect(geometry).toHaveLength(3)
      for (const column of geometry) {
        expect(column.height).toBe(geometry[0].height)
        expect(column.label).toBe(geometry[0].label)
        expect(column.trend).toBe(geometry[0].trend)
      }
      const overflow = await columns(page).evaluateAll((nodes) => nodes.some((n) => n.scrollWidth > n.clientWidth + 1))
      expect(overflow).toBe(false)
    }
  })

  test('the savings column shows label, total and trend and nothing else, and still opens', async ({ page }) => {
    const savings = page.locator('[data-summary-column="savings"]')
    await expect(savings.getByRole('progressbar')).toHaveCount(0)
    await expect(savings).not.toContainText('de 300')
    await expect(savings).not.toHaveAttribute('aria-disabled', 'true')
    await savings.click()
    await expect(savings).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('#summary-group-panel')).toContainText('Acumulado')
  })

  test('on a phone the strip is folded, with no indicator, and the card opens and closes it', async ({ page }) => {
    const card = page.locator('.hero-card')
    const toggle = card.getByRole('button', { name: /Margen libre/ })
    const strip = page.locator('[data-composition-strip]')
    // Folded is zero height in a clipping wrapper, which Playwright still counts as visible.
    const foldedHeight = () => page.locator('#free-margin-composition').evaluate((el) => el.getBoundingClientRect().height)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(foldedHeight).toBeLessThan(1)
    // Nothing on screen says the card opens: no chevron, no icon.
    await expect(card.locator('svg')).toHaveCount(0)
    await card.click({ position: { x: 300, y: 40 } })
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(strip).toBeVisible()
    await expect.poll(foldedHeight).toBeGreaterThan(20)
    // A tap on a segment shows its tooltip and leaves the strip open.
    await page.locator('[data-segment="libre"]').click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    // The keyboard reaches the same toggle.
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(foldedHeight).toBeLessThan(1)
  })

  test('the composition strip splits the income into spent, saved and free, with tooltips and no printed numbers', async ({ page }) => {
    const strip = page.locator('[data-composition-strip]')
    await page.locator('.hero-card').getByRole('button', { name: /Margen libre/ }).click()
    await expect(strip).toBeVisible()
    await page.waitForTimeout(300)
    const segments = strip.locator('[data-segment]')
    await expect(segments).toHaveCount(3)
    const widths = await segments.evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().width))
    const total = widths.reduce((sum, w) => sum + w, 0)
    expect(widths[2] / total).toBeGreaterThan(0.29)
    expect(widths[2] / total).toBeLessThan(0.33)
    const labels = strip.locator('[aria-hidden] span')
    await expect(labels).toHaveText(['Gastado', 'Ahorrado', 'Libre'])
    await expect(page.locator('.hero-card')).not.toContainText('2.820')
    await expect(page.locator('.hero-card')).not.toContainText('%')
    await page.locator('[data-segment="ahorrado"]').hover()
    const tooltip = page.locator('.hero-card [role="tooltip"][data-open]')
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toContainText('146 €')
    await expect(tooltip).toContainText('5 %')
    await expect(tooltip).toContainText('Ahorrado')
    await page.mouse.move(2, 2)
    await expect(tooltip).toBeHidden()
    await page.locator('[data-segment="ahorrado"]').focus()
    await expect(page.locator('.hero-card [role="tooltip"][data-open]')).toContainText('146 €')
  })

  test('a negative margin shows no strip', async ({ page }) => {
    await addExpense(page, 'comida', { amount: '3000', description: 'Viaje' })
    await expect(page.locator('.hero-card')).toHaveClass(/hero-card--negative/)
    await expect(page.locator('[data-composition-strip]')).toHaveCount(0)
  })

  test('the monthly caption reads a 3 % drop against "ago" in the good colour', async ({ page }) => {
    await reveal(page, '[data-monthly-chart]')
    const chart = page.locator('[data-monthly-chart]')
    await expect(chart.locator('[data-trend]')).toContainText('−3 %')
    await expect(chart.locator('[data-trend]')).toHaveAttribute('data-trend', 'good')
    await expect(chart).toContainText('vs ago')
  })
})
