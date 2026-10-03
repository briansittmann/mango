// @ts-check
import { test, expect } from '@playwright/test'
import { BAR_HEIGHT, addExpense, goToWeekOne, reveal, sheet, weeklyBars, weeklyCaption } from './widgets-helpers'

test.use({ viewport: { width: 390, height: 844 } })

// `spend-insights` → *Weekly top categories widget* and *Widgets recompute from the shown rows*,
// on `/demo`. The demo's "today" is clamped to the last day of its September 2026 cycle once that
// month has passed, so the current week is the cycle's last one (29–30 September) and holds no
// spent row; the stable figures live in week 1.

test.beforeEach(async ({ page }) => {
  await page.goto('/demo')
  await reveal(page, '[data-weekly-top]')
})

test('opens on the week that contains today, with the title, the week name and the total', async ({ page }) => {
  const widget = page.locator('[data-weekly-top]')
  await expect(widget.getByRole('heading', { name: 'Top gastos de la semana' })).toBeVisible()
  const caption = await weeklyCaption(page)
  expect(caption).toMatch(/\d{1,2}.*sept/)
  await expect(page.getByRole('button', { name: 'Semana siguiente' })).toBeDisabled()
  // Nothing after today can be reached with the keyboard either.
  await page.getByRole('button', { name: 'Semana siguiente' }).focus({ timeout: 1000 }).catch(() => {})
  await page.keyboard.press('Enter')
  expect(await weeklyCaption(page)).toBe(caption)
  // The week's name and total are announced.
  await expect(widget.getByRole('status')).toContainText(/Semana \d/)
  await expect(widget.getByRole('status')).toContainText('Total de la semana')
})

test('walking back to week 1 ranks vivienda 865 € first and comida 310 € second', async ({ page }) => {
  await goToWeekOne(page)
  expect(await weeklyCaption(page)).toMatch(/^1–7 sep/)
  const labels = await weeklyBars(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')))
  expect(labels[0]).toMatch(/^Vivienda · 865\s€$/)
  expect(labels[1]).toMatch(/^Comida · 310\s€$/)
  // Descending from there, every bar is a category with its amount at the tip.
  const amounts = labels.map((label) => Number(label?.match(/· ([\d.,]+)\s€/)?.[1].replace('.', '').replace(',', '.')))
  expect(amounts).toEqual([...amounts].sort((a, b) => b - a))
  await expect(page.getByRole('button', { name: 'Semana anterior' })).toBeDisabled()
  const next = page.getByRole('button', { name: 'Semana siguiente' })
  await expect(next).toBeEnabled()
  await next.click()
  expect(await weeklyCaption(page)).toMatch(/^8–14 sep/)
})

test('the longest bar spans the plot and the others are proportional, at most 24px thick, in the category colour', async ({ page }) => {
  await goToWeekOne(page)
  const bars = await weeklyBars(page).evaluateAll((nodes) =>
    nodes.map((node) => {
      const bar = /** @type {HTMLElement} */ (node.querySelector('.chart-bar'))
      const rect = bar.getBoundingClientRect()
      return {
        width: rect.width,
        height: rect.height,
        background: getComputedStyle(bar).backgroundColor,
        amount: Number(node.getAttribute('aria-label')?.match(/· ([\d.,]+)\s€/)?.[1].replace('.', '').replace(',', '.')),
      }
    }),
  )
  expect(bars[0].width).toBeGreaterThan(100)
  for (const bar of bars) {
    expect(bar.height).toBeLessThanOrEqual(24)
    expect(Math.abs(bar.width / bars[0].width - bar.amount / bars[0].amount)).toBeLessThan(0.03)
  }
  const dot = await page.locator('[data-weekly-bar="comida"] [data-category-dot]').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bars[1].background).toBe(dot)
})

test('seven spending categories fold into "Otras (2)", which is not a control', async ({ page }) => {
  // Week 1 holds five categories; two more rows dated inside it make seven.
  await addExpense(page, 'hogar', { amount: '5', description: 'Bombillas', date: '2026-09-02' })
  await addExpense(page, 'salud', { amount: '4', description: 'Tiritas', date: '2026-09-02' })
  await reveal(page, '[data-weekly-top]')
  await goToWeekOne(page)
  const bars = weeklyBars(page)
  await expect(bars).toHaveCount(6)
  const last = bars.last()
  await expect(last).toHaveAttribute('data-weekly-bar', 'others')
  await expect(last).toContainText('Otras (2)')
  await expect(last).toContainText(/9\s€/)
  expect(await last.evaluate((el) => el.tagName)).not.toBe('BUTTON')
  const fill = await last.locator('.chart-bar').evaluate((el) => getComputedStyle(el).backgroundColor)
  const muted = await page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.backgroundColor = 'var(--chart-muted)'
    document.body.appendChild(probe)
    const value = getComputedStyle(probe).backgroundColor
    probe.remove()
    return value
  })
  expect(fill).toBe(muted)
})

