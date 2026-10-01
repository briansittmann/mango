// @ts-check
import { test, expect } from '@playwright/test'
import { body, expectStep, fillBasics, primary, progress } from './onboarding-helpers.js'

test.use({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Dublin' })

// `onboarding` → *The onboarding is one route with seven steps*, on `/demo/onboarding` in Spanish.

const TITLES = ['Bienvenida', 'Sobre ti', 'Tus categorías', 'Ingresos y fijos', 'Presupuestos', 'Meta de ahorro', 'WhatsApp']
const HEADINGS = ['', '', 'Tus categorías', 'Ingresos y fijos', 'Presupuestos', 'Meta de ahorro', '¿Quieres cargar por WhatsApp?']

test('seven steps forward, the progress line counts them and names them', async ({ page }) => {
  await page.goto('/demo/onboarding')
  await expect(page.getByText('Esto es una prueba: nada se guarda')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hola. Vamos a armar tu mes.' })).toBeVisible()
  await expect(primary(page)).toHaveText('Empezar')
  await expect(progress(page)).toHaveAttribute('aria-valuenow', '1')
  await expect(progress(page)).toHaveAttribute('aria-valuetext', 'Bienvenida')

  await primary(page).click()
  await expectStep(page, 2)
  await expect(primary(page)).toHaveText('Continuar')
  await expect(primary(page)).toBeDisabled()
  await fillBasics(page)
  await expect(primary(page)).toBeEnabled()

  for (let n = 3; n <= 7; n++) {
    await primary(page).click()
    await expectStep(page, n)
    await expect(progress(page)).toHaveAttribute('aria-valuetext', TITLES[n - 1])
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(HEADINGS[n - 1])
  }
  await expect(primary(page)).toHaveText('Vincular')
  expect(await body(page)).not.toMatch(/\b\d de 7\b/)
})

test('back keeps what was stored', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=3')
  await page.getByRole('button', { name: 'Comida', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Categorías' })).toContainText('Comida')

  await primary(page).click()
  await expectStep(page, 4)
  await page.getByRole('button', { name: 'Volver' }).click()
  await expectStep(page, 3)
  await expect(page.getByRole('list', { name: 'Categorías' })).toContainText('Comida')

  await page.getByRole('button', { name: 'Volver' }).click()
  await expectStep(page, 2)
  await expect(page.getByLabel('Nombre', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Volver' })).toBeVisible()
})

test('?paso= opens on that step and the welcome has no back control', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=5&e2eSeed=1')
  await expectStep(page, 5)
  await expect(page.getByRole('button', { name: 'Volver' })).toBeVisible()

  await page.goto('/demo/onboarding')
  await expectStep(page, 1)
  await expect(page.getByRole('button', { name: 'Volver' })).toHaveCount(0)
})
