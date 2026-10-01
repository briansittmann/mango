// @ts-check
import { test, expect } from '@playwright/test'
import { body, expectStep, primary } from './onboarding-helpers.js'

test.use({ viewport: { width: 390, height: 844 } })

// `onboarding` → *Savings target step*, on `/demo/onboarding?paso=6&e2eSeed=1` (margin 1 180).

test('the preview line reads what is left after the target; the margin itself does not move', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=6&e2eSeed=1')
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*1\.180\s?€/)
  await expect(page.locator('[data-savings-preview]')).toHaveCount(0)

  await page.getByLabel('Meta de ahorro por mes').fill('300')
  await expect(page.locator('[data-savings-preview]')).toHaveText(/Con esta meta te quedan 880\s?€ por mes/)
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*1\.180\s?€/)

  await page.getByLabel('Meta de ahorro por mes').fill('')
  await expect(page.locator('[data-savings-preview]')).toHaveCount(0)
})

test('the hero persists from budgets to the savings target', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=5&e2eSeed=1')
  const hero = page.locator('[data-hero]')
  await expect(hero).toBeVisible()
  const before = await hero.boundingBox()
  await primary(page).click()
  await expectStep(page, 6)
  const after = await hero.boundingBox()
  expect(after?.y).toBe(before?.y)
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*1\.180\s?€/)
})

test('an empty field continues with no target; an invalid one blocks', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=6&e2eSeed=1')
  await page.getByLabel('Meta de ahorro por mes').fill('abc')
  await expect(primary(page)).toBeDisabled()
  await page.getByLabel('Meta de ahorro por mes').fill('')
  await expect(primary(page)).toBeEnabled()
  await primary(page).click()
  await expectStep(page, 7)
})
