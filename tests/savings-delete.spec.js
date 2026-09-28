// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

// `savings-editing` → *A savings movement deletes like an income entry*, on `/demo` in Spanish:
// the sample holds "Ahorro mensual" (+176 €) and the free margin is 864 €.

function body(page) {
  return page.evaluate(() => {
    const copy = document.body.cloneNode(true)
    copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove())
    return copy.textContent.replace(/\s+/g, ' ')
  })
}

// A savings row is not a button, so the locator is its name: the swipe spans the panel's width at
// that height, since the name alone is too short to reach the delete threshold.
async function longSwipe(page, row) {
  const box = await row.boundingBox()
  const panelBox = await page.locator('#summary-group-panel').boundingBox()
  if (!box || !panelBox) throw new Error('row not visible')
  const y = box.y + box.height / 2
  await page.mouse.move(panelBox.x + panelBox.width - 10, y)
  await page.mouse.down()
  await page.mouse.move(panelBox.x + 10, y, { steps: 12 })
  await page.mouse.up()
}

async function openSavings(page) {
  await page.getByRole('button', { name: /^Ahorro/ }).click()
  const panel = page.locator('#summary-group-panel')
  await panel.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
  return panel
}

test('a long swipe deletes a deposit and undo brings it back', async ({ page }) => {
  await page.goto('/demo')
  const panel = await openSavings(page)
  await longSwipe(page, panel.getByText('Ahorro mensual'))

  await expect(page.getByText('Movimiento eliminado')).toBeVisible()
  await expect(panel).not.toContainText('Ahorro mensual')
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*1\.040\s?€/)

  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(panel).toContainText('Ahorro mensual')
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*864\s?€/)
})

test('a movement added and deleted leaves the figures where they were', async ({ page }) => {
  await page.goto('/demo')
  const panel = await openSavings(page)
  await panel.getByRole('button', { name: 'Añadir movimiento de ahorro' }).click()
  const sheet = page.locator('div[role="dialog"][data-open]')
  await sheet.getByLabel('Importe').fill('50')
  await sheet.getByLabel('Nombre').fill('Extra')
  await sheet.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*814\s?€/)

  await longSwipe(page, panel.getByText('Extra'))
  await expect(panel).not.toContainText('Extra')
  await expect.poll(() => body(page)).toMatch(/Margen libre\s*864\s?€/)
})
