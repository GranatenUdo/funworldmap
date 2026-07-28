import { test, expect, type Page } from '@playwright/test'
import { waitForAnimationIdle, waitForMapLoaded } from './helpers'

async function getBorderOpacity(page: Page): Promise<number> {
  return page.evaluate(() => {
    const map = (
      window as unknown as {
        __funworldmap_map?: { getPaintProperty: (id: string, prop: string) => number }
      }
    ).__funworldmap_map
    if (!map) throw new Error('map not exposed')
    return map.getPaintProperty('country-borders', 'line-opacity')
  })
}

async function getFillColor(page: Page, layerId: string): Promise<string> {
  return page.evaluate((id) => {
    const map = (
      window as unknown as {
        __funworldmap_map?: { getPaintProperty: (id: string, prop: string) => string }
      }
    ).__funworldmap_map
    if (!map) throw new Error('map not exposed')
    return map.getPaintProperty(id, 'fill-color')
  }, layerId)
}

test.describe('compare view dimming interacts with satellite mode', () => {
  test('exiting compare with satellite ON restores satellite border opacity', async ({ page }) => {
    // Satellite is ON by default.
    await page.goto('/#FRA,DEU')
    await waitForMapLoaded(page)
    // Poll until dimming animation settles to the compare-view value (0.15).
    await expect.poll(() => getBorderOpacity(page), { timeout: 15_000 }).toBeCloseTo(0.15, 2)

    // Exit compare.
    await page.evaluate(() => {
      window.location.hash = '#FRA'
    })
    // Poll until dimming releases back to the satellite-default value
    // (0.9 — B2's cased light line).
    await expect.poll(() => getBorderOpacity(page), { timeout: 15_000 }).toBeCloseTo(0.9, 2)
  })
})

test.describe('compare view A/B highlight colours match panel badges', () => {
  // Badge colours defined in src/index.css .compare-badge-a / .compare-badge-b
  const CORAL = '#f43f5e'
  const TEAL_DIM = '#0d9488'

  test('in compare mode: A (selected) is coral and B (compareWith) is teal-dim', async ({
    page,
  }) => {
    // Navigate directly into compare mode: FRA = A (selected), DEU = B (compareWith).
    await page.goto('/#FRA,DEU')
    await waitForMapLoaded(page)

    // Poll until useCompareViewHighlight has applied the badge-matched paint props.
    await expect.poll(() => getFillColor(page, 'country-selected'), { timeout: 15_000 }).toBe(CORAL)

    await expect
      .poll(() => getFillColor(page, 'country-compare-fill'), { timeout: 15_000 })
      .toBe(TEAL_DIM)

    // Camera must frame BOTH countries left of the compare panel (batch-2 §3).
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const map = window.__funworldmap_map as {
            project: (lnglat: [number, number]) => { x: number; y: number }
          }
          const france = map.project([2, 46])
          const germany = map.project([9, 51])
          const unoccluded = window.innerWidth - 672 // compare panel footprint
          return [france, germany].every(
            (p) => p.x > 0 && p.x < unoccluded && p.y > 0 && p.y < window.innerHeight,
          )
        }),
      )
      .toBe(true)
  })

  test('A and B colours are distinct from each other in compare mode', async ({ page }) => {
    await page.goto('/#FRA,DEU')
    await waitForMapLoaded(page)

    // Wait for compare mode to settle (border opacity is the stable signal).
    await expect.poll(() => getBorderOpacity(page), { timeout: 15_000 }).toBeCloseTo(0.15, 2)

    const aColor = await getFillColor(page, 'country-selected')
    const bColor = await getFillColor(page, 'country-compare-fill')

    expect(aColor).not.toBe(bColor)
    expect(aColor).toBe(CORAL)
    expect(bColor).toBe(TEAL_DIM)
  })

  test.describe('exit restoration in light mode', () => {
    test.use({ colorScheme: 'light' })

    test('exiting compare mode restores selection to theme-appropriate coral', async ({ page }) => {
      // Start in compare mode.
      await page.goto('/#FRA,DEU')
      await waitForMapLoaded(page)
      // Wait for compare mode paint to settle.
      await expect.poll(() => getBorderOpacity(page), { timeout: 15_000 }).toBeCloseTo(0.15, 2)

      // Exit compare by navigating to single-country hash.
      await page.evaluate(() => {
        window.location.hash = '#FRA'
      })
      // Wait for compare mode to release (border opacity restores to 0.9).
      await expect.poll(() => getBorderOpacity(page), { timeout: 15_000 }).toBeCloseTo(0.9, 2)

      // Light mode → CORAL is the restored colour (matches the badge).
      // Verify that exiting compare restores the correct theme-appropriate fill-color.
      const selColor = await getFillColor(page, 'country-selected')
      expect(selColor).toBe(CORAL)
    })
  })
})

