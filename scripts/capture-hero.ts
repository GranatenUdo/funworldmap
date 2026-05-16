/**
 * One-off hero screenshot capture for the README.
 *
 * Run with the dev server already serving on localhost:5173:
 *   npm run dev &
 *   npx tsx scripts/capture-hero.ts
 *
 * Output: docs/assets/hero.png (1200×675).
 */
import { chromium } from '@playwright/test'

const url = process.env.HERO_URL || 'http://localhost:5173'

async function main(): Promise<void> {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1200, height: 675 } })
  const page = await context.newPage()
  await page.goto(url, { waitUntil: 'load' })
  await page.waitForSelector('[data-app-ready="true"]', { timeout: 30_000 })
  // Settle the launcher card's entrance animation. This is a one-off capture
  // script, not a test — the waitForTimeout pattern that's forbidden in e2e
  // specs is acceptable here because flake doesn't matter for asset generation.
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'docs/assets/hero.png', fullPage: false })
  await browser.close()
  // eslint-disable-next-line no-console
  console.log('Wrote docs/assets/hero.png')
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exit(1)
})
