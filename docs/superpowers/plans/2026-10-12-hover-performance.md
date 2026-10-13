# Hover Performance + Reveal Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make sweeping the cursor across countries smooth by stopping every border crossing from reloading the whole `countries` GeoJSON source, and fix the game reveal highlight that has never rendered.

**Architecture:** Hover's filter-driven overlays (`country-hover-border`, `country-extrusion`) move onto their own single-feature source, `countries-hover`, updated with `updateData` so a crossing only touches the tiles around the old and new country. The game reveal gets its own `country-reveal-border` layer keyed by ccn3 (it matched the wrong id and borrowed the hover layer, so it never drew) — this lands first because Stage 1 removes the hover layers' filters. Two further steps are gated on re-measurement: moving the hover tint off feature-state, and collapsing the two delegated hover listeners into one hit-test.

**Tech Stack:** MapLibre GL JS 5.23.0 (globe projection, 3D terrain in satellite mode), React 19, TypeScript (strict), Vitest, Playwright, Vite.

**Spec:** none separate — this is a bug fix whose design pivoted during review. The rationale is in Context below; two adversarial reviews (Opus 5.5, xhigh, one reviewer each) are recorded under Review record.

## Context

The default view is satellite with 3D terrain (`App.tsx` `useState(true)`; `useSatelliteMode.ts` calls `setTerrain`). Three costs sit on the hover path, all verified in the installed MapLibre source and then measured (see Baseline):

1. **Every country crossing reloads the whole `countries` source.** `useMapInteractions.ts` calls `setFilter` on `country-extrusion` and `country-hover-border` on every crossing and every coast exit. `Style.setFilter` → `_updateLayer` marks the layer's whole source `'reload'` (`style.ts` `setFilter`/`_updateLayer`), so every in-view tile is re-parsed for every bucket on `countries` (13 layers: full-world fill earcut + globe subdivision, borders, casing, the dim fill when a country is selected), then deserialized and re-uploaded on the main thread.
2. **With terrain, every crossing also re-renders all draped textures** — the style `data` event from `setFilter` frees every render-to-texture (`map.ts` `_terrainDataCallback`), and the `hover` feature-state bump changes the source revision that keys the draped-texture fingerprint (`render_to_texture.ts`).
3. **With terrain, every mouse move stalls on the GPU.** Two delegated listeners (`mousemove`, `mouseleave` on `country-fill`) each run `queryRenderedFeatures`; each terrain projection is a synchronous `gl.readPixels` (`terrain.ts` `pointCoordinate`).

Separately, the game reveal border never rendered: `useRevealMapEffects` filters `['get','id']` against `targetCca3` (`"FRA"`), but feature ids are ccn3 strings (`"250"`); it also borrowed `country-hover-border`, so `movestartClear` wiped it, hover overwrote it, and its colour/width leaked into every later hover. The e2e asserted the filter _value_, so it passed.

## Baseline (Stage 0)

Measured on `main` @ `3ad9040`, `npm run build:e2e && npm run preview` (port 4173, `VITE_TEST_HOOKS` exposes `__funworldmap_map`), real network tiles, 1440×900, ANGLE / NVIDIA RTX 5070 Ti (D3D11), 120 Hz display. Camera fixed with `jumpTo({center:[12,35], zoom:3.2})` then `idle`. One warm-up sweep discarded, then 5 sweeps of 60 mouse moves, one move per two rAFs, zig-zag across Europe/Africa: **28 boundary transitions, 15 distinct countries, 17 ocean points**. Medians:

| Metric                                      |   Satellite + terrain (default) |                Vector |
| ------------------------------------------- | ------------------------------: | --------------------: |
| `countries` tile reloads (`sourcedata`)     |                         **667** |               **659** |
| `setFilter` / `setFeatureState` calls       |                         58 / 40 |               58 / 40 |
| `queryRenderedFeatures` calls / time        |                   122 / 328 ms |          122 / 15 ms |
| `readPixels` calls / time                   | **1315** (≈21.6 per move) / 372 ms |          22 / 0.2 ms |
| Main-thread busy (`TaskDuration`) per sweep |                     **2644 ms** |                953 ms |
| Paced-sweep wall time (idle control 1497)   |                         2331 ms |               1495 ms |
| Frame p50 / p95 / max                       |                8.4 / 16.8 / 33.4 | 8.3 / 8.5 / 8.6 ms |
| Long tasks (>50 ms)                         |                               0 |                     0 |
| Idle control (hover never reached the map)  |           busy 59 ms, p95 8.4 ms |                     — |
| Countries pipeline: source add → first render | **149 ms** (range 134–160, 7 loads) |                     — |

Reading: sweep reloads are exact and repeatable (each `setFilter` ≈ 11–12 tiles). On this fast GPU/CPU frame p95 is quantised to 120 Hz steps (8.3 ms) and hides most of the damage, so `busyMs` and `wallMs` are the sensitive indicators: a satellite sweep keeps the main thread ~2.6 s busy and stretches a 1.5 s paced sweep to 2.3 s.

**Methodology note.** The e2e bundle is minified, so profiler function names are unreadable. Instead of parsing a trace, the scripts wrap `map.queryRenderedFeatures`, `map.setFilter`, `map.setFeatureState` and `WebGL*RenderingContext.prototype.readPixels` with `performance.now()` timers, count `sourcedata` events with `sourceId === 'countries' && tile`, and read `Performance.getMetrics` `TaskDuration` over CDP for main-thread busy time. The first run of the script produced zeros because the first-visit launcher overlay swallowed every pointer move — the script now dismisses it (as `ensureLauncherDismissed` does) and throws if a sweep produces no `queryRenderedFeatures` calls.

**Targets after Stage 1:** `countries` reloads = **0**; satellite `busyMs` and `wallMs` down; satellite frame p95 ≥25 % lower (16.8 → ≤12.6 ms, i.e. one vsync); first-tiles time within +10 % (≤164 ms). **Gates:** Stage 1b runs only if the p95 target is missed; Stage 2 runs only if `queryRenderedFeatures` + `readPixels` ≥15 % of main-thread busy time in the satellite sweep (baseline ≈14 %, but busy time is about to shrink, so re-measure).

## Scope out

- In-memory point-in-polygon hit-testing (raise only if Stage 2 still misses its target).
- Selection-click filter reloads (once per click, not per move).
- Compare view's one-shot hover suppression: `useCompareViewHighlight` clears the overlay once on entry and hover can return on the next crossing. Pre-existing; behaviour preserved.
- The `CountryLike` game type is not changed. `GameController` already receives `referenceCountries: Map<cca3, CountryData>` (which carries `ccn3`); it is passed to the reveal hook instead.
- Basemap/terrain tile fetch behaviour.

## File Structure

