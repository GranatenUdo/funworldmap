# Fix CI Bugs and Tune CI Performance

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn CI green. Fix five concrete bugs surfaced by the first GitHub Actions CI run and tune the Playwright e2e configuration so CI walltime drops from ~5.5 min to roughly half.

**Architecture:** Small, surgical fixes to `useTheme.ts`, `CountryPanel.tsx`, two e2e specs, and `playwright.config.ts`. No refactors, no new abstractions. Every task is scoped to one bug or one config knob, with a commit per task so any regression can be reverted cleanly.

**Tech Stack:** React 19 + Vite 6 + TypeScript + Tailwind 4, Vitest, Playwright, GitHub Actions.

**Scope out of this plan:** Adding new features, re-engineering responsive layout, adding network-stubbed tile mocks, splitting CI into parallel jobs (would increase billing), reworking the chromium-gpu Playwright project (the 7 skipped tests need a dedicated Linux-runner-with-GPU approach — separate plan).

---

## File Structure

**Files to modify:**
- `src/hooks/useTheme.ts` — default theme constant
- `src/components/CountryPanel.tsx` — add `data-testid` to the primary flag `<img>`
- `e2e/panel-and-deeplink.spec.ts` — use the new testid; add a narrower selector for the mobile-expand test
- `e2e/accessibility.spec.ts` — stabilize the axe scan with a deterministic wait
- `playwright.config.ts` — override `GITHUB_ACTIONS` env for the webServer and raise CI worker count

**Files NOT modified:**
- Production map/layout components (mobile-expand fix is test-only unless investigation shows otherwise)
- `.github/workflows/ci.yml` — the CI walltime improvement comes from Playwright config, not from changing the workflow

---

## Pre-flight

- [ ] **Step 0.1: Working tree clean, on `main`**

Run:
```bash
git status --short
git branch --show-current
```

Expected: clean working tree, current branch `main`. If dirty, stash or commit before starting.

- [ ] **Step 0.2: Local tests pass except the known CI failures**

Run (to establish a local baseline):
```bash
npm run test:unit
npx playwright test --project=chromium
```

Expected: unit 32/32 pass. E2E has the same pre-existing failures that CI flags (theme×4, panel-flag×1, panel-mobile-expand×1, potentially axe flake). `meta-and-static` passes locally because `GITHUB_ACTIONS` is unset — Task 1 is what makes it fail locally the same way it does in CI.

---

## Task 1: Fix robots.txt/sitemap.xml 404 under `GITHUB_ACTIONS=true`

**Files:**
- Modify: `playwright.config.ts`

**Rationale:** `vite.config.ts:7` sets the app's base path to `/funworldmap/` when `process.env.GITHUB_ACTIONS` is set. On GitHub Actions runners, that variable is always `true`, so Playwright's webServer (`npm run dev`) inherits it and serves `public/` files at `/funworldmap/robots.txt` instead of `/robots.txt`. The e2e test requests `/robots.txt` (because `baseURL` is `http://localhost:5173`) and gets a 404.

Fix: explicitly unset `GITHUB_ACTIONS` for the Playwright webServer. The deploy workflow still builds with `GITHUB_ACTIONS=true`, so the deployed site's base path remains correct — only the test dev-server is affected.

- [ ] **Step 1.1: Read current playwright.config.ts webServer block**

Run:
```bash
grep -A 4 "webServer" playwright.config.ts
```

Expected current shape:
```ts
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
```

- [ ] **Step 1.2: Add env override**

Modify `playwright.config.ts`. Replace the `webServer` block with:

```ts
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: {
      // Vite uses GITHUB_ACTIONS as a build-time signal to set base to
      // /funworldmap/ for GH Pages. During tests we serve from root, so
      // force it unset for the webServer child process.
      GITHUB_ACTIONS: '',
    },
  },
```

- [ ] **Step 1.3: Verify locally under simulated CI env**

Run:
```bash
GITHUB_ACTIONS=true npx playwright test meta-and-static --project=chromium
```

Expected: 6/6 pass. Without the fix, the `static files` tests fail on 404. With the fix, the webServer's `env` override clears `GITHUB_ACTIONS` before Vite evaluates `vite.config.ts`, so `base` stays `/`.

- [ ] **Step 1.4: Commit**

```bash
git add playwright.config.ts
git commit -m "fix(ci): unset GITHUB_ACTIONS for playwright webServer so public/ serves at root"
```

