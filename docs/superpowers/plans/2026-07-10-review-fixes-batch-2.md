# Review Fixes Batch 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-10-review-fixes-batch-2-design.md`
**Branch:** `feat/2026-07-10-review-batch-2`

**Goal:** Land the four approved review-fix streams: game basemap tuning (no answer labels, legible satellite borders during play), panel polish (five defects), compare-view camera framing, and the batch-1 deferred cleanups.

**Architecture:** Every map change goes through an existing single-owner function in `src/lib/mapLayers.ts` (the repo's #111 pattern) — basemap layer visibility gets one new owner, border emphasis extends the existing baseline-paint owner. Panel changes are local to `SingleCountryPanel`/`BorderChip` plus two tiny new lib/components. Camera geometry moves into a shared `layoutConstants` module consumed by both fly helpers and guarded by a drift-alarm test.

**Tech Stack:** React 19, MapLibre GL 5, Vitest + Testing Library (jsdom), Playwright.

## Global Constraints

- Game gate is `session.status === 'playing'` — reveal (`round-ended`) and `game-over` render normally.
- Satellite default and space-dark backdrop are intentional; nothing here changes basemap mode selection.
- `selectionOriginRef` threading stays as-is (consciously declined in the spec).
- CLAUDE.md e2e rules apply: no `waitForTimeout`, no `force: true`, no Fuse-order assertions, deterministic state waits only.
- Every commit message ends with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Pre-commit runs eslint+prettier via lint-staged; test files live under `src/**` and must satisfy `tsconfig.app.json` (never create a same-basename `.tsx` next to an existing `.ts` — TS drops one silently).

---

### Task 1: Layout constants module + drift alarm + flyToCountry consumes it

**Files:**
- Create: `src/lib/layoutConstants.ts`
- Create: `src/lib/__tests__/layoutConstants.test.ts`
- Modify: `src/lib/flyToCountry.ts` (replace private `panelOffset`)
- Modify: `src/lib/__tests__/flyToCountry.test.ts` (offset expectations unchanged in value; imports only if needed)

**Interfaces:**
- Consumes: nothing.
- Produces: `DESKTOP_MEDIA_QUERY: string`; `SINGLE_PANEL_FOOTPRINT_PX = 376`; `COMPARE_PANEL_FOOTPRINT_PX = 672`; `SHEET_COLLAPSED_FRACTION = 0.4`; `COMPARE_SHEET_FRACTION = 0.8`; `panelScreenOffset(kind: 'single' | 'compare'): [number, number]`. Tasks 6 (class assertions) and 7 (compare offset) rely on these exact names.

- [ ] **Step 1: Write the failing drift-alarm test**

```ts
// src/lib/__tests__/layoutConstants.test.ts
/**
 * Drift alarm: Tailwind class literals cannot consume TS constants, so this
 * test pins the panel components' class strings to the layout constants the
 * camera code uses. If a panel is restyled, this fails and names the constant
 * to update — instead of the camera silently mis-framing (batch-2 spec §4.1).
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import {
  DESKTOP_MEDIA_QUERY,
  SINGLE_PANEL_FOOTPRINT_PX,
  COMPARE_PANEL_FOOTPRINT_PX,
  SHEET_COLLAPSED_FRACTION,
  COMPARE_SHEET_FRACTION,
  panelScreenOffset,
} from '../layoutConstants'

function componentSource(rel: string): string {
  return readFileSync(fileURLToPath(new URL(`../../components/${rel}`, import.meta.url)), 'utf8')
}

afterEach(() => vi.unstubAllGlobals())

describe('layout constants ↔ panel classes drift alarm', () => {
  it('SingleCountryPanel width/inset/sheet classes match the constants', () => {
    const src = componentSource('SingleCountryPanel.tsx')
    expect(src).toContain(`w-[${SINGLE_PANEL_FOOTPRINT_PX - 16}px]`) // 376 - right-4 inset
    expect(src).toContain('right-4')
    expect(src).toContain(`h-[${SHEET_COLLAPSED_FRACTION * 100}vh]`) // collapsed sheet
  })

  it('CompareCountryPanel width/sheet classes match the constants', () => {
    const src = componentSource('CompareCountryPanel.tsx')
    expect(src).toContain(`w-[${COMPARE_PANEL_FOOTPRINT_PX - 16}px]`)
    expect(src).toContain(`h-[${COMPARE_SHEET_FRACTION * 100}vh]`)
  })

  it('useMediaQuery default equals DESKTOP_MEDIA_QUERY', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../../hooks/useMediaQuery.ts', import.meta.url)),
      'utf8',
    )
    expect(src).toContain(DESKTOP_MEDIA_QUERY)
  })

  it('panelScreenOffset centers in the un-occluded area', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    expect(panelScreenOffset('single')).toEqual([-SINGLE_PANEL_FOOTPRINT_PX / 2, 0])
    expect(panelScreenOffset('compare')).toEqual([-COMPARE_PANEL_FOOTPRINT_PX / 2, 0])
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
    vi.stubGlobal('innerHeight', 800)
    expect(panelScreenOffset('single')).toEqual([0, -160]) // 800 * 0.4 / 2
    expect(panelScreenOffset('compare')).toEqual([0, -320]) // 800 * 0.8 / 2
  })
})
```

- [ ] **Step 2: Run it — expect FAIL (module not found)**

Run: `npx vitest run src/lib/__tests__/layoutConstants.test.ts`
Expected: FAIL — cannot resolve `../layoutConstants`.

- [ ] **Step 3: Implement the module**

```ts
// src/lib/layoutConstants.ts
/** Shared layout geometry. Tailwind class literals in the panel components
 *  cannot consume these constants, so layoutConstants.test.ts pins the class
 *  strings to these values — restyling a panel fails that test and names the
 *  constant to update (batch-2 spec §4.1). */

/** Must match useMediaQuery's default query. */
export const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)'

/** SingleCountryPanel: right-4 (16px) + w-[360px]. */
export const SINGLE_PANEL_FOOTPRINT_PX = 376

/** CompareCountryPanel: right-4 (16px) + w-[656px]. */
export const COMPARE_PANEL_FOOTPRINT_PX = 672

/** Mobile bottom sheet, collapsed single-country state: h-[40vh]. */
export const SHEET_COLLAPSED_FRACTION = 0.4

/** Mobile compare / expanded sheet: h-[80vh]. */
export const COMPARE_SHEET_FRACTION = 0.8

/** Screen-space camera offset so a fly-to target centers in the area the
 *  open panel does not cover. */
export function panelScreenOffset(kind: 'single' | 'compare'): [number, number] {
  const footprint = kind === 'compare' ? COMPARE_PANEL_FOOTPRINT_PX : SINGLE_PANEL_FOOTPRINT_PX
  if (window.matchMedia(DESKTOP_MEDIA_QUERY).matches) return [-footprint / 2, 0]
  const fraction = kind === 'compare' ? COMPARE_SHEET_FRACTION : SHEET_COLLAPSED_FRACTION
  return [0, -Math.round((window.innerHeight * fraction) / 2)]
}
```

- [ ] **Step 4: Point `flyToCountry` at the shared module**

In `src/lib/flyToCountry.ts` delete the private `panelOffset` function and its comment block, add the import, and use it:

```ts
import { panelScreenOffset } from './layoutConstants'
// …
  map.flyTo({
    center: [lng, lat],
    zoom,
    offset: panelScreenOffset('single'),
    pitch: reducedMotion ? 0 : DEFAULT_PITCH,
    duration: reducedMotion ? 0 : 1400,
    curve: 1.5,
  })
```

- [ ] **Step 5: Run both suites — expect PASS**

Run: `npx vitest run src/lib/__tests__/layoutConstants.test.ts src/lib/__tests__/flyToCountry.test.ts`
Expected: all green (flyToCountry offset values are unchanged: `[-188, 0]` / `[0, -160]`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/layoutConstants.ts src/lib/__tests__/layoutConstants.test.ts src/lib/flyToCountry.ts
git commit -m "refactor(layout): shared panel-geometry constants with class-drift alarm"
```

---

### Task 2: Extrusion fade replaces the z6 cliff

**Files:**
- Modify: `src/lib/mapLayers.ts` (extrusion layer defs, `EXTRUSION_MAX_ZOOM`)
- Modify: `src/lib/__tests__/mapLayers.test.ts`

**Interfaces:**
- Produces: exported `EXTRUSION_MAX_ZOOM = 7` and `extrusionHeightExpression(peakMeters: number)`; Task 3 migrates this test file's fake map, so keep assertions helper-agnostic.

- [ ] **Step 1: Update the test to the fade contract (failing first)**

Replace the two tests in `src/lib/__tests__/mapLayers.test.ts` bodies with:

```ts
import { describe, expect, it, vi } from 'vitest'
import type maplibregl from 'maplibre-gl'
import {
  addHoverLayers,
  addSelectionLayers,
  addCompareLayers,
  EXTRUSION_MAX_ZOOM,
  extrusionHeightExpression,
} from '../mapLayers'

function captureAddedLayers(add: (map: maplibregl.Map) => void) {
  const specs: maplibregl.LayerSpecification[] = []
  const map = {
    addLayer: vi.fn((spec: maplibregl.LayerSpecification) => specs.push(spec)),
  } as unknown as maplibregl.Map
  add(map)
  return specs
}

describe('highlight extrusion layers', () => {
  it.each([
    ['hover', addHoverLayers, 60000],
    ['selection', addSelectionLayers, 80000],
    ['compare', addCompareLayers, 80000],
  ])('%s extrusion fades with zoom and keeps a maxzoom backstop', (_n, add, peak) => {
    const specs = captureAddedLayers(add as (m: maplibregl.Map) => void)
    const extrusions = specs.filter((s) => s.type === 'fill-extrusion')
    expect(extrusions.length).toBeGreaterThan(0)
    for (const spec of extrusions) {
      expect(spec.maxzoom).toBe(EXTRUSION_MAX_ZOOM)
      expect(spec.paint?.['fill-extrusion-height']).toEqual(extrusionHeightExpression(peak))
    }
  })

  it('fade expression interpolates peak → 0 across the fade band', () => {
    expect(extrusionHeightExpression(80000)).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      4.5,
      80000,
      6.5,
      0,
    ])
  })

  it('non-extrusion highlight layers stay unbounded (highlight must never vanish)', () => {
    for (const add of [addHoverLayers, addSelectionLayers, addCompareLayers]) {
      const others = captureAddedLayers(add).filter((s) => s.type !== 'fill-extrusion')
      expect(others.length).toBeGreaterThan(0)
      for (const spec of others) expect(spec.maxzoom).toBeUndefined()
    }
  })
})
```

- [ ] **Step 2: Run — expect FAIL (exports missing, heights are scalars)**

Run: `npx vitest run src/lib/__tests__/mapLayers.test.ts`

- [ ] **Step 3: Implement in `mapLayers.ts`**

Replace the `EXTRUSION_MAX_ZOOM` block and both extrusion paint blocks:

```ts
/** Backstop zoom for the highlight extrusions. The lift fades to 0 via
 *  extrusionHeightExpression well before this; the maxzoom only guards
 *  against a zero-height top-face render at high zoom. */
