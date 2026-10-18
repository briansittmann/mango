// @ts-check
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { loadDesktop, openCategory } from './desktop-helpers'

// `payment-method`, `expense-editing` → *Payment method on an expense*, `income-editing` →
// *Payment method on an income entry*, `dashboard-ui` → *A row shows how it was paid* and *The demo's
// payment methods*, `design-system` → *Payment-method surfaces follow the system*, on `/demo` in
// Spanish (September 2026, today clamped to the 30th): free margin 864 €, cash 142,60 € ("Café"
// −62,40 on the 2nd, the 100 € transfer on the 4th, "Cine" −45 on the 5th, plus 150 € of August tips),
// card 1.492,40 €.

// The sample is a European account, not offered the feature (D14): this flag mounts it offered.
const DEMO = '/demo?e2e=payment-methods'

const dialog = (page) => page.locator('div[role="dialog"][data-open]').last()
const pockets = (page) => page.locator('[data-pockets]')
const pocket = (page, method) => page.locator(`[data-pocket="${method}"]`)
const moveButton = (page) => page.locator('[data-move-money]')
const chips = (sheet) => sheet.locator('[data-payment-chips]')
const chip = (sheet, name) => chips(sheet).getByRole('button', { name, exact: true })
const pocketRowsOf = (sheet) => sheet.locator('[data-pocket-rows] [data-movement-row]')

// Totals are rolling counters: the aria-hidden digit columns are stripped before matching.
function visibleText(locator) {
  return locator.evaluate((root) => {
    const copy = /** @type {Element} */ (root.cloneNode(true))
    // The inline scripts carry the message catalogue, every string of the page included.
    copy.querySelectorAll('[aria-hidden="true"], script').forEach((node) => node.remove())
    return (copy.textContent ?? '').replace(/\s+/g, ' ')
  })
}
const body = (page) => visibleText(page.locator('body'))

const money = (figure) => new RegExp(`${figure.replace(/\./g, '\\.')}\\s?€`)

async function expectPockets(page, cash, card) {
  await expect(pocket(page, 'efectivo')).toHaveAttribute('aria-label', new RegExp(`Efectivo: ${money(cash).source}`))
  await expect(pocket(page, 'tarjeta')).toHaveAttribute('aria-label', new RegExp(`Tarjeta: ${money(card).source}`))
}

async function expectFigure(page, label, figure) {
  await expect.poll(() => body(page)).toMatch(new RegExp(`${label}\\s*${money(figure).source}`))
}

async function addExpenseSheet(page, categoryId) {
  const panel = await openCategory(page, categoryId)
  await panel.getByRole('button', { name: 'Añadir gasto' }).click()
  const sheet = dialog(page)
  await expect(sheet.getByText('Nuevo gasto')).toBeVisible()
  return sheet
}

async function openExpense(page, categoryId, name) {
  const panel = await openCategory(page, categoryId)
  await panel.getByRole('button', { name: new RegExp(`^${name}`) }).first().click()
  const sheet = dialog(page)
  await expect(sheet).toBeVisible()
  return sheet
}

async function save(sheet, name = /^(Guardar|Añadir)$/) {
  await sheet.getByRole('button', { name }).click()
  await expect(sheet).toBeHidden()
}

async function openPocket(page, method) {
  const sheet = dialog(page)
  // A tap that lands before hydration does nothing (WebKit, under load): tap again only then.
  await expect(async () => {
    if ((await sheet.locator(`[data-pocket-sheet="${method}"]`).count()) === 0) await pocket(page, method).click()
    await expect(sheet.locator(`[data-pocket-sheet="${method}"]`)).toBeVisible({ timeout: 3000 })
  }).toPass({ timeout: 15000 })
  return sheet
}

async function openMoveMoney(page) {
  await moveButton(page).click()
  const sheet = dialog(page)
  await expect(sheet.locator('[data-move-money-sheet]')).toBeVisible()
  return sheet
}

/** A swipe across the whole sheet at the row's height: the name alone is too short to arm it. */
async function longSwipe(page, row, container) {
  await row.scrollIntoViewIfNeeded()
  const box = await row.boundingBox()
  const outer = await container.boundingBox()
  if (!box || !outer) throw new Error('row not visible')
  const y = box.y + box.height / 2
  await page.mouse.move(outer.x + outer.width - 10, y)
  await page.mouse.down()
  await page.mouse.move(outer.x + 10, y, { steps: 12 })
  await page.mouse.up()
}

