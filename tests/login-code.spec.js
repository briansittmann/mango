// @ts-check
import { test, expect } from '@playwright/test'

// The code step of /login (replace-magic-link-with-email-otp, D9). `/login?email=` opens it without
// sending a code, so nothing here needs a database or a mail. The tests that submit six digits make
// one real call to Supabase's verify endpoint through the server action (made-up address, no mail,
// no row; it counts against the shared 360/h verify bucket), so they run in Chromium only.

test.use({ viewport: { width: 390, height: 844 } })

const CODE_STEP = '/login?email=tu%40mail.com'
const CELL = '[data-cell]'

async function setTheme(page, theme) {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('theme', t)
    } catch {}
  }, theme)
}

function trackPosts(page) {
  const posts = []
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url())
  })
  return posts
}

const cells = (page) => page.locator(CELL).evaluateAll((els) => els.map((el) => el.textContent?.trim() ?? ''))
const activeIndex = (page) => page.locator(CELL).evaluateAll((els) => els.findIndex((el) => el.hasAttribute('data-active')))
const codeInput = (page) => page.getByLabel('Código de 6 dígitos')

async function openCodeStep(page) {
  await page.goto(CODE_STEP)
  await codeInput(page).focus()
}

/** Samples every animation frame for `ms`: per cell the transform, the ring's opacity and the
 * frame lights' opacity (same in-page approach as recurring-motion-a11y.spec.js). */
