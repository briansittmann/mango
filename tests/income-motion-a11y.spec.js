// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

async function setTheme(page, theme) {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('theme', t)
    } catch {}
  }, theme)
}

async function openIncomePanel(page) {
  await page.goto('/demo')
  await page.getByRole('button', { name: /^Ingresos/ }).click()
}

/** WCAG contrast check, identical to recurring-motion-a11y.spec.js's `CONTRAST_CHECK`. */
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

test.describe('income rows and add row: reduced motion', () => {
  test('the add row badge does not grow and its plus does not rotate on hover', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openIncomePanel(page)

    const addRow = page.locator('#summary-group-panel').getByRole('button', { name: 'Añadir ingreso' })
    const badge = addRow.locator('span').first()
    const plus = badge.locator('svg')

    const before = await badge.evaluate((el) => getComputedStyle(el).transform)
    const plusBefore = await plus.evaluate((el) => getComputedStyle(el).transform)

    await addRow.hover()
    await page.waitForTimeout(500)

    const after = await badge.evaluate((el) => getComputedStyle(el).transform)
    const plusAfter = await plus.evaluate((el) => getComputedStyle(el).transform)

    expect(after).toBe(before)
    expect(plusAfter).toBe(plusBefore)
  })
})

for (const theme of /** @type {const} */ (['light', 'dark'])) {
  test.describe(`income panel contrast in ${theme}`, () => {
    test('the income panel reaches 4.5:1', async ({ page }) => {
      await setTheme(page, theme)
      await openIncomePanel(page)

      const result = await page.evaluate(CONTRAST_CHECK, '#summary-group-panel')
      expect(result.error).toBeUndefined()
      expect(result.checked).toBeGreaterThan(0)
      expect(result.failures).toEqual([])
    })
  })
}
