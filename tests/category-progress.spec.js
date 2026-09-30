// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

// "Ocultar barra de progreso" is a stored preference of the category (0027): on /demo it lives in
// the in-memory edits, so it holds across cycles within the page; /dashboard reads it from the DB.

const title = (page) => page.locator('[data-month-picker-trigger]').last()
const progress = (page) => page.locator('#category-progress-comida > div')

async function move(page, direction) {
  const before = await title(page).textContent()
  await page.locator(`button[aria-label="${direction === 'next' ? 'Ciclo siguiente' : 'Ciclo anterior'}"]`).last().click()
  await expect(title(page)).not.toHaveText(before ?? '')
}

async function toggle(page, label) {
  await page.getByRole('button', { name: /^Opciones de Comida$/ }).click()
  const sheet = page.locator('div[role="dialog"][data-open]')
  await sheet.getByRole('button', { name: label }).click()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
}

test('a hidden bar stays hidden in every cycle until it is shown again', async ({ page }) => {
  await page.goto('/demo')
  await expect(progress(page)).not.toHaveAttribute('inert', '')

  await toggle(page, 'Ocultar barra de progreso')
  await expect(progress(page)).toHaveAttribute('inert', '')

  await move(page, 'next')
  await expect(progress(page)).toHaveAttribute('inert', '')
  await move(page, 'previous')
  await expect(progress(page)).toHaveAttribute('inert', '')

  await toggle(page, 'Mostrar barra de progreso')
  await expect(progress(page)).not.toHaveAttribute('inert', '')
})
