// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

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

async function addExpense(page, categoryId, amount) {
  await page.locator(`button[aria-controls="category-panel-${categoryId}"]`).click()
  await page.locator(`#category-panel-${categoryId}`).getByRole('button', { name: 'Añadir gasto' }).click()
  const sheet = dialog(page)
  await sheet.locator('input[inputmode="decimal"]').first().fill(amount)
  await sheet.locator('input[type="text"]').first().fill('Prueba')
  await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(sheet).toBeHidden()
}

async function setComidaBudget(page, amount) {
  await page.getByRole('button', { name: /^Opciones de Comida$/ }).click()
  const sheet = dialog(page)
  await sheet.getByLabel('Presupuesto').fill(amount)
  await sheet.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(sheet).toBeHidden()
}

test.describe('a budget reserves its amount in the free margin', () => {
  test('on load, a recurring charge counts inside its category\'s envelope', async ({ page }) => {
    await page.goto('/demo')
    await expect.poll(() => body(page)).toMatch(margin('864'))
    await expect.poll(() => body(page)).toMatch(/Transporte\s*130\s?€\s*de\s*100\s?€/)

    await page.getByRole('button', { name: /^Gastos/ }).click()
    await expect(page.locator('#summary-group-panel')).toContainText(/Transporte\s*130\s?€/)
  })

  test('spending within a budget leaves the margin where it was', async ({ page }) => {
    await page.goto('/demo')
    await addExpense(page, 'comida', '20')
    await expect.poll(() => body(page)).toMatch(/Comida\s*330\s?€\s*de\s*400\s?€/)
    await expect.poll(() => body(page)).toMatch(margin('864'))
  })

  test('spending past a budget costs only the overspend', async ({ page }) => {
    await page.goto('/demo')
    await addExpense(page, 'transporte', '30')
    await expect.poll(() => body(page)).toMatch(/Transporte\s*160\s?€\s*de\s*100\s?€/)
    await expect.poll(() => body(page)).toMatch(margin('834'))
  })

  test('raising, lowering and clearing a budget move the margin by what it reserves', async ({ page }) => {
    await page.goto('/demo')

    await setComidaBudget(page, '600')
    await expect.poll(() => body(page)).toMatch(margin('664'))

    await setComidaBudget(page, '200')
    await expect.poll(() => body(page)).toMatch(margin('954'))
    await expect.poll(() => body(page)).toMatch(/110\s?€ por encima del presupuesto/)

    await setComidaBudget(page, '')
    await expect.poll(() => body(page)).toMatch(margin('954'))
  })
})

test.describe('cycle header', () => {
  test('the current cycle cannot move forward, only back', async ({ page }) => {
    await page.goto('/demo')
    const next = page.getByRole('button', { name: 'Ciclo siguiente', includeHidden: true })
    const previous = page.getByRole('button', { name: 'Ciclo anterior', includeHidden: true })
    await expect(next).toHaveCount(2)
    for (const button of await next.all()) await expect(button).toBeDisabled()
    for (const button of await previous.all()) await expect(button).toBeEnabled()
  })
})
