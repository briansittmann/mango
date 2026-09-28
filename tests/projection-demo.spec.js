// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

// `cycle-projection` and the projection scenarios of `dashboard-ui` / `category-editing`, on
// `/demo`: the September 2026 sample is the last generated cycle, and next reaches six
// projections past it (October 2026 – March 2027).

function dialog(page) {
  return page.locator('div[role="dialog"][data-open]')
}

// See income-create.spec.js: totals are rolling counters, so the aria-hidden digit columns are
// stripped before matching the visible text.
function body(page) {
  return page.evaluate(() => {
    const copy = document.body.cloneNode(true)
    copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove())
    return copy.textContent.replace(/\s+/g, ' ')
  })
}

const nextButtons = (page) => page.locator('button[aria-label="Ciclo siguiente"]')
const previousButtons = (page) => page.locator('button[aria-label="Ciclo anterior"]')
const cardHeader = (page, id) => page.locator(`button[aria-controls="category-panel-${id}"]`).locator('..')

async function goForward(page, times) {
  for (let i = 0; i < times; i += 1) {
    const title = page.locator('[data-month-picker-trigger]').last()
    const before = await title.textContent()
    // The title's own control; the top bar's copy only takes over once the title scrolls away.
    await nextButtons(page).last().click()
    await expect(title).not.toHaveText(before ?? '')
  }
}

// The scope choice sits in a collapsed, inert wrapper until the budget changes.
const scopeChoice = (sheet) => sheet.locator('fieldset').locator('xpath=..')

async function openCategory(page, name) {
  await page.getByRole('button', { name: new RegExp(`^Opciones de ${name}$`) }).click()
  const sheet = dialog(page)
  await sheet.waitFor()
  return sheet
}

test.describe('navigation into the projection', () => {
  test('from the sample, next is enabled in both places and the picker reaches March 2027', async ({ page }) => {
    await page.goto('/demo')
    await expect(nextButtons(page)).toHaveCount(2)
    for (const button of await nextButtons(page).all()) await expect(button).toBeEnabled()

    await page.getByRole('button', { name: /Seleccionar mes/ }).click()
    const picker = page.getByRole('dialog', { name: 'Seleccionar mes' })
    const months = picker.locator('.grid button')
    for (const index of [9, 10, 11]) await expect(months.nth(index)).toBeEnabled()
    await picker.getByRole('button', { name: 'Año siguiente' }).click()
    for (const index of [0, 1, 2]) await expect(months.nth(index)).toBeEnabled()
    for (let index = 3; index < 12; index += 1) await expect(months.nth(index)).toBeDisabled()
    await expect(picker.getByRole('button', { name: 'Año siguiente' })).toBeDisabled()
  })

  test('on March 2027, the sixth projection, next is disabled and previous is not', async ({ page }) => {
    await page.goto('/demo')
    await goForward(page, 6)
    await expect(page.locator('[data-month-picker-trigger]').last()).toContainText(/marzo/i)
    for (const button of await nextButtons(page).all()) await expect(button).toBeDisabled()
    for (const button of await previousButtons(page).all()) await expect(button).toBeEnabled()
  })

  test('the picker opens a projection directly', async ({ page }) => {
    await page.goto('/demo')
    await page.getByRole('button', { name: /Seleccionar mes/ }).click()
    await page.getByRole('dialog', { name: 'Seleccionar mes' }).locator('.grid button').nth(10).click()
    await expect(page.locator('[data-month-picker-trigger]').last()).toContainText(/noviembre/i)
    await expect.poll(() => body(page)).toMatch(/Proyección/)
  })
})

