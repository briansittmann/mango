// @ts-check
import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

async function gotoDemo(page, locale) {
  await page.context().addCookies([{ name: 'locale', value: locale, url: 'http://localhost:3000' }])
  await page.goto('/demo')
}

const COPY = {
  es: {
    addExpense: 'Añadir gasto',
    switchLabel: 'Se repite todos los meses',
    dayLabel: 'Día del mes',
    add: 'Añadir',
    dayError: 'Elige un día del mes',
    explanation: 'Cada día 15 anotaremos 50 € en Transporte. Puedes cambiarlo cuando quieras.',
    categoryId: 'transporte',
    categoryLine: /Transporte\s*80\s?€\s*de\s*100\s?€/,
    total: /1\.750\s?€/,
  },
  en: {
    addExpense: 'Add expense',
    switchLabel: 'Repeats every month',
    dayLabel: 'Day of the month',
    add: 'Add',
    dayError: 'Choose a day of the month',
    explanation: "On day 15 of every month we'll record €50 in Transport. You can change it anytime.",
    categoryId: 'transporte',
    categoryLine: /Transport€?80\s*of\s*€?100/,
    total: /Expenses€1,750/,
  },
}

for (const locale of /** @type {const} */ (['es', 'en'])) {
  const copy = COPY[locale]

  test(`recurring create flow (${locale})`, async ({ page }) => {
    await gotoDemo(page, locale)
    await page.locator(`button[aria-controls="category-panel-${copy.categoryId}"]`).click()
    await page.locator(`#category-panel-${copy.categoryId}`).getByRole('button', { name: copy.addExpense }).click()

    // The "Próximos cobros" definition sheet (task 10.1) is always mounted, just closed, so
    // scope every recurrence-field lookup to the entry sheet actually open right now — both
    // sheets share the "Día del mes" label.
    const sheet = page.locator('div[role="dialog"][data-open]')
    const sw = sheet.getByRole('switch', { name: copy.switchLabel })
    await expect(sw).toHaveAttribute('aria-checked', 'false')
    const dayInputReachable = await sheet.evaluate((el) => {
      const day = el.querySelector('[id$="-recurrence-day"]')
      if (!day) return 'missing'
      day.focus()
      return document.activeElement === day
    })
    expect(dayInputReachable).toBe(false)

    await sw.click()
    const dayInput = sheet.getByLabel(copy.dayLabel)
    await expect(dayInput).toBeVisible()

    await sheet.locator('input[inputmode="decimal"]').first().fill('50')
    await dayInput.fill('')
    await dayInput.fill('15')
    await expect(sheet.getByText(copy.explanation)).toBeVisible()

    const addBtn = sheet.getByRole('button', { name: copy.add, exact: true })
    await dayInput.fill('')
    await expect(addBtn).toBeDisabled()
    await dayInput.blur()
    await expect(sheet.getByText(copy.dayError)).toBeVisible()

    await dayInput.fill('15')
    await sheet.locator('input[type="text"]').first().fill('Peaje')
    await expect(addBtn).toBeEnabled()
    await addBtn.click()

    // Totals are rolling counters (`AnimatedAmount`): on screen every column carries all ten
    // digits, and the figure itself is the counter's `aria-hidden` twin. Reading the accessible
    // text is reading what the counter is showing.
    const body = () =>
      page.evaluate(() => {
        const copy = document.body.cloneNode(true)
        copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove())
        return copy.textContent.replace(/\s+/g, ' ')
      })
    await expect.poll(body).toMatch(copy.categoryLine)
    await expect.poll(body).toMatch(copy.total)
    await expect.poll(body).toMatch(/(Margen libre|Free margin)\s*€?794/)

    await page.locator('button[aria-controls="upcoming-charges-panel"]').click()
    await expect(page.locator('#upcoming-charges-panel').getByText('Peaje')).toBeVisible()
  })
}
