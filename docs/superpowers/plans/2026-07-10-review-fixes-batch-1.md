# Review fixes, batch 1 — implementation plan

**Execution:** `superpowers:executing-plans` (inline, checkpoint per task)
**Spec:** `docs/superpowers/specs/2026-07-10-review-fixes-batch-1-design.md`
**Branch:** `fix/2026-07-10-review-batch-1`

**Goal:** Land the five bug-tier review fixes: tooltip overflow scrollbars, stale hover artifacts,
search Enter-commits-top-result, extrusion wall cap, origin-aware selection camera.

**Architecture:** All changes ride existing seams — CSS base rule, the `useMapInteractions` event
registry, `SearchBar`'s activeIndex state, `mapLayers` layer definitions, and the
`flyToCountry`/`useSelectedCountry` selection chain. One new 10-line module
(`src/lib/selectionOrigin.ts`) carries the click-vs-auto mark across the URL-hash boundary.

**Tech stack:** React 19, MapLibre GL 5, Vitest + Testing Library, Playwright.

## Scope out

- Game basemap tuning, political tinting, panel polish, compare camera (future batches).
- No changes to game-mode camera code or `useRevealMapEffects`.
- No upstream MapLibre work (READ-usage warnings documented as no-action in the spec).

## File structure

| File | Change |
| --- | --- |
| `src/index.css` | `.country-tooltip` gains `top: 0; left: 0` |
| `src/hooks/useMapInteractions.ts` | extract hover-clearing helper; register on `movestart`; `markClickOrigin()` in `clickCountry` |
| `src/hooks/__tests__/useMapInteractions.test.tsx` | **new** — movestart clears hover artifacts |
| `src/components/SearchBar.tsx` | auto-active index 0; `spellCheck={false}` |
| `src/components/__tests__/SearchBar.test.tsx` | **new** — type + Enter selects top result |
| `e2e/search.spec.ts` | drop ArrowDown-before-Enter; keep arrow-key coverage |
| `src/lib/mapLayers.ts` | `maxzoom: 6` on the three extrusion layers |
| `src/lib/__tests__/mapLayers.test.ts` | **new** — extrusion layers carry maxzoom |
| `src/lib/selectionOrigin.ts` | **new** — `markClickOrigin` / `takeOrigin` |
| `src/hooks/useSelectedCountry.ts` | consume origin in `resolveHash`, expose `selectionOriginRef` |
| `src/App.tsx` | thread `selectionOriginRef` to `WorldMap` |
| `src/components/WorldMap.tsx` | pass `selectionOriginRef` to `useSelectionHighlight` |
| `src/hooks/useSelectionHighlight.ts` | pass `preserveZoom` to `flyToCountry` |
| `src/lib/flyToCountry.ts` | retuned `zoomFromArea`; `preserveZoom` option; panel-aware `offset` |
| `src/lib/__tests__/flyToCountry.test.ts` | rewrite to new semantics |
| `src/hooks/__tests__/useSelectionHighlight.test.tsx` | update for new call shape |

## Pre-flight

- [ ] `git branch --show-current` → `fix/2026-07-10-review-batch-1`; `git status --short` clean
- [ ] `npm run check` green before starting (baseline)
- [ ] No stray dev servers: `Get-NetTCPConnection -LocalPort 5173 -State Listen` empty

## Task 1 — tooltip overflow + stale hover artifacts

- [ ] `src/index.css` — in the `.country-tooltip` rule add, after `position: absolute;`:

```css
  /* Initial resting position. Without this the hidden tooltip sits at its
     static position after the map container and stretches the document 12px
     past the viewport — permanent page scrollbars (2026-07-10 review). */
  top: 0;
  left: 0;
```

- [ ] `src/hooks/useMapInteractions.ts` — extract the hover-clearing body shared by `mouseleave`
      and camera moves. Replace `mouseleaveHover` with:

```ts
    // Shared by mouseleave and movestart: a camera move without mouse movement
    // (search select, deep link) must not leave a hover highlight or tooltip
    // describing the previous view (2026-07-10 review).
    const clearHoverArtifacts = () => {
      if (hoveredRef.current !== null) {
        map.setFeatureState({ source: 'countries', id: hoveredRef.current }, { hover: false })
        hoveredRef.current = null
      }
      map.setFilter(LAYER.extrusion, ['==', ['get', 'id'], ''])
      map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], ''])
      const tooltip = tooltipRef.current
      if (tooltip) tooltip.classList.remove('visible')
    }

    const mouseleaveHover = () => {
      clearHoverArtifacts()
      const canvas = map.getCanvas()
      if (canvas.style.cursor !== 'crosshair') canvas.style.cursor = 'grab'
    }
```

      (No cursor write in `clearHoverArtifacts` — `movestart` fires mid-drag after `dragstart` set
      `grabbing`, and resetting to `grab` there would glitch the drag cursor.)