export const EXTRUSION_MAX_ZOOM = 7

/** Zoom-interpolated lift: full at z4.5, gone at z6.5. Replaces the hard
 *  z6 cliff that popped the column off in one frame mid-flight
 *  (2026-07-10 batch-2 spec §4.3). */
export function extrusionHeightExpression(
  peakMeters: number,
): maplibregl.ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], 4.5, peakMeters, 6.5, 0]
}
```

In `addHoverLayers` (LAYER.extrusion): `maxzoom: EXTRUSION_MAX_ZOOM,` and `'fill-extrusion-height': extrusionHeightExpression(60000),`.
In `addHighlightStack` (`${prefix}-extrusion`): `maxzoom: EXTRUSION_MAX_ZOOM,` and `'fill-extrusion-height': extrusionHeightExpression(80000),`. Update both nearby comments to reference the fade.

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/lib/__tests__/mapLayers.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/mapLayers.ts src/lib/__tests__/mapLayers.test.ts
git commit -m "fix(map): fade highlight extrusions across z4.5-6.5 instead of the z6 cliff"
```

---

### Task 3: Fake-map helper consolidation

**Files:**
- Modify: `src/test/fakeMapRef.ts`
- Modify: `src/hooks/__tests__/useMapInteractions.test.ts` (drop both inline fakes)
- Modify: `src/lib/__tests__/mapLayers.test.ts` (drop `captureAddedLayers`)
- Modify: `src/lib/__tests__/flyToCountry.test.ts` (drop `makeMap`)

