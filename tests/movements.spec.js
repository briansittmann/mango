// @ts-check
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { addExpense, sheet, tokenColor } from './widgets-helpers'
import { TOP_BAR_HEIGHT, loadDesktop } from './desktop-helpers'

// `transaction-list`, on `/demo` in Spanish (September 2026, Europe/Dublin, today clamped to the
// 30th): nine one-off expenses, "Freelance" and three savings movements are the user's entries.

const DEMO_ORDER = [
  'Electrónica',
  'Decoración',
  'Bono ahorro',
  'Conciertos',
  'Retiro emergencia',
  'Restaurante',
  'Ropa',
  'Cine',
  'Freelance',
  'Gasolina',
  'Supermercado',
  'Ahorro mensual',
  'Café',
]
const FIXED = ['Alquiler', 'Internet', 'Seguro', 'Gimnasio', 'Limpieza', 'Parking', 'Salario']

const card = (page) => page.locator('[data-movements-card]')
const header = (page) => card(page).locator('button[aria-controls="movements-panel"]')
const rows = (page) => card(page).locator('[data-movement-row]')
const row = (page, name) => rows(page).filter({ has: page.getByText(name, { exact: true }) })
const segment = (page, value) => card(page).locator(`[data-segment="${value}"]`)

async function rowNames(page) {
  return rows(page).evaluateAll((els) => els.map((el) => el.querySelector('span.block span')?.textContent ?? ''))
}

async function openCard(page) {
  await header(page).scrollIntoViewIfNeeded()
  if ((await header(page).getAttribute('aria-expanded')) !== 'true') await header(page).click()
  await expect(header(page)).toHaveAttribute('aria-expanded', 'true')
}

/** A swipe across the whole card at the row's height: the name alone is too short to arm it. */
async function longSwipe(page, target) {
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  const cardBox = await card(page).boundingBox()
  if (!box || !cardBox) throw new Error('row not visible')
  const y = box.y + box.height / 2
  await page.mouse.move(cardBox.x + cardBox.width - 10, y)
  await page.mouse.down()
  await page.mouse.move(cardBox.x + 10, y, { steps: 12 })
  await page.mouse.up()
}

const HINT_KEY = 'mango:pista-deslizar-movimientos'
const hint = (page) => card(page).locator('[data-hint]')

/** The one-time swipe hint, marked as seen so it never plays over the tests about something else. */
async function skipHint(page) {
  await page.addInitScript((key) => {
    try {
      localStorage.setItem(key, '1')
    } catch {}
  }, HINT_KEY)
}

/** Scrolls down in wheel steps, the way a person does, so the observer sees each position. */
async function scrollDown(page, steps) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, 100)
    await page.waitForTimeout(120)
  }
}