test.describe('a projected cycle', () => {
  test('label, projected rows that open and swipe, and the add-category tile', async ({ page }) => {
    await page.goto('/demo')
    await goForward(page, 2)
    const line = page.locator('p', { hasText: 'Proyección' })
    await expect(line).toContainText(/Proyección\s*·\s*1\s*[–-]\s*30\s*nov/i)
    await expect(page.getByText('en curso')).toHaveCount(0)

    await page.locator('button[aria-controls="category-panel-vivienda"]').click()
    const panel = page.locator('#category-panel-vivienda')
    await expect(panel).toContainText('Alquiler')
    // A projected charge opens the entry sheet as its definition's slot (`add-forward-scoped-edits`).
    await expect(panel.getByRole('button', { name: /Alquiler/ })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Añadir gasto' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Añadir categoría' })).toHaveCount(1)

    await page.getByRole('button', { name: /^Ingresos/ }).click()
    await expect(page.locator('#summary-group-panel')).toContainText('Salario')
    await expect(page.locator('#summary-group-panel').getByRole('button', { name: /^Salario/ })).toBeVisible()
    await expect(page.locator('#summary-group-panel').getByRole('button', { name: 'Añadir ingreso' })).toBeVisible()
    await page.getByRole('button', { name: /^Ahorro/ }).click()
    await expect(page.locator('#summary-group-panel')).not.toContainText('Acumulado')
    await expect(page.locator('#summary-group-panel').getByRole('button')).toHaveCount(1)
    await expect(page.locator('#summary-group-panel').getByRole('button', { name: 'Añadir movimiento de ahorro' })).toBeVisible()
  })

  test('the spend chart is hidden and the free margin follows the projection', async ({ page }) => {
    await page.goto('/demo')
    await goForward(page, 1)
    // 2 400 income − 300 savings target − (900 vivienda + max(100, 50) transporte + 35 hogar +
    // 40 salud + 400 comida + 150 ocio)
    await expect.poll(() => body(page)).toMatch(/Margen libre\s*475\s?€/)
    await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(0)
  })

  test('a budgeted card shows its budget and an empty bar', async ({ page }) => {
    await page.goto('/demo')
    await goForward(page, 1)
    await expect(cardHeader(page, 'transporte')).toContainText(/Transporte\s*100\s?€/)
    await expect(cardHeader(page, 'transporte')).not.toContainText(/de\s*100/)
    const bar = page.locator('#category-progress-transporte [role="progressbar"]')
    await expect(bar).toHaveAttribute('aria-valuenow', '0')
    const progress = page.locator('#category-progress-transporte')
    await expect(progress).not.toContainText(/por semana|por encima|quedan/i)
    await expect(progress.locator('svg')).toHaveCount(0)
  })

  test('upcoming charges lists every projected charge as pending, in day order', async ({ page }) => {
    await page.goto('/demo')
    await goForward(page, 2)
    await page.getByRole('button', { name: /Próximos cobros/ }).click()
    const rows = page.locator('#upcoming-charges-panel button')
    const labels = await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') ?? ''))
    expect(labels.map((label) => label.split(' · ')[0])).toEqual(['Alquiler', 'Internet', 'Seguro', 'Parking', 'Limpieza', 'Gimnasio'])
    for (const label of labels) expect(label).toContain('Pendiente')
    await expect(page.locator('#upcoming-charges-panel')).toContainText(/comprometido este ciclo · 1\.025\s?€/)

    await rows.first().click()
    await expect(dialog(page)).toContainText('Alquiler')
  })
})

test.describe('the demo projects its sample', () => {
  test('October lists the active charges, and Seguro stays in all six projections', async ({ page }) => {
    await page.goto('/demo')
    for (let month = 1; month <= 6; month += 1) {
      await goForward(page, 1)
      await expect.poll(() => body(page)).toMatch(/Proyección/)
      await expect(page.locator('#category-panel-vivienda')).toContainText('Seguro')
      if (month === 1) {
        await expect(page.locator('#category-panel-vivienda')).toContainText('Alquiler')
        await expect(page.locator('#category-panel-transporte')).toContainText('Parking')
        await expect(page.locator('#category-panel-comida')).not.toContainText('Supermercado')
      }
    }
  })

  test('a budget raised in the sample reaches the October projection', async ({ page }) => {
    await page.goto('/demo')
    const sheet = await openCategory(page, 'Comida')
    await sheet.getByLabel('Presupuesto').fill('500')
    await expect(scopeChoice(sheet)).toHaveAttribute('inert', '')
    await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(sheet).toBeHidden()

    await goForward(page, 1)
    await expect(cardHeader(page, 'comida')).toContainText(/Comida\s*500\s?€/)
  })

  test('the previous control goes back from a projection to the sample', async ({ page }) => {
    await page.goto('/demo')
    await goForward(page, 1)
    await previousButtons(page).last().click()
    await expect(page.locator('[data-month-picker-trigger]').last()).toContainText(/septiembre/i)
    await expect(page.getByText('Proyección')).toHaveCount(0)
  })
})

