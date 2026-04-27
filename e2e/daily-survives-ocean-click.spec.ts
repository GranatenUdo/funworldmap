import { test, expect, type Page } from '@playwright/test'
import { waitForAppReady } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.setTimeout(60_000)

async function waitForGameTestHook(page: Page) {
  await expect.poll(
    () => page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: Record<string, unknown> }).__funworldmap_game
      return g
        && typeof g.submitCountryGuess === 'function'
        && typeof g.completeNow === 'function'
        ? 'ready' : 'not-ready'
    }),
    { timeout: 15_000 },
  ).toBe('ready')
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
      localStorage.removeItem('funworldmap-daily-history')
      localStorage.removeItem('funworldmap-daily-resume')
      localStorage.removeItem('funworldmap-game-country-pinning-bests-v2')
      sessionStorage.clear()
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

test.describe('daily survives ocean clicks', () => {
  test('ocean click between attempts does not corrupt end-of-game flow', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedTodayPuzzle(page, today)
    await page.goto(`/#daily/${today}/country-pinning`)
    await waitForAppReady(page)
    await waitForGameTestHook(page)

    // Three country attempts with one ocean click in between.
    // Test hooks expose submitCountryGuess and the map ref — see
    // src/game/GameController.tsx:661 and src/hooks/useMapInstance.ts:98.
    await page.evaluate(async () => {
      // @ts-expect-error — test seam
      window.__funworldmap_game.submitCountryGuess('USA')
      await new Promise((r) => setTimeout(r, 600))
      // Synthetic ocean click — fires the same handler chain as a real click,
      // but with a known-water lng/lat so queryRenderedFeatures returns nothing.
      // @ts-expect-error — test seam
      const map = window.__funworldmap_map
      if (!map) throw new Error('map not exposed via test hook')
      // Atlantic — far from any country fill polygon
      map.fire('click', { point: { x: 50, y: 50 }, lngLat: { lng: -40, lat: 0 } })
      await new Promise((r) => setTimeout(r, 200))
    })

    // Assert hash is preserved (the gate works)
    expect(page.url()).toContain(`#daily/${today}/country-pinning`)

    // Continue: two more attempts then completeNow
    await page.evaluate(async () => {
      // @ts-expect-error — test seam
      window.__funworldmap_game.submitCountryGuess('CAN')
      await new Promise((r) => setTimeout(r, 600))
      // @ts-expect-error — test seam
      window.__funworldmap_game.submitCountryGuess('CHN')
      await new Promise((r) => setTimeout(r, 600))
      // @ts-expect-error — test seam
      window.__funworldmap_game.completeNow()
      await new Promise((r) => setTimeout(r, 400))
    })

    // Game-over reached — verify daily UI, not free UI:
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('daily-share-block')).toBeVisible()
    await expect(page.getByTestId('game-over-pb')).toHaveCount(0)
    await expect(page.getByTestId('game-over-play-again')).toHaveCount(0)

    // Verify storage:
    const ls = await page.evaluate(() => ({
      history: JSON.parse(localStorage.getItem('funworldmap-daily-history') ?? 'null'),
      resume: localStorage.getItem('funworldmap-daily-resume'),
      pb: JSON.parse(localStorage.getItem('funworldmap-game-country-pinning-bests-v2') ?? 'null'),
    }))
    expect(ls.history).not.toBeNull()
    expect(ls.history.days[today]?.['country-pinning']).toBeDefined()
    expect(ls.resume).toBeNull()
    expect(ls.pb).toBeNull()
  })
})
