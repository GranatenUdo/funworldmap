/**
 * Phase 2.5 — Label-contrast measurement (collect-not-fail mode)
 *
 * Measures WCAG contrast ratios for MapLibre label layers against their
 * halo and background colours in all four theme × view combinations.
 *
 * BASELINE COLLECTION MODE
 * ────────────────────────
 * This spec captures contrast ratios as a baseline. Threshold violations are
 * LOGGED (visible in stdout and test-info attachments) but do NOT fail the test.
 * The measurement infrastructure is verified (paints are read, maths are sound),
 * not the threshold values themselves. Phase 3 will tighten thresholds and fix
 * contrast after the contrast-remediation work lands.
 *
 * Design notes
 * ────────────
 * The real OpenFreeMap positron style URL is stubbed (routeMapTiles) so CI
 * cannot flake on network variance.  The stub deliberately includes a set of
 * representative symbol (label) layers matching the layer IDs that the real
 * positron style ships.  applyMapTheme (src/lib/mapColors.ts) iterates over
 * all symbol layers in map.getStyle().layers and applies a uniform
 * text-color / text-halo-color pair — so a stub with known symbol layers is
 * sufficient to verify the paint values actually written to the map.
 *
 * applyMapTheme applies these values:
 *   dark:  text-color #64748b, text-halo-color #10141a
 *   light: text-color #78716c, text-halo-color #e8e3da
 *
 * Background land-fill colours applied by applyMapTheme (src/lib/mapColors.ts):
 *   dark:  #10141a  (= background-color AND text-halo-color — intentional match)
 *   light: #e8e3da  (= background-color AND text-halo-color — intentional match)
 *
 * For satellite view the same text/halo values are used; the background is
 * raster imagery so no single representative colour exists — we measure
 * text-vs-halo only (which is the dominant contrast path for glyphs on any map).
 */

import { test, expect, type Page } from '@playwright/test'
import { Buffer } from 'node:buffer'

// ─── WCAG maths ────────────────────────────────────────────────────────────

interface Rgb { r: number; g: number; b: number }

function parseColor(raw: string): Rgb | null {
  if (!raw) return null

  // #rrggbb
  const hex6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(raw)
  if (hex6) {
    return {
      r: parseInt(hex6[1], 16),
      g: parseInt(hex6[2], 16),
      b: parseInt(hex6[3], 16),
    }
  }

  // #rgb
  const hex3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(raw)
  if (hex3) {
    return {
      r: parseInt(hex3[1] + hex3[1], 16),
      g: parseInt(hex3[2] + hex3[2], 16),
      b: parseInt(hex3[3] + hex3[3], 16),
    }
  }

  // rgb(...) or rgba(...)
  const rgba = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(raw)
  if (rgba) {
    return { r: parseInt(rgba[1]), g: parseInt(rgba[2]), b: parseInt(rgba[3]) }
  }

  return null
}

function relativeLuminance(rgb: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}

function contrastRatio(rgb1: Rgb, rgb2: Rgb): number {
  const l1 = relativeLuminance(rgb1)
  const l2 = relativeLuminance(rgb2)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

function wcagAA(ratio: number): boolean {
  return ratio >= 4.5
}

function formatRatio(r: number): string {
  return r.toFixed(2) + ':1'
}

// ─── Known label layers (OpenFreeMap positron representative set) ─────────

const LABEL_LAYER_IDS = [
  'place_country',
  'place_state',
  'place_city',
  'place_town',
  'place_village',
  'place_suburb',
]

// ─── Rich style stub that includes representative symbol layers ───────────

function buildRichPositronStub(): Buffer {
  const labelLayers = LABEL_LAYER_IDS.map((id) => ({
    id,
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'place',
    layout: {
      'text-field': '{name}',
      'text-font': ['Open Sans Regular'],
      'text-size': 12,
    },
    paint: {
      'text-color': '#333333',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1,
    },
  }))

  return Buffer.from(
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
        {
          id: 'water',
          type: 'fill',
          source: 'openmaptiles',
          'source-layer': 'water',
          paint: { 'fill-color': '#a8c8f0' },
        },
        ...labelLayers,
      ],
    }),
  )
}

// ─── Route helper with rich positron stub ─────────────────────────────────