- [ ] Register/unregister alongside the other handlers:

```ts
    map.on('movestart', clearHoverArtifacts)
    // …
    map.off('movestart', clearHoverArtifacts)
```

- [ ] **New** `src/hooks/__tests__/useMapInteractions.test.tsx` — follow the fake-map pattern from
      `useSelectionHighlight.test.tsx` / `src/test/fakeMapRef.ts`: render the hook, simulate hover
      state (`hoveredRef` set via firing the captured `mousemove` handler is overkill — instead
      fire the captured `movestart` handler after seeding a hovered feature) and assert
      `setFeatureState` called with `{ hover: false }`, both `setFilter` calls got the empty
      filter, and the tooltip element lost `visible`.
- [ ] `npx vitest run src/hooks/__tests__/useMapInteractions.test.tsx` → new file green
- [ ] Browser sanity (dev server): cold load →
      `document.documentElement.scrollHeight === window.innerHeight` → `true`
- [ ] Commit: `fix(map): hover tooltip no longer overflows the page or lingers across camera moves`

## Task 2 — search: Enter commits the top result

- [ ] `src/components/SearchBar.tsx` — in the results effect, replace `setActiveIndex(-1)` with:

```ts
    // Auto-activate the top result so Enter commits it immediately
    // ("Search First" — approved 2026-07-10). Arrow keys move from here.
    setActiveIndex(results.length > 0 ? 0 : -1)
```

