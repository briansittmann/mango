// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

function dialog(page) {
  return page.locator('div[role="dialog"][data-open]')
}

async function setTheme(page, theme) {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('theme', t)
    } catch {}
  }, theme)
}

async function openEntrySheetOnTransporte(page) {
  await page.goto('/demo')
  await page.locator('button[aria-controls="category-panel-transporte"]').click()
  await page.locator('#category-panel-transporte').getByRole('button', { name: 'Añadir gasto' }).click()
  return dialog(page)
}

async function openDefinitionSheet(page, name) {
  await page.goto('/demo')
  await page.locator('button[aria-controls="upcoming-charges-panel"]').click()
  const row = page.locator('#upcoming-charges-panel').getByRole('button', { name: new RegExp(`^${name} ·`) })
  await row.click()
  return { sheet: dialog(page), row }
}

async function sheetRect(sheet) {
  return sheet.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, height: r.height }
  })
}

/** Records each target on every animation frame, from inside the page, for `ms`.
 *
 * Sampling from the test side instead means every read pays a Playwright IPC round trip, and under
 * parallel load two consecutive reads can straddle a whole 500ms transition — which is exactly how
 * the first version of these tests passed alone and failed in the full suite. The browser collects
 * the series itself here, so load changes how many frames land, never whether any land mid-flight.
 *
 * The window has to outlast the click that triggers the transition, not just the transition: a row
 * click can take a second on its own, because Playwright waits for the panel that just expanded to
 * stop moving before it will click anything inside it. Static frames on either side are harmless —
 * every assertion is about how many *distinct* values the series holds, not how long it is.
 *
 * `translateX` reads the standalone CSS `translate` property, which is what Tailwind v4 sets for
 * `translate-x-*` rather than `transform` (confirmed in task 6.1's own verification).
 */
async function startSampling(page, targets, ms = 4000) {
  await page.evaluate(
    ({ targets, ms }) => {
      const series = {}
      for (const target of targets) series[target.name] = []
      window.__motionSamples = series
      const deadline = performance.now() + ms
      const tick = () => {
        for (const target of targets) {
          const el = document.querySelector(target.selector)
          if (!el) continue
          if (target.prop === 'translateX') {
            const translate = getComputedStyle(el).translate
            series[target.name].push(!translate || translate === 'none' ? 0 : parseFloat(translate.split(' ')[0]))
          } else {
            const rect = el.getBoundingClientRect()
            series[target.name].push(Math.round((target.prop === 'top' ? rect.top : rect.height) * 100) / 100)
          }
        }
        if (performance.now() < deadline) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    },
    { targets, ms },
  )
}

async function collectSamples(page, ms = 950) {
  await page.waitForTimeout(ms)
  return page.evaluate(() => window.__motionSamples)
}

const distinct = (values) => new Set(values).size
const last = (values) => values[values.length - 1]

const OPEN_SHEET = 'div[role="dialog"][data-open]'
const SWITCH_THUMB = `${OPEN_SHEET} [role="switch"] > span > span`

/** WCAG contrast check over every element in `containerSelector` that carries its own text node,
 * compositing translucent backgrounds up the ancestor chain onto an opaque white backdrop. */
const CONTRAST_CHECK = (containerSelector) => {
  function parseColor(str) {
    const m = str && str.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const parts = m[1].split(',').map((s) => parseFloat(s))
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 }
  }
  function over(fg, bg) {
    const a = fg.a
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 }
  }
  function effectiveBackground(el) {
    const chain = []
    for (let n = el; n; n = n.parentElement) chain.push(n)
    chain.reverse()
    let acc = { r: 255, g: 255, b: 255, a: 1 }
    for (const node of chain) {
      const bg = parseColor(getComputedStyle(node).backgroundColor)
      if (bg && bg.a > 0) acc = over(bg, acc)
    }
    return acc
  }
  function relLum({ r, g, b }) {
    const chan = (c) => {
      c /= 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)
  }
  function ratio(c1, c2) {
    const l1 = relLum(c1)
    const l2 = relLum(c2)
    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)
  }

  const container = document.querySelector(containerSelector)
  if (!container) return { error: `not found: ${containerSelector}` }
  const failures = []
  let checked = 0
  container.querySelectorAll('*').forEach((el) => {
    if (el.closest('[aria-hidden="true"]')) return
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return
    const hasOwnText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 0)
    if (!hasOwnText) return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const fg = parseColor(style.color)
    if (!fg) return
    checked += 1
    const bg = effectiveBackground(el)
    const fgOpaque = over(fg, bg)
    const r = ratio(fgOpaque, bg)
    if (r < 4.45) {
      failures.push({ text: el.textContent.trim().slice(0, 40), ratio: Math.round(r * 100) / 100 })
    }
  })
  return { checked, failures }
}

