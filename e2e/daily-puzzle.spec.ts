import { test, expect, type Page } from '@playwright/test'
import { toLocalDateString } from '../src/game/daily/dates'
import { finalizeGame } from './helpers'

test.setTimeout(120_000)

const TODAY = toLocalDateString(new Date())

async function withDailyStub(page: Page): Promise<void> {
  await page.route('**/daily/index.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        window: { start: TODAY, end: TODAY },
        days: {
          [TODAY]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } },
        },
      }),
    })
  })
}

/**
 * Submit a country guess and wait for the reducer to reflect it.
 * The test seam dispatches `attempt` synchronously, but rapid back-to-back
 * page.evaluate calls race React's re-render — this helper polls until React
 * commits the resulting state change (currentAttempts.length) before continuing.
 */
async function submitAndWait(page: Page, cca3: string, expectAfter: number): Promise<void> {
  await page.evaluate((id) => {
    ;(window as unknown as { __funworldmap_game: { submitCountryGuess(s: string): boolean } })
      .__funworldmap_game.submitCountryGuess(id)
  }, cca3)
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __funworldmap_game: { getSession(): { currentAttempts: unknown[] } }
              }
            ).__funworldmap_game.getSession().currentAttempts.length,
        ),
      { timeout: 5_000 },
    )
    .toBeGreaterThanOrEqual(expectAfter)
}

test.describe('Daily puzzle — country-pinning, 3 attempts', () => {
  test('clicking Play starts the daily and three guesses finalize with best-of-3', async ({ page }) => {
    await withDailyStub(page)
    await page.goto('/')
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('launcher-card-country-pinning-daily-cta').click()

    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 10_000 })
      .toContain(`daily/${TODAY}/country-pinning`)

    await page.waitForFunction(() => Boolean((window as unknown as { __funworldmap_game?: unknown }).__funworldmap_game))
    await submitAndWait(page, 'DEU', 1)
    await submitAndWait(page, 'ESP', 2)
    await submitAndWait(page, 'FRA', 3)

    await finalizeGame(page)
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('game-over-score')).toContainText('100')
  })

  test('deep-linking to #daily/<today>/country-pinning bypasses launcher and starts', async ({ page }) => {
    await withDailyStub(page)
    await page.goto(`/#daily/${TODAY}/country-pinning`)
    await expect(page.getByTestId('launcher')).not.toBeVisible()
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 })
      .toContain(`daily/${TODAY}/country-pinning`)
  })

  test('daily history persists: playing + reloading shows played state', async ({ page }) => {
    await withDailyStub(page)
    await page.goto('/')
    await expect(page.getByTestId('launcher-card-country-pinning-daily-cta')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('launcher-card-country-pinning-daily-cta').click()
    await page.waitForFunction(() => Boolean((window as unknown as { __funworldmap_game?: unknown }).__funworldmap_game))
    await submitAndWait(page, 'FRA', 1)
    await submitAndWait(page, 'FRA', 2)
    await submitAndWait(page, 'FRA', 3)
    await finalizeGame(page)
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })
    // recordDailyResult runs inside the status-change useEffect, AFTER the
    // game-over overlay is rendered. Wait for the localStorage write to
    // complete before navigating away — otherwise the reload could beat
    // the effect, losing the persistence signal.
    await expect
      .poll(
        () =>
          page.evaluate((today) => {
            const raw = localStorage.getItem('funworldmap-daily-history')
            if (!raw) return null
            const parsed = JSON.parse(raw) as {
              days?: Record<string, Record<string, unknown>>
            }
            return parsed.days?.[today]?.['country-pinning'] ?? null
          }, TODAY),
        { timeout: 5_000 },
      )
      .not.toBeNull()
    await page.getByRole('button', { name: /back to map/i }).click()
    await page.reload()
    await expect(page.getByTestId('launcher-card-country-pinning')).toHaveAttribute('data-state', 'played')
  })

  test('daily country-pinning: panel suppressed for intermediate attempts 1 + 2', async ({ page }) => {
    await withDailyStub(page)
    await page.goto(`/#daily/${TODAY}/country-pinning`)
    await page.waitForFunction(() => Boolean((window as unknown as { __funworldmap_game?: unknown }).__funworldmap_game))
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    // Attempt 1: wrong guess. After the existing 1200ms intermediate timer fires,
    // the round advances to attempt 2 — no panel should have appeared.
    await page.evaluate(() => {
      const game = (window as unknown as {
        __funworldmap_game?: { submitCountryGuess: (cca3: string) => boolean }
      }).__funworldmap_game
      game?.submitCountryGuess('USA')
    })
    await expect(page.getByTestId('country-panel')).not.toBeAttached({ timeout: 2_000 })

    // Attempt 2: wrong guess. Same expectation — no panel between attempts.
    await page.evaluate(() => {
      const game = (window as unknown as {
        __funworldmap_game?: { submitCountryGuess: (cca3: string) => boolean }
      }).__funworldmap_game
      game?.submitCountryGuess('CHN')
    })
    await expect(page.getByTestId('country-panel')).not.toBeAttached({ timeout: 2_000 })

    // Note: attempt 3 transitions directly to `status: 'game-over'` (not
    // `round-ended`), so the new round-end panel does not open. The existing
    // GameOverOverlay handles the final state. See the spec §Daily
    // intermediate-attempt suppression for rationale.
  })
})

test.describe('Daily puzzle — launcher-anchored deep link', () => {
  test('#daily/<today> opens launcher anchored to today', async ({ page }) => {
    await withDailyStub(page)
    await page.goto(`/#daily/${TODAY}`)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
  })
})