test('an empty week shows the empty state, the week name and 0 €, and the controls still work', async ({ page }) => {
  // The demo's current week (29–30 September) holds nothing once September 2026 has passed.
  test.skip(new Date().toISOString().slice(0, 10) <= '2026-09-30', 'the demo cycle is still in progress')
  await expect(page.locator('[data-weekly-empty]')).toHaveText('Nada gastado esta semana')
  await expect(weeklyBars(page)).toHaveCount(0)
  expect(await weeklyCaption(page)).toMatch(/29–30 sep.*0\s€/)
  await page.getByRole('button', { name: 'Semana anterior' }).click()
  expect(await weeklyCaption(page)).toMatch(/^22–28 sep/)
})

test('activating the comida bar scrolls its card below the top bar', async ({ page }) => {
  await goToWeekOne(page)
  await page.locator('[data-weekly-bar="comida"]').click()
  await page.waitForTimeout(1500)
  const top = await page.locator('[aria-controls="category-panel-comida"]').evaluate((el) => el.getBoundingClientRect().top)
  expect(top).toBeGreaterThanOrEqual(BAR_HEIGHT)
  expect(top).toBeLessThan(400)
})

test('hovering and focusing a bar shows the category, amount, share and row count', async ({ page }) => {
  await goToWeekOne(page)
  const comida = page.locator('[data-weekly-bar="comida"]')
  await comida.hover()
  const tooltip = page.locator('[data-weekly-top] [role="tooltip"][data-open]')
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('Comida')
  await expect(tooltip).toContainText('310 €')
  await expect(tooltip).toContainText('23 % de la semana')
  await expect(tooltip).toContainText('3 movimientos')
  await expect(comida).toHaveAttribute('aria-describedby', /.+/)
  await page.mouse.move(2, 2)
  await expect(tooltip).toBeHidden()
  await comida.focus()
  await expect(page.locator('[data-weekly-top] [role="tooltip"][data-open]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-weekly-top] [role="tooltip"][data-open]')).toBeHidden()
})

test('a new expense dated today grows the current week in the same render', async ({ page }) => {
  await addExpense(page, 'comida', { amount: '20', description: 'Panadería' })
  await reveal(page, '[data-weekly-top]')
  await expect(page.locator('[data-weekly-bar="comida"]')).toHaveAttribute('aria-label', /Comida · [\d.,]+\s€/)
  const label = await page.locator('[data-weekly-bar="comida"]').getAttribute('aria-label')
  const caption = await weeklyCaption(page)
  const amount = Number(label?.match(/· ([\d.,]+)\s€/)?.[1].replace('.', '').replace(',', '.'))
  expect(amount).toBeGreaterThanOrEqual(20)
  expect(caption).toContain('€')
})

test('deleting Café and undoing it moves week 1 by 62,40 € and back', async ({ page }) => {
  await goToWeekOne(page)
  await expect(page.locator('[data-weekly-bar="comida"]')).toHaveAttribute('aria-label', /^Comida · 310\s€$/)
  const header = page.locator('[aria-controls="category-panel-comida"]')
  await header.scrollIntoViewIfNeeded()
  await header.click()
  await page.locator('#category-panel-comida').getByRole('button', { name: /^Café/ }).click()
  const dialog = sheet(page)
  await dialog.getByRole('button', { name: 'Eliminar gasto' }).click()
  const confirm = dialog.getByRole('button', { name: 'Eliminar', exact: true })
  if (await confirm.count()) await confirm.click()
  await expect(dialog).toBeHidden()
  await reveal(page, '[data-weekly-top]')
  await expect(page.locator('[data-weekly-bar="comida"]')).toHaveAttribute('aria-label', /^Comida · 247,60\s€$/)
  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(page.locator('[data-weekly-bar="comida"]')).toHaveAttribute('aria-label', /^Comida · 310\s€$/)
})

test('the bar takes the category\'s new colour in the same render', async ({ page }) => {
  await goToWeekOne(page)
  const bar = page.locator('[data-weekly-bar="comida"] .chart-bar')
  const before = await bar.evaluate((el) => getComputedStyle(el).backgroundColor)
  await page.locator('[data-category-options="comida"]').scrollIntoViewIfNeeded()
  await page.locator('[data-category-options="comida"]').click()
  const dialog = sheet(page)
  await dialog.getByRole('radio', { name: 'Celeste' }).or(dialog.getByRole('button', { name: 'Celeste' })).first().click()
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog).toBeHidden()
  await reveal(page, '[data-weekly-top]')
  const after = await bar.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(after).not.toBe(before)
  const dot = await page.locator('[data-weekly-bar="comida"] [data-category-dot]').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(after).toBe(dot)
})

test('a projected cycle has no weekly widget', async ({ page }) => {
  await page.locator('button[aria-label="Ciclo siguiente"]').last().click()
  await expect(page.getByText('Proyección').first()).toBeVisible()
  await expect(page.locator('[data-weekly-top]')).toHaveCount(0)
  await expect(page.locator('[data-spend-calendar]')).toHaveCount(0)
  await expect(page.locator('[data-monthly-chart]')).toHaveCount(0)
  await expect(page.locator('[data-distribution-chart]')).toHaveCount(1)
})
