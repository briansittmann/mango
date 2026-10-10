// @ts-check
import { test, expect } from '@playwright/test'
import { activeSection, composite, contrast, loadDesktop, rect, READING_LINE, SIDEBAR_WIDTH, sideSheet, TOP_BAR_HEIGHT } from './desktop-helpers'
import { tokenColor } from './widgets-helpers'

// `desktop-shell` → *Desktop shell at wide viewports*, *Static and floating shell*, *Sidebar navigation
// follows the page*; `dashboard-ui` → *Cycle header and free margin* (no phone bar on a laptop) and
// *Account avatar and menu* (the sidebar's card), on `/demo`.

const CATEGORIES = ['Vivienda', 'Salud', 'Hogar', 'Comida', 'Ocio', 'Transporte', 'Compras']

test('the shell replaces the phone chrome: sidebar with the sections, bar with the month and "Añadir gasto"', async ({ page }) => {
  await loadDesktop(page)
  await expect(page.locator('[data-desktop-sidebar]')).toBeVisible()
  const names = await page.locator('[data-shell-nav] .truncate').evaluateAll((els) => els.map((e) => e.textContent?.trim()))
  expect(names[0]).toBe('Resumen')
  expect(names.slice(1)).toEqual(CATEGORIES)
  await expect(page.locator('[data-shell-nav="categoria-comida"]')).toContainText(/310\s?€/)
  await expect(page.locator('[data-sidebar-account]')).toContainText('Ana García')
  // The figures block starts on the income and its dots move it; reduced motion is on, so it never rotates by itself.
  const figures = page.locator('[data-sidebar-figures]')
  await expect(figures).toContainText('Ingresos')
  await expect(figures).toContainText(/2\.820\s?€/)
  await page.locator('[data-figure-dot="savings"]').click()
  await expect(figures).toHaveAttribute('data-figure', 'savings')
  await expect(figures).toContainText(/146\s?€/)
  await page.locator('[data-figure-dot="freeMargin"]').click()
  await expect(figures).toContainText(/864\s?€/)
  // The bar's theme shortcut: the stored choice is light, so the sun is checked; the moon switches and stores dark.
  await expect(page.locator('[data-theme-option="light"]')).toHaveAttribute('aria-checked', 'true')
  await page.locator('[data-theme-option="dark"]').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('[data-theme-option="dark"]')).toHaveAttribute('aria-checked', 'true')
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark')
  await page.locator('[data-theme-option="light"]').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  const month = page.locator('[data-desktop-top-bar] [data-month-picker-trigger]')
  await expect(month).toBeVisible()
  await expect(month).toContainText(/septiembre/i)
  await expect(page.locator('[data-add-expense]')).toBeVisible()
  await expect(page.locator('[data-cycle-status="proyeccion"]')).toHaveCount(0)
  // The month name is shown once: the phone's bar and the title block are gone.
  expect(await page.locator('[data-month-picker-trigger]').evaluateAll((els) => els.filter((e) => e.getClientRects().length > 0).length)).toBe(1)
  await expect(page.locator('.sticky.top-0')).toBeHidden()
  await expect(page.locator('[data-dashboard-page] .font-display.text-headline-lg')).toBeHidden()
  await expect(page.locator('[aria-controls="account-menu"]:visible')).toHaveCount(1)
  // The month name opens the picker, inside the viewport.
  await month.click()
  const picker = page.locator('[data-desktop-top-bar] [role="dialog"][aria-label="Seleccionar mes"]')
  await expect(picker).toBeVisible()
  const box = await rect(page, '[data-desktop-top-bar] [role="dialog"][aria-label="Seleccionar mes"]')
  expect(box.top).toBeGreaterThanOrEqual(0)
  expect(box.bottom).toBeLessThanOrEqual(900)
  expect(box.left).toBeGreaterThanOrEqual(0)
})

test('the next control disables on the sixth projected cycle and the status pill reads "Proyección"', async ({ page }) => {
  await loadDesktop(page)
  const next = page.locator('[data-desktop-top-bar]').getByRole('button', { name: 'Ciclo siguiente' })
  for (let i = 0; i < 6; i += 1) {
    await expect(next).toBeEnabled()
    await next.click()
    await page.waitForTimeout(250)
  }
  await expect(next).toBeDisabled()
  await expect(page.locator('[data-cycle-status="proyeccion"]')).toBeVisible()
  await expect(page.locator('[data-desktop-top-bar]').getByRole('button', { name: 'Ciclo anterior' })).toBeEnabled()
})