| File                                                      | Task  | Responsibility                                                                                                                                                                        |
| --------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/mapLayers.ts`                                    | 1,2,3 | `LAYER.revealBorder`; `ensureRevealFillLayer` → `ensureRevealLayers`; `COUNTRY_SOURCE`/`HOVER_SOURCE`; `addHoverLayers(map, geojson)` + `setHoverOverlay` (single owner of the overlay) |
| `src/game/hooks/useRevealMapEffects.ts`                   | 1     | Key the reveal by ccn3 via `countryByCca3`; write the border/fill on the dedicated layers; delete every reveal write to the hover layers                                              |
| `src/game/GameController.tsx`                             | 1     | Pass `referenceCountries` as `countryByCca3`                                                                                                                                          |
| `src/game/shared/revealAnimation.ts`                      | 1     | Doc comment names `ensureRevealLayers`                                                                                                                                                |
| `src/hooks/useMapInteractions.ts`                         | 2,3b,4 | Call `setHoverOverlay` instead of two `setFilter`s; 3b: hover highlight (tint + overlay) goes through `queueHoverHighlight`/`setHoverHighlight`, flush on `mousedown`, cancel on cleanup; 4: one plain `mousemove` hit-test |
| `src/hooks/useCompareViewHighlight.ts`                    | 2,3b  | `setHoverOverlay(map, null)`, after the colour pins (3b: `setHoverHighlight`)                                                                                                         |
| `src/components/WorldMap.tsx`                             | 2     | Pass `geojson` to `addHoverLayers`                                                                                                                                                    |
| `src/test/fakeMapRef.ts`                                  | 2,3b  | `getSource` stub gains `updateData`; 3b: `getTerrain` stub (`opts.terrain`)                                                                                                           |
| `src/index.css`                                           | 4b    | `.round-result` / `.dark .round-result` text colour (mirrors `.results-card`)                                                                                                         |
| `src/lib/__tests__/designTokens.test.ts`                  | 4b    | Source-text pin for the new `.round-result` colour blocks                                                                                                                             |
| `e2e/a11y-contrast.spec.ts`                               | 4b    | Dark-mode computed-contrast check on the round-result panel (runs in CI)                                                                                                              |
| `src/lib/__tests__/mapLayers.test.ts`                     | 1,2,3 | Reveal-layer and overlay tests; fix `addHoverLayers` call sites                                                                                                                       |
| `src/game/hooks/__tests__/useRevealMapEffects.test.tsx`   | 1     | ccn3 filters, dedicated layers, no hover-layer writes (replaces the obsolete hover-border assertions)                                                                                 |
| `src/game/hooks/__tests__/fixtures.ts`                    | 1     | `countryByCca3Fixture`                                                                                                                                                                |
| `src/hooks/__tests__/useMapInteractions.test.ts`          | 2,3,4 | Mock `setHoverOverlay`; assert overlay calls instead of `setFilter`                                                                                                                   |
| `src/hooks/__tests__/useCompareViewHighlight.test.tsx`    | 2     | Mock `setHoverOverlay`; assert it clears on entry                                                                                                                                     |
| `e2e/helpers.ts`                                          | 2     | `waitForMapSettled`                                                                                                                                                                   |
| `e2e/map-and-countries.spec.ts`                           | 2     | Guard: hovering never reloads `countries` (runs in CI)                                                                                                                                |
| `e2e/reveal-animation-reduced-motion.spec.ts`             | 1     | ccn3 filter + something actually renders on the answer (runs in CI)                                                                                                                   |
| `e2e/reveal-animation.spec.ts`                            | 1     | `'FRA'` → `'250'` (local-only: CI `testIgnore`, #106)                                                                                                                                 |
| `docs/systems/map-rendering.md`                           | 0,3b  | Hover overlay source + the rule, reveal border, layer count; 3b/4: throttled highlight in terrain mode, single hit-test                                                               |
| `docs/superpowers/notes/2026-10-12-hover-sweep/*.js`      | 0     | The Stage 0 measurement scripts, so the before/after table is reproducible                                                                                                            |

## Review record

Required by `AGENTS.md`: exactly one adversarial reviewer per plan; a material redesign gets a fresh one.

- **Review 1** (Opus 5.5, xhigh) of the first draft (duplicate full-data source + `setFilter`): root cause confirmed; found the draft would not fix the default satellite/terrain mode (terrain `readPixels`, RTT flushes), that the e2e arming/terrain-tile races could give a wrong red/green, and that `npm run dev` does not expose the test seam. **Disposition:** redesigned (single-feature overlay via `updateData`, measured baseline, gated Stage 1b/2, deterministic e2e settle).
- **Review 2** (fresh Opus 5.5, xhigh) of the redesign: no blocker. Majors: (M1) `updateData` merges diffs without `promoteId`, so island-patch features with numeric `id` 798 but `properties.id` `'798'` could leave a stuck highlight — **fixed** by registering normalized copies with `id === properties.id`; (M2) Stage 1 does not remove the per-crossing draped redraw from the feature-state bump — **reworded**, Stage 1b added; (M3) Stage 0 not runnable as written — **fixed** (see Baseline); (M4) Stage 2 semantics (leave only on transition; no rAF deferral) — **adopted**; (M5) reveal fix had no CI coverage — **moved** the assertion to the reduced-motion spec, which runs in CI. Minors adopted: `beforeId: country-labels` for the reveal layers, mock `setHoverOverlay` in hook tests, `npm run check` not `npm run test`.

- **Review 3** (Opus 5.5, effort `xhigh` as requested of the subagent) of the three owner-approved additions (Tasks 3b, 4, 4b). **Blocker B1:** throttling only the overlay cannot reach the target — the feature-state tint alone costs the same ~8 s per sweep (Results table), so the first Task 3b draft could gain ≈3 % — **fixed** by throttling tint and overlay as one unit and tracking the tinted id separately; this is a material redesign, so it gets a fresh review (below). **Majors:** M1 the benchmark's frame pacing hides a 100 ms throttle (moves land ~180 ms apart at 4×) — **fixed**, wall-clock `PACE_MS`; M2 the queued-swap cancel must be the first statement of `setHoverHighlight`, before the `shown === id` early return — **fixed** and tested; M3 a late timer after `map.remove()` would throw because `getSource` sat outside the `try` (and the plan wrongly called it a no-op) — **fixed**, `getSource` inside the `try` plus `cancelHoverHighlight` on cleanup, and two wrong comments about context-loss re-registration removed (`retryWebGL` restores in place; `onLoad` does not re-run); M4 the throttle's UX edges — **decided**: flush on `mousedown` (pinning game) and terrain-only (owner, 2026-10-13); M5 a hit-test refactor gated on `hoveredRef` would leave the `pointer` cursor over the ocean after a fly-to — **fixed** with a separate `overFillRef` mirroring the delegated listener's `mousein`, and the mid-drag rationale corrected; M6 no cursor tests exist and the fake's `getLayer` is `undefined` — **fixed** (characterization tests first, guard dropped, tests rewritten for the plain event model). **Minors adopted:** `lastSwapAt = -Infinity` for fake timers, the layer reveal in the shared apply path, the dropped link rule, exact-block CSS pin plus a CI computed-colour e2e, checkbox steps, File Structure rows, docs-first, and a11y-contrast + mobile-chromium in the e2e list.
- **Review 4** (fresh Opus 5.5, `xhigh`) of the redesigned Task 3b: _pending — recorded here when it reports._

## Global Constraints

- **Branch:** `fix/hover-performance`, in the worktree `.claude/worktrees/fix-hover-performance`, off `main` @ `3ad9040`. Owner decision 2026-10-12. The `calibrated-fittings-and-product-record` checkout and its uncommitted `CLAUDE.md`/`AGENTS.md` changes are not touched.
- **Order is load-bearing:** Task 1 (reveal) before Task 2 (overlay). If the reveal still wrote `setFilter` on `country-hover-border`, its cleanup to EMPTY would hide the filterless overlay layer for the rest of the session.
- **Single paint/filter owner rule** (the repo's #111 pattern): `setHoverOverlay` in `mapLayers.ts` — becoming `setHoverHighlight` in Task 3b, which also owns the feature-state tint — is the only writer of the hover highlight; nothing calls `setFilter` on a `countries` layer at pointer frequency.
- **AGENTS.md e2e rules:** no `waitForTimeout`, no `force: true`; use `e2e/helpers.ts` readiness helpers; never assert result order.
- **No new npm dependencies.** Remove obsolete code and tests in the same change (project memory).
- **Every task ends green:** `npm run check` before each commit. Kill any background `npm run dev` before running Playwright (project memory: `reuseExistingServer` reuses it without `VITE_TEST_HOOKS`).
- **Commit messages:** conventional-commit prefix; end the body with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Pre-flight

- [ ] Worktree is on `fix/hover-performance` at `3ad9040`; `git status --short` is empty.
- [ ] `npm ci && npm run check` — expected: lint and typecheck clean, `87 passed` test files / `689 passed` tests.
- [ ] Baseline numbers above reproduced if a stage claims a delta: `npm run build:e2e`, `npm run preview -- --port 4173 --strictPort`, then run `docs/superpowers/notes/2026-10-12-hover-sweep/hover-sweep.js` (set `MODE` to `satellite` or `vector`) and `first-tiles.js` through Playwright MCP `browser_run_code_unsafe` (the MCP only reads files under the project root or `.playwright-mcp/`, so copy them into the gitignored `.playwright-mcp/` first).

---

## Task 0: Docs before code

**Files:**

- Create: this plan, `docs/superpowers/notes/2026-10-12-hover-sweep/hover-sweep.js`, `docs/superpowers/notes/2026-10-12-hover-sweep/first-tiles.js`
- Modify: `docs/systems/map-rendering.md`

- [ ] **Step 1: Update `docs/systems/map-rendering.md`** — in the layer notes (`## Map Layers`), state that hover border + extrusion sit on a dedicated `countries-hover` source holding at most one feature, updated via `updateData`; add the rule _"never `setFilter` at pointer frequency on a layer that shares the `countries` source — a filter change reloads every layer on the source"_; add `country-reveal-border` and update the `LAYER` count (18 → 19); fix the "a GeoJSON source" line in the data-flow diagram; note that on a wheel-zoom the overlay's tiles queue behind `countries` tiles, so for a few frames the outline may render from a parent tile.
- [ ] **Step 2: Commit.**

```bash
git add docs/superpowers/plans/2026-10-12-hover-performance.md docs/superpowers/notes/2026-10-12-hover-sweep docs/systems/map-rendering.md
git commit -m "docs: plan for hover performance and the reveal highlight fix"
```

## Task 1: The reveal highlight draws (Part 2)

**Files:** see File Structure (`mapLayers.ts`, `useRevealMapEffects.ts`, `GameController.tsx`, `revealAnimation.ts`, tests, fixtures, two e2e specs).

**Interfaces:**

- Consumes: `referenceCountries: Map<string, CountryData>` already held by `GameController`.
- Produces: `ensureRevealLayers(map)`, `LAYER.revealBorder`, and a new `countryByCca3` arg on `useRevealMapEffects`. Task 2 depends on the reveal no longer writing `LAYER.hoverBorder`.

- [ ] **Step 1: Write the failing tests.** In `fixtures.ts` add `export const countryByCca3Fixture = new Map([['USA', { ccn3: '840' }], ['FRA', { ccn3: '250' }]])`. In `useRevealMapEffects.test.tsx`, add `countryByCca3` to `BuildRevealArgsOverrides`/`buildRevealArgs` (default the fixture), then **replace** the three hover-border tests (`paints green correct-country border`, `paints signal wrong-country border`, `clears hoverBorder filter on cleanup`) with:

```ts
it('paints the correct-country border on country-reveal-border, keyed by ccn3', () => {
  const fake = createFakeMapRef()
  const reveal = makeCountryReveal({ correct: true, clickedCca3: null, distanceKm: null })
  renderRevealHook(buildRevealArgs({ session: roundEnded(reveal), mapRef: fake.ref }))
  expect(fake.calls.setFilter).toHaveBeenCalledWith('country-reveal-border', ['==', ['get', 'id'], '250'])
  expect(fake.calls.setPaintProperty).toHaveBeenCalledWith('country-reveal-border', 'line-color', REVEAL_CORRECT)
})

it('never writes the hover layers — hover owns them', () => {
  const fake = createFakeMapRef()
  const reveal = makeCountryReveal({ correct: false, clickedCca3: null, distanceKm: null })
  renderRevealHook(buildRevealArgs({ session: roundEnded(reveal), mapRef: fake.ref }))
  const touchesHover = (c: unknown[]) => c[0] === 'country-hover-border' || c[0] === 'country-extrusion'
  expect(fake.calls.setFilter.mock.calls.some(touchesHover)).toBe(false)
  expect(fake.calls.setPaintProperty.mock.calls.some(touchesHover)).toBe(false)
})

it('skips the highlight when the target has no ccn3 (no layers added, nothing to clear)', () => {
  const fake = createFakeMapRef()
  const reveal = makeCountryReveal({ correct: true, clickedCca3: null, distanceKm: null })
  renderRevealHook(buildRevealArgs({ session: roundEnded(reveal), mapRef: fake.ref, countryByCca3: new Map() }))
  expect(fake.addedLayers).toHaveLength(0)
  expect(fake.calls.setFilter).not.toHaveBeenCalled()
})

it('teardown clears both reveal filters', () => {
  /* rerender status → 'playing' as in the existing fill teardown test; expect setFilter('country-reveal-border', ['==', ['get','id'], ''])
     and setFilter('country-reveal-fill', ...) */
})
```

Change the existing fill assertions `'FRA'` → `'250'` (`adds country-reveal-fill, targets the answer…`). Point (city) reveals must add neither layer. In `mapLayers.test.ts` replace the `ensureRevealFillLayer` describe with `ensureRevealLayers`: adds `country-reveal-fill` then `country-reveal-border` (both `source: 'countries'`, empty filter, fill-opacity 0, border `line-opacity` 0.6); passes `LAYER.countryLabels` as `addLayer`'s second argument when `getLayer(countryLabels)` is truthy and `undefined` otherwise; is idempotent when both layers exist. In `reveal-animation-reduced-motion.spec.ts`, after the `REVEAL_FILL_REDUCED` poll add the render assertion below. Run `npx vitest run src/game src/lib/__tests__/mapLayers.test.ts` — expected: the new/changed tests FAIL.

```ts
// Features are keyed by ccn3 ("250" = France), not cca3. A 'FRA' filter matched nothing and
// this spec used to pass anyway because it only read fill-opacity. Query the whole viewport
// (a point query never hits a line layer) and dedupe — a feature appears once per tile.
for (const layerId of [LAYER.revealFill, LAYER.revealBorder]) {
  await expect
    .poll(
      async () =>
        await page.evaluate(
          (id) => [...new Set(window.__funworldmap_map?.queryRenderedFeatures({ layers: [id] }).map((f) => String(f.id)))],
          layerId,
        ),
      { timeout: 5_000 },
    )
    .toEqual(['250'])
}
```

- [ ] **Step 2: Implement `mapLayers.ts`.** Add `revealBorder: 'country-reveal-border'` to `LAYER`; replace `ensureRevealFillLayer` with:

```ts
export function ensureRevealLayers(map: maplibregl.Map): void {
  // Below the labels: the pulse must not tint the answer's name label. Guarded because
  // MapLibre refuses (and logs) an addLayer whose beforeId does not exist.
  const before = map.getLayer(LAYER.countryLabels) ? LAYER.countryLabels : undefined
  if (!map.getLayer(LAYER.revealFill)) {
    map.addLayer(
      { id: LAYER.revealFill, type: 'fill', source: 'countries', paint: { 'fill-color': REVEAL_WRONG, 'fill-opacity': 0 }, filter: EMPTY_FILTER },
      before,
    )
  }
  if (!map.getLayer(LAYER.revealBorder)) {
    map.addLayer(
      { id: LAYER.revealBorder, type: 'line', source: 'countries', paint: { 'line-color': REVEAL_WRONG, 'line-width': 4, 'line-opacity': 0.6 }, filter: EMPTY_FILTER },
      before,
    )
  }
}
```

Update its doc comment (dedicated layers; why the border no longer borrows the hover layer) and the `revealAnimation.ts` comment that names `ensureRevealFillLayer`.

- [ ] **Step 3: Implement `useRevealMapEffects.ts`.** Add `countryByCca3: ReadonlyMap<string, { ccn3: string }>` to `UseRevealMapEffectsArgs` (doc: features are keyed by ccn3, not cca3) and to the destructure and the effect dependency array. In the country branch:

```ts
const targetCcn3 = reveal.kind === 'country' ? countryByCca3.get(reveal.targetCca3)?.ccn3 : undefined
let revealLayersShown = false
if (reveal.kind === 'country' && targetCcn3) {
  try {
    const targetFilter: maplibregl.FilterSpecification = ['==', ['get', 'id'], targetCcn3]
    const colour = reveal.correct ? REVEAL_CORRECT : REVEAL_WRONG
    ensureRevealLayers(map)
    revealLayersShown = true
    map.setFilter(LAYER.revealBorder, targetFilter)
    map.setPaintProperty(LAYER.revealBorder, 'line-color', colour)
    map.setPaintProperty(LAYER.revealBorder, 'line-width', reduced ? 3 : 4)
    map.setFilter(LAYER.revealFill, targetFilter)
    map.setPaintProperty(LAYER.revealFill, 'fill-color', colour)
    /* …pulse block unchanged… */
  } catch {
    /* layer may not exist */
  }
}
```

Rename `clearRevealFill` → `clearRevealHighlight`; after the pulse cancel, `if (!revealLayersShown) return`, then `setFilter(LAYER.revealBorder, EMPTY_FILTER)`, `setFilter(LAYER.revealFill, EMPTY_FILTER)`, `setPaintProperty(LAYER.revealFill, 'fill-opacity', 0)`. **Delete** the two `map.setFilter(LAYER.hoverBorder, …)` cleanup blocks (planless early-return cleanup and the arc cleanup) and the import of nothing-now-unused symbols. In `GameController.tsx` pass `countryByCca3: referenceCountries`.

- [ ] **Step 4: Update `e2e/reveal-animation.spec.ts`** — the filter expectation `'FRA'` → `'250'` with a one-line comment (feature ids are ccn3).
- [ ] **Step 5: Verify.** `npm run check` — expected: all green. Then `npm run test:e2e -- reveal-animation --workers=2` (dev server killed) — expected: both reveal specs pass, including the new render assertions.
- [ ] **Step 6: Commit** `fix(game): the reveal highlight draws — key it by ccn3 on its own layers`.

## Task 2: Hover overlay on its own single-feature source (Stage 1)

**Files:** `mapLayers.ts`, `useMapInteractions.ts`, `useCompareViewHighlight.ts`, `WorldMap.tsx`, `fakeMapRef.ts`, tests, `helpers.ts`, `map-and-countries.spec.ts`.

**Interfaces:** Produces `COUNTRY_SOURCE`, `HOVER_SOURCE`, `addHoverLayers(map, geojson)`, `setHoverOverlay(map, id | null)`. Consumes Task 1's guarantee that nothing else writes the hover layers.

- [ ] **Step 1: Write the failing e2e guard** in the `Hover interaction` describe of `map-and-countries.spec.ts`, plus the helper in `e2e/helpers.ts`:

```ts
/** Wait until MapLibre has no pending work. `map.loaded()` alone is true while a source reload
 *  is queued but not applied (isSourceLoaded stays true), so also require areTilesLoaded(). */
