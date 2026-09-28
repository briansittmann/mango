// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

// Entries in a projected cycle on `/demo` (`add-entries-in-projected-cycles`): the October 2026
// projection starts at a free margin of 475 €, income 2.400 €, savings 300 € (the target).

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

const margin = (amount) => new RegExp(`Margen libre\\s*${amount}\\s?€`)
const cardHeader = (page, id) => page.locator(`button[aria-controls="category-panel-${id}"]`).locator('..')
const title = (page) => page.locator('[data-month-picker-trigger]').last()

async function move(page, direction) {
  const before = await title(page).textContent()
  await page.locator(`button[aria-label="${direction === 'next' ? 'Ciclo siguiente' : 'Ciclo anterior'}"]`).last().click()
  await expect(title(page)).not.toHaveText(before ?? '')
}

async function openOctober(page) {
  await page.goto('/demo')
  await move(page, 'next')
  await expect(title(page)).toContainText(/octubre/i)
  await expect.poll(() => body(page)).toMatch(margin('475'))
}

async function openCard(page, id) {
  const toggle = page.locator(`button[aria-controls="category-panel-${id}"]`)
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  return page.locator(`#category-panel-${id}`)
}

async function fillEntry(sheet, amount, description) {
  await sheet.getByLabel('Importe').fill(amount)
  await sheet.getByLabel('Descripción').fill(description)
}

