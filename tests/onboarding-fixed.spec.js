// @ts-check
import { test, expect } from '@playwright/test'
import { longSwipe } from './onboarding-helpers.js'

test.use({ viewport: { width: 390, height: 844 } })

// `onboarding` → *Income and fixed expenses step*, on `/demo/onboarding?paso=4`.

function income(page) {
  return page.getByRole('region', { name: 'Lo que cobras' })
}

function expenses(page) {
  return page.getByRole('region', { name: 'Lo que pagas todos los meses' })
}

test('the seed lists income and expense rows with amount and day', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=4&e2eSeed=1')
  const sueldo = income(page).getByRole('listitem', { name: 'Sueldo · día 1' })
  await expect(sueldo).toBeVisible()
  await expect(sueldo).toContainText(/2\.000\s?€/)
  const alquiler = expenses(page).getByRole('listitem', { name: 'Alquiler · día 1' })
  await expect(alquiler).toBeVisible()
  await expect(alquiler).toContainText(/820\s?€/)
  await expect(alquiler.locator('[data-category-dot]')).toHaveAttribute('data-category-dot', 'granate')
})

test('the composers add an income and an expense in a category', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=4&e2eSeed=1')
  const incomeForm = income(page).getByRole('form', { name: 'Lo que cobras' })
  await incomeForm.getByLabel('Nombre').fill('Propina')
  await incomeForm.getByLabel('Monto').fill('50')
  await incomeForm.getByLabel('Día').fill('5')
  await incomeForm.getByRole('button', { name: 'Añadir' }).click()
  await expect(income(page).getByRole('listitem', { name: 'Propina · día 5' })).toBeVisible()

  const expenseForm = expenses(page).getByRole('form', { name: 'Lo que pagas todos los meses' })
  await expenseForm.getByLabel('Nombre').fill('Súper')
  await expenseForm.getByLabel('Monto').fill('300')
  await expenseForm.getByRole('radio', { name: 'Comida' }).click()
  await expenseForm.getByRole('button', { name: 'Añadir' }).click()
  const row = expenses(page).getByRole('listitem', { name: 'Súper · día 1' })
  await expect(row).toBeVisible()
  await expect(row.locator('[data-category-dot]')).toHaveAttribute('data-category-dot', 'rojo')
})

test('without a category the expense composer is replaced by a line and the income one works', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=4')
  await expect(expenses(page).getByText('Para cargar fijos, primero añade una categoría.')).toBeVisible()
  await expect(expenses(page).getByRole('form')).toHaveCount(0)
  const incomeForm = income(page).getByRole('form', { name: 'Lo que cobras' })
  await incomeForm.getByLabel('Nombre').fill('Sueldo')
  await incomeForm.getByLabel('Monto').fill('2000')
  await incomeForm.getByRole('button', { name: 'Añadir' }).click()
  await expect(income(page).getByRole('listitem', { name: 'Sueldo · día 1' })).toBeVisible()
})

test('income glows green; expenses glow red until a category is chosen, then in its colour', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=4&e2eSeed=1')
  await expect(income(page).locator('.animate-star-top')).toHaveAttribute('style', /var\(--brand\)/)
  const glow = expenses(page).locator('.animate-star-top')
  await expect(glow).toHaveAttribute('style', /var\(--destructive\)/)
  const vivienda = expenses(page).getByRole('radio', { name: 'Vivienda' })
  const comida = expenses(page).getByRole('radio', { name: 'Comida' })
  // Nothing chosen up front, so "Añadir" waits for a category.
  await expect(vivienda).toHaveAttribute('aria-checked', 'false')
  await expect(comida).toHaveAttribute('aria-checked', 'false')
  const form = expenses(page).getByRole('form')
  await form.getByLabel('Nombre').fill('Luz')
  await form.getByLabel('Monto').fill('60')
  await expect(form.getByRole('button', { name: 'Añadir' })).toBeDisabled()

  await vivienda.click()
  await expect(vivienda).toHaveAttribute('style', /--cat-granate/)
  await expect(glow).toHaveAttribute('style', /--cat-granate/)
  await expect(form.getByRole('button', { name: 'Añadir' })).toBeEnabled()

  await comida.click()
  await expect(comida).toHaveAttribute('aria-checked', 'true')
  await expect(comida).toHaveAttribute('style', /--cat-rojo/)
  await expect(vivienda).not.toHaveAttribute('style', /--cat-/)
  await expect(glow).toHaveAttribute('style', /--cat-rojo/)

  // With rows above, the composer keeps its hairline; with none, it has no border to poke past the corners.
  await expect(expenses(page).getByRole('form')).toHaveCSS('border-top-width', '1px')
  await page.goto('/demo/onboarding?paso=4')
  await expect(income(page).getByRole('form')).toHaveCSS('border-top-width', '0px')
})

test('a swipe deletes an income or an expense, and undo brings it back as it was', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=4&e2eSeed=1')
  await longSwipe(page, income(page).getByRole('listitem').filter({ hasText: 'Sueldo' }))
  await expect(page.getByText('Se eliminó Sueldo')).toBeVisible()
  await expect(income(page).getByRole('listitem', { name: 'Sueldo · día 1' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Deshacer' }).click()
  const sueldo = income(page).getByRole('listitem', { name: 'Sueldo · día 1' })
  await expect(sueldo).toBeVisible()
  await expect(sueldo).toContainText(/2\.000\s?€/)

  await longSwipe(page, expenses(page).getByRole('listitem').filter({ hasText: 'Alquiler' }))
  await expect(page.getByText('Se eliminó Alquiler')).toBeVisible()
  await expect(expenses(page).getByRole('listitem', { name: 'Alquiler · día 1' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Deshacer' }).click()
  const alquiler = expenses(page).getByRole('listitem', { name: 'Alquiler · día 1' })
  await expect(alquiler).toBeVisible()
  await expect(alquiler.locator('[data-category-dot]')).toHaveAttribute('data-category-dot', 'granate')
})

test('a tap on a row opens nothing: rows are deleted by swiping, edited later in the dashboard', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=4&e2eSeed=1')
  await expenses(page).getByRole('listitem', { name: 'Alquiler · día 1' }).click()
  await income(page).getByRole('listitem', { name: 'Sueldo · día 1' }).click()
  await page.waitForTimeout(600)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
