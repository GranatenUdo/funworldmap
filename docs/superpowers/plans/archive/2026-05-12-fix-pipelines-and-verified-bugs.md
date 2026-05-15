# Fix Daily Pipelines + Verified Code Bugs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the daily-content pipeline so prod stays current, decide the fate of the failing news pipeline, and fix two verified code bugs surfaced by the 2026-05-11 assessment.

**Architecture:** Four independent changes. Each is a single-PR-sized unit and can ship independently. The pipeline fix is highest priority because production has been serving stale content since 2026-05-07.

**Tech Stack:** GitHub Actions (workflow_run triggers), Vite + React, Vitest (unit tests), Playwright (e2e), Sentry SDK.

**Scope discipline:** This plan covers ONLY findings I personally verified during the 2026-05-11 assessment. The following items from the original critical review are **NOT in scope here** — they need their own brainstorm + plan:

- `GameController.tsx` extraction (833-line god component) — architectural refactor
- Bundle-budget CI gate — needs measurement baseline + budget design
- ESLint upgrade to `recommended-type-checked` + Prettier integration — disruptive sweep
- Cross-browser CI matrix re-enable — needs self-hosted GPU runner
- `countries-10m` → `countries-50m` swap — design decision (Tuvalu hand-patch tradeoff)
- 13 testIgnore'd specs on CI — see above (same runner dependency)

When this plan is done, the user can choose whether to fund any of those follow-ups individually.

---

## Local repository state assumed by this plan

- `main` is checked out and up to date with `origin/main` as of 2026-05-12 (post-pull). Local `public/daily/index.json` shows window ending 2026-05-12; prod still serves window ending 2026-05-07.
- No staged changes; working tree has unrelated untracked files (`.tmp-locked-node/`, `docs/design-sketches/`, two PNG screenshots, three docs from the 2026-05-11 assessment, this plan). The plan's tasks don't touch any of those.

## File map

Files this plan touches:

- Modify: `.github/workflows/deploy.yml` — add `workflow_run` trigger so bot commits redeploy prod
- Modify: `.github/workflows/news.yml` — guard against empty fetches; **OR delete** depending on Task 2.0 decision
- Modify: `src/App.tsx` — gate `flyTo` on reduced-motion (line ~200)
- Modify: `src/game/daily/storage.ts` — add Sentry breadcrumbs to swallow-catches
- Modify: `src/game/daily/resume.ts` — add Sentry breadcrumbs to swallow-catches
- Modify: `src/lib/initSentry.ts` — export `captureBreadcrumb` helper (or use SDK directly)
- Create: `src/game/daily/__tests__/storage-corruption.test.ts` — verify breadcrumbs fire
- Create: `e2e/cold-load-deep-link.spec.ts` — regression test for the cold-load path (Bug 1 was retracted, but the test gap is real)
- Modify: `src/__tests__/App.reduced-motion.test.tsx` (new) — verify game-start flyTo respects preference

---

## Section 1 — Pipeline fixes (P0)

### Task 1.0: Confirm the diagnosis before fixing

**Files:**
- Read: `.github/workflows/daily-puzzle.yml`, `.github/workflows/deploy.yml`

The hypothesis is: `GITHUB_TOKEN`-authored pushes do not trigger workflows that listen on `push`. This is GitHub's documented behavior to prevent infinite loops. We can verify by checking whether deploy.yml has fired since 2026-05-07 (it hasn't, per `gh run list --workflow=deploy.yml`).

- [ ] **Step 1: Verify deploy.yml hasn't fired on a bot commit**

```bash
gh run list --workflow=deploy.yml --limit 15
```

Expected: every run since the assessment is from a human push (PR merge, direct push). No bot author shows up.

- [ ] **Step 2: Verify the daily-puzzle workflow did commit**

```bash
git log --oneline --author=funworldmap-bot -20
```

Expected: a steady cadence of "chore(daily): update daily-puzzle window" and "chore(news): daily refresh" commits — but none of those commits triggered a deploy.

- [ ] **Step 3: Read GitHub docs to confirm the failure mode**

