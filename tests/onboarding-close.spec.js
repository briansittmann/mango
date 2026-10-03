// @ts-check
import { test, expect } from '@playwright/test'
import { primary, takeChip } from './onboarding-helpers.js'

test.use({ viewport: { width: 390, height: 844 } })

// `onboarding` → *Closing step* (`add-whatsapp-linking`), on `/demo/onboarding?paso=7`: the
// sandbox's code is `DEMO42`, its number `15551234567`; `?e2eVinculado=1` makes the next re-read
// find the chat linked and `?e2eSinNumero=1` removes the number.

const LINK = 'https://wa.me/15551234567?text=vincular%20DEMO42'

/** The anchor would leave for WhatsApp: the navigation is blocked so the page stays. */
async function blockWhatsApp(page) {
  await page.route('https://wa.me/**', (route) => route.abort())
}

test('the chat preview shows the real code and Mango\'s reply', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=7&pais=AR')
  await expect(page.locator('[data-bubble="person"]')).toHaveText('vincular DEMO42')
  await expect(page.locator('[data-bubble="mango"]')).toHaveText('✅ Listo, este chat ya está vinculado a tu cuenta.')
  await expect(page.locator('[data-link-code]')).toHaveText('DEMO42')
  await expect(page.locator('[data-link-state]')).toHaveCount(0)
})

test('"Vincular WhatsApp" is a link to wa.me with the message written, then the step waits', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=7&pais=AR')
  await blockWhatsApp(page)
  const action = primary(page)
  await expect(action).toHaveText('Vincular WhatsApp')
  await expect(action).toHaveAttribute('href', LINK)
  await expect(action).toHaveAttribute('target', '_blank')
  await action.click()
  await expect(primary(page)).toHaveText('Ir a mi mes')
  await expect(page.locator('[data-link-state="waiting"]')).toContainText('Esperando tu mensaje')
  await expect(page.locator('[data-link-code]')).toHaveText('DEMO42')
  await expect(page.getByRole('button', { name: 'Seguir sin WhatsApp' })).toBeVisible()
})

test('a return to the tab after the chat linked shows "Vinculado" with the number', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=7&pais=AR&e2eVinculado=1')
  await blockWhatsApp(page)
  await primary(page).click()
  await expect(page.locator('[data-link-state="waiting"]')).toBeVisible()
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  const linked = page.locator('[data-link-state="linked"]')
  await expect(linked).toContainText('Vinculado')
  await expect(linked).toContainText('+54 9 11 5555 1234')
  await expect(primary(page)).toHaveText('Ir a mi mes')
  await expect(page.getByRole('button', { name: 'Seguir sin WhatsApp' })).toHaveCount(0)
  await primary(page).click()
  await expect(page).toHaveURL(/\/demo$/)
})

test('"Dejar mi número" opens the field; a valid number enables the save, "abc" does not', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=7&pais=AR')
  const save = page.getByRole('button', { name: 'Guardar número' })
  await page.getByRole('button', { name: 'Dejar mi número' }).click()
  await expect(page.getByRole('combobox', { name: 'País' })).toHaveValue('AR')
  await expect(save).toBeDisabled()
  await page.getByLabel('Número', { exact: true }).fill('abc')
  await expect(save).toBeDisabled()
  await page.getByLabel('Número', { exact: true }).fill('11 5555 1234')
  await expect(save).toBeEnabled()
  await save.click()
  await expect(page.getByText('Número guardado')).toBeVisible()
  // Saving stays on the step, with the code untouched.
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '7')
  await expect(page.locator('[data-link-code]')).toHaveText('DEMO42')
})

test('"Seguir sin WhatsApp" completes the onboarding', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=7')
  await page.getByRole('button', { name: 'Seguir sin WhatsApp' }).click()
  await expect(page).toHaveURL(/\/demo$/)
})

test('without a configured number the code and the manual line show, and "Ir a mi mes" is the primary', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=7&pais=AR&e2eSinNumero=1')
  await expect(primary(page)).toHaveText('Ir a mi mes')
  await expect(page.locator('[data-link-code]')).toHaveText('DEMO42')
  await expect(page.locator('[data-manual-line]')).toHaveText('Envía *vincular DEMO42* a Mango por WhatsApp.')
  await expect(page.locator('a[data-primary]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Seguir sin WhatsApp' })).toBeVisible()
})

test('the sandbox writes nothing over the network', async ({ page }) => {
  const posts = []
  const supabase = []
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url())
    if (new URL(request.url()).hostname.includes('supabase')) supabase.push(request.url())
  })
  await page.goto('/demo/onboarding?paso=3')
  await takeChip(page, 'Comida')
  await expect(page.getByRole('list', { name: 'Categorías' })).toContainText('Comida')
  await page.reload()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
  await expect(page.getByRole('list', { name: 'Categorías' })).toHaveCount(0)
  expect(posts).toEqual([])
  expect(supabase).toEqual([])
})