export async function waitForMapSettled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const map = window.__funworldmap_map
    return !!map && map.loaded() && map.areTilesLoaded()
  })
}
```

```ts
test('hovering across countries never reloads the countries source', async ({ page }) => {
  await gotoAndWaitForMap(page, '/')
  await ensureLauncherDismissed(page)
  await waitForCountryTilesRendered(page)
  await waitForMapSettled(page) // let the baseline-paint reload land BEFORE arming
  const targets = await page.evaluate(/* scan the canvas for two points over DIFFERENT country ids → [{x,y,id}, {x,y,id}] */)
  expect(targets).toHaveLength(2)
  await page.evaluate(() => {
    const w = window as unknown as { __countriesReloads: number }
    w.__countriesReloads = 0
    window.__funworldmap_map!.on('sourcedata', (e) => {
      if (e.sourceId === 'countries' && e.tile) w.__countriesReloads++
    })
  })
  for (let i = 0; i < 4; i++) {
    for (const t of targets) {
      await page.mouse.move(t.x, t.y)
      // hover feature-state is set synchronously in the handler — a state wait, not a sleep
      await expect.poll(() => page.evaluate(({ id }) => !!window.__funworldmap_map!.getFeatureState({ source: 'countries', id }).hover, t)).toBe(true)
    }
  }
  await waitForMapSettled(page) // so a RED run cannot pass because reloads have not landed yet
  expect(await page.evaluate(() => (window as unknown as { __countriesReloads: number }).__countriesReloads)).toBe(0)
  // asserted second: on main the source does not exist, and the count above is the real signal
  await expect.poll(() => page.evaluate(() => [...new Set(window.__funworldmap_map!.querySourceFeatures('countries-hover').map((f) => String(f.id)))])).toEqual([targets[1].id])
})
```

Run `npm run test:e2e -- map-and-countries -g "never reloads" --workers=2` — expected: FAIL with the reload count > 0.

- [ ] **Step 2: Write the failing unit tests.** `fakeMapRef.ts`: `const updateData = vi.fn()`, `getSource = vi.fn(() => ({ setData, updateData }))`, export `updateData` in `calls`. `mapLayers.test.ts`: pass a fixture `FeatureCollection` to `addHoverLayers` (call sites at the `it.each` and the unbounded-layers loop); new describe `hover overlay`: layers sit on `HOVER_SOURCE` with **no** filter; the source is added empty with `promoteId: 'id'`; `setHoverOverlay` — first call adds one feature (`updateData({remove: [], add: [feature]})`), a different id removes the previous and adds the next, `null` removes, the same id is a no-op, an unknown id is ignored, an unregistered map is a no-op, and `setFilter` is never called; the added copy satisfies `id === properties.id` **including a fixture feature with numeric `id: 798` and `properties.id: '798'`**. `useMapInteractions.test.ts`: `vi.mock('../../lib/mapLayers', async (orig) => ({ ...(await orig<typeof import('../../lib/mapLayers')>()), setHoverOverlay: vi.fn() }))`; replace the `setFilter … EMPTY_FILTER` assertions (movestart tests) with `expect(setHoverOverlay).toHaveBeenCalledWith(fake.map, null)`, and assert a crossing calls `setHoverOverlay(fake.map, ccn3)` and never `setFilter`. `useCompareViewHighlight.test.tsx`: same mock; entering compare calls `setHoverOverlay(map, null)` and no `setFilter` on the hover layers. Run `npx vitest run` — expected: FAIL.

- [ ] **Step 3: Implement `mapLayers.ts`:**

```ts
export const COUNTRY_SOURCE = 'countries'
export const HOVER_SOURCE = 'countries-hover'