**Interfaces:**
- Consumes: existing `createFakeMapRef()` consumers (useRevealMapEffects tests etc.) — additions must be backward compatible.
- Produces: `createFakeMapRef(opts?: { zoom?: number })` whose return adds `map`, `fire(event, layer, payload?)`, `addedLayers: maplibregl.LayerSpecification[]`, and calls `setFeatureState`, `setLayoutProperty`, `getZoom`, `getCanvas`, `cameraForBounds` (Task 7 uses `cameraForBounds` + `fire`).

- [ ] **Step 1: Extend `src/test/fakeMapRef.ts`**

```ts
import { vi } from 'vitest'
import type { MutableRefObject } from 'react'
import type maplibregl from 'maplibre-gl'

type Handler = (...args: unknown[]) => void

export function createFakeMapRef(opts: { zoom?: number } = {}) {
  const setData = vi.fn()
  const setFilter = vi.fn()
  const setPaintProperty = vi.fn()
  const setLayoutProperty = vi.fn()
  const setFeatureState = vi.fn()
  const getSource = vi.fn(() => ({ setData }))
  const addSource = vi.fn()
  const addedLayers: maplibregl.LayerSpecification[] = []
  const addLayer = vi.fn((spec: maplibregl.LayerSpecification) => {
    addedLayers.push(spec)
  })
  const handlers = new Map<string, Handler>()
  const keyFor = (event: string, layerOrHandler: unknown) =>
    typeof layerOrHandler === 'string' ? `${event}:${layerOrHandler}` : event
  const on = vi.fn((event: string, layerOrHandler: unknown, maybeHandler?: unknown) => {
    const handler = (typeof layerOrHandler === 'function' ? layerOrHandler : maybeHandler) as Handler
    handlers.set(keyFor(event, layerOrHandler), handler)
  })
  const off = vi.fn()
  const easeTo = vi.fn()
  const flyTo = vi.fn()
  const jumpTo = vi.fn()
  const getZoom = vi.fn(() => opts.zoom ?? 1.8)
  const canvas = { style: { cursor: '' } }
  const getCanvas = vi.fn(() => canvas as unknown as HTMLCanvasElement)
  const cameraForBounds = vi.fn(() => ({ center: [0, 0], zoom: 3 }))
  const queryRenderedFeatures = vi.fn(() => [])
  const getStyle = vi.fn(() => ({ layers: [] as maplibregl.LayerSpecification[] }))
  const doubleClickZoom = { disable: vi.fn() }

  const map = {
    setFilter, setPaintProperty, setLayoutProperty, setFeatureState,
    getSource, addSource, addLayer, on, off, easeTo, flyTo, jumpTo,
    getZoom, getCanvas, cameraForBounds, queryRenderedFeatures, getStyle,
    doubleClickZoom,
  } as unknown as maplibregl.Map

  /** Invoke a captured `map.on` handler. Throws when nothing registered. */
  const fire = (event: string, layer: string | null, payload?: unknown) => {
    const handler = handlers.get(layer ? `${event}:${layer}` : event)
    if (!handler) throw new Error(`no handler registered for ${event}${layer ? `:${layer}` : ''}`)
    handler(payload)
  }

  const ref: MutableRefObject<maplibregl.Map | null> = { current: map }
  return {
    ref, map, fire, addedLayers, canvas,
    calls: {
      setFilter, setPaintProperty, setLayoutProperty, setFeatureState,
      getSource, addSource, addLayer, on, off, easeTo, flyTo, jumpTo,
      setData, getZoom, cameraForBounds, getStyle,
    },
  }
}
```

- [ ] **Step 2: Run the existing consumers — expect PASS (backward compat)**

Run: `npx vitest run src/game/hooks src/hooks/__tests__/useSelectionHighlight.test.tsx`
Expected: green — only additive changes.

- [ ] **Step 3: Migrate the three inline fakes**

- `useMapInteractions.test.ts`: delete `makeInteractionMap` and `makeClickMap`; both describe blocks use `const fake = createFakeMapRef()`, `h.mapRef.current = fake.map`, and `fake.fire(...)` / `fake.calls.setFeatureState` / `fake.calls.setFilter`. The click-origin block's `clickCountry(payload)` helper becomes `fake.fire('click', LAYER.fill, payload)`.
- `mapLayers.test.ts`: delete `captureAddedLayers`; use `const fake = createFakeMapRef(); add(fake.map); const specs = fake.addedLayers`.
- `flyToCountry.test.ts`: delete `makeMap`; use `const fake = createFakeMapRef({ zoom: 4 })` and read `fake.calls.flyTo`.

- [ ] **Step 4: Run all touched suites — expect PASS**

Run: `npx vitest run src/hooks/__tests__/useMapInteractions.test.ts src/lib/__tests__/mapLayers.test.ts src/lib/__tests__/flyToCountry.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/test/fakeMapRef.ts src/hooks/__tests__/useMapInteractions.test.ts src/lib/__tests__/mapLayers.test.ts src/lib/__tests__/flyToCountry.test.ts
git commit -m "test: consolidate fake-map builders into createFakeMapRef"
```

---

### Task 4: Hide basemap labels during play (single-owner visibility)

**Files:**
- Modify: `src/lib/mapLayers.ts` (new owner function)
- Modify: `src/hooks/useSatelliteMode.ts`
- Modify: `src/hooks/__tests__/useSatelliteMode.test.tsx`
- Modify: `src/components/WorldMap.tsx` (only if the hook signature changes — it does not; the hook reads game context itself)

