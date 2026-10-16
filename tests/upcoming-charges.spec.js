// @ts-check
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { sheet as dialog } from './widgets-helpers'
import { loadDesktop, openCategory } from './desktop-helpers'

// `upcoming-charges` after `restyle-upcoming-charges-card`, on `/demo` in Spanish: Alquiler (1),
// Internet (3) and Seguro (8, 4 de 10) are taken; Parking (15), Limpieza (20) and Gimnasio (22)
// are pending. Cards (`show-card-on-upcoming-charges`): "Débito" carries Alquiler and Internet,
// "Crédito" Gimnasio and Seguro.

const header = (page) => page.locator('button[aria-controls="upcoming-charges-panel"]')
const fold = (page) => page.locator('button[aria-controls="upcoming-charges-taken"]')
const panel = (page) => page.locator('#upcoming-charges-panel')
const chargeRow = (page, name) => panel(page).locator('button[aria-label]').filter({ has: page.getByText(name, { exact: true }) })

async function openCard(page) {
  await header(page).scrollIntoViewIfNeeded()
  if ((await header(page).getAttribute('aria-expanded')) !== 'true') await header(page).click()
  await expect(header(page)).toHaveAttribute('aria-expanded', 'true')
}

async function unfold(page) {
  await fold(page).click()
  await expect(fold(page)).toHaveAttribute('aria-expanded', 'true')
}

/** The charge names, in DOM order, of the rows outside an inert (folded) region. */
function reachableNames(page) {
  return panel(page)
    .locator('button[aria-label]')
    .evaluateAll((els) => els.filter((el) => !el.closest('[inert]')).map((el) => el.getAttribute('aria-label')?.split(' · ')[0]))
}

/** Right edge of the amount box (a row's last child) of every row matched by `selector`. */
function amountEdges(page, selector) {
  return page.locator(selector).evaluateAll((els) => els.map((el) => Math.round(el.lastElementChild.getBoundingClientRect().right)))
}

const thumb = (page, name) => chargeRow(page, name).locator('[data-card-thumb]')

/** Width, height and gap to its amount of every card thumbnail in the panel. */
function thumbGeometry(page) {
  return panel(page)
    .locator('[data-card-thumb]')
    .evaluateAll((els) =>
      els.map((el) => {
        const box = el.getBoundingClientRect()
        return { width: Math.round(box.width), height: Math.round(box.height), gap: Math.round(el.nextElementSibling.getBoundingClientRect().left - box.right) }
      }),
    )
}

/** A face's resolved gradient stops: the thumbnail and the wallet card read the same tokens. */
const faceColours = (locator) =>
  locator.evaluate((el) => [getComputedStyle(el).getPropertyValue('--card-from').trim(), getComputedStyle(el).getPropertyValue('--card-to').trim()])

const wallet = (page) => page.locator('[data-wallet-widget]')
const walletFace = (page, name) =>
  wallet(page)
    .locator('[data-wallet-entry]')
    .filter({ has: page.locator('[data-wallet-card-name]', { hasText: new RegExp(`^${name}$`) }) })
    .locator('.wallet-card')

async function openWalletCard(page, name) {
  await walletFace(page, name).scrollIntoViewIfNeeded()
  await walletFace(page, name).click({ position: { x: 40, y: 20 } })
  await expect(dialog(page)).toBeVisible()
  return dialog(page)
}

async function saveSheet(sheet) {
  await sheet.getByRole('button', { name: 'Guardar' }).click()
  await expect(sheet).toBeHidden()
}