async function startSampling(page, ms) {
  await page.evaluate((ms) => {
    const samples = []
    window.__codeSamples = samples
    const deadline = performance.now() + ms
    const tick = () => {
      const ring = document.querySelector('section svg')
      samples.push({
        transforms: [...document.querySelectorAll('[data-cell]')].map((el) => getComputedStyle(el).transform),
        ring: ring ? Number(getComputedStyle(ring).opacity) : 0,
        light: Math.max(0, ...[...document.querySelectorAll('[data-frame-light]')].map((el) => Number(getComputedStyle(el).opacity))),
      })
      if (performance.now() < deadline) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, ms)
}

const samples = (page) => page.evaluate(() => window.__codeSamples)
const AT_REST = (t) => t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)'

function paste(page, text) {
  return codeInput(page).evaluate((input, text) => {
    const data = new DataTransfer()
    data.setData('text/plain', text)
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }, text)
}

test('the code step opens by URL without sending anything', async ({ page }) => {
  const requests = []
  page.on('request', (request) => requests.push(request))
  await page.goto(CODE_STEP)

  await expect(page.getByRole('heading', { name: 'Revisa tu mail' })).toBeVisible()
  await expect(page.getByText('tu@mail.com')).toBeVisible()
  expect(await cells(page)).toEqual(['', '', '', '', '', ''])
  expect(requests.filter((r) => r.method() === 'POST')).toEqual([])
  expect(requests.filter((r) => r.url().includes('supabase'))).toEqual([])
})

test('typing fills the cells in order without submitting', async ({ page }) => {
  const posts = trackPosts(page)
  await openCodeStep(page)
  expect(await activeIndex(page)).toBe(0)

  await page.keyboard.type('4x82')
  expect(await cells(page)).toEqual(['4', '8', '2', '', '', ''])
  expect(await activeIndex(page)).toBe(3)
  expect(posts).toEqual([])
})

test('Backspace empties the last filled cell', async ({ page }) => {
  await openCodeStep(page)
  await page.keyboard.type('4829')
  await page.keyboard.press('Backspace')
  expect(await cells(page)).toEqual(['4', '8', '2', '', '', ''])
  expect(await activeIndex(page)).toBe(3)
})

test('the frame light travels once around the cell and goes out', async ({ page }) => {
  await openCodeStep(page)
  await startSampling(page, 1000)
  await page.keyboard.type('4')
  await page.waitForTimeout(1100)
  const series = await samples(page)
  expect(Math.max(...series.map((s) => s.light))).toBeGreaterThan(0.5)
  expect(series.at(-1).light).toBe(0)
})

test('"Cambiar mail" goes back to the e-mail step', async ({ page }) => {
  await page.goto(CODE_STEP)
  await page.getByRole('button', { name: 'Cambiar mail' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Entrar a Mango' })).toBeVisible()
  await expect(page.getByLabel('Correo electrónico')).toHaveValue('tu@mail.com')
})

test('"Reenviar" counts down 60 s before it is enabled', async ({ page }) => {
  const posts = trackPosts(page)
  const start = new Date('2026-09-28T10:00:00')
  await page.clock.install({ time: start })
  // A second after `install`: pausing at the same instant fails in Firefox once a millisecond passed.
  await page.clock.pauseAt(new Date(start.getTime() + 1000))
  await page.goto(CODE_STEP)
  const resend = page.getByRole('button', { name: /Reenviar/ })
  await expect(resend).toHaveText('Reenviar en 60 s')
  await expect(resend).toBeDisabled()

  // One second per attempt: each tick schedules the next after React renders, so a second jumped
  // before that is simply retried; the text moves at most one second per attempt, so no expected
  // value is skipped. `fastForward` also skips the animation frames `runFor` would run one by one.
  const advanceUntil = (text) =>
    expect
      .poll(
        async () => {
          await page.clock.fastForward(1000)
          return resend.textContent()
        },
        { intervals: [0], timeout: 60_000 },
      )
      .toBe(text)
  await advanceUntil('Reenviar en 30 s')
  await expect(resend).toBeDisabled()
  await advanceUntil('Reenviar código')
  await expect(resend).toBeEnabled()
  expect(posts).toEqual([])
})

for (const theme of /** @type {const} */ (['light', 'dark'])) {
  test(`the active cell matches the amount field of the entry sheet in ${theme}`, async ({ page }) => {
    await setTheme(page, theme)

    await page.goto('/demo')
    await page.getByRole('button', { name: /^Ingresos/ }).click()
    // What is measured is the field, not the path to it: a dispatched click opens the sheet even
    // while the opening panel still slides under the sticky header (a WebKit flake in /demo).
    await page.locator('#summary-group-panel').getByRole('button', { name: 'Añadir ingreso' }).dispatchEvent('click')
    const amount = page.locator('div[role="dialog"][data-open]').getByLabel('Importe')
    await amount.focus()
    await page.waitForTimeout(400)
    const field = await amount.evaluate((input) => {
      const style = getComputedStyle(/** @type {HTMLElement} */ (input.parentElement))
      return [style.borderTopColor, style.backgroundColor, style.boxShadow, getComputedStyle(input).caretColor]
    })

    await openCodeStep(page)
    await page.waitForTimeout(400)
    const box = await page.locator(`${CELL}[data-active]`).evaluate((el) => {
      const style = getComputedStyle(el)
      return [style.borderTopColor, style.backgroundColor, style.boxShadow]
    })
    const cellCaret = await codeInput(page).evaluate((input) => getComputedStyle(input).caretColor)
    const cell = [...box, cellCaret]

    expect(cell).toEqual(field)
  })
}

test.describe('submitting a code (one real verify call each)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one real call per run is enough')

  test('paste fills the row, the cells orbit, and a rejected code comes back empty with the message', async ({ page }) => {
    const posts = trackPosts(page)
    await openCodeStep(page)
    await startSampling(page, 5000)
    await paste(page, '48 29-13')
    expect(await cells(page)).toEqual(['4', '8', '2', '9', '1', '3'])
    await expect(codeInput(page)).toBeDisabled()
    await page.keyboard.type('7')
    expect(await cells(page)).toEqual(['4', '8', '2', '9', '1', '3'])

    const message = page.locator('[data-message]')
    await expect(message).toHaveText('Ese código no es el que mandamos. Revisa el último mail o pide uno nuevo.', { timeout: 10_000 })
    expect(posts).toHaveLength(1)
    expect(await cells(page)).toEqual(['', '', '', '', '', ''])
    await expect(codeInput(page)).toBeFocused()
    expect(await page.context().cookies()).toEqual([])

    await page.waitForTimeout(300)
    const series = await samples(page)
    expect(series.some((s) => s.transforms.some((t) => !AT_REST(t)))).toBe(true)
    expect(Math.max(...series.map((s) => s.ring))).toBe(1)
    const after = await page.locator(CELL).evaluateAll((els) => els.map((el) => getComputedStyle(el).transform))
    expect(after.every(AT_REST)).toBe(true)
    expect(await page.locator('section svg').first().evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(0)

    await page.keyboard.type('5')
    await expect(message).toHaveText('')
    expect(await cells(page)).toEqual(['5', '', '', '', '', ''])
  })

  test('with reduced motion nothing leaves the row and the message still shows', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openCodeStep(page)
    await startSampling(page, 4000)
    await page.keyboard.type('123456')
    await expect(page.locator('[data-message]')).toHaveText(/Ese código no es el que mandamos/, { timeout: 10_000 })
    const series = await samples(page)
    expect(series.every((s) => s.transforms.every(AT_REST))).toBe(true)
    expect(Math.max(...series.map((s) => s.ring))).toBe(0)
    expect(Math.max(...series.map((s) => s.light))).toBe(0)
    expect(await cells(page)).toEqual(['', '', '', '', '', ''])
  })
})