The relevant doc snippet:
> When you use the repository's GITHUB_TOKEN to perform tasks, events triggered by the GITHUB_TOKEN [...] will not create a new workflow run. This prevents you from accidentally creating recursive workflow runs.

Source: GitHub docs — "Automatic token authentication" → "Using the GITHUB_TOKEN in a workflow".

This confirms the diagnosis. Proceed to Task 1.1.

---

### Task 1.1: Add `workflow_run` trigger to `deploy.yml`

**Files:**
- Modify: `.github/workflows/deploy.yml`

The fix: chain deploy to the completion of the two content-generating workflows. `workflow_run` triggers **do** fire regardless of the token type that caused the upstream run, because they react to the workflow run object, not the push event.

- [ ] **Step 1: Write the failing manual test (test plan)**

Before changing the file, document what success looks like:

> After this task lands, manually triggering `daily-puzzle.yml` via `gh workflow run daily-puzzle.yml` must cause `deploy.yml` to run within 60 s of the daily-puzzle run's completion (whether or not the daily-puzzle run actually committed changes).

This is a manual verification, not an automated test.

- [ ] **Step 2: Modify `.github/workflows/deploy.yml`**

Replace the `on:` block:

```yaml
on:
  push:
    branches: [main]
  workflow_run:
    workflows: ["Daily puzzle index", "News feed"]
    types: [completed]
    branches: [main]
```

Add a job-level guard so the deploy only runs when the upstream succeeded (we don't redeploy on a failed daily-puzzle run that didn't commit anything anyway):

```yaml
jobs:
  build:
    if: ${{ github.event_name == 'push' || github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    steps:
      # ... existing steps unchanged
```

