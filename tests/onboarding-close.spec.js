// @ts-check
import { test, expect } from '@playwright/test'
import { primary } from './onboarding-helpers.js'

test.use({ viewport: { width: 390, height: 844 } })

// `onboarding` → *Closing step stores a WhatsApp request and sends nothing*, on `/demo/onboarding?paso=7`.

test('the code field is shown while the invitation is required, and hidden with ?e2eInvite=0', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=7&pais=AR')
  await expect(page.getByLabel('Tu número')).toBeVisible()
  await expect(page.getByLabel('Código de invitación')).toBeVisible()
  await expect(page.getByText('Hoy funciona por invitación.')).toBeVisible()

  await page.goto('/demo/onboarding?paso=7&pais=AR&e2eInvite=0')
  await expect(page.getByLabel('Tu número')).toBeVisible()
  await expect(page.getByLabel('Código de invitación')).toHaveCount(0)
  await page.getByLabel('Tu número').fill('11 5555 1234')
  await expect(primary(page)).toBeEnabled()
})

test('a malformed phone keeps "Vincular" disabled; a code alone is not enough', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=7&pais=AR')
  await expect(primary(page)).toHaveText('Vincular')
  await expect(primary(page)).toBeDisabled()
  await page.getByLabel('Tu número').fill('abc')
  await page.getByLabel('Código de invitación').fill('mng-7k2qx4')
  await expect(primary(page)).toBeDisabled()
  await page.getByLabel('Tu número').fill('11 5555 1234')
  await expect(primary(page)).toBeEnabled()
  await page.getByLabel('Código de invitación').fill('')
  await expect(primary(page)).toBeDisabled()
})

test('"Vincular" stores the number, says so without claiming a message, and reaches the end', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=7&pais=AR')
  await page.getByLabel('Tu número').fill('11 5555 1234')
  await page.getByLabel('Código de invitación').fill('mng-7k2qx4')
  await primary(page).click()
  await expect(page).toHaveURL(/\/demo$/)
})

test('"Seguir sin WhatsApp" completes the onboarding without a phone', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=7')
  await page.getByRole('button', { name: 'Seguir sin WhatsApp' }).click()
  await expect(page).toHaveURL(/\/demo$/)
})

test('the sandbox writes nothing over the network', async ({ page }) => {
  const posts = []
  const supabase = []
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url())
    if (new URL(request.url()).hostname.includes('supabase')) supabase.push(request.url())
  })
  await page.goto('/demo/onboarding?paso=3')
  await page.getByRole('button', { name: 'Comida', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Categorías' })).toContainText('Comida')
  await page.reload()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
  await expect(page.getByRole('list', { name: 'Categorías' })).toHaveCount(0)
  expect(posts).toEqual([])
  expect(supabase).toEqual([])
})
