# Review fixes, batch 1 — design

**Date:** 2026-07-10
**Author:** Tobias Ens (with Claude)
**Status:** Draft

## Context

The 2026-07-10 critical review (full app walkthrough on desktop + mobile, both themes, both game
modes, production bundle build) surfaced a set of confirmed defects. Each item below was verified
twice: behaviorally in a live browser session and against the code path that produces it. Two items
went through a dedicated root-cause debugging session (extrusion smear, GPU-readback warnings —
the latter turned out to be MapLibre-internal and produces no work item; see "Explicitly no action"
below).

Product-direction questions raised by the review were settled in-session:

- Satellite-by-default is intentional — keep.
- Space-dark backdrop in both themes is a settled constraint.
- Game-round camera carry-over is intended game difficulty — no change.
- Search Enter should commit the top result (approved direction).
- Both root-cause investigations were commissioned and completed.

This batch is the bug-tier slice: five small fixes with confirmed root causes and approved
directions. Larger design work (game-mode basemap tuning, per-country political tinting, panel
polish, compare-view camera) is out of scope and will get separate specs.

## Goals

1. No document overflow: the app never shows page scrollbars.
2. The hover tooltip never lingers over a view it doesn't describe.
3. Typing a country name and pressing Enter selects the top search result.
4. Selecting or hovering a country never draws an extrusion wall across the viewport.
5. Auto selections (search, deep link, border chip) frame the country usefully at any starting
   zoom — including zooming *out* — while direct map clicks keep the user's zoom (preserving the
   2026-05-17 decision).

## Non-goals

- Game basemap tuning (labels leak answers in map view; faint borders in satellite) — next batch.
- Per-country political tinting of the base fill — next batch.
- Panel polish (title truncation, region-chip wrap, ESH chip, timezones overflow, heading focus
  ring) — next batch.
- Compare-view camera reframing — separate design question.
- `zoomFromArea` pitch handling (`DEFAULT_PITCH` reset on selection) — pre-existing open question
  from the 2026-05-17 spec, still open.

## Relationship to prior specs

- **Amends `2026-05-17-country-click-preserve-zoom-design.md`.** That spec's `Math.max` clamp was a
  deliberate response to "there should not be a zoom out to a default zoom level when I click on a
  country", and it documented the accepted cost (search-while-zoomed-in lands at the old zoom) plus
  the migration path: *thread `origin` into the call chain and gate the `Math.max` on
  `origin === 'click'`*. Item 5 implements exactly that migration path. The reported failure case
  that triggers it now: select Vatican (z≈11.5), then search Japan → camera stays at z11.5 over
  rural Honshu.
