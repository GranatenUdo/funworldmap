import { test, expect } from '@playwright/test'
import { waitForAppReady } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.setTimeout(60_000)

const TODAY = toLocalDateString(new Date())

async function stubDailyForTelemetry(page: import('@playwright/test').Page) {
  await page.route('**/daily/index.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        window: { start: TODAY, end: TODAY },
        days: { [TODAY]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } } },
      }),
    }),
  )
}

function enableAnalyticsCapture(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    ;(window as unknown as { __PLAYWRIGHT__: boolean }).__PLAYWRIGHT__ = true
  })
}

test.describe('Telemetry regression: deep_link_opened', () => {
  test('country hash (#FRA) does NOT fire deep_link_opened', async ({ page }) => {
    await enableAnalyticsCapture(page)
    await page.goto('/#FRA')
    await waitForAppReady(page)
    // Wait for the country panel to confirm the hash was processed.
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 10_000 })
    const events = await page.evaluate(() => {
      const w = window as unknown as { __testAnalytics?: Array<{ name: string }> }
      return (w.__testAnalytics ?? []).map((e) => e.name)
    })
    expect(events).not.toContain('deep_link_opened')
  })

  test('/reveal route emits exactly ONE deep_link_opened with outcome:reveal', async ({ page }) => {
    await stubDailyForTelemetry(page)
    await enableAnalyticsCapture(page)
    await page.goto(`/#daily/${TODAY}/reveal`)
    await waitForAppReady(page)
    // Wait until the reveal overlay is visible so we know bootstrap has completed.
    await expect(page.getByTestId('daily-reveal')).toBeVisible({ timeout: 10_000 })
    const events = await page.evaluate(() => {
      const w = window as unknown as {
        __testAnalytics?: Array<{ name: string; props: Record<string, unknown> }>
      }
      return (w.__testAnalytics ?? []).filter((e) => e.name === 'deep_link_opened')
    })
    expect(events).toHaveLength(1)
    expect(events[0].props.outcome).toBe('reveal')
  })
})
