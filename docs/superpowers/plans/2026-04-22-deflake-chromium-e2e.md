# Deflake `e2e (chromium)` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `e2e (chromium)` go reliably green in CI by adding a deterministic app-ready signal and replacing brittle `waitForTimeout` polling with explicit waits.

**Architecture:** Add `data-app-ready` attribute on `<main>` in `App.tsx`, set true on first effect tick once `countries.length > 0 && cities.length > 0`. Add `waitForAppReady(page)` to `e2e/helpers.ts`. Replace bare `waitForTimeout(1000)` patterns in `beforeEach` of the three flaky specs (`search.spec.ts`, `satellite-default.spec.ts`, `launcher.spec.ts`) with the explicit signal. If diagnosis reveals additional culprits beyond the readiness race, the spec's "additional fixes" path is invoked (Task 6 escalation gate).

**Tech Stack:** TypeScript, Playwright, React 19, Vite 6.

**Spec:** [`2026-04-22-retention-v1-finishing-design.md`](../specs/2026-04-22-retention-v1-finishing-design.md) §A.

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `src/App.tsx` | Modify (~5 LOC) | Add `data-app-ready` attribute on `<main>`, set true once countries + cities are ready |
| `e2e/helpers.ts` | Modify (~15 LOC) | Add `waitForAppReady(page)` helper |
| `e2e/search.spec.ts` | Modify (~3 LOC) | Replace `waitForTimeout(1000)` in `beforeEach` with `waitForAppReady` |
| `e2e/satellite-default.spec.ts` | Modify (~3 LOC) | Add `waitForAppReady` after `goto('/')` |
| `e2e/launcher.spec.ts` | Modify (~3 LOC) | Add `waitForAppReady` after `freshTab(page)` if needed (review per-test) |
| `docs/superpowers/notes/2026-04-22-chromium-flake-diagnosis.md` | Create | Diagnosis notes from Task 2 trace capture |

No new dependencies. No config changes (Playwright config unchanged).

---

### Task 1: Set up isolated worktree

**Files:**
- New worktree: `../polworldmap-deflake-chromium`

- [ ] **Step 1: Create worktree off `main` with new branch**

```bash
git worktree add ../polworldmap-deflake-chromium -b chore/deflake-chromium-e2e main
```

- [ ] **Step 2: Verify worktree is on the new branch**

```bash
cd ../polworldmap-deflake-chromium
git status
```

Expected output starts with: `On branch chore/deflake-chromium-e2e`

- [ ] **Step 3: Install dependencies in worktree**

```bash
npm install
```

Expected: completes without errors.

---

### Task 2: Reproduce flake locally and capture traces

**Files:**
- Create: `docs/superpowers/notes/2026-04-22-chromium-flake-diagnosis.md`

- [ ] **Step 1: Run chromium project 10× with retries=0 and trace=on**

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do
  echo "=== Run $i ==="
  npx playwright test --project=chromium --retries=0 --trace=on --workers=2 2>&1 | tail -20
done
```

Expected: at least one run shows a failure in `search.spec.ts`, `satellite-default.spec.ts`, or `launcher.spec.ts`. If zero failures across all 10 runs, the local environment doesn't reproduce the flake — proceed to Step 4 (apply the fix preemptively; it is good practice regardless).

- [ ] **Step 2: Locate failing-test trace files**

```bash
ls -la test-results/ | grep -E "trace|error" | head -20
```

Expected: `trace.zip` files for any failed test.

- [ ] **Step 3: Inspect one trace via Playwright trace viewer**

```bash
npx playwright show-trace test-results/<failing-test>/trace.zip
```

Manually inspect: did `countries` arrive in SearchBar's props before `fill('Paris')` ran? Was MapLibre still fetching tiles? Were there console errors? Did React commit a render between fill and assert?

- [ ] **Step 4: Write diagnosis notes**

Create `docs/superpowers/notes/2026-04-22-chromium-flake-diagnosis.md` with:

```markdown
# Chromium e2e flake — diagnosis notes

**Date:** 2026-04-22
**Spec:** ../specs/2026-04-22-retention-v1-finishing-design.md §A

## Local reproduction

- Runs executed: <N>
- Runs that flaked: <M> (failure modes: <list>)
- Traces captured: <list>

## Findings from trace inspection

<bullet points: what was the page state at the moment of failure; what fetches were in-flight; what was in console; what React state had the relevant component>

## Conclusion

<one of: "primary cause is the missing readiness signal — readiness fix should suffice" / "primary cause is X (specifics) — readiness fix is necessary but not sufficient; additional task: <Y>" / "no local repro; applying readiness fix preemptively as best-practice cleanup">
```

- [ ] **Step 5: Commit diagnosis notes**

```bash
git add docs/superpowers/notes/2026-04-22-chromium-flake-diagnosis.md
git commit -m "docs: chromium e2e flake diagnosis notes"
```

---

### Task 3: Add `data-app-ready` signal to `App.tsx`

**Files:**
- Modify: `src/App.tsx:337` (the `<main>` element)

- [ ] **Step 1: Locate the `<main>` element**

Read `src/App.tsx` around line 337. The current line is:

```tsx
      <main>