async function axeViolations(page, selector) {
  await page.evaluate(readFileSync('node_modules/axe-core/axe.min.js', 'utf8'))
  const found = []
  for (const theme of ['light', 'dark']) {
    await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme)
    await page.waitForTimeout(300)
    const violations = await page.evaluate(async (selector) => {
      // @ts-expect-error axe is attached by the evaluated source above
      const result = await window.axe.run(document.querySelector(selector), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })
      return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
    }, selector)
    found.push(...violations.map((v) => `${theme} ${v}`))
  }
  return found
}

const box = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }
  })
const target = (locator) => locator.evaluate((el) => ({ width: /** @type {HTMLElement} */ (el).offsetWidth, height: /** @type {HTMLElement} */ (el).offsetHeight }))
const fontSize = (locator) => locator.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('plain /demo is not offered the feature: no chip, icon or pocket', async ({ page }) => {
    await page.goto('/demo')
    await expectFigure(page, 'Margen libre', '864')
    await expect(pockets(page)).toHaveCount(0)
    await expect(moveButton(page)).toHaveCount(0)
    const comida = await openCategory(page, 'comida')
    await expect(comida.locator('[data-payment-method]')).toHaveCount(0)
    await expect(comida.getByRole('button', { name: /^Café/ })).not.toHaveAccessibleName(/en efectivo/)
    await comida.getByRole('button', { name: 'Añadir gasto' }).click()
    const sheet = dialog(page)
    await expect(sheet.getByText('Nuevo gasto')).toBeVisible()
    await expect(chips(sheet)).toHaveCount(0)
  })

  test.describe('chips in the entry sheet', () => {
    test('a new expense shows both chips right after the amount, neither pressed', async ({ page }) => {
      await page.goto(DEMO)
      const sheet = await addExpenseSheet(page, 'ocio')
      await expect(chips(sheet)).toHaveAttribute('role', 'group')
      await expect(chips(sheet)).toHaveAttribute('aria-label', 'Medio de pago')
      await expect(chip(sheet, 'Efectivo')).toHaveAttribute('aria-pressed', 'false')
      await expect(chip(sheet, 'Tarjeta')).toHaveAttribute('aria-pressed', 'false')
      // The row right before the group is the amount's.
      const previous = await chips(sheet).evaluate((group) => group.previousElementSibling?.querySelector('label')?.textContent ?? null)
      expect(previous).toBe('Importe')
    })

    test('marking, switching and unmarking', async ({ page }) => {
      await page.goto(DEMO)
      const sheet = await addExpenseSheet(page, 'ocio')
      await chip(sheet, 'Efectivo').click()
      await expect(chip(sheet, 'Efectivo')).toHaveAttribute('aria-pressed', 'true')
      await expect(chip(sheet, 'Tarjeta')).toHaveAttribute('aria-pressed', 'false')
      await chip(sheet, 'Tarjeta').click()
      await expect(chip(sheet, 'Efectivo')).toHaveAttribute('aria-pressed', 'false')
      await expect(chip(sheet, 'Tarjeta')).toHaveAttribute('aria-pressed', 'true')
      await chip(sheet, 'Tarjeta').click()
      await expect(chip(sheet, 'Efectivo')).toHaveAttribute('aria-pressed', 'false')
      await expect(chip(sheet, 'Tarjeta')).toHaveAttribute('aria-pressed', 'false')
    })

    test('the default preselects, and unmarking it saves no method', async ({ page }) => {
      await page.goto('/demo?e2e=default-tarjeta')
      const sheet = await addExpenseSheet(page, 'ocio')
      await expect(chip(sheet, 'Tarjeta')).toHaveAttribute('aria-pressed', 'true')
      await chip(sheet, 'Tarjeta').click()
      await sheet.getByLabel('Importe').fill('9')
      await sheet.getByLabel('Descripción').fill('Chicles')
      await save(sheet)
      const row = page.locator('#category-panel-ocio').getByRole('button', { name: /^Chicles/ })
      await expect(row).toBeVisible()
      await expect(row.locator('[data-payment-method]')).toHaveCount(0)
      await expectPockets(page, '142,60', '1.492,40')
    })

    test('edit shows the row’s own method, whatever the default', async ({ page }) => {
      await page.goto('/demo?e2e=default-tarjeta')
      const sheet = await openExpense(page, 'comida', 'Café')
      await expect(chip(sheet, 'Efectivo')).toHaveAttribute('aria-pressed', 'true')
      await expect(chip(sheet, 'Tarjeta')).toHaveAttribute('aria-pressed', 'false')
    })

    test('a fixed charge asks how far a changed method reaches before writing', async ({ page }) => {
      await page.goto(DEMO)
      const sheet = await openExpense(page, 'vivienda', 'Alquiler')
      await expect(chip(sheet, 'Tarjeta')).toHaveAttribute('aria-pressed', 'true')
      const scopeShown = () => sheet.getByText('Solo este mes').evaluate((el) => el.closest('[inert]') == null)
      expect(await scopeShown()).toBe(false)
      await chip(sheet, 'Efectivo').click()
      await expect.poll(scopeShown).toBe(true)
      await expect(sheet.getByText('Desde este mes en adelante')).toBeVisible()
      await expectPockets(page, '142,60', '1.492,40')
    })

    test('the method moves no figure but the pockets', async ({ page }) => {
      await page.goto(DEMO)
      const comida = page.locator('[aria-controls="category-panel-comida"]')
      const comidaBefore = await visibleText(comida)

      let sheet = await openExpense(page, 'comida', 'Restaurante')
      await expect(chip(sheet, 'Tarjeta')).toHaveAttribute('aria-pressed', 'true')
      await chip(sheet, 'Efectivo').click()
      await save(sheet, 'Guardar')
      await expectPockets(page, '75', '1.560')
      await expectFigure(page, 'Gastos', '1.700')
      await expectFigure(page, 'Margen libre', '864')
      await expect.poll(() => visibleText(comida)).toBe(comidaBefore)

      sheet = await openExpense(page, 'comida', 'Restaurante')
      await expect(chip(sheet, 'Efectivo')).toHaveAttribute('aria-pressed', 'true')
      await chip(sheet, 'Efectivo').click()
      await save(sheet, 'Guardar')
      await expectPockets(page, '142,60', '1.560')
      await expectFigure(page, 'Gastos', '1.700')
      await expectFigure(page, 'Margen libre', '864')
      await expect.poll(() => visibleText(comida)).toBe(comidaBefore)
    })

    test('cash tips: an income in cash moves the income, the margin and the cash pocket only', async ({ page }) => {
      await page.goto(DEMO)
      await page.getByRole('button', { name: /^Ingresos/ }).click()
      await page.locator('#summary-group-panel').getByRole('button', { name: 'Añadir ingreso' }).click()
      const sheet = dialog(page)
      await expect(sheet.getByText('Nuevo ingreso')).toBeVisible()
      await expect(chip(sheet, 'Efectivo')).toHaveAttribute('aria-pressed', 'false')
      await expect(chip(sheet, 'Tarjeta')).toHaveAttribute('aria-pressed', 'false')
      await sheet.getByLabel('Importe').fill('40')
      await sheet.locator('input[type="text"]').first().fill('Propinas')
      await chip(sheet, 'Efectivo').click()
      await save(sheet, /^Añadir$/)

      await expectFigure(page, 'Ingresos', '2.860')
      await expectFigure(page, 'Margen libre', '904')
      await expectPockets(page, '182,60', '1.492,40')
    })

    test('the savings sheet has no payment method', async ({ page }) => {
      await page.goto(DEMO)
      await page.locator('[aria-controls="summary-group-panel"]').filter({ hasText: /^Ahorro/ }).click()
      const panel = page.locator('#summary-group-panel')
      await panel.getByRole('button', { name: 'Añadir movimiento de ahorro' }).click()
      let sheet = dialog(page)
      await expect(sheet.getByText('Nuevo movimiento')).toBeVisible()
      await expect(chips(sheet)).toHaveCount(0)
      await sheet.getByRole('button', { name: 'Cancelar' }).click()
      await expect(sheet).toBeHidden()

      await panel.locator('[data-savings-movement-row]').filter({ hasText: 'Bono ahorro' }).click()
      sheet = dialog(page)
      await expect(sheet.getByText('Editar movimiento')).toBeVisible()
      await expect(chips(sheet)).toHaveCount(0)
    })
  })

  test.describe('rows', () => {
    test('cash and card rows show their icon before the date, named in words', async ({ page }) => {
      await page.goto(DEMO)
      const panel = await openCategory(page, 'comida')
      const cafe = panel.getByRole('button', { name: /^Café/ })
      const restaurante = panel.getByRole('button', { name: /^Restaurante/ })
      await expect(cafe.locator('[data-payment-method="efectivo"] svg')).toHaveAttribute('aria-hidden', 'true')
      await expect(restaurante.locator('[data-payment-method="tarjeta"] svg')).toHaveAttribute('aria-hidden', 'true')
      await expect(cafe).toHaveAccessibleName(/en efectivo/)
      await expect(restaurante).toHaveAccessibleName(/con tarjeta/)

      const colours = await cafe.locator('[data-payment-method="efectivo"]').evaluate((el) => {
        const icon = /** @type {Element} */ (el.querySelector('svg'))
        const probe = document.createElement('span')
        probe.className = 'text-muted-foreground'
        document.body.appendChild(probe)
        const muted = getComputedStyle(probe).color
        probe.remove()
        return { icon: getComputedStyle(icon).color, muted }
      })
      expect(colours.icon).toBe(colours.muted)
    })

    test('a row with no method is unchanged: its date starts where its name does', async ({ page }) => {
      await page.goto(DEMO)
      const panel = await openCategory(page, 'compras')
      const ropa = panel.getByRole('button', { name: /^Ropa/ })
      await expect(ropa.locator('[data-payment-method]')).toHaveCount(0)
      const lines = await ropa.evaluate((el) => {
        const [name, date] = /** @type {HTMLElement} */ (el.querySelector('span.block')).children
        return { name: name.getBoundingClientRect().left, date: date.getBoundingClientRect().left, height: el.getBoundingClientRect().height }
      })
      expect(lines.date).toBe(lines.name)

      // Same height as a row that carries an icon.
      const cafe = (await openCategory(page, 'comida')).getByRole('button', { name: /^Café/ })
      expect((await box(cafe)).height).toBe(lines.height)
    })

    test('a transfer appears in no card, panel or widget', async ({ page }) => {
      await page.goto(DEMO)
      // Visible text only: a slow load can hold streamed markup the page has not shown yet.
      await expect(page.getByText('Tarjeta a efectivo').locator('visible=true')).toHaveCount(0)
      await page.getByRole('button', { name: /^Ingresos/ }).click()
      await expect(page.locator('#summary-group-panel')).not.toContainText('Tarjeta a efectivo')
    })
  })

  test.describe('the pockets block', () => {
    test('seeded balances under the free margin, smaller, with the swap button on the boundary', async ({ page }) => {
      await page.goto(DEMO)
      await expectFigure(page, 'Margen libre', '864')
      await expectPockets(page, '142,60', '1.492,40')
      await expect(pockets(page)).toHaveCSS('border-top-style', 'solid')

      const cash = await box(pocket(page, 'efectivo'))
      const card = await box(pocket(page, 'tarjeta'))
      const swap = await box(moveButton(page))
      expect(cash.right).toBeLessThan(card.left)
      expect(Math.abs(swap.left + swap.width / 2 - (cash.right + card.left) / 2)).toBeLessThanOrEqual(1)
      await expect(moveButton(page)).toHaveAccessibleName('Mover plata')

      const margin = page.locator('.hero-value').first()
      const marginSize = await fontSize(margin)
      for (const method of ['efectivo', 'tarjeta']) {
        expect(await fontSize(pocket(page, method).locator('> span').last())).toBeLessThan(marginSize)
      }
    })

    test('the blocks stay with the strip folded or open, and never toggle it', async ({ page }) => {
      await page.goto(DEMO)
      const toggle = page.locator('[aria-controls="free-margin-composition"]')
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await expect(pockets(page)).toBeVisible()
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await expect(pockets(page)).toBeVisible()
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')

      const sheet = await openPocket(page, 'efectivo')
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await sheet.getByRole('button', { name: 'Volver' }).click()
      await expect(sheet).toBeHidden()
      const move = await openMoveMoney(page)
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await move.getByRole('button', { name: 'Cancelar' }).click()
    })

    test('no block in a projection', async ({ page }) => {
      await page.goto(DEMO)
      await expect(pockets(page)).toBeVisible()
      const title = page.locator('[data-month-picker-trigger]').last()
      await page.locator('button[aria-label="Ciclo siguiente"]').last().click()
      await expect(title).toContainText(/octubre/i)
      await expect.poll(() => body(page)).toMatch(/Proyección/)
      await expect(pockets(page)).toHaveCount(0)
      await expect(moveButton(page)).toHaveCount(0)
    })

    test('no pockets until the first mark, and none again once it is deleted', async ({ page }) => {
      await page.goto('/demo?e2e=no-payment-methods')
      await expectFigure(page, 'Margen libre', '864')
      await expect(pockets(page)).toHaveCount(0)

      const sheet = await addExpenseSheet(page, 'ocio')
      await sheet.getByLabel('Importe').fill('12')
      await sheet.getByLabel('Descripción').fill('Helado')
      await chip(sheet, 'Efectivo').click()
      await save(sheet)
      await expectPockets(page, '[−-]12', '0')
      await expect(pocket(page, 'efectivo').locator('.text-destructive-ink')).toHaveCount(1)

      const edit = await openExpense(page, 'ocio', 'Helado')
      await edit.getByRole('button', { name: 'Eliminar gasto' }).click()
      await expect(edit).toBeHidden()
      await expect(pockets(page)).toHaveCount(0)
    })

    test('the pockets are opaque', async ({ page }) => {
      await page.goto(DEMO)
      for (const theme of ['light', 'dark']) {
        await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme)
        for (const method of ['efectivo', 'tarjeta']) {
          const style = await pocket(page, method).evaluate((el) => {
            const cs = getComputedStyle(el)
            return { blur: cs.backdropFilter, background: cs.backgroundColor }
          })
          expect(style.blur, theme).toBe('none')
          const alpha = style.background.match(/rgba?\(([^)]+)\)/)?.[1].split(/[ ,/]+/).filter(Boolean)[3]
          expect(alpha == null || Number(alpha) === 1, `${theme} ${style.background}`).toBe(true)
        }
      }
    })
  })

  test.describe('"Mover plata"', () => {
    test('a withdrawal moves only the pockets', async ({ page }) => {
      await page.goto(DEMO)
      const sheet = await openMoveMoney(page)
      await expect(sheet.getByText('Mover plata', { exact: true })).toBeVisible()
      await expect(sheet.locator('[data-move-box="from"]')).toContainText('Tarjeta')
      await expect(sheet.locator('[data-move-box="to"]')).toContainText('Efectivo')
      await expect(sheet.getByLabel('Fecha', { exact: true })).toHaveAttribute('data-value', '2026-09-30')
      await expect(sheet.locator('button[type="submit"]')).toBeDisabled()

      await sheet.getByLabel('Importe').fill('50')
      await expect(sheet.locator('[data-preview="efectivo"]')).toContainText(money('192,60'))
      await expect(sheet.locator('[data-preview="tarjeta"]')).toContainText(money('1.442,40'))
      await expect(sheet.getByText('El margen libre no cambia')).toBeVisible()
      await sheet.getByRole('button', { name: /^Mover 50\s?€$/ }).click()
      await expect(sheet).toBeHidden()

      await expectPockets(page, '192,60', '1.442,40')
      await expectFigure(page, 'Margen libre', '864')
      await expectFigure(page, 'Ingresos', '2.820')
      await expectFigure(page, 'Gastos', '1.700')
    })

    test('swapping the direction flips the boxes and the preview', async ({ page }) => {
      await page.goto(DEMO)
      const sheet = await openMoveMoney(page)
      await sheet.getByLabel('Importe').fill('50')
      await sheet.getByRole('button', { name: 'Intercambiar origen y destino' }).click()
      await expect(sheet.locator('[data-move-box="from"]')).toContainText('Efectivo')
      await expect(sheet.locator('[data-move-box="to"]')).toContainText('Tarjeta')
      await expect(sheet.locator('[data-preview="efectivo"]')).toContainText(money('92,60'))
      await expect(sheet.locator('[data-preview="tarjeta"]')).toContainText(money('1.542,40'))
      await sheet.getByRole('button', { name: /^Mover 50\s?€$/ }).click()
      await expect(sheet).toBeHidden()
      await expectPockets(page, '92,60', '1.542,40')
    })

    test('nothing but amount, direction and date; the date stays in the cycle', async ({ page }) => {
      await page.goto(DEMO)
      const sheet = await openMoveMoney(page)
      await expect(sheet.getByLabel('Descripción')).toHaveCount(0)
      await expect(sheet.getByRole('switch')).toHaveCount(0)
      await expect(sheet.getByText('Categoría')).toHaveCount(0)
      await sheet.getByLabel('Fecha', { exact: true }).click()
      await expect(sheet.locator('[data-date-option="2026-09-01"]')).toBeEnabled()
      for (const outside of ['2026-08-31', '2026-10-01']) {
        const option = sheet.locator(`[data-date-option="${outside}"]`)
        if (await option.count()) await expect(option).toBeDisabled()
      }
      await sheet.locator('[data-date-option="2026-09-12"]').click()
      await expect(sheet.getByLabel('Fecha', { exact: true })).toHaveAttribute('data-value', '2026-09-12')
    })

    test('a failed move keeps the sheet open with its values and changes nothing', async ({ page }) => {
      await page.goto('/demo?e2e=fail-transfer')
      const sheet = await openMoveMoney(page)
      await sheet.getByLabel('Importe').fill('50')
      await sheet.getByRole('button', { name: /^Mover 50\s?€$/ }).click()
      await expect(sheet.getByRole('alert')).toBeVisible()
      await expect(sheet).toBeVisible()
      await expect(sheet.getByLabel('Importe')).toHaveValue('50')
      await expectPockets(page, '142,60', '1.492,40')
    })

    test('a reload resets the demo', async ({ page }) => {
      await page.goto(DEMO)
      const sheet = await openMoveMoney(page)
      await sheet.getByLabel('Importe').fill('50')
      await sheet.getByRole('button', { name: /^Mover 50\s?€$/ }).click()
      await expect(sheet).toBeHidden()
      await expectPockets(page, '192,60', '1.442,40')
      await page.reload()
      await expectPockets(page, '142,60', '1.492,40')
    })
  })

  test.describe('the pocket list', () => {
    test('the cash list: header and rows, newest first, the transfer muted and unsigned', async ({ page }) => {
      await page.goto(DEMO)
      const sheet = await openPocket(page, 'efectivo')
      const header = sheet.locator('[data-pocket-header]')
      await expect(sheet.getByText('Efectivo', { exact: true }).first()).toBeVisible()
      await expect.poll(() => visibleText(header)).toMatch(money('142,60'))
      await expect(header).toContainText(/Entró 100\s?€ · Salió 107,40\s?€/)

      const rows = pocketRowsOf(sheet)
      await expect(rows).toHaveCount(3)
      await expect(rows.nth(0)).toContainText('Cine')
      await expect(rows.nth(0)).toContainText(/−45\s?€/)
      await expect(rows.nth(1)).toContainText('Tarjeta a efectivo')
      await expect(rows.nth(1)).toHaveAttribute('data-movement-row', 'transfer')
      await expect(rows.nth(1)).not.toContainText(/[+−]\s?100/)
      await expect(rows.nth(1)).toContainText(money('100'))
      await expect(rows.nth(2)).toContainText('Café')
      await expect(rows.nth(2)).toContainText(/−62,40\s?€/)

      const tone = await rows.nth(1).evaluate((el) => {
        const name = /** @type {Element} */ (el.querySelector('span.block span'))
        const probe = document.createElement('span')
        probe.className = 'text-muted-foreground'
        document.body.appendChild(probe)
        const muted = getComputedStyle(probe).color
        probe.remove()
        return { name: getComputedStyle(name).color, muted }
      })
      expect(tone.name).toBe(tone.muted)
    })

    test('an expense opens its entry sheet with its method marked', async ({ page }) => {
      await page.goto(DEMO)
      const list = await openPocket(page, 'efectivo')
      await pocketRowsOf(list).filter({ hasText: 'Café' }).click()
      const sheet = dialog(page)
      await expect(sheet.getByText('Editar gasto')).toBeVisible()
      await expect(sheet.getByLabel('Descripción')).toHaveValue('Café')
      await expect(chip(sheet, 'Efectivo')).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('div[role="dialog"][data-open] [data-pocket-sheet]')).toHaveCount(0)
    })

    test('editing a transfer', async ({ page }) => {
      await page.goto(DEMO)
      const list = await openPocket(page, 'efectivo')
      await pocketRowsOf(list).filter({ hasText: 'Tarjeta a efectivo' }).click()
      const sheet = dialog(page)
      await expect(sheet.getByText('Editar movimiento')).toBeVisible()
      await expect(sheet.getByLabel('Importe')).toHaveValue('100')
      await expect(sheet.getByLabel('Fecha', { exact: true })).toHaveAttribute('data-value', '2026-09-04')
      await expect(sheet.locator('[data-move-box="to"]')).toContainText('Efectivo')
      await sheet.getByLabel('Importe').fill('120')
      await save(sheet, 'Guardar')
      await expectPockets(page, '162,60', '1.472,40')
      await expectFigure(page, 'Margen libre', '864')
    })

    test('deleting a transfer from its sheet, with undo', async ({ page }) => {
      await page.goto(DEMO)
      const list = await openPocket(page, 'efectivo')
      await pocketRowsOf(list).filter({ hasText: 'Tarjeta a efectivo' }).click()
      const sheet = dialog(page)
      await sheet.getByRole('button', { name: 'Eliminar movimiento' }).click()
      await expect(sheet).toBeHidden()
      await expect(page.getByText('Movimiento eliminado')).toBeVisible()
      await expectPockets(page, '42,60', '1.592,40')
      await page.getByRole('button', { name: 'Deshacer' }).click()
      await expectPockets(page, '142,60', '1.492,40')
    })

    test('swiping a transfer away, with undo', async ({ page }) => {
      await page.goto(DEMO)
      const list = await openPocket(page, 'efectivo')
      const transfer = pocketRowsOf(list).filter({ hasText: 'Tarjeta a efectivo' })
      await longSwipe(page, transfer, list)
      await expect(page.getByText('Movimiento eliminado')).toBeVisible()
      await expect(transfer).toHaveCount(0)
      await expectPockets(page, '42,60', '1.592,40')
      await page.getByRole('button', { name: 'Deshacer' }).click()
      await expectPockets(page, '142,60', '1.492,40')
      await expect(transfer).toHaveCount(1)
    })

    test('an empty pocket says so', async ({ page }) => {
      await page.goto('/demo?e2e=no-payment-methods')
      const sheet = await addExpenseSheet(page, 'ocio')
      await sheet.getByLabel('Importe').fill('12')
      await sheet.getByLabel('Descripción').fill('Helado')
      await chip(sheet, 'Efectivo').click()
      await save(sheet)
      const list = await openPocket(page, 'tarjeta')
      await expect(list.getByText('No hay movimientos este mes')).toBeVisible()
      await expect(pocketRowsOf(list)).toHaveCount(0)
    })
  })

  test.describe('look and motion', () => {
    test('targets: chips, blocks, swap buttons and back are 44px; list rows 48px', async ({ page }) => {
      await page.goto(DEMO)
      for (const method of ['efectivo', 'tarjeta']) {
        const b = await target(pocket(page, method))
        expect(b.height, method).toBeGreaterThanOrEqual(44)
        expect(b.width, method).toBeGreaterThanOrEqual(44)
      }
      const swap = await target(moveButton(page))
      expect(Math.min(swap.width, swap.height)).toBeGreaterThanOrEqual(44)

      const entry = await addExpenseSheet(page, 'ocio')
      for (const name of ['Efectivo', 'Tarjeta']) {
        const b = await target(chip(entry, name))
        expect(Math.min(b.width, b.height), name).toBeGreaterThanOrEqual(44)
      }
      await entry.getByRole('button', { name: 'Cancelar' }).click()
      await expect(entry).toBeHidden()

      const move = await openMoveMoney(page)
      const sheetSwap = await target(move.getByRole('button', { name: 'Intercambiar origen y destino' }))
      expect(Math.min(sheetSwap.width, sheetSwap.height)).toBeGreaterThanOrEqual(44)
      await move.getByRole('button', { name: 'Cancelar' }).click()
      await expect(move).toBeHidden()

      const list = await openPocket(page, 'efectivo')
      const back = await target(list.getByRole('button', { name: 'Volver' }))
      expect(Math.min(back.width, back.height)).toBeGreaterThanOrEqual(44)
      for (const row of await pocketRowsOf(list).all()) expect((await target(row)).height).toBeGreaterThanOrEqual(48)
    })

    test('a marked chip differs by more than colour, in both themes', async ({ page }) => {
      await page.goto(DEMO)
      const sheet = await addExpenseSheet(page, 'ocio')
      await chip(sheet, 'Efectivo').click()
      for (const theme of ['light', 'dark']) {
        await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme)
        const weight = (name) => chip(sheet, name).evaluate((el) => Number(getComputedStyle(el).fontWeight))
        expect(await weight('Efectivo'), theme).toBeGreaterThan(await weight('Tarjeta'))
        await expect(chip(sheet, 'Efectivo')).toHaveAttribute('aria-pressed', 'true')
      }
    })

    test('reduced motion: the sheets are at rest at once and the balances change without counting', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(DEMO)
      const atRest = async () => {
        const first = await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => {
                const el = /** @type {Element | null} */ (document.querySelector('div[role="dialog"][data-open]'))
                resolve(el ? Math.round(el.getBoundingClientRect().top) : null)
              }),
            ),
        )
        await page.waitForTimeout(500)
        const later = await dialog(page).evaluate((el) => Math.round(el.getBoundingClientRect().top))
        return { first, later }
      }

      await moveButton(page).click()
      const move = await atRest()
      expect(move.first).toBe(move.later)
      const sheet = dialog(page)
      await sheet.getByLabel('Importe').fill('50')
      await sheet.getByRole('button', { name: /^Mover 50\s?€$/ }).click()
      await expect(sheet).toBeHidden()
      await expect(pocket(page, 'efectivo').locator('.count-up')).toHaveCount(0)
      expect(await visibleText(pocket(page, 'efectivo'))).toMatch(money('192,60'))

      await pocket(page, 'efectivo').click()
      const list = await atRest()
      expect(list.first).toBe(list.later)
    })

    test('no axe violation on the card and both sheets, in either theme', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(DEMO)
      expect(await axeViolations(page, '[data-pockets]')).toEqual([])

      const move = await openMoveMoney(page)
      await move.getByLabel('Importe').fill('50')
      expect(await axeViolations(page, 'div[role="dialog"][data-open]')).toEqual([])
      await move.getByRole('button', { name: 'Cancelar' }).click()
      await expect(move).toBeHidden()

      await openPocket(page, 'efectivo')
      expect(await axeViolations(page, 'div[role="dialog"][data-open]')).toEqual([])
    })
  })
})

