# Review fixes, batch 2 — design

**Date:** 2026-07-10
**Author:** Tobias Ens (with Claude)
**Status:** Draft

## Context

Second slice of the 2026-07-10 critical review findings (batch 1: PR #129). Scope was settled
in-session: the four fix-shaped streams land now; per-country political tinting is deferred to its
own design-first cycle (batch 3) because it needs genuine palette exploration.

All four sections below were presented and approved in-session on 2026-07-10.

## Goals

1. Active play never shows the answer: basemap labels are hidden during play in map view, and
   country borders are legible during play in satellite view.
2. The country panel renders every country's name, region, neighbors, and timezones without
   truncation artifacts, raw codes, or layout breakage.
3. Picking a compare partner frames **both** countries in the area the compare panel does not
   cover.
4. The deferred batch-1 cleanups land: shared layout constants with a drift alarm, consolidated
   fake-map test helpers, and a smooth extrusion fade instead of the z6 cliff.

## Non-goals

- Per-country political tinting (batch 3, design-first).
- The `selectionOriginRef` threading simplification — **consciously declined**, not deferred: the
  mechanism works, is tested, and documented; collapsing it is churn without behavior change.
- Any change to game rules, scoring, or round flow.
- Compare-view feature changes beyond the camera (source icons, delta emphasis stay as-is).

## Stream 1 — game basemap tuning (during active play)

**Trigger.** `session.status === 'playing'` — the same live gate `mapHoverTooltipEnabled` uses.
Reveal phases and game-over render normally (the reveal names the target anyway).

**Map view: hide the answer labels.** All non-custom basemap layers of type `symbol` (country
names, city names, sea labels) get `visibility: none` while playing. Ownership: `useSatelliteMode`
already flips every non-custom layer on mode change, so a mid-game satellite toggle would
re-show labels. Following the repo's #111 single-owner pattern, basemap layer visibility gets ONE
owner with one rule:

> a non-custom layer is visible iff `!satellite`, and symbol layers additionally require
> `!playing`.

Implemented as one function (e.g. `applyBasemapLayerVisibility(map, { satellite, hideLabels })`)
called by the (renamed or extended) hook on every `{ satellite, playing }` change. The satellite
raster layer and terrain handling stay as they are.

**Satellite view: emphasize borders while playing.** `applyCountryBaselinePaint` — already the
single owner of the border/fill baseline — gains a `gameActive` input. In satellite + playing,
`country-borders` renders at 1.6px width / 0.9 opacity (from 0.5px / 0.6; the live pass may tune
each within ±20%); the white color is unchanged. Reverts at game end via the same owner. (Note: border *width* is currently set only at
layer creation — the owner starts writing `line-width` per mode change.)

**Tests.** Unit: fake map capturing `setLayoutProperty`/`setPaintProperty` — the visibility rule
truth table, and the ordering case (toggle satellite mid-game → labels stay hidden). E2E: existing
game specs re-run; a targeted assertion via the map test seam that a symbol layer is hidden during
play and restored after. Live pass in both modes.

## Stream 2 — panel polish (five verified defects)

1. **Title truncation** ("Vatican…", "Liechtenst…"): the `<h2>` (SingleCountryPanel.tsx:176)
   replaces `truncate` with `line-clamp-2 break-words`; the official-name subtitle (line 184) gets
   the same treatment. Every real common name fits two lines at panel width.
2. **Region chip mid-phrase wrap** ("Europe / Western ⏎ Europe"): remove the chip's effective
   width constraint so "Europe / Western Europe" renders on one line, wrapping as a unit below the
   flag block when space demands (the compare-prompt header state already proves one-line fits).
3. **Border chips for non-selectable neighbors**: the data sweep found six codes referenced by
   canonical countries' `borders` but outside the selectable 195 — ESH (Western Sahara), GIB
   (Gibraltar), GUF (French Guiana), HKG (Hong Kong), MAC (Macau), UNK (not in the dataset;
   REST Countries' code for Kosovo). Five have display names in the shipped 249-entry dataset:
   resolve chip names from the full dataset, with a static `UNK → "Kosovo"` fallback. Chips stay
   non-clickable and visually distinct as today — but never show a raw code.
4. **Timezones overflow**: render the first 3 offsets plus an inline "+N more" toggle that expands
   the full list (France: `UTC-10:00, UTC-09:30, UTC-09:00  +11 more`). Countries with ≤3
   timezones render unchanged.
5. **Heading focus ring**: keep the programmatic focus (screen-reader announcement) but drop the
   `focus-visible:ring-*` classes from the heading — Chromium matches `:focus-visible` for script
   focus, and the heading is never keyboard-focusable, so the ring communicates nothing.

**Tests.** Component tests: long-name country renders un-ellipsized (two lines); UNK/ESH chips show
names; timezones toggle expands/collapses; heading has no ring class. The existing
SingleCountryPanel tests keep passing.

## Stream 3 — compare-view camera

When `compareWith` is set, fly to frame both countries: `cameraForBounds` over the two countries'
centroids with 80px padding (absorbs centroid-vs-outline underframing), then apply the
panel-aware screen offset — desktop compare panel
is `right-4 w-[656px]` (672px footprint → offset `[-336, 0]`), the mobile compare sheet is
`h-[80vh]` (offset `[0, -0.4 · innerHeight]`; the visible sliver still shows both highlights).
Exiting compare leaves the camera in place (preserve-the-user's-view philosophy; the selection
highlight remains). Clearing `compareWith` never flies.

Centroid-based bounds under-frame very large countries slightly; padding absorbs it, and the
common case (neighboring/regional comparisons) frames well.

**Tests.** Unit: compare fly fires once per compareWith change with the expected bounds/offset
shape; no fly on compare exit. An antimeridian pair (e.g. Japan + United States) is asserted to
produce a valid camera (`cameraForBounds` handles wrapping — verified, not assumed). E2E:
compare flow spec extended to assert both highlights are within the un-occluded viewport region.

## Stream 4 — batch-1 deferred cleanups

1. **Layout constants + drift alarm.** New `src/lib/layoutConstants.ts`: desktop breakpoint query
   (single source shared with `useMediaQuery`), single-panel width/inset (360 + 16), compare-panel
   width (656 + 16), sheet heights (40vh collapsed, 80vh compare/expanded). `flyToCountry` and the
   compare camera consume them. Tailwind class literals can't consume TS constants, so a unit test
   asserts the panel components' class strings still contain the constant-derived values
   (`w-[360px]`, `h-[40vh]`, `w-[656px]`, …) — geometry drift fails a test instead of silently
   mis-framing the camera.
2. **Fake-map consolidation.** `src/test/fakeMapRef.ts` grows the spies the batch-1 inline fakes
   added (`setFeatureState`, `getCanvas`, `getZoom`, handler capture keyed by event+layer, layer-
   spec capture); the three inline fakes (useMapInteractions, mapLayers, flyToCountry tests) and
   the compare-camera tests use the shared helper.
3. **Extrusion fade.** Replace the hard `maxzoom: 6` cliff on the three highlight extrusions with
   zoom-interpolated `fill-extrusion-height` (full height at z4.5 → 0 at z6.5) plus `maxzoom: 7`
   as a backstop — the lift shrinks smoothly during flights instead of vanishing in one frame.
   `EXTRUSION_MAX_ZOOM` is exported so tests stop pinning a literal.

## Verification (batch)

1. `npm run check` green; new unit/component tests per stream.
2. E2E: game specs (country-pinning, city-guessing), compare flow, panel specs — plus
   `search.spec.ts`/`map-and-countries.spec.ts` as regression canaries. Kill stray dev servers
   first (project memory).
3. Live pass: play both modes in both basemap styles (no labels in map view during play; bold
   borders in satellite; both restored after); Vatican/Liechtenstein names un-truncated; Algeria
   shows "Western Sahara", Serbia shows "Kosovo"; France timezones collapsed with toggle; compare
   France+Germany and Japan+USA framed left of the panel; extrusion fades (no pop) flying
   Vatican→world.

## Risks / watch-outs

- **Symbol-layer hiding breadth**: hiding ALL symbol layers also hides road/water labels — that is
  intended (any text can anchor guesses), but verify the map doesn't look broken during play.
- **Style reload interplay**: a basemap style reload (theme switch mid-game) re-adds layers with
  default visibility; the owner must re-apply on style/data events the way existing paint owners
  do.
- **`cameraForBounds` on globe projection**: verified in the antimeridian unit test and the live
  pass; if globe support is unreliable, fall back to the midpoint-centroid + max-span zoom
  heuristic.
- **Panel class drift test** is intentionally brittle — that is its job; keep the assertion
  message explicit about which constant to update.

## Rollback

Each stream lands as its own commit(s); any can be `git revert`ed independently. No storage or
data migrations.