async function routeMapTilesRich(page: Page): Promise<void> {
  const pngBody = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=',
    'base64',
  )
  const emptySpriteJson = Buffer.from('{}')
  const emptyTileJson = Buffer.from(
    JSON.stringify({
      tilejson: '2.2.0',
      tiles: ['http://localhost:5173/__stub_tiles__/{z}/{x}/{y}.pbf'],
      minzoom: 0,
      maxzoom: 22,
    }),
  )
  const richPositronStub = buildRichPositronStub()

  await page.route('**/*', (route) => {
    const url = route.request().url()
    if (
      url.startsWith('http://localhost') ||
      url.startsWith('https://localhost') ||
      url.startsWith('data:')
    ) {
      return route.continue()
    }
    const isExternalTileHost =
      url.includes('tiles.openfreemap.org') ||
      url.includes('tiles.maps.eox.at') ||
      url.includes('s3.amazonaws.com')
    if (!isExternalTileHost) return route.continue()

    const urlObj = new URL(url)
    if (/^\/styles\/[^/]+$/.test(urlObj.pathname.replace(/\?.*$/, ''))) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: richPositronStub,
      })
    }
    if (url.endsWith('.json') || url.includes('.json?')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: emptySpriteJson })
    }
    const lastSegment = urlObj.pathname.split('/').pop() ?? ''
    if (!lastSegment.includes('.')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: emptyTileJson })
    }
    if (
      url.endsWith('.jpg') || url.endsWith('.jpeg') ||
      url.endsWith('.png') || url.endsWith('.webp') ||
      url.includes('.jpg?') || url.includes('.png?')
    ) {
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'Cache-Control': 'public, max-age=3600' },
        body: pngBody,
      })
    }
    if (url.endsWith('.pbf') || url.includes('.pbf?')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/x-protobuf',
        body: Buffer.alloc(0),
      })
    }
    return route.continue()
  })
}

// ─── Runtime paint reader ─────────────────────────────────────────────────

interface LabelPaint {
  layerId: string
  textColor: string | null
  textHaloColor: string | null
}

async function readLabelPaints(page: Page, layerIds: string[]): Promise<LabelPaint[]> {
  return page.evaluate((ids: string[]): LabelPaint[] => {
    const map = (window as unknown as {
      __funworldmap_map?: {
        getPaintProperty: (id: string, prop: string) => string | null
        getLayer: (id: string) => unknown
      }
    }).__funworldmap_map
    if (!map) throw new Error('__funworldmap_map not exposed')
    return ids
      .filter((id) => !!map.getLayer(id))
      .map((id) => ({
        layerId: id,
        textColor: map.getPaintProperty(id, 'text-color') as string | null ?? null,
        textHaloColor: map.getPaintProperty(id, 'text-halo-color') as string | null ?? null,
      }))
  }, layerIds)
}

// ─── Wait for map loaded ──────────────────────────────────────────────────

async function waitForMapLoaded(page: Page): Promise<void> {
  // Race the success signal and the non-recoverable watchdog signal.
  // data-map-error="timeout" means the app-level watchdog fired before MapLibre's
  // 'load' event — [data-map-loaded] will never appear after that, so we fast-fail
  // with a descriptive message rather than waiting out the full 90s timeout.
  // data-map-error="style" is a transient map error that can occur before a
  // successful load and does NOT block the 'load' event — we ignore it here.
  const result = await page.waitForFunction(
    () => {
      const loadedEl = document.querySelector('[data-map-loaded]')
      if (loadedEl) return 'loaded'
      const errorEl = document.querySelector('[data-map-error]')
      const reason = errorEl?.getAttribute('data-map-error')
      if (reason === 'timeout') return 'timeout'
      return null
    },
    undefined,
    { timeout: 90_000 },
  )
  const state = await result.jsonValue()
  if (state === 'timeout') {
    throw new Error('Map watchdog fired: data-map-error="timeout". MapLibre did not reach \'load\' within BASEMAP_LOAD_TIMEOUT_MS.')
  }
}

// ─── Contrast row ─────────────────────────────────────────────────────────

interface ContrastRow {
  layer: string
  textColor: string
  haloColor: string
  bgColor: string
  textVsHalo: number
  textVsBg: number
  haloVsBg: number
}

function measureContrast(paints: LabelPaint[], bgColor: string): ContrastRow[] {
  return paints.map(({ layerId, textColor, textHaloColor }) => {
    const tc = parseColor(textColor ?? '') ?? { r: 0, g: 0, b: 0 }
    const hc = parseColor(textHaloColor ?? '') ?? { r: 255, g: 255, b: 255 }
    const bc = parseColor(bgColor) ?? { r: 128, g: 128, b: 128 }
    return {
      layer: layerId,
      textColor: textColor ?? '(none)',
      haloColor: textHaloColor ?? '(none)',
      bgColor,
      textVsHalo: contrastRatio(tc, hc),
      textVsBg: contrastRatio(tc, bc),
      haloVsBg: contrastRatio(hc, bc),
    }
  })
}

// ─── Test suite ───────────────────────────────────────────────────────────

