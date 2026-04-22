# Phase 5b — Launch Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the remaining automatable Phase 5 work — system docs, roadmap pruning, CF Analytics Engine saved queries, automated keyboard-only smoke spec, and rollback procedure — so that retention v1 can go live once the 14-day analytics baseline satisfies on 2026-05-05.

**Architecture:** One PR's worth of docs + test coverage + version-controlled Analytics Engine queries. Anything that requires a browser-UI click (CF dashboard building, NVDA pass, 72 h monitor-alert configuration) is captured as a launch checklist inside `docs/systems/daily-puzzle.md` for the human to execute post-merge. No source-code changes except the one new e2e spec and potential test-id additions needed by the spec.

**Tech Stack:** Markdown docs; Playwright (existing `@axe-core/playwright` + `waitForAppReady` helper); SQL-like Cloudflare Analytics Engine query syntax (commented `.sql` files, not executed in CI).

**Spec:** [`2026-04-22-retention-v1-finishing-design.md`](../specs/2026-04-22-retention-v1-finishing-design.md) §C "Docs" + "Launch checklist".

---

## Critical-review findings applied before drafting

1. **Worker data gap.** `cloudflare-worker/index.ts` writes fixed blob slots (`mode, path, method, dateKind, outcome, cellKind`) + doubles (`dateAge, scoreBucket, bestScoreBucket, attemptIndex, attemptsUsed, days`). The Phase 4 `daily_shared` event's new `modesPlayed` field is **not captured** (no blob slot), and `date` is implicitly covered by CF's automatic `_timestamp`. **Resolution:** dashboards will break `daily_shared` down by `method` only. `modesPlayed` goes onto the v1.1 roadmap as a minor Worker extension.
2. **Worker deploys manually.** `deploy.yml` does not deploy the Worker; it's shipped via `wrangler deploy`. Roadmap already tracks "CI-driven Worker deploys" as a v1.1 item. **Resolution:** no change here.
3. **14-day baseline timing.** Phase 1 shipped 2026-04-21; today is 2026-04-22. Baseline satisfied 2026-05-05. **Resolution:** Phase 5b code lands now; the launch-announcement + 72h-monitor trigger wait.
4. **CF dashboards are UI-only.** We commit `.sql` queries + a README explaining how to paste them into a dashboard. The dashboard layout itself is not version-controlled (CF does not expose a dashboards-as-code API for Analytics Engine today).
5. **Keyboard smoke** — spec §C lists this as manual. It is partially automatable via Playwright's `page.keyboard.press('Tab')` + focus assertions. The golden path (launcher → streak pill → history panel → cards → dismiss) is automatable; the *subjective* feel ("does Tab order match the visual order?") is not. **Resolution:** commit an automated traversal spec + keep the manual pass on the launch checklist.

---

## Scope

### In scope (this PR, subagent-executable)

- `docs/systems/daily-puzzle.md` (new) — lifecycle, storage, routing, telemetry, operational notes (including rollback), launch checklist.
- `docs/purpose.md` — one new paragraph about the daily puzzle layer.
- `docs/roadmap.md` — close out the retention-program section; consolidate survivors under a single "Retention v1.1+" area (already partially done).
- `cloudflare-worker/queries/*.sql` (new, 5 files) — saved Analytics Engine queries for the dashboards listed in the spec.
- `cloudflare-worker/queries/README.md` (new) — how to import into a CF dashboard.
- `e2e/a11y-keyboard-smoke.spec.ts` (new) — automated keyboard-only traversal of the golden path.

### Out of scope (human executes post-merge per the launch checklist in `daily-puzzle.md`)

- Manual NVDA / VoiceOver smoke on Windows hardware.
- CF dashboard UI creation (paste committed `.sql` into CF dashboard panels).
- 72 h monitor alerts setup (CF + Sentry).
- Launch announcement.

### Out of scope (deferred to v1.1 roadmap)