---

## Task 2: Fix default theme from `'dark'` to `'system'`

**Files:**
- Modify: `src/hooks/useTheme.ts`

**Rationale:** The test suite in `e2e/theme-and-responsive.spec.ts` expects the app's default theme to be `'system'` (so `aria-label` on the toggle button is "Switch to light mode" and no `dark` class is on `<html>` in a light-OS environment). The current default is `'dark'` — a two-character bug at `useTheme.ts:10` that breaks four tests.

- [ ] **Step 2.1: Verify the failing-test baseline**

Run:
```bash
npx playwright test theme-and-responsive.spec.ts --project=chromium --grep "defaults to system"
```

Expected: FAIL. The assertion `expect(hasDark).toBe(false)` returns `true` because the hook defaults to `'dark'` and applies `.dark` to `<html>`.

- [ ] **Step 2.2: Change the default**

Modify `src/hooks/useTheme.ts`. Current lines 7–11:

```ts
function getStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'dark'
}
```

Change the final line only. New:

```ts
function getStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}
```

- [ ] **Step 2.3: Verify all theme tests pass**

Run:
```bash
npx playwright test theme-and-responsive.spec.ts --project=chromium
```

Expected: 5/5 pass (was 1/5). The `respects prefers-color-scheme: dark` case (line 80) continues to pass because emulating `colorScheme: 'dark'` resolves `'system'` → `'dark'` → dark class applied.

- [ ] **Step 2.4: Unit tests still pass**

Run:
```bash
npm run test:unit
```

Expected: 32/32 pass. No unit tests exercise the theme default directly, so this is a sanity check.

- [ ] **Step 2.5: Commit**

```bash
git add src/hooks/useTheme.ts
git commit -m "fix(theme): default to system instead of dark when no preference stored"
```

---

## Task 3: Fix `panel shows flag image` strict-mode violation

**Files:**
- Modify: `src/components/CountryPanel.tsx`
- Modify: `e2e/panel-and-deeplink.spec.ts`

**Rationale:** The test at `e2e/panel-and-deeplink.spec.ts:21` selects `page.getByTestId('country-panel').locator('img')`. `CountryPanel.tsx` has three `<img>` sites — the desktop flag (line ~96), the mobile-sheet flag (line ~285), and neighbor-country chips (line ~461). Germany (`#DEU`) has 9 neighbors, so the locator resolves to 10 `img`s and Playwright's strict mode fails. Give the primary flag a `data-testid` and use it in the test.

- [ ] **Step 3.1: Read the primary flag `img` sites**

Run:
```bash
grep -n "src={country.flag}" src/components/CountryPanel.tsx
```

Expected: two results — the desktop flag (~line 96) and the mobile flag (~line 285). Neighbor images at ~line 461 use `src={neighbor.flag}`, so they won't appear in this grep.

- [ ] **Step 3.2: Add `data-testid="country-flag"` to both primary flag `img` tags**

Modify `src/components/CountryPanel.tsx`. Find the desktop flag block (around line 96):

```tsx
            <img
              src={country.flag}
              alt={country.flagAlt || `Flag of ${country.name.common}`}
```

Add the testid attribute:

```tsx
            <img
              data-testid="country-flag"
              src={country.flag}
              alt={country.flagAlt || `Flag of ${country.name.common}`}
```

Find the mobile flag block (around line 285) with the same `src={country.flag}` pattern and apply the same addition. Both primary flag images should carry the testid; neighbor chips should NOT.

Only one of the two is visible at a time (responsive layout), so `getByTestId('country-flag')` resolves to exactly one element regardless of viewport.

- [ ] **Step 3.3: Update the e2e test to use the testid**

Modify `e2e/panel-and-deeplink.spec.ts`. Current lines 21–23:

```ts
    const flag = page.getByTestId('country-panel').locator('img')
    await expect(flag).toBeAttached()
    await expect(flag).toHaveAttribute('src', 'flags/DE.svg')
```

Change to:

```ts
    const flag = page.getByTestId('country-panel').getByTestId('country-flag')
    await expect(flag).toBeAttached()
    await expect(flag).toHaveAttribute('src', 'flags/DE.svg')
```

- [ ] **Step 3.4: Verify the test passes**

Run:
```bash
npx playwright test panel-and-deeplink.spec.ts --project=chromium --grep "panel shows flag image"
```

Expected: PASS.