**Interfaces:**
- Consumes: `useGameSessionContext()` (same pattern as `useMapInteractions`).
- Produces: `applyBasemapLayerVisibility(map, opts: { satellite: boolean; hideLabels: boolean }): void` in mapLayers.ts. Rule: custom layers (id starts `country-` / `satellite-`) untouched; other layers visible iff `!satellite && (type !== 'symbol' || !hideLabels)`.

- [ ] **Step 1: Write failing unit tests for the owner function**

Append to `src/lib/__tests__/mapLayers.test.ts`:

```ts
import { applyBasemapLayerVisibility } from '../mapLayers'

describe('applyBasemapLayerVisibility', () => {
  const styleLayers = [
    { id: 'water', type: 'fill' },
    { id: 'place-labels', type: 'symbol' },
    { id: 'country-fill', type: 'fill' },
    { id: 'satellite-layer', type: 'raster' },
  ]
  function makeMapWithStyle() {
    const fake = createFakeMapRef()
    ;(fake.map.getStyle as ReturnType<typeof vi.fn>).mockReturnValue({ layers: styleLayers })
    return fake
  }
  const visibilityOf = (fake: ReturnType<typeof createFakeMapRef>, id: string) =>
    fake.calls.setLayoutProperty.mock.calls.filter((c) => c[0] === id).at(-1)?.[2]

  it('map view during play: symbol layers hidden, others visible, custom untouched', () => {
    const fake = makeMapWithStyle()
    applyBasemapLayerVisibility(fake.map, { satellite: false, hideLabels: true })
    expect(visibilityOf(fake, 'water')).toBe('visible')
    expect(visibilityOf(fake, 'place-labels')).toBe('none')
    expect(visibilityOf(fake, 'country-fill')).toBeUndefined()
    expect(visibilityOf(fake, 'satellite-layer')).toBeUndefined()
  })

  it('map view idle: everything non-custom visible', () => {
    const fake = makeMapWithStyle()
    applyBasemapLayerVisibility(fake.map, { satellite: false, hideLabels: false })
    expect(visibilityOf(fake, 'place-labels')).toBe('visible')
  })

  it('satellite: all non-custom hidden regardless of hideLabels', () => {
    const fake = makeMapWithStyle()
    applyBasemapLayerVisibility(fake.map, { satellite: true, hideLabels: true })
    expect(visibilityOf(fake, 'water')).toBe('none')
    expect(visibilityOf(fake, 'place-labels')).toBe('none')
  })
})
```

- [ ] **Step 2: Run — expect FAIL (function missing)**

Run: `npx vitest run src/lib/__tests__/mapLayers.test.ts`

- [ ] **Step 3: Implement the owner in `mapLayers.ts`**

```ts
/** Single owner of BASEMAP layer visibility (the repo's #111 pattern —
 *  useSatelliteMode's satellite toggle and the in-game label hiding both go
 *  through this rule, so neither can clobber the other):
 *  custom layers (country-*, satellite-*) are never touched here; every
 *  other layer is visible iff !satellite, and symbol layers (all text —
 *  country/city/sea names leak game answers) additionally require
 *  !hideLabels (2026-07-10 batch-2 spec §1). */
export function applyBasemapLayerVisibility(
  map: maplibregl.Map,
  opts: { satellite: boolean; hideLabels: boolean },
): void {
  const style = map.getStyle()
  if (!style?.layers) return
  const customPrefixes = ['country-', 'satellite-']
  for (const layer of style.layers) {
    if (customPrefixes.some((p) => layer.id.startsWith(p))) continue
    const visible = !opts.satellite && (layer.type !== 'symbol' || !opts.hideLabels)
    try {
      map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none')
    } catch {
      /* some layers don't support visibility */
    }
  }
}
```

- [ ] **Step 4: Rewire `useSatelliteMode` through the owner + game gate**

Replace `src/hooks/useSatelliteMode.ts` with:

```ts
import { useEffect } from 'react'
import { LAYER, applyBasemapLayerVisibility } from '../lib/mapLayers'
import { useMap } from './useMap'
import { useGameSessionContext } from '../game/shared/GameSessionProvider'

interface Options {
  loaded: boolean
  satellite: boolean
}

/** Satellite layer visibility, terrain, and basemap-layer hide/show —
 *  including hiding all basemap text during active play, because labels
 *  print the answers (country names for pinning, city names for
 *  city-guessing). Layer visibility itself is owned by
 *  applyBasemapLayerVisibility so the satellite toggle and the game gate
 *  cannot clobber each other (batch-2 spec §1). */
export function useSatelliteMode({ loaded, satellite }: Options): void {
  const { mapRef } = useMap()
  const { session } = useGameSessionContext()
  const playing = session.status === 'playing'

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    try {
      map.setLayoutProperty(LAYER.satellite, 'visibility', satellite ? 'visible' : 'none')
      if (satellite) {
        map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 })
      } else {
        map.setTerrain(null)
      }
      applyBasemapLayerVisibility(map, { satellite, hideLabels: playing })
    } catch {
      // Layers may not exist yet.
    }
  }, [satellite, loaded, playing, mapRef])
}
```

- [ ] **Step 5: Update `useSatelliteMode.test.tsx`**

**Harness facts (verified 2026-07-11):** this file uses `makeMapWrapper` from `fakeMapHooks` with a LOCAL `makeSatelliteFakeMap(layers)` — there is no `../useMap` mock. `useGameSessionContext` THROWS outside its provider, so without the module mock below every EXISTING case in this file crashes the moment the hook gains the context read. Required changes:

1. Add a module-level mock with a mutable session holder:

```ts
const h = vi.hoisted(() => ({
  session: { modeId: 'country-pinning', status: 'idle' } as { modeId: string; status: string },
}))
vi.mock('../../game/shared/GameSessionProvider', () => ({
  useGameSessionContext: () => ({ session: h.session }),
}))
```