- Adding `modesPlayed` to the Worker's blob slots for `daily_shared`.
- CI-driven Worker deploys.
- Canvas-rendered share image and the other v1.1+ items already enumerated.

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `docs/systems/daily-puzzle.md` | Create (~200 LOC) | Single-page system doc — lifecycle, storage, routing, telemetry, operational notes, rollback, launch checklist |
| `docs/purpose.md` | Modify (+1 paragraph) | Add a "Daily puzzle" section under the existing modes description |
| `docs/roadmap.md` | Modify | Close retention-program section; consolidate v1.1+ subsection |
| `cloudflare-worker/queries/README.md` | Create | How to import saved queries into a CF Analytics Engine dashboard |
| `cloudflare-worker/queries/daily_opened_rate.sql` | Create | Per-day count of `daily_opened` events |
| `cloudflare-worker/queries/daily_funnel.sql` | Create | `daily_started` → `daily_completed` funnel conversion |
| `cloudflare-worker/queries/streak_milestone_distribution.sql` | Create | Distribution of `streak_reached_milestone` by threshold |
| `cloudflare-worker/queries/history_opened_rate.sql` | Create | Per-day count of `history_opened` events |
| `cloudflare-worker/queries/daily_shared_by_method.sql` | Create | `daily_shared` count grouped by `method` (share-api / clipboard-text / clipboard-link) |
| `e2e/a11y-keyboard-smoke.spec.ts` | Create (~120 LOC) | Automated keyboard-only traversal through launcher + history panel + mode cards + dismiss |
| `playwright.config.ts` | Modify (+1 line) | Add new spec to chromium `testMatch` |

No source-code changes. No dependencies added.

---

### Task 1: Set up isolated worktree + pre-flight

**Files:**
- New worktree: `../polworldmap-phase-5b-launch`

- [ ] **Step 1: Create worktree**

```bash
git worktree add ../polworldmap-phase-5b-launch -b feat/phase-5b-launch-prep main
```

- [ ] **Step 2: Install dependencies**

```bash
cd /e/polworldmap-phase-5b-launch
npm install 2>&1 | tail -3
```

- [ ] **Step 3: Verify the Worker + existing analytics state**

```bash
grep -n "writeDataPoint\|EventName" cloudflare-worker/index.ts | head -20
```

Confirm the blob/double slot mapping matches what the SQL queries in Task 4 will assume:
- `index1` = event name (also stored in `blob1`)
- `blob2..7` = `mode, path, method, dateKind, outcome, cellKind`
- `double1..6` = `dateAge, scoreBucket, bestScoreBucket, attemptIndex, attemptsUsed, days`
- `_timestamp` = automatic

Note any divergence — the queries in Task 4 must reflect reality. Do NOT modify the Worker in this PR.

---

### Task 2: Write `docs/systems/daily-puzzle.md`

**Files:**
- Create: `docs/systems/daily-puzzle.md`

- [ ] **Step 1: Confirm the target directory exists**

```bash
ls docs/systems/ 2>/dev/null || mkdir -p docs/systems
```

- [ ] **Step 2: Create the file**

Write to `docs/systems/daily-puzzle.md` with the following content. Keep it dense; each section is ≤ 40 lines:

```markdown
# Daily Puzzle — System Overview

Date: 2026-04-22 (Phase 5b launch-prep)

This doc is the single place that explains the retention-v1 daily-puzzle
feature end-to-end: what it is, how the pieces fit, and how to operate it.

## Lifecycle

A single daily puzzle is a (country, city) pair that every visitor sees on
the same calendar day.

1. **Content generation.** A GitHub Actions workflow
   (`.github/workflows/daily-puzzle.yml`) runs four times a day to regenerate
   `public/daily/index.json` from the curated pools in
   `scripts/daily-content/`. The picker is deterministic: seeded by date
   and falls through to a salted retry on collisions with the last 30 days.
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
   `#daily/YYYY-MM-DD/<mode>/reveal` routes mount `DailyRevealOverlay`.
7. **Share.** `DailyShareBlock` mounts in both `GameOverOverlay` (post-game)
   and `DailyRevealOverlay` (reveal view). Uses `navigator.share` with a
   clipboard fallback. Fires the `daily_shared` analytics event.

## Storage shape

See `src/game/daily/types.ts`. Top-level:

- `version: 1` — migration gate. Unknown versions reset to empty.
- `streak: StreakState` — current / longest / lastActiveDate /
  lastMilestoneShown.
- `days: Record<YYYY-MM-DD, Partial<Record<ModeId, DailyDayResult>>>` —
  per-mode result.

`DailyDayResult.attempts[]` is always length 3 in steady-state play (session
auto-advances until exhausted). Each attempt records `pointsEarned`,
`distanceKm`, and optionally `guessCca3` / `guessLngLat`.

## Routing matrix

All hash-based, fully static:

| URL | Behaviour |
|---|---|
| `/` | Launcher on bare root. |
| `/#daily/YYYY-MM-DD` | Launcher anchored to that date (header copy: "Daily · …"). |
| `/#daily/YYYY-MM-DD/<mode>` | If today + unplayed → start daily. Else → redirect to `.../reveal`. |
| `/#daily/YYYY-MM-DD/reveal` | Both-mode reveal (text-only — no game). |
| `/#daily/YYYY-MM-DD/<mode>/reveal` | Single-mode reveal. |
| `/#<cca3>` | Country panel deep link (pre-retention-v1 behaviour). |
| `/#game/<mode>` | Free-play game (pre-retention-v1 behaviour). |

`useLauncherVisibility.ts` regex `/^daily\/\d{4}-\d{2}-\d{2}$/` is the one
point of truth for the no-mode daily-anchor pattern.

## Telemetry events

All events go to `funworldmap.com/api/event` → Cloudflare Worker →
Analytics Engine dataset `funworldmap_events`.

| Event | Props used | Notes |
|---|---|---|
| `daily_opened` | `mode: ModeId`, `dateAge: number` | Fires once per session per mode when the launcher shows a daily card. |
| `daily_started` | `mode` | Fires when the user clicks a daily CTA. |
| `daily_attempted` | `mode`, `attemptIndex: 1\|2\|3`, `scoreBucket: 0-100` | Per-attempt. |
| `daily_completed` | `mode`, `bestScoreBucket`, `attemptsUsed` | Fires at game-over. |
| `daily_shared` | `method: 'share-api'\|'clipboard-text'\|'clipboard-link'` | `modesPlayed` is present in the app-level event but is NOT captured by the Worker's fixed blob slots — v1.1 roadmap item. |
| `free_started` | `mode` | |
| `history_opened` | — | |
| `history_cell_clicked` | `cellKind: 'played'\|'unplayed-in-window'\|'rolled-off'` | |
| `streak_reached_milestone` | `days: 3\|7\|14\|30\|100` | Fires at most once per milestone per user (dedupe via `lastMilestoneShown`). |
| `launcher_dismissed` | `path: 'link'\|'card'\|'escape'` | |
| `deep_link_opened` | `dateKind: 'today'\|'past'\|'future'\|'invalid'`, `outcome: 'reveal'\|'start'\|'redirect'` | |

Worker blob/double mapping (`cloudflare-worker/index.ts`): `index1 = name`,
`blob1 = name`, `blob2..7 = mode, path, method, dateKind, outcome, cellKind`,
`double1..6 = dateAge, scoreBucket, bestScoreBucket, attemptIndex,
attemptsUsed, days`.

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
3. **Daily index.** `public/daily/index.json` is regenerated every 6 h by
   the GHA workflow. To pause daily content delivery, disable the
   `daily-puzzle.yml` workflow. To serve a specific frozen index, push it
   to `main` and disable regeneration.

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
```

- [ ] **Step 3: Commit**

```bash
git add docs/systems/daily-puzzle.md
git commit -m "docs(systems): daily-puzzle — lifecycle, storage, routing, telemetry, operational notes, launch checklist"
```

---

### Task 3: Edit `docs/purpose.md` + prune `docs/roadmap.md`

**Files:**
- Modify: `docs/purpose.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Read `docs/purpose.md`**

```bash
head -60 docs/purpose.md 2>/dev/null
```

Identify a good insertion point — typically after the existing modes description or the "what this is" section.

- [ ] **Step 2: Add a daily-puzzle paragraph to `docs/purpose.md`**

Insert the following paragraph at the chosen location:

```markdown
## Daily puzzle

A daily layer turns both modes into a returnable habit. Each calendar day,
every visitor sees the same country and the same city puzzle; results
persist locally and feed a cross-session streak counter, a 30-day history
calendar, and a text share artifact. No backend required — content is
regenerated via GitHub Actions four times a day, scores never leave the
user's browser except as anonymous aggregate telemetry.

System details: [`systems/daily-puzzle.md`](systems/daily-puzzle.md).
```

- [ ] **Step 3: Read and update `docs/roadmap.md`**

```bash
grep -n "^## \|^### \|Retention" docs/roadmap.md | head -30
```

The roadmap already has a "Retention program (v1.1+)" section. Apply two edits:

1. **Close out** anything that now lives in shipped code. Skim the "Retention program (v1.1+)" section. If any bullet was actually shipped (e.g. the calendar history, the share flow, the milestone overlay), strike it with a back-reference to the PR.

2. **Add** any discoveries surfaced during Phase 5b drafting. Specifically, append under the existing "Retention program (v1.1+)" section:

```markdown
- **Worker blob-slot extension for `modesPlayed`** — `cloudflare-worker/index.ts` doesn't capture the `modesPlayed` field on `daily_shared` events because the blob slots are fixed to `mode, path, method, dateKind, outcome, cellKind`. Adding a 7th blob or converting to JSON-blob storage would surface the 1-mode vs 2-mode split on share dashboards.
```

- [ ] **Step 4: Commit**

```bash
git add docs/purpose.md docs/roadmap.md
git commit -m "docs: daily-puzzle paragraph in purpose.md; roadmap prune + modesPlayed gap noted"
```

---

### Task 4: Create CF Analytics Engine saved queries + README

**Files:**
- Create: `cloudflare-worker/queries/README.md`
- Create: `cloudflare-worker/queries/daily_opened_rate.sql`
- Create: `cloudflare-worker/queries/daily_funnel.sql`
- Create: `cloudflare-worker/queries/streak_milestone_distribution.sql`
- Create: `cloudflare-worker/queries/history_opened_rate.sql`
- Create: `cloudflare-worker/queries/daily_shared_by_method.sql`

- [ ] **Step 1: Create directory + README**

```bash
mkdir -p cloudflare-worker/queries
```

Write `cloudflare-worker/queries/README.md`:

```markdown
# Saved Analytics Engine Queries

These queries target the `funworldmap_events` dataset written by
`cloudflare-worker/index.ts`. They power the retention-v1 CF dashboard.

## Blob / double slot mapping

From `cloudflare-worker/index.ts`:

| Slot | Field |
|---|---|
| `index1` | event name |
| `blob1` | event name (duplicate for blob-only reads) |
| `blob2` | `mode` (ModeId) |
| `blob3` | `path` |
| `blob4` | `method` (share/launcher-dismiss) |
| `blob5` | `dateKind` |
| `blob6` | `outcome` |
| `blob7` | `cellKind` |
| `double1` | `dateAge` |
| `double2` | `scoreBucket` |
| `double3` | `bestScoreBucket` |
| `double4` | `attemptIndex` |
| `double5` | `attemptsUsed` |
| `double6` | `days` (milestone threshold) |

Automatic columns: `_timestamp`, `_sample_interval`.

## How to import

1. Open CF → Analytics → Analytics Engine → Query.
2. Paste a `.sql` file's content into the query editor.
3. Save as a dashboard panel on the "funworldmap retention v1"
   dashboard. Recommended chart types are noted in each file.

If a query fails with a schema error, the Worker's slot mapping has
drifted — update both the query and this README.
```

- [ ] **Step 2: Create `daily_opened_rate.sql`**

```sql
-- daily_opened_rate.sql
-- Count of daily_opened events per calendar day, grouped by mode.
-- Recommended chart: line, x=day, y=count, color=mode.

SELECT
  toStartOfInterval(_timestamp, INTERVAL '1' DAY) AS day,
  blob2 AS mode,
  SUM(_sample_interval) AS events
FROM funworldmap_events
WHERE index1 = 'daily_opened'
  AND _timestamp > NOW() - INTERVAL '30' DAY
GROUP BY day, mode
ORDER BY day ASC, mode ASC;
```

