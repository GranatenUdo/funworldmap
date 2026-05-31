# Remove the Daily — High Scores as the Retention Hub Design

**Date:** 2026-05-30
**Status:** Draft — revised after code audit; pending user review
**Depends on / supersedes:** Retention v1 (`2026-04-21-retention-program-v1-design.md`) and the daily follow-ups (`2026-05-18-daily-already-played-ux-design.md`, `2026-05-19-daily-city-feedback-design.md`, `2026-05-20-daily-flow-polish-design.md`, `2026-05-29-daily-content-data-branch-design.md`). This spec removes the daily-puzzle feature those specs built.

---

## Problem

The daily puzzle is a single `(country, city)` pair shown to every visitor on the same calendar day, played best-of-3 in either game mode. It was the retention layer of Retention v1.

For **city guessing** the daily makes no sense: a best-of-3, one-pin-per-day format does not fit a 10-round pinpoint game, and the daily UI (streak, history calendar, reveal, share) reads as ceremony around a mechanic that does not reward it. The owner's call is to drop the daily entirely — for **both** modes — and let the games themselves, ranked by **personal-best high scores**, bring players back. Personal bests already persist client-side (`src/game/shared/personalBestsStore.ts`, key `funworldmap-game-<mode>-bests-v2`: `bestScore`, `bestStreak`, `gamesPlayed`); they are not yet the centre of the experience. User accounts + a multiplayer score page are a later phase.

The daily is large, verified surface area: the `src/game/daily/` module (12 source files + 13 test files), seven launcher sub-components, a **best-of-N reducer capability** that leaks into the HUD and three hooks, a scheduled GitHub Actions content pipeline writing to an orphan `data` branch, a family of `#daily/...` hash routes, ~12 telemetry events, five Cloudflare query files, and ~24 e2e specs.

## Goal

Remove the daily puzzle / daily country / daily city feature from the codebase entirely. Keep the launcher as the **play hub**, reframed around per-mode high scores. Leave free play, country exploration, search, and personal-best persistence fully working.

**Primary success criteria.**

- No code path reads, writes, fetches, or routes to anything daily. A final `grep -riE "daily|streak|milestone|best-of|attemptsPerRound" src/ scripts/ .github/ cloudflare-worker/` returns only incidental matches (none functional).
- The launcher opens from the header **Play** button (map-first cold load preserved — the launcher never auto-opens) and presents the two modes, each showing its personal best, with a single **Play** action that starts unlimited play.
- Free play in both modes works end-to-end: country-pinning (endless, 3 lives, best score + longest streak) and city-guessing (10 rounds, best score). Personal bests record and display unchanged.
- `npm run build`, `npm run test:unit`, and `npm run test:e2e` are green with daily tests removed and free-play tests retained/added. No new `test.fixme` quarantines.
- A returning visitor with leftover daily `localStorage` keys has them cleaned up once on load; no console errors from a missing `/daily/index.json`.

**Explicit non-goals (future phases).**

- User accounts / server-side persistence of scores.
- A multiplayer or global leaderboard / dedicated score page.
- Surfacing high scores outside the launcher (e.g. a header high-score badge). _Flagged observation:_ because cold load is map-first, the high-score hub sits behind a Play click; making scores more prominent is deferred unless the owner wants it now.
- Rewriting historical dated specs/plans/notes under `docs/superpowers/` — those stay as the record of what was built. Only docs describing _current_ behaviour are updated.

---

## Confirmed decisions

1. **Reducer cleanup: full removal**, executed as **Phase B** below (test-first).
2. **Storage cleanup: add one-time removal** of the two inert daily keys.
3. **Phasing (new, from the code audit).** Split into two independently-shippable phases. After Phase A the app is daily-free and best-of-N code is dead-but-inert (`attemptsPerRound` is never > 1, so the Done button and `AttemptsIndicator` never render). Phase B is then a pure dead-code deletion behind its own test gate.

---

## Phase A — Remove the daily feature

### A1. Launcher → free-play high-score hub

Keep `Launcher.tsx`'s shell: modal, backdrop, focus trap (`installFocusTrap`), `data-animation-state` idle signalling, close/backdrop/escape dismissal, and the **map-first** visibility model (shown only on explicit `show()` from the header Play button; `useLauncherVisibility.ts:58-60`).

Strip every daily concern: remove use of `useDailyPuzzlesContext`, `useDailyHistory`, `getToday/getYesterday`, `deriveStreakMode`, `byDate`, `cardState`, `playedFor`, `anchorDate`, the `daily_opened` effect, `startDaily`, `seeReveal`, `openHistory`, `onCellActivate`, `onMilestoneDismiss`; drop `LauncherStreakPill`, `LauncherCountdown`, `LauncherHistoryPanel`, `LauncherMilestoneOverlay` from the tree; subtitle becomes a static host line.