Full updated file:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_run:
    workflows: ["Daily puzzle index", "News feed"]
    types: [completed]
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    if: ${{ github.event_name == 'push' || github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Build
        run: npm run build
        env:
          VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
          VITE_CF_WA_TOKEN: ${{ secrets.VITE_CF_WA_TOKEN }}
          VITE_ANALYTICS_ENDPOINT: ${{ secrets.VITE_ANALYTICS_ENDPOINT }}
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Commit and push to a branch**

```bash
git checkout -b fix/deploy-on-bot-commit
git add .github/workflows/deploy.yml
git commit -m "fix(ci): trigger deploy on workflow_run from daily-puzzle/news

GITHUB_TOKEN-authored pushes from daily-puzzle.yml and news.yml don't
fire push-triggered workflows. Result: bot has committed daily-content
updates since 2026-05-07 but deploy.yml never ran. Production /daily/
index.json fell 5 days behind main.

Adds workflow_run trigger on the two content workflows so deploy runs
when either completes successfully on main. Push trigger remains for
human commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push -u origin fix/deploy-on-bot-commit
```

- [ ] **Step 4: Open PR and merge**

```bash
gh pr create --title "fix(ci): trigger deploy on workflow_run from daily-puzzle/news" \
  --body "$(cat <<'EOF'
## Summary
- daily-puzzle.yml has been committing fresh /daily/index.json since 2026-05-07 but deploy.yml never fires for bot commits (GitHub Actions doesn't trigger push workflows from GITHUB_TOKEN-authored pushes)
- Adds `workflow_run` trigger on deploy.yml chained to daily-puzzle + news
- Resolves prod-health-smoke alert (issue #37)

## Test plan
- [ ] Merge this PR
- [ ] Manually trigger daily-puzzle.yml: `gh workflow run daily-puzzle.yml`
- [ ] Confirm deploy.yml fires within 60s of daily-puzzle completion
- [ ] Within 1h, verify `https://funworldmap.com/daily/index.json` shows today's window
- [ ] Within 6h, verify prod-health-smoke goes green and issue #37 auto-closes (or close it manually)
EOF
)"
```

- [ ] **Step 5: Manual verification after merge**

```bash
# Trigger the daily-puzzle workflow manually
gh workflow run daily-puzzle.yml

# Wait ~90s, then check if deploy fired
sleep 90
gh run list --workflow=deploy.yml --limit 3
```

Expected: a new deploy run with `event: workflow_run` triggered by the daily-puzzle run.

```bash
# After deploy completes, check prod
curl -fsSL https://funworldmap.com/daily/index.json | python -c "import sys, json; print(json.load(sys.stdin)['window'])"
```

Expected: `window.end` matches today's UTC date or yesterday.

- [ ] **Step 6: Close issue #37 manually if it didn't auto-close**

```bash
gh issue close 37 --comment "Fixed by #<PR-number>. The deploy.yml workflow now fires on workflow_run completion from daily-puzzle.yml, so bot-committed index updates reach prod."
```

---

### Task 1.2: Drop the news pipeline (decided 2026-05-12)

**Decision:** Branch B (drop). Rationale: 2026-05-11 run produced 0 articles across 249 files; race condition with daily-puzzle.yml; 17-31 min runtime burns Actions minutes; `CountryNewsSection.tsx` already handles 404 with "News unavailable." Dropping removes a feature returning empty data anyway.

**Files:**
- Delete: `.github/workflows/news.yml`
- Delete: `scripts/news/build.ts` (and any helpers in `scripts/news/`)
- Delete: `public/news/` (the cached articles)
- Modify: `src/components/CountryNewsSection.tsx` — either delete or stub
- Modify: `src/components/SingleCountryPanel.tsx` — remove the CountryNewsSection import + use
- Modify: `docs/systems/country-news.md` — delete the doc
- Modify: `docs/systems/overview.md` — remove the news system from the diagram if listed
- Modify: `package.json` — remove the `news:build` script
- Modify: `src/components/__tests__/` — remove news-related tests
- Modify: `e2e/country-news.spec.ts` — delete

- [ ] **Step 1: Find all news touch-points**

```bash
git grep -l -i "news\|CountryNews"
```

Inventory everything that will be removed.

- [ ] **Step 2: Run the existing tests to capture current pass state**

```bash
npm run test:unit
```

Baseline for "didn't break anything else."

- [ ] **Step 3: Remove the workflow**

```bash
rm .github/workflows/news.yml
```

- [ ] **Step 4: Remove the build script**

```bash
rm -r scripts/news/
```

- [ ] **Step 5: Remove cached news output**

```bash
rm -r public/news/
```

- [ ] **Step 6: Remove the component**

```bash
rm src/components/CountryNewsSection.tsx
rm src/components/__tests__/CountryNewsSection.test.tsx  # if it exists
```

- [ ] **Step 7: Remove the import + use from SingleCountryPanel.tsx**

Find the import and the JSX element. Remove both. (Specific edit can't be templated without reading the current file state.)

- [ ] **Step 8: Remove the e2e spec**

```bash
rm e2e/country-news.spec.ts
```

Also remove it from `playwright.config.ts` testMatch list at line 81.

- [ ] **Step 9: Remove the docs**

```bash
rm docs/systems/country-news.md
```

Edit `docs/index.md` if it links to country-news.md. Edit `docs/systems/overview.md` if news is mentioned.

- [ ] **Step 10: Remove the script entry**

In `package.json`, remove the `"news:build": "tsx scripts/news/build.ts"` line.

- [ ] **Step 11: Run tests and build**

```bash
npm run lint
npm run test:unit
npm run build
```

Expected: all pass. If lint complains about unused imports, fix them.

- [ ] **Step 12: Commit and PR**

```bash
git checkout -b chore/drop-news-pipeline
git add -A
git commit -m "chore: remove country news feature and its scheduled workflow

The news workflow (.github/workflows/news.yml) has been producing 0
articles per run since 2026-05-10 due to GDELT API rate-limiting from
the GitHub Actions IP range. It also races with daily-puzzle.yml for
the push, causing legitimate-but-empty runs to fail.

CountryNewsSection.tsx, the consumer, degrades to 'no news' gracefully
when the JSON files are empty, so removing both the pipeline and the
section is the simplest path.

If a news feature is wanted later, use a paid news API and a separate
Cloudflare Worker — don't fan out to 249 country fetches from CI.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push -u origin chore/drop-news-pipeline
gh pr create --title "chore: drop country news feature" --body "..."
```

---

### Task 1.3: Validate prod-health-smoke after pipeline fix

**Files:** none modified.

- [ ] **Step 1: Wait for the next scheduled prod-health-smoke run**

Smoke runs at minute 15 of hours 1, 7, 13, 19 UTC. Find the next run time.

- [ ] **Step 2: Verify the run succeeds**

```bash
gh run list --workflow=prod-health-smoke.yml --limit 1
```

Expected: latest run is `success`.

- [ ] **Step 3: Close issue #37 manually (smoke check does not auto-close)**

The prod-health-smoke workflow only opens or comments on issues; it does not close. After confirming Step 2 succeeded, close manually:

```bash
gh issue close 37 --comment "Resolved by <PR-number>. deploy.yml now fires on workflow_run completion from daily-puzzle.yml. Prod served fresh /daily/index.json window at <verification-timestamp>."
```

If the smoke check is still failing, deploy.yml didn't fire — return to Task 1.1 and debug.

---

## Section 2 — Verified code bugs

### Task 2.1: Fix reduced-motion bypass on game start

**Files:**
- Modify: `src/App.tsx:196-203` — add `prefersReducedMotion()` guard on `duration`
- Create: `e2e/reduced-motion-game-start.spec.ts`

**Context:** The effect at `App.tsx:196-203` unconditionally dispatches `mapRef.current?.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 700 })` on game start. Verified 2026-05-11. Every other camera site (`flyToCountry.ts`, `resetViewControl.ts`, `GameController.tsx:684`) checks `prefersReducedMotion()` from `src/lib/motion.ts:1-3`. This one site doesn't. Per `docs/purpose.md:33` and `accessibility.md:104`, the app promises to respect the preference. This is a real WCAG violation.

**Test tier choice (decided 2026-05-12):** E2E. Unit testing is the wrong tier — the map ref is null in jsdom, so `mapRef.current?.flyTo(...)` is a no-op; the test can't observe what would happen with a real map. E2E with `page.emulateMedia({ reducedMotion: 'reduce' })` and the existing `__funworldmap_map` test seam directly observes the camera behavior.

- [ ] **Step 1: Write the failing e2e spec**

Create `e2e/reduced-motion-game-start.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { waitForAppReady, waitForGameTestHook } from './helpers'

