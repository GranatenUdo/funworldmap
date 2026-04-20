# A11y + Contrast Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three small, product-direction-neutral fixes to the country panel and search dropdown: raise every 10px region badge to 11px, bump light-mode meta copy from `sand-500` to `sand-600` for WCAG AA, and apply `tabular-nums` to the shared `DataCell` so numeric fields align in compare view.

**Architecture:** Nine single-line component edits across four files, plus one new Playwright spec (`e2e/a11y-contrast.spec.ts`) that asserts computed font-size, color, and `font-variant-numeric`. No CSS-variable, font, or surface-color changes. Dark mode is untouched. Work is grouped into three TDD phases that ship as three intermediate commits on a feature branch, merged as one PR.

**Tech Stack:** TypeScript 5.7, React 19, Vite 6, Tailwind CSS 4, Playwright 1.59, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-04-20-a11y-contrast-pass-design.md` (committed `74b60f9`).

---

## Pre-flight

### Task 1: Clean state, baseline, feature branch

**Files:** none (git + baseline checks only).

- [ ] **Step 1: Verify working tree is clean**

Run: `git status`
Expected: `On branch main` and `nothing to commit, working tree clean` — except the untracked `docs/design-sketches/` directory (leftover artifact from brainstorming, ignore).

- [ ] **Step 2: Pull latest main**

Run: `git pull origin main`
Expected: *"Already up to date."* or fast-forward.

- [ ] **Step 3: Run baseline checks**

Run: `npm run lint && npx tsc -b && npm run test:unit`
Expected: zero warnings, zero errors, all unit tests pass.

- [ ] **Step 4: Create the feature branch**

Run: `git checkout -b fix/a11y-contrast-pass`
Expected: *"Switched to a new branch 'fix/a11y-contrast-pass'"*.

The full e2e suite runs once in Task 8, not in pre-flight — a pre-flight e2e run wastes minutes on a change this small.

---

## Phase 1 — Region-badge size floor (10px → 11px)

### Task 2: Add failing e2e test for region-badge size

**Files:**
- Create: `e2e/a11y-contrast.spec.ts`

- [ ] **Step 1: Create the spec file with three region-badge assertions**

Write `e2e/a11y-contrast.spec.ts` exactly as below. This file will be extended in Phases 2 and 3 — the structure is set up for that now.

```ts
import { test, expect, type Locator, type Page } from '@playwright/test'

test.setTimeout(60_000)

async function openPanel(page: Page, cca3: string, expectedName: string) {
  await page.goto(`/#${cca3}`)
  const panel = page.getByTestId('country-panel')
  await expect(panel).toBeVisible({ timeout: 15_000 })
  await expect(panel).toContainText(expectedName, { timeout: 15_000 })
  return panel
}

async function computedFontSizePx(locator: Locator): Promise<number> {
  const value = await locator.evaluate((el) => window.getComputedStyle(el).fontSize)
  return parseFloat(value)
}

test.describe('A11y + Contrast Pass', () => {
  test.describe('Region-badge size floor', () => {
    test('single-panel region badge is >= 11px', async ({ page }) => {
      const panel = await openPanel(page, 'FRA', 'France')
      const badge = panel.getByTestId('region-badge').first()
      const px = await computedFontSizePx(badge)
      expect(px).toBeGreaterThanOrEqual(11)
    })

    test('compare-column region badges are >= 11px', async ({ page }) => {
      await page.goto('/#FRA')
      const panel = page.getByTestId('country-panel')
      await expect(panel).toBeVisible({ timeout: 15_000 })
      await panel.getByRole('button', { name: /Compare with another country/i }).click()
      await panel.getByRole('button', { name: 'Germany' }).click()
      const badges = panel.getByTestId('region-badge')
      const count = await badges.count()
      expect(count).toBeGreaterThanOrEqual(2)
      for (let i = 0; i < count; i++) {
        const px = await computedFontSizePx(badges.nth(i))
        expect(px).toBeGreaterThanOrEqual(11)
      }
    })

    test('search-result region badge is >= 11px', async ({ page }) => {
      await page.goto('/')
      await page.getByTestId('search-input').fill('Germany')
      const firstResult = page
        .getByTestId('search-results')
        .getByRole('option')
        .first()
      await expect(firstResult).toBeVisible({ timeout: 10_000 })
      const badge = firstResult.getByTestId('region-badge')
      const px = await computedFontSizePx(badge)
      expect(px).toBeGreaterThanOrEqual(11)
    })
  })
})
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `npx playwright test e2e/a11y-contrast.spec.ts --reporter=list`
Expected: all three `Region-badge size floor` tests FAIL.

