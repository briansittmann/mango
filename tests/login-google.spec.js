// @ts-check
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

// "Continuar con Google" and "Continuar con email" on /login (add-google-login). `/auth/google` is stubbed
// in every test that presses the button, and its URL points back to a stubbed page here, so nothing
// reaches Google or Supabase.

test.use({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Madrid' })

const PROVIDER = 'http://localhost:3000/__proveedor-google'

function stubGoogle(page, answer, { hold = false } = {}) {
  const bodies = []
  page.route('**/auth/google', async (route) => {
    bodies.push(route.request().postDataJSON())
    if (hold) return
    await route.fulfill({ json: answer })
  })
  page.route('**/__proveedor-google', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Google</h1>' }))
  return bodies
}

const googleButton = (page, name = 'Continuar con Google') => page.getByRole('button', { name })

const emailButton = (page, name = 'Continuar con email') => page.getByRole('button', { name })

test('Google sits above "Continuar con email" with the card’s fill, Google’s border and label and the four-colour mark', async ({ page }) => {
  await page.goto('/login')
  const button = googleButton(page)
  await expect(button).toBeVisible()
  await expect(page.getByText('o', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Correo electrónico')).toHaveCount(0)

  const buttonBox = await button.boundingBox()
  const emailBox = await emailButton(page).boundingBox()
  expect(buttonBox.y + buttonBox.height).toBeLessThan(emailBox.y)
  expect(buttonBox.height).toBeGreaterThanOrEqual(44)
  expect(emailBox.height).toBeGreaterThanOrEqual(44)

  await page.mouse.move(0, 0)
  const styles = await button.evaluate((element) => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, border: style.borderTopColor, color: style.color, borderWidth: style.borderTopWidth }
  })
  expect(styles).toEqual({ background: 'rgb(19, 24, 20)', border: 'rgb(142, 145, 143)', color: 'rgb(227, 227, 227)', borderWidth: '1px' })

  const fills = await button.locator('[data-google-g] path').evaluateAll((paths) => paths.map((path) => path.getAttribute('fill')).sort())
  expect(fills).toEqual(['#34A853', '#4285F4', '#EA4335', '#FBBC05'])
})

test('in English the button and the divider are translated', async ({ page }) => {
  await page.context().addCookies([{ name: 'locale', value: 'en', url: 'http://localhost:3000' }])
  await page.goto('/login')
  await expect(googleButton(page, 'Continue with Google')).toBeVisible()
  await expect(page.getByText('or', { exact: true })).toBeVisible()
  await expect(emailButton(page, 'Continue with email')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible()
})

test('"Continuar con email" swaps the two ways for the field, focused, and Volver brings them back', async ({ page }) => {
  await page.goto('/login')
  await emailButton(page).click()

  await expect(page.getByLabel('Correo electrónico')).toBeFocused()
  await expect(page.getByText('Si es tu primera vez, creamos tu cuenta con este mail.')).toBeVisible()
  await expect(googleButton(page)).toHaveCount(0)
  await expect(emailButton(page)).toHaveCount(0)

  await page.getByRole('button', { name: 'Volver' }).click()
  await expect(googleButton(page)).toBeFocused()
  await expect(emailButton(page)).toBeVisible()
  await expect(page.getByLabel('Correo electrónico')).toHaveCount(0)
  await expect(page).toHaveURL(/\/login$/)
})

test('Volver on the two ways goes to Home', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Volver' }).click()
  await expect(page).toHaveURL('/')
})

test('the way not taken leaves while Google prepares, and comes back if it fails', async ({ page }) => {
  let release
  page.route('**/auth/google', async (route) => {
    await new Promise((resolve) => (release = resolve))
    await route.fulfill({ json: { status: 'error' } })
  })
  await page.goto('/login')
  await googleButton(page).click()

  await expect.poll(() => emailButton(page).evaluate((node) => getComputedStyle(node.parentElement).opacity)).toBe('0')
  release()
  await expect(page.locator('form').getByRole('alert')).toBeVisible()
  await expect.poll(() => emailButton(page).evaluate((node) => getComputedStyle(node.parentElement).opacity)).toBe('1')
})

test('the request carries the language and the timezone and the page goes to the provider', async ({ page }) => {
  await page.context().addCookies([{ name: 'locale', value: 'en', url: 'http://localhost:3000' }])
  const bodies = stubGoogle(page, { status: 'ok', url: PROVIDER })
  await page.goto('/login')
  await googleButton(page, 'Continue with Google').click()

  await expect(page).toHaveURL(PROVIDER)
  expect(bodies).toEqual([{ idioma: 'en', timezone: 'Europe/Madrid' }])
})

test('while the redirect is prepared the button is busy and a second press sends nothing', async ({ page }) => {
  const bodies = stubGoogle(page, null, { hold: true })
  await page.goto('/login')
  const button = googleButton(page)
  await button.click()

  await expect(button).toHaveAttribute('aria-busy', 'true')
  await button.click({ force: true })
  await page.waitForTimeout(300)
  expect(bodies).toHaveLength(1)
})

test('a failed request leaves the button active with the Google message', async ({ page }) => {
  stubGoogle(page, { status: 'error' })
  await page.goto('/login')
  const button = googleButton(page)
  await button.click()

  await expect(page.locator('form').getByRole('alert')).toHaveText('No se pudo entrar con Google. Inténtalo de nuevo o entra con tu mail.')
  await expect(button).not.toHaveAttribute('aria-busy', 'true')
  await expect(page).toHaveURL(/\/login$/)
})

test('a failed return shows the Google message, and a bad link keeps its own', async ({ page }) => {
  await page.goto('/login?error=google')
  await expect(page.locator('form').getByRole('alert')).toHaveText('No se pudo entrar con Google. Inténtalo de nuevo o entra con tu mail.')

  await page.goto('/login?error=enlace')
  await expect(page.locator('form').getByRole('alert')).toHaveText('El enlace venció o ya se usó. Pide uno nuevo.')
})

test('a cancelled consent lands on /login with the Google message', async ({ page }) => {
  await page.goto('/auth/confirm?error=access_denied&error_description=The+user+denied')
  await expect(page).toHaveURL('/login?error=google')
  await expect(page.locator('form').getByRole('alert')).toHaveText('No se pudo entrar con Google. Inténtalo de nuevo o entra con tu mail.')
})

test('with reduced motion the button does not animate its fold, and the ways swap at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/login')
  await emailButton(page).click()
  await expect(page.getByLabel('Correo electrónico')).toBeFocused()
  await page.getByRole('button', { name: 'Volver' }).click()

  stubGoogle(page, null, { hold: true })
  const button = googleButton(page)
  await expect(button).toHaveCSS('transition-property', 'none')
  await button.click()
  await expect(button).toHaveAttribute('aria-busy', 'true')
  await expect(emailButton(page)).toHaveCSS('opacity', '1')
})

test('no axe violation on the e-mail step', async ({ page }) => {
  await page.goto('/login')
  await expect(googleButton(page)).toBeVisible()
  // The entrance blurs and fades each piece in; measuring mid-way reads as low contrast.
  await page.waitForFunction(() =>
    [...document.querySelector('form').children].every((child) => getComputedStyle(child).opacity === '1' && getComputedStyle(child).filter === 'none'),
  )
  await page.evaluate(readFileSync('node_modules/axe-core/axe.min.js', 'utf8'))
  const violations = await page.evaluate(async () => {
    // @ts-expect-error axe is attached by the evaluated source above
    const result = await window.axe.run(document.querySelector('form'), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })
    return result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)
  })
  expect(violations).toEqual([])
})
