# Deferred Cleanups — Design

**Date:** 2026-04-18
**Status:** Draft — pending user review
**Supersedes:** none
**Predecessor:** `2026-04-17-findings-implementation-and-voting-removal-design.md` and the subsequent `/simplify` pass on commit `cf75145`.

## Context

The 2026-04-17 implementation plan landed seven phases of refactor / docs / test work in 25 commits on branch `plan/findings-and-voting-removal`. A subsequent `/simplify` pass on that work fixed one regression and several quality issues but explicitly deferred a list of items. This spec covers the deferred items.

Two findings emerged during self-review of the deferred list that change the plan:

1. **`map.setFog(...)` is not a MapLibre method.** It exists in Mapbox GL JS only; MapLibre never implemented it. The current code in `useMapTheme.ts` casts to `as never as { setFog: ... }` to silence TypeScript, then calls a non-existent method, then swallows the resulting `TypeError` with the surrounding `try/catch`. The "fog" effect the original developer intended has never run. The actual fog properties (`'fog-color'`, `'fog-ground-blend'`, `'horizon-fog-blend'`) are passed to `setSky` instead, which is the correct MapLibre API.

2. **`map.setSky` IS already typed in MapLibre 5.23.** The `as never as { setSky: ... }` cast is unnecessary noise.

These two findings collapse what was originally planned as a "module augmentation" phase into a "dead-code removal" phase.

## Goals

1. Replace 60+ string-literal layer IDs with a typed const map so renames and typos are caught at compile time.
2. Remove the dead `setFog` block and the unneeded `setSky` cast in `useMapTheme.ts`.
3. Fix the stale `loaded` closure in `useMapInstance.ts`'s error handler.
4. Consolidate cursor logic into `useMapInteractions.ts` so `useSatelliteMode.ts` covers only satellite/terrain.
5. Split the compare-view dimming concern out of `useSelectionHighlight.ts` into its own hook.
6. Reduce the `useMap` context surface by moving the single-reader `hoveredRef` into `useMapInteractions`.
7. Extract `CloseButton` and `FieldLabel` shared components used by `SingleCountryPanel.tsx` and `CountryColumn.tsx`.

## Non-Goals

- Tooltip DOM rebuild optimization (Phase 7 of the original list, deferred per Q5 — current code is fine).
- Variant `<CountryHeader>` component (original Q2 option C, rejected as over-parameterized).
- Any new feature work, brand changes, data changes, or component visual redesign.
- Re-implementing real fog (separate from removing the dead `setFog` call). If fog is wanted, it should be a deliberate spec — not part of this cleanup.
- Replacing the `useMap` context entirely or moving away from it (only minimal collapse).

## High-Level Shape

Seven sequential phases on the existing `plan/findings-and-voting-removal` branch (already 25 commits ahead of `main`). Each phase is its own commit, lint + tsc + unit + e2e green between phases. Each phase is independently revertable.

| # | Phase | Type | Risk |
|---|---|---|---|
| 1 | Layer-id constants | Type-safety | Low (mechanical rename) |
| 2 | Delete dead `setFog`, drop `setSky` cast | Dead-code removal | Low |
| 3 | Stale `loaded` closure → `loadedRef` | Bug fix | Low |
| 4 | Cursor consolidation | Restructure | Medium (touches two hooks) |
| 5 | `useSelectionHighlight` split | Restructure | Medium (call-order trap) |
| 6 | `useMap` context partial collapse | Restructure | Low |
| 7 | Shared `CloseButton` + `FieldLabel` | Reuse | Low |

## Phase 1 — Layer-ID Constants

**Intent:** Replace string-literal layer IDs across `src/lib/mapLayers.ts` and the five map hooks with a typed `const` map. Catches typos at compile time and gives one edit-point for renames.

**New export in `src/lib/mapLayers.ts`:**

```typescript
export const LAYER = {
  fill: 'country-fill',
  borders: 'country-borders',
  hoverBorder: 'country-hover-border',
  extrusion: 'country-extrusion',
  selected: 'country-selected',
  selectedBorder: 'country-selected-border',
  selectedGlow: 'country-selected-glow',
  selectedExtrusion: 'country-selected-extrusion',
  compareFill: 'country-compare-fill',
  compareBorder: 'country-compare-border',
  compareGlow: 'country-compare-glow',
  compareExtrusion: 'country-compare-extrusion',
  satellite: 'satellite-layer',
} as const
```

**Replace string literals in:**
- `src/lib/mapLayers.ts` (`addBaseCountryLayers`, `addHoverLayers`, `applyDefaultBorderPaint`)
- `src/hooks/useMapInteractions.ts` (filter writes, query layer)
- `src/hooks/useSelectionHighlight.ts` (filter writes)
- `src/hooks/useMapTheme.ts` (paint property writes)
- `src/hooks/useSatelliteMode.ts` (paint / layout property writes; `customPrefixes` check)

