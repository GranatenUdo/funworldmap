# UX Smoothening — Launcher, First-Load Posture, Copy Pass Design

**Date:** 2026-05-17
**Status:** Draft — pending user review
**Depends on:** Retention v1 (shipped). Touches the launcher, header, and the launcher-on-bare-hash visibility rule established by `2026-04-21-retention-program-v1-design.md` and finalised by `2026-04-22-retention-v1-finishing-design.md`.

---

## Problem

funworldmap presents a game picker before establishing that it is also a map. The picker uses internal vocabulary (`free`, `pinning`) and the modal re-asserts itself on every visit because `useLauncherVisibility` keys dismissal on component state, not on persisted preference. A free product feels like it has a gate.

Concretely:

- `src/components/LauncherModeCard.tsx:151–166` — `Play free mode →` and `Best (free)`. The site is free; "free" here is doing the work of distinguishing daily-vs-not.
- `src/components/Launcher.tsx:303–304` — subtitle `249 countries. Explore or guess.` and the rest of the launcher's copy reads as functional documentation rather than invitation.
- `src/hooks/useLauncherVisibility.ts:45–48` — the launcher is `visible` whenever the hash is bare or `#daily/…` and not dismissed and the game is idle. `dismissed` is component state; on reload the launcher returns. Returning visitors who already know the product still get a modal in their face.
- `src/components/LauncherModeCard.tsx:107, 164` — score denominators are inconsistent within country-pinning (daily shows `/100`, free best shows just `pts`).

## Goal

Reset the visitor's first moment to "this is a world map" and surface today's puzzle as a peer affordance, not a gate. Rewrite copy so it sounds like a host. Collapse the launcher's five competing zones to two. Keep the diff small enough that every change is independently revertible.

**Primary success criteria.**

- A returning visitor with no streak loads the URL → sees the map, not a modal.
- Today's puzzle is reachable in one click from the header at any time, with at-a-glance status (unplayed / partially played / done).
- No string contains the word "free" in a context that conflates "no paywall" with "non-daily mode."
- Score denominators are consistent within each mode.
- All existing e2e tests either still pass or have a targeted update; no `test.fixme` quarantines added.
- The closing moment of the daily journey (`GameOverOverlay` for daily mode) does not say "Game over."

**Explicit non-goals.** Engagement-loop polish (celebration animations, history hover memories, custom non-emoji streak mark), Globle-style bonus rounds, first-visit one-time intro, code-level mode-ID renaming, region-badge reuse on the map. Each deferred to a follow-up spec.

---

## Principles

1. **Map first.** The homepage is the map. Everything else is a peer affordance.
2. **Words a host would say.** Copy is rewritten from the visitor's perspective. Internal vocabulary stays in code; visible vocabulary changes.
3. **One job per zone.** The launcher tells you about _today_ and how to get to _unlimited_ — nothing else competes.
4. **No new state machines.** Reuse existing hooks (`useLauncherVisibility`, `useDailyHistory`, `useDailyPuzzlesContext`); change their inputs/outputs only where required.

---

## Scope

### In scope (two PRs, sequenced)

**PR1 — Launcher + journey copy (lower-risk, mostly contained):**

- **A. Naming + copy pass** (smallest diff, biggest tone shift).
- **B. Launcher composition** (collapse the five zones to two).
- **D. Score-denominator fix** (folds into B via stats-footer removal).
- **E. Countdown to tomorrow** (inside launcher, both-modes-played state only).
- **G. Daily-mode GameOverOverlay copy** (closes the journey loop the rest of PR1 opens).

**PR2 — First-load posture (invasive, higher-risk):**

- **C. First-load posture** (remove modal-on-bare-hash; add header CTA states).
- **F. e2e test updates** (helper rename, several spec rewrites; couples to C).

Each PR is independently revertible. PR1 makes the launcher better even if PR2 never ships; PR2 depends on PR1's `×` close button and copy pass.

### Out of scope

- Engagement-loop polish (Theme D from the brainstorm review).
- Bonus rounds post-solve.
- First-visit one-time intro modal (deferred until we observe whether map-first is clear on its own).
- Game-mode IDs (`country-pinning`, `city-guessing`) — display strings change only.
- Region-badge reuse on map.
- HUD copy beyond the tutorial title change.

