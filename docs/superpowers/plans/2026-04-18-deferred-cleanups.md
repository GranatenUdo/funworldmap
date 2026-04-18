# Deferred Cleanups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the seven deferred cleanups from the 2026-04-17 simplify pass: layer-id constants, removal of dead `setFog` code, fix the stale `loaded` closure, consolidate cursor logic, split `useSelectionHighlight`, partially collapse the `useMap` context, and extract shared `CloseButton` + `FieldLabel` components.

**Architecture:** Seven sequential phases on the existing `plan/findings-and-voting-removal` branch. Each phase is one or two commits; full lint + tsc + unit + e2e runs between phases. The work is behavior-preserving everywhere except Phase 2 (deletes a no-op `setFog` call that has been silently throwing) and Phase 3 (closes a stale-closure bug that may produce one extra `MapErrorOverlay` after a post-load tile error).

**Tech Stack:** React 19 + Vite 6 + TypeScript 5.7, MapLibre GL 5.23, Vitest 4 (jsdom env), Playwright 1.59 (two projects: `chromium` for SwiftShader DOM tests, `chromium-gpu` for ANGLE WebGL tests).

**Design reference:** `docs/superpowers/specs/2026-04-18-deferred-cleanups-design.md`.

**Scope out:** tooltip DOM rebuild optimization (Phase 7 from the original list — current code is fine); variant `<CountryHeader>` extraction (rejected as over-parameterized); any new feature work, brand changes, data changes, or visual redesign; re-implementing real fog (only deletes the dead call); replacing the `useMap` context entirely (only minimal collapse).

---

## File Structure

**Files to create:**

- Phase 1: none (constant added to existing `src/lib/mapLayers.ts`)
- Phase 2: none
- Phase 3: none
- Phase 4: none
- Phase 5:
  - `src/hooks/useCompareViewDimming.ts` — pulls the dimming effect out of `useSelectionHighlight`
  - `e2e/compare-view-dimming.spec.ts` — guards the call-order coupling
- Phase 6: none
- Phase 7:
  - `src/components/CloseButton.tsx` — shared close-X button
  - `src/components/FieldLabel.tsx` — shared label-with-source-tooltip wrapper

**Files to modify:**

- Phase 1: `src/lib/mapLayers.ts`, `src/hooks/useMapInteractions.ts`, `src/hooks/useSelectionHighlight.ts`, `src/hooks/useMapTheme.ts`, `src/hooks/useSatelliteMode.ts`
- Phase 2: `src/hooks/useMapTheme.ts`
- Phase 3: `src/hooks/useMapInstance.ts`
- Phase 4: `src/hooks/useMapInteractions.ts`, `src/hooks/useSatelliteMode.ts`, `src/components/WorldMap.tsx`
- Phase 5: `src/hooks/useSelectionHighlight.ts`, `src/hooks/__tests__/useSelectionHighlight.test.tsx`, `src/components/WorldMap.tsx`, `playwright.config.ts`
- Phase 6: `src/hooks/useMap.tsx`, `src/hooks/useMapInteractions.ts`, `src/hooks/useSatelliteMode.ts`
- Phase 7: `src/components/SingleCountryPanel.tsx`, `src/components/CountryColumn.tsx`

**Files NOT modified:**

- `src/data/countries.json` — data layer untouched
- `src/lib/mapStyles.ts`, `src/lib/mapColors.ts`, `src/lib/probeBasemap.ts`, `src/lib/flyToCountry.ts`, `src/lib/loadCountryGeojson.ts`, `src/lib/resetViewControl.ts`, `src/lib/motion.ts`, `src/lib/mapPalette.ts`, `src/lib/hashState.ts`, `src/lib/initSentry.ts`, `src/lib/types.ts` — already good
- `src/App.tsx` — only consumes `WorldMap`'s public API; doesn't change

---

## Pre-flight

- [ ] **Step 0.1: Verify clean working tree on the right branch**

Run:
```bash
git -C E:/polworldmap status
git -C E:/polworldmap branch --show-current
```
Expected: branch is `plan/findings-and-voting-removal`. Working tree clean (only the two pre-existing untracked plan files `docs/superpowers/plans/2026-04-16-fix-ci-bugs-and-perf.md` and `docs/superpowers/plans/2026-04-17-chromium-gpu-on-linux.md`). If on a different branch, switch first; if dirty, stop and fix before starting.

- [ ] **Step 0.2: Verify last commit is the expected baseline**

Run:
```bash
git -C E:/polworldmap log -1 --oneline
```
Expected: `92fdefb docs(spec): deferred-cleanups design`. If different, this plan was written against a different baseline — verify nothing else has landed since.

- [ ] **Step 0.3: Run full verification at baseline**

Run:
```bash
cd E:/polworldmap
npm run lint
tsc -b
npm run test:unit
npm run build
npm run test:e2e
```
Expected: all green. 70 unit tests, 56 e2e tests. If any fails, stop and resolve before starting Phase 1.

---

# Phase 1 — Layer-ID Constants

Intent: replace string-literal layer IDs with a typed `const LAYER` map exported from `src/lib/mapLayers.ts`.

### Task 1.1: Add the `LAYER` constant

**Files:**
- Modify: `src/lib/mapLayers.ts` — add new export at the bottom

- [ ] **Step 1.1.1: Append the `LAYER` const to `mapLayers.ts`**

Open `src/lib/mapLayers.ts`. After the existing `applyDefaultBorderPaint` function (currently the last named export), add:

```typescript
/** Typed layer ID registry. Use these constants when calling `setFilter`,
 *  `setPaintProperty`, `setLayoutProperty`, etc. so renames stay consistent
 *  and typos fail at compile time. */
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

- [ ] **Step 1.1.2: Verify the file still compiles**

Run:
```bash
cd E:/polworldmap
npx tsc -b 2>&1 | tail -3
```
Expected: no output (zero errors). Constant is unused but not flagged because it's exported.

### Task 1.2: Use `LAYER` inside `mapLayers.ts`'s own functions

**Files:**
- Modify: `src/lib/mapLayers.ts:36-69` (`addCountrySource`, `addBaseCountryLayers`, `addHoverLayers`)

The `addHighlightStack` helper KEEPS its internal `${prefix}-glow` style concatenation — do not refactor it to look up via `LAYER`. The constants are for external references; rewriting the helper would couple it to the constant shape unnecessarily.

- [ ] **Step 1.2.1: Replace string IDs in the non-highlight factory functions**

Edit `src/lib/mapLayers.ts`. In `addBaseCountryLayers`, change:
```typescript
  map.addLayer({
    id: 'country-fill',
```
to:
```typescript
  map.addLayer({
    id: LAYER.fill,
```

In the same function, change:
```typescript
  map.addLayer({
    id: 'country-borders',
```
to:
```typescript
  map.addLayer({
    id: LAYER.borders,
```

In `addHoverLayers`, change:
```typescript
  map.addLayer({
    id: 'country-hover-border',
```
to:
```typescript
  map.addLayer({
    id: LAYER.hoverBorder,
```

And:
```typescript
  map.addLayer({
    id: 'country-extrusion',
```
to:
```typescript
  map.addLayer({
    id: LAYER.extrusion,
```

In `applyDefaultBorderPaint`, change both lines:
```typescript
  map.setPaintProperty('country-borders', 'line-color', isDark ? '#1e293b' : '#94a3b8')
  map.setPaintProperty('country-borders', 'line-opacity', isDark ? 0.5 : 0.35)
```
to:
```typescript
  map.setPaintProperty(LAYER.borders, 'line-color', isDark ? '#1e293b' : '#94a3b8')
  map.setPaintProperty(LAYER.borders, 'line-opacity', isDark ? 0.5 : 0.35)
```

- [ ] **Step 1.2.2: Verify**

Run:
```bash
cd E:/polworldmap
npx tsc -b 2>&1 | tail -3
```
Expected: no errors.

### Task 1.3: Use `LAYER` in `useMapInteractions.ts`

**Files:**
- Modify: `src/hooks/useMapInteractions.ts`

- [ ] **Step 1.3.1: Add the import**

At the top of `src/hooks/useMapInteractions.ts`, add:
```typescript
import { LAYER } from '../lib/mapLayers'
```

- [ ] **Step 1.3.2: Replace string IDs in event handlers**

Inside the `mousemoveHover` handler, change:
```typescript
        map.setFilter('country-extrusion', ['==', ['get', 'id'], id])
        map.setFilter('country-hover-border', ['==', ['get', 'id'], id])
```
to:
```typescript
        map.setFilter(LAYER.extrusion, ['==', ['get', 'id'], id])
        map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], id])
```

Inside `mouseleaveHover`, change:
```typescript
      map.setFilter('country-extrusion', ['==', ['get', 'id'], ''])
      map.setFilter('country-hover-border', ['==', ['get', 'id'], ''])
```
to:
```typescript
      map.setFilter(LAYER.extrusion, ['==', ['get', 'id'], ''])
      map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], ''])
```

Inside `clickMap`, change:
```typescript
      const features = map.queryRenderedFeatures(e.point, { layers: ['country-fill'] })
```
to:
```typescript
      const features = map.queryRenderedFeatures(e.point, { layers: [LAYER.fill] })
```

Then attach the listeners with the new IDs. Change:
```typescript
    map.on('mousemove', 'country-fill', mousemoveHover)
```
and the matching `mouseleave` and `click` calls to use `LAYER.fill`. Same for the `map.off` calls in the cleanup return:
```typescript
    map.on('mousemove', LAYER.fill, mousemoveHover)
    map.on('mousemove', mousemovePosition)
    map.on('mouseleave', LAYER.fill, mouseleaveHover)
    map.on('click', LAYER.fill, clickCountry)
    map.on('click', clickMap)
    map.on('dragstart', dragStart)
    map.on('dragend', dragEnd)
```
And:
```typescript
      map.off('mousemove', LAYER.fill, mousemoveHover)
      map.off('mousemove', mousemovePosition)
      map.off('mouseleave', LAYER.fill, mouseleaveHover)
      map.off('click', LAYER.fill, clickCountry)
      map.off('click', clickMap)
      map.off('dragstart', dragStart)
      map.off('dragend', dragEnd)
```

- [ ] **Step 1.3.3: Verify**

Run:
```bash
cd E:/polworldmap
npx tsc -b 2>&1 | tail -3
```
Expected: no errors.

### Task 1.4: Use `LAYER` in `useSelectionHighlight.ts`

**Files:**
- Modify: `src/hooks/useSelectionHighlight.ts`

- [ ] **Step 1.4.1: Add `LAYER` to the existing import**

Change the existing import block:
```typescript
import {
  EMPTY_FILTER as EMPTY,
  DEFAULT_FILL_OPACITY,
  applyDefaultBorderPaint,
} from '../lib/mapLayers'
```
to:
```typescript
import {
  EMPTY_FILTER as EMPTY,
  DEFAULT_FILL_OPACITY,
  applyDefaultBorderPaint,
  LAYER,
} from '../lib/mapLayers'
```

- [ ] **Step 1.4.2: Replace string IDs in the three effects**

In the first effect (selection filters), change:
```typescript
      map.setFilter('country-selected', filter)
      map.setFilter('country-selected-border', filter)
      map.setFilter('country-selected-glow', filter)
      map.setFilter('country-selected-extrusion', filter)
      flyToCountry(map, selected)
    } else {
      map.setFilter('country-selected', EMPTY)
      map.setFilter('country-selected-border', EMPTY)
      map.setFilter('country-selected-glow', EMPTY)
      map.setFilter('country-selected-extrusion', EMPTY)
    }
```
to:
```typescript
      map.setFilter(LAYER.selected, filter)
      map.setFilter(LAYER.selectedBorder, filter)
      map.setFilter(LAYER.selectedGlow, filter)
      map.setFilter(LAYER.selectedExtrusion, filter)
      flyToCountry(map, selected)
    } else {
      map.setFilter(LAYER.selected, EMPTY)
      map.setFilter(LAYER.selectedBorder, EMPTY)
      map.setFilter(LAYER.selectedGlow, EMPTY)
      map.setFilter(LAYER.selectedExtrusion, EMPTY)
    }
```

In the second effect (compare filters), similarly replace `'country-compare-fill'` → `LAYER.compareFill`, `'country-compare-border'` → `LAYER.compareBorder`, `'country-compare-glow'` → `LAYER.compareGlow`, `'country-compare-extrusion'` → `LAYER.compareExtrusion`. Both `if` and `else` branches.

In the third effect (compare-view dimming), change:
```typescript
        map.setPaintProperty('country-fill', 'fill-opacity', 0.05)
        map.setFilter('country-hover-border', EMPTY)
        map.setFilter('country-extrusion', EMPTY)
        map.setPaintProperty('country-borders', 'line-opacity', 0.15)
      } else if (!satellite) {
        map.setPaintProperty('country-fill', 'fill-opacity', DEFAULT_FILL_OPACITY)
```
to:
```typescript
        map.setPaintProperty(LAYER.fill, 'fill-opacity', 0.05)
        map.setFilter(LAYER.hoverBorder, EMPTY)
        map.setFilter(LAYER.extrusion, EMPTY)
        map.setPaintProperty(LAYER.borders, 'line-opacity', 0.15)
      } else if (!satellite) {
        map.setPaintProperty(LAYER.fill, 'fill-opacity', DEFAULT_FILL_OPACITY)
```

- [ ] **Step 1.4.3: Verify**

Run:
```bash
cd E:/polworldmap
npx tsc -b 2>&1 | tail -3
```
Expected: no errors.

### Task 1.5: Use `LAYER` in `useMapTheme.ts`

**Files:**
- Modify: `src/hooks/useMapTheme.ts`

- [ ] **Step 1.5.1: Add `LAYER` to the existing import**

Change:
```typescript
import { applyDefaultBorderPaint } from '../lib/mapLayers'
```
to:
```typescript
import { applyDefaultBorderPaint, LAYER } from '../lib/mapLayers'
```

- [ ] **Step 1.5.2: Replace string IDs in the paint-property writes**

Change the seven `setPaintProperty` calls inside the `try` block:
```typescript
      map.setPaintProperty('country-fill', 'fill-color', teal)
      map.setPaintProperty('country-extrusion', 'fill-extrusion-color', teal)
      map.setPaintProperty('country-hover-border', 'line-color', teal)

      map.setPaintProperty('country-selected', 'fill-color', coral)
      map.setPaintProperty('country-selected-border', 'line-color', coral)
      map.setPaintProperty('country-selected-glow', 'line-color', coral)
      map.setPaintProperty('country-selected-extrusion', 'fill-extrusion-color', coral)
```
to:
```typescript
      map.setPaintProperty(LAYER.fill, 'fill-color', teal)
      map.setPaintProperty(LAYER.extrusion, 'fill-extrusion-color', teal)
      map.setPaintProperty(LAYER.hoverBorder, 'line-color', teal)

      map.setPaintProperty(LAYER.selected, 'fill-color', coral)
      map.setPaintProperty(LAYER.selectedBorder, 'line-color', coral)
      map.setPaintProperty(LAYER.selectedGlow, 'line-color', coral)
      map.setPaintProperty(LAYER.selectedExtrusion, 'fill-extrusion-color', coral)
```

- [ ] **Step 1.5.3: Verify**

Run:
```bash
cd E:/polworldmap
npx tsc -b 2>&1 | tail -3
```
Expected: no errors.

### Task 1.6: Use `LAYER` in `useSatelliteMode.ts`

**Files:**
- Modify: `src/hooks/useSatelliteMode.ts`

- [ ] **Step 1.6.1: Add `LAYER` to the existing import**

Change:
```typescript
import { DEFAULT_FILL_OPACITY, applyDefaultBorderPaint } from '../lib/mapLayers'
```
to:
```typescript
import { DEFAULT_FILL_OPACITY, applyDefaultBorderPaint, LAYER } from '../lib/mapLayers'
```

- [ ] **Step 1.6.2: Replace satellite layer IDs and paint writes**

Change:
```typescript
      map.setLayoutProperty(
        'satellite-layer',
        'visibility',
        satellite ? 'visible' : 'none',
      )
```
to:
```typescript
      map.setLayoutProperty(
        LAYER.satellite,
        'visibility',
        satellite ? 'visible' : 'none',
      )
```

Change the `customPrefixes` check (the prefix list documents which layers we own; keep as raw strings since they're prefixes, not full IDs):
```typescript
        const customPrefixes = ['country-', 'satellite-']
```
This stays unchanged — these are id prefixes, not IDs themselves.

Change the four `setPaintProperty` calls in the `if (satellite)` branch and the one in the `else` branch:
```typescript
      if (satellite) {
        map.setPaintProperty('country-borders', 'line-color', 'rgba(255,255,255,0.35)')
        map.setPaintProperty('country-borders', 'line-opacity', 0.6)
        map.setPaintProperty('country-fill', 'fill-opacity', [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.32,
          0.03,
        ])
      } else {
        applyDefaultBorderPaint(map, resolvedTheme === 'dark')
        map.setPaintProperty('country-fill', 'fill-opacity', DEFAULT_FILL_OPACITY)
      }
```
to:
```typescript
      if (satellite) {
        map.setPaintProperty(LAYER.borders, 'line-color', 'rgba(255,255,255,0.35)')
        map.setPaintProperty(LAYER.borders, 'line-opacity', 0.6)
        map.setPaintProperty(LAYER.fill, 'fill-opacity', [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.32,
          0.03,
        ])
      } else {
        applyDefaultBorderPaint(map, resolvedTheme === 'dark')
        map.setPaintProperty(LAYER.fill, 'fill-opacity', DEFAULT_FILL_OPACITY)
      }
```

- [ ] **Step 1.6.3: Verify**

Run:
```bash
cd E:/polworldmap
npx tsc -b 2>&1 | tail -3
```
Expected: no errors.

### Task 1.7: Final verification and commit Phase 1

- [ ] **Step 1.7.1: Confirm zero remaining string-literal layer IDs (outside `mapLayers.ts`)**

Run:
```bash
cd E:/polworldmap
grep -rnE "'country-(fill|borders|hover-border|extrusion|selected|selected-border|selected-glow|selected-extrusion|compare-fill|compare-border|compare-glow|compare-extrusion)'|'satellite-layer'" src/ --include="*.ts" --include="*.tsx" | grep -v "src/lib/mapLayers.ts"
```
Expected: zero hits. The only remaining string literals for these IDs should live inside `mapLayers.ts` (the `LAYER` const values).

- [ ] **Step 1.7.2: Run full verification**

Run:
```bash
cd E:/polworldmap
npm run lint
npx tsc -b
npm run test:unit
npm run build
npm run test:e2e
```
Expected: all green. 70 unit tests, 56 e2e tests.

- [ ] **Step 1.7.3: Commit Phase 1**

Run:
```bash
git -C E:/polworldmap add src/lib/mapLayers.ts src/hooks/useMapInteractions.ts src/hooks/useSelectionHighlight.ts src/hooks/useMapTheme.ts src/hooks/useSatelliteMode.ts
git -C E:/polworldmap commit -m "$(cat <<'EOF'
refactor(map): replace string-literal layer IDs with typed LAYER const

Adds LAYER constant in src/lib/mapLayers.ts and threads it through
mapLayers.ts (factory functions and applyDefaultBorderPaint) and the
four map hooks. Catches typos at compile time and gives one edit-point
for renames. addHighlightStack keeps its internal prefix concatenation
pattern unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 2 — Delete Dead `setFog` and Drop `setSky` Cast

Intent: remove the dead `setFog` block (the method does not exist on MapLibre 5.23 — verified against `node_modules/maplibre-gl/dist/maplibre-gl.d.ts`) and the unneeded `setSky` cast (the method IS typed in MapLibre).

### Task 2.1: Edit `useMapTheme.ts`

**Files:**
- Modify: `src/hooks/useMapTheme.ts:36-51`

- [ ] **Step 2.1.1: Delete the dead `setFog` block and replace the `setSky` cast**

In `src/hooks/useMapTheme.ts`, replace:
```typescript
      ;(map as never as { setFog: (fog: Record<string, unknown>) => void }).setFog({
        range: [1.5, 10],
        color: isDark ? 'rgba(16, 20, 26, 0.7)' : 'rgba(232, 227, 218, 0.5)',
        'high-color': isDark ? '#10141a' : '#c4d8e6',
        'horizon-blend': 0.1,
      })

      ;(map as never as { setSky: (sky: Record<string, unknown>) => void }).setSky({
        'sky-color': isDark ? '#0a1a2e' : '#88c6fc',
        'horizon-color': isDark ? '#1a2030' : '#f0ede6',
        'fog-color': isDark ? '#10141a' : '#e8e3da',
        'fog-ground-blend': 0.5,
        'horizon-fog-blend': 0.8,
        'sky-horizon-blend': 0.8,
        'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
      })
```
with:
```typescript
      map.setSky({
        'sky-color': isDark ? '#0a1a2e' : '#88c6fc',
        'horizon-color': isDark ? '#1a2030' : '#f0ede6',
        'fog-color': isDark ? '#10141a' : '#e8e3da',
        'fog-ground-blend': 0.5,
        'horizon-fog-blend': 0.8,
        'sky-horizon-blend': 0.8,
        'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
      })
```

- [ ] **Step 2.1.2: Update the catch comment**

Change:
```typescript
    } catch {
      // Layers may not exist yet.
    }
```
to:
```typescript
    } catch {
      // setPaintProperty / setSky throw if the basemap style hasn't
      // committed its layers yet (e.g. fast theme toggle on a slow load).
    }
```

### Task 2.2: Verify and commit Phase 2

- [ ] **Step 2.2.1: Confirm no `setFog` references and no remaining `as never as` casts**

Run:
```bash
cd E:/polworldmap
grep -rn "setFog" src/
grep -rn "as never as" src/
```
Expected: both return zero hits.

- [ ] **Step 2.2.2: Full verification**

Run:
```bash
cd E:/polworldmap
npm run lint
npx tsc -b
npm run test:unit
npm run build
npm run test:e2e
```
Expected: all green.

- [ ] **Step 2.2.3: Commit Phase 2**

Run:
```bash
git -C E:/polworldmap add src/hooks/useMapTheme.ts
git -C E:/polworldmap commit -m "$(cat <<'EOF'
refactor(map): remove dead setFog call and unneeded setSky cast

setFog is not a MapLibre method (verified against
node_modules/maplibre-gl/dist/maplibre-gl.d.ts — zero matches). The
prior code cast through 'as never as' to call it; the surrounding
try/catch swallowed the resulting TypeError so the "fog" effect has
never run. The actual fog-related properties are passed to setSky,
which is the correct MapLibre API.

setSky IS already typed in MapLibre 5.23 — drop the unnecessary cast
and call it directly.

Catch comment narrowed to describe what setSky / setPaintProperty
actually throw on (style not yet committed during fast theme toggle).

No visible behavior change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 3 — Stale `loaded` Closure → `loadedRef`

Intent: fix the bug where `useMapInstance.ts`'s `map.on('error', ...)` handler reads a stale `loaded === false` because the init effect's deps don't include `loaded`. Use a ref so the handler always reads current state.

### Task 3.1: Add `loadedRef` and update writers/readers

**Files:**
- Modify: `src/hooks/useMapInstance.ts`

- [ ] **Step 3.1.1: Add the ref alongside the loaded state**

In `src/hooks/useMapInstance.ts`, add `useRef` to the existing import on line 1:
```typescript
import { useEffect, useRef, useState, type RefObject } from 'react'
```

Then change the state declaration block:
```typescript
  const { mapRef, tooltipRef } = useMap()
  const [supported, setSupported] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [mapError, setMapErrorState] = useState<MapErrorReason | null>(null)
  const [basemapDegraded, setBasemapDegraded] = useState(false)
```
to:
```typescript
  const { mapRef, tooltipRef } = useMap()
  const [supported, setSupported] = useState(true)
  const [loaded, setLoaded] = useState(false)
  // INVARIANT: loadedRef and the `loaded` state must be set together.
  // Closures captured inside the init effect (e.g. the 'error' handler)
  // read loadedRef; React rendering reads the state.
  const loadedRef = useRef(false)
  const [mapError, setMapErrorState] = useState<MapErrorReason | null>(null)
  const [basemapDegraded, setBasemapDegraded] = useState(false)
```

- [ ] **Step 3.1.2: Set both together in the load handler**

Change the load handler:
```typescript
    map.on('load', () => {
      window.clearTimeout(watchdog)
      map.setProjection({ type: 'globe' })
      map.scrollZoom.setZoomRate(1 / 150)
      Promise.resolve(onLoad(map))
        .then(() => setLoaded(true))
        .catch((err: unknown) => {
          console.error(err)
          setMapErrorState((prev) => prev ?? 'country-data')
        })
    })
```
to:
```typescript
    map.on('load', () => {
      window.clearTimeout(watchdog)
      map.setProjection({ type: 'globe' })
      map.scrollZoom.setZoomRate(1 / 150)
      Promise.resolve(onLoad(map))
        .then(() => {
          // Invariant: keep loadedRef and `loaded` state in sync (see useRef).
          loadedRef.current = true
          setLoaded(true)
        })
        .catch((err: unknown) => {
          console.error(err)
          setMapErrorState((prev) => prev ?? 'country-data')
        })
    })
```

- [ ] **Step 3.1.3: Read `loadedRef` in the error handler**

Change:
```typescript
    map.on('error', (e) => {
      console.warn('Map error:', e.error?.message || e)
      setMapErrorState((prev) => {
        // Don't overwrite a real failure with a transient post-load tile issue.
        if (prev !== null) return prev
        return loaded ? prev : 'style'
      })
    })
```
to:
```typescript
    map.on('error', (e) => {
      console.warn('Map error:', e.error?.message || e)
      setMapErrorState((prev) => {
        // Don't overwrite a real failure with a transient post-load tile issue.
        if (prev !== null) return prev
        return loadedRef.current ? prev : 'style'
      })
    })
```

- [ ] **Step 3.1.4: Reset the ref in cleanup**

Change the cleanup block (currently lines 128-137):
```typescript
    return () => {
      cancelled = true
      window.clearTimeout(watchdog)
      window.removeEventListener('keydown', homeHandler)
      tooltipRef.current?.remove()
      tooltipRef.current = null
      map.remove()
      mapRef.current = null
      delete (window as unknown as Record<string, unknown>).__funworldmap_map
    }
```
to:
```typescript
    return () => {
      cancelled = true
      window.clearTimeout(watchdog)
      window.removeEventListener('keydown', homeHandler)
      tooltipRef.current?.remove()
      tooltipRef.current = null
      loadedRef.current = false
      map.remove()
      mapRef.current = null
      delete (window as unknown as Record<string, unknown>).__funworldmap_map
    }
```

### Task 3.2: Verify and commit Phase 3

- [ ] **Step 3.2.1: Run full verification**

Run:
```bash
cd E:/polworldmap
npm run lint
npx tsc -b
npm run test:unit
npm run build
npm run test:e2e
```
Expected: all green. The existing `useMapInstance.test.tsx` tests don't exercise post-load error events; no new test added because reproducing the prior stale-closure behavior in jsdom (without a real MapLibre tile-load failure) is brittle and out of scope.

- [ ] **Step 3.2.2: Commit Phase 3**

Run:
```bash
git -C E:/polworldmap add src/hooks/useMapInstance.ts
git -C E:/polworldmap commit -m "$(cat <<'EOF'
fix(map): close stale loaded closure in useMapInstance error handler

The map.on('error', ...) handler is registered inside an init effect
whose deps are [containerRef]. The handler closed over `loaded` from
first render, where it was always false — so the 'don't show style
errors after load' branch was permanently dead.

Add loadedRef as the source of truth for closures inside the init
effect. The state still drives React rendering; the ref is read by
the captured handler. An invariant comment near both the declaration
and the load-time write makes the pair-write requirement explicit.

Reset loadedRef in cleanup so a remount starts cleanly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 4 — Cursor Consolidation

Intent: move the `comparePickingMode` cursor effect out of `useSatelliteMode.ts` (where it's misplaced) and into `useMapInteractions.ts` (where the rest of the cursor logic lives). `useSatelliteMode` keeps only satellite/terrain/border-tint concerns.

### Task 4.1: Add the cursor-on-picking effect to `useMapInteractions.ts`

**Files:**
- Modify: `src/hooks/useMapInteractions.ts`

- [ ] **Step 4.1.1: Add `comparePickingMode` to the Options interface**

Change:
```typescript
interface Options {
  loaded: boolean
  byNumeric: Map<string, CountryData>
  onSelect: (cca3: string) => void
  onDeselect: () => void
}
```
to:
```typescript
interface Options {
  loaded: boolean
  byNumeric: Map<string, CountryData>
  onSelect: (cca3: string) => void
  onDeselect: () => void
  comparePickingMode: boolean
}
```

- [ ] **Step 4.1.2: Destructure the new prop**

Change the function signature:
```typescript
export function useMapInteractions({ loaded, byNumeric, onSelect, onDeselect }: Options): void {
```
to:
```typescript
export function useMapInteractions({
  loaded,
  byNumeric,
  onSelect,
  onDeselect,
  comparePickingMode,
}: Options): void {
```

- [ ] **Step 4.1.3: Add the cursor effect alongside the handler-attachment effect**

After the existing handler-attachment `useEffect` block (the one ending at line 141 with `}, [loaded, mapRef, hoveredRef, tooltipRef])`), add a new effect:

```typescript
  // Crosshair cursor while picking a compare target. When picking ends, restore
  // either pointer (if hovering a country) or grab (if not).
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

### Task 4.2: Remove the effect from `useSatelliteMode.ts`

**Files:**
- Modify: `src/hooks/useSatelliteMode.ts`

- [ ] **Step 4.2.1: Remove `comparePickingMode` from Options**

Change:
```typescript
interface Options {
  loaded: boolean
  satellite: boolean
  resolvedTheme: 'light' | 'dark'
  comparePickingMode: boolean
}
```
to:
```typescript
interface Options {
  loaded: boolean
  satellite: boolean
  resolvedTheme: 'light' | 'dark'
}
```

- [ ] **Step 4.2.2: Remove `comparePickingMode` from the function signature**

Change:
```typescript
export function useSatelliteMode({
  loaded,
  satellite,
  resolvedTheme,
  comparePickingMode,
}: Options): void {
  const { mapRef, hoveredRef } = useMap()

  // Crosshair cursor during compare-picking.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    if (comparePickingMode) {
      map.getCanvas().style.cursor = 'crosshair'
    } else {
      map.getCanvas().style.cursor = hoveredRef.current ? 'pointer' : 'grab'
    }
  }, [comparePickingMode, loaded, mapRef, hoveredRef])

  // Satellite layer + terrain + base-layer hide/show + border tint.
  useEffect(() => {
```
to:
```typescript
export function useSatelliteMode({
  loaded,
  satellite,
  resolvedTheme,
}: Options): void {
  const { mapRef } = useMap()

  // Satellite layer + terrain + base-layer hide/show + border tint.
  useEffect(() => {
```

This removes the cursor effect entirely AND drops `hoveredRef` from the `useMap()` destructuring (it's now unused in this hook).

### Task 4.3: Update the WorldMap call sites

**Files:**
- Modify: `src/components/WorldMap.tsx:62-65`

- [ ] **Step 4.3.1: Move `comparePickingMode` from `useSatelliteMode` to `useMapInteractions`**

Change:
```typescript
  useMapInteractions({ loaded, byNumeric, onSelect, onDeselect })
  useSelectionHighlight({ loaded, selected, compareWith, satellite, resolvedTheme })
  useMapTheme({ loaded, resolvedTheme })
  useSatelliteMode({ loaded, satellite, resolvedTheme, comparePickingMode })
```
to:
```typescript
  useMapInteractions({ loaded, byNumeric, onSelect, onDeselect, comparePickingMode })
  useSelectionHighlight({ loaded, selected, compareWith, satellite, resolvedTheme })
  useMapTheme({ loaded, resolvedTheme })
  useSatelliteMode({ loaded, satellite, resolvedTheme })
```

### Task 4.4: Verify and commit Phase 4

- [ ] **Step 4.4.1: Full verification**

Run:
```bash
cd E:/polworldmap
npm run lint
npx tsc -b
npm run test:unit
npm run build
npm run test:e2e
```
Expected: all green. The existing `chromium-gpu` `map-and-countries.spec.ts` covers the compare-picking flow indirectly; if it now fails, diff the cursor-effect timing — the React effect order may differ from the prior placement.

- [ ] **Step 4.4.2: Commit Phase 4**

Run:
```bash
git -C E:/polworldmap add src/hooks/useMapInteractions.ts src/hooks/useSatelliteMode.ts src/components/WorldMap.tsx
git -C E:/polworldmap commit -m "$(cat <<'EOF'
refactor(map): consolidate cursor logic into useMapInteractions

The crosshair-on-picking effect lived in useSatelliteMode for
historical reasons (it was tucked in next to the satellite-mode
effect). It has nothing to do with satellite — it's part of the
cursor state machine. Moving it into useMapInteractions next to
the rest of the cursor writes (hover / drag / leave) makes the
ownership clear and lets useSatelliteMode drop hoveredRef from its
context destructuring.

WorldMap call site adjusted accordingly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 5 — `useSelectionHighlight` Split

Intent: extract the third effect (compare-view dimming) into a dedicated `useCompareViewDimming` hook. Add an e2e guard for the call-order coupling between this hook and `useMapTheme` (both write `country-borders` `line-opacity` on theme change).

### Task 5.1: Create `useCompareViewDimming.ts`

**Files:**
- Create: `src/hooks/useCompareViewDimming.ts`

- [ ] **Step 5.1.1: Write the new hook file**

Create `src/hooks/useCompareViewDimming.ts` with:

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

/** Dim the base fill + borders and clear hover layers when the user is in
 *  compare view. When compare ends (and not in satellite mode), restore the
 *  theme-default fill opacity and border paint.
 *
 *  CALL ORDER: must run AFTER useMapTheme. Both hooks write
 *  country-borders line-opacity on resolvedTheme change; this hook needs
 *  to win when compareWith !== null. */
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

### Task 5.2: Trim `useSelectionHighlight.ts`

**Files:**
- Modify: `src/hooks/useSelectionHighlight.ts`

- [ ] **Step 5.2.1: Slim the imports**

Change:
```typescript
import {
  EMPTY_FILTER as EMPTY,
  DEFAULT_FILL_OPACITY,
  applyDefaultBorderPaint,
  LAYER,
} from '../lib/mapLayers'
```
to:
```typescript
import { EMPTY_FILTER as EMPTY, LAYER } from '../lib/mapLayers'
```

- [ ] **Step 5.2.2: Trim the Options interface and signature**

Change:
```typescript
interface Options {
  loaded: boolean
  selected: CountryData | null
  compareWith: CountryData | null
  satellite: boolean
  resolvedTheme: 'light' | 'dark'
}

/** Apply selection + compare filters and adjust base-layer dimming when in
 *  compare view. Flies camera to the selected country. */
export function useSelectionHighlight({
  loaded,
  selected,
  compareWith,
  satellite,
  resolvedTheme,
}: Options): void {
  const { mapRef } = useMap()
```
to:
```typescript
interface Options {
  loaded: boolean
  selected: CountryData | null
  compareWith: CountryData | null
}

/** Apply selection + compare filters. Flies camera to the selected country.
 *  Compare-view dimming lives in useCompareViewDimming (separate hook
 *  because it has different deps and must run after useMapTheme). */
export function useSelectionHighlight({
  loaded,
  selected,
  compareWith,
}: Options): void {
  const { mapRef } = useMap()
```

- [ ] **Step 5.2.3: Delete the third (compare-view dimming) effect**

Remove the entire third `useEffect` (currently the block starting at line 68 with `useEffect(() => { ... }, [compareWith, loaded, satellite, resolvedTheme, mapRef])`). The file now ends after the second effect's closing brace.

### Task 5.3: Update `useSelectionHighlight.test.tsx`

**Files:**
- Modify: `src/hooks/__tests__/useSelectionHighlight.test.tsx`

- [ ] **Step 5.3.1: Remove the dimming test and trim hook calls**

Open `src/hooks/__tests__/useSelectionHighlight.test.tsx`. Remove the entire `it('dims base fill when compareWith is present', ...)` test block.

For each remaining `useSelectionHighlight({...})` call, drop `satellite` and `resolvedTheme`. So:
```typescript
        useSelectionHighlight({
          loaded: true,
          selected: makeCountry('250'),
          compareWith: null,
          satellite: false,
          resolvedTheme: 'light',
        }),
```
becomes:
```typescript
        useSelectionHighlight({
          loaded: true,
          selected: makeCountry('250'),
          compareWith: null,
        }),
```

Apply this trim to all three remaining tests (`'sets selection filter with ccn3 when a country is selected'`, `'sets empty selection filters when nothing is selected'`, `'does nothing when loaded is false'`).

- [ ] **Step 5.3.2: Run the trimmed test**

Run:
```bash
cd E:/polworldmap
npm run test:unit -- src/hooks/__tests__/useSelectionHighlight.test.tsx
```
Expected: 3 passing tests (was 4; the dimming test moved out of scope).

### Task 5.4: Wire the new hook into WorldMap

**Files:**
- Modify: `src/components/WorldMap.tsx`

- [ ] **Step 5.4.1: Import the new hook**

Add an import alongside the other hook imports:
```typescript
import { useCompareViewDimming } from '../hooks/useCompareViewDimming'
```

- [ ] **Step 5.4.2: Adjust the `useSelectionHighlight` call and append `useCompareViewDimming`**

Change:
```typescript
  useMapInteractions({ loaded, byNumeric, onSelect, onDeselect, comparePickingMode })
  useSelectionHighlight({ loaded, selected, compareWith, satellite, resolvedTheme })
  useMapTheme({ loaded, resolvedTheme })
  useSatelliteMode({ loaded, satellite, resolvedTheme })
```
to:
```typescript
  useMapInteractions({ loaded, byNumeric, onSelect, onDeselect, comparePickingMode })
  useSelectionHighlight({ loaded, selected, compareWith })
  useMapTheme({ loaded, resolvedTheme })
  useSatelliteMode({ loaded, satellite, resolvedTheme })
  // Must be after useMapTheme: both write country-borders line-opacity on
  // resolvedTheme change; this hook wins when compareWith !== null.
  useCompareViewDimming({ loaded, compareWith, satellite, resolvedTheme })
```

### Task 5.5: Add the call-order e2e guard

**Files:**
- Create: `e2e/compare-view-dimming.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 5.5.1: Write the spec**

Create `e2e/compare-view-dimming.spec.ts` with:

```typescript
import { test, expect } from '@playwright/test'

/** Guard for Phase 5 call-order coupling: useCompareViewDimming must run
 *  after useMapTheme so the dimming wins on theme change while in compare. */
test.describe('compare-view dimming survives theme toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]')
  })

  test('country-borders stays dimmed in compare view after toggling dark mode', async ({ page }) => {
    // Open compare view via URL hash to skip the picking flow.
    await page.evaluate(() => {
      window.location.hash = 'FRA,DEU'
    })
    await page.waitForFunction(
      () => document.querySelector('[data-testid="country-panel"]') !== null,
    )
    // Wait for the dimming effect to settle (effects run sync after mount,
    // but the camera flyTo and paint commits are async).
    await page.waitForTimeout(500)

    const dimmedOpacity = await page.evaluate(() => {
      const map = (
        window as unknown as {
          __funworldmap_map?: { getPaintProperty: (id: string, prop: string) => unknown }
        }
      ).__funworldmap_map
      return map?.getPaintProperty('country-borders', 'line-opacity') ?? null
    })
    expect(dimmedOpacity).toBe(0.15)

    // Toggle theme — this re-runs useMapTheme (writes 0.5/0.35) and then
    // useCompareViewDimming (writes 0.15). Last writer wins; assert 0.15.
    await page.locator('[aria-label*="Switch to"]').first().click()
    await page.waitForTimeout(500)

    const opacityAfterToggle = await page.evaluate(() => {
      const map = (
        window as unknown as {
          __funworldmap_map?: { getPaintProperty: (id: string, prop: string) => unknown }
        }
      ).__funworldmap_map
      return map?.getPaintProperty('country-borders', 'line-opacity') ?? null
    })
    expect(opacityAfterToggle).toBe(0.15)
  })
})
```

- [ ] **Step 5.5.2: Add the spec to the GPU project**

Open `playwright.config.ts`. Find the `chromium-gpu` project's `testMatch` array and add `'compare-view-dimming.spec.ts'`. The result should look like:
```typescript
      testMatch: ['map-and-countries.spec.ts', 'map-reliability.spec.ts', 'keyboard-map-nav.spec.ts', 'compare-view-dimming.spec.ts'],
```

- [ ] **Step 5.5.3: Run the new spec**

Run:
```bash
cd E:/polworldmap
npx playwright test compare-view-dimming.spec.ts --project=chromium-gpu 2>&1 | tail -10
```
Expected: 1 passing test.

If the test fails because `[aria-label*="Switch to"]` doesn't match the theme toggle button, run this from a browser console while the dev server is up to discover the right selector:
```javascript
document.querySelectorAll('button').forEach(b => console.log(b.getAttribute('aria-label')))
```
Then update the locator to match.

### Task 5.6: Verify and commit Phase 5

- [ ] **Step 5.6.1: Full verification**

Run:
```bash
cd E:/polworldmap
npm run lint
npx tsc -b
npm run test:unit
npm run build
npm run test:e2e
```
Expected: all green. 69 unit tests (was 70 — the dimming test moved out of the suite without a replacement, since the new hook is covered by the e2e spec, not a unit test). 57 e2e tests now (was 56).

- [ ] **Step 5.6.2: Commit Phase 5**

Run:
```bash
git -C E:/polworldmap add src/hooks/useCompareViewDimming.ts src/hooks/useSelectionHighlight.ts src/hooks/__tests__/useSelectionHighlight.test.tsx src/components/WorldMap.tsx e2e/compare-view-dimming.spec.ts playwright.config.ts
git -C E:/polworldmap commit -m "$(cat <<'EOF'
refactor(map): split compare-view dimming out of useSelectionHighlight

useSelectionHighlight was doing two jobs: applying selection / compare
filters (symmetric, share inputs), and the asymmetric "dim the base
map when compareWith is present" effect that needed satellite +
resolvedTheme. The latter moves into a dedicated useCompareViewDimming
hook.

Call order matters: useMapTheme and useCompareViewDimming both write
country-borders line-opacity on resolvedTheme change. The dimming hook
must run after the theme hook to win when compareWith !== null. New
e2e spec compare-view-dimming.spec.ts guards this by toggling dark
mode while in compare view and asserting the borders stay dimmed
(0.15, not the theme-default 0.5/0.35).

useSelectionHighlight tests trimmed: the dimming test moved to the
new hook's domain, and remaining tests drop the now-unused satellite
and resolvedTheme props.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 6 — `useMap` Context Partial Collapse

Intent: move `hoveredRef` (single reader after Phase 4) into `useMapInteractions.ts` as a local `useRef`. Keep `mapRef` and `tooltipRef` in context.

### Task 6.1: Drop `hoveredRef` from the context

**Files:**
- Modify: `src/hooks/useMap.tsx`

- [ ] **Step 6.1.1: Remove `hoveredRef` from the interface and provider**

Change `src/hooks/useMap.tsx` to:

```typescript
import { createContext, useContext, useRef, type ReactNode, type MutableRefObject } from 'react'
import type maplibregl from 'maplibre-gl'

interface MapRefs {
  mapRef: MutableRefObject<maplibregl.Map | null>
  tooltipRef: MutableRefObject<HTMLDivElement | null>
}

const MapContext = createContext<MapRefs | null>(null)

export function MapProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  return (
    <MapContext.Provider value={{ mapRef, tooltipRef }}>
      {children}
    </MapContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMap(): MapRefs {
  const ctx = useContext(MapContext)
  if (!ctx) throw new Error('useMap must be used inside <MapProvider>')
  return ctx
}
```

### Task 6.2: Move `hoveredRef` into `useMapInteractions.ts`

**Files:**
- Modify: `src/hooks/useMapInteractions.ts`

- [ ] **Step 6.2.1: Drop the destructured `hoveredRef` and add a local `useRef`**

Change:
```typescript
export function useMapInteractions({
  loaded,
  byNumeric,
  onSelect,
  onDeselect,
  comparePickingMode,
}: Options): void {
  const { mapRef, hoveredRef, tooltipRef } = useMap()
```
to:
```typescript
export function useMapInteractions({
  loaded,
  byNumeric,
  onSelect,
  onDeselect,
  comparePickingMode,
}: Options): void {
  const { mapRef, tooltipRef } = useMap()
  const hoveredRef = useRef<string | null>(null)
```

- [ ] **Step 6.2.2: Update the effect dep list**

The first effect's deps array (currently `[loaded, mapRef, hoveredRef, tooltipRef]`) — `hoveredRef` is now a local ref but the dep stays the same (refs are stable, but inclusion is a lint convention). Leave it as-is.

The crosshair effect added in Phase 4 already lists `[comparePickingMode, loaded, mapRef, hoveredRef]`; leave it as-is.

### Task 6.3: Update tests that mocked `hoveredRef` via the context

**Files:**
- Inspect: `src/hooks/__tests__/useMapInstance.test.tsx`, `src/hooks/__tests__/useSelectionHighlight.test.tsx`

- [ ] **Step 6.3.1: Confirm no tests reference `hoveredRef` from `useMap`**

Run:
```bash
cd E:/polworldmap
grep -rn "hoveredRef" src/hooks/__tests__/
```
Expected: zero hits. (The existing `useMapInstance.test.tsx` and `useSelectionHighlight.test.tsx` don't touch `hoveredRef` — they only use `mapRef` from the context.)

If any hits appear, update those tests to construct a local ref instead. None are expected.

### Task 6.4: Verify and commit Phase 6

- [ ] **Step 6.4.1: Full verification**

Run:
```bash
cd E:/polworldmap
npm run lint
npx tsc -b
npm run test:unit
npm run build
npm run test:e2e
```
Expected: all green.

- [ ] **Step 6.4.2: Commit Phase 6**

Run:
```bash
git -C E:/polworldmap add src/hooks/useMap.tsx src/hooks/useMapInteractions.ts
git -C E:/polworldmap commit -m "$(cat <<'EOF'
refactor(map): move hoveredRef into useMapInteractions

After Phase 4 consolidated cursor logic into useMapInteractions,
hoveredRef has exactly one reader. There's no reason to expose it via
context — moving it to a local useRef inside the consuming hook
shrinks the useMap surface from 3 refs to 2.

mapRef and tooltipRef stay in context: mapRef is read by all map
hooks, and tooltipRef is genuinely shared between useMapInstance
(writes) and useMapInteractions (reads).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 7 — Shared `CloseButton` and `FieldLabel`

Intent: extract the inline X-SVG button and the label-with-source-tooltip pattern into reusable components. Eliminates the close-button duplication between `SingleCountryPanel.tsx` and `CountryColumn.tsx`, and the `DataCell` / inline-Borders-label duplication within `SingleCountryPanel.tsx`.

### Task 7.1: Create `CloseButton.tsx`

**Files:**
- Create: `src/components/CloseButton.tsx`

- [ ] **Step 7.1.1: Write the component**

Create `src/components/CloseButton.tsx` with:

```typescript
interface Props {
  onClick: () => void
  ariaLabel: string
  testId?: string
  className?: string
}

const DEFAULT_CLASSNAME =
  'p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-500 dark:text-dark-100 transition-colors'

export function CloseButton({ onClick, ariaLabel, testId, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={testId}
      className={className ?? DEFAULT_CLASSNAME}
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

### Task 7.2: Create `FieldLabel.tsx`

**Files:**
- Create: `src/components/FieldLabel.tsx`

- [ ] **Step 7.2.1: Write the component**

Create `src/components/FieldLabel.tsx` with:

```typescript
import type { CountryData, CountriesFile } from '../lib/types'
import SourceTooltip from './SourceTooltip'

interface Props {
  label: string
  field: string
  country: CountryData
  sources: CountriesFile['_sources']
  className?: string
}

const DEFAULT_CLASSNAME =
  'text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light mb-0.5 flex items-center gap-1'

/** Note: `className`, when provided, fully replaces DEFAULT_CLASSNAME (no
 *  merge). Pass the full Tailwind string for the variant you want. */
export function FieldLabel({ label, field, country, sources, className }: Props) {
  return (
    <div className={className ?? DEFAULT_CLASSNAME}>
      {label}
      <SourceTooltip field={field} fieldSources={country._fieldSources} sources={sources} />
    </div>
  )
}
```

### Task 7.3: Use `CloseButton` and `FieldLabel` in `SingleCountryPanel.tsx`

**Files:**
- Modify: `src/components/SingleCountryPanel.tsx`

- [ ] **Step 7.3.1: Add imports**

Add to the existing imports at the top of `src/components/SingleCountryPanel.tsx`:

```typescript
import { CloseButton } from './CloseButton'
import { FieldLabel } from './FieldLabel'
```

- [ ] **Step 7.3.2: Replace the `DataCell` label `<div>` with `<FieldLabel>`**

Find the `DataCell` function near the top of the file. Replace its body:

```typescript
function DataCell({
  label,
  children,
  field,
  country,
  sources,
}: {
  label: string
  children: React.ReactNode
  field: string
  country: CountryData
  sources: CountriesFile['_sources']
}) {
  return (
    <div className="py-1.5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light mb-0.5 flex items-center gap-1">
        {label}
        <SourceTooltip field={field} fieldSources={country._fieldSources} sources={sources} />
      </div>
      <div className="text-[15px] text-sand-800 dark:text-dark-50">{children}</div>
    </div>
  )
}
```
with:
```typescript
function DataCell({
  label,
  children,
  field,
  country,
  sources,
}: {
  label: string
  children: React.ReactNode
  field: string
  country: CountryData
  sources: CountriesFile['_sources']
}) {
  return (
    <div className="py-1.5">
      <FieldLabel label={label} field={field} country={country} sources={sources} />
      <div className="text-[15px] text-sand-800 dark:text-dark-50">{children}</div>
    </div>
  )
}
```

- [ ] **Step 7.3.3: Replace the inline close button SVG**

Find the close-button block in the panel header (look for `aria-label="Close panel"`). Replace:

```typescript
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-500 dark:text-dark-100 transition-colors"
              aria-label="Close panel"
              data-testid="panel-close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
```
with:
```typescript
            <CloseButton onClick={onClose} ariaLabel="Close panel" testId="panel-close" />
```

- [ ] **Step 7.3.4: Replace the inline Borders label with `<FieldLabel>`**

Find the Borders section (look for the `text-[11px] ... mb-2 ...` div that wraps `Borders` and the `SourceTooltip`). Replace:

```typescript
                  <div className="text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light mb-2 flex items-center gap-1">
                    Borders
                    <SourceTooltip
                      field="borders"
                      fieldSources={country._fieldSources}
                      sources={sources}
                    />
                  </div>
```
with:
```typescript
                  <FieldLabel
                    label="Borders"
                    field="borders"
                    country={country}
                    sources={sources}
                    className="text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light mb-2 flex items-center gap-1"
                  />
```

(The `className` override differs only in `mb-2` vs the default's `mb-0.5`.)

- [ ] **Step 7.3.5: Remove the now-unused `SourceTooltip` import if it's no longer referenced**

Run:
```bash
cd E:/polworldmap
grep -n "SourceTooltip" src/components/SingleCountryPanel.tsx
```
Expected: only the `import` line if no other usages remain. If so, remove that import line:
```typescript
import SourceTooltip from './SourceTooltip'
```

If `grep` shows other usages (e.g., I missed one), keep the import.

### Task 7.4: Use `CloseButton` in `CountryColumn.tsx`

**Files:**
- Modify: `src/components/CountryColumn.tsx`

- [ ] **Step 7.4.1: Add the import**

Add to the imports:
```typescript
import { CloseButton } from './CloseButton'
```

- [ ] **Step 7.4.2: Replace the inline close button SVG**

Find the conditional close-button block (look for `aria-label="Exit compare"`). Replace:

```typescript
          {showColumnClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-500 dark:text-dark-100 transition-colors"
              aria-label="Exit compare"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
```
with:
```typescript
          {showColumnClose && <CloseButton onClick={onClose} ariaLabel="Exit compare" />}
```

### Task 7.5: Verify and commit Phase 7

- [ ] **Step 7.5.1: Full verification**

Run:
```bash
cd E:/polworldmap
npm run lint
npx tsc -b
npm run test:unit
npm run build
npm run test:e2e
```
Expected: all green. The `data-testid="panel-close"` is preserved by the new `<CloseButton testId="panel-close" />`, so the `panel-focus.spec.ts` and any other selectors keep working.

- [ ] **Step 7.5.2: Commit Phase 7**

Run:
```bash
git -C E:/polworldmap add src/components/CloseButton.tsx src/components/FieldLabel.tsx src/components/SingleCountryPanel.tsx src/components/CountryColumn.tsx
git -C E:/polworldmap commit -m "$(cat <<'EOF'
refactor(panel): extract shared CloseButton and FieldLabel components

CloseButton replaces the inline X-SVG button used in three places:
SingleCountryPanel header (Close panel) and CountryColumn header
(Exit compare). The data-testid="panel-close" is preserved via the
testId prop so e2e selectors keep working.

FieldLabel replaces the "uppercase teal label + SourceTooltip"
pattern used by SingleCountryPanel's DataCell helper and again inline
in the Borders section. The className prop accepts a full Tailwind
string override (no merge) so the Borders use site can swap mb-0.5
for mb-2.

No visible behavior change. SourceTooltip import dropped from
SingleCountryPanel since FieldLabel now wraps it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Final Gate

- [ ] **Step F.1: Branch summary**

Run:
```bash
git -C E:/polworldmap log --oneline 92fdefb..HEAD
```
Expected: 7 commits (one per phase), each focused.

- [ ] **Step F.2: Final full verification**

Run:
```bash
cd E:/polworldmap
npm run lint
npx tsc -b
npm run test:unit
npm run build
npm run test:e2e
```
Expected: all green. 69 unit tests (one moved out in Phase 5), 57 e2e tests (one new spec from Phase 5).

- [ ] **Step F.3: Total branch state**

Run:
```bash
git -C E:/polworldmap log --oneline main..HEAD | wc -l
```
Expected: 32 commits (the 25 from before this plan, plus 7 from this plan). The branch is now ready for the same merge / PR flow as the original plan.