test.describe("a future cycle's budget asks how far it reaches", () => {
  test('the question appears only for a budget change, and gates the save', async ({ page }) => {
    await page.goto('/demo')
    await goForward(page, 3)
    const sheet = await openCategory(page, 'Comida')
    await sheet.getByLabel('Presupuesto').fill('500')
    const only = sheet.getByRole('radio', { name: 'Solo este mes' })
    const onward = sheet.getByRole('radio', { name: 'Desde este mes en adelante' })
    await expect(only).not.toBeChecked()
    await expect(onward).not.toBeChecked()
    await expect(scopeChoice(sheet)).not.toHaveAttribute('inert', '')
    const save = sheet.getByRole('button', { name: 'Guardar', exact: true })
    await expect(save).toBeDisabled()

    await sheet.getByText('Solo este mes').click()
    await expect(only).toBeChecked()
    await expect(save).toBeEnabled()
    await save.click()
    await expect(sheet).toBeHidden()

    // Only this month: December 500, January back to 400, November still 400.
    await expect(cardHeader(page, 'comida')).toContainText(/Comida\s*500\s?€/)
    await goForward(page, 1)
    await expect(cardHeader(page, 'comida')).toContainText(/Comida\s*400\s?€/)
    await previousButtons(page).last().click()
    await previousButtons(page).last().click()
    await expect(cardHeader(page, 'comida')).toContainText(/Comida\s*400\s?€/)
  })

  test('from this month on carries into the later projections', async ({ page }) => {
    await page.goto('/demo')
    await goForward(page, 3)
    const sheet = await openCategory(page, 'Comida')
    await sheet.getByLabel('Presupuesto').fill('500')
    await sheet.getByText('Desde este mes en adelante').click()
    await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(sheet).toBeHidden()
    await goForward(page, 1)
    await expect(cardHeader(page, 'comida')).toContainText(/Comida\s*500\s?€/)
  })

  test('no question for a rename, and the rename keeps every budget', async ({ page }) => {
    await page.goto('/demo')
    await goForward(page, 3)
    const sheet = await openCategory(page, 'Comida')
    await sheet.getByLabel('Nombre').fill('Comida y bebida')
    await expect(scopeChoice(sheet)).toHaveAttribute('inert', '')
    await expect(sheet.getByRole('button', { name: 'Reordenar' })).toHaveCount(0)
    await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(sheet).toBeHidden()
    await expect(cardHeader(page, 'comida')).toContainText(/Comida y bebida\s*400\s?€/)
  })
})

test.describe('English', () => {
  test('a projection shows no Spanish copy', async ({ page, context }) => {
    await context.addCookies([{ name: 'locale', value: 'en', url: 'http://localhost:3000' }])
    await page.goto('/demo')
    await page.getByRole('button', { name: 'Next cycle' }).click()
    await expect.poll(() => body(page)).toMatch(/Projection/)
    await page.getByRole('button', { name: /^Food options$/ }).click()
    const sheet = dialog(page)
    await sheet.getByLabel('Budget').fill('500')
    await expect(sheet.getByRole('radio', { name: 'Only this month' })).toBeVisible()
    await expect(sheet.getByRole('radio', { name: 'From this month on' })).toBeVisible()
    await expect(sheet).toContainText('Apply the change')
    const text = await body(page)
    expect(text).not.toMatch(/Proyección|Solo este mes|Desde este mes|Aplicar el cambio/)
  })
})

test('no request reaches a Supabase host', async ({ page }) => {
  const hosts = []
  page.on('request', (request) => {
    const host = new URL(request.url()).host
    if (host.includes('supabase')) hosts.push(host)
  })
  await page.goto('/demo')
  await goForward(page, 6)
  expect(hosts).toEqual([])
})
