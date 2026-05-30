# Remove the Daily — High Scores as the Retention Hub Design

**Date:** 2026-05-30
**Status:** Draft — pending user review
**Depends on / supersedes:** Retention v1 (`2026-04-21-retention-program-v1-design.md`) and the daily follow-ups (`2026-05-18-daily-already-played-ux-design.md`, `2026-05-19-daily-city-feedback-design.md`, `2026-05-20-daily-flow-polish-design.md`, `2026-05-29-daily-content-data-branch-design.md`). This spec removes the daily-puzzle feature those specs built.

---

## Problem

The daily puzzle is a single `(country, city)` pair shown to every visitor on the same calendar day, played best-of-3 in either game mode. It was the retention layer of Retention v1.

For **city guessing** the daily makes no sense: a best-of-3, one-pin-per-day format does not fit a 10-round pinpoint game, and the daily UI (streak, history calendar, reveal, share) reads as ceremony around a mechanic that does not reward it. The owner's call is to drop the daily entirely — for **both** modes — and let the games themselves, ranked by **personal-best high scores**, bring players back. Personal bests already persist client-side (`src/game/shared/personalBestsStore.ts`, key `funworldmap-game-<mode>-bests-v2`: `bestScore`, `bestStreak`, `gamesPlayed`); they are not yet the centre of the experience.

The daily is also expensive surface area: an entire `src/game/daily/` module, seven launcher sub-components, a best-of-N reducer capability, a scheduled GitHub Actions content pipeline writing to an orphan `data` branch, a family of `#daily/...` hash routes, seven telemetry events, and ~24 test files.

## Goal

Remove the daily puzzle / daily country / daily city feature from the codebase entirely. Keep the launcher as the **play hub**, reframed around per-mode high scores. Leave free play, country exploration, search, and personal-best persistence fully working.

**Primary success criteria.**

- No code path reads, writes, fetches, or routes to anything daily. `grep -ri daily src/ scripts/ .github/` returns only incidental matches (none functional).
- The launcher opens from the header **Play** button (map-first cold load preserved) and presents the two modes, each showing its personal best, with a single **Play** action that starts unlimited play.
- Free play in both modes works end-to-end: country-pinning (endless, 3 lives, best score + longest streak) and city-guessing (10 rounds, best score). Personal bests record and display unchanged.
- `npm run build`, `npm run test`, and `npm run test:e2e` are green with daily tests removed and free-play tests retained/added. No new `test.fixme` quarantines.
- A returning visitor with leftover daily `localStorage` keys has them cleaned up once on load; no console errors from missing `/daily/index.json`.

**Explicit non-goals (future phases).**

- User accounts / server-side persistence of scores.
- A multiplayer or global leaderboard / dedicated score page.
- Surfacing high scores outside the launcher (e.g. a header high-score badge).
- Rewriting historical dated specs/plans/notes under `docs/superpowers/` — those stay as the record of what was built. Only docs describing _current_ behaviour are updated.

---

## Confirmed decisions

1. **Reducer cleanup: full removal.** The best-of-N machinery (`attemptsPerRound > 1`, the `resume` action, per-attempt resume persistence) existed only for the daily. Remove it entirely, test-first against the existing free-play reducer tests, rather than pinning `attemptsPerRound` to 1 and leaving dead branches.
2. **Storage cleanup: add one-time removal.** Idempotently `removeItem` the two inert daily keys (`funworldmap-daily-history`, `funworldmap-daily-resume`) on startup, mirroring the v1 self-clean already in `personalBestsStore.ts`.

---

## Design

### 1. The launcher becomes a free-play high-score hub

Keep `Launcher.tsx`'s shell: the modal, backdrop, focus trap (`installFocusTrap`), `data-animation-state` idle signalling, close/backdrop/escape dismissal, and the **map-first** visibility model (the launcher is shown only on explicit `show()` from the header Play button; cold load lands on the map — `useLauncherVisibility.ts:38-44`).

Strip every daily concern from it:

- Remove imports/usage of `useDailyPuzzlesContext`, `useDailyHistory`, `getToday/getYesterday`, `deriveStreakMode`, `byDate`, `cardState`, `playedFor`, `anchorDate`, the `daily_opened` effect, `startDaily`, `seeReveal`, `openHistory`, `onCellActivate`, `onMilestoneDismiss`.
- Remove `LauncherStreakPill`, `LauncherCountdown`, `LauncherHistoryPanel`, `LauncherMilestoneOverlay` from the tree.
- Subtitle drops "Daily · date" / "Today's puzzle · date"; becomes a static host line (e.g. "Pick a mode and beat your best").

