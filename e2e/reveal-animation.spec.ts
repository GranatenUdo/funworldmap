import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

test.describe('reveal animation', () => {
  test('wrong country guess renders a tessellated line from guess → target', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)
    await page.getByTestId('launcher-card-country-pinning-free-link').click()
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    // Pin France as the target, then submit Germany as the guess.
    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { setRound: (c: string) => boolean } }).__funworldmap_game
      g?.setRound('FRA')
    })
    await expect(page.getByTestId('game-prompt-name')).toHaveText('France', { timeout: 10_000 })
    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { submitCountryGuess: (c: string) => boolean } }).__funworldmap_game
      g?.submitCountryGuess('DEU')
    })

    // Poll until the animation completes — the line source ends with all 65
    // tessellated points (64 segments). A mid-animation snapshot would have
    // fewer points and the "last" point would not yet be the target centroid.
    const geom = await page.waitForFunction(() => {
      const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
      if (!map) return null
      const src = map.getSource('game-reveal-line') as maplibregl.GeoJSONSource | undefined
      if (!src) return null
      const data = (src as unknown as { serialize: () => { data: GeoJSON.FeatureCollection } }).serialize().data
      if (!data?.features?.length) return null
      const g = data.features[0].geometry as GeoJSON.LineString
      if (!g || g.type !== 'LineString') return null
      if (g.coordinates.length < 65) return null
      return g.coordinates
    }, null, { timeout: 5_000 })

    const coords = await geom.jsonValue() as Array<[number, number]>
    // 64 segments => 65 vertices. Endpoints must be tessellated (length > 2)
    // and match DEU (lng 9, lat 51) and FRA (lng 2, lat 46) centroids.
    expect(coords.length).toBeGreaterThan(2)
    expect(coords).toHaveLength(65)
    const first = coords[0]
    const last = coords[coords.length - 1]
    expect(first[0]).toBeCloseTo(9, 0)
    expect(first[1]).toBeCloseTo(51, 0)
    expect(last[0]).toBeCloseTo(2, 0)
    expect(last[1]).toBeCloseTo(46, 0)
  })

  test('city-guessing wrong guess renders a tessellated line from point → target', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)
    await page.getByTestId('launcher-card-city-guessing-free-link').click()
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    // Submit a point guess at [0, 0] — target is whatever the mode picked.
    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { submitGuess: (i: { kind: string; lngLat: [number, number] }) => void } }).__funworldmap_game
      g?.submitGuess({ kind: 'point', lngLat: [0, 0] })
    })

    const geom = await page.waitForFunction(() => {
      const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
      if (!map) return null
      const src = map.getSource('game-reveal-line') as maplibregl.GeoJSONSource | undefined
      if (!src) return null
      const data = (src as unknown as { serialize: () => { data: GeoJSON.FeatureCollection } }).serialize().data
      if (!data?.features?.length) return null
      const g = data.features[0].geometry as GeoJSON.LineString
      if (!g || g.type !== 'LineString') return null
      if (g.coordinates.length < 65) return null
      return g.coordinates
    }, null, { timeout: 5_000 })

    const coords = await geom.jsonValue() as Array<[number, number]>
    expect(coords.length).toBeGreaterThan(2)
    expect(coords).toHaveLength(65)
    // First endpoint is [0, 0] exactly (our guess).
    expect(coords[0][0]).toBeCloseTo(0, 5)
    expect(coords[0][1]).toBeCloseTo(0, 5)
  })
})
