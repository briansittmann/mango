// @ts-check

/** Shared steps for the desktop shell specs (`desktop-shell`, `dashboard-ui`, `design-system`), on `/demo`. */

export const SIDEBAR_WIDTH = 272
export const TOP_BAR_HEIGHT = 88
/** The reading line: the bar plus the 16px every section target scrolls to (design D3). */
export const READING_LINE = 104

/**
 * Loads `/demo` at a desktop size. Reduced motion by default, so geometry is read at rest; pass
 * `reduced: false` for the motion scenarios.
 */
export async function loadDesktop(page, { width = 1280, height = 900, reduced = true, theme = 'light', path = '/demo' } = {}) {
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' })
  await page.setViewportSize({ width, height })
  // Stored before the load, so the theme script applies it at hydration instead of overwriting a
  // later attribute with its default (the slower engines hydrate after the first paint).
  await page.addInitScript((theme) => {
    try {
      localStorage.setItem('theme', theme)
    } catch {}
  }, theme)
  await page.goto(path)
  await page.waitForSelector('[data-weekly-top]', { state: 'attached' })
  await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme)
  await page.waitForTimeout(reduced ? 600 : 1400)
}

export function rect(page, selector) {
  return page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) }
  })
}

/** Elements with a blur that are actually on screen, named for the allow-list assertions. */
export function visibleBackdrops(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((e) => getComputedStyle(e).backdropFilter !== 'none')
      .filter((e) => {
        const cs = getComputedStyle(e)
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false
        if (e.closest('[hidden], [inert]')) return false
        const r = e.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
      .map((e) => {
        if (e.hasAttribute('data-shell-material')) return 'shell-material'
        if (e.hasAttribute('data-sheet-backdrop')) return 'sheet-backdrop'
        if (e.getAttribute('data-presentation')) return `popup:${e.getAttribute('data-presentation')}`
        if (e.id === 'account-menu') return 'account-menu'
        return e.className.toString().slice(0, 40)
      }),
  )
}

export function widgetOrder(page) {
  return page.locator('[data-widget-list] [data-widget]').evaluateAll((els) => els.map((e) => e.getAttribute('data-widget')))
}

export function sideSheet(page) {
  return page.locator('div[role="dialog"][data-open]')
}

export function activeSection(page) {
  return page.evaluate(() => document.querySelector('[data-shell-nav][aria-current]')?.getAttribute('data-shell-nav') ?? null)
}

/** WCAG relative luminance of an `rgb(...)` / `rgba(...)` string. */
export function luminance(rgb) {
  const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => {
    const c = Number(v) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** `over` (rgba with alpha) composited onto `under` (opaque), as an `rgb(...)` string. */
export function composite(over, under) {
  const [r1, g1, b1, a = 1] = over.match(/[\d.]+/g).map(Number)
  const [r2, g2, b2] = under.match(/[\d.]+/g).map(Number)
  const mix = (x, y) => Math.round(x * a + y * (1 - a))
  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`
}

/**
 * The element's translation in px, from the `translate` property (Tailwind's translate utilities)
 * or, failing that, from `transform` (motion's drag). `{ x: 0, y: 0 }` at rest.
 */
export function translateOf(page, selector) {
  return page.locator(selector).first().evaluate((el) => {
    const cs = getComputedStyle(el)
    if (cs.translate && cs.translate !== 'none') {
      const [x = '0', y = '0'] = cs.translate.split(' ')
      return { x: Math.round(parseFloat(x)), y: Math.round(parseFloat(y)) }
    }
    const m = new DOMMatrixReadOnly(cs.transform)
    return { x: Math.round(m.m41), y: Math.round(m.m42) }
  })
}