interface HoverOverlay {
  /** Normalised copies — see addHoverLayers. */
  features: Map<string, GeoJSON.Feature>
  shown: string | null
}
const hoverOverlays = new WeakMap<maplibregl.Map, HoverOverlay>()

/** Add the hover overlay: a border line and a highlight extrusion on their OWN source that holds
 *  at most ONE feature at a time. They used to share `countries` and be driven by `setFilter`;
 *  a filter change reloads the whole source (every in-view tile re-parsed for every layer on it)
 *  and, with terrain, flushes every draped texture — at pointer frequency. updateData reloads
 *  only the tiles around the old and new country and fires no style `data` event.
 *  RULE: never setFilter at pointer frequency on a layer that shares the `countries` source. */
export function addHoverLayers(map: maplibregl.Map, geojson: GeoJSON.FeatureCollection): void {
  // Normalised copies (id === properties.id, geometry shared): MapLibre's updateData merge keys
  // `add` by feature.id without promoteId, and the island patch has numeric ids (798) with
  // string properties.id ('798') — a busy-worker merge would leave a stuck highlight. Copies also
  // keep MapLibre's promote/demote steps away from the objects the `countries` source shares.
  const features = new Map<string, GeoJSON.Feature>()
  for (const f of geojson.features) {
    const id = f.properties?.id
    if (typeof id === 'string') features.set(id, { type: 'Feature', id, properties: { id }, geometry: f.geometry })
  }
  hoverOverlays.set(map, { features, shown: null })
  map.addSource(HOVER_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'id' })
  /* addLayer(LAYER.hoverBorder …) and addLayer(LAYER.extrusion …) exactly as today, with
     source: HOVER_SOURCE and NO filter */
}

