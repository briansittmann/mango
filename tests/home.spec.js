// @ts-check
import { test, expect } from '@playwright/test'

test('home shows its entry points and talks to no Supabase host', async ({ page }) => {
  const supabaseRequests = []
  page.on('request', (request) => {
    if (new URL(request.url()).hostname.includes('supabase')) supabaseRequests.push(request.url())
  })

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Ver la demo' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Empezar' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Entrar', exact: true })).toBeVisible()
  expect(supabaseRequests).toEqual([])
})

test('home says what Mango is', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/Mango ordena tu mes: gastos, ingresos, ahorro y lo que te queda libre\./)).toBeAttached()
})

test('home in English', async ({ page }) => {
  await page.context().addCookies([{ name: 'locale', value: 'en', url: 'http://localhost:3000' }])
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'See the demo' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Get started' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeVisible()
  await expect(page.getByText(/Mango sorts out your month: spending, income, savings and what you have left\./)).toBeAttached()
})

test('Ver la demo opens /demo', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Ver la demo' }).first().click()
  await expect(page).toHaveURL(/\/demo$/)
})

test('Entrar and Empezar open /login', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/')
  await page.getByRole('link', { name: 'Empezar' }).first().click()
  await expect(page).toHaveURL(/\/login$/)
})

test('the phone story embeds the demo without its notice', async ({ page }) => {
  await page.goto('/demo?embed=1')
  await expect(page.getByText('Estás viendo datos de ejemplo')).toHaveCount(0)
})

test('home shows the Claude and ChatGPT conversations, one at a time', async ({ page }) => {
  await page.goto('/')
  const section = page.getByRole('region', { name: 'Tu mes, también en Claude y ChatGPT.' })
  const tabs = section.getByRole('tab')
  await expect(tabs).toHaveCount(3)
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true')
  await tabs.nth(1).click()
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(section.getByRole('tabpanel')).toHaveCount(1)
  await expect(section.getByRole('tabpanel')).toContainText('Anota la cena de anoche')
  await tabs.nth(1).press('ArrowDown')
  await expect(tabs.nth(2)).toBeFocused()
  await expect(section.getByRole('tabpanel')).toContainText('¿Quieres que lo añada como fijo desde noviembre?')
})
