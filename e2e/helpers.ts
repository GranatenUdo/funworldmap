import { expect, type Page, type JSHandle } from '@playwright/test'
import { Buffer } from 'node:buffer'
import type { ModeId } from '../src/game/shared/types'
import { REVEAL_LINE_SOURCE } from '../src/game/shared/revealLayers'

export interface SeedHistoryOptions {
  date: string
  lastMilestoneShown?: 0 | 3 | 7 | 14 | 30 | 100
  modes?: ReadonlyArray<ModeId>
}

/**
 * Seed `funworldmap-daily-history` in localStorage BEFORE page.goto, so the
 * launcher / reveal overlay renders with a known history state.
 * Defaults: country-pinning mode only, lastMilestoneShown=3 (prevents the
 * milestone overlay from firing in tests that aren't about it).
 */
export async function seedDailyHistory(
  page: Page,
  { date, lastMilestoneShown = 3, modes = ['country-pinning'] }: SeedHistoryOptions,
): Promise<void> {
  await page.addInitScript(
    ({ d, ms, mods }) => {
      const days: Record<string, Record<string, unknown>> = {}
      const dayEntries: Record<string, unknown> = {}
      if (mods.includes('country-pinning')) {
        dayEntries['country-pinning'] = {
          score: 87,
          attempts: [
            { pointsEarned: 42, distanceKm: 1200 },
            { pointsEarned: 63, distanceKm: 400 },
            { pointsEarned: 91, distanceKm: 0 },
          ],
          completedAt: 1,
        }
      }
      if (mods.includes('city-guessing')) {
        dayEntries['city-guessing'] = {
          score: 81,
          attempts: [
            { pointsEarned: 34, distanceKm: 1500 },
            { pointsEarned: 78, distanceKm: 200 },
            { pointsEarned: 95, distanceKm: 10 },
          ],
          completedAt: 2,
        }
      }
      days[d] = dayEntries
      const history = {
        version: 1,
        streak: { current: 3, longest: 3, lastActiveDate: d, lastMilestoneShown: ms },
        days,
      }
      localStorage.setItem('funworldmap-daily-history', JSON.stringify(history))
    },
    { d: date, ms: lastMilestoneShown, mods: Array.from(modes) },
  )
}

/**
 * Stub `/daily/index.json` with a one-day index containing France + Paris.
 * Call BEFORE page.goto. Defaults to FRA/FRA-paris; other IDs can be
 * supplied if a test needs them.
 */
export async function stubDailyIndex(
  page: Page,
  date: string,
  opts: { cca3?: string; cityId?: string } = {},
): Promise<void> {
  const { cca3 = 'FRA', cityId = 'FRA-paris' } = opts
  await page.route('**/daily/index.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: `${date}T00:00:00.000Z`,
        window: { start: date, end: date },
        days: { [date]: { country: { cca3 }, city: { id: cityId } } },
      }),
    }),
  )
}

/**
 * Submit a country guess via the game's exposed API and wait for the session
 * to reflect the new attempt count.
 */
export async function submitAndWait(page: Page, cca3: string, expectAfter: number): Promise<void> {
  await page.evaluate(({ c }) => {
    const game = (window as unknown as { __funworldmap_game?: { submitCountryGuess: (cca3: string) => void } })
      .__funworldmap_game
    game?.submitCountryGuess(c)
  }, { c: cca3 })
  await expect
    .poll(
      () => page.evaluate(() => {
        const game = (window as unknown as { __funworldmap_game?: { getSession: () => { currentAttempts: unknown[] } } })
          .__funworldmap_game
        return game?.getSession().currentAttempts.length ?? 0
      }),
      { timeout: 5_000 },
    )
    .toBe(expectAfter)
}

/**
 * Dismiss the launcher if it is visible. No-op if the test uses a deep-link
 * URL (e.g. /#FRA) that bypasses the launcher.
 *
 * Call from beforeEach in any spec that relies on map-first entry via
 * page.goto('/') — after the launcher landing-state PR, '/' shows the
 * launcher by default.
 *
 * Implementation notes:
 * - Uses waitFor({ state: 'visible' }) with a 2s budget instead of a one-shot
 *   isVisible() — the latter races against the launcher's 260ms staggered
 *   entrance animation on slow renderers (Linux CI, headless xvfb).
 * - Awaits not.toBeAttached after dismiss so the caller can rely on the
 *   launcher's backdrop being fully removed before performing clicks that
 *   would otherwise be absorbed by the still-present backdrop.
 * - Final 150ms settle lets React batch-commit the post-dismiss header
 *   re-render (play + satellite buttons reappearing) before the caller
 *   interacts.
 */