- [ ] **Step 3.5: Unit tests still pass**

Run:
```bash
npm run test:unit
```

Expected: 32/32 pass.

- [ ] **Step 3.6: Commit**

```bash
git add src/components/CountryPanel.tsx e2e/panel-and-deeplink.spec.ts
git commit -m "fix(panel): add data-testid to primary flag image to scope e2e locator"
```

---

## Task 4: Investigate and fix mobile-expand test

**Files:**
- Read: `src/components/CountryPanel.tsx` (understand structure)
- Modify: `e2e/panel-and-deeplink.spec.ts` OR `src/components/CountryPanel.tsx` depending on root cause

**Rationale:** The test at `e2e/panel-and-deeplink.spec.ts:130` asserts `panel.getByText('Population').not.toBeVisible()` in the mobile peek state (viewport 390×844). It fails because Population IS visible. There are two plausible root causes:

1. **Responsive layout leak** — `CountryPanel.tsx:131` and `:382` both render "Population". One should be hidden at mobile breakpoints and isn't.
2. **Test assumption drift** — the mobile peek state may have been redesigned to always show Population, and the test is stale.

The correct fix depends on which. Investigate first, then pick the minimal correction.

- [ ] **Step 4.1: Read the two Population render sites with context**

Run:
```bash
grep -n -B 2 -A 4 "Population" src/components/CountryPanel.tsx
```

Look at the enclosing JSX: are both under a responsive visibility guard (`hidden md:block`, `md:hidden`, etc.)? If one has no guard, that's the leak.

- [ ] **Step 4.2: Open the app at mobile viewport and inspect**

Run:
```bash
npm run dev
```

In a browser, open the app, set the DevTools device emulation to 390×844, and navigate to `#JPN`. Look at the DOM for the Country Panel:
- Is Population visible on screen in peek state?
- Which DOM subtree contains it — the desktop panel (often with `hidden lg:block` or similar) or the mobile sheet (often with `md:hidden`)?
- Is the expand button behavior correct when clicked (does it reveal a different Population instance)?

Based on what you see, proceed with **A** or **B** below, then stop the dev server.

- [ ] **Step 4.3A: If Population is leaking from the desktop panel on mobile**

This means the desktop panel's outer container lacks `hidden lg:block` (or similar). In `CountryPanel.tsx`, find the outer wrapper that contains the desktop DataCell at line ~382 and ensure it has a responsive-hide class. Example shape (adapt to the actual class stack already present):

```tsx
// Wrapper for the desktop layout block
<div className="hidden lg:block ...existing classes">
```

Then re-run the test:
```bash
npx playwright test panel-and-deeplink.spec.ts --project=chromium --grep "expand button"
```
Expected: PASS.

- [ ] **Step 4.3B: If the mobile peek state legitimately shows Population**

Then the test is stale — the peek state includes Population by design. Update the test to assert on a field that actually IS hidden in peek state (e.g., "Government" if the panel hides CIA Factbook fields until expanded).

Modify `e2e/panel-and-deeplink.spec.ts` lines 123–138. Determine from the dev-server inspection which field is hidden by default in peek state — call it `FIELD_X`. Rewrite the test:

```ts
  test('expand button shows secondary fields on mobile', async ({ page }) => {
    await page.goto('/#JPN')
    await page.waitForTimeout(1500)

    const panel = page.getByTestId('country-panel')

    // In peek state, secondary fields should not be visible (mobile)
    await expect(panel.getByText('FIELD_X')).not.toBeVisible()

    // Click expand
    await page.getByLabel('Expand panel').click()
    await page.waitForTimeout(500)

    // Now secondary fields should be visible
    await expect(panel.getByText('FIELD_X')).toBeVisible()
  })
```

Replace `FIELD_X` with the actual hidden-in-peek label you found during inspection.

Then re-run:
```bash
npx playwright test panel-and-deeplink.spec.ts --project=chromium --grep "expand button"
```
Expected: PASS.

- [ ] **Step 4.4: Commit (pick the message matching your fix path)**

If you fixed responsive layout (4.3A):
```bash
git add src/components/CountryPanel.tsx
git commit -m "fix(panel): hide desktop layout on mobile viewports"
```

If you updated the stale test (4.3B):
```bash
git add e2e/panel-and-deeplink.spec.ts
git commit -m "test(panel): align mobile-expand test with current peek-state fields"
```

---

