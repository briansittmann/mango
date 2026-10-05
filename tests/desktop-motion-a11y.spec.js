// @ts-check
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { loadDesktop, sideSheet, visibleBackdrops, widgetOrder } from './desktop-helpers'
import { reveal } from './widgets-helpers'

// `design-system` → *Motion respects user preference* (shell, side panels, widget list) and
// *Translucent materials* (the laptop allow-lists), plus axe and the six-size rule at 1280px.

test.describe('reduced motion', () => {
  test('the shell floats in the first frame after a scroll, the highlight lands on "ocio" at once, the sheet is at rest', async ({ page }) => {
    await loadDesktop(page)
    const shell = await page.evaluate(
      () =>
        new Promise((resolve) => {
          window.scrollTo(0, 200)
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const sidebar = /** @type {Element} */ (document.querySelector('[data-desktop-sidebar]'))
              const material = /** @type {Element} */ (sidebar.querySelector('[data-shell-material]'))
              const rest = /** @type {Element} */ (sidebar.querySelector('.shell-rest'))
              resolve({
                floating: sidebar.hasAttribute('data-floating'),
                materialOpacity: getComputedStyle(material).opacity,
                materialTransition: getComputedStyle(material).transitionProperty,
                restTransition: getComputedStyle(rest).transitionProperty,
              })
            }),
          )
        }),
    )
    expect(shell).toEqual({ floating: true, materialOpacity: '1', materialTransition: 'none', restTransition: 'none' })
    await page.locator('[data-shell-nav="categoria-ocio"]').click()
    const highlight = await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => {
            const pill = /** @type {HTMLElement} */ (document.querySelector('[data-shell-nav-pill]'))
            const link = /** @type {HTMLElement} */ (document.querySelector('[data-shell-nav="categoria-ocio"]'))
            resolve({
              pillY: Math.round(new DOMMatrixReadOnly(getComputedStyle(pill).transform).m42),
              linkTop: /** @type {HTMLElement} */ (link.parentElement).offsetTop,
              transition: getComputedStyle(pill).transitionProperty,
              current: document.querySelector('[data-shell-nav][aria-current]')?.getAttribute('data-shell-nav'),
            })
          }),
        ),
    )
    expect(highlight.transition).toBe('none')
    expect(highlight.current).toBe('categoria-ocio')
    expect(highlight.pillY).toBe(highlight.linkTop)
    await page.locator('[data-category-options="ocio"]').click()
    const sheet = await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => {
            const el = /** @type {Element} */ (document.querySelector('div[role="dialog"][data-open]'))
            resolve(getComputedStyle(el).translate)
          }),
        ),
    )
    expect(['none', '0px', '0px 0px']).toContain(sheet)
  })

  test('a keyboard move puts the calendar and the widget it passed in their new positions in the first frame', async ({ page }) => {
    await loadDesktop(page)
    const grip = page.locator('[data-widget-grip="calendar"]')
    await grip.scrollIntoViewIfNeeded()
    await grip.focus()
    await page.keyboard.press('ArrowDown')
    const frame = await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => {
            const items = [...document.querySelectorAll('[data-widget-list] [data-widget]')]
            resolve({
              order: items.map((el) => el.getAttribute('data-widget')),
              transforms: items.map((el) => getComputedStyle(el).transform),
            })
          }),
        ),
    )
    expect(frame.order).toEqual(['weekly', 'monthly', 'calendar', 'distribution'])
    for (const transform of frame.transforms) expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform)
  })
})

test.describe('motion on', () => {
  test('a dragged donut moves the widgets it passes over successive frames and settles after release', async ({ page }) => {
    await loadDesktop(page, { reduced: false, height: 1800 })
    const grip = page.locator('[data-widget-grip="distribution"]')
    await grip.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    const from = await grip.evaluate((el) => el.getBoundingClientRect())
    const first = await page.locator('[data-widget-list] [data-widget]').first().evaluate((el) => el.getBoundingClientRect())
    // A frame-by-frame recorder inside the page, so the sample does not depend on the driver's round trips.
    await page.evaluate(() => {
      const el = /** @type {Element} */ (document.querySelector('[data-widget="monthly"]'))
      const ys = []
      // @ts-expect-error scratch state for this test
      window.__ys = ys
      const tick = () => {
        ys.push(Math.round(new DOMMatrixReadOnly(getComputedStyle(el).transform).m42))
        // @ts-expect-error scratch state for this test
        if (!window.__stop) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    await page.mouse.move(from.left + 10, from.top + 10)
    await page.mouse.down()
    for (let i = 1; i <= 24; i += 1) {
      await page.mouse.move(from.left + 10, from.top + 10 + ((first.top - 40 - from.top) * i) / 24)
      await page.waitForTimeout(20)
    }
    await page.waitForTimeout(400)
    // @ts-expect-error scratch state for this test
    const ys = await page.evaluate(() => ((window.__stop = true), window.__ys))
    // The passed widget travels: several distinct in-between positions, not a jump.
    expect(new Set(ys).size).toBeGreaterThan(3)
    await page.mouse.up()
    const donutY = () => page.locator('[data-widget="distribution"]').evaluate((el) => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m42))
    const afterRelease = await donutY()
    // It travels to rest rather than jumping: still away from rest right after release, at rest soon after.
    expect(afterRelease).toBeGreaterThan(1)
    await expect.poll(donutY, { timeout: 2500 }).toBeLessThanOrEqual(1)
    expect(await widgetOrder(page)).toEqual(['distribution', 'weekly', 'calendar', 'monthly'])
  })
})

test.describe('materials and accessibility at 1280px', () => {
  test('backdrop allow-lists: none at rest, the two shell materials floating, the panel and its scrim with a sheet, the menu alone', async ({ page }) => {
    await loadDesktop(page)
    expect(await visibleBackdrops(page)).toEqual([])
    await page.evaluate(() => window.scrollTo(0, 200))
    await page.waitForTimeout(300)
    expect((await visibleBackdrops(page)).sort()).toEqual(['shell-material', 'shell-material'])
    await page.locator('#category-panel-comida').getByRole('button', { name: 'Añadir gasto' }).click()
    await expect(sideSheet(page)).toBeVisible()
    await page.waitForTimeout(300)
    expect((await visibleBackdrops(page)).sort()).toEqual(['popup:side', 'sheet-backdrop'])
    await page.keyboard.press('Escape')
    await expect(sideSheet(page)).toBeHidden()
    await page.waitForTimeout(400)
    await page.locator('[data-sidebar-account]').click()
    await page.waitForTimeout(300)
    expect(await visibleBackdrops(page)).toEqual(['account-menu'])
  })

  test('no axe violation in either theme with the shell, the tiles and the widgets', async ({ page }) => {
    await loadDesktop(page)
    await reveal(page, '[data-distribution-chart]')
    await page.evaluate(readFileSync('node_modules/axe-core/axe.min.js', 'utf8'))
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme)
      await page.waitForTimeout(300)
      const violations = await page.evaluate(async () => {
        // @ts-expect-error axe is attached by the evaluated source above
        const result = await window.axe.run(document.body, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })
        // The category cards' budget bars predate this change and carry no accessible name (CLAUDE.md → Deuda técnica).
        return result.violations.filter((v) => v.id !== 'aria-progressbar-name').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
      })
      expect(violations, theme).toEqual([])
    }
  })

  test('visible text at 1280px uses at most six font sizes', async ({ page }) => {
    await loadDesktop(page)
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
  })
})
