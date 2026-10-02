// @ts-check
import { test, expect } from '@playwright/test'
import { body } from './onboarding-helpers.js'

test.use({ viewport: { width: 390, height: 844 } })

// `onboarding` → *Budgets step with the live free margin*, on `/demo/onboarding?paso=5&e2eSeed=1`:
// Sueldo 2 000, Alquiler 820 in Vivienda, Comida with nothing.

function margin(page) {
  return expect.poll(() => body(page))
}

/** `[translateX, scaleX]` of every segment of the envelope bar, left to right. */
function segments(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-envelope-bar] [data-segment]')).map((el) => {
      const style = /** @type {HTMLElement} */ (el).style.transform
      const translate = Number(/translateX\(([-\d.]+)%\)/.exec(style)?.[1])
      const scale = Number(/scaleX\(([-\d.]+)\)/.exec(style)?.[1])
      return { id: el.getAttribute('data-segment'), translate, scale }
    }),
  )
}

test('the margin moves as budgets are typed, before any field is left', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=5&e2eSeed=1')
  await margin(page).toMatch(/Margen libre\s*1\.180\s?€/)

  const comida = page.getByLabel('Presupuesto de Comida')
  const vivienda = page.getByLabel('Presupuesto de Vivienda')
  await comida.fill('300')
  await margin(page).toMatch(/Margen libre\s*880\s?€/)
  await vivienda.fill('820')
  await margin(page).toMatch(/Margen libre\s*880\s?€/)
  await vivienda.fill('900')
  await margin(page).toMatch(/Margen libre\s*800\s?€/)
  await comida.fill('')
  await margin(page).toMatch(/Margen libre\s*1\.100\s?€/)
})

test('the bar splits the spending by category: Vivienda 820 of 1 120, Comida 300 of 1 120', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=5&e2eSeed=1')
  // Only Vivienda spends (its 820 fixed): one segment, the whole bar. Polled: the page may still be mounting.
  await expect.poll(async () => (await segments(page)).length).toBe(1)
  let bar = await segments(page)
  expect(bar[0].scale).toBeCloseTo(1, 5)

  await page.getByLabel('Presupuesto de Comida').fill('300')
  await margin(page).toMatch(/Margen libre\s*880\s?€/)
  bar = await segments(page)
  expect(bar).toHaveLength(2)
  expect(bar.map((segment) => segment.id)).not.toContain('margin')
  expect(bar[0].translate).toBeCloseTo(0, 5)
  expect(bar[0].scale).toBeCloseTo(820 / 1120, 5)
  expect(bar[1].translate).toBeCloseTo((820 / 1120) * 100, 2)
  expect(bar[1].scale).toBeCloseTo(300 / 1120, 5)
})

test('a line above the fields says budgets are optional; it is absent without categories', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=5&e2eSeed=1')
  await expect(page.locator('[data-budgets-hint]')).toHaveText(
    'Ponle presupuesto solo a lo que quieras vigilar, como la comida o las salidas. El resto puede quedar vacío.',
  )
  await page.goto('/demo/onboarding?paso=5')
  await expect(page.locator('[data-budgets-hint]')).toHaveCount(0)
})

test('a typed budget opens the dashboard card bar: spent of budget and what is left', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=5&e2eSeed=1')
  // The budget bars, not the step's own progress line at the top.
  const bars = page.locator('[data-budget-progress] [role="progressbar"]')
  const vivienda = page.locator('[data-budget-progress]').first()
  const comida = page.locator('[data-budget-progress]').last()
  await expect(bars).toHaveCount(0)

  // Vivienda: its fixed 820 is what it has spent so far.
  await page.getByLabel('Presupuesto de Vivienda').fill('900')
  await expect(bars).toHaveCount(1)
  await expect(vivienda).toContainText(/820\s?€\s*de 900\s?€/)
  await expect(vivienda).toContainText(/Te quedan/)

  // Comida, nothing fixed: 0 of 300.
  await page.getByLabel('Presupuesto de Comida').fill('300')
  await expect(bars).toHaveCount(2)
  await expect(comida).toContainText(/0\s?€\s*de 300\s?€/)

  // Cleared, the bar goes away.
  await page.getByLabel('Presupuesto de Comida').fill('')
  await expect(bars).toHaveCount(1)
})

test('over the income: a negative number in the destructive colour and no remainder segment', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=5&e2eSeed=1')
  await page.getByLabel('Presupuesto de Comida').fill('1500')
  await margin(page).toMatch(/Margen libre\s*-320\s?€/)
  await expect(page.locator('[data-hero]')).toHaveClass(/hero-card--negative/)
  const bar = await segments(page)
  expect(bar.map((segment) => segment.id)).not.toContain('margin')
  expect(bar.reduce((sum, segment) => sum + segment.scale, 0)).toBeCloseTo(1, 5)
})

// The painted colour, not just the class: the onboarding's own rule once kept the number green below zero.
for (const scheme of ['dark', 'light']) {
  test(`the number is painted red below zero and green above it (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.addInitScript((theme) => localStorage.setItem('theme', theme), scheme)
    await page.goto('/demo/onboarding?paso=5&e2eSeed=1')
    const tokens = await page.evaluate(() => {
      const probe = document.createElement('span')
      document.body.append(probe)
      const read = (value) => {
        probe.style.color = value
        return getComputedStyle(probe).color
      }
      const result = { red: read('var(--destructive-ink)'), green: read('var(--brand-ink)') }
      probe.remove()
      return result
    })
    const value = page.locator('[data-hero] .hero-value')
    await expect(value).toHaveCSS('color', tokens.green)
    await page.getByLabel('Presupuesto de Comida').fill('1500')
    await expect(value).toHaveCSS('color', tokens.red)
    await page.getByLabel('Presupuesto de Comida').fill('')
    await expect(value).toHaveCSS('color', tokens.green)
  })
}

test('an invalid budget shows the sheet message, stores nothing and counts as empty', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=5&e2eSeed=1')
  const comida = page.getByLabel('Presupuesto de Comida')
  await comida.fill('12,345')
  await margin(page).toMatch(/Margen libre\s*1\.180\s?€/)
  await comida.blur()
  await expect(page.getByText('Introduce un importe mayor que 0 con hasta 2 decimales')).toBeVisible()
  await margin(page).toMatch(/Margen libre\s*1\.180\s?€/)
})

test('a committed budget stays after leaving the field and moving on', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=5&e2eSeed=1')
  const comida = page.getByLabel('Presupuesto de Comida')
  await comida.fill('300')
  await comida.press('Enter')
  await margin(page).toMatch(/Margen libre\s*880\s?€/)
  await page.locator('[data-primary]').click()
  await page.getByRole('button', { name: 'Volver' }).click()
  await expect(page.getByLabel('Presupuesto de Comida')).toHaveValue('300')
  await margin(page).toMatch(/Margen libre\s*880\s?€/)
})

test('with nothing spent there is no bar, and with no income a line points back to the income step', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=5')
  await expect(page.locator('[data-envelope-bar]')).toHaveCount(0)
  await expect(page.getByText('Añade tus ingresos para ver el margen')).toBeVisible()
  await page.getByRole('button', { name: 'Ir a ingresos' }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4')
})
