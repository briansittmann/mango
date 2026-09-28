// @ts-check
import { test, expect } from '@playwright/test'

// The e-mail step of /login with registration open (open-web-signup, D10). `/auth/request-code` is
// stubbed in every test, so nothing here creates an auth user, sends a mail or reaches Supabase.

test.use({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Madrid' })

const NEW_ADDRESS = 'nueva.persona@mail.com'

function stubRequestCode(page, answer) {
  const bodies = []
  page.route('**/auth/request-code', async (route) => {
    bodies.push(route.request().postDataJSON())
    await route.fulfill({ json: typeof answer === 'function' ? answer(bodies.at(-1)) : answer })
  })
  return bodies
}

function trackSupabase(page) {
  const requests = []
  page.on('request', (request) => {
    if (new URL(request.url()).hostname.includes('supabase')) requests.push(request.url())
  })
  return requests
}

async function submit(page, email) {
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByRole('button', { name: 'Enviar código' }).click()
}

test('the e-mail step says a first-time address gets an account', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Si es tu primera vez, creamos tu cuenta con este mail.')).toBeVisible()
})

test('a new address reaches the code step', async ({ page }) => {
  const supabase = trackSupabase(page)
  const bodies = stubRequestCode(page, (body) => ({ status: 'sent', email: body.email }))
  await page.goto('/login')
  await submit(page, NEW_ADDRESS)

  await expect(page.getByRole('heading', { name: 'Revisa tu mail' })).toBeVisible()
  await expect(page.getByText(NEW_ADDRESS)).toBeVisible()
  await expect(page).toHaveURL(`/login?email=${encodeURIComponent(NEW_ADDRESS)}`)
  expect(bodies).toHaveLength(1)
  expect(supabase).toEqual([])
})

test('the request carries the address, the language and the timezone', async ({ page }) => {
  await page.context().addCookies([{ name: 'locale', value: 'en', url: 'http://localhost:3000' }])
  const bodies = stubRequestCode(page, (body) => ({ status: 'sent', email: body.email }))
  await page.goto('/login')
  await expect(page.getByText("First time here? We'll create your account with this e-mail.")).toBeVisible()
  await page.getByLabel('Email').fill(NEW_ADDRESS)
  await page.getByRole('button', { name: 'Send code' }).click()

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  expect(bodies).toEqual([{ email: NEW_ADDRESS, idioma: 'en', timezone: 'Europe/Madrid' }])
})

test('a rate-limited request stays on the e-mail step with its message', async ({ page }) => {
  const supabase = trackSupabase(page)
  stubRequestCode(page, { status: 'rate_limited' })
  await page.goto('/login')
  await submit(page, NEW_ADDRESS)

  await expect(page.getByText('Pediste demasiados códigos. Espera un minuto; si vuelve a pasar, prueba más tarde.')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
  expect(supabase).toEqual([])
})

test('a failed request stays on the e-mail step with the send error', async ({ page }) => {
  const supabase = trackSupabase(page)
  stubRequestCode(page, { status: 'error' })
  await page.goto('/login')
  await submit(page, NEW_ADDRESS)

  await expect(page.getByText('No se pudo enviar el código. Inténtalo de nuevo en unos minutos.')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
  expect(supabase).toEqual([])
})