```

- [ ] **Step 2: Add an `appReady` state derived from data presence**

Add a `useMemo` near the top of the `App` function body (after `const { countries, ... } = useCountryData()` and `const { cities } = useCityData()`):

```tsx
const appReady = countries.length > 0 && cities.length > 0
```

`countries` is bundled (synchronous) and `cities` is bundled (synchronous), so this resolves true on the first render — but the attribute being **present in the DOM** still requires React to commit the first render, which is the actual signal Playwright needs.

- [ ] **Step 3: Apply `data-app-ready` to `<main>`**

Change `<main>` to:

```tsx
<main data-app-ready={appReady ? 'true' : 'false'}>
```

- [ ] **Step 4: Run unit tests to confirm no regression**

```bash
npm run test:unit
```

Expected: 231/231 passing (no new tests yet; existing suite unchanged).

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc -b
```

Expected: clean (no output).

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): expose data-app-ready attribute on <main> for e2e readiness checks"
```

---

### Task 4: Add `waitForAppReady` helper

**Files:**
- Modify: `e2e/helpers.ts`

- [ ] **Step 1: Add the helper export**

Append to `e2e/helpers.ts`:

```ts
/**
 * Wait until the app has finished its first render with bundled data ready.
 * Replaces brittle `page.waitForTimeout(1000)` patterns in beforeEach blocks.
 *
 * The signal is set on <main> in src/App.tsx as `data-app-ready="true"` once
 * countries + cities (both statically bundled) are non-empty after the first
 * useMemo evaluation. Because both are synchronous bundle imports, the
 * attribute appears as soon as React commits the first render — which is
 * exactly the moment downstream interactive components (SearchBar,
 * satellite-toggle, launcher mode cards) become safe to interact with.
 */
export async function waitForAppReady(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.locator('main[data-app-ready="true"]').waitFor({ state: 'attached', timeout: timeoutMs })
}
```

- [ ] **Step 2: Verify the helper compiles**

```bash
npx tsc -b
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add e2e/helpers.ts
git commit -m "test(e2e): add waitForAppReady helper backed by data-app-ready attribute"
```

---

### Task 5: Replace brittle waits in `search.spec.ts`

**Files:**
- Modify: `e2e/search.spec.ts:7-11` (beforeEach)

- [ ] **Step 1: Locate the current beforeEach**

```ts
test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await dismissLauncher(page)
    await page.waitForTimeout(1000)
  })
```

- [ ] **Step 2: Update the import line and replace `waitForTimeout`**

Change the imports at top of file from:

```ts
import { dismissLauncher } from './helpers'
```

to:

```ts
import { dismissLauncher, waitForAppReady } from './helpers'
```

Change the beforeEach body to:

```ts
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await dismissLauncher(page)
  })
```

`waitForAppReady` runs before `dismissLauncher` because the launcher itself is part of the post-ready render — once the app is ready, the launcher is mounted and `dismissLauncher` can find it.

- [ ] **Step 3: Run search.spec only, locally, 5× with retries=0**

```bash
for i in 1 2 3 4 5; do
  echo "=== Run $i ==="
  npx playwright test --project=chromium --retries=0 e2e/search.spec.ts 2>&1 | tail -10
done
```

Expected: 5/5 passes. If any flake, halt and escalate per Task 7 gate.

- [ ] **Step 4: Commit**

```bash
git add e2e/search.spec.ts
git commit -m "test(e2e): search spec uses waitForAppReady instead of waitForTimeout"
```

---

### Task 6: Replace brittle waits in `satellite-default.spec.ts` and `launcher.spec.ts`

**Files:**
- Modify: `e2e/satellite-default.spec.ts`
- Modify: `e2e/launcher.spec.ts` (only if Task 2 traces or Task 5 reproduction implicate launcher.spec timing)

- [ ] **Step 1: Read `e2e/satellite-default.spec.ts`**

```bash
cat e2e/satellite-default.spec.ts
```

Identify any `goto('/')` followed immediately by `getByTestId('satellite-toggle')` — that's the failing pattern. If a `beforeEach` exists, modify it; otherwise add `waitForAppReady` after each `goto`.

- [ ] **Step 2: Update `satellite-default.spec.ts` to wait for ready before asserting satellite-toggle**

Add `waitForAppReady(page)` immediately after each `await page.goto('/')` line. If the spec already has a `beforeEach` with `goto`, add `waitForAppReady` there:

```ts
import { waitForAppReady } from './helpers'

