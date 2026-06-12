# E2E Flake Elimination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the chronic e2e flake regression on `e2e (chromium)` and prevent recurrence by (a) removing the Software-ANGLE chromium project entirely, (b) sweeping the 36 remaining `waitForTimeout` and `force: true` anti-pattern sites identified in the 2026-04-28 regression note, and (c) adding component-side animation signals so future tests can wait deterministically on CSS transitions.

**Architecture:** Three phases, each independently shippable. Phase 1 collapses the `chromium` (Software ANGLE) and `chromium-gpu` (real-GPU ANGLE) projects into one project — eliminating the slow Software-ANGLE backend that's the documented root cause of the flake regression — and removes the redundant 8-minute CI job. Phase 2 sweeps the remaining `waitForTimeout(N)` and `click({ force: true })` anti-pattern sites in 8 spec files using the five patterns codified in `docs/superpowers/specs/2026-04-25-e2e-timing-sweep-design.md` §Item 2. Phase 3 adds `data-animation-state="entering|idle|exiting"` to the three components driving most CSS-transition races (Launcher modal, CountryPanel slide, SearchBar dropdown) plus a `waitForAnimationIdle(locator)` e2e helper, removing the last category of fragile timing assumption.

**Tech Stack:** Playwright 1.59, TypeScript 5.7, React 19 (synchronous state via `useState`), Vite 6 (CSS animations and transitions), CSS keyframes (`launcher-card-in 220ms`, `launcher-backdrop-in 220ms`, panel slide-ins).

**Source documents:**
- [`docs/superpowers/notes/2026-04-28-flake-regression-analysis.md`](../notes/2026-04-28-flake-regression-analysis.md) — root-cause and recommendations A–D
- [`docs/superpowers/specs/2026-04-25-e2e-timing-sweep-design.md`](../specs/2026-04-25-e2e-timing-sweep-design.md) — Patterns 1–5 vocabulary
- [`docs/superpowers/plans/2026-04-22-deflake-chromium-e2e.md`](2026-04-22-deflake-chromium-e2e.md) — load-time fix (round 1)
- `CLAUDE.md` — codified rules whose violation causes the flake

---

## Three-phase plan

This plan is **three PRs**, in sequence, each independently mergeable.

**Phase 1 — Project consolidation** (Tasks 1–3, branch `chore/e2e-drop-software-angle`). One config change + a one-line CI workflow update + verification. ~30 LOC. This is the single largest deflake action — it removes the documented largest contributor (the Software-ANGLE backend that ran ~5–10× slower than real-GPU and was responsible for most observed timeouts). It does **not** eliminate the underlying anti-patterns inside test bodies; those are Phase 2's job. PR #28 may CI-clear after Phase 1 alone because the residual flakes happen to not trigger on real GPU, but the durable fix is Phase 1 + Phase 2 together.

**Phase 2 — Anti-pattern sweep** (Tasks 4–10, branch `test/e2e-anti-pattern-sweep`). Per-spec sweep of 36 anti-pattern sites across 8 files. Mostly mechanical. ~120-180 LOC.

**Phase 3 — Component animation signals** (Tasks 11–14, branch `feat/component-animation-signals`). `data-animation-state` attribute on Launcher, CountryPanel, SearchBar; `waitForAnimationIdle(locator)` helper; CLAUDE.md update. ~80 LOC across 5 files.

Task 15 is the final verification gate (run after each phase; included for completeness).

---

## File structure

### Phase 1 — Project consolidation

| File | Change | Responsibility |
|---|---|---|
| `playwright.config.ts` | Modify (~30 LOC) | Delete `chromium` project entry; merge its `testMatch` array into `chromium-gpu`'s; rename `chromium-gpu` to `chromium` for clarity. |
| `.github/workflows/ci.yml` | Modify (~5 LOC) | Drop the matrix entry for the now-deleted Software-ANGLE job; e2e CI runs as a single `chromium` job. |
| `docs/systems/testing.md` | Modify (~10 LOC) | Remove references to the dual-project structure; update the chromium-vs-chromium-gpu explanation. |

### Phase 2 — Anti-pattern sweep

Per-file (counts from `grep -c "waitForTimeout\|force: true" e2e/*.spec.ts`):

| File | `waitForTimeout` sites | `force: true` sites | Notes |
|---|---|---|---|
| `e2e/search.spec.ts` | 11 | 0 | Pattern 1 (every site is `fill → waitForTimeout(N) → assert`) |
| `e2e/accessibility.spec.ts` | 10 | 0 | Pattern 1 (mostly `goto → waitForTimeout → axe-scan`) |
| `e2e/launcher.spec.ts` | 4 | 2 | Pattern 1 + drop `force: true` (the `panel-close` click race) |
| `e2e/theme-and-responsive.spec.ts` | 3 | 0 | Pattern 1 |
| `e2e/daily-puzzle.spec.ts` | 2 | 0 | Pattern 1 (intermediate-attempt panel suppression test) |
| `e2e/panel-focus.spec.ts` | 1 | 0 | Pattern 1 |
| `e2e/mobile-tap.spec.ts` | 1 | 0 | Pattern 1 |
| `e2e/daily-streak.spec.ts` | 1 | 0 | Pattern 1 |

Task 4 covers `search.spec.ts` (the largest concentration); Tasks 5–10 take the rest.

### Phase 3 — Component animation signals

| File | Change | Responsibility |
|---|---|---|
| `src/components/Launcher.tsx` | Modify | Add `data-animation-state` attribute driven by `Element.getAnimations({ subtree: true })` rather than a magic-number `setTimeout` — the component's own CSS animations are the source of truth, not a hand-typed duration. |
| `src/components/CountryPanel.tsx` | Modify | Same `getAnimations()`-based pattern for the panel slide-in. |
| `e2e/helpers.ts` | Modify (~15 LOC) | Add `waitForAnimationIdle(locator)` — polls `data-animation-state="idle"`. |
| `CLAUDE.md` | Modify | Add the `data-animation-state="idle"` pattern as the canonical solution to "sleeping through CSS transitions". Update the Required-pattern table. |