test.describe('on a laptop', () => {
  test('the pockets sit inside the first tile, under the income line', async ({ page }) => {
    await loadDesktop(page, { path: DEMO })
    await expect(pockets(page)).toBeVisible()
    await expectPockets(page, '142,60', '1.492,40')
    const tile = await box(pockets(page).locator('xpath=..'))
    const block = await box(pockets(page))
    expect(block.left).toBeGreaterThanOrEqual(tile.left)
    expect(block.right).toBeLessThanOrEqual(tile.right)
    // At `lg` the card is no control: nothing folds.
    await expect(page.locator('[aria-controls="free-margin-composition"]')).toHaveCount(0)
  })

  test('with the pockets the other tiles show their trend; without them they do not', async ({ page }) => {
    await loadDesktop(page, { path: DEMO })
    for (const key of ['income', 'expenses', 'savings']) {
      await expect(page.locator(`[data-summary-column="${key}"] [data-summary-trend]`)).toHaveCount(1)
      await expect(page.locator(`[data-summary-column="${key}"] [data-sparkline]`)).toHaveCount(1)
    }
    await loadDesktop(page)
    await expect(pockets(page)).toHaveCount(0)
    await expect(page.locator('[data-summary-tiles] [data-summary-trend]')).toHaveCount(0)
  })

  test('"Mover plata" is a side panel and moves the money', async ({ page }) => {
    await loadDesktop(page, { path: DEMO })
    await moveButton(page).click()
    const sheet = dialog(page)
    await expect(sheet.locator('[data-move-money-sheet]')).toBeVisible()
    await expect(sheet).toHaveAttribute('data-presentation', 'side')
    await sheet.getByLabel('Importe').fill('50')
    await sheet.locator('button[type="submit"]').click()
    await expect(sheet).toBeHidden()
    await expectPockets(page, '192,60', '1.442,40')
    await expectFigure(page, 'Margen libre', '864')
  })

  test('the cash list lists its rows and opens an expense', async ({ page }) => {
    await loadDesktop(page, { path: DEMO })
    const list = await openPocket(page, 'efectivo')
    await expect(pocketRowsOf(list)).toHaveCount(3)
    await pocketRowsOf(list).filter({ hasText: 'Café' }).click()
    const sheet = dialog(page)
    await expect(sheet.getByLabel('Descripción')).toHaveValue('Café')
    await expect(chip(sheet, 'Efectivo')).toHaveAttribute('aria-pressed', 'true')
  })

  test('no axe violation on the tile and the side panels, in either theme', async ({ page }) => {
    await loadDesktop(page, { path: DEMO })
    expect(await axeViolations(page, '[data-pockets]')).toEqual([])
    await openMoveMoney(page)
    expect(await axeViolations(page, 'div[role="dialog"][data-open]')).toEqual([])
  })
})
