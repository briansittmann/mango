// Renders og.html to public/og-es.jpg and public/og-en.jpg: `node assets/og/render.mjs` from the repo root.
// SwiftShader so the background shader draws in headless Chromium.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const html = fileURLToPath(new URL('og.html', import.meta.url));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const lang of ['es', 'en']) {
  await page.goto(`file://${html}?lang=${lang}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `public/og-${lang}.jpg`, type: 'jpeg', quality: 92 });
}
await browser.close();
