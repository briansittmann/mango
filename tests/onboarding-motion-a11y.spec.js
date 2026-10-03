// @ts-check
import { test, expect } from '@playwright/test'
import { fillBasics } from './onboarding-helpers.js'

test.use({ viewport: { width: 390, height: 844 } })

// `onboarding` → *Motion of the onboarding*, on `/demo/onboarding`. The browser samples each
// frame itself (see `recurring-motion-a11y.spec.js` on why a test-side loop is unreliable).

/** Records `transform`'s x translation, `opacity`, or an element's text on every frame for `ms`. */
async function startSampling(page, targets, ms = 1500) {
  await page.evaluate(
    ({ targets, ms }) => {
      const series = {}
      for (const target of targets) series[target.name] = []
      window.__onboardingSamples = series
      const deadline = performance.now() + ms
      const tick = () => {
        for (const target of targets) {
          const el = document.querySelector(target.selector)
          if (!el) continue
          if (target.prop === 'text') series[target.name].push(el.textContent)
          else if (target.prop === 'opacity') series[target.name].push(Number(getComputedStyle(el).opacity))
          else {
            const transform = getComputedStyle(el).transform
            series[target.name].push(transform === 'none' ? 0 : Number(transform.split(',')[4]))
          }
        }
        if (performance.now() < deadline) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    },
    { targets, ms },
  )
}

function samples(page) {
  return page.evaluate(() => window.__onboardingSamples)
}

function distinct(values) {
  return new Set(values.map((value) => (typeof value === 'number' ? Math.round(value * 100) / 100 : value))).size
}

// Step 3 and not step 2: step 2's layer only fades, its title and fields carry the direction.
test('a step change slides the incoming step in; the theme control does not move', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/demo/onboarding?paso=2')
  await fillBasics(page)
  const pillBefore = await page.locator('[data-theme-pill]').boundingBox()
  await startSampling(page, [
    { name: 'x', selector: 'section[data-step="3"]', prop: 'transform' },
    { name: 'opacity', selector: 'section[data-step="3"]', prop: 'opacity' },
  ])
  await page.locator('[data-primary]').click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
  await page.waitForTimeout(1600)
  const series = await samples(page)
  expect(distinct(series.x)).toBeGreaterThan(2)
  expect(Math.max(...series.x)).toBeGreaterThan(0)
  expect(series.x[series.x.length - 1]).toBe(0)
  expect(distinct(series.opacity)).toBeGreaterThan(2)
  expect(series.opacity[series.opacity.length - 1]).toBe(1)
  expect(await page.locator('[data-theme-pill]').boundingBox()).toEqual(pillBefore)
})

/** Per frame: the title's and the fields' x `translate`, and the primary slot's opacity, with a timestamp. */
async function sampleBasicsEntrance(page, ms = 1200) {
  await page.evaluate((ms) => {
    const series = []
    window.__basicsEntrance = series
    const start = performance.now()
    const x = (el) => (el ? parseFloat(getComputedStyle(el).translate.split(' ')[0]) || 0 : null)
    const tick = () => {
      const step = document.querySelector('section[data-step="2"]:not([data-leaving])')
      const slot = document.querySelector('[data-primary]')?.parentElement
      series.push({
        t: performance.now() - start,
        title: x(step?.querySelector('h1')),
        fields: x(step?.querySelector('.onboarding-enter-right')),
        button: slot ? Number(getComputedStyle(slot).opacity) : null,
      })
      if (performance.now() - start < ms) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, ms)
}

test('step 2 enters with the title from the left, the fields from the right, then "Continuar"', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/demo/onboarding')
  await sampleBasicsEntrance(page, 1800)
  await page.locator('[data-primary]').click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
  await page.waitForTimeout(1900)
  const series = (await page.evaluate(() => window.__basicsEntrance)).filter((s) => s.title != null)
  expect(Math.min(...series.map((s) => s.title))).toBeLessThan(-10)
  expect(Math.max(...series.map((s) => s.fields))).toBeGreaterThan(10)
  const last = series[series.length - 1]
  expect(last.title).toBe(0)
  expect(last.fields).toBe(0)
  // The last sample can land a frame before the button's animation ends on a slow run.
  expect(last.button).toBeGreaterThan(0.99)
  // The button is still hidden while the fields travel, and only rises once they are in place.
  const travelling = series.filter((s) => s.fields > 1)
  expect(travelling.length).toBeGreaterThan(0)
  expect(travelling.every((s) => s.button < 0.05)).toBe(true)
  const landed = series.find((s) => s.fields === 0 && s.t > 100)
  const rising = series.find((s) => s.button > 0.05)
  expect(rising && landed && rising.t >= landed.t - 20).toBe(true)
  // The layer itself only fades on step 2: the direction is the title's and the fields'.
  const layer = await page.locator('section[data-step="2"]').evaluate((el) => getComputedStyle(el).transform)
  expect(layer).toBe('none')
})

test('under reduced motion step 2 and its button are in place from the first frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/demo/onboarding')
  await sampleBasicsEntrance(page, 400)
  await page.locator('[data-primary]').click()
  await expect(page.locator('section[data-step="2"]')).toBeAttached()
  await page.waitForTimeout(500)
  const series = (await page.evaluate(() => window.__basicsEntrance)).filter((s) => s.title != null)
  expect(series.length).toBeGreaterThan(0)
  expect(series.every((s) => s.title === 0 && s.fields === 0 && s.button === 1)).toBe(true)
})