/** Single owner of the hover overlay. Never throws; no-op for an unregistered map or unknown id. */
export function setHoverOverlay(map: maplibregl.Map, id: string | null): void {
  const overlay = hoverOverlays.get(map)
  if (!overlay || overlay.shown === id) return
  const next = id === null ? undefined : overlay.features.get(id)
  if (id !== null && !next) return
  const source = map.getSource<maplibregl.GeoJSONSource>(HOVER_SOURCE)
  if (!source) return
  try {
    source.updateData({ remove: overlay.shown === null ? [] : [overlay.shown], add: next ? [next] : [] })
    overlay.shown = id
  } catch {
    /* source torn down (context loss) — the next onLoad registers a fresh overlay */
  }
}
```

Replace the remaining `'countries'` literals with `COUNTRY_SOURCE` (including `addCountrySource`). Fix the stale comment in `applyCountryBaselinePaint`'s compare branch: the hover fill tint is scalar there, and the border/extrusion overlay is cleared **once** on entry and can reappear on the next crossing (pre-existing).

  **As built (refinement found by measurement):** both overlay layers are created with `layout: { visibility: 'none' }` and `setHoverOverlay` reveals them (`setLayoutProperty(..., 'visibility', 'visible')`, once, tracked by `overlay.revealed`) before its first `updateData`. A source whose layers are all hidden is unused and requests no tiles, so the extra source stays off the startup critical path; the startup cost that remains is quantified under Results. The layers carry no filter, as above.

- [ ] **Step 4: Wire the callers.** `useMapInteractions.ts`: replace the two `setFilter`s with `setHoverOverlay(map, id)` and the two in `clearHoverArtifacts` with `setHoverOverlay(map, null)`; use `COUNTRY_SOURCE` in the three `setFeatureState` calls; drop the now-unused `EMPTY_FILTER` import; update the comment at the same-country early return. `useCompareViewHighlight.ts`: call `setHoverOverlay(map, null)` **after** the colour pins (a throw cannot skip them); drop the `EMPTY` import. `WorldMap.tsx`: `addHoverLayers(map, geojson)`.
- [ ] **Step 5: Verify.** `npm run check` green; the e2e guard now passes; run `npm run test:e2e -- map-and-countries compare game-country-pinning mobile-tap --workers=2`. Re-run the sweep scripts against a fresh `npm run build:e2e` in both modes and record the after-table in this plan under Results. Visually compare (Playwright screenshots) hover border + extrusion in light, dark and satellite against `main`.
- [ ] **Step 6: Commit** `perf(map): hover overlay on its own single-feature source — no more whole-source reload per crossing`.

## Task 3: Hover tint off feature-state (Stage 1b) — REFUTED, NOT BUILT (see Results)

**Run only if** satellite frame p95 misses its target after Task 2 (the feature-state revision bump still forces a draped-texture redraw per crossing). Otherwise record "skipped: target met" under Results.

- [ ] Add a fill layer `country-hover-fill` on `HOVER_SOURCE`, `beforeId: LAYER.bordersCasing`, same colour as the base fill. Opacity is α′ = (α_hover − α_base)/(1 − α_base) so it composites like today's tint: vector 0.23/0.95 ≈ **0.2421**, satellite 0.29/0.97 ≈ **0.2990**.
- [ ] `applyCountryBaselinePaint` owns its opacity (0 in compare view, mode-dependent otherwise); `country-fill` returns to scalar 0.05 / 0.03. Delete the `DEFAULT_FILL_OPACITY` / `SATELLITE_FILL_OPACITY` `case` expressions and their tests, and the `setFeatureState` hover calls in `useMapInteractions` (including `hover: false` in `clearHoverArtifacts`).
- [ ] Update the e2e guard's state wait from `getFeatureState(...).hover` to the overlay source (`querySourceFeatures(HOVER_SOURCE)` ids). Unit: layer spec, α′ per mode, 0 in compare; `useMapInteractions` makes no `setFeatureState` calls. Re-measure; commit `perf(map): hover tint on the overlay source — no feature-state revision bump`.

## Task 3b: Throttle the hover highlight in terrain mode (owner-approved 2026-10-13; redesigned after review 3)

The Results show the dominant remaining cost in terrain mode is a heavy terrain re-render per highlight change. **Review 3 caught that the first draft would not work:** the feature-state tint alone costs the same ~8 s per sweep as the overlay alone (8,154 vs 8,426 ms), so throttling only the overlay could gain ≈3 %. The throttle therefore covers the **whole highlight — tint and outline/extrusion together, as one unit** — and only that. The owner chose to build it and judge by feel, and (decision 2026-10-13) to apply it **in satellite/terrain mode only**: vector mode is already smooth (p95 10.4 ms, busy 518 ms), so it keeps the instant highlight.

What stays instant: `hoveredRef`, the cursor, the tooltip, the tooltip position. What lags (terrain mode, fast sweeps only): the tint and the outline/extrusion, by up to the interval.

**Design.** `mapLayers.ts` stays the single owner of the highlight. `setHoverOverlay` becomes `setHoverHighlight` (it now writes the feature-state tint as well as the overlay), with these entry points and one exported constant so the owner can tune it:

- `HOVER_HIGHLIGHT_MIN_INTERVAL_MS = 100`, used only while `map.getTerrain()` is truthy; otherwise the interval is 0 and `queueHoverHighlight` behaves exactly like `setHoverHighlight`.
- `setHoverHighlight(map, id)` — apply **immediately**. Its **first statement** cancels any queued swap (before any early return — review 3 M2: with nothing shown, a pending A and an incoming `null` would otherwise leave A to be drawn after a camera move with its tint and tooltip already cleared).
- `queueHoverHighlight(map, id)` — the pointer path, a **leading + trailing throttle**: if nothing is queued and the last _actual_ swap was ≥ the interval ago, apply now; otherwise remember the **latest** requested id and schedule one trailing apply for when the interval has elapsed. A call that would change nothing (the id is already both tinted and shown) does not consume the budget, so A → B → back to A inside the interval costs nothing.
- `flushHoverHighlight(map)` — apply a queued swap now, if any (called on `mousedown`, so a fast flick-and-click never lands on a stale outline in the pinning game — review 3 M4).
- `cancelHoverHighlight(map)` — drop the timer and queued id without applying (called from the effect cleanup).
- Per-map state: `features` (normalised copies, as now), `shown` (id in the overlay source), `tinted` (id whose feature-state `hover` is true — tracked separately so a clear never leaves a stuck tint, review 3 B1), `revealed`, `lastSwapAt` (starts at `-Infinity` so the first swap is never deferred under fake timers, review 3 m1; uses the monotonic `performance.now()`), `timer`, `pending` (`undefined` = nothing queued, `null` = queued clear).
- One internal `applyHighlight(map, state, id)` is shared by every entry point **and** the timer callback: it unconditionally reveals the layers on the first change (review 3 m2), does `getSource` **inside** the `try` (review 3 M3: after `map.remove()` the style is gone and `getSource` would throw an uncaught TypeError from a late timer), tints the previous country off and the new one on via `setFeatureState`, swaps the overlay with `updateData`, and sets `lastSwapAt` only when something actually changed. An unknown id is ignored.
- Corrected comments: `retryWebGL` restores the context in place and `onLoad` does not re-run, so the earlier remarks that context-loss recovery re-registers the overlay are wrong and are removed.

**Callers.** `hoverCountry` (the per-country body) and the pointer-driven leave call `queueHoverHighlight`; `clearHoverArtifacts(immediate)` — shared with `movestartClear`, which must clear at once — calls `setHoverHighlight(map, null)` when `immediate` and `queueHoverHighlight(map, null)` otherwise; `useCompareViewHighlight` calls `setHoverHighlight(map, null)` (still after the colour pins). The hook stops calling `setFeatureState` itself. `map.on('mousedown', flush)` is added, and the effect cleanup calls `cancelHoverHighlight`.

**Tests** (vitest fake timers; they fake `performance` by default): leading edge applies immediately (tint and overlay); a second change inside the interval is deferred and applied once at the trailing edge with the **latest** id; a burst A→B→C→D applies A, then only D; A→B→back-to-A inside the interval causes no extra `setFeatureState`/`updateData`; `setHoverHighlight` cancels a queued swap **including when it would be a no-op** (the M2 case); `flushHoverHighlight` applies at once; `cancelHoverHighlight` drops it; interval 0 (no terrain) applies immediately every time; a first swap applied from the timer also reveals the layers; a throwing/removed map inside the timer callback does not throw; a clear never leaves a stuck tint. Hook tests assert pointer events call `queueHoverHighlight`, `movestart` and compare entry call `setHoverHighlight(map, null)`, `mousedown` flushes, and cleanup cancels.

**Benchmark pacing (review 3 M1).** The sweep waits two rAFs per move; at 4× a frame is ~90 ms, so moves land ~180 ms apart — wider than the interval — and the throttle would never engage. `hover-sweep.js` gains a `PACE_MS` option (0 = the existing frame pacing, kept so earlier numbers stay comparable) that waits wall-clock time between moves instead, and reports `updateData` and `setFeatureState` counts per sweep. The comparison is the pre-3b build (copy of `dist` taken before rebuilding, served on its own port) against the new build in the same session, satellite at 1× and 4× with `PACE_MS=40`.

**Steps.**

- [ ] Docs first: update `docs/systems/map-rendering.md` (throttled highlight in terrain mode, flush on mousedown, vector unaffected) and commit this plan revision before any code.
- [ ] Extend `fakeMapRef` (`getTerrain`, `setFeatureState` already present) and write the failing unit tests above; confirm they fail.
- [ ] Implement `mapLayers.ts` (rename `setHoverOverlay` → `setHoverHighlight`, add the four entry points and the shared apply), then wire `useMapInteractions` and `useCompareViewHighlight`; update the existing hook tests that assert `setFeatureState`/`setHoverOverlay` directly.
- [ ] Add `PACE_MS` to `hover-sweep.js`; measure pre-3b vs new, satellite 1× and 4×, plus vector (to confirm the interval is inert there). Record under Results.
- [ ] `npm run check`, the e2e specs listed in Task 5; commit `perf(map): throttle the hover highlight in terrain mode`.

## Task 4: One hit-test per mouse move (Stage 2) — APPROVED by the owner 2026-10-13

The unthrottled gate was met (`readPixels` is 20 % of busy time). Expected value is small under throttling (~7 %); the owner chose to build it.

**Design (refinements from reviews 2 and 3).** Replace the delegated `map.on('mousemove', LAYER.fill, …)` and `map.on('mouseleave', LAYER.fill, …)` with one plain `map.on('mousemove', hoverMove)` plus `map.on('mouseout', leaveFill)`. `hoverMove` runs a **single** `queryRenderedFeatures(e.point, { layers: [LAYER.fill] })`. The old `getLayer` guard is dropped: the effect only attaches after `loaded`, when the layer exists, and `queryRenderedFeatures` returns `[]` with no style.

- On a hit: set `overFillRef.current = true` and call the existing per-country body, refactored to take an id (`hoverCountry(id)`) — cursor `pointer` (unless `crosshair`) on every move, tooltip gating, then the early return when the id is unchanged.
- On an empty result, or on `mouseout`: if `overFillRef.current` is true, set it false and run the leave path (`clearHoverArtifacts(false)` + cursor `grab` unless `crosshair`); otherwise do nothing.
- **`overFillRef` is a separate flag from `hoveredRef`** (review 3 M5). It mirrors the delegated listener's internal `mousein`. `movestartClear` nulls `hoveredRef` but not `overFillRef`, so after a reveal fly-to or search jump the next ocean move still runs the leave path and resets the cursor from `pointer` to `grab`, exactly as today. Gating on `hoveredRef !== null` would have left `pointer` over the ocean.
- The "must not clobber `grabbing`" rationale is corrected: map `mousemove` events do not fire while a pan/rotate handler is active (`map_event.ts`), so the leave path cannot run mid-drag from mousemove; the existing mid-drag cursor write comes from `mouseout`, which is unchanged behaviour and out of scope.
- Synchronous, no rAF deferral, so no race with `movestartClear`. `mousemovePosition` (tooltip position) stays a separate listener.

**Tests (review 3 M6).** `useMapInteractions.test.ts` has no cursor tests today (only the e2e at `map-and-countries.spec.ts` checks `pointer`). So, in order: (1) add characterization tests for the **current** cursor/hover state machine — grab on load, pointer on hover, crosshair preserved while compare-picking, grab after leaving, leave after `movestart` clears `hoveredRef`, `dragStart`/`dragEnd`, compare-picking restore — written through a small `hoverOver(id)` / `hoverOff()` helper that fires the delegated events, and confirm they pass; (2) switch the helper to the plain model (stub `getLayer`-free `queryRenderedFeatures` to return `[{ id }]` or `[]`, fire plain `mousemove` with a `point`, and `mouseout`) and confirm the same assertions go red; (3) implement until green. The tests at the old `:147/:181/:229-232` keyed on `mousemove:country-fill`/`mouseleave:country-fill` (which make `fire` throw once those handlers are gone) are rewritten, not kept. Add: exactly one `queryRenderedFeatures` per move; an ocean move with nothing hovered writes no cursor; `mouseout` clears.

- [ ] Write the characterization tests; confirm green on the delegated implementation.
- [ ] Switch the test helper to the plain event model; confirm red.
- [ ] Implement (`overFillRef`, `hoverMove`, `leaveFill`, `hoverCountry`), delete the delegated listeners and their `off` calls; update `docs/systems/map-rendering.md` and this plan's File Structure in the same commit.
- [ ] Re-measure `queryRenderedFeatures` and `readPixels` counts (target: ≈half); `npm run check` and the e2e list in Task 5; commit `perf(map): one hover hit-test per mouse move`.

## Task 4b: The reveal panel's text is invisible in dark mode (owner-approved 2026-10-13)

Found while capturing the reveal screenshot; unrelated to hover. Measured in dark mode on the round-ended panel: the heading, "Your guess" line, metrics and "Learn about" summary all compute `color: rgb(0, 0, 0)` — the browser default, because the app sets no global text colour — on the `dark-400` (`#161a22`) panel: **≈ 1.2 : 1** against the 4.5 : 1 minimum. Only the eyebrow and the button set their own colours. Light mode is fine (black on sand).

