# Daily Puzzle — System Overview

Date: 2026-04-22 (Phase 5b launch-prep)

This doc is the single place that explains the retention-v1 daily-puzzle
feature end-to-end: what it is, how the pieces fit, and how to operate it.

## Lifecycle

A single daily puzzle is a (country, city) pair that every visitor sees on
the same calendar day.

1. **Content generation.** A GitHub Actions workflow
   (`.github/workflows/daily-puzzle.yml`) runs four times a day to regenerate
   the daily index from the curated pools in `scripts/daily-content/` and
   commits it to the orphan **`data` branch** — not `main`, so `main`'s history
   stays free of bot commits. The picker is deterministic: seeded by date and
   falls through to a salted retry on collisions with the last 30 days.
   `deploy.yml` fetches the index from the `data` branch at build time and
   serves it as `/daily/index.json`. Locally and in e2e the index is generated
   on demand (`predev` / the Playwright `webServer`), never committed to `main`.
2. **Client fetch.** On load, `useDailyPuzzles` (`src/game/daily/`) fetches
   `/daily/index.json` once and exposes `byDate(YYYY-MM-DD)`.
3. **Play.** The user opens the launcher (`Launcher.tsx`), picks a mode, and
   plays three attempts. Each attempt is scored 0–100; best-of-3 is the
   daily score. Session state lives in `GameSessionProvider` via `useReducer`.
4. **Storage.** `useDailyHistory` (`src/game/daily/`) persists per-date
   results + streak state to `localStorage` under the key
   `funworldmap-daily-history`. The shape is typed as `DailyHistoryV1` in
   `src/game/daily/types.ts`. Client prunes entries older than 90 days.
