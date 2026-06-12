# Chromium e2e flake triage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve PR #36's residual chromium e2e flakes through targeted, evidence-driven fixes — not blanket timeout bumps or test rewrites that violate CLAUDE.md.

**Architecture:** Four phases on the existing `feat/vision-audit-remediation` branch. Phase 1 is a known fix (replace the project's only remaining `waitForTimeout` with a state-based wait). Phases 2-3 are investigation-then-fix on two persistent failures whose root causes are hypothesised but unverified. Phase 4 is observational — watch 5 consecutive CI runs as the gate before declaring done.

**Tech Stack:** Playwright e2e specs, Vite/React app, MapLibre GL JS, GitHub Actions CI, ubuntu-latest runners with Software ANGLE (no real GPU — that's a separate roadmap item).

**Source spec:** `docs/superpowers/specs/2026-05-05-flake-triage-design.md`.

---

## File structure

| File | Phase | Operation | Responsibility |
|---|---|---|---|
| `e2e/helpers.ts` | 1 | Modify (line ~149) | Replace `waitForTimeout(150)` in `dismissLauncher` with deterministic Header-mounted wait |
| `e2e/helpers.ts` | 2 | Read (the `routeMapTiles*` exports) | Understand stub coverage of light-positron tile URLs |
| `e2e/label-contrast.spec.ts` | 2 | Maybe-modify | Either drop `routeMapTilesRich` (if test doesn't need network stub) or extend the stub |
| `e2e/helpers.ts` | 2 | Maybe-modify | If stub needs broader coverage, extend `routeMapTilesRich` |
| `src/components/SingleCountryPanel.tsx` | 3 | Maybe-modify | If trace shows component-side bug in animation-state effect, fix here (deps, ref-init race, stale closure) |
| `e2e/panel-focus.spec.ts` | 3 | Maybe-modify | If trace shows simply slow CI (not a real bug), bump `waitForAnimationIdle` timeout with measurement-justified comment |
| `e2e/helpers.ts` | 3 | Maybe-modify | If `waitForAnimationIdle` itself needs more diagnostic on failure, extend it |

Phases 2-3 list "Maybe-modify" because the fix path branches on what investigation reveals. Each task in Phases 2-3 has decision points written into the steps.

---

## Task 1: Replace `dismissLauncher`'s `waitForTimeout(150)` with Header-attached wait

**Files:**
- Modify: `e2e/helpers.ts:140-150` (the `dismissLauncher` function)
- Verify-against (no edits): `e2e/theme-and-responsive.spec.ts`

**Diagnosis recap:** `helpers.ts:149` has `await page.waitForTimeout(150)` after `expect(launcher).not.toBeAttached()`. Comment-implied purpose is to let the Header re-mount (Header returns `null` while launcher is visible per Phase 3.2). On 5-10× slower CI, 150 ms races the Header re-mount, causing later interactions on Header children (e.g. `theme-toggle`) to miss.

The fix is a state-based wait on a Header child. The search input has `id="search-input"` and renders only when Header is mounted. Wait for it.

- [ ] **Step 1: Read the current `dismissLauncher` body**

Run: `Read e2e/helpers.ts`, focus on lines 138-150.

Confirm the current shape:
```ts
export async function dismissLauncher(page: Page): Promise<void> {
  await waitForAppReady(page)
  const launcher = page.getByTestId('launcher')
  if (!(await launcher.isVisible())) {
    return
  }
  await page.getByTestId('launcher-dismiss').click()
  await expect(launcher).not.toBeAttached({ timeout: 5_000 })
  await page.waitForTimeout(150)
}
```

Verify the search input is the right Header child to wait on:

Run: `Grep -n 'id="search-input"' src/components/SearchBar.tsx` (or wherever it's defined).

Expected: a single match on a `<input id="search-input" ...>` line in `SearchBar.tsx`.

- [ ] **Step 2: Replace the `waitForTimeout(150)` with the deterministic wait**

Edit `e2e/helpers.ts:149`:

```ts
// before
await page.waitForTimeout(150)

// after
// Header is conditionally rendered (returns null while launcher is visible).
// Wait for a known Header child to be attached before returning so callers'
// next interaction (e.g. clicking theme-toggle) doesn't race the re-mount.
await page.locator('#search-input').waitFor({ state: 'attached', timeout: 5_000 })
```

- [ ] **Step 3: Run the existing `theme-and-responsive` spec locally to verify the fix**

Run: `npx playwright test e2e/theme-and-responsive.spec.ts --project=chromium --workers=2 --retries=0 --repeat-each=10`

Expected: 30 PASSED (3 tests × 10 repeats), 0 FAILED, 0 FLAKY.

If any flake appears, the diagnosis was wrong or incomplete. STOP and inspect the failure trace before proceeding.

- [ ] **Step 4: Run the `dismissLauncher`-using specs as a regression check**

Run: `npx playwright test e2e/launcher.spec.ts e2e/launcher-card-loading-states.spec.ts e2e/launcher-backdrop-dismiss.spec.ts e2e/panel-and-deeplink.spec.ts e2e/search.spec.ts --project=chromium --workers=2 --retries=0`

Expected: all PASS. The change is a tightening (deterministic wait replaces sleep), so anything that passed before should still pass.

- [ ] **Step 5: Confirm the project's `waitForTimeout` count is now 0**

Run: `Grep "waitForTimeout" e2e/`

Expected: only matches inside comments (e.g. helper docstrings describing what they replace). No live calls.

- [ ] **Step 6: Commit**

```bash
git add e2e/helpers.ts
git commit -m "fix(e2e/helpers): wait for Header re-mount deterministically in dismissLauncher

Replace the project's last waitForTimeout(150) with a state-based wait on
the search-input element (rendered only when Header is mounted). On
5-10x slower CI runners, 150ms could race the Header re-mount that
follows launcher dismissal, causing subsequent clicks on Header children
(theme-toggle, satellite-toggle, header-play) to miss.

Removes the last live waitForTimeout from the e2e suite."
```

---

## Task 2: Investigate `label-contrast.spec.ts:316` — read tile-stub helpers

**Files:**
- Read: `e2e/helpers.ts` (full `routeMapTiles` and `routeMapTilesRich` definitions)
- Read: `e2e/label-contrast.spec.ts:316-340` (the test setup)
- Read: `src/lib/mapStyles.ts` (to find the basemap style URL the app loads)

**Goal:** Understand what `routeMapTilesRich` actually stubs vs. what the light-theme positron basemap actually requests at runtime.

- [ ] **Step 1: Read `routeMapTilesRich` and `routeMapTiles`**

Run: `Grep -n "export.*routeMapTiles" e2e/helpers.ts` to find both function starts.

Run: `Read e2e/helpers.ts` covering both functions in full. Note:
- Which URL patterns are intercepted (`page.route('**/*.{ext}', ...)` shape)
- What responses they fulfill (empty, JSON style stub, blank PNG?)
- What the test invokes — `routeMapTilesRich(page)` or `routeMapTiles(page)`

- [ ] **Step 2: Read the spec's setup to confirm what's expected to load**

Run: `Read e2e/label-contrast.spec.ts` (lines 316-340 minimum).

Confirm:
- `await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'light'))`
- `await routeMapTilesRich(page)`
- `await page.goto('/')`
- `await waitForMapLoaded(page)` — waits for `[data-map-loaded]` 90 s

The spec is measuring paint properties on label layers — it does NOT need real map tiles to render; it only needs the basemap STYLE to load (which determines paint properties).

- [ ] **Step 3: Check what URL the light positron style fetches**

Run: `Grep -n "BASEMAP_STYLE\|positron" src/lib/mapStyles.ts`

Expected: a constant pointing at the OpenFreeMap positron style JSON URL (e.g. `https://tiles.openfreemap.org/styles/positron`).

The style JSON references many tile/sprite/glyph URLs internally. If the rich stub only intercepts `*.png` / `*.pbf` tiles but not the style JSON's sprite or glyph URLs, MapLibre may block.

- [ ] **Step 4: Reproduce the failure locally with `--project=chromium --workers=4`**

The spec passes in isolation locally (per pre-PR smoke). To reproduce CI conditions, increase parallelism to slow individual tests:

Run: `npx playwright test e2e/label-contrast.spec.ts --project=chromium --workers=4 --retries=0 --repeat-each=5`

Expected: most pass, but if the diagnosis is correct, occasionally `light + map view` flakes with the same `[data-map-loaded]` 90s timeout. If it doesn't reproduce locally, document and proceed to Step 5 anyway (CI is the authoritative environment).

- [ ] **Step 5: Decide the fix path based on findings**

Two clean options. Pick based on Step 3:

**Option A — Drop `routeMapTilesRich` from this spec.** The spec doesn't need network stubbing for paint-property measurement. The rich stub's purpose is unclear here.

```ts
// e2e/label-contrast.spec.ts:316 — DELETE the routeMapTilesRich line:
//   await routeMapTilesRich(page)
// Keep the spec's other setup (localStorage seed, goto, waitForMapLoaded).
```

**Option B — Extend `routeMapTilesRich` to cover the gap.** If the stub is intentional (some other test needs it), extend the route patterns to include the missing URLs from Step 3.

**Recommended: Option A** unless Step 3 reveals the test depends on stubbed tiles for some specific reason. Most paint-property measurement tests don't.

If you pick Option A, proceed to Task 3. If you pick Option B, see Step 6 below.

- [ ] **Step 6 (Option B only): Extend `routeMapTilesRich`**

Edit `e2e/helpers.ts` `routeMapTilesRich` to add patterns for the gap URLs (sprite, glyph, etc.) revealed in Step 3. Each new pattern routes to a stable, non-blocking response (empty PNG for sprites, empty pbf for tiles, etc.).

```ts
// inside routeMapTilesRich(page), add for each missing URL pattern:
await page.route(NEW_PATTERN, (route) =>
  route.fulfill({ status: 200, contentType: APPROPRIATE_TYPE, body: '' }),
)
```

Concrete shape depends on findings — implementer fills in `NEW_PATTERN` and `APPROPRIATE_TYPE` from Step 3 evidence.

---

## Task 3: Apply the chosen fix for label-contrast

Branch on Task 2 Step 5 outcome:

### Task 3A — Drop `routeMapTilesRich` (Option A path)

**Files:**
- Modify: `e2e/label-contrast.spec.ts:316-340`

- [ ] **Step 1: Remove the `routeMapTilesRich` call from the failing test**

Edit `e2e/label-contrast.spec.ts:316` block. Find:
```ts
test('light + map view: label paint properties set correctly', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'light'))
  await routeMapTilesRich(page)
  await page.goto('/')
  await waitForMapLoaded(page)
  ...
```

Change to:
```ts
test('light + map view: label paint properties set correctly', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'light'))
  await page.goto('/')
  await waitForMapLoaded(page)
  ...
```

Apply the same change to other `light + ...` and `dark + ...` tests in the file IF Task 2 confirmed the stub isn't needed for paint-property measurement. (If only the `light + map view` test was failing, and the others passed with the stub, leave the others alone.)

If `routeMapTilesRich` is no longer called anywhere in this spec file, remove the `import` line at the top:
```ts
// before:
import { routeMapTilesRich, ... } from './helpers'
// after:
import { ... } from './helpers'
```

- [ ] **Step 2: Run the failing test 10× locally**

Run: `npx playwright test e2e/label-contrast.spec.ts --project=chromium --workers=2 --retries=0 --repeat-each=10`

Expected: all pass (existing test count × 10 repeats).

- [ ] **Step 3: Run the file's full test suite to verify no other test broke**

If `routeMapTilesRich` was removed only from one test, the others should still pass. If it was removed from all tests, all should still pass.

Run: `npx playwright test e2e/label-contrast.spec.ts --project=chromium --retries=0`

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/label-contrast.spec.ts
git commit -m "fix(e2e/label-contrast): drop unneeded routeMapTilesRich

The light+map test waits for [data-map-loaded] but the rich tile stub
does not cover all URLs the light positron style fetches (sprite,
glyph) on first load — MapLibre blocks waiting for those, exceeding
the 90s timeout on slow CI. The spec measures paint properties, not
network behavior, and doesn't need the stub."
```

### Task 3B — Extend `routeMapTilesRich` (Option B path)

**Files:**
- Modify: `e2e/helpers.ts` (`routeMapTilesRich` function body)

- [ ] **Step 1: Extend the stub with the missing URL patterns**

Apply the changes drafted in Task 2 Step 6.

- [ ] **Step 2: Run the failing test 10× locally**

Run: `npx playwright test e2e/label-contrast.spec.ts --project=chromium --workers=2 --retries=0 --repeat-each=10`

Expected: all pass.

- [ ] **Step 3: Run all specs that use the rich stub to confirm no regression**

Run: `Grep -l "routeMapTilesRich" e2e/`

For each match, run that spec.

Run: `npx playwright test <each_spec> --project=chromium --retries=0`

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/helpers.ts
git commit -m "fix(e2e/helpers): extend routeMapTilesRich to cover light positron URLs

The previous patterns missed sprite/glyph URLs the light positron style
fetches; MapLibre blocked waiting for them, causing label-contrast's
light+map test to time out on slow CI."
```

---

## Task 4: Investigate `panel-focus.spec.ts:27` — pull CI trace

**Files:**
- Read: a Playwright trace from a failed CI run (downloaded artefact)
- Read: `src/components/SingleCountryPanel.tsx` (animation-state effect, lines ~85-110)
- Read: `e2e/helpers.ts` (`waitForAnimationIdle` function)

**Goal:** Determine WHICH of three hypotheses is correct: (a) stale closure in the effect, (b) mount-time race, (c) genuine CI slowness.

- [ ] **Step 1: Download a Playwright trace from a failed CI run**

The most recent failed run for this spec was in CI run `25381853202` (`feat/vision-audit-remediation`, e2e (chromium) job).

Run: `gh run download 25381853202 --pattern playwright-blob-chromium`

Or via UI: open the run, download the `playwright-blob-chromium` artifact, expand it locally.

- [ ] **Step 2: Open the trace for `panel-focus.spec.ts:27`**

Run: `npx playwright show-trace path/to/extracted/trace.zip` (the trace file for the specific test).

In the trace UI, look at:
- The DOM snapshot at the moment of timeout (just before the test fails)
- The value of `data-animation-state` on `country-panel` at that moment
- Whether `country-panel` is still attached
- Console / network panel for any errors

- [ ] **Step 3: Read the `SingleCountryPanel` animation effect**

Run: `Read src/components/SingleCountryPanel.tsx` lines 85-110 (or wherever the `useEffect` that sets `animationState` lives).

Confirm:
- The initial `useState` value (probably `'entering'`)
- The effect dependency array (should be `[]` — runs once on mount)
- The `requestAnimationFrame` + `Promise.all(animations.map(a => a.finished))` flow
- The `setTimeout(flipToIdle, 1000)` fallback
- Cleanup function

- [ ] **Step 4: Read `waitForAnimationIdle` helper**

Run: `Grep -n "waitForAnimationIdle" e2e/helpers.ts` and Read the function.

Confirm:
- It's polling on `data-animation-state === 'idle'` via `expect.poll`
- The default timeout
- Any short-circuit conditions

- [ ] **Step 5: Match trace evidence against hypotheses**

Decide which hypothesis fits:

| Trace evidence | Hypothesis | Fix path |
|---|---|---|
| `data-animation-state === 'entering'` at 30s timeout | Effect ran but neither animation completion nor 1s fallback fired | Component-side bug (closure / cleanup race). Investigate effect code. |
| `data-animation-state === ''` or attribute absent | Effect didn't run OR component re-mounted | Component-side mount race. Add stable mount signal. |
| `data-animation-state === 'idle'` (i.e., the test itself isn't actually failing on this assertion) | The poll's TIMEOUT was reached but state changed during the last ~100 ms | Test-side: increase poll timeout, document evidence |
| Other (panel detached, console error, etc.) | Different bug — investigate accordingly | Case-by-case |

Document your finding in a code comment that will accompany the fix.

---

## Task 5: Apply the chosen fix for panel-focus

Branch on Task 4 Step 5 outcome:

### Task 5A — Component-side fix (closure / cleanup / re-mount race)

**Files:**
- Modify: `src/components/SingleCountryPanel.tsx` (animation-state effect)

- [ ] **Step 1: Apply the targeted fix indicated by the trace**

The exact change depends on findings. Examples:

If stale closure on `setAnimationState`:
```ts
// before
useEffect(() => {
  let cancelled = false
  const flipToIdle = () => { if (!cancelled) setAnimationState('idle') }
  // ...
}, [])

// after — the closure was already correct here, this branch is unlikely
```

If re-mount during animation race:
```ts
useEffect(() => {
  let mounted = true
  // ... existing logic, but check mounted before setState
  return () => { mounted = false }
}, [])
```

Make the smallest correct change. Do NOT restructure the effect.

- [ ] **Step 2: Run the unit test for animation-state lifecycle**

Run: `npm run test:unit -- src/components/__tests__/SingleCountryPanel.test.tsx`

Expected: all pass. The unit suite already has lifecycle tests; the fix shouldn't break them.

- [ ] **Step 3: Run the e2e spec 10× locally**

Run: `npx playwright test e2e/panel-focus.spec.ts --project=chromium --workers=2 --retries=0 --repeat-each=10`

Expected: 10 passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/SingleCountryPanel.tsx
git commit -m "fix(SingleCountryPanel): <root cause from trace>

<one-paragraph explanation including the trace evidence that motivated
the fix>"
```

### Task 5B — Test-side fix (genuine CI slowness)

**Files:**
- Modify: `e2e/panel-focus.spec.ts:16` (the `waitForAnimationIdle` call)

Use this path ONLY if Task 4's trace shows `data-animation-state === 'idle'` was reached, just after the timeout.

- [ ] **Step 1: Bump `waitForAnimationIdle` timeout with measurement-based justification**

Edit `e2e/panel-focus.spec.ts:16`:

```ts
// before
await waitForAnimationIdle(panel, 30_000)

// after
// CI runs Software ANGLE on ubuntu-latest (no GPU); animation-finished
// Promises take ~Xms vs ~Yms locally, measured in trace from CI run NNNNN.
// 45s gives 1.5x headroom over observed CI duration.
await waitForAnimationIdle(panel, 45_000)
```

Replace `Xms`, `Yms`, and `NNNNN` with the actual measurements from the trace.

- [ ] **Step 2: Bump `test.setTimeout` accordingly**

Currently `test.setTimeout(90_000)` at line 4. The 15s focus poll + 45s animation idle + other steps may exceed 90s. Bump to 120s if measurements suggest it.

- [ ] **Step 3: Run the spec 10× locally**

Run: `npx playwright test e2e/panel-focus.spec.ts --project=chromium --workers=2 --retries=0 --repeat-each=10`

Expected: 10 passes.

- [ ] **Step 4: Commit**

```bash
git add e2e/panel-focus.spec.ts
git commit -m "fix(e2e/panel-focus): raise animation-idle timeout for Software ANGLE CI

CI run NNNNN trace shows data-animation-state takes ~Xms to flip to
'idle' under Software ANGLE (vs ~Yms locally). Previous 30s budget
left no headroom; 45s gives 1.5x over observed CI duration. Not a
component-side bug per trace inspection."
```

---

## Task 6: Push and start the 5-consecutive-green watch

**Files:**
- No file edits in this task. CI watch only.

- [ ] **Step 1: Confirm working tree is clean and on the right branch**

Run: `git status --short --untracked-files=no`

Expected: clean, on `feat/vision-audit-remediation`.

Run: `git log --oneline c86dd70..HEAD`

Expected: 1-3 commits from Tasks 1, 3, and 5 (depending on which branches were taken).

- [ ] **Step 2: Push**

Run: `git push origin feat/vision-audit-remediation`

Expected: clean push, no rejection.

- [ ] **Step 3: Trigger and watch CI run #1**

Run: `gh pr checks 36`

Expected: a new run pending. Note the run ID.

Run: `gh run watch <run_id> --exit-status`

Expected: watches until done. The exit code is informational; check actual results with `gh pr checks 36` after.

- [ ] **Step 4: Record results in a tracking note**

Open `docs/superpowers/notes/2026-05-05-flake-watch.md` (create if missing). Append:

```markdown
## Run 1 — <date> <time>

- run_id: <id>
- chromium e2e: <pass | fail (specs: list)>
- lint+unit: <pass | fail>
- merge-reports: <pass | fail>
- notes: <anything noteworthy>
```

If the run is GREEN: continue with run 2 (Steps 3-4 again).
If the run is RED: STOP. Diagnose the new failure with the same investigate-then-fix pattern as Tasks 2-5. Failures count toward "non-consecutive" — the green-run counter resets to 0.

- [ ] **Step 5: Repeat Steps 3-4 for runs 2-5**

Trigger each subsequent run (push a no-op commit OR `gh pr re-run`).

After 5 consecutive green runs are recorded in the watch note: the spec's acceptance criterion is met.

If after attempting to reach 5 consecutive green for an extended period (say > 10 total runs without 5-in-a-row), STOP. The residual flakes are environmental. Per the spec, the next move is option D (real GPU CI runner) — file as a roadmap item or open a separate issue, then declare this plan's work complete-with-known-limitations.

- [ ] **Step 6: Commit the watch note when 5-in-a-row is achieved (or escalation is recorded)**

```bash
git add docs/superpowers/notes/2026-05-05-flake-watch.md
git commit -m "docs(notes): flake-watch tracking — <5 green achieved | escalated to option D>"
```

---

## Self-review

**Spec coverage:**
- Phase 1 (`dismissLauncher` race) → Task 1 ✓
- Phase 2 (label-contrast investigation) → Task 2 + Task 3A/B ✓
- Phase 3 (panel-focus investigation) → Task 4 + Task 5A/B ✓
- Phase 4 (5 consecutive runs) → Task 6 ✓
- Out-of-scope items (preventive ESLint, self-hosted runner, cross-browser CI) → not in any task ✓
- Definition-of-done items: 0 `waitForTimeout` (Task 1 Step 5), 10× green per spec (Task 1 Step 3, Task 3 Step 2, Task 5 Step 3), 5 consecutive CI runs (Task 6 Step 5) ✓

**Placeholder scan:**
- Task 2 Step 6 has `NEW_PATTERN` / `APPROPRIATE_TYPE` placeholders — these are conditional on Step 3 findings. Documented as "implementer fills in from Step 3 evidence." Acceptable per spec's investigation-prefix design.
- Task 5A Step 1 has "<root cause from trace>" — same pattern, conditional on Task 4 findings.
- Task 5B Step 1 has `Xms`, `Yms`, `NNNNN` — same.
- All placeholders are in branches conditioned on findings; no flat "TODO" or "TBD."

**Type / signature consistency:**
- `dismissLauncher`'s signature unchanged (still `Page → Promise<void>`)
- `routeMapTilesRich` signature unchanged in either branch
- `waitForAnimationIdle` signature unchanged
- `data-animation-state` values referenced consistently (`entering`, `idle`)
- Test-id values referenced consistently (`country-panel`, `launcher`, `launcher-dismiss`, `theme-toggle`, `search-input`)

**Branching honest:** Tasks 3 and 5 split into 3A/3B and 5A/5B because the fix path genuinely depends on Task 2 / Task 4 findings. The plan doesn't pretend to know what's needed; investigation steps make the choice explicit. This matches the spec's "investigation-prefixed" framing.

No issues found. Plan is ready.