async function axeViolations(page) {
  await page.evaluate(readFileSync('node_modules/axe-core/axe.min.js', 'utf8'))
  const found = []
  for (const theme of ['light', 'dark']) {
    await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme)
    await page.waitForTimeout(300)
    const violations = await page.evaluate(async () => {
      // @ts-expect-error axe is attached by the evaluated source above
      const result = await window.axe.run(document.querySelector('[data-movements-card]'), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })
      return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
    })
    found.push(...violations.map((v) => `${theme} ${v}`))
  }
  return found
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }, testInfo) => {
    if (!testInfo.title.startsWith('swipe hint')) await skipHint(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/demo')
    await card(page).waitFor()
  })

  test('swipe hint: plays once on the first row when the card is opened, never again', async ({ page }) => {
    await openCard(page)
    await scrollDown(page, 6)
    await expect(hint(page)).toHaveCount(1)
    await expect(hint(page)).toContainText('Desliza para borrar')
    await expect(hint(page).locator('[data-movement-row]')).toHaveAttribute('aria-label', /Electrónica/)
    expect(await page.evaluate((key) => localStorage.getItem(key), HINT_KEY)).toBe('1')
    await page.reload()
    await openCard(page)
    await scrollDown(page, 6)
    await page.waitForTimeout(500)
    await expect(hint(page)).toHaveCount(0)
  })

  test('folded below the categories, with a count and no amount', async ({ page }) => {
    const main = page.locator('[data-dashboard-main]')
    await expect(main.locator('[data-movements-card]')).toHaveCount(1)
    const after = await page.evaluate(() => {
      const tile = [...document.querySelectorAll('[data-dashboard-main] button')].find((b) => b.textContent?.includes('Añadir categoría'))
      const movements = document.querySelector('[data-movements-card]')
      return tile && movements ? Boolean(tile.compareDocumentPosition(movements) & Node.DOCUMENT_POSITION_FOLLOWING) : false
    })
    expect(after).toBe(true)
    await expect(header(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(card(page).locator('h2')).toHaveText('Movimientos')
    await expect(card(page).locator('[data-movements-count]')).toHaveText('13')
    const headerText = await card(page).locator('h2').locator('..').innerText()
    expect(headerText).not.toMatch(/€/)
  })

  test("only the user's entries, newest first, grouped by local day", async ({ page }) => {
    await openCard(page)
    await card(page).locator('[data-movements-more]').click()
    expect(await rowNames(page)).toEqual(DEMO_ORDER)
    for (const name of FIXED) await expect(row(page, name)).toHaveCount(0)

    const days = card(page).locator('[data-movements-day]')
    await expect(days).toHaveCount(8)
    await expect(days.nth(0).locator('h3')).toHaveText('jue 10 sept')
    await expect(days.nth(1).locator('h3')).toHaveText('mié 9 sept')
    await expect(days.nth(2).locator('h3')).toHaveText('mar 8 sept')
    await expect(days.nth(1).locator('[data-movement-row]')).toHaveCount(2)
    // "Café" is stored at 23:30 UTC on the 2nd: the 3rd in Dublin, after the 3rd's two rows.
    await expect(days.nth(7).locator('h3')).toHaveText('jue 3 sept')
    await expect(days.nth(7)).toContainText(/Supermercado.*Ahorro mensual.*Café/s)
    // No heading carries an amount.
    for (const text of await card(page).locator('h3').allInnerTexts()) expect(text).not.toMatch(/€/)
  })

  test('each kind reads its own line and sign', async ({ page }) => {
    await openCard(page)
    const cine = row(page, 'Cine')
    await expect(cine).toContainText('Ocio')
    await expect(cine).toContainText(/45\s?€/)
    await expect(cine.locator('[data-category-dot]')).toHaveAttribute('data-category-dot', 'violeta_metalico')

    const freelance = row(page, 'Freelance')
    await expect(freelance).toContainText('Ingreso')
    await expect(freelance).toContainText(/\+420\s?€/)
    const brand = await tokenColor(page, '--brand-ink')
    expect(await freelance.locator('span.shrink-0.rounded-lg').evaluate((el) => getComputedStyle(el).color)).toBe(brand)

    const retiro = row(page, 'Retiro emergencia')
    await expect(retiro).toContainText('Retiro')
    await expect(retiro).toContainText(/−80\s?€/)
    const foreground = await tokenColor(page, '--foreground')
    expect(await retiro.locator('span.shrink-0.rounded-lg').evaluate((el) => getComputedStyle(el).color)).toBe(foreground)
    await expect(retiro).toHaveAttribute('aria-label', /Retiro emergencia, Retiro, mar 8 sept, −80\s?€/)
  })

  test('the filter narrows by kind, by keyboard too, and announces the count', async ({ page }) => {
    await openCard(page)
    await segment(page, 'income').click()
    expect(await rowNames(page)).toEqual(['Freelance'])
    await expect(card(page).locator('[data-movements-day] h3')).toHaveText(['sáb 5 sept'])

    await segment(page, 'savings').click()
    expect(await rowNames(page)).toEqual(['Bono ahorro', 'Retiro emergencia', 'Ahorro mensual'])
    await expect(card(page).locator('[data-movements-day]')).toHaveCount(3)
    await expect(card(page).locator('[aria-live="polite"]')).toHaveText('Mostrando 3 movimientos')

    await segment(page, 'all').click()
    await segment(page, 'all').focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(segment(page, 'income')).toHaveAttribute('aria-checked', 'true')
    await expect(segment(page, 'income')).toBeFocused()
    expect(await rowNames(page)).toEqual(['Freelance'])

    const heights = await card(page).locator('[data-segment]').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(44)
  })

  test('a new expense appears under its day and the count follows', async ({ page }) => {
    await addExpense(page, 'salud', { amount: '12', description: 'Farmacia', date: '2026-09-09' })
    await expect(card(page).locator('[data-movements-count]')).toHaveText('14')
    await openCard(page)
    await expect(card(page).locator('[data-movements-day="2026-09-09"]')).toContainText('Farmacia')
  })

  test('show more, show less, and the filter goes back to the first page', async ({ page }) => {
    await openCard(page)
    await expect(rows(page)).toHaveCount(10)
    expect(await rowNames(page)).toEqual(DEMO_ORDER.slice(0, 10))
    const more = card(page).locator('[data-movements-more]')
    await expect(more).toHaveText('Mostrar más')

    await more.click()
    await expect(rows(page)).toHaveCount(13)
    await expect(rows(page).nth(10)).toBeFocused()
    await expect(more).toHaveText('Mostrar menos')

    await more.click()
    await expect(rows(page)).toHaveCount(10)
    await expect.poll(() => card(page).evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0)

    await more.click()
    await expect(rows(page)).toHaveCount(13)
    await segment(page, 'expense').click()
    await segment(page, 'all').click()
    await expect(rows(page)).toHaveCount(10)
  })

  test('no "Mostrar más" with fewer than a page', async ({ page }) => {
    await openCard(page)
    await segment(page, 'savings').click()
    await expect(rows(page)).toHaveCount(3)
    await expect(card(page).locator('[data-movements-more]')).toHaveCount(0)
  })

  test('a row opens its sheet and the edit shows in both places', async ({ page }) => {
    await openCard(page)
    await row(page, 'Conciertos').click()
    const dialog = sheet(page)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Importe')).toHaveValue(/85/)
    await dialog.getByLabel('Importe').fill('90')
    await dialog.getByRole('button', { name: /^(Guardar|Añadir)$/ }).click()
    await expect(dialog).toBeHidden()
    await expect(row(page, 'Conciertos')).toContainText(/90\s?€/)
    await expect(page.locator('#category-panel-ocio')).toContainText(/90\s?€/)
  })

  test('a savings row opens the savings sheet', async ({ page }) => {
    await openCard(page)
    await row(page, 'Bono ahorro').click()
    const dialog = sheet(page)
    await expect(dialog.getByText('Editar movimiento')).toBeVisible()
    await expect(dialog.getByLabel('Nombre')).toHaveValue('Bono ahorro')
    await expect(dialog.getByLabel('Importe')).toHaveValue('50')
    await dialog.getByLabel('Importe').fill('80')
    await dialog.getByRole('button', { name: 'Guardar' }).click()
    await expect(dialog).toBeHidden()
    await expect(row(page, 'Bono ahorro')).toContainText(/\+80\s?€/)
  })

  test('a deposit already saved says so on its muted line', async ({ page }) => {
    await page.getByRole('button', { name: /^Ahorro/ }).first().click()
    await page.locator('#summary-group-panel').getByRole('button', { name: 'Añadir movimiento de ahorro' }).click()
    const dialog = sheet(page)
    await dialog.getByRole('switch', { name: 'Ya lo tenía ahorrado' }).click()
    await dialog.getByLabel('Nombre').fill('Ahorros de antes')
    await dialog.getByLabel('Importe').fill('1000')
    await dialog.getByRole('button', { name: 'Añadir', exact: true }).click()
    await expect(dialog).toBeHidden()
    await page.keyboard.press('Escape')
    await openCard(page)
    await expect(row(page, 'Ahorros de antes')).toContainText('Depósito · Ya ahorrado')
    await expect(row(page, 'Ahorros de antes')).toContainText(/\+1\.000\s?€/)
  })

  test('swipe to delete with undo, in the card and in its category', async ({ page }) => {
    await openCard(page)
    await longSwipe(page, row(page, 'Electrónica'))
    await expect(page.getByText('Gasto eliminado')).toBeVisible()
    await expect(row(page, 'Electrónica')).toHaveCount(0)
    await expect(page.locator('#category-panel-compras')).not.toContainText('Electrónica')
    await page.getByRole('button', { name: 'Deshacer' }).click()
    await expect(row(page, 'Electrónica')).toHaveCount(1)
    await expect(page.locator('#category-panel-compras')).toContainText('Electrónica')
  })

  test('an empty filter keeps the filter and names the kind', async ({ page }) => {
    await openCard(page)
    await longSwipe(page, row(page, 'Freelance'))
    await expect(row(page, 'Freelance')).toHaveCount(0)
    await segment(page, 'income').click()
    await expect(card(page).locator('[data-movements-empty-filter]')).toHaveText('No hay ingresos cargados este mes')
    await expect(segment(page, 'income')).toBeVisible()
  })

  test('a projected cycle is empty, and the filter starts over on the way back', async ({ page }) => {
    await openCard(page)
    await segment(page, 'savings').click()
    await page.locator('button[aria-label="Ciclo siguiente"]').last().click()
    await expect(card(page).locator('[data-movements-count]')).toHaveText('0')
    await openCard(page)
    await expect(card(page).locator('[data-movements-empty]')).toBeVisible()
    await expect(card(page).locator('[data-segment]')).toHaveCount(0)
    await expect(rows(page)).toHaveCount(0)

    await page.locator('button[aria-label="Ciclo anterior"]').last().click()
    await expect(card(page).locator('[data-movements-count]')).toHaveText('13')
    await openCard(page)
    await expect(segment(page, 'all')).toHaveAttribute('aria-checked', 'true')
  })

  test('nothing moves with reduced motion', async ({ page }) => {
    await openCard(page)
    const running = () =>
      card(page).evaluate((el) =>
        el
          .getAnimations({ subtree: true })
          .filter((a) => a.playState === 'running')
          .map((a) => ('transitionProperty' in a ? a.transitionProperty : 'animationName' in a ? a.animationName : 'animation'))
          // A colour may still fade; nothing may be translated or scaled.
          .filter((name) => name !== 'color' && name !== 'background-color' && name !== 'opacity'),
      )
    // The chevron's turn belongs to opening the card, not to the changes measured here.
    await card(page).evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
    await segment(page, 'savings').click()
    expect(await running()).toEqual([])
    await segment(page, 'all').click()
    await card(page).locator('[data-movements-more]').click()
    expect(await running()).toEqual([])
  })

  test('no axe violation in either theme', async ({ page }) => {
    await openCard(page)
    expect(await axeViolations(page)).toEqual([])
  })
})

