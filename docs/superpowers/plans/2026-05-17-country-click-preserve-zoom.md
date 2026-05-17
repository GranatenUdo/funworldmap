# Preserve user zoom on country selection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the camera from receding to ~world zoom when selecting a country from a closer view. Re-center on the country, but never decrease the user's current zoom level.

**Architecture:** One-expression change in `src/lib/flyToCountry.ts` — clamp the target zoom against `map.getZoom()` via `Math.max`. New unit-test file covers four cases (small country, large country with current > computed, large country with current < computed, reduced-motion compose).

**Tech Stack:** TypeScript, React, MapLibre-GL, Vitest (unit tests), Playwright (e2e regression check).

Spec: `docs/superpowers/specs/2026-05-17-country-click-preserve-zoom-design.md`.

---

## File Structure

- **Modify:** `src/lib/flyToCountry.ts` (one expression — change the `zoom` value passed to `map.flyTo`).
- **Create:** `src/lib/__tests__/flyToCountry.test.ts` (new file; placement matches existing `src/lib/__tests__/` convention).

No other files change. The fix is contained to one module.

---

## Task 1: Add zoom clamp under TDD

**Files:**

- Create: `src/lib/__tests__/flyToCountry.test.ts`
- Modify: `src/lib/flyToCountry.ts:12-24`
- Reference (no change): `src/lib/types.ts` (`CountryData`), `src/lib/motion.ts` (`prefersReducedMotion`)

- [ ] **Step 1: Create the failing test file**

Create `src/lib/__tests__/flyToCountry.test.ts` with the following content:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type maplibregl from 'maplibre-gl'
import type { CountryData } from '../types'
import { flyToCountry } from '../flyToCountry'
import { prefersReducedMotion } from '../motion'

vi.mock('../motion', () => ({
  prefersReducedMotion: vi.fn(() => false),
}))

function makeCountry(opts: { area: number; latlng?: [number, number] }): CountryData {
  return {
    cca3: 'XYZ',
    ccn3: '999',
    name: { common: 'X', official: 'X' },
    capital: [],
    region: '',
    subregion: '',
    languages: {},
    currencies: {},
    timezones: [],
    borders: [],
    flag: '',
    flagAlt: '',
    population: 0,
    area: opts.area,
    latlng: opts.latlng ?? [0, 0],
    unMember: true,
    independent: true,
    governmentType: '',
    _fieldSources: {},
  } as unknown as CountryData
}

function makeMap(currentZoom: number): {
  map: maplibregl.Map
  flyTo: ReturnType<typeof vi.fn>
} {
  const flyTo = vi.fn()
  const map = {
    getZoom: vi.fn(() => currentZoom),
    flyTo,
  } as unknown as maplibregl.Map
  return { map, flyTo }
}

beforeEach(() => {
  vi.mocked(prefersReducedMotion).mockReturnValue(false)
})