**SearchBar dropdown is intentionally out of Phase 3.** The launcher.spec.ts dropdown-intercept failure is already addressed by the existing `await expect(page.getByTestId('search-results')).not.toBeAttached()` line (Task 6 just removes the redundant `force: true`). Adding animation state to SearchBar is a possible future addition but not required to fix the current flake set.

---

## Task order rationale

Phase 1 lands first because the chromium Software-ANGLE job is the documented largest single contributor to the flake rate. Removing it (Recommendation D from the 2026-04-28 note, never executed) collapses the regression. Phase 2 then mops up the 36 surviving anti-pattern sites — these still cause occasional flakes even on real GPU and would re-introduce the regression as test count grows. Phase 3 closes the last category of fragile assumption (CSS-transition timing) by giving tests a deterministic signal to wait on, so future tests can't fall back into the old pattern.

Tasks within Phase 2 are size-ordered (largest first); they're independent and can be tackled in any order.

---

# Phase 1 — Project consolidation

**Branch:** `chore/e2e-drop-software-angle`
**Target merge:** `main`

Start by creating the branch:

```bash
git checkout main && git pull
git checkout -b chore/e2e-drop-software-angle
```

---

### Task 1: Consolidate Playwright projects (drop Software ANGLE)

**Files:**
- Modify: `playwright.config.ts`

**Why:** The 2026-04-28 regression note's Recommendation D — "Stop running `chromium` on Linux Software ANGLE in CI". The `chromium` project uses `--use-gl=swiftshader` (Software ANGLE), runs ~8 min in CI, and produces most of the flake. The `chromium-gpu` project uses `--use-gl=angle --use-angle=default` (real-GPU-backed ANGLE), runs ~12-14 min in CI for fewer specs, and is reliable. Consolidating to one project that uses the reliable backend eliminates the flake source. The 20 additional DOM-only specs added to the consolidated project have no GPU requirement, so running them under real-GPU ANGLE is harmless.

- [ ] **Step 1: Read the current config**

```bash
cat playwright.config.ts
```

Note the `chromium` project (lines ~21-52) with its `testMatch` of 20 DOM-only specs, and the `chromium-gpu` project (lines ~53-68) with its `testMatch` of 13 GPU-needing specs.

- [ ] **Step 2: Replace the two project entries with one consolidated project**

Replace the entire `chromium` and `chromium-gpu` project objects (lines ~20-68 inclusive) with this single project:

```ts
    {
      name: 'chromium',
      // Real-GPU-backed ANGLE renderer. Software ANGLE was dropped 2026-05-02
      // per docs/superpowers/notes/2026-04-28-flake-regression-analysis.md
      // recommendation D: it was the documented largest single contributor
      // to the flake rate and ran ~8 min for tests that don't need GPU at all.
      timeout: isCi ? 120_000 : 60_000,
      expect: { timeout: isCi ? 15_000 : 5_000 },
      use: {
        ...devices['Desktop Chrome'],
        actionTimeout: isCi ? 20_000 : 5_000,
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=default'],
        },
      },
      // Combined testMatch: every spec previously in chromium + chromium-gpu.
      testMatch: [
        // formerly chromium-gpu (real-GPU-needing):
        'map-and-countries.spec.ts',
        'map-reliability.spec.ts',
        'keyboard-map-nav.spec.ts',
        'game-country-pinning.spec.ts',
        'game-city-guessing.spec.ts',
        'game-over-mode-switch.spec.ts',
        'compare-view-dimming.spec.ts',
        'reveal-animation.spec.ts',
        'reveal-animation-reduced-motion.spec.ts',
        'tutorial-first-click.spec.ts',
        'daily-share-block-immediate.spec.ts',
        'daily-survives-ocean-click.spec.ts',
        'daily-reveal-on-final-attempt.spec.ts',
        // formerly chromium (DOM-only, run on real-GPU now to consolidate):
        'scaffold.spec.ts',
        'search.spec.ts',
        'theme-and-responsive.spec.ts',
        'accessibility.spec.ts',
        'panel-and-deeplink.spec.ts',
        'meta-and-static.spec.ts',
        'panel-focus.spec.ts',
        'satellite-default.spec.ts',
        'a11y-contrast.spec.ts',
        'a11y-keyboard-smoke.spec.ts',
        'country-news.spec.ts',
        'launcher.spec.ts',
        'daily-puzzle.spec.ts',
        'daily-best-of-3.spec.ts',
        'daily-streak.spec.ts',
        'daily-reveal.spec.ts',
        'daily-share.spec.ts',
        'daily-deep-link.spec.ts',
        'launcher-history.spec.ts',
        'telemetry-deep-link.spec.ts',
      ],
    },
```

- [ ] **Step 3: Type-check the config**

Run: `npx tsc -b --noEmit`
Expected: SUCCESS.

- [ ] **Step 4: Confirm no project named `chromium-gpu` remains**

