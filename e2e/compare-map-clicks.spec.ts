import { test, expect, type Page } from '@playwright/test'
import { gotoAndWaitForMap, waitForCountryTilesRendered } from './helpers'

/**
 * A8 — map-click semantics while a compare pair is active (#FRA,DEU):
 *   1. clicking a third country replaces B (never tears down the pair)
 *   2. clicking A is a no-op
 *   3. clicking ocean is a no-op (must NOT close the compare panel)
 *   4. Escape keeps the staged exit: compare → single → closed
 *
 * Clicks are synthetic `map.fire('click', …)` — camera-agnostic (CLAUDE.md).
 * Every fired point carries a queryRenderedFeatures precondition so the test
 * fails loudly if the point stops landing where the case requires.
 */

const FRA_ID = '250' // ccn3 of A
const DEU_ID = '276' // ccn3 of B

async function openComparePair(page: Page): Promise<void> {
  await gotoAndWaitForMap(page, '/#FRA,DEU')
  await expect(page.getByTestId('exit-compare')).toBeVisible({ timeout: 15_000 })
  await waitForCountryTilesRendered(page)
}

/**
 * Grid-scan the canvas for a point matching `want` on the country-fill layer
 * ('ocean' = zero rendered features; 'country' = a feature whose id passes
 * the idIs / idNot constraints), fire a synthetic click there, and return the
 * clicked feature id ('' for ocean; null when no point qualified — callers
 * assert non-null as the loud precondition). The country geojson is the
 * canonical 195 (canonical-195.spec.ts), so any rendered id resolves in
 * App's byNumeric.
 */
function fireClickWhere(
  page: Page,
  want: { kind: 'ocean' } | { kind: 'country'; idIs?: string; idNot?: string[] },
): Promise<string | null> {
  return page.evaluate((w) => {
    const map = window.__funworldmap_map
    if (!map) throw new Error('map test seam not exposed — is VITE_TEST_HOOKS set?')
    const canvas = map.getCanvas()
    for (let x = 20; x < canvas.clientWidth - 20; x += 40) {
      for (let y = 20; y < canvas.clientHeight - 20; y += 40) {
        const features = map.queryRenderedFeatures([x, y], { layers: ['country-fill'] })
        const id = features.length > 0 ? String(features[0].id) : null
        const matches =
          w.kind === 'ocean'
            ? id === null
            : id !== null &&
              (w.idIs === undefined || id === w.idIs) &&
              (w.idNot === undefined || !w.idNot.includes(id))
        if (matches) {
          // point MUST be an array, not a {x,y} object: MapLibre's own
          // queryRenderedFeatures narrows its geometry arg via
          // `instanceof Point || Array.isArray(e)` — a plain {x,y} literal
          // fails both checks and silently falls back to querying the WHOLE
          // viewport, so every delegated click listener (clickCountry,
          // clickMap) would see every rendered feature instead of the one
          // under the point (found via a debug repro during A8 development).
          map.fire('click', { point: [x, y], lngLat: map.unproject([x, y]) })
          return id ?? ''
        }
      }
    }
    return null
  }, want)
}

test.describe('A8 — map clicks while comparing', () => {
  test('clicking a third country replaces B and keeps the compare view', async ({ page }) => {
    await openComparePair(page)

    const clickedId = await fireClickWhere(page, { kind: 'country', idNot: [FRA_ID, DEU_ID] })
    // Precondition: the compare framing must show some third country to click.
    expect(clickedId).not.toBeNull()

    await expect.poll(() => page.evaluate(() => window.location.hash)).toMatch(/^#FRA,[A-Z]{3}$/)
    expect(await page.evaluate(() => window.location.hash)).not.toBe('#FRA,DEU')
    await expect(page.getByTestId('exit-compare')).toBeVisible()
  })

  test('clicking A leaves the pair untouched', async ({ page }) => {
    await openComparePair(page)

    const clickedId = await fireClickWhere(page, { kind: 'country', idIs: FRA_ID })
    // Precondition: flyToComparePair frames both countries, so A is on screen.
    expect(clickedId).toBe(FRA_ID)

    // A regression (select('FRA')) writes the hash synchronously inside the
    // click handler, so this immediate read is a deterministic signal.
    expect(await page.evaluate(() => window.location.hash)).toBe('#FRA,DEU')
    await expect(page.getByTestId('exit-compare')).toBeVisible()
  })

  test('clicking ocean does not tear down the comparison', async ({ page }) => {
    await openComparePair(page)

    const clickedId = await fireClickWhere(page, { kind: 'ocean' })
    // Precondition (CLAUDE.md): the synthetic point must NOT land on a country.
    expect(clickedId).toBe('')

    // A regression (deselect()) clears the hash synchronously via
    // history.replaceState, so this immediate read is deterministic.
    expect(await page.evaluate(() => window.location.hash)).toBe('#FRA,DEU')
    await expect(page.getByTestId('country-panel')).toBeVisible()
    await expect(page.getByTestId('exit-compare')).toBeVisible()
  })

  test('Escape keeps the staged exit: compare → single → closed', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,DEU')
    await expect(page.getByTestId('exit-compare')).toBeVisible({ timeout: 15_000 })

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('exit-compare')).not.toBeAttached()
    await expect(page.getByTestId('country-panel')).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#FRA')

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('country-panel')).not.toBeAttached()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('')
  })
})