describe('flyToCountry', () => {
  it('zooms in to the computed level for a tiny country when current zoom is lower', () => {
    const { map, flyTo } = makeMap(1.8)
    const vatican = makeCountry({ area: 0.49, latlng: [41.9, 12.45] })
    flyToCountry(map, vatican)
    expect(flyTo).toHaveBeenCalledTimes(1)
    const arg = flyTo.mock.calls[0][0] as { zoom: number; center: [number, number] }
    expect(arg.zoom).toBeGreaterThan(10)
    expect(arg.center).toEqual([12.45, 41.9])
  })

  it('preserves the user-current zoom when it exceeds the area-derived zoom', () => {
    const { map, flyTo } = makeMap(4)
    const russia = makeCountry({ area: 17_098_242, latlng: [60, 100] })
    flyToCountry(map, russia)
    const arg = flyTo.mock.calls[0][0] as { zoom: number }
    expect(arg.zoom).toBe(4)
  })

  it('flies to the area-derived clamp when current zoom is below it', () => {
    const { map, flyTo } = makeMap(1.5)
    const russia = makeCountry({ area: 17_098_242, latlng: [60, 100] })
    flyToCountry(map, russia)
    const arg = flyTo.mock.calls[0][0] as { zoom: number }
    expect(arg.zoom).toBe(2)
  })

  it('composes the clamp with reduced-motion duration: 0', () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true)
    const { map, flyTo } = makeMap(4)
    const france = makeCountry({ area: 643_801, latlng: [46, 2] })
    flyToCountry(map, france)
    const arg = flyTo.mock.calls[0][0] as { zoom: number; duration: number }
    expect(arg.zoom).toBe(4)
    expect(arg.duration).toBe(0)
  })
})
```

- [ ] **Step 2: Run the new tests and confirm 2 of 4 fail (the new-behavior tests)**

Run: `npx vitest run src/lib/__tests__/flyToCountry.test.ts --reporter=verbose`

Expected:

- ✓ `zooms in to the computed level for a tiny country when current zoom is lower` — PASS (today's behavior already satisfies this; regression guard).
- ✗ `preserves the user-current zoom when it exceeds the area-derived zoom` — FAIL with `expected 4, received 2`.
- ✓ `flies to the area-derived clamp when current zoom is below it` — PASS (today's behavior at default view; regression guard).
- ✗ `composes the clamp with reduced-motion duration: 0` — FAIL with `expected 4, received 2`.

If a different test fails or all pass, stop — something has drifted from the spec; re-read `src/lib/flyToCountry.ts` and reconcile before proceeding.

- [ ] **Step 3: Apply the `Math.max` clamp to `flyToCountry`**

Open `src/lib/flyToCountry.ts` and replace the body of `flyToCountry` (lines 12-24) with:

```ts
export function flyToCountry(map: maplibregl.Map, country: CountryData): void {
  const [lat, lng] = country.latlng
  const computed = zoomFromArea(country.area)
  const zoom = Math.max(map.getZoom(), computed)
  const reducedMotion = prefersReducedMotion()

  map.flyTo({
    center: [lng, lat],
    zoom,
    pitch: reducedMotion ? 0 : DEFAULT_PITCH,
    duration: reducedMotion ? 0 : 1400,
    curve: 1.5,
  })
}
```

The only difference vs. today: introduce the `computed` local and the `zoom = Math.max(map.getZoom(), computed)` line. Everything else (center, pitch, duration, curve) is byte-identical.

- [ ] **Step 4: Re-run the unit tests, confirm all 4 pass**

Run: `npx vitest run src/lib/__tests__/flyToCountry.test.ts --reporter=verbose`

Expected: 4 passed, 0 failed.

- [ ] **Step 5: Run the full unit suite to confirm no collateral damage**

Run: `npx vitest run --reporter=dot`

Expected: all tests pass (the existing count was 457; this task adds 4 → expect 461 passed). `useSelectionHighlight` tests mock `flyToCountry`, so they remain insulated.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`

Expected: no errors.

- [ ] **Step 7: Lint the touched files**

Run: `npx eslint src/lib/flyToCountry.ts src/lib/__tests__/flyToCountry.test.ts`

Expected: no errors.

- [ ] **Step 8: Run the targeted e2e regression specs**

Run: `npx playwright test e2e/map-and-countries.spec.ts e2e/game-country-pinning.spec.ts e2e/satellite-default.spec.ts --project=chromium --reporter=list`

Expected: all specs pass (combined ~16-25 tests). The relevant coverage is:

- `e2e/map-and-countries.spec.ts:85` — clicking a country sets URL hash and opens panel (exercises the click → flyToCountry path).
- `e2e/map-and-countries.spec.ts:204` — `#FRA` deep link selects France with highlight (exercises the hash → flyToCountry path).
- `e2e/map-and-countries.spec.ts:132` — clicking ocean deselects and closes panel (selection-clear path, no flyTo).
- `e2e/game-country-pinning.spec.ts` — full game flow, including the round-end target-country panel (uses a separate camera trajectory via `useRevealMapEffects`, not `flyToCountry`).

