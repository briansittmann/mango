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

/** Takes a suggestion chip. The chips drift continuously, so the click skips the stability wait. */
export async function takeChip(page, name) {
  await page.getByRole('group', { name: 'Sugerencias' }).getByRole('button', { name, exact: true }).click({ force: true })
}

/** A swipe from the right of the list surface to its left edge, at the row's height, starting left of any trailing handle. */
export async function longSwipe(page, row) {
  // The step's layer slides in on load and on a step change: measure the row once it is at rest.
  await expect
    .poll(() =>
      page
        .locator('section[data-step]:not([data-leaving])')
        .evaluate((el) => getComputedStyle(el).transform === 'none' && getComputedStyle(el).opacity === '1'),
    )
    .toBe(true)
  // A row below the fold (or under the pinned "Continuar") is brought to the middle of the viewport.
  await row.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  const box = await row.boundingBox()
  if (!box) throw new Error('row not visible')
  // A row inside a grouped surface swipes across the surface; a row that is its own surface, across itself.
  const ancestor = row.locator('xpath=ancestor::*[contains(@class,"rounded-card")][1]')
  const surface = (await ancestor.count()) > 0 ? await ancestor.boundingBox() : null
  const left = surface ? surface.x : box.x
  const right = surface ? surface.x + surface.width : box.x + box.width
  const y = box.y + box.height / 2
  await page.mouse.move(right - 56, y)
  await page.mouse.down()
  await page.mouse.move(left + 10, y, { steps: 12 })
  await page.mouse.up()
}
