# Repo cleanup and fixes — design

Date: 2026-06-11
Status: Accepted

## Context

A full-repo critical review (all living docs, all of `src/`, `scripts/`, `cloudflare-worker/`, the e2e suite, and the complete `docs/superpowers/` corpus, 2026-06-11) found:

- The **code** is in good shape; defects are small and enumerable (a satellite-mode
  paint-restore gap on compare exit, clickable unmatched border chips in compare
  columns, one conflicting Tailwind class pair, a handful of dead modules left by
  the news/daily removals).
- The **test suite** has eradicated the historical flake patterns, but its CI story
  is undocumented: the CI matrix runs the `chromium` project only and `testIgnore`
  excludes 10 more specs, so **13 of 38 spec files never run on CI** — including
  `game-country-pinning` and both axe audits. One e2e test asserts nothing
  (`webgl-context-loss` retry), one uses the literally-forbidden `.first()`
  pattern (`panel-focus`), and a config `testMatch` entry points at a deleted file.
- The **living docs** contradict the code in ~15 places (reset-view behavior,
  search highlighting, zoom table, focus management, data-collection fallback,
  bundle numbers, flag sourcing) and `docs/testing/playwright-matrix.md` still
  presents ten deleted daily specs as live.
- The **plans/specs corpus** has no lifecycle: 36 shipped plans sit un-archived,
  ~11 of them describing deleted features with no supersession markers; CLAUDE.md
  inherited the corpus's GPU-on-CI confusion.

## Decisions (user-confirmed 2026-06-11)

1. **CI coverage — honesty pass only.** Document the local-only specs, reference a
   tracking issue from `testIgnore`, delete the dangling `testMatch` entry. No CI
   behavior changes; re-enabling specs stays a roadmap item.
2. **Corpus — archive sweep + tombstones.** Move all 36 shipped plans to
   `plans/archive/`; add one-line tombstone headers to deleted-feature plans/specs;
   align the superpowers README's archive policy with practice. No content rewrites.
3. **Search highlighting — remove dead plumbing.** Drop `includeMatches`/`matches`
   from `useCountrySearch` and correct `search.md`. Highlighting may return later
   as a real feature (roadmap).
4. **Panel focus — keep two-stage, fix docs.** Heading focus (announce) then close
   button (park) is kept as-is; `accessibility.md` is corrected to describe it.

## Goals

- Fix the verified small production bugs, with tests.
- Delete dead code left behind by the news/daily removals.
- Make CLAUDE.md, `testing.md`, and `playwright.config.ts` tell the truth about CI.
- Reconcile every identified living-doc/code contradiction.
- Restore the documented plan lifecycle (archive sweep + tombstones).
- (Optional, droppable) extend lint/typecheck gates to `e2e/` and `scripts/`.

## Non-goals / out of scope (added to roadmap instead)

- Re-enabling the CI-skipped specs (needs the GPU-runner roadmap item).
- Shared unit-test utilities (CountryData factory ×5, matchMedia stub ×6 dedup).
- `waitForMapLoaded(page)` helper + `routeMapTiles` parameterisation
  (absorbs `label-contrast`'s 70-line interceptor copy).
- Implementing search match highlighting.
- Routing `useGameAnnouncements` strings through `messages.ts` (i18n prep).
- Unit-test gaps: `useSatelliteMode`, `useMapTheme`, `GameSessionProvider` guards,
  reducer `endGame`/`overrideRound`.
- Rewriting historical notes/plans content (tombstones and correction banners only).

## Phases (each an independently shippable PR)

| Phase | Content                                                                                                                       | Size |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1     | Production bug fixes + unit tests (fill-opacity restore, border chips, overlay classes)                                       | S    |
| 2     | Dead-code sweep (relativeTime, REVEAL_FAR, keyframes, GameMode.title/description, Fuse matches, .gitignore)                   | M    |
| 3     | Test hygiene (corrupt-v2 test, GameOverOverlay tests, dead e2e test, stale headers, webgl retry assertions, `.first()` fixes) | M    |
| 4     | CI/config honesty (config cleanup, tracking issue, CLAUDE.md, testing.md, ci.yml comments)                                    | S    |
| 5     | Living-docs reconciliation (~14 files; playwright-matrix.md rewritten)                                                        | M    |
| 6     | Superpowers corpus sweep (archive 36 plans, ~19 tombstones, README policy, note corrections, roadmap updates)                 | M    |
| 7     | (Optional) typecheck + lint gates for `e2e/` and `scripts/`                                                                   | S–M  |

## Verification

- Phases 1–3: `npm run check` green; targeted Playwright specs green locally
  (`--project=chromium`, repeat-each for changed specs). Kill any background
  `npm run dev` first (reuseExistingServer would serve a non-hooks build).
- Phases 4–6: `npm run check` (docs don't break builds); link spot-check on
  edited docs; `npx playwright test --list` confirms config still parses.
- Phase 7: `tsc -b` and `npm run lint` green including the new surfaces.

## Risks

- **Phase 2 type ripple:** removing `GameMode.title/description` may touch test
  fixtures; the plan greps before deleting.
- **Phase 3 webgl retry assertion:** the strengthened test asserts actual recovery;
  if `restoreContext()` proves unreliable on CI SwiftShader, quarantine per
  CLAUDE.md rules rather than weakening the assertion.
- **Phase 7 unknown fallout:** enabling gates may surface latent errors; the phase
  is explicitly droppable (stop and file an issue if >20 errors surface).