**Fix (CSS only, scoped to the one surface).** Mirror the sibling `.results-card` pattern in `src/index.css`: `.round-result { color: var(--color-sand-900) }` and `.dark .round-result { color: var(--color-dark-50) }`. No component change. Contrast from the token values: `dark-50` on `dark-400` ≈ 17 : 1, `sand-900` on `sand-50` ≈ 16 : 1 (the same pair `.results-card` uses, so the game-over review, which reuses `RoundResult` inside `.results-card`, is unchanged). `.dark` is on `<html>` for both the OS preference and the manual toggle, and `index.css` rules sit outside Tailwind's layers, so nothing overrides these.

**Dropped from the first draft (review 3 m3):** an explicit `.learn-details a` colour. Tailwind's preflight sets `a { color: inherit }`, so links were black, not UA blue, and will simply inherit the fixed colour; an explicit link colour would be a style choice, not a contrast fix.

**Tests.** (1) Source-text pin in `src/lib/__tests__/designTokens.test.ts`, in the file's exact-block `toContain` style (a regex for `.round-result {` would also match inside `.dark .round-result {`, and `[^}]*color` would also match `border-color`): the two exact blocks are present. (2) The stronger regression — a computed-colour check in `e2e/a11y-contrast.spec.ts`, which runs in CI and already asserts token RGB values after setting `funworldmap-theme`: reach the round-ended panel through the same game seams the reveal specs use, then assert the `round-result` heading's computed colour is `dark-50` in dark mode and `sand-900` in light. The contrast probe I used to measure the bug is scratch and is not committed.

