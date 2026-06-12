import { test, expect } from '@playwright/test'
import { waitForRevealLineCoords, openLauncher, waitForMapLoaded } from './helpers'
import { REVEAL_LINE_SOURCE } from '../src/game/shared/revealLayers'

test.describe('reveal animation', () => {
  test('wrong country guess renders a tessellated line from guess → target', async ({ page }) => {
    // This spec covers the ANIMATED reveal path; opt out of the project-wide
    // reduced-motion baseline (mirrors animation-interrupt.spec.ts).
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await waitForMapLoaded(page)
    // Precondition: the rich-motion override actually applied — otherwise this
    // spec silently tests the one-shot reduced path and the 65-point arc
    // assertion still passes (mirrors the reduced-motion sibling's assert).
    expect(
      await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    ).toBe(false)
    await openLauncher(page)
    await page.getByTestId('launcher-card-country-pinning-play').click()
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    // Pin France as the target, then submit Germany as the guess.
    await page.evaluate(() => window.__funworldmap_game?.setRound?.('FRA'))
    await expect(page.getByTestId('game-prompt-name')).toHaveText('France', { timeout: 10_000 })
    await page.evaluate(() => window.__funworldmap_game?.submitCountryGuess?.('DEU'))

    // Wait for animation completion (full 65-point tessellated arc settled).
    const geom = await waitForRevealLineCoords(page, { minPoints: 65 })
    const coords = await geom.jsonValue()

    // 64 segments => 65 vertices. Endpoints match DEU (lng 9, lat 51) and
    // FRA (lng 2, lat 46) centroids; `toBeCloseTo(_, 0)` tolerates ±0.5°.
    expect(coords).toHaveLength(65)
    expect(coords[0][0]).toBeCloseTo(9, 0)
    expect(coords[0][1]).toBeCloseTo(51, 0)
    expect(coords[64][0]).toBeCloseTo(2, 0)
    expect(coords[64][1]).toBeCloseTo(46, 0)

    // Camera ends near the target centroid (FRA = [2, 46]). 2° tolerance
    // accommodates the easeTo duration. Wait for the camera to stop moving
    // before reading the center (easeTo is async; line data arrives before
    // the camera animation completes).
    await page.waitForFunction(() => !window.__funworldmap_map?.isMoving(), { timeout: 10_000 })
    const center = await page.evaluate(() => {
      const c = window.__funworldmap_map?.getCenter()
      return c ? { lng: c.lng, lat: c.lat } : null
    })
    expect(center).not.toBeNull()
    expect(center!.lng).toBeCloseTo(2, 0)
    expect(center!.lat).toBeCloseTo(46, 0)

    // Advance to the next round and confirm reveal artifacts cleared.
    // The round-end panel opens with a "Continue" button
    // (data-testid="game-continue"). Clicking it calls
    // advanceRoundEndPanel → advance → next round.
    await expect(page.getByTestId('game-continue')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('game-continue').click()
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            type Hook = { getSession?: () => { status: string } }
            const g = (window as unknown as { __funworldmap_game?: Hook }).__funworldmap_game
            return g?.getSession?.()?.status
          }),
        { timeout: 5_000 },
      )
      .toBe('playing')

    // The reveal line source should now have zero features. Use the public
    // querySourceFeatures API rather than reaching into MapLibre's private
    // _data field. Poll until the rendered tiles catch up with the data clear.
    await expect
      .poll(
        async () =>
          await page.evaluate(
            (sourceId) => window.__funworldmap_map?.querySourceFeatures(sourceId).length ?? -1,
            REVEAL_LINE_SOURCE,
          ),
        { timeout: 5_000 },
      )
      .toBe(0)
  })

  test('city-guessing wrong guess renders a tessellated line from point → target', async ({
    page,
  }) => {
    // This spec covers the ANIMATED reveal path; opt out of the project-wide
    // reduced-motion baseline (mirrors animation-interrupt.spec.ts).
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await waitForMapLoaded(page)
    // Precondition: the rich-motion override actually applied — otherwise this
    // spec silently tests the one-shot reduced path and the 65-point arc
    // assertion still passes (mirrors the reduced-motion sibling's assert).
    expect(
      await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    ).toBe(false)
    await openLauncher(page)
    await page.getByTestId('launcher-card-city-guessing-play').click()
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    // Submit a point guess at [0, 0] — target is whatever the mode picked.
    await page.evaluate(() => {
      window.__funworldmap_game?.submitGuess?.({ kind: 'point', lngLat: [0, 0] })
    })

    const geom = await waitForRevealLineCoords(page, { minPoints: 65 })
    const coords = await geom.jsonValue()

    expect(coords).toHaveLength(65)
    expect(coords[0][0]).toBeCloseTo(0, 5)
    expect(coords[0][1]).toBeCloseTo(0, 5)
  })
})