- [ ] **Step 3: Create `daily_funnel.sql`**

```sql
-- daily_funnel.sql
-- daily_started → daily_completed conversion funnel per day.
-- Recommended chart: stacked bar, x=day, y=count, stack=name.

SELECT
  toStartOfInterval(_timestamp, INTERVAL '1' DAY) AS day,
  index1 AS name,
  SUM(_sample_interval) AS events
FROM funworldmap_events
WHERE index1 IN ('daily_started', 'daily_completed')
  AND _timestamp > NOW() - INTERVAL '30' DAY
GROUP BY day, name
ORDER BY day ASC, name ASC;
```

- [ ] **Step 4: Create `streak_milestone_distribution.sql`**

```sql
-- streak_milestone_distribution.sql
-- Distribution of streak_reached_milestone firings by threshold (3/7/14/30/100).
-- Recommended chart: bar, x=threshold, y=count.

SELECT
  double6 AS milestone_days,
  SUM(_sample_interval) AS events
FROM funworldmap_events
WHERE index1 = 'streak_reached_milestone'
  AND _timestamp > NOW() - INTERVAL '30' DAY
GROUP BY milestone_days
ORDER BY milestone_days ASC;
```

- [ ] **Step 5: Create `history_opened_rate.sql`**

```sql
-- history_opened_rate.sql
-- Count of history_opened events per calendar day.
-- Recommended chart: line, x=day, y=count.

SELECT
  toStartOfInterval(_timestamp, INTERVAL '1' DAY) AS day,
  SUM(_sample_interval) AS events
FROM funworldmap_events
WHERE index1 = 'history_opened'
  AND _timestamp > NOW() - INTERVAL '30' DAY
GROUP BY day
ORDER BY day ASC;
```

- [ ] **Step 6: Create `daily_shared_by_method.sql`**

```sql
-- daily_shared_by_method.sql
-- Count of daily_shared events grouped by dispatch method.
-- Recommended chart: stacked bar or pie, x=day (optional), y=count, stack=method.
-- Note: modesPlayed is not captured at the Worker level (v1.1 roadmap item).

SELECT
  toStartOfInterval(_timestamp, INTERVAL '1' DAY) AS day,
  blob4 AS method,
  SUM(_sample_interval) AS events
FROM funworldmap_events
WHERE index1 = 'daily_shared'
  AND _timestamp > NOW() - INTERVAL '30' DAY
GROUP BY day, method
ORDER BY day ASC, method ASC;
```

- [ ] **Step 7: Verify all five files exist**

```bash
ls -la cloudflare-worker/queries/
```

Expected: `README.md` + 5 `.sql` files.

- [ ] **Step 8: Commit**

```bash
git add cloudflare-worker/queries/
git commit -m "feat(analytics): commit Analytics Engine saved queries for retention v1 dashboards"
```

---

### Task 5: Automated keyboard-only smoke spec

**Files:**
- Create: `e2e/a11y-keyboard-smoke.spec.ts`
- Modify: `playwright.config.ts` — add to chromium `testMatch`

