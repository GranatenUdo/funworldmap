# Graph-Derived Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the graphify corpus reproducible, remove the last raw-`slate` chrome from the app (fixing a real invisible-headline a11y bug), and leave a gate so the same regression cannot recur.

**Architecture:** Five independent phases, one commit each, ordered so that each phase's verification passes at the moment it lands. Phases 1 (tooling dotfiles) and 5 (identifier renames) touch nothing visual. Phase 2 consolidates a duplicated data-encoding table with zero pixel change. Phase 3 migrates two app-shell resilience surfaces onto the Observatory token ramps. Phase 4 adds the source-text gate that makes Phase 3 permanent — it must land last because it fails at HEAD by design.

**Tech Stack:** React 19, TypeScript (strict), Tailwind CSS 4 (CSS-first `@theme` in `src/index.css`), Vitest + @testing-library/react, Playwright, Prettier, graphify 0.9.36.

**Spec:** `docs/superpowers/specs/2026-08-08-graph-derived-fixes-design.md`

## Global Constraints

- **Branch:** `calibrated-fittings-and-product-record`. Do not create a new branch; do not merge to `main`. Owner ruling 2026-08-08.
- **Two-Accent Rule (DESIGN.md):** ice = interactive/wayfinding, signal = live game state/loss. No third accent. Anything else with hue must be justifiable as a data encoding.
- **Accessible-Pair Rule (DESIGN.md):** light surfaces carry deep variants for text (`text-ice-accessible dark:text-ice`); dark surfaces carry bare accents. Never bare ice or signal text on a sand surface.
- **Retirement Rule (DESIGN.md):** teal (`#14b8a6` family) and coral (`#f43f5e` family) are retired and pinned absent by `src/lib/__tests__/designTokens.test.ts`. Never reintroduce, under any name.
- **Primary CTA recipe (DESIGN.md § Buttons):** `bg-ice-accessible` (#075985), white text 500–600 weight, `rounded-xl`, `px-4 py-2`, `hover:bg-ice-dim` (#0369a1). **Identical in both themes** — no `dark:` split.
- **Focus recipe (DESIGN.md § Buttons):** `focus:outline-none` + `focus-visible:ring-2` in the ice family — `focus-visible:ring-ice-dim/50 dark:focus-visible:ring-ice/50`. Never signal.
- **Token names are fixed** (`src/index.css` `@theme`): sand ramp `sand-50…sand-900`; dark ramp `dark-50 #f1f5f9`, `dark-100 #94a3b8`, `dark-200 #334155`, `dark-300 #1e2430`, `dark-400 #161a22`, `dark-500 #121518`; `ice #7dd3fc`, `ice-dim #0369a1`, `ice-accessible #075985`.
- **Region tints and amber exception badges are data encodings**, not accents. Do not restyle their colors in any task. Phase 2 relocates them verbatim.
- **No new npm dependencies.**
- **Every phase ends green:** `npm run check` (= `npm run lint && npm run typecheck && npm run test:unit`) must pass before each commit.
- **Commit message convention:** conventional-commit prefix, and end the body with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

## File Structure

| File | Phase | Responsibility |
| --- | --- | --- |
| `.prettierignore` | 1 | Modify — add `graphify-out/` so lint-staged stops rewriting graph artifacts |
| `.graphifyignore` | 1 | **Create** — pin the `public/` corpus exclusion so the graph is reproducible |
| `src/lib/regionTints.ts` | 2 | **Create** — the single source of truth for the six-region tint data encoding, in `solid` and `soft` alpha variants, plus the unknown-region fallback |
| `src/components/SearchBar.tsx` | 2 | Modify — delete local `REGION_COLORS`, consume `REGION_TINTS[...].solid` |
| `src/components/SingleCountryPanel.tsx` | 2 | Modify — delete local `REGION_BADGE`, consume `REGION_TINTS[...].soft` |
| `src/components/__tests__/chromeAccent.test.tsx` | 2 | Modify — doc comment references the renamed maps |
| `src/lib/__tests__/designTokens.test.ts` | 2 | Modify — comment names the new module (singular → module) |
| `src/components/AppCrashFallback.tsx` | 3 | **Create** — extract the ErrorBoundary fallback so it is renderable (and therefore testable) in isolation |
| `src/components/__tests__/AppCrashFallback.test.tsx` | 3 | **Create** — pin that the headline carries an explicit color class |
| `src/main.tsx` | 3 | Modify — import and use `AppCrashFallback` |
| `src/components/MapErrorOverlay.tsx` | 3 | Modify — migrate 13 raw-slate usages onto the sand/dark ramps and the CTA recipe |
| `src/lib/__tests__/chromeNeutrals.test.ts` | 4 | **Create** — source-text gate: no raw neutral palette classes in `src/**/*.{ts,tsx}` |
| `src/hooks/__tests__/useCountrySearch.test.ts` | 5 | Modify — rename the `c` factory to `makeSearchCountry` |
| `src/components/CompareCountryPanel.tsx` | 5 | Modify — rename the `c` destructured key to `country` |

---

## Task 1: Tooling gaps — reproducible corpus, no artifact churn

**Files:**
- Modify: `.prettierignore` (append a third block)
- Create: `.graphifyignore`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing importable. Later tasks do not depend on this task; it is first because it is free and prevents the next graph run from being wrong.

**Context for the implementer:** `graphify-out/` was committed in `2b77f47` on purpose, so a fresh worktree inherits the knowledge graph instead of paying ~2.1M tokens to rebuild it. The consequence needing a fix is that `lint-staged`'s `*.{ts,tsx,json,md,yml,yaml}` glob now runs `prettier --write` over `graph.json` and `GRAPH_REPORT.md` on any commit that stages them — observed three times while writing this plan's own commits.

Separately, `public/`'s exclusion from the corpus was achieved on the 2026-08-08 run by hand-editing the detect JSON, so it is not reproducible. `.graphifyignore` pins it.

**Premise corrected during pre-flight — do not add a `graphify-out/` entry.** An earlier draft of this task justified one on the grounds that a *tracked* `graphify-out/` is no longer excluded by the `.gitignore` merge and would be ingested as corpus. That is false: `graphify.detect()` resolves `root / GRAPHIFY_OUT` into `configured_out_dir` and excludes it unconditionally, independent of any ignore file (`graphify/detect.py:1290`). Verified empirically at HEAD — with `graphify-out/` tracked and no `.graphifyignore` present, `detect` reports `has graphify-out/: False`. The entry would be a harmless no-op resting on a wrong claim, which is worse than no entry.

- [ ] **Step 1: Append the ignore block to `.prettierignore`**

The file already carries two blocks in exactly this shape (a comment explaining *why*, then the pattern). Match it. Append at the end:

```
# graphify knowledge-graph artifacts — machine-generated, tracked deliberately
# (see 2b77f47). The lint-staged `*.{json,md}` glob would otherwise rewrite
# graph.json / GRAPH_REPORT.md on every commit that stages them.
graphify-out/
```

- [ ] **Step 2: Create `.graphifyignore`**

Gitignore syntax. graphify reads `.gitignore` first and `.graphifyignore` last per directory, so entries here can only ever exclude more, never re-include.

```
# graphify corpus exclusion, pinned so the corpus is reproducible — the
# 2026-08-08 run achieved this by hand-editing the detect JSON.
#
# 252 flag SVGs + font binaries. Vision extraction would spawn one subagent per
# flag and emit 252 isolated "flag of X" nodes with no edges.
#
# graphify-out/ deliberately absent: graphify already excludes its own output
# directory unconditionally (detect.py's configured_out_dir), so an entry here
# would be a no-op.
public/
```

- [ ] **Step 3: Verify prettier now skips the artifacts**

Run:
```bash
npx prettier --check graphify-out/graph.json
```
Expected: prettier reports the file is ignored, **not** a formatting complaint. (Exit code 0 with no "Code style issues" line. If prettier prints `graph.json` as an issue, the pattern did not take.)

- [ ] **Step 4: Verify the graphify corpus is now filtered**

This is a read-only `detect` call — it does not rebuild the graph or write any file. Run it with the Bash tool (POSIX `sh`), not PowerShell:

```bash
"$(cat graphify-out/.graphify_python)" -c "
from pathlib import Path
from graphify.detect import detect
r = detect(Path('.'))
norm = lambda f: f.replace(chr(92), '/')
allf = [f for fl in r['files'].values() for f in fl]
print('total_files:', r['total_files'])
print('public/ files:', sum(1 for f in allf if '/public/' in norm(f)))
"
```

Expected: `total_files: 425`, `public/ files: 0`.

Baseline measured at HEAD before this task: `total_files: 677`, `public/ files: 252`. The 425 is 677 − 252. (The graph report's "675" was this same count two commits earlier, before the spec and plan documents existed.)

- [ ] **Step 5: Commit**

```bash
git add .prettierignore .graphifyignore
git commit -m "chore: pin the graphify corpus exclusion, stop artifact reformatting

graphify-out/ is tracked (2b77f47) so worktrees inherit the graph instead of
paying ~2.1M tokens to rebuild it. The side effect: lint-staged's json/md glob
reformatted graph.json on every commit that staged it. .prettierignore now skips
the directory, matching the two blocks already there for the same reason.

.graphifyignore pins the public/ exclusion, which the 2026-08-08 run achieved by
hand-editing the detect JSON and was therefore not reproducible. detect now
reports 425 files, down from 677.

No graphify-out/ entry: graphify already excludes its own output directory
unconditionally via detect.py's configured_out_dir, so the entry an earlier draft
called for would have been a no-op justified by a false premise. Verified at HEAD
with the directory tracked and no ignore file present.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Consolidate the region-tint data encoding

**Files:**
- Create: `src/lib/regionTints.ts`
- Modify: `src/components/SearchBar.tsx` (delete lines 16-23; update the badge className at 229-232)
- Modify: `src/components/SingleCountryPanel.tsx` (delete lines 56-63; update the badge className at 320-323)
- Modify: `src/components/__tests__/chromeAccent.test.tsx` (doc comment, lines 19-20)
- Modify: `src/lib/__tests__/designTokens.test.ts` (comment, line 52)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `REGION_TINTS: Record<string, RegionTint>` where `interface RegionTint { solid: string; soft: string }` — keys are the six region names `Africa | Americas | Asia | Europe | Oceania | Antarctic`.
  - `REGION_TINT_FALLBACK: string` — the unknown-region class string.
  - Task 4 exempts the file path `lib/regionTints.ts` by exactly that spelling.

**Context for the implementer:** These two tables are the same data encoding duplicated across two components, differing only by a `/80` alpha on the light-mode background. `docs/superpowers/plans/2026-07-28-e-foundations.md:547` ruled the *colors* out of scope for accent migration — that ruling stands, and this task must not change a single color. It relocates them verbatim.

**Why literal strings, not composition:** Tailwind 4 scans source *text* for class names. Building `bg-amber-100` + `/80` at runtime produces a class that never appears literally in any source file, and Tailwind purges it. Both alpha variants must be written out in full. (Proof that a `src/lib/*.ts` module is scanned: `src/components/exceptionBadge.ts` already holds `text-[11px]` plus amber classes in a plain `.ts` file and renders correctly; `src/index.css` declares no `@source` narrowing — line 1 is `@import 'tailwindcss'` and nothing else.)

- [ ] **Step 1: Create `src/lib/regionTints.ts`**

```ts
/**
 * Region tints — a data encoding, not an accent.
 *
 * DESIGN.md's Two-Accent Rule reserves ice and signal for interaction and game
 * state; these six hues encode which continent a country belongs to, which is
 * exactly the "justifiable as a data encoding" carve-out. They are deliberately
 * NOT migrated onto the ice/signal ramps
 * (docs/superpowers/plans/2026-07-28-e-foundations.md:547).
 *
 * Two alpha variants exist because the surfaces differ: search-result rows sit
 * on the opaque dropdown (`solid`), the country panel's badge sits on the
 * frosted card and wants the softer 80% fill (`soft`). Both are written as
 * complete literal class strings — Tailwind 4 scans source text, so composing
 * `bg-amber-100` + `/80` at runtime would yield a class it purges.
 *
 * `Antarctic` is the one sanctioned raw-neutral usage in the TS/TSX sources;
 * `chromeNeutrals.test.ts` exempts this file for it.
 */
export interface RegionTint {
  /** Opaque light-mode fill — search-result rows. */
  solid: string
  /** 80% light-mode fill — the country-panel badge on the frosted card. */
  soft: string
}

export const REGION_TINTS: Record<string, RegionTint> = {
  Africa: {
    solid: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    soft: 'bg-amber-100/80 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  Americas: {
    solid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    soft: 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  Asia: {
    solid: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    soft: 'bg-rose-100/80 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  },
  Europe: {
    solid: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    soft: 'bg-blue-100/80 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  Oceania: {
    solid: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    soft: 'bg-teal-100/80 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  },
  Antarctic: {
    solid: 'bg-slate-100 text-slate-800 dark:bg-slate-800/30 dark:text-slate-300',
    soft: 'bg-slate-100/80 text-slate-800 dark:bg-slate-800/30 dark:text-slate-300',
  },
}

/** Unknown / missing region. Sand-neutral, no continent claim. */
export const REGION_TINT_FALLBACK =
  'bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100'
```

A note if you reword that doc comment: never write a `**/*` glob inside a `/* */`
block comment. The sequence contains `*/` and terminates the comment early,
producing a syntax error several lines down that does not obviously point back at
the comment. Either escape it (`**\/*`) or, as here, describe the scope in prose.

- [ ] **Step 2: Run the existing tests to capture the green baseline**

Run:
```bash
npx vitest run src/components/__tests__/SearchBar.test.tsx src/components/__tests__/SingleCountryPanel.test.tsx
```
Expected: PASS. These tests must still pass **unmodified** after this task — that is this task's correctness proof, so confirm they are green *before* touching the components.

- [ ] **Step 3: Rewire `SearchBar.tsx`**

Delete lines 16-23 (the whole `const REGION_COLORS: Record<string, string> = {…}` block, including its closing brace).

Add to the import block after line 4:

```ts
import { REGION_TINTS, REGION_TINT_FALLBACK } from '../lib/regionTints'
```

Replace the badge className expression at lines 229-232. From:

```tsx
                        className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                          REGION_COLORS[country.region] ||
                          'bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100'
                        }`}
```

To:

```tsx
                        className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                          REGION_TINTS[country.region]?.solid ?? REGION_TINT_FALLBACK
                        }`}
```

`?.`/`??` rather than `||` because `REGION_TINTS[...]` is now an object: `||` on an object would never fall through, and `?.solid` on a missing key yields `undefined`, which `??` catches. Do not change the size or shape classes (`text-[11px] font-medium px-1.5 py-0.5 rounded-full`) — `e2e/a11y-contrast.spec.ts` asserts the badge computes to ≥11px.

- [ ] **Step 4: Rewire `SingleCountryPanel.tsx`**

Delete lines 56-63 (the whole `const REGION_BADGE: Record<string, string> = {…}` block).

Add to the import block after line 15:

```ts
import { REGION_TINTS, REGION_TINT_FALLBACK } from '../lib/regionTints'
```

Replace the badge className expression at lines 320-323. From:

```tsx
            className={`inline-block whitespace-nowrap text-[11px] font-medium px-2 py-0.5 rounded-full ${
              REGION_BADGE[country.region] ||
              'bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100'
            }`}
```

To:

```tsx
            className={`inline-block whitespace-nowrap text-[11px] font-medium px-2 py-0.5 rounded-full ${
              REGION_TINTS[country.region]?.soft ?? REGION_TINT_FALLBACK
            }`}
```

- [ ] **Step 5: Update the two stale comments**

In `src/components/__tests__/chromeAccent.test.tsx`, lines 19-20 currently read:

```
 *  teal is retired from chrome (it survives ONLY in the Oceania region-badge
 *  data encodings, which render via REGION_BADGE/REGION_COLORS maps, not
```

Replace those two lines with:

```
 *  teal is retired from chrome (it survives ONLY in the Oceania region-badge
 *  data encoding, which renders via the shared REGION_TINTS map in
 *  src/lib/regionTints.ts, not
```

In `src/lib/__tests__/designTokens.test.ts`, line 52 currently reads:

```
  // reveal #f59e0b (absorbed into the signal family by E4). The Oceania
```

and line 53:

```
  // region badge's teal-100/-300/-800/-900 classes are Tailwind's default
```

Replace line 53 with:

```
  // region tint's teal-100/-300/-800/-900 classes (src/lib/regionTints.ts,
  // both `solid` and `soft` variants) are Tailwind's default
```

- [ ] **Step 6: Verify the untouched tests still pass**

Run:
```bash
npx vitest run src/components/__tests__/SearchBar.test.tsx src/components/__tests__/SingleCountryPanel.test.tsx src/components/__tests__/chromeAccent.test.tsx src/lib/__tests__/designTokens.test.ts
```
Expected: PASS, with **no edits to any assertion**. If a test needed changing, the refactor changed behavior and is wrong — revert and re-check the class strings character by character.

- [ ] **Step 7: Confirm no stale references remain**

Run:
```bash
grep -rn "REGION_COLORS\|REGION_BADGE" src/ e2e/
```
Expected: no output. (If `chromeAccent.test.tsx` still matches, Step 5 was missed.)

- [ ] **Step 8: Full check and commit**

Run:
```bash
npm run check
```
Expected: PASS.

```bash
git add src/lib/regionTints.ts src/components/SearchBar.tsx src/components/SingleCountryPanel.tsx src/components/__tests__/chromeAccent.test.tsx src/lib/__tests__/designTokens.test.ts
git commit -m "refactor: one region-tint table instead of two

REGION_COLORS (SearchBar) and REGION_BADGE (SingleCountryPanel) were the same
six-region data encoding, differing only by a /80 light-mode alpha — and both
call sites repeated the same unknown-region fallback, so seven duplicated class
strings in total. Consolidated into src/lib/regionTints.ts with explicit solid
and soft variants.

Colors are unchanged; e-foundations:547's ruling that region tints stay off the
ice/signal ramps still holds. Both components' existing tests pass unmodified,
which is the proof this is a pure refactor.

Both variants are written as complete literal strings because Tailwind 4 scans
source text — composing bg-amber-100 + /80 at runtime yields a purged class.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Migrate the resilience surfaces onto the Observatory ramps

**Files:**
- Create: `src/components/AppCrashFallback.tsx`
- Create: `src/components/__tests__/AppCrashFallback.test.tsx`
- Modify: `src/main.tsx` (replace the inline `fallback={…}` JSX with the component)
- Modify: `src/components/MapErrorOverlay.tsx` (lines 33, 35, 36, 37, 42)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `AppCrashFallback` — a **named** export (no default export), `export function AppCrashFallback()`, takes no props, returns JSX. `main.tsx` imports it as `{ AppCrashFallback }`. Task 4's gate scans both files and must find no raw neutrals in them.

**Context for the implementer — there is a real bug here, not just token hygiene.**

`body` is space-dark in **both** themes (`src/index.css:105-107`, a radial gradient `#16213b → #0a0f1f → #04060d`; DESIGN.md's Space-Dark Rule makes this deliberate and permanent). There is no global `body { color }`, Tailwind 4's `preflight.css` declares no root `color`, and `color-scheme` is declared nowhere in the project. So text with no color class inherits the UA default — black.

`main.tsx`'s crash-fallback `<h1>` has **no color class at all**. It renders black on `#0a0f1f`:

| Element | Current | Contrast | AA 4.5:1 |
| --- | --- | --- | --- |
| `<h1>` (no color class) | `#000` on space-dark | **1.10:1** (1.31:1 at the gradient's brightest point) | ✗ both themes |
| `<p>` light theme | `slate-600` `#475569` | **2.52:1** | ✗ |
| `<p>` dark theme | `slate-400` `#94a3b8` | 7.44:1 | ✓ |

axe never caught this because the surface renders only after React has thrown. It **does** render without Sentry configured: `@sentry/react`'s `componentDidCatch` calls `this.setState({ error, componentStack, eventId })` unconditionally, and `render()` branches on `state.componentStack === null` — so a DSN-less dev or CI build still shows it.

**Do not "fix" this by declaring `color-scheme: dark` on `:root`.** That is a one-line root-cause fix and it was considered and rejected: light theme's instrument surfaces (panels, search, dropdown) are sand-light, and a global dark scheme would darken their scrollbars and form-control chrome.

**Honest scope, so you do not over-claim in review:** the `dark` ramp's top two steps *are* Tailwind slate values under project names — `dark-50` **is** `#f1f5f9` = `slate-100`, `dark-100` **is** `#94a3b8` = `slate-400`. So `dark:text-slate-400 → text-dark-100` is a rename with zero pixel change. Exactly two real pixel changes ship in this task: the `<h1>` gains a color (1.10:1 → 17.4:1, both themes), and the light-theme `<p>` leaves `slate-600` (2.52:1 → 7.44:1). Everything else is token hygiene.

**Why the extraction is necessary:** the fallback is currently an inline JSX literal inside `main.tsx`'s `fallback={…}` prop, and `main.tsx` calls `createRoot(...).render(...)` at module scope. Importing it from a test would boot the whole app. Extracting to a component makes it renderable in isolation.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/AppCrashFallback.test.tsx`:

```tsx
/**
 * The crash fallback renders on the space-dark body backdrop (index.css:105-107,
 * space-dark in BOTH themes per DESIGN.md's Space-Dark Rule). Nothing declares a
 * root `color` or `color-scheme`, so an element with no color class inherits the
 * UA default black — 1.10:1 on #0a0f1f. That was this surface's bug: the
 * headline had no color class at all. These tests pin that every text node
 * carries an explicit color and that the CTA uses the ice recipe.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppCrashFallback } from '../AppCrashFallback'

describe('AppCrashFallback', () => {
  it('gives the headline an explicit color class (no UA-default inheritance)', () => {
    render(<AppCrashFallback />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.className).toMatch(/\btext-dark-50\b/)
  })

  it('gives the body copy an explicit color class', () => {
    render(<AppCrashFallback />)
    const body = screen.getByText(/unexpected error occurred/i)
    expect(body.className).toMatch(/\btext-dark-100\b/)
  })

  it('uses the ice primary-CTA recipe, identical in both themes', () => {
    render(<AppCrashFallback />)
    const button = screen.getByRole('button', { name: /refresh/i })
    expect(button.className).toContain('bg-ice-accessible')
    expect(button.className).toContain('hover:bg-ice-dim')
    // DESIGN.md: the primary CTA is identical in both themes — no dark: split.
    expect(button.className).not.toMatch(/\bdark:/)
  })

  it('carries no raw neutral palette class', () => {
    render(<AppCrashFallback />)
    const html = document.body.innerHTML
    expect(html).not.toMatch(/-(slate|gray|zinc|neutral|stone)-\d{2,3}/)
  })

  it('announces itself to assistive tech', () => {
    render(<AppCrashFallback />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
```

**Snippet superseded — `toBeInTheDocument()` is not available in this repo.** It throws `Invalid Chai property: toBeInTheDocument`: there is no `@testing-library/jest-dom` dependency, and `vite.config.ts` declares no vitest `setupFiles` to register the matcher. Adding the dependency would also have violated this plan's own "No new npm dependencies" constraint. The shipped test uses `expect(screen.getByRole('alert')).toBeTruthy()`, matching this repo's existing convention (`src/components/__tests__/BorderChip.test.tsx`). Left below rather than deleted, per this batch's own practice (`7ab91ca`) of annotating a falsified premise instead of erasing it.

- [ ] **Step 2: Run it to make sure it fails**

Run:
```bash
npx vitest run src/components/__tests__/AppCrashFallback.test.tsx
```
Expected: FAIL — `Failed to resolve import "../AppCrashFallback"`. The component does not exist yet.

- [ ] **Step 3: Create `src/components/AppCrashFallback.tsx`**

```tsx
/**
 * Last-resort crash screen, rendered by Sentry's ErrorBoundary in main.tsx when
 * React throws. Extracted from main.tsx's inline `fallback={…}` prop so it can
 * be rendered — and therefore tested — without booting the app (main.tsx calls
 * createRoot().render() at module scope).
 *
 * Colours are the dark-ramp values with no `dark:` split, because the surface it
 * sits on is the space-dark body backdrop in BOTH themes (index.css:105-107;
 * DESIGN.md's Space-Dark Rule). This mirrors the ambient-pill precedent — "dark
 * in both themes". The headline previously had no colour class at all and
 * inherited UA-default black at 1.10:1; text-dark-50 is 17.4:1.
 */
export function AppCrashFallback() {
  return (
    <div role="alert" className="flex h-screen items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <h1 className="text-xl font-semibold text-dark-50">Something went wrong</h1>
        <p className="mt-2 text-sm text-dark-100">
          An unexpected error occurred. Refresh the page to try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-xl bg-ice-accessible px-4 py-2 text-sm font-medium text-white hover:bg-ice-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-ice/50"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
```

The focus ring is the bare `ice/50` with no `dark:` split — the Accessible-Pair Rule assigns bare accents to dark surfaces, and this surface is dark in both themes.

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npx vitest run src/components/__tests__/AppCrashFallback.test.tsx
```
Expected: PASS, 5 tests.

- [ ] **Step 5: Rewire `main.tsx`**

Replace the whole file with:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App'
import { AppCrashFallback } from './components/AppCrashFallback'
import { initSentry } from './lib/initSentry'
import { cleanupLegacyDailyStorage } from './lib/legacyStorageCleanup'

initSentry(import.meta.env.VITE_SENTRY_DSN as string | undefined)
cleanupLegacyDailyStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<AppCrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
```

- [ ] **Step 6: Migrate `MapErrorOverlay.tsx`**

This surface has no contrast bug — it paints its own scrim, so its text is legible. It is pure token hygiene. Apply exactly these five replacements.

Line 33, the scrim:
```tsx
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-sand-50/90 backdrop-blur-sm dark:bg-dark-500/90"
```

Line 35, the card:
```tsx
      <div className="max-w-md rounded-2xl border border-sand-200/50 bg-sand-50 p-6 text-center shadow-2xl dark:border-dark-200/30 dark:bg-dark-400">
```

Line 36, the title:
```tsx
        <h2 className="text-lg font-semibold text-sand-900 dark:text-dark-50">{title}</h2>
```

`sand-900`, not `sand-800`: the house convention reserves `sand-900` for headings
(`CountryColumn.tsx:38`, `CompareCountryPanel.tsx:189`, `LauncherModeCard.tsx:74`)
and `sand-800` for readouts and data values (`CompareFieldRow.tsx:73`,
`SingleCountryPanel.tsx:48`). The spec's table said `sand-800`; this is the
correction.

Line 37, the body:
```tsx
        <p className="mt-2 text-sm text-sand-600 dark:text-dark-100">{body}</p>
```

Line 42, the CTA:
```tsx
          className="mt-4 inline-flex items-center rounded-xl bg-ice-accessible px-4 py-2 text-sm font-medium text-white hover:bg-ice-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/50 dark:focus-visible:ring-ice/50"
```

Three deliberate decisions to preserve:

1. **The card stays opaque — no `backdrop-blur-xl`,** so it does not adopt the full Frosted Card Rule. The scrim one level up already carries `backdrop-blur-sm`, so the frost is present without nesting two backdrop-filters; and this surface's most important reason to exist is the `webgl-lost` state, where piling extra compositor work onto the one screen shown after the graphics context died is the wrong trade. DESIGN.md sanctions exactly this carve-out: "(Mobile sheets and the game-over card go opaque — same hues, no blur.)"
2. **`shadow-xl` → `shadow-2xl`** per DESIGN.md's Shadow Vocabulary, which assigns `shadow-2xl` to the Overlay card class (HUD, search dropdown, game-over card, tutorial).
3. **The CTA loses its `dark:` split** and gains `hover:bg-ice-dim`, because DESIGN.md's Primary CTA recipe is "identical in both themes". Unlike the crash fallback, the focus ring here **keeps** the light/dark pair (`ice-dim/50` / `ice/50`) — this card is sand-light in light theme, so the Accessible-Pair Rule applies normally.

- [ ] **Step 7: Verify no test regressed**

Run:
```bash
npx vitest run
```
Expected: PASS. No existing unit test pins a color on either surface — verified: `useMapReady.test.tsx` reads the `data-map-error` attribute only.

- [ ] **Step 8: Verify no e2e spec pinned these colors**

Run:
```bash
grep -rn "slate\|bg-white" e2e/map-reliability.spec.ts e2e/webgl-context-loss.spec.ts
```
Expected: no output. Both specs address the overlay via `data-testid="map-error-overlay"` / `map-error-retry` and the `data-map-error` attribute, never by color.

- [ ] **Step 9: Eyeball the crash screen once**

Temporarily add `throw new Error('probe')` at the top of `App()` in `src/App.tsx`, run `npm run dev`, load the page, and confirm the headline is legible in **both** themes (toggle your OS colour scheme, or set `localStorage.setItem('funworldmap-theme','light')` and reload). Then **remove the throw**.

This is the only way to see this surface; do not skip it, and do not commit the throw. Confirm `git diff src/App.tsx` is empty before Step 11.

- [ ] **Step 10: Full check**

Run:
```bash
npm run check
```
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/components/AppCrashFallback.tsx src/components/__tests__/AppCrashFallback.test.tsx src/main.tsx src/components/MapErrorOverlay.tsx
git commit -m "fix(a11y): the crash screen's headline was invisible in both themes

body is space-dark in both themes (index.css:105-107, DESIGN.md's Space-Dark
Rule). Nothing declares a root color or color-scheme — not index.css, not
Tailwind's preflight — so text with no color class inherits UA-default black.
main.tsx's ErrorBoundary headline had no color class at all: 1.10:1 on #0a0f1f,
1.31:1 at the gradient's brightest point. axe never caught it because the
surface only renders after React has thrown.

The fallback moves to src/components/AppCrashFallback.tsx so it can be rendered
without booting the app (main.tsx calls createRoot().render() at module scope),
and gains explicit dark-ramp colors with no dark: split — it sits on a backdrop
that is dark in both themes, the ambient-pill precedent.

Fixing this at the root with color-scheme: dark on :root was considered and
rejected: light theme's instrument surfaces are sand-light, and a global dark
scheme would darken their scrollbars and form-control chrome.

MapErrorOverlay has no contrast bug — it paints its own scrim — and is migrated
for token hygiene only. Its card stays opaque rather than taking the full
Frosted Card Rule: the scrim already blurs, and stacking compositor work onto
the one screen shown when the WebGL context has died is the wrong trade.
DESIGN.md already carves this out for mobile sheets and the game-over card.

Honest scope: dark-50 IS slate-100 and dark-100 IS slate-400, so the dark-theme
half of this diff is a rename with zero pixel change. Two real pixel changes
ship — the h1 gains a color (1.10:1 -> 17.4:1), and the light-theme <p> leaves
slate-600 (2.52:1 -> 7.44:1).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Gate raw neutrals so this cannot recur

**Files:**
- Create: `src/lib/__tests__/chromeNeutrals.test.ts`

**Interfaces:**
- Consumes: the file path string `lib/regionTints.ts` from Task 2 (its sole exemption), and a clean `src/` from Task 3.
- Produces: nothing importable.

**Context for the implementer:** `MapErrorOverlay.tsx` and `main.tsx` sat on raw `slate` through the entire Observatory migration because no task was ever scoped to "components still on raw neutrals". `docs/superpowers/plans/2026-07-28-e-foundations.md:546` explicitly cleared `MapErrorOverlay.tsx (slate)` as "no edit needed" — correct on the *teal/coral* criterion it was applying, and blind to this one. `designTokens.test.ts` pins only `index.css` and `mapPalette.ts`, never components. This test closes that gap.

**Why `import.meta.glob` and not explicit `?raw` imports:** `designTokens.test.ts` and `layoutConstants.test.ts` both use hand-listed per-file `?raw` imports. This test deliberately deviates, because a hand-maintained import list is precisely what failed here — nobody would have thought to add `MapErrorOverlay.tsx` to it. Covering files that do not exist yet is the entire point.

**Already verified empirically at HEAD** (probe test written, run, deleted on 2026-08-08), so do not re-litigate these:
- `import.meta.glob('../../**/*.{ts,tsx}')` from `src/lib/__tests__/` returns **194 modules**, including `'../../App.tsx'` and `'../../main.tsx'` at depth zero. No second pattern is needed for root-level files.
- Keys are glob-relative strings (`'../../components/MapErrorOverlay.tsx'`); values are `{ default: string }`.
- 60 of the 194 are under `__tests__` and get filtered out.
- The regex's required leading hyphen means `mapPalette.ts:61`'s `(tailwind slate-950)` prose comment does **not** match, while `bg-slate-900` and `dark:bg-slate-950/90` both do.

- [ ] **Step 1: Write the test**

Create `src/lib/__tests__/chromeNeutrals.test.ts`:

```ts
/**
 * Drift alarm: app chrome uses the project's sand/dark ramps, never Tailwind's
 * raw numbered neutral palettes.
 *
 * This gate exists because MapErrorOverlay.tsx and main.tsx sat on raw `slate`
 * through the entire Observatory migration. The e-foundations task that swept
 * chrome accents cleared MapErrorOverlay as "no edit needed" — true on the
 * teal/coral criterion it was applying, blind to this one — and
 * designTokens.test.ts pins only index.css and mapPalette.ts, never components.
 * Nobody was watching this axis. See
 * docs/superpowers/specs/2026-08-08-graph-derived-fixes-design.md, Phase 4.
 *
 * Unlike designTokens.test.ts and layoutConstants.test.ts, which hand-list their
 * `?raw` imports, this scans via import.meta.glob. That is deliberate: a
 * hand-maintained list is exactly what failed here, since nobody would have
 * added MapErrorOverlay.tsx to it. Covering files that do not exist yet is the
 * point.
 *
 * Scope limit: this checks Tailwind *classes* in .ts/.tsx. It does not cover
 * src/index.css, which carries three raw slate-equivalent literals on the
 * tooltip and attribution chrome — rgba(51, 65, 85, 0.35), rgba(148, 163, 184,
 * 0.7) and #cbd5e1. Those are sanctioned: DESIGN.md's Navigation section states
 * the attribution pill and hover tooltip "wear the same light/dark chrome
 * literals".
 */
import { describe, expect, it } from 'vitest'

/**
 * Requires a leading hyphen so a class fragment (`bg-slate-900`,
 * `dark:bg-slate-950/90`) matches but bare prose does not — mapPalette.ts's
 * "(tailwind slate-950)" comment is not a violation.
 *
 * Residual, accepted: a comment spelling a full class name — `// bg-slate-950 is
 * retired` — would match. The failure is loud and self-explanatory, and the fix
 * is to reword the comment. Stripping comments before scanning is more machinery
 * than the risk earns.
 */
const RAW_NEUTRAL = /-(slate|gray|zinc|neutral|stone)-\d{2,3}/

/**
 * src-relative paths allowed to carry a raw neutral, each with its reason.
 * Keep this list at one entry if at all possible.
 */
const EXEMPT = new Map([
  ['lib/regionTints.ts', 'Antarctic region tint — a data encoding, not chrome'],
])

const modules = import.meta.glob('../../**/*.{ts,tsx}', { query: '?raw', eager: true })

/** '../../components/Foo.tsx' -> 'components/Foo.tsx' */
function toSrcRelative(globKey: string): string {
  return globKey.replace(/^(\.\.\/)+/, '')
}

describe('chrome uses the sand/dark ramps, not raw Tailwind neutrals', () => {
  it('scans a plausible number of source files', () => {
    // Guards against a glob that silently matches nothing — a green gate that
    // scanned zero files is worse than no gate.
    expect(Object.keys(modules).length).toBeGreaterThan(100)
  })

  it('finds no raw neutral palette class in src/**/*.{ts,tsx}', () => {
    const offenders: string[] = []

    for (const [globKey, mod] of Object.entries(modules)) {
      const path = toSrcRelative(globKey)
      if (path.includes('__tests__/')) continue
      if (EXEMPT.has(path)) continue

      const source = (mod as { default: string }).default
      source.split('\n').forEach((line, i) => {
        const hit = RAW_NEUTRAL.exec(line)
        if (hit) offenders.push(`src/${path}:${i + 1} — ${hit[0]}`)
      })
    }

    expect(
      offenders,
      `Raw Tailwind neutral classes found. Use the sand ramp (light) or dark ramp\n` +
        `(dark) instead — see DESIGN.md § Color. If this is a data encoding rather\n` +
        `than chrome, add the file to EXEMPT with a reason.\n\n` +
        offenders.map((o) => `  ${o}`).join('\n') +
        '\n',
    ).toEqual([])
  })

  it('each exemption is still real (no rotted allowlist)', () => {
    for (const path of EXEMPT.keys()) {
      const entry = Object.entries(modules).find(([k]) => toSrcRelative(k) === path)
      expect(entry, `EXEMPT lists ${path}, which no longer exists`).toBeDefined()
      const source = (entry![1] as { default: string }).default
      expect(RAW_NEUTRAL.test(source), `${path} is exempt but has no raw neutral`).toBe(true)
    }
  })
})
```

The third test is the anti-rot guard: if a future refactor removes the Antarctic tint, the exemption becomes a lie and this fails, forcing the list back to zero entries.

**Snippet superseded — this `toSrcRelative` is not what shipped.** `import.meta.glob` keys are real relative paths from the call site, not a fixed `'../../'` prefix: `src/lib/regionTints.ts` arrives as `'../regionTints.ts'` (one level up from `src/lib/__tests__/`, not two), so the naive strip above yields `'regionTints.ts'` instead of `'lib/regionTints.ts'`. That misses the `EXEMPT` lookup, wrongly flags the sanctioned Antarctic tint as a violation, and fails the third test with "no longer exists" instead of passing. A second latent bug in the same function: `'./designTokens.test.ts'`, a sibling file inside `__tests__/` itself, never starts with `../`, so the strip leaves it unmatched by the `path.includes('__tests__/')` filter and the gate would scan sibling test files it should skip. The shipped implementation resolves `.`/`..` segments against the test's own directory instead of assuming a fixed prefix — see `src/lib/__tests__/chromeNeutrals.test.ts`. Left below rather than deleted, per this batch's own practice (`7ab91ca`) of annotating a falsified premise instead of erasing it; the acceptance step next ("expect PASS, 3 tests") describes the corrected code's behavior, not this snippet's.

- [ ] **Step 2: Run it — expect PASS, and understand why**

Run:
```bash
npx vitest run src/lib/__tests__/chromeNeutrals.test.ts
```
Expected: PASS, 3 tests. Tasks 2 and 3 already removed every offender.

- [ ] **Step 3: Prove the gate actually bites**

A gate that passes for the wrong reason is worthless. Temporarily reintroduce one violation: edit `src/components/MapErrorOverlay.tsx` line 36, changing `text-sand-900` to `text-slate-900`, then run:

```bash
npx vitest run src/lib/__tests__/chromeNeutrals.test.ts
```
Expected: FAIL, with a message naming `src/components/MapErrorOverlay.tsx:36 — -slate-900`.

Then revert:
```bash
git checkout src/components/MapErrorOverlay.tsx
```
and confirm `git diff src/components/MapErrorOverlay.tsx` is empty.

- [ ] **Step 4: Full check**

Run:
```bash
npm run check
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/__tests__/chromeNeutrals.test.ts
git commit -m "test: gate raw Tailwind neutrals in src chrome

MapErrorOverlay.tsx and main.tsx sat on raw slate through the whole Observatory
migration because no task was ever scoped to this axis: e-foundations:546
cleared MapErrorOverlay as 'no edit needed' on the teal/coral criterion it was
applying, and designTokens.test.ts pins only index.css and mapPalette.ts, never
components.

Scans via import.meta.glob rather than the hand-listed ?raw imports the other
two pin tests use — a hand-maintained list is exactly what failed here, since
nobody would have added MapErrorOverlay.tsx to it. Verified to cover all 194
src modules including root-level App.tsx and main.tsx.

One exemption (lib/regionTints.ts, for the Antarctic tint), and a third test
that fails if that exemption ever stops being real, so the allowlist cannot rot.
Does not cover index.css's three DESIGN.md-sanctioned chrome literals.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Name the single-letter identifiers

**Files:**
- Modify: `src/hooks/__tests__/useCountrySearch.test.ts` (line 7 definition; call sites at 17, 18, 19, 20, 91)
- Modify: `src/components/CompareCountryPanel.tsx` — **two** blocks: the mobile header at 175-198 and the borders section at 210-235

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. Purely local renames.

**Context for the implementer:** AST extraction resolved bare `c(...)` call sites in `scripts/` against the only `c` definition it knew — a test-file helper — and emitted two false `indirect_call` edges (`validateJoinIntegrity() → c()`, `fetchRestCountries() → c()`), which surfaced in the graph report's "Surprising Connections". The graph noticed a readability problem. This is the weakest task in the batch and the first to cut if the batch needs trimming; its payoff is readability, and the two edges it removes are 2 of 254 dangling edges the spec otherwise treats as out of scope.

- [ ] **Step 1: Rename the search-test factory**

In `src/hooks/__tests__/useCountrySearch.test.ts`, line 7, change:

```ts
const c = (cca3: string, ccn3: string, common: string, capital: string[] = []): CountryData =>
```

to:

```ts
const makeSearchCountry = (
  cca3: string,
  ccn3: string,
  common: string,
  capital: string[] = [],
): CountryData =>
```

Then update all five call sites. Lines 17-20 become:

```ts
  makeSearchCountry('FRA', '250', 'France', ['Paris']),
  makeSearchCountry('DEU', '276', 'Germany', ['Berlin']),
  makeSearchCountry('ESP', '724', 'Spain', ['Madrid']),
  makeSearchCountry('ITA', '380', 'Italy', ['Rome']),
```

And line 91:

```ts
      makeSearchCountry(`C${i.toString().padStart(2, '0')}`, `${i}`, `Country${i}`),
```

Do not reformat the surrounding lines — prettier will settle the multi-line signature on commit.

- [ ] **Step 2: Rename the compare-panel destructured key**

In `src/components/CompareCountryPanel.tsx`, replace lines 175-198 with the block
below.

**Do not rename the key to `country`.** `country` is already the enclosing
component's prop name, so destructuring to it inside the callback shadows the
prop — legal TypeScript, silently confusing code, and `@typescript-eslint`'s
no-shadow rules are not configured to catch it here. Use `side`, which reads
correctly (this block renders the A and B *sides* of the mobile compare header)
and shadows nothing.

```tsx
              {(
                [
                  { side: country, letter: 'A', color: 'a' },
                  { side: compareWith, letter: 'B', color: 'b' },
                ] as const
              ).map(({ side, letter, color }) => (
                <div key={letter} className="flex items-center gap-2 min-w-0">
                  <span className={`compare-badge compare-badge-${color}`}>{letter}</span>
                  <img
                    data-testid="country-flag"
                    src={side.flag}
                    alt={side.flagAlt || `Flag of ${side.name.common}`}
                    className="w-7 h-5 object-cover rounded-sm shadow-sm shrink-0"
                  />
                  <h2 className="text-sm font-bold text-sand-900 dark:text-dark-50 truncate leading-tight">
                    {side.name.common}
                  </h2>
                  {side.capital.length > 0 && (
                    <span className="text-xs text-ice-accessible dark:text-ice truncate">
                      {side.capital.join(', ')}
                    </span>
                  )}
                </div>
              ))}
```

- [ ] **Step 3: Rename the borders-section key too — the same pattern, 35 lines down**

`CompareCountryPanel.tsx` uses this idiom **twice**. Replace lines 210-235 with:

```tsx
              {(
                [
                  { side: country, column: 'a' as const },
                  { side: compareWith, column: 'b' as const },
                ] as const
              ).map(
                ({ side, column }) =>
                  side.borders.length > 0 && (
                    <div key={side.cca3}>
                      <div className="text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice mb-1.5">
                        Borders — {side.name.common}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {side.borders.map((code) => (
                          <BorderChip
                            key={code}
                            code={code}
                            neighbor={byCca3.get(code)}
                            onSelect={(cca3) => onCompareColumnSelect(column, cca3)}
                            size="compare"
                          />
                        ))}
                      </div>
                    </div>
                  ),
              )}
```

- [ ] **Step 4: Confirm no bare `c` object keys survive**

Run:
```bash
grep -n "{ c:\|{ c,\|({ c\b" src/hooks/__tests__/useCountrySearch.test.ts src/components/CompareCountryPanel.tsx
grep -nE "^const c = |^  c\(" src/hooks/__tests__/useCountrySearch.test.ts
```
Expected: no output from either.

Deliberately **not** matched: `useCountrySearch.test.ts:215`'s
`results.slice(0, 3).map((c) => c.cca3)`. A one-character parameter in an inline
`.map()` is idiomatic and is not what produced the phantom edges — those came
from the module-scope `const c = …` factory, which AST extraction saw as a
resolvable definition that bare `c(...)` call sites in `scripts/` could bind to.
Leave line 215 alone; a broader grep like `\bc\.` would flag it and falsely
report this task incomplete.

- [ ] **Step 5: Run the affected tests**

Run:
```bash
npx vitest run src/hooks/__tests__/useCountrySearch.test.ts src/components/__tests__/CompareCountryPanel.test.tsx
```
Expected: PASS. All three renames are pure — no assertion should need editing.

Both edited blocks live in `CompareCountryPanel`'s **mobile** branch (inside
`data-testid="compare-mobile-scroll"`), and `CompareCountryPanel.test.tsx`'s
`renderMobile()` helper (line 385, `isDesktop={false}`) renders that subtree — so
a missed reference throws at render rather than passing silently. The stronger
gate is `tsc`: any `c` left referenced after the key is renamed is a compile
error, which is why Step 6's `npm run check` is the real proof here.

- [ ] **Step 6: Full check**

Run:
```bash
npm run check
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/__tests__/useCountrySearch.test.ts src/components/CompareCountryPanel.tsx
git commit -m "refactor: name two single-letter identifiers

AST extraction resolved bare c(...) call sites in scripts/ against the only c
definition it knew — a test-file helper — and emitted two false indirect_call
edges (validateJoinIntegrity -> c, fetchRestCountries -> c) that surfaced in the
graph report's Surprising Connections.

useCountrySearch.test.ts's factory becomes makeSearchCountry. CompareCountryPanel
used the same { c: ... } idiom twice — the mobile header and the borders section —
and both destructured keys become 'side', not 'country', which would shadow the
enclosing component's prop.

The inline .map((c) => c.cca3) at useCountrySearch.test.ts:215 stays. A
one-character parameter in an inline map is idiomatic, and it is not what
produced the phantom edges — those bound to the module-scope factory definition.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] **Step 1: Full unit suite**

Run:
```bash
npm run check
```
Expected: PASS — lint, typecheck, and all unit tests.

- [ ] **Step 2: Full e2e suite**

Kill any background `npm run dev` first — Playwright's `reuseExistingServer` will otherwise reuse a server started without `VITE_TEST_HOOKS`, and every seam-based spec fails confusingly.

Run:
```bash
npm run test:e2e
```
Expected: PASS, with the usual **5** `test.fixme` quarantines reported — three in `animation-interrupt.spec.ts`, one in `compare-view-dimming.spec.ts`, one in `game-over-mode-switch.spec.ts`, against tracking issues #32, #47 and #136 — plus 13 local-only specs. No new failures. Region badges (`a11y-contrast.spec.ts`) and the map error overlay (`map-reliability.spec.ts`, `webgl-context-loss.spec.ts`) are the specs most likely to notice this work — check those first if something goes red.

- [ ] **Step 3: Confirm the working tree is clean**

Run:
```bash
git status --short
```
Expected: no output. In particular, confirm the Task 3 Step 9 debug `throw` and any Task 4 Step 3 probe edit are gone.

- [ ] **Step 4: Review the phase sequence**

Run:
```bash
git log --oneline -8
```
Expected, newest first: the Task 5 rename, the Task 4 gate, the Task 3 a11y fix, the Task 2 refactor, the unplanned `7ab91ca` premise correction, the Task 1 chore, this plan's own commit, then `8c02bf4 docs: spec revision after critical self-review`. **-8, not -6:** `7ab91ca` landed during pre-flight as an extra commit the original count didn't anticipate, pushing `8c02bf4` from the 6th entry to the 8th.
