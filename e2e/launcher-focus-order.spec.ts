import { test, expect } from '@playwright/test'
import { toLocalDateString } from '../src/game/daily/dates'
import { waitForAppReady, stubDailyIndex } from './helpers'

test.setTimeout(60_000)

function todayString(): string {
  return toLocalDateString(new Date())
}

// Minimal valid daily index payload for use in the slow-load test.
function validIndex(date: string) {
  return {
    generatedAt: `${date}T00:00:00.000Z`,
    window: { start: date, end: date },
    days: { [date]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } } },
  }
}

test.describe('Launcher — initial focus order', () => {
  test('initial focus lands on country-pinning daily CTA after content loads', async ({ page }) => {
    const today = todayString()
    // Stub daily index before goto so it resolves immediately on load
    await stubDailyIndex(page, today)
    // Clear lastMode and history so we get a clean, first-time-visitor state
    await page.addInitScript(() => {
      localStorage.removeItem('funworldmap-game-last-mode')
      localStorage.removeItem('funworldmap-daily-history')
    })
    await page.goto('/')
    await waitForAppReady(page)

    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    // Daily CTA must be visible (puzzlesStatus === 'ready', state === 'unplayed')
    await expect(page.getByTestId('launcher-card-country-pinning-daily-cta')).toBeVisible({
      timeout: 10_000,
    })
    // Focus must have landed on the daily CTA, not on the free-link
    await expect(page.getByTestId('launcher-card-country-pinning-daily-cta')).toBeFocused()
  })

  test('tab forward from initial focus follows visual order', async ({ page }) => {
    const today = todayString()
    await stubDailyIndex(page, today)
    await page.addInitScript(() => {
      localStorage.removeItem('funworldmap-game-last-mode')
      localStorage.removeItem('funworldmap-daily-history')
    })
    await page.goto('/')
    await waitForAppReady(page)

    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    // Confirm starting focus position before any keyboard navigation
    await expect(page.getByTestId('launcher-card-country-pinning-daily-cta')).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByTestId('launcher-card-country-pinning-daily-cta')).toBeFocused()

    // Each Tab step is asserted individually — never count Tabs without checking
    // Note: per-card free-links are removed in PR1 Task 3.3.
    // PR1 also added a shared launcher-unlimited-link below the cards.
    // DOM order: launcher-close (absolute top) → CTA1 → CTA2 → unlimited-link.
    // Initial focus is on CTA1; Tab walks: CTA2 → unlimited-link → close → (trap cycles to CTA1).
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-card-city-guessing-daily-cta')).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-unlimited-link')).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-close')).toBeFocused()

    // Focus trap must cycle back to the first focusable element
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-card-country-pinning-daily-cta')).toBeFocused()
  })

  test('does not steal focus when puzzlesStatus transitions to ready while user has tabbed elsewhere', async ({
    page,
  }) => {
    const today = todayString()

    // Stub index to delay 2 s before resolving — ensures the app mounts in
    // 'loading' state while the user manually moves focus, then the daily CTA
    // appears after the delay.
    await page.route('**/daily/index.json', async (route) => {
      await new Promise<void>((r) => setTimeout(r, 2000))
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(validIndex(today)),
      })
    })
    await page.addInitScript(() => {
      localStorage.removeItem('funworldmap-game-last-mode')
      localStorage.removeItem('funworldmap-daily-history')
    })
    await page.goto('/')
    await waitForAppReady(page)

    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })

    // Move focus to the launcher-close button explicitly — simulating a
    // user who has tabbed to a different element before content settled.
    await page.getByTestId('launcher-close').focus()
    await expect(page.getByTestId('launcher-close')).toBeFocused()

    // Wait for the daily CTA to appear (puzzlesStatus transitions to 'ready')
    await expect(page.getByTestId('launcher-card-country-pinning-daily-cta')).toBeVisible({
      timeout: 10_000,
    })

    // A11y guard: focus must NOT have been stolen to the daily CTA
    await expect(page.getByTestId('launcher-close')).toBeFocused()
  })
})
