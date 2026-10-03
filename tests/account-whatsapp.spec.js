// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

// `dashboard-ui` → *Account avatar and menu*, the WhatsApp section (`add-whatsapp-linking` D9),
// on `/demo`. The demo mounts the dashboard without profile operations, so "Cuenta" is disabled
// there (*Cuenta on the demo*) and the sheet itself cannot open: this spec covers what `/demo`
// exposes — the account menu's row and the formatted phone — and the section is verified against
// the real project (tasks 10.6 of the change).

test('the account menu shows the formatted phone and the disabled "Cuenta" row', async ({ page }) => {
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Abrir menú de cuenta' }).click()
  const menu = page.getByRole('dialog', { name: 'Menú de cuenta' })
  await expect(menu).toContainText('+34 611 22 23 33')
  const cuenta = menu.getByRole('button', { name: 'Cuenta' })
  await expect(cuenta).toBeDisabled()
})