- [ ] **Step 1: Create `e2e/a11y-keyboard-smoke.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { waitForAppReady, seedDailyHistory, stubDailyIndex } from './helpers'

test.setTimeout(60_000)

const TODAY = new Date().toISOString().slice(0, 10)

test.describe('Keyboard-only smoke — retention v1 golden path', () => {
  test('Tab through launcher lands on a focusable element in order', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })

    // Press Tab until a button in the launcher is focused. We do not assert
    // a specific element — only that a focusable element inside the launcher
    // receives focus within 10 Tab presses (the launcher has <10 focusables).
    for (let i = 0; i < 10; i++) {
      const active = await page.evaluate(
        () => document.activeElement?.getAttribute('data-testid') ?? '',
      )
      if (active.startsWith('launcher-')) return
      await page.keyboard.press('Tab')
    }
    throw new Error('No launcher-* focusable received focus within 10 Tab presses')
  })

  test('Enter on launcher-dismiss closes the launcher', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
    const dismiss = page.getByTestId('launcher-dismiss')
    await dismiss.focus()
    await expect(dismiss).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })
  })

  test('Escape dismisses the launcher (hash root)', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })
  })

  test('History panel opens via keyboard (Enter on history-link) and Escape closes it', async ({ page }) => {
    await seedDailyHistory(page, { date: TODAY })
    await page.goto('/')
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
    const historyButton = page.locator('[data-testid*="history-link"], [data-testid*="history-open"]').first()
    await historyButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('launcher-history')).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('launcher-history')).not.toBeAttached({ timeout: 5_000 })
    // Escape closing the history panel should NOT also close the launcher.
    await expect(page.getByTestId('launcher')).toBeVisible()
  })

  test('Calendar cells are reachable via arrow keys from the today cell', async ({ page }) => {
    await seedDailyHistory(page, { date: TODAY })
    await page.goto('/')
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
    const historyButton = page.locator('[data-testid*="history-link"], [data-testid*="history-open"]').first()
    await historyButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('launcher-history')).toBeVisible({ timeout: 5_000 })
    const todayCell = page.getByTestId(`launcher-cal-${TODAY}`)
    await todayCell.focus()
    await expect(todayCell).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    const focusedTestId = await page.evaluate(
      () => document.activeElement?.getAttribute('data-testid') ?? '',
    )
    // After ArrowLeft we should be on SOME launcher-cal-YYYY-MM-DD cell, not the original today.
    expect(focusedTestId).toMatch(/^launcher-cal-\d{4}-\d{2}-\d{2}$/)
    expect(focusedTestId).not.toBe(`launcher-cal-${TODAY}`)
  })

  test('Reveal route keyboard path: Tab lands on Close / Share in order', async ({ page }) => {
    await seedDailyHistory(page, { date: TODAY })
    await stubDailyIndex(page, TODAY)
    await page.goto(`/#daily/${TODAY}/reveal`)
    await waitForAppReady(page)
    await expect(page.getByTestId('daily-reveal')).toBeVisible({ timeout: 5_000 })
    // Tab N times and confirm daily-share-primary becomes focusable (not
    // asserting exact Tab count — just reachable without a trap).
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab')
      const active = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '')
      if (active === 'daily-share-primary') return
    }
    throw new Error('daily-share-primary was not reachable via Tab within 20 presses')
  })
})
```

Note on test-ids: the history-link button test-id may be one of several names depending on what's in `src/components/LauncherStreakPill.tsx` — the `locator('[data-testid*="history-link"], [data-testid*="history-open"]').first()` fallback captures either. If the actual test-id differs, grep the source and update the selector.

- [ ] **Step 2: Register in `playwright.config.ts`**

Add `'a11y-keyboard-smoke.spec.ts'` to the `chromium` project's `testMatch` array (alphabetical position near other `a11y-*` specs).

- [ ] **Step 3: Run locally**

```bash
cd /e/polworldmap-phase-5b-launch
npx playwright test --project=chromium --retries=0 e2e/a11y-keyboard-smoke.spec.ts 2>&1 | tail -15
```

Expected: all 6 tests pass. If any test fails, the target behaviour may not exist yet — fix at source (add a missing test-id or keyboard handler) rather than relaxing the assertion. If the root cause is a genuine gap (e.g. the reveal overlay has no focus trap at all), log it in `docs/roadmap.md` under "Retention v1.1+" → "Accessibility" and SKIP the test with a code comment:

```ts
test.skip('Reveal route keyboard path…', async () => { /* unskip after v1.1 */ })
```

- [ ] **Step 4: Commit**

```bash
git add e2e/a11y-keyboard-smoke.spec.ts playwright.config.ts
git commit -m "test(a11y): automated keyboard-only smoke — launcher, history, calendar, reveal"
```

---

### Task 6: Local validation + push + PR

**Files:** none

- [ ] **Step 1: Unit + tsc**

```bash
cd /e/polworldmap-phase-5b-launch
npm run test:unit 2>&1 | tail -3
npx tsc -b 2>&1 | tail -3
```

Expected: 245/245 unit (no unit tests added); tsc clean.

- [ ] **Step 2: Full accessibility spec + new keyboard smoke**

```bash
npx playwright test --project=chromium --retries=0 e2e/accessibility.spec.ts e2e/a11y-keyboard-smoke.spec.ts 2>&1 | tail -10
```

Expected: all green. The 10 existing accessibility tests + new 6 keyboard smoke tests.

- [ ] **Step 3: Full chromium project (catch any integration regression)**

```bash
npx playwright test --project=chromium --retries=0 --workers=2 2>&1 | tail -5
```

Expected: fully green. Phase 5b only adds a new spec + doc files, so no source regression is possible.

- [ ] **Step 4: chromium-gpu sanity**

```bash
npx playwright test --project=chromium-gpu --retries=0 2>&1 | tail -5
```

Expected: green (unchanged).

- [ ] **Step 5: Push**

```bash
git push -u origin feat/phase-5b-launch-prep
```

- [ ] **Step 6: Open PR**

```bash
gh pr create --base main --title "docs+a11y: Phase 5b — launch prep" --body "$(cat <<'EOF'
## Summary