export async function dismissLauncher(page: Page): Promise<void> {
  const launcher = page.getByTestId('launcher')
  try {
    await launcher.waitFor({ state: 'visible', timeout: 2_000 })
  } catch {
    // Launcher never appeared within 2s — deep-link test or already dismissed.
    return
  }
  await page.getByTestId('launcher-dismiss').click()
  await expect(launcher).not.toBeAttached({ timeout: 5_000 })
  await page.waitForTimeout(150)
}

/**
 * Wait until the app has finished its first render with bundled data ready.
 * Replaces brittle `page.waitForTimeout(1000)` patterns in beforeEach blocks.
 *
 * The signal is set on <main> in src/App.tsx as `data-app-ready="true"` once
 * countries + cities (both statically bundled) are non-empty after the first
 * useMemo evaluation. Because both are synchronous bundle imports, the
 * attribute appears as soon as React commits the first render — which is
 * exactly the moment downstream interactive components (SearchBar,
 * satellite-toggle, launcher mode cards) become safe to interact with.
 */
export async function waitForAppReady(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.locator('main[data-app-ready="true"]').waitFor({ state: 'attached', timeout: timeoutMs })
}

/**
 * Stub tiles, navigate to `path`, and wait for `[data-map-loaded]`. The bundled
 * three-step preamble used by every mobile spec.
 */
