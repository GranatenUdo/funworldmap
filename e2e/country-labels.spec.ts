import { test, expect, type Page } from '@playwright/test'
import { ensureLauncherDismissed, gotoAndWaitForMap, waitForGameTestHook } from './helpers'

test.setTimeout(60_000)

// B1 visibility contract, asserted through the __funworldmap_map seam. The
// tile stub (routeMapTiles inside gotoAndWaitForMap) serves EMPTY glyph PBFs,
// so no label text ever rasterises here — all assertions read MapLibre's
// in-memory style, never rendered pixels (CLAUDE.md / testing.md rule).
// The rule under test lives in applyBasemapLayerVisibility (mapLayers.ts):
// country-labels is visible iff satellite && !playing.
function labelVisibility(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const map = (
      window as unknown as {
        __funworldmap_map?: {
          getLayoutProperty: (id: string, prop: string) => string | undefined
        }
      }
    ).__funworldmap_map
    return map?.getLayoutProperty('country-labels', 'visibility') ?? null
  })
}

test.describe('Country labels (B1) visibility contract', () => {
  test('satellite idle: labels visible', async ({ page }) => {
    await gotoAndWaitForMap(page)
    await ensureLauncherDismissed(page)
    // Poll: useSatelliteMode's first owner pass runs in an effect after the
    // data-map-loaded commit.
    await expect.poll(() => labelVisibility(page), { timeout: 15_000 }).toBe('visible')
  })

  test('hidden while a session is playing, restored on game exit', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#game/country-pinning/play')
    await waitForGameTestHook(page)
    await expect.poll(() => labelVisibility(page), { timeout: 15_000 }).toBe('none')
    // Exit via the seam, not UI driving (CLAUDE.md; the B1 spike found
    // UI-driven exit flaky for session-state timing unrelated to this rule).
    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { endGame?: () => void } })
        .__funworldmap_game
      g?.endGame?.()
    })
    await expect.poll(() => labelVisibility(page), { timeout: 15_000 }).toBe('visible')
  })

  test('vector mode: labels hidden; restored on toggle back to satellite', async ({ page }) => {
    await gotoAndWaitForMap(page)
    await ensureLauncherDismissed(page)
    const toggle = page.getByTestId('satellite-toggle')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(() => labelVisibility(page), { timeout: 15_000 }).toBe('none')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => labelVisibility(page), { timeout: 15_000 }).toBe('visible')
  })
})