- [ ] Add `spellCheck={false}` to the `<input>` attributes.
- [ ] **New** `src/components/__tests__/SearchBar.test.tsx`: render with fixture countries
      (`makeCountryData` for France/Germany), type `fra` into the combobox, `await` the France
      option appearing (covers `useCountrySearch`'s debounce), press Enter, assert `onSelect`
      received `'FRA'`. Second case: ArrowDown then Enter selects the *second* result.
- [ ] `e2e/search.spec.ts`:
  - "selecting a result opens the country panel": delete the `await searchInput.press('ArrowDown')`
    line — Enter alone must yield `#FRA`.
  - "keyboard navigation: arrow down, enter selects": after the Germany option is visible, assert
    the first option has `aria-selected="true"`, then `ArrowDown` + `ArrowUp` (returns to top),
    then Enter → Germany panel. Keeps arrow-key coverage honest under auto-activation.
- [ ] `npx vitest run src/components/__tests__/SearchBar.test.tsx` → green
- [ ] Commit: `feat(search): Enter commits the top result; disable input spellcheck`

## Task 3 — cap highlight extrusions at z6

- [ ] `src/lib/mapLayers.ts` — add `maxzoom: 6` to `country-extrusion` (in `addHoverLayers`) and to
      the `${prefix}-extrusion` layer in `addHighlightStack`, each with the comment:

```ts
    // Cap the 3D lift at continent zooms: at high zoom the fixed-height column
    // renders as a wall crossing the viewport (Vatican smear, 2026-07-10 review).
    maxzoom: 6,
```

- [ ] **New** `src/lib/__tests__/mapLayers.test.ts` — fake map capturing `addLayer` specs; call
      `addHoverLayers` / `addSelectionLayers` / `addCompareLayers`; assert every
      `fill-extrusion`-type spec has `maxzoom: 6`.
- [ ] `npx vitest run src/lib/__tests__/mapLayers.test.ts` → green
- [ ] Commit: `fix(map): cap highlight extrusions at z6 to prevent high-zoom walls`

## Task 4 — flyToCountry: retuned zoom + preserveZoom option + panel-aware offset

- [ ] `src/lib/flyToCountry.ts` — full replacement:

```ts
import type maplibregl from 'maplibre-gl'
import type { CountryData } from './types'
import { DEFAULT_PITCH, MAX_ZOOM } from './mapStyles'
import { prefersReducedMotion } from './motion'

/** Area-derived zoom. Retuned 2026-07-10 (batch-1 spec §5b): the previous
 *  11 − 1.7·log₁₀ clamped everything above ~196k km² to the world view. */
function zoomFromArea(areaKm2: number): number {
  if (areaKm2 <= 0) return 6
  const zoom = 10.8 - Math.log10(areaKm2) * 1.35
  return Math.max(2, Math.min(MAX_ZOOM, zoom))
}

/** Screen-space offset so the country centers in the area the panel does not
 *  cover: desktop panel is right-4 w-[360px] (376px) at ≥1024px; the mobile
 *  sheet is h-[40vh]. */
function panelOffset(): [number, number] {
  if (window.matchMedia('(min-width: 1024px)').matches) return [-188, 0]
  return [0, -Math.round(window.innerHeight * 0.2)]
}

export interface FlyToCountryOptions {
  /** Never zoom out (map-click selections — 2026-05-17 decision). Auto
   *  selections (search, chips, deep link) fly to the computed zoom. */
  preserveZoom?: boolean
}

export function flyToCountry(
  map: maplibregl.Map,
  country: CountryData,
  { preserveZoom = false }: FlyToCountryOptions = {},
): void {
  const [lat, lng] = country.latlng
  const computed = zoomFromArea(country.area)
  const zoom = preserveZoom ? Math.max(map.getZoom(), computed) : computed
  const reducedMotion = prefersReducedMotion()

  map.flyTo({
    center: [lng, lat],
    zoom,
    offset: panelOffset(),
    pitch: reducedMotion ? 0 : DEFAULT_PITCH,
    duration: reducedMotion ? 0 : 1400,
    curve: 1.5,
  })
}
```

- [ ] Rewrite `src/lib/__tests__/flyToCountry.test.ts` (tolerance assertions, jsdom `matchMedia`
      mocked to desktop): tiny-country zoom-in (Vatican > 10 either origin); click-origin
      preserves current 4 on Russia (`preserveZoom: true` → 4); auto-origin zooms out
      (`getZoom: 11.5`, Japan, no options → `toBeCloseTo(3.3, 0)`); mid-size country meaningful
      zoom (Germany ≈ 3.3 from 1.8); reduced-motion composition; `offset` `[-188, 0]` on desktop
      and `[0, -h*0.2]` when `matchMedia` says mobile.
- [ ] `npx vitest run src/lib/__tests__/flyToCountry.test.ts` → green
- [ ] Commit: `feat(map): retuned selection zoom with panel-aware offset and preserveZoom option`

## Task 5 — origin plumbing (click vs auto)

- [ ] **New** `src/lib/selectionOrigin.ts`:

```ts
/** Transient carrier for HOW the next selection was made. Selection state
 *  flows through the URL hash, which cannot carry this bit. The map-click
 *  path marks; useSelectedCountry.resolveHash takes (and thereby resets) on
 *  every hashchange, so a mark can never leak into a later selection.
 *  (2026-05-17 preserve-zoom spec's documented migration path.) */
let pending: 'click' | null = null

export function markClickOrigin(): void {
  pending = 'click'
}

export function takeOrigin(): 'click' | 'auto' {
  const origin = pending ?? 'auto'
  pending = null
  return origin
}
```

- [ ] `src/hooks/useMapInteractions.ts` — in `clickCountry`, before `onSelectRef.current(...)`:

```ts
        markClickOrigin()
```

      (import from `../lib/selectionOrigin`). This is the only click-origin site — `onMapSelect`
      in App is shared with search/chips, so the mark must live here, not there.
- [ ] `src/hooks/useSelectedCountry.ts` — add `const selectionOriginRef = useRef<'click' | 'auto'>('auto')`;
      first line of `resolveHash`: `selectionOriginRef.current = takeOrigin()`; include
      `selectionOriginRef` in the return value (ref, not state — reading it in the fly effect must
      not re-trigger that effect).
- [ ] `src/App.tsx` — destructure `selectionOriginRef` and pass to `<WorldMap …>`.
- [ ] `src/components/WorldMap.tsx` — accept prop, pass into `useSelectionHighlight`.
- [ ] `src/hooks/useSelectionHighlight.ts`:

```ts
    if (selected)
      flyToCountry(map, selected, { preserveZoom: selectionOriginRef.current === 'click' })
```

- [ ] Update `src/hooks/__tests__/useSelectionHighlight.test.tsx` for the new prop/arguments; add
      a case: origin ref `'click'` → `flyToCountry` called with `preserveZoom: true`.
- [ ] `npx vitest run src/hooks src/lib` → green
- [ ] Commit: `feat(map): map clicks keep zoom, auto selections may zoom out (origin-gated camera)`

## Task 6 — verification (batch)

- [ ] `npm run check` → lint, typecheck, unit all green
- [ ] Kill stray servers, then
      `npx playwright test search.spec.ts map-and-countries.spec.ts --project=chromium` → all pass
- [ ] Live pass (dev server, fresh profile):
  - cold load: no page scrollbars; `scrollHeight === innerHeight`
  - `#VAT`: no ribbon at z≈11; world-view selection still shows the lift
  - from `#VAT`, search "Japan": camera zooms OUT, Japan framed left of the panel
  - type "japan" + Enter (no arrows): Japan selected
  - hover a country, search-select another: no stale tooltip
  - offset spike check: selected country visually centered in the un-occluded area on desktop and
    above the sheet on mobile viewport (390×844); if `offset` misbehaves under globe, fall back to
    `padding` and re-verify
- [ ] Update spec Status → Accepted; commit any test/doc touch-ups
- [ ] On merge: move this plan to `docs/superpowers/plans/archive/`