async function addExpense(page, id, amount, description) {
  const panel = await openCard(page, id)
  await panel.getByRole('button', { name: 'Añadir gasto' }).click()
  const sheet = dialog(page)
  await fillEntry(sheet, amount, description)
  await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(sheet).toBeHidden()
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

async function openSummary(page, name) {
  const toggle = page.getByRole('button', { name: new RegExp(`^${name}`) })
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  const panel = page.locator('#summary-group-panel')
  // Its rows only take clicks once the expand transition ends; WebKit hit-tests mid-way otherwise.
  await panel.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
  return panel
}

test('an expense in a projected cycle moves the projected margin', async ({ page }) => {
  await openOctober(page)
  await addExpense(page, 'hogar', '20', 'Ferretería')
  await expect(page.locator('#category-panel-hogar')).toContainText('Ferretería')
  await expect(cardHeader(page, 'hogar')).toContainText(/Hogar\s*55\s?€/)
  await expect.poll(() => body(page)).toMatch(margin('455'))
  await page.getByRole('button', { name: /Próximos cobros/ }).click()
  await expect(page.locator('#upcoming-charges-panel')).toContainText(/comprometido este ciclo · 1\.025\s?€/)
  await expect(page.locator('#upcoming-charges-panel')).not.toContainText('Ferretería')
})

test('edit and delete in a projected cycle', async ({ page }) => {
  await openOctober(page)
  await addExpense(page, 'hogar', '20', 'Ferretería')
  const panel = page.locator('#category-panel-hogar')

  await panel.getByRole('button', { name: /^Ferretería/ }).click()
  const sheet = dialog(page)
  await expect(sheet.getByText('Editar gasto')).toBeVisible()
  await sheet.getByLabel('Importe').fill('50')
  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect(cardHeader(page, 'hogar')).toContainText(/Hogar\s*85\s?€/)
  await expect.poll(() => body(page)).toMatch(margin('425'))

  await longSwipe(page, panel.getByRole('button', { name: /^Ferretería/ }))
  await expect(panel).not.toContainText('Ferretería')
  await expect(cardHeader(page, 'hogar')).toContainText(/Hogar\s*35\s?€/)
  await expect.poll(() => body(page)).toMatch(margin('475'))

  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(panel).toContainText('Ferretería')
  await expect(panel).toContainText(/50\s?€/)
  await expect.poll(() => body(page)).toMatch(margin('425'))
})

test('a projected charge stays read-only beside the add row', async ({ page }) => {
  await openOctober(page)
  const panel = await openCard(page, 'vivienda')
  await panel.getByText('Alquiler').click()
  await expect(dialog(page)).toHaveCount(0)
  await panel.getByRole('button', { name: 'Añadir gasto' }).click()
  await expect(dialog(page).getByText('Nuevo gasto')).toBeVisible()
})

test('income in a projected cycle', async ({ page }) => {
  await openOctober(page)
  const panel = await openSummary(page, 'Ingresos')
  await expect(panel.getByText('Salario')).toBeVisible()
  await expect(panel.getByRole('button', { name: /^Salario/ })).toHaveCount(0)

  await panel.getByRole('button', { name: 'Añadir ingreso' }).click()
  let sheet = dialog(page)
  await fillEntry(sheet, '300', 'Bonus')
  await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect.poll(() => body(page)).toMatch(/Ingresos\s*2\.700\s?€/)
  await expect.poll(() => body(page)).toMatch(margin('775'))

  await panel.getByRole('button', { name: /^Bonus/ }).click()
  sheet = dialog(page)
  await sheet.getByLabel('Importe').fill('350')
  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect.poll(() => body(page)).toMatch(/Ingresos\s*2\.750\s?€/)
  await expect.poll(() => body(page)).toMatch(margin('825'))

  await panel.getByRole('button', { name: /^Bonus/ }).click()
  sheet = dialog(page)
  await sheet.getByRole('button', { name: 'Eliminar ingreso' }).click()
  await expect(sheet).toBeHidden()
  await expect.poll(() => body(page)).toMatch(/Ingresos\s*2\.400\s?€/)
  await expect.poll(() => body(page)).toMatch(margin('475'))
  await expect(panel).toContainText('Salario')
  await expect(panel.getByRole('button', { name: /^Salario/ })).toHaveCount(0)

  await move(page, 'previous')
  await expect.poll(() => body(page)).toMatch(/Ingresos\s*2\.820\s?€/)
  await expect(page.locator('#summary-group-panel')).not.toContainText('Bonus')
})

test('a deposit in a projected cycle', async ({ page }) => {
  await openOctober(page)
  const panel = await openSummary(page, 'Ahorro')
  for (const [amount, name] of [['50', 'Extra'], ['300', 'Paga extra']]) {
    await panel.getByRole('button', { name: 'Añadir movimiento de ahorro' }).click()
    const sheet = dialog(page)
    await sheet.getByLabel('Importe').fill(amount)
    await sheet.getByLabel('Nombre').fill(name)
    await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
    await expect(sheet).toBeHidden()
    if (name === 'Extra') {
      await expect(panel).toContainText(/Extra\s*1 oct\s*\+50\s?€/)
      await expect.poll(() => body(page)).toMatch(/Ahorro\s*300\s?€/)
      await expect.poll(() => body(page)).toMatch(margin('475'))
    }
  }
  await expect.poll(() => body(page)).toMatch(/Ahorro\s*350\s?€/)
  await expect.poll(() => body(page)).toMatch(margin('425'))

  await move(page, 'previous')
  await expect.poll(() => body(page)).toMatch(/Ahorro\s*146\s?€/)
  await expect(page.locator('#summary-group-panel')).not.toContainText('Extra')
})

test('a budgeted card in a projection with a real row', async ({ page }) => {
  await openOctober(page)
  await addExpense(page, 'transporte', '60', 'Taxi')
  await expect(cardHeader(page, 'transporte')).toContainText(/110\s?€\s*de\s*100\s?€/)
  const bar = page.locator('#category-progress-transporte [role="progressbar"]')
  // The bar's value is capped at 100, as in the cycle in progress.
  await expect(bar).toHaveAttribute('aria-valuenow', '100')
  await expect(page.locator('#category-progress-transporte')).toContainText(/10\s?€ por encima del presupuesto/)
  await expect.poll(() => body(page)).toMatch(margin('465'))
})

test('a projection bar within budget', async ({ page }) => {
  await openOctober(page)
  await addExpense(page, 'comida', '120', 'Cumpleaños')
  await expect(cardHeader(page, 'comida')).toContainText(/120\s?€\s*de\s*400\s?€/)
  const bar = page.locator('#category-progress-comida [role="progressbar"]')
  await expect(bar).toHaveAttribute('aria-valuenow', '30')
  // (400 − 120) ÷ 31 days × 7, rounded down: the whole cycle is left.
  await expect(page.locator('#category-progress-comida')).toContainText(/63\s?€.*semana/)
  await expect.poll(() => body(page)).toMatch(margin('475'))
})

test.describe('sheets in a projected cycle', () => {
  const expectOctoberDate = async (sheet) => {
    const date = sheet.getByLabel('Fecha')
    await expect(date).toHaveValue('2026-10-01')
    await expect(date).toHaveAttribute('min', '2026-10-01')
    await expect(date).toHaveAttribute('max', '2026-10-31')
  }

  test('create an expense', async ({ page }) => {
    await openOctober(page)
    const panel = await openCard(page, 'comida')
    await panel.getByRole('button', { name: 'Añadir gasto' }).click()
    const sheet = dialog(page)
    await expect(sheet.getByText('Nuevo gasto')).toBeVisible()
    await expectOctoberDate(sheet)
    await expect(sheet.getByRole('switch')).toHaveCount(0)
  })

  test('create an income entry', async ({ page }) => {
    await openOctober(page)
    const panel = await openSummary(page, 'Ingresos')
    await panel.getByRole('button', { name: 'Añadir ingreso' }).click()
    const sheet = dialog(page)
    await expect(sheet.getByText('Nuevo ingreso')).toBeVisible()
    await expectOctoberDate(sheet)
    await expect(sheet.getByRole('switch')).toHaveCount(0)
  })

  test('add a savings movement', async ({ page }) => {
    await openOctober(page)
    const panel = await openSummary(page, 'Ahorro')
    await panel.getByRole('button', { name: 'Añadir movimiento de ahorro' }).click()
    const sheet = dialog(page)
    await expect(sheet.getByRole('radio', { name: 'Depósito' })).toBeChecked()
    await expectOctoberDate(sheet)
  })
})

test('a demo entry stays in its projected cycle', async ({ page }) => {
  await openOctober(page)
  await addExpense(page, 'hogar', '20', 'Ferretería')
  await expect.poll(() => body(page)).toMatch(margin('455'))

  await move(page, 'previous')
  await expect(page.locator('#category-panel-hogar')).not.toContainText('Ferretería')
  await expect(cardHeader(page, 'hogar')).toContainText(/Hogar\s*95\s?€/)
  await expect.poll(() => body(page)).toMatch(margin('864'))

  await move(page, 'next')
  await move(page, 'next')
  await expect(title(page)).toContainText(/noviembre/i)
  await expect(page.locator('#category-panel-hogar')).not.toContainText('Ferretería')
  await expect.poll(() => body(page)).toMatch(margin('475'))
})

test('English: a projection with a real row shows no Spanish copy', async ({ page, context }) => {
  await context.addCookies([{ name: 'locale', value: 'en', url: 'http://localhost:3000' }])
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Next cycle' }).last().click()
  await expect.poll(() => body(page)).toMatch(/Projection/)
  const panel = await openCard(page, 'transporte')
  await panel.getByRole('button', { name: 'Add expense' }).click()
  const sheet = dialog(page)
  await expect(sheet.getByText('New expense')).toBeVisible()
  await sheet.getByLabel('Amount').fill('60')
  await sheet.getByLabel('Description').fill('Taxi')
  await sheet.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect(page.locator('#category-progress-transporte')).toContainText(/over budget/)
  const text = await page.locator('body').innerText()
  expect(text).not.toMatch(/Proyección|Añadir|por encima|por semana|Margen libre|Ingresos|Ahorro/)
})

test('no request reaches a Supabase host', async ({ page }) => {
  const hosts = []
  page.on('request', (request) => {
    const host = new URL(request.url()).host
    if (host.includes('supabase')) hosts.push(host)
  })
  await openOctober(page)
  await addExpense(page, 'hogar', '20', 'Ferretería')
  expect(hosts).toEqual([])
})