`LauncherModeCard` is **rewritten** into a lean free-play card driven by `usePersonalBests(modeId)`:

- Shows mode title + description and the personal best: `bestScore` for both modes, plus `bestStreak` for country-pinning (its `maxRounds === null` endless format), and `gamesPlayed`. A fresh player (all zeros) shows an inviting "No games yet — play your first" state instead of "Best: 0".
- One primary **Play** button → `startFree(modeId)` (writes `lastMode`, dismisses, sets `#game/<mode>`). The existing per-mode "Play free" and the bottom "Play unlimited rounds" link collapse into this single CTA.

The launcher continues to receive `countries`/`cities` only if the rewritten card still needs them; if the card needs only personal-bests, those props are dropped.

### 2. Header

The "Play today" CTA (done/partial/unplayed dot + 🔥 streak chip, `Header.tsx:65-133`) becomes a plain **Play** button that calls `onOpenLauncher`. Remove props `ctaState`, `streakCurrent`, `streakActive`, and `onOpenLauncherHistory`, and the `header-streak-chip` button. `App.tsx` stops computing `streakActive`/`ctaState` and the `today/yesterday`/`useDailyHistory` derivation that feeds them.

### 3. Game session / reducer (full best-of-N removal)

In `useGameSession.ts` + `GameSessionProvider.tsx`:

- Remove `dailyDate` from `GameSession` and from `start`/`resume`/`restart` signatures.
- Remove the `resume` action entirely (daily-only rehydration of an in-progress best-of-N round).
- Remove best-of-N state: `attemptsPerRound`, `currentAttempts`, `attemptsRemaining`, and the round-end "best of all attempts" derivation; a round ends on its single attempt. Country-pinning keeps its 3-lives/endless model; city-guessing keeps 10 rounds. Verify (during planning) that nothing outside the daily reads these fields.
- Simplify `finishFree` (drop the `if (session.dailyDate !== null) return state` guard). Keep `finalize`, `advance`, `completeNow`, `endGame`, `start`, `restart`, `overrideRound`.

This is the highest-risk edit, so it is done **test-first**: keep the existing free-play reducer tests green, delete only the `resume`/best-of-N cases, add coverage where the single-attempt path changes.

### 4. Routing

- `hashState.ts`: remove the `{ kind: 'daily'; ... }` variant and all `daily/` parsing + writing. Keep `empty`, `country`, `game`.
- `useHashGameRouter.ts`: delete `startOrResumeDaily`, `DAILY_ATTEMPTS_PER_ROUND`, resume read, `classifyDate`/`buildCountryDailyRound`/`buildCityDailyRound`, the today-only / already-played-redirect logic, and the `deep_link_opened` analytics. Keep the `#game/<mode>` free-play bootstrap.
- `useLauncherVisibility.ts`: remove `isDailyRoot` and `anchorDate`; `visible` becomes `intent.kind === 'open' && session.status === 'idle'`.
- `GameController.tsx` (`writeIdleHash`): stop matching `#daily`; match `#game` only.

### 5. Telemetry

In `analytics.ts` remove the daily-coupled events: `daily_opened`, `daily_started`, `daily_attempted`, `daily_completed`, `daily_shared`, `daily_done_low_score_prompt`, `streak_reached_milestone`, `history_opened`, `history_cell_clicked`, `deep_link_opened`, and the `CtaState` type. Reduce `header_cta_clicked` to a prop-less event (drop its `state` payload; keep the event name so the open-rate signal survives). Keep `free_started` and `launcher_dismissed` (trim its now-impossible `path` values). Delete the daily Cloudflare query files `cloudflare-worker/queries/daily_funnel.sql`, `daily_opened_rate.sql`, `daily_shared_by_method.sql`. The Worker itself accepts forward-compatible event shapes and needs no change; daily events simply stop arriving.

### 6. Build, content pipeline, deploy

- Delete `.github/workflows/daily-puzzle.yml` (the 4×/day generator that commits the index to the orphan `data` branch).
- Delete `scripts/daily-content/` (pools, picker, generator, validator, tests).
- `package.json`: remove `predev`, `daily:generate`, `daily:validate`; drop "daily" from the description.
- `playwright.config.ts` `webServer`: drop any daily-index generation step.
- `deploy.yml`: remove the `data`-branch checkout and the copy of `index.json` into `public/daily/`. No `/daily/index.json` is served. (The orphan `data` branch can be left in place; deleting it is an optional ops cleanup noted in the runbook.)

### 7. One-time storage cleanup

Add a tiny idempotent module (e.g. `src/lib/legacyStorageCleanup.ts`) that, on app init, `removeItem`s `funworldmap-daily-history` and `funworldmap-daily-resume` inside try/catch (private-mode safe), and call it once from app bootstrap. Mirrors the existing v1 self-clean in `personalBestsStore.ts`.