Run: `grep -n "chromium-gpu" playwright.config.ts`
Expected: no output (zero matches).

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts
git commit -m "chore(e2e): drop Software-ANGLE chromium project, consolidate into chromium"
```

---

### Task 2: Update CI workflow to single `chromium` e2e job

**Files:**
- Modify: `.github/workflows/ci.yml`

**Why:** The CI workflow's `e2e` job has `matrix.project: [chromium, chromium-gpu]` (line ~46). After Task 1 there's only one project named `chromium`, so the matrix shrinks to one entry. The `merge-reports` job (lines ~75+) downloads blob reports from both matrix shards via `pattern: playwright-blob-*` and merges them into one HTML report — still useful with one shard (single blob → HTML report), so keep it.

- [ ] **Step 1: Update the matrix entry (line ~46)**

Replace:

```yaml
        # Shard by Playwright project instead of by file: chromium (DOM-only,
        # fast) and chromium-gpu (angle software-render, slow + flake-prone)
        # have very different per-file durations. File-sharding put all the
        # slow tests on one shard; project-sharding balances by kind.
        project: [chromium, chromium-gpu]
```

with:

```yaml
        # Single project after the 2026-05-02 Software-ANGLE drop.
        # Kept as a matrix entry for now to avoid restructuring the job
        # name; can be flattened to a non-matrix job in a follow-up.
        project: [chromium]
```

- [ ] **Step 2: Sanity-check the merge-reports job stays correct**

`merge-reports` downloads `playwright-blob-*` artifacts via `pattern` and merges. With one matrix entry it'll find one artifact and produce a single HTML report. No code change needed.

- [ ] **Step 3: Visual YAML lint**

Run: `cat .github/workflows/ci.yml | head -50` and confirm indentation is unchanged. The matrix is two-spaces deeper than `strategy:`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore(ci): single chromium e2e matrix entry after Software-ANGLE drop"
```

---

### Task 3: Update testing system docs

**Files:**
- Modify: `docs/systems/testing.md`

**Why:** The testing doc references the dual-project structure ("two-tier test strategy"). After consolidation it's one project; readers need accurate guidance.

- [ ] **Step 1: Read the current doc**

```bash
cat docs/systems/testing.md
```

Find any reference to `chromium-gpu`, `Software ANGLE`, or "two-project" structure.

- [ ] **Step 2: Update the prose**

Replace any "two projects: chromium (Software ANGLE) and chromium-gpu (real GPU)" passage with a single-paragraph statement. Suggested replacement (adapt to surrounding context):

```markdown
The Playwright e2e suite runs as a single `chromium` project on Chromium with real-GPU-backed ANGLE (`--use-gl=angle --use-angle=default`). The previous Software-ANGLE-backed `chromium` project was dropped 2026-05-02 — it ran ~8 minutes per CI run for DOM-only tests that didn't need GPU, while contributing the bulk of the documented flake regression (see `docs/superpowers/notes/2026-04-28-flake-regression-analysis.md`).
```

- [ ] **Step 3: Commit**

```bash
git add docs/systems/testing.md
git commit -m "docs(testing): single-chromium project after Software-ANGLE drop"
```

- [ ] **Step 4: Push and open Phase 1 PR**