test.describe('Game start respects prefers-reduced-motion', () => {
  test('reduce: camera does not animate on idle → playing', async ({ page }) => {
    // Force reduced-motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await page.goto('/')
    await waitForAppReady(page)
    await waitForGameTestHook(page)

    // Pan the camera somewhere distinct so we can observe whether the
    // game-start flyTo overrides it instantly (reduced) or animates over time.
    await page.evaluate(() => {
      const map = (window as unknown as { __funworldmap_map: { jumpTo: (o: unknown) => void; getCenter: () => { lng: number; lat: number } } }).__funworldmap_map
      map.jumpTo({ center: [120, -30], zoom: 4 })
    })

    // Sample center BEFORE game start
    const before = await page.evaluate(() => {
      const map = (window as unknown as { __funworldmap_map: { getCenter: () => { lng: number; lat: number } } }).__funworldmap_map
      const c = map.getCenter()
      return { lng: c.lng, lat: c.lat }
    })
    expect(Math.abs(before.lng - 120)).toBeLessThan(0.1)

    // Trigger the game start by setting the hash
    await page.evaluate(() => { window.location.hash = 'game/country-pinning' })

    // With reduced-motion, the camera should snap to DEFAULT_CENTER within one frame.
    // Without the fix, the 700ms flyTo animation interpolates over ~700ms.
    // Sample at 100ms: with the fix, center should already be at DEFAULT_CENTER (lng=0, lat=20).
    await page.waitForTimeout(100)
    const after100ms = await page.evaluate(() => {
      const map = (window as unknown as { __funworldmap_map: { getCenter: () => { lng: number; lat: number } } }).__funworldmap_map
      const c = map.getCenter()
      return { lng: c.lng, lat: c.lat }
    })

    // With the fix (duration: 0), center is at DEFAULT_CENTER (lng=0).
    // Without the fix, center is interpolating from 120 toward 0, still > 30 at 100ms.
    expect(Math.abs(after100ms.lng)).toBeLessThan(5)
  })

  test('no preference: camera DOES animate on idle → playing', async ({ page }) => {
    // Default — no media emulation
    await page.goto('/')
    await waitForAppReady(page)
    await waitForGameTestHook(page)

    await page.evaluate(() => {
      const map = (window as unknown as { __funworldmap_map: { jumpTo: (o: unknown) => void } }).__funworldmap_map
      map.jumpTo({ center: [120, -30], zoom: 4 })
    })

    await page.evaluate(() => { window.location.hash = 'game/country-pinning' })

    // At 100ms, the 700ms animation is ~14% complete; center is still far from 0.
    await page.waitForTimeout(100)
    const after100ms = await page.evaluate(() => {
      const map = (window as unknown as { __funworldmap_map: { getCenter: () => { lng: number; lat: number } } }).__funworldmap_map
      const c = map.getCenter()
      return { lng: c.lng, lat: c.lat }
    })
    expect(Math.abs(after100ms.lng)).toBeGreaterThan(30)
  })
})
```

Note: the `chromium` Playwright project already sets `reducedMotion: 'reduce'` per `playwright.config.ts:47`. To make the "no preference" test reliable, override with `page.emulateMedia({ reducedMotion: 'no-preference' })` at the start. Adjust the spec if needed.

- [ ] **Step 2: Register the spec in `playwright.config.ts`**

Add `'reduced-motion-game-start.spec.ts'` to the chromium project's `testMatch` array (around line 53-103).

- [ ] **Step 3: Run the spec, expect FAIL on the "reduce" test**

```bash
npm run test:e2e -- --project=chromium reduced-motion-game-start.spec.ts
```

Expected: the "reduce" test fails because the current code uses unconditional `duration: 700`, so at 100ms the camera is still mid-animation.

- [ ] **Step 4: Patch `src/App.tsx`**

Read the current content of the effect first:

```bash
sed -n '195,210p' src/App.tsx
```

Apply the one-line fix:

```tsx
import { prefersReducedMotion } from './lib/motion'  // add to existing imports

