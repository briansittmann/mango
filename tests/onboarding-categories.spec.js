// @ts-check
import { test, expect } from '@playwright/test'
import { fillBasics, longSwipe, takeChip } from './onboarding-helpers.js'

test.use({ viewport: { width: 390, height: 844 } })

// `onboarding` → *Categories step*, on `/demo/onboarding?paso=3`.

function list(page) {
  return page.getByRole('list', { name: 'Categorías' })
}

function suggestions(page) {
  return page.getByRole('group', { name: 'Sugerencias' })
}

const PALETTE = [
  'granate', 'rojo', 'coral', 'rosa', 'naranja_calido', 'violeta_metalico', 'azul_electrico', 'azul_apagado',
  'celeste', 'turquesa', 'verde_menta', 'verde_profundo', 'gris_calido', 'gris_oscuro', 'blanco',
]

test('a suggestion hands its colour to the category it becomes, and leaves the chips', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=3')
  await expect(list(page)).toHaveCount(0)
  // Every chip wears a distinct vivid colour on its border.
  const chipColours = await suggestions(page).getByRole('button').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-chip-color')))
  expect(chipColours).toHaveLength(8)
  expect(new Set(chipColours).size).toBe(8)
  for (const colour of chipColours) expect(PALETTE.slice(0, 12)).toContain(colour)
  const comidaColour = await suggestions(page).getByRole('button', { name: 'Comida', exact: true }).getAttribute('data-chip-color')

  await takeChip(page, 'Comida')
  await expect(list(page).getByRole('listitem')).toHaveCount(1)
  await expect(list(page)).toContainText('Comida')
  await expect(suggestions(page).getByRole('button', { name: 'Comida', exact: true })).toHaveCount(0)
  await expect(list(page).locator('[data-category-dot]')).toHaveAttribute('data-category-dot', comidaColour ?? '')

  await takeChip(page, 'Vivienda')
  await takeChip(page, 'Ocio')
  await expect(list(page).getByRole('listitem')).toHaveCount(3)
  // Three distinct palette colours; the row's border carries the same colour as its dot.
  const dots = list(page).locator('[data-category-dot]')
  const colours = await dots.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-category-dot')))
  expect(new Set(colours).size).toBe(3)
  for (const colour of colours) expect(PALETTE).toContain(colour)
  const borders = await list(page).locator('.onboarding-row').evaluateAll((nodes) => nodes.map((node) => node.style.borderColor))
  expect(borders).toEqual(colours.map((colour) => `var(--cat-${colour})`))
})

test('nothing is written before "Continuar"; the list is stored on it', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=3')
  await takeChip(page, 'Comida')
  await takeChip(page, 'Ocio')
  // The cycle day stays editable while the draft is unsaved (nothing is keyed to the cycle yet).
  await page.getByRole('button', { name: 'Volver' }).click()
  await expect(page.getByLabel('Día de inicio')).not.toHaveAttribute('readonly')
  await fillBasics(page)
  await page.locator('[data-primary]').click()
  await expect(list(page).getByRole('listitem')).toHaveCount(2)
  await page.locator('[data-primary]').click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4')
  await page.getByRole('button', { name: 'Volver' }).click()
  await page.getByRole('button', { name: 'Volver' }).click()
  await expect(page.getByLabel('Día de inicio')).toHaveAttribute('readonly', '')
})

test('the handle moves a row in place with the keyboard and the pointer, with no mode to enter', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=3')
  await takeChip(page, 'Comida')
  await takeChip(page, 'Vivienda')
  await takeChip(page, 'Ocio')

  const handle = page.getByRole('button', { name: 'Mover Comida, posición 1 de 3' })
  await handle.focus()
  await handle.press('ArrowDown')
  await expect(list(page).getByRole('listitem')).toHaveText(['Vivienda', 'Comida', 'Ocio'])
  await expect(page.locator('div[role="status"].sr-only')).toHaveText('Comida, posición 2 de 3')

  // The keyboard move travels as a FLIP; the pointer drag measures rows at rest. The computed
  // transform, not the inline one: the FLIP clears the inline value to start its transition.
  await expect
    .poll(() => list(page).getByRole('listitem').evaluateAll((nodes) => nodes.every((node) => getComputedStyle(node).transform === 'none')))
    .toBe(true)
  const ocio = page.getByRole('button', { name: 'Mover Ocio, posición 3 de 3' })
  const from = await ocio.boundingBox()
  const first = await list(page).getByRole('listitem').first().boundingBox()
  if (!from || !first) throw new Error('rows not visible')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2, first.y + first.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect(list(page).getByRole('listitem')).toHaveText(['Ocio', 'Vivienda', 'Comida'])

  // No blur and nothing pushed back: the chips, the composer and the rows stay interactive.
  await expect(page.getByLabel('Nombre de la categoría')).toBeEditable()
  await expect(page.getByRole('button', { name: 'Cambiar el nombre de Ocio' })).toBeEnabled()
  // The order survives "Continuar".
  await page.locator('[data-primary]').click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4')
  await page.getByRole('button', { name: 'Volver' }).click()
  await expect(list(page).getByRole('listitem')).toHaveText(['Ocio', 'Vivienda', 'Comida'])
})

test('the composer creates a typed name and refuses a duplicate', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=3')
  const field = page.getByLabel('Nombre de la categoría')
  await field.fill('Mascotas')
  await page.getByRole('button', { name: 'Añadir' }).click()
  await expect(list(page)).toContainText('Mascotas')
  await expect(field).toHaveValue('')

  await takeChip(page, 'Comida')
  await field.fill(' comida ')
  await page.getByRole('button', { name: 'Añadir' }).click()
  await expect(page.getByText('Ya existe una categoría con este nombre')).toBeVisible()
  await expect(list(page).getByRole('listitem')).toHaveCount(2)
})

test('swipe to delete with undo brings the category back with its colour', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=3')
  await takeChip(page, 'Ocio')
  const row = list(page).getByRole('listitem').filter({ hasText: 'Ocio' })
  await expect(row).toBeVisible()
  const colour = await list(page).locator('[data-category-dot]').getAttribute('data-category-dot')
  await longSwipe(page, row)
  await expect(page.getByText('Categoría eliminada')).toBeVisible()
  await expect(list(page)).toHaveCount(0)
  // Its chip is back while the category is gone.
  await expect(suggestions(page).getByRole('button', { name: 'Ocio', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(list(page)).toContainText('Ocio')
  await expect(list(page).locator('[data-category-dot]')).toHaveAttribute('data-category-dot', colour ?? '')
})

test('a category holding a fixed expense cannot be swiped away', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=3&e2eSeed=1')
  const row = list(page).getByRole('listitem').filter({ hasText: 'Vivienda' })
  await longSwipe(page, row)
  await expect(page.getByText('Primero quita sus gastos fijos').first()).toBeVisible()
  await expect(list(page)).toContainText('Vivienda')
})

test('a name is renamed in place', async ({ page }) => {
  await page.goto('/demo/onboarding?paso=3')
  await takeChip(page, 'Comida')
  await page.getByRole('button', { name: 'Cambiar el nombre de Comida' }).click()
  const input = page.getByRole('textbox', { name: 'Cambiar el nombre de Comida' })
  await input.fill('Mercado')
  await input.press('Enter')
  await expect(list(page)).toContainText('Mercado')
  await expect(list(page)).not.toContainText('Comida')
})