### 8. Documentation

- Delete `docs/systems/daily-puzzle.md` and `docs/adr/0004-daily-content-data-branch.md`.
- Update `docs/systems/overview.md` (the "Game system" section: drop the daily layer, best-of-N, resume), `docs/purpose.md`, `README.md`, `docs/roadmap.md`, and `docs/ops/runbook.md` (remove the "Daily content (`data` branch)" section).
- Update `CLAUDE.md`: remove the daily-puzzle doc-table row and the `stubDailyIndex`/`seedDailyHistory` helper references in the e2e section; adjust any daily-specific examples.

### 9. Tests

- **Delete** the 11 daily e2e specs (`e2e/daily-*.spec.ts`, `mobile-daily-flow.spec.ts`) and the daily helpers in `e2e/helpers.ts` (`seedDailyHistory`, `stubDailyIndex`, `seedPlayedDaily`; remove `installShareStub` only if it becomes unused once `DailyShareBlock` is gone).
- **Delete** all `src/game/daily/__tests__/*` and the launcher/daily component+hook tests (`LauncherModeCard` test is rewritten for the free-play card; `DailyRevealOverlay`, `DailyShareBlock`, `LauncherStreakPill`, `LauncherCountdown`, `LauncherHistoryPanel`, `LauncherCalendarCell`, `LauncherMilestoneOverlay`, `useDailyResumePersistence` tests deleted).
- **Edit** partially-daily tests: `useGameSession.test.ts` (drop `resume`/best-of-N cases), `useGameAnnouncements.test.tsx` (drop daily recording), `cold-load-deep-link.spec.ts` (drop the `dailyDate` assertion), `useHashGameRouter.test.tsx` (drop daily bootstrap, keep free routes).
- **Add**: a launcher free-play hub test (renders both modes, shows personal best, Play starts `#game/<mode>`) and a startup-cleanup unit test.

---

## Removal inventory (at a glance)

**Deleted outright:** `src/game/daily/**` (+ tests) · `DailyRevealOverlay.tsx` · `DailyShareBlock.tsx` · `LauncherStreakPill.tsx` · `LauncherCountdown.tsx` · `LauncherHistoryPanel.tsx` · `LauncherCalendarCell.tsx` · `LauncherMilestoneOverlay.tsx` · `useDailyResumePersistence.ts` · `useNextDailyCountdown.ts` (+ all their tests) · `.github/workflows/daily-puzzle.yml` · `scripts/daily-content/**` · `cloudflare-worker/queries/daily_*.sql` · `docs/systems/daily-puzzle.md` · `docs/adr/0004-daily-content-data-branch.md`.

**Rewritten:** `LauncherModeCard.tsx` (free-play high-score card) and its test.

**Surgically edited:** `App.tsx` · `GameController.tsx` · `useGameSession.ts` · `GameSessionProvider.tsx` · `useHashGameRouter.ts` · `useGameAnnouncements.ts` · `useLauncherVisibility.ts` · `Launcher.tsx` · `Header.tsx` · `GameOverOverlay.tsx` (drop the daily "Today's results"/share branch) · `hashState.ts` · `analytics.ts` · `package.json` · `deploy.yml` · `playwright.config.ts` · the docs in §8 · `CLAUDE.md`.

**Added:** `src/lib/legacyStorageCleanup.ts` (+ test).

---

## Risks & mitigations

- **Free-play scoring regression from the reducer surgery.** Highest risk. Mitigation: TDD — make the reducer changes against existing free-play tests, deleting only daily cases; verify country (3 lives, endless) and city (10 rounds) game-over scores and personal-best recording by hand and in e2e before merge.
- **Dangling imports / broken build after deletions.** Mitigation: delete leaf modules first, let `tsc`/Vite surface every reference, then resolve top-down; a final `grep -ri daily` sweep gates completion.
- **e2e flake from launcher changes.** Mitigation: reuse `waitForAnimationIdle` on the launcher's `data-animation-state`; follow the CLAUDE.md e2e rules (no `waitForTimeout`, no `force:true`); run locally with `--workers=2`.
- **`GameOverOverlay` still importing daily share/history.** Mitigation: it is in the surgical list; the daily branch and `DailyShareBlock`/`useDailyHistory` imports are removed, leaving the free-play score/PB layout.

## Verification

`npm run build` · `npm run test` · `npm run test:e2e` all green; manual smoke of both modes' full play→game-over→play-again loop and the header Play → launcher → start flow; `grep -ri daily src/ scripts/ .github/ docs/systems docs/adr` clean of functional references.
