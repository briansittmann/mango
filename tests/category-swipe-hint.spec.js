// @ts-check
import { test, expect } from '@playwright/test'

// The swipe-to-delete hint on the category cards plays once for all of them: every card has the
// same rows, so the first one opened by hand teaches the rest.

test.use({ viewport: { width: 390, height: 844 } })

test('the hint plays on the first category card opened and on no other', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/demo')
  const headers = page.locator('[aria-controls^="category-panel-"]')
  await headers.nth(0).click()
  await expect(page.locator('[data-hint]')).toHaveCount(1)
  await expect(page.locator('[data-hint]')).toHaveCount(0, { timeout: 6000 })
  expect(await page.evaluate(() => localStorage.getItem('mango:pista-deslizar-categoria'))).toBe('1')
  await headers.nth(1).click()
  await expect(headers.nth(1)).toHaveAttribute('aria-expanded', 'true')
  await page.waitForTimeout(800)
  await expect(page.locator('[data-hint]')).toHaveCount(0)
})