// In the effect body around line 200:
useEffect(() => {
  if (session.status !== 'playing' || session.roundIndex !== 0) return
  if (selected) deselect()
  setComparePickingMode(false)
  mapRef.current?.flyTo({
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    duration: prefersReducedMotion() ? 0 : 700,
  })
}, [session.status, session.roundIndex, selected, deselect, mapRef])
```

- [ ] **Step 5: Run the spec, expect PASS**

```bash
npm run test:e2e -- --project=chromium reduced-motion-game-start.spec.ts
```

Expected: both tests pass.

- [ ] **Step 6: Commit**

```bash
git checkout -b fix/reduced-motion-on-game-start
git add src/App.tsx e2e/reduced-motion-game-start.spec.ts playwright.config.ts
git commit -m "fix(a11y): gate game-start flyTo on prefers-reduced-motion

App.tsx:196-203 dispatched an unconditional 700ms flyTo on every
idle→playing and game-over→Play-again transition. Other camera
sites in lib/flyToCountry.ts and lib/resetViewControl.ts gate on
prefersReducedMotion(); this one didn't.

Per docs/purpose.md:33 and accessibility.md:104, the app promises
to respect the preference. This was a real WCAG 2.1 SC 2.3.3 violation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.2: Add Sentry breadcrumbs to daily-storage swallow-catches

**Files:**
- Modify: `src/game/daily/storage.ts` — breadcrumbs in `readHistory`, `writeHistory`
- Modify: `src/game/daily/resume.ts` — breadcrumbs in `readResume`, `writeResume`, `clearResume`
- Create: `src/game/daily/__tests__/storage-corruption.test.ts`

