# Review follow-ups — design

Date: 2026-06-12
Status: Accepted

## Context

The 2026-06 cleanup (PRs #103–#110, #112) closed with two tracked work queues:
issue **#111** (seven verified cleanup-grade findings from the max-effort code
review, each with a fix shape) and the roadmap section **"Deferred from the
2026-06 cleanup"**. This spec covers implementing the unconditioned subset.

## Decisions (user-confirmed 2026-06-12)

1. **Scope — unconditioned work only.** In scope: #111 items 1–6, shared
   unit-test utilities, unit-test gaps, the pre-load `'style'`-latch fix,
   `eslint-plugin-playwright`, and the `waitForMapLoaded`/`routeMapTiles`
   helper consolidation. Out of scope (their deferral conditions still hold):
   search match highlighting (needs a UI design), `messages.ts` announcement
   routing (needs i18n work to start), the preamble-prefix helper (#111 item 7;
   needs a fourth duplication site).
2. **Style latch — clear on load.** MapLibre's `load` event proves the style
   loaded; a latched `'style'` error is cleared there. `timeout`, `webgl-lost`,
   and `country-data` are unaffected; post-load tile hiccups keep routing to
   `BasemapBanner`.
3. **Reconciler — one baseline-paint hook.** A new `useCountryBaselinePaint`
   becomes the single owner of country-fill opacity and country-borders paint
   across `{satellite, inCompareView, resolvedTheme}`. `useSatelliteMode` and
   the compare hook drop those writes, eliminating the documented
   "must run AFTER" call-order dependency for this paint class.
   `useCompareViewDimming` narrows to compare highlight colours + hover
   suppression and is renamed `useCompareViewHighlight`.

## Goals

- #111 items 1–6 fixed: paint ownership (1), the phantom confirm-dialog doc
  branch (2), `MODE_IDS` compile-time exhaustiveness (3), the 3-of-4 axe header
  (4), shared `BorderChip` (5), un-exported opacity constants (6).
- Roadmap items shipped: shared test utilities (CountryData factory ×5,
  matchMedia stub ×6, fake-map wrapper ×2 deduped), unit-test gaps
  (`useSatelliteMode`, `useMapTheme`, `GameSessionProvider` guards + seam,
  reducer `endGame`/`overrideRound`), style-latch fix with unit + e2e
  regression tests, `eslint-plugin-playwright` on the e2e lint block,
  `waitForMapLoaded(page)` + parameterised `routeMapTiles` (absorbing
  `label-contrast`'s ~70-line interceptor copy).
- Close-out: #111 closed with PR links; shipped roadmap entries struck.

## Non-goals

- The three condition-gated items above.
- Folding the bestsKeyMigration test triplication (not in the queues).
- Type-checked ESLint for e2e (latency choice stands; the plugin's syntactic
  rules cover the high-value gap).

## Phases (each an independently shippable PR)

| Phase | Content | Size |
| --- | --- | --- |
| 1 | Trivial doc/comment fixes (#111 items 2, 4) | XS |
| 2 | `useCountryBaselinePaint` reconciler (#111 item 1) + rename, matrix unit tests | M |
| 3 | Style-latch clear-on-load + unit test + e2e regression assertion | S |
| 4 | `MODE_IDS` guard, `BorderChip` extraction, un-export constants (#111 items 3, 5, 6) | S |
| 5 | Shared test utilities in `src/test/` + 13-site migration | M |
| 6 | Unit-test gaps (4 new/extended test files) | M |
| 7 | e2e helper consolidation (`waitForMapLoaded`, `routeMapTiles(opts)`) | S |
| 8 | `eslint-plugin-playwright` (abort criterion: >20 non-trivial errors → exclude + report) | S |
| 9 | Close-out: roadmap strikes, close #111, archive this plan on landing | XS |

Ordering constraints: Phase 2 before 4 (constants) and before 6 (the
`useSatelliteMode` tests target its post-reconciler surface); Phase 5 before 6
(gap tests consume the shared utilities). Others independent.

## Verification

- Per phase: `npm run check` green; targeted vitest files; targeted Playwright
  specs for phases 2/3/7 (`compare-view-dimming`, `satellite-default`,
  `map-reliability`, `label-contrast`, plus every spec whose local helper is
  replaced in phase 7). Kill any background `npm run dev` first.
- Phase 3's e2e step is TDD at the suite level: the new
  "clean load leaves no [data-map-error]" assertion fails before the fix in
  the stubbed environment and passes after.
- Final: full `--project=chromium` + `--project=mobile-chromium` locally.

## Risks

- **Phase 2 visual fidelity:** the reconciler must reproduce today's paint
  values exactly (entry: fill 0.03/0.05 + borders 0.15 opacity over
  mode-coloured lines; exit/baseline: `fillOpacityForMode` +
  `applyBorderPaintForMode`). The matrix unit tests pin every cell before the
  hooks are rewired.
- **Phase 3 e2e ripple:** clearing `'style'` on load changes the stubbed-run
  steady state (no latched attribute). The webgl spec's assertions are already
  scoped to `webgl-lost` and unaffected; `map-reliability` gains the new
  assertion deliberately.
- **Phase 8 fallout:** `playwright/no-standalone-expect` will flag
  `e2e/helpers.ts`'s exported `expect.poll` helpers — expected; configure the
  rule rather than restructure the helpers. Abort criterion applies.