test('under reduced motion a step change cross-fades with no horizontal movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/demo/onboarding')
  await startSampling(page, [{ name: 'x', selector: 'section[data-step="2"]', prop: 'transform' }])
  await page.locator('[data-primary]').click()
  await expect(page.locator('section[data-step="2"]')).toBeAttached()
  const transform = await page.locator('section[data-step="2"]').evaluate((el) => getComputedStyle(el).transform)
  expect(transform).toBe('none')
  await page.waitForTimeout(400)
  const series = await samples(page)
  expect(series.x.every((value) => value === 0)).toBe(true)
  await expect(page.locator('section[data-step="2"]')).toHaveCSS('opacity', '1')
})

test('the free margin rolls over successive frames and retargets from where it is', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/demo/onboarding?paso=5&e2eSeed=1')
  const comida = page.getByLabel('Presupuesto de Comida')
  // The first paint is the count-up; the live figure takes over on the first change.
  await comida.fill('1')
  await expect(page.locator('[data-live-figure]')).toBeAttached()
  await startSampling(page, [{ name: 'figure', selector: '[data-live-figure]', prop: 'text' }])
  await comida.fill('300')
  await page.waitForTimeout(100)
  await comida.fill('900')
  await page.waitForTimeout(1500)
  const series = await samples(page)
  expect(distinct(series.figure)).toBeGreaterThan(3)
  expect(series.figure[series.figure.length - 1]).toBe('280')
  // Retargeting from mid-flight: no frame jumped above where the number started (1 180).
  const values = series.figure.map((text) => Number(String(text).replace(/\./g, '')))
  expect(values.every((value) => value <= 1180)).toBe(true)
})

test('under reduced motion the free margin reads its target in the first frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/demo/onboarding?paso=5&e2eSeed=1')
  const comida = page.getByLabel('Presupuesto de Comida')
  await comida.fill('1')
  await expect(page.locator('[data-live-figure]')).toBeAttached()
  await comida.fill('300')
  const text = await page.locator('[data-live-figure]').evaluate((el) => el.textContent)
  expect(text).toBe('880')
})

