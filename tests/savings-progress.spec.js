// @ts-check
import { test, expect } from '@playwright/test';
import { getSavingsProgress } from '../lib/data/savings';
import { buildDemoData } from '../lib/demo/demo-data';

test.describe('getSavingsProgress', () => {
  test('no movements', () => {
    const result = getSavingsProgress({ target: 300, movements: [] });

    expect(result.net).toBe(0);
    expect(result.netRatio).toBe(0);
    expect(result.depositedRatio).toBe(0);
    expect(result.reached).toBe(false);
  });

  test('with withdrawals', () => {
    const result = getSavingsProgress({
      target: 300,
      movements: [{ amount: 176 }, { amount: -80 }, { amount: 50 }],
    });

    expect(result.deposited).toBe(226);
    expect(result.withdrawn).toBe(80);
    expect(result.net).toBe(146);
    expect(result.netRatio).toBeCloseTo(0.4867, 4);
    expect(result.depositedRatio).toBeCloseTo(0.7533, 4);
    expect(result.reached).toBe(false);
  });

  test('target exceeded', () => {
    const result = getSavingsProgress({
      target: 300,
      movements: [{ amount: 312 }],
    });

    expect(result.net).toBe(312);
    expect(result.reached).toBe(true);
    expect(result.netRatio).toBe(1);
    expect(result.depositedRatio).toBe(1);
  });

  test('negative net', () => {
    const result = getSavingsProgress({
      target: 300,
      movements: [{ amount: 50 }, { amount: -100 }],
    });

    expect(result.net).toBe(-50);
    expect(result.netRatio).toBe(0);
    expect(result.reached).toBe(false);
  });
});

test.describe('buildDemoData savings', () => {
  test('sparkline agrees with the accumulated balance', () => {
    const data = buildDemoData('es');

    expect(data.savings.history.length).toBeGreaterThanOrEqual(6);
    expect(data.savings.history.at(-1)?.accumulated).toBe(data.savings.accumulated);
  });
});

test.describe('/demo savings card', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo');
  });

  test('bar, hatch and caption render under the savings total', async ({ page }) => {
    const savingsTile = page.locator('[aria-controls="summary-group-panel"]').nth(2);
    const track = savingsTile.locator('[role="progressbar"]');

    await expect(track).toHaveCSS('height', '6px');

    const fill = track.locator('> div').first();
    const hatch = track.locator('> div').nth(1);
    // The fill springs from 0 to its value on first reveal (design-system's motion rule); wait for
    // that transition to settle before measuring it, rather than racing the intersection observer.
    await expect(async () => {
      const width = await fill.evaluate((el) => getComputedStyle(el).width);
      expect(width).not.toBe('0px');
    }).toPass({ timeout: 5000 });
    await page.waitForTimeout(750);

    const trackBox = await track.boundingBox();
    const fillBox = await fill.boundingBox();
    const hatchBox = await hatch.boundingBox();
    if (!trackBox || !fillBox || !hatchBox) throw new Error('missing bounding box');

    const fillPct = (fillBox.width / trackBox.width) * 100;
    const hatchEndPct = ((hatchBox.x - trackBox.x + hatchBox.width) / trackBox.width) * 100;
    expect(fillPct).toBeGreaterThanOrEqual(48);
    expect(fillPct).toBeLessThanOrEqual(49);
    expect(hatchEndPct).toBeGreaterThanOrEqual(75);
    expect(hatchEndPct).toBeLessThanOrEqual(76);

    const caption = savingsTile.locator('p.text-muted-foreground');
    await expect(caption).toHaveText('146 de 300');

    const valueText = await track.getAttribute('aria-valuetext');
    expect(valueText).toContain('146');
    expect(valueText).toContain('300');
    expect(valueText).toContain('€');

    const fillStyle = await fill.evaluate((el) => el.getAttribute('style'));
    expect(fillStyle).toContain('var(--brand)');
    expect(fillStyle).not.toContain('var(--warning)');
    expect(fillStyle).not.toContain('var(--destructive)');
  });

  test('withdrawal uses the typographic minus sign in the regular colour', async ({ page }) => {
    await page.getByRole('button', { name: /Ahorro/ }).click();
    const panel = page.locator('#summary-group-panel');
    const withdrawalAmount = panel.getByText('−80 €');

    await expect(withdrawalAmount).toBeVisible();
    const text = await withdrawalAmount.textContent();
    expect(text).toContain('−');
    expect(text).not.toContain('-');

    const [color, destructive] = await withdrawalAmount.evaluate((el) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--destructive)';
      document.body.appendChild(probe);
      const destructiveColor = getComputedStyle(probe).color;
      probe.remove();
      return [getComputedStyle(el).color, destructiveColor];
    });
    expect(color).not.toBe(destructive);
  });
});

test.describe('/demo savings card — reduced motion', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo');
  });

  test('the bar fill is at its final width with no transition to wait for', async ({ page }) => {
    const savingsTile = page.locator('[aria-controls="summary-group-panel"]').nth(2);
    const track = savingsTile.locator('[role="progressbar"]');
    const fill = track.locator('> div').first();

    // No CSS transition to settle, unlike the non-reduced case — but hydration still has to run
    // once before React applies the width at all, so poll for that rather than racing it.
    await expect(async () => {
      const width = await fill.evaluate((el) => getComputedStyle(el).width);
      expect(width).not.toBe('0px');
    }).toPass({ timeout: 5000 });

    const trackBox = await track.boundingBox();
    const fillBox = await fill.boundingBox();
    if (!trackBox || !fillBox) throw new Error('missing bounding box');
    const fillPct = (fillBox.width / trackBox.width) * 100;
    expect(fillPct).toBeGreaterThanOrEqual(48);
    expect(fillPct).toBeLessThanOrEqual(49);
  });

  test('movement rows are at full opacity and in place as soon as the panel opens', async ({ page }) => {
    await page.getByRole('button', { name: /Ahorro/ }).click();
    const panel = page.locator('#summary-group-panel');
    const rows = panel.locator('[data-savings-movement-row]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const { opacity, transform } = await row.evaluate((el) => {
        const style = getComputedStyle(el);
        return { opacity: style.opacity, transform: style.transform };
      });
      expect(opacity).toBe('1');
      expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
    }
  });
});