2. Reset `h.session` to `status: 'idle'` in a `beforeEach`, and give the STYLE_LAYERS fixtures `type` fields (`background`/`water` → `'fill'`, add `{ id: 'place-labels', type: 'symbol' }`; entries without `type` are treated as non-symbol, so existing assertions stay green).
3. Add the new cases using the file's own fake:

```ts
const lastVisibility = (fake: ReturnType<typeof makeSatelliteFakeMap>, id: string) =>
  fake.calls.setLayoutProperty.filter((c) => c[0] === id).at(-1)?.[2]

it('hides symbol layers while a game is playing in map view', () => {
  const fake = makeSatelliteFakeMap(STYLE_LAYERS)
  h.session = { modeId: 'country-pinning', status: 'playing' }
  renderHook(() => useSatelliteMode({ loaded: true, satellite: false }), {
    wrapper: makeMapWrapper(fake),
  })
  expect(lastVisibility(fake, 'place-labels')).toBe('none')
  expect(lastVisibility(fake, 'water')).toBe('visible')
})

it('re-hides labels when satellite toggles off mid-game (ordering regression)', () => {
  const fake = makeSatelliteFakeMap(STYLE_LAYERS)
  h.session = { modeId: 'country-pinning', status: 'playing' }
  const { rerender } = renderHook(
    ({ satellite }: { satellite: boolean }) => useSatelliteMode({ loaded: true, satellite }),
    { initialProps: { satellite: true }, wrapper: makeMapWrapper(fake) },
  )
  rerender({ satellite: false })
  expect(lastVisibility(fake, 'place-labels')).toBe('none')
  expect(lastVisibility(fake, 'water')).toBe('visible')
})

it('restores labels when the game ends', () => {
  const fake = makeSatelliteFakeMap(STYLE_LAYERS)
  h.session = { modeId: 'country-pinning', status: 'playing' }
  const { rerender } = renderHook(() => useSatelliteMode({ loaded: true, satellite: false }), {
    wrapper: makeMapWrapper(fake),
  })
  h.session = { modeId: 'country-pinning', status: 'game-over' }
  rerender()
  expect(lastVisibility(fake, 'place-labels')).toBe('visible')
})
```

- [ ] **Step 6: Run — expect PASS**

Run: `npx vitest run src/hooks/__tests__/useSatelliteMode.test.tsx src/lib/__tests__/mapLayers.test.ts`

- [ ] **Step 7: Commit**

```bash
git add src/lib/mapLayers.ts src/lib/__tests__/mapLayers.test.ts src/hooks/useSatelliteMode.ts src/hooks/__tests__/useSatelliteMode.test.tsx
git commit -m "feat(game): hide basemap labels during play via single-owner layer visibility"
```

---

### Task 5: Emphasize satellite borders during play

**Files:**
- Modify: `src/lib/mapLayers.ts` (`applyCountryBaselinePaint` + `applyBorderPaintForMode`)
- Modify: `src/hooks/useCountryBaselinePaint.ts`
- Modify: `src/hooks/__tests__/useCountryBaselinePaint.test.tsx` (or `.ts` — extend the existing file)

**Interfaces:**
- Consumes: `useGameSessionContext()`.
- Produces: `applyCountryBaselinePaint(map, opts: { satellite; inCompareView; isDark; gameActive: boolean })` — new required `gameActive` member; the only call site is `useCountryBaselinePaint`.

- [ ] **Step 1: Extend the paint owner (test first)**

Append to `src/lib/__tests__/mapLayers.test.ts`:

```ts
import { applyCountryBaselinePaint } from '../mapLayers'

describe('applyCountryBaselinePaint game emphasis', () => {
  const paintOf = (fake: ReturnType<typeof createFakeMapRef>, prop: string) =>
    fake.calls.setPaintProperty.mock.calls.filter((c) => c[1] === prop).at(-1)?.[2]

  it('satellite + playing: borders 1.6px @ 0.9', () => {
    const fake = createFakeMapRef()
    applyCountryBaselinePaint(fake.map, {
      satellite: true, inCompareView: false, isDark: false, gameActive: true,
    })
    expect(paintOf(fake, 'line-width')).toBe(1.6)
    expect(paintOf(fake, 'line-opacity')).toBe(0.9)
  })

  it('satellite idle: baseline 0.5px @ 0.6 restored', () => {
    const fake = createFakeMapRef()
    applyCountryBaselinePaint(fake.map, {
      satellite: true, inCompareView: false, isDark: false, gameActive: false,
    })
    expect(paintOf(fake, 'line-width')).toBe(0.5)
    expect(paintOf(fake, 'line-opacity')).toBe(0.6)
  })

  it('map view + playing: vector border paint unchanged by the game', () => {
    const fake = createFakeMapRef()
    applyCountryBaselinePaint(fake.map, {
      satellite: false, inCompareView: false, isDark: false, gameActive: true,
    })
    expect(paintOf(fake, 'line-width')).toBe(0.5)
    expect(paintOf(fake, 'line-opacity')).toBe(0.35)
  })
})
```

- [ ] **Step 2: Run — expect FAIL (gameActive not accepted; line-width never written)**

- [ ] **Step 3: Implement**

In `applyBorderPaintForMode`, accept and apply emphasis, and start owning `line-width` in every branch:

