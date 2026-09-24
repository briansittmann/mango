// @ts-check
import { test, expect } from '@playwright/test'

test('/login renders the e-mail field and the submit button', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('Correo electrónico')).toHaveAttribute('type', 'email')
  await expect(page.getByRole('button', { name: 'Enviar enlace' })).toBeVisible()
})

test('a malformed e-mail is refused without a request', async ({ page }) => {
  await page.goto('/login')
  const posts = []
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url())
  })

  const email = page.getByLabel('Correo electrónico')
  await email.fill('brian')
  await page.getByRole('button', { name: 'Enviar enlace' }).click()

  expect(await email.evaluate((input) => /** @type {HTMLInputElement} */ (input).validity.valid)).toBe(false)
  await expect(page.getByRole('status')).toHaveCount(0)
  expect(posts).toEqual([])
})

for (const path of ['/dashboard', '/dashboard?mes=2026-08']) {
  test(`${path} without a session redirects to /login`, async ({ page }) => {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login$/)
  })
}

test('/demo still renders the sample notice', async ({ page }) => {
  await page.goto('/demo')
  await expect(page.getByText('Estás viendo datos de ejemplo')).toBeVisible()
})
