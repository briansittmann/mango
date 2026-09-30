// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

// Changes to a row that belongs to a definition (`add-forward-scoped-edits`, `recurring-expenses`
// → *Every change to a recurring row asks how far it reaches*) on `/demo`: September 2026 is the
// sample (free margin 864 €), and "Gimnasio" is 40 € on the 22nd, pending.

function dialog(page) {
  return page.locator('div[role="dialog"][data-open]')
}

function body(page) {
  return page.evaluate(() => {
    const copy = document.body.cloneNode(true)
    copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove())
    return copy.textContent.replace(/\s+/g, ' ')
  })
}

const title = (page) => page.locator('[data-month-picker-trigger]').last()

async function move(page, direction, times = 1) {
  for (let i = 0; i < times; i++) {
    const before = await title(page).textContent()
    await page.locator(`button[aria-label="${direction === 'next' ? 'Ciclo siguiente' : 'Ciclo anterior'}"]`).last().click()
    await expect(title(page)).not.toHaveText(before ?? '')
  }
}

async function openCard(page, id) {
  const toggle = page.locator(`button[aria-controls="category-panel-${id}"]`)
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  return page.locator(`#category-panel-${id}`)
}

async function openRow(page, id, name) {
  const panel = await openCard(page, id)
  await panel.getByRole('button', { name: new RegExp(name) }).click()
  return dialog(page)
}

async function longSwipe(page, row) {
  const box = await row.boundingBox()
  if (!box) throw new Error('row not visible')
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width - 10, y)
  await page.mouse.down()
  await page.mouse.move(box.x + 10, y, { steps: 12 })
  await page.mouse.up()
}

test('the question gates the save of a fixed charge', async ({ page }) => {
  await page.goto('/demo')
  const sheet = await openRow(page, 'salud', 'Gimnasio')
  await expect(sheet.getByText('Salud · Se repite cada mes')).toBeVisible()
  await sheet.getByLabel('Importe').fill('45')

  const only = sheet.getByRole('radio', { name: 'Solo este mes' })
  const onward = sheet.getByRole('radio', { name: 'Desde este mes en adelante' })
  await expect(only).not.toBeChecked()
  await expect(onward).not.toBeChecked()
  const save = sheet.getByRole('button', { name: 'Guardar', exact: true })
  await expect(save).toBeDisabled()

  await sheet.getByText('Desde este mes en adelante').click()
  await expect(save).toBeEnabled()
  await save.click()
  await expect(sheet).toBeHidden()
  await expect(page.locator('div[role="status"].sr-only')).toHaveText('Cambios guardados desde septiembre')
  await expect(page.locator('#category-amount-salud')).toContainText('45')

  await move(page, 'next')
  await expect(await openCard(page, 'salud')).toContainText(/Gimnasio[\s\S]*45/)
})

test('no question for a plain expense', async ({ page }) => {
  await page.goto('/demo')
  const sheet = await openRow(page, 'ocio', 'Cine')
  await sheet.getByLabel('Importe').fill('50')
  await expect(sheet.getByRole('radio', { name: 'Solo este mes' })).toHaveCount(0)
  await expect(sheet.getByRole('button', { name: 'Guardar', exact: true })).toBeEnabled()
})

test('from December on leaves October and November as they were', async ({ page }) => {
  await page.goto('/demo')
  await move(page, 'next', 3)
  await expect(title(page)).toContainText(/diciembre/i)
  const sheet = await openRow(page, 'salud', 'Gimnasio')
  await expect(sheet.getByLabel('Importe')).toHaveValue('40')
  await sheet.getByLabel('Importe').fill('50')
  await sheet.getByText('Desde este mes en adelante').click()
  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect(await openCard(page, 'salud')).toContainText(/Gimnasio[\s\S]*50/)

  await move(page, 'next')
  await expect(await openCard(page, 'salud')).toContainText(/Gimnasio[\s\S]*50/)
  await move(page, 'previous', 2)
  await expect(title(page)).toContainText(/noviembre/i)
  await expect(await openCard(page, 'salud')).toContainText(/Gimnasio[\s\S]*40/)
})

test('swiping a projected charge deletes that month only, and undo brings it back', async ({ page }) => {
  await page.goto('/demo')
  await move(page, 'next', 2)
  const panel = await openCard(page, 'transporte')
  await longSwipe(page, panel.getByRole('button', { name: /Parking/ }))
  await expect(page.getByText('Solo se borró el de este mes')).toBeVisible()
  await expect(panel).not.toContainText('Parking')

  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(panel).toContainText('Parking')
  // The restored row grows in from zero height: measure it once it has settled.
  await panel.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))

  await longSwipe(page, panel.getByRole('button', { name: /Parking/ }))
  await expect(panel).not.toContainText('Parking')
  await move(page, 'next')
  await expect(await openCard(page, 'transporte')).toContainText('Parking')
})

test('deleting a fixed charge asks the scope in a confirmation step', async ({ page }) => {
  await page.goto('/demo')
  const sheet = await openRow(page, 'salud', 'Gimnasio')
  await sheet.getByRole('button', { name: 'Eliminar gasto' }).click()

  // The header keeps the sheet's own "Cancelar" (close) on the left; the step's is on the right.
  const cancel = sheet.getByRole('button', { name: 'Cancelar' }).last()
  await expect(cancel).toBeFocused()
  const remove = sheet.getByRole('button', { name: 'Eliminar', exact: true })
  await expect(remove).toBeDisabled()

  await cancel.click()
  await expect(sheet.getByLabel('Importe')).toBeVisible()

  await sheet.getByRole('button', { name: 'Eliminar gasto' }).click()
  await sheet.getByText('Solo este mes').click()
  await expect(remove).toBeEnabled()
  await remove.click()
  await expect(sheet).toBeHidden()
  await expect(page.getByText('Solo se borró el de este mes')).toBeVisible()
  await expect(page.locator('#category-panel-salud')).not.toContainText('Gimnasio')

  await move(page, 'next')
  await expect(await openCard(page, 'salud')).toContainText('Gimnasio')
})

test('a raise of a fixed income from December on', async ({ page }) => {
  await page.goto('/demo')
  await move(page, 'next', 3)
  await page.getByRole('button', { name: /^Ingresos/ }).click()
  await page.locator('#summary-group-panel').getByRole('button', { name: /^Salario/ }).click()
  const sheet = dialog(page)
  await expect(sheet.getByText('Se repite cada mes')).toBeVisible()
  await sheet.getByLabel('Importe').fill('2600')
  await sheet.getByText('Desde este mes en adelante').click()
  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect.poll(() => body(page)).toMatch(/Ingresos\s*2\.600\s?€/)

  await move(page, 'previous')
  await expect.poll(() => body(page)).toMatch(/Ingresos\s*2\.400\s?€/)
})
