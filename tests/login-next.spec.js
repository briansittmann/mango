// @ts-check
import { test, expect } from '@playwright/test'

// `/login?next=` (add-mcp-server, `web-access` → *Sign-in returns to where it was sent from*) and the
// consent page's states that need no session. `/auth/request-code`, `/auth/verify-code` and
// `/auth/google` are stubbed, so nothing reaches Supabase; without a real session, landing on the
// consent page sends the browser back to `/login?next=`, which is what proves where it went.

test.use({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Madrid' })

const CONSENT = '/oauth/consent?authorization_id=abc'
const NEXT = encodeURIComponent(CONSENT)

function stubAuth(page) {
  const google = []
  page.route('**/auth/request-code', (route) => route.fulfill({ json: { status: 'sent', email: route.request().postDataJSON().email } }))
  page.route('**/auth/verify-code', (route) => route.fulfill({ json: { status: 'ok' } }))
  page.route('**/auth/google', (route) => {
    google.push(route.request().postDataJSON())
    return route.fulfill({ json: { status: 'error' } })
  })
  return google
}

function trackPaths(page) {
  const paths = []
  page.on('request', (request) => paths.push(new URL(request.url()).pathname))
  return paths
}

async function signInWithCode(page) {
  await page.getByRole('button', { name: 'Continuar con email' }).click()
  await page.getByLabel('Correo electrónico').fill('tu@mail.com')
  await page.getByRole('button', { name: 'Enviar código' }).click()
  await page.getByLabel('Código de 6 dígitos').focus()
  await page.keyboard.type('482913')
  await page.getByRole('button', { name: 'Ir a mi mes' }).click({ timeout: 10_000 })
}

test('a valid code lands on next', async ({ page }) => {
  stubAuth(page)
  const paths = trackPaths(page)
  await page.goto(`/login?next=${NEXT}`)
  await signInWithCode(page)

  await expect(page).toHaveURL(`/login?next=${NEXT}`)
  expect(paths).toContain('/oauth/consent')
  expect(paths).not.toContain('/dashboard')
})

test('a foreign next is ignored and the code lands on the dashboard', async ({ page }) => {
  stubAuth(page)
  const paths = trackPaths(page)
  await page.goto(`/login?next=${encodeURIComponent('//evil.example')}`)
  await signInWithCode(page)

  await expect.poll(() => paths.includes('/dashboard')).toBe(true)
  expect(paths.some((path) => path.includes('evil'))).toBe(false)
})

test('the code step keeps next in its URL, and "Cambiar mail" too', async ({ page }) => {
  stubAuth(page)
  await page.goto(`/login?next=${NEXT}`)
  await page.getByRole('button', { name: 'Continuar con email' }).click()
  await page.getByLabel('Correo electrónico').fill('tu@mail.com')
  await page.getByRole('button', { name: 'Enviar código' }).click()

  await expect(page).toHaveURL(`/login?email=tu%40mail.com&next=${NEXT}`)
  await page.getByRole('button', { name: 'Cambiar mail' }).click()
  await expect(page).toHaveURL(`/login?next=${NEXT}`)
})

test('the Google request carries next, and only a safe one', async ({ page }) => {
  const google = stubAuth(page)
  await page.goto(`/login?next=${NEXT}`)
  await page.getByRole('button', { name: 'Continuar con Google' }).click()
  await expect.poll(() => google.length).toBe(1)
  expect(google[0]).toEqual({ idioma: 'es', timezone: 'Europe/Madrid', next: CONSENT })

  await page.goto(`/login?next=${encodeURIComponent('https://evil.example')}`)
  await page.getByRole('button', { name: 'Continuar con Google' }).click()
  await expect.poll(() => google.length).toBe(2)
  expect(google[1]).toEqual({ idioma: 'es', timezone: 'Europe/Madrid' })
})

test('the consent page without a session sends to the login with next', async ({ page }) => {
  await page.goto(CONSENT)
  await expect(page).toHaveURL(`/login?next=${NEXT}`)
})

test('the consent page without a request says it expired, with no buttons, and is not indexed', async ({ page }) => {
  await page.context().addCookies([{ name: 'locale', value: 'es', url: 'http://localhost:3000' }])
  await page.goto('/oauth/consent')
  await expect(page.getByRole('heading', { name: 'Esta solicitud ya no sirve' })).toBeVisible()
  await expect(page.locator('main').getByRole('button')).toHaveCount(0)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})