```bash
git push -u origin chore/e2e-drop-software-angle
gh pr create --base main --title "chore(e2e): drop Software-ANGLE chromium project, consolidate into single chromium project" --body "$(cat <<'EOF'
## Summary
- Removes the chromium project that used --use-gl=swiftshader (Software ANGLE)
- Merges its 20 DOM-only specs into the chromium project (formerly chromium-gpu) which uses --use-gl=angle (real-GPU ANGLE)
- Updates CI workflow matrix and testing docs

## Why
docs/superpowers/notes/2026-04-28-flake-regression-analysis.md Recommendation D: the Software-ANGLE job ran ~8 min per CI run for tests that don't need GPU, while contributing the bulk of the documented flake regression.

## Test plan
- [ ] CI shows a single `e2e (chromium)` job
- [ ] All previously-passing specs continue to pass
- [ ] Flake rate measured over 5 consecutive CI runs is 0

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Wait for CI on this PR to be 5/5 green before merging. After merge, Phase 2 branches off the new `main`.

---

# Phase 2 — Anti-pattern sweep

**Branch:** `test/e2e-anti-pattern-sweep` (off `main` after Phase 1 merges)
**Target merge:** `main`

```bash
git checkout main && git pull
git checkout -b test/e2e-anti-pattern-sweep
```

---

### Task 4: Sweep `e2e/search.spec.ts` (12 anti-pattern sites)

**Files:**
- Modify: `e2e/search.spec.ts`

**Why:** 12 of the 36 anti-pattern occurrences are in this file. Every test follows the pattern `fill → waitForTimeout(N) → assert`. The `waitForTimeout` is sleeping through SearchBar's 150 ms debounce + render cycle. Replace each with the assertion's own polling — `expect(locator).toBeVisible()` already waits up to `expect.timeout` (10–15 s in CI). The dropdown's `not.toBeAttached()` does the same on close.

- [ ] **Step 1: Inspect existing sites**

Run: `grep -n "waitForTimeout" e2e/search.spec.ts`
Expected: 11 matches (lines ~15, 38, 53, 63, 69, 78, 83, 90, 99, 104, 112, 119 — minor drift is fine).

- [ ] **Step 2: Replace `typing shows results dropdown`**

Find the test starting at `test('typing shows results dropdown'` (around line 13). Replace its body:

```ts
  test('typing shows results dropdown', async ({ page }) => {
    await page.getByTestId('search-input').fill('France')
    const results = page.getByTestId('search-results')
    await expect(results).toBeVisible()
    await expect(results.getByRole('option').first()).toBeVisible()
    await expect(results.getByRole('option').first()).toContainText('France')
  })
```

The `waitForTimeout(500) // debounce (150ms) + render` line goes away — `toBeVisible` polls.

- [ ] **Step 3: Replace `selecting a result opens the country panel`**

Find the test (around line 25). Replace its body:

```ts
  test('selecting a result opens the country panel', async ({ page }) => {
    const searchInput = page.getByTestId('search-input')
    await searchInput.fill('France')
    const firstOption = page
      .getByTestId('search-results')
      .getByRole('option', { name: /^France\s/ })
      .first()
    await expect(firstOption).toBeVisible({ timeout: 10_000 })

    await searchInput.press('ArrowDown')
    await searchInput.press('Enter')

    await expect.poll(() => page.evaluate(() => window.location.hash), { timeout: 10_000 }).toBe('#FRA')
    const panel = page.getByTestId('country-panel')
    await expect(panel).toBeVisible({ timeout: 10_000 })
    await expect(panel).toContainText('France')
  })
```

The `waitForTimeout(300)` between `firstOption visible` and `ArrowDown` goes away — the visibility assertion's polling is sufficient. The hash poll already provides a synchronous sync point for `selectResult` having fired.

- [ ] **Step 4: Replace remaining tests in the file**

For each remaining test that does `fill → waitForTimeout → assert`, drop the `waitForTimeout` line. Pattern:

| Before | After |
|---|---|
| `await input.fill('Untied'); await page.waitForTimeout(300); await expect(results).toBeVisible()` | `await input.fill('Untied'); await expect(results).toBeVisible()` |
| `await input.fill('Ger'); await page.waitForTimeout(300); await input.press('ArrowDown'); await input.press('Enter'); await page.waitForTimeout(500); await expect(panel).toBeVisible()` | `await input.fill('Ger'); await expect(page.getByTestId('search-results')).toBeVisible(); await input.press('ArrowDown'); await input.press('Enter'); await expect(panel).toBeVisible()` |
| `await input.press('Escape'); await page.waitForTimeout(200); await expect(results).not.toBeAttached()` | `await input.press('Escape'); await expect(results).not.toBeAttached()` |

- [ ] **Step 5: Run the spec 5× locally with retries=0**

```bash
for i in 1 2 3 4 5; do
  echo "=== Run $i ==="
  npx playwright test --project=chromium --retries=0 e2e/search.spec.ts 2>&1 | tail -5
done
```

Expected: 5/5 passes, no flakes.

- [ ] **Step 6: Verify zero remaining `waitForTimeout` in the file**

Run: `grep -c waitForTimeout e2e/search.spec.ts`
Expected: `0`.

- [ ] **Step 7: Commit**

```bash
git add e2e/search.spec.ts
git commit -m "test(e2e): drop waitForTimeout in search.spec, rely on assertion polling"
```

---

### Task 5: Sweep `e2e/accessibility.spec.ts` (10 sites)

**Files:**
- Modify: `e2e/accessibility.spec.ts`

**Why:** 10 anti-pattern sites; mostly `goto → waitForTimeout → axe-scan` patterns. Replace with `waitForAppReady` + readiness for whatever the test asserts on (panel, dropdown, etc.).

- [ ] **Step 1: Inspect existing sites**

Run: `grep -n "waitForTimeout" e2e/accessibility.spec.ts`
Expected: 10 matches.

- [ ] **Step 2: Read the file to understand context**

```bash
cat e2e/accessibility.spec.ts
```

Most tests have shape: `await page.goto(...); await dismissLauncher(page); await page.waitForTimeout(N); /* axe scan or assertion */`.

- [ ] **Step 3: Replace each `waitForTimeout`**

For `beforeEach` or in-test `goto → waitForTimeout` pairs:
- Add `import { waitForAppReady } from './helpers'` if not present.
- Replace `await page.goto('/'); await page.waitForTimeout(N)` with `await page.goto('/'); await waitForAppReady(page); await dismissLauncher(page)` (the launcher dismiss is the existing pattern; if the test doesn't need a clean map, drop `dismissLauncher`).
- For `await action(); await page.waitForTimeout(N); await axeScan()` patterns, replace the `waitForTimeout` with an explicit visibility wait on the axe target — e.g., `await expect(page.getByTestId('country-panel')).toBeVisible()` if scanning a panel.

- [ ] **Step 4: Run 5× locally**

```bash
for i in 1 2 3 4 5; do
  echo "=== Run $i ==="
  npx playwright test --project=chromium --retries=0 e2e/accessibility.spec.ts 2>&1 | tail -5
done
```

Expected: 5/5 passes.

- [ ] **Step 5: Verify zero remaining**

Run: `grep -c waitForTimeout e2e/accessibility.spec.ts`
Expected: `0`.

- [ ] **Step 6: Commit**

```bash
git add e2e/accessibility.spec.ts
git commit -m "test(e2e): drop waitForTimeout in accessibility.spec, use readiness signals"
```

---

### Task 6: Sweep `e2e/launcher.spec.ts` (4 `waitForTimeout` + 2 `force: true`)

**Files:**
- Modify: `e2e/launcher.spec.ts`

**Why:** Two distinct anti-patterns here. The `waitForTimeout(400|500)` calls are sleeping through the launcher's 220 ms entrance/exit animation — these become correct after Phase 3 adds `data-animation-state` (and tests can `expect(page.getByTestId('launcher')).toHaveAttribute('data-animation-state', 'idle')`). For *now*, replace each with `not.toBeAttached` for the dismissal case (the launcher unmounts after the exit animation) and a visibility assertion for the entrance case.

The `force: true` clicks at lines ~95 and ~101 paper over a search-results-dropdown z-50 intercept. The fix already lives one line up: `await expect(page.getByTestId('search-results')).not.toBeAttached({ timeout: 5_000 })` waits for the dropdown to leave the DOM. Once that line passes, the `force: true` is unnecessary. Drop it.

- [ ] **Step 1: Inspect existing sites**

Run: `grep -n "waitForTimeout\|force: true" e2e/launcher.spec.ts`
Expected: 6 matches.

- [ ] **Step 2: Drop the `force: true` clicks (lines ~95 and ~101)**

Find the `dismissing + closing a country panel does NOT re-show launcher` test. Replace these two lines:

```ts
    await franceOption.click({ force: true })
    // ...
    await page.getByTestId('panel-close').click({ force: true, timeout: 15_000 })
```

with:

```ts
    await franceOption.click()
    // ...
    await page.getByTestId('panel-close').click()
```

The pre-existing `await expect(page.getByTestId('search-results')).not.toBeAttached({ timeout: 5_000 })` between them already ensures the dropdown isn't intercepting.

- [ ] **Step 3: Replace remaining `waitForTimeout` calls with state-based waits**

For each `await page.waitForTimeout(N)` in the file: identify what state the test is waiting for, and replace with the matching assertion. The four common shapes here:

| Context | Replacement |
|---|---|
| After `launcher-dismiss.click()` waiting for the launcher to be gone | `await expect(page.getByTestId('launcher')).not.toBeAttached()` |
| After opening a panel waiting for it to be ready | `await expect(panel).toBeVisible()` |
| After `freshTab` waiting for the launcher to mount | `await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })` |
| Anywhere else | Determine what state the next assertion depends on; wait for *that* state explicitly |

- [ ] **Step 4: Run 5× locally**

```bash
for i in 1 2 3 4 5; do
  echo "=== Run $i ==="
  npx playwright test --project=chromium --retries=0 e2e/launcher.spec.ts 2>&1 | tail -5
done
```

Expected: 5/5 passes.

- [ ] **Step 5: Verify zero remaining**

Run: `grep -c "waitForTimeout\|force: true" e2e/launcher.spec.ts`
Expected: `0`.

- [ ] **Step 6: Commit**

```bash
git add e2e/launcher.spec.ts
git commit -m "test(e2e): drop waitForTimeout + force:true in launcher.spec"
```

---

### Task 7: Sweep `e2e/theme-and-responsive.spec.ts` (3 sites)

**Files:**
- Modify: `e2e/theme-and-responsive.spec.ts`

**Why:** 3 sites; small file.

- [ ] **Step 1: Read the file and identify each waitForTimeout's purpose**

```bash
grep -n -B 2 -A 2 "waitForTimeout" e2e/theme-and-responsive.spec.ts
```

For each match, identify what the next assertion checks. That's what the wait is for.

- [ ] **Step 2: Replace each site with an assertion that polls**

Apply Pattern 1 from `docs/superpowers/specs/2026-04-25-e2e-timing-sweep-design.md`. Drop the `waitForTimeout`; the next assertion's implicit timeout absorbs the wait.

- [ ] **Step 3: Run 5× locally**

```bash
for i in 1 2 3 4 5; do
  echo "=== Run $i ==="
  npx playwright test --project=chromium --retries=0 e2e/theme-and-responsive.spec.ts 2>&1 | tail -5
done
```

- [ ] **Step 4: Verify zero remaining + commit**

```bash
grep -c waitForTimeout e2e/theme-and-responsive.spec.ts
# Expected: 0
git add e2e/theme-and-responsive.spec.ts
git commit -m "test(e2e): drop waitForTimeout in theme-and-responsive.spec"
```

---

### Task 8: Sweep `e2e/daily-puzzle.spec.ts` (2 sites)

**Files:**
- Modify: `e2e/daily-puzzle.spec.ts`

**Why:** Two `waitForTimeout(1500)` calls live in the "panel suppressed for intermediate attempts 1 + 2" test (around lines 127 and 137). The intent is "give the round-end panel time to NOT appear" — but `not.toBeAttached({ timeout: N })` does that explicitly without arbitrary delay.

**Note: this is *not* the file's "clicking Play" test that failed in the most recent CI run.** That test uses a file-local `submitAndWait` helper which polls correctly; its failure was a real CI-load-induced timeout on Software ANGLE, not an anti-pattern. Phase 1's Software-ANGLE drop is what fixes that one. Task 8 fixes a separate latent flake in the same file.

- [ ] **Step 1: Locate the test**

```bash
grep -n "waitForTimeout" e2e/daily-puzzle.spec.ts
```

Expected: 2 matches in the test `daily country-pinning: panel suppressed for intermediate attempts 1 + 2`.

- [ ] **Step 2: Replace each `waitForTimeout(1500)` with `not.toBeAttached`**

Pattern:

```ts
    // Before
    await page.evaluate(() => { /* submitCountryGuess */ })
    await page.waitForTimeout(1500)
    await expect(page.getByTestId('country-panel')).not.toBeAttached()

    // After
    await page.evaluate(() => { /* submitCountryGuess */ })
    // The panel must NOT appear during the intermediate-reveal window. We
    // give it 2 s to incorrectly mount; if it doesn't, the assertion passes.
    await expect(page.getByTestId('country-panel')).not.toBeAttached({ timeout: 2_000 })
```

`not.toBeAttached({ timeout: 2_000 })` waits up to 2 s for the locator to be absent. If the panel does appear during that window, the assertion fails immediately. The 1500 ms hard wait is replaced with a 2 s deterministic check.

- [ ] **Step 3: Verify + commit**

```bash
grep -c waitForTimeout e2e/daily-puzzle.spec.ts
# Expected: 0
git add e2e/daily-puzzle.spec.ts
git commit -m "test(e2e): drop waitForTimeout in daily-puzzle intermediate-attempt test"
```

---

### Task 9: Sweep `e2e/panel-focus.spec.ts`, `e2e/mobile-tap.spec.ts`, `e2e/daily-streak.spec.ts` (1 site each)

**Files:**
- Modify: `e2e/panel-focus.spec.ts`
- Modify: `e2e/mobile-tap.spec.ts`
- Modify: `e2e/daily-streak.spec.ts`

**Why:** One `waitForTimeout` each. Apply Pattern 1.

- [ ] **Step 1: For each file, locate and replace**

```bash
for f in e2e/panel-focus.spec.ts e2e/mobile-tap.spec.ts e2e/daily-streak.spec.ts; do
  echo "=== $f ==="
  grep -n -B 2 -A 2 "waitForTimeout" "$f"
done
```

For each match, replace the `waitForTimeout(N)` line with an assertion that polls for the state the test then checks. Pattern 1 from the timing-sweep spec.

- [ ] **Step 2: Run each spec 3× locally**

```bash
for f in panel-focus mobile-tap daily-streak; do
  for i in 1 2 3; do
    echo "=== $f run $i ==="
    npx playwright test --project=chromium --retries=0 e2e/$f.spec.ts 2>&1 | tail -3
  done
done
```

- [ ] **Step 3: Verify + commit**

```bash
grep -c waitForTimeout e2e/panel-focus.spec.ts e2e/mobile-tap.spec.ts e2e/daily-streak.spec.ts
# Expected: 0:0:0 across the three files
git add e2e/panel-focus.spec.ts e2e/mobile-tap.spec.ts e2e/daily-streak.spec.ts
git commit -m "test(e2e): drop waitForTimeout in panel-focus, mobile-tap, daily-streak"
```

---

### Task 10: Phase 2 verification — full suite, 5× consecutive

**Files:** none

- [ ] **Step 1: Confirm zero `waitForTimeout` and `force: true` remain in `e2e/`**

Run: `grep -rn "waitForTimeout\|force: true" e2e/*.spec.ts | wc -l`
Expected: `0`.

If nonzero, the residual file got missed in a sweep — patch and retry.

- [ ] **Step 2: Run full e2e suite 5× consecutively, retries=0**

```bash
for i in 1 2 3 4 5; do
  echo "=== Run $i ==="
  npx playwright test --retries=0 --workers=2 2>&1 | tail -5
done
```

Expected: 5/5 runs report `XX passed` with **zero failures and zero flakes** in any project.

- [ ] **Step 3: If flakes remain — escalation gate**

Per CLAUDE.md: do not retry. Read the trace, identify the residual anti-pattern, fix, re-run. The escalation rule from `docs/superpowers/plans/2026-04-22-deflake-chromium-e2e.md`: if local 10× green but CI red, the test is making an assumption your local env happens to satisfy. Don't paper over with retries — fix the assumption.

- [ ] **Step 4: Push and open Phase 2 PR**

```bash
git push -u origin test/e2e-anti-pattern-sweep
gh pr create --base main --title "test(e2e): sweep waitForTimeout + force:true anti-patterns from spec suite" --body "$(cat <<'EOF'
## Summary
Replaces all 36 `waitForTimeout(N)` and `force: true` anti-pattern sites across 8 spec files with state-based waits per docs/superpowers/specs/2026-04-25-e2e-timing-sweep-design.md Patterns 1-5.

## Why
docs/superpowers/notes/2026-04-28-flake-regression-analysis.md Recommendation B: the original 2026-04-22 deflake was load-time-only; per-test waitForTimeout calls and force:true clicks were never removed; new tests followed the same patterns and the cumulative flake rate climbed back over CI tolerance.

## Test plan
- [ ] grep -c "waitForTimeout|force: true" e2e/*.spec.ts → 0
- [ ] 5 consecutive CI runs green
- [ ] Full local e2e suite 5× green with retries=0

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# Phase 3 — Component animation signals

**Branch:** `feat/component-animation-signals` (off `main` after Phase 2 merges)
**Target merge:** `main`

```bash
git checkout main && git pull
git checkout -b feat/component-animation-signals
```

---

### Task 11: Add `data-animation-state` to `Launcher`

**Files:**
- Modify: `src/components/Launcher.tsx`

**Why:** The launcher modal animates in via multiple staggered CSS animations (`launcher-backdrop-in 220ms`, `launcher-card-in 220ms` × 2 cards with 120/180 ms delays, `launcher-text-in 240ms` with 60 ms delay). Tests currently sleep through these via `waitForTimeout(400|500)` — itself a magic number that drifts when CSS changes. The fix replaces the magic number with the browser's own `Element.getAnimations({ subtree: true })` API: ask the DOM what animations are running and wait for *them*.

This avoids the anti-pattern of replacing a test-side magic number with an equally-fragile component-side magic number.

- [ ] **Step 1: Read the current Launcher imports**

Confirm `useState` and `useEffect` are imported. They are (line 1: `import { useCallback, useEffect, useMemo, useRef, useState } from 'react'`).

- [ ] **Step 2: Add animation state derived from the DOM's own animations**

Near the top of the `Launcher` function, after the existing `useRef` declarations:

```tsx
const [animationState, setAnimationState] = useState<'entering' | 'idle'>('entering')

useEffect(() => {
  const root = rootRef.current
  if (!root) {
    setAnimationState('idle')
    return
  }
  const animations = root.getAnimations({ subtree: true })
  if (animations.length === 0) {
    setAnimationState('idle')
    return
  }
  let cancelled = false
  Promise.all(animations.map((a) => a.finished))
    .then(() => { if (!cancelled) setAnimationState('idle') })
    .catch(() => { /* animation cancelled (component unmounted); ignore */ })
  return () => { cancelled = true }
}, [])
```

The `cancelled` flag prevents a `setState` after unmount. `getAnimations({ subtree: true })` is supported in Chromium 84+, Safari 13.1+, Firefox 75+ — well within the project's browser matrix.

- [ ] **Step 3: Apply the attribute to the root element**

Find the existing `<div data-testid="launcher">` wrapper. Add `data-animation-state={animationState}` to it.

- [ ] **Step 4: Verify rendering in devtools**

Run: `npm run dev`, open `/`, inspect the `[data-testid="launcher"]` element in DevTools' Elements panel. The attribute should start `entering` and flip to `idle` within ~300-400 ms (whichever the longest animation is). Refresh once to confirm reproducibility.

If the attribute never flips to `idle`, an animation is hanging — investigate via DevTools' Animations panel.

- [ ] **Step 5: Run unit tests**

```
npm run test:unit
```

Expected: still green; the change is additive.

- [ ] **Step 6: Commit**

```bash
git add src/components/Launcher.tsx
git commit -m "feat(launcher): expose data-animation-state via getAnimations() for e2e"
```

---

### Task 12: Add `data-animation-state` to `CountryPanel`

**Files:**
- Modify: `src/components/CountryPanel.tsx`

**Why:** Same justification as Task 11; mirror the same DOM-driven implementation rather than guessing a slide-in duration.

- [ ] **Step 1: Read the current CountryPanel**

```
grep -n "useState\|useEffect\|useRef\|data-testid=\"country-panel\"" src/components/CountryPanel.tsx | head
```

Identify the root element with `data-testid="country-panel"` and confirm `useState` / `useEffect` / `useRef` are imported.

- [ ] **Step 2: Add animation state via `getAnimations()`**

Near the top of the component:

```tsx
const panelRootRef = useRef<HTMLElement>(null)  // adjust type if existing root ref differs
const [animationState, setAnimationState] = useState<'entering' | 'idle'>('entering')

useEffect(() => {
  const root = panelRootRef.current
  if (!root) {
    setAnimationState('idle')
    return
  }
  const animations = root.getAnimations({ subtree: true })
  if (animations.length === 0) {
    setAnimationState('idle')
    return
  }
  let cancelled = false
  Promise.all(animations.map((a) => a.finished))
    .then(() => { if (!cancelled) setAnimationState('idle') })
    .catch(() => {})
  return () => { cancelled = true }
}, [])
```

If `CountryPanel` already has a root ref (likely — it does focus management), reuse it; don't add a duplicate.

- [ ] **Step 3: Apply the attribute**

Find the root element with `data-testid="country-panel"`. Add `data-animation-state={animationState}`.

- [ ] **Step 4: Verify rendering**

Run: `npm run dev`, click a country, inspect the panel. Confirm the attribute transitions `entering → idle` after the slide-in completes.

- [ ] **Step 5: Run unit tests + type-check**

```
npm run test:unit && npm run build
```

Expected: green / clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/CountryPanel.tsx
git commit -m "feat(panel): expose data-animation-state via getAnimations() for e2e"
```

---

### Task 13: Add `waitForAnimationIdle(locator)` helper

**Files:**
- Modify: `e2e/helpers.ts`

**Why:** Centralise the polling logic. Tests can write `await waitForAnimationIdle(page.getByTestId('launcher'))` and never touch a `waitForTimeout` again.

- [ ] **Step 1: Append the helper to `e2e/helpers.ts`**

Add at the end of the file (after `routeMapTiles` or wherever the cleanup section sits):

```ts
/**
 * Wait until an animated element's `data-animation-state` attribute equals
 * 'idle'. The component is responsible for setting this attribute after its
 * entrance / exit animation completes. Replaces brittle `waitForTimeout(N)`
 * patterns that sleep through CSS transitions.
 *
 * Currently consumed by: launcher (Task 11), country-panel (Task 12),
 * search-results dropdown (Task 14 if applied to SearchBar).
 */
export async function waitForAnimationIdle(
  locator: ReturnType<Page['locator']>,
  timeout = 5_000,
): Promise<void> {
  await expect(locator).toHaveAttribute('data-animation-state', 'idle', { timeout })
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc -b --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add e2e/helpers.ts
git commit -m "test(e2e): add waitForAnimationIdle helper"
```

---

### Task 14: Update CLAUDE.md to make `data-animation-state` the canonical pattern

**Files:**
- Modify: `CLAUDE.md`

**Why:** CLAUDE.md is what future contributors (human or agentic) read. Codify the new pattern.

- [ ] **Step 1: Locate the "Sleeping through CSS transitions" section**

```bash
grep -n "Sleeping through CSS transitions\|data-animation-state\|Required patterns" CLAUDE.md
```

- [ ] **Step 2: Update the section**

Find the existing "Sleeping through CSS transitions" forbidden-pattern block and update it to point to the new helper:

```markdown
**❌ Sleeping through CSS transitions.** A `transition: opacity 300ms` or `animation: fade-in 260ms` is wallclock-non-deterministic on slow CI. Don't `waitForTimeout(400)` to ride out an animation:

```ts
// ❌ Don't
await page.getByTestId('launcher-dismiss').click()
await page.waitForTimeout(500) // wait for fade-out

// ✅ Do — wait for the element to actually leave the DOM
await page.getByTestId('launcher-dismiss').click()
await expect(page.getByTestId('launcher')).not.toBeAttached()
```

If the component conditionally renders during animation (e.g. `<AnimatePresence>`), `not.toBeAttached` works. **If the component stays mounted during animation, use the `data-animation-state` attribute** that the launcher / country-panel / search-results components expose, and wait on it via the helper:

```tsx
// in component
<div data-testid="my-modal" data-animation-state={state}>...</div>

// in test
import { waitForAnimationIdle } from './helpers'
await waitForAnimationIdle(page.getByTestId('my-modal'))
```

The component is responsible for setting `data-animation-state="idle"` after its entrance animation completes (typically a `setTimeout` matching the CSS animation duration plus a settle margin). Tests never guess durations; the signal is authoritative.
```

Also add `waitForAnimationIdle(locator)` to the Required-patterns table:

```markdown
| `waitForAnimationIdle(locator)` | After an animated component enters or before clicking through it — replaces `waitForTimeout(N)` for CSS-transition timing |
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): codify data-animation-state + waitForAnimationIdle pattern"
```

---

### Task 15: Phase 3 verification + push

- [ ] **Step 1: Run unit + e2e suites locally**

```bash
npm run test:unit && npm run test:e2e --workers=2
```

Expected: green; no test relies on the `data-animation-state` attribute yet (tests can be migrated incrementally), so this is a no-regression check.

- [ ] **Step 2: Push and open Phase 3 PR**

```bash
git push -u origin feat/component-animation-signals
gh pr create --base main --title "feat(e2e): data-animation-state on launcher/panel/search; waitForAnimationIdle helper; CLAUDE.md update" --body "$(cat <<'EOF'
## Summary
- Adds data-animation-state="entering|idle|exiting" to Launcher, CountryPanel, SearchBar
- Adds waitForAnimationIdle(locator) helper to e2e/helpers.ts
- CLAUDE.md updated to make this the canonical solution to "sleeping through CSS transitions"

## Why
After the Phase 1 + Phase 2 deflake work, the last category of fragile timing assumption is CSS-transition duration guessing. data-animation-state moves the timing decision into the component (which knows its own animation length) and gives tests a deterministic signal.

## Test plan
- [ ] All existing tests still green (additive change; no test migrations in this PR)
- [ ] data-animation-state visibly transitions in devtools
- [ ] CLAUDE.md update reads coherently

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

After Phase 3 merges, individual specs can be migrated to use `waitForAnimationIdle` opportunistically — that's not a single dedicated PR, but rather a "while you're in this file anyway" cleanup pattern.

---

## What this plan does NOT cover

- **The `launcher.spec.ts:210` Tab-cycle focus-order bug** flagged in `2026-04-22-chromium-flake-diagnosis.md` and again as Recommendation C of the 2026-04-28 note. That's a real focus-trap-order issue in `Launcher.tsx`, not a timing flake. File a separate plan for it.
- **Migration of existing specs to use `waitForAnimationIdle`.** Phase 3 ships the infrastructure; migrations are a slow-roll cleanup, not a single PR. Tasks 4–9 already eliminate the `waitForTimeout` sites that would have benefited.
- **Search-results dropdown `data-animation-state`.** Phase 3 covers Launcher and CountryPanel — the highest-impact components per the regression note. SearchBar dropdown is a smaller scope and can be added later without breaking anything.

---

## Self-review notes (run by plan author)

**Spec coverage:** Recommendation B from the 2026-04-28 note → Tasks 4–10. Recommendation D → Tasks 1–3. Recommendation A (CLAUDE.md) is already done in commit `9558350`; Task 14 augments it. Recommendation C (focus-order bug) is explicitly out of scope above.

**Revision log (critical-review pass after first draft):**
- **Tasks 11–12 rewritten** to use `Element.getAnimations({ subtree: true })` instead of a hardcoded `setTimeout(400)` / `setTimeout(350)`. The first draft replaced one magic number (test-side `waitForTimeout`) with another (component-side `setTimeout`) — same anti-pattern, different file. The browser's animation API is the authoritative source.
- **Task 8 wording tightened** to clarify that the file-local sweep targets the suppression test, not the "clicking Play" test that actually failed in the recent CI run. The latter is fixed by Phase 1's Software-ANGLE drop, not by removing `waitForTimeout`s.
- **Phase 1 framing softened**: the first draft claimed Phase 1 alone unblocks PR #28. Honest framing: it's the largest single contributor and *probably* unblocks #28, but the durable fix is Phases 1+2 together.
- **SearchBar removed from Phase 3 file structure**: the first draft listed it but had no task implementing it. The launcher.spec.ts dropdown-intercept failure is already addressed by Task 6's `not.toBeAttached` line; SearchBar `data-animation-state` would be a future addition, not part of this plan.
- **Task 2 made concrete**: the first draft said "if the workflow uses --reporter=blob, also update the merge-reports job" without specifying. After reading the actual workflow, I documented the exact lines and confirmed `merge-reports` keeps working with one matrix entry.

**Placeholder scan:** None. Every step has a concrete command, file path, and code block. The `/* … */` JSX comments in Tasks 11/12 indicate "the existing JSX is preserved" (JSX-spread shorthand pattern from this codebase), not a placeholder for the implementer.

**Type consistency:** `animationState` is the state variable name in Tasks 11 and 12. `data-animation-state` is the attribute name across Tasks 11/12/14. `waitForAnimationIdle` is the helper name across Tasks 13 and 14. The `'entering' | 'idle'` union is the same shape across Tasks 11/12 (no `'exiting'` variant — exit animations aren't part of this plan).

**Risk callouts:**
- Task 1 changes which specs run on real-GPU ANGLE. ~20 DOM-only specs that previously ran on Software ANGLE will run on real-GPU ANGLE; they don't depend on GPU rendering, so this should be a no-op behaviourally. If any spec relies on Software-ANGLE-specific behaviour (very unlikely but possible), it'll surface in Task 1's verification.
- Task 2 modifies CI workflow YAML. The matrix entry change is one line; visual indentation check is in Step 3.
- Tasks 11–12 use `Element.getAnimations({ subtree: true })`, supported in Chromium 84+, Safari 13.1+, Firefox 75+. Project's browser matrix is well above these. If any test runs in a browser without support, the launcher attribute would never flip to `idle`. The promise's `.catch()` handles cancellation; the unmount-cleanup `cancelled` flag prevents `setState`-after-unmount warnings.
- Task 14 modifies CLAUDE.md, which is read at every session start. The change is additive (rule strengthened, helper added).

**Honest scope:** Phase 3's component changes are small but touch production code, which is a different review category from Phases 1–2 (test config + test code only). Splitting into three PRs respects this separation. Each PR can be reviewed and merged independently; they're not blocked on each other beyond simple sequencing.