test.describe('compare picking mode cancel (A7)', () => {
  test('inline Cancel exits picking mode without closing the panel', async ({ page }) => {
    await page.goto('/#FRA')
    await waitForMapLoaded(page)

    const panel = page.getByTestId('country-panel')
    await expect(panel).toContainText('France', { timeout: 15_000 })
    await waitForAnimationIdle(panel)

    // Enter picking mode via the panel's compare entry button.
    await page.getByRole('button', { name: 'Compare with another country' }).click()
    const banner = page.getByRole('status').filter({ hasText: 'Pick a country to compare with' })
    await expect(banner).toBeVisible()

    // The touch-reachable exit: the banner's inline Cancel.
    await page.getByTestId('compare-picking-cancel').click()
    await expect(banner).not.toBeAttached()
    // Picking mode exited: the compare entry button re-renders (it is hidden
    // while picking) and the panel itself survived the cancel.
    await expect(page.getByRole('button', { name: 'Compare with another country' })).toBeVisible()
    await expect(panel).toContainText('France')
  })
})

test.describe('B4 spotlight: country-dim layer state via the map seam', () => {
  // ccn3 ids, matching compare-map-clicks.spec.ts.
  const FRA_ID = '250'
  const DEU_ID = '276'

  async function getDimFilterJson(page: Page): Promise<string> {
    return page.evaluate(() => {
      const map = (
        window as unknown as {
          __funworldmap_map?: { getFilter: (id: string) => unknown }
        }
      ).__funworldmap_map
      if (!map) throw new Error('map not exposed')
      return JSON.stringify(map.getFilter('country-dim'))
    })
  }

  async function getNumericPaint(page: Page, layerId: string, prop: string): Promise<number> {
    return page.evaluate(
      ([id, p]) => {
        const map = (
          window as unknown as {
            __funworldmap_map?: { getPaintProperty: (id: string, prop: string) => number }
          }
        ).__funworldmap_map
        if (!map) throw new Error('map not exposed')
        return map.getPaintProperty(id, p)
      },
      [layerId, prop] as const,
    )
  }

  test('selecting a country dims everything else and quiets the selection paint', async ({
    page,
  }) => {
    await page.goto('/#FRA')
    await waitForMapLoaded(page)

    // Filter contract: everything EXCEPT the selection is dimmed.
    await expect
      .poll(() => getDimFilterJson(page), { timeout: 15_000 })
      .toBe(JSON.stringify(['!=', ['get', 'id'], FRA_ID]))

    // Paint contract: 0.25 scrim, ≤0.10 selection fill, 4px/blur-2 glow.
    expect(await getNumericPaint(page, 'country-dim', 'fill-opacity')).toBeCloseTo(0.25, 2)
    expect(await getNumericPaint(page, 'country-selected', 'fill-opacity')).toBeCloseTo(0.1, 2)
    expect(await getNumericPaint(page, 'country-selected-glow', 'line-width')).toBe(4)
    expect(await getNumericPaint(page, 'country-selected-glow', 'line-blur')).toBe(2)
  })

  test('compare excludes both countries from the scrim; exit re-dims around A only', async ({
    page,
  }) => {
    await page.goto('/#FRA,DEU')
    await waitForMapLoaded(page)

    await expect
      .poll(() => getDimFilterJson(page), { timeout: 15_000 })
      .toBe(JSON.stringify(['all', ['!=', ['get', 'id'], FRA_ID], ['!=', ['get', 'id'], DEU_ID]]))

    // Exit compare — the scrim collapses back to selection-only.
    await page.evaluate(() => {
      window.location.hash = '#FRA'
    })
    await expect
      .poll(() => getDimFilterJson(page), { timeout: 15_000 })
      .toBe(JSON.stringify(['!=', ['get', 'id'], FRA_ID]))
  })
})
