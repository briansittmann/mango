// @ts-check
import { test, expect } from '@playwright/test'

test('home shows the two entry points and talks to no Supabase host', async ({ page }) => {
  const supabaseRequests = []
  page.on('request', (request) => {
    if (new URL(request.url()).hostname.includes('supabase')) supabaseRequests.push(request.url())
  })

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Demo' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
  expect(supabaseRequests).toEqual([])
})

test('Demo opens /demo', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Demo' }).click()
  await expect(page).toHaveURL(/\/demo$/)
})

test('Entrar opens /login', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/login$/)
})