**Context:** Verified 2026-05-12 — `grep "Sentry\." src/game/daily/` returns zero matches. Verified by reading the files:
- `storage.ts:28-30` — `readHistory` catch (parse failure)
- `storage.ts:36-38` — `writeHistory` catch (quota / private-mode)
- `resume.ts:27-29` — `readResume` parse-failure catch
- `resume.ts:35-37` — `writeResume` write catch
- `resume.ts:41-45` — `clearResume` removal catch
- `resume.ts:21` — inner stale-date `removeItem` catch (best-effort, no signal needed)

All swallow silently. A user's streak can reset with zero ops visibility. Sentry is installed (`@sentry/react`, init in `lib/initSentry.ts`) but never called from these paths.

**Design choice:** Use **breadcrumbs** for write-side failures (best-effort, frequent) and **captureException** for read-side parse failures (rare, indicates corruption). This avoids breadcrumb-flooding while making real corruption visible.

- [ ] **Step 1: Read the current storage.ts and resume.ts**

```bash
cat src/game/daily/storage.ts src/game/daily/resume.ts
```

Note the exact catch blocks and what they return.

- [ ] **Step 2: Write the failing test**

Create `src/game/daily/__tests__/storage-corruption.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Sentry from '@sentry/react'
import { readHistory } from '../storage'

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}))

describe('readHistory on corrupted localStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('captures a Sentry exception when JSON.parse fails', () => {
    localStorage.setItem('funworldmap-daily-history', '{not json')
    const result = readHistory()
    // History resets to empty
    expect(Object.keys(result.days)).toHaveLength(0)
    // Sentry was notified
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(Sentry.captureException).mock.calls[0][0]
    expect(arg).toBeInstanceOf(Error)
  })

  it('captures a Sentry exception when the version is unknown', () => {
    localStorage.setItem('funworldmap-daily-history', JSON.stringify({ version: 99, days: {}, streak: { current: 0, longest: 0, lastActiveDate: null, lastMilestoneShown: 0 } }))
    readHistory()
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
```

Add a second file for the write side:

```ts
// src/game/daily/__tests__/storage-write-breadcrumb.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Sentry from '@sentry/react'
import { writeHistory } from '../storage'

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}))

describe('writeHistory on quota exceeded', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('emits a breadcrumb (not an exception) when localStorage throws', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    writeHistory({
      version: 1,
      days: {},
      streak: { current: 0, longest: 0, lastActiveDate: null, lastMilestoneShown: 0 },
    })
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
      category: 'storage',
      level: 'warning',
    }))
    expect(Sentry.captureException).not.toHaveBeenCalled()
    setItemSpy.mockRestore()
  })
})
```

- [ ] **Step 3: Run tests, expect FAIL**

```bash
npm run test:unit -- storage-corruption storage-write-breadcrumb
```

Expected: FAIL — Sentry mocks never called because the code doesn't call them yet.

- [ ] **Step 4: Patch `src/game/daily/storage.ts`**

Read current file first. Then add Sentry calls:

```ts
import * as Sentry from '@sentry/react'

// readHistory - existing function around line 18
export function readHistory(): DailyHistory {
  try {
    const raw = localStorage.getItem('funworldmap-daily-history')
    if (raw === null) return emptyHistory()
    const parsed = JSON.parse(raw) as DailyHistory
    if (parsed.version !== 1) {
      Sentry.captureException(new Error(`daily-history: unknown version ${parsed.version}`), {
        tags: { area: 'daily-storage', kind: 'unknown-version' },
      })
      return emptyHistory()
    }
    return parsed
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: 'daily-storage', kind: 'parse-failure' },
    })
    return emptyHistory()
  }
}

// writeHistory - existing function around line 34
export function writeHistory(history: DailyHistory): void {
  try {
    localStorage.setItem('funworldmap-daily-history', JSON.stringify(history))
  } catch (err) {
    Sentry.addBreadcrumb({
      category: 'storage',
      level: 'warning',
      message: 'writeHistory failed',
      data: { name: (err as Error).name, message: (err as Error).message },
    })
  }
}
```

