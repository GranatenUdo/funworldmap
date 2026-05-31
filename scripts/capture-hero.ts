/**
 * One-off hero screenshot capture for the README.
 *
 * Build and serve the app, then run this against the served URL:
 *   npm run build
 *   npm run preview -- --port 4173 --strictPort &
 *   HERO_URL=http://localhost:4173 npx tsx scripts/capture-hero.ts
 *
 * The app is map-first on cold load (the launcher does not auto-open), so the
 * script clicks the header Play button to open the launcher before capturing —
 * the hero shows the two game modes over the satellite globe.
 *
 * Output: docs/assets/hero.png (1200×675).
 */
import { chromium } from '@playwright/test'

const url = process.env.HERO_URL || 'http://localhost:4173'
const out = process.env.HERO_OUT || 'docs/assets/hero.png'

async function main(): Promise<void> {
  // ANGLE so MapLibre's WebGL2 context renders the satellite basemap.
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=default'],
  })
  try {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 675 },
    })
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'load' })
    await page.waitForSelector('[data-app-ready="true"]', { timeout: 30_000 })
    // WorldMap sets data-map-loaded OR data-map-error (mutually exclusive), so
    // waiting on loaded alone would hang the full timeout if the basemap fails
    // (e.g. software-GL fallback). Mirror the app's own useMapReady signal.
    await page.waitForSelector('[data-map-loaded], [data-map-error]', { timeout: 30_000 })
    if (await page.$('[data-map-error]')) {
      throw new Error('Map reported data-map-error — cannot capture a usable hero.')
    }
    // Let satellite imagery + terrain tiles paint. This is a one-off capture
    // script, not a test — the waitForTimeout pattern forbidden in e2e specs is
    // acceptable here because flake doesn't matter for asset generation.
    await page.waitForTimeout(5_000)

    // Map-first cold load: open the launcher so the hero shows the game modes.
    await page.getByTestId('header-play').click()
    await page.getByTestId('launcher').waitFor({ state: 'visible', timeout: 10_000 })
    await page
      .locator('[data-testid="launcher"][data-animation-state="idle"]')
      .waitFor({ timeout: 5_000 })
    await page.waitForTimeout(400)

    await page.screenshot({ path: out, fullPage: false })
    // eslint-disable-next-line no-console
    console.log(`Wrote ${out}`)
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exit(1)
})
