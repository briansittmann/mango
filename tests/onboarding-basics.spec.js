// @ts-check
import { test, expect } from '@playwright/test'
import { expectStep, primary } from './onboarding-helpers.js'

test.use({ viewport: { width: 390, height: 844 } })

// `onboarding` → *Basics — name, country, currency, format and cycle day*, on `/demo/onboarding?paso=2`.

test.describe('from an Argentine timezone', () => {
  test.use({ timezoneId: 'America/Argentina/Cordoba' })

  test('Argentina is preselected, pesos and the format control follow', async ({ page }) => {
    await page.goto('/demo/onboarding?paso=2')
    await expect(page.getByLabel('País')).toHaveValue('AR')
    await expect(page.getByLabel('Moneda')).toHaveValue('ARS')
    await expect(page.locator('[data-derived-line]')).toHaveText(/Peso argentino · hora de Cordoba/)

    const control = page.locator('[data-format-control]')
    await expect(control).toBeVisible()
    await expect(control.getByRole('radio', { name: 'Completo' })).toHaveText('350.000')
    await expect(control.getByRole('radio', { name: 'Completo' })).toHaveAttribute('aria-checked', 'true')
    await expect(control.getByRole('radio', { name: 'Abreviado' })).toHaveText('350k')

    // The currency stays editable and the control stays: the country is still Argentina.
    await page.getByLabel('Moneda').selectOption('EUR')
    await expect(control).toBeVisible()
    await expect(page.locator('[data-derived-line]')).toHaveText(/Euro · hora de Cordoba/)
  })
})

test.describe('from an Irish timezone', () => {
  test.use({ timezoneId: 'Europe/Dublin' })

  test('Ireland: euros, Dublin time and no format control', async ({ page }) => {
    await page.goto('/demo/onboarding?paso=2')
    await expect(page.getByLabel('País')).toHaveValue('IE')
    await expect(page.getByLabel('Moneda')).toHaveValue('EUR')
    await expect(page.locator('[data-derived-line]')).toHaveText(/Euro · hora de Dublin/)
    await expect(page.locator('[data-format-control]')).toBeHidden()
  })

  test('the timezone follows the country: Spain takes Madrid', async ({ page }) => {
    await page.goto('/demo/onboarding?paso=2')
    await page.getByLabel('País').selectOption('ES')
    await expect(page.locator('[data-derived-line]')).toHaveText(/Euro · hora de Madrid/)
    await page.getByLabel('País').selectOption('AR')
    await expect(page.locator('[data-derived-line]')).toHaveText(/Peso argentino · hora de Buenos Aires/)
    await expect(page.locator('[data-format-control]')).toBeVisible()
  })

  test('the day is editable on a fresh account and locked once something is keyed to the cycle', async ({ page }) => {
    await page.goto('/demo/onboarding?paso=2')
    const day = page.getByLabel('Día de inicio')
    await expect(day).toHaveValue('1')
    await expect(day).not.toHaveAttribute('readonly')
    await expect(page.locator('[data-cycle-hint]')).toHaveText('Si cobras el 1 o no te aplica, deja 1')
    await day.fill('29')
    await expect(page.getByText('Elige un día del 1 al 28')).toBeVisible()
    await page.getByLabel('Nombre', { exact: true }).fill('Ana')
    await expect(primary(page)).toBeDisabled()
    await day.fill('28')
    await expect(primary(page)).toBeEnabled()

    await page.goto('/demo/onboarding?paso=2&e2eSeed=1')
    await expect(page.getByLabel('Día de inicio')).toHaveAttribute('readonly', '')
    await expect(page.locator('[data-cycle-hint]')).toHaveText('Se fija con la primera categoría')
  })

  test('a handle is not a name: empty field, the handle as placeholder, Continuar disabled', async ({ page }) => {
    await page.goto('/demo/onboarding?paso=2&nombre=brianrebadj%2Balta1')
    const name = page.getByLabel('Nombre', { exact: true })
    await expect(name).toHaveValue('')
    await expect(name).toHaveAttribute('placeholder', 'brianrebadj+alta1')
    await expect(primary(page)).toBeDisabled()
    await name.fill('Brian')
    await expect(primary(page)).toBeEnabled()
    await primary(page).click()
    await expectStep(page, 3)
  })

  test('a stored name that looks like one is prefilled', async ({ page }) => {
    await page.goto('/demo/onboarding?paso=2&nombre=Ana%20Mar%C3%ADa')
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Ana María')
  })
})