**Deliberate exception:** `addHighlightStack` in `mapLayers.ts` keeps its internal `${prefix}-glow` style concatenation. The constants are for external references; the helper's internal naming convention stays local. Adding a constant lookup inside `addHighlightStack` would force the constants to encode the suffix structure, defeating the helper's purpose.

**Verification:**
- `grep -nE "'country-(fill|borders|hover|extrusion|selected|compare)|'satellite-layer'"` returns hits only inside `mapLayers.ts` (the constant values).
- All e2e tests pass unchanged.

## Phase 2 — Delete Dead `setFog`, Drop `setSky` Cast

**Intent:** Remove the dead `setFog` call and the unneeded `setSky` cast in `useMapTheme.ts`.

**Edits to `src/hooks/useMapTheme.ts`:**

1. Delete the entire `setFog` block:
   ```typescript
   ;(map as never as { setFog: (fog: Record<string, unknown>) => void }).setFog({
     range: [1.5, 10],
     color: ...,
     'high-color': ...,
     'horizon-blend': 0.1,
   })
   ```
2. Replace the `setSky` cast with a direct call. The `SkySpecification` type accepts the same property bag the current code passes, so no value changes are needed beyond the cast removal.

**Optional polish (in scope):** rename the `try/catch` comment from "Layers may not exist yet" to be specific — the catch protects against `setSky` running before the basemap style commits its sky/fog properties.

**Verification:**
- `grep -n "setFog" src/` returns zero results.
- `grep -n "as never as" src/` returns zero results.
- All e2e tests pass; theme toggling still produces the expected sky / atmosphere appearance (no visible regression — fog config was already in `setSky`, the dead call was a no-op).

**Risk:** None. The `setFog` call has been silently failing since the project's inception; deleting it changes nothing observable.

## Phase 3 — Stale `loaded` Closure → `loadedRef`

**Intent:** Fix the bug where `useMapInstance.ts`'s `map.on('error', ...)` handler reads a stale `loaded === false` because the init effect's deps don't include `loaded`.

**Edits to `src/hooks/useMapInstance.ts`:**

```typescript
const [loaded, setLoaded] = useState(false)
const loadedRef = useRef(false)

// ... inside the init effect:
map.on('load', () => {
  // ... existing setup ...
  Promise.resolve(onLoad(map))
    .then(() => {
      // INVARIANT: loadedRef and the loaded state must be set together.
      // Closures inside this effect read loadedRef; React rendering reads loaded.
      loadedRef.current = true
      setLoaded(true)
    })
    .catch((err: unknown) => {
      console.error(err)
      setMapErrorState((prev) => prev ?? 'country-data')
    })
})

map.on('error', (e) => {
  console.warn('Map error:', e.error?.message || e)
  setMapErrorState((prev) => {
    if (prev !== null) return prev
    return loadedRef.current ? prev : 'style'
  })
})
```

**Verification:**
- The invariant comment makes the pair-write explicit so future refactors don't break it.
- All existing tests pass unchanged.
- No new test added; reproducing the original bug requires triggering a post-load `'error'` event, which is hard to do deterministically in jsdom and isn't worth the test complexity.

## Phase 4 — Cursor Consolidation

