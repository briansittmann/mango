// @ts-check
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { addExpense, goToWeekOne, reveal } from './widgets-helpers'

test.use({ viewport: { width: 390, height: 844 } })

// `design-system` → *Motion respects user preference* (chart marks) and the keyboard and tooltip
// scenarios of `spend-insights` and `dashboard-ui`, on `/demo`.

const FULL_BAR = /^inset\(0px/

test.describe('reduced motion', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/demo')
    await page.waitForSelector('[data-weekly-top]', { state: 'attached' })
  })

  test('every mark is at its final size and opacity in the first frame it is visible', async ({ page }) => {
    await page.locator('[data-spend-calendar]').scrollIntoViewIfNeeded()
    const state = await page.evaluate(() => {
      const style = (selector) => getComputedStyle(document.querySelector(selector))
      return {
        cell: style('[data-day="2026-09-01"]').opacity,
        cellTransition: style('[data-day="2026-09-01"]').transitionProperty,
        // The tile sparklines are hidden behind `SHOW_SUMMARY_TRENDS` for now; checked when present.
        spark: document.querySelector('.sparkline-stroke') ? style('.sparkline-stroke').strokeDashoffset : '0px',
        segment: style('[data-segment]').opacity,
      }
    })
    expect(state.cell).toBe('1')
    expect(state.cellTransition).toBe('none')
    expect(state.spark).toBe('0px')
    expect(state.segment).toBe('1')
    await goToWeekOne(page)
    const bar = await page.locator('[data-weekly-bar] .chart-bar').first().evaluate((el) => ({ clip: getComputedStyle(el).clipPath, transition: getComputedStyle(el).transitionProperty }))
    expect(bar.clip).toMatch(FULL_BAR)
    expect(bar.transition).toBe('none')
    await page.locator('[data-monthly-chart]').scrollIntoViewIfNeeded()
    const monthly = await page.locator('path[data-month-bar="2026-09"]').evaluate((el) => getComputedStyle(el).clipPath)
    expect(monthly).toMatch(FULL_BAR)
  })

  test('after an expense is added the changed bar is at its new size in the first frame', async ({ page }) => {
    await addExpense(page, 'comida', { amount: '20', description: 'Panadería' })
    await page.locator('[data-weekly-top]').scrollIntoViewIfNeeded()
    const bar = page.locator('[data-weekly-bar="comida"] .chart-bar')
    await expect(bar).toHaveCount(1)
    const clip = await bar.evaluate((el) => getComputedStyle(el).clipPath)
    expect(clip).toMatch(FULL_BAR)
    // Below `lg` the strip is folded until the card is opened.
    await page.locator('.hero-card').getByRole('button', { name: /Margen libre/ }).click()
    const tooltip = page.locator('[data-segment="ahorrado"]')
    await tooltip.focus()
    const transform = await page.locator('.hero-card [role="tooltip"]').evaluate((el) => getComputedStyle(el).transform)
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform)
  })
})

test.describe('motion on', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/demo')
    await page.waitForSelector('[data-weekly-top]', { state: 'attached' })
  })

  test('chart marks draw once: clipped before reveal, full within 900 ms, no replay on a later scroll', async ({ page }) => {
    const path = page.locator('path[data-month-bar="2026-09"]')
    await expect(path).toHaveCount(1)
    const before = await path.evaluate((el) => getComputedStyle(el).clipPath)
    expect(before).not.toMatch(FULL_BAR)
    // Queried fresh each time: recharts may swap the path node when the chart re-measures.
    const clip = () => page.evaluate(() => getComputedStyle(/** @type {Element} */ (document.querySelector('path[data-month-bar="2026-09"]'))).clipPath)
    await page.locator('[data-monthly-chart]').scrollIntoViewIfNeeded()
    await expect.poll(clip, { timeout: 1200 }).toMatch(FULL_BAR)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(300)
    await page.locator('[data-monthly-chart]').scrollIntoViewIfNeeded()
    expect(await clip()).toMatch(FULL_BAR)
    const duration = await page.evaluate(() => getComputedStyle(/** @type {Element} */ (document.querySelector('path[data-month-bar="2026-09"]'))).transitionDuration)
    expect(['0.25s', '0.5s']).toContain(duration)
  })

  test('a changed bar moves from its previous size instead of restarting from zero', async ({ page }) => {
    await reveal(page, '[data-monthly-chart]')
    const path = page.locator('path[data-month-bar="2026-09"]')
    const heightBefore = await path.evaluate((el) => el.getBoundingClientRect().height)
    await addExpense(page, 'comida', { amount: '20', description: 'Panadería' })
    await page.locator('[data-monthly-chart]').scrollIntoViewIfNeeded()
    const clip = await path.evaluate((el) => getComputedStyle(el).clipPath)
    expect(clip).not.toMatch(/inset\(100%/)
    expect(await path.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(heightBefore - 1)
  })
})