The failure mode in this pre-implementation state is a **locator timeout**, not a size-assertion miss — the `data-testid="region-badge"` attribute is added by Task 3, so `getByTestId('region-badge')` resolves to zero elements until then. Playwright's output will show something like `locator.evaluate: Error: strict mode violation` or `Timeout ... waiting for getByTestId('region-badge')`. That's the expected red state.

After Task 3 adds the test-ids AND bumps the size, both conditions are satisfied and the tests turn green in one step.

### Task 3: Apply the three size edits (plus data-testid), verify green

Both the size bump AND a `data-testid="region-badge"` addition happen in the same edit at each site. The test-id stabilizes the Phase 1 selectors — otherwise `text=Europe` matches subregion labels, border-neighbor names, and the badge itself, and `.first()` silently grabs the wrong node.

**Files:**
- Modify: `src/components/SingleCountryPanel.tsx:130`
- Modify: `src/components/CountryColumn.tsx:58`
- Modify: `src/components/SearchBar.tsx:173`

- [ ] **Step 1: Edit `src/components/SingleCountryPanel.tsx:130`**

Change `text-[10px]` → `text-[11px]` on the region-badge `<span>`, AND add `data-testid="region-badge"` as a prop on that `<span>`. The rest of the class string (e.g. `inline-block font-medium px-2 py-0.5 rounded-full mt-1.5 ${...}`) is unchanged.

- [ ] **Step 2: Edit `src/components/CountryColumn.tsx:58`**

Same pattern: change `text-[10px]` → `text-[11px]` and add `data-testid="region-badge"` on the region-badge `<span>` at line 58.

- [ ] **Step 3: Edit `src/components/SearchBar.tsx:173`**

Same pattern: change `text-[10px]` → `text-[11px]` and add `data-testid="region-badge"` on the region-badge `<span>` at line 173.

- [ ] **Step 4: Verify no other `text-[10px]` remains**

Run (Bash/PowerShell friendly):

```bash
grep -rn 'text-\[10px\]' src/components/ || echo 'no matches'
```

Expected: `no matches`.

- [ ] **Step 5: Run the three Phase-1 tests and verify they pass**

Run: `npx playwright test e2e/a11y-contrast.spec.ts -g "Region-badge" --reporter=list`
Expected: all three PASS.

- [ ] **Step 6: Commit**

```bash
git add e2e/a11y-contrast.spec.ts src/components/SingleCountryPanel.tsx src/components/CountryColumn.tsx src/components/SearchBar.tsx
git commit -m "fix(a11y): raise region-badge size floor to 11px"
```

---

## Phase 2 — Meta-color contrast bump (`sand-500` → `sand-600`)

### Task 4: Extend the spec with meta-color assertions

**Files:**
- Modify: `e2e/a11y-contrast.spec.ts`

Context: `sand-600` in the project's palette is `#6b6459`. Tailwind converts that to RGB `rgb(107, 100, 89)` for computed `color`. `sand-500` is `#8c8578` → `rgb(140, 133, 120)`. We assert the computed color is sand-600's RGB in light mode, and that it is NOT changed in dark mode.

Dark mode toggle uses `localStorage` key `funworldmap-theme` with value `'dark'` or `'light'` (see `index.html:27–40`).

- [ ] **Step 1: Add the `Meta-color contrast` describe block to the existing file**

Insert this block inside the top-level `test.describe('A11y + Contrast Pass', ...)` from Task 2, immediately after the `Region-badge size floor` describe:

```ts
  test.describe('Meta-color contrast', () => {
    // Use substring matching — Chromium normalises to `rgb(...)`, but older
    // WebKit/Firefox builds can emit `rgba(R, G, B, 1)` for the same color
    // declaration. `toContain` is format-agnostic.
    const SAND_600_RGB = '107, 100, 89'    // #6b6459
    const DARK_100_RGB = '148, 163, 184'   // #94a3b8

    async function computedColor(locator: Locator): Promise<string> {
      return locator.evaluate((el) => window.getComputedStyle(el).color)
    }

    test('official-name line uses sand-600 in light mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'light'))
      const panel = await openPanel(page, 'FRA', 'France')
      const official = panel.getByText('French Republic').first()
      const color = await computedColor(official)
      expect(color).toContain(SAND_600_RGB)
    })

    test('official-name line is unchanged in dark mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'dark'))
      const panel = await openPanel(page, 'FRA', 'France')
      const official = panel.getByText('French Republic').first()
      const color = await computedColor(official)
      expect(color).toContain(DARK_100_RGB)
    })

    test('close-button icon uses sand-600 in light mode', async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('funworldmap-theme', 'light'))
      const panel = await openPanel(page, 'FRA', 'France')
      const closeBtn = panel.getByTestId('panel-close')
      const color = await computedColor(closeBtn)
      expect(color).toContain(SAND_600_RGB)
    })
  })
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `npx playwright test e2e/a11y-contrast.spec.ts -g "Meta-color" --reporter=list`
Expected: at least `light mode` tests FAIL with color mismatch (expected `rgb(107, 100, 89)`, received `rgb(140, 133, 120)`). The dark-mode test should PASS even before the fix (dark color is unchanged).

### Task 5: Apply the five color edits and verify green

**Files:**
- Modify: `src/components/SingleCountryPanel.tsx:120, 158, 170, 299`
- Modify: `src/components/CloseButton.tsx:9`

- [ ] **Step 1: Edit `src/components/SingleCountryPanel.tsx:120`**

Change `text-sand-500` to `text-sand-600` in the `className` on the official-name `<p>` at line 120. The `dark:text-dark-100` half of the same class string is preserved verbatim.

- [ ] **Step 2: Edit `src/components/SingleCountryPanel.tsx:158`**

Change `text-sand-500` to `text-sand-600` in the `className` on the share-link button at line 158. Preserve `dark:text-dark-100`.

- [ ] **Step 3: Edit `src/components/SingleCountryPanel.tsx:170`**

Change `text-sand-500` to `text-sand-600` in the `className` on the mobile expand button at line 170. Preserve `dark:text-dark-100`.

- [ ] **Step 4: Edit `src/components/SingleCountryPanel.tsx:299`**

Change `text-sand-500` to `text-sand-600` in the `className` on the unknown-border code `<span>` at line 299. Preserve `dark:text-dark-100`.

- [ ] **Step 5: Edit `src/components/CloseButton.tsx:9`**

Change `text-sand-500` to `text-sand-600` in the base-class constant at line 9. Preserve `dark:text-dark-100`.

- [ ] **Step 6: Verify the only remaining `text-sand-500` usages are out-of-scope**

Run:

```bash
grep -rn 'text-sand-500' src/components/
```

Expected output — exactly these five lines, all explicitly out-of-scope per the spec:

```
src/components/Header.tsx:69:...text-sand-500 dark:text-dark-100...
src/components/PlayMenu.tsx:87:...text-sand-500 dark:text-dark-100...
src/components/SearchBar.tsx:168:...text-sand-500 dark:text-dark-100...
src/components/SearchBar.tsx:184:...text-sand-500 dark:text-dark-100...
src/components/ThemeToggle.tsx:33:...text-sand-500 dark:text-dark-100...
```

If any in-scope file (`SingleCountryPanel.tsx`, `CloseButton.tsx`) still contains `text-sand-500`, repeat Steps 1–5.

- [ ] **Step 7: Run the Phase-2 tests and verify they pass**

Run: `npx playwright test e2e/a11y-contrast.spec.ts -g "Meta-color" --reporter=list`
Expected: all three PASS.

- [ ] **Step 8: Run the full new spec to guard against regressions in Phase 1**

Run: `npx playwright test e2e/a11y-contrast.spec.ts --reporter=list`
Expected: six of the planned tests PASS, zero FAIL (Phase 3's test is not yet in the file).

- [ ] **Step 9: Commit**

```bash
git add e2e/a11y-contrast.spec.ts src/components/SingleCountryPanel.tsx src/components/CloseButton.tsx
git commit -m "fix(a11y): bump panel meta copy to sand-600 for WCAG AA contrast"
```

---

## Phase 3 — Tabular figures on `DataCell`

### Task 6: Extend the spec with a tabular-nums assertion

**Files:**
- Modify: `e2e/a11y-contrast.spec.ts`

- [ ] **Step 1: Add the `Tabular figures` describe block to the existing file**

Insert this block inside the top-level `test.describe('A11y + Contrast Pass', ...)`, after the `Meta-color contrast` describe:

```ts
  test.describe('Tabular figures on DataCell', () => {
    test('DataCell values have font-variant-numeric: tabular-nums', async ({ page }) => {
      const panel = await openPanel(page, 'FRA', 'France')
      const valueCells = panel.locator('[data-testid="data-cell-value"]')
      const count = await valueCells.count()
      expect(count).toBeGreaterThan(0)
      const variant = await valueCells.first().evaluate(
        (el) => window.getComputedStyle(el).fontVariantNumeric,
      )
      expect(variant).toContain('tabular-nums')
    })
  })