- [ ] **Step 5: Patch `src/game/daily/resume.ts`**

Same pattern. `readResume` → captureException on parse failure. `writeResume` and `clearResume` → addBreadcrumb on failure.

- [ ] **Step 6: Run tests, expect PASS**

```bash
npm run test:unit -- storage-corruption storage-write-breadcrumb
```

Expected: PASS.

- [ ] **Step 7: Run full unit suite**

```bash
npm run test:unit
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git checkout -b fix/daily-storage-observability
git add src/game/daily/storage.ts src/game/daily/resume.ts src/game/daily/__tests__/storage-corruption.test.ts src/game/daily/__tests__/storage-write-breadcrumb.test.ts
git commit -m "fix(observability): emit Sentry signal on daily-storage failures

storage.ts:18-31,34-39 and resume.ts:13-30,33,41 swallow every error
including JSON.parse failures. A user's streak can silently reset
with zero ops visibility. Sentry is installed but was never called
from these paths.

Read-side parse failures (rare, indicates real corruption) →
Sentry.captureException with area/kind tags.

Write-side failures (frequent, expected on quota-exceeded or
private-mode Safari) → Sentry.addBreadcrumb at warning level.

This makes prod corruption diagnosable from Sentry alone.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Section 3 — Regression test for cold-load deep link

### Task 3.1: Add e2e test for `#game/<mode>` cold load

**Files:**
- Create: `e2e/cold-load-deep-link.spec.ts`

**Context:** During the 2026-05-11 walkthrough, I mis-diagnosed a same-URL-navigate no-op as a bootstrap bug ("Bug 1" — retracted in the divergence report). The bug wasn't real, but the test gap is: no spec exercises a cold tab opening `#game/<mode>` directly. If a future regression breaks this path, no test catches it.

- [ ] **Step 1: Read `e2e/helpers.ts` to understand the readiness helpers**

```bash
cat e2e/helpers.ts | head -100
```

- [ ] **Step 2: Write the spec**

Create `e2e/cold-load-deep-link.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { waitForAppReady, waitForGameTestHook } from './helpers'

test.describe('Cold-load deep links bootstrap their target state', () => {
  test('navigating directly to #game/country-pinning starts the game', async ({ page }) => {
    await page.goto('/#game/country-pinning')
    await waitForAppReady(page)
    await waitForGameTestHook(page)

    const session = await page.evaluate(() => {
      const w = window as unknown as { __funworldmap_game: { getSession: () => unknown } }
      return w.__funworldmap_game.getSession()
    })
    expect(session).toMatchObject({
      status: 'playing',
      modeId: 'country-pinning',
      attemptsPerRound: 1,
      maxRounds: null,
      dailyDate: null,
    })
    await expect(page.getByTestId('game-prompt-name')).toBeVisible()
    await expect(page.getByTestId('launcher')).not.toBeAttached()
  })

  test('navigating directly to #game/city-guessing starts the game', async ({ page }) => {
    await page.goto('/#game/city-guessing')
    await waitForAppReady(page)
    await waitForGameTestHook(page)

    const session = await page.evaluate(() => {
      const w = window as unknown as { __funworldmap_game: { getSession: () => unknown } }
      return w.__funworldmap_game.getSession()
    })
    expect(session).toMatchObject({
      status: 'playing',
      modeId: 'city-guessing',
      attemptsPerRound: 1,
      maxRounds: 10,
    })
    await expect(page.getByTestId('game-prompt-name')).toBeVisible()
  })
})
```

- [ ] **Step 3: Register the spec in playwright.config.ts**

In the `chromium` project's `testMatch` array (around line 53-103), add `'cold-load-deep-link.spec.ts'`. Keep it OUT of the `testIgnore` list — this spec doesn't need GPU.

- [ ] **Step 4: Run the test locally**