**Steps.**

- [ ] Write the failing pin and e2e assertions; confirm they fail (heading computes `rgb(0, 0, 0)` in dark).
- [ ] Add the two CSS blocks; confirm green; verify in a real browser in both themes and take a before/after screenshot.
- [ ] `npm run check`; commit `fix(game): the round-result text is readable in dark mode` — a **separate commit, called out in the PR as unrelated to hover**.

**Scope out.** The root cause is the missing global default text colour; other surfaces that rely on inheritance may have the same bug. A global default would change every inheriting element and needs a visual-regression pass, so it is reported to the owner, not done here.

## Task 5: Close out

**Owner decision 2026-10-13:** push `fix/hover-performance` and open a PR against `main` (replaces the earlier "push only" answer). The PR body carries the measured tables, the decisions above, and the note that `reveal-animation.spec.ts` is local-only (#106).

- [ ] Fill in **Results** (the 3b and 4 measurements, per mode) at the bottom of this plan. The `docs/systems/map-rendering.md` updates for 3b/4 land with their code (docs-first for 3b, in the same commit for 4), not here.
- [ ] `npm run check`, `npm run build:e2e`, then `npm run test:e2e -- --workers=2` for map-and-countries, reveal-animation + reduced-motion, compare, game-country-pinning, **a11y-contrast**, and the **mobile-chromium** project (mobile-tap, which exercises the coarse-pointer path through the changed handlers). Use `E2E_PORT` (project memory).
- [ ] Move this plan to `docs/superpowers/plans/archive/` (shipped). Open the PR: measured table, and a note that `reveal-animation.spec.ts` is local-only (#106) while the reduced-motion spec covers the reveal in CI.

## Results

### Task 1 — the reveal highlight draws

A/B in a normal browser (France as target, wrong guess Germany, reduced motion), old `main` against the fix:

|                                   | Old                    | Fixed                                      |
| --------------------------------- | ---------------------- | ------------------------------------------ |
| `country-reveal-fill` filter      | `"FRA"`                | `"250"`                                    |
| Fill features rendered            | `[]` (nothing)         | `["250"]`                                  |
| `country-reveal-border`           | layer does not exist   | exists, renders `["250"]`                  |
| Hover outline after one round     | width 3, `#ff8a4c`     | width 2, `#7dd3fc` (unpolluted)            |

### Task 2 — hover overlay on its own source (Stage 1)

**Like-for-like** (same session, old `main` and the fix interleaved; supersedes the Stage 0 table for any before/after claim). The display cadence on the dev machine drifted from 8.3 ms to 9.6 ms between the Stage 0 baseline and these runs, and the Stage 0 satellite run was taken under heavier machine load (busy 2,644 ms against 1,820 ms for the same old code later), so the Stage 0 absolute numbers must not be compared with these.

| Metric (median of 5 sweeps)        |       Satellite old → new |        Vector old → new |
| ---------------------------------- | ------------------------: | ----------------------: |
| `countries` tile reloads           |                 667 → **0** |               667 → **0** |
| `setFilter` calls                  |                    58 → 0 |                  58 → 0 |
| Overlay source tile events         |        0 → 131 (29 `updateData`, 1.2 ms) | same |
| Main-thread busy                   | 1,820 → 1,506 ms (**−17 %**) |  858 → 518 ms (**−40 %**) |
| Frame p95 / worst frame            |   10.5 → 10.4 / 19.3 → 19.6 ms |  10.3 → 10.4 / 10.9 → 10.7 ms |

Frame p95 is unchanged because this machine (RTX 5070 Ti, 120 Hz) barely drops frames on the old code at full speed. At **4× CPU slowdown** (CDP, a rough mid-range laptop) satellite is genuinely janky on both builds — old: 52 long tasks, p95 77.6 ms, worst frame 106 ms, busy 9.0 s; new: busy 8.4 s with long tasks 63–117 against 20–101 per sweep — i.e. **no measurable difference under throttling**.

**Why: the remaining satellite cost is terrain draping, not hover hit-testing or the reload.** A CPU profile of a throttled sweep (new build) puts ~40 % of busy time in terrain rendering (`_getTerrainCoordsForRegularTile` 15 %, `uniformMatrix4fv` 11 %, native GL), and only 7 % in `readPixels`. Isolating the trigger (satellite, 4×, new build):

| Hover visual that still runs                    | Busy time | Long tasks | Frame p95 |
| ----------------------------------------------- | --------: | ---------: | --------: |
| feature-state tint + overlay `updateData` (as shipped) | 8,426 ms |         99 |   91.6 ms |
| overlay `updateData` only (tint disabled)       |  8,238 ms |         85 |   86.7 ms |
| feature-state tint only (overlay disabled)      |  8,154 ms |         92 |   86.8 ms |
| **neither**                                     | **1,002 ms** |      **0** | **10.6 ms** |

Either visual alone costs the full ~7 s; removing both removes it. In terrain mode **any highlight change forces a heavy terrain re-render** (draped textures are invalidated), roughly 250 ms of throttled main-thread time per border crossing, independent of which mechanism triggers it.

**Startup cost.** The extra source costs about **+23 ms (+15 %)** on the countries pipeline's first render (median of 25 loads: 152 → 175 ms) and **+16 ms (+4 %)** navigation to first render (382 → 398 ms), measured after hiding the overlay layers until the first hover (which MapLibre treats as an unused source, so it requests no tiles). Bisecting with a 7-load sample was misleading — the spread inside a run (144–230 ms) is as large as the effect — so only the 25-load figures are quoted. This misses the plan's "+10 %" first-tiles target.

**Visual check:** hovering France on old and new builds (satellite, dark) is pixel-identical, Corsica included.

**e2e:** the new guard goes red on the old build (32 `countries` reloads from 8 hover moves, expected 0) and green on the fix. The 40 specs covering compare view, map and hover, the pinning game and the reveal (including the CI-run reduced-motion spec with its new render assertions) all pass.

### Gates

- **Task 3 (Stage 1b) — not built.** Its hypothesis was that the feature-state tint's source-revision bump was the draping cost. Disabling the tint entirely changed nothing (8,238 vs 8,426 ms), so moving it onto the overlay source would not help.
- **Task 4 (Stage 2) — gate met unthrottled** (`readPixels` is 20 % of busy time, 1,307 calls ≈ 21.6 per mouse move), **but its expected value is small**: under throttling `readPixels` is ~7 % of busy time, and with both hover visuals disabled the whole sweep is already 1.0 s. It would roughly halve a cost that is not the dominant one.
- **Owner decided 2026-10-13: build it and judge by feel (Task 3b).** The dominant remaining cost is the per-crossing terrain re-render. The lever that scales is making fewer highlight changes during a fast sweep — a leading + trailing throttle of ~100 ms over the **whole** highlight (tint and outline together; the table above shows throttling only one half cannot work), in terrain mode only — at the price of the highlight lagging the cursor by up to that interval during fast sweeps. Task 3b; its measurements are added below when it lands.