Rewrite `LauncherModeCard` into a lean free-play card driven by `usePersonalBests(modeId)`: shows title + description and the personal best (`bestScore` both modes; plus `bestStreak` for country-pinning's endless format; `gamesPlayed`), with a fresh-player "No games yet — play your first" state instead of "Best: 0", and one **Play** button → `startFree(modeId)` (`writeLastMode`, dismiss, `#game/<mode>`). The per-mode "Play free" and bottom "Play unlimited rounds" link collapse into this CTA. The rewritten card needs neither `countries` nor `cities`, so those props drop from `Launcher` and its call site in `App.tsx`.

### A2. Header

The "Play today" CTA (done/partial/unplayed dot + 🔥 streak chip, `Header.tsx:65-133`) becomes a plain **Play** button that calls `onOpenLauncher`. Remove props `ctaState`, `streakCurrent`, `streakActive`, `onOpenLauncherHistory`, and the `header-streak-chip` button. `App.tsx` stops computing `streakActive`/`ctaState` and the `today/yesterday`/`useDailyHistory` derivation feeding them (`App.tsx:152-165`), and drops `openLauncherHistory`.

### A3. Daily module, components, providers

Delete `src/game/daily/**` (12 source + 13 test files, incl. `sentry.ts`). Delete components `DailyRevealOverlay`, `DailyShareBlock`, `LauncherStreakPill`, `LauncherCountdown`, `LauncherHistoryPanel`, `LauncherCalendarCell`, `LauncherMilestoneOverlay` (+ tests). Delete hooks `useDailyResumePersistence`, `useNextDailyCountdown` (+ tests). `App.tsx` drops `<DailyPuzzlesProvider>` and the reveal-state effect (`App.tsx:116-132, 466-487`). `GameController.tsx` drops the `DailyRevealOverlay` game-over branch (`:155-166`), `useDailyPuzzlesContext`, `useDailyHistory`, `clearResume`, `useDailyResumePersistence`, and the `recordDailyResult` arg passed to `useGameAnnouncements`. `GameOverOverlay.tsx` drops the daily "Today's results"/`DailyShareBlock`/`useDailyHistory` branch, leaving the free-play score/PB layout; its dead `maxRounds === 1` copy branch goes too.

### A4. Routing

- `hashState.ts`: remove the `{ kind: 'daily' }` variant and all `daily/` parse + write. Keep `empty`, `country`, `game`.
- `useHashGameRouter.ts`: delete `startOrResumeDaily`, `DAILY_ATTEMPTS_PER_ROUND`, the resume read, `classifyDate`/`buildCountryDailyRound`/`buildCityDailyRound`, the daily branch in `check()`, the daily branch in the drain effect, and the **entire `daily_attempted` telemetry effect** (`:257-290`). Simplify `wasGameOver`/`isPlayableRoute` to game-only and drop the `resume` option from `UseHashGameRouterOptions`. Keep the `#game/<mode>` bootstrap, the deferred-pool drain, and the bug-#32 atomic `restart`.
- `useLauncherVisibility.ts`: remove `isDailyRoot` and `anchorDate`; `visible` becomes `intent.kind === 'open' && session.status === 'idle'`.
- `GameController.tsx` `writeIdleHash`: match `#game` only (drop `#daily`).

### A5. Telemetry

In `analytics.ts` remove `daily_opened`, `daily_started`, `daily_attempted`, `daily_completed`, `daily_shared`, `history_opened`, `history_cell_clicked`, `streak_reached_milestone`, `deep_link_opened`, and the `CtaState` type. Reduce `header_cta_clicked` to a prop-less event (drop the `state` payload; keep the name so the open-rate signal survives). Keep `free_started` and `launcher_dismissed` (trim `launcher_dismissed.path` to the values still reachable). Remove the now-orphaned call sites in `Launcher.tsx`, `useHashGameRouter.ts`, `useGameAnnouncements.ts`, and `Header.tsx`. **`daily_done_low_score_prompt` is deferred to Phase B** — its only call site is in `HudShell`, which Phase B rewrites; removing the event type now would break the build mid-phase. Delete the five Cloudflare query files (`daily_funnel.sql`, `daily_opened_rate.sql`, `daily_shared_by_method.sql`, `history_opened_rate.sql`, `streak_milestone_distribution.sql`) and update `cloudflare-worker/queries/README.md`. The Worker accepts forward-compatible events and needs no code change.

### A6. Build, content pipeline, deploy

- Delete `.github/workflows/daily-puzzle.yml` and `scripts/daily-content/**` (pools, picker, generator, validator, tests).
- `package.json`: remove `predev`, `daily:generate`, `daily:validate`; drop "daily geography puzzles" from `description` and `daily-puzzle` from `keywords`.
- `playwright.config.ts`: change `webServer.command` to drop `npm run daily:generate &&`; remove the deleted/renamed specs from `testMatch` and from the CI `testIgnore` list.
- `deploy.yml`: remove the `data`-branch checkout and the copy of `index.json` into `public/daily/`. No `/daily/index.json` is served. (The orphan `data` branch is left in the remote; deleting it is an optional ops step noted in the runbook.)

### A7. One-time storage cleanup

Add `src/lib/legacyStorageCleanup.ts` that, on app init (called once from `App` / `main`), idempotently `removeItem`s `funworldmap-daily-history` and `funworldmap-daily-resume` inside try/catch (private-mode safe). Mirrors the v1 self-clean already in `personalBestsStore.ts`. Add a unit test.

### A8. Documentation

- Delete `docs/systems/daily-puzzle.md` and `docs/adr/0004-daily-content-data-branch.md`.
- Update `docs/systems/overview.md` (Game system section: drop daily layer, best-of-N, resume), `docs/systems/testing.md`, `docs/purpose.md`, `README.md`, `docs/roadmap.md`, `docs/ops/runbook.md` (remove the "Daily content (`data` branch)" section; add the optional `data`-branch deletion note), and `docs/testing/game-happy-paths.md` if it references daily.
- Update `CLAUDE.md`: remove the daily-puzzle doc-table row; correct the **stale** "`/` now shows the launcher by default" note (it is map-first); remove the `stubDailyIndex`/`seedDailyHistory` helper references in the e2e section.

### A9. Tests (Phase A)

- **Delete** the daily/launcher-daily/share/deep-link specs: `daily-puzzle`, `daily-best-of-3`, `daily-city-feedback`, `daily-deep-link`, `daily-reveal`, `daily-reveal-on-final-attempt`, `daily-share`, `daily-share-block-immediate`, `daily-streak`, `daily-survives-ocean-click`, `mobile-daily-flow`, `share-branches`, `telemetry-deep-link`, `header-cta`, `launcher-history`. (best-of-N specs `done-confirm-low-score` handled in Phase B.)
- **Rewrite** for the free-play hub: `launcher.spec.ts`, `launcher-focus-order.spec.ts`, `launcher-card-loading-states.spec.ts` (now a free-play DOM smoke — keep a spec of this name or repoint the mobile-webkit/firefox `testMatch`), `launcher-backdrop-dismiss.spec.ts`, `header-play-reopens-launcher.spec.ts`.
- **Edit**: `cold-load-deep-link.spec.ts` (drop the `dailyDate` assertion), `game-country-pinning`/`game-city-guessing` (drop any `dailyDate` assertions), and `e2e/helpers.ts` (remove `seedDailyHistory`, `stubDailyIndex`, `seedPlayedDaily`; remove `installShareStub` if it becomes unused).
- **Keep**: `mobile-free-play.spec.ts`, the reveal-animation specs (country-pinning, not daily), and all non-game DOM/a11y specs.
- Unit: delete all `src/game/daily/__tests__/*` and the deleted components'/hooks' tests; edit `useGameAnnouncements.test.tsx` (drop daily-recording cases) and `useHashGameRouter.test.tsx` (drop daily bootstrap, keep `#game`).

After Phase A: `grep -ri "daily" src` is functionally clean except the inert best-of-N plumbing; the app builds, plays, and all retained tests pass.

---

## Phase B — Delete the dead best-of-N machinery (test-first)

With the daily gone, `attemptsPerRound` is always 1 and `resume` is never dispatched. Remove the dead capability:

- `useGameSession.ts`: drop `dailyDate`, the `resume` action + `resume()` API, `completeNow` action + `completeNow()` API, `attemptsPerRound`/`attemptsRemaining`/`currentAttempts` from `GameSession` and `EMPTY`, the `attemptsPerRound>1` config guards, and the exported `deriveBest`. Collapse `attempt` to record one attempt → `endOfRound`; simplify `endOfRound` to a single result (no `deriveBest`, `attemptsRemaining: 0`). Trim `start`/`restart` signatures to `(modeId, firstRound, maxRounds)`.
- `GameSessionProvider.tsx`: drop `resume`/`completeNow` from the API and the `dailyDate`/`attemptsPerRound` params.
- `HudShell.tsx`: remove `bestOfN`, the Done button + low-score confirm + `handleDoneClick` + `LOW_SCORE_THRESHOLD` + the `daily_done_low_score_prompt` call site (and its event type from `analytics.ts`), `runningBest`/`scorePending`/`deriveBest`, the `confirmAsked`/`promptShownThisRound` state and reset effect, and the `onDone` prop. Indicator becomes `fixedRounds ? RoundCounter : LivesIndicator`; score is `session.score`.
- Delete `AttemptsIndicator.tsx` (+ test).
- `GameController.tsx`: drop `completeNow` and `onDone={completeNow}`; change the tutorial signal `firstAttemptMade` to `session.lastOutcome !== null` (no `currentAttempts`).
- `App.tsx`: simplify `roundEndTarget` (`:167-182`) — drop the `attemptsPerRound === 1 || attemptsRemaining === 0` check (always true).
- `useGameAnnouncements.ts`: drop the `isFinalOutcome` derivation (always true), the dead country `!isFinalOutcome` branch, `recordDailyCompletion`, `clearResume`, `recordDailyResult`, and `currentAttempts` from deps; game-over recording becomes just `record(session.score, session.bestStreak)`.
- Audit the `__funworldmap_game` test seams (`useGameTestSeams.ts` + wherever `finalize`/`completeNow` seams are registered): remove any `completeNow`/`resume` seam; **keep `finalize`** (used by free play).
- Tests: delete `done-confirm-low-score.spec.ts`; update `useGameSession.test.ts` (remove `resume`/best-of-N/`completeNow` cases, keep+extend single-attempt free-play cases), `HudShell` test, `useGameAnnouncements.test.tsx`.

Verification gate for Phase B: the free-play reducer + announcement tests are green, and a manual country/city play→game-over→play-again loop scores and records PB correctly.

---

## Removal inventory (verified)

**Deleted outright:** `src/game/daily/**` (12 + 13 tests) · `DailyRevealOverlay` · `DailyShareBlock` · `LauncherStreakPill` · `LauncherCountdown` · `LauncherHistoryPanel` · `LauncherCalendarCell` · `LauncherMilestoneOverlay` · `useDailyResumePersistence` · `useNextDailyCountdown` · `AttemptsIndicator` (all + tests) · `.github/workflows/daily-puzzle.yml` · `scripts/daily-content/**` · `cloudflare-worker/queries/daily_funnel.sql` + `daily_opened_rate.sql` + `daily_shared_by_method.sql` + `history_opened_rate.sql` + `streak_milestone_distribution.sql` · `docs/systems/daily-puzzle.md` · `docs/adr/0004-daily-content-data-branch.md` · ~15 daily e2e specs.

**Rewritten:** `LauncherModeCard.tsx` (free-play high-score card) · `HudShell.tsx` (no best-of-N) · 5 launcher/header e2e specs.

**Surgically edited:** `App.tsx` · `GameController.tsx` · `useGameSession.ts` · `GameSessionProvider.tsx` · `useHashGameRouter.ts` · `useGameAnnouncements.ts` · `useGameTestSeams.ts` (seam audit) · `useLauncherVisibility.ts` · `Launcher.tsx` · `Header.tsx` · `GameOverOverlay.tsx` · `hashState.ts` · `analytics.ts` · `package.json` · `playwright.config.ts` · `deploy.yml` · `cloudflare-worker/queries/README.md` · docs in A8 · `CLAUDE.md`.

**Added:** `src/lib/legacyStorageCleanup.ts` (+ test).

---

## Risks & mitigations

- **Free-play scoring regression from Phase B reducer surgery** — highest risk. Mitigation: phasing isolates it behind Phase A (already shippable); TDD against existing free-play reducer/announcement tests; manual smoke of both modes' full loop before merge.
- **Dangling imports after deletions** — delete leaf modules first, let `tsc`/Vite surface every reference, resolve top-down; final `grep` sweep gates completion.
- **`playwright.config.ts` drift** — the config's `testMatch`/`testIgnore`/`webServer` are edited in the same change as the spec deletions; a green `test:e2e` run is the gate.
- **mobile-webkit/firefox lose `launcher-card-loading-states`** — either keep a free-play spec of that name or repoint those projects' `testMatch` to another DOM smoke.
- **e2e flake from launcher rewrite** — reuse `waitForAnimationIdle` on the launcher `data-animation-state`; obey the CLAUDE.md e2e rules (no `waitForTimeout`, no `force:true`); run locally with `--workers=2`.

## Verification

Per phase: `npm run build` · `npm run test:unit` · `npm run test:e2e` green; manual smoke of both modes' full play→game-over→play-again loop and header Play → launcher → start; `grep -riE "daily|streak|milestone|attemptsPerRound|best-of" src/ scripts/ .github/ cloudflare-worker/` clean of functional references.
