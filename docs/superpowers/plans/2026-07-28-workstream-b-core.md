# Workstream B-core — Political Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the default map read as a political map: app-owned country labels on satellite (B1), cased borders (B2), selection as spotlight instead of sticker (B4), a reveal fill pulse so the answer country pops (B5), compare camera via asymmetric padding (B6), and map-control polish (B7) — B3 (vector political pass) is explicitly severed to a later tranche.

**Architecture:** Every layer/paint change routes through the single owners in `src/lib/mapLayers.ts` (`applyCountryBaselinePaint`, `applyBasemapLayerVisibility`) with new layers registered in the `LAYER` registry and anchored by `beforeId` against named layers (never absolute positions). New pure modules: `countryLabelFeatures.ts` (label GeoJSON with areaRank) and a reveal pulse-plan function in the `revealAnimation.ts` style. Tasks execute strictly 1 → 9; later tasks quote `mapLayers.ts` as it exists after earlier tasks land.

**Tech Stack:** React 19, TypeScript, MapLibre GL 5.23 (glyphs from the positron endpoint — live-verified by the 2026-07-28 spike; no font assets ship), Vitest + fake-map capture tests, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-26-ux-visual-program-design.md` — workstream B items B1/B2/B4/B5/B6/B7 and the Testing commitments. Spike input: `docs/superpowers/notes/2026-07-28-b1-glyph-spike.md`. Task ↔ spec map: T1–T3=B1, T4=B2, T5=B4, T6=B5, T7=B6, T8=B7, T9=verification sweep.

## Global Constraints

- Map paint/visibility single-owner rule: no scattered `setPaintProperty`/`setLayoutProperty` outside `mapLayers.ts` owners or the documented reveal-effects owner; fake-map unit tests capture every owner change (`src/test/fakeMapRef.ts`).
- `country-labels` visibility contract: **visible iff `satellite && !hideLabels`** — never leaks answers during play; truth-table test extended including the toggle-satellite-mid-game ordering case.
- Glyphs: `text-font: ['Noto Sans Bold']` via the style's existing endpoint; the e2e tile stub serves empty glyph PBFs, so label e2e asserts layers/layout via the map seam, never rendered text pixels.
- B4 keeps the interim coral selection border (E4's ice re-skin comes in the E-foundations tranche); the dim layer must never join hit-testing — every `queryRenderedFeatures` caller stays layer-scoped.
- B5/B6 camera + paint animations are invisible to `Element.getAnimations` — seam-based contracts only (poll paint properties / `!map.isMoving()`), waveform unit-tested; reduced-motion paths mandatory.
- B6 keeps the >110° wide-pair midpoint fallback; the `GLOBE_SCALE_ZOOM` guard is removed only if both live cases (Japan+USA, France+Germany) pass without it — conservative default is keep.
- Touch targets reuse the shipped `TOUCH_TARGET_*`/pinning-test convention from workstream A (`src/lib/layoutConstants.ts`); light-theme chrome aligns with A3's shipped `.dark`-scoped CSS.
- e2e rules (CLAUDE.md): no `page.waitForTimeout`, no `force: true`, auto-retrying expects, helpers from `e2e/helpers.ts`; kill stray dev servers before Playwright; `--project=chromium --workers=2`; CI-excluded specs are named as local-only in each task.
- Analytics: **no new telemetry in this workstream** (map presentation only).
- Docs: any change that stales a `docs/systems/` page updates that page in the same task.
- Commits: conventional prefix, imperative, trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Pure country-label feature builder (`countryLabelFeatures.ts`)

**Files:**
- Create: `src/lib/countryLabelFeatures.ts` (~60 lines)
- Create: `src/lib/__tests__/countryLabelFeatures.test.ts`

**Interfaces:**
- Consumes: `CANONICAL_CCA3: ReadonlySet<string>` from `src/lib/canonicalCountries.ts` (the single 195-country filter — do NOT re-derive the canonical set); `CountryData`, `CountriesFile` from `src/lib/types.ts`; bundled `src/data/countries.json` (249 entries; each has `cca3`, `name.common`, `latlng: [lat, lng]`, `area: number` — verified complete, no missing fields).
- Produces:
  - `interface CountryLabelProperties { cca3: string; name: string; areaRank: number }`
  - `type CountryLabelCollection = GeoJSON.FeatureCollection<GeoJSON.Point, CountryLabelProperties>`
  - `type CountryLabelSource = Pick<CountryData, 'cca3' | 'name' | 'latlng' | 'area'>`
  - `buildCountryLabelFeatures(countries: readonly CountryLabelSource[]): CountryLabelCollection` — pure builder
  - `COUNTRY_LABEL_COLLECTION: CountryLabelCollection` — built once at module load from the bundled data (the `canonicalCountries.ts` pattern). Task 2's `WorldMap.tsx` consumes this.

Data facts this task is designed around (verified against `src/data/countries.json` on 2026-07-28): `latlng` is `[lat, lng]` (restcountries order — GeoJSON needs the swap); every canonical longitude lies in [-175, 178.065] so **no antimeridian shift is needed for points** — a Point cannot straddle the antimeridian the way the FJI/RUS *polygons* do (`fixAntimeridian` in `loadCountryGeojson.ts` shifts those into 0..360), and MapLibre wraps point longitudes, so a Fiji label at lng 178.065 renders on the shifted Fiji polygon without adjustment; all 195 canonical `name.common` values are Latin-1 (one cached glyph PBF, range 0-255, covers the whole layer — B1 glyph spike, `docs/superpowers/notes/2026-07-28-b1-glyph-spike.md`); there are no exact-area ties today (RUS 17,098,246 km² … VAT 0.49 km²).

- [ ] **Step 1: Write the failing unit test.** Create `src/lib/__tests__/countryLabelFeatures.test.ts` with exactly:

```ts
import { describe, expect, it } from 'vitest'
import { COUNTRY_LABEL_COLLECTION, buildCountryLabelFeatures } from '../countryLabelFeatures'
import countriesFile from '../../data/countries.json'
import type { CountriesFile } from '../types'

const { features } = COUNTRY_LABEL_COLLECTION
const byCca3 = new Map(features.map((f) => [f.properties.cca3, f]))

describe('buildCountryLabelFeatures', () => {
  it('emits exactly the 195 canonical countries from the full 249-entry file', () => {
    expect((countriesFile as unknown as CountriesFile).countries.length).toBe(249)
    expect(features).toHaveLength(195)
    expect(byCca3.has('TWN')).toBe(false) // non-canonical entries filtered out
  })

  it('France is present with swapped [lng, lat] coordinates and a mid-table rank', () => {
    const fra = byCca3.get('FRA')
    expect(fra).toBeDefined()
    // countries.json latlng for FRA is [46, 2] ([lat, lng]); GeoJSON order is [lng, lat].
    expect(fra!.geometry.coordinates).toEqual([2, 46])
    expect(fra!.properties.name).toBe('France')
    // 543,908 km² ranks France 48th of 195 in the current data. Range-asserted
    // so an upstream area revision doesn't churn this test.
    expect(fra!.properties.areaRank).toBeGreaterThanOrEqual(40)
    expect(fra!.properties.areaRank).toBeLessThanOrEqual(60)
  })

  it('areaRank is a dense 1..195 ranking: 1 = Russia (largest), 195 = Vatican (smallest)', () => {
    expect(byCca3.get('RUS')!.properties.areaRank).toBe(1)
    expect(byCca3.get('VAT')!.properties.areaRank).toBe(195)
    const ranks = features.map((f) => f.properties.areaRank)
    expect(new Set(ranks).size).toBe(195)
    expect(Math.min(...ranks)).toBe(1)
    expect(Math.max(...ranks)).toBe(195)
  })

  it('every label name is Latin-1 — one glyph PBF range (0-255) covers the layer', () => {
    const offenders = features
      .filter((f) => [...f.properties.name].some((ch) => ch.codePointAt(0)! > 0xff))
      .map((f) => `${f.properties.cca3}:${f.properties.name}`)
    expect(offenders).toEqual([])
  })

  it('no point needs an antimeridian shift: all coordinates in [-180,180]×[-90,90]', () => {
    for (const f of features) {
      const [lng, lat] = f.geometry.coordinates
      expect(lng).toBeGreaterThanOrEqual(-180)
      expect(lng).toBeLessThanOrEqual(180)
      expect(lat).toBeGreaterThanOrEqual(-90)
      expect(lat).toBeLessThanOrEqual(90)
    }
  })

  it('rank ties break deterministically by cca3 (guards future data refreshes)', () => {
    const tied = buildCountryLabelFeatures([
      { cca3: 'DEU', name: { common: 'Germany', official: 'x' }, latlng: [51, 9], area: 100 },
      {
        cca3: 'AUT',
        name: { common: 'Austria', official: 'x' },
        latlng: [47.3333, 13.3333],
        area: 100,
      },
    ])
    expect(tied.features.map((f) => f.properties.cca3)).toEqual(['AUT', 'DEU'])
  })
})
```

- [ ] **Step 2: Run it and see it fail.** From `E:\polworldmap`: `npx vitest run src/lib/__tests__/countryLabelFeatures.test.ts` — expect a module-resolution failure: `Failed to resolve import "../countryLabelFeatures"` (the module does not exist yet). All 6 tests error, none pass.

- [ ] **Step 3: Implement the module.** Create `src/lib/countryLabelFeatures.ts` with exactly:

```ts
import countriesFile from '../data/countries.json'
import { CANONICAL_CCA3 } from './canonicalCountries'
import type { CountriesFile, CountryData } from './types'

/** Properties carried by each country-label point feature (workstream B1). */
export interface CountryLabelProperties {
  cca3: string
  /** name.common — every canonical name is Latin-1, so one cached glyph PBF
   *  (the 0-255 range) covers the whole layer (B1 glyph spike, 2026-07-28). */
  name: string
  /** 1 = largest area (Russia) … 195 = smallest (Vatican). Drives the label
   *  layer's zoom-stepped admission filter and `symbol-sort-key` so
   *  globe-scale collision drops microstates before giants deterministically. */
  areaRank: number
}

export type CountryLabelCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  CountryLabelProperties
>

/** The minimal country shape this module needs — lets tests feed fixtures
 *  without fabricating full CountryData records. */
export type CountryLabelSource = Pick<CountryData, 'cca3' | 'name' | 'latlng' | 'area'>

/** Build the canonical label points: one Point feature per canonical country
 *  at its bundled `latlng` centroid, ranked by area (1 = largest).
 *
 *  Antimeridian note (decided against the real data, 2026-07-28): no longitude
 *  shift is needed. Every canonical latlng longitude lies in [-175, 178.065],
 *  a Point cannot straddle the antimeridian the way the FJI/RUS polygons do
 *  (fixAntimeridian shifts THOSE into 0..360), and MapLibre wraps point
 *  longitudes — so a label at 178.065 renders on the shifted Fiji polygon
 *  without adjustment. */
export function buildCountryLabelFeatures(
  countries: readonly CountryLabelSource[],
): CountryLabelCollection {
  const canonical = countries.filter((c) => CANONICAL_CCA3.has(c.cca3))
  // Descending area; cca3 tiebreak keeps ranks deterministic should a future
  // data refresh introduce an exact-area tie (none exist today).
  const byAreaDesc = [...canonical].sort((a, b) => b.area - a.area || a.cca3.localeCompare(b.cca3))
  return {
    type: 'FeatureCollection',
    features: byAreaDesc.map((c, i) => ({
      type: 'Feature',
      // restcountries latlng is [lat, lng]; GeoJSON wants [lng, lat].
      geometry: { type: 'Point', coordinates: [c.latlng[1], c.latlng[0]] },
      properties: { cca3: c.cca3, name: c.name.common, areaRank: i + 1 },
    })),
  }
}

/** The label collection for the bundled dataset, built once at module load
 *  (the canonicalCountries.ts pattern). WorldMap feeds this to
 *  addCountryLabelLayer (src/lib/mapLayers.ts). */
export const COUNTRY_LABEL_COLLECTION: CountryLabelCollection = buildCountryLabelFeatures(
  (countriesFile as unknown as CountriesFile).countries,
)
```

- [ ] **Step 4: Run green.** `npx vitest run src/lib/__tests__/countryLabelFeatures.test.ts` — expect `6 passed`. Then `npm run check` (lint + typecheck + full unit suite) — expect green.

- [ ] **Step 5: Commit.**

```
git add src/lib/countryLabelFeatures.ts src/lib/__tests__/countryLabelFeatures.test.ts
git commit -m "feat(map): canonical country-label point features with area ranks (B1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `country-labels` symbol layer + explicit visibility ownership

**Files:**
- Modify: `src/lib/mapLayers.ts` (LAYER registry lines 233–247; new `addCountryLabelLayer` + constants inserted after `addBaseCountryLayers`, i.e. after line 75; `applyBasemapLayerVisibility` lines 294–317)
- Modify: `src/components/WorldMap.tsx` (import block lines 7–15; `onLoad` lines 52–61)
- Modify: `src/lib/__tests__/mapLayers.test.ts` (styleLayers fixture line 55–60; new tests appended)
- Modify: `docs/systems/map-rendering.md` (lines 18 and 60 — the layer inventory goes stale with this change, so it updates in this task)
- Test: `src/lib/__tests__/mapLayers.test.ts`

