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

test('the envelope bar splits the income: Vivienda 41 %, Comida 15 %, the margin 44 %', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=5&e2eSeed=1')
  await page.getByLabel('Presupuesto de Comida').fill('300')
  await margin(page).toMatch(/Margen libre\s*880\s?€/)

  const bar = await segments(page)
  expect(bar).toHaveLength(3)
  expect(bar[0].translate).toBeCloseTo(0, 5)
  expect(bar[0].scale).toBeCloseTo(0.41, 5)
  expect(bar[1].translate).toBeCloseTo(41, 5)
  expect(bar[1].scale).toBeCloseTo(0.15, 5)
  expect(bar[2].id).toBe('margin')
  expect(bar[2].translate).toBeCloseTo(56, 5)
  expect(bar[2].scale).toBeCloseTo(0.44, 5)
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

test('with no income the bar is hidden and a line points back to the income step', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=5')
  await expect(page.locator('[data-envelope-bar]')).toHaveCount(0)
  await expect(page.getByText('Añade tus ingresos para ver el margen')).toBeVisible()
  await page.getByRole('button', { name: 'Ir a ingresos' }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4')
})
