// @ts-check
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { contrast, loadDesktop } from './desktop-helpers'
import { sheet as dialog } from './widgets-helpers'

// `card-wallet` and `recurring-expenses` → *A fixed expense names the card it is charged to*
// (`add-card-wallet`), on `/demo` in Spanish. Fixed expenses: Alquiler 820 (1), Internet 45 (3),
// Seguro 35 (8, 4 de 10), Parking 50 (15), Limpieza 35 (20), Gimnasio 40 (22); fixed income Salario.
// Seed: "Débito" carries Alquiler and Internet (865 €), "Crédito" Gimnasio and Seguro (75 €).

const widget = (page) => page.locator('[data-wallet-widget]')
const entry = (page, name) => widget(page).locator('[data-wallet-entry]').filter({ has: page.locator('[data-wallet-card-name]', { hasText: new RegExp(`^${name}$`) }) })
const total = (page, name) => entry(page, name).locator('[data-wallet-card-total]')
const footer = (page) => widget(page).locator('[data-wallet-card-footer]')
const names = (page) => widget(page).locator('[data-wallet-card-name]').allTextContents()

/** A card's top band: every card but the last is covered below its 56px band. */
async function openCard(page, name) {
  await entry(page, name).scrollIntoViewIfNeeded()
  await entry(page, name).click({ position: { x: 40, y: 20 } })
  await expect(dialog(page)).toBeVisible()
  return dialog(page)
}

async function addCard(page) {
  await widget(page).getByRole('button', { name: 'Añadir tarjeta' }).click()
  await expect(dialog(page)).toBeVisible()
  return dialog(page)
}

const fixedRow = (sheet, name) => sheet.locator('[data-card-fixed]').filter({ hasText: name })
const check = (sheet, name) => fixedRow(sheet, name).getByRole('checkbox')

async function save(sheet) {
  await sheet.getByRole('button', { name: 'Guardar' }).click()
  await expect(sheet).toBeHidden()
}

async function nextCycle(page, month) {
  await page.locator('button[aria-label="Ciclo siguiente"]').last().click()
  await expect(page.locator('[data-month-picker-trigger]').last()).toContainText(month)
}

/** Opens a fixed expense's sheet from its category card. */
async function openFixed(page, categoryId, name) {
  const header = page.locator(`[aria-controls="category-panel-${categoryId}"]`)
  await header.scrollIntoViewIfNeeded()
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click()
  await page.locator(`#category-panel-${categoryId}`).getByRole('button', { name: new RegExp(name) }).first().click()
  await expect(dialog(page)).toBeVisible()
  return dialog(page)
}

const cardRow = (sheet) => sheet.locator('[data-fixed-card]')

async function chooseCard(sheet, name) {
  await cardRow(sheet).getByRole('button').click()
  await sheet.getByRole('radio', { name }).click()
}

