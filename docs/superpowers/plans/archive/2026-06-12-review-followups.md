# Review Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement issue #111's six unconditioned findings and the unconditioned "Deferred from the 2026-06 cleanup" roadmap items: paint-ownership reconciler, style-latch fix, MODE_IDS guard, BorderChip extraction, shared test utilities, unit-test gaps, e2e helper consolidation, and eslint-plugin-playwright.

**Architecture:** Nine PR-sized phases ordered so the reconciler (Phase 2) lands before the work that depends on its surface (Phases 4, 6) and the shared test utilities (Phase 5) land before the gap tests that consume them (Phase 6). Every behavioral change is matrix-pinned by unit tests before hooks are rewired; the style-latch fix gets a suite-level TDD e2e assertion that fails pre-fix.

**Tech Stack:** React 19 + TypeScript (Vitest, Testing Library), Playwright + eslint-plugin-playwright, MapLibre GL.

**Spec:** [`docs/superpowers/specs/2026-06-12-review-followups-design.md`](../specs/2026-06-12-review-followups-design.md). **Queues being drained:** issue #111; roadmap § "Deferred from the 2026-06 cleanup".

---

## Pre-flight

- [ ] `git status` clean; on `main`, up to date.
- [ ] **Kill any background `npm run dev`** before any Playwright run (reuseExistingServer would serve a non-hooks build).
- [ ] Baseline green: `npm run check`.
- [ ] One branch + PR per phase (`followups/phase-<n>-<slug>`); commits `type(scope): subject` + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; husky lint-staged reformats are expected.

### Task 0: Commit spec + plan

- [ ] **Step 1:**

```bash
git checkout -b followups/phase-1-trivia
git add docs/superpowers/specs/2026-06-12-review-followups-design.md docs/superpowers/plans/2026-06-12-review-followups.md
git commit -m "docs(superpowers): spec + plan for the post-cleanup review follow-ups

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Phase 1 — Trivial fixes (branch `followups/phase-1-trivia`, includes Task 0)

### Task 1: Delete the phantom confirm-dialog branch (#111 item 2)

**Files:** Modify: `docs/testing/game-unhappy-paths.md` (D1 block, ~lines 215-222)

- [ ] **Step 1:** In the D1 "Escape mid-game" block, replace the three After lines

```markdown
   - After: Either an "End game?" confirm dialog opens, or `endGame` dispatches directly.
   - After: If confirmed: session → `idle`, hash returns to `#`, the user returns to the bare map (no launcher auto-open, no camera reset).
   - After: If a confirm dialog: focus moves to the dialog, second Escape dismisses (does NOT end game), Enter on the confirm button ends.
```

with:

```markdown
   - After: `endGame` dispatches directly — there is no confirm dialog (the HUD's "End game" button is the flow that routes through `finishFree` to the game-over overlay).
   - After: Session → `idle`, hash returns to `#`, the user returns to the bare map (no launcher auto-open, no camera reset).
```

(If the exact old lines differ — the 2026-06 cleanup edited the middle one — match on the "Either an 'End game?' confirm dialog opens" and "If a confirm dialog:" anchors and remove every dialog-branch mention in D1. The 2026-05-13 update note below the block stays.)

- [ ] **Step 2:** Grep the file for `confirm` → expect no remaining dialog-flow hits in D1.

### Task 2: Fix the 3-of-4 axe header (#111 item 4)

**Files:** Modify: `e2e/axe-snapshot.spec.ts` (header States list, ~lines 9-13)

- [ ] **Step 1:** After the line ` *   3. Game-over modal       — driven via the "End game" button`, add:

```ts
 *   4. In-game HUD           — free country-pinning, mid-round
```

- [ ] **Step 2: Verify + commit + PR**

Run: `npm run check`
Expected: green.

```bash
git add docs/testing/game-unhappy-paths.md e2e/axe-snapshot.spec.ts
git commit -m "docs: drop the phantom Escape confirm-dialog branch; complete the axe state inventory

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Push and open PR `docs: trivial review follow-ups (#111 items 2, 4)`.

---

## Phase 2 — Baseline-paint reconciler (branch `followups/phase-2-paint-reconciler`)

One owner for country-fill opacity + country-borders paint. End state: `useSatelliteMode` keeps satellite-layer visibility, terrain, and base-layer hide/show ONLY; the compare hook (renamed `useCompareViewHighlight`) keeps hover-suppression filters + A/B/selection colours ONLY; the new `useCountryBaselinePaint` owns the rest.

### Task 3: `applyCountryBaselinePaint` in mapLayers (TDD via the hook tests in Task 4)

**Files:** Modify: `src/lib/mapLayers.ts` (below `applyBorderPaintForMode`)

- [ ] **Step 1:** Add:

```ts
/** Single owner of the country-fill opacity + country-borders baseline paint.
 *  Called from useCountryBaselinePaint for every {satellite, compare, theme}
 *  change, so the winning value is decided by THIS logic — not by which hook's
 *  effect happened to run last (the pre-2026-06 ordering bug class). */
export function applyCountryBaselinePaint(
  map: maplibregl.Map,
  opts: { satellite: boolean; inCompareView: boolean; isDark: boolean },
): void {
  // Borders: mode colour first, then the compare dim on top.
  applyBorderPaintForMode(map, { isDark: opts.isDark, satellite: opts.satellite })
  if (opts.inCompareView) {
    map.setPaintProperty(LAYER.borders, 'line-opacity', 0.15)
    // Hover layers are suppressed in compare view (useCompareViewHighlight),
    // so a scalar dim is fine — matched to the mode's baseline (satellite base
    // is 0.03; the vector 0.05 would brighten over imagery).
    map.setPaintProperty(LAYER.fill, 'fill-opacity', opts.satellite ? 0.03 : 0.05)
  } else {
    map.setPaintProperty(LAYER.fill, 'fill-opacity', fillOpacityForMode(opts.satellite))
  }
}
```

### Task 4: `useCountryBaselinePaint` hook + matrix tests

**Files:**
- Create: `src/hooks/useCountryBaselinePaint.ts`
- Create: `src/hooks/__tests__/useCountryBaselinePaint.test.tsx`

- [ ] **Step 1: Write the failing matrix test** (the hook doesn't exist yet). Copy the fixture trio from `src/hooks/__tests__/useCompareViewDimming.test.tsx` (`makeFakeMap`, `Injector`, `makeWrapper` — Phase 5 dedupes them later; duplicating here keeps phases independent):

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { MapProvider, useMap } from '../useMap'
import { useCountryBaselinePaint } from '../useCountryBaselinePaint'

function makeFakeMap() {
  const calls: Record<string, unknown[][]> = { setFilter: [], setPaintProperty: [] }
  return {
    setFilter: vi.fn((...args: unknown[]) => calls.setFilter.push(args)),
    setPaintProperty: vi.fn((...args: unknown[]) => calls.setPaintProperty.push(args)),
    calls,
  }
}
function Injector({ children, map }: { children: ReactNode; map: unknown }) {
  const refs = useMap()
  refs.mapRef.current = map as never
  return <>{children}</>
}
function makeWrapper(map: unknown) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MapProvider>
        <Injector map={map}>{children}</Injector>
      </MapProvider>
    )
  }
}

