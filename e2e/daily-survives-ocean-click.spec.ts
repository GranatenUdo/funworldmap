import { test, expect, type Page } from '@playwright/test'
import { waitForAppReady, waitForGameTestHook } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.setTimeout(60_000)

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
    await page.evaluate(async () => {
      // @ts-expect-error — test seam
      window.__funworldmap_game.submitCountryGuess('USA')
      await new Promise((r) => setTimeout(r, 600))
      // Synthetic ocean click — fires the same handler chain as a real click,
      // but with a known-water lng/lat so queryRenderedFeatures returns nothing.
      // @ts-expect-error — test seam
      const map = window.__funworldmap_map
      if (!map) throw new Error('map not exposed via test hook')
      // Synthetic click at canvas (50, 50). The lngLat is decorative — clickMap
      // does its own queryRenderedFeatures using only the point. Verify (50, 50)
      // is over no country fill so the test exercises the gate, not a country
      // hit. If this assertion ever fires, recompute a safe canvas coord (see
      // e2e/map-and-countries.spec.ts:46-60 for a dynamic-coord pattern).
      const featuresAtPoint = map.queryRenderedFeatures([50, 50], { layers: ['country-fill'] })
      if (featuresAtPoint.length > 0) {
        throw new Error(`Test precondition broken: canvas (50, 50) hits a country (${featuresAtPoint[0]?.properties?.name ?? 'unknown'}); pick a different ocean coord.`)
      }
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
    })

    // completeNow() transitions to round-ended; finalize() advances to game-over.
    await page.evaluate(() => (window as unknown as { __funworldmap_game: { finalize(): void } }).__funworldmap_game.finalize())
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
