// @ts-check
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { loadDesktop } from './desktop-helpers'

// `savings-editing` → *Editing a savings movement* and *A deposit the user already had*, on `/demo`
// in Spanish: savings 146 € (+176 "Ahorro mensual" on the 3rd, −80 "Retiro emergencia" on the 8th,
// +50 "Bono ahorro" on the 9th), accumulated 2.646 €, free margin 864 €.

function dialog(page) {
  return page.locator('div[role="dialog"][data-open]')
}

// Totals are rolling counters: the aria-hidden digit columns are stripped before matching.
function body(page) {
  return page.evaluate(() => {
    const copy = document.body.cloneNode(true)
    copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove())
    return copy.textContent.replace(/\s+/g, ' ')
  })
}

const figures = (savings, accumulated, margin) => [
  new RegExp(`Ahorro\\s*${savings}\\s?€`),
  new RegExp(`Acumulado\\s*${accumulated}\\s?€`),
  new RegExp(`Margen libre\\s*${margin}\\s?€`),
]

async function expectFigures(page, savings, accumulated, margin) {
  for (const pattern of figures(savings, accumulated, margin)) await expect.poll(() => body(page)).toMatch(pattern)
}

const panel = (page) => page.locator('#summary-group-panel')
const movementRow = (page, name) => panel(page).locator('[data-savings-movement-row]').filter({ hasText: name })
const alreadySaved = (sheet) => sheet.getByRole('switch', { name: 'Ya lo tenía ahorrado' })
// The switch folds into the sheet's `Collapsible`, which keeps it in the DOM under `inert`.
const switchShown = (sheet) => alreadySaved(sheet).evaluate((el) => el.closest('[inert]') == null)

async function openSavings(page, path = '/demo') {
  await page.goto(path)
  await page.locator('[aria-controls="summary-group-panel"]').filter({ hasText: /^Ahorro/ }).click()
  await panel(page).waitFor()
}

async function openMovement(page, name) {
  await movementRow(page, name).click()
  const sheet = dialog(page)
  await expect(sheet.getByText('Editar movimiento')).toBeVisible()
  return sheet
}

async function addMovement(page, { name, amount, kind = 'Depósito', already = false }) {
  await panel(page).getByRole('button', { name: 'Añadir movimiento de ahorro' }).click()
  const sheet = dialog(page)
  await expect(sheet.getByText('Nuevo movimiento')).toBeVisible()
  if (kind !== 'Depósito') await sheet.getByRole('radio', { name: kind }).click()
  if (already) await alreadySaved(sheet).click()
  await sheet.getByLabel('Nombre').fill(name)
  await sheet.getByLabel('Importe').fill(amount)
  await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(sheet).toBeHidden()
}