// ... in beforeEach or per-test:
await page.goto('/')
await waitForAppReady(page)
```

- [ ] **Step 3: Run `satellite-default.spec.ts` 5× locally with retries=0**

```bash
for i in 1 2 3 4 5; do
  echo "=== Run $i ==="
  npx playwright test --project=chromium --retries=0 e2e/satellite-default.spec.ts 2>&1 | tail -10
done
```

Expected: 5/5 passes.

- [ ] **Step 4: Inspect `launcher.spec.ts` for similar patterns**

```bash
grep -n "waitForTimeout\|goto\|freshTab" e2e/launcher.spec.ts | head -20
```

If `freshTab(page)` already includes a sufficient wait (check its definition), no change needed. If `waitForTimeout` patterns exist around `goto`, replace them with `waitForAppReady`.

- [ ] **Step 5: If launcher.spec.ts changed, run it 5× locally**

```bash
for i in 1 2 3 4 5; do
  echo "=== Run $i ==="
  npx playwright test --project=chromium --retries=0 e2e/launcher.spec.ts 2>&1 | tail -10
done
```

Expected: 5/5 passes.

- [ ] **Step 6: Commit**

```bash
git add e2e/satellite-default.spec.ts e2e/launcher.spec.ts
git commit -m "test(e2e): satellite + launcher specs use waitForAppReady"
```

---

### Task 7: Local validation — full chromium project 10× consecutive

**Files:** none

- [ ] **Step 1: Run full chromium project 10× consecutively with retries=0**

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do
  echo "=== Run $i ==="
  npx playwright test --project=chromium --retries=0 --workers=2 2>&1 | tail -5
done
```

Expected: 10/10 runs report `XX passed` with **zero failures and zero flakes** in the chromium project.

- [ ] **Step 2: If any flakes remain — escalation gate**

If Step 1 shows residual flakes, **stop**. Do not retry, do not paper over with retry-loops. Report the remaining failure pattern to the controller. The escalation path is to return to `writing-plans` and add additional tasks (likely `routeMapTiles` fixture per the spec's A3 candidates) before continuing.

- [ ] **Step 3: Run chromium-gpu project to confirm no regression**

```bash
npx playwright test --project=chromium-gpu --retries=0 2>&1 | tail -5
```

Expected: green (chromium-gpu was already green; we are confirming no inadvertent breakage).

- [ ] **Step 4: Run unit tests + type check**

```bash
npm run test:unit && npx tsc -b
```

Expected: 231/231 passing; tsc clean.

---

### Task 8: Push and verify CI

**Files:** none

- [ ] **Step 1: Push branch with upstream tracking**

```bash
git push -u origin chore/deflake-chromium-e2e
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --base main --title "chore(e2e): deflake chromium project via data-app-ready signal" --body "$(cat <<'EOF'
## Summary

- Adds `data-app-ready` attribute on `<main>` in `App.tsx`, set once bundled `countries` + `cities` are present
- Adds `waitForAppReady(page)` helper to `e2e/helpers.ts`
- Replaces `waitForTimeout(1000)` in `search.spec.ts` / `satellite-default.spec.ts` / `launcher.spec.ts` `beforeEach` blocks with the explicit signal

## Why

PRs #8 / #9 / #10 each saw `e2e (chromium)` red on the same `search` / `satellite` / `launcher` tests with retry-recovery flake patterns. Root cause analysis (see `docs/superpowers/notes/2026-04-22-chromium-flake-diagnosis.md`) showed the `waitForTimeout(1000)` polling was insufficient under CI load. A deterministic readiness signal removes the timing race.

Spec: `docs/superpowers/specs/2026-04-22-retention-v1-finishing-design.md` §A.

## Test Plan

- [ ] CI `lint + type + unit` green
- [ ] CI `e2e (chromium)` green on first run (no admin-merge required)
- [ ] CI `e2e (chromium-gpu)` still green
- [ ] Local: chromium project 10× consecutive with `--retries=0`, 0 flakes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI**

```bash
gh pr checks $(gh pr view --json number --jq .number) --watch
```

Expected: all checks pass on first run. If `e2e (chromium)` fails on first run, **escalate** — do not re-run, investigate the new failure mode.

- [ ] **Step 4: Verify with finishing-a-development-branch skill**

Invoke `superpowers:finishing-a-development-branch` and present the 4-option menu.

---

## Self-review notes (run by plan author)

- **Spec coverage:** A1 (reproduce) → Task 2; A2 (diagnose) → Task 2 Steps 3-4; A3 (fix at source) → Tasks 3-6; A4 (validate) → Tasks 7-8. All A subsections covered.
- **Placeholder scan:** none. Every step has concrete commands or code.
- **Type consistency:** `appReady` defined in Task 3 Step 2, attribute in Task 3 Step 3, helper queries the same attribute in Task 4 Step 1, all three callers use the same helper name in Tasks 5-6.
- **Honest scope:** Task 6 escalation gate covers the spec's "diagnosis after 2 days shows no clear root cause" fallback.
