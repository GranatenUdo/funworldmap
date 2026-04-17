# Findings Implementation & Voting Removal — Design

**Date:** 2026-04-17
**Status:** Draft — pending user review
**Supersedes:** none

## Context

A critical assessment of the repository (see session notes 2026-04-17) surfaced findings in four categories: a documented-but-undesigned voting feature; structural complexity in two large components; testing gaps (no hook coverage, e2e runs against dev server not built bundle); documentation gaps (no CONTRIBUTING, SECURITY, ops runbook, or ADR convention). This spec covers a single comprehensive plan that addresses all findings and removes the voting feature completely.

## Goals

1. Remove all voting / user-sentiment content from the repository. Silent scrub, no replacement marker.
2. Close the structural-complexity findings by splitting `WorldMap.tsx` (786 LOC) and `CountryPanel.tsx` (490 LOC) along coherent seams.
3. Close the testing findings: add hook-level unit tests; run e2e against the production bundle.
4. Close the documentation findings: add contributor, security, ops, and ADR-convention docs.
5. Close smaller UX findings: focus management, explicit keyboard-nav affordances, improved basemap degradation UX.

## Non-Goals

- Secondary basemap provider. Banner polish only; provider failover deserves its own spec.
- Voting backend, data-model migration, or any backend work.
- Performance optimization beyond what falls out of the refactor.
- Visual redesign, new features, brand changes.
- Reclassifying existing plans as retrospectives (self-review determined they are forward specs, not post-hoc notes).
- Speculative ADR content for decisions that are not being revisited (convention doc only).

## High-Level Shape

Seven sequential phases, ordered low-risk-first. Each phase is a coherent commit cluster with its own verification gate. `main` must be green (lint + tsc + unit + e2e) before the next phase starts.

| # | Phase | Size |
|---|---|---|
| 1 | Voting removal | S |
| 2 | Documentation additions | M |
| 3 | Planning convention | S |
| 4 | Test infrastructure | M |
| 5 | WorldMap refactor | L |
| 6 | CountryPanel split | M |
| 7 | UX fixes | M |

Phase 4 lands before Phase 5 because the e2e-against-preview change (moving Playwright from `vite dev` to `vite preview` with the conditional base-path) must be stable before a large refactor lands — otherwise a Phase 5 regression and a Phase 4 flake are indistinguishable. Phase 4's hook unit tests cover existing hooks that Phase 5 does not touch; Phase 5 writes its own tests for the hooks it creates. Phases 5 and 6 are independent; executed in order purely for stable-main predictability. Phase 7's panel focus management depends on Phase 6's split being stable, so Phase 7 runs last.

## Phase 1 — Voting Removal

**Intent:** Silent scrub. No "non-goal" marker, no ADR, no deprecation note.

**Scope (grep-verified at design time):**

- `docs/purpose.md:66` — delete the `**Government type sentiment**:` bullet from the "Future Vision" list. The following multi-topic bullet stays unchanged.
- `docs/systems/data-collection.md:125-127` — delete the entire `## Future: Voting & NGO Sentiment` heading and paragraph.
- **Auto-memory update:** `C:\Users\renade\.claude\projects\E--polworldmap\memory\project_polworldmap_purpose.md` — remove the "voting feature future phase" phrasing. Update the `MEMORY.md` index pointer line accordingly.

**Execution-time re-grep patterns** (expected to return zero hits after edits):

- `(?i)vot(e|ing)`
- `(?i)sentiment`
- `(?i)NGO classification`
- `(?i)community perception`
- `(?i)government.type.sentiment`

If the re-grep surfaces a hit in a historical plan under `docs/superpowers/plans/`, **leave it alone.** Historical plans document what work was planned at a point in time; rewriting them is revisionist. Only scrub forward-looking docs.

**Verification:**

- Post-edit re-grep returns zero hits in `docs/` (excluding `docs/superpowers/plans/`) and `README.md`.
- `npm run build` and `npm run test:unit` pass.
- Commit message: `docs: remove voting feature from roadmap`.

**Risks:**

- Deleting the single bullet leaves one sibling bullet in the "Future Vision" list. A list of one is acceptable; no reformatting needed.
- Auto-memory file is outside the repo; it must be edited during execution but is not committed.