```ts
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

In `applyCountryBaselinePaint`, change the opts type to `{ satellite: boolean; inCompareView: boolean; isDark: boolean; gameActive: boolean }` and pass `gameActive` through the non-compare branch: `applyBorderPaintForMode(map, { isDark: opts.isDark, satellite: opts.satellite, gameActive: opts.gameActive })`. The compare branch keeps its flat dim (compare never coexists with a game).

- [ ] **Step 4: Wire the hook**

In `src/hooks/useCountryBaselinePaint.ts`: `const { session } = useGameSessionContext()`, `const gameActive = session.status === 'playing'`, include `gameActive` in the `applyCountryBaselinePaint` opts and the effect deps. **Required (verified 2026-07-11):** `useCountryBaselinePaint.test.tsx` uses `makeFakeMap`/`makeMapWrapper` with NO GameSessionProvider — `useGameSessionContext` throws outside its provider, so add the same `vi.mock('../../game/shared/GameSessionProvider')` + hoisted `h.session` (default `'idle'`) as in Task 4, or every existing matrix case crashes. With the idle default the pinned {satellite × compare} paint matrix is unchanged. Then add one case: satellite + `h.session.status='playing'` rerender writes `line-width` 1.6, then back to 0.5 after `status='game-over'`.

- [ ] **Step 5: Run — expect PASS**

Run: `npx vitest run src/lib/__tests__/mapLayers.test.ts src/hooks/__tests__/useCountryBaselinePaint.test.tsx`
(Also `npx tsc -b` — the opts type change must not break other callers; `useCountryBaselinePaint` is the only one.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/mapLayers.ts src/lib/__tests__/mapLayers.test.ts src/hooks/useCountryBaselinePaint.ts src/hooks/__tests__/useCountryBaselinePaint.test.tsx
git commit -m "feat(game): bold satellite country borders while a round is in play"
```

---

### Task 6: Panel polish (five defects)

**Files:**
- Create: `src/lib/neighborNames.ts`
- Create: `src/components/TimezoneList.tsx`
- Modify: `src/components/BorderChip.tsx`
- Modify: `src/components/SingleCountryPanel.tsx`
- Modify: `src/components/__tests__/BorderChip.test.tsx`
- Create: `src/components/__tests__/TimezoneList.test.tsx`
- Modify: `src/components/__tests__/SingleCountryPanel.test.tsx` (heading/badge assertions)

**Interfaces:**
- Produces: `nonSelectableNeighborName(code: string): string | undefined`; `<TimezoneList timezones={string[]} />` rendering ≤3 inline or 3 + toggle.

- [ ] **Step 1: neighborNames lib (test first)**

```ts
// src/lib/__tests__/neighborNames.test.ts
import { describe, expect, it } from 'vitest'
import { nonSelectableNeighborName } from '../neighborNames'

describe('nonSelectableNeighborName', () => {
  it.each([
    ['ESH', 'Western Sahara'],
    ['GIB', 'Gibraltar'],
    ['GUF', 'French Guiana'],
    ['HKG', 'Hong Kong'],
    ['MAC', 'Macau'],
    ['UNK', 'Kosovo'], // not in the dataset — static fallback
  ])('%s → %s', (code, name) => {
    expect(nonSelectableNeighborName(code)).toBe(name)
  })
  it('unknown codes return undefined', () => {
    expect(nonSelectableNeighborName('ZZZ')).toBeUndefined()
  })
})
```

```ts
// src/lib/neighborNames.ts
import countriesData from '../data/countries.json'

/** Display names for border codes OUTSIDE the selectable 195 (data sweep
 *  2026-07-10: ESH, GIB, GUF, HKG, MAC, UNK). Five live in the shipped
 *  249-entry dataset; UNK is REST Countries' Kosovo code and is not in the
 *  dataset at all. Chips for these render inert but must never show a raw
 *  code (batch-2 spec §2.3). */
const STATIC_NAMES: Record<string, string> = { UNK: 'Kosovo' }

const datasetNames = new Map<string, string>(
  countriesData.countries.map((c) => [c.cca3, c.name.common]),
)

export function nonSelectableNeighborName(code: string): string | undefined {
  return datasetNames.get(code) ?? STATIC_NAMES[code]
}
```

Run: `npx vitest run src/lib/__tests__/neighborNames.test.ts` → PASS.

- [ ] **Step 2: BorderChip uses it (extend the existing test file first)**

In `BorderChip.test.tsx` update the ESH expectations: the span shows `Western Sahara` (not `ESH`); add a `UNK` case showing `Kosovo`; add a truly-unknown code case still falling back to the raw code. Then in `BorderChip.tsx`:

```ts
import { nonSelectableNeighborName } from '../lib/neighborNames'
// in the !neighbor branch:
  if (!neighbor) {
    return <span className={SPAN_CLASSES[size]}>{nonSelectableNeighborName(code) ?? code}</span>
  }
```

Run: `npx vitest run src/components/__tests__/BorderChip.test.tsx` → PASS.

- [ ] **Step 3: TimezoneList component (test first)**

```tsx
// src/components/__tests__/TimezoneList.test.tsx
import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimezoneList } from '../TimezoneList'

describe('TimezoneList', () => {
  it('renders ≤3 timezones inline without a toggle', () => {
    render(<TimezoneList timezones={['UTC+01:00']} />)
    expect(screen.getByText('UTC+01:00')).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('collapses >3 to the first 3 plus a +N more toggle', () => {
    const zones = ['UTC-10:00', 'UTC-09:30', 'UTC-09:00', 'UTC+01:00', 'UTC+02:00']
    render(<TimezoneList timezones={zones} />)
    expect(screen.getByText(/UTC-10:00, UTC-09:30, UTC-09:00/)).toBeDefined()
    expect(screen.queryByText(/UTC\+01:00/)).toBeNull()
    const toggle = screen.getByRole('button', { name: '+2 more' })
    fireEvent.click(toggle)
    expect(screen.getByText(/UTC\+02:00/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
    expect(screen.queryByText(/UTC\+02:00/)).toBeNull()
  })
})
```

```tsx
// src/components/TimezoneList.tsx
import { useState } from 'react'

const COLLAPSED_COUNT = 3

/** Timezones value with overflow folding: France's 14 UTC offsets dominated
 *  the panel as a 4-line dump (2026-07-10 review; batch-2 spec §2.4). */
export function TimezoneList({ timezones }: { timezones: string[] }) {
  const [expanded, setExpanded] = useState(false)
  if (timezones.length <= COLLAPSED_COUNT) return <>{timezones.join(', ')}</>
  const shown = expanded ? timezones : timezones.slice(0, COLLAPSED_COUNT)
  return (
    <>
      {shown.join(', ')}{' '}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="text-teal-accessible dark:text-teal-light text-xs underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 rounded"
      >
        {expanded ? 'Show less' : `+${timezones.length - COLLAPSED_COUNT} more`}
      </button>
    </>
  )
}
```