```

Note: the test expects a `data-testid="data-cell-value"` attribute on the `DataCell` value `<div>`. That attribute does not exist yet in the codebase — it's added as part of Task 7 Step 1 (shown below). The test therefore also asserts the structural marker is present.

- [ ] **Step 2: Run the new test and verify it fails**

Run: `npx playwright test e2e/a11y-contrast.spec.ts -g "Tabular figures" --reporter=list`
Expected: FAIL with `expected: containing "tabular-nums", received: "normal"` (or similar).

### Task 7: Apply the `DataCell` change and verify green

**Files:**
- Modify: `src/components/SingleCountryPanel.tsx:33`

- [ ] **Step 1: Edit `src/components/SingleCountryPanel.tsx:33`**

Add the Tailwind `tabular-nums` utility to the value `<div>`'s `className` and add a `data-testid` for the test selector. The current line 33 reads:

```tsx
<div className="text-[15px] text-sand-800 dark:text-dark-50">{children}</div>
```

Change it to:

```tsx
<div data-testid="data-cell-value" className="text-[15px] text-sand-800 dark:text-dark-50 tabular-nums">{children}</div>
```

The utility maps to `font-variant-numeric: tabular-nums` at the CSS level (native Tailwind v4 utility). The `data-testid` lets the Phase-3 test locate every value cell without depending on field-name text.

- [ ] **Step 2: Run the Phase-3 test and verify it passes**

Run: `npx playwright test e2e/a11y-contrast.spec.ts -g "Tabular figures" --reporter=list`
Expected: PASS.

- [ ] **Step 3: Run the full new spec**

Run: `npx playwright test e2e/a11y-contrast.spec.ts --reporter=list`
Expected: all seven tests PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/a11y-contrast.spec.ts src/components/SingleCountryPanel.tsx
git commit -m "fix(a11y): enable tabular figures on DataCell values"
```

---

## Finalize

### Task 8: Full test + lint + typecheck

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: zero warnings, zero errors.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: zero errors.

- [ ] **Step 3: Unit tests**

Run: `npm run test:unit`
Expected: all pass (no unit-test files were touched, so this is a regression guard).

- [ ] **Step 4: Full e2e suite**

Run: `npm run test:e2e`
Expected: all tests pass, including the seven new ones in `a11y-contrast.spec.ts`.

If any pre-existing e2e test fails, investigate — a lightweight className change shouldn't break anything. Likely causes: (a) the `text-xs` fallback on a region badge was being relied on by a visibility-sensitive test (unlikely); (b) a selector that matched the exact previous className string (very unlikely). Fix by narrowing the selector in the existing test, not by reverting this work.

### Task 9: Manual cross-browser smoke