## Phase 2 — Documentation Additions

**Intent:** Fill the contributor / security / ops / ADR-convention gaps. Avoid speculative historical ADRs.

**New files:**

- `CONTRIBUTING.md` (root). ~100 lines.
  - Local dev setup, PR expectations (lint/tsc/tests green), commit convention (`type(scope): subject`), how to run e2e locally, how to propose a new data source (cross-link `docs/systems/data-collection.md`), how to report data errors, code style (Prettier/ESLint authoritative, no `any`, no new `@ts-ignore`).

- `SECURITY.md` (root). ~20 lines.
  - Scope: frontend XSS, dependency CVEs, basemap provider incidents. Out of scope: social engineering of GH Pages, non-reproducible upstream issues.
  - Reporting: email + best-effort SLA (static site, no backend, no user data).
  - Disclosure: 90-day coordinated.

- `docs/ops/runbook.md` (new directory). ~80 lines.
  - **Bandwidth watch.** GH Pages soft cap ~100 GB/month. How to check (repo Insights → Traffic). Response: rate-limit advisory, CDN migration path.
  - **Data freshness.** REST Countries quarterly review. CIA Factbook frozen Jan 2026 — no cadence. Owner placeholder: `OWNER_TBD` with explicit `> **Action:**` call-out.
  - **Basemap degradation.** What the degraded banner means; how to confirm via OpenFreeMap status; recovery is user-initiated reload today.
  - **Incident response.** Revert workflow; rollback to last green tag.

- `docs/adr/README.md`. ~30 lines.
  - Filing convention: numbering (4-digit, zero-padded), required sections (Context / Decision / Consequences / Alternatives / Status / Date).
  - When to write one: a genuinely load-bearing decision being made or revisited. Not for historical record.

**Files edited:**

- `README.md`: add Contributing, Security, and Decision Records links. Remove any "follow-up work" bullets that `docs/ops/runbook.md` now covers.
- `docs/index.md`: add `docs/ops/runbook.md` and `docs/adr/README.md` to the reading guide.

**Explicitly deferred:**

- CHANGELOG — git log is the record until there's a release cadence.
- ROADMAP — Phase 0 is shipped; after voting removal the roadmap is "stabilize." A speculative doc would age poorly.
- Data-schema doc — the TypeScript types in `src/lib/types.ts` are the schema.
- Content ADRs for bundled-data / MapLibre / SwiftShader — none is being revisited. Filing historical ADRs produces low-value retroactive docs.

**Verification:**

- Link check: every internal `](docs/` or `](./docs/` path in new files resolves.
- Grep for `TODO|TBD|XXX|FIXME` in new files — expected hit is only the deliberate `OWNER_TBD` call-out in the runbook.
- `npm run build` passes.

## Phase 3 — Planning Convention

**Intent:** Set the norm that plans under `docs/superpowers/plans/` are forward specs, written before code. No file moves — self-review established that existing plans are forward specs that were executed to completion, not post-hoc notes.

**New file:**