- **Does not touch** the camera rules from `2026-05-17-camera-coherence-design.md` (game lifecycle
  preserves the user's view; reveal animation is the only autonomous camera move).

## Item 1 — hover tooltip causes permanent page scrollbars

**Root cause (measured).** `.country-tooltip` (`src/index.css`) is `position: absolute` with no
initial `top`/`left`. Until the first hover positions it, it sits at its static position at the end
of `<body>`, extending the document 12px past the viewport (`scrollHeight` 912 in a 900px window;
856 in 844). Result: permanent vertical + horizontal scrollbars on classic-scrollbar platforms, on
every viewport.

**Fix.** Add `top: 0; left: 0;` to the `.country-tooltip` base rule. JS positions the element on
every show, so the initial coordinates are never user-visible.

**Verification.** In a browser: `document.documentElement.scrollHeight === window.innerHeight` on
cold load, after hover, after selection. No scrollbars in a fresh screenshot.

## Item 2 — hover tooltip and hover highlight go stale across camera jumps

**Root cause (observed).** The tooltip and the hover feature-state/filters are cleared only on
`mouseleave` of the fill layer (`useMapInteractions.ts`). A camera move without mouse movement
(keyboard search selection, deep link, reveal fly-to) leaves both behind: a "Tanzania / Dodoma"
tooltip floated over Rome during the debugging session, and a ghost hover square lingered after
deselection in an earlier session.

**Fix.** On `movestart`, run the same clearing the `mouseleave` handler does: hide the tooltip,
clear the hover feature state, reset the extrusion/hover-border filters, restore the cursor. If the
pointer is still over a country, the next `mousemove` re-applies hover — so this is safe during
ordinary drags.

**Verification.** Unit test on the interactions hook with a fake map: hover state set → fire
`movestart` → tooltip hidden and filters reset. Live: hover a country, select a distant one via
search, confirm no tooltip remains.

## Item 3 — search: Enter commits the top result

**Root cause (code).** `activeIndex` starts at −1 and is reset to −1 on every keystroke
(`SearchBar.tsx`); Enter only selects when `activeIndex >= 0`. Type "japan" + Enter does nothing —
against the product's "Search First" principle. Mouse hover primes Enter, so keyboard-only users
get the worst path.

**Fix.**
- When results are non-empty, auto-activate index 0 (`setActiveIndex(results.length > 0 ? 0 : -1)`
  in the results effect). Enter then commits the visually-highlighted top result;
  `aria-activedescendant` already tracks `activeIndex`, so screen readers hear the active option.
- ArrowDown/ArrowUp continue to move the active option from that starting point.
- Add `spellCheck={false}` to the input (queries currently get red spell-check squiggles).

**Test updates (same change).** `e2e/search.spec.ts` "selecting a result opens the country panel"
and "keyboard navigation" both press ArrowDown before Enter to reach the first option; with
auto-activation ArrowDown would move to the *second* option. Drop the ArrowDown presses — the
updated tests then prove the new behavior. Add a component test: type query → press Enter →
`onSelect` called with the top result's cca3.

**Risk.** The first row now renders in its active style as soon as results appear. That is the
point (it telegraphs what Enter will do), but it is a visible change to the dropdown's resting
look.

## Item 4 — selection/hover extrusion renders as a wall at high zoom

**Root cause (A-B-A confirmed).** The highlight stacks include `fill-extrusion` layers with fixed
heights: hover 60 km, selection/compare 80 km (`mapLayers.ts`). At world zooms this is the intended
subtle "lift"; at the zooms tiny countries fly to (Vatican z≈11.5, pitch 20°) the 80 km column over
a ~1 km polygon projects as a ribbon crossing the entire viewport. Hiding
`country-selected-extrusion` removes the ribbon; restoring it brings the ribbon back.

**Fix.** Add `maxzoom: 6` to the three extrusion layer definitions (`country-extrusion`,
`country-selected-extrusion`, `country-compare-extrusion`). The lift stays for world/continent
views; past z6 the polygon fill/border/glow carry the highlight alone. 6 is a judgment call —
verify visually at z5–7 during implementation and adjust ±1 if the cutoff pops.

**Verification.** Live repro from the debugging session: `#VAT` shows no ribbon at z11.5; world
view still shows the lift on selection. If a layer-definition unit test exists for these layers,
assert `maxzoom` is present.

## Item 5 — origin-aware selection camera

Three coordinated changes to `flyToCountry` and its call chain.

### 5a — origin-gated zoom clamp

**Behavior.**
- `origin === 'click'` (user clicked a country polygon on the map): `zoom = max(current, computed)`
  — exactly today's behavior; clicking what you can already see never zooms out (2026-05-17
  decision preserved).
- `origin === 'auto'` (search select, border chip, deep link, back/forward): `zoom = computed` —
  the camera may zoom out, so Vatican → search "Japan" frames Japan instead of stranding at z11.5.

**Mechanism.** Selection state flows through the URL hash, so origin can't ride on it. Use a
transient module-scoped mark (e.g. `selectionOrigin.ts` exporting `markClickOrigin()` /
`takeOrigin()`): the map-click select path calls `markClickOrigin()` immediately before writing the
hash. The mark is consumed in `useSelectedCountry.resolveHash` — which runs on *every* hashchange —
and exposed as `selectionOrigin` state alongside `selected`, so the mark can never go stale (a
click that re-selects the already-selected country still consumes it, even though no camera effect
fires). `useSelectionHighlight` receives the origin with the selection and passes `preserveZoom`
to `flyToCountry`. Default is `'auto'` for every unmarked hash change (search, chips, deep link,
back/forward).

### 5b — retuned `zoomFromArea`

**Problem (verified).** `11 − 1.7·log₁₀(area)` clamps to z2 for every country larger than
~196,000 km² — Japan, Germany, Italy, the UK all "fly" to the world view. Only sub-100k-km²
countries get a meaningful zoom-in.

**Fix.** Retune to `10.8 − 1.35·log₁₀(area)`, clamped to `[2, MAX_ZOOM]` (keep `area <= 0 → 6`).
Representative targets:

