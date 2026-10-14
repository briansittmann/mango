// @ts-check
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { sheet as dialog } from './widgets-helpers'
import { loadDesktop } from './desktop-helpers'

// `recurring-expenses` → *One sheet for a fixed row*, *Marking a charge as charged* and the
// recurrence switch in edit mode (`unify-fixed-charge-sheet`), on `/demo` in Spanish: Alquiler (1),
// Internet (3) and Seguro (8, 4 de 10) are taken; Parking (15, Transporte), Limpieza (20) and
// Gimnasio (22, Salud) are pending. Free margin 864 €.

const header = (page) => page.locator('button[aria-controls="upcoming-charges-panel"]')
const fold = (page) => page.locator('button[aria-controls="upcoming-charges-taken"]')
const panel = (page) => page.locator('#upcoming-charges-panel')
const chargeRow = (page, name) => panel(page).locator('button[aria-label]').filter({ has: page.getByText(name, { exact: true }) })
const pendingNames = (page) =>
  panel(page)
    .locator('button[aria-label]')
    .evaluateAll((els) => els.filter((el) => !el.closest('#upcoming-charges-taken')).map((el) => el.getAttribute('aria-label')?.split(' · ')[0]))
const summary = (page) => dialog(page).locator('[data-fixed-summary]')

// Totals are rolling counters: the aria-hidden digit columns are stripped before matching.
function body(page) {
  return page.evaluate(() => {
    const copy = document.body.cloneNode(true)
    copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove())
    return copy.textContent.replace(/\s+/g, ' ')
  })
}

async function openUpcoming(page) {
  await header(page).scrollIntoViewIfNeeded()
  if ((await header(page).getAttribute('aria-expanded')) !== 'true') await header(page).click()
  await expect(header(page)).toHaveAttribute('aria-expanded', 'true')
  await panel(page).evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
}

async function fromUpcoming(page, name) {
  await openUpcoming(page)
  if (!(await pendingNames(page)).includes(name) && (await fold(page).getAttribute('aria-expanded')) !== 'true') {
    await fold(page).click()
    await expect(fold(page)).toHaveAttribute('aria-expanded', 'true')
    // The taken rows slide open; a press mid-transition can land beside the row.
    await panel(page).evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
  }
  await chargeRow(page, name).click()
  await expect(dialog(page)).toBeVisible()
  return dialog(page)
}

async function fromCard(page, categoryId, name) {
  const cardHeader = page.locator(`[aria-controls="category-panel-${categoryId}"]`)
  await cardHeader.scrollIntoViewIfNeeded()
  if ((await cardHeader.getAttribute('aria-expanded')) !== 'true') await cardHeader.click()
  await page.locator(`#category-panel-${categoryId}`).getByRole('button', { name: new RegExp(name) }).first().click()
  await expect(dialog(page)).toBeVisible()
  return dialog(page)
}

