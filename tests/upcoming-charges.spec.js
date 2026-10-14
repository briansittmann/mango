// @ts-check
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { sheet as dialog } from './widgets-helpers'
import { loadDesktop, openCategory } from './desktop-helpers'

// `upcoming-charges` after `restyle-upcoming-charges-card`, on `/demo` in Spanish: Alquiler (1),
// Internet (3) and Seguro (8, 4 de 10) are taken; Parking (15), Limpieza (20) and Gimnasio (22)
// are pending.

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
    await expect(panel(page).locator('[data-category-dot]')).toHaveCount(0)
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
    await expect(chargeRow(page, 'Seguro')).toContainText(/Vivienda · esperado 35\s?€ · 4 de 10/)
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

  test('a projected cycle has nothing taken: no fold line', async ({ page }) => {
    const title = page.locator('[data-month-picker-trigger]').last()
    const before = await title.textContent()
    await page.locator('button[aria-label="Ciclo siguiente"]').last().click()
    await expect(title).not.toHaveText(before ?? '')
    await openCard(page)
    await expect(fold(page)).toHaveCount(0)
    expect(await reachableNames(page)).toEqual(['Alquiler', 'Internet', 'Seguro', 'Parking', 'Limpieza', 'Gimnasio'])
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
  })
})