/** Per frame: each bubble's y translation and opacity, with a timestamp (the closing step's preview). */
async function sampleBubbles(page, ms = 1500) {
  await page.evaluate((ms) => {
    const series = []
    window.__bubbles = series
    const start = performance.now()
    const read = (el) => {
      if (!el) return null
      const transform = getComputedStyle(el).transform
      // `matrix(a, b, c, d, tx, ty)`: the sixth value, with its closing parenthesis.
      return { y: transform === 'none' ? 0 : parseFloat(transform.split(',')[5]) || 0, opacity: Number(getComputedStyle(el).opacity) }
    }
    const tick = () => {
      series.push({
        t: performance.now() - start,
        person: read(document.querySelector('[data-bubble="person"]')),
        mango: read(document.querySelector('[data-bubble="mango"]')),
      })
      if (performance.now() - start < ms) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, ms)
}

test('the chat preview enters bubble by bubble, Mango\'s after the person\'s, and nothing runs endlessly', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/demo/onboarding?paso=6')
  await sampleBubbles(page, 2200)
  await page.locator('[data-primary]').click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '7')
  await page.waitForTimeout(2300)
  const series = (await page.evaluate(() => window.__bubbles)).filter((s) => s.person && s.mango)
  expect(series.length).toBeGreaterThan(5)
  // Both travel from below and fade in over frames, then settle.
  expect(Math.max(...series.map((s) => s.person.y))).toBeGreaterThan(2)
  expect(Math.max(...series.map((s) => s.mango.y))).toBeGreaterThan(2)
  expect(distinct(series.map((s) => s.person.opacity))).toBeGreaterThan(2)
  const last = series[series.length - 1]
  expect(last.person.y).toBe(0)
  expect(last.mango.y).toBe(0)
  expect(last.person.opacity).toBe(1)
  expect(last.mango.opacity).toBe(1)
  // The person's bubble is in place before Mango's starts moving.
  const personLanded = series.find((s) => s.person.y === 0 && s.person.opacity === 1)
  const mangoStarted = series.find((s) => s.mango.opacity > 0.05)
  expect(personLanded && mangoStarted && mangoStarted.t >= personLanded.t - 20).toBe(true)
  // Both settled within a second of the step showing (the first sample with the bubbles mounted).
  const shown = series[0].t
  expect(series.find((s) => s.t > shown + 1000 && (s.mango.y !== 0 || s.mango.opacity < 1))).toBeUndefined()

  await page.waitForTimeout(2000)
  const endless = await page.evaluate(() =>
    document.getAnimations().filter((animation) => {
      const effect = /** @type {KeyframeEffect} */ (animation.effect)
      return effect?.getTiming().iterations === Infinity && animation.playState === 'running'
    }).length,
  )
  expect(endless).toBe(0)
})

test('under reduced motion both bubbles are in place in the first frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/demo/onboarding?paso=6')
  await sampleBubbles(page, 400)
  await page.locator('[data-primary]').click()
  await expect(page.locator('[data-bubble="mango"]')).toBeAttached()
  await page.waitForTimeout(500)
  const series = (await page.evaluate(() => window.__bubbles)).filter((s) => s.person && s.mango)
  expect(series.length).toBeGreaterThan(0)
  expect(series.every((s) => s.person.y === 0 && s.mango.y === 0 && s.person.opacity === 1 && s.mango.opacity === 1)).toBe(true)
})

test('the welcome enters once without blocking "Empezar", and nothing runs endlessly', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/demo/onboarding')
  // Clickable while the stagger plays: Playwright's own click waits for the element to stop
  // moving, so the press is dispatched from inside the page as soon as React has hydrated
  // (the template's layout effect stores the theme choice), while the entrance is still running.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('theme'))).toBe('system')
  const stillEntering = await page.evaluate(() => {
    const button = /** @type {HTMLButtonElement | null} */ (document.querySelector('[data-primary]'))
    const animations = button?.parentElement?.getAnimations({ subtree: true }) ?? []
    const running = animations.some((a) => a.playState === 'running')
    button?.click()
    return running
  })
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
  test.info().annotations.push({ type: 'entrance-still-running-at-click', description: String(stillEntering) })

  await page.goto('/demo/onboarding?paso=5&e2eSeed=1')
  await page.waitForTimeout(2000)
  const endless = await page.evaluate(() =>
    document.getAnimations().filter((animation) => {
      const effect = /** @type {KeyframeEffect} */ (animation.effect)
      return effect?.getTiming().iterations === Infinity && animation.playState === 'running'
    }).length,
  )
  expect(endless).toBe(0)
})