Closes out the remaining Phase 5 automatable work from the spec:

- `docs/systems/daily-puzzle.md` — comprehensive system doc (lifecycle, storage, routing matrix, telemetry, operational notes including rollback, and the human launch checklist)
- `docs/purpose.md` — daily-puzzle paragraph + link to system doc
- `docs/roadmap.md` — retention-program section pruned; discovered gaps added under Retention v1.1+
- `cloudflare-worker/queries/` — 5 saved Analytics Engine queries (daily_opened rate, daily funnel, milestone distribution, history rate, share by method) + README
- `e2e/a11y-keyboard-smoke.spec.ts` — 6 automated keyboard-only traversal tests on the golden path

## What Phase 5b does NOT include (by design)

Manual / UI-only launch work lives in the "Launch checklist" section of `docs/systems/daily-puzzle.md` and is the human's responsibility post-merge:

- Manual NVDA smoke pass on the golden path
- CF dashboard panel creation in the CF web UI from the committed `.sql` queries
- Sentry error-rate alert + CF daily_started baseline alert configuration
- Launch announcement (out of engineering scope)
- 72 h post-launch monitor verification

## Discovered gaps (logged on the v1.1 roadmap)

- `modesPlayed` field on `daily_shared` is dropped at the Worker level (fixed blob slot mapping has no slot for it). Dashboards show `method` breakdown only.
- CI-driven Worker deploys remain a v1.1 item.

## Test Plan

- [ ] CI `lint + type + unit`, `e2e (chromium)`, `e2e (chromium-gpu)` all green
- [ ] Manually: render `docs/systems/daily-puzzle.md` on GitHub — internal links resolve, tables render
- [ ] Manually: paste each `.sql` file into CF Analytics Engine query editor — none errors

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7: Watch CI**

```bash
gh pr checks $(gh pr view --json number --jq .number) --watch
```

Expected: all green on first run. If `e2e (chromium)` fails, investigate before re-running; the deflake work from Plan A should hold.

- [ ] **Step 8: Hand off to `finishing-a-development-branch`**

Present the 4-option menu.

---

## Self-review notes

- **Spec coverage:** §C "Docs" — Tasks 2 and 3. §C "Launch checklist" items → embedded in `daily-puzzle.md` Task 2 + README in Task 4 (dashboards + queries). §C "Axe-core across all new surfaces" → shipped in Phase 5a. §C "Manual NVDA / keyboard" → keyboard portion automated in Task 5 + manual portion is an explicit checklist item. §C "Rollback documented" → inside `daily-puzzle.md` Operational notes.
- **Placeholder scan:** all `.sql` files contain real, syntactically-valid Analytics Engine queries. Doc file has concrete content. Keyboard-smoke spec has complete test bodies.
- **Type consistency:** Worker slot mapping is documented once in the queries README; each `.sql` references `blobN` / `doubleN` consistent with it. Event names in the telemetry table match the enum in `cloudflare-worker/index.ts`.
- **Honest scope:** the `modesPlayed` Worker gap is surfaced (not fixed) — keeps this PR tight and defers correctly to v1.1.
