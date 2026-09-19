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

async function thumbTranslateX(thumb) {
  // Tailwind v4 sets the standalone CSS `translate` property for `translate-x-*`, not `transform`
  // (confirmed in task 6.1's own verification), so read that instead of parsing a transform matrix.
  return thumb.evaluate((el) => {
    const translate = getComputedStyle(el).translate
    if (!translate || translate === 'none') return 0
    return parseFloat(translate.split(' ')[0])
  })
}

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

    const sw = sheet.getByRole('switch', { name: 'Se repite todos los meses' })
    await sw.click()
    const justAfter = await sheetRect(sheet)
    await page.waitForTimeout(260)
    const settled = await sheetRect(sheet)

    expect(settled.height).toBeGreaterThan(before.height + 20)
    expect(Math.abs(justAfter.height - settled.height)).toBeLessThanOrEqual(1)
  })

  test('reduced motion: the definition sheet is at rest in the first frame', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/demo')
    await page.locator('button[aria-controls="upcoming-charges-panel"]').click()
    const row = page.locator('#upcoming-charges-panel').getByRole('button', { name: /^Alquiler ·/ })
    await row.click()
    const sheet = dialog(page)
    await expect(sheet).toBeVisible()

    const justAfter = await sheetRect(sheet)
    await page.waitForTimeout(600)
    const settled = await sheetRect(sheet)
    expect(Math.abs(justAfter.top - settled.top)).toBeLessThanOrEqual(1)
  })

  test('without reduced motion, the switch thumb and the revealed field animate over frames', async ({ page }) => {
    const sheet = await openEntrySheetOnTransporte(page)
    const before = await sheetRect(sheet)

    const sw = sheet.getByRole('switch', { name: 'Se repite todos los meses' })
    const thumb = sw.locator('[class*="size-5"]')
    await sw.click()
    const midHeight = (await sheetRect(sheet)).height
    // `--ease-spring` overshoots before settling, so two close samples during the transition are
    // compared for any change rather than assumed to grow monotonically toward the resting value.
    const x1 = await thumbTranslateX(thumb)
    await page.waitForTimeout(40)
    const x2 = await thumbTranslateX(thumb)
    await page.waitForTimeout(300)
    const settled = await sheetRect(sheet)
    const settledX = await thumbTranslateX(thumb)

    expect(settled.height).toBeGreaterThan(before.height + 20)
    expect(midHeight).toBeLessThan(settled.height - 2)
    expect(x1).not.toBe(x2)
    expect(settledX).toBeCloseTo(20, 0)
  })

  test('without reduced motion, the definition sheet slides in over frames', async ({ page }) => {
    await page.goto('/demo')
    await page.locator('button[aria-controls="upcoming-charges-panel"]').click()
    const row = page.locator('#upcoming-charges-panel').getByRole('button', { name: /^Alquiler ·/ })
    await row.click()
    const sheet = dialog(page)
    await expect(sheet).toBeVisible()

    const early = await sheetRect(sheet)
    await page.waitForTimeout(150)
    const mid = await sheetRect(sheet)
    await page.waitForTimeout(500)
    const settled = await sheetRect(sheet)

    expect(Math.abs(early.top - settled.top)).toBeGreaterThan(20)
    expect(Math.abs(mid.top - settled.top)).toBeGreaterThan(2)
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
