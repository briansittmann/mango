// @ts-check
import { test, expect } from '@playwright/test'

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

test('a step change slides the incoming step in; the theme control does not move', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/demo/onboarding')
  const pillBefore = await page.locator('[data-theme-pill]').boundingBox()
  await startSampling(page, [
    { name: 'x', selector: 'section[data-step="2"]', prop: 'transform' },
    { name: 'opacity', selector: 'section[data-step="2"]', prop: 'opacity' },
  ])
  await page.locator('[data-primary]').click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
  await page.waitForTimeout(1600)
  const series = await samples(page)
  expect(distinct(series.x)).toBeGreaterThan(2)
  expect(Math.max(...series.x)).toBeGreaterThan(0)
  expect(series.x[series.x.length - 1]).toBe(0)
  expect(distinct(series.opacity)).toBeGreaterThan(2)
  expect(series.opacity[series.opacity.length - 1]).toBe(1)
  expect(await page.locator('[data-theme-pill]').boundingBox()).toEqual(pillBefore)
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
  // Retargeting from mid-flight: no frame jumped back to the start value.
  const values = series.figure.map((text) => Number(String(text).replace(/\./g, '')))
  expect(values.every((value) => value <= 1179)).toBe(true)
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

test('the welcome enters once without blocking "Empezar", and nothing runs endlessly', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/demo/onboarding')
  // Clickable from the first frame: the stagger is still playing.
  await page.locator('[data-primary]').click({ timeout: 300 })
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')

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