If any of these fail, do not commit. Re-read the failing spec, compare expected vs. actual zoom/center assertions, and reconcile. None of these tests assert specific zoom values, so failure here would be unexpected and worth investigating.

- [ ] **Step 9: Browser smoke check (per CLAUDE.md "test UI changes in a browser")**

If a dev server is not already running on `http://localhost:5173`, start one: `npm run dev`.

Open the page in a browser (Chrome / Edge) and verify:

1. **Re-center without zoom-out (the user's reported case).** From the default world view, manually zoom in to Europe (mouse-wheel up a few times until you can see country shapes — ~zoom 4). Click France. Expected: camera re-centers on France smoothly; the **zoom level is preserved** (you remain at ~zoom 4, not zoomed out to world). The country panel opens.
2. **Tiny-country auto-zoom-in still works.** Press `/` to focus the search bar, type "Vatican", select the result. Expected: camera flies in to high zoom (the small-country auto-fit behavior is preserved).
3. **Default-view selection still auto-fits.** Press `Home` to reset the view. Click any large country (Russia, USA, Brazil). Expected: minimal zoom change — the area-derived clamp is `2`, which is just above the default `1.8`.
4. **Back/forward navigation works.** With a country panel open, hit browser-back. Panel closes, view stays put. Browser-forward returns to the country selection.

If any of these don't match expectation, do not commit. Diagnose (likely re-read the change to `flyToCountry.ts`) and fix.

- [ ] **Step 10: Commit**

Run:

```bash
git add src/lib/flyToCountry.ts src/lib/__tests__/flyToCountry.test.ts
git commit -m "$(cat <<'EOF'
fix(map): never zoom out on country selection

flyToCountry unconditionally flew to zoomFromArea(area), which for any
country >= ~100,000 km² clamps to zoom 2 — just above DEFAULT_ZOOM=1.8.
Selecting a large country from a closer view (e.g. zoomed in to Europe
at zoom 4 and clicking France) caused the camera to recede to ~world
view.

Clamp the target zoom against map.getZoom() so the fly is monotonic:
small countries still zoom in to their computed level, large/medium
ones just re-center without backing the camera out. Rule applies to
every hash-mediated selection (click, search, deep-link) — see spec
for the search-while-zoomed-in tradeoff decision and migration path.

Spec: docs/superpowers/specs/2026-05-17-country-click-preserve-zoom-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: pre-commit hook (lint-staged + prettier + eslint) runs clean; commit lands on `feat/ux-phase2-pr1a`.

---

## Self-review (run after writing, before handing off)

- **Spec coverage:** Every spec requirement maps to a step above.
  - Spec "Item 1 — clamp target zoom against current zoom" → Step 3.
  - Spec "Testing → Four cases" → Step 1 (all four written) and Step 2 (failure verification matches the spec's case breakdown).
  - Spec "Existing tests stay green" → Step 5 (full suite) and Step 8 (e2e regression specs).
  - Spec "No e2e changes required" → Step 8 confirms by running existing specs unchanged.
  - Spec "Branch & PR → single commit `fix(map): never zoom out on country selection`" → Step 10.
- **Tradeoff section:** No new code or tests needed; the decision is documented in the spec. Confirmed.
- **Open questions (pitch):** Out of scope by spec; not addressed here. Confirmed.
- **Placeholder scan:** No TBD / TODO / "similar to" / "add appropriate handling". Each code step has full source.
- **Type consistency:** `flyToCountry(map: maplibregl.Map, country: CountryData)` signature in test fixtures matches the production function; `makeMap` returns the minimal shape (`getZoom`, `flyTo`) and casts to `maplibregl.Map`, matching the pattern used in `useSelectionHighlight.test.tsx`'s `makeFakeMap`.
