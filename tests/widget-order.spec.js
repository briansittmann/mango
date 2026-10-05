// @ts-check
import { test, expect } from '@playwright/test'
import { loadDesktop, rect, widgetOrder } from './desktop-helpers'
import { goToWeekOne } from './widgets-helpers'

// `desktop-shell` → *Widget order is the user's* and `dashboard-data` → the widget order, on `/demo`.

const DEFAULT = ['weekly', 'calendar', 'monthly', 'distribution']
const status = (page) => page.locator('div[role="status"].sr-only')

/** Drags `id`'s grip to 40px above `targetSelector`'s top edge, measured once the grip is in view, and keeps the button down. */
async function dragGrip(page, id, targetSelector) {
  const grip = page.locator(`[data-widget-grip="${id}"]`)
  await grip.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  const from = await rect(page, `[data-widget-grip="${id}"]`)
  const toY = (await rect(page, targetSelector)).top - 40
  await page.mouse.move(from.left + 10, from.top + 10)
  await page.mouse.down()
  const steps = 20
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(from.left + 10, from.top + 10 + ((toY - from.top) * i) / steps)
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(150)
}

test('grips name their widget and position; Down moves the calendar to third, keeps focus and announces it', async ({ page }) => {
  await loadDesktop(page)
  await expect(page.locator('[data-widget-grip]')).toHaveText(['', '', '', ''])
  const labels = await page.locator('[data-widget-grip]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  expect(labels).toEqual([
    'Mover Top gastos de la semana, posición 1 de 4',
    'Mover Gasto por día, posición 2 de 4',
    'Mover Gasto mensual, posición 3 de 4',
    'Mover Distribución, posición 4 de 4',
  ])
  const grip = page.locator('[data-widget-grip="calendar"]')
  await grip.scrollIntoViewIfNeeded()
  await grip.focus()
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(400)
  expect(await widgetOrder(page)).toEqual(['weekly', 'monthly', 'calendar', 'distribution'])
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-widget-grip'))).toBe('calendar')
  await expect(grip).toHaveAttribute('aria-label', 'Mover Gasto por día, posición 3 de 4')
  await expect(status(page)).toHaveText('Gasto por día movido a la posición 3 de 4')
  // The ends do nothing.
  await page.locator('[data-widget-grip="weekly"]').focus()
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(200)
  expect(await widgetOrder(page)).toEqual(['weekly', 'monthly', 'calendar', 'distribution'])
})

test('the donut dragged by its grip above the first widget lands first; the rest keep their order', async ({ page }) => {
  // Tall enough to hold the whole widget list: a widget drag does not scroll the page, and a
  // pointer outside the window gets no `pointerup` in Firefox.
  await loadDesktop(page, { height: 1800 })
  await dragGrip(page, 'distribution', '[data-widget-list] [data-widget]')
  await expect(page.locator('[data-held]')).toHaveCount(1)
  await page.mouse.up()
  await page.waitForTimeout(600)
  expect(await widgetOrder(page)).toEqual(['distribution', 'weekly', 'calendar', 'monthly'])
  await expect(page.locator('[data-held]')).toHaveCount(0)
})

test('the order survives a cycle switch and a projection shows only the donut, first', async ({ page }) => {
  await loadDesktop(page)
  const grip = page.locator('[data-widget-grip="distribution"]')
  await grip.scrollIntoViewIfNeeded()
  await grip.focus()
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(400)
  expect(await widgetOrder(page)).toEqual(['distribution', 'weekly', 'calendar', 'monthly'])
  await page.locator('[data-desktop-top-bar]').getByRole('button', { name: 'Ciclo siguiente' }).click()
  await page.waitForTimeout(800)
  expect(await widgetOrder(page)).toEqual(['distribution'])
  await expect(page.locator('[data-widget-grip]')).toHaveCount(0)
  await page.locator('[data-desktop-top-bar]').getByRole('button', { name: 'Ciclo anterior' }).click()
  await page.waitForTimeout(800)
  expect(await widgetOrder(page)).toEqual(['distribution', 'weekly', 'calendar', 'monthly'])
})

test('a rejected save returns the donut and shows the status message', async ({ page }) => {
  await loadDesktop(page, { path: '/demo?e2e=fail-widget-order' })
  const grip = page.locator('[data-widget-grip="distribution"]')
  await grip.scrollIntoViewIfNeeded()
  await grip.focus()
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(600)
  expect(await widgetOrder(page)).toEqual(DEFAULT)
  await expect(status(page)).toHaveText('No se pudo guardar el orden de los widgets')
})

test('a weekly bar pressed and dragged 40px moves no widget and still leads to its card', async ({ page }) => {
  await loadDesktop(page)
  await goToWeekOne(page)
  const bar = page.locator('[data-weekly-bar]').first()
  await bar.scrollIntoViewIfNeeded()
  const b = await rect(page, '[data-weekly-bar]')
  const target = await bar.getAttribute('data-weekly-bar')
  await page.mouse.move(b.left + 20, b.top + 10)
  await page.mouse.down()
  await page.mouse.move(b.left + 20, b.top + 50, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(600)
  expect(await widgetOrder(page)).toEqual(DEFAULT)
  await expect(page.locator('[data-held]')).toHaveCount(0)
  // A click on the bar runs its own action: the page scrolls to the category's card.
  await bar.click()
  await page.waitForTimeout(800)
  const card = await rect(page, `#categoria-${target}`)
  expect(card.top).toBeGreaterThanOrEqual(88)
  expect(card.top).toBeLessThanOrEqual(120)
})

test('no grips below 1024px and none without the operation; the supplied order is kept', async ({ page }) => {
  await loadDesktop(page, { width: 390, height: 844 })
  await expect(page.locator('[data-widget-grip]')).toHaveCount(0)
  expect(await widgetOrder(page)).toEqual(DEFAULT)
  await loadDesktop(page, { path: '/demo?e2e=no-widget-order' })
  await expect(page.locator('[data-widget-grip]')).toHaveCount(0)
  expect(await widgetOrder(page)).toEqual(DEFAULT)
})