**Intent:** Move the `comparePickingMode` cursor effect from `useSatelliteMode.ts` (where it doesn't belong) into `useMapInteractions.ts` (where the rest of the cursor logic already lives).

**Edits to `src/hooks/useSatelliteMode.ts`:**
- Remove the first `useEffect` (the `comparePickingMode` cursor switch).
- Remove `comparePickingMode` from `Options` interface.
- Remove the `hoveredRef` reference (`useMap()` destructuring drops it).

**Edits to `src/hooks/useMapInteractions.ts`:**
- Add `comparePickingMode: boolean` to `Options`.
- Add a new effect alongside the existing handler-attachment effect:
  ```typescript
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    const canvas = map.getCanvas()
    if (comparePickingMode) {
      canvas.style.cursor = 'crosshair'
    } else {
      canvas.style.cursor = hoveredRef.current ? 'pointer' : 'grab'
    }
  }, [comparePickingMode, loaded, mapRef, hoveredRef])
  ```

**Edits to `src/components/WorldMap.tsx`:**
- `useMapInteractions({ loaded, byNumeric, onSelect, onDeselect, comparePickingMode })`.
- `useSatelliteMode({ loaded, satellite, resolvedTheme })` — drop `comparePickingMode`.

**Verification:**
- E2E for compare-picking cursor (the `chromium-gpu` `map-and-countries.spec.ts` covers compare-picking flow indirectly).
- Existing `useSelectionHighlight.test.tsx` and `useMapInstance.test.tsx` are unaffected.

## Phase 5 — `useSelectionHighlight` Split

**Intent:** Pull the third (compare-view dimming) effect out of `useSelectionHighlight.ts` into a new dedicated hook. `useSelectionHighlight` keeps its symmetric selection + compare filter effects.

**New file `src/hooks/useCompareViewDimming.ts`:**

```typescript
import { useEffect } from 'react'
import {
  EMPTY_FILTER as EMPTY,
  DEFAULT_FILL_OPACITY,
  applyDefaultBorderPaint,
  LAYER,
} from '../lib/mapLayers'
import { useMap } from './useMap'

interface Options {
  loaded: boolean
  compareWith: { ccn3: string } | null
  satellite: boolean
  resolvedTheme: 'light' | 'dark'
}

/** When the user is in compare view, dim the base fill + borders and
 *  suppress hover highlights so the two compared countries stand out.
 *  Must run AFTER useMapTheme — both write country-borders line-opacity
 *  on theme change; this hook needs to win that race when compareWith
 *  is non-null. */
export function useCompareViewDimming({
  loaded,
  compareWith,
  satellite,
  resolvedTheme,
}: Options): void {
  const { mapRef } = useMap()

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    const inCompareView = compareWith !== null
    try {
      if (inCompareView) {
        map.setPaintProperty(LAYER.fill, 'fill-opacity', 0.05)
        map.setFilter(LAYER.hoverBorder, EMPTY)
        map.setFilter(LAYER.extrusion, EMPTY)
        map.setPaintProperty(LAYER.borders, 'line-opacity', 0.15)
      } else if (!satellite) {
        map.setPaintProperty(LAYER.fill, 'fill-opacity', DEFAULT_FILL_OPACITY)
        applyDefaultBorderPaint(map, resolvedTheme === 'dark')
      }
    } catch {
      // Layers may not exist yet (e.g. fast theme toggle before load completes).
    }
  }, [compareWith, loaded, satellite, resolvedTheme, mapRef])
}
```

**Edits to `src/hooks/useSelectionHighlight.ts`:**
- Remove the third effect entirely.
- Remove `satellite` and `resolvedTheme` from `Options` (only used by the removed effect).
- Drop the `applyDefaultBorderPaint`, `DEFAULT_FILL_OPACITY` imports.

**Edits to `src/components/WorldMap.tsx` — call order matters:**

```typescript
useMapInteractions({ loaded, byNumeric, onSelect, onDeselect, comparePickingMode })
useSelectionHighlight({ loaded, selected, compareWith })
useMapTheme({ loaded, resolvedTheme })
useSatelliteMode({ loaded, satellite, resolvedTheme })
useCompareViewDimming({ loaded, compareWith, satellite, resolvedTheme })  // MUST be after useMapTheme
```

**Why the order:** Both `useMapTheme` and `useCompareViewDimming` write `country-borders` `line-opacity` on `resolvedTheme` change. React fires effects in hook-call order. The dimming hook must win when `compareWith !== null`; therefore it must run last.

**New e2e spec `e2e/compare-view-dimming.spec.ts`** (added to the `chromium-gpu` project):
- Open compare view (select country A, compare-pick country B).
- Toggle dark mode.
- Assert `country-borders` `line-opacity` is still the dimmed value (0.15), not the theme default (0.5/0.35). Read via `__funworldmap_map.getPaintProperty(LAYER.borders, 'line-opacity')`.

**Edits to `src/hooks/__tests__/useSelectionHighlight.test.tsx`:**
- Remove the `'dims base fill when compareWith is present'` test — that behavior moved to the new hook.
- Update the test wrapper to match the trimmed `Options` shape.

**Risk:** Call-order is the highest-risk subtle bug in this plan. The new e2e test guards it.

## Phase 6 — `useMap` Context Partial Collapse

**Intent:** Move `hoveredRef` (single reader) out of context into `useMapInteractions` as a local `useRef`. Keep `mapRef` and `tooltipRef` in context — `mapRef` is read by all five map hooks, `tooltipRef` is genuinely shared between `useMapInstance` (writes) and `useMapInteractions` (reads).

**Edits to `src/hooks/useMap.tsx`:**

```typescript
interface MapRefs {
  mapRef: MutableRefObject<maplibregl.Map | null>
  tooltipRef: MutableRefObject<HTMLDivElement | null>
}
// ... drop hoveredRef from MapProvider
```

**Edits to `src/hooks/useMapInteractions.ts`:**
- Add `const hoveredRef = useRef<string | null>(null)` at hook top.
- Drop `hoveredRef` from `useMap()` destructuring.
- Update effect deps to include the local `hoveredRef` (refs are stable, so this is moot but keeps lint happy).

**Edits to `src/hooks/useSatelliteMode.ts`:**
- Already lost its `hoveredRef` reference in Phase 4. After Phase 6, the hook's `useMap()` line drops `hoveredRef` from destructuring (was already unused at this point).

**Verification:**
- All existing tests pass.
- `useMapInstance.test.tsx` is unaffected (it never used `hoveredRef`).
- `useSelectionHighlight.test.tsx` is unaffected.

**Why `tooltipRef` stays:** Pulling it out cleanly requires either (a) returning it as a ref from `useMapInstance`, which is awkward because callers can mutate it without React knowing, or (b) creating a third `useMapTooltip` hook to own it, which is overkill for a single read site. The 2-ref context is honest and small.

## Phase 7 — Shared `CloseButton` + `FieldLabel`

**Intent:** Eliminate the inline X-SVG button and the `text-[11px] uppercase ... + SourceTooltip` label-with-tooltip pattern that currently repeat across `SingleCountryPanel.tsx` and `CountryColumn.tsx`.

**New file `src/components/CloseButton.tsx`:**

```tsx
interface Props {
  onClick: () => void
  ariaLabel: string
  testId?: string
  className?: string
}

export function CloseButton({ onClick, ariaLabel, testId, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={testId}
      className={
        className ??
        'p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-500 dark:text-dark-100 transition-colors'
      }
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  )
}
```

**New file `src/components/FieldLabel.tsx`:**

```tsx
import type { CountryData, CountriesFile } from '../lib/types'
import SourceTooltip from './SourceTooltip'

interface Props {
  label: string
  field: string
  country: CountryData
  sources: CountriesFile['_sources']
  className?: string
}

export function FieldLabel({ label, field, country, sources, className }: Props) {
  return (
    <div
      className={
        className ??
        'text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light mb-0.5 flex items-center gap-1'
      }
    >
      {label}
      <SourceTooltip field={field} fieldSources={country._fieldSources} sources={sources} />
    </div>
  )
}
```

**Edits to `src/components/SingleCountryPanel.tsx`:**
- Replace the inline close button SVG (in the header) with `<CloseButton onClick={onClose} ariaLabel="Close panel" testId="panel-close" />`.
- Replace the `DataCell` label `<div>` block with `<FieldLabel label={label} field={field} country={country} sources={sources} />`.
- Replace the inline Borders label block (the `text-[11px] ... mb-2 ...` div) with `<FieldLabel label="Borders" field="borders" country={country} sources={sources} className="text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light mb-2 flex items-center gap-1" />`. **Note:** the `className` prop in `FieldLabel` fully replaces the default classes (no merge). The override here exists only to swap `mb-0.5` for `mb-2`; everything else matches the default.

**Edits to `src/components/CountryColumn.tsx`:**
- Replace the inline close button SVG with `<CloseButton onClick={onClose} ariaLabel="Exit compare" />`.

**Verification:**
- All existing panel/deeplink/compare e2e tests pass unchanged.
- Visual regression check: the close button still has the same hit area, the field labels still render identically (CSS classes preserved).

## Cross-Phase Quality Gates

Before closing each phase:

1. `npm run lint` — zero warnings.
2. `tsc -b` — zero errors.
3. `npm run test:unit` — all green (currently 70 tests).
4. `npm run test:e2e` — all green (currently 56 tests; +1 in Phase 5).
5. `npm run build` — succeeds.

## Branch Strategy

Extend the existing `plan/findings-and-voting-removal` branch (currently 25 commits ahead of `main`, last commit `cf75145`). After all 7 phases land, the same branch / PR carries the work.

Rationale: this is the same cleanup arc as the original plan and the `/simplify` pass. A new branch would split the review surface artificially. If the user prefers a separate PR for this slice, cherry-picking phase commits is straightforward — they're each atomic.

## Rollback Strategy

Each phase is a single commit. If a phase regresses something detected later, `git revert <SHA>` restores the prior phase's state without affecting downstream phases (they touch independent files except for the call-order coupling in Phase 5, which depends on Phase 4 having landed).

## Open Items

None at design time. Remaining decisions are mechanical and can be made during execution.

## Appendix: Items → Phases Traceability

| Original deferred item | Phase |
|---|---|
| Layer-id constants (originally /simplify item #1) | 1 |
| `setFog`/`setSky` casts (originally item #8) | 2 |
| Stale `loaded` closure (originally efficiency #2 / item #6) | 3 |
| `useSatelliteMode` cursor effect (originally item #5) | 4 |
| `useSelectionHighlight` split (originally item #4) | 5 |
| `useMap` context over-specification (originally item #2) | 6 |
| `PanelHeader` / `FieldLabel` extraction (originally item #3, scope B) | 7 |
| Tooltip rebuild optimization (originally item #7) | **OUT OF SCOPE** per Q5 |