/** A swipe across the whole panel at the row's height: the name alone is too short to arm it. */
async function longSwipe(page, row) {
  const box = await row.boundingBox()
  const panelBox = await panel(page).boundingBox()
  if (!box || !panelBox) throw new Error('row not visible')
  const y = box.y + box.height / 2
  await page.mouse.move(panelBox.x + panelBox.width - 10, y)
  await page.mouse.down()
  await page.mouse.move(panelBox.x + 10, y, { steps: 12 })
  await page.mouse.up()
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('a deposit opens with its values and the amount selected', async ({ page }) => {
    await openSavings(page)
    const sheet = await openMovement(page, 'Bono ahorro')

    await expect(sheet.getByRole('radio', { name: 'Depósito' })).toHaveAttribute('aria-checked', 'true')
    await expect(sheet.getByLabel('Nombre')).toHaveValue('Bono ahorro')
    await expect(sheet.getByLabel('Importe')).toBeFocused()
    await expect(sheet.getByLabel('Importe')).toHaveValue('50')
    expect(await sheet.getByLabel('Importe').evaluate((el) => el.selectionStart === 0 && el.selectionEnd === el.value.length)).toBe(true)
    await expect(sheet.getByLabel('Fecha')).toHaveAttribute('data-value', '2026-09-09')
    await expect(alreadySaved(sheet)).toHaveAttribute('aria-checked', 'false')
    expect(await switchShown(sheet)).toBe(true)
    await expect(sheet.getByRole('button', { name: 'Eliminar movimiento' })).toBeVisible()
  })

  test('a new amount moves the savings, the accumulated balance and the margin', async ({ page }) => {
    await openSavings(page)
    const sheet = await openMovement(page, 'Bono ahorro')
    await sheet.getByLabel('Importe').fill('80')
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet).toBeHidden()

    await expect(page.locator('div[role="status"].sr-only')).toHaveText('Cambios guardados')
    await expect(movementRow(page, 'Bono ahorro')).toContainText(/\+80\s?€/)
    await expectFigures(page, '176', '2\\.676', '834')
    await expect.poll(() => body(page)).toMatch(/Ingresos\s*2\.820\s?€/)
  })

  test('a withdrawal turned into a deposit becomes positive', async ({ page }) => {
    await openSavings(page)
    const sheet = await openMovement(page, 'Retiro emergencia')
    await expect(sheet.getByRole('radio', { name: 'Retiro' })).toHaveAttribute('aria-checked', 'true')
    await expect(sheet.getByLabel('Importe')).toHaveValue('80')
    expect(await switchShown(sheet)).toBe(false)
    await sheet.getByRole('radio', { name: 'Depósito' }).click()
    await expect.poll(() => switchShown(sheet)).toBe(true)
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet).toBeHidden()

    await expect(movementRow(page, 'Retiro emergencia')).toContainText(/\+80\s?€/)
    await expectFigures(page, '306', '2\\.806', '704')
  })

  test('a new date moves the row and no figure', async ({ page }) => {
    await openSavings(page)
    const sheet = await openMovement(page, 'Ahorro mensual')
    await sheet.getByLabel('Fecha').click()
    await sheet.locator('[data-date-option="2026-09-10"]').click()
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet).toBeHidden()

    await expect(panel(page).locator('[data-savings-movement-row]').last()).toContainText('Ahorro mensual')
    await expectFigures(page, '146', '2\\.646', '864')
  })

  test('the sheet deletes the movement with the same undo as a swipe', async ({ page }) => {
    await openSavings(page)
    const sheet = await openMovement(page, 'Bono ahorro')
    await sheet.getByRole('button', { name: 'Eliminar movimiento' }).click()
    await expect(sheet).toBeHidden()

    await expect(page.getByText('Movimiento eliminado')).toBeVisible()
    await expect(movementRow(page, 'Bono ahorro')).toHaveCount(0)
    await expectFigures(page, '96', '2\\.596', '914')

    await page.getByRole('button', { name: 'Deshacer' }).click()
    await expect(movementRow(page, 'Bono ahorro')).toHaveCount(1)
    await expectFigures(page, '146', '2\\.646', '864')
  })

  test('a failed save keeps the sheet open with an error', async ({ page }) => {
    await openSavings(page, '/demo?e2e=fail-savings-update')
    const sheet = await openMovement(page, 'Bono ahorro')
    await sheet.getByLabel('Importe').fill('80')
    await sheet.getByRole('button', { name: 'Guardar' }).click()

    await expect(sheet.getByRole('alert')).toBeVisible()
    await expect(sheet).toBeVisible()
    await expect(sheet.getByLabel('Importe')).toHaveValue('80')
    await expect(movementRow(page, 'Bono ahorro')).toContainText(/\+50\s?€/)
  })

  test('a deposit already saved moves only the accumulated balance', async ({ page }) => {
    await openSavings(page)
    await addMovement(page, { name: 'Ahorros de antes', amount: '1000', already: true })

    await expect(movementRow(page, 'Ahorros de antes')).toContainText(/\+1\.000\s?€/)
    await expect(movementRow(page, 'Ahorros de antes')).toContainText('Ya ahorrado')
    await expectFigures(page, '146', '3\\.646', '864')

    await longSwipe(page, movementRow(page, 'Ahorros de antes'))
    await expect(movementRow(page, 'Ahorros de antes')).toHaveCount(0)
    await expectFigures(page, '146', '2\\.646', '864')
  })

  test('marking an existing deposit takes it out of the month', async ({ page }) => {
    await openSavings(page)
    const sheet = await openMovement(page, 'Ahorro mensual')
    await alreadySaved(sheet).click()
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet).toBeHidden()

    await expect(movementRow(page, 'Ahorro mensual')).toContainText('Ya ahorrado')
    await expectFigures(page, '[−-]30', '2\\.646', '1\\.040')

    const reopened = await openMovement(page, 'Ahorro mensual')
    await expect(alreadySaved(reopened)).toHaveAttribute('aria-checked', 'true')
  })

  test('the switch is only there for a deposit, and a withdrawal never keeps the mark', async ({ page }) => {
    await openSavings(page)
    await panel(page).getByRole('button', { name: 'Añadir movimiento de ahorro' }).click()
    const sheet = dialog(page)
    await expect(alreadySaved(sheet)).toHaveAttribute('aria-checked', 'false')
    await alreadySaved(sheet).click()
    await sheet.getByRole('radio', { name: 'Retiro' }).click()
    await expect.poll(() => switchShown(sheet)).toBe(false)
    await sheet.getByLabel('Nombre').fill('Regalo')
    await sheet.getByLabel('Importe').fill('20')
    await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
    await expect(sheet).toBeHidden()

    await expect(movementRow(page, 'Regalo')).not.toContainText('Ya ahorrado')
    await expectFigures(page, '126', '2\\.626', '884')
  })

  test('in a projection a deposit already saved adds to the balance and not to the floor', async ({ page }) => {
    await page.goto('/demo')
    const title = page.locator('[data-month-picker-trigger]').last()
    const next = async (month) => {
      await page.locator('button[aria-label="Ciclo siguiente"]').last().click()
      await expect(title).toContainText(month)
    }
    await next(/octubre/i)
    await expect.poll(() => body(page)).toMatch(/Margen libre\s*475\s?€/)
    await page.locator('[aria-controls="summary-group-panel"]').filter({ hasText: /^Ahorro/ }).click()
    const accumulated = async () => Number((await body(page)).match(/Acumulado\s*([\d.]+)\s?€/)?.[1].replace(/\./g, ''))
    const octoberBefore = await accumulated()

    await addMovement(page, { name: 'Ahorros de antes', amount: '1000', already: true })
    await expect.poll(() => body(page)).toMatch(/Ahorro\s*300\s?€/)
    await expect.poll(() => body(page)).toMatch(/Margen libre\s*475\s?€/)
    await expect.poll(accumulated).toBe(octoberBefore + 1000)

    await next(/noviembre/i)
    await page.locator('[aria-controls="summary-group-panel"]').filter({ hasText: /^Ahorro/ }).click()
    const novemberWith = await accumulated()
    expect(novemberWith).toBe(octoberBefore + 1000 + 300)
  })

  test('reduced motion: the switch appears and the figures change without movement', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openSavings(page)
    const sheet = await openMovement(page, 'Retiro emergencia')
    await sheet.getByRole('radio', { name: 'Depósito' }).click()
    expect(await switchShown(sheet)).toBe(true)
    const transition = await alreadySaved(sheet).evaluate((el) => {
      const collapsible = el.closest('.grid')
      return collapsible ? getComputedStyle(collapsible).transitionProperty : ''
    })
    expect(transition).toBe('none')
  })

  test('the edit sheet has no axe violation in either theme', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openSavings(page)
    await openMovement(page, 'Bono ahorro')
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
  test('a movement opens from the side panel and saves', async ({ page }) => {
    await loadDesktop(page)
    await page.locator('[data-summary-column="savings"]').click()
    const side = page.locator('div[role="dialog"][data-open]')
    await expect(side.getByText('Acumulado')).toHaveCount(1)
    await side.locator('[data-savings-movement-row]').filter({ hasText: 'Bono ahorro' }).click()
    const sheet = page.locator('div[role="dialog"][data-open]').last()
    await expect(sheet.getByText('Editar movimiento')).toBeVisible()
    await expect(sheet.getByLabel('Importe')).toBeFocused()
    await sheet.getByLabel('Importe').fill('80')
    await sheet.locator('button[type="submit"]').click()
    await page.waitForTimeout(600)
    await expect(page.locator('[data-summary-column="savings"]')).toContainText(/176\s?€/)
  })

  // The side sheet grows downwards: the switch must take the press even while the empty name is
  // focused and would show its error line on blur.
  test('the switch takes the first click while the empty name is focused', async ({ page }) => {
    await loadDesktop(page)
    await page.locator('[data-summary-column="savings"]').click()
    await page.locator('div[role="dialog"][data-open]').getByText('Añadir movimiento de ahorro').click()
    const sheet = page.locator('div[role="dialog"][data-open]').last()
    await expect(sheet.getByLabel('Nombre')).toBeFocused()
    const toggle = sheet.locator('[role="switch"]')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await sheet.getByLabel('Nombre').fill('Ahorros de antes')
    await sheet.getByLabel('Importe').fill('1000')
    await sheet.locator('button[type="submit"]').click()
    await page.waitForTimeout(600)
    await expect(page.locator('[data-summary-column="savings"]')).toContainText(/146\s?€/)
  })
})