test('nothing of the shell on a phone or a tablet', async ({ page }) => {
  for (const width of [390, 820]) {
    await loadDesktop(page, { width, height: 900 })
    await expect(page.locator('[data-desktop-sidebar]')).toHaveCount(0)
    await expect(page.locator('[data-desktop-top-bar]')).toHaveCount(0)
    await expect(page.locator('[data-add-expense]')).toHaveCount(0)
    await expect(page.locator('[data-shell-nav]')).toHaveCount(0)
    expect(await page.getByRole('link', { name: 'Resumen' }).count()).toBe(0)
    await expect(page.locator('.sticky.top-0')).toBeVisible()
    await expect(page.locator('[data-dashboard-page] .text-headline-lg')).toBeVisible()
  }
})

test('floating after a 200px scroll, static again at the top; the month name never moves', async ({ page }) => {
  await loadDesktop(page)
  const sidebar = page.locator('[data-desktop-sidebar]')
  const bar = page.locator('[data-desktop-top-bar]')
  const material = '[data-desktop-sidebar] [data-shell-material]'
  await expect(sidebar).not.toHaveAttribute('data-floating', '')
  expect(await page.locator(material).evaluate((el) => getComputedStyle(el).backdropFilter)).toBe('none')
  expect(await page.locator(material).evaluate((el) => getComputedStyle(el).opacity)).toBe('0')
  const monthBefore = await rect(page, '[data-desktop-top-bar] [data-month-picker-trigger]')
  await page.evaluate(() => window.scrollTo(0, 200))
  await page.waitForTimeout(300)
  await expect(sidebar).toHaveAttribute('data-floating', '')
  await expect(bar).toHaveAttribute('data-floating', '')
  const floating = await page.locator(material).evaluate((el) => {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return { backdrop: cs.backdropFilter, radius: cs.borderRadius, opacity: cs.opacity, left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right) }
  })
  expect(floating.backdrop).toMatch(/blur\(32px\)/)
  expect(floating.radius).toBe('24px')
  expect(floating.opacity).toBe('1')
  expect(floating).toMatchObject({ left: 16, top: 16, right: SIDEBAR_WIDTH })
  const barMaterial = await rect(page, '[data-desktop-top-bar] [data-shell-material]')
  expect(barMaterial).toMatchObject({ top: 16, left: SIDEBAR_WIDTH + 8, right: 1280 - 24, height: TOP_BAR_HEIGHT - 16 })
  expect(await page.locator('[data-desktop-top-bar] [data-shell-material]').evaluate((el) => getComputedStyle(el).borderRadius)).toBe('999px')
  expect(await rect(page, '[data-desktop-top-bar] [data-month-picker-trigger]')).toEqual(monthBefore)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
  await expect(sidebar).not.toHaveAttribute('data-floating', '')
  expect(await page.locator(material).evaluate((el) => getComputedStyle(el).backdropFilter)).toBe('none')
  expect(await page.locator('[data-desktop-sidebar] .shell-rest').evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
})

test('with motion on, the material changes over successive frames within 450 ms and reverses from where it was', async ({ page }) => {
  await loadDesktop(page, { reduced: false })
  const samples = await page.evaluate(async () => {
    const sidebar = /** @type {Element} */ (document.querySelector('[data-desktop-sidebar]'))
    const material = /** @type {Element} */ (sidebar.querySelector('[data-shell-material]'))
    const month = /** @type {Element} */ (document.querySelector('[data-desktop-top-bar] [data-month-picker-trigger]'))
    const opacity = () => Number(getComputedStyle(material).opacity)
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const until = async (test) => {
      for (let i = 0; i < 60 && !test(); i += 1) await frame()
    }
    const monthTop = month.getBoundingClientRect().top
    window.scrollTo(0, 200)
    await until(() => sidebar.hasAttribute('data-floating'))
    await frame()
    const early = opacity()
    await wait(120)
    const mid = opacity()
    // Reverse mid-way: the fade retargets from its current value rather than restarting.
    window.scrollTo(0, 0)
    await until(() => !sidebar.hasAttribute('data-floating'))
    await frame()
    const reversed = opacity()
    await wait(600)
    const settled = opacity()
    return { early, mid, reversed, settled, duration: getComputedStyle(material).transitionDuration, monthMoved: month.getBoundingClientRect().top !== monthTop }
  })
  expect(samples.early).toBeLessThan(1)
  expect(samples.mid).toBeGreaterThan(samples.early)
  expect(samples.mid).toBeLessThanOrEqual(1)
  // Retargeted from where it was: never back up at 1 before coming down.
  expect(samples.reversed).toBeLessThanOrEqual(samples.mid + 0.05)
  expect(samples.settled).toBe(0)
  expect(samples.duration).toBe('0.4s')
  expect(samples.monthMoved).toBe(false)
})

