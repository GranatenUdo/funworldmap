import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)
test.use({ colorScheme: 'dark', reducedMotion: 'reduce' })

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

test.describe('reveal animation — reduced motion', () => {
  test('full tessellated line is present immediately on wrong guess', async ({ page }) => {
    // Force reduced motion via the CDP-backed emulation API. Setting it via
    // test.use({ reducedMotion: 'reduce' }) does not propagate reliably under
    // the chromium-gpu project (custom --use-gl=angle launch args), so we
    // emulate explicitly and verify with matchMedia before proceeding.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await waitForMap(page)
    const reducedMotionMatches = await page.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    )
    expect(reducedMotionMatches).toBe(true)
    await page.getByTestId('launcher-card-country-pinning-free-link').click()
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { setRound: (c: string) => boolean } }).__funworldmap_game
      g?.setRound('FRA')
    })
    await expect(page.getByTestId('game-prompt-name')).toHaveText('France', { timeout: 10_000 })
    await page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: { submitCountryGuess: (c: string) => boolean } }).__funworldmap_game
      g?.submitCountryGuess('DEU')
    })

    // Within 250 ms the full 65-point arc must already be in the source data.
    // Under non-reduced motion the arc would still be growing past this point.
    const handle = await page.waitForFunction(() => {
      const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
      if (!map) return null
      const src = map.getSource('game-reveal-line') as maplibregl.GeoJSONSource | undefined
      if (!src) return null
      const data = (src as unknown as { serialize: () => { data: GeoJSON.FeatureCollection } }).serialize().data
      if (!data?.features?.length) return null
      const g = data.features[0].geometry as GeoJSON.LineString
      return g && g.type === 'LineString' ? g.coordinates.length : null
    }, null, { timeout: 250 })
    const count = await handle.jsonValue() as number
    expect(count).toBe(65)
  })
})
