// @ts-check
import { test, expect } from '@playwright/test'
import { longSwipe } from './onboarding-helpers.js'

test.use({ viewport: { width: 390, height: 844 } })

// `onboarding` → *Categories step*, on `/demo/onboarding?paso=3`.

function list(page) {
  return page.getByRole('list', { name: 'Categorías' })
}

function suggestions(page) {
  return page.getByRole('group', { name: 'Sugerencias' })
}

test('a suggestion becomes a category, in palette order, and leaves the chips', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=3')
  await expect(list(page)).toHaveCount(0)
  await suggestions(page).getByRole('button', { name: 'Comida', exact: true }).click()
  await expect(list(page).getByRole('listitem')).toHaveCount(1)
  await expect(list(page)).toContainText('Comida')
  await expect(suggestions(page).getByRole('button', { name: 'Comida', exact: true })).toHaveCount(0)

  await suggestions(page).getByRole('button', { name: 'Vivienda', exact: true }).click()
  await suggestions(page).getByRole('button', { name: 'Ocio', exact: true }).click()
  await expect(list(page).getByRole('listitem')).toHaveCount(3)
  // The first three palette colours, in order (`CATEGORY_COLORS`).
  const dots = list(page).locator('[data-category-dot]')
  await expect(dots.nth(0)).toHaveAttribute('data-category-dot', 'granate')
  await expect(dots.nth(1)).toHaveAttribute('data-category-dot', 'rojo')
  await expect(dots.nth(2)).toHaveAttribute('data-category-dot', 'coral')
})

test('the composer creates a typed name and refuses a duplicate', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=3')
  const field = page.getByLabel('Nombre de la categoría')
  await field.fill('Mascotas')
  await page.getByRole('button', { name: 'Añadir' }).click()
  await expect(list(page)).toContainText('Mascotas')
  await expect(field).toHaveValue('')

  await suggestions(page).getByRole('button', { name: 'Comida', exact: true }).click()
  await field.fill(' comida ')
  await page.getByRole('button', { name: 'Añadir' }).click()
  await expect(page.getByText('Ya existe una categoría con este nombre')).toBeVisible()
  await expect(list(page).getByRole('listitem')).toHaveCount(2)
})

test('swipe to delete with undo brings the category back with its colour', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=3')
  await suggestions(page).getByRole('button', { name: 'Ocio', exact: true }).click()
  const row = list(page).getByRole('listitem').filter({ hasText: 'Ocio' })
  await expect(row).toBeVisible()
  await longSwipe(page, row)
  await expect(page.getByText('Categoría eliminada')).toBeVisible()
  await expect(list(page)).toHaveCount(0)

  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(list(page)).toContainText('Ocio')
  await expect(list(page).locator('[data-category-dot]')).toHaveAttribute('data-category-dot', 'granate')
})

test('a category holding a fixed expense cannot be swiped away', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=3&e2eSeed=1')
  const row = list(page).getByRole('listitem').filter({ hasText: 'Vivienda' })
  await longSwipe(page, row)
  await expect(page.getByText('Primero quita sus gastos fijos')).toBeVisible()
  await expect(list(page)).toContainText('Vivienda')
})

test('a name is renamed in place', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=3')
  await suggestions(page).getByRole('button', { name: 'Comida', exact: true }).click()
  await page.getByRole('button', { name: 'Cambiar el nombre de Comida' }).click()
  const input = page.getByRole('textbox', { name: 'Cambiar el nombre de Comida' })
  await input.fill('Mercado')
  await input.press('Enter')
  await expect(list(page)).toContainText('Mercado')
  await expect(list(page)).not.toContainText('Comida')
})
