import { test, expect, type Page } from '@playwright/test'
import { gotoAndWaitForMap, waitForCountryTilesRendered } from './helpers'

/**
 * A8 — map-click semantics while a compare pair is active (#FRA,DEU):
 *   1. clicking a third country replaces B (never tears down the pair)
 *   2. clicking A is a no-op
 *   3. clicking ocean is a no-op (must NOT close the compare panel)
 *   4. Escape keeps the staged exit: compare → single → closed
 *   5. border-chip clicks inside the panel are column-scoped (C1)
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

test.describe('ocean click during compare-picking mode (regression)', () => {
  // Picking mode is entered from a single-country panel (compareWith is still
  // null — see App.tsx's enterComparePicking), so it is a distinct state from
  // the active-pair scenarios above. An ocean click here used to run
  // deselect() (compareWith is null, so the A8 guard doesn't apply) without
  // clearing comparePickingMode, wedging every later selection into a no-op
  // until Escape or a game start — touch users had no recovery at all.
  test('ocean click exits picking mode AND the next country click selects normally', async ({
    page,
  }) => {
    await gotoAndWaitForMap(page, '/#FRA')
    const panel = page.getByTestId('country-panel')
    await expect(panel).toContainText('France', { timeout: 15_000 })
    await waitForCountryTilesRendered(page)

    // Enter picking mode via the panel's compare entry button.
    await page.getByRole('button', { name: 'Compare with another country' }).click()
    const banner = page.getByRole('status').filter({ hasText: 'Pick a country to compare with' })
    await expect(banner).toBeVisible()

    const oceanClickedId = await fireClickWhere(page, { kind: 'ocean' })
    // Precondition (CLAUDE.md): the synthetic point must NOT land on a country.
    expect(oceanClickedId).toBe('')

    // Picking mode banner is gone, the panel closed (Task 13's deselect path),
    // and the hash cleared — all synchronous with the click.
    await expect(banner).not.toBeAttached()
    await expect(panel).not.toBeAttached()
    expect(await page.evaluate(() => window.location.hash)).toBe('')

    // The regression: comparePickingMode stuck true means this next click
    // would silently no-op (onMapSelect's picking branch requires a
    // `selected` country, which is now null). Asserting it selects normally
    // is the pin for the fix.
    const clickedId = await fireClickWhere(page, { kind: 'country' })
    expect(clickedId).not.toBeNull()
    await expect(panel).toBeVisible()
  })
})

test.describe('B6 — compare framing clears the panel footprint', () => {
  // FRA+UKR spans ~40° of longitude, so the frame is width-constrained: under
  // the replaced screen-offset mechanism cameraForBounds sized zoom to the
  // FULL 1280px viewport and Ukraine's centroid projected under the 672px
  // compare panel. Asymmetric padding sizes zoom to the un-occluded strip.
  // Camera moves are invisible to Element.getAnimations — poll the map seam
  // (the reveal-animation.spec.ts pattern), never data-animation-state.
  test('both countries project into the un-occluded strip left of the panel', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,UKR')
    await expect(page.getByTestId('exit-compare')).toBeVisible({ timeout: 15_000 })

    // COMPARE_PANEL_FOOTPRINT_PX (src/lib/layoutConstants.ts): 16px inset + 656px panel.
    const PANEL_FOOTPRINT = 672
    await expect
      .poll(
        () =>
          page.evaluate((footprint) => {
            const map = window.__funworldmap_map
            if (!map || map.isMoving()) return null // camera still settling
            // latlng is [lat, lng] in bundled data; project() wants [lng, lat]
            const fra = map.project([2, 46])
            const ukr = map.project([32, 49])
            const maxX = window.innerWidth - footprint
            const inStrip = (p: { x: number; y: number }) =>
              p.x > 0 && p.x < maxX && p.y > 0 && p.y < window.innerHeight
            return inStrip(fra) && inStrip(ukr)
          }, PANEL_FOOTPRINT),
        { timeout: 10_000 },
      )
      .toBe(true)
  })
})

test.describe('C1 — border-chip clicks are column-scoped', () => {
  // Would have failed before C1: chips routed to select(), tearing the pair
  // down to a single panel. Real bundled data: ESP and DEU are France's
  // border chips; POL is one of Germany's.
  test('a chip in column A replaces A and keeps B', async ({ page }) => {
    await openComparePair(page)

    await page.getByTestId('compare-column-a').getByRole('button', { name: 'Spain' }).click()

    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#ESP,DEU')
    await expect(page.getByTestId('exit-compare')).toBeVisible()
    await expect(page.getByTestId('compare-column-a')).toContainText('Spain')
    await expect(page.getByTestId('compare-column-b')).toContainText('Germany')
  })

  test('a chip in column B replaces B and keeps A', async ({ page }) => {
    await openComparePair(page)

    await page.getByTestId('compare-column-b').getByRole('button', { name: 'Poland' }).click()

    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#FRA,POL')
    await expect(page.getByTestId('exit-compare')).toBeVisible()
    await expect(page.getByTestId('compare-column-b')).toContainText('Poland')
  })

  test("a chip naming the OTHER column's country is a no-op (no X-vs-X pair)", async ({ page }) => {
    await openComparePair(page)

    // Germany (the current B) is one of France's border chips.
    await page.getByTestId('compare-column-a').getByRole('button', { name: 'Germany' }).click()

    // A regression writes the hash synchronously inside the click handler,
    // so this immediate read is a deterministic signal (existing pattern).
    expect(await page.evaluate(() => window.location.hash)).toBe('#FRA,DEU')
    await expect(page.getByTestId('exit-compare')).toBeVisible()
  })
})
