// Captures the onboarding screens of this folder (add-web-onboarding 10.1): `node docs/prototipos/onboarding/capturar.mjs` with the dev server on :3000.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const out = 'docs/prototipos/onboarding'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch()

const shots = [
  { name: 'paso-1-bienvenida', query: 'paso=1&e2eSeed=1' },
  { name: 'paso-2-datos', query: 'paso=2&e2eSeed=1' },
  { name: 'paso-3-categorias', query: 'paso=3&e2eSeed=1' },
  { name: 'paso-4-fijos', query: 'paso=4&e2eSeed=1' },
  { name: 'paso-5-presupuestos', query: 'paso=5&e2eSeed=1' },
  { name: 'paso-5-presupuestos-argentina-abreviado', query: 'paso=5&e2eSeed=1&pais=AR&formato=abreviado', budget: '300000' },
  { name: 'paso-6-ahorro', query: 'paso=6&e2eSeed=1' },
  { name: 'paso-7-whatsapp', query: 'paso=7&e2eSeed=1&pais=AR' },
]

for (const theme of ['light', 'dark']) {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 800 },
      timezoneId: 'Europe/Dublin',
      colorScheme: theme,
      reducedMotion: 'reduce',
    })
    await context.addInitScript((t) => {
      try {
        localStorage.setItem('theme', t)
      } catch {}
    }, theme)
    const page = await context.newPage()
    for (const shot of shots) {
      await page.goto(`http://localhost:3000/demo/onboarding?${shot.query}`)
      await page.waitForSelector('[data-primary]')
      if (shot.budget) {
        await page.getByLabel('Presupuesto de Comida').fill(shot.budget)
        await page.getByLabel('Presupuesto de Comida').press('Enter')
      }
      await page.waitForTimeout(600)
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      if (scrollWidth > width) console.log('HORIZONTAL SCROLL', shot.name, theme, width, scrollWidth)
      await page.screenshot({ path: `${out}/${shot.name}-${width}-${theme}.png`, fullPage: width === 390 })
    }
    await context.close()
  }
}
await browser.close()
console.log('done')
