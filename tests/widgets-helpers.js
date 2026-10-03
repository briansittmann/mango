// @ts-check
import { expect } from '@playwright/test'

/** Shared steps for the dashboard widget specs (`spend-insights`, `dashboard-ui`, `design-system`). */

export const BAR_HEIGHT = 56

export function sheet(page) {
  return page.locator('div[role="dialog"][data-open]')
}

/** Opens the entry sheet from a category card and saves an expense; `date` is optional (today by default). */
export async function addExpense(page, categoryId, { amount, description, date }) {
  const header = page.locator(`[aria-controls="category-panel-${categoryId}"]`)
  await header.scrollIntoViewIfNeeded()
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click()
  const panel = page.locator(`#category-panel-${categoryId}`)
  await panel.getByRole('button', { name: 'Añadir gasto' }).click()
  const dialog = sheet(page)
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Importe').fill(amount)
  await dialog.getByLabel('Descripción').fill(description)
  if (date) await dialog.getByLabel('Fecha').fill(date)
  await dialog.getByRole('button', { name: /^(Guardar|Añadir)$/ }).click()
  await expect(dialog).toBeHidden()
}

/** Walks the weekly widget back to its first week. */
export async function goToWeekOne(page) {
  const previous = page.getByRole('button', { name: 'Semana anterior' })
  for (let i = 0; i < 8; i += 1) {
    if (await previous.isDisabled()) return
    await previous.click()
  }
}

export function weeklyBars(page) {
  return page.locator('[data-weekly-bar]')
}

export async function weeklyCaption(page) {
  return (await page.locator('[data-week-caption]').innerText()).replace(/\s+/g, ' ')
}

/** The computed value of a colour token, read through a probe element. */
export async function tokenColor(page, token) {
  return page.evaluate((token) => {
    const probe = document.createElement('span')
    probe.style.color = `var(${token})`
    document.body.appendChild(probe)
    const value = getComputedStyle(probe).color
    probe.remove()
    return value
  }, token)
}

/** Scrolls a widget into view and waits for its first reveal to settle. */
export async function reveal(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded()
  await page.waitForTimeout(1000)
}
