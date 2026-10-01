// @ts-check
import { expect } from '@playwright/test'

/** The page's text without what is hidden from assistive technology (the rolling counters). */
export function body(page) {
  return page.evaluate(() => {
    const copy = document.body.cloneNode(true)
    copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove())
    return copy.textContent.replace(/\s+/g, ' ')
  })
}

export function primary(page) {
  return page.locator('[data-primary]')
}

export function progress(page) {
  return page.getByRole('progressbar')
}

export function step(page, n) {
  return page.locator(`section[data-step="${n}"]:not([data-leaving])`)
}

/** Fills the basics so "Continuar" is enabled: a name, with the country left to the timezone. */
export async function fillBasics(page, name = 'Ana') {
  await page.getByLabel('Nombre', { exact: true }).fill(name)
}

export async function expectStep(page, n) {
  await expect(progress(page)).toHaveAttribute('aria-valuenow', String(n))
  await expect(step(page, n)).toBeVisible()
}

/** A swipe from the right edge of the list surface to its left edge, at the row's height. */
export async function longSwipe(page, row) {
  const box = await row.boundingBox()
  if (!box) throw new Error('row not visible')
  const surface = await row.locator('xpath=ancestor::*[contains(@class,"rounded-card")][1]').boundingBox()
  const left = surface ? surface.x : box.x
  const right = surface ? surface.x + surface.width : box.x + box.width
  const y = box.y + box.height / 2
  await page.mouse.move(right - 10, y)
  await page.mouse.down()
  await page.mouse.move(left + 10, y, { steps: 12 })
  await page.mouse.up()
}
