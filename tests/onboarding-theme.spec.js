// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

// `onboarding` → *A floating theme control on every step*; `theming` → *Theme selection*.

const LIGHT_BACKGROUND = 'rgb(244, 247, 244)'
const DARK_BACKGROUND = 'rgb(13, 17, 14)'

function pill(page) {
  return page.locator('[data-theme-pill]')
}

function themeAttribute(page) {
  return page.evaluate(() => document.documentElement.getAttribute('data-theme'))
}

function stored(page) {
  return page.evaluate(() => localStorage.getItem('theme'))
}

function bodyBackground(page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor)
}

test('no stored choice: automatic is selected, the page follows a light OS, the choice is stored', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/demo/onboarding')
  expect(await themeAttribute(page)).toBeNull()
  await expect(pill(page).getByRole('radio', { name: 'Automático' })).toHaveAttribute('aria-checked', 'true')
  expect(await bodyBackground(page)).toBe(LIGHT_BACKGROUND)
  await expect.poll(() => stored(page)).toBe('system')
})

test('choosing dark applies at once, persists and is selected after a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/demo/onboarding?paso=2')
  await pill(page).getByRole('radio', { name: 'Oscuro' }).click()
  await expect.poll(() => themeAttribute(page)).toBe('dark')
  expect(await stored(page)).toBe('dark')
  await expect.poll(() => bodyBackground(page)).toBe(DARK_BACKGROUND)

  await page.reload()
  expect(await themeAttribute(page)).toBe('dark')
  await expect(pill(page).getByRole('radio', { name: 'Oscuro' })).toHaveAttribute('aria-checked', 'true')
  expect(await bodyBackground(page)).toBe(DARK_BACKGROUND)
})

test('a stored choice is kept against the OS', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('theme', 'light')
    } catch {}
  })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/demo/onboarding')
  expect(await themeAttribute(page)).toBe('light')
  await expect(pill(page).getByRole('radio', { name: 'Claro' })).toHaveAttribute('aria-checked', 'true')
  expect(await bodyBackground(page)).toBe(LIGHT_BACKGROUND)
})

test('the pill is glass, stays in place across steps and the demo dashboard keeps dark by default', async ({ page }) => {
  await page.goto('/demo/onboarding')
  const blur = await pill(page).evaluate((el) => getComputedStyle(el).backdropFilter)
  expect(blur).not.toBe('none')
  const before = await pill(page).boundingBox()
  await page.locator('[data-primary]').click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
  const after = await pill(page).boundingBox()
  expect(after).toEqual(before)

  // `/demo` for a first-time browser stays dark: the system default is the onboarding's alone.
  await page.evaluate(() => localStorage.removeItem('theme'))
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/demo')
  expect(await themeAttribute(page)).toBe('dark')
})