## Task 5: Stabilize the axe-core home-page flake

**Files:**
- Modify: `e2e/accessibility.spec.ts`

**Rationale:** The CI run reported `axe-core audit passes on home page` as a flake (passed on retry). Likely cause: the 1-second `waitForTimeout` at line 100 is not enough for the map to fully render on a slow runner, so axe scans a partially-painted page and sometimes detects transient violations (e.g., insufficient contrast on an element still mid-animation). Replace the fixed wait with a deterministic wait for the map's `data-map-loaded` attribute.

- [ ] **Step 5.1: Read the current test**

Run:
```bash
sed -n '98,107p' e2e/accessibility.spec.ts
```

Expected (approximately):
```ts
  test('axe-core audit passes on home page', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)

    const results = await new AxeBuilder({ page })
      .exclude('.maplibregl-canvas')
      .analyze()

    expect(results.violations).toEqual([])
  })
```

- [ ] **Step 5.2: Swap the fixed wait for a deterministic one**

Modify `e2e/accessibility.spec.ts`. Replace the test body (the two lines after `await page.goto('/')`) so the wait is tied to the map being loaded rather than a wall-clock timer. The map error overlay sets `data-map-error` and the healthy state sets `data-map-loaded`; either terminal state means rendering is settled enough for axe.

New body (keep the describe/test wrapper intact):

```ts
  test('axe-core audit passes on home page', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-map-loaded], [data-map-error]').first().waitFor({ timeout: 15_000 })

    const results = await new AxeBuilder({ page })
      .exclude('.maplibregl-canvas')
      .analyze()

    expect(results.violations).toEqual([])
  })
```

Do the same for the second axe test at lines ~109–116 (`axe-core audit passes with country panel open`) — replace `await page.waitForTimeout(2000)` with a wait on the country panel being attached:

```ts
  test('axe-core audit passes with country panel open', async ({ page }) => {
    await page.goto('/#FRA')
    await page.getByTestId('country-panel').waitFor({ timeout: 15_000 })

    const results = await new AxeBuilder({ page })
      .exclude('.maplibregl-canvas')
      .analyze()

    expect(results.violations).toEqual([])
  })
```

- [ ] **Step 5.3: Run both axe tests ten times to check stability**

Run:
```bash
npx playwright test accessibility.spec.ts --project=chromium --grep "axe-core" --repeat-each=10
```

Expected: 20/20 pass (2 tests × 10 repeats). If any case still flakes, the violation is real — inspect the failure's `results.violations[0]` via `test-results/.../error-context.md` and decide whether to patch the component or exclude the specific rule with `.disableRules(['color-contrast'])`.

- [ ] **Step 5.4: Commit**

```bash
git add e2e/accessibility.spec.ts
git commit -m "test(a11y): wait on data-map-loaded rather than fixed timeout before axe scan"
```

---

## Task 6: Raise CI worker count from 1 to 2

**Files:**
- Modify: `playwright.config.ts`

**Rationale:** `playwright.config.ts:8` sets `workers: process.env.CI ? 1 : undefined`. GitHub's standard Linux runner has 4 cores; serializing to 1 worker leaves 3 idle. Moving to 2 workers roughly halves e2e walltime (~5.5 min → ~3 min) with no additional cost — you're still billed for a single runner VM.

- [ ] **Step 6.1: Change the workers setting**

Modify `playwright.config.ts`. Current line 8:

```ts
  workers: process.env.CI ? 1 : undefined,
```

Change to:

```ts
  workers: process.env.CI ? 2 : undefined,
```

- [ ] **Step 6.2: Local regression check**

Run:
```bash
CI=1 npx playwright test --project=chromium
```

Expected: same pass/fail set as before (all prior fixes in place). No test should fail because it assumed serial execution. If one does (e.g., shared localStorage state across tests), that test has a pre-existing isolation bug — surface it but don't fix it in this task.

- [ ] **Step 6.3: Commit**

```bash
git add playwright.config.ts
git commit -m "perf(ci): raise Playwright workers from 1 to 2 (same runner, ~half walltime)"
```

---

## Task 7: Swap `npm run dev` for `vite build && vite preview` in CI

**Files:**
- Modify: `playwright.config.ts`

**Rationale:** Playwright's `webServer` currently runs `npm run dev`, which boots Vite dev mode with HMR, source maps, and on-the-fly TS compilation — all dead weight during e2e. `vite preview` serves the pre-built production bundle from `dist/`, matching what ships to GH Pages and starting in milliseconds. Net: faster test startup and tests exercise the same code path deployed to production.

