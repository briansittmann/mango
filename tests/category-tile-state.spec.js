// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

function tile(page) {
  return page.getByRole('button', { name: 'Añadir categoría' })
}

async function setTheme(page, theme) {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('theme', t)
    } catch {}
  }, theme)
}

test.describe('the add-category tile', () => {
  test('is absent during reorder mode and comes back after', async ({ page }) => {
    await page.goto('/demo')
    await expect(tile(page)).toBeVisible()

    await page.getByRole('button', { name: /^Opciones de Comida$/ }).click()
    await page.getByRole('button', { name: /^Reordenar/ }).click()
    await expect(tile(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Listo' }).click()
    await expect(tile(page)).toBeVisible()
  })

  test('is disabled when the mounting page supplies no category operations', async ({ page }) => {
    await page.goto('/demo?e2eNoCategoryActions=1')
    await expect(tile(page)).toBeVisible()
    await expect(tile(page)).toBeDisabled()
  })
})

for (const theme of /** @type {const} */ (['light', 'dark'])) {
  test.describe(`the add-category tile at rest in ${theme}`, () => {
    test('the label and icon reach contrast and the border reads against the background', async ({ page }) => {
      await setTheme(page, theme)
      await page.goto('/demo')

      const result = await tile(page).evaluate((el) => {
        // The design tokens resolve to `lab()`/`oklab()`, which a regex can't parse — rasterizing
        // onto a 1x1 canvas forces the browser to resolve any CSS colour space into sRGB bytes.
        const probe = document.createElement('canvas').getContext('2d')
        function parseColor(str) {
          if (!str) return null
          probe.clearRect(0, 0, 1, 1)
          probe.fillStyle = str
          probe.fillRect(0, 0, 1, 1)
          const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data
          return { r, g, b, a: a / 255 }
        }
        function over(fg, bg) {
          const a = fg.a
          return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 }
        }
        function effectiveBackground(node) {
          const chain = []
          for (let n = node; n; n = n.parentElement) chain.push(n)
          chain.reverse()
          let acc = { r: 255, g: 255, b: 255, a: 1 }
          for (const n of chain) {
            const bg = parseColor(getComputedStyle(n).backgroundColor)
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
          return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
        }

        const background = effectiveBackground(el.parentElement ?? el)
        const labelColor = parseColor(getComputedStyle(el).color)
        const labelRatio = labelColor ? ratio(over(labelColor, background), background) : null
        const borderColor = parseColor(getComputedStyle(el).borderTopColor)
        const borderDelta = borderColor ? Math.abs(relLum(over(borderColor, background)) - relLum(background)) : 0
        return { labelRatio, borderDelta }
      })

      expect(result.labelRatio).not.toBeNull()
      expect(result.labelRatio).toBeGreaterThanOrEqual(4.45)
      expect(result.borderDelta).toBeGreaterThan(0.02)
    })
  })
}