test.describe('keyboard and tooltips', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo')
    await reveal(page, '[data-monthly-chart]')
  })

  test('Tab reaches the monthly bars in order, Enter selects July and the tooltip names the month', async ({ page, browserName }) => {
    // WebKit on macOS moves focus to buttons with Option+Tab, as Safari does by default.
    const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab'
    await page.locator('[data-month-control="2026-04"]').focus()
    for (const month of ['2026-05', '2026-06', '2026-07']) {
      await page.keyboard.press(tab)
      expect(await page.evaluate(() => document.activeElement?.getAttribute('data-month-control'))).toBe(month)
    }
    const tooltip = page.locator('[data-monthly-chart] [role="tooltip"][data-open]')
    await expect(tooltip).toContainText('julio')
    await expect(tooltip).toContainText('1.450 €')
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-month-control="2026-07"]')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-month-control="2026-09"]')).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('path[data-month-bar="2026-09"]')).toHaveAttribute('fill', 'var(--brand)')
    await page.keyboard.press('Escape')
    await expect(tooltip).toBeHidden()
    await page.locator('[data-month-control="2026-07"]').hover()
    await expect(page.locator('[data-monthly-chart] [role="tooltip"][data-open]')).toContainText('julio')
  })

  test('bar geometry: at most 24px thick, a 2px gap, a 44px hit area, one value label', async ({ page }) => {
    const bars = await page.locator('path[data-month-bar]').evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right, width: r.width })))
    // Sub-pixel rounding differs by engine (24.05 in Firefox).
    for (const bar of bars) expect(bar.width).toBeLessThanOrEqual(24.5)
    for (let i = 1; i < bars.length; i += 1) expect(bars[i].left - bars[i - 1].right).toBeGreaterThanOrEqual(2)
    const hits = await page.locator('[data-month-control]').evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().width))
    for (const hit of hits) expect(hit).toBeGreaterThanOrEqual(44)
    const labels = await page.locator('[data-monthly-chart] svg text').evaluateAll((nodes) => nodes.map((n) => n.textContent))
    expect(labels.filter((label) => label?.includes('mil'))).toHaveLength(1)
    await expect(page.locator('[data-monthly-chart] ul.sr-only li')).toHaveCount(6)
    await expect(page.locator('[data-monthly-chart] ul.sr-only')).toContainText('septiembre de 2026 · 1.700 €')
  })

  test('the donut legend carries amounts and shares, highlights on hover and Enter leads to the card', async ({ page }) => {
    await reveal(page, '[data-distribution-chart]')
    const comida = page.locator('[data-legend="comida"]')
    await expect(comida).toContainText('310 €')
    await expect(comida).toContainText('18 %')
    await expect(page.locator('[data-distribution-chart]')).toContainText('Total')
    const totals = await page.locator('[data-distribution-chart]').evaluate((el) => (el.textContent?.match(/1\.700\s€/g) ?? []).length)
    expect(totals).toBe(1)
    const donut = await page.locator('[data-donut]').evaluate((el) => el.getBoundingClientRect().width)
    expect(donut).toBeGreaterThanOrEqual(160)
    await comida.hover()
    await expect(page.locator('[data-donut-active]')).toContainText('Comida')
    await expect(page.locator('[data-donut-active]')).toContainText('310 €')
    await expect(page.locator('[data-slice="ocio"]')).toHaveAttribute('fill-opacity', '0.5')
    await expect(page.locator('[data-slice="comida"]')).toHaveAttribute('fill-opacity', '1')
    await page.mouse.move(2, 2)
    await expect(page.locator('[data-donut-active]')).toHaveAttribute('aria-hidden', 'true')
    await expect(page.locator('[data-slice="ocio"]')).toHaveAttribute('fill-opacity', '1')
    await page.locator('[data-legend="ocio"]').focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1500)
    const top = await page.locator('[aria-controls="category-panel-ocio"]').evaluate((el) => el.getBoundingClientRect().top)
    expect(top).toBeGreaterThanOrEqual(56)
  })

  test('no axe violation in either theme with the widgets revealed', async ({ page }) => {
    await reveal(page, '[data-distribution-chart]')
    // Evaluated through the driver rather than injected as a tag, so no page policy gets in the way.
    await page.evaluate(readFileSync('node_modules/axe-core/axe.min.js', 'utf8'))
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme)
      await page.waitForTimeout(300)
      const violations = await page.evaluate(async () => {
        // @ts-expect-error axe is attached by the evaluated source above
        const result = await window.axe.run(document.querySelector('[data-dashboard-page]'), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })
        // The category cards' budget bars predate this change and carry no accessible name
        // (CLAUDE.md → Deuda técnica); everything the widgets add must be clean.
        return result.violations.filter((v) => v.id !== 'aria-progressbar-name').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
      })
      expect(violations, theme).toEqual([])
    }
  })

  test('visible text at 390px collapsed uses at most six font sizes and no category colour', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 0))
    const sizes = await page.evaluate(() => {
      const set = new Set()
      for (const el of document.querySelectorAll('body *')) {
        if (!el.textContent?.trim() || el.children.length || el.closest('.sr-only')) continue
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden') continue
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        set.add(cs.fontSize)
      }
      return [...set]
    })
    expect(sizes.length).toBeLessThanOrEqual(6)
    const categoryColoured = await page.evaluate(() => {
      const dots = [...document.querySelectorAll('[data-category-dot]')].map((d) => getComputedStyle(d).backgroundColor)
      return [...document.querySelectorAll('[data-weekly-top] *, [data-distribution-chart] *')].filter((el) => el.children.length === 0 && el.textContent?.trim() && dots.includes(getComputedStyle(el).color)).length
    })
    expect(categoryColoured).toBe(0)
  })
})