5. **Streak.** Same hook derives `streak: { current, longest, lastActiveDate,
lastMilestoneShown }`. `updateStreak` logic lives in `storage.ts`.
6. **Reveal.** `#daily/YYYY-MM-DD/reveal` (both modes) and
   `#daily/YYYY-MM-DD/<mode>/reveal` routes mount `DailyRevealOverlay`. Daily-city game-over also renders `DailyRevealOverlay` directly (the single-attempt-feedback flow needs the reveal's city-name + dot summary, not a numeric `GameOverOverlay`); daily-country game-over continues to render `GameOverOverlay` with the share block.
7. **Share.** `DailyShareBlock` mounts in both `GameOverOverlay` (post-game)
   and `DailyRevealOverlay` (reveal view). Uses `navigator.share` with a
   clipboard fallback. Fires the `daily_shared` analytics event.

**Round-end pause.** Daily and free games transition `playing → round-ended → game-over` via a `finalize` reducer action. The intermediate `round-ended` status is the window in which the existing reveal-animation effects fire (border highlight, dashed-arc geodesic, country-panel slide). The controller schedules `finalize` after the reveal animation completes (≥ 3 s for country, ≥ 2 s for city); a key press (Enter / Esc / Space) skips the hold. E2E specs use `__funworldmap_game.finalize()` to bypass the wall-clock wait.

## Storage shape

See `src/game/daily/types.ts`. Top-level:

- `version: 1` — migration gate. Unknown versions reset to empty.
- `streak: StreakState` — current / longest / lastActiveDate /
  lastMilestoneShown.
- `days: Record<YYYY-MM-DD, Partial<Record<ModeId, DailyDayResult>>>` —
  per-mode result.

`DailyDayResult.attempts[]` has length 1, 2, or 3 — depending on whether the
player pressed Done early or used all attempts. Each attempt records
`pointsEarned`, `distanceKm`, and optionally `guessCca3` / `guessLngLat`.

### State sharing

Daily history and personal-best state live in module-level stores
(`src/game/daily/historyStore.ts`, `src/game/shared/personalBestsStore.ts`)
exposed to React via `useSyncExternalStore`. A single write is visible to
every consumer (`<GameOverOverlay>`, `<DailyShareBlock>`, `<Launcher>`,
etc.) on the same render. The `useDailyHistory()` and `usePersonalBests()`
hooks have not changed shape — only their backing storage.

The session itself carries the daily date as `session.dailyDate: string |
null`, set at `start()` / `resume()` time. Game-over recording, the
per-attempt resume write, and `GameOverOverlay` read this field instead
of re-parsing `window.location.hash`. The hash is the routing input;
session state is the source of truth for "is this a daily, and if so,
for what date?". See `docs/superpowers/specs/2026-04-27-game-flow-cascade-fixes-design.md`.

### Resume key

`localStorage` key `funworldmap-daily-resume` (v1) holds in-progress best-of-N
attempts so a refresh restores the same round.

Shape:

```ts
{ version: 1, date: 'YYYY-MM-DD', modeId: ModeId, attempts: AttemptRecord[] }
```

Lifecycle:

- _Write:_ on every `attempt` action while `status === 'playing'` and
  `attemptsPerRound > 1`.
- _Read:_ on hash bootstrap when route is `daily/<date>/<mode>` and the
  history has no entry for that day.
- _Clear:_ after `writeHistory` returns successfully on completion; on
  `endGame` dispatch (Escape, End-game button); on stale-date mismatch.

## Routing matrix

All hash-based, fully static:

| URL                                | Behaviour                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                | Launcher on bare root.                                                                                                                                  |
| `/#daily/YYYY-MM-DD`               | Launcher anchored to that date (header copy: "Daily · …").                                                                                              |
| `/#daily/YYYY-MM-DD/<mode>`        | Today + unplayed → start daily; today + in-progress resume blob → resume; past or already-played → redirect to `.../reveal`; future → redirect to root. |
| `/#daily/YYYY-MM-DD/reveal`        | Both-mode reveal (text-only — no game).                                                                                                                 |
| `/#daily/YYYY-MM-DD/<mode>/reveal` | Single-mode reveal.                                                                                                                                     |
| `/#<cca3>`                         | Country panel deep link (pre-retention-v1 behaviour).                                                                                                   |
| `/#game/<mode>`                    | Free-play game (pre-retention-v1 behaviour).                                                                                                            |

`useLauncherVisibility.ts` regex `/^daily\/\d{4}-\d{2}-\d{2}$/` is the one
point of truth for the no-mode daily-anchor pattern.

## Telemetry events

All events go to `funworldmap.com/api/event` → Cloudflare Worker →
Analytics Engine dataset `funworldmap_events`.

| Event                      | Props used                                                                                | Notes                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `daily_opened`             | `mode: ModeId`, `dateAge: number`                                                         | Fires once per session per mode when the launcher shows a daily card.                                                     |
| `daily_started`            | `mode`                                                                                    | Fires when the user clicks a daily CTA.                                                                                   |
| `daily_attempted`          | `mode`, `attemptIndex: 1\|2\|3`, `scoreBucket: 0-100`                                     | Per-attempt.                                                                                                              |
| `daily_completed`          | `mode`, `bestScoreBucket`, `attemptsUsed`                                                 | Fires at game-over.                                                                                                       |
| `daily_shared`             | `method: 'share-api'\|'clipboard-text'\|'clipboard-link'`                                 | `modesPlayed` is present in the app-level event but is NOT captured by the Worker's fixed blob slots — v1.1 roadmap item. |
| `free_started`             | `mode`                                                                                    |                                                                                                                           |
| `history_opened`           | —                                                                                         |                                                                                                                           |
| `history_cell_clicked`     | `cellKind: 'played'\|'unplayed-in-window'\|'rolled-off'`                                  |                                                                                                                           |
| `streak_reached_milestone` | `days: 3\|7\|14\|30\|100`                                                                 | Fires at most once per milestone per user (dedupe via `lastMilestoneShown`).                                              |
| `launcher_dismissed`       | `path: 'link'\|'card'\|'escape'`                                                          |                                                                                                                           |
| `deep_link_opened`         | `dateKind: 'today'\|'past'\|'future'`, `outcome: 'start'\|'resume'\|'reveal'\|'redirect'` |                                                                                                                           |

Worker blob/double slot mapping: see
[`cloudflare-worker/queries/README.md`](../../cloudflare-worker/queries/README.md).

## Known limitations

- **Timezone lag.** Daily rolls over at 00:00 UTC. East-of-UTC users up to
  +14 h may see "yesterday" slightly past their local midnight. Accepted
  for v1; per-TZ rollover is a v1.1 roadmap item.
- **No backend game state.** Scores never leave the user's browser except
  as anonymous aggregate telemetry. No leaderboard, no multiplayer.
- **`modesPlayed` not captured on `daily_shared`.** See telemetry table
  above. v1.1 item.
- **Worker deploys manually.** `wrangler deploy` is run by hand; no CI
  job. v1.1 item.

## Operational notes

### Rollback

The retention-v1 surfaces are purely client-side; GitHub Pages serves the
built bundle.

1. **Code revert.** `git revert <merge-commit>` on `main`. The
   `deploy.yml` Action republishes GH Pages automatically.
2. **Worker.** Roll back the Worker separately via `cd cloudflare-worker &&
wrangler deployments list && wrangler rollback <deployment-id>` if the
   rollback target predates the current Worker. Usually not necessary —
   the Worker accepts forward-compatible event shapes.
3. **Daily index.** The index lives on the `data` branch and is regenerated
   every 6 h by `daily-puzzle.yml`. To pause daily content delivery, disable
   that workflow. To serve a specific frozen index, commit it to the `data`
   branch and disable regeneration; `deploy.yml` picks it up on the next
   deploy. See `docs/ops/runbook.md` § "Daily content (`data` branch)" for the
   bootstrap and fallback.

### User-state inspection

The client persists everything to `localStorage`. To inspect a support
case, ask the user to share the JSON value of
`localStorage.getItem('funworldmap-daily-history')` from devtools. The
shape is documented in `src/game/daily/types.ts`.

### Analytics queries

Saved Analytics Engine queries live in `cloudflare-worker/queries/`. See
the README there for how to import them into a CF dashboard panel.

## Launch checklist (human)

Run through this list after the Phase 5b code PR merges and before posting
the launch announcement.

- [ ] Code is on `main` and deployed to GH Pages (check
      `funworldmap.com` shows the current revision).
- [ ] **Baseline window satisfied.** Phase 1 shipped 2026-04-21; at least
      14 days of `funworldmap_events` have accumulated (verify via any
      query in `cloudflare-worker/queries/` — rows from 2026-04-21 onward).
- [ ] **CF dashboards built.** Import each `.sql` from
      `cloudflare-worker/queries/` into a panel on a new CF dashboard
      titled "funworldmap retention v1". Verify each query returns data.
- [ ] **Sentry error-rate alert.** In Sentry → Alerts, create a rule that
      fires if the error rate on the `funworldmap` project exceeds 2×
      baseline for ≥ 15 min.
- [ ] **CF 72 h monitor.** In Cloudflare → Rules → Page Rules or
      Alerts, set an alert for `daily_started` events < 0.25× the baseline
      rate for ≥ 6 h (catches complete event-flow breakage).
- [ ] **NVDA smoke pass (Windows).** Run through the golden path with NVDA
      on:
  1. Cold-load `/` → launcher reads correctly + focus order.
  2. Tab through mode cards → each card + CTA + free-link are announced.
  3. Complete a daily in country-pinning → game-over overlay + share
     block announced.
  4. Navigate to `#daily/<today>/reveal` → reveal overlay + share block
     announced.
  5. Trigger milestone (e.g. play day 3) → milestone overlay announced
     before auto-dismiss.
     If any announcement is missing or misleading, file under Retention
     v1.1+ → Accessibility in `docs/roadmap.md` with the specific issue.
- [ ] **Launch announcement posted.** Out of engineering scope.
- [ ] **72 h monitor opened.** Timer starts at the launch-announcement
      timestamp. Check CF + Sentry dashboards + alerts at T+24 h, +48 h,
      +72 h. Document any anomaly in a follow-up issue.
- [ ] **v1 retrospective scheduled.** 2–4 weeks post-launch; use the
      accumulated analytics to plan v1.1.