function paintValue(fake: ReturnType<typeof makeFakeMap>, layer: string, prop: string) {
  // Last write wins — mirror MapLibre semantics.
  const calls = fake.calls.setPaintProperty.filter((c) => c[0] === layer && c[1] === prop)
  return calls.at(-1)?.[2]
}

const SAT_EXPR = ['case', ['boolean', ['feature-state', 'hover'], false], 0.32, 0.03]
const VEC_EXPR = ['case', ['boolean', ['feature-state', 'hover'], false], 0.28, 0.05]

describe('useCountryBaselinePaint', () => {
  // Full {satellite × compare} matrix — these pin today's exact visuals so the
  // hook rewiring in this phase cannot drift them.
  const cases = [
    { satellite: true, inCompareView: false, fill: SAT_EXPR, borderOpacity: 0.6, borderColor: 'rgba(255,255,255,0.35)' },
    { satellite: false, inCompareView: false, fill: VEC_EXPR, borderOpacity: 0.35, borderColor: '#94a3b8' },
    { satellite: true, inCompareView: true, fill: 0.03, borderOpacity: 0.15, borderColor: 'rgba(255,255,255,0.35)' },
    { satellite: false, inCompareView: true, fill: 0.05, borderOpacity: 0.15, borderColor: '#94a3b8' },
  ] as const

  for (const c of cases) {
    it(`satellite=${c.satellite} compare=${c.inCompareView} → fill/border baseline`, () => {
      const fake = makeFakeMap()
      renderHook(
        () =>
          useCountryBaselinePaint({
            loaded: true,
            satellite: c.satellite,
            inCompareView: c.inCompareView,
            resolvedTheme: 'light',
          }),
        { wrapper: makeWrapper(fake) },
      )
      expect(paintValue(fake, 'country-fill', 'fill-opacity')).toEqual(c.fill)
      expect(paintValue(fake, 'country-borders', 'line-opacity')).toBe(c.borderOpacity)
      expect(paintValue(fake, 'country-borders', 'line-color')).toBe(c.borderColor)
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
      { wrapper: makeWrapper(fake) },
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
      { wrapper: makeWrapper(fake) },
    )
    expect(fake.setPaintProperty).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2:** Run `npx vitest run src/hooks/__tests__/useCountryBaselinePaint.test.tsx` → FAIL (module not found).
- [ ] **Step 3: Implement** `src/hooks/useCountryBaselinePaint.ts`:

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

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    try {
      applyCountryBaselinePaint(map, { satellite, inCompareView, isDark: resolvedTheme === 'dark' })
    } catch {
      // Layers may not exist yet (e.g. fast toggle before load completes).
    }
  }, [loaded, satellite, inCompareView, resolvedTheme, mapRef])
}
```

- [ ] **Step 4:** Run the test file → PASS (7 tests).
- [ ] **Step 5: Commit** `feat(map): single-owner baseline paint for country fill + borders` (+ trailer).

### Task 5: Rewire the hooks

**Files:**
- Modify: `src/hooks/useSatelliteMode.ts` (drop lines 43-44: the `applyBorderPaintForMode` + `fillOpacityForMode` writes; drop both from the import)
- Rename: `src/hooks/useCompareViewDimming.ts` → `src/hooks/useCompareViewHighlight.ts`
- Rename: `src/hooks/__tests__/useCompareViewDimming.test.tsx` → `src/hooks/__tests__/useCompareViewHighlight.test.tsx`
- Modify: `src/components/WorldMap.tsx` (imports + hook calls)

- [ ] **Step 1:** In `useSatelliteMode.ts`, delete the two baseline-paint lines (`applyBorderPaintForMode(...)` and `map.setPaintProperty(LAYER.fill, 'fill-opacity', fillOpacityForMode(satellite))`) and trim the import to `import { LAYER } from '../lib/mapLayers'`. With the border write gone, `resolvedTheme` is unused — remove it from the `Options` interface, the destructuring, AND the effect deps (otherwise `noUnusedLocals` fails). Keep everything else (satellite layer visibility, terrain, base-layer loop). Update the hook's doc comment: it no longer owns border tint / fill opacity (point at `useCountryBaselinePaint`).
- [ ] **Step 2:** `git mv src/hooks/useCompareViewDimming.ts src/hooks/useCompareViewHighlight.ts` and rewrite it to keep ONLY the compare-specific work (rename the export to `useCompareViewHighlight`):

```ts
import { useEffect } from 'react'
import { EMPTY_FILTER as EMPTY, applySelectionColor, LAYER } from '../lib/mapLayers'
import { CORAL, CORAL_LIGHT, TEAL_DIM } from '../lib/mapPalette'
import { useMap } from './useMap'

interface Options {
  loaded: boolean
  compareWith: { ccn3: string } | null
  resolvedTheme: 'light' | 'dark'
}

/** Compare-view highlight management: suppress hover layers while picking is
 *  meaningless, and pin the A/B colours to the panel badges (A = coral,
 *  B = teal-dim). Baseline fill/border dimming lives in
 *  useCountryBaselinePaint — this hook no longer writes baseline paint, so
 *  hook call order no longer matters (#111 item 1). */
export function useCompareViewHighlight({ loaded, compareWith, resolvedTheme }: Options): void {
  const { mapRef } = useMap()

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    try {
      if (compareWith !== null) {
        map.setFilter(LAYER.hoverBorder, EMPTY)
        map.setFilter(LAYER.extrusion, EMPTY)
        // Pin A = coral badge colour, B = teal-dim badge colour, overriding
        // whatever useMapTheme set (it uses CORAL_LIGHT in dark).
        applySelectionColor(map, CORAL)
        map.setPaintProperty(LAYER.compareFill, 'fill-color', TEAL_DIM)
        map.setPaintProperty(LAYER.compareBorder, 'line-color', TEAL_DIM)
        map.setPaintProperty(LAYER.compareGlow, 'line-color', TEAL_DIM)
        map.setPaintProperty(LAYER.compareExtrusion, 'fill-extrusion-color', TEAL_DIM)
      } else {
        // Restore the selection highlight to the theme-appropriate coral.
        applySelectionColor(map, resolvedTheme === 'dark' ? CORAL_LIGHT : CORAL)
      }
    } catch {
      // Layers may not exist yet.
    }
  }, [compareWith, loaded, resolvedTheme, mapRef])
}
```

(Note the `satellite` option is gone — it was only consumed by the baseline writes.)

- [ ] **Step 3:** Rewrite the renamed test file for the narrowed surface — keep the colour-pinning and hover-filter tests, MOVE the four baseline-paint tests' coverage to Task 4's matrix (already done), and pin what remains:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { MapProvider, useMap } from '../useMap'
import { useCompareViewHighlight } from '../useCompareViewHighlight'
import { CORAL, CORAL_LIGHT, TEAL_DIM } from '../../lib/mapPalette'

function makeFakeMap() {
  const calls: Record<string, unknown[][]> = { setFilter: [], setPaintProperty: [] }
  return {
    setFilter: vi.fn((...args: unknown[]) => calls.setFilter.push(args)),
    setPaintProperty: vi.fn((...args: unknown[]) => calls.setPaintProperty.push(args)),
    calls,
  }
}
function Injector({ children, map }: { children: ReactNode; map: unknown }) {
  const refs = useMap()
  refs.mapRef.current = map as never
  return <>{children}</>
}
function makeWrapper(map: unknown) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MapProvider>
        <Injector map={map}>{children}</Injector>
      </MapProvider>
    )
  }
}

describe('useCompareViewHighlight', () => {
  it('suppresses hover layers and pins A/B colours when compareWith is present', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useCompareViewHighlight({ loaded: true, compareWith: { ccn3: '276' }, resolvedTheme: 'light' }),
      { wrapper: makeWrapper(fake) },
    )
    expect(
      fake.calls.setFilter.filter(
        (c) => c[0] === 'country-hover-border' || c[0] === 'country-extrusion',
      ),
    ).toHaveLength(2)
    const selFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
    )
    expect(selFill?.[2]).toBe(CORAL)
    const cmpFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-compare-fill' && c[1] === 'fill-color',
    )
    expect(cmpFill?.[2]).toBe(TEAL_DIM)
  })

  it('pins A to CORAL (not CORAL_LIGHT) in dark mode while comparing', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useCompareViewHighlight({ loaded: true, compareWith: { ccn3: '276' }, resolvedTheme: 'dark' }),
      { wrapper: makeWrapper(fake) },
    )
    const selFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
    )
    expect(selFill?.[2]).toBe(CORAL)
  })

  it('restores theme-appropriate coral on exit', () => {
    const fake = makeFakeMap()
    renderHook(
      () => useCompareViewHighlight({ loaded: true, compareWith: null, resolvedTheme: 'dark' }),
      { wrapper: makeWrapper(fake) },
    )
    const selFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
    )
    expect(selFill?.[2]).toBe(CORAL_LIGHT)
  })

  it('does nothing when loaded is false', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useCompareViewHighlight({ loaded: false, compareWith: { ccn3: '276' }, resolvedTheme: 'light' }),
      { wrapper: makeWrapper(fake) },
    )
    expect(fake.setFilter).not.toHaveBeenCalled()
    expect(fake.setPaintProperty).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4:** In `src/components/WorldMap.tsx`: replace the `useCompareViewDimming` import/call with `useCompareViewHighlight({ loaded, compareWith, resolvedTheme })`, change `useSatelliteMode({ loaded, satellite, resolvedTheme })` → `useSatelliteMode({ loaded, satellite })`, and add `useCountryBaselinePaint({ loaded, satellite, inCompareView: compareWith !== null, resolvedTheme })`. Hook order no longer matters for paint; keep the call list tidy (theme, satellite, baseline-paint, compare-highlight).
- [ ] **Step 5:** Update the one live-doc mention: in `docs/systems/ui-layout.md`'s Compare paragraph, `(\`useCompareViewDimming.ts\`)` → `(\`useCompareViewHighlight.ts\` + \`useCountryBaselinePaint.ts\`)`.
- [ ] **Step 6:** `npm run check` → green; then `npx playwright test --project=chromium compare-view-dimming.spec.ts satellite-default.spec.ts` → green (the e2e asserts end-state paint values, which are unchanged by design).
- [ ] **Step 7: Commit + PR** `refactor(map): useCountryBaselinePaint owns fill/border baselines (#111 item 1)` (+ trailer). PR body: name the bug class this kills and the matrix tests pinning visuals.

---

## Phase 3 — Style-latch fix (branch `followups/phase-3-style-latch`)

### Task 6: e2e regression assertion first (fails pre-fix)

**Files:** Modify: `e2e/map-reliability.spec.ts`

- [ ] **Step 1:** Add a test (match the file's existing style — read it first; it uses `gotoAndWaitForMap`):

```ts
test('a clean load leaves no latched map error', async ({ page }) => {
  await gotoAndWaitForMap(page, '/')
  // Pre-fix, transient pre-load tile errors in the stubbed environment latch
  // mapError='style' forever (roadmap § "Pre-load 'style' error latching").
  await expect(page.locator('[data-map-error]')).not.toBeAttached()
})
```

- [ ] **Step 2:** Run `npx playwright test --project=chromium map-reliability.spec.ts` → the new test FAILS (`[data-map-error="style"]` is attached after a stubbed load). If it unexpectedly PASSES, STOP — re-validate the latch reproduction before continuing (the fix's premise needs re-checking).

### Task 7: Unit test + clear-on-load fix

**Files:**
- Modify: `src/hooks/__tests__/useMapInstance.test.tsx`
- Modify: `src/hooks/useMapInstance.ts` (the `map.on('load', ...)` handler)

- [ ] **Step 1:** Expose constructed instances from the test's maplibre mock: inside `vi.mock('maplibre-gl', ...)`, add `const instances: FakeMap[] = []` beside `constructorArgs`, push `instances.push(this)` in the FakeMap constructor, and export `__instances: instances` in the returned object. Also add a `fire(evt: string, e?: unknown)` method to FakeMap: `this._handlers[evt]?.forEach((h) => h(e ?? {}))`.
- [ ] **Step 2:** Write the failing test:

```tsx
  it('clears a latched pre-load style error once load fires', async () => {
    const maplibre = (await import('maplibre-gl')) as unknown as {
      __instances: Array<{ fire: (evt: string, e?: unknown) => void }>
    }
    const { result } = renderHook(
      () => {
        const ref = useRef<HTMLDivElement | null>(document.getElementById('c') as HTMLDivElement)
        return useMapInstance({ containerRef: ref, onLoad: () => Promise.resolve() })
      },
      { wrapper: Wrapper },
    )
    const map = maplibre.__instances.at(-1)!

    // A transient pre-load error latches 'style'...
    await act(async () => {
      map.fire('error', { error: { message: 'The source image could not be decoded' } })
    })
    expect(result.current.mapError).toBe('style')

    // ...and a successful load clears it (the style demonstrably loaded).
    await act(async () => {
      map.fire('load')
    })
    await vi.waitFor(() => expect(result.current.mapError).toBeNull())
    await vi.waitFor(() => expect(result.current.loaded).toBe(true))
  })
```

(Import `act` from `@testing-library/react` alongside `renderHook`.)

- [ ] **Step 3:** Run the file → the new test FAILS at the `toBeNull()` wait (mapError stays 'style').
- [ ] **Step 4: Implement** — in `useMapInstance.ts`'s `map.on('load', ...)` handler, directly after `window.clearTimeout(watchdog)`, add:

```ts
      // 'load' fired, so the style demonstrably loaded — clear a latched
      // pre-load 'style' error (transient tile/style fetch hiccups otherwise
      // pin the full-screen overlay over a working map). timeout / webgl-lost /
      // country-data are real failures and stay latched.
      setMapErrorState((prev) => (prev === 'style' ? null : prev))
```

- [ ] **Step 5:** Run the unit file → all green. Run `npx playwright test --project=chromium map-reliability.spec.ts webgl-context-loss.spec.ts` → the Task 6 assertion now PASSES; webgl spec unaffected (its assertions are scoped to `webgl-lost`).
- [ ] **Step 6:** Update the roadmap entry — in `docs/roadmap.md`, wrap the "Pre-load `'style'` error latching" bullet in `~~…~~` and append ` **Done** (this PR): cleared on \`load\`; unit + e2e regression tests added.`
- [ ] **Step 7: Commit + PR** `fix(map): clear a latched pre-load style error once the map loads` (+ trailer).

---

## Phase 4 — Small src cleanups (branch `followups/phase-4-src-cleanups`, after Phase 2 merges)

### Task 8: MODE_IDS compile-time exhaustiveness (#111 item 3)

**Files:** Modify: `src/game/modes/index.ts`

- [ ] **Step 1:** Replace

```ts
/** Launcher card order. */
export const MODE_IDS: readonly ModeId[] = ['country-pinning', 'city-guessing']
```

with:

```ts
/** Launcher card order — derived from a Record over ModeId so adding a mode
 *  to the union without registering it here is a COMPILE error (a plain
 *  ModeId[] accepts any subset and silently drops the launcher card). */
const MODE_REGISTRY = {
  'country-pinning': 0,
  'city-guessing': 0,
} as const satisfies Record<ModeId, 0>

export const MODE_IDS = Object.keys(MODE_REGISTRY) as readonly ModeId[]
```

- [ ] **Step 2:** Prove the guard: temporarily add `| 'fake-mode'` to `ModeId` in `src/game/shared/types.ts`, run `npx tsc -b` → expect an error on `MODE_REGISTRY` (missing key); revert. Record the error line in the report.
- [ ] **Step 3:** `npm run check` → green. Commit `chore(game): compile-time exhaustiveness for MODE_IDS` (+ trailer).

### Task 9: Shared BorderChip (#111 item 5)

**Files:**
- Create: `src/components/BorderChip.tsx`
- Create: `src/components/__tests__/BorderChip.test.tsx`
- Modify: `src/components/SingleCountryPanel.tsx` (borders map, ~lines 348-376)
- Modify: `src/components/CountryColumn.tsx` (borders map, ~lines 95-123)
- Modify: `src/components/__tests__/CountryColumn.test.tsx` (keep — it asserts the integration)

- [ ] **Step 1: Component** (one definition for both panels; classes are today's exact tokens per size):

```tsx
import type { CountryData } from '../lib/types'

interface Props {
  code: string
  neighbor: CountryData | undefined
  onSelect: (cca3: string) => void
  /** 'panel' = SingleCountryPanel sizing (with flag); 'compare' = CountryColumn sizing (no flag). */
  size: 'panel' | 'compare'
}

const BUTTON_CLASSES = {
  panel:
    'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-full border border-teal/20 dark:border-teal-light/15 bg-teal/5 dark:bg-teal-light/5 text-teal-dim dark:text-teal-light hover:bg-teal/12 dark:hover:bg-teal-light/12 hover:scale-[1.03] active:scale-100 transition-all duration-150',
  compare:
    'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border border-teal/20 dark:border-teal-light/15 bg-teal/5 dark:bg-teal-light/5 text-teal-dim dark:text-teal-light hover:bg-teal/12 dark:hover:bg-teal-light/12 transition-colors',
} as const

const SPAN_CLASSES = {
  panel: 'px-2.5 py-1.5 text-xs rounded-full bg-sand-200 dark:bg-dark-300 text-sand-600 dark:text-dark-100',
  compare: 'px-2 py-0.5 text-[11px] rounded-full bg-sand-200 dark:bg-dark-300 text-sand-600 dark:text-dark-100',
} as const

/** A neighbouring-country chip. Codes with no canonical match (e.g. ESH, HKG,
 *  UNK, GUF, MAC, GIB) render INERT — selecting them would write an
 *  unresolvable hash, which clears the selection and closes the panel. */
export function BorderChip({ code, neighbor, onSelect, size }: Props) {
  if (!neighbor) {
    return <span className={SPAN_CLASSES[size]}>{code}</span>
  }
  return (
    <button onClick={() => onSelect(code)} className={BUTTON_CLASSES[size]}>
      {size === 'panel' && (
        <img src={neighbor.flag} alt="" className="w-4 h-3 object-cover rounded-sm shrink-0" />
      )}
      {neighbor.name.common}
    </button>
  )
}
```

- [ ] **Step 2: Failing test** `src/components/__tests__/BorderChip.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BorderChip } from '../BorderChip'
import { makeCountry } from './singleCountryPanelTestUtils'

describe('BorderChip', () => {
  it('renders a clickable button with flag for a matched neighbor (panel size)', () => {
    const onSelect = vi.fn()
    render(<BorderChip code="DZA" neighbor={makeCountry({ cca3: 'DZA', name: { common: 'Algeria', official: 'Algeria' } })} onSelect={onSelect} size="panel" />)
    screen.getByRole('button', { name: 'Algeria' }).click()
    expect(onSelect).toHaveBeenCalledWith('DZA')
  })

  it('omits the flag in compare size', () => {
    render(<BorderChip code="DZA" neighbor={makeCountry({ cca3: 'DZA', name: { common: 'Algeria', official: 'Algeria' } })} onSelect={() => {}} size="compare" />)
    expect(screen.getByRole('button', { name: 'Algeria' }).querySelector('img')).toBeNull()
  })

  it('renders unmatched codes inert in both sizes', () => {
    const onSelect = vi.fn()
    const { rerender } = render(<BorderChip code="ESH" neighbor={undefined} onSelect={onSelect} size="panel" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('ESH')).toBeTruthy()
    rerender(<BorderChip code="ESH" neighbor={undefined} onSelect={onSelect} size="compare" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
```

Run → FAIL (module not found) → create the component (Step 1) → PASS.

- [ ] **Step 3: Migrate both call sites.** In `SingleCountryPanel.tsx`, the borders `.map` body becomes `(<BorderChip key={code} code={code} neighbor={byCca3.get(code)} onSelect={onSelect} size="panel" />)`; in `CountryColumn.tsx` likewise with `size="compare"` (keep its `.slice(0, 6)` + `+N` overflow span). Remove the now-duplicated inline span/button JSX and the local comment (it lives in BorderChip). Imports updated.
- [ ] **Step 4:** Run `npx vitest run src/components/__tests__/` → all green (CountryColumn.test still passes — same DOM contract). `npm run check` → green. Targeted e2e: `npx playwright test --project=chromium panel-and-deeplink.spec.ts compare-source-attribution.spec.ts` → green.
- [ ] **Step 5: Commit** `refactor(components): shared BorderChip for matched/inert border codes (#111 item 5)` (+ trailer).

### Task 10: Un-export the opacity constants (#111 item 6)

**Files:** Modify: `src/lib/mapLayers.ts`

- [ ] **Step 1:** Change `export const DEFAULT_FILL_OPACITY` and `export const SATELLITE_FILL_OPACITY` to plain `const` (both are consumed only inside the module — by `addBaseCountryLayers`, `fillOpacityForMode`, `applyCountryBaselinePaint`). Keep `fillOpacityForMode` exported (it has external callers until Phase 2's rewiring removes them — after Phase 2, verify with `grep -rn "fillOpacityForMode" src/ | grep -v mapLayers` and if ONLY mapLayers-internal, un-export it too in the same commit).
- [ ] **Step 2:** `npm run check` → green (typecheck proves no external consumer). Commit `chore(map): module-private fill-opacity constants — fillOpacityForMode/applyCountryBaselinePaint are the doorway` (+ trailer). Push + PR for Phase 4: `chore: src cleanups from #111 (MODE_IDS guard, BorderChip, private constants)`.

---

## Phase 5 — Shared test utilities (branch `followups/phase-5-test-utils`, test-only)

### Task 11: Create the three shared utilities

**Files:**
- Create: `src/test/countryFixtures.ts`
- Create: `src/test/matchMediaStub.ts`
- Create: `src/test/fakeMapHooks.tsx`

- [ ] **Step 1:** `src/test/countryFixtures.ts` — promote the fully-typed factory (modeled on `singleCountryPanelTestUtils.makeCountry`, which migrates to re-export it):

```ts
import type { CountryData } from '../lib/types'

/** Fully-typed CountryData factory for tests — no `as unknown as` casts.
 *  Defaults model France; override per test. */
export function makeCountryData(overrides: Partial<CountryData> = {}): CountryData {
  return {
    cca3: 'FRA',
    ccn3: '250',
    cca2: 'FR',
    name: { common: 'France', official: 'French Republic' },
    capital: ['Paris'],
    region: 'Europe',
    subregion: 'Western Europe',
    population: 67_000_000,
    area: 551_695,
    governmentType: 'Republic',
    languages: { fra: 'French' },
    currencies: { EUR: { name: 'Euro', symbol: '€' } },
    flag: '',
    flagAlt: '',
    latlng: [46, 2],
    borders: [],
    independent: true,
    unMember: true,
    landlocked: false,
    timezones: ['UTC+01:00'],
    continents: ['Europe'],
    _fieldSources: {},
    ...overrides,
  }
}
```

- [ ] **Step 2:** `src/test/matchMediaStub.ts`:

```ts
import { vi } from 'vitest'

/** Install a window.matchMedia stub (jsdom has none). `matches` decides the
 *  result per query — default: always false. Returns a restore function. */
export function stubMatchMedia(matches: (query: string) => boolean = () => false): () => void {
  const original = (window as { matchMedia?: typeof window.matchMedia }).matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: matches(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  return () => {
    if (original) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: original,
      })
    } else {
      delete (window as { matchMedia?: unknown }).matchMedia
    }
  }
}
```

- [ ] **Step 3:** `src/test/fakeMapHooks.tsx` — the fixture trio duplicated across the map-hook tests:

```tsx
import { vi } from 'vitest'
import { type ReactNode } from 'react'
import { MapProvider, useMap } from '../hooks/useMap'

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

function Injector({ children, map }: { children: ReactNode; map: unknown }) {
  const refs = useMap()
  refs.mapRef.current = map as never
  return <>{children}</>
}

/** renderHook wrapper that provides MapProvider with `map` pre-injected. */
export function makeMapWrapper(map: unknown) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MapProvider>
        <Injector map={map}>{children}</Injector>
      </MapProvider>
    )
  }
}
```

- [ ] **Step 4:** Commit `test: shared CountryData factory, matchMedia stub, fake-map wrapper in src/test/` (+ trailer).

### Task 12: Migrate the 13 duplication sites (one commit per group)

- [ ] **Step 1 — CountryData factory (5 sites):**
  - `src/components/__tests__/singleCountryPanelTestUtils.ts`: replace the `makeCountry` body with `export { makeCountryData as makeCountry } from '../../test/countryFixtures'` (keep `sources`, `stubMatchMedia` → see Step 2, `stubGetAnimations` in place).
  - `src/hooks/__tests__/useCountrySearch.test.ts`: replace the local `c(cca3, ccn3, common, capital)` factory with `const c = (cca3: string, ccn3: string, common: string, capital: string[] = []) => makeCountryData({ cca3, ccn3, cca2: cca3.slice(0, 2), name: { common, official: common }, capital })` importing `makeCountryData` — call sites unchanged.
  - `src/hooks/__tests__/useSelectedCountry.test.ts`, `src/hooks/__tests__/useSelectionHighlight.test.tsx`, `src/lib/__tests__/flyToCountry.test.ts`: read each, replace the local `makeCountry`/factory with `makeCountryData({...})` calls preserving each test's overridden fields exactly.
  After each file: `npx vitest run <file>` → green. Commit `test: one CountryData factory (was 5 copies)`.
- [ ] **Step 2 — matchMedia stub (6 sites):** `src/hooks/__tests__/useTheme.test.ts` (`mockMatchMedia(prefersDark)` → `stubMatchMedia((q) => q.includes('dark') && prefersDark)` — note it re-installs per test, restore not needed there), `src/lib/__tests__/motion.test.ts`, `src/hooks/__tests__/useMapInstance.test.tsx` (the `setupDom` block), `src/game/hooks/__tests__/useGameAnnouncements.test.tsx`, `src/game/hooks/__tests__/useRevealMapEffects.test.tsx`, `src/components/__tests__/singleCountryPanelTestUtils.ts` (its `stubMatchMedia` becomes a re-export or thin call). Read each file first; preserve each site's query behavior via the `matches` callback. Per-file vitest run after each. Commit `test: one matchMedia stub (was 6 copies)`.
- [ ] **Step 3 — fake-map trio (3 sites incl. Phase 2's new file):** `useSelectionHighlight.test.tsx`, `useCompareViewHighlight.test.tsx`, `useCountryBaselinePaint.test.tsx` — delete the local `makeFakeMap`/`Injector`/`makeWrapper`, import `makeFakeMap, makeMapWrapper` from `../../test/fakeMapHooks` (call sites: `makeWrapper(fake)` → `makeMapWrapper(fake)`). Per-file runs → green. Commit `test: shared fake-map wrapper (was 3 copies)`.
- [ ] **Step 4:** `npm run check` → green (whole suite). Push + PR `test: shared test utilities — dedupe factories, matchMedia stubs, fake-map wrappers`.

---

## Phase 6 — Unit-test gaps (branch `followups/phase-6-test-gaps`, test-only, after Phases 2+5 merge)

### Task 13: `useSatelliteMode` tests (post-reconciler surface)

**Files:** Create: `src/hooks/__tests__/useSatelliteMode.test.tsx`

- [ ] **Step 1:** The fake map needs `setLayoutProperty`, `setTerrain`, `getStyle` — extend locally (don't widen the shared fixture for one consumer):

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { makeMapWrapper } from '../../test/fakeMapHooks'
import { useSatelliteMode } from '../useSatelliteMode'

function makeSatelliteFakeMap(layers: Array<{ id: string }>) {
  const calls: Record<string, unknown[][]> = { setLayoutProperty: [], setTerrain: [] }
  return {
    setLayoutProperty: vi.fn((...args: unknown[]) => calls.setLayoutProperty.push(args)),
    setTerrain: vi.fn((...args: unknown[]) => calls.setTerrain.push(args)),
    getStyle: () => ({ layers }),
    calls,
  }
}

const STYLE_LAYERS = [
  { id: 'background' },
  { id: 'water' },
  { id: 'country-fill' },
  { id: 'satellite-layer' },
]

describe('useSatelliteMode', () => {
  it('satellite ON: shows the satellite layer, sets terrain, hides basemap layers', () => {
    const fake = makeSatelliteFakeMap(STYLE_LAYERS)
    renderHook(
      () => useSatelliteMode({ loaded: true, satellite: true, resolvedTheme: 'light' }),
      { wrapper: makeMapWrapper(fake) },
    )
    expect(fake.calls.setLayoutProperty).toContainEqual(['satellite-layer', 'visibility', 'visible'])
    expect(fake.calls.setTerrain).toContainEqual([{ source: 'terrain-dem', exaggeration: 1.5 }])
    // Non-custom basemap layers hidden; country-/satellite- prefixed left alone.
    expect(fake.calls.setLayoutProperty).toContainEqual(['background', 'visibility', 'none'])
    expect(fake.calls.setLayoutProperty).toContainEqual(['water', 'visibility', 'none'])
    expect(
      fake.calls.setLayoutProperty.filter((c) => c[0] === 'country-fill'),
    ).toHaveLength(0)
  })

  it('satellite OFF: hides the satellite layer, removes terrain, restores basemap layers', () => {
    const fake = makeSatelliteFakeMap(STYLE_LAYERS)
    renderHook(
      () => useSatelliteMode({ loaded: true, satellite: false, resolvedTheme: 'light' }),
      { wrapper: makeMapWrapper(fake) },
    )
    expect(fake.calls.setLayoutProperty).toContainEqual(['satellite-layer', 'visibility', 'none'])
    expect(fake.calls.setTerrain).toContainEqual([null])
    expect(fake.calls.setLayoutProperty).toContainEqual(['water', 'visibility', 'visible'])
  })

  it('does nothing before loaded', () => {
    const fake = makeSatelliteFakeMap(STYLE_LAYERS)
    renderHook(
      () => useSatelliteMode({ loaded: false, satellite: true, resolvedTheme: 'light' }),
      { wrapper: makeMapWrapper(fake) },
    )
    expect(fake.setLayoutProperty).not.toHaveBeenCalled()
  })
})
```

(Post-Phase-2, `useSatelliteMode`'s Options is `{ loaded, satellite }` — `resolvedTheme` was removed with the border write; the test code above already reflects that, minus the `resolvedTheme: 'light'` fields, which must be deleted from all three renderHook calls.)

- [ ] **Step 2:** Run → green (these test existing behavior; if any expectation mismatches reality, READ the hook and fix the TEST, then re-check the hook's doc comment). Commit `test(map): cover useSatelliteMode (visibility, terrain, base-layer loop)`.

### Task 14: `useMapTheme` tests

**Files:** Create: `src/hooks/__tests__/useMapTheme.test.tsx`

- [ ] **Step 1:**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { makeMapWrapper } from '../../test/fakeMapHooks'
import { useMapTheme } from '../useMapTheme'
import { TEAL, TEAL_LIGHT } from '../../lib/mapPalette'

function makeThemeFakeMap(layers: Array<{ id: string; type: string }>) {
  const calls: Record<string, unknown[][]> = { setPaintProperty: [], setSky: [] }
  return {
    setPaintProperty: vi.fn((...args: unknown[]) => calls.setPaintProperty.push(args)),
    setSky: vi.fn((...args: unknown[]) => calls.setSky.push(args)),
    getLayer: (id: string) => layers.find((l) => l.id === id),
    getStyle: () => ({ layers }),
    setFilter: vi.fn(),
    calls,
  }
}

const LAYERS = [
  { id: 'background', type: 'background' },
  { id: 'water', type: 'fill' },
  { id: 'place-label', type: 'symbol' },
  { id: 'country-fill', type: 'fill' },
]

describe('useMapTheme', () => {
  it('dark: applies dark overrides, recolors symbol text/halo, sets dark sky, teal-light accents', () => {
    const fake = makeThemeFakeMap(LAYERS)
    renderHook(() => useMapTheme({ loaded: true, resolvedTheme: 'dark' }), {
      wrapper: makeMapWrapper(fake),
    })
    expect(fake.calls.setPaintProperty).toContainEqual(['background', 'background-color', '#10141a'])
    expect(fake.calls.setPaintProperty).toContainEqual(['water', 'fill-color', '#060a12'])
    expect(fake.calls.setPaintProperty).toContainEqual(['place-label', 'text-color', '#64748b'])
    expect(fake.calls.setPaintProperty).toContainEqual(['country-fill', 'fill-color', TEAL_LIGHT])
    expect(fake.setSky).toHaveBeenCalledTimes(1)
  })

  it('light: light overrides and teal accents', () => {
    const fake = makeThemeFakeMap(LAYERS)
    renderHook(() => useMapTheme({ loaded: true, resolvedTheme: 'light' }), {
      wrapper: makeMapWrapper(fake),
    })
    expect(fake.calls.setPaintProperty).toContainEqual(['background', 'background-color', '#e8e3da'])
    expect(fake.calls.setPaintProperty).toContainEqual(['country-fill', 'fill-color', TEAL])
  })

  it('survives setPaintProperty throwing (fast toggle before layers commit)', () => {
    const fake = makeThemeFakeMap(LAYERS)
    fake.setPaintProperty.mockImplementation(() => {
      throw new Error('layer not ready')
    })
    expect(() =>
      renderHook(() => useMapTheme({ loaded: true, resolvedTheme: 'dark' }), {
        wrapper: makeMapWrapper(fake),
      }),
    ).not.toThrow()
  })
})
```

(Note: `applyMapTheme`'s per-layer override loop checks `map.getLayer(layerId)`; the symbol loop iterates `getStyle().layers` — the fake covers both. `useMapTheme` also calls `applySelectionColor` and `setSky`; if `setFilter` or other methods are hit, extend the fake minimally — read the hook first.)

- [ ] **Step 2:** Run → green (same fix-the-test rule as Task 13). Commit `test(map): cover useMapTheme (overrides, symbol recolor, sky, throw-resilience)`.

### Task 15: `GameSessionProvider` guards + window seam

**Files:** Create: `src/game/shared/__tests__/GameSessionProvider.test.tsx`

- [ ] **Step 1:**

```tsx
import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { type ReactNode } from 'react'
import { GameSessionProvider, useGameSessionContext } from '../GameSessionProvider'
import { countriesFixture, citiesFixture } from '../../hooks/__tests__/fixtures'

function wrapperWith(pools: { countries: typeof countriesFixture; cities: typeof citiesFixture }) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <GameSessionProvider pools={pools}>{children}</GameSessionProvider>
  }
}

describe('GameSessionProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('mode is null while the active mode pool is empty', () => {
    const { result } = renderHook(() => useGameSessionContext(), {
      wrapper: wrapperWith({ countries: [], cities: citiesFixture }),
    })
    // Default modeId is country-pinning; its pool is empty.
    expect(result.current.mode).toBeNull()
  })

  it('submitGuessInput is a no-op unless status is playing', () => {
    const { result } = renderHook(() => useGameSessionContext(), {
      wrapper: wrapperWith({ countries: countriesFixture, cities: citiesFixture }),
    })
    act(() => {
      result.current.submitGuessInput({ kind: 'skip' })
    })
    expect(result.current.session.status).toBe('idle')
    expect(result.current.session.lastOutcome).toBeNull()
  })

  it('registers and tears down the window seam under VITE_TEST_HOOKS', () => {
    vi.stubEnv('VITE_TEST_HOOKS', '1')
    const { result, unmount } = renderHook(() => useGameSessionContext(), {
      wrapper: wrapperWith({ countries: countriesFixture, cities: citiesFixture }),
    })
    const seam = (window as { __funworldmap_game?: Record<string, unknown> }).__funworldmap_game
    expect(typeof seam?.getSession).toBe('function')
    expect(typeof seam?.endGame).toBe('function')
    expect(typeof seam?.finalize).toBe('function')
    expect(typeof seam?.restart).toBe('function')
    // getSession returns the live session through the ref.
    expect(
      (seam!.getSession as () => { status: string })().status,
    ).toBe(result.current.session.status)
    unmount()
    const after = (window as { __funworldmap_game?: Record<string, unknown> }).__funworldmap_game
    expect(after?.getSession).toBeUndefined()
  })
})
```

- [ ] **Step 2:** Run → if the seam test fails because `import.meta.env.VITE_TEST_HOOKS` isn't stubbed by `vi.stubEnv` in this Vitest version, gate it instead by running that one test with `VITE_TEST_HOOKS=1 npx vitest run <file>` and mark the in-file approach with the working mechanism — do NOT delete the test; find the supported env route (Vitest ≥1 supports `vi.stubEnv` for `import.meta.env`). Commit `test(game): cover GameSessionProvider pool guards and window seam`.

### Task 16: Reducer `endGame` / `overrideRound` coverage

**Files:** Modify: `src/game/shared/__tests__/useGameSession.test.ts`

- [ ] **Step 1:** Read the file's existing setup (it drives the real reducer via `renderHook(() => useGameSession())` + `act`). If it already defines a country-round factory, reuse it for `round()` below; otherwise add these self-contained tests (the literals match `CountryRoundSpec`/`GuessInput`/`ModeGuessResult` in `src/game/shared/types.ts` exactly):

```ts
  const round = (cca3: string): CountryRoundSpec => ({
    kind: 'country-pinning',
    targetCca3: cca3,
    targetName: cca3,
    targetFlag: '',
    targetCentroid: [0, 0],
  })
  const wrongResult: ModeGuessResult = {
    pointsEarned: 10,
    livesDelta: -1,
    reveal: {
      kind: 'country',
      correct: false,
      targetCca3: 'FRA',
      clickedCca3: 'DEU',
      clickedName: 'Germany',
      distanceKm: 800,
    },
  }
  const guess: GuessInput = { kind: 'country', cca3: 'DEU', name: 'Germany', centroid: [0, 0] }

  it('endGame resets to idle with a fresh used set from any state', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => result.current.start('country-pinning', round('FRA'), null))
    act(() => result.current.attempt(guess, wrongResult))
    act(() => result.current.endGame())
    expect(result.current.session.status).toBe('idle')
    expect(result.current.session.score).toBe(0)
    expect(result.current.session.lives).toBe(3)
    expect(result.current.session.currentRound).toBeNull()
    expect(result.current.session.used.size).toBe(0)
  })

  it('overrideRound while playing swaps the round WITHOUT advancing roundIndex', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => result.current.start('country-pinning', round('FRA'), null))
    act(() => result.current.overrideRound(round('DEU')))
    expect(result.current.session.roundIndex).toBe(0)
    expect(result.current.session.currentRound?.kind === 'country-pinning' && result.current.session.currentRound.targetCca3).toBe('DEU')
    expect(result.current.session.used.has('FRA')).toBe(true)
    expect(result.current.session.used.has('DEU')).toBe(true)
  })

  it('overrideRound from round-ended advances roundIndex and clears lastOutcome', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => result.current.start('country-pinning', round('FRA'), null))
    act(() => result.current.attempt(guess, wrongResult))
    expect(result.current.session.status).toBe('round-ended')
    act(() => result.current.overrideRound(round('ESP')))
    expect(result.current.session.status).toBe('playing')
    expect(result.current.session.roundIndex).toBe(1)
    expect(result.current.session.lastOutcome).toBeNull()
  })

  it('overrideRound from idle is rejected', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => result.current.overrideRound(round('FRA')))
    expect(result.current.session.status).toBe('idle')
    expect(result.current.session.currentRound).toBeNull()
  })
```

(Imports to extend at the top of the file if absent: `CountryRoundSpec, GuessInput, ModeGuessResult` from `../types`. If the file already has equivalent round/result factories, use those instead of redefining — but every assertion above must appear.)

- [ ] **Step 2:** Run the file → green; `npm run check` → green. Commit `test(game): cover the reducer's endGame and overrideRound actions`. Push + PR for Phase 6: `test: close the unit-test gaps (useSatelliteMode, useMapTheme, GameSessionProvider, reducer actions)`.

---

## Phase 7 — e2e helper consolidation (branch `followups/phase-7-e2e-helpers`)

### Task 17: `waitForMapLoaded(page)` + replace the hand-rolled copies

**Files:**
- Modify: `e2e/helpers.ts`
- Modify (9 specs): `e2e/compare-view-dimming.spec.ts`, `e2e/animation-interrupt.spec.ts`, `e2e/game-city-guessing.spec.ts`, `e2e/game-country-pinning.spec.ts`, `e2e/game-over-mode-switch.spec.ts`, `e2e/reveal-animation.spec.ts`, `e2e/reveal-animation-reduced-motion.spec.ts`, `e2e/tutorial-first-click.spec.ts`, `e2e/map-and-countries.spec.ts`

- [ ] **Step 1:** Add to `helpers.ts` (near `gotoAndWaitForMap`):

```ts
/**
 * Wait for the map's first load WITHOUT stubbing tiles — for GPU specs that
 * need real basemap rendering (gotoAndWaitForMap stubs tiles and is the right
 * choice for everything else). Replaces the per-spec `waitForMap` copies.
 */
export async function waitForMapLoaded(page: Page, timeout = 60_000): Promise<void> {
  await page.waitForSelector('[data-map-loaded]', { timeout })
}
```

- [ ] **Step 2:** In each of the 9 specs: delete the local `waitForMap`/`waitForMapReady` helper (each is a 3-line `page.waitForSelector('[data-map-loaded]', ...)` wrapper at the top of the file) and replace its call sites with `waitForMapLoaded(page)` imported from `./helpers`. LEAVE ALONE any spec waiting on the `'[data-map-loaded], [data-map-error]'` loaded-OR-error variant (e.g. `panel-focus.spec.ts`) — different semantics.
- [ ] **Step 3:** Run the affected specs: `npx playwright test --project=chromium compare-view-dimming.spec.ts animation-interrupt.spec.ts game-city-guessing.spec.ts game-country-pinning.spec.ts game-over-mode-switch.spec.ts reveal-animation.spec.ts reveal-animation-reduced-motion.spec.ts tutorial-first-click.spec.ts map-and-countries.spec.ts` → all green. Commit `test(e2e): shared waitForMapLoaded helper (was 9 copies)`.

### Task 18: Parameterise `routeMapTiles`; absorb label-contrast's copy

**Files:**
- Modify: `e2e/helpers.ts` (`routeMapTiles` signature)
- Modify: `e2e/label-contrast.spec.ts` (delete `routeMapTilesRich`, ~lines 171-235)

- [ ] **Step 1:** Change `routeMapTiles`'s signature to `export async function routeMapTiles(page: Page, opts: { styleStub?: Buffer } = {}): Promise<void>` and where the embedded `positronStyleStub` is served (the `/styles/` route fulfilment), serve `opts.styleStub ?? positronStyleStub`. No other behavior changes.
- [ ] **Step 2:** In `label-contrast.spec.ts`: delete the whole `routeMapTilesRich` function; its callers become `await routeMapTiles(page, { styleStub: buildRichPositronStub() })` (the `buildRichPositronStub()` builder above it STAYS — only the duplicated ~65-line interceptor goes). Remove now-unused local constants (`pngBody`, `emptySpriteJson`, `emptyTileJson` inside the deleted function go with it).
- [ ] **Step 3:** Run `npx playwright test --project=chromium label-contrast.spec.ts` → green (CI-skipped spec; local verification is the gate). `npm run check` → green.
- [ ] **Step 4:** Update the roadmap: strike the `**\`waitForMapLoaded(page)\` e2e helper**` bullet with ` **Done** (this PR).` Commit `test(e2e): routeMapTiles takes a style stub — label-contrast drops its 70-line copy` (+ trailer). Push + PR `test(e2e): helper consolidation (waitForMapLoaded, parameterised routeMapTiles)`.

---

## Phase 8 — eslint-plugin-playwright (branch `followups/phase-8-eslint-playwright`)

**ABORT CRITERION:** if the plugin surfaces more than ~20 errors needing non-trivial fixes, configure the worst rules off with justifying comments instead of mass-editing specs, or stop and file an issue. Trivial mechanical fixes don't count against the budget.

### Task 19: Install and wire the plugin

**Files:** Modify: `package.json`, `package-lock.json`, `eslint.config.js`

- [ ] **Step 1:** `npm install --save-dev eslint-plugin-playwright` (latest; flat-config-compatible).
- [ ] **Step 2:** In `eslint.config.js`, add AFTER the `tooling/e2e-and-scripts` block (so it layers on top for e2e only):

```js
  {
    name: 'tooling/e2e-playwright',
    extends: [playwright.configs['flat/recommended']],
    files: ['e2e/**/*.ts'],
    rules: {
      // helpers.ts deliberately exports expect-based readiness helpers
      // (waitForAppReady, waitForGameTestHook, ...) used across specs.
      'playwright/no-standalone-expect': 'off',
    },
  },
```

with `import playwright from 'eslint-plugin-playwright'` at the top. (If `flat/recommended`'s export shape differs in the installed version, adapt per its README — the goal rules: `missing-playwright-await` (error), `no-wait-for-timeout`, `no-force-option`, plus the rest of recommended.)

- [ ] **Step 3:** `npm run lint` → triage everything surfaced. Expected classes: none for `waitForTimeout`/`force` (the suite is clean — these rules now MECHANIZE the CLAUDE.md bans); possibly `playwright/no-conditional-in-test` or `no-skipped-test` hits on the `test.fixme(!!process.env.CI, ...)` quarantines — if so, disable those two rules with a comment pointing at CLAUDE.md's quarantine policy (the conditional fixme IS the policy). Fix genuinely-flagged code only when trivial; apply the abort criterion.
- [ ] **Step 4:** `npm run check` → green; `npx playwright test --list --project=chromium` still parses.
- [ ] **Step 5:** Add one line to CLAUDE.md's "Forbidden patterns" intro (after "The rules below exist because every test that violates them has caused a CI flake."): `As of 2026-06, eslint-plugin-playwright mechanizes the waitForTimeout and force-click bans (\`npm run lint\`).`
- [ ] **Step 6:** Strike the roadmap's `**\`eslint-plugin-playwright\` on the e2e lint block**` bullet with ` **Done** (this PR).` Commit `chore(lint): eslint-plugin-playwright on e2e — mechanizes the CLAUDE.md flake bans` (+ trailer). Push + PR.

---

## Phase 9 — Close-out (branch `followups/phase-9-closeout`)

### Task 20: Roadmap + issue + plan lifecycle

- [ ] **Step 1:** In `docs/roadmap.md` § "Deferred from the 2026-06 cleanup", strike the two remaining shipped bullets (`**Shared unit-test utilities**`, `**Unit-test gaps**`) with ` **Done** (PR #<n>).` (style-latch, helper, and eslint bullets were struck in their own phases). The three condition-gated bullets (highlighting, messages.ts routing — and note the preamble helper lives in #111, not the roadmap) remain live.
- [ ] **Step 2:** Commit `docs(roadmap): strike the shipped 2026-06 deferrals` (+ trailer); push; PR; merge per the usual flow.
- [ ] **Step 3 (after all phases merge):** Close #111: `gh issue comment 111 --body "<per-item PR mapping; item 7 stays deferred per its 4th-site condition>"` then `gh issue close 111`.
- [ ] **Step 4:** Archive this plan: `git mv docs/superpowers/plans/2026-06-12-review-followups.md docs/superpowers/plans/archive/` with an execution note at the top (same pattern as the cleanup plan), via a final small PR.

## Final verification (after all merges)

- [ ] `npm run check` green on main.
- [ ] `npx playwright test --project=chromium` and `--project=mobile-chromium` green locally (dev servers killed).
- [ ] `grep -rn "useCompareViewDimming" src/ e2e/ docs/systems docs/testing` → no live references (rename complete; `docs/systems/ui-layout.md` mentions `useCompareViewDimming.ts` — update that line in Phase 2's PR).
- [ ] Issue #111 closed; roadmap deferred-section has only the three condition-gated items.