**Interfaces:**
- Consumes: `COUNTRY_LABEL_COLLECTION: CountryLabelCollection` from `src/lib/countryLabelFeatures.ts` (Task 1).
- Produces:
  - `LAYER.countryLabels === 'country-labels'` (registered in the typed `LAYER` registry; the `country-` prefix is required so the owner's `customPrefixes` skip covers it for the generic rule while the new explicit rule handles it first)
  - `export const COUNTRY_LABEL_SOURCE = 'country-label-points'`
  - `export function addCountryLabelLayer(map: maplibregl.Map, labels: GeoJSON.FeatureCollection): void`
  - `applyBasemapLayerVisibility` (existing single owner, same signature `(map, { satellite, hideLabels })`) gains the explicit B1 rule: `country-labels` visible **iff `satellite && !hideLabels`**. No new call site — `useSatelliteMode` already calls the owner on every `{satellite, playing}` change and on load.

Type facts verified against the installed `maplibre-gl@5.23` style-spec d.ts (`node_modules/maplibre-gl/node_modules/@maplibre/maplibre-gl-style-spec/dist/index.d.ts`): `symbol-sort-key` and `text-size` are `DataDrivenPropertyValueSpecification<number>` (data-driven expressions allowed); `filter` is `FilterSpecification = boolean | ExpressionSpecification | legacy`, and the `'step'` tuple form accepts expression outputs — but the style-spec rule is that `['zoom']` in a **filter** may only appear as the input of a *top-level* `step`/`interpolate`, so the whole filter is one `step` (evaluated at integer zooms, which is fine for tier admission).

- [ ] **Step 1: Write the failing unit tests.** In `src/lib/__tests__/mapLayers.test.ts`, first extend the imports (lines 1–11). Replace:

```ts
import {
  addHoverLayers,
  addSelectionLayers,
  addCompareLayers,
  applyBasemapLayerVisibility,
  applyCountryBaselinePaint,
  EXTRUSION_MAX_ZOOM,
  extrusionHeightExpression,
} from '../mapLayers'
```

with:

```ts
import {
  addCountryLabelLayer,
  addHoverLayers,
  addSelectionLayers,
  addCompareLayers,
  applyBasemapLayerVisibility,
  applyCountryBaselinePaint,
  COUNTRY_LABEL_SOURCE,
  EXTRUSION_MAX_ZOOM,
  extrusionHeightExpression,
  LAYER,
} from '../mapLayers'
```

Then in the `describe('applyBasemapLayerVisibility', ...)` block, replace the fixture (lines 55–60):

```ts
  const styleLayers = [
    { id: 'water', type: 'fill' },
    { id: 'place-labels', type: 'symbol' },
    { id: 'country-fill', type: 'fill' },
    { id: 'satellite-layer', type: 'raster' },
  ]
```

with:

```ts
  const styleLayers = [
    { id: 'water', type: 'fill' },
    { id: 'place-labels', type: 'symbol' },
    { id: 'country-fill', type: 'fill' },
    { id: 'country-labels', type: 'symbol' },
    { id: 'satellite-layer', type: 'raster' },
  ]
```

and append these tests inside the same `describe`, after the `'satellite: all non-custom hidden regardless of hideLabels'` test (before its closing `})`):

```ts
  // B1: the app-owned label layer is the ONE country-* layer this owner does
  // write — the explicit rule (visible iff satellite && !hideLabels) runs
  // before the customPrefixes skip.
  it.each([
    [true, false, 'visible'],
    [true, true, 'none'],
    [false, false, 'none'],
    [false, true, 'none'],
  ])(
    'country-labels: satellite=%s hideLabels=%s → %s',
    (satellite, hideLabels, expected) => {
      const fake = makeMapWithStyle()
      applyBasemapLayerVisibility(fake.map, { satellite, hideLabels })
      expect(visibilityOf(fake, 'country-labels')).toBe(expected)
    },
  )

  it('the country-labels rule does not leak to other custom layers', () => {
    const fake = makeMapWithStyle()
    applyBasemapLayerVisibility(fake.map, { satellite: true, hideLabels: false })
    expect(visibilityOf(fake, 'country-fill')).toBeUndefined()
    expect(visibilityOf(fake, 'satellite-layer')).toBeUndefined()
  })

  it('toggle-satellite-mid-game ordering: hidden through both toggles, restored only when the game ends', () => {
    const fake = makeMapWithStyle()
    // Playing in satellite → hidden.
    applyBasemapLayerVisibility(fake.map, { satellite: true, hideLabels: true })
    expect(visibilityOf(fake, 'country-labels')).toBe('none')
    // Player toggles to vector mid-game → still hidden.
    applyBasemapLayerVisibility(fake.map, { satellite: false, hideLabels: true })
    expect(visibilityOf(fake, 'country-labels')).toBe('none')
    // Back to satellite while STILL playing → satellite alone must not reveal.
    applyBasemapLayerVisibility(fake.map, { satellite: true, hideLabels: true })
    expect(visibilityOf(fake, 'country-labels')).toBe('none')
    // Game ends in satellite → labels return.
    applyBasemapLayerVisibility(fake.map, { satellite: true, hideLabels: false })
    expect(visibilityOf(fake, 'country-labels')).toBe('visible')
  })
```

Finally append a new top-level `describe` at the end of the file:

```ts
describe('addCountryLabelLayer', () => {
  const labelFixture: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [2, 46] },
        properties: { cca3: 'FRA', name: 'France', areaRank: 48 },
      },
    ],
  }

  function addAndGetLayer() {
    const fake = createFakeMapRef()
    addCountryLabelLayer(fake.map, labelFixture)
    const layer = fake.addedLayers.find((l) => l.id === LAYER.countryLabels)
    if (layer?.type !== 'symbol') throw new Error('country-labels must be a symbol layer')
    return { fake, layer }
  }

  it('adds the geojson source and a symbol layer registered as LAYER.countryLabels', () => {
    const { fake, layer } = addAndGetLayer()
    expect(fake.calls.addSource).toHaveBeenCalledWith(COUNTRY_LABEL_SOURCE, {
      type: 'geojson',
      data: labelFixture,
    })
    expect(layer.source).toBe(COUNTRY_LABEL_SOURCE)
  })

  it('uses the endpoint-verified Noto Sans Bold font (the default stack 404s on the positron glyphs endpoint)', () => {
    const { layer } = addAndGetLayer()
    expect(layer.layout?.['text-font']).toEqual(['Noto Sans Bold'])
    expect(layer.layout?.['text-field']).toEqual(['get', 'name'])
  })

  it('sorts collisions by areaRank and starts hidden until the visibility owner runs', () => {
    const { layer } = addAndGetLayer()
    expect(layer.layout?.['symbol-sort-key']).toEqual(['get', 'areaRank'])
    expect(layer.layout?.visibility).toBe('none')
  })

  it('zoom-stepped areaRank admission: a top-level step on zoom ending in admit-all', () => {
    const { layer } = addAndGetLayer()
    const filter = layer.filter as unknown[]
    expect(filter[0]).toBe('step')
    expect(filter[1]).toEqual(['zoom'])
    expect(filter.at(-1)).toBe(true) // final branch admits all 195
  })

  it('white text with a dark halo inside the 1–2.5px legibility band', () => {
    const { layer } = addAndGetLayer()
    expect(layer.paint?.['text-color']).toBe('#ffffff')
    expect(layer.paint?.['text-halo-color']).toBe('#0f172a')
    const halo = layer.paint?.['text-halo-width'] as number
    expect(halo).toBeGreaterThanOrEqual(1)
    expect(halo).toBeLessThanOrEqual(2.5)
  })
})
```

- [ ] **Step 2: Run and see it fail.** `npx vitest run src/lib/__tests__/mapLayers.test.ts` — expect the whole file to error on import: `mapLayers.ts` does not export `addCountryLabelLayer`, `COUNTRY_LABEL_SOURCE`, or `LAYER.countryLabels` yet (Vitest reports "does not provide an export named 'COUNTRY_LABEL_SOURCE'" or a TS error). Nothing passes.

- [ ] **Step 3: Implement in `src/lib/mapLayers.ts`.** Three edits.

  (a) In the `LAYER` registry (lines 233–247), replace:

```ts
  compareExtrusion: 'country-compare-extrusion',
  satellite: 'satellite-layer',
} as const
```

with:

```ts
  compareExtrusion: 'country-compare-extrusion',
  countryLabels: 'country-labels',
  satellite: 'satellite-layer',
} as const
```

  (b) Insert after the closing `}` of `addBaseCountryLayers` (line 75), before `/** Add hover / extrusion overlays ... */`:

```ts
/** GeoJSON source id for the app-built country-label points (B1). */
export const COUNTRY_LABEL_SOURCE = 'country-label-points'

/** Zoom-stepped areaRank admission — the "area-ranked minzoom" from the B1
 *  design: area giants label from the base zoom, each stop admits the next
 *  tier, everything (incl. microstates) labels from z5. Zoom expressions in
 *  FILTERS must be a top-level step/interpolate on ['zoom'] (style-spec
 *  rule), hence the whole filter is one step; filters evaluate at integer
 *  zooms, which is fine for tier admission. Stops are tuned in the B1 e2e
 *  task's live pass. */
const LABEL_RANK_FILTER: maplibregl.ExpressionSpecification = [
  'step',
  ['zoom'],
  ['<=', ['get', 'areaRank'], 40],
  3,
  ['<=', ['get', 'areaRank'], 100],
  4,
  ['<=', ['get', 'areaRank'], 160],
  5,
  true,
]

/** Area-ranked text size: giants render larger than microstates at every
 *  zoom; both grow with zoom. Outer interpolate must be on zoom (composite
 *  expression order); inner is on the areaRank data property. Tuned in the
 *  B1 e2e task's live pass. */
const LABEL_TEXT_SIZE: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  1.5,
  ['interpolate', ['linear'], ['get', 'areaRank'], 1, 13, 195, 9],
  6,
  ['interpolate', ['linear'], ['get', 'areaRank'], 1, 18, 195, 12],
]

/** Add the app-owned country-name label layer (B1). Called LAST in WorldMap's
 *  onLoad so labels render above every other app layer. Starts hidden:
 *  applyBasemapLayerVisibility is the single visibility owner (visible iff
 *  satellite && !hideLabels) and runs from useSatelliteMode once loaded —
 *  the initial 'none' prevents a label flash on a deep-linked game cold load
 *  before the owner's first pass. */
export function addCountryLabelLayer(
  map: maplibregl.Map,
  labels: GeoJSON.FeatureCollection,
): void {
  map.addSource(COUNTRY_LABEL_SOURCE, { type: 'geojson', data: labels })
  map.addLayer({
    id: LAYER.countryLabels,
    type: 'symbol',
    source: COUNTRY_LABEL_SOURCE,
    filter: LABEL_RANK_FILTER,
    layout: {
      // Explicit font is load-bearing: the positron glyphs endpoint serves
      // Noto Sans; MapLibre's default font stack would 404 there (B1 glyph
      // spike, docs/superpowers/notes/2026-07-28-b1-glyph-spike.md).
      'text-font': ['Noto Sans Bold'],
      'text-field': ['get', 'name'],
      'text-size': LABEL_TEXT_SIZE,
      // Lower sort key places first → giants win the collision pass
      // deterministically; microstates drop first in dense views.
      'symbol-sort-key': ['get', 'areaRank'],
      visibility: 'none',
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#0f172a',
      'text-halo-width': 1.5,
    },
  })
}
```

  (c) In `applyBasemapLayerVisibility` (lines 301–317), replace the loop body:

```ts
  const customPrefixes = ['country-', 'satellite-']
  for (const layer of style.layers) {
    if (customPrefixes.some((p) => layer.id.startsWith(p))) continue
    const visible = !opts.satellite && (layer.type !== 'symbol' || !opts.hideLabels)
```

with:

```ts
  const customPrefixes = ['country-', 'satellite-']
  for (const layer of style.layers) {
    // B1: the app-owned label layer gets an explicit rule BEFORE the
    // custom-prefix skip — visible iff satellite && !hideLabels. Labels ride
    // the satellite view only (basemap symbols cover vector mode), and
    // hideLabels gates them the same way so game answers never leak.
    if (layer.id === LAYER.countryLabels) {
      map.setLayoutProperty(
        layer.id,
        'visibility',
        opts.satellite && !opts.hideLabels ? 'visible' : 'none',
      )
      continue
    }
    if (customPrefixes.some((p) => layer.id.startsWith(p))) continue
    const visible = !opts.satellite && (layer.type !== 'symbol' || !opts.hideLabels)
```

Also extend the owner's doc comment (lines 294–300). Replace:

```ts
/** Single owner of BASEMAP layer visibility (the repo's #111 pattern —
 *  useSatelliteMode's satellite toggle and the in-game label hiding both go
 *  through this rule, so neither can clobber the other):
 *  custom layers (country-*, satellite-*) are never touched here; every
 *  other layer is visible iff !satellite, and symbol layers (all text —
 *  country/city/sea names leak game answers) additionally require
 *  !hideLabels (2026-07-10 batch-2 spec §1). */
```

with:

```ts
/** Single owner of BASEMAP layer visibility (the repo's #111 pattern —
 *  useSatelliteMode's satellite toggle and the in-game label hiding both go
 *  through this rule, so neither can clobber the other):
 *  custom layers (country-*, satellite-*) are never touched here — EXCEPT
 *  the app-owned country-labels layer, which gets an explicit rule (B1):
 *  visible iff satellite && !hideLabels. Every other layer is visible iff
 *  !satellite, and symbol layers (all text — country/city/sea names leak
 *  game answers) additionally require !hideLabels (2026-07-10 batch-2
 *  spec §1). */
```

- [ ] **Step 4: Wire the layer into `src/components/WorldMap.tsx`.** Replace the import block (lines 7–15):

```ts
import {
  addRasterSources,
  addCountrySource,
  addBaseCountryLayers,
  addHoverLayers,
  addSelectionLayers,
  addCompareLayers,
  applyWarmLighting,
} from '../lib/mapLayers'
```

with:

```ts
import {
  addRasterSources,
  addCountrySource,
  addBaseCountryLayers,
  addHoverLayers,
  addSelectionLayers,
  addCompareLayers,
  addCountryLabelLayer,
  applyWarmLighting,
} from '../lib/mapLayers'
import { COUNTRY_LABEL_COLLECTION } from '../lib/countryLabelFeatures'
```

and in `onLoad` (lines 52–61), replace:

```ts
    addSelectionLayers(map)
    addCompareLayers(map)
    applyWarmLighting(map)
```

with:

```ts
    addSelectionLayers(map)
    addCompareLayers(map)
    // Added LAST so labels render above every other app layer. Starts hidden;
    // useSatelliteMode's applyBasemapLayerVisibility pass owns its visibility.
    addCountryLabelLayer(map, COUNTRY_LABEL_COLLECTION)
    applyWarmLighting(map)
```

- [ ] **Step 5: Run green.** `npx vitest run src/lib/__tests__/mapLayers.test.ts` — expect all tests green (the pre-existing 3 truth-table tests, plus 6 new label-layer tests and 6 new truth-table rows/tests). Then `npx vitest run src/hooks/__tests__/useSatelliteMode.test.tsx` — expect green unchanged (its private fixture has no `country-labels` layer, so the explicit rule never fires there; verified before writing this plan). Then `npm run check` — green.

- [ ] **Step 6: Update the stale layer inventory in `docs/systems/map-rendering.md`** (same task per repo rules — a doc under `docs/systems/` inventories the layers this task changes). Two edits.

  (a) Line 18, replace the sentence ending:

```
In this mode the OpenFreeMap vector layers are hidden, country borders are tinted for contrast against the imagery, and the country-fill opacity is lowered so imagery shows through.
```

with:

```
In this mode the OpenFreeMap vector layers are hidden, country borders are tinted for contrast against the imagery, and the country-fill opacity is lowered so imagery shows through. App-owned country-name labels (`country-labels` symbol layer, `Noto Sans Bold` served by the positron style's existing glyphs endpoint — no shipped font assets) render in this mode only and are hidden during active play so game answers don't leak: `applyBasemapLayerVisibility`'s explicit rule is visible iff satellite && not playing.
```

  (b) Line 60, replace:

```
These are the three core layers. Hover (border + extrusion), the 4-layer selection and compare highlight stacks, and the satellite raster complete the picture — the full registry is `LAYER` in `src/lib/mapLayers.ts` (13 ids).
```

with:

```
These are the three core layers. Hover (border + extrusion), the 4-layer selection and compare highlight stacks, the satellite raster, and the satellite-only `country-labels` symbol layer (app-built name points from bundled `latlng` centroids — see Basemap above) complete the picture — the full registry is `LAYER` in `src/lib/mapLayers.ts` (14 ids).
```

- [ ] **Step 7: Commit.**

```
git add src/lib/mapLayers.ts src/components/WorldMap.tsx src/lib/__tests__/mapLayers.test.ts docs/systems/map-rendering.md
git commit -m "feat(map): app-owned country-labels symbol layer, satellite-only with game gating (B1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Seam-based e2e contract + label tuning pass

**Files:**
- Create: `e2e/country-labels.spec.ts`
- Modify: `playwright.config.ts` (chromium `testMatch`, insert after `'satellite-default.spec.ts',` line 82)
- Modify: `docs/systems/testing.md` (lines 134, 146; spec-list sample lines 125–134)
- Modify: `docs/testing/playwright-matrix.md` (spec-assignment row, line 38 — that file's own header requires it be updated in the same PR as any `testMatch` change)
- Possibly modify (tuning only): `src/lib/mapLayers.ts` (`LABEL_RANK_FILTER` / `LABEL_TEXT_SIZE` / `text-halo-width` constants) and `src/lib/__tests__/mapLayers.test.ts` in the same commit if values move
- Test: `e2e/country-labels.spec.ts`

**Interfaces:**
- Consumes: layer id `'country-labels'` (Task 2, `LAYER.countryLabels`); `__funworldmap_map` seam (registered in `src/hooks/useMapInstance.ts` under `VITE_TEST_HOOKS`; `map.getLayoutProperty(id: string, prop: string): string | undefined`); `__funworldmap_game.endGame(): void` seam (registered in `src/game/shared/GameSessionProvider.tsx`); helpers `gotoAndWaitForMap`, `ensureLauncherDismissed`, `waitForGameTestHook` from `e2e/helpers.ts`.

**CI status — explicit:** the new spec **runs on CI**. It is added to the chromium `testMatch` and deliberately NOT to the CI `testIgnore` list: it reads MapLibre's in-memory layout properties over `routeMapTiles`-stubbed tiles — no GPU rasterization, no rendered pixels — the same CI-stable class as `satellite-default.spec.ts`. CI runs the chromium project 4-way sharded; Playwright distributes new files across shards automatically, so no shard configuration exists to touch. Seam assertions only, never rendered-text pixels: the e2e tile stub serves **empty glyph PBFs** (`e2e/helpers.ts` lines 427–434), so label text never rasterises under test by design.

**Page weight — explicit:** no runbook or bundle-budget doc touch is needed. B1 ships zero assets — glyphs are fetched at runtime from the positron style's already-configured endpoint (one cached ~77 KB PBF covers all names), nothing lands in `public/` or `dist/assets/`, so the CI bundle budget and its documentation are unaffected (spec § Testing commitments confirms this disposition).

- [ ] **Step 1: Write the spec.** Create `e2e/country-labels.spec.ts` with exactly:

```ts
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
```

Non-vacuousness note: if the layer id ever disappears, `getLayoutProperty` returns `undefined`, `labelVisibility` returns `null`, and every poll times out loudly — the spec cannot pass vacuously.

- [ ] **Step 2: Register the spec in `playwright.config.ts`.** In the chromium `testMatch` array, replace:

```ts
        'satellite-default.spec.ts',
        'a11y-contrast.spec.ts',
```

with:

```ts
        'satellite-default.spec.ts',
        'country-labels.spec.ts',
        'a11y-contrast.spec.ts',
```

Do NOT add it to `testIgnore` — it must run on CI (rationale in the Interfaces section above).

- [ ] **Step 3: Run it and see it pass (3 passed).** Kill any stray dev server first — a background `npm run dev` would be reused by Playwright *without* `VITE_TEST_HOOKS` (project memory):

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'vite' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
npx playwright test e2e/country-labels.spec.ts --project=chromium --workers=2
```

Expect `3 passed`. (This spec verifies Task 2's already-landed behavior — it is a regression contract, not TDD; the failure mode is exercised by the non-vacuousness property above.) Then confirm the neighbors this feature touches are unaffected:

```powershell
npx playwright test e2e/satellite-default.spec.ts e2e/game-country-pinning.spec.ts --project=chromium --workers=2
```

Expect green — `game-country-pinning.spec.ts`'s basemap-label assertion already filters out `country-`-prefixed symbol layers (line 285: `!l.id.startsWith('country-')`), so the new layer cannot pollute it; it is CI-`testIgnore`d, so this local run is its only automated coverage before merge.

- [ ] **Step 4: Update the two test-inventory docs (spec count 38 → 39).**

  (a) `docs/systems/testing.md` line 134, replace:

```
  …                             # 38 specs total — see playwright.config.ts testMatch
```

with:

```
  country-labels.spec.ts        # B1 satellite country labels — seam visibility contract
  …                             # 39 specs total — see playwright.config.ts testMatch
```

  (b) `docs/systems/testing.md` line 146, replace:

```
Net effect: **13 of 38 spec files run locally only** — the ten `testIgnore`d
```

with:

```
Net effect: **13 of 39 spec files run locally only** — the ten `testIgnore`d
```

  (c) `docs/testing/playwright-matrix.md` line 38, replace:

```
| panel-and-deeplink, panel-focus\*, satellite-default, compare-source-attribution, source-tooltip-edge\*, source-tooltip-keyboard |    ✓     |                 |               |                       |
```

with:

```
| panel-and-deeplink, panel-focus\*, satellite-default, country-labels, compare-source-attribution, source-tooltip-edge\*, source-tooltip-keyboard |    ✓     |                 |               |                       |
```

- [ ] **Step 5: Tuning pass (budgeted half-day; the spike's two flagged unknowns are collision at ~190-label scale and halos over bright terrain).** Start a dev server WITH test hooks so the browser console has the `__funworldmap_map` seam for exact camera placement:

```powershell
$env:VITE_TEST_HOOKS = '1'; npm run dev
```

Open http://localhost:5173 (satellite is the default), dismiss the launcher if open, and work through this screenshot checklist (capture each screenshot for the PR thread; camera commands go in the browser devtools console):

  1. **z1.5 world:** `__funworldmap_map.jumpTo({ center: [0, 20], zoom: 1.5, pitch: 0 })` — only the top-40 area tier labels; Russia/Canada/China/USA/Brazil all present (giants must survive the collision pass — `symbol-sort-key` guarantees smaller ranks place first); no Caribbean/Pacific microstates.
  2. **z3 Europe (dense-region collision — the spike's untested scale):** `__funworldmap_map.jumpTo({ center: [10, 50], zoom: 3 })` — France, Germany, Spain, Poland legible; collisions may drop *smaller* countries (Benelux dropping is acceptable) but never a larger country in favor of a smaller neighbor.
  3. **z5 Europe (full admission):** `__funworldmap_map.jumpTo({ center: [7.4, 43.7], zoom: 5 })` — Monaco (areaRank 194) now admitted and labeled; Switzerland/Austria distinct.
  4. **Pacific / antimeridian:** `__funworldmap_map.jumpTo({ center: [178, -17], zoom: 3 })`, then zoom to 5 — Fiji's label sits on the 0..360-shifted Fiji polygon (Task 1's no-shift decision holds visually); New Zealand labeled at [174, -41]; no label orphaned off its polygon.
  5. **Pitch 60 over Nepal (terrain occlusion — spec-mandated):** `__funworldmap_map.jumpTo({ center: [84, 28], zoom: 5.5, pitch: 60 })` — satellite mode has terrain exaggeration 1.5; "Nepal" must not be swallowed by Himalaya relief and the halo must hold over snow.
  6. **Bright-terrain halo (Sahara):** `__funworldmap_map.jumpTo({ center: [13, 23], zoom: 4 })` — Niger/Chad/Libya labels legible on bright sand.

  **Adjustment bounds** (all knobs are the named constants in `src/lib/mapLayers.ts`; nothing else moves): `LABEL_RANK_FILTER` tier cutoffs (40/100/160 at z3/z4/z5) may shift by ±20 and stop zooms by ±1, but the top tier must be admitted from the base zoom and all 195 by z5; `LABEL_TEXT_SIZE` output stops stay within 8–20px; `text-halo-width` stays within 1–2.5px (the unit test range-asserts exactly this band, and the filter-shape test pins only `['step', ['zoom'], …, true]` — so in-bounds tuning does not churn tests; only an exact-value change outside those shapes requires a same-commit test update). After any constant change: `npx vitest run src/lib/__tests__/mapLayers.test.ts` and re-run the checklist item that motivated it. When done, stop the dev server (it must not linger — reused dev servers break later Playwright runs, per project memory).

- [ ] **Step 6: Final verification.** `npm run check` (lint covers `e2e/` — the new spec must satisfy eslint-plugin-playwright: no `waitForTimeout`, no `force: true`; it does). Then, with no dev server running: `npx playwright test e2e/country-labels.spec.ts --project=chromium --workers=2` — `3 passed`.

- [ ] **Step 7: Commit.**

```
git add e2e/country-labels.spec.ts playwright.config.ts docs/systems/testing.md docs/testing/playwright-matrix.md src/lib/mapLayers.ts src/lib/__tests__/mapLayers.test.ts
git commit -m "test(e2e): country-labels visibility contract + B1 label tuning pass

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(If the tuning pass changed no constants, `src/lib/mapLayers.ts` and its test file will be unmodified — `git add` of an unchanged file is a harmless no-op; the commit then contains only the spec, config, and docs.)

### Task 4: B2 — cased country borders on satellite (retire the batch-2 play emphasis)

**Files:**
- Modify: `src/lib/mapLayers.ts` (addBaseCountryLayers lines 58–75; new casing constants next to `borderLineColorForMode` ~line 200; `applyBorderPaintForMode` lines 214–228; `LAYER` registry lines 233–247; `applyCountryBaselinePaint` lines 253–282)
- Modify: `src/hooks/useCountryBaselinePaint.ts` (whole file, 41 lines — drop the `gameActive` wiring)
- Modify: `e2e/compare-view-dimming.spec.ts` (lines 40–41 and 110–112 — the satellite border-opacity restore anchor moves 0.6 → 0.9)
- Modify: `docs/systems/map-rendering.md` (line 18 satellite paragraph; lines 52–60 layer table + registry count)
- Test: `src/lib/__tests__/mapLayers.test.ts` (replace the `applyCountryBaselinePaint game emphasis` describe, lines 97–154)
- Test: `src/hooks/__tests__/useCountryBaselinePaint.test.tsx` (full rewrite — retire the gameActive mock and play-emphasis row)

**Interfaces:**
- Produces: `LAYER.bordersCasing = 'country-borders-casing'` (new entry in the `LAYER` registry in `src/lib/mapLayers.ts`); changed signatures `applyBorderPaintForMode(map, opts: { isDark: boolean; satellite: boolean })` and `applyCountryBaselinePaint(map, opts: { satellite: boolean; inCompareView: boolean; isDark: boolean })` — `gameActive` is REMOVED from both (spec B2: the cased baseline supersedes the play emphasis; play and rest render the same legible cased borders).
- Consumes: `createFakeMapRef` from `src/test/fakeMapRef.ts` (captures `setPaintProperty` calls and `addedLayers`); `makeFakeMap` / `makeMapWrapper` from `src/test/fakeMapHooks.tsx`; existing `borderLineColorForMode` (module-internal in `mapLayers.ts` — do not duplicate it).

Context for the executing engineer: today `country-borders` is a single hairline (`0.5px`) that batch 2 bolds to `1.6px @ 0.9` opacity while a game is `playing` on satellite (the `gameActive` branch in `applyBorderPaintForMode`). This task replaces that with a permanent cased pair on satellite: a dark casing layer (`country-borders-casing`, ~1.6px, `#0f172a` @ 0.85) rendered UNDER the existing light line (~0.9px @ 0.9 opacity), both zoom-interpolated. The `gameActive` branch and its truth-table test rows are retired. All paint goes through `applyCountryBaselinePaint` — the single owner. No new telemetry.

- [ ] **Step 1: Write the failing unit tests in `src/lib/__tests__/mapLayers.test.ts`.** First extend the import block at the top of the file. Current code (lines 2–10):

  ```ts
  import {
    addHoverLayers,
    addSelectionLayers,
    addCompareLayers,
    applyBasemapLayerVisibility,
    applyCountryBaselinePaint,
    EXTRUSION_MAX_ZOOM,
    extrusionHeightExpression,
  } from '../mapLayers'
  ```

  Replace with:

  ```ts
  import {
    addBaseCountryLayers,
    addHoverLayers,
    addSelectionLayers,
    addCompareLayers,
    applyBasemapLayerVisibility,
    applyCountryBaselinePaint,
    EXTRUSION_MAX_ZOOM,
    extrusionHeightExpression,
    LAYER,
  } from '../mapLayers'
  ```

  Then DELETE the entire `describe('applyCountryBaselinePaint game emphasis', ...)` block (lines 97–154 — it starts with `describe('applyCountryBaselinePaint game emphasis', () => {` and its four `it` blocks pin the retired 1.6px/0.9 play emphasis) and replace it with:

  ```ts
  describe('cased country borders (B2)', () => {
    const paintOf = (
      fake: ReturnType<typeof createFakeMapRef>,
      layer: string,
      prop: string,
    ): unknown =>
      fake.calls.setPaintProperty.mock.calls
        .filter((c) => c[0] === layer && c[1] === prop)
        .at(-1)?.[2]

    const CASING_WIDTH = ['interpolate', ['linear'], ['zoom'], 1, 1.2, 5, 1.6, 10, 2.6]
    const CASED_WIDTH = ['interpolate', ['linear'], ['zoom'], 1, 0.7, 5, 0.9, 10, 1.5]

    it('addBaseCountryLayers adds the casing directly under the light border line', () => {
      const fake = createFakeMapRef()
      addBaseCountryLayers(fake.map)
      const ids = fake.addedLayers.map((l) => l.id)
      expect(ids.indexOf(LAYER.bordersCasing)).toBeGreaterThanOrEqual(0)
      expect(ids.indexOf(LAYER.bordersCasing)).toBe(ids.indexOf(LAYER.borders) - 1)
    })

    it('satellite: light line at 0.9 opacity over a dark casing, both zoom-interpolated', () => {
      const fake = createFakeMapRef()
      applyCountryBaselinePaint(fake.map, { satellite: true, inCompareView: false, isDark: false })
      expect(paintOf(fake, LAYER.borders, 'line-width')).toEqual(CASED_WIDTH)
      expect(paintOf(fake, LAYER.borders, 'line-opacity')).toBe(0.9)
      expect(paintOf(fake, LAYER.bordersCasing, 'line-color')).toBe('#0f172a')
      expect(paintOf(fake, LAYER.bordersCasing, 'line-width')).toEqual(CASING_WIDTH)
      expect(paintOf(fake, LAYER.bordersCasing, 'line-opacity')).toBe(0.85)
    })

    it('vector: hairline baseline unchanged, casing hidden', () => {
      const fake = createFakeMapRef()
      applyCountryBaselinePaint(fake.map, { satellite: false, inCompareView: false, isDark: false })
      expect(paintOf(fake, LAYER.borders, 'line-width')).toBe(0.5)
      expect(paintOf(fake, LAYER.borders, 'line-opacity')).toBe(0.35)
      expect(paintOf(fake, LAYER.bordersCasing, 'line-opacity')).toBe(0)
    })

    it('compare view: flat dim hairline, casing hidden (even arriving from satellite)', () => {
      const fake = createFakeMapRef()
      applyCountryBaselinePaint(fake.map, { satellite: true, inCompareView: false, isDark: false })
      applyCountryBaselinePaint(fake.map, { satellite: true, inCompareView: true, isDark: false })
      expect(paintOf(fake, LAYER.borders, 'line-width')).toBe(0.5)
      expect(paintOf(fake, LAYER.borders, 'line-opacity')).toBe(0.15)
      expect(paintOf(fake, LAYER.bordersCasing, 'line-opacity')).toBe(0)
    })
  })
  ```

  Note: the calls deliberately omit `gameActive` — that property is being removed from the signature in Step 3. Vitest transpiles without type-checking, so the file still runs; do not "fix" the calls by adding `gameActive` back.

- [ ] **Step 2: Run the test and see it fail.**

  ```
  npx vitest run src/lib/__tests__/mapLayers.test.ts
  ```

  Expected: the 4 new `cased country borders (B2)` tests fail — `LAYER.bordersCasing` is `undefined` so the ordering test gets `indexOf` mismatches (`-1` vs `0`); the satellite test gets scalar `0.5` where it expects the width expression (the old code's `gameActive: undefined` falls into the idle branch); the vector and compare tests get `undefined` casing opacity instead of `0`. All pre-existing tests in the file stay green.

- [ ] **Step 3: Implement in `src/lib/mapLayers.ts`.** Four edits, all in the single paint owner — no component touches paint.

  **(3a)** In the `LAYER` registry (line 233), current code:

  ```ts
  export const LAYER = {
    fill: 'country-fill',
    borders: 'country-borders',
    hoverBorder: 'country-hover-border',
  ```

  Replace with:

  ```ts
  export const LAYER = {
    fill: 'country-fill',
    borders: 'country-borders',
    bordersCasing: 'country-borders-casing',
    hoverBorder: 'country-hover-border',
  ```

  (The `country-` prefix keeps the new layer inside `applyBasemapLayerVisibility`'s custom-layer skip — no change needed there.)

  **(3b)** Add the casing constants directly below the existing `borderLineColorForMode` function (which ends at line 202, just above `applyDefaultBorderPaint`):

  ```ts
  /** B2 cased satellite borders: a dark casing under the light line, both
   *  zoom-interpolated. Supersedes the batch-2 play emphasis (1.6px/0.9 via
   *  the retired gameActive branch) — those values were near-identical to
   *  this resting state, so play and rest now render the same cased pair. */
  const BORDER_CASING_COLOR = '#0f172a'
  const CASING_LINE_WIDTH: maplibregl.ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    1,
    1.2,
    5,
    1.6,
    10,
    2.6,
  ]
  const CASED_LINE_WIDTH: maplibregl.ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    1,
    0.7,
    5,
    0.9,
    10,
    1.5,
  ]
  ```

  **(3c)** In `addBaseCountryLayers` (line 58), the casing must be added BEFORE `country-borders` so the light line draws on top. Current code:

  ```ts
    map.addLayer({
      id: LAYER.borders,
      type: 'line',
      source: 'countries',
      paint: { 'line-color': '#334155', 'line-width': 0.5, 'line-opacity': 0.4 },
    })
  ```

  Replace with:

  ```ts
    // B2: dark casing rendered UNDER the light border line (added first, so
    // the light line draws on top). Paint is owned by applyCountryBaselinePaint;
    // opacity 0 keeps it invisible until the owner first runs.
    map.addLayer({
      id: LAYER.bordersCasing,
      type: 'line',
      source: 'countries',
      paint: {
        'line-color': BORDER_CASING_COLOR,
        'line-width': CASING_LINE_WIDTH,
        'line-opacity': 0,
      },
    })

    map.addLayer({
      id: LAYER.borders,
      type: 'line',
      source: 'countries',
      paint: { 'line-color': '#334155', 'line-width': 0.5, 'line-opacity': 0.4 },
    })
  ```

  **(3d)** Replace `applyBorderPaintForMode` in full (lines 210–228). Current code:

  ```ts
  /** Apply border paint for the current visual mode. Satellite mode uses a
   *  white-ish translucent border over imagery; vector mode uses the theme's
   *  default border color and opacity. Called from applyCountryBaselinePaint,
   *  the single owner of the country baseline paint. */
  export function applyBorderPaintForMode(
    map: maplibregl.Map,
    opts: { isDark: boolean; satellite: boolean; gameActive?: boolean },
  ): void {
    if (opts.satellite) {
      map.setPaintProperty(LAYER.borders, 'line-color', borderLineColorForMode(opts.isDark, true))
      // During play the hairline border is the only country signal on imagery —
      // bold it so the pinning game is playable (batch-2 spec §1).
      map.setPaintProperty(LAYER.borders, 'line-width', opts.gameActive ? 1.6 : 0.5)
      map.setPaintProperty(LAYER.borders, 'line-opacity', opts.gameActive ? 0.9 : 0.6)
    } else {
      applyDefaultBorderPaint(map, opts.isDark)
      map.setPaintProperty(LAYER.borders, 'line-width', 0.5)
    }
  }
  ```

  New code:

  ```ts
  /** Apply border paint for the current visual mode. Satellite mode renders a
   *  cased pair over imagery — dark casing under a light line (B2); vector
   *  mode keeps the theme hairline and hides the casing. Called from
   *  applyCountryBaselinePaint, the single owner of the country baseline
   *  paint. The batch-2 gameActive emphasis is retired: play and rest render
   *  the same legible cased borders. */
  export function applyBorderPaintForMode(
    map: maplibregl.Map,
    opts: { isDark: boolean; satellite: boolean },
  ): void {
    if (opts.satellite) {
      map.setPaintProperty(LAYER.borders, 'line-color', borderLineColorForMode(opts.isDark, true))
      map.setPaintProperty(LAYER.borders, 'line-width', CASED_LINE_WIDTH)
      map.setPaintProperty(LAYER.borders, 'line-opacity', 0.9)
      map.setPaintProperty(LAYER.bordersCasing, 'line-color', BORDER_CASING_COLOR)
      map.setPaintProperty(LAYER.bordersCasing, 'line-width', CASING_LINE_WIDTH)
      map.setPaintProperty(LAYER.bordersCasing, 'line-opacity', 0.85)
    } else {
      applyDefaultBorderPaint(map, opts.isDark)
      map.setPaintProperty(LAYER.borders, 'line-width', 0.5)
      map.setPaintProperty(LAYER.bordersCasing, 'line-opacity', 0)
    }
  }
  ```

  **(3e)** In `applyCountryBaselinePaint` (line 253): remove `gameActive` from the options type and the pass-through, and hide the casing in compare view. Current code:

  ```ts
  export function applyCountryBaselinePaint(
    map: maplibregl.Map,
    opts: { satellite: boolean; inCompareView: boolean; isDark: boolean; gameActive: boolean },
  ): void {
    if (opts.inCompareView) {
      // Compare view keeps the mode/theme border COLOUR but dims to a flat 0.15.
      // Set the colour directly rather than via applyBorderPaintForMode, so we
      // don't write the mode opacity (0.6 / 0.5 / 0.35) only to overwrite it.
      map.setPaintProperty(
        LAYER.borders,
        'line-color',
        borderLineColorForMode(opts.isDark, opts.satellite),
      )
      map.setPaintProperty(LAYER.borders, 'line-opacity', 0.15)
      // Width must be owned here too: a game's emphasized 1.6px otherwise
      // survives a browser-Back into a compare hash (final review 2026-07-11).
      map.setPaintProperty(LAYER.borders, 'line-width', 0.5)
      // Hover layers are suppressed in compare view (useCompareViewHighlight),
      // so a scalar dim is fine — matched to the mode's baseline (satellite base
      // is 0.03; the vector 0.05 would brighten over imagery).
      map.setPaintProperty(LAYER.fill, 'fill-opacity', opts.satellite ? 0.03 : 0.05)
    } else {
      applyBorderPaintForMode(map, {
        isDark: opts.isDark,
        satellite: opts.satellite,
        gameActive: opts.gameActive,
      })
      map.setPaintProperty(LAYER.fill, 'fill-opacity', fillOpacityForMode(opts.satellite))
    }
  }
  ```

  New code:

  ```ts
  export function applyCountryBaselinePaint(
    map: maplibregl.Map,
    opts: { satellite: boolean; inCompareView: boolean; isDark: boolean },
  ): void {
    if (opts.inCompareView) {
      // Compare view keeps the mode/theme border COLOUR but dims to a flat 0.15.
      // Set the colour directly rather than via applyBorderPaintForMode, so we
      // don't write the mode opacity (0.9 / 0.5 / 0.35) only to overwrite it.
      map.setPaintProperty(
        LAYER.borders,
        'line-color',
        borderLineColorForMode(opts.isDark, opts.satellite),
      )
      map.setPaintProperty(LAYER.borders, 'line-opacity', 0.15)
      // Width must be owned here too: satellite's cased width expression
      // otherwise survives a browser-Back into a compare hash (final review
      // 2026-07-11, re-confirmed for B2).
      map.setPaintProperty(LAYER.borders, 'line-width', 0.5)
      // The casing is a satellite-legibility device; compare dims to the flat
      // hairline, so hide it (paint-owned, mirrors the width reset above).
      map.setPaintProperty(LAYER.bordersCasing, 'line-opacity', 0)
      // Hover layers are suppressed in compare view (useCompareViewHighlight),
      // so a scalar dim is fine — matched to the mode's baseline (satellite base
      // is 0.03; the vector 0.05 would brighten over imagery).
      map.setPaintProperty(LAYER.fill, 'fill-opacity', opts.satellite ? 0.03 : 0.05)
    } else {
      applyBorderPaintForMode(map, { isDark: opts.isDark, satellite: opts.satellite })
      map.setPaintProperty(LAYER.fill, 'fill-opacity', fillOpacityForMode(opts.satellite))
    }
  }
  ```

- [ ] **Step 4: Run the mapLayers unit test and see it pass.**

  ```
  npx vitest run src/lib/__tests__/mapLayers.test.ts
  ```

  Expected: all tests green (the file also contains the extrusion and `applyBasemapLayerVisibility` suites — they must stay green; the visibility owner skips `country-*` ids, which covers the new layer with no change).

- [ ] **Step 5: Drop the `gameActive` wiring from `src/hooks/useCountryBaselinePaint.ts`.** The hook is the only caller of `applyCountryBaselinePaint` (verified: `src/components/WorldMap.tsx:72` calls the hook; nothing else imports the function outside tests). Replace the whole file. Current code:

  ```ts
  import { useEffect } from 'react'
  import { applyCountryBaselinePaint } from '../lib/mapLayers'
  import { useMap } from './useMap'
  import { useGameSessionContext } from '../game/shared/GameSessionProvider'

  interface Options {
    loaded: boolean
    satellite: boolean
    inCompareView: boolean
    resolvedTheme: 'light' | 'dark'
  }

  /** Single owner of the country-fill opacity + country-borders baseline paint.
   *  Replaces the pre-2026-06 pattern where useSatelliteMode and the compare
   *  hook each wrote these with call-order deciding the winner (#111 item 1). */
  export function useCountryBaselinePaint({
    loaded,
    satellite,
    inCompareView,
    resolvedTheme,
  }: Options): void {
    const { mapRef } = useMap()
    const { session } = useGameSessionContext()
    const gameActive = session.status === 'playing'

    useEffect(() => {
      const map = mapRef.current
      if (!map || !loaded) return
      try {
        applyCountryBaselinePaint(map, {
          satellite,
          inCompareView,
          isDark: resolvedTheme === 'dark',
          gameActive,
        })
      } catch {
        // Layers may not exist yet (e.g. fast toggle before load completes).
      }
    }, [loaded, satellite, inCompareView, resolvedTheme, gameActive, mapRef])
  }
  ```

  New code:

  ```ts
  import { useEffect } from 'react'
  import { applyCountryBaselinePaint } from '../lib/mapLayers'
  import { useMap } from './useMap'

  interface Options {
    loaded: boolean
    satellite: boolean
    inCompareView: boolean
    resolvedTheme: 'light' | 'dark'
  }

  /** Single owner of the country-fill opacity + country-borders(-casing)
   *  baseline paint. Replaces the pre-2026-06 pattern where useSatelliteMode
   *  and the compare hook each wrote these with call-order deciding the winner
   *  (#111 item 1). The batch-2 game-status dependency is retired with B2's
   *  cased baseline — paint no longer varies with the game session. */
  export function useCountryBaselinePaint({
    loaded,
    satellite,
    inCompareView,
    resolvedTheme,
  }: Options): void {
    const { mapRef } = useMap()

    useEffect(() => {
      const map = mapRef.current
      if (!map || !loaded) return
      try {
        applyCountryBaselinePaint(map, {
          satellite,
          inCompareView,
          isDark: resolvedTheme === 'dark',
        })
      } catch {
        // Layers may not exist yet (e.g. fast toggle before load completes).
      }
    }, [loaded, satellite, inCompareView, resolvedTheme, mapRef])
  }
  ```

- [ ] **Step 6: Rewrite `src/hooks/__tests__/useCountryBaselinePaint.test.tsx`.** The old file mocks `useGameSessionContext` (the hook no longer imports it — the mock would be dead code, which project memory forbids), pins the retired satellite idle opacity `0.6`, and carries the retired "satellite + playing bolds the border" test. Replace the whole file with:

  ```tsx
  import { describe, expect, it } from 'vitest'
  import { renderHook } from '@testing-library/react'
  import { useCountryBaselinePaint } from '../useCountryBaselinePaint'
  import { makeFakeMap, makeMapWrapper } from '../../test/fakeMapHooks'

  function paintValue(fake: ReturnType<typeof makeFakeMap>, layer: string, prop: string) {
    // Last write wins — mirror MapLibre semantics.
    const calls = fake.calls.setPaintProperty.filter((c) => c[0] === layer && c[1] === prop)
    return calls.at(-1)?.[2]
  }

  const SAT_EXPR = ['case', ['boolean', ['feature-state', 'hover'], false], 0.32, 0.03]
  const VEC_EXPR = ['case', ['boolean', ['feature-state', 'hover'], false], 0.28, 0.05]

  describe('useCountryBaselinePaint', () => {
    // Full {satellite × compare} matrix — pins B2's cased-border baseline.
    // The batch-2 gameActive emphasis is retired: play and rest render the
    // same cased borders, so game status no longer appears in this table.
    const cases = [
      {
        satellite: true,
        inCompareView: false,
        fill: SAT_EXPR,
        borderOpacity: 0.9,
        borderColor: 'rgba(255,255,255,0.35)',
        casingOpacity: 0.85,
      },
      {
        satellite: false,
        inCompareView: false,
        fill: VEC_EXPR,
        borderOpacity: 0.35,
        borderColor: '#94a3b8',
        casingOpacity: 0,
      },
      {
        satellite: true,
        inCompareView: true,
        fill: 0.03,
        borderOpacity: 0.15,
        borderColor: 'rgba(255,255,255,0.35)',
        casingOpacity: 0,
      },
      {
        satellite: false,
        inCompareView: true,
        fill: 0.05,
        borderOpacity: 0.15,
        borderColor: '#94a3b8',
        casingOpacity: 0,
      },
    ] as const

    for (const c of cases) {
      it(`satellite=${c.satellite} compare=${c.inCompareView} → fill/border/casing baseline`, () => {
        const fake = makeFakeMap()
        renderHook(
          () =>
            useCountryBaselinePaint({
              loaded: true,
              satellite: c.satellite,
              inCompareView: c.inCompareView,
              resolvedTheme: 'light',
            }),
          { wrapper: makeMapWrapper(fake) },
        )
        expect(paintValue(fake, 'country-fill', 'fill-opacity')).toEqual(c.fill)
        expect(paintValue(fake, 'country-borders', 'line-opacity')).toBe(c.borderOpacity)
        expect(paintValue(fake, 'country-borders', 'line-color')).toBe(c.borderColor)
        expect(paintValue(fake, 'country-borders-casing', 'line-opacity')).toBe(c.casingOpacity)
      })
    }

    it('dark vector mode uses the dark border baseline', () => {
      const fake = makeFakeMap()
      renderHook(
        () =>
          useCountryBaselinePaint({
            loaded: true,
            satellite: false,
            inCompareView: false,
            resolvedTheme: 'dark',
          }),
        { wrapper: makeMapWrapper(fake) },
      )
      expect(paintValue(fake, 'country-borders', 'line-color')).toBe('#1e293b')
      expect(paintValue(fake, 'country-borders', 'line-opacity')).toBe(0.5)
    })

    it('does nothing before loaded', () => {
      const fake = makeFakeMap()
      renderHook(
        () =>
          useCountryBaselinePaint({
            loaded: false,
            satellite: true,
            inCompareView: false,
            resolvedTheme: 'light',
          }),
        { wrapper: makeMapWrapper(fake) },
      )
      expect(fake.setPaintProperty).not.toHaveBeenCalled()
    })
  })
  ```

- [ ] **Step 7: Run both unit suites and the repo check green.**

  ```
  npx vitest run src/lib/__tests__/mapLayers.test.ts src/hooks/__tests__/useCountryBaselinePaint.test.tsx
  npm run check
  ```

  Expected: both suites green; `npm run check` green (the typecheck confirms no remaining caller passes `gameActive` — if it flags one, that caller was missed and must be updated, not the signature reverted).

- [ ] **Step 8: Re-anchor `e2e/compare-view-dimming.spec.ts`.** This spec polls `country-borders` `line-opacity` through the map test seam and pins the OLD satellite idle value `0.6`, which this task changes to `0.9` (the compare value `0.15` is unchanged). Two edits. Current code (lines 39–41):

  ```ts
      // Poll until dimming releases back to the satellite-default value (0.6).
      await expect.poll(() => getBorderOpacity(page), { timeout: 15_000 }).toBeCloseTo(0.6, 2)
  ```

  New code:

  ```ts
      // Poll until dimming releases back to the satellite-default value
      // (0.9 — B2's cased light line).
      await expect.poll(() => getBorderOpacity(page), { timeout: 15_000 }).toBeCloseTo(0.9, 2)
  ```

  Current code (lines 111–112):

  ```ts
        // Wait for compare mode to release (border opacity restores).
        await expect.poll(() => getBorderOpacity(page), { timeout: 15_000 }).toBeCloseTo(0.6, 2)
  ```

  New code:

  ```ts
        // Wait for compare mode to release (border opacity restores to 0.9).
        await expect.poll(() => getBorderOpacity(page), { timeout: 15_000 }).toBeCloseTo(0.9, 2)
  ```

  No other e2e spec anchors on border paint: `e2e/map-and-countries.spec.ts:24` only asserts `country-borders` exists (still true), and no game spec asserts border width/opacity during play (verified by grep over `e2e/` for `line-width`, `line-opacity`, `country-borders`) — so no game-spec re-anchoring is needed.

- [ ] **Step 9: Run the re-anchored e2e spec.** First kill any stray dev server (project memory: a reused `npm run dev` lacks `VITE_TEST_HOOKS`), then:

  ```
  npx playwright test e2e/compare-view-dimming.spec.ts --project=chromium --workers=2
  ```

  Expected: all 5 tests green.

- [ ] **Step 10: Update `docs/systems/map-rendering.md`** (stale layer inventory — same commit per repo rules). Three edits. Current text (line 18, inside the Satellite bullet):

  ```
  In this mode the OpenFreeMap vector layers are hidden, country borders are tinted for contrast against the imagery, and the country-fill opacity is lowered so imagery shows through.
  ```

  New text:

  ```
  In this mode the OpenFreeMap vector layers are hidden, country borders render as a cased pair — a dark `country-borders-casing` line under the light `country-borders` line — for contrast against the imagery, and the country-fill opacity is lowered so imagery shows through.
  ```

  Current text (lines 52–60, the Map Layers table and its trailing sentence):

  ```
  Three visual layers render on top of the basemap:

  | Layer              | Purpose                        | Style                                                                          |
  | ------------------ | ------------------------------ | ------------------------------------------------------------------------------ |
  | `country-fill`     | Clickable area, hover feedback | Semi-transparent fill. Opacity increases on hover via `feature-state`.         |
  | `country-borders`  | Political boundary lines       | Thin gray/white lines.                                                         |
  | `country-selected` | Selected country highlight     | Thicker border + stronger fill. Filtered to show only the selected country ID. |

  These are the three core layers. Hover (border + extrusion), the 4-layer selection and compare highlight stacks, and the satellite raster complete the picture — the full registry is `LAYER` in `src/lib/mapLayers.ts` (13 ids).
  ```

  New text:

  ```
  Four visual layers render on top of the basemap:

  | Layer                    | Purpose                        | Style                                                                            |
  | ------------------------ | ------------------------------ | -------------------------------------------------------------------------------- |
  | `country-fill`           | Clickable area, hover feedback | Semi-transparent fill. Opacity increases on hover via `feature-state`.           |
  | `country-borders-casing` | Satellite border legibility    | Dark casing rendered under `country-borders`; hidden in vector and compare view. |
  | `country-borders`        | Political boundary lines       | Cased light line on satellite; thin gray hairline on the vector basemap.         |
  | `country-selected`       | Selected country highlight     | Thicker border + stronger fill. Filtered to show only the selected country ID.   |

  These are the four core layers. Hover (border + extrusion), the 4-layer selection and compare highlight stacks, and the satellite raster complete the picture — the full registry is `LAYER` in `src/lib/mapLayers.ts` (14 ids).
  ```

- [ ] **Step 11: Live sanity pass, then commit.** Run `npm run dev`, load the app (satellite default), and confirm: cased borders legible over imagery at z2 and z5; start a Country Pinning game and confirm borders look identical during play; open `#FRA,DEU` and confirm borders dim flat with no dark casing remaining. Kill the dev server (project memory: it conflicts with later Playwright runs). Then:

  ```
  git add src/lib/mapLayers.ts src/hooks/useCountryBaselinePaint.ts src/lib/__tests__/mapLayers.test.ts src/hooks/__tests__/useCountryBaselinePaint.test.tsx e2e/compare-view-dimming.spec.ts docs/systems/map-rendering.md
  git commit -m "feat(map): cased country borders on satellite, retiring the play-emphasis branch (B2)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

### Task 5: B4 — selection as spotlight: `country-dim` scrim, quiet selection fill, tight glow (one commit)

**Context you need (no other task provides it):** Today selecting France covers it with a coral fill at 0.32 opacity — the requested country becomes the *least* legible thing on screen. B4 inverts this: a new `country-dim` fill layer darkens everything *except* the selection (and, in compare mode, both compared countries) at 0.25 opacity, the selection fill drops to 0.10, and the selection border glow tightens from 10px/blur 5 to 4px/blur 2. The border color stays coral — the E4 ice re-skin is a later tranche; the spotlight mechanism is color-agnostic.

Three invariants you must preserve (all verified against current source):

1. **Hit-testing stays layer-scoped.** Every `queryRenderedFeatures` caller in app code (`src/hooks/useMapInteractions.ts:221` — `{ layers: [LAYER.fill] }`) and e2e code (`e2e/helpers.ts:192`, `e2e/compare-map-clicks.spec.ts:44`, `e2e/map-and-countries.spec.ts` — all `{ layers: ['country-fill'] }`) is scoped to `country-fill`. The new fill layer therefore CANNOT pollute click handling or ocean-click preconditions — and must never be added to any interaction registration or `queryRenderedFeatures` layer list.
2. **Games never show the scrim — structurally, not via gating code.** `src/App.tsx` (lines 220–227) deselects on the first round of every game (`if (selected) deselect()` when `session.status === 'playing' && session.roundIndex === 0`), and `src/game/hooks/useRevealMapEffects.ts` touches only `LAYER.hoverBorder` plus its own reveal marker/line sources — it never reads or writes the selection stack or the dim layer. So when the dim filter is derived *solely* from `selected`/`compareWith`, it is `EMPTY_FILTER` (matches nothing) for the entire game session. Do NOT add a `gameActive` prop anywhere; the structural guarantee plus the unit test below is the contract.
3. **The `country-` id prefix is load-bearing.** `applyBasemapLayerVisibility` (`src/lib/mapLayers.ts:301-317`) skips all layers whose id starts with `country-` or `satellite-`. The new layer id `country-dim` keeps it out of the basemap visibility owner's reach — do not name it anything else.

Single-owner rules: the layer definition and the filter-expression builder live in `src/lib/mapLayers.ts` (the layer owner); the filter is *applied* only from `src/hooks/useSelectionHighlight.ts` (which already receives both `selected` and `compareWith` — it is the only hook that has both, which is why the dim filter lives there and NOT in `useCompareViewHighlight`, which owns compare *colors* only and needs no change in this task). The dim color constant goes in `src/lib/mapPalette.ts` (the palette owner — TEAL/CORAL already live there).

**Files:**

- Modify: `src/lib/mapPalette.ts` (append after line 6 — add `SPOTLIGHT_DIM`)
- Modify: `src/lib/mapLayers.ts` (line 8 import; lines 110–125 highlight-stack paint values; append two functions after line 156; add `dim` to `LAYER` registry lines 233–247)
- Modify: `src/components/WorldMap.tsx` (import block lines 7–15; `onLoad` lines 52–61)
- Modify: `src/hooks/useSelectionHighlight.ts` (line 6 import; new effect before line 70's closing brace)
- Modify: `docs/systems/map-rendering.md` (§ Map Layers, lines 50–60)
- Test: `src/lib/__tests__/mapLayers.test.ts` (import block lines 1–11; append two describes)
- Test: `src/hooks/__tests__/useSelectionHighlight.test.tsx` (append three tests inside the existing describe)
- Test: `e2e/compare-view-dimming.spec.ts` (append helpers + one describe; already in the chromium `testMatch` and NOT CI-ignored, so these assertions are CI-covered)

**Interfaces:**

- Consumes: `LAYER`, `EMPTY_FILTER`, `addHighlightStack` (all `src/lib/mapLayers.ts`); `CountryData.ccn3` (`src/lib/types.ts`); `makeFakeMap`/`makeMapWrapper` (`src/test/fakeMapHooks.tsx`); `createFakeMapRef` (`src/test/fakeMapRef.ts`); `makeCountryData` (`src/test/countryFixtures.ts`); the `window.__funworldmap_map` e2e seam (`getFilter(id)`, `getPaintProperty(id, prop)` — the real MapLibre map, exposed under `VITE_TEST_HOOKS`).
- Produces: `SPOTLIGHT_DIM = '#020617'` (`src/lib/mapPalette.ts`); `addSpotlightDimLayer(map: maplibregl.Map): void`, `spotlightDimFilter(selectedCcn3: string | null, compareCcn3: string | null): maplibregl.FilterSpecification`, `LAYER.dim = 'country-dim'` (all `src/lib/mapLayers.ts`).

- [ ] **Step 1: Write the failing unit tests for the layer owner (`mapLayers.test.ts`).**

  In `src/lib/__tests__/mapLayers.test.ts`, replace the import block (lines 1–11):

  ```ts
  import { describe, expect, it, vi } from 'vitest'
  import {
    addHoverLayers,
    addSelectionLayers,
    addCompareLayers,
    applyBasemapLayerVisibility,
    applyCountryBaselinePaint,
    EXTRUSION_MAX_ZOOM,
    extrusionHeightExpression,
  } from '../mapLayers'
  import { createFakeMapRef } from '../../test/fakeMapRef'
  ```

  with:

  ```ts
  import { describe, expect, it, vi } from 'vitest'
  import {
    addHoverLayers,
    addSelectionLayers,
    addCompareLayers,
    addSpotlightDimLayer,
    applyBasemapLayerVisibility,
    applyCountryBaselinePaint,
    spotlightDimFilter,
    EXTRUSION_MAX_ZOOM,
    extrusionHeightExpression,
  } from '../mapLayers'
  import { SPOTLIGHT_DIM } from '../mapPalette'
  import { createFakeMapRef } from '../../test/fakeMapRef'
  ```

  Then append at the end of the file:

  ```ts
  describe('B4 spotlight dim layer', () => {
    it('adds country-dim as a fill scrim that starts matching nothing', () => {
      const fake = createFakeMapRef()
      addSpotlightDimLayer(fake.map)
      expect(fake.addedLayers).toHaveLength(1)
      expect(fake.addedLayers[0]).toMatchObject({
        id: 'country-dim',
        type: 'fill',
        source: 'countries',
        paint: { 'fill-color': SPOTLIGHT_DIM, 'fill-opacity': 0.25 },
        filter: ['==', ['get', 'id'], ''],
      })
    })

    it('no selection matches nothing — games never show the scrim (game start deselects)', () => {
      expect(spotlightDimFilter(null, null)).toEqual(['==', ['get', 'id'], ''])
    })

    it('selection dims everything except the selected country', () => {
      expect(spotlightDimFilter('250', null)).toEqual(['!=', ['get', 'id'], '250'])
    })

    it('compare dims everything except BOTH countries', () => {
      expect(spotlightDimFilter('250', '276')).toEqual([
        'all',
        ['!=', ['get', 'id'], '250'],
        ['!=', ['get', 'id'], '276'],
      ])
    })
  })

  describe('B4 spotlight highlight-stack quieting', () => {
    it.each([
      ['selection', addSelectionLayers, 'country-selected', 'country-selected-glow'],
      ['compare', addCompareLayers, 'country-compare-fill', 'country-compare-glow'],
    ] as const)('%s fill drops to 0.10 and the glow tightens to 4px/blur 2', (_n, add, fillId, glowId) => {
      const fake = createFakeMapRef()
      add(fake.map)
      const fill = fake.addedLayers.find((s) => s.id === fillId)
      expect(fill).toMatchObject({ paint: { 'fill-opacity': 0.1 } })
      const glow = fake.addedLayers.find((s) => s.id === glowId)
      expect(glow).toMatchObject({ paint: { 'line-width': 4, 'line-blur': 2, 'line-opacity': 0.3 } })
    })
  })
  ```

- [ ] **Step 2: Write the failing unit tests for the filter applier (`useSelectionHighlight.test.tsx`).**

  In `src/hooks/__tests__/useSelectionHighlight.test.tsx`, append these three tests INSIDE the existing `describe('useSelectionHighlight', ...)` block (after the last test, the `replacing B reframes the pair...` test ending at line 174 — insert before the describe's closing `})`):

  ```ts
    it('B4: selection sets the country-dim filter to everything-except-selection', () => {
      const fake = makeFakeMap()
      renderHook(
        () =>
          useSelectionHighlight({
            loaded: true,
            selected: makeCountry('250'),
            selectionOriginRef: originRef(),
            compareWith: null,
          }),
        { wrapper: makeMapWrapper(fake) },
      )
      const call = fake.calls.setFilter.find((c) => c[0] === 'country-dim')
      expect(call?.[1]).toEqual(['!=', ['get', 'id'], '250'])
    })

    it('B4: compare excludes BOTH countries from the country-dim filter', () => {
      const fake = makeFakeMap()
      renderHook(
        () =>
          useSelectionHighlight({
            loaded: true,
            selected: makeCountry('250'),
            selectionOriginRef: originRef(),
            compareWith: makeCountryData({ cca3: 'DEU', ccn3: '276', latlng: [51, 9] }),
          }),
        { wrapper: makeMapWrapper(fake) },
      )
      const call = fake.calls.setFilter.filter((c) => c[0] === 'country-dim').at(-1)
      expect(call?.[1]).toEqual([
        'all',
        ['!=', ['get', 'id'], '250'],
        ['!=', ['get', 'id'], '276'],
      ])
    })

    it('B4: no selection leaves country-dim matching nothing (games stay scrim-free)', () => {
      const fake = makeFakeMap()
      renderHook(
        () =>
          useSelectionHighlight({
            loaded: true,
            selected: null,
            selectionOriginRef: originRef(),
            compareWith: null,
          }),
        { wrapper: makeMapWrapper(fake) },
      )
      const call = fake.calls.setFilter.find((c) => c[0] === 'country-dim')
      expect(call?.[1]).toEqual(['==', ['get', 'id'], ''])
    })
  ```

  (`makeCountryData` is already imported at line 9 of this file; no new imports needed.)

- [ ] **Step 3: Run both unit files and see them fail.**

  ```
  npx vitest run src/lib/__tests__/mapLayers.test.ts src/hooks/__tests__/useSelectionHighlight.test.tsx
  ```

  Expected failures: `mapLayers.test.ts` fails at module load — `SyntaxError: The requested module '../mapLayers' does not provide an export named 'addSpotlightDimLayer'` (and `SPOTLIGHT_DIM` missing from `../mapPalette`), which fails every test in that file. The three new `useSelectionHighlight` tests fail with `expect(received).toEqual(expected)` — received `undefined` (no `setFilter('country-dim', ...)` call exists yet). The pre-existing tests in `useSelectionHighlight.test.tsx` stay green.

- [ ] **Step 4: Implement the palette constant and the layer owner (`mapPalette.ts` + `mapLayers.ts`).**

  **`src/lib/mapPalette.ts`** — append after the current line 6 (`export const CORAL_LIGHT = '#fb7185'`):

  ```ts

  /** B4 spotlight scrim — the `country-dim` fill laid over every country
   *  EXCEPT the selection (and both compare countries). Near-black slate
   *  (tailwind slate-950) so "lights down" reads the same over satellite
   *  imagery and the vector map, in both themes. */
  export const SPOTLIGHT_DIM = '#020617'
  ```

  **`src/lib/mapLayers.ts`** — four edits:

  (a) Replace the import at line 8:

  ```ts
  import { TEAL, TEAL_DIM, CORAL } from './mapPalette'
  ```

  with:

  ```ts
  import { TEAL, TEAL_DIM, CORAL, SPOTLIGHT_DIM } from './mapPalette'
  ```

  (b) In `addHighlightStack` (lines 110–125), replace:

  ```ts
    map.addLayer({
      id: `${prefix}-glow`,
      type: 'line',
      source: 'countries',
      paint: { 'line-color': color, 'line-width': 10, 'line-blur': 5, 'line-opacity': 0.3 },
      filter: EMPTY_FILTER,
    })
    // Compare's fill keeps the '-fill' suffix to preserve historic ids.
    const fillId = prefix === 'country-compare' ? `${prefix}-fill` : prefix
    map.addLayer({
      id: fillId,
      type: 'fill',
      source: 'countries',
      paint: { 'fill-color': color, 'fill-opacity': 0.32 },
      filter: EMPTY_FILTER,
    })
  ```

  with:

  ```ts
    map.addLayer({
      id: `${prefix}-glow`,
      type: 'line',
      source: 'countries',
      // B4 spotlight: tight glow (was 10px / blur 5) — the country-dim scrim
      // now carries the emphasis; the glow only crisps the outline.
      paint: { 'line-color': color, 'line-width': 4, 'line-blur': 2, 'line-opacity': 0.3 },
      filter: EMPTY_FILTER,
    })
    // Compare's fill keeps the '-fill' suffix to preserve historic ids.
    const fillId = prefix === 'country-compare' ? `${prefix}-fill` : prefix
    map.addLayer({
      id: fillId,
      type: 'fill',
      source: 'countries',
      // B4 spotlight: faint fill (was 0.32) — the selected country must be the
      // MOST legible thing on screen, so the sticker fill nearly disappears.
      paint: { 'fill-color': color, 'fill-opacity': 0.1 },
      filter: EMPTY_FILTER,
    })
  ```

  (c) After `addCompareLayers` (lines 153–156):

  ```ts
  /** Add the compare (teal-dim) highlight stack. */
  export function addCompareLayers(map: maplibregl.Map): void {
    addHighlightStack(map, 'country-compare', TEAL_DIM)
  }
  ```

  append (keeping `addCompareLayers` unchanged above it):

  ```ts

  /** Add the B4 spotlight scrim: a dark fill over every country EXCEPT the
   *  current selection (and both compare countries). WorldMap's onLoad adds it
   *  between the base layers and the hover/highlight stacks, so highlights
   *  render above the scrim (layers stack in add order). Starts matching
   *  nothing; useSelectionHighlight is the single owner of the filter (via
   *  spotlightDimFilter). Never hit-tested: every queryRenderedFeatures caller
   *  in app and e2e code is scoped to LAYER.fill — keep it that way. */
  export function addSpotlightDimLayer(map: maplibregl.Map): void {
    map.addLayer({
      id: LAYER.dim,
      type: 'fill',
      source: 'countries',
      paint: { 'fill-color': SPOTLIGHT_DIM, 'fill-opacity': 0.25 },
      filter: EMPTY_FILTER,
    })
  }

  /** The `country-dim` filter for the current selection state (single owner of
   *  the expression shape; useSelectionHighlight applies it):
   *  - no selection: EMPTY_FILTER — the scrim matches nothing. This is also the
   *    game guarantee: game start deselects (App.tsx, round 0), and the reveal
   *    path (useRevealMapEffects) never touches selection state, so the scrim
   *    stays off for the whole session without any gameActive gating.
   *  - selection: everything except the selected country;
   *  - compare: everything except BOTH countries. */
  export function spotlightDimFilter(
    selectedCcn3: string | null,
    compareCcn3: string | null,
  ): maplibregl.FilterSpecification {
    if (!selectedCcn3) return EMPTY_FILTER
    const notSelected: maplibregl.ExpressionSpecification = ['!=', ['get', 'id'], selectedCcn3]
    if (!compareCcn3) return notSelected
    return ['all', notSelected, ['!=', ['get', 'id'], compareCcn3]]
  }
  ```

  (Verified against the bundled maplibre-gl type declarations: `FilterSpecification = ExpressionFilterSpecification | LegacyFilterSpecification`, where `['!=', ExpressionSpecification, ExpressionInputType]` and `['all', ...(boolean | ExpressionSpecification)[]]` are valid `ExpressionSpecification` branches — the annotation on `notSelected` makes the `'all'` return type-check without casts.)

  (d) In the `LAYER` registry (line 233), replace:

  ```ts
  export const LAYER = {
    fill: 'country-fill',
    borders: 'country-borders',
  ```

  with:

  ```ts
  export const LAYER = {
    fill: 'country-fill',
    borders: 'country-borders',
    dim: 'country-dim',
  ```

  (The `country-` prefix keeps the layer inside `applyBasemapLayerVisibility`'s custom-layer skip — required, see invariant 3.)

- [ ] **Step 5: Wire the layer into the map and the filter into the hook (`WorldMap.tsx` + `useSelectionHighlight.ts`).**

  **`src/components/WorldMap.tsx`** — replace the import block (lines 7–15):

  ```ts
  import {
    addRasterSources,
    addCountrySource,
    addBaseCountryLayers,
    addHoverLayers,
    addSelectionLayers,
    addCompareLayers,
    applyWarmLighting,
  } from '../lib/mapLayers'
  ```

  with:

  ```ts
  import {
    addRasterSources,
    addCountrySource,
    addBaseCountryLayers,
    addSpotlightDimLayer,
    addHoverLayers,
    addSelectionLayers,
    addCompareLayers,
    applyWarmLighting,
  } from '../lib/mapLayers'
  ```

  and in `onLoad`, replace:

  ```ts
      addBaseCountryLayers(map)
      addHoverLayers(map)
  ```

  with:

  ```ts
      addBaseCountryLayers(map)
      // B4 spotlight scrim: above base fill/borders, below the hover +
      // selection/compare stacks (layers render in add order).
      addSpotlightDimLayer(map)
      addHoverLayers(map)
  ```

  **`src/hooks/useSelectionHighlight.ts`** — replace the import at line 6:

  ```ts
  import { EMPTY_FILTER as EMPTY, LAYER } from '../lib/mapLayers'
  ```

  with:

  ```ts
  import { EMPTY_FILTER as EMPTY, LAYER, spotlightDimFilter } from '../lib/mapLayers'
  ```

  and replace the second effect plus the closing brace (lines 62–71):

  ```ts
    useEffect(() => {
      const map = mapRef.current
      if (!map || !loaded) return
      applyOrClearFilter(map, COMPARE_LAYERS, compareWith?.ccn3 ?? null)
      // Fly to frame BOTH countries; clearing compare never moves the camera
      // (preserve-the-user's-view philosophy, batch-2 spec §3).
      if (compareWith && selected) flyToComparePair(map, selected, compareWith)
    }, [compareWith, selected, loaded, mapRef])
  }
  ```

  with:

  ```ts
    useEffect(() => {
      const map = mapRef.current
      if (!map || !loaded) return
      applyOrClearFilter(map, COMPARE_LAYERS, compareWith?.ccn3 ?? null)
      // Fly to frame BOTH countries; clearing compare never moves the camera
      // (preserve-the-user's-view philosophy, batch-2 spec §3).
      if (compareWith && selected) flyToComparePair(map, selected, compareWith)
    }, [compareWith, selected, loaded, mapRef])

    // B4 spotlight: dim every country EXCEPT the selection (and the compare
    // partner). Single owner of the country-dim filter — derived solely from
    // selection state, so games never show the scrim (game start deselects,
    // App.tsx round-0 effect; the reveal path never touches selection).
    useEffect(() => {
      const map = mapRef.current
      if (!map || !loaded) return
      map.setFilter(LAYER.dim, spotlightDimFilter(selected?.ccn3 ?? null, compareWith?.ccn3 ?? null))
    }, [selected, compareWith, loaded, mapRef])
  }
  ```

- [ ] **Step 6: Run the unit tests green.**

  ```
  npx vitest run src/lib/__tests__/mapLayers.test.ts src/hooks/__tests__/useSelectionHighlight.test.tsx
  ```

  Expected: all tests pass, including every pre-existing test in both files (the pre-existing tests pin filter shapes and extrusion values that this change does not touch; none pins the old 0.32 fill or 10px glow).

- [ ] **Step 7: Add the e2e seam assertions to `e2e/compare-view-dimming.spec.ts`.**

  Append at the end of the file (after the `compare picking mode cancel (A7)` describe). France's ccn3 is `'250'`, Germany's `'276'` (same constants `e2e/compare-map-clicks.spec.ts` uses). All assertions read MapLibre's in-memory style through the `__funworldmap_map` seam — never rendered pixels (the tile stub serves empty glyph PBFs, and map paint is invisible to `Element.getAnimations`; this is the seam-based contract from the testing commitments):

  ```ts
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
        .toBe(
          JSON.stringify(['all', ['!=', ['get', 'id'], FRA_ID], ['!=', ['get', 'id'], DEU_ID]]),
        )

      // Exit compare — the scrim collapses back to selection-only.
      await page.evaluate(() => {
        window.location.hash = '#FRA'
      })
      await expect
        .poll(() => getDimFilterJson(page), { timeout: 15_000 })
        .toBe(JSON.stringify(['!=', ['get', 'id'], FRA_ID]))
    })
  })
  ```

  (`Page` and `waitForMapLoaded` are already imported at the top of this spec. No new spec file → no `playwright.config.ts` change.)

- [ ] **Step 8: Run the touched e2e specs (kill stray dev servers first — a reused `npm run dev` lacks `VITE_TEST_HOOKS`, project memory).**

  ```
  Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -Confirm:$false
  npx playwright test e2e/compare-view-dimming.spec.ts e2e/compare-map-clicks.spec.ts --project=chromium --workers=2
  ```

  Expected: all green. `compare-view-dimming.spec.ts` includes the two new B4 tests plus the pre-existing dimming/colour tests (which assert border opacity and fill *colours* only — untouched by this change). `compare-map-clicks.spec.ts` is run to prove the new fill layer does not join hit-testing: its grid-scan `queryRenderedFeatures([x, y], { layers: ['country-fill'] })` preconditions and synthetic clicks must behave exactly as before. If any compare-map-clicks test fails, the bug is in your change (an unscoped query or an interaction registration on the new layer) — do not touch that spec.

- [ ] **Step 9: Update the layer inventory in `docs/systems/map-rendering.md` (same-commit doc rule).**

  Replace (lines 50–60):

  ```markdown
  ### Map Layers

  Three visual layers render on top of the basemap:

  | Layer              | Purpose                        | Style                                                                          |
  | ------------------ | ------------------------------ | ------------------------------------------------------------------------------ |
  | `country-fill`     | Clickable area, hover feedback | Semi-transparent fill. Opacity increases on hover via `feature-state`.         |
  | `country-borders`  | Political boundary lines       | Thin gray/white lines.                                                         |
  | `country-selected` | Selected country highlight     | Thicker border + stronger fill. Filtered to show only the selected country ID. |

  These are the three core layers. Hover (border + extrusion), the 4-layer selection and compare highlight stacks, and the satellite raster complete the picture — the full registry is `LAYER` in `src/lib/mapLayers.ts` (13 ids).
  ```

  with:

  ```markdown
  ### Map Layers

  Four visual layers render on top of the basemap:

  | Layer              | Purpose                        | Style                                                                                                                                                                                                                                                                             |
  | ------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `country-fill`     | Clickable area, hover feedback | Semi-transparent fill. Opacity increases on hover via `feature-state`.                                                                                                                                                                                                              |
  | `country-borders`  | Political boundary lines       | Thin gray/white lines.                                                                                                                                                                                                                                                              |
  | `country-dim`      | Selection spotlight scrim (B4) | Dark 25% fill over every country EXCEPT the selection (and both compare countries). Sits above the base layers, below the hover/highlight stacks. Filter owned by `useSelectionHighlight` via `spotlightDimFilter`; matches nothing when no country is selected, so games never show it. Never hit-tested — every `queryRenderedFeatures` caller stays scoped to `country-fill`. |
  | `country-selected` | Selected country highlight     | Tight border glow (4px, blur 2) + faint 10% fill — the spotlight scrim carries the emphasis. Filtered to show only the selected country ID.                                                                                                                                          |

  These are the four core layers. Hover (border + extrusion), the 4-layer selection and compare highlight stacks, and the satellite raster complete the picture — the full registry is `LAYER` in `src/lib/mapLayers.ts` (14 ids).
  ```

- [ ] **Step 10: Run the full check.**

  ```
  npm run check
  ```

  Expected: green (typecheck, lint, full unit suite). If lint flags the long `map.setFilter(...)` line in `useSelectionHighlight.ts`, break the argument onto its own line — do not disable the rule.

- [ ] **Step 11: Live-verify the spotlight (both basemaps, both themes), then commit.**

  Start the dev server, open `http://localhost:5173/#FRA`, and confirm: the world dims, France stays bright with a tight coral outline; toggle satellite off and the theme dark/light — the scrim reads correctly in all four combinations; open `#FRA,DEU` — both countries stay undimmed; start a game from the launcher — the scrim disappears the moment the game starts (selection is cleared). Then kill the dev server (project memory: never leave it running before e2e) and commit everything in ONE commit:

  ```
  git add src/lib/mapPalette.ts src/lib/mapLayers.ts src/components/WorldMap.tsx src/hooks/useSelectionHighlight.ts src/lib/__tests__/mapLayers.test.ts src/hooks/__tests__/useSelectionHighlight.test.tsx e2e/compare-view-dimming.spec.ts docs/systems/map-rendering.md
  git commit -m "feat(map): B4 selection spotlight — country-dim scrim, quiet fill, tight glow

  Selecting a country now dims everything else (country-dim fill layer,
  0.25 dark scrim, filtered to everything except the selection and both
  compare countries) instead of covering the selection with a 0.32 sticker
  fill. Selection fill drops to 0.10; the border glow tightens from
  10px/blur 5 to 4px/blur 2 (coral stays until E4). Filter owned by
  useSelectionHighlight via spotlightDimFilter; games never show the scrim
  because game start deselects. The new layer never joins hit-testing —
  all queryRenderedFeatures callers stay scoped to country-fill.

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

### Task 6: B5 — reveal fill pulse on the answer country (`country-reveal-fill`)

At round end the answer country currently gets only a recolored hover border (see `src/game/hooks/useRevealMapEffects.ts`). This task adds a **dedicated** `country-reveal-fill` layer (not a borrowed selection layer — the single-owner lesson) that pulses `fill-opacity` 0.35 → 0.12 over two beats and settles at 0.15 for the reveal phase; `prefers-reduced-motion` gets a static 0.2 fill with no rAF loop. The pulse waveform is a pure, unit-tested function in `revealAnimation.ts` (map paint animations are invisible to `Element.getAnimations`, so seam-based contracts replace `data-animation-state` per the spec's Testing commitments). Outcome color reuses the existing reveal palette (`REVEAL_CORRECT` / `REVEAL_WRONG` in `src/lib/mapPalette.ts`). This workstream ships **no new telemetry** — do not add `track()` calls. One commit.

Design notes the code below encodes (do not re-derive):
- The layer id is `country-reveal-fill` — the `country-` prefix keeps it out of `applyBasemapLayerVisibility`'s basemap sweep (that owner skips `country-*`/`satellite-*` ids; see `src/lib/mapLayers.ts:301-317`), so no visibility-owner change is needed.
- Layer **creation** lives in `src/lib/mapLayers.ts` (the canonical creator of all `country-*` layers, registered in `LAYER`), added lazily on first country reveal like the reveal marker/line layers. Runtime **paint/filter** is owned by `useRevealMapEffects` — the existing, documented reveal-paint owner (it already writes `LAYER.hoverBorder` paint and the arc's `line-gradient`); this is not a scattered-setPaintProperty violation.
- The pulse gets its **own** rAF loop inside the same round-ended effect, mirroring the arc loop's quantise/cancel pattern. It cannot be merged into the arc's `step` closure because the arc rAF only exists for wrong guesses with a known click, while the fill pulse must also run on correct guesses and skips (where `computeRevealAnimationPlan` returns `null` and the effect early-returns).
- Layer stacking: on a wrong-guess reveal the fill is ensured before `ensureRevealSources`, so markers/arc stack above it. If the session's first reveal was a city (point) reveal, a later country reveal's fill lands above the marker layers — accepted (the fill is filtered to one country and translucent); no `beforeId` juggling.

**Files:**
- Modify: `src/game/shared/revealAnimation.ts` (append after line 46 — end of file)
- Modify: `src/game/shared/__tests__/revealAnimation.test.ts` (line 2 import; append after line 139)
- Modify: `src/test/fakeMapRef.ts` (add a `getLayer` spy: after line 13, in the map object at lines 45–64, in `calls` at lines 80–97)
- Modify: `src/lib/mapLayers.ts` (line 8 import; new `ensureRevealFillLayer` after line 156; `LAYER` registry lines 245–247)
- Modify: `src/lib/__tests__/mapLayers.test.ts` (lines 1–11 imports; append after line 154)
- Modify: `src/game/hooks/useRevealMapEffects.ts` (lines 4 and 7 imports; country-reveal block lines 127–139; both cleanups at lines 158–167 and 264–266)
- Modify: `src/game/hooks/__tests__/useRevealMapEffects.test.tsx` (after line 10 import; append after line 449)
- Modify: `e2e/reveal-animation.spec.ts` (lines 1–3 imports; two insertions in the first test)
- Modify: `e2e/reveal-animation-reduced-motion.spec.ts` (lines 1–2 imports; one insertion)
- Modify: `docs/systems/map-rendering.md` (line 60 — the `LAYER` registry sentence hardcodes the id count)
- Tests: `src/game/shared/__tests__/revealAnimation.test.ts`, `src/lib/__tests__/mapLayers.test.ts`, `src/game/hooks/__tests__/useRevealMapEffects.test.tsx`, `e2e/reveal-animation.spec.ts`, `e2e/reveal-animation-reduced-motion.spec.ts`

**Interfaces:**
- Consumes: `REVEAL_CORRECT: string` / `REVEAL_WRONG: string` (`src/lib/mapPalette.ts`); `LAYER` registry and `EMPTY_FILTER: maplibregl.FilterSpecification` (`src/lib/mapLayers.ts` — EMPTY_FILTER is already exported there; do NOT re-inline `['==', ['get', 'id'], '']` in new code); `prefersReducedMotion(): boolean` (`src/lib/motion.ts`); `createFakeMapRef` (`src/test/fakeMapRef.ts`); `makeSession`/`makeCountryReveal`/`makePointReveal`/`makeOutcome` (`src/game/shared/__tests__/factories.ts`); `stubMatchMedia` (`src/test/matchMediaStub`).
- Produces: `revealFillOpacityAt(elapsedMs: number): number` plus constants `REVEAL_FILL_PEAK = 0.35`, `REVEAL_FILL_TROUGH = 0.12`, `REVEAL_FILL_SETTLED = 0.15`, `REVEAL_FILL_REDUCED = 0.2`, `REVEAL_FILL_PULSE_MS = 1200` (all exported from `src/game/shared/revealAnimation.ts`); `ensureRevealFillLayer(map: maplibregl.Map): void` and `LAYER.revealFill = 'country-reveal-fill'` (`src/lib/mapLayers.ts`); `createFakeMapRef` gains a `getLayer` spy (returns `undefined` by default).

- [ ] **Step 1: Write the failing waveform unit tests.** Append to `src/game/shared/__tests__/revealAnimation.test.ts` (after the closing `})` of the `computeRevealAnimationPlan` describe, line 139), and extend the import at line 2:

  Change line 2 from:
  ```ts
  import { computeRevealAnimationPlan } from '../revealAnimation'
  ```
  to:
  ```ts
  import {
    computeRevealAnimationPlan,
    revealFillOpacityAt,
    REVEAL_FILL_PEAK,
    REVEAL_FILL_TROUGH,
    REVEAL_FILL_SETTLED,
    REVEAL_FILL_PULSE_MS,
  } from '../revealAnimation'
  ```

  Append:
  ```ts

  describe('revealFillOpacityAt', () => {
    // Waveform: two cosine beats (peak at 0 and PULSE/2, troughs at PULSE/4 and
    // 3·PULSE/4) blended linearly toward the settled value so the pulse decays
    // and lands exactly on REVEAL_FILL_SETTLED with no snap.
    it('starts at the 0.35 peak', () => {
      expect(revealFillOpacityAt(0)).toBeCloseTo(REVEAL_FILL_PEAK, 10)
    })

    it('dips to the first-beat trough at a quarter of the pulse', () => {
      // wave = 0.12, blend t = 0.25 → 0.12 + (0.15 − 0.12) · 0.25 = 0.1275
      expect(revealFillOpacityAt(REVEAL_FILL_PULSE_MS * 0.25)).toBeCloseTo(0.1275, 4)
    })

    it('rebounds into a decayed second beat at the halfway point', () => {
      // wave = 0.35, blend t = 0.5 → 0.35 + (0.15 − 0.35) · 0.5 = 0.25
      const secondPeak = revealFillOpacityAt(REVEAL_FILL_PULSE_MS * 0.5)
      expect(secondPeak).toBeCloseTo(0.25, 4)
      expect(secondPeak).toBeLessThan(REVEAL_FILL_PEAK)
      expect(secondPeak).toBeGreaterThan(REVEAL_FILL_SETTLED)
    })

    it('dips to the second-beat trough at three quarters', () => {
      // wave = 0.12, blend t = 0.75 → 0.12 + (0.15 − 0.12) · 0.75 = 0.1425
      expect(revealFillOpacityAt(REVEAL_FILL_PULSE_MS * 0.75)).toBeCloseTo(0.1425, 4)
    })

    it('settles at exactly 0.15 from the pulse end onward', () => {
      expect(revealFillOpacityAt(REVEAL_FILL_PULSE_MS)).toBe(REVEAL_FILL_SETTLED)
      expect(revealFillOpacityAt(REVEAL_FILL_PULSE_MS * 5)).toBe(REVEAL_FILL_SETTLED)
    })

    it('stays within [trough, peak] for the whole pulse', () => {
      for (let ms = 0; ms <= REVEAL_FILL_PULSE_MS; ms += 10) {
        const v = revealFillOpacityAt(ms)
        expect(v).toBeLessThanOrEqual(REVEAL_FILL_PEAK)
        expect(v).toBeGreaterThanOrEqual(REVEAL_FILL_TROUGH)
      }
    })

    it('clamps negative elapsed to the starting peak', () => {
      expect(revealFillOpacityAt(-50)).toBeCloseTo(REVEAL_FILL_PEAK, 10)
    })
  })
  ```

- [ ] **Step 2: Run the waveform tests and see them fail.** Command:
  ```
  npx vitest run src/game/shared/__tests__/revealAnimation.test.ts
  ```
  Expected failure: module resolution error — `revealAnimation.ts` "does not provide an export named 'REVEAL_FILL_PEAK'" (or equivalent SyntaxError), failing the whole file.

- [ ] **Step 3: Implement the pure pulse waveform.** `src/game/shared/revealAnimation.ts` currently ends (lines 40–46) with:
  ```ts
    if (reveal.clickedPoint === null) return null
    return {
      from: reveal.clickedPoint,
      to: reveal.targetCentroid,
      durationMs: scaledDuration(reveal.distanceKm, reducedMotion),
    }
  }
  ```
  Append after that closing brace:
  ```ts

  /** Reveal fill pulse (B5) — fill-opacity waveform for the dedicated
   *  `country-reveal-fill` layer (see ensureRevealFillLayer in
   *  src/lib/mapLayers.ts; driven by useRevealMapEffects). Map paint
   *  animations are invisible to Element.getAnimations, so this pure
   *  function is the unit-tested animation contract — the same pattern as
   *  computeRevealAnimationPlan above. */
  export const REVEAL_FILL_PEAK = 0.35
  export const REVEAL_FILL_TROUGH = 0.12
  export const REVEAL_FILL_SETTLED = 0.15
  /** Static fill under prefers-reduced-motion — no rAF loop runs at all. */
  export const REVEAL_FILL_REDUCED = 0.2
  /** Two beats of 600 ms each. */
  export const REVEAL_FILL_PULSE_MS = 1200
  const PULSE_BEATS = 2

  /**
   * Fill opacity at `elapsedMs` since reveal: two cosine beats
   * (peak → trough → peak → trough) blended linearly toward the settled
   * value, so the pulse visibly decays and lands exactly on
   * REVEAL_FILL_SETTLED at REVEAL_FILL_PULSE_MS with no discontinuity.
   */
  export function revealFillOpacityAt(elapsedMs: number): number {
    if (elapsedMs >= REVEAL_FILL_PULSE_MS) return REVEAL_FILL_SETTLED
    const t = Math.max(0, elapsedMs) / REVEAL_FILL_PULSE_MS
    const wave =
      REVEAL_FILL_TROUGH +
      ((REVEAL_FILL_PEAK - REVEAL_FILL_TROUGH) * (1 + Math.cos(2 * Math.PI * PULSE_BEATS * t))) / 2
    return wave + (REVEAL_FILL_SETTLED - wave) * t
  }
  ```

- [ ] **Step 4: Run the waveform tests green.**
  ```
  npx vitest run src/game/shared/__tests__/revealAnimation.test.ts
  ```
  Expected: all tests pass (9 existing + 7 new).

- [ ] **Step 5: Teach the fake map `getLayer` (test infrastructure for the next steps).** Three edits to `src/test/fakeMapRef.ts`. After line 13:
  ```ts
    const getSource = vi.fn(() => ({ setData }))
  ```
  becomes:
  ```ts
    const getSource = vi.fn(() => ({ setData }))
    const getLayer = vi.fn((): unknown => undefined)
  ```
  In the `map` object (currently):
  ```ts
      setFeatureState,
      getSource,
      addSource,
  ```
  (4-space indent, lines 49–51) becomes:
  ```ts
      setFeatureState,
      getSource,
      getLayer,
      addSource,
  ```
  In the `calls` record (currently, 6-space indent, lines 85–87):
  ```ts
        setFeatureState,
        getSource,
        addSource,
  ```
  becomes:
  ```ts
        setFeatureState,
        getSource,
        getLayer,
        addSource,
  ```

- [ ] **Step 6: Write the failing layer-creation unit tests.** In `src/lib/__tests__/mapLayers.test.ts`, replace the import block (lines 1–11):
  ```ts
  import { describe, expect, it, vi } from 'vitest'
  import {
    addHoverLayers,
    addSelectionLayers,
    addCompareLayers,
    applyBasemapLayerVisibility,
    applyCountryBaselinePaint,
    EXTRUSION_MAX_ZOOM,
    extrusionHeightExpression,
  } from '../mapLayers'
  ```
  with:
  ```ts
  import { describe, expect, it, vi } from 'vitest'
  import type { FillLayerSpecification } from 'maplibre-gl'
  import {
    addHoverLayers,
    addSelectionLayers,
    addCompareLayers,
    applyBasemapLayerVisibility,
    applyCountryBaselinePaint,
    ensureRevealFillLayer,
    EXTRUSION_MAX_ZOOM,
    extrusionHeightExpression,
    LAYER,
  } from '../mapLayers'
  ```
  Append at end of file (after line 154's closing `})`):
  ```ts

  describe('ensureRevealFillLayer', () => {
    it('adds the dedicated country-reveal-fill layer, transparent and unfiltered', () => {
      const fake = createFakeMapRef()
      ensureRevealFillLayer(fake.map)
      const spec = fake.addedLayers.find((l) => l.id === LAYER.revealFill)
      expect(spec?.type).toBe('fill')
      const fill = spec as FillLayerSpecification
      expect(fill.source).toBe('countries')
      expect(fill.paint?.['fill-opacity']).toBe(0)
      expect(fill.filter).toEqual(['==', ['get', 'id'], ''])
    })

    it('is idempotent — no addLayer when the layer already exists', () => {
      const fake = createFakeMapRef()
      ;(fake.map.getLayer as ReturnType<typeof vi.fn>).mockReturnValue({ id: LAYER.revealFill })
      ensureRevealFillLayer(fake.map)
      expect(fake.calls.addLayer).not.toHaveBeenCalled()
    })
  })
  ```

- [ ] **Step 7: Run the mapLayers tests and see them fail.**
  ```
  npx vitest run src/lib/__tests__/mapLayers.test.ts
  ```
  Expected failure: import error — `mapLayers.ts` has no export named `ensureRevealFillLayer`.

- [ ] **Step 8: Implement layer registration + lazy creation in `src/lib/mapLayers.ts`.** Three edits.

  (a) Line 8, change:
  ```ts
  import { TEAL, TEAL_DIM, CORAL } from './mapPalette'
  ```
  to:
  ```ts
  import { TEAL, TEAL_DIM, CORAL, REVEAL_WRONG } from './mapPalette'
  ```

  (b) Register the id. The `LAYER` registry currently ends (lines 245–247):
  ```ts
    compareExtrusion: 'country-compare-extrusion',
    satellite: 'satellite-layer',
  } as const
  ```
  becomes:
  ```ts
    compareExtrusion: 'country-compare-extrusion',
    revealFill: 'country-reveal-fill',
    satellite: 'satellite-layer',
  } as const
  ```

  (c) Add the creator after `addCompareLayers` (which currently reads, lines 153–156):
  ```ts
  /** Add the compare (teal-dim) highlight stack. */
  export function addCompareLayers(map: maplibregl.Map): void {
    addHighlightStack(map, 'country-compare', TEAL_DIM)
  }
  ```
  Append directly after it:
  ```ts

  /** Lazily add the game reveal fill layer (`country-reveal-fill`) — a
   *  dedicated fill over the answer country, pulsed by useRevealMapEffects at
   *  round end (B5, 2026-07-26 spec). Dedicated on purpose: borrowing the
   *  selection stack would couple reveal paint to selection paint (the
   *  single-owner lesson). Added lazily on first country reveal, like the
   *  reveal marker/line layers; idempotent. The `country-` prefix keeps it out
   *  of applyBasemapLayerVisibility's basemap sweep. Runtime paint/filter is
   *  owned by useRevealMapEffects (the reveal-paint owner). */
  export function ensureRevealFillLayer(map: maplibregl.Map): void {
    if (map.getLayer(LAYER.revealFill)) return
    map.addLayer({
      id: LAYER.revealFill,
      type: 'fill',
      source: 'countries',
      paint: { 'fill-color': REVEAL_WRONG, 'fill-opacity': 0 },
      filter: EMPTY_FILTER,
    })
  }
  ```
  (MapLibre 5 signature check: `Map.getLayer(id: string): StyleLayer | undefined` — verified against `node_modules/maplibre-gl/dist/maplibre-gl.d.ts`.)

- [ ] **Step 9: Run the mapLayers tests green.**
  ```
  npx vitest run src/lib/__tests__/mapLayers.test.ts
  ```
  Expected: all pass (existing 9 + 2 new).

- [ ] **Step 10: Write the failing hook tests (paint, reduced-motion, teardown).** In `src/game/hooks/__tests__/useRevealMapEffects.test.tsx`, after line 10 (`import { REVEAL_CORRECT, REVEAL_WRONG } from '../../../lib/mapPalette'`) add:
  ```ts
  import { REVEAL_FILL_PEAK, REVEAL_FILL_REDUCED } from '../../shared/revealAnimation'
  ```
  Append at end of file (after the closing `})` of the `useRevealMapEffects — city reveal` describe, line 449):
  ```ts

  describe('useRevealMapEffects — reveal fill pulse (B5)', () => {
    // All country reveals here use clickedCca3: null so computeRevealAnimationPlan
    // returns null and no arc rAF runs — any rAF observed is the pulse's.
    function roundEnded(reveal: ReturnType<typeof makeCountryReveal | typeof makePointReveal>) {
      return makeSession({
        status: 'round-ended',
        modeId: 'country-pinning',
        lastOutcome: makeOutcome(reveal),
      })
    }

    it('adds country-reveal-fill, targets the answer, pulses from the peak (correct = green)', () => {
      const fake = createFakeMapRef()
      const reveal = makeCountryReveal({ correct: true, clickedCca3: null, distanceKm: null })
      renderRevealHook(buildRevealArgs({ session: roundEnded(reveal), mapRef: fake.ref }))
      expect(fake.addedLayers.some((l) => l.id === 'country-reveal-fill')).toBe(true)
      expect(fake.calls.setFilter).toHaveBeenCalledWith('country-reveal-fill', [
        '==',
        ['get', 'id'],
        'FRA',
      ])
      expect(fake.calls.setPaintProperty).toHaveBeenCalledWith(
        'country-reveal-fill',
        'fill-color',
        REVEAL_CORRECT,
      )
      // Animated path writes the waveform peak synchronously before the first rAF tick.
      expect(fake.calls.setPaintProperty).toHaveBeenCalledWith(
        'country-reveal-fill',
        'fill-opacity',
        REVEAL_FILL_PEAK,
      )
    })

    it('colors the fill amber on a wrong-country reveal', () => {
      const fake = createFakeMapRef()
      const reveal = makeCountryReveal({ correct: false, clickedCca3: null, distanceKm: null })
      renderRevealHook(buildRevealArgs({ session: roundEnded(reveal), mapRef: fake.ref }))
      expect(fake.calls.setPaintProperty).toHaveBeenCalledWith(
        'country-reveal-fill',
        'fill-color',
        REVEAL_WRONG,
      )
    })

    it('reduced motion: one static 0.2 write, no rAF loop', () => {
      stubMatchMedia((q) => q.includes('reduce'))
      const raf = vi.spyOn(window, 'requestAnimationFrame')
      const fake = createFakeMapRef()
      const reveal = makeCountryReveal({ correct: true, clickedCca3: null, distanceKm: null })
      renderRevealHook(buildRevealArgs({ session: roundEnded(reveal), mapRef: fake.ref }))
      expect(fake.calls.setPaintProperty).toHaveBeenCalledWith(
        'country-reveal-fill',
        'fill-opacity',
        REVEAL_FILL_REDUCED,
      )
      expect(raf).not.toHaveBeenCalled()
      raf.mockRestore()
    })

    it('never touches the reveal fill for point (city) reveals', () => {
      const fake = createFakeMapRef()
      const reveal = makePointReveal({ clickedPoint: [-10, 40], distanceKm: 1500 })
      const session = makeSession({
        status: 'round-ended',
        modeId: 'city-guessing',
        lastOutcome: makeOutcome(reveal),
      })
      renderRevealHook(buildRevealArgs({ session, mapRef: fake.ref }))
      expect(fake.addedLayers.some((l) => l.id === 'country-reveal-fill')).toBe(false)
      const fillCalls = fake.calls.setPaintProperty.mock.calls.filter(
        (c) => c[0] === 'country-reveal-fill',
      )
      expect(fillCalls).toHaveLength(0)
    })

    it('teardown on advance: filter emptied and fill-opacity reset to 0', () => {
      const fake = createFakeMapRef()
      const reveal = makeCountryReveal({ correct: true, clickedCca3: null, distanceKm: null })
      const session = roundEnded(reveal)
      const args = buildRevealArgs({ session, mapRef: fake.ref })
      const { rerender } = renderHook(({ s }) => useRevealMapEffects({ ...args, session: s }), {
        initialProps: { s: session },
      })
      fake.calls.setFilter.mockClear()
      fake.calls.setPaintProperty.mockClear()
      rerender({ s: makeSession({ ...session, status: 'playing', lastOutcome: null }) })
      expect(fake.calls.setFilter).toHaveBeenCalledWith('country-reveal-fill', [
        '==',
        ['get', 'id'],
        '',
      ])
      expect(fake.calls.setPaintProperty).toHaveBeenCalledWith(
        'country-reveal-fill',
        'fill-opacity',
        0,
      )
    })
  })
  ```

- [ ] **Step 11: Run the hook tests and see the new ones fail.**
  ```
  npx vitest run src/game/hooks/__tests__/useRevealMapEffects.test.tsx
  ```
  Expected: the 5 new B5 tests fail (e.g. `expect(false).toBe(true)` for the layer-added assertion; `setFilter` never called with `'country-reveal-fill'`); the 15 pre-existing tests still pass.

- [ ] **Step 12: Implement the pulse in `src/game/hooks/useRevealMapEffects.ts`.** Four edits.

  (a) Line 4, change:
  ```ts
  import { LAYER } from '../../lib/mapLayers'
  ```
  to:
  ```ts
  import { EMPTY_FILTER, ensureRevealFillLayer, LAYER } from '../../lib/mapLayers'
  ```

  (b) Line 7, change:
  ```ts
  import { computeRevealAnimationPlan } from '../shared/revealAnimation'
  ```
  to:
  ```ts
  import {
    computeRevealAnimationPlan,
    revealFillOpacityAt,
    REVEAL_FILL_PULSE_MS,
    REVEAL_FILL_REDUCED,
  } from '../shared/revealAnimation'
  ```

  (c) Replace the country-reveal block (currently lines 127–139):
  ```ts
      const reveal = session.lastOutcome.reveal
      const reduced = prefersReducedMotion()

      if (reveal.kind === 'country') {
        try {
          map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], reveal.targetCca3])
          const colour = reveal.correct ? REVEAL_CORRECT : REVEAL_WRONG
          map.setPaintProperty(LAYER.hoverBorder, 'line-color', colour)
          map.setPaintProperty(LAYER.hoverBorder, 'line-width', reduced ? 3 : 4)
        } catch {
          /* layer may not exist */
        }
      }
  ```
  with:
  ```ts
      const reveal = session.lastOutcome.reveal
      const reduced = prefersReducedMotion()

      // Reveal fill pulse (B5): rAF handle for the two-beat fill-opacity pulse
      // on the dedicated country-reveal-fill layer. Declared ahead of the
      // country block so both cleanup paths below can cancel it. This is a
      // separate loop from the arc's rAF on purpose — the arc loop only exists
      // for wrong guesses with a known click, while the pulse also runs on
      // correct guesses and skips.
      let pulseFrameId: number | null = null

      if (reveal.kind === 'country') {
        try {
          map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], reveal.targetCca3])
          const colour = reveal.correct ? REVEAL_CORRECT : REVEAL_WRONG
          map.setPaintProperty(LAYER.hoverBorder, 'line-color', colour)
          map.setPaintProperty(LAYER.hoverBorder, 'line-width', reduced ? 3 : 4)

          // B5: pulse the answer country's fill. Paint animations are
          // invisible to Element.getAnimations, so the waveform is the pure
          // unit-tested revealFillOpacityAt (revealAnimation.ts) and e2e
          // asserts the settled value through the map seam. Reduced motion:
          // one static write, no rAF.
          ensureRevealFillLayer(map)
          map.setFilter(LAYER.revealFill, ['==', ['get', 'id'], reveal.targetCca3])
          map.setPaintProperty(LAYER.revealFill, 'fill-color', colour)
          if (reduced) {
            map.setPaintProperty(LAYER.revealFill, 'fill-opacity', REVEAL_FILL_REDUCED)
          } else {
            // Write the peak synchronously so the fill is in a deterministic
            // state before the first rAF tick (mirrors the arc's entry
            // line-gradient write).
            map.setPaintProperty(LAYER.revealFill, 'fill-opacity', revealFillOpacityAt(0))
            const pulseStart = performance.now()
            let lastOpacity = revealFillOpacityAt(0)
            const pulseStep = (now: number) => {
              const elapsed = now - pulseStart
              // Quantise to 1/1000 to skip redundant paint updates when rAF
              // fires faster than a visible change (mirrors the arc loop's
              // 1/64 line-gradient quantiser).
              const quantised = Math.round(revealFillOpacityAt(elapsed) * 1000) / 1000
              if (quantised !== lastOpacity) {
                lastOpacity = quantised
                try {
                  map.setPaintProperty(LAYER.revealFill, 'fill-opacity', quantised)
                } catch {
                  /* layer torn down */
                }
              }
              pulseFrameId =
                elapsed < REVEAL_FILL_PULSE_MS ? window.requestAnimationFrame(pulseStep) : null
            }
            pulseFrameId = window.requestAnimationFrame(pulseStep)
          }
        } catch {
          /* layer may not exist */
        }
      }

      // Teardown for the reveal fill: cancel the pulse and restore the layer
      // to its inert state (empty filter, transparent). Shared by both cleanup
      // paths (planless early-return and the arc path), mirroring how the
      // hover-border filter is restored. The layer itself persists, like the
      // reveal marker/line layers.
      const clearRevealFill = () => {
        if (pulseFrameId !== null) window.cancelAnimationFrame(pulseFrameId)
        if (reveal.kind !== 'country') return
        try {
          map.setFilter(LAYER.revealFill, EMPTY_FILTER)
          map.setPaintProperty(LAYER.revealFill, 'fill-opacity', 0)
        } catch {
          /* no-op */
        }
      }
  ```

  (d) Wire `clearRevealFill()` into **both** cleanups. The planless early-return cleanup (currently lines 158–167):
  ```ts
        return () => {
          if (reveal.kind === 'country') {
            try {
              map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], ''])
            } catch {
              /* no-op */
            }
          }
          clearRevealSources(map)
        }
  ```
  becomes:
  ```ts
        return () => {
          clearRevealFill()
          if (reveal.kind === 'country') {
            try {
              map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], ''])
            } catch {
              /* no-op */
            }
          }
          clearRevealSources(map)
        }
  ```
  And the main cleanup (currently lines 264–266):
  ```ts
      return () => {
        if (frameId !== null) window.cancelAnimationFrame(frameId)
        if (reveal.kind === 'country') {
  ```
  becomes:
  ```ts
      return () => {
        if (frameId !== null) window.cancelAnimationFrame(frameId)
        clearRevealFill()
        if (reveal.kind === 'country') {
  ```
  (The transition-to-idle effect at the bottom of the hook needs no change: leaving `round-ended` re-runs the geometry effect's cleanup, which is where the hover border is restored today and where `clearRevealFill` now runs — same mechanism, mode-neutral.)

- [ ] **Step 13: Run the hook tests green.**
  ```
  npx vitest run src/game/hooks/__tests__/useRevealMapEffects.test.tsx
  ```
  Expected: all 20 tests pass.

- [ ] **Step 14: Update the stale layer-registry doc line (same task — rule for `docs/systems/`).** `docs/systems/map-rendering.md` line 60 currently reads:
  ```
  These are the three core layers. Hover (border + extrusion), the 4-layer selection and compare highlight stacks, and the satellite raster complete the picture — the full registry is `LAYER` in `src/lib/mapLayers.ts` (13 ids).
  ```
  Replace with:
  ```
  These are the three core layers. Hover (border + extrusion), the 4-layer selection and compare highlight stacks, the game reveal fill (`country-reveal-fill`, pulsed by `useRevealMapEffects` at round end), and the satellite raster complete the picture — the full registry is `LAYER` in `src/lib/mapLayers.ts` (14 ids).
  ```
  **Caveat:** earlier tasks in this plan (B1 adds `country-labels`, B4 adds `country-dim`) may already have bumped this sentence. If the line no longer matches the quote above, keep its current wording, add the reveal-fill clause, and set the count to the actual number of entries in the `LAYER` object in `src/lib/mapLayers.ts` after your Step 8 edit (count them — do not guess).

- [ ] **Step 15: Add the seam-based e2e assertions.** Two spec files. Note on imports: e2e specs already import app constants from `src/` (`REVEAL_LINE_SOURCE` at `e2e/reveal-animation.spec.ts:3`); `src/lib/mapLayers.ts` and `src/game/shared/revealAnimation.ts` are safe to import in Node (pure constants; `maplibre-gl` is `import type`-only — verified). `window.__funworldmap_map` is typed as `maplibregl.Map` in `e2e/test-globals.d.ts`, so `getPaintProperty`/`getFilter` need no casts.

  (a) `e2e/reveal-animation.spec.ts` — extend the imports (lines 1–3):
  ```ts
  import { test, expect } from '@playwright/test'
  import { waitForRevealLineCoords, openLauncher, waitForMapLoaded } from './helpers'
  import { REVEAL_LINE_SOURCE } from '../src/game/shared/revealLayers'
  ```
  becomes:
  ```ts
  import { test, expect } from '@playwright/test'
  import { waitForRevealLineCoords, openLauncher, waitForMapLoaded } from './helpers'
  import { REVEAL_LINE_SOURCE } from '../src/game/shared/revealLayers'
  import { LAYER } from '../src/lib/mapLayers'
  import { REVEAL_FILL_SETTLED } from '../src/game/shared/revealAnimation'
  ```
  In the first test, directly after:
  ```ts
      expect(center!.lng).toBeCloseTo(2, 0)
      expect(center!.lat).toBeCloseTo(46, 0)
  ```
  insert:
  ```ts

      // B5: the reveal fill pulse settles at REVEAL_FILL_SETTLED over the
      // answer country. Map paint animations are invisible to
      // Element.getAnimations, so poll the paint property through the map
      // seam (the seam-based contract from the 2026-07-26 spec). The layer is
      // guaranteed to exist here: it is ensured in the same effect that wrote
      // the arc geometry we already waited for.
      await expect
        .poll(
          async () =>
            await page.evaluate(
              (layerId) => window.__funworldmap_map?.getPaintProperty(layerId, 'fill-opacity'),
              LAYER.revealFill,
            ),
          { timeout: 10_000 },
        )
        .toBe(REVEAL_FILL_SETTLED)
      // And it is filtered to the answer country (FRA), not the guess.
      expect(
        await page.evaluate(
          (layerId) => window.__funworldmap_map?.getFilter(layerId),
          LAYER.revealFill,
        ),
      ).toEqual(['==', ['get', 'id'], 'FRA'])
  ```
  At the end of the same test, directly after the existing block:
  ```ts
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
  ```
  insert:
  ```ts

      // B5 teardown: advancing to the next round restores the reveal fill to
      // fully transparent (the layer persists; only its paint/filter reset).
      await expect
        .poll(
          async () =>
            await page.evaluate(
              (layerId) => window.__funworldmap_map?.getPaintProperty(layerId, 'fill-opacity'),
              LAYER.revealFill,
            ),
          { timeout: 5_000 },
        )
        .toBe(0)
  ```

  (b) `e2e/reveal-animation-reduced-motion.spec.ts` — extend the imports (lines 1–2):
  ```ts
  import { test, expect } from '@playwright/test'
  import { waitForRevealLineCoords, openLauncher, waitForMapLoaded } from './helpers'
  ```
  becomes:
  ```ts
  import { test, expect } from '@playwright/test'
  import { waitForRevealLineCoords, openLauncher, waitForMapLoaded } from './helpers'
  import { LAYER } from '../src/lib/mapLayers'
  import { REVEAL_FILL_REDUCED } from '../src/game/shared/revealAnimation'
  ```
  Directly after:
  ```ts
      const handle = await waitForRevealLineCoords(page, { minPoints: 1 })
      const coords = await handle.jsonValue()
      expect(coords).toHaveLength(65)
  ```
  insert:
  ```ts

      // B5 reduced motion: no pulse loop runs — the reveal fill is written
      // once, synchronously, as the static REVEAL_FILL_REDUCED value.
      await expect
        .poll(
          async () =>
            await page.evaluate(
              (layerId) => window.__funworldmap_map?.getPaintProperty(layerId, 'fill-opacity'),
              LAYER.revealFill,
            ),
          { timeout: 5_000 },
        )
        .toBe(REVEAL_FILL_REDUCED)
  ```

  **CI-coverage honesty (state this in the PR too):** `reveal-animation.spec.ts` is **CI-excluded** — it sits in the chromium project's `isCi` `testIgnore` in `playwright.config.ts` (no-GPU free runners, tracking issue #106) — so the pulse/teardown assertions hold only at the local merge-time run. The reduced-motion sibling is **not** in that ignore list and does run in CI, so the static-0.2 assertion gives the new layer a CI-visible contract. Both specs are already in the chromium `testMatch`; no `playwright.config.ts` change is needed.

- [ ] **Step 16: Run the touched e2e specs locally.** First kill any background `npm run dev` (project memory: `reuseExistingServer` would reuse it **without** `VITE_TEST_HOOKS`, breaking the `__funworldmap_game`/`__funworldmap_map` seams). Then:
  ```
  npx playwright test e2e/reveal-animation.spec.ts e2e/reveal-animation-reduced-motion.spec.ts --project=chromium --workers=2
  ```
  Expected: 3 passed (2 + 1). If the settled-opacity poll flakes, do NOT add waits — re-read the trace; the poll is auto-retrying and the value is written by the final rAF frame, so a failure means the pulse loop or teardown is wrong.

- [ ] **Step 17: Full verification.**
  ```
  npm run check
  ```
  Expected: green (lint — including eslint-plugin-playwright on the new e2e code — typecheck, and the full unit suite).

- [ ] **Step 18: Commit.**
  ```
  git add src/game/shared/revealAnimation.ts src/game/shared/__tests__/revealAnimation.test.ts src/test/fakeMapRef.ts src/lib/mapLayers.ts src/lib/__tests__/mapLayers.test.ts src/game/hooks/useRevealMapEffects.ts src/game/hooks/__tests__/useRevealMapEffects.test.tsx e2e/reveal-animation.spec.ts e2e/reveal-animation-reduced-motion.spec.ts docs/systems/map-rendering.md
  git commit -m "feat(game): B5 reveal fill pulse on a dedicated country-reveal-fill layer" -m "Two-beat fill-opacity pulse (0.35 -> 0.12, settling at 0.15) over the answer country at round end, driven by useRevealMapEffects; reduced motion gets a static 0.2 fill with no rAF. Waveform is a pure unit-tested function (revealAnimation.ts pattern); e2e polls the settled/teardown opacity through the map seam because paint animations are invisible to Element.getAnimations. Layer registered in LAYER, created lazily via ensureRevealFillLayer (mapLayers.ts), outcome color from the existing reveal palette. No new telemetry." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

### Task 7: B6 — compare camera via asymmetric `cameraForBounds` padding (+ optional A/B centroid markers riding on B1)

**Scope note:** This task ships no new telemetry (map presentation only) — do not add `track()` calls.

**Files:**

- Modify: `src/lib/layoutConstants.ts` (add a maplibre type import at the top; replace `panelScreenOffset`, currently lines 25–32; append `COMPARE_FRAME_PADDING_PX` + `comparePanelPadding` after it)
- Modify: `src/lib/flyToCountry.ts` (line 37 only — `panelScreenOffset('single')` → `panelScreenOffset()`)
- Modify: `src/lib/flyToComparePair.ts` (imports line 5; comments + camera block, lines 15–84)
- Modify: `src/lib/__tests__/flyToComparePair.test.ts` (full rewrite, 89 lines)
- Modify: `src/lib/__tests__/layoutConstants.test.ts` (imports lines 15–28; the `panelScreenOffset` test, lines 48–62)
- Modify: `e2e/compare-map-clicks.spec.ts` (append a framing regression test after line 122; spec is already in the `chromium` `testMatch` in `playwright.config.ts` — no config change)
- Optional (Steps 8–12, gated on B1 having landed): `src/lib/mapLayers.ts`, `src/lib/__tests__/mapLayers.test.ts`, `src/test/fakeMapHooks.tsx` (lines 7–14), `src/hooks/useSelectionHighlight.ts` (lines 6, 62–69), `src/hooks/__tests__/useSelectionHighlight.test.tsx` (append), `src/components/WorldMap.tsx` (imports + `onLoad`), `docs/systems/map-rendering.md` (line 60, `LAYER` id count)
- Tests: `src/lib/__tests__/flyToComparePair.test.ts`, `src/lib/__tests__/layoutConstants.test.ts`, `src/lib/__tests__/mapLayers.test.ts`, `src/hooks/__tests__/useSelectionHighlight.test.tsx`, `e2e/compare-map-clicks.spec.ts`

**Interfaces:**

- Consumes: `COMPARE_PANEL_FOOTPRINT_PX = 672`, `SINGLE_PANEL_FOOTPRINT_PX`, `SHEET_COLLAPSED_FRACTION`, `DESKTOP_MEDIA_QUERY` (all existing, `src/lib/layoutConstants.ts`); maplibre-gl's `PaddingOptions` type — verified against `node_modules/maplibre-gl/dist/maplibre-gl.d.ts`: `RequireAtLeastOne<{ top: number; bottom: number; right: number; left: number }>`, and `CameraForBoundsOptions.padding?: number | PaddingOptions` (a bare number means uniform padding); `createFakeMapRef` (`src/test/fakeMapRef.ts` — already spies `cameraForBounds`); `makeCountryData` (`src/test/countryFixtures.ts` — defaults model France, `latlng: [46, 2]`); `CORAL = '#f43f5e'` and `TEAL_DIM = '#0d9488'` from `src/lib/mapPalette.ts` (the canonical owners of the compare badge colors — `index.css`'s `.compare-badge-a`/`.compare-badge-b` hardcode the same hex values); Task B1's `country-labels` layer + glyph decision (`text-font: ['Noto Sans Bold']`) — gate only, see Step 8.
- Produces: `COMPARE_FRAME_PADDING_PX = 80`; `comparePanelPadding(): PaddingOptions` (workstream C's C6 and G's G3 will consume/extend this — do NOT reinvent padding math there); `panelScreenOffset(): [number, number]` (**breaking**: the `kind` parameter is removed — compare no longer uses offsets, and `flyToCountry` is the only remaining caller); optional: `LAYER.compareMarkers = 'country-compare-markers'`, `addCompareMarkerLayer(map: maplibregl.Map): void`, `applyCompareMarkers(map: maplibregl.Map, pair: { a: CountryData; b: CountryData } | null): void` (the single documented owner of the marker source + visibility).

**Why:** `flyToComparePair` currently passes `offset: panelScreenOffset('compare')` to `cameraForBounds`. An offset only shifts the *center*; zoom is still sized to the **full** viewport, so for wide pairs country B slides under the 672px compare panel. Asymmetric padding makes `cameraForBounds` fold the occluded area into **both** zoom and center (the returned `CenterZoomBearing` bakes the padding in, so the follow-up `flyTo` needs no padding argument). The >110° wide-pair midpoint fallback is **kept** unchanged; the `GLOBE_SCALE_ZOOM` guard is **kept as the conservative default** and re-verified live (Step 7) before any removal.

- [ ] **Step 1: Rewrite the failing unit tests for `flyToComparePair`.** Replace the entire contents of `src/lib/__tests__/flyToComparePair.test.ts` with:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { flyToComparePair } from '../flyToComparePair'
import { prefersReducedMotion } from '../motion'
import { makeCountryData } from '../../test/countryFixtures'
import { createFakeMapRef } from '../../test/fakeMapRef'
import { COMPARE_FRAME_PADDING_PX, COMPARE_PANEL_FOOTPRINT_PX } from '../layoutConstants'

vi.mock('../motion', () => ({ prefersReducedMotion: vi.fn(() => false) }))

const FRANCE = makeCountryData() // latlng [46, 2]
const GERMANY = makeCountryData({ cca3: 'DEU', ccn3: '276', latlng: [51, 9] })
const JAPAN = makeCountryData({ cca3: 'JPN', ccn3: '392', latlng: [36, 138] })
const USA = makeCountryData({ cca3: 'USA', ccn3: '840', latlng: [38, -97] })
// Mid-wide pair: extended-bounds span (~81°) stays under the WIDE_PAIR_SPAN_DEG
// (110°) fallback threshold, so this pair still reaches cameraForBounds — used
// for the globe-scale guard test now that Japan+USA takes the fallback.
const BRAZIL = makeCountryData({ cca3: 'BRA', ccn3: '076', latlng: [-10, -55], area: 8_515_767 })
const NIGERIA = makeCountryData({ cca3: 'NGA', ccn3: '566', latlng: [10, 8], area: 923_768 })

beforeEach(() => {
  vi.mocked(prefersReducedMotion).mockReturnValue(false)
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  ) // desktop
})
afterEach(() => vi.unstubAllGlobals())

describe('flyToComparePair', () => {
  it('frames both countries with asymmetric padding reserving the panel footprint — no offset', () => {
    const fake = createFakeMapRef()
    flyToComparePair(fake.map, FRANCE, GERMANY)
    const [bounds, opts] = fake.calls.cameraForBounds.mock.calls[0]
    const [[west, south], [east, north]] = bounds as [[number, number], [number, number]]
    // Centroid bounds are extended by area-derived half-extents (both fixtures
    // share the France default area), so the raw centroid box [2,46]-[9,51]
    // must be strictly grown in every direction, not just padded.
    expect(west).toBeLessThan(2)
    expect(south).toBeLessThan(46 - 3)
    expect(east).toBeGreaterThan(9 + 3)
    expect(north).toBeGreaterThan(51 + 2)
    // B6: padding is folded into BOTH zoom and center by cameraForBounds —
    // the batch-2 screen offset only shifted the center, so zoom stayed sized
    // to the full viewport and country B slid under the 672px panel. toEqual
    // (not toMatchObject) also proves the offset option is GONE.
    expect(opts).toEqual({
      padding: {
        top: COMPARE_FRAME_PADDING_PX,
        bottom: COMPARE_FRAME_PADDING_PX,
        left: COMPARE_FRAME_PADDING_PX,
        right: COMPARE_FRAME_PADDING_PX + COMPARE_PANEL_FOOTPRINT_PX,
      },
    })
    expect(fake.calls.flyTo).toHaveBeenCalledTimes(1)
  })

  it('mobile: flat symmetric padding (the sheet-aware bottom padding is C6, not B6)', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    )
    const fake = createFakeMapRef()
    flyToComparePair(fake.map, FRANCE, GERMANY)
    const opts = fake.calls.cameraForBounds.mock.calls[0][1]
    expect(opts).toEqual({
      padding: {
        top: COMPARE_FRAME_PADDING_PX,
        bottom: COMPARE_FRAME_PADDING_PX,
        left: COMPARE_FRAME_PADDING_PX,
        right: COMPARE_FRAME_PADDING_PX,
      },
    })
  })

  it('falls back to the pair midpoint at world zoom when the span exceeds a globe face (Japan+USA)', () => {
    const fake = createFakeMapRef()
    flyToComparePair(fake.map, JAPAN, USA)
    // A globe face physically cannot frame a ~169°-plus span — cameraForBounds
    // is skipped entirely in favor of the midpoint fallback (spec §3, kept by B6).
    expect(fake.calls.cameraForBounds).not.toHaveBeenCalled()
    expect(fake.calls.flyTo).toHaveBeenCalledTimes(1)
    const flyToArgs = fake.calls.flyTo.mock.calls[0][0] as {
      center: [number, number]
      zoom: number
    }
    expect(flyToArgs.zoom).toBe(1.8)
    // -97 shifted to +263 (antimeridian normalization); (138 + 263) / 2 = 200.5
    expect(flyToArgs.center[0]).toBeCloseTo(200.5, 0)
    expect(flyToArgs.center[1]).toBe(37)
  })

  it('is a no-op when cameraForBounds returns undefined', () => {
    const fake = createFakeMapRef()
    ;(fake.map.cameraForBounds as ReturnType<typeof vi.fn>).mockReturnValue(undefined)
    flyToComparePair(fake.map, FRANCE, GERMANY)
    expect(fake.calls.flyTo).not.toHaveBeenCalled()
  })

  it('reduced motion flies with duration 0', () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true)
    const fake = createFakeMapRef()
    flyToComparePair(fake.map, FRANCE, GERMANY)
    expect(fake.calls.flyTo.mock.calls[0][0]).toMatchObject({ duration: 0, pitch: 0 })
  })

  it('falls back to symmetric padding at globe-scale zooms so wide pairs stay centered', () => {
    const fake = createFakeMapRef()
    ;(fake.map.cameraForBounds as ReturnType<typeof vi.fn>).mockReturnValue({
      center: [-25, 0],
      zoom: 1.6,
    })
    flyToComparePair(fake.map, BRAZIL, NIGERIA)
    expect(fake.calls.cameraForBounds).toHaveBeenCalledTimes(2)
    const secondOpts = fake.calls.cameraForBounds.mock.calls[1][1]
    // A bare number is CameraForBoundsOptions' uniform-padding form.
    expect(secondOpts).toEqual({ padding: COMPARE_FRAME_PADDING_PX })
    expect(fake.calls.flyTo).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Update the layoutConstants unit tests.** In `src/lib/__tests__/layoutConstants.test.ts`, add `COMPARE_FRAME_PADDING_PX` and `comparePanelPadding` to the existing import block from `'../layoutConstants'` (lines 15–28), then replace this test (lines 48–62):

```ts
  it('panelScreenOffset centers in the un-occluded area', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    )
    expect(panelScreenOffset('single')).toEqual([-SINGLE_PANEL_FOOTPRINT_PX / 2, 0])
    expect(panelScreenOffset('compare')).toEqual([-COMPARE_PANEL_FOOTPRINT_PX / 2, 0])
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    )
    vi.stubGlobal('innerHeight', 800)
    expect(panelScreenOffset('single')).toEqual([0, -160]) // 800 * 0.4 / 2
    expect(panelScreenOffset('compare')).toEqual([0, -320]) // 800 * 0.8 / 2
  })
```

with:

```ts
  it('panelScreenOffset centers the single-country fly-to in the un-occluded area', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    )
    expect(panelScreenOffset()).toEqual([-SINGLE_PANEL_FOOTPRINT_PX / 2, 0])
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    )
    vi.stubGlobal('innerHeight', 800)
    expect(panelScreenOffset()).toEqual([0, -160]) // 800 * 0.4 / 2
  })

  it('comparePanelPadding reserves the panel footprint on desktop, stays flat on mobile (B6)', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    )
    expect(comparePanelPadding()).toEqual({
      top: COMPARE_FRAME_PADDING_PX,
      bottom: COMPARE_FRAME_PADDING_PX,
      left: COMPARE_FRAME_PADDING_PX,
      right: COMPARE_FRAME_PADDING_PX + COMPARE_PANEL_FOOTPRINT_PX,
    })
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    )
    // Mobile compare framing (sheet-fraction bottom padding) is C6's change —
    // B6 deliberately ships flat 80s there (spec: "Mobile compare framing is
    // C6's padding change").
    expect(comparePanelPadding()).toEqual({ top: 80, bottom: 80, left: 80, right: 80 })
  })
```

(`COMPARE_PANEL_FOOTPRINT_PX` and `COMPARE_SHEET_FRACTION` stay imported — the class-drift tests at lines 39–42 still use them.)

- [ ] **Step 3: Run both test files and see them fail.** Run: `npx vitest run src/lib/__tests__/flyToComparePair.test.ts src/lib/__tests__/layoutConstants.test.ts` — expected failure: `SyntaxError: The requested module '../layoutConstants' does not provide an export named 'COMPARE_FRAME_PADDING_PX'` (both files fail to even load; the assertions would fail on `padding`/`offset` shape afterwards).

- [ ] **Step 4: Implement the layoutConstants changes.** In `src/lib/layoutConstants.ts`: (a) add the type import as the first code line, directly after the file-header doc comment (the file currently has no imports):

```ts
import type { PaddingOptions } from 'maplibre-gl'
```

(b) replace the current `panelScreenOffset` (lines 25–32):

```ts
/** Screen-space camera offset so a fly-to target centers in the area the
 *  open panel does not cover. */
export function panelScreenOffset(kind: 'single' | 'compare'): [number, number] {
  const footprint = kind === 'compare' ? COMPARE_PANEL_FOOTPRINT_PX : SINGLE_PANEL_FOOTPRINT_PX
  if (window.matchMedia(DESKTOP_MEDIA_QUERY).matches) return [-footprint / 2, 0]
  const fraction = kind === 'compare' ? COMPARE_SHEET_FRACTION : SHEET_COLLAPSED_FRACTION
  return [0, -Math.round((window.innerHeight * fraction) / 2)]
}
```

with:

```ts
/** Screen-space camera offset so the SINGLE-country fly-to centers in the
 *  area the open panel does not cover. Compare framing stopped consuming
 *  this in B6 (2026-07-28): an offset only shifts the center while
 *  cameraForBounds sizes zoom to the FULL viewport, so country B slid under
 *  the compare panel — comparePanelPadding() replaced it. */
export function panelScreenOffset(): [number, number] {
  if (window.matchMedia(DESKTOP_MEDIA_QUERY).matches) return [-SINGLE_PANEL_FOOTPRINT_PX / 2, 0]
  return [0, -Math.round((window.innerHeight * SHEET_COLLAPSED_FRACTION) / 2)]
}

/** Breathing room around the framed compare pair on every un-occluded side. */
export const COMPARE_FRAME_PADDING_PX = 80

/** cameraForBounds padding that frames the compare pair in the area the
 *  compare panel does not cover (B6, 2026-07-28). Desktop reserves the panel
 *  footprint as extra `right` padding — cameraForBounds folds padding into
 *  BOTH zoom and center, which the replaced screen offset could not do.
 *  Mobile deliberately stays flat: the sheet-aware bottom padding
 *  (innerHeight × COMPARE_SHEET_FRACTION) ships with C6's compare-sheet
 *  redesign, which owns mobile compare framing (spec C6/G3). */
export function comparePanelPadding(): PaddingOptions {
  const panel = window.matchMedia(DESKTOP_MEDIA_QUERY).matches ? COMPARE_PANEL_FOOTPRINT_PX : 0
  return {
    top: COMPARE_FRAME_PADDING_PX,
    bottom: COMPARE_FRAME_PADDING_PX,
    left: COMPARE_FRAME_PADDING_PX,
    right: COMPARE_FRAME_PADDING_PX + panel,
  }
}
```

- [ ] **Step 5: Implement the padding-based `flyToComparePair` and the `flyToCountry` call-site fix.** (a) In `src/lib/flyToCountry.ts` line 37, change `offset: panelScreenOffset('single'),` to `offset: panelScreenOffset(),` (the rest of the file is untouched). (b) Replace the entire contents of `src/lib/flyToComparePair.ts` with (the bounds/fallback code is byte-identical to today; the header comment, imports, and the camera block change):

```ts
import type maplibregl from 'maplibre-gl'
import type { CountryData } from './types'
import { DEFAULT_PITCH, DEFAULT_ZOOM } from './mapStyles'
import { prefersReducedMotion } from './motion'
import { COMPARE_FRAME_PADDING_PX, comparePanelPadding } from './layoutConstants'

/** Approximate a country's half-extent in degrees of latitude: half the side
 *  of the equivalent-area square (sqrt(area) km / 2) at ~111 km per degree.
 *  France (543,908 km²) → ~3.3°, matching its real ~6.5° half-span well
 *  enough for framing. */
function halfExtentDeg(country: CountryData): number {
  return Math.sqrt(Math.max(country.area, 0)) / 222
}

/** Frame BOTH compared countries in the area the compare panel does not
 *  cover. B6 (2026-07-28) replaced batch-2's screen offset with asymmetric
 *  cameraForBounds padding (the panel footprint as extra `right` padding,
 *  from comparePanelPadding): an offset only shifted the center while zoom
 *  stayed sized to the FULL viewport, so country B still slid under the
 *  panel — padding folds the occluded area into BOTH zoom and center, and
 *  the returned camera bakes the shift in, so the flyTo needs no padding.
 *  Centroid bounds are extended by area-derived half-extents because raw
 *  centroid boxes underframe adjacent pairs (live pass 2026-07-11) — padding
 *  alone can't absorb the shortfall for neighbours like France/Germany.
 *  Longitudes >180° apart are shifted so the box crosses the antimeridian
 *  instead of wrapping the long way. Pairs wider than a globe face (>110°,
 *  e.g. Japan+USA) skip framing entirely and fly to the pair's midpoint at
 *  world zoom instead — no padding trick can fit both countries in one
 *  globe-projection frame (batch-2 spec §3's designed fallback, kept by B6;
 *  live pass 2026-07-11). */
export function flyToComparePair(map: maplibregl.Map, a: CountryData, b: CountryData): void {
  const [latA, lngA] = a.latlng
  const [latB, rawLngB] = b.latlng
  const lngB = Math.abs(rawLngB - lngA) > 180 ? rawLngB + (rawLngB < lngA ? 360 : -360) : rawLngB

  const rA = halfExtentDeg(a)
  const rB = halfExtentDeg(b)
  const lngScale = (lat: number) => 1 / Math.cos((Math.min(Math.abs(lat), 75) * Math.PI) / 180)

  const bounds: [[number, number], [number, number]] = [
    [
      Math.min(lngA - rA * lngScale(latA), lngB - rB * lngScale(latB)),
      Math.min(latA - rA, latB - rB),
    ],
    [
      Math.max(lngA + rA * lngScale(latA), lngB + rB * lngScale(latB)),
      Math.max(latA + rA, latB + rB),
    ],
  ]
  const reducedMotion = prefersReducedMotion()

  const [[west], [east]] = bounds
  // A globe face cannot frame a pair this wide no matter the padding — fall
  // back to the pair's midpoint at world zoom (spec §3's designed fallback;
  // Japan+USA live pass 2026-07-11). lngB is already antimeridian-shifted,
  // so the arithmetic midpoint is the circular midpoint.
  const WIDE_PAIR_SPAN_DEG = 110
  if (east - west > WIDE_PAIR_SPAN_DEG) {
    map.flyTo({
      center: [(lngA + lngB) / 2, (latA + latB) / 2],
      zoom: DEFAULT_ZOOM,
      pitch: reducedMotion ? 0 : DEFAULT_PITCH,
      duration: reducedMotion ? 0 : 1400,
      curve: 1.5,
    })
    return
  }

  const paddedCamera = map.cameraForBounds(bounds, { padding: comparePanelPadding() })
  if (!paddedCamera) return
  // At globe-scale zooms the panel-footprint padding equates to tens of
  // degrees of rotation and can swing one country past the horizon (the
  // failure mode batch-2's offset showed on Japan+USA, live pass 2026-07-11).
  // The un-occluded viewport still shows the whole globe face there, so fall
  // back to symmetric padding. B6 keeps this guard as the CONSERVATIVE
  // DEFAULT — remove only after the live matrix in the B-core plan passes
  // without it. NOTE: padded zooms run systematically lower than the
  // offset-era zooms this 2.2 threshold was tuned against (the footprint now
  // shrinks the fitting area by ~672px), so the guard fires for more pairs
  // than before — part of what the live step evaluates.
  const GLOBE_SCALE_ZOOM = 2.2
  const camera =
    (paddedCamera.zoom ?? 0) < GLOBE_SCALE_ZOOM
      ? (map.cameraForBounds(bounds, { padding: COMPARE_FRAME_PADDING_PX }) ?? paddedCamera)
      : paddedCamera

  map.flyTo({
    ...camera,
    pitch: reducedMotion ? 0 : DEFAULT_PITCH,
    duration: reducedMotion ? 0 : 1400,
    curve: 1.5,
  })
}
```

- [ ] **Step 6: Run the unit tests green.** Run: `npx vitest run src/lib/__tests__/flyToComparePair.test.ts src/lib/__tests__/layoutConstants.test.ts src/hooks/__tests__/useSelectionHighlight.test.tsx src/hooks/__tests__/useMapInteractions.test.ts` — all pass (`useSelectionHighlight.test.tsx` mocks `flyToComparePair` so it is unaffected; it and `useMapInteractions.test.ts` are run as the blast-radius check for the signature change).

- [ ] **Step 7: Add the e2e framing regression test, red-verify it against the old mechanism, then run green.** Append to `e2e/compare-map-clicks.spec.ts` (after the closing `})` of the `'ocean click during compare-picking mode (regression)'` describe, line 162 — NOT inside it):

```ts
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
```

Then: (a) ensure nothing is listening on port 5173 (project memory — a stale dev/preview server would serve a build without the right code: check with `Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue` and stop the owning process); (b) red-verify: `git stash push -- src` then `npx playwright test e2e/compare-map-clicks.spec.ts --project=chromium --workers=2` — expected: the new test FAILS (`expect.poll` timeout, received `false` — Ukraine projects under the panel) while the five pre-existing tests pass; (c) `git stash pop`, kill port 5173 again if needed, re-run the same command — expected: all 6 tests pass. The pre-existing tests double as the framing regression net (their `fireClickWhere` preconditions require A and a third country on screen).

- [ ] **Step 8: Live verification — the `GLOBE_SCALE_ZOOM` guard decision procedure.** Start the app (`npm run dev`, desktop-width browser window ≥1024px) and check this matrix. The guard's branch logic is unit-proven (Step 1's last test); what is NOT provable in units is globe-projection horizon behavior, which is why these are explicit live checks:

  1. `http://localhost:5173/#JPN,USA` — expected: the >110° wide-pair **midpoint fallback** (whole globe face at world zoom 1.8, midpoint over the Pacific, both Japan and the USA visible). This path never reaches the guard; it verifies the kept fallback is intact.
  2. `http://localhost:5173/#FRA,DEU` — expected: both countries fully visible in the strip **left of** the 656px panel with visible margin; neither clipped by the panel edge. (This pair resolves well above zoom 2.2 — it verifies the padding path, not the guard.)
  3. `http://localhost:5173/#BRA,NGA` — the pair that actually trips the guard under the new mechanism (~81° span; the padded camera resolves below zoom 2.2 at 1280px-class viewports). Expected WITH the guard: symmetric-padding framing — whole globe face, pair centered on the full viewport, Nigeria possibly partially under the panel but nothing swung past the horizon.
  4. Now probe removal: temporarily comment out the four `const camera = ...` guard lines and use `paddedCamera` directly, reload cases 2 and 3. Removal criteria — ALL must hold: (a) case 1 unchanged (it never reaches this code); (b) case 2 unchanged; (c) case 3 shows BOTH countries fully on the visible globe face (nothing rotated past the horizon) AND inside the un-occluded strip.

  **Decision (conservative default, per spec risk note "the guards encode live findings; they are kept until the padding approach passes the same live cases"):** if any criterion fails or is ambiguous, restore the guard exactly as written in Step 5 and ship it — record the observed behavior in the commit body. Only if all criteria clearly pass: delete the guard block (the `GLOBE_SCALE_ZOOM` const, the `const camera = ...` ternary, and its comment), pass `paddedCamera` to `flyTo` directly, drop `COMPARE_FRAME_PADDING_PX` from the `flyToComparePair.ts` import (it stays exported from `layoutConstants.ts` — `comparePanelPadding` uses it), delete the `'falls back to symmetric padding at globe-scale zooms...'` unit test from Step 1's file, re-run Step 6's command green, and state "GLOBE_SCALE_ZOOM guard removed after live pass: JPN+USA / FRA+DEU / BRA+NGA all clean without it" in the commit body.

- [ ] **Step 9 (OPTIONAL — A/B centroid markers; gate on B1):** Run `git grep -n "country-labels" -- src/lib/mapLayers.ts`. If there is **no** match, B1 (this plan's earlier task) has slipped — **skip Steps 9–12 entirely**, note "B6 markers deferred pending B1 (spec: 'defer if B1 hasn't landed')" in the commit body, and jump to Step 13. If it matches, write the failing marker tests. (a) Append to `src/lib/__tests__/mapLayers.test.ts` (add `addCompareMarkerLayer, applyCompareMarkers` to the existing `'../mapLayers'` import list, plus two new imports at the top: `import type maplibregl from 'maplibre-gl'` and `import { makeCountryData } from '../../test/countryFixtures'`):

```ts
describe("compare A/B centroid markers (B6 — rides on B1's glyph pattern)", () => {
  it('adds a country- prefixed symbol layer with explicit Noto Sans Bold, hidden by default', () => {
    const fake = createFakeMapRef()
    addCompareMarkerLayer(fake.map)
    expect(fake.calls.addSource).toHaveBeenCalledWith('compare-markers', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
    const spec = fake.addedLayers.find((s) => s.id === 'country-compare-markers') as
      | maplibregl.SymbolLayerSpecification
      | undefined
    expect(spec?.type).toBe('symbol')
    // The positron glyphs endpoint 404s MapLibre's default font stack — the
    // explicit Noto Sans Bold is B1's live-verified glyph decision.
    expect(spec?.layout?.['text-font']).toEqual(['Noto Sans Bold'])
    // Hidden until applyCompareMarkers shows it; the country- prefix keeps
    // applyBasemapLayerVisibility's custom-layer skip in force.
    expect(spec?.layout?.visibility).toBe('none')
  })

  it('applyCompareMarkers writes [lng, lat]-swapped A/B points and toggles visibility', () => {
    const fake = createFakeMapRef()
    const a = makeCountryData() // France, latlng [46, 2]
    const b = makeCountryData({ cca3: 'DEU', ccn3: '276', latlng: [51, 9] })
    applyCompareMarkers(fake.map, { a, b })
    expect(fake.calls.setData).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [2, 46] },
          properties: { label: 'A' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [9, 51] },
          properties: { label: 'B' },
        },
      ],
    })
    expect(fake.calls.setLayoutProperty).toHaveBeenLastCalledWith(
      'country-compare-markers',
      'visibility',
      'visible',
    )
    applyCompareMarkers(fake.map, null)
    expect(fake.calls.setData).toHaveBeenLastCalledWith({
      type: 'FeatureCollection',
      features: [],
    })
    expect(fake.calls.setLayoutProperty).toHaveBeenLastCalledWith(
      'country-compare-markers',
      'visibility',
      'none',
    )
  })
})
```

(b) Extend the hook-test fake in `src/test/fakeMapHooks.tsx` — replace `makeFakeMap` (lines 7–14):

```ts
/** Spy-backed stand-in for a MapLibre map, for hook tests that assert
 *  setFilter/setPaintProperty calls. */
export function makeFakeMap() {
  const calls: Record<string, unknown[][]> = { setFilter: [], setPaintProperty: [] }
  return {
    setFilter: vi.fn((...args: unknown[]) => calls.setFilter.push(args)),
    setPaintProperty: vi.fn((...args: unknown[]) => calls.setPaintProperty.push(args)),
    calls,
  }
}
```

with:

```ts
/** Spy-backed stand-in for a MapLibre map, for hook tests that assert
 *  setFilter/setPaintProperty/setLayoutProperty/GeoJSON-setData calls. */
export function makeFakeMap() {
  const calls: Record<string, unknown[][]> = {
    setFilter: [],
    setPaintProperty: [],
    setLayoutProperty: [],
    setData: [],
  }
  const setData = vi.fn((...args: unknown[]) => calls.setData.push(args))
  return {
    setFilter: vi.fn((...args: unknown[]) => calls.setFilter.push(args)),
    setPaintProperty: vi.fn((...args: unknown[]) => calls.setPaintProperty.push(args)),
    setLayoutProperty: vi.fn((...args: unknown[]) => calls.setLayoutProperty.push(args)),
    getSource: vi.fn(() => ({ setData })),
    setData,
    calls,
  }
}
```

(c) Append inside the `describe('useSelectionHighlight', ...)` block of `src/hooks/__tests__/useSelectionHighlight.test.tsx` (after the `'replacing B reframes the pair...'` test, before the describe's closing `})`):

```ts
  it('writes A/B centroid markers while comparing and clears them when compare ends (B6)', () => {
    const fake = makeFakeMap()
    const selected = makeCountry('250') // France, latlng [46, 2]
    const compareWith = makeCountryData({ cca3: 'DEU', ccn3: '276', latlng: [51, 9] })
    const { rerender } = renderHook<void, { compareWith: CountryData | null }>(
      (props) =>
        useSelectionHighlight({
          loaded: true,
          selected,
          selectionOriginRef: originRef(),
          compareWith: props.compareWith,
        }),
      { wrapper: makeMapWrapper(fake), initialProps: { compareWith } },
    )
    const written = fake.calls.setData.at(-1)?.[0] as GeoJSON.FeatureCollection
    expect(written.features.map((f) => f.properties?.label)).toEqual(['A', 'B'])
    // country.latlng is [lat, lng]; GeoJSON points are [lng, lat]
    expect((written.features[0].geometry as GeoJSON.Point).coordinates).toEqual([2, 46])
    expect(fake.calls.setLayoutProperty.at(-1)).toEqual([
      'country-compare-markers',
      'visibility',
      'visible',
    ])

    rerender({ compareWith: null })
    const cleared = fake.calls.setData.at(-1)?.[0] as GeoJSON.FeatureCollection
    expect(cleared.features).toEqual([])
    expect(fake.calls.setLayoutProperty.at(-1)).toEqual([
      'country-compare-markers',
      'visibility',
      'none',
    ])
  })
```

- [ ] **Step 10 (OPTIONAL, continues 9): Run the marker tests and see them fail.** Run: `npx vitest run src/lib/__tests__/mapLayers.test.ts src/hooks/__tests__/useSelectionHighlight.test.tsx` — expected: `SyntaxError: The requested module '../mapLayers' does not provide an export named 'addCompareMarkerLayer'`, and the new hook test fails (`setData` never called / `calls.setData.at(-1)` undefined).

- [ ] **Step 11 (OPTIONAL, continues 9): Implement the marker layer, its owner, and the wiring.** (a) In `src/lib/mapLayers.ts`: add `import type { CountryData } from './types'` next to the existing imports (line 1 block; `CORAL` and `TEAL_DIM` are already imported from `./mapPalette` on line 8); add to the `LAYER` registry (insert after `compareExtrusion: 'country-compare-extrusion',`, line 245):

```ts
  compareMarkers: 'country-compare-markers',
```

then append after `applyBasemapLayerVisibility` (end of file):

```ts
/** Compare A/B centroid markers — one symbol layer labelling the pair on the
 *  map in the compare badge colors (A coral / B teal-dim; index.css's
 *  .compare-badge-a/-b hardcode the same mapPalette hexes). Rides on B1's
 *  label-layer pattern: `text-font` MUST be explicit because the positron
 *  glyphs endpoint 404s MapLibre's default font stack (B1 glyph decision,
 *  live-verified 2026-07-27). The `country-` prefix keeps
 *  applyBasemapLayerVisibility's custom-layer skip in force. Add AFTER B1's
 *  country-labels layer so A/B draw above the name labels. */
export function addCompareMarkerLayer(map: maplibregl.Map): void {
  map.addSource('compare-markers', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer({
    id: LAYER.compareMarkers,
    type: 'symbol',
    source: 'compare-markers',
    layout: {
      visibility: 'none',
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 14,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': ['match', ['get', 'label'], 'A', CORAL, TEAL_DIM],
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
    },
  })
}

/** Single owner of the compare-marker source data + visibility (the repo's
 *  single-paint-owner rule). Pass the pair to label A/B at their centroids,
 *  or null to clear — called from useSelectionHighlight's compare effect. */
export function applyCompareMarkers(
  map: maplibregl.Map,
  pair: { a: CountryData; b: CountryData } | null,
): void {
  const source = map.getSource('compare-markers') as maplibregl.GeoJSONSource | undefined
  if (!source) return
  const features: GeoJSON.Feature<GeoJSON.Point>[] = pair
    ? [
        { label: 'A', c: pair.a },
        { label: 'B', c: pair.b },
      ].map(({ label, c }) => ({
        type: 'Feature',
        // country.latlng is [lat, lng]; GeoJSON wants [lng, lat]
        geometry: { type: 'Point', coordinates: [c.latlng[1], c.latlng[0]] },
        properties: { label },
      }))
    : []
  source.setData({ type: 'FeatureCollection', features })
  map.setLayoutProperty(LAYER.compareMarkers, 'visibility', pair ? 'visible' : 'none')
}
```

(b) In `src/components/WorldMap.tsx`: add `addCompareMarkerLayer,` to the `'../lib/mapLayers'` import list (lines 7–15), and in `onLoad` insert `addCompareMarkerLayer(map)` on its own line AFTER B1's country-labels add call and before `applyWarmLighting(map)` (line 60 today; B1's task inserted its own call into this sequence — markers must be the later of the two so A/B render above the name labels). (c) In `src/hooks/useSelectionHighlight.ts`: change line 6 from `import { EMPTY_FILTER as EMPTY, LAYER } from '../lib/mapLayers'` to `import { EMPTY_FILTER as EMPTY, LAYER, applyCompareMarkers } from '../lib/mapLayers'`, and in the second effect insert after `applyOrClearFilter(map, COMPARE_LAYERS, compareWith?.ccn3 ?? null)` (line 65):

```ts
    applyCompareMarkers(map, compareWith && selected ? { a: selected, b: compareWith } : null)
```

- [ ] **Step 12 (OPTIONAL, continues 9): Marker tests green + doc count.** Run: `npx vitest run src/lib/__tests__/mapLayers.test.ts src/hooks/__tests__/useSelectionHighlight.test.tsx` — all pass. Then update `docs/systems/map-rendering.md` line 60, which pins the `LAYER` registry size ("the full registry is `LAYER` in `src/lib/mapLayers.ts` (13 ids)" pre-B1): increment the count by one for `compareMarkers` (after B1's own bump it should read 15; whatever it currently says, set it to the actual `Object.keys(LAYER).length`). Live-check the markers while the Step 8 dev server is up: `#FRA,DEU` shows a coral "A" over France and a teal "B" over Germany in BOTH basemaps; exiting compare removes them; starting a game never shows them (compare exits before play).

- [ ] **Step 13: Full gate and commit (one commit).** Kill any stray dev server (port 5173, project memory), then run `npm run check` (green) and `npx playwright test e2e/compare-map-clicks.spec.ts e2e/compare-view-dimming.spec.ts --project=chromium --workers=2` (green — `compare-view-dimming` is the paint-side compare spec whose `#FRA,DEU` flow rides the new framing). Commit everything in ONE commit (drop the Step 9–12 paths from `git add` if the B1 gate said skip; adjust the guard sentence per Step 8's outcome):

```
git add src/lib/layoutConstants.ts src/lib/flyToComparePair.ts src/lib/flyToCountry.ts src/lib/__tests__/flyToComparePair.test.ts src/lib/__tests__/layoutConstants.test.ts e2e/compare-map-clicks.spec.ts src/lib/mapLayers.ts src/lib/__tests__/mapLayers.test.ts src/test/fakeMapHooks.tsx src/hooks/useSelectionHighlight.ts src/hooks/__tests__/useSelectionHighlight.test.tsx src/components/WorldMap.tsx docs/systems/map-rendering.md
git commit -m "feat(compare): frame pairs with asymmetric cameraForBounds padding (B6)" -m "Replaces batch-2's screen offset: an offset only shifted the center while zoom stayed sized to the full viewport, so country B slid under the 672px panel. comparePanelPadding() reserves the panel footprint as right padding on desktop (mobile stays flat; sheet-aware bottom padding is C6's). Keeps the >110 degree wide-pair midpoint fallback. GLOBE_SCALE_ZOOM guard: <kept as conservative default / removed> after the JPN+USA, FRA+DEU, BRA+NGA live matrix — <observed outcomes>. A/B centroid markers: <shipped riding B1's glyph pattern / deferred pending B1>." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 8: B7 — map control polish (44px coarse touch targets, crosshair-globe reset glyph, theme pins)

**One commit.** The map controls are already app-styled (A3 shipped the light base + `.dark` overrides for the whole ctrl block in `src/index.css` lines 246–328 — group surface, button color, hover, separators, icon filter, attribution, tooltip). The remaining B7 gaps are: (1) MapLibre's stock buttons are 29×29px — below the app's 44px touch-target convention (A13, `src/lib/layoutConstants.ts`); (2) the hand-built reset glyph (globe + corner arrow `M20 4 L20 9 L15 9`) is ambiguous — it reads as "redo/refresh", not "re-center". The light-theme sub-item from the spec is **already covered by A3** — this task verifies that and locks it with e2e color pins instead of re-implementing it.

**Mechanism decision (44px):** the A13 `TOUCH_TARGET_*` constants are Tailwind `className` strings — MapLibre builds the zoom/compass buttons imperatively inside vendor DOM, so there is no JSX to attach them to. The invisible-`::after` hit-extension also doesn't fit here: the ctrl-group stacks its buttons flush (1px `border-top` seams), so ±7.5px `::after` overlays would overlap across the seams and the later sibling would steal taps on the shared strip (WCAG 2.5.8 also wants non-overlapping targets). Instead the buttons genuinely grow via `min-width/min-height: 44px` under `@media (pointer: coarse)` — `min-*` outranks MapLibre's stock `width/height: 29px` without re-specifying them, and the stock icon sprites stay 29px centered (`background-position: 50%`, no `background-size`), so glyphs don't scale. Fine-pointer desktops keep the stock 29px.

**Files:**

- Modify: `src/lib/resetViewControl.ts` (lines 52–58 — replace the arrow path with reticle ticks)
- Create: `src/lib/__tests__/resetViewControl.test.ts`
- Modify: `src/lib/layoutConstants.ts` (append `TOUCH_TARGET_MIN_PX` after line 72)
- Modify: `src/lib/__tests__/layoutConstants.test.ts` (imports at lines 8–28; new describe after line 140)
- Modify: `src/index.css` (insert `@media (pointer: coarse)` block after line 285)
- Modify: `e2e/a11y-contrast.spec.ts` (two color pins inside the `Meta-color contrast` describe ending line 118; new describe before the file's closing at line 132)
- Modify: `docs/systems/ui-layout.md` (§ Map Controls, lines 75–78)
- Tests: `src/lib/__tests__/resetViewControl.test.ts`, `src/lib/__tests__/layoutConstants.test.ts`, `e2e/a11y-contrast.spec.ts`

**Interfaces:**

- Consumes: `stubMatchMedia(matches?): () => void` from `src/test/matchMediaStub.ts` (jsdom has no `matchMedia`; `flyToHome` → `prefersReducedMotion()` needs it); `DEFAULT_CENTER: [number, number]`, `DEFAULT_ZOOM: number`, `DEFAULT_PITCH: number` from `src/lib/mapStyles.ts`; `ensureLauncherDismissed(page: Page)` from `e2e/helpers.ts`.
- Produces: `TOUCH_TARGET_MIN_PX = 44` in `src/lib/layoutConstants.ts` — the named owner of the 44px convention floor (the existing `TOUCH_TARGET_*` strings encode it implicitly in their inset math; the map-control CSS names it literally and the pinning test ties the two together). Future consumers import it from `layoutConstants.ts`; do not redeclare `44` elsewhere.

- [ ] **Step 1: Write the failing unit test for the reset control**

Create `src/lib/__tests__/resetViewControl.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import type maplibregl from 'maplibre-gl'
import { ResetViewControl } from '../resetViewControl'
import { DEFAULT_CENTER, DEFAULT_ZOOM, DEFAULT_PITCH } from '../mapStyles'
import { stubMatchMedia } from '../../test/matchMediaStub'

const CROSSHAIR_TICKS_D = 'M12 1v3 M12 20v3 M1 12h3 M20 12h3'
const LEGACY_ARROW_D = 'M20 4 L20 9 L15 9'

function mountControl() {
  const flyTo = vi.fn()
  const control = new ResetViewControl()
  const container = control.onAdd({ flyTo } as unknown as maplibregl.Map)
  return { container, flyTo }
}

describe('ResetViewControl', () => {
  it('renders the crosshair-globe glyph (reticle ticks; legacy arrow gone)', () => {
    const { container } = mountControl()
    const pathDs = Array.from(container.querySelectorAll('svg path')).map((p) =>
      p.getAttribute('d'),
    )
    expect(pathDs).toContain(CROSSHAIR_TICKS_D)
    expect(pathDs).not.toContain(LEGACY_ARROW_D)
    // Still reads as a globe: circle + meridian survive the redraw.
    expect(container.querySelector('svg circle')).not.toBeNull()
    expect(container.querySelector('svg ellipse')).not.toBeNull()
  })

  it('keeps the accessible name and flies home on click', () => {
    const restore = stubMatchMedia() // flyToHome → prefersReducedMotion → window.matchMedia
    try {
      const { container, flyTo } = mountControl()
      const button = container.querySelector('button')
      expect(button?.getAttribute('aria-label')).toBe('Reset to world view')
      button?.click()
      expect(flyTo).toHaveBeenCalledWith({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: DEFAULT_PITCH,
        bearing: 0,
        duration: 1400,
      })
    } finally {
      restore()
    }
  })
})
```

- [ ] **Step 2: Run it and watch the glyph test fail**

```
npx vitest run src/lib/__tests__/resetViewControl.test.ts
```

Expected: 1 failed, 1 passed. The glyph test fails with `AssertionError: expected [ 'M20 4 L20 9 L15 9' ] to include 'M12 1v3 M12 20v3 M1 12h3 M20 12h3'`. The second test (accessible name + flyTo) passes already — it pins existing behavior the redraw must not break.

- [ ] **Step 3: Redraw the glyph in `src/lib/resetViewControl.ts`**

Replace (current lines 52–58):

```ts
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    arrow.setAttribute('d', 'M20 4 L20 9 L15 9')

    svg.appendChild(circle)
    svg.appendChild(meridian)
    svg.appendChild(arrow)
```

with:

```ts
    // Crosshair-globe: the globe (circle + meridian) centered in a reticle —
    // four crosshair ticks with a 1px gap to the circle edge (circle spans
    // y 5..19; ticks run 1→4 and 20→23). Reads as "re-center the globe" and
    // echoes the reticle brand mark (spec 2026-07-26, B7 + E3). Replaces the
    // ambiguous corner-arrow glyph, which read as "redo/refresh".
    const ticks = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    ticks.setAttribute('d', 'M12 1v3 M12 20v3 M1 12h3 M20 12h3')

    svg.appendChild(circle)
    svg.appendChild(meridian)
    svg.appendChild(ticks)
```

Everything else in the file (circle, meridian, button wiring, `flyToHome`) is untouched.

- [ ] **Step 4: Run the unit test green**

```
npx vitest run src/lib/__tests__/resetViewControl.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Write the failing drift-alarm pin for the 44px CSS**

In `src/lib/__tests__/layoutConstants.test.ts`, extend the import block (lines 15–28) — add `TOUCH_TARGET_MIN_PX` to the `../layoutConstants` import list, and add one new `?raw` import after line 14 (`import cityGuessingHudSource ...`):

```ts
import indexCssSource from '../../index.css?raw'
```

Then append at the end of the file (after the closing `})` of the `A13 supplemental touch targets` describe, line 140):

```ts

describe('B7 map-control touch-target drift alarm', () => {
  it('index.css grows vendor ctrl buttons to the convention floor under pointer: coarse', () => {
    // MapLibre's ctrl buttons are vendor-built DOM — the Tailwind
    // TOUCH_TARGET_* class strings can't reach them, so index.css sizes
    // them directly. This pin ties the raw CSS to the named constant:
    // change either side and this test names the other.
    expect(TOUCH_TARGET_MIN_PX).toBe(44)
    expect(indexCssSource).toContain(
      `@media (pointer: coarse) {
  .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button {
    min-width: ${TOUCH_TARGET_MIN_PX}px;
    min-height: ${TOUCH_TARGET_MIN_PX}px;
  }
}`,
    )
  })
})
```

- [ ] **Step 6: Run it and watch it fail**

```
npx vitest run src/lib/__tests__/layoutConstants.test.ts
```

Expected: transform/build error — `"../layoutConstants"` has no exported member named `TOUCH_TARGET_MIN_PX` (the suite fails to load before any test runs).

- [ ] **Step 7: Implement the constant and the CSS**

Append to `src/lib/layoutConstants.ts` (after the `TOUCH_TARGET_FROM_32` block, line 72):

```ts

/** ── B7 map-control touch targets ───────────────────────────────────────
 * The convention floor (px) that all the TOUCH_TARGET_* insets above are
 * computed against, named once. MapLibre's ctrl buttons are vendor-built
 * DOM with no className hook for the Tailwind constants, so index.css
 * grows them directly with `min-width/min-height: 44px` under
 * `@media (pointer: coarse)` — layoutConstants.test.ts pins that raw CSS
 * to this constant. */
export const TOUCH_TARGET_MIN_PX = 44
```

In `src/index.css`, insert after the rule ending at line 285:

```css
.dark .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button + button {
  border-top-color: rgba(94, 234, 212, 0.15);
}
```

this new block (before the `/* MapLibre compass/zoom icon color override ... */` comment at line 287):

```css

/* B7 coarse-pointer touch targets: grow the vendor ctrl buttons from
   MapLibre's stock 29px to the app's 44px convention floor
   (TOUCH_TARGET_MIN_PX in src/lib/layoutConstants.ts — this literal CSS is
   pinned to it by layoutConstants.test.ts). Real enlargement, not the A13
   invisible-::after hit extension, for two reasons: (1) the TOUCH_TARGET_*
   constants are Tailwind className strings and MapLibre builds these
   buttons imperatively — no JSX to attach them to; (2) the ctrl-group
   stacks its buttons flush, so overlapping ::after hit boxes would let the
   later sibling steal taps on the shared seam (WCAG 2.5.8 wants targets
   non-overlapping). min-width/min-height outrank the stock
   `width/height: 29px` without re-specifying them; the stock icon sprites
   stay 29px centered (background-position: 50%, no background-size), so
   glyphs don't scale. Fine pointers keep the stock 29px. */
@media (pointer: coarse) {
  .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button {
    min-width: 44px;
    min-height: 44px;
  }
}
```

- [ ] **Step 8: Run the pin test green**

```
npx vitest run src/lib/__tests__/layoutConstants.test.ts
```

Expected: all tests pass (the pre-existing A13 describes plus the new B7 describe).

- [ ] **Step 9: Extend `e2e/a11y-contrast.spec.ts` — theme pins + coarse-target assertion**

**A3 coverage verification (spec sub-item "light-theme variant"):** `src/index.css` on this branch already ships the full light chrome for the ctrl block — light base + `.dark` overrides for the group surface (lines 248–260), button color (262–269), hover (271–277), separators (279–285), the dark-only icon filter (290–292, correct: stock icons are dark gray, already legible on the light sand surface), plus attribution and tooltip. **No new light-theme CSS is needed; the sub-item is closed by pinning it.** The two color tests below therefore pass on first run — they are regression pins locking A3's coverage against future ctrl-block edits, not failing-first tests (the failing-first cycle for this task's CSS was Steps 5–8).

In the `test.describe('Meta-color contrast', ...)` block, insert after the closing `})` of the `'header wordmark keeps teal-light in dark mode'` test (line 117) and before the describe's closing `})` (line 118):

```ts

    test('map nav-control buttons use teal-accessible in light mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'light'))
      await page.goto('/')
      await ensureLauncherDismissed(page)
      const button = page
        .locator('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button')
        .first()
      await expect(button).toBeVisible()
      expect(await computedColor(button)).toContain(TEAL_ACCESSIBLE_RGB)
    })

    test('map nav-control buttons keep teal-light in dark mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'dark'))
      await page.goto('/')
      await ensureLauncherDismissed(page)
      const button = page
        .locator('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button')
        .first()
      await expect(button).toBeVisible()
      expect(await computedColor(button)).toContain(TEAL_LIGHT_RGB)
    })
```

Then insert a new describe before the outer `A11y + Contrast Pass` describe's final closing `})` (i.e. after the `Tabular figures on DataCell` describe closes at line 131):

```ts

  test.describe('Map control touch targets (B7)', () => {
    // Pixel-7-like emulation: isMobile + hasTouch flip Chromium's CSS
    // `pointer` media feature to coarse, so the `@media (pointer: coarse)`
    // block in src/index.css applies. Fine-pointer desktop runs keep
    // MapLibre's stock 29px buttons — that path is intentionally unasserted.
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    test('every bottom-right map control button is >= 44px on coarse pointers', async ({
      page,
    }) => {
      await page.goto('/')
      await ensureLauncherDismissed(page)
      const buttons = page.locator('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button')
      await expect(buttons.first()).toBeVisible()
      // zoom-in, zoom-out, compass (NavigationControl) + reset (ResetViewControl)
      await expect(buttons).toHaveCount(4)
      for (let i = 0; i < 4; i++) {
        const box = await buttons.nth(i).boundingBox()
        expect(box, `button ${i} bounding box`).not.toBeNull()
        expect(box!.width, `button ${i} width`).toBeGreaterThanOrEqual(44)
        expect(box!.height, `button ${i} height`).toBeGreaterThanOrEqual(44)
      }
    })

    test('reset control keeps its accessible name', async ({ page }) => {
      await page.goto('/')
      await ensureLauncherDismissed(page)
      await expect(page.getByRole('button', { name: 'Reset to world view' })).toBeVisible()
    })
  })
```

No new imports are needed (`ensureLauncherDismissed`, `expect`, `test` are already imported at lines 1–2; `computedColor`, `TEAL_ACCESSIBLE_RGB`, `TEAL_LIGHT_RGB` are in scope inside the Meta-color describe). No `waitForTimeout`, no `force: true`, auto-retrying `expect`s only — the controls are attached at map construction, before tiles, so no map-loaded wait is required.

- [ ] **Step 10: Run the e2e spec green**

Kill any stray dev server first (project memory: `reuseExistingServer` would reuse it without `VITE_TEST_HOOKS`):

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

then:

```
npx playwright test e2e/a11y-contrast.spec.ts --project=chromium --workers=2
```

Expected: all tests pass, including the four new ones (this spec is CI-covered — it is in the chromium `testMatch` and not in `testIgnore`, so no config change is needed).

- [ ] **Step 11: Update `docs/systems/ui-layout.md` § Map Controls (same-task doc rule)**

Replace (lines 75–78):

```markdown
- MapLibre's built-in `NavigationControl` (zoom +/−, compass)
- Custom "Reset view" button — flies the camera back to the default world view (longitude 0, latitude 20, zoom 1.8, pitch 20°, bearing 0). It does not touch selection: an open panel and the URL hash are preserved. (The Home key does the same while the map has focus.)
- Positioned bottom-right on desktop
- Repositioned to avoid bottom sheet overlap on mobile
```

with:

```markdown
- MapLibre's built-in `NavigationControl` (zoom +/−, compass)
- Custom "Reset view" button — a crosshair-globe (reticle) glyph; flies the camera back to the default world view (longitude 0, latitude 20, zoom 1.8, pitch 20°, bearing 0). It does not touch selection: an open panel and the URL hash are preserved. (The Home key does the same while the map has focus.)
- Positioned bottom-right on desktop
- Repositioned to avoid bottom sheet overlap on mobile
- On coarse pointers every control button grows to the 44px touch-target floor (`TOUCH_TARGET_MIN_PX` in `src/lib/layoutConstants.ts`, applied via `@media (pointer: coarse)` in `src/index.css` — vendor DOM, so real enlargement instead of the A13 `::after` hit extension); fine-pointer desktops keep MapLibre's stock 29px. Styled for both themes (light base + `.dark` overrides, shipped with A3).
```

- [ ] **Step 12: Full gates and commit (one commit)**

```
npm run check
```

Expected: lint, typecheck, and the full unit suite all green. Then:

```
git add src/lib/resetViewControl.ts src/lib/__tests__/resetViewControl.test.ts src/lib/layoutConstants.ts src/lib/__tests__/layoutConstants.test.ts src/index.css e2e/a11y-contrast.spec.ts docs/systems/ui-layout.md
git commit -m "feat(map): grow map controls to 44px coarse targets and redraw reset glyph (B7)" -m "Light-theme ctrl chrome verified already covered by A3; locked with e2e color pins instead of new CSS." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Workstream B-core verification sweep (final task — run after Tasks 1–8 are merged into the branch)

Close-out task for the B-core tranche (B1, B2, B4, B5, B6, B7 — B3 is explicitly severed to a later tranche). It runs the full gates, the affected e2e set split honestly into CI-covered vs local-only, a live pass, a docs-staleness check with concrete fallback edits, and the analytics confirmation. Steps 1–5 are verification (no code); Step 6 is conditional doc edits; commit only if Step 6 changed files.

**Files:**

- Modify (conditional, only if the Step 6 greps show the earlier tasks left them stale): `docs/systems/map-rendering.md` (§ Map Layers, line 60), `docs/systems/ui-layout.md` (§ Compare, line 108), `docs/systems/overview.md` (§ Data Flow → On Page Load, line 68)
- Tests: none created — this task runs the suites listed below

- [ ] **Step 1: Kill stray dev servers, then run the full unit + static gates**

Project memory: a background `npm run dev` on port 5173 gets reused by Playwright's `reuseExistingServer` **without** `VITE_TEST_HOOKS`, breaking every seam-based spec. Kill it first:

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Then:

```
npm run check
```

(`check` = `eslint src/ e2e/ scripts/` + `tsc -b` + `vitest run` — the full unit suite, satisfying the workstream's "full `npx vitest run`" commitment.) Expected: exit 0. Any red here is a Task 1–8 regression — fix in that task's file, do not proceed.

- [ ] **Step 2: Enumerate what this branch actually touched in e2e/, and verify project registration**

```
git diff --name-only main...HEAD -- e2e/
```

For every **new** `.spec.ts` file in that output, confirm its filename appears in the `chromium` project's `testMatch` array in `playwright.config.ts` (lines 57–96) — a spec absent from every project's `testMatch` silently never runs. Add any missing filename to the `chromium` `testMatch` (this is the CLAUDE.md "Before adding a new e2e test" rule the earlier task should have followed; fixing it here is part of the sweep). Include every changed/new spec from this output in the Step 3/4 runs below.

- [ ] **Step 3: Run the CI-covered affected e2e specs**

These are in the chromium `testMatch` and **not** in the CI `testIgnore` — CI will keep guarding them after merge:

```
npx playwright test e2e/satellite-default.spec.ts e2e/map-and-countries.spec.ts e2e/compare-view-dimming.spec.ts e2e/compare-map-clicks.spec.ts e2e/reveal-animation-reduced-motion.spec.ts e2e/game-city-guessing.spec.ts e2e/keyboard-map-nav.spec.ts e2e/a11y-contrast.spec.ts --project=chromium --workers=2
```

Coverage mapping: `satellite-default` + `game-city-guessing` (B1 label layer + play-gating), `map-and-countries` (layer-scoped `queryRenderedFeatures` invariant against the new fill layers), `compare-view-dimming` + `compare-map-clicks` (B4 spotlight, B6 camera), `reveal-animation-reduced-motion` (B5 static fallback), `keyboard-map-nav` (Home-key reset path B7 touched), `a11y-contrast` (B7 pins). Expected: all pass at `--workers=2` (CI parallelism — single-worker runs hide flakes).

- [ ] **Step 4: Run the local-only affected e2e specs**

These are excluded on CI via the chromium `testIgnore` (no GPU on free runners — tracking issue #106; `docs/systems/testing.md` § "What Runs in CI"). **CI will NOT guard them after merge — this local run is their only merge gate:**

```
npx playwright test e2e/reveal-animation.spec.ts e2e/game-country-pinning.spec.ts e2e/label-contrast.spec.ts e2e/theme-and-responsive.spec.ts e2e/accessibility.spec.ts e2e/axe-snapshot.spec.ts --project=chromium --workers=2
```

Coverage mapping: `reveal-animation` (B5 pulse waveform via the map seam), `game-country-pinning` (B1 in-game label hiding + B2's retired `gameActive` border branch), `label-contrast` (B1/B2 halo + border legibility), `theme-and-responsive` (the `index.css` theme surface B7 touched), `accessibility` + `axe-snapshot` (axe over the changed chrome — the spec's AA commitment holds only at this run). Then the mobile projects (also never run on CI — CI runs the chromium project only):

```
npx playwright test --project=mobile-chromium --workers=2
```

Expected: all pass. Finally, the whole CI-shaped suite once, as the tranche merge gate:

```
npx playwright test --project=chromium --workers=2
```

Expected: all pass (a handful of `fixme`/skipped entries in the summary is normal — quarantined specs, see CLAUDE.md).

- [ ] **Step 5: Live pass (both basemaps, both themes, desktop + 390px mobile)**

```
npm run dev
```

Open http://localhost:5173. Run the matrix below; for the mobile column use DevTools device toolbar at 390×844 (device emulation also flips `pointer` to coarse, which the B7 checks need). Toggle theme via the header button; toggle basemap via the satellite/map button.

| Check | Desktop light | Desktop dark | 390px light | 390px dark |
| --- | --- | --- | --- | --- |
| B1: satellite country labels legible over bright + dark imagery (z1.5 giants → ~z5 microstates; halo holds) | ☐ | ☐ | ☐ | ☐ |
| B1: start a Country Pinning round → labels fully hidden on satellite; toggle basemap mid-round → still hidden; end game → labels return | ☐ | ☐ | ☐ | ☐ |
| B2: cased borders (dark casing under light line) read at z1.8 and z5 on satellite; vector basemap unaffected | ☐ | ☐ | ☐ | ☐ |
| B4: select France → everything else dims, France is the most legible thing on screen; compare France+Germany → both excluded from the dim | ☐ | ☐ | ☐ | ☐ |
| B5: wrong guess in Country Pinning → answer country pulses then settles; with OS reduced-motion on → static fill, no pulse | ☐ | ☐ | — | — |
| B6: compare Japan + USA and France + Germany → both countries fully visible left of the desktop panel / above the mobile sheet, no slide-under | ☐ | ☐ | ☐ | ☐ |
| B7: controls ≥44px at 390px (coarse), stock 29px on desktop; crosshair-globe reset glyph reads as "re-center" and resets the view; ctrl chrome correct in both themes | ☐ | ☐ | ☐ | ☐ |

When done, **kill the dev server** (same PowerShell command as Step 1 — leaving it running poisons the next Playwright run, per project memory).

- [ ] **Step 6: Docs-staleness check for the new layers (conditional edits)**

Earlier tasks were required to update `docs/systems/` in-task; verify, and patch only what they missed. First get the authoritative new layer ids from the registry:

```
git diff main...HEAD -- src/lib/mapLayers.ts
```

and note the id strings the branch actually added to `LAYER` (the spec names them `country-labels` (B1), a borders-casing line (B2), `country-dim` (B4), `country-reveal-fill` (B5) — **use the registry's real strings, not the spec's, if they differ**). Then check each doc:

**(a)** `grep -n "country-labels\|country-dim\|country-reveal" docs/systems/map-rendering.md` — if empty, the § Map Layers summary is stale. Replace line 60:

```markdown
These are the three core layers. Hover (border + extrusion), the 4-layer selection and compare highlight stacks, and the satellite raster complete the picture — the full registry is `LAYER` in `src/lib/mapLayers.ts` (13 ids).
```

with (substituting the registry's real id strings):

```markdown
These are the three core layers. Hover (border + extrusion), the 4-layer selection and compare highlight stacks, the satellite raster, and the B-core political-legibility layers — `country-labels` (app-owned satellite name labels, hidden during play), the `country-borders` casing line (cased border pair), `country-dim` (selection spotlight: dims everything except the selection / compare pair), and `country-reveal-fill` (game-reveal pulse) — complete the picture. The full registry is `LAYER` in `src/lib/mapLayers.ts`.
```

**(b)** `grep -n "borders are dimmed" docs/systems/ui-layout.md` — if it still matches (line 108), B4's task missed it. In that sentence replace `while the other countries' borders are dimmed` with `while every non-compared country is dimmed by the `country-dim` spotlight layer`.

**(c)** `grep -n "country-labels" docs/systems/overview.md` — if empty, extend § On Page Load step 6. Replace line 68:

```markdown
6. Country boundaries render as interactive layers
```

with:

```markdown
6. Country boundaries render as interactive layers; on the satellite basemap, app-owned `country-labels` name labels render above them (hidden while a game round is playing — see [Map Rendering](map-rendering.md))
```

If a grep already matches (the earlier task covered it), skip that edit and note it as covered.

- [ ] **Step 7: Analytics commitment — explicit "no new telemetry" confirmation**

```powershell
git diff main...HEAD -- src | Select-String "track\("
```

Expected: **no output.** This tranche is map presentation only; the spec's analytics commitment for it is the explicit statement, which this step records: **"Workstream B-core ships no new telemetry — no new `track()` calls, no `KNOWN_EVENTS` changes, no `docs/systems/analytics.md` changes; verified against the branch diff."** Include that sentence verbatim in your completion report (and in the Step 8 commit body if a commit happens). If the grep DOES match, an earlier task violated the plan's analytics declaration — stop and escalate rather than deploying an undeclared event.

- [ ] **Step 8: Commit (only if Step 6 changed files)**

```
git add docs/systems/map-rendering.md docs/systems/ui-layout.md docs/systems/overview.md
git commit -m "docs(systems): record the B-core map layers in the systems docs" -m "Verification sweep for workstream B-core (B1, B2, B4-B7). Workstream B-core ships no new telemetry - verified against the branch diff." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

If Step 6 required no edits, there is nothing to commit — report the sweep results (Steps 1–5 green, Step 6 all covered, Step 7 confirmation line) and finish.