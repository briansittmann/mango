// @ts-check
import { test, expect } from '@playwright/test'

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
  const sueldo = income(page).getByRole('button', { name: 'Sueldo · día 1' })
  await expect(sueldo).toBeVisible()
  await expect(sueldo).toContainText(/2\.000\s?€/)
  const alquiler = expenses(page).getByRole('button', { name: 'Alquiler · día 1' })
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
  await expect(income(page).getByRole('button', { name: 'Propina · día 5' })).toBeVisible()

  const expenseForm = expenses(page).getByRole('form', { name: 'Lo que pagas todos los meses' })
  await expenseForm.getByLabel('Nombre').fill('Súper')
  await expenseForm.getByLabel('Monto').fill('300')
  await expenseForm.getByRole('radio', { name: 'Comida' }).click()
  await expenseForm.getByRole('button', { name: 'Añadir' }).click()
  const row = expenses(page).getByRole('button', { name: 'Súper · día 1' })
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
  await expect(income(page).getByRole('button', { name: 'Sueldo · día 1' })).toBeVisible()
})

test('a row opens the definition sheet, which saves and deletes', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=4&e2eSeed=1')
  await expenses(page).getByRole('button', { name: 'Alquiler · día 1' }).click()
  const sheet = page.locator('div[role="dialog"][data-open]')
  await expect(sheet).toBeVisible()
  await sheet.getByLabel('Monto esperado').fill('850')
  await sheet.getByRole('button', { name: 'Guardar' }).click()
  await expect(sheet).toBeHidden()
  await expect(expenses(page).getByRole('button', { name: 'Alquiler · día 1' })).toContainText(/850\s?€/)

  await expenses(page).getByRole('button', { name: 'Alquiler · día 1' }).click()
  await sheet.getByRole('button', { name: 'Eliminar y borrar el historial' }).click()
  await sheet.getByRole('button', { name: 'Eliminar', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect(expenses(page).getByRole('button', { name: 'Alquiler · día 1' })).toHaveCount(0)
})