Tradeoff: preview requires a build before the server starts. In CI the build already runs as an earlier step — we just need Playwright to invoke `preview` instead of `dev` when `CI` is set. Locally, keep `dev` for the HMR experience.

- [ ] **Step 7.1: Conditional webServer command**

Modify `playwright.config.ts`. The current `webServer` block (after Task 1's env override) looks like:

```ts
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: {
      GITHUB_ACTIONS: '',
    },
  },
```

Change to:

```ts
  webServer: {
    command: process.env.CI ? 'npm run preview -- --port 5173' : 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: {
      GITHUB_ACTIONS: '',
    },
  },
```

Note: Vite's `preview` defaults to port `4173`. Forcing `--port 5173` keeps `baseURL` unchanged.

- [ ] **Step 7.2: Ensure a build runs before e2e in CI**

Read `.github/workflows/ci.yml`:

```bash
cat .github/workflows/ci.yml
```

Confirm the order is: `npm ci` → Lint → Type check → Unit tests → Build → Install Playwright browsers → E2E tests. Since Build runs before E2E, `dist/` exists when Playwright starts its preview webServer — no workflow change needed. If this order has drifted, put Build before E2E.

- [ ] **Step 7.3: Verify locally**

Run:
```bash
npm run build
CI=1 npx playwright test meta-and-static --project=chromium
```

Expected: 6/6 pass. The preview server serves the built `index.html` that lives in `dist/` — if Build skipped any step, e2e would now catch it.

- [ ] **Step 7.4: Commit**

```bash
git add playwright.config.ts
git commit -m "perf(ci): use vite preview (not dev) for e2e webServer in CI"
```

---

## Task 8: Verify on GitHub

**Files:** none modified.

**Rationale:** Push the branch of commits and confirm CI turns green (or stays amber with only the genuine known-unstable cases, if any).

- [ ] **Step 8.1: Push**

Run:
```bash
git push
```

Expected: push succeeds. Triggers both `CI` and `Deploy to GitHub Pages` workflows.

- [ ] **Step 8.2: Watch the CI run**

Run:
```bash
gh run watch --repo GranatenUdo/funworldmap --exit-status
```

Expected: exit 0. The CI job should now pass. Walltime on the `E2E tests` step should be roughly half the prior ~5.5 min.

If CI fails: inspect the run in order of priority. Anything in `theme-and-responsive`, `panel-and-deeplink`, or `meta-and-static` that still fails means a local fix was incomplete — debug that specific test rather than chasing other noise.

- [ ] **Step 8.3: Confirm deployed site still works**

Run:
```bash
curl -I https://granatenudo.github.io/funworldmap/
```

Expected: `HTTP/1.1 200 OK` or `HTTP/2 200`. Manually open the URL, verify the globe loads, click a country, toggle the theme — the default toggle label should now be "Switch to light mode" on a first visit (was "Switch to system theme" before Task 2).

---

## Wrap-up

- [ ] **Step W.1: Optional follow-ups**

Open issues in `github.com/GranatenUdo/funworldmap/issues` for anything out of scope that surfaced:

1. **`chromium-gpu` tests all skipped on Linux runners** — 7 tests. They work locally with a real GPU. To run them in CI, either self-host a runner with a GPU or rework them to pass with SwiftShader. Not urgent; the DOM project gives most coverage.
2. **Stub OpenFreeMap tiles in e2e** — removes external-network variance. Do this after CI stabilizes if residual flake appears.
3. **Bundle size budgets in CI** — wire `size-limit` or similar so silent regressions get caught.

- [ ] **Step W.2: Save a project memory about the GITHUB_ACTIONS env trap**

Save to memory so a future session avoids the same rabbit hole:

```
name: vite base path trap under GITHUB_ACTIONS
description: Why GITHUB_ACTIONS=true breaks e2e tests without an env override
type: project

vite.config.ts:7 sets base to /funworldmap/ when process.env.GITHUB_ACTIONS is set. On GitHub Actions runners this is always true. Playwright's webServer inherits the env unless overridden — if it does, public/robots.txt is served at /funworldmap/robots.txt, not /robots.txt, and e2e tests requesting /robots.txt fail. Fix is in playwright.config.ts webServer.env override.
```