test('clicking "ocio" lands its card under the bar and marks it current; the end of the page marks the last category', async ({ page }) => {
  await loadDesktop(page)
  expect(await activeSection(page)).toBe('resumen')
  await page.locator('[data-shell-nav="categoria-ocio"]').click()
  await page.waitForTimeout(600)
  const card = await rect(page, '#categoria-ocio')
  expect(card.top).toBeGreaterThanOrEqual(TOP_BAR_HEIGHT)
  expect(card.top).toBeLessThanOrEqual(READING_LINE + 4)
  await expect(page.locator('[aria-controls="category-panel-ocio"]')).toHaveAttribute('aria-expanded', 'true')
  expect(await activeSection(page)).toBe('categoria-ocio')
  await expect(page.locator('[data-shell-nav][aria-current]')).toHaveCount(1)
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('categoria-ocio')
  // One highlight that moves: the pill sits on the current link.
  const pill = await page.locator('[data-shell-nav-pill]').evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42)
  const link = await page.locator('[data-shell-nav="categoria-ocio"]').evaluate((el) => /** @type {HTMLElement} */ (el.parentElement).offsetTop)
  expect(Math.round(pill)).toBe(link)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(400)
  expect(await activeSection(page)).toBe('categoria-compras')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
  expect(await activeSection(page)).toBe('resumen')
})

test('the list follows a rename: "comida" becomes "Mercado" in the same position', async ({ page }) => {
  await loadDesktop(page)
  await page.locator('[data-category-options="comida"]').click()
  const dialog = sideSheet(page)
  await expect(dialog).toBeVisible()
  await dialog.getByLabel(/Nombre/).fill('Mercado')
  await dialog.locator('button[type="submit"]').click()
  await expect(dialog).toBeHidden()
  const names = await page.locator('[data-shell-nav] .truncate').evaluateAll((els) => els.map((e) => e.textContent?.trim()))
  expect(names[4]).toBe('Mercado')
  expect(names).not.toContain('Comida')
})

test('the account menu opens from the sidebar card, inside a 700px-tall viewport, with the phone\'s rows', async ({ page }) => {
  await loadDesktop(page, { height: 700 })
  await page.locator('[data-sidebar-account]').click()
  const menu = page.locator('#account-menu')
  await expect(menu).toBeVisible()
  const box = await rect(page, '#account-menu')
  expect(box.top).toBeGreaterThanOrEqual(0)
  expect(box.bottom).toBeLessThanOrEqual(700)
  expect(box.left).toBeGreaterThanOrEqual(0)
  await expect(menu).toContainText('Ana García')
  await expect(menu.getByRole('radiogroup')).toHaveCount(3)
  await expect(menu.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
})

test('the floating bar keeps 4.5:1 for the month name and "Añadir gasto" over the hero tile and the page, in both themes', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await loadDesktop(page, { theme })
    await page.evaluate(() => window.scrollTo(0, 200))
    await page.waitForTimeout(300)
    const monthColor = await page.locator('[data-desktop-top-bar] [data-month-picker-trigger] span').first().evaluate((el) => getComputedStyle(el).color)
    const addColor = await page.locator('[data-add-expense]').evaluate((el) => getComputedStyle(el).color)
    const addBackground = await page.locator('[data-add-expense]').evaluate((el) => getComputedStyle(el).backgroundColor)
    // The material's weaker gradient stop (globals.css → .shell-material), over the hero's two stops and the page.
    const material = theme === 'light' ? 'rgba(255, 255, 255, 0.74)' : 'rgba(19, 24, 20, 0.8)'
    const backgrounds = [await tokenColor(page, '--background'), await tokenColor(page, '--hero-start'), await tokenColor(page, '--hero-end')]
    for (const background of backgrounds) {
      expect(contrast(monthColor, composite(material, background)), `${theme} month over ${background}`).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(addColor, addBackground), `${theme} add button`).toBeGreaterThanOrEqual(4.5)
  }
})