async function axeViolations(page) {
  await page.evaluate(readFileSync('node_modules/axe-core/axe.min.js', 'utf8'))
  const found = []
  for (const theme of ['light', 'dark']) {
    await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme)
    await page.waitForTimeout(300)
    const violations = await page.evaluate(async () => {
      // @ts-expect-error axe is attached by the evaluated source above
      const result = await window.axe.run(document.getElementById('upcoming-charges-panel').parentElement, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })
      return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
    })
    found.push(...violations.map((v) => `${theme} ${v}`))
  }
  return found
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/demo')
  })

  test('pending first under "Pendientes", taken folded behind "3 cobrados"', async ({ page }) => {
    await openCard(page)
    await expect(panel(page).getByRole('heading', { name: 'Pendientes' })).toBeVisible()
    expect(await reachableNames(page)).toEqual(['Parking', 'Limpieza', 'Gimnasio'])
    await expect(fold(page)).toHaveText('3 cobrados')
    await expect(fold(page)).toHaveAttribute('aria-expanded', 'false')
    for (const name of ['Alquiler', 'Internet', 'Seguro']) {
      expect(await chargeRow(page, name).evaluate((el) => !!el.closest('[inert]'))).toBe(true)
    }
  })

  test('unfolding shows the taken charges by day with a check badge, and folds back', async ({ page }) => {
    await openCard(page)
    await unfold(page)
    expect(await reachableNames(page)).toEqual(['Parking', 'Limpieza', 'Gimnasio', 'Alquiler', 'Internet', 'Seguro'])
    for (const name of ['Alquiler', 'Internet', 'Seguro']) {
      await expect(chargeRow(page, name).locator('svg')).toHaveCount(1)
      await expect(chargeRow(page, name)).toHaveAttribute('aria-label', /Cobrado/)
    }
    await expect(chargeRow(page, 'Parking').locator('svg')).toHaveCount(0)
    await expect(header(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('#upcoming-charges-next')).toHaveText('Parking · día 15')

    await fold(page).click()
    await expect(fold(page)).toHaveAttribute('aria-expanded', 'false')
    expect(await reachableNames(page)).toEqual(['Parking', 'Limpieza', 'Gimnasio'])
  })

  test('one 32px mark with the day and one muted line naming the category', async ({ page }) => {
    await openCard(page)
    const mark = chargeRow(page, 'Parking').locator('> span').first()
    await expect(mark).toHaveText('15')
    const box = await mark.boundingBox()
    expect(Math.round(box?.width ?? 0)).toBe(32)
    expect(Math.round(box?.height ?? 0)).toBe(32)
    await expect(chargeRow(page, 'Parking').getByText('Transporte', { exact: true })).toBeVisible()
    await expect(chargeRow(page, 'Parking').locator('span.block span.block').last()).toHaveText('Transporte')
    await expect(thumb(page, 'Parking')).toHaveCount(0)
    await expect(panel(page).locator('[data-category-dot]')).toHaveCount(0)
  })

  test('a charge names its card on the muted line and draws its thumbnail left of the amount', async ({ page }) => {
    await openCard(page)
    await unfold(page)
    await expect(chargeRow(page, 'Gimnasio')).toContainText('Salud · Crédito')
    await expect(chargeRow(page, 'Gimnasio')).toHaveAttribute('aria-label', /Salud, Crédito, 40\s?€/)
    const gap = await thumb(page, 'Gimnasio').evaluate((el) => {
      const amount = el.nextElementSibling
      return amount?.textContent?.includes('40') ? Math.round(amount.getBoundingClientRect().left - el.getBoundingClientRect().right) : null
    })
    expect(gap).toBe(8)
    await expect(thumb(page, 'Gimnasio')).toHaveAttribute('aria-hidden', 'true')
    for (const name of ['Alquiler', 'Internet']) {
      await expect(chargeRow(page, name)).toContainText('Vivienda · Débito')
      await expect(thumb(page, name)).toHaveCount(1)
      expect(await faceColours(thumb(page, name))).toEqual(await faceColours(walletFace(page, 'Débito')))
    }
    expect(await faceColours(thumb(page, 'Gimnasio'))).toEqual(await faceColours(walletFace(page, 'Crédito')))
    for (const name of ['Parking', 'Limpieza']) {
      await expect(thumb(page, name)).toHaveCount(0)
      await expect(chargeRow(page, name)).not.toContainText(/Débito|Crédito/)
    }
  })

  test('the card follows an assignment, a rename and a deletion without a reload', async ({ page }) => {
    const transporte = await openCategory(page, 'transporte')
    await transporte.getByRole('button', { name: /Parking/ }).first().click()
    let sheet = dialog(page)
    await sheet.locator('[data-fixed-card]').getByRole('button').click()
    await sheet.getByRole('radio', { name: 'Crédito' }).click()
    await saveSheet(sheet)

    sheet = await openWalletCard(page, 'Crédito')
    await sheet.getByLabel('Nombre').fill('Visa')
    await saveSheet(sheet)

    sheet = await openWalletCard(page, 'Débito')
    await sheet.getByRole('button', { name: 'Eliminar tarjeta' }).click()
    await sheet.getByRole('button', { name: 'Eliminar', exact: true }).click()
    await expect(sheet).toBeHidden()

    await openCard(page)
    await unfold(page)
    await expect(chargeRow(page, 'Parking')).toContainText('Transporte · Visa')
    await expect(thumb(page, 'Parking')).toHaveCount(1)
    await expect(chargeRow(page, 'Gimnasio')).toContainText('Salud · Visa')
    for (const name of ['Alquiler', 'Internet']) {
      await expect(thumb(page, name)).toHaveCount(0)
      await expect(chargeRow(page, name)).not.toContainText('Débito')
    }
  })

  test('expected amount and progress share the muted line', async ({ page }) => {
    const vivienda = await openCategory(page, 'vivienda')
    await vivienda.getByRole('button', { name: /Seguro/ }).click()
    const entry = dialog(page)
    await entry.getByLabel('Importe').fill('40')
    await entry.getByText('Solo este mes').click()
    await entry.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(entry).toBeHidden()

    await openCard(page)
    await unfold(page)
    await expect(chargeRow(page, 'Seguro')).toContainText(/Vivienda · Crédito · esperado 35\s?€ · 4 de 10/)
    for (const name of ['Alquiler', 'Internet', 'Parking', 'Limpieza', 'Gimnasio']) {
      await expect(chargeRow(page, name)).not.toContainText(/de 10|esperado/)
    }
  })

  test('taken rows are not dimmed', async ({ page }) => {
    await openCard(page)
    await unfold(page)
    const look = (name) =>
      chargeRow(page, name).evaluate((el) => {
        let opacity = 1
        for (let node = el; node && !node.classList.contains('rounded-card'); node = node.parentElement) {
          if (!node.closest('[aria-expanded="false"]')) opacity *= Number(getComputedStyle(node).opacity)
        }
        return { opacity, color: getComputedStyle(el.querySelector('span.block span')).color }
      })
    // Polled: the unfold fades in over 200 ms, and the slower engines are still inside it.
    await expect.poll(async () => (await look('Alquiler')).opacity).toBe(1)
    expect((await look('Alquiler')).color).toBe((await look('Parking')).color)
  })

  test('marks and amounts form columns that end where "Movimientos" amounts end', async ({ page }) => {
    await openCard(page)
    await unfold(page)
    const marks = await panel(page)
      .locator('button[aria-label]')
      .evaluateAll((els) => els.map((el) => Math.round(el.firstElementChild.getBoundingClientRect().width)))
    expect(new Set(marks)).toEqual(new Set([32]))
    const edges = await amountEdges(page, '#upcoming-charges-panel button[aria-label]')
    expect(new Set(edges).size).toBe(1)
    const thumbs = await thumbGeometry(page)
    expect(thumbs).toHaveLength(4)
    expect(new Set(thumbs.map((t) => `${t.width}x${t.height}+${t.gap}`))).toEqual(new Set(['22x14+8']))

    const movements = page.locator('[data-movements-card] button[aria-controls="movements-panel"]')
    await movements.scrollIntoViewIfNeeded()
    await movements.click()
    const movementEdges = await amountEdges(page, '[data-movement-row]')
    expect(movementEdges[0]).toBe(edges[0])
  })

  test('the header matches a category card: height, title ink and weight, chevron', async ({ page }) => {
    const ours = await header(page).boundingBox()
    const theirs = await page.locator('button[aria-controls="category-panel-vivienda"]').boundingBox()
    expect(Math.abs((ours?.height ?? 0) - (theirs?.height ?? 0))).toBeLessThanOrEqual(1)

    const style = (selector) => page.locator(selector).evaluate((el) => ({ color: getComputedStyle(el).color, weight: getComputedStyle(el).fontWeight }))
    expect(await style('#upcoming-charges-name')).toEqual(await style('#category-name-vivienda'))

    const chevron = (id) => page.locator(`button[aria-controls="${id}"] + div svg.lucide-chevron-down`).evaluate((el) => getComputedStyle(el).color)
    expect(await chevron('upcoming-charges-panel')).toBe(await chevron('category-panel-vivienda'))
    await openCard(page)
    await openCategory(page, 'vivienda')
    expect(await chevron('upcoming-charges-panel')).toBe(await chevron('category-panel-vivienda'))
  })

  test('keyboard: disclosure, pending rows, fold line, then taken rows', async ({ page, browserName }) => {
    // WebKit on macOS skips buttons on Tab unless Option is held.
    const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab'
    await openCard(page)
    await header(page).focus()
    const focused = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label')?.split(' · ')[0] ?? document.activeElement?.textContent)
    const order = []
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press(tab)
      order.push(await focused())
    }
    expect(order).toEqual(['Parking', 'Limpieza', 'Gimnasio', '3 cobrados'])
    await page.keyboard.press('Enter')
    await expect(fold(page)).toHaveAttribute('aria-expanded', 'true')
    for (const name of ['Alquiler', 'Internet', 'Seguro']) {
      await page.keyboard.press(tab)
      expect(await focused()).toBe(name)
    }
    await page.keyboard.press('Enter')
    await expect(dialog(page).getByLabel('Descripción')).toHaveValue('Seguro')
  })

  test('reduced motion: unfolded rows are at their final height in the first frame', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openCard(page)
    const heights = await page.evaluate(async () => {
      const region = document.getElementById('upcoming-charges-taken')
      document.querySelector('button[aria-controls="upcoming-charges-taken"]').click()
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const first = region.getBoundingClientRect().height
      await new Promise((resolve) => setTimeout(resolve, 400))
      return { first, settled: region.getBoundingClientRect().height }
    })
    expect(heights.settled).toBeGreaterThan(100)
    expect(heights.first).toBe(heights.settled)
  })

  test('expanded and unfolded, the page still uses at most six text sizes', async ({ page }) => {
    await openCard(page)
    await unfold(page)
    await page.waitForTimeout(300)
    const sizes = await page.evaluate(() => {
      const set = new Set()
      for (const el of document.querySelectorAll('body *')) {
        if (!el.textContent?.trim() || el.children.length || el.closest('.sr-only')) continue
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden') continue
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        set.add(cs.fontSize)
      }
      return [...set]
    })
    expect(sizes.length).toBeLessThanOrEqual(6)
  })

  test('only day marks, card thumbnails and open chevrons carry colour', async ({ page }) => {
    await openCard(page)
    await unfold(page)
    await page.mouse.move(0, 0)
    await page.waitForTimeout(300)
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), theme)
      await page.waitForTimeout(300)
      const stray = await panel(page)
        .locator('xpath=..')
        .evaluate((card) => {
          const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
          const chromatic = (value) => {
            ctx.clearRect(0, 0, 1, 1)
            ctx.fillStyle = '#000'
            ctx.fillStyle = value
            ctx.fillRect(0, 0, 1, 1)
            const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
            return a > 0 && Math.max(r, g, b) - Math.min(r, g, b) > 24
          }
          const found = []
          for (const el of [card, ...card.querySelectorAll('*')]) {
            if (el.closest('[inert]')) continue
            const cs = getComputedStyle(el)
            const isMark = el.getAttribute('style')?.includes('--cat-')
            const isThumb = el.hasAttribute('data-card-thumb')
            const isOpenChevron = !!el.closest('svg.lucide-chevron-down') && !!el.closest('svg').classList.contains('rotate-180')
            if (cs.backgroundImage !== 'none' && !isThumb) found.push(`${el.tagName} background-image`)
            if (chromatic(cs.backgroundColor) && !isMark) found.push(`${el.tagName} background ${cs.backgroundColor}`)
            if (chromatic(cs.color) && !isOpenChevron) found.push(`${el.tagName} color ${cs.color}`)
            if (parseFloat(cs.borderTopWidth) > 0 && chromatic(cs.borderTopColor)) found.push(`${el.tagName} border ${cs.borderTopColor}`)
          }
          return found
        })
      expect(stray, theme).toEqual([])
    }
  })

  test('a rainbow card\'s thumbnails turn like its face', async ({ page }) => {
    const sheet = await openWalletCard(page, 'Crédito')
    await sheet.getByRole('radio', { name: 'Arcoíris' }).click()
    await saveSheet(sheet)
    await openCard(page)
    await unfold(page)
    for (const name of ['Gimnasio', 'Seguro']) {
      const paint = () => thumb(page, name).evaluate((el) => getComputedStyle(el).backgroundImage)
      const before = await paint()
      await page.waitForTimeout(600)
      expect(await paint()).not.toBe(before)
    }
  })

  test('reduced motion: a rainbow card\'s thumbnail stays still', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const sheet = await openWalletCard(page, 'Crédito')
    await sheet.getByRole('radio', { name: 'Arcoíris' }).click()
    await saveSheet(sheet)
    await openCard(page)
    const paint = () => thumb(page, 'Gimnasio').evaluate((el) => getComputedStyle(el).backgroundImage)
    const before = await paint()
    await page.waitForTimeout(600)
    expect(await paint()).toBe(before)
  })

  test('a projected cycle has nothing taken: no fold line', async ({ page }) => {
    const title = page.locator('[data-month-picker-trigger]').last()
    const before = await title.textContent()
    await page.locator('button[aria-label="Ciclo siguiente"]').last().click()
    await expect(title).not.toHaveText(before ?? '')
    await openCard(page)
    await expect(fold(page)).toHaveCount(0)
    expect(await reachableNames(page)).toEqual(['Alquiler', 'Internet', 'Seguro', 'Parking', 'Limpieza', 'Gimnasio'])
    await expect(chargeRow(page, 'Alquiler')).toContainText('Vivienda · Débito')
    expect(await faceColours(thumb(page, 'Alquiler'))).toEqual(await faceColours(walletFace(page, 'Débito')))
  })

  test('no axe violation in either theme, unfolded', async ({ page }) => {
    await openCard(page)
    await unfold(page)
    expect(await axeViolations(page)).toEqual([])
  })
})

test.describe('on a laptop', () => {
  test('header height and amount edge match the category cards and "Movimientos" at 1280px', async ({ page }) => {
    await loadDesktop(page)
    const ours = await header(page).boundingBox()
    const theirs = await page.locator('button[aria-controls="category-panel-vivienda"]').boundingBox()
    expect(Math.abs((ours?.height ?? 0) - (theirs?.height ?? 0))).toBeLessThanOrEqual(1)

    await openCard(page)
    await unfold(page)
    const edges = await amountEdges(page, '#upcoming-charges-panel button[aria-label]')
    expect(new Set(edges).size).toBe(1)
    const movementEdges = await amountEdges(page, '[data-movement-row]')
    expect(movementEdges[0]).toBe(edges[0])
    expect(new Set((await thumbGeometry(page)).map((t) => `${t.width}x${t.height}+${t.gap}`))).toEqual(new Set(['22x14+8']))
  })
})
