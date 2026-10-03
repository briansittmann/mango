// @ts-check
import { test, expect } from '@playwright/test'
import { body } from './onboarding-helpers.js'

test.use({ viewport: { width: 390, height: 844 } })

// `localization` → *Amount format preference*; `onboarding` → *Abbreviated sandbox*.

test('Argentina with the abbreviated format reads "$ 1,2k" and the fields keep full numbers', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=5&e2eSeed=1&pais=AR&formato=abreviado')
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*\$\s?1,2k/)
  await expect(page.getByText(/Fijos: \$\s?820/)).toBeVisible()

  const comida = page.getByLabel('Presupuesto de Comida')
  await expect(comida).toHaveValue('')
  await comida.fill('300000')
  await expect(comida).toHaveValue('300.000')
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*-\$\s?298,8k/)
})

test('Argentina with the complete format reads "$ 1.180"', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=5&e2eSeed=1&pais=AR')
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*\$\s?1\.180/)
})

test('another country ignores a stored abbreviated format', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=5&e2eSeed=1&pais=UY&formato=abreviado')
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*1\.180\s?\$/)
})