---

## A — Naming + copy pass

All changes are display strings. Internal IDs and codepaths unchanged.

| File                                   | Today                                                          | New                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LauncherModeCard.tsx:151`             | `Play free mode →`                                             | (removed from card — single shared link below both cards: `Play unlimited rounds →`)                                                                                                                                                                                                                                                                                                                                                                    |
| `LauncherModeCard.tsx:160`             | `Best (free)`                                                  | (removed from card — see §D for where the stat goes)                                                                                                                                                                                                                                                                                                                                                                                                    |
| `LauncherModeCard.tsx:29`              | `Country Pinning` (title)                                      | `Country` (title) + subtitle line: `Click the right country on the map`                                                                                                                                                                                                                                                                                                                                                                                 |
| `LauncherModeCard.tsx:30`              | `City Guessing`                                                | `City` + `Pin where the city is`                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `LauncherModeCard.tsx:33–38`           | Eyebrow `TODAY · COUNTRY` / `TODAY · CITY` (and date variants) | Eyebrow removed for "today"; for past-day cards, eyebrow becomes the date alone (`MAY 16`)                                                                                                                                                                                                                                                                                                                                                              |
| `LauncherModeCard.tsx:89`              | `Play · 3 attempts`                                            | `Play` (button) + `3 tries · best one counts` (caption beneath, `text-xs text-sand-600/dark:text-dark-100`)                                                                                                                                                                                                                                                                                                                                             |
| `LauncherStreakPill.tsx:26` ('broken') | `Start your streak — play today's daily.`                      | `Your streak's reset — back in with today's puzzle?`                                                                                                                                                                                                                                                                                                                                                                                                    |
| `LauncherStreakPill.tsx:29` ('first')  | `Play today's daily.`                                          | `You haven't played today yet — start a streak?`                                                                                                                                                                                                                                                                                                                                                                                                        |
| `App.tsx:401`                          | `Explore the world`                                            | `Click a country to explore — or press / to search`                                                                                                                                                                                                                                                                                                                                                                                                     |
| `FirstSessionTutorial.tsx:12, 20`      | `Daily — best of 3`                                            | `Today's puzzle`                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `LauncherModeCard.tsx:131`             | `Couldn't load today's puzzle. Refresh to retry.`              | `Couldn't load today's puzzle.` + visible `[Retry]` button — calls a new `refetch` exported from `DailyPuzzlesProvider`. The "Or try yesterday's →" affordance is **not** added to this state because `latestAvailableDate` is sourced from the index, and the index fetch is what failed. (The yesterday's-link affordance already exists in the `no-puzzle-today` state, where the index loaded but had no entry for today — that case is unchanged.) |

Punctuation, casing, and curly-quote usage stay consistent with current code (all single-quotes are `’`).

---

## B — Launcher composition

```
┌──────────────────────────────────────────┐
│                              [×]         │
│            funworldmap                   │
│         Today's puzzle · May 17          │
│                                          │
│   ┌─────────────┐    ┌─────────────┐    │
│   │  📍 Country │    │  🏙  City    │    │
│   │             │    │             │    │
│   │ Click the   │    │ Pin where   │    │
│   │ right       │    │ the city is │    │
│   │ country     │    │             │    │
│   │             │    │             │    │
│   │  [ Play ]   │    │  [ Play ]   │    │
│   │ 3 tries     │    │ 3 tries     │    │
│   └─────────────┘    └─────────────┘    │
│                                          │
│   🔥 5-day streak  ·  Past 30 days →    │
│                                          │
│   Play unlimited rounds →                │
└──────────────────────────────────────────┘
```

Changes vs current:

- Eyebrow `TODAY · COUNTRY` / `TODAY · CITY` removed (the subtitle "Today's puzzle · May 17" carries the date, and the icon + title carries the mode).
- Per-card secondary link `Play free mode →` removed; replaced by **one shared link** below both cards: `Play unlimited rounds →`. The link routes to `startFree(lastMode)` where `lastMode` is read via `readLastMode()` (existing helper used in `Launcher.tsx:42`), falling back to `country-pinning` if no last-mode is set. This avoids adding a chooser submenu and reuses an existing preference signal.
- `Best (free)` stats footer **removed from the launcher card.** Personal bests for unlimited mode remain accessible from the post-game HUD and from a future stats view. Rationale: the launcher is about _today_; unlimited stats are a separate visit-type signal that competes for attention.
- The bottom `Just explore the map` link is replaced by an **explicit `×` close button** in the top-right corner of the modal (universal close affordance; matches mobile expectations).
- Cards keep their side-by-side desktop / stacked mobile layout. No grid change.
- Played state inside the card: the `[Play]` button becomes `✓ 87/100 · See reveal →` (full-width button). Score format follows §D.

---

## C — First-load posture

### Header

The header's icon-only `▶` play button (`Header.tsx:57–66`) becomes a labeled pill with state.

```
[funworldmap]   [Search countries…]   [🔥 5]  [▶ Play today •]  [🛰]  [☼/☾]
```

| State                         | Pill content   | Dot                                                                                                  |
| ----------------------------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| Unplayed today                | `▶ Play today` | small solid accent-color circle (e.g., `bg-teal w-2 h-2 rounded-full`) to the right of the label     |
| One mode played, one unplayed | `▶ Play today` | same circle, but outline only (`border-2 border-teal bg-transparent`) — signals "started, not done"  |
| Both modes played today       | `✓ Today done` | no dot; pill background drops to muted (`bg-sand-100/60 dark:bg-dark-400/60`), text colour preserved |

Streak chip `🔥 5` appears to the **left** of the play pill when the user has an active streak (`streakMode === 'active'`). Clicking the chip opens the launcher with the history panel pre-expanded — implemented by passing a new `initialHistoryOpen: boolean` prop to `Launcher`, defaulting to `false`. No URL-hash route added (keeps hash semantics unchanged). Clicking the play pill opens the launcher normally (`initialHistoryOpen={false}`).

The streak chip is **omitted** when `streakMode` is `first` or `broken` — only positive reinforcement lives in the header.

Mobile (`<sm` breakpoint): the streak chip and the play pill render as **one combined pill** — `[🔥 5  ▶ Play today]` — with no dual tap targets. The whole pill opens the launcher normally (`initialHistoryOpen={false}`); history remains reachable from the streak pill inside the launcher. Two tap targets on a 320px viewport would crowd; one wider target is honest. Search stays the row's priority on mobile.

### Launcher visibility rule change

`useLauncherVisibility` (`src/hooks/useLauncherVisibility.ts:45–48`) currently returns `visible: true` when:

- hash is bare (`#` / empty) OR matches `#daily/YYYY-MM-DD`
- AND not dismissed
- AND `session.status === 'idle'`

New rule:

- hash is bare → `visible: false` (the map is the homepage)
- hash matches `#daily/YYYY-MM-DD` → `visible: true` (deep-link to a specific day still opens the launcher anchored on that date — supports share links)
- AND `session.status === 'idle'`
- The `dismissed` state remains for "user closed the launcher this session"; it has no persistence requirement because there's no on-load modal to suppress.

The launcher is now opened by:

- Clicking the header play pill → calls `showLauncher()` (existing) and is the dominant entry point.
- A deep link (`#daily/2026-05-17`) → same as today.
- Escape closes the launcher (existing behaviour preserved).
- The `×` button closes the launcher (replaces the bottom "Just explore the map" link).

### Hint toast

`App.tsx:397–402`. Today fires 1.5s after `mapReady` if not selected, not played, not previously shown in this session.

- Copy: `Click a country to explore — or press / to search`
- Trigger conditions unchanged (sessionStorage key `funworldmap-hint-shown` unchanged).
- Dismisses on first interaction (unchanged).

### Removed loading-state coupling

Today, the on-load modal also covers part of the map's pop-in. With the modal gone, the loading-dots splash (`App.tsx:347–360`) is the only pre-ready surface. No change needed — the splash already fades out on `mapReady` and the bundle is small (`countries.json` + `cities.json` statically imported).

### Analytics

Add a new event:

```ts
track('header_cta_clicked', { state: 'unplayed' | 'partial' | 'done' })
```

Fired when the play pill is clicked. Lets you compare the new funnel (`header_cta_clicked → launcher_opened → daily_started`) to the historical (`launcher_auto_opened → daily_started`). Existing `launcher_dismissed` / `daily_opened` / `daily_started` / `free_started` events unchanged.

**Note on `free_started`.** UI vocabulary changes from "free" to "unlimited" per §A, but the existing `free_started` event keeps its name — renaming it would be a backwards-incompatible analytics schema change (existing `cloudflare-worker/queries/*.sql` and saved dashboards reference the old name). UI and analytics intentionally diverge here. Add an `// alias: unlimited` comment near the event definition in `analytics.ts`.

---

## D — Score denominators

`LauncherModeCard.tsx:107` (played state inside daily card) — unchanged at `87/100` for country-pinning, `760/1000` for city-guessing.

`LauncherModeCard.tsx:164` (free-best footer) — **deleted** in §B; the inconsistent line goes with it.

Future-facing: when an "unlimited stats" view exists, denominators stay consistent within mode. Country = `/100`, city = `/1000`. The same rule applies to any future surface that shows scores side-by-side (e.g., game-over overlay totals).

---

## E — Countdown to tomorrow

When both modes are played for today, the launcher renders an additional small line under the cards:

```
   ✓ All played today  ·  Next puzzle in 4h 23m
```

Behaviour:

- Updates every 60s via `setInterval`; cleared on unmount.
- "Tomorrow" = next local midnight (matches `dates.ts` rollover semantics).
- Only renders when `cardState(modeId)` returns `'played'` for **both** modes (`country-pinning` AND `city-guessing`).
- Not shown in the header — keeps the header simple and avoids a permanent ticking element.

New component: `src/components/LauncherCountdown.tsx`. Pure render + a small `useNextDailyCountdown` hook. Tested at unit level (clock-mocked).

---

## G — Daily-mode GameOverOverlay copy

The end-of-daily moment currently renders `GameOverOverlay` with:

- Title: `Game over` (`GameOverOverlay.tsx:70`)
- Subtitle: `describeGameEnd(session)` → for daily best-of-3 (`maxRounds === 1`) this returns `1 round complete.` (`GameOverOverlay.tsx:14–19`)

"Game over" is correct framing for unlimited-mode three-strike-out; it's harsh framing for a daily player who's just finished their three attempts. The reveal that follows is celebratory; the gate before it should not undercut it.

Change for daily-mode only (gate on `session.dailyDate !== null`, which is already computed at `GameOverOverlay.tsx:29`):

| Field                                                         | Today               | New (daily only; unlimited unchanged)                        |
| ------------------------------------------------------------- | ------------------- | ------------------------------------------------------------ |
| Title (`GameOverOverlay.tsx:70`)                              | `Game over`         | `Today's results`                                            |
| Subtitle (`GameOverOverlay.tsx:72` calling `describeGameEnd`) | `1 round complete.` | empty string (rendered branch elides the paragraph if empty) |

Unlimited mode keeps `Game over` + the existing `describeGameEnd` output verbatim. `describeGameEnd` is not changed; the daily-mode branch routes around it.

Out of scope (and explicitly noted): rest of the HUD copy, the `FirstSessionTutorial` for non-daily modes, the in-game attempt indicators. Only the closing moment for daily-mode is touched.

---

## F — e2e test updates

The launcher-on-bare-hash assumption is baked into helpers and tests.

| Surface                                                                     | Today                                                                              | New                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/helpers.ts` `dismissLauncher(page)`                                    | Clicks the bottom "Just explore the map" link to clear the modal                   | **Rename to `ensureLauncherDismissed(page)`**. Implementation: check whether `[data-testid="launcher"]` is currently attached; if yes, click the new `[data-testid="launcher-close"]` (the new `×` button); if no, return immediately. Works in both old and new worlds without silently skipping work tests intended. Add a new `openLauncher(page)` helper that clicks `[data-testid="header-play"]` for tests that need the launcher _open_. |
| Any test that does `await page.goto('/')` then expects the launcher visible | Most tests dismiss the launcher anyway; only daily-specific tests assume it's open | Audit and adjust: dailies that need the launcher must click `[data-testid="header-play"]` (or navigate to `#daily/YYYY-MM-DD`) first.                                                                                                                                                                                                                                                                                                           |
| `e2e/launcher.spec.ts`                                                      | Tests the modal-on-load and dismissal paths                                        | Rewrite to assert: (a) bare `/` shows no modal; (b) clicking header CTA opens it; (c) deep link still opens it; (d) `×` button closes it.                                                                                                                                                                                                                                                                                                       |
| `e2e/header.spec.ts` (if exists; otherwise new)                             | n/a                                                                                | Cover header CTA state pills (unplayed / partial / done) using `__funworldmap_daily.markPlayed(...)` test seam (need to add this seam if it doesn't exist).                                                                                                                                                                                                                                                                                     |

No `test.fixme` quarantines are acceptable as part of this slice (per `CLAUDE.md`). If a test cannot be updated cleanly, that is a signal to revisit the design.

---

## Risks

1. **Funnel impact.** Removing the on-load modal will lower `daily_started` per visit unless the header CTA picks up the slack. Mitigation: ship the `header_cta_clicked` event, watch the 7-day delta, be prepared to revert §C alone (it's the most invasive section).
2. **Header crowding on small mobile.** The play pill + streak chip + satellite + theme is four controls. On `<sm` breakpoints, search occupies the row; controls collapse beneath. Verify the collapse layout reads cleanly before merge.
3. **`useLauncherVisibility` semantic change** could affect deep-link routing. The `#daily/YYYY-MM-DD` case is explicitly preserved, but tests must cover it (already in `e2e/daily-*.spec.ts`).
4. **Retry of failed daily fetch** depends on `DailyPuzzlesProvider` exposing a `refetch` function. Today it doesn't (per the brainstorm review). Adding it is a small additional surface that must be tested independently.

---

## Implementation order (for the plan)

**PR1 commits** (in this order; each commit independently revertible within the PR):

1. Foundations (no UX change): add `refetch` to `DailyPuzzlesProvider`; add `useNextDailyCountdown` hook; declare `header_cta_clicked` in `EventSchema` (event not yet wired); add `initialHistoryOpen` prop to `Launcher` (default `false`, no callers yet).
2. Naming + copy pass (§A). Mostly string changes plus the `[Retry]` button wired to step-1's `refetch`.
3. Launcher composition (§B). New `[×]` close button (`data-testid="launcher-close"`), single shared unlimited link routed via `readLastMode()`, drop the stats footer, drop the eyebrow, restructure played-state CTA.
4. Score denominator change (§D) — folds into commit 3 via stats-footer removal.
5. Countdown component (§E).
6. Daily-mode GameOverOverlay copy (§G).
7. Manual smoke on PR1 surface: launcher visible via existing modal-on-bare-hash, copy reads right, countdown ticks, daily end-screen says "Today's results", `[×]` and Esc both close, retry button works under network throttle.

**PR2 commits** (after PR1 merges; sequenced internally):

8. Header CTA refactor (§C — header). New `[Play today •]` pill replacing the icon button, three-state visuals, mobile-collapse layout, streak chip (or combined-pill on mobile). Wire `header_cta_clicked` event.
9. `useLauncherVisibility` semantic change (§C — visibility). Bare hash returns `visible: false`; `#daily/YYYY-MM-DD` still returns `visible: true`.
10. e2e helper rename and audit (§F). `dismissLauncher` → `ensureLauncherDismissed`; add `openLauncher`; sweep call sites; rewrite `e2e/launcher.spec.ts` for the new posture.
11. Manual smoke on PR2 surface: bare `/` shows map only, header CTA opens launcher with correct state pill, streak chip click opens history-expanded launcher, deep link `#daily/2026-05-17` still opens launcher, share-link land path unchanged.

§C is the most invasive change and is isolated to PR2 so its funnel impact can be measured cleanly against PR1's baseline.

---

## Testing notes

- Unit tests for `useNextDailyCountdown` (mocked clock) and the new header pill state computation.
- Component tests for `LauncherModeCard` re-cover the new played/unplayed/error/no-puzzle states with new copy.
- e2e per §F.
- a11y: confirm the new header pill keeps `aria-label` (state-dependent — `Play today, 1 unplayed`, `Today's puzzle complete`, etc.). The streak chip is decorative with `aria-hidden`; its accessible function is duplicated by the launcher's history panel.

---

## What this is not

This spec does not redesign the game mechanics, the reveal overlay, the share text, or the in-game HUD beyond the tutorial title. It does not introduce a new visual identity beyond keeping `🔥` for streaks (a custom mark is deferred). It does not change the daily-puzzle content pipeline.