async function close(page) {
  await dialog(page).getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog(page)).toBeHidden()
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/demo')
  })

  test('"Parking" opens the same sheet from "Próximos cobros" and from its card', async ({ page }) => {
    for (const open of [() => fromUpcoming(page, 'Parking'), () => fromCard(page, 'transporte', 'Parking')]) {
      const sheet = await open()
      await expect(sheet.getByText('Editar gasto')).toBeVisible()
      await expect(sheet.getByText('Transporte · Se repite cada mes')).toBeVisible()
      await expect(sheet.getByLabel('Importe')).toHaveValue('50')
      await expect(sheet.getByLabel('Fecha')).toHaveAttribute('data-value', '2026-09-15')
      await expect(summary(page)).toHaveText(/50\s?€ cada mes, el día 15/)
      await expect(sheet.getByRole('switch', { name: 'Cobrado este mes' })).toHaveAttribute('aria-checked', 'false')
      await expect(sheet.getByRole('switch', { name: 'Recordatorio' })).toBeVisible()
      await expect(sheet.getByRole('button', { name: 'Dejar de repetir' })).toBeVisible()
      await expect(sheet.getByRole('button', { name: 'Eliminar gasto' })).toBeVisible()
      await close(page)
    }
  })

  test('a plan states its progress and what is left, live once it is for every month', async ({ page }) => {
    const sheet = await fromUpcoming(page, 'Seguro')
    await expect(summary(page)).toContainText('4 de 10')
    await expect(summary(page)).toContainText(/quedan 6 pagos · 210\s?€/)
    await sheet.getByLabel('Importe').fill('40')
    await sheet.getByText('Desde este mes en adelante').click()
    await expect(summary(page)).toContainText(/quedan 6 pagos · 240\s?€/)
  })

  test('both numbers at once after a one-month change', async ({ page }) => {
    let sheet = await fromCard(page, 'vivienda', 'Alquiler')
    await sheet.getByLabel('Importe').fill('880')
    await sheet.getByText('Solo este mes').click()
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet).toBeHidden()
    sheet = await fromUpcoming(page, 'Alquiler')
    await expect(sheet.getByLabel('Importe')).toHaveValue('880')
    await expect(summary(page)).toHaveText(/820\s?€ cada mes, el día 1/)
    await expect(sheet.getByRole('switch', { name: 'Cobrado este mes' })).toHaveAttribute('aria-checked', 'true')
  })

  test('a fixed income entry shows the section without mark or reminder', async ({ page }) => {
    await page.locator('[aria-controls="summary-group-panel"]').filter({ hasText: /^Ingresos/ }).click()
    await page.locator('#summary-group-panel').getByRole('button', { name: /Salario/ }).click()
    const sheet = dialog(page)
    await expect(summary(page)).toHaveText(/2\.400\s?€ cada mes, el día 1/)
    await expect(sheet.getByRole('button', { name: 'Dejar de repetir' })).toBeVisible()
    await expect(sheet.getByRole('switch', { name: 'Cobrado este mes' })).toHaveCount(0)
    await expect(sheet.getByRole('switch', { name: 'Recordatorio' })).toHaveCount(0)
  })

  test('"Cobrado este mes" waits for "Guardar", and turns back off the same way', async ({ page }) => {
    let sheet = await fromUpcoming(page, 'Parking')
    const toggle = sheet.getByRole('switch', { name: 'Cobrado este mes' })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await expect(toggle).toHaveAttribute('data-on', 'true')
    await expect(sheet).toBeVisible()
    expect(await pendingNames(page)).toEqual(['Parking', 'Limpieza', 'Gimnasio'])
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByText('Parking: cobrado este mes')).toBeVisible()
    await expect.poll(() => pendingNames(page)).toEqual(['Limpieza', 'Gimnasio'])
    await expect(fold(page)).toHaveText('4 cobrados')
    await expect.poll(() => body(page)).toMatch(/Margen libre\s*864\s?€/)

    sheet = await fromUpcoming(page, 'Parking')
    await expect(sheet.getByRole('switch', { name: 'Cobrado este mes' })).toHaveAttribute('aria-checked', 'true')
    await sheet.getByRole('switch', { name: 'Cobrado este mes' }).click()
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByText('Parking: pendiente este mes')).toBeVisible()
    await expect.poll(() => pendingNames(page)).toEqual(['Parking', 'Limpieza', 'Gimnasio'])
  })

  test('a charge taken by its date can be marked not charged', async ({ page }) => {
    const sheet = await fromUpcoming(page, 'Internet')
    await sheet.getByRole('switch', { name: 'Cobrado este mes' }).click()
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet).toBeHidden()
    await expect.poll(() => pendingNames(page)).toEqual(['Internet', 'Parking', 'Limpieza', 'Gimnasio'])
    await expect(fold(page)).toHaveText('2 cobrados')
  })

  test('changing a pending charge\'s amount keeps it pending with the switch off', async ({ page }) => {
    const sheet = await fromUpcoming(page, 'Parking')
    await sheet.getByLabel('Importe').fill('55')
    await sheet.getByText('Solo este mes').click()
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet).toBeHidden()
    await expect.poll(() => pendingNames(page)).toEqual(['Parking', 'Limpieza', 'Gimnasio'])
  })

  test('the question is asked from "Próximos cobros" too, and "from this month on" reaches the definition', async ({ page }) => {
    const sheet = await fromUpcoming(page, 'Gimnasio')
    await sheet.getByLabel('Importe').fill('45')
    await expect(sheet.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    await sheet.getByText('Desde este mes en adelante').click()
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.locator('div[role="status"].sr-only')).toHaveText(/septiembre/)
    await fromUpcoming(page, 'Gimnasio')
    await expect(summary(page)).toHaveText(/45\s?€ cada mes, el día 22/)
  })

  test('the reminder saves on its own, without the question and without confirming the charge', async ({ page }) => {
    let sheet = await fromUpcoming(page, 'Parking')
    await sheet.getByRole('switch', { name: 'Recordatorio' }).click()
    await sheet.getByLabel('Días antes').fill('2')
    // The scope question folds into a `Collapsible`, kept in the DOM under `inert`.
    expect(await sheet.getByText('Solo este mes').evaluate((el) => el.closest('[inert]') != null)).toBe(true)
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet).toBeHidden()
    expect(await pendingNames(page)).toContain('Parking')
    sheet = await fromUpcoming(page, 'Parking')
    await expect(sheet.getByRole('switch', { name: 'Recordatorio' })).toHaveAttribute('aria-checked', 'true')
    await expect(sheet.getByLabel('Días antes')).toHaveValue('2')
  })

  test('saving nothing confirms nothing', async ({ page }) => {
    const sheet = await fromUpcoming(page, 'Gimnasio')
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet).toBeHidden()
    expect(await pendingNames(page)).toContain('Gimnasio')
  })

  test('stop repeating keeps this month and leaves the projection', async ({ page }) => {
    const sheet = await fromUpcoming(page, 'Gimnasio')
    await sheet.getByRole('button', { name: 'Dejar de repetir' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.locator('#category-panel-salud')).toContainText('Gimnasio')
    await page.locator('button[aria-label="Ciclo siguiente"]').last().click()
    await expect(page.locator('[data-month-picker-trigger]').last()).toContainText(/octubre/i)
    await openUpcoming(page)
    await expect(chargeRow(page, 'Gimnasio')).toHaveCount(0)
  })

  test('delete offers three reaches, and "every month" takes the history with no undo', async ({ page }) => {
    const sheet = await fromUpcoming(page, 'Parking')
    await sheet.getByRole('button', { name: 'Eliminar gasto' }).click()
    await expect(sheet.getByRole('button', { name: 'Cancelar' }).last()).toBeFocused()
    for (const label of ['Solo este mes', 'Desde este mes en adelante', 'Todos los meses, también los anteriores']) {
      await expect(sheet.getByText(label)).toBeVisible()
    }
    await expect(sheet.getByRole('button', { name: 'Eliminar', exact: true })).toBeDisabled()
    await sheet.getByText('Todos los meses, también los anteriores').click()
    await sheet.getByRole('button', { name: 'Eliminar', exact: true }).click()
    await expect(sheet).toBeHidden()
    await expect(chargeRow(page, 'Parking')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Deshacer' })).toHaveCount(0)
    await page.locator('button[aria-label="Ciclo siguiente"]').last().click()
    await expect(page.locator('[data-month-picker-trigger]').last()).toContainText(/octubre/i)
    await openUpcoming(page)
    await expect(chargeRow(page, 'Parking')).toHaveCount(0)
  })

  test('an entered expense becomes fixed, as one row', async ({ page }) => {
    const sheet = await fromCard(page, 'transporte', 'Gasolina')
    const toggle = sheet.getByRole('switch', { name: 'Se repite todos los meses' })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await toggle.click()
    await expect(sheet.getByLabel('Día del mes')).toHaveValue('4')
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet).toBeHidden()

    await expect(page.locator('#category-panel-transporte').getByRole('button', { name: /Gasolina/ })).toHaveCount(1)
    await expect.poll(() => body(page)).toMatch(/Margen libre\s*864\s?€/)
    await openUpcoming(page)
    await expect(fold(page)).toHaveText('4 cobrados')
    const again = await fromCard(page, 'transporte', 'Gasolina')
    await expect(again.getByRole('switch', { name: 'Se repite todos los meses' })).toHaveCount(0)
    await expect(summary(page)).toHaveText(/80\s?€ cada mes, el día 4/)
  })

  test('an income entered once becomes monthly', async ({ page }) => {
    await page.locator('[aria-controls="summary-group-panel"]').filter({ hasText: /^Ingresos/ }).click()
    await page.locator('#summary-group-panel').getByRole('button', { name: /Freelance/ }).click()
    const sheet = dialog(page)
    await sheet.getByRole('switch', { name: 'Se repite todos los meses' }).click()
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.locator('#summary-group-panel').getByRole('button', { name: /Freelance/ })).toHaveCount(1)
    await expect.poll(() => body(page)).toMatch(/Ingresos\s*2\.820\s?€/)
    await page.locator('button[aria-label="Ciclo siguiente"]').last().click()
    await expect(page.locator('[data-month-picker-trigger]').last()).toContainText(/octubre/i)
    await expect.poll(() => body(page)).toMatch(/Freelance/)
  })

  test('no recurrence switch on a projected one-off row', async ({ page }) => {
    await page.locator('button[aria-label="Ciclo siguiente"]').last().click()
    await expect(page.locator('[data-month-picker-trigger]').last()).toContainText(/octubre/i)
    const cardHeader = page.locator('[aria-controls="category-panel-comida"]')
    await cardHeader.click()
    await page.locator('#category-panel-comida').getByRole('button', { name: 'Añadir gasto' }).click()
    let sheet = dialog(page)
    await sheet.getByLabel('Importe').fill('12')
    await sheet.getByLabel('Descripción').fill('Panadería')
    await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
    await expect(sheet).toBeHidden()
    sheet = await fromCard(page, 'comida', 'Panadería')
    await expect(sheet.getByRole('switch', { name: 'Se repite todos los meses' })).toHaveCount(0)
  })

  test('reduced motion: the reminder field is at rest when revealed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const sheet = await fromUpcoming(page, 'Parking')
    await sheet.getByRole('switch', { name: 'Recordatorio' }).click()
    const transition = await sheet.getByLabel('Días antes').evaluate((el) => getComputedStyle(el.closest('.grid')).transitionProperty)
    expect(transition).toBe('none')
  })

  test('no axe violation on the sheet in either theme', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await fromUpcoming(page, 'Seguro')
    await page.evaluate(readFileSync('node_modules/axe-core/axe.min.js', 'utf8'))
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme)
      await page.waitForTimeout(300)
      const violations = await page.evaluate(async () => {
        // @ts-expect-error axe is attached by the evaluated source above
        const result = await window.axe.run(document.querySelector('div[role="dialog"][data-open]'), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })
        return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
      })
      expect(violations, theme).toEqual([])
    }
  })
})

test.describe('on a laptop', () => {
  test('"Parking" opens as a side panel from "Próximos cobros" and marks', async ({ page }) => {
    await loadDesktop(page)
    await openUpcoming(page)
    await chargeRow(page, 'Parking').click()
    const sheet = dialog(page)
    await expect(sheet.locator('[data-fixed-summary]')).toHaveText(/50\s?€ cada mes, el día 15/)
    await sheet.getByRole('switch', { name: 'Cobrado este mes' }).click()
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet).toBeHidden()
    expect(await pendingNames(page)).toEqual(['Limpieza', 'Gimnasio'])
  })
})