test.describe('recurring motion', () => {
  test('reduced motion: switch and its revealed field are final in the first frame', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const sheet = await openEntrySheetOnTransporte(page)
    const before = await sheetRect(sheet)

    await startSampling(page, [
      { name: 'height', selector: OPEN_SHEET, prop: 'height' },
      { name: 'thumb', selector: SWITCH_THUMB, prop: 'translateX' },
    ])
    await sheet.getByRole('switch', { name: 'Se repite todos los meses' }).click()
    const samples = await collectSamples(page)

    // Only two values ever exist: before the toggle and after it. No frame lands in between.
    expect(distinct(samples.height)).toBeLessThanOrEqual(2)
    expect(distinct(samples.thumb)).toBeLessThanOrEqual(2)
    expect(last(samples.height)).toBeGreaterThan(before.height + 20)
    expect(last(samples.thumb)).toBeCloseTo(20, 0)
  })

  test('reduced motion: the definition sheet is at rest in the first frame', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/demo')
    await page.locator('button[aria-controls="upcoming-charges-panel"]').click()

    await startSampling(page, [{ name: 'top', selector: OPEN_SHEET, prop: 'top' }])
    await page.locator('#upcoming-charges-panel').getByRole('button', { name: /^Alquiler ·/ }).click()
    const samples = await collectSamples(page)

    // Two positions at most, and nothing in between: the off-screen offset the panel mounts at for
    // a frame or two (base-ui applies the starting style, then drops it) and the resting position it
    // snaps to. An animated open fills the gap between those two with intermediate positions; with
    // `transition: none` the panel is simply never painted anywhere but off-screen or at rest.
    expect(samples.top.length).toBeGreaterThan(3)
    expect(distinct(samples.top)).toBeLessThanOrEqual(2)
    expect(last(samples.top)).toBe(Math.min(...samples.top))
  })

  test('without reduced motion, the switch thumb and the revealed field animate over frames', async ({ page }) => {
    const sheet = await openEntrySheetOnTransporte(page)
    const before = await sheetRect(sheet)

    await startSampling(page, [
      { name: 'height', selector: OPEN_SHEET, prop: 'height' },
      { name: 'thumb', selector: SWITCH_THUMB, prop: 'translateX' },
    ])
    await sheet.getByRole('switch', { name: 'Se repite todos los meses' }).click()
    const samples = await collectSamples(page)

    // Intermediate values exist, so both travelled rather than jumping. `--ease-spring` overshoots
    // before settling, so the series is checked for intermediate frames, not for monotonic growth.
    expect(distinct(samples.height)).toBeGreaterThanOrEqual(3)
    expect(distinct(samples.thumb)).toBeGreaterThanOrEqual(3)
    expect(last(samples.height)).toBeGreaterThan(before.height + 20)
    expect(last(samples.thumb)).toBeCloseTo(20, 0)
  })

  test('without reduced motion, the definition sheet slides in over frames', async ({ page }) => {
    await page.goto('/demo')
    await page.locator('button[aria-controls="upcoming-charges-panel"]').click()

    await startSampling(page, [{ name: 'top', selector: OPEN_SHEET, prop: 'top' }])
    await page.locator('#upcoming-charges-panel').getByRole('button', { name: /^Alquiler ·/ }).click()
    const samples = await collectSamples(page)

    expect(distinct(samples.top)).toBeGreaterThanOrEqual(3)
    // It comes up from below, so the first frames sit lower on screen than the resting position.
    expect(Math.max(...samples.top)).toBeGreaterThan(last(samples.top))
  })
})

test.describe('definition sheet geometry', () => {
  test('rows are 48px and the switch hit area is 44 x 44', async ({ page }) => {
    const { sheet } = await openDefinitionSheet(page, 'Alquiler')
    await expect(sheet).toBeVisible()

    const rows = await sheet.evaluate((el) => {
      const heights = []
      el.querySelectorAll('.min-h-row').forEach((node) => heights.push(node.getBoundingClientRect().height))
      el.querySelectorAll('.min-h-14').forEach((node) => heights.push(node.getBoundingClientRect().height))
      return heights
    })
    expect(rows.length).toBeGreaterThan(0)
    for (const height of rows) expect(height).toBeGreaterThanOrEqual(47)

    const switchBox = await sheet.getByRole('switch', { name: 'Recordatorio' }).boundingBox()
    expect(switchBox?.width).toBeGreaterThanOrEqual(43)
    expect(switchBox?.height).toBeGreaterThanOrEqual(43)
  })
})

for (const theme of /** @type {const} */ (['light', 'dark'])) {
  test.describe(`contrast in ${theme}`, () => {
    test(`the "Próximos cobros" card reaches 4.5:1`, async ({ page }) => {
      await setTheme(page, theme)
      await page.goto('/demo')
      await page.locator('button[aria-controls="upcoming-charges-panel"]').click()
      await expect(page.locator('#upcoming-charges-panel')).toBeVisible()

      // The open modal sheet marks the rest of the page aria-hidden (base-ui's `markOthers`),
      // which would zero out this check, so the card is read before any sheet is opened.
      const cardResult = await page.evaluate(CONTRAST_CHECK, '#upcoming-charges-panel')
      expect(cardResult.error).toBeUndefined()
      expect(cardResult.checked).toBeGreaterThan(0)
      expect(cardResult.failures).toEqual([])
    })

    test('the definition sheet reaches 4.5:1', async ({ page }) => {
      await setTheme(page, theme)
      const { sheet } = await openDefinitionSheet(page, 'Alquiler')
      await expect(sheet).toBeVisible()
      // The reminder switch reveals the "Días antes" field, which is otherwise not on screen.
      await sheet.getByRole('switch', { name: 'Recordatorio' }).click()

      const sheetResult = await page.evaluate(CONTRAST_CHECK, 'div[role="dialog"][data-open]')
      expect(sheetResult.error).toBeUndefined()
      expect(sheetResult.checked).toBeGreaterThan(0)
      expect(sheetResult.failures).toEqual([])
    })
  })
}