| Country       | Area km²   | Today | New  |
| ------------- | ---------- | ----- | ---- |
| Vatican       | 0.49       | 11.5  | 11.2 |
| Liechtenstein | 160        | 7.3   | 7.8  |
| Luxembourg    | 2,586      | 5.2   | 6.2  |
| Netherlands   | 41,850     | 3.1   | 4.6  |
| Portugal      | 92,090     | 2.6   | 4.1  |
| Germany       | 357,114    | 2.0   | 3.3  |
| Japan         | 377,930    | 2.0   | 3.3  |
| France        | 543,908    | 2.0   | 3.1  |
| India         | 3,287,590  | 2.0   | 2.0  |
| Brazil        | 8,515,767  | 2.0   | 2.0  |
| Russia        | 17,098,242 | 2.0   | 2.0  |

Mid-size countries now read as the subject of the frame; continental giants still resolve to the
globe view, which is correct for them. The 2026-05-17 spec declared the formula out of *its* scope;
this item deliberately brings it in scope.

### 5c — panel-aware framing

**Problem (measured).** `flyTo` centers the country in the full viewport; the panel then covers the
right 392px (desktop) or bottom ~45% (mobile sheet), so the selection sits off-center or partially
under the panel.

**Fix.** Since selection always opens the panel, apply a deterministic screen offset in
`flyToCountry`: desktop → shift the target center left by half the panel width
(`offset: [-196, 0]`); mobile (below the panel's bottom-sheet breakpoint) → shift up by ~20% of the
viewport height. **Spike first:** confirm whether `flyTo`'s `padding` option behaves under the
globe projection; prefer `padding` if it does, `offset` otherwise (offset is projection-agnostic).
Read the actual panel width/breakpoint from `SingleCountryPanel` at implementation time rather than
hardcoding guesses.

### Test updates (same change)

`src/lib/__tests__/flyToCountry.test.ts` is rewritten to the new semantics: tiny-country zoom-in
(unchanged), click-origin preserves zoom (max), auto-origin flies to computed (may zoom out),
reduced-motion composition, offset presence per layout. Use tolerance assertions
(`toBeGreaterThan` / `toBeCloseTo` with wide precision) per the 2026-05-17 spec's own advice so
constant tweaks don't make the suite brittle. `useSelectionHighlight.test.tsx` (which mocks
`flyToCountry`) and `useSelectedCountry`'s tests also change for the new origin plumbing. Check
e2e specs for zoom-value assertions (`map-and-countries.spec.ts` deep-links `#FRA`, which now
lands at ~3.1 instead of 2 — its assertions are panel/hash-based, but verify).

## Explicitly no action

- **"READ-usage buffer" console warnings** — root-caused to MapLibre's globe-projection
  `ProjectionErrorMeasurement` readback loop (async PIXEL_PACK_BUFFER readback overwritten under
  continuous rendering; Chromium/ANGLE emits a performance note). Not app code, no user impact;
  at most an upstream maplibre-gl-js issue. Documented here so the next reviewer doesn't re-chase
  it.
- **Vatican polygon offset vs. basemap** — 1:50m world-atlas source resolution; unrelated to the
  extrusion smear and not fixable by paint changes. Future data-tier decision.

## Verification (batch)

1. `npm run check` green (lint + typecheck + unit).
2. Targeted e2e: `npx playwright test search.spec.ts map-and-countries.spec.ts --project=chromium`
   — kill stray dev servers first (`Get-Process node | Stop-Process`), per project memory.
3. Live pass: cold load has no scrollbars; `#VAT` shows no ribbon; from `#VAT`, searching Japan
   zooms out and frames Japan left of the panel; typing "japan" + Enter selects Japan; hover a
   country then search-select another → no stale tooltip; world-view selection still shows the
   extrusion lift.

## Risks / watch-outs

- **Globe projection vs. `padding`** — spiked before wiring (5c); `offset` is the fallback.
- **Auto-active first result changes dropdown resting visuals** — intended, but new.
- **`maxzoom: 6` cutoff** — hard cut when crossing z6 mid-selection; verify it doesn't pop
  distractingly during the Vatican fly-through (the fill/border/glow remain, so the highlight never
  disappears entirely).
- **Retuned zoom changes screenshots/assumptions** in any test that implicitly relied on z2
  arrivals; the e2e sweep in verification exists to catch this.
- **`movestart` clearing** fires during the selection fly-to itself — that's desired (it clears the
  pre-selection hover), but confirm the selection highlight (a different layer set) is unaffected.

## Rollback

Each item lands as its own commit; any can be `git revert`ed independently. No storage, data, or
config migrations.