**Files:** none (manual verification with a running dev server).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Vite prints a local URL (typically `http://localhost:5173/`).

- [ ] **Step 2: Desktop light**

Open the URL in a desktop browser window at ≥1024px width. In Settings → System appearance, use light mode. Check:
- Click France. Region badge reads crisp at 11px; flag and title still breathe.
- Official-name "French Republic" reads slightly darker than before (sand-600, not sand-500).
- Click the compare button, then pick Germany. Both columns' region badges at 11px. Scroll — no color seam between the column sticky-header and the body.
- Close the panel. Type "Germ" in the search. First result's region badge reads at 11px.
- Population and Area in France vs. Germany compare view: the digits stack vertically in clean columns (tabular figures visibly align).

- [ ] **Step 3: Desktop dark**

Toggle the theme to dark. Re-check the same five items above. The main difference must be: meta-copy colors (official name, share/close/expand icons) are **unchanged** from before this PR in dark mode. If anything looks different from the pre-PR dark appearance, stop — the `dark:text-dark-100` half of a swap got lost.

- [ ] **Step 4: Mobile light + dark**

Use browser devtools mobile emulation (iPhone 12 or similar, ≤600px width). Repeat light and dark checks. The mobile bottom-sheet panel has the same region badge and meta copy; the expand-chevron icon is one of the bumped sand-600 icons.

- [ ] **Step 5: `prefers-reduced-motion`**

In devtools → Rendering, set `prefers-reduced-motion: reduce`. Open and close the panel. Animations should clip to near-instant per `src/index.css:243`. Nothing in this PR should have changed reduced-motion behavior — this is a regression guard.

- [ ] **Step 6: Stop the dev server**

`Ctrl+C` in the terminal running `npm run dev`.

### Task 10: Push and open the PR

**Files:** none (git + gh only).

- [ ] **Step 1: Push the branch**

Run: `git push -u origin fix/a11y-contrast-pass`

- [ ] **Step 2: Open the PR**

Run:

```bash
gh pr create --title "fix(a11y): region-badge size floor + meta-contrast + tabular figures" --body "$(cat <<'EOF'
## Summary

Narrow a11y and contrast pass. Three small, product-direction-neutral fixes:

- Raise every `text-[10px]` region badge to `text-[11px]` (three locations: single-country panel, compare column, search dropdown result).
- Bump light-mode panel-surface meta copy from `sand-500` (#8c8578, ~4.0:1 contrast — fails WCAG AA) to `sand-600` (#6b6459, ~6.0:1 — passes AA). Five edits across `SingleCountryPanel` and the shared `CloseButton`. Dark-mode colors untouched.
- Apply `tabular-nums` to the shared `DataCell` value container so numeric fields (Population, Area, etc.) align vertically in compare view.

Spec: `docs/superpowers/specs/2026-04-20-a11y-contrast-pass-design.md`.

## Test plan

- [ ] New spec `e2e/a11y-contrast.spec.ts` passes locally (seven tests).
- [ ] `npm run lint && npx tsc -b && npm run test:unit && npm run test:e2e` all green.
- [ ] Manual smoke on desktop light, desktop dark, mobile light, mobile dark: region badges read crisp, meta copy slightly darker in light mode only, Population/Area values align vertically in compare view.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Confirm it links to the correct branch.

- [ ] **Step 3: Wait for CI**

Monitor the PR checks (`gh pr checks` or the web UI). All must pass before merging. Do not `--squash-merge` manually — the maintainer handles merge strategy.

---

## Reference — grep anchor for in-scope locations

This appendix is a single-glance verification table. After each phase, the following greps should hold:

| Phase | Grep | Expected |
|---|---|---|
| 1 post-impl | `grep -rn 'text-\[10px\]' src/components/` | no matches |
| 2 post-impl | `grep -rn 'text-sand-500' src/components/ \| wc -l` | 5 (the out-of-scope list: `Header.tsx`, `PlayMenu.tsx`, `SearchBar.tsx` × 2, `ThemeToggle.tsx`) |
| 3 post-impl | `grep -n 'tabular-nums' src/components/SingleCountryPanel.tsx` | one match at line 33 |