- `docs/superpowers/README.md`. ~40 lines.
  - `plans/` contains **forward specs** written before or alongside active work. Format: `YYYY-MM-DD-<slug>.md` with a Goal / Architecture / Tech Stack / Scope-out / File Structure / Pre-flight / Task-list structure.
  - `specs/` contains **design documents** (this one's format) — the output of a brainstorming pass before a plan is written.
  - If a document is retrospective (describes work after the fact), do not file it here. Update the relevant system doc in `docs/systems/` or open an ADR.
  - Checklist for a well-formed plan: forward-looking; checkbox task items; named sub-skill; explicit scope-out; self-contained enough to be executed by a subagent.

**Verification:**

- No files moved, no existing plans edited.
- `docs/index.md` reading guide gains a link to `docs/superpowers/README.md`.

## Phase 4 — Test Infrastructure

**Intent:** Close the hook-coverage gap; run e2e against the production bundle so tests exercise what users get.

**Unit test additions** (Vitest, colocated `*.test.ts` next to source):

- `src/hooks/useSelectedCountry.test.ts` — round-trip select/deselect via URL hash; compareSelect flow; ordering when hash updates arrive between user-initiated calls; empty-hash and malformed-hash handling.
- `src/hooks/useCountryData.test.ts` — Map-by-cca3 and Map-by-numeric construction; field-source registry lookup; empty-input behavior.
- `src/hooks/useCountrySearch.test.ts` — Fuse weight behavior across common/official/cca2/cca3; threshold 0.4 boundary; debounce timing using fake timers.
- `src/hooks/useTheme.test.ts` — system → stored → toggle transitions; localStorage read/write; `resolvedTheme` derivation under media-query changes.
- `src/lib/parseHash.test.ts` — extend existing file with edge cases (trailing separators, unknown codes, lowercase codes, empty hash, single-code vs compare-pair).

Coverage target: ~80% branch coverage on each hook file. No coverage enforcement in CI yet (adding thresholds is out of scope); coverage reported locally via `npm run test:unit -- --coverage`.

**E2E against production bundle:**

- `vite.config.ts`: base-path becomes conditional. Default `'/'`; when building for GH Pages the existing behavior (`/funworldmap/`) is produced via an explicit env var (e.g., `GH_PAGES=1`).
- `playwright.config.ts`: `webServer` command switches to `npm run build && npm run preview -- --port <PORT>`. `baseURL` stays at the root URL (now that preview serves at `/`).
- The GH Pages deploy workflow in `.github/workflows/` sets `GH_PAGES=1` in the build step so production artifacts still live under `/funworldmap/`.

**Scope-out clause:** If the base-path fix requires restructuring asset imports, router base, or downstream code (beyond `vite.config.ts` + `playwright.config.ts` + the deploy workflow), **stop and file a follow-up spec.** Do not sink more than one working day into this sub-task.

**Verification:**

- `npm run test:unit` passes with new tests; coverage report shows hook coverage ≥ 80% branch on the four files above.
- `npm run test:e2e` passes when Playwright's `webServer` is the preview of the built bundle.
- GH Pages deploy workflow still produces artifacts under `/funworldmap/` (verified by inspecting build output's `index.html` base paths).

**Risks:**

- Fake timers + `useEffect` interactions in `useTheme` and `useCountrySearch` tests can produce flakes if `act()` boundaries are sloppy. Use `@testing-library/react` `renderHook` + `act` around every state mutation.
- Preview-bundle e2e may expose timing differences vs. dev-bundle (HMR, source maps). Some currently-passing tests may need small adjustments.

## Phase 5 — WorldMap Refactor

**Intent:** Split the 786-LOC `WorldMap.tsx` into coherent single-purpose units. Behavior-preserving.

**New files under `src/lib/`:**

- `src/lib/mapLayers.ts` — pure layer-definition data. Exports the paint/layout specs for `country-fill`, `country-borders`, `country-hover-border`, `country-extrusion`, the selection stack, the compare stack, the satellite layer, the terrain DEM source. Palette constants (`TEAL`, `CORAL`, variants) live here.
- `src/lib/loadCountryGeojson.ts` — async function that imports `topojson-client` + `world-atlas/countries-50m.json`, converts to GeoJSON, normalizes `feature.properties.id`, and applies the antimeridian fix. Returns `GeoJSON.FeatureCollection`. Independently testable (no MapLibre dependency).
- `src/lib/resetViewControl.ts` — the `ResetViewControl` class extracted verbatim; no behavior change.

**New hooks under `src/hooks/`:**

- `src/hooks/useMap.ts` — returns a stable context object: `{ map, loaded, mapError, basemapDegraded, supported, hoveredRef, tooltipRef }`. This is the shared-ref mechanism that lets the other hooks split cleanly.
- `src/hooks/useMapInstance.ts` — owns MapLibre construction, watchdog timeout, `probeBasemap`, error/degraded state, cleanup. Consumed by `useMap`.
- `src/hooks/useMapInteractions.ts` — hover (feature-state + filter updates), tooltip DOM mutations, click-to-select, click-outside deselect, cursor-state juggling. Consumes `useMap`.
- `src/hooks/useSelectionHighlight.ts` — selection filter effect + compare filter effect + compare-view dimming. Consumes `useMap`.
- `src/hooks/useMapTheme.ts` — paint-property updates for theme changes (teal/coral variants, borders, fog, sky, atmosphere). Consumes `useMap`.
- `src/hooks/useSatelliteMode.ts` — satellite layer visibility, terrain toggle, basemap layer hide/show, border recolor for satellite view. Consumes `useMap`.

**New hook unit tests** (added in this phase, not deferred):

- `src/lib/loadCountryGeojson.test.ts` — antimeridian fix logic with synthetic topology fixtures; id normalization.
- `src/hooks/useMapInstance.test.tsx` — probes surface `basemapDegraded`; watchdog surfaces `timeout`; construction failure surfaces `supported=false`. Mocks MapLibre.
- `src/hooks/useSelectionHighlight.test.tsx` — filter-spec generation for selected + compareWith + combined states. Mocks MapLibre's `setFilter`.
- Interactions / theme / satellite hooks exercise too much MapLibre-internal state to unit-test meaningfully; they're covered by existing e2e.

**Refactored `src/components/WorldMap.tsx`** — lands around 100–150 LOC. Composition only: renders the container, reads `useMap`, threads props into interaction/highlight/theme/satellite hooks, renders error overlay and degraded banner.

**Verification:**

- All existing unit tests pass unchanged.
- All existing e2e tests pass unchanged — this is a behavior-preserving refactor.
- New unit tests (loadCountryGeojson, useMapInstance, useSelectionHighlight) pass.
- `WorldMap.tsx` is under 200 LOC.
- No new `@ts-ignore` or `any` introduced.

**Risks:**

- Shared-ref mechanism (`hoveredRef`, `tooltipRef`) needs to survive hook re-renders. Returning refs from `useMap` (which is itself a memoized context) handles this; confirm with a render-count test if needed.
- MapLibre's event handlers reference closures. Splitting handlers across hooks must preserve the same `map.on(...)` / cleanup contract. Error-prone — plan the event-handler ownership explicitly during execution (each `map.on` has exactly one attaching hook and a matching `map.off` in its cleanup).
- Landing this as one commit is risky (large diff). Execution may split into sub-commits (extract lib files first; then extract hooks one at a time), all on a single branch.

## Phase 6 — CountryPanel Split

**Intent:** Separate single and compare layouts. No context-izing; splits follow the actual conditional shape.

**New files:**

- `src/components/SingleCountryPanel.tsx` — the single-country layout branch from today's `CountryPanel.tsx`. Owns the single-country header, field layout, borders list, source tooltips.
- `src/components/CompareCountryPanel.tsx` — the compare layout branch. Owns the two-column layout, the compare header, per-column close button, the A/B distinction.
- `src/components/CountryColumn.tsx` — stays as the shared inner presentation; minor prop cleanup if any duplication surfaces.

**Refactored `src/components/CountryPanel.tsx`** — thin router. Decides single vs compare based on props and renders the appropriate child. Lands around 40–60 LOC.

**Props:** neither child receives more than 6 props. Any shared lookups (`byCca3`, `sources`) are passed through directly — still props, not context.

**Verification:**

- All existing e2e tests for panel, deeplink, search→panel pass unchanged.
- No visible UX change.
- Each new component is independently reviewable.

**Risks:**

- Mobile peek-state logic (referenced in recent commits, `b08f459` and `db771ec`) may straddle both layouts. Confirm during execution where peek-state lives and whether it belongs in the router, the single panel, or both.

## Phase 7 — UX Fixes

**Intent:** Close the remaining UX findings: focus affordance on the map, keyboard-nav announcements, `Home` binding, panel focus management, banner polish.

**Map keyboard affordance:**

- MapLibre's built-in `KeyboardHandler` already handles arrows (pan), `+`/`-` (zoom), `Shift+Arrows` (rotate/pitch). Keep enabled.
- Add a **visible focus ring** to the map container (`tabIndex={0}` element) via CSS — `:focus-visible` outline using the existing focus-ring token.
- Bind `Home` on the map container to reset-to-world-view (same behavior as `ResetViewControl`). Implemented via a `keydown` listener on the container; does not fight MapLibre's handlers.
- **ARIA live-region announcements** when keyboard actions fire: "Zoomed in / out" (debounced ~500ms), "Reset view", "Deselected." Reuses the existing live region in `App.tsx`.

**Panel focus management:**

- When a country is selected and the panel opens: move focus to the panel's close button (or the panel container if close is not appropriate).
- When the panel closes via Esc or close button: restore focus to `document.activeElement` captured at open-time, falling back to the search input. Use `useRef` + `useLayoutEffect` to capture before the DOM mutates.
- Compare mode: focus moves to the B-column header when compare opens; returns to A on compare-clear.

**Enhanced `BasemapBanner`:**

- Rewrite the message to be specific: "Basemap tiles are slow or unavailable. Country interaction still works."
- Add an explicit **Retry** button that re-runs `probeBasemap` and, on success, hides the banner. On failure, re-shows with a timestamp.
- Add an explicit **Dismiss** button; dismissal persists for the session via `sessionStorage`.

**New e2e coverage:**

- `e2e/keyboard-map-nav.spec.ts` — focus the map, press `Home`, verify camera position snaps to `DEFAULT_CENTER` + `DEFAULT_ZOOM`. Press arrows, verify `center` changes. Press `+`, verify `zoom` increases.
- `e2e/panel-focus.spec.ts` — open panel via search, verify focus moves into panel. Close via Esc, verify focus returns to search.
- `e2e/basemap-banner.spec.ts` — extend existing reliability spec with a Retry-button interaction (using the fault-injection path already present).

**Verification:**

- Axe-core audit passes on every page state (home, single panel, compare panel, banner visible).
- New e2e specs pass on both `chromium` and `chromium-gpu` projects as appropriate.
- Manual keyboard-only walkthrough: tab to map → Home → arrows → +/- → tab to search → type → Enter → panel → Esc. No keyboard trap.

**Risks:**

- MapLibre's `KeyboardHandler` may preventDefault on keys we want to observe. Validate before wiring Home; if there's a conflict, use `capture: true` on the listener or map through `map.on('move', ...)` to detect the reset.
- Live-region announcements firing on every keystroke are noisy. Debounce aggressively (500ms+) and only announce terminal states.

## Cross-Phase Quality Gates

Before closing each phase:

1. `npm run lint` — zero warnings.
2. `npm run type-check` (or `tsc -b`) — zero errors.
3. `npm run test:unit` — all green.
4. `npm run test:e2e` — all green.
5. `npm run build` — succeeds with no new warnings above the existing MapLibre chunk-size-warning.
6. Manual smoke: home loads, search works, select a country, open compare, toggle theme, toggle satellite.

## Rollback Strategy

Each phase is a clean commit cluster on a single branch (or merge to main as a cohesive set). If a phase surfaces a regression after merge, it can be reverted as a single commit range without touching prior phases. Phase 5 carries the highest rollback risk — the refactor may land as multiple sub-commits on one branch, with a tagged rollback point at the phase boundary.

## Open Items

- `OWNER_TBD` in `docs/ops/runbook.md` — filled in at execution time or left as an explicit action-item call-out.
- GH Pages deploy workflow adjustment (Phase 4) — exact env-var wiring depends on the existing workflow file's shape; design confirmed during execution.

## Appendix: Findings → Phases Traceability

| Finding | Phase |
|---|---|
| Voting feature undesigned / vaporware | 1 |
| No CONTRIBUTING.md | 2 |
| No SECURITY.md | 2 |
| No ops runbook (bandwidth, data freshness, basemap) | 2 |
| No ADR convention | 2 |
| Planning discipline norms not written down | 3 |
| No hook unit tests | 4 |
| E2E runs against dev server not production bundle | 4 |
| `WorldMap.tsx` 786 LOC god component | 5 |
| `CountryPanel.tsx` 490 LOC mixed concerns | 6 |
| No visible focus ring on map canvas | 7 |
| No ARIA announcements for keyboard actions | 7 |
| No panel focus management on open/close | 7 |
| `BasemapBanner` message is generic, no retry | 7 |