test.describe('Label contrast measurement (Phase 2.5)', () => {
  test.setTimeout(120_000)

  // applyMapTheme values from src/lib/mapColors.ts (exact constants, not guessed)
  const EXPECTED_DARK_TEXT = '#64748b'
  const EXPECTED_DARK_HALO = '#10141a'
  const EXPECTED_LIGHT_TEXT = '#78716c'
  const EXPECTED_LIGHT_HALO = '#e8e3da'

  // Background overrides from src/lib/mapColors.ts
  const DARK_LAND_BG = '#10141a'
  const LIGHT_LAND_BG = '#e8e3da'

  // ─── Light + Map view ─────────────────────────────────────────────

  test('light + map view: label paint properties set correctly', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'light'))
    await routeMapTilesRich(page)
    await page.goto('/')
    await waitForMapLoaded(page)

    // Poll until applyMapTheme has applied the light text-color
    await expect.poll(
      async () => {
        const paints = await readLabelPaints(page, LABEL_LAYER_IDS)
        return paints[0]?.textColor ?? null
      },
      { timeout: 15_000 },
    ).toBe(EXPECTED_LIGHT_TEXT)

    const paints = await readLabelPaints(page, LABEL_LAYER_IDS)
    expect(paints.length, 'at least one label layer must be present in the stub style').toBeGreaterThan(0)

    for (const p of paints) {
      expect(p.textColor, `${p.layerId} text-color`).toBe(EXPECTED_LIGHT_TEXT)
      expect(p.textHaloColor, `${p.layerId} text-halo-color`).toBe(EXPECTED_LIGHT_HALO)
    }

    const rows = measureContrast(paints, LIGHT_LAND_BG)
    const testInfo = test.info()
    console.log('\n=== Light + Map view ===')
    for (const r of rows) {
      const tvh = formatRatio(r.textVsHalo)
      const tvb = formatRatio(r.textVsBg)
      const hvb = formatRatio(r.haloVsBg)
      const aaLabel = wcagAA(r.textVsHalo) ? 'PASS AA' : r.textVsHalo >= 3 ? 'WARN <AA' : 'FAIL <3:1'
      console.log(`  ${r.layer}: text vs halo = ${tvh} [${aaLabel}] | text vs bg = ${tvb} | halo vs bg = ${hvb}`)
      // Log violations (collect mode); sanity-check that measurement worked (ratio > 0)
      if (r.textVsHalo < 3.0) {
        testInfo.attach('contrast-violation', {
          body: `${r.layer} text-vs-halo ${tvh} below WCAG minimum 3:1`,
          contentType: 'text/plain',
        })
      }
      expect(r.textVsHalo, `${r.layer} text-vs-halo measurement`).toBeGreaterThan(0)
    }
  })

  // ─── Dark + Map view ──────────────────────────────────────────────

  test('dark + map view: label paint properties set correctly', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'dark'))
    await routeMapTilesRich(page)
    await page.goto('/')
    await waitForMapLoaded(page)

    await expect.poll(
      async () => {
        const paints = await readLabelPaints(page, LABEL_LAYER_IDS)
        return paints[0]?.textColor ?? null
      },
      { timeout: 15_000 },
    ).toBe(EXPECTED_DARK_TEXT)

    const paints = await readLabelPaints(page, LABEL_LAYER_IDS)
    expect(paints.length, 'at least one label layer must be present in the stub style').toBeGreaterThan(0)

    for (const p of paints) {
      expect(p.textColor, `${p.layerId} text-color`).toBe(EXPECTED_DARK_TEXT)
      expect(p.textHaloColor, `${p.layerId} text-halo-color`).toBe(EXPECTED_DARK_HALO)
    }

    const rows = measureContrast(paints, DARK_LAND_BG)
    console.log('\n=== Dark + Map view ===')
    for (const r of rows) {
      const tvh = formatRatio(r.textVsHalo)
      const tvb = formatRatio(r.textVsBg)
      const hvb = formatRatio(r.haloVsBg)
      const aaLabel = wcagAA(r.textVsHalo) ? 'PASS AA' : r.textVsHalo >= 3 ? 'OK ≥3:1' : 'FAIL <3:1'
      console.log(`  ${r.layer}: text vs halo = ${tvh} [${aaLabel}] | text vs bg = ${tvb} | halo vs bg = ${hvb}`)
      // Phase 3.10: dark-mode 3:1 minimum is now a hard assertion (was collect-only in Phase 2.5)
      expect(r.textVsHalo, `${r.layer} text-vs-halo must meet WCAG minimum 3:1`).toBeGreaterThanOrEqual(3.0)
    }
  })

  // ─── Light + Satellite view ───────────────────────────────────────

  test('light + satellite view: label paint properties set correctly', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'light'))
    await routeMapTilesRich(page)
    await page.goto('/')
    await waitForMapLoaded(page)

    await expect.poll(
      async () => {
        const paints = await readLabelPaints(page, LABEL_LAYER_IDS)
        return paints[0]?.textColor ?? null
      },
      { timeout: 15_000 },
    ).toBe(EXPECTED_LIGHT_TEXT)

    const paints = await readLabelPaints(page, LABEL_LAYER_IDS)
    const rows = measureContrast(paints, LIGHT_LAND_BG)
    const testInfo = test.info()

    console.log('\n=== Light + Satellite view (text vs halo — primary path; bg is variable imagery) ===')
    for (const r of rows) {
      const tvh = formatRatio(r.textVsHalo)
      const aaLabel = wcagAA(r.textVsHalo) ? 'PASS AA' : r.textVsHalo >= 3 ? 'WARN <AA' : 'FAIL <3:1'
      console.log(`  ${r.layer}: text vs halo = ${tvh} [${aaLabel}]`)
      // Log violations (collect mode); sanity-check that measurement worked (ratio > 0)
      if (r.textVsHalo < 3.0) {
        testInfo.attach('contrast-violation', {
          body: `${r.layer} text-vs-halo ${tvh} below WCAG minimum 3:1`,
          contentType: 'text/plain',
        })
      }
      expect(r.textVsHalo, `${r.layer} text-vs-halo measurement`).toBeGreaterThan(0)
    }
  })

  // ─── Dark + Satellite view ────────────────────────────────────────

  test('dark + satellite view: label paint properties set correctly', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'dark'))
    await routeMapTilesRich(page)
    await page.goto('/')
    await waitForMapLoaded(page)

    await expect.poll(
      async () => {
        const paints = await readLabelPaints(page, LABEL_LAYER_IDS)
        return paints[0]?.textColor ?? null
      },
      { timeout: 15_000 },
    ).toBe(EXPECTED_DARK_TEXT)

    const paints = await readLabelPaints(page, LABEL_LAYER_IDS)
    const rows = measureContrast(paints, DARK_LAND_BG)

    console.log('\n=== Dark + Satellite view (text vs halo — primary path; bg is variable imagery) ===')
    for (const r of rows) {
      const tvh = formatRatio(r.textVsHalo)
      const aaLabel = wcagAA(r.textVsHalo) ? 'PASS AA' : r.textVsHalo >= 3 ? 'OK ≥3:1' : 'FAIL <3:1'
      console.log(`  ${r.layer}: text vs halo = ${tvh} [${aaLabel}]`)
      // Phase 3.10: dark-mode 3:1 minimum is now a hard assertion (was collect-only in Phase 2.5)
      expect(r.textVsHalo, `${r.layer} text-vs-halo must meet WCAG minimum 3:1`).toBeGreaterThanOrEqual(3.0)
    }
  })

  // ─── Static analysis (pure maths, no browser) ────────────────────

  test('static: dark palette text-vs-halo measurement', () => {
    const text = parseColor(EXPECTED_DARK_TEXT)!
    const halo = parseColor(EXPECTED_DARK_HALO)!
    const ratio = contrastRatio(text, halo)
    const ratioStr = formatRatio(ratio)
    console.log(`\nStatic dark  text(${EXPECTED_DARK_TEXT}) vs halo(${EXPECTED_DARK_HALO}) = ${ratioStr}`)
    // Phase 3.10: dark-mode 3:1 minimum is now a hard assertion (was collect-only in Phase 2.5)
    expect(ratio, `Dark palette text-vs-halo must meet WCAG minimum 3:1`).toBeGreaterThanOrEqual(3.0)
  })

  test('static: light palette text-vs-halo measurement', () => {
    const text = parseColor(EXPECTED_LIGHT_TEXT)!
    const halo = parseColor(EXPECTED_LIGHT_HALO)!
    const ratio = contrastRatio(text, halo)
    const ratioStr = formatRatio(ratio)
    const testInfo = test.info()
    console.log(`\nStatic light text(${EXPECTED_LIGHT_TEXT}) vs halo(${EXPECTED_LIGHT_HALO}) = ${ratioStr}`)
    // Log violation (collect mode); sanity-check that measurement worked (ratio > 0)
    if (ratio < 3.0) {
      testInfo.attach('contrast-violation', {
        body: `Light palette text-vs-halo ${ratioStr} below WCAG minimum 3:1`,
        contentType: 'text/plain',
      })
    }
    expect(ratio).toBeGreaterThan(0)
  })
})