In `SingleCountryPanel.tsx` the Timezones DataCell child becomes `<TimezoneList timezones={country.timezones} />`.
Run: `npx vitest run src/components/__tests__/TimezoneList.test.tsx` → PASS.

- [ ] **Step 4: Heading wrap, subtitle wrap, badge row, focus ring**

In `SingleCountryPanel.tsx`:

- `<h2>` (line ~179): replace `truncate` with `line-clamp-2 break-words`; delete `focus-visible:ring-2 focus-visible:ring-teal-accessible/50` (keep `focus:outline-none` — the heading takes programmatic focus for screen readers and Chromium matches `:focus-visible` for script focus, drawing a meaningless ring; 2026-07-10 review).
- Official-name `<p>` (line ~184): replace `truncate` with `line-clamp-2 break-words`.
- Region badge: move the whole `<span data-testid="region-badge">…</span>` OUT of the name column `<div className="min-w-0 pt-0.5">` to directly AFTER the header flex row's closing `</div>` (still inside the sticky container), classes becoming:

```tsx
<span
  data-testid="region-badge"
  className={`inline-block whitespace-nowrap text-[11px] font-medium px-2 py-0.5 rounded-full mt-2 ${
    REGION_BADGE[country.region] || 'bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100'
  }`}
>
  {country.region}
  {country.subregion && ` / ${country.subregion}`}
</span>
```

- [ ] **Step 5: Assert in SingleCountryPanel tests**

Add to `SingleCountryPanel.test.tsx` (using its existing render helper): heading className contains `line-clamp-2` and NOT `truncate` / `focus-visible:ring`; the region badge is NOT a descendant of the heading's parent column (`expect(badge.parentElement).not.toBe(heading.parentElement)`) and has `whitespace-nowrap`.

- [ ] **Step 6: Run the component suites — expect PASS**

Run: `npx vitest run src/components`

- [ ] **Step 7: Commit**

```bash
git add src/lib/neighborNames.ts src/lib/__tests__/neighborNames.test.ts src/components
git commit -m "fix(panel): un-truncated names, one-line region badge, named neighbor chips, timezone folding, no phantom focus ring"
```

---

### Task 7: Compare-view camera

**Files:**
- Create: `src/lib/flyToComparePair.ts`
- Create: `src/lib/__tests__/flyToComparePair.test.ts`
- Modify: `src/hooks/useSelectionHighlight.ts`
- Modify: `src/hooks/__tests__/useSelectionHighlight.test.tsx`
- Modify: `e2e/compare-view-dimming.spec.ts` (drives the full compare flow; `compare-source-attribution.spec.ts` stays untouched)

**Interfaces:**
- Consumes: `panelScreenOffset('compare')` (Task 1); `createFakeMapRef` `cameraForBounds`/`flyTo` spies (Task 3).
- Produces: `flyToComparePair(map: maplibregl.Map, a: CountryData, b: CountryData): void`.

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/__tests__/flyToComparePair.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { flyToComparePair } from '../flyToComparePair'
import { prefersReducedMotion } from '../motion'
import { makeCountryData } from '../../test/countryFixtures'
import { createFakeMapRef } from '../../test/fakeMapRef'

vi.mock('../motion', () => ({ prefersReducedMotion: vi.fn(() => false) }))

const FRANCE = makeCountryData() // latlng [46, 2]
const GERMANY = makeCountryData({ cca3: 'DEU', ccn3: '276', latlng: [51, 9] })
const JAPAN = makeCountryData({ cca3: 'JPN', ccn3: '392', latlng: [36, 138] })
const USA = makeCountryData({ cca3: 'USA', ccn3: '840', latlng: [38, -97] })

beforeEach(() => {
  vi.mocked(prefersReducedMotion).mockReturnValue(false)
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true }))) // desktop
})
afterEach(() => vi.unstubAllGlobals())

describe('flyToComparePair', () => {
  it('frames both countries with padding and the compare-panel offset', () => {
    const fake = createFakeMapRef()
    flyToComparePair(fake.map, FRANCE, GERMANY)
    const [bounds, opts] = fake.calls.cameraForBounds.mock.calls[0]
    expect(bounds).toEqual([
      [2, 46],
      [9, 51],
    ])
    expect(opts).toMatchObject({ padding: 80, offset: [-336, 0] })
    expect(fake.calls.flyTo).toHaveBeenCalledTimes(1)
  })

  it('normalizes antimeridian pairs so the bounds cross the Pacific, not the planet', () => {
    const fake = createFakeMapRef()
    flyToComparePair(fake.map, JAPAN, USA)
    const [bounds] = fake.calls.cameraForBounds.mock.calls[0]
    const [[west], [east]] = bounds as [[number, number], [number, number]]
    expect(east - west).toBeLessThan(180) // -97 shifted to +263
    expect(east).toBeGreaterThan(180)
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
})
```

- [ ] **Step 2: Run — expect FAIL (module missing)**

- [ ] **Step 3: Implement**

```ts
// src/lib/flyToComparePair.ts
import type maplibregl from 'maplibre-gl'
import type { CountryData } from './types'
import { DEFAULT_PITCH } from './mapStyles'
import { prefersReducedMotion } from './motion'
import { panelScreenOffset } from './layoutConstants'

/** Frame BOTH compared countries in the area the compare panel does not
 *  cover (batch-2 spec §3). Centroid bounds + 80px padding absorb the
 *  centroid-vs-outline underframing; longitudes >180° apart are shifted so
 *  the box crosses the antimeridian instead of wrapping the long way. */
export function flyToComparePair(
  map: maplibregl.Map,
  a: CountryData,
  b: CountryData,
): void {
  const [latA, lngA] = a.latlng
  const [latB, rawLngB] = b.latlng
  const lngB = Math.abs(rawLngB - lngA) > 180 ? rawLngB + (rawLngB < lngA ? 360 : -360) : rawLngB

  const bounds: [[number, number], [number, number]] = [
    [Math.min(lngA, lngB), Math.min(latA, latB)],
    [Math.max(lngA, lngB), Math.max(latA, latB)],
  ]
  const camera = map.cameraForBounds(bounds, {
    padding: 80,
    offset: panelScreenOffset('compare'),
  })
  if (!camera) return

  const reducedMotion = prefersReducedMotion()
  map.flyTo({
    ...camera,
    pitch: reducedMotion ? 0 : DEFAULT_PITCH,
    duration: reducedMotion ? 0 : 1400,
    curve: 1.5,
  })
}
```

- [ ] **Step 4: Wire into `useSelectionHighlight`'s compare effect**

```ts
import { flyToComparePair } from '../lib/flyToComparePair'
// second effect becomes:
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    applyOrClearFilter(map, COMPARE_LAYERS, compareWith?.ccn3 ?? null)
    // Fly to frame BOTH countries; clearing compare never moves the camera
    // (preserve-the-user's-view philosophy, batch-2 spec §3).
    if (compareWith && selected) flyToComparePair(map, selected, compareWith)
  }, [compareWith, selected, loaded, mapRef])