/** The rotation of an element's transform around its X and Y axes, in degrees, signed for Y. */
function rotation(locator) {
  return locator.evaluate((el) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
    const deg = (rad) => (rad * 180) / Math.PI
    return { x: deg(Math.acos(Math.min(1, m.m22))), y: deg(Math.asin(Math.max(-1, Math.min(1, m.m31)))), none: getComputedStyle(el).transform === 'none' }
  })
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/demo')
    await widget(page).scrollIntoViewIfNeeded()
  })

  test('the wallet shows both seed cards with their totals', async ({ page }) => {
    expect(await names(page)).toEqual(['Débito', 'Crédito'])
    await expect(total(page, 'Débito')).toHaveText(/865\s?€/)
    await expect(total(page, 'Crédito')).toHaveText(/75\s?€/)
    await expect(footer(page)).toHaveCount(1)
    await expect(entry(page, 'Crédito').locator('[data-wallet-card-footer]')).toHaveText('2 gastos fijos')
    await expect(widget(page).getByRole('button', { name: /^Débito, 865\s?€ este mes$/ })).toBeVisible()
  })

  test('a card opens its sheet by pointer and by keyboard', async ({ page }) => {
    let sheet = await openCard(page, 'Débito')
    await expect(sheet.getByText('Débito').first()).toBeVisible()
    await expect(check(sheet, 'Alquiler')).toHaveAttribute('aria-checked', 'true')
    await sheet.getByRole('button', { name: 'Cancelar' }).click()
    await expect(sheet).toBeHidden()

    await widget(page).getByRole('button', { name: /^Crédito,/ }).focus()
    await page.keyboard.press('Enter')
    sheet = dialog(page)
    await expect(sheet).toBeVisible()
    await expect(sheet.getByLabel('Nombre')).toHaveValue('Crédito')
  })

  test('creating a card with two fixed charges', async ({ page }) => {
    const sheet = await addCard(page)
    await expect(sheet.getByText('Nueva tarjeta').first()).toBeVisible()
    await expect(fixedRow(sheet, 'Salario')).toHaveCount(0)
    await sheet.getByLabel('Nombre').fill(' Revolut ')
    await check(sheet, 'Parking').click()
    await check(sheet, 'Limpieza').click()
    await expect(sheet.locator('[data-card-preview] [data-wallet-card-total]')).toHaveText(/85\s?€/)
    await save(sheet)
    expect(await names(page)).toEqual(['Débito', 'Crédito', 'Revolut'])
    await expect(total(page, 'Revolut')).toHaveText(/85\s?€/)
    await expect(entry(page, 'Revolut').locator('[data-wallet-card-footer]')).toHaveText('2 gastos fijos')
  })

  test('a repeated name is refused', async ({ page }) => {
    const sheet = await addCard(page)
    await sheet.getByLabel('Nombre').fill('débito')
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet.getByText('Ya tienes una tarjeta con ese nombre')).toBeVisible()
    await expect(sheet).toBeVisible()
    expect(await names(page)).toEqual(['Débito', 'Crédito'])
  })

  test('a failed rename changes nothing', async ({ page }) => {
    await page.goto('/demo?e2e=fail-card-save')
    const sheet = await openCard(page, 'Débito')
    await sheet.getByLabel('Nombre').fill('Cuenta sueldo')
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet.getByRole('alert')).toContainText('No se pudo guardar')
    await expect(sheet.getByLabel('Nombre')).toHaveValue('Cuenta sueldo')
    expect(await names(page)).toEqual(['Débito', 'Crédito'])
  })

  test('ticking a fixed charge on another card moves it', async ({ page }) => {
    const sheet = await openCard(page, 'Crédito')
    await expect(fixedRow(sheet, 'Alquiler')).toContainText('En Débito')
    await check(sheet, 'Alquiler').click()
    await save(sheet)
    await expect(total(page, 'Crédito')).toHaveText(/895\s?€/)
    await expect(total(page, 'Débito')).toHaveText(/45\s?€/)
    await expect(entry(page, 'Crédito').locator('[data-wallet-card-footer]')).toHaveText('3 gastos fijos')
  })

  test('unticking leaves the fixed charge with no card', async ({ page }) => {
    const sheet = await openCard(page, 'Crédito')
    await check(sheet, 'Seguro').click()
    await save(sheet)
    await expect(entry(page, 'Crédito').locator('[data-wallet-card-footer]')).toHaveText('1 gasto fijo')
    const seguro = await openFixed(page, 'vivienda', 'Seguro')
    await expect(cardRow(seguro).locator('[data-fixed-card-current]')).toHaveText('Sin tarjeta')
  })

  test('deleting asks first, names what is freed, and cancelling keeps the card', async ({ page }) => {
    let sheet = await openCard(page, 'Crédito')
    await sheet.getByRole('button', { name: 'Eliminar tarjeta' }).click()
    await expect(sheet.getByText(/Seguro y Gimnasio quedan sin tarjeta/)).toBeVisible()
    await sheet.getByRole('button', { name: 'Cancelar' }).last().click()
    await expect(sheet.getByRole('button', { name: 'Eliminar tarjeta' })).toBeFocused()
    await sheet.getByRole('button', { name: 'Cancelar' }).first().click()
    await expect(sheet).toBeHidden()
    expect(await names(page)).toEqual(['Débito', 'Crédito'])

    sheet = await openCard(page, 'Crédito')
    await sheet.getByRole('button', { name: 'Eliminar tarjeta' }).click()
    await sheet.getByRole('button', { name: 'Eliminar', exact: true }).click()
    await expect(sheet).toBeHidden()
    expect(await names(page)).toEqual(['Débito'])
    const gimnasio = await openFixed(page, 'salud', 'Gimnasio')
    await expect(cardRow(gimnasio).locator('[data-fixed-card-current]')).toHaveText('Sin tarjeta')
    await expect(gimnasio.getByLabel('Importe')).toHaveValue('40')
  })

  test('three or more are counted in the confirmation', async ({ page }) => {
    let sheet = await openCard(page, 'Crédito')
    await check(sheet, 'Parking').click()
    await save(sheet)
    sheet = await openCard(page, 'Crédito')
    await sheet.getByRole('button', { name: 'Eliminar tarjeta' }).click()
    await expect(sheet.getByText('3 gastos fijos quedan sin tarjeta.')).toBeVisible()
  })

  test('totals follow a projected cycle', async ({ page }) => {
    const seguro = await openFixed(page, 'vivienda', 'Seguro')
    await seguro.getByRole('button', { name: 'Dejar de repetir' }).click()
    await expect(seguro).toBeHidden()
    await nextCycle(page, /octubre/i)
    await expect(widget(page)).toBeVisible()
    await expect(total(page, 'Crédito')).toHaveText(/40\s?€/)
    await expect(entry(page, 'Crédito').locator('[data-wallet-card-footer]')).toHaveText('1 gasto fijo')
  })

  test('a "solo este mes" amount counts in this cycle only', async ({ page }) => {
    const sheet = await openFixed(page, 'salud', 'Gimnasio')
    await sheet.getByLabel('Importe').fill('55')
    await sheet.getByText('Solo este mes').click()
    await sheet.getByRole('button', { name: 'Guardar' }).click()
    await expect(sheet).toBeHidden()
    await expect(total(page, 'Crédito')).toHaveText(/90\s?€/)
    await nextCycle(page, /octubre/i)
    await expect(total(page, 'Crédito')).toHaveText(/75\s?€/)
  })

  test('the "Tarjeta" row assigns, removes, and the choice holds in a projection', async ({ page }) => {
    let sheet = await openFixed(page, 'transporte', 'Parking')
    await expect(cardRow(sheet).locator('[data-fixed-card-current]')).toHaveText('Sin tarjeta')
    await chooseCard(sheet, 'Débito')
    await save(sheet)
    await expect(total(page, 'Débito')).toHaveText(/915\s?€/)
    sheet = await openFixed(page, 'transporte', 'Parking')
    await expect(cardRow(sheet).locator('[data-fixed-card-current]')).toHaveText('Débito')
    await sheet.getByRole('button', { name: 'Cancelar' }).click()

    sheet = await openFixed(page, 'vivienda', 'Alquiler')
    await chooseCard(sheet, 'Sin tarjeta')
    await save(sheet)
    await expect(total(page, 'Débito')).toHaveText(/95\s?€/)

    await nextCycle(page, /octubre/i)
    sheet = await openFixed(page, 'transporte', 'Parking')
    await expect(cardRow(sheet).locator('[data-fixed-card-current]')).toHaveText('Débito')
  })

  test('no "Tarjeta" row on income, nor without cards', async ({ page }) => {
    await page.locator('[aria-controls="summary-group-panel"]').filter({ hasText: /^Ingresos/ }).click()
    await page.locator('#summary-group-panel').getByRole('button', { name: /Salario/ }).click()
    await expect(dialog(page)).toBeVisible()
    await expect(cardRow(dialog(page))).toHaveCount(0)
    await dialog(page).getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog(page)).toBeHidden()
    await page.keyboard.press('Escape')

    for (const name of ['Crédito', 'Débito']) {
      const sheet = await openCard(page, name)
      await sheet.getByRole('button', { name: 'Eliminar tarjeta' }).click()
      await sheet.getByRole('button', { name: 'Eliminar', exact: true }).click()
      await expect(sheet).toBeHidden()
    }
    await expect(widget(page).locator('[data-wallet-empty]')).toHaveText('Anota con qué tarjeta se paga cada fijo')
    await expect(widget(page).getByRole('button', { name: 'Añadir tarjeta' })).toBeVisible()
    const parking = await openFixed(page, 'transporte', 'Parking')
    await expect(cardRow(parking)).toHaveCount(0)
  })

  test('the demo resets on reload', async ({ page }) => {
    const sheet = await openCard(page, 'Crédito')
    await sheet.getByRole('button', { name: 'Eliminar tarjeta' }).click()
    await sheet.getByRole('button', { name: 'Eliminar', exact: true }).click()
    await expect(sheet).toBeHidden()
    await page.reload()
    await widget(page).scrollIntoViewIfNeeded()
    expect(await names(page)).toEqual(['Débito', 'Crédito'])
    await expect(total(page, 'Crédito')).toHaveText(/75\s?€/)
  })

  test('every card colour reads at 4.5:1 or more in both themes', async ({ page }) => {
    test.setTimeout(90_000)
    const sheet = await addCard(page)
    const face = sheet.locator('[data-card-preview] .wallet-card')
    const swatches = sheet.getByRole('radiogroup').getByRole('radio')
    expect(await swatches.count()).toBe(20)
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme)
      for (let i = 0; i < 20; i++) {
        await swatches.nth(i).click()
        // The lightest point under the text: the gradient's start with the sheen's 8% white over it.
        const background = await face.evaluate((el) => {
          const probe = document.createElement('span')
          probe.style.background = 'var(--card-from)'
          el.appendChild(probe)
          const color = getComputedStyle(probe).backgroundColor
          probe.remove()
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = 1
          const ctx = canvas.getContext('2d')
          ctx.fillStyle = color
          ctx.fillRect(0, 0, 1, 1)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
          ctx.fillRect(0, 0, 1, 1)
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
          return `rgb(${r}, ${g}, ${b})`
        })
        const ink = await face.locator('[data-wallet-card-name]').evaluate((el) => getComputedStyle(el).color)
        expect(contrast(ink, background), `${theme} swatch ${i}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  test('no axe violation on the widget and the sheet in either theme', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.evaluate(readFileSync('node_modules/axe-core/axe.min.js', 'utf8'))
    const run = (selector) =>
      page.evaluate(async (selector) => {
        // @ts-expect-error axe is attached by the evaluated source above
        const result = await window.axe.run(document.querySelector(selector), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })
        return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
      }, selector)
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme)
      await page.waitForTimeout(300)
      // Colours transition with the theme; axe measures them once settled.
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)))
      expect(await run('[data-wallet-widget]'), `${theme} widget`).toEqual([])
    }
    await openCard(page, 'Crédito')
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme)
      await page.waitForTimeout(300)
      // Colours transition with the theme; axe measures them once settled.
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)))
      expect(await run('div[role="dialog"][data-open]'), `${theme} sheet`).toEqual([])
    }
  })
})

test.describe('with a finger', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
  test.skip(({ browserName }) => browserName === 'firefox', 'Firefox has no touch emulation')

  /**
   * Slides a finger from the card's band by (dx, dy) without lifting it. Chromium gets real touches
   * through CDP, so `touch-action` and scrolling are the browser's own; WebKit has no CDP, so it
   * gets touch pointer events one frame apart (Motion's pan reads them per frame).
   */
  async function press(page, browserName, locator) {
    const box = await locator.boundingBox()
    const start = { x: box.x + box.width / 2, y: box.y + 20 }
    if (browserName === 'chromium') {
      const cdp = await page.context().newCDPSession(page)
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
      await touch('touchStart', start.x, start.y)
      return {
        async move(dx, dy) {
          for (let i = 1; i <= 8; i++) {
            await touch('touchMove', start.x + (dx * i) / 8, start.y + (dy * i) / 8)
            await page.waitForTimeout(16)
          }
        },
        release: () => touch('touchEnd'),
      }
    }
    const fire = (type, x, y) =>
      locator.locator('> div').first().evaluate(
        (el, { type, x, y }) =>
          new Promise((resolve) =>
            requestAnimationFrame(() => {
              el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1 }))
              if (type === 'pointerup') el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }))
              resolve(undefined)
            }),
          ),
        { type, x, y },
      )
    await fire('pointerdown', start.x, start.y)
    let last = start
    return {
      async move(dx, dy) {
        for (let i = 1; i <= 8; i++) {
          last = { x: start.x + (dx * i) / 8, y: start.y + (dy * i) / 8 }
          await fire('pointermove', last.x, last.y)
        }
      },
      release: () => fire('pointerup', last.x, last.y),
    }
  }

  const face = (page, name) => entry(page, name).locator('> div').first()

  test.beforeEach(async ({ page }) => {
    await page.goto('/demo')
    await widget(page).scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
  })

  test('a sideways slide tilts the card towards it, and it springs back without opening', async ({ page, browserName }) => {
    // Layout offsets, which a transform (the tilt, the press's scale) does not move.
    const offsets = () => entry(page, 'Débito').evaluate((el) => [el.offsetLeft, el.offsetTop])
    const before = await offsets()
    const finger = await press(page, browserName, entry(page, 'Débito'))
    await finger.move(80, 0)
    await expect.poll(async () => (await rotation(face(page, 'Débito'))).y).toBeGreaterThan(1)
    expect((await rotation(face(page, 'Débito'))).y).toBeLessThanOrEqual(8)
    expect(await offsets()).toEqual(before)
    await finger.release()
    await expect.poll(async () => Math.abs((await rotation(face(page, 'Débito'))).y)).toBeLessThan(0.5)
    await page.waitForTimeout(300)
    await expect(dialog(page)).toHaveCount(0)
  })

  test('a vertical slide leaves the page to scroll and does not tilt', async ({ page, browserName }) => {
    await expect(face(page, 'Débito')).toHaveCSS('touch-action', 'pan-y')
    if (browserName === 'chromium') {
      // A real touch scroll gesture starting on the card, which honours `touch-action`.
      const box = await entry(page, 'Débito').boundingBox()
      const scrolled = await page.evaluate(() => window.scrollY)
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Input.synthesizeScrollGesture', { x: box.x + box.width / 2, y: box.y + 20, yDistance: 120, gestureSourceType: 'touch', speed: 400 })
      // The widget sits at the page's end, so the finger slides down and the page scrolls up.
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(scrolled)
      expect(Math.abs((await rotation(face(page, 'Débito'))).y)).toBeLessThan(0.5)
      return
    }
    // WebKit's synthetic events cannot scroll: they check the tilt alone.
    const finger = await press(page, browserName, entry(page, 'Débito'))
    await finger.move(0, -120)
    await page.waitForTimeout(300)
    expect(Math.abs((await rotation(face(page, 'Débito'))).y)).toBeLessThan(0.5)
    await finger.release()
  })

  test('a tap still opens the sheet', async ({ page }) => {
    await entry(page, 'Débito').tap({ position: { x: 40, y: 20 } })
    await expect(dialog(page)).toBeVisible()
  })

  test('reduced motion: a slide changes nothing', async ({ page, browserName }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await widget(page).scrollIntoViewIfNeeded()
    const finger = await press(page, browserName, entry(page, 'Débito'))
    await finger.move(80, 0)
    await page.waitForTimeout(300)
    expect((await rotation(face(page, 'Débito'))).none).toBe(true)
    await finger.release()
  })
})

test.describe('with a mouse', () => {
  test('hovering tilts and lifts a card at most 8 degrees, and leaving returns it', async ({ page }) => {
    await loadDesktop(page, { reduced: false })
    await widget(page).scrollIntoViewIfNeeded()
    const card = entry(page, 'Débito')
    await card.hover({ position: { x: 40, y: 20 } })
    await page.waitForTimeout(400)
    const tilted = await rotation(card)
    expect(tilted.none).toBe(false)
    for (const angle of [tilted.x, Math.abs(tilted.y)]) {
      expect(angle).toBeGreaterThan(0)
      expect(angle).toBeLessThanOrEqual(8)
    }
    await page.mouse.move(5, 5)
    await page.waitForTimeout(400)
    expect((await rotation(card)).none).toBe(true)
  })

  test('reduced motion: hovering changes nothing', async ({ page }) => {
    await loadDesktop(page, { reduced: true })
    await widget(page).scrollIntoViewIfNeeded()
    await entry(page, 'Débito').hover({ position: { x: 40, y: 20 } })
    await page.waitForTimeout(300)
    expect((await rotation(entry(page, 'Débito'))).none).toBe(true)
  })

  test('the wallet sits among the widgets and opens a side panel', async ({ page }) => {
    await loadDesktop(page)
    await expect(page.locator('[data-widget-list] [data-widget="wallet"]')).toHaveCount(1)
    const sheet = await openCard(page, 'Débito')
    await expect(sheet).toHaveAttribute('data-presentation', 'side')
    await sheet.getByLabel('Nombre').fill('Cuenta sueldo')
    await save(sheet)
    expect(await names(page)).toEqual(['Cuenta sueldo', 'Crédito'])
  })
})
