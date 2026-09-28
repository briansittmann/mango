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

test('home says what Mango is and that the bot is by invitation', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/Mango ordena tu mes.*El bot de WhatsApp es por invitación\./)).toBeVisible()
})

test('home in English', async ({ page }) => {
  await page.context().addCookies([{ name: 'locale', value: 'en', url: 'http://localhost:3000' }])
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Demo' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()
  await expect(page.getByText(/Mango sorts out your month.*The WhatsApp bot is by invitation\./)).toBeVisible()
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