test.describe('on a laptop', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!testInfo.title.startsWith('swipe hint')) await skipHint(page)
    await loadDesktop(page)
  })

  test('swipe hint: plays when the open card scrolls into view, not before', async ({ page }) => {
    await page.waitForTimeout(500)
    await expect(hint(page)).toHaveCount(0)
    await scrollDown(page, 8)
    await expect(hint(page)).toHaveCount(1)
  })

  test('open by default in the main column while the categories start folded, outside expand and collapse all', async ({ page }) => {
    await expect(page.locator('[data-dashboard-main] [data-movements-card]')).toHaveCount(1)
    await expect(header(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(rows(page)).toHaveCount(10)
    await expect(page.locator('[aria-controls="category-panel-ocio"]')).toHaveAttribute('aria-expanded', 'false')
    await page.getByRole('button', { name: 'Expandir todas' }).click()
    await expect(page.locator('[aria-controls="category-panel-ocio"]')).toHaveAttribute('aria-expanded', 'true')
    await expect(header(page)).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('button', { name: 'Contraer todas' }).click()
    await expect(page.locator('[aria-controls="category-panel-ocio"]')).toHaveAttribute('aria-expanded', 'false')
    await expect(header(page)).toHaveAttribute('aria-expanded', 'true')
  })

  test('the sidebar entry scrolls to the card and opens it', async ({ page }) => {
    await header(page).scrollIntoViewIfNeeded()
    await header(page).click()
    await expect(header(page)).toHaveAttribute('aria-expanded', 'false')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(300)
    const entry = page.locator('[data-shell-nav="movimientos"]')
    await expect(entry).toHaveText(/Movimientos/)
    await entry.click()
    await expect(header(page)).toHaveAttribute('aria-expanded', 'true')
    await expect.poll(() => card(page).evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeGreaterThanOrEqual(TOP_BAR_HEIGHT)
    await expect(entry).toHaveAttribute('aria-current', 'true')
  })

  test('no axe violation in either theme', async ({ page }) => {
    expect(await axeViolations(page)).toEqual([])
  })
})
