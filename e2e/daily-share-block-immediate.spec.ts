import { test, expect, type Page } from '@playwright/test'
import { toLocalDateString } from '../src/game/daily/dates'
import { waitForGameTestHook } from './helpers'

test.setTimeout(60_000)

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

async function seedTodayPuzzle(page: Page, date: string): Promise<void> {
  await page.addInitScript(
    ({ d }) => {
      const index = {
        generatedAt: new Date().toISOString(),
        window: { start: d, end: d },
        days: { [d]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } } },
      }
      ;(window as unknown as { __seededIndex?: unknown }).__seededIndex = index
      // Wipe any leftover daily history from a previous run.
      localStorage.removeItem('funworldmap-daily-history')
      localStorage.removeItem('funworldmap-daily-resume')
    },
    { d: date },
  )
  await page.route('**/daily/index.json', async (route) => {
    const seeded = await page.evaluate(
      () => (window as unknown as { __seededIndex?: unknown }).__seededIndex,
    )
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(seeded) })
  })
}

test.describe('daily share block on game-over', () => {
  test('first daily completion of the day shows the share block immediately', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedTodayPuzzle(page, today)
    await page.goto(`/#daily/${today}/country-pinning`)
    await waitForMap(page)
    await waitForGameTestHook(page)

    // First attempt: correct (FRA). Then completeNow ends the best-of-3 early.
    await page.evaluate(() => {
      // @ts-expect-error — test seam
      window.__funworldmap_game.submitCountryGuess('FRA')
      // @ts-expect-error — test seam
      window.__funworldmap_game.completeNow()
    })

    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('daily-share-block')).toBeVisible({ timeout: 5_000 })
    const preview = page.getByTestId('daily-share-preview')
    const text = (await preview.textContent()) ?? ''
    expect(text).toContain('100/100')
  })

  test('second mode of the day reflects in the share text immediately', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedTodayPuzzle(page, today)
    // Pre-seed country-pinning played; play city-guessing next.
    await page.addInitScript((d: string) => {
      const history = {
        version: 1,
        streak: { current: 1, longest: 1, lastActiveDate: d, lastMilestoneShown: 0 },
        days: {
          [d]: {
            'country-pinning': { score: 100, attempts: [], completedAt: 1 },
          },
        },
      }
      localStorage.setItem('funworldmap-daily-history', JSON.stringify(history))
    }, today)

    await page.goto(`/#daily/${today}/city-guessing`)
    await waitForMap(page)
    await waitForGameTestHook(page)

    // Pin Paris (lng=2.3522, lat=48.8566) as the first attempt, then completeNow.
    await page.evaluate(() => {
      // @ts-expect-error — test seam
      window.__funworldmap_game.submitGuess({ kind: 'point', lngLat: [2.3522, 48.8566] })
      // @ts-expect-error — test seam
      window.__funworldmap_game.completeNow()
    })

    await expect(page.getByTestId('daily-share-block')).toBeVisible({ timeout: 5_000 })
    const preview = page.getByTestId('daily-share-preview')
    const text = (await preview.textContent()) ?? ''
    expect(text).not.toContain('not played')
    expect(text).toMatch(/100\/100/)
  })
})