```

Add to `useSelectionHighlight.test.tsx` (mock `../../lib/flyToComparePair` like `flyToCountry`): compare set → called once with (map, selected, compareWith); compare cleared → not called again.

- [ ] **Step 5: Extend the compare e2e spec**

In `e2e/compare-view-dimming.spec.ts`, in the flow that establishes a compare pair, after the compare panel is visible add:

```ts
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
```

(Uses the `__funworldmap_map` seam — available in e2e builds; `expect.poll` is the auto-retrying wait CLAUDE.md requires.)

- [ ] **Step 6: Run — expect PASS**

Run: `npx vitest run src/lib/__tests__/flyToComparePair.test.ts src/hooks/__tests__/useSelectionHighlight.test.tsx`

- [ ] **Step 7: Commit**

```bash
git add src/lib/flyToComparePair.ts src/lib/__tests__/flyToComparePair.test.ts src/hooks/useSelectionHighlight.ts src/hooks/__tests__/useSelectionHighlight.test.tsx e2e/
git commit -m "feat(compare): frame both countries around the compare panel"
```

---

### Task 8: Game e2e assertion + batch verification + PR

**Files:**
- Modify: `e2e/game-country-pinning.spec.ts` (label-hiding assertion)
- Modify: `docs/superpowers/specs/2026-07-10-review-fixes-batch-2-design.md` (Status → Accepted)

- [ ] **Step 1: Game label-hiding e2e**

**Stub vacuity guard (verified 2026-07-11):** the game specs run under `routeMapTiles`, whose embedded minimal positron style may contain no symbol layers — the assertion below would then pass vacuously. Follow label-contrast.spec.ts's precedent and pass `routeMapTiles(page, { styleStub })` with a minimal style containing at least one symbol layer (e.g. a `place-labels` symbol layer over the stub source), and assert `symbols.length > 0` before the visibility checks.

In the country-pinning spec, inside an existing test that reaches `status: 'playing'` in map view (or a new test following that spec's established setup helpers — `waitForGameTestHook` etc.), add:

```ts
// Basemap labels leak the answer — they must be hidden while playing and
// restored afterward (batch-2 spec §1).
const symbolVisibility = () =>
  page.evaluate(() => {
    const map = window.__funworldmap_map as {
      getStyle: () => { layers: { id: string; type: string }[] }
      getLayoutProperty: (id: string, prop: string) => string | undefined
    }
    const symbols = map
      .getStyle()
      .layers.filter((l) => l.type === 'symbol' && !l.id.startsWith('country-'))
    return symbols.map((l) => map.getLayoutProperty(l.id, 'visibility'))
  })
// Non-vacuous: the style stub must actually contain symbol layers.
expect(await symbolVisibility()).not.toHaveLength(0)
await expect.poll(symbolVisibility).not.toContain('visible')
// … after game end (End game → Back to map):
await expect.poll(symbolVisibility).not.toContain('none')
```

(Note: the game must be running in MAP view for this test — set it up by clicking the satellite toggle before Play, using the spec's existing helpers.)

- [ ] **Step 2: Full check ×2 (ordering flakes)**

Run: `npm run check` twice.
Expected: lint, `tsc -b`, and the full vitest suite green both times (~380+ tests after this batch).

- [ ] **Step 3: Targeted e2e**

Verify no stray servers (`Get-NetTCPConnection -LocalPort 5173 -State Listen` — kill node listeners; TaskStop leaves Vite children alive, see project memory). Then:

Run: `npx playwright test game-country-pinning.spec.ts game-city-guessing.spec.ts search.spec.ts map-and-countries.spec.ts compare-view-dimming.spec.ts --project=chromium`
Expected: all pass.

- [ ] **Step 4: Live pass (dev server, then kill it + orphans)**

- Play country-pinning in map view: no text labels anywhere during the round; labels back at game end.
- Play in satellite: borders clearly bolder during the round; hairline again after.
- `#VAT` → name renders un-truncated ("Vatican City" over ≤2 lines); Algeria panel shows "Western Sahara" chip; Serbia shows "Kosovo".
- France panel: timezones collapsed to 3 + "+11 more"; toggle works.
- Compare France+Germany (desktop + 390px viewport): both highlights visible beside/above the panel. Compare Japan+USA: framed across the Pacific.
- Fly Vatican→world: extrusion lift fades in, no pop.

- [ ] **Step 5: Spec status + plan checkboxes, commit**

Set spec Status → `Accepted (implemented on feat/2026-07-10-review-batch-2)`, tick this plan's boxes, append execution notes for any deviations.

```bash
git add docs/
git commit -m "docs: batch-2 spec accepted; plan execution notes"
```

- [ ] **Step 6: Push and open PR**

```bash
git push -u origin feat/2026-07-10-review-batch-2
gh pr create --base main --title "Review fixes batch 2: game basemap, panel polish, compare camera, cleanups" --body "<summary per batch-1 pattern; end with the Claude Code attribution line>"
```

On merge: move this plan to `docs/superpowers/plans/archive/`.