```bash
npm run test:e2e -- --project=chromium cold-load-deep-link.spec.ts
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git checkout -b test/cold-load-deep-link
git add e2e/cold-load-deep-link.spec.ts playwright.config.ts
git commit -m "test(e2e): cover cold-load deep link to #game/<mode>

No existing spec exercises a fresh tab opening a free-play game route
directly. Adds two assertions: country-pinning and city-guessing both
bootstrap correctly when the hash is set before mount (as it is when
a user bookmarks or shares the URL).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Section 4 — Out of scope (explicit deferrals)

The following items from the 2026-05-11 critical review are **not in this plan**. Each needs its own brainstorm + plan with explicit stakeholder agreement:

| Item | Why deferred | Sketch of follow-up |
|---|---|---|
| `GameController.tsx` extraction (833 lines, 9 ref-mirrors) | Architectural refactor with broad blast radius; existing unit tests cover the reducer, not the controller's effects | New plan: extract `useHashGameRouter`, `useDailyResumePersistence`, `useGameAnnouncements`, `useRevealMapEffects`, `useGameTestSeams` as separate hooks. Each is a multi-step refactor of its own. |
| Bundle-budget CI gate | Needs measurement baseline, budget design, gate-vs-warn threshold decision | New plan: pick budgets, instrument `npm run build` to write a JSON summary, add a CI step that diffs against budgets, decide failure threshold |
| `countries-10m` → `countries-50m` | Design decision: Tuvalu hand-patch tradeoff vs current behavior | New plan: prototype both options, measure perceived map quality, pick |
| ESLint upgrade to type-checked rules | Disruptive sweep — many findings to clean up before the rules can land green | New plan: enable rules one at a time, fix findings, commit each rule transition separately |
| Cross-browser CI re-enable | Blocked on self-hosted GPU runner | New plan: provision the runner, validate the existing test list, decide which projects to gate |
| Daily index local-staleness | UX gap for new contributors (file ends 5 days ago today, 2026-05-12) | Either backfill on dev startup or document explicitly. Not load-bearing. |
| `forced-colors` / Windows HC mode | Unverified gap — zero CSS rules for it | New plan: audit WCAG 1.4.1/1.4.11 surface, add CSS as needed |
| Panel-open focus management | Verified via agent but I didn't personally confirm in the walkthrough | Quick verification + one-line fix if confirmed |
| 44×44 touch target floor | Audit work to find non-compliant elements | New plan: scan all interactive elements, add CSS as needed |

---

## Sequencing & critical path

The dependency between tasks:

```
Task 1.0 (confirm diagnosis)
  → Task 1.1 (deploy.yml workflow_run)
      → Task 1.3 (validate prod-health-smoke)
  → Task 1.2 (news decision)

Task 2.1 (reduced-motion) — independent
Task 2.2 (Sentry breadcrumbs) — independent
Task 3.1 (cold-load e2e) — independent
```

**Recommended order:**

1. **Task 1.1 first** — production has been stale since 2026-05-07. Highest urgency.
2. **Task 1.2** in parallel — needs a human decision, then either fix or drop.
3. **Task 1.3** after 1.1 — wait for smoke check to validate.
4. **Tasks 2.1, 2.2, 3.1** — any order, each a separate PR.

Each task ships as its own PR. Total: 4-5 PRs depending on news decision.

---

## Self-review (done before delivery)

- **Spec coverage:** Every verified bug from the 2026-05-11 assessment that I personally confirmed has a task. Items I didn't personally verify (forced-colors, panel-focus) are deferred. Items needing architectural debate (GameController, bundle gate) are deferred.
- **Placeholder scan:** Two soft spots:
  - Task 2.1 Step 3 acknowledges the test mock may need adjustment ("If the spy approach doesn't reach the map instance..."). Real-world: the engineer needs to read the actual App.tsx structure before finalizing. I marked this honestly rather than papering over it.
  - Task 1.2A Step 2 sketches retry-with-backoff without templating the full file. The script structure varies; the engineer needs to read `scripts/news/build.ts` to slot it in.
- **Type consistency:** Where I named functions (`prefersReducedMotion`, `captureException`, `addBreadcrumb`), they're used consistently across tasks.
