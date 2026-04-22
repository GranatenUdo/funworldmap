import { test, expect, type Page } from '@playwright/test'
import { waitForAppReady } from './helpers'

test.setTimeout(60_000)

async function seedIndex(page: Page, dates: string[]): Promise<void> {
  await page.addInitScript(
    ({ ds }) => {
      const days: Record<string, unknown> = {}
      for (const d of ds) days[d] = { country: { cca3: 'FRA' }, city: { id: 'paris' } }
      const index = {
        generatedAt: new Date().toISOString(),
        window: { start: ds[0], end: ds[ds.length - 1] },
        days,
      }
      ;(window as unknown as { __seededIndex?: unknown }).__seededIndex = index
    },
    { ds: dates },
  )
  await page.route('**/daily/index.json', async (route) => {
    const seeded = await page.evaluate(
      () => (window as unknown as { __seededIndex?: unknown }).__seededIndex,
    )
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(seeded) })
  })
}

test.describe('Daily deep link — no-mode launcher anchor', () => {
  test('#daily/<today> (no mode) lands on launcher with anchorDate', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10)
    await seedIndex(page, [today])
    await page.goto(`/#daily/${today}`)
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('launcher')).toContainText(`Daily · ${today}`)
  })

  test('#daily/<past-date> lands on launcher anchored to that date', async ({ page }) => {
    const today = new Date()
    const past = new Date(today)
    past.setDate(past.getDate() - 3)
    const pastStr = past.toISOString().slice(0, 10)
    const todayStr = today.toISOString().slice(0, 10)
    await seedIndex(page, [pastStr, todayStr])
    await page.goto(`/#daily/${pastStr}`)
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('launcher')).toContainText(`Daily · ${pastStr}`)
  })

  // #daily/not-a-date does not match the isDailyRoot regex (/^daily\/\d{4}-\d{2}-\d{2}$/)
  // and is not a bare root, so the launcher is NOT shown at all.
  test('#daily/<garbage> does not open launcher', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10)
    await seedIndex(page, [today])
    await page.goto('/#daily/not-a-date')
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).not.toBeAttached()
  })
})