export async function gotoAndWaitForMap(page: Page, path = '/'): Promise<void> {
  await routeMapTiles(page)
  await page.goto(path)
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

/**
 * Poll the `game-reveal-line` source until it carries a LineString feature
 * with at least `minPoints` coordinates. Returns the coordinate array as a
 * JSHandle — call `.jsonValue()` on it to read the values.
 *
 * Default timeout is generous (15 s) because the animation alone takes
 * up to 1.2 s and CI's software-ANGLE Chromium adds significant render-time
 * overhead on top.
 */
export async function waitForRevealLineCoords(
  page: Page,
  { minPoints = 1, timeout = 15_000 }: { minPoints?: number; timeout?: number } = {},
): Promise<JSHandle<Array<[number, number]>>> {
  const handle = await page.waitForFunction(
    ({ src, min }) => {
      const map = window.__funworldmap_map
      if (!map) return null
      const source = map.getSource(src) as maplibregl.GeoJSONSource | undefined
      if (!source) return null
      const data = (source as unknown as { serialize: () => { data: GeoJSON.FeatureCollection } }).serialize().data
      if (!data?.features?.length) return null
      const g = data.features[0].geometry as GeoJSON.LineString
      if (!g || g.type !== 'LineString') return null
      if (g.coordinates.length < min) return null
      return g.coordinates as Array<[number, number]>
    },
    { src: REVEAL_LINE_SOURCE, min: minPoints },
    { timeout },
  )
  return handle as JSHandle<Array<[number, number]>>
}

/**
 * Stub all MapLibre network requests — style JSON, TileJSON, sprite images,
 * vector PBFs, raster tiles — so that external-network variance cannot prevent
 * the map 'load' event from firing under SwiftShader (software WebGL).
 *
 * What is stubbed and why:
 *   - tiles.openfreemap.org/styles/positron  — basemap style JSON.
 *     Stubbed with an embedded minimal-but-valid style that preserves the
 *     correct source / sprite / glyph URLs so subsequent resource requests
 *     also hit this interceptor instead of the real network.
 *   - /sprites/…json                         — sprite atlas JSON → '{}'
 *   - /planet, /wmts/…/tilejson              — TileJSON → emptyTileJson
 *   - *.png / *.jpg / *.webp                 — raster tiles / sprites → 1×1 PNG
 *   - *.pbf                                  — vector tiles and glyph ranges → empty body
 *
 * The map renders blank after these stubs, but layer-style assertions,
 * satellite-toggle aria-pressed state, and map.getLayoutProperty() calls
 * still work because they read MapLibre's in-memory style — not pixels.
 *
 * All localhost requests (app assets, daily API stubs, etc.) pass through
 * unchanged.
 *
 * Call BEFORE page.goto('/') so the intercepts are in place before any
 * network activity begins.
 */
export async function routeMapTiles(page: Page): Promise<void> {
  // 1×1 transparent PNG (base64-encoded)
  const pngBody = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=',
    'base64',
  )

  // Minimal valid sprite JSON atlas — MapLibre accepts this and fires 'load'
  // without any icons. Assertions don't rely on icon pixels.
  const emptySpriteJson = Buffer.from('{}')

  // Minimal valid TileJSON — a fake tile URL template pointing to a
  // localhost path that returns a 404. MapLibre accepts this as a valid
  // source definition and fires 'load'; the 404 tile responses are handled
  // gracefully as missing tiles (the map renders blank, which is fine).
  const emptyTileJson = Buffer.from(
    JSON.stringify({
      tilejson: '2.2.0',
      tiles: ['http://localhost:5173/__stub_tiles__/{z}/{x}/{y}.pbf'],
      minzoom: 0,
      maxzoom: 22,
    }),
  )

  // Minimal MapLibre GL style JSON for the OpenFreeMap positron basemap.
  //
  // Why embed this here: the style JSON lives at tiles.openfreemap.org which
  // can be slow or unreachable under CI / SwiftShader. MapLibre's 10-second
  // watchdog fires before the real response arrives, producing a 'timeout'
  // map error before the 'load' event ever fires. Returning a deterministic
  // stub eliminates this network dependency entirely.
  //
  // The stub keeps the correct source and sprite URLs so that subsequent
  // requests for TileJSON, sprite images, and vector tiles are also routed
  // through this same interceptor and fulfilled instantly.
  //
  // The layers array is reduced to a single background layer — enough for
  // MapLibre to consider the style valid and fire 'load'. All programmatic
  // layers added by mapLayers.ts (country fills, satellite raster, etc.)
  // are still added post-load and work normally.
  const positronStyleStub = Buffer.from(
    JSON.stringify({
      version: 8,
      sources: {
        ne2_shaded: {
          type: 'raster',
          tiles: ['https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 6,
        },
        openmaptiles: {
          type: 'vector',
          url: 'https://tiles.openfreemap.org/planet',
        },
      },
      sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
      glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: { 'background-color': 'rgb(242,243,240)' },
        },
      ],
    }),
  )

  await page.route('**/*', (route) => {
    const url = route.request().url()

    // Let all localhost requests pass through (app assets, daily API stubs, etc.)
    if (
      url.startsWith('http://localhost') ||
      url.startsWith('https://localhost') ||
      url.startsWith('data:')
    ) {
      return route.continue()
    }

    // Only intercept the known external MapLibre tile/asset hosts:
    //   tiles.openfreemap.org  — basemap style, vector tiles, sprites, glyphs
    //   tiles.maps.eox.at      — EOX Sentinel-2 satellite raster tiles
    //   s3.amazonaws.com       — AWS terrain PNG tiles
    const isExternalTileHost =
      url.includes('tiles.openfreemap.org') ||
      url.includes('tiles.maps.eox.at') ||
      url.includes('s3.amazonaws.com')

    if (!isExternalTileHost) {
      return route.continue()
    }

    const urlObj = new URL(url)

    // ── Style JSON ─────────────────────────────────────────────────────────
    // The basemap style JSON lives at /styles/<name> with no file extension.
    // Return our embedded stub so MapLibre gets a valid style immediately,
    // with no real-network latency. The probe request (?probe=1) also gets
    // the stub — probeBasemap only checks res.ok, not the body.
    if (/^\/styles\/[^/]+$/.test(urlObj.pathname.replace(/\?.*$/, ''))) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: positronStyleStub,
      })
    }

    // ── Sprite JSON atlas (.json extension) ───────────────────────────────
    if (url.endsWith('.json') || url.includes('.json?')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: emptySpriteJson,
      })
    }

    // ── TileJSON (no file extension, e.g. /planet, /wmts/…/tilejson) ──────
    // Detect by absence of any dotted extension in the last path segment.
    const lastSegment = urlObj.pathname.split('/').pop() ?? ''
    if (!lastSegment.includes('.')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: emptyTileJson,
      })
    }

    // ── Raster tiles: satellite JPGs, terrain PNGs, sprite sheet PNGs ─────
    if (
      url.endsWith('.jpg') ||
      url.endsWith('.jpeg') ||
      url.endsWith('.png') ||
      url.endsWith('.webp') ||
      url.includes('.jpg?') ||
      url.includes('.png?')
    ) {
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'Cache-Control': 'public, max-age=3600' },
        body: pngBody,
      })
    }

    // ── Vector tile PBFs and glyph range PBFs ─────────────────────────────
    if (url.endsWith('.pbf') || url.includes('.pbf?')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/x-protobuf',
        body: Buffer.alloc(0),
      })
    }

    // Anything else on a tile host — pass through unchanged.
    return route.continue()
  })
}
