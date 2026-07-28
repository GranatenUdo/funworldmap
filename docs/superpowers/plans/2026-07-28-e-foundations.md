# E-Foundations — Observatory Accent Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Observatory direction's foundations as one atomic tranche: the E4 two-accent token system (ice = interactive/wayfinding/selection/compare-B; signal = live game state/loss/wrong-reveal/compare-A; coral retires entirely, teal chrome migrates to ice) and the E2 type-role utilities (`.text-readout`/`.text-display`/`.text-label`) — across chrome AND map paint, so no user ever sees a mixed-accent state.

**Architecture:** Tokens first (Task 1), then three enumerated migration sweeps (chrome, game surfaces, map paint — every occurrence listed file:line → old → new), then a grep-gated retirement sweep that deletes the teal/coral tokens only when zero usages remain. Every e2e/unit color pin is re-anchored in the same commit as the color it pins. `src/index.css` and `src/lib/mapPalette.ts` are touched by multiple tasks — all edits are content-anchored, executed strictly in order 1 → 6.

**Tech Stack:** Tailwind 4 `@theme` tokens, plain CSS utilities, TypeScript paint constants in `mapPalette.ts`, Vitest drift-alarm tests (`?raw` CSS pins), Playwright seam/color-pin e2e.

**Spec:** `docs/superpowers/specs/2026-07-26-ux-visual-program-design.md` — items E2 + E4 and Sequencing tranche 3. Task ↔ spec map: T1=tokens+utilities+backdrop interim, T2/T3=chrome migration, T4=game surfaces, T5=map paint (completes B4's deferred ice re-skin), T6=retirement + atomic verification.

## Global Constraints

- **Atomicity gate:** after Task 6, `grep -rn "teal\|coral"` over `src/` and `e2e/` returns only the enumerated allowed survivors (data-encoding badge hues, sand/dark ramps, historical docs); the `@theme` teal/coral tokens are deleted and the drift alarm asserts their absence. No tranche-internal state ships to main — the branch merges once, whole.
- Semantic ownership (E4): ice family = links, focus, search, basemap toggle, map selection border/glow, compare-B; signal family = score changes, streaks, lost hearts, wrong-guess reveal (absorbs amber), compare-A. Region badges and A5 exception badges are data encodings — untouched. `--color-ice-accessible: #075985` is the light-mode text variant (AA math in Task 1: ≥7:1 on sand surfaces).
- Type roles (E2): `.text-readout` (ui-monospace stack + tabular-nums) applies to compare values and game scores in this tranche; panel hero stats belong to D1 later. No font files change.
- Every changed pinned literal (e2e `a11y-contrast`/`label-contrast` rgb pins, unit className/paint-value pins) is re-anchored in the SAME commit — enumerated per task; pins are never deleted.
- Map paint stays single-owner (`mapLayers.ts` owners, `useSelectionHighlight`/`useCompareViewHighlight`, reveal effects); `mapPalette.ts` gains the documented semantic role structure.
- e2e rules (CLAUDE.md): no `waitForTimeout`, no `force: true`; `--project=chromium --workers=2`; kill stray dev servers first; CI-covered vs local-only stated per task.
- Analytics: **no new telemetry**. Docs: `docs/systems/` color mentions updated in the tasks that stale them.
- Commits: conventional prefix, imperative, trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- After the batch: full `npx vitest run`, full local chromium e2e project, and the both-theme live pass (light+dark × desktop+390px: landing, panel, compare, game, game-over) verifying zero teal/coral chrome pixels.

---

### Task 1: E4 accent tokens + E2 type-role utilities + interim backdrop recolor (foundation)

**Files:**

- Modify: `src/index.css` — three content-anchored edits: the `@theme` block (currently lines 29–62), the `body` backdrop rule (currently lines 64–75), and an insertion after the panel-animation utility block (currently lines 120–124). **Intra-plan collision note:** `src/index.css` is touched again by later tasks in this plan (chrome migration, final sweep). This task runs FIRST and edits the file exactly as it exists on `main` at `db4df72`; every later task must quote the file as it exists AFTER this task's commit. Anchor all edits on content, never on line numbers.
- Create: `src/lib/__tests__/designTokens.test.ts` — drift-alarm unit test (the `layoutConstants.test.ts` pattern: `?raw` import of `index.css`, source-text pins).
- Test: `npx vitest run src/lib/__tests__/designTokens.test.ts` and `npx vitest run src/lib/__tests__/layoutConstants.test.ts`

**Interfaces:**

- Consumes: existing `@theme` tokens in `src/index.css` (`--color-sand-*`, `--color-teal*`, `--color-coral*`, `--font-display`); `vite.config.ts` already has `test.css.include: [/index\.css/]` and `layoutConstants.test.ts` already proves `index.css?raw` imports work under Vitest — **no config change is needed or allowed in this task**.
- Produces (the foundation every later task consumes):
  - `@theme` CSS custom properties, which Tailwind 4 exposes both as `var(--color-…)` and as generated utilities (`text-ice`, `bg-signal/20`, `border-ice/40`, `ring-ice/50`, `text-ice-accessible`, `dark:text-ice-light`, etc.):
    - `--color-ice: #7dd3fc` (Tailwind sky-300), `--color-ice-light: #bae6fd` (sky-200), `--color-ice-dim: #38bdf8` (sky-400)
    - `--color-ice-accessible: #075985` (sky-800 — light-mode text variant, AA math below)
    - `--color-signal: #ff8a4c`, `--color-signal-dim: #f97316` (Tailwind orange-500; hue 24.6° vs signal's 20.8° — same family, one step darker)
  - Plain CSS utility classes (unlayered, like the existing `.panel-card-in` utilities, so they win over layered Tailwind utilities on the same element): `.text-readout`, `.text-display`, `.text-label`
  - Drift-alarm test `src/lib/__tests__/designTokens.test.ts` pinning all of the above
- **Explicit non-goals / ownership:** this task does NOT touch `src/lib/mapPalette.ts` — TS-side `ICE`/`SIGNAL` paint constants are owned by the map-paint migration task of this plan; do not duplicate them here. This task also does NOT migrate any component classes or chrome CSS — the teal/coral `@theme` tokens are **intentionally kept** in this task (components still reference them) and are deleted only by this plan's **final sweep task**, once its grep gate proves zero usages remain. The final sweep task also **inverts** this test's "teal/coral survive" pins to `not.toContain` — that handoff is stated in a code comment in the test itself.
- **WCAG math for `--color-ice-accessible: #075985`** (relative luminance per WCAG 2.1: linearize c/255 via `((c+0.055)/1.055)^2.4`, then `L = 0.2126R + 0.7152G + 0.0722B`; contrast = `(L1+0.05)/(L2+0.05)`):
  - `#075985` → L ≈ 0.0888
  - on `--color-sand-50` `#fefdfb` (L ≈ 0.9829): (0.9829+0.05)/(0.0888+0.05) = **7.4:1** ✓ ≥ 4.5:1
  - on `--color-sand-100` `#faf7f2` (L ≈ 0.9326): (0.9326+0.05)/(0.0888+0.05) = **7.1:1** ✓ ≥ 4.5:1
  - on white (L = 1.0): **7.6:1** ✓ — comfortably clears AA for normal text (and AAA), matching the darkness class of `--color-teal-accessible: #065f56` it patterns after.
- **e2e color-pin audit for this task:** `e2e/a11y-contrast.spec.ts` pins `TEAL_ACCESSIBLE_RGB`/`TEAL_LIGHT_RGB` on the header/nav-controls — untouched here because no component or chrome color changes in this task (teal tokens stay, chrome CSS stays). The only visual change is the body-background hex-tile stroke (`%235eead4` → `%237dd3fc`), which no e2e spec asserts (verified: the only e2e occurrence of `5eead4` is the a11y-contrast constant for the header wordmark, which does not change). No e2e re-anchoring is needed in this commit.

**Steps:**

- [ ] **Write the failing drift-alarm test.** Create `src/lib/__tests__/designTokens.test.ts` with exactly:

  ```ts
  /**
   * Drift alarm: the E4 two-accent tokens (ice / signal), the E2 type-role
   * utilities, and the backdrop hex-tile stroke live in raw CSS that no
   * TypeScript import can see, so this test pins them by source text (the
   * layoutConstants.test.ts pattern). If a token value or utility block is
   * edited, this fails and names the spec item to reconcile
   * (docs/superpowers/specs/2026-07-26-ux-visual-program-design.md, E2/E4).
   */
  import { describe, expect, it } from 'vitest'
  import indexCssSource from '../../index.css?raw'

  // Normalize CRLF -> LF: Windows checkouts with core.autocrlf=true convert
  // the committed LF blob to CRLF on disk; the git blob (and CI's Linux
  // checkout) stay LF. Normalizing keeps these pins platform-agnostic.
  const css = indexCssSource.replace(/\r\n/g, '\n')

  describe('E4 accent tokens (index.css @theme)', () => {
    it('defines the ice ramp (sky-200/300/400)', () => {
      expect(css).toContain('--color-ice: #7dd3fc;')
      expect(css).toContain('--color-ice-light: #bae6fd;')
      expect(css).toContain('--color-ice-dim: #38bdf8;')
    })

    it('defines the AA light-mode ice text variant (sky-800)', () => {
      // 7.4:1 on sand-50, 7.1:1 on sand-100, 7.6:1 on white — see the
      // contrast math in the token's own comment in index.css.
      expect(css).toContain('--color-ice-accessible: #075985;')
    })

    it('defines the signal ramp', () => {
      expect(css).toContain('--color-signal: #ff8a4c;')
      expect(css).toContain('--color-signal-dim: #f97316;')
    })

    it('teal/coral tokens survive until the final sweep task of this plan', () => {
      // HANDOFF: the tranche-3 final sweep task deletes the teal and coral
      // token blocks once its grep gate proves zero usages remain, and
      // INVERTS these two pins to not.toContain in the same commit. Until
      // then their premature removal must fail loudly — components still
      // reference them.
      expect(css).toContain('--color-teal: #14b8a6;')
      expect(css).toContain('--color-coral: #f43f5e;')
    })
  })

  describe('E2 type-role utilities (index.css)', () => {
    it('.text-readout is the system mono stack with tabular figures', () => {
      expect(css).toContain(`.text-readout {
    font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }`)
    })

    it('.text-display is Outfit 700 with tight tracking', () => {
      expect(css).toContain(`.text-display {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: -0.025em;
  }`)
    })

    it('.text-label is 11px uppercase with 0.12em tracking', () => {
      expect(css).toContain(`.text-label {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }`)
    })
  })

  describe('backdrop hex-tile stroke (E4 interim recolor, replaced by E1)', () => {
    it('strokes the hex grid in ice, not retired teal-light', () => {
      expect(css).toContain("stroke='%237dd3fc'")
      expect(css).not.toContain("stroke='%235eead4'")
    })
  })
  ```

  **Indentation warning:** the three multi-line `toContain` template literals above are written with the test file's own 2-space indent inside the backtick string (`\n    font-family…\n  }`). The index.css blocks you write in the implementation step MUST match those strings after the leading `.text-… {` — i.e. index.css uses 2-space property indent and a closing `}` at column 0, so the template literals here deliberately carry TWO extra leading spaces on every continuation line to compensate for the test file's indentation. If the green run fails on whitespace, diff the exact literal against the CSS block — do not loosen the pin to single-property `toContain`s.

- [ ] **Run the test and confirm the expected failure.**

  ```
  npx vitest run src/lib/__tests__/designTokens.test.ts
  ```

  Expected: **7 failed | 1 passed** — every pin except `teal/coral tokens survive…` fails with `AssertionError: expected '…' to contain '--color-ice: #7dd3fc;'` (and the analogous messages for signal, the three utilities, and the backdrop stroke). If the run fails instead with a module-resolution error on `index.css?raw`, stop — the environment differs from `layoutConstants.test.ts`'s working `?raw` import and needs diagnosis, not a config hack.

- [ ] **Implement edit 1 of 3 — `@theme` tokens.** In `src/index.css`, replace this exact block (the tail of the `@theme` block):

  ```css
    --color-teal: #14b8a6;
    --color-teal-light: #5eead4;
    --color-teal-dim: #0d9488;
    /* Deep teal: WCAG AA on white/sand-50 (≥4.5:1). Use for interactive text
       and primary CTA backgrounds in light mode where teal / teal-dim fall short. */
    --color-teal-accessible: #065f56;

    --color-coral: #f43f5e;
    --color-coral-light: #fb7185;
    --color-coral-dim: #e11d48;
  }
  ```

  with:

  ```css
    /* RETIRING (E4): teal and coral survive only until this tranche's final
       sweep task deletes them (zero-usage grep gate). Do not add consumers. */
    --color-teal: #14b8a6;
    --color-teal-light: #5eead4;
    --color-teal-dim: #0d9488;
    /* Deep teal: WCAG AA on white/sand-50 (≥4.5:1). Use for interactive text
       and primary CTA backgrounds in light mode where teal / teal-dim fall short. */
    --color-teal-accessible: #065f56;

    --color-coral: #f43f5e;
    --color-coral-light: #fb7185;
    --color-coral-dim: #e11d48;

    /* E4 two-accent system (Observatory). One meaning per accent:
       ice = interactive + wayfinding (links, focus, search, selection,
       compare-B); signal = live game state + loss (score changes, streaks,
       lost hearts, wrong-guess reveal, compare-A). Ice is the Tailwind sky
       ramp: light=sky-200, base=sky-300, dim=sky-400. */
    --color-ice: #7dd3fc;
    --color-ice-light: #bae6fd;
    --color-ice-dim: #38bdf8;
    /* Deep ice (sky-800): WCAG AA for light-mode interactive text, following
       the --color-teal-accessible pattern. Contrast (WCAG relative-luminance
       formula): 7.4:1 on sand-50 #fefdfb, 7.1:1 on sand-100 #faf7f2, 7.6:1 on
       white — all ≥4.5:1 (AA normal text). */
    --color-ice-accessible: #075985;

    --color-signal: #ff8a4c;
    /* orange-500 — darker signal for borders/edges where the base is too hot */
    --color-signal-dim: #f97316;
  }
  ```

- [ ] **Implement edit 2 of 3 — backdrop stroke interim recolor.** In the `body` rule of `src/index.css`, replace this exact block:

  ```css
    font-family: var(--font-body);
    /* Modern honeycomb / orbital-console backdrop: tileable hex-grid outlines
       (teal at low opacity) overlaying a deep-navy radial gradient. Shows
       through the map canvas's transparent basemap-background layer in the
       sky area around the globe. Space-dark in both themes. */
    background:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill='none' stroke='%235eead4' stroke-opacity='0.22' stroke-width='1'%3E%3Cpath d='M13.99 9.25 L27 16.75 L27 31.75 L13.99 39.25 L1 31.75 L1 16.75 Z'/%3E%3Cpath d='M0 0 L1 0.5 L1 8.5 M27 0.5 L28 0'/%3E%3Cpath d='M27 40.5 L28 41 L28 49 M0 49 L0 41 L1 40.5'/%3E%3C/g%3E%3C/svg%3E"),
      radial-gradient(ellipse at 50% 55%, #16213b 0%, #0a0f1f 55%, #04060d 100%);
  ```

  with (only the stroke hex and one comment word change — `%235eead4` → `%237dd3fc`, "teal" → "ice, E4 interim until E1's starfield replaces the hex tile"):

  ```css
    font-family: var(--font-body);
    /* Modern honeycomb / orbital-console backdrop: tileable hex-grid outlines
       (ice at low opacity — E4 interim recolor until E1's starfield replaces
       the hex tile entirely) overlaying a deep-navy radial gradient. Shows
       through the map canvas's transparent basemap-background layer in the
       sky area around the globe. Space-dark in both themes. */
    background:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill='none' stroke='%237dd3fc' stroke-opacity='0.22' stroke-width='1'%3E%3Cpath d='M13.99 9.25 L27 16.75 L27 31.75 L13.99 39.25 L1 31.75 L1 16.75 Z'/%3E%3Cpath d='M0 0 L1 0.5 L1 8.5 M27 0.5 L28 0'/%3E%3Cpath d='M27 40.5 L28 41 L28 49 M0 49 L0 41 L1 40.5'/%3E%3C/g%3E%3C/svg%3E"),
      radial-gradient(ellipse at 50% 55%, #16213b 0%, #0a0f1f 55%, #04060d 100%);
  ```

- [ ] **Implement edit 3 of 3 — type-role utilities.** In `src/index.css`, immediately after this exact block (the panel-animation utilities — the task brief's "near the existing panel animation utilities"):

  ```css
  .panel-card-in    { animation: panel-card-in 250ms ease-out; }
  .panel-fade-up    { animation: fade-up 200ms ease-out; }
  .panel-field-in-1 { animation: panel-field-in 200ms ease-out 50ms both; }
  .panel-field-in-2 { animation: panel-field-in 200ms ease-out 100ms both; }
  .panel-field-in-3 { animation: panel-field-in 200ms ease-out 150ms both; }
  ```

  insert:

  ```css

  /* --- Type-role utilities (E2, Observatory) ---
     Unlayered on purpose (like the panel utilities above) so a role class
     wins over layered Tailwind utilities on the same element. No colors here:
     color stays per-usage via Tailwind classes. */

  /* Data readouts — panel stats/ranks, compare values, game scores,
     coordinates. System mono (zero bundle cost); tabular figures align digits. */
  .text-readout {
    font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }

  /* Display headings — panel country names, "Game over". */
  .text-display {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: -0.025em;
  }

  /* Micro-labels — field captions, HUD labels. Widens the legacy
     tracking-wider (0.05em) convention to 0.12em. */
  .text-label {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  ```

- [ ] **Run the drift test green.**

  ```
  npx vitest run src/lib/__tests__/designTokens.test.ts
  ```

  Expected: **8 passed**. If a multi-line utility pin fails, the mismatch is whitespace between the CSS block and the template literal — fix the CSS to match the pin (2-space property indent), never weaken the pin.

- [ ] **Confirm the existing index.css pin is untouched.** The B7 drift alarm pins the `@media (pointer: coarse)` block of `index.css` verbatim; none of the three edits touch it, so this must stay green:

  ```
  npx vitest run src/lib/__tests__/layoutConstants.test.ts
  ```

  Expected: all tests pass (11 passed as of `main` at `db4df72`).

- [ ] **Commit.**

  ```
  git add src/index.css src/lib/__tests__/designTokens.test.ts
  git commit -m "feat(theme): E4 ice/signal tokens, E2 type-role utilities, backdrop ice recolor" -m "Tranche-3 foundation: @theme ice ramp (sky-200/300/400 + sky-800 ice-accessible, AA-verified 7.4:1 on sand-50 / 7.1:1 on sand-100), signal ramp (#ff8a4c / orange-500 dim), .text-readout/.text-display/.text-label role utilities, and the interim hex-tile stroke recolor %235eead4 -> %237dd3fc (E1 replaces the backdrop later). Teal/coral tokens intentionally survive: components still consume them; the final sweep task deletes them and inverts the drift pins once its zero-usage grep gate holds. New drift alarm pins all of the above via index.css?raw." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

### Task 2: Migrate index.css chrome blocks + compare badges + Header to ice/signal, re-anchoring the a11y-contrast e2e pins in the same commit

**Files:**

- Modify: `src/index.css` — the chrome blocks only: `.country-tooltip` (~lines 174–244), MapLibre ctrl group (~246–312), attribution (~314–348), compare badges (~350–370). Do NOT touch the `@theme` block (Task 1 owns the token definitions; the retired `--color-teal*`/`--color-coral*` tokens stay until the final grep-gate task because the Oceania region badges still consume `--color-teal`/`--color-teal-light`), do NOT touch the `body` hex-tile data URI (`%235eead4` — owned by the map-paint/backdrop task in this plan), and do NOT touch the `@media (pointer: coarse)` block (pinned verbatim by `src/lib/__tests__/layoutConstants.test.ts`). Task 1 has already inserted tokens into this file — anchor every edit on the content shown below, not on line numbers.
- Modify: `src/components/Header.tsx` (lines 40–88) — wordmark, Play button, satellite toggle.
- Modify: `e2e/a11y-contrast.spec.ts` (lines 55–140) — re-anchor the pinned rgb literals and test titles; add a compare-badge AA test.
- Tests: `e2e/a11y-contrast.spec.ts` (chromium), `src/lib/__tests__/layoutConstants.test.ts` (guard — proves the pinned CSS block survived).

**Interfaces:**

- Consumes (defined by Task 1 in `src/index.css` `@theme` — Tailwind 4 derives all `text-*`/`bg-*`/`border-*`/`ring-*` utilities from these automatically):
  - `--color-ice: #7dd3fc` (dark-mode accent)
  - `--color-ice-dim: #0369a1` (mid accent: light-mode icons/tints/rings, CTA hover)
  - `--color-ice-accessible: #075985` (light-mode text + CTA backgrounds — the `--color-teal-accessible` pattern)
  - `--color-signal: #ff8a4c` (compare-A / live game state)
  - Pre-existing: `--color-dark-500: #121518`, `--color-sand-300: #e0d8cc`.
- Produces: recolored `.compare-badge` / `.compare-badge-a` / `.compare-badge-b` CSS classes (consumed unchanged by `src/components/CountryColumn.tsx` line 32 — no component edit needed for badges); e2e constants `ICE_ACCESSIBLE_RGB` / `ICE_RGB` / `SIGNAL_RGB` / `DARK_INK_RGB` in `a11y-contrast.spec.ts`.
- AA contrast math (WCAG relative-luminance formula, all computed and verified):
  - `#075985` (ice-accessible) on `#fefdfb` sand-50 = **7.44:1**; on white = 7.56:1; on `#faf7f2` sand-100 = 7.08:1 (all ≥ 4.5 ✓)
  - `#7dd3fc` (ice) on `#161a22` dark-400 = **10.45:1**; on attribution pill base `#04060d` = 12.15:1 ✓
  - white on `#075985` = **7.56:1** ✓; white on `#0369a1` (hover) = 5.93:1 ✓
  - Badge ink `#121518` (dark-500) on signal `#ff8a4c` = **7.85:1**; on ice `#7dd3fc` = **10.99:1** ✓ — the outgoing white-on-`#f43f5e` badge was 3.67:1 and white-on-`#0d9488` was 3.74:1, both sub-AA.
- Note: `e2e/label-contrast.spec.ts` was checked — it pins `applyMapTheme` label values (`#64748b`/`#78716c`/`#10141a`/`#e8e3da`) which this tranche does not change. No edit there. `e2e/compare-view-dimming.spec.ts` pins MAP paint (`#f43f5e`/`#0d9488` fills) — those are re-anchored by the map-paint task of this plan, not here.

**Steps:**

- [ ] **Re-anchor the e2e pins and add the badge test (failing first).** In `e2e/a11y-contrast.spec.ts`, inside the `Meta-color contrast` describe, replace:

  ```ts
      const TEAL_ACCESSIBLE_RGB = '6, 95, 86' // #065f56 — --color-teal-accessible
      const TEAL_LIGHT_RGB = '94, 234, 212' // #5eead4 — --color-teal-light
  ```

  with:

  ```ts
      const ICE_ACCESSIBLE_RGB = '7, 89, 133' // #075985 — --color-ice-accessible
      const ICE_RGB = '125, 211, 252' // #7dd3fc — --color-ice
      const SIGNAL_RGB = '255, 138, 76' // #ff8a4c — --color-signal (compare-A)
      const DARK_INK_RGB = '18, 21, 24' // #121518 — --color-dark-500 (compare-badge ink)
  ```

  Then update the five pinned tests (titles AND expectations):
  - `'header wordmark uses teal-accessible in light mode'` → `'header wordmark uses ice-accessible in light mode'`; `toContain(TEAL_ACCESSIBLE_RGB)` → `toContain(ICE_ACCESSIBLE_RGB)` (line 98)
  - `'header Play button uses teal-accessible in light mode'` → `'header Play button uses ice-accessible in light mode'`; same constant swap (line 107)
  - `'header wordmark keeps teal-light in dark mode'` → `'header wordmark keeps ice in dark mode'`; `toContain(TEAL_LIGHT_RGB)` → `toContain(ICE_RGB)` (line 116)
  - `'map nav-control buttons use teal-accessible in light mode'` → `'...use ice-accessible in light mode'`; `TEAL_ACCESSIBLE_RGB` → `ICE_ACCESSIBLE_RGB` (line 127)
  - `'map nav-control buttons keep teal-light in dark mode'` → `'...keep ice in dark mode'`; `TEAL_LIGHT_RGB` → `ICE_RGB` (line 138)

  After the last nav-control test (still inside `Meta-color contrast`), add:

  ```ts
      async function computedBackground(locator: Locator): Promise<string> {
        return locator.evaluate((el) => window.getComputedStyle(el).backgroundColor)
      }

      test('compare badges: A is signal, B is ice, ink is dark-500 (AA on both)', async ({
        page,
      }) => {
        await page.goto('/#FRA')
        const panel = page.getByTestId('country-panel')
        await expect(panel).toBeVisible({ timeout: 15_000 })
        await panel.getByRole('button', { name: /Compare with another country/i }).click()
        await panel.getByRole('button', { name: 'Germany' }).click()
        const badgeA = page.locator('.compare-badge-a')
        const badgeB = page.locator('.compare-badge-b')
        await expect(badgeA).toBeVisible()
        await expect(badgeB).toBeVisible()
        // #121518 on #ff8a4c = 7.85:1, on #7dd3fc = 10.99:1 — the retired
        // white-on-coral/teal-dim badges were 3.67:1 / 3.74:1 (sub-AA).
        expect(await computedBackground(badgeA)).toContain(SIGNAL_RGB)
        expect(await computedBackground(badgeB)).toContain(ICE_RGB)
        expect(await computedColor(badgeA)).toContain(DARK_INK_RGB)
        expect(await computedColor(badgeB)).toContain(DARK_INK_RGB)
      })
  ```

  (`Locator` is already imported at the top of the file; `computedColor` already exists in this describe.)

- [ ] **Run the spec — expect the six color tests to fail.** First ensure no stray dev server is running (a leftover `npm run dev` gets reused by Playwright without `VITE_TEST_HOOKS` — kill it; check with `netstat -ano | findstr :5173`). Then:

  ```
  npx playwright test e2e/a11y-contrast.spec.ts --project=chromium --workers=2
  ```

  Expected: the 5 renamed tests fail with `expect(received).toContain(expected)` — received still `rgb(6, 95, 86)` / `rgb(94, 234, 212)`; the new badge test fails with received `rgb(244, 63, 94)`. The region-badge, tabular-nums, and touch-target tests stay green.

- [ ] **Migrate the index.css chrome blocks.** Apply these exact content-anchored edits (every one is a whole-declaration replacement; keep everything not shown untouched):

  1. In the comment above `.country-tooltip`: `Base = light chrome (A3): sand surface, teal-accessible text; the .dark` → `Base = light chrome (A3): sand surface, ice-accessible text; the .dark`
  2. In `.country-tooltip { ... }`: `color: var(--color-teal-accessible);` → `color: var(--color-ice-accessible);`
  3. In `.dark .country-tooltip { ... }`: `color: #5eead4;` → `color: var(--color-ice);`
  4. In `.country-tooltip .tooltip-name { ... }`: `color: var(--color-teal-accessible);` → `color: var(--color-ice-accessible);`
  5. In `.dark .country-tooltip .tooltip-name { ... }`: `color: #5eead4;` → `color: var(--color-ice);`
  6. In `.dark .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group { ... }`: `border-color: rgba(94, 234, 212, 0.25);` → `border-color: rgba(125, 211, 252, 0.25);`
  7. In `.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button { ... }`: `color: var(--color-teal-accessible);` → `color: var(--color-ice-accessible);`
  8. In `.dark .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button { ... }`: `color: #5eead4;` → `color: var(--color-ice);`
  9. In `...button:hover { ... }` (light): `background: rgba(6, 95, 86, 0.08);` → `background: rgba(7, 89, 133, 0.08);`
  10. In `.dark ...button:hover { ... }`: `background: rgba(94, 234, 212, 0.12);` → `background: rgba(125, 211, 252, 0.12);`
  11. In `.dark ...button + button { ... }`: `border-top-color: rgba(94, 234, 212, 0.15);` → `border-top-color: rgba(125, 211, 252, 0.15);`
  12. Replace the icon-filter rule wholesale. Current:

      ```css
      .dark .maplibregl-ctrl-bottom-right .maplibregl-ctrl-icon {
        filter: brightness(0) saturate(100%) invert(83%) sepia(37%) saturate(356%) hue-rotate(122deg) brightness(92%) contrast(93%);
      }
      ```

      New:

      ```css
      .dark .maplibregl-ctrl-bottom-right .maplibregl-ctrl-icon {
        /* Recolors MapLibre's stock icon sprites to ice: brightness(0) flattens
           to black, then the chain maps black → exactly rgb(125, 211, 252)
           (#7dd3fc) under the CSS filter-effects matrix math (solver-verified
           2026-07-28 — re-solve if --color-ice ever changes). */
        filter: brightness(0) saturate(100%) invert(71%) sepia(68%) saturate(509%) hue-rotate(172deg) brightness(103%) contrast(98%);
      }
      ```

  13. Attribution links — replace all four declarations:

      ```css
      .maplibregl-map .maplibregl-ctrl-attrib a {
        color: var(--color-teal-accessible);
      }

      .dark .maplibregl-map .maplibregl-ctrl-attrib a {
        color: #7dd3c0;
      }

      .maplibregl-map .maplibregl-ctrl-attrib a:hover {
        color: var(--color-teal-accessible);
        text-decoration: underline;
      }

      .dark .maplibregl-map .maplibregl-ctrl-attrib a:hover {
        color: #5eead4;
      }
      ```

      →

      ```css
      .maplibregl-map .maplibregl-ctrl-attrib a {
        color: var(--color-ice-accessible);
      }

      /* Ice on the dark pill (rgba(4,6,13,0.82)) = 12.15:1; hover #bae6fd = 15.26:1. */
      .dark .maplibregl-map .maplibregl-ctrl-attrib a {
        color: var(--color-ice);
      }

      .maplibregl-map .maplibregl-ctrl-attrib a:hover {
        color: var(--color-ice-accessible);
        text-decoration: underline;
      }

      .dark .maplibregl-map .maplibregl-ctrl-attrib a:hover {
        color: #bae6fd;
      }
      ```

  14. Compare badges — replace:

      ```css
      .compare-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        font-size: 10px;
        font-weight: 700;
        color: white;
        flex-shrink: 0;
      }

      .compare-badge-a {
        background: #f43f5e;
      }

      .compare-badge-b {
        background: #0d9488;
      }
      ```

      →

      ```css
      /* Compare A/B badges — E4 accents: A = signal (live/compare-A), B = ice
         (wayfinding/compare-B), matching mapPalette's SIGNAL/ICE compare fills.
         Dark ink instead of white: #121518 on #ff8a4c = 7.85:1, on #7dd3fc =
         10.99:1 (the old white-on-coral/teal-dim pair was 3.67:1 / 3.74:1). */
      .compare-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        font-size: 10px;
        font-weight: 700;
        color: var(--color-dark-500);
        flex-shrink: 0;
      }

      .compare-badge-a {
        background: var(--color-signal);
      }

      .compare-badge-b {
        background: var(--color-ice);
      }
      ```

- [ ] **Migrate Header.tsx.** Three exact edits in `src/components/Header.tsx`:
  1. Wordmark (line 42): `className="text-lg font-bold tracking-wide text-teal-accessible dark:text-teal-light drop-shadow-sm"` → `className="text-lg font-bold tracking-wide text-ice-accessible dark:text-ice drop-shadow-sm"`
  2. Play button (line 69) — in its className string replace `focus-visible:ring-teal/50` → `focus-visible:ring-ice-dim/50 dark:focus-visible:ring-ice/50` and `text-teal-accessible dark:text-teal-light` → `text-ice-accessible dark:text-ice` (rest of the string unchanged).
  3. Satellite toggle (lines 84–86) — replace `focus-visible:ring-teal/50` → `focus-visible:ring-ice-dim/50 dark:focus-visible:ring-ice/50`, and the active-state branch string `'bg-teal/20 dark:bg-teal-light/20 border-teal/40 dark:border-teal-light/30 text-teal-accessible dark:text-teal-light'` → `'bg-ice-dim/20 dark:bg-ice/20 border-ice-dim/40 dark:border-ice/30 text-ice-accessible dark:text-ice'` (inactive branch unchanged).

- [ ] **Run the spec green:**

  ```
  npx playwright test e2e/a11y-contrast.spec.ts --project=chromium --workers=2
  ```

  Expected: all tests pass (including the new badge test and the untouched region-badge/tabular-nums/touch-target tests).

- [ ] **Run the CSS drift guard** (this test pins the `@media (pointer: coarse)` block in index.css verbatim — proves the chrome edits didn't disturb it):

  ```
  npx vitest run src/lib/__tests__/layoutConstants.test.ts
  ```

  Expected: pass.

- [ ] **Commit:**

  ```
  git add src/index.css src/components/Header.tsx e2e/a11y-contrast.spec.ts
  git commit -m "feat(e4): migrate map chrome, header, and compare badges to ice/signal accents" -m "index.css chrome blocks (tooltip, nav ctrl incl. re-solved icon filter, attribution) and Header move teal->ice; compare badges A/B move coral/teal-dim -> signal/ice with AA dark ink (7.85:1 / 10.99:1). a11y-contrast e2e pins re-anchored to the new rgb values in the same commit." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 3: Sweep the remaining non-game components teal→ice (coral-free), apply `.text-readout` to CompareField values, and pin the migration with a unit drift alarm

**Files:**

- Modify: `src/App.tsx` (lines 313, 319, 338, 345, 397), `src/components/SearchBar.tsx` (108, 110, 145, 205), `src/components/ThemeToggle.tsx` (19, 28), `src/components/Toast.tsx` (27), `src/components/WorldMap.tsx` (110), `src/components/BorderChip.tsx` (14, 16), `src/components/FieldLabel.tsx` (13), `src/components/TimezoneList.tsx` (18), `src/components/SourceTooltip.tsx` (56, 75), `src/components/SingleCountryPanel.tsx` (171, 181, 224, 244, 299, 345, 391), `src/components/CompareCountryPanel.tsx` (88, 130, 140), `src/components/CountryColumn.tsx` (7, 10, 44, 84), `src/components/Launcher.tsx` (141, 159), `src/components/LauncherModeCard.tsx` (8, 25, 85).
- Create: `src/components/__tests__/chromeAccent.test.tsx`.
- Verified zero teal/coral occurrences, no edit needed: `CloseButton.tsx`, `BasemapBanner.tsx` (amber = status encoding), `MapErrorOverlay.tsx` (slate), `CountryPanel.tsx`. `Header.tsx` was migrated in Task 2.
- Explicitly NOT touched (owned elsewhere in this plan): `src/lib/mapPalette.ts`, `src/lib/mapLayers.ts`, `src/hooks/useMapTheme.ts`, `src/hooks/useCompareViewHighlight.ts` and their tests (map-paint tasks); `src/game/**` (game-chrome task); region badges at `SearchBar.tsx:21` (`REGION_COLORS.Oceania`) and `SingleCountryPanel.tsx:63` (`REGION_BADGE.Oceania`) and the A5 `EXCEPTION_BADGE` amber (`SingleCountryPanel.tsx:71-72`) — data encodings, stay as-is; the `@theme` teal/coral token definitions in `index.css` (final grep-gate task decides their fate; `--color-teal`/`--color-teal-light` must survive for the Oceania badges).
- Tests: `src/components/__tests__/chromeAccent.test.tsx` (new), full `npx vitest run`. No e2e spec pins any color changed here (verified: the only chrome color pins live in `a11y-contrast.spec.ts`, re-anchored in Task 2; `compare-view-dimming.spec.ts` pins map paint, owned by the map-paint task).

**Interfaces:**

- Consumes (from Task 1's `@theme` in `src/index.css`): `--color-ice: #7dd3fc`, `--color-ice-dim: #0369a1`, `--color-ice-accessible: #075985`; and Task 1's `.text-readout` utility (system mono stack + `font-variant-numeric: tabular-nums` — E2). Do not redefine any of these.
- Mapping rule applied uniformly (state for review, verified AA values in Task 2's Interfaces): light-mode **text** → `text-ice-accessible` (7.08–7.56:1 on sand surfaces); light-mode **non-text accents** (icon strokes, tint backgrounds, borders, focus rings) → `ice-dim` at the existing alpha (#0369a1 on sand-100 = 5.55:1, ≥3:1 non-text ✓); dark-mode accents → `ice` (≥9.3:1 on all dark surfaces); surfaces dark in BOTH themes (toast, hint pill, launcher backdrop, source-tooltip card) → single `ice` class, no `dark:` split; solid CTA backgrounds → `bg-ice-accessible` + `hover:bg-ice-dim` (white text 7.56:1 / 5.93:1 — the outgoing `bg-teal` launcher CTA was white-on-#14b8a6 = 2.49:1, sub-AA).
- Produces: no new exports; the drift-alarm test file.

**Complete occurrence enumeration** (grep `teal|coral` over `src/App.tsx src/components`, game/ excluded — every hit below is migrated in the steps; the only survivors are the two Oceania region-badge lines):

| file:line | old (fragment) | new |
|---|---|---|
| App.tsx:313, 319 | `focus:bg-teal focus:text-white` | `focus:bg-ice-accessible focus:text-white` |
| App.tsx:338 | `text-teal dark:text-teal-light` | `text-ice-accessible dark:text-ice` |
| App.tsx:345 | `bg-teal dark:bg-teal-light` | `bg-ice-accessible dark:bg-ice` |
| App.tsx:397 | `border-teal/20 dark:border-teal-light/20 text-teal-light` | `border-ice/20 text-ice` |
| SearchBar.tsx:108 | comment `teal colored` | `ice colored` |
| SearchBar.tsx:110 | `text-teal dark:text-teal-light` | `text-ice-dim dark:text-ice` |
| SearchBar.tsx:145 | `focus-visible:ring-teal/40 focus:border-teal/40 dark:focus:border-teal-light/30` | `focus-visible:ring-ice-dim/40 dark:focus-visible:ring-ice/40 focus:border-ice-dim/40 dark:focus:border-ice/30` |
| SearchBar.tsx:205 | `bg-teal/8 dark:bg-teal-light/10 border-l-3 border-l-teal dark:border-l-teal-light` | `bg-ice-dim/8 dark:bg-ice/10 border-l-3 border-l-ice-dim dark:border-l-ice` |
| ThemeToggle.tsx:19 | `focus-visible:ring-teal/50` | `focus-visible:ring-ice-dim/50 dark:focus-visible:ring-ice/50` |
| ThemeToggle.tsx:28 | `text-teal-light` | `text-ice` |
| Toast.tsx:27 | `border-teal/30 text-teal-light` | `border-ice/30 text-ice` |
| WorldMap.tsx:110 | `focus-visible:outline-teal dark:focus-visible:outline-teal-light` | `focus-visible:outline-ice-dim dark:focus-visible:outline-ice` |
| BorderChip.tsx:14, 16 | `border-teal/20 dark:border-teal-light/15 bg-teal/5 dark:bg-teal-light/5 text-teal-dim dark:text-teal-light hover:bg-teal/12 dark:hover:bg-teal-light/12` | `border-ice-dim/20 dark:border-ice/15 bg-ice-dim/5 dark:bg-ice/5 text-ice-accessible dark:text-ice hover:bg-ice-dim/12 dark:hover:bg-ice/12` |
| FieldLabel.tsx:13 | `text-teal dark:text-teal-light` | `text-ice-accessible dark:text-ice` |
| TimezoneList.tsx:18 | `text-teal-accessible dark:text-teal-light` … `focus-visible:ring-teal/40` | `text-ice-accessible dark:text-ice` … `focus-visible:ring-ice-dim/40 dark:focus-visible:ring-ice/40` |
| SourceTooltip.tsx:56 | `hover:text-teal dark:hover:text-teal-light` … `focus-visible:ring-teal/50` | `hover:text-ice-accessible dark:hover:text-ice` … `focus-visible:ring-ice-dim/50 dark:focus-visible:ring-ice/50` |
| SourceTooltip.tsx:75 | `text-teal-light hover:text-teal` | `text-ice hover:text-ice/80` (card bg is dark in both themes) |
| SingleCountryPanel.tsx:171 | `bg-teal/10 dark:bg-teal-light/10 border border-teal/20 dark:border-teal-light/20 text-xs text-teal dark:text-teal-light` | `bg-ice-dim/10 dark:bg-ice/10 border border-ice-dim/20 dark:border-ice/20 text-xs text-ice-accessible dark:text-ice` |
| SingleCountryPanel.tsx:181 | `hover:bg-teal/20 dark:hover:bg-teal-light/20` | `hover:bg-ice-dim/20 dark:hover:bg-ice/20` |
| SingleCountryPanel.tsx:224 | `text-teal dark:text-teal-light` | `text-ice-accessible dark:text-ice` |
| SingleCountryPanel.tsx:244 | `text-teal dark:text-teal-light` | `text-ice-dim dark:text-ice` (icon) |
| SingleCountryPanel.tsx:299 | `bg-teal-accessible text-white … hover:bg-teal-dim … focus-visible:ring-teal-accessible/60` | `bg-ice-accessible text-white … hover:bg-ice-dim … focus-visible:ring-ice-accessible/60` |
| SingleCountryPanel.tsx:345 | `bg-teal/10 dark:bg-teal-light/10` | `bg-ice-dim/10 dark:bg-ice/10` |
| SingleCountryPanel.tsx:391 | `text-teal dark:text-teal-light` | `text-ice-accessible dark:text-ice` |
| CompareCountryPanel.tsx:88 | `text-teal-accessible dark:text-teal-light` | `text-ice-accessible dark:text-ice` |
| CompareCountryPanel.tsx:130 | `text-teal dark:text-teal-light` | `text-ice-accessible dark:text-ice` |
| CompareCountryPanel.tsx:140 | `text-teal-accessible dark:text-teal-light … focus-visible:ring-teal/60` | `text-ice-accessible dark:text-ice … focus-visible:ring-ice-dim/60 dark:focus-visible:ring-ice/60` |
| CountryColumn.tsx:7 | `text-teal dark:text-teal-light` | `text-ice-accessible dark:text-ice` |
| CountryColumn.tsx:10 | `className="text-sm text-sand-800 dark:text-dark-50"` | `className="text-readout text-sm text-sand-800 dark:text-dark-50"` (E2 — compare values) |
| CountryColumn.tsx:44 | `text-teal dark:text-teal-light` | `text-ice-accessible dark:text-ice` |
| CountryColumn.tsx:84 | `text-teal dark:text-teal-light` | `text-ice-accessible dark:text-ice` |
| Launcher.tsx:141 | `focus-visible:ring-teal/60` | `focus-visible:ring-ice/60` (dark backdrop both themes) |
| Launcher.tsx:159 | `text-teal dark:text-teal-light` | `text-ice` (dark backdrop both themes) |
| LauncherModeCard.tsx:8, 25 | `text-teal dark:text-teal-light` | `text-ice-dim dark:text-ice` (icons) |
| LauncherModeCard.tsx:85 | `bg-teal text-white font-semibold hover:bg-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60` | `bg-ice-accessible text-white font-semibold hover:bg-ice-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/60 dark:focus-visible:ring-ice/60` |

(Launcher/LauncherModeCard: color-token swap ONLY — the full instrument-card identity is E6, a later plan. Panel hero stats are D1, a later plan — do not add `.text-readout` beyond the CompareField value line above; single-panel DataCells already set `tabular-nums` and keep their current face until D1.)

**Steps:**

- [ ] **Write the failing drift-alarm test.** Create `src/components/__tests__/chromeAccent.test.tsx`:

  ```tsx
  import { describe, it, expect, vi } from 'vitest'
  import { render, screen } from '@testing-library/react'
  import { BorderChip } from '../BorderChip'
  import { CountryColumn } from '../CountryColumn'
  import { makeCountry } from './singleCountryPanelTestUtils'

  /** E4 two-accent migration drift alarm: chrome accents are the ice family;
   *  teal is retired from chrome (it survives ONLY in the Oceania region-badge
   *  data encodings, which render via REGION_BADGE/REGION_COLORS maps, not
   *  these components' accent classes). E2: CompareField values render in the
   *  .text-readout face. */
  describe('E4 ice chrome + E2 readout drift alarm', () => {
    it('BorderChip buttons use ice-family classes, no teal', () => {
      render(
        <BorderChip
          code="DZA"
          neighbor={makeCountry({ cca3: 'DZA', name: { common: 'Algeria', official: 'Algeria' } })}
          onSelect={vi.fn()}
          size="panel"
        />,
      )
      const cls = screen.getByRole('button', { name: 'Algeria' }).className
      expect(cls).toContain('text-ice-accessible')
      expect(cls).toContain('dark:text-ice')
      expect(cls).not.toMatch(/teal/)
    })

    it('CompareField labels are ice and values use .text-readout (E2)', () => {
      render(
        <CountryColumn
          country={makeCountry()}
          byCca3={new Map()}
          onSelect={vi.fn()}
          badgeLetter="A"
          badgeColor="a"
        />,
      )
      const label = screen.getByText('Population')
      expect(label.className).toContain('text-ice-accessible')
      expect(label.className).toContain('dark:text-ice')
      expect(label.className).not.toMatch(/teal/)
      // makeCountry defaults population to 67_000_000 (France fixture)
      const value = screen.getByText('67,000,000')
      expect(value.className).toContain('text-readout')
    })
  })
  ```

- [ ] **Run it — expect failure:**

  ```
  npx vitest run src/components/__tests__/chromeAccent.test.tsx
  ```

  Expected: both tests fail — `expect(cls).toContain('text-ice-accessible')` receives the current `text-teal-dim dark:text-teal-light` chip string, and the value div has no `text-readout`.

- [ ] **Sweep group 1 — panel/compare components.** Apply the enumerated table rows exactly, quoting current code:
  - `BorderChip.tsx` — in BOTH `BUTTON_CLASSES.panel` (line 14) and `BUTTON_CLASSES.compare` (line 16) replace the fragment `border-teal/20 dark:border-teal-light/15 bg-teal/5 dark:bg-teal-light/5 text-teal-dim dark:text-teal-light hover:bg-teal/12 dark:hover:bg-teal-light/12` with `border-ice-dim/20 dark:border-ice/15 bg-ice-dim/5 dark:bg-ice/5 text-ice-accessible dark:text-ice hover:bg-ice-dim/12 dark:hover:bg-ice/12` (spacing/scale suffixes of each string unchanged).
  - `FieldLabel.tsx:13` — `DEFAULT_CLASSNAME = 'text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light mb-0.5 flex items-center gap-1'` → `'text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice mb-0.5 flex items-center gap-1'`.
  - `TimezoneList.tsx:18` — `className="text-teal-accessible dark:text-teal-light text-xs underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 rounded"` → `className="text-ice-accessible dark:text-ice text-xs underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/40 dark:focus-visible:ring-ice/40 rounded"`.
  - `SourceTooltip.tsx:56` — replace `hover:text-teal dark:hover:text-teal-light` → `hover:text-ice-accessible dark:hover:text-ice` and `focus-visible:ring-teal/50` → `focus-visible:ring-ice-dim/50 dark:focus-visible:ring-ice/50`. Line 75 — `className="text-teal-light hover:text-teal underline"` → `className="text-ice hover:text-ice/80 underline"`.
  - `SingleCountryPanel.tsx` — the six rows from the table (lines 171, 181, 224, 244, 299, 345, 391), each an in-string fragment swap; line 63's `REGION_BADGE.Oceania` and lines 71–72's `EXCEPTION_BADGE` stay byte-identical.
  - `CompareCountryPanel.tsx` — lines 88, 130, 140 per the table (line 88 keeps `py-1.5` and `text-sm` intact — `layoutConstants.test.ts` pins those fragments on the exit-compare button).
  - `CountryColumn.tsx` — lines 7, 44, 84 accent swaps; line 10 gains `text-readout` as the first class.

- [ ] **Sweep group 2 — app shell.** `App.tsx` lines 313/319 (both skip links), 338 (loading wordmark), 345 (loading dots), 397 (hint pill: full fragment `border border-teal/20 dark:border-teal-light/20 text-teal-light` → `border border-ice/20 text-ice`; the pill bg is `bg-dark-400/80 dark:bg-dark-300/80`, dark in both themes — ice reads 10.45:1/9.33:1). The vignette style block (~line 355) is pure black rgba — untouched. `SearchBar.tsx` lines 108/110/145/205 per the table (line 21 `REGION_COLORS.Oceania` stays byte-identical). `ThemeToggle.tsx` lines 19/28. `Toast.tsx` line 27. `WorldMap.tsx` line 110.

- [ ] **Sweep group 3 — launcher (non-game chrome only).** `Launcher.tsx` line 141 (`focus-visible:ring-teal/60` → `focus-visible:ring-ice/60`) and line 159 (`className="text-2xl font-bold tracking-wide text-teal dark:text-teal-light drop-shadow-sm"` → `className="text-2xl font-bold tracking-wide text-ice drop-shadow-sm"` — the launcher backdrop is `bg-black/55` in both themes). `LauncherModeCard.tsx` lines 8 and 25 (`className="w-8 h-8 text-teal dark:text-teal-light"` → `className="w-8 h-8 text-ice-dim dark:text-ice"`) and line 85 CTA per the table (note this also fixes the sub-AA white-on-#14b8a6 = 2.49:1 → 7.56:1; `hover:bg-teal-600` was Tailwind's default palette teal — it goes too).

- [ ] **Run the drift alarm green:**

  ```
  npx vitest run src/components/__tests__/chromeAccent.test.tsx
  ```

  Expected: 2 passed.

- [ ] **Grep gate for this sweep's scope** (Git Bash):

  ```
  grep -rnE "teal|coral" src/App.tsx src/components --include="*.tsx" --include="*.ts"
  ```

  Expected output: EXACTLY two hits, both Oceania region-badge data encodings — `src/components/SearchBar.tsx` (`REGION_COLORS` map) and `src/components/SingleCountryPanel.tsx` (`REGION_BADGE` map). Any other hit is a missed migration — fix it before proceeding. (mapPalette/mapLayers/hooks/game still contain teal/coral at this point; they are later tasks in this plan, gated by the plan's final repo-wide grep task.)

- [ ] **Full unit suite + lint** (the lint run also enforces the CLAUDE.md Playwright bans; the vitest run proves no other component test pinned the old class strings):

  ```
  npx vitest run
  npm run lint
  ```

  Expected: all green. (`src/hooks/__tests__` teal/coral tests still pass — they pin `mapPalette` constants this task does not touch.)

- [ ] **Commit:**

  ```
  git add src/App.tsx src/components/SearchBar.tsx src/components/ThemeToggle.tsx src/components/Toast.tsx src/components/WorldMap.tsx src/components/BorderChip.tsx src/components/FieldLabel.tsx src/components/TimezoneList.tsx src/components/SourceTooltip.tsx src/components/SingleCountryPanel.tsx src/components/CompareCountryPanel.tsx src/components/CountryColumn.tsx src/components/Launcher.tsx src/components/LauncherModeCard.tsx src/components/__tests__/chromeAccent.test.tsx
  git commit -m "feat(e4): sweep non-game chrome to ice accents; CompareField values adopt text-readout" -m "36 enumerated teal occurrences across 14 components/App migrate to the ice family per the E4 mapping rule (light text ice-accessible, light non-text ice-dim, dark ice); launcher CTA gains AA (2.49:1 -> 7.56:1). Region badges and A5 exception badges stay as data encodings. E2: CompareField value cells gain .text-readout. New chromeAccent drift-alarm unit test pins the migration." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

### Task 4: Game-surface accent migration — signal owns live game state + loss (E4) + readout type roles (E2)

The game HUD, game-over overlay, and reveal palette move onto the two-accent system: **signal** (`#ff8a4c` family) takes every live-game-state and loss surface (streak badge, lost hearts, the wrong-guess reveal — absorbing the old amber role), **ice** (`#7dd3fc` family) takes the interactive chrome that was teal (focus rings, PB text, game-over buttons, tutorial pill). Hearts flip prominence: alive hearts become neutral (starlight in dark mode), a LOST heart becomes the loud signal one. Game scores adopt the `.text-readout` mono role; the "Game over" title adopts `.text-display`. **Color/type only — no motion work here; F1 (a later plan) owns the heart-loss animation. Do not add keyframes or `data-animation-state`.**

**Files:**

- Modify: `src/lib/mapPalette.ts` (header doc comment; the reveal-feedback block — currently lines 14–17. This file is also touched by this plan's token and map-paint tasks: anchor every edit on the quoted content, never on line numbers)
- Modify: `src/game/hooks/useRevealMapEffects.ts` (the `MARKER_COLOR_BY_ROLE` doc comment, currently lines 32–35)
- Modify: `src/game/shared/hud/LivesIndicator.tsx` (line 20)
- Modify: `src/game/shared/hud/ScoreBadge.tsx` (line 8)
- Modify: `src/game/shared/hud/StreakBadge.tsx` (line 9)
- Modify: `src/game/shared/hud/GameOverOverlay.tsx` (lines 64, 78, 88, 99, 111, 119)
- Modify: `src/game/shared/hud/HudShell.tsx` (line 44)
- Modify: `src/game/modes/city-guessing/CityGuessingHud.tsx` (line 64)
- Modify: `src/game/shared/hud/FirstSessionTutorial.tsx` (line 44)
- Modify: `src/game/hooks/__tests__/useRevealMapEffects.test.tsx` (two stale test names + one new value-pin test)
- Modify: `src/game/shared/hud/__tests__/ScoreBadge.test.tsx` (one new test)
- Modify: `src/game/shared/hud/__tests__/GameOverOverlay.test.tsx` (two new tests)
- Create: `src/game/shared/hud/__tests__/LivesIndicator.test.tsx`
- Create: `src/game/shared/hud/__tests__/StreakBadge.test.tsx`
- Tests (unit): `npx vitest run src/game`
- Tests (e2e, local verification): `npx playwright test e2e/game-country-pinning.spec.ts e2e/game-city-guessing.spec.ts e2e/game-over-mode-switch.spec.ts e2e/tutorial-first-click.spec.ts e2e/reveal-animation.spec.ts e2e/reveal-animation-reduced-motion.spec.ts --project=chromium --workers=2`

**Interfaces:**

*Consumes (canonical owners are earlier tasks in THIS plan — never redefine these here):*

- CSS theme tokens in `src/index.css` `@theme` (owner: this plan's token-definition task): `--color-ice: #7dd3fc`, `--color-ice-dim: #0369a1`, `--color-ice-accessible: #075985`, `--color-signal: #ff8a4c`, `--color-signal-accessible: #9a3412` — consumed as Tailwind classes `text-ice`, `text-ice-accessible`, `bg-ice-accessible`, `hover:bg-ice-dim`, `ring-ice/50`, `ring-ice-accessible/50`, `border-ice/30`, `text-signal`, `text-signal-accessible`, `bg-signal/15`, `border-signal/30`.
- Type-role utilities in `src/index.css` (owner: this plan's E2 utilities task): `.text-readout` (system mono stack + `font-variant-numeric: tabular-nums`, no size/weight) and `.text-display` (Outfit 700, tight tracking, no size).
- `SIGNAL` constant, `export const SIGNAL = '#ff8a4c'` in `src/lib/mapPalette.ts` (owner: this plan's map-paint task, which replaced `TEAL`/`CORAL` with `ICE`/`SIGNAL` and mechanically updated importers — including the `ICE` import in `useRevealMapEffects.ts`'s `MARKER_COLOR_BY_ROLE`).

*Produces (consumed by later work):*

- `REVEAL_WRONG = SIGNAL` (value `'#ff8a4c'`) in `src/lib/mapPalette.ts` — consumed by `useRevealMapEffects.ts`, its unit tests, and the reveal e2e specs. `REVEAL_CORRECT = '#22c55e'` is **unchanged** (outcome-green is an outcome encoding, not an accent).
- The two-accent semantic contract documented in the `mapPalette.ts` header comment (referenced by later plans C2, E6, F1).
- Heart color contract for F1's animation plan: alive = `text-sand-500 dark:text-dark-50`, lost = `text-signal-accessible dark:text-signal`, pinned by `LivesIndicator.test.tsx`.

**Migration enumeration** (every occurrence this task changes; from `grep -rniE "teal|coral|amber|rose|REVEAL_WRONG" src/game src/lib/mapPalette.ts`):

| # | Location | Old | New |
|---|----------|-----|-----|
| 1 | `src/lib/mapPalette.ts:17` | `export const REVEAL_WRONG = '#f59e0b'` (amber-500) | `export const REVEAL_WRONG = SIGNAL` (`#ff8a4c`) |
| 2 | `src/lib/mapPalette.ts:14–15` | reveal comment "…arc and target marker are amber" | signal wording (see step 8) |
| 3 | `src/lib/mapPalette.ts:1` | header doc comment (pre-plan: "Warm Explorer palette — teal for exploration, coral for selection") | normative two-accent E4 header (see step 8) |
| 4 | `src/game/hooks/useRevealMapEffects.ts:34–35` | comment "…player's guess is teal; …falls through to amber" | ice/signal wording (see step 9) |
| 5 | `src/game/shared/hud/LivesIndicator.tsx:20` | `active ? 'text-rose-500' : 'text-sand-300 dark:text-dark-200'` | `active ? 'text-sand-500 dark:text-dark-50' : 'text-signal-accessible dark:text-signal'` |
| 6 | `src/game/shared/hud/ScoreBadge.tsx:8` | `text-sm font-semibold tabular-nums` | `text-readout text-sm font-semibold` |
| 7 | `src/game/shared/hud/StreakBadge.tsx:9` | `bg-teal/15 dark:bg-teal-light/15 border border-teal/30 dark:border-teal-light/30 … text-teal dark:text-teal-light` | `bg-signal/15 border border-signal/30 … text-signal-accessible dark:text-signal` |
| 8 | `src/game/shared/hud/GameOverOverlay.tsx:64` | title `text-xl font-bold` | `text-display text-xl` |
| 9 | `src/game/shared/hud/GameOverOverlay.tsx:78` | score `<dd>` `font-bold … tabular-nums` | `text-readout … font-bold` |
| 10 | `src/game/shared/hud/GameOverOverlay.tsx:88` | streak `<dd>` (identical class string to #9) | same change as #9 |
| 11 | `src/game/shared/hud/GameOverOverlay.tsx:99` | `text-teal-accessible dark:text-teal-light` | `text-ice-accessible dark:text-ice` |
| 12 | `src/game/shared/hud/GameOverOverlay.tsx:111` | `bg-teal-accessible … hover:bg-teal-dim … ring-teal-accessible/50` | `bg-ice-accessible … hover:bg-ice-dim … ring-ice-accessible/50` |
| 13 | `src/game/shared/hud/GameOverOverlay.tsx:119` | `focus-visible:ring-teal/50` | `focus-visible:ring-ice/50` |
| 14 | `src/game/shared/hud/HudShell.tsx:44` | `focus-visible:ring-teal/50` | `focus-visible:ring-ice/50` |
| 15 | `src/game/modes/city-guessing/CityGuessingHud.tsx:64` | `focus-visible:ring-teal/50` | `focus-visible:ring-ice/50` |
| 16 | `src/game/shared/hud/FirstSessionTutorial.tsx:44` | `border border-teal/30 dark:border-teal-light/30 text-teal-light` | `border border-ice/30 text-ice` |
| 17 | `src/game/hooks/__tests__/useRevealMapEffects.test.tsx:115` | test name `'paints orange wrong-country border…'` | `'paints signal wrong-country border…'` |
| 18 | `src/game/hooks/__tests__/useRevealMapEffects.test.tsx:494` | test name `'colors the fill amber on a wrong-country reveal'` | `'colors the fill signal on a wrong-country reveal'` |

**E2E pin audit (lesson 4 — done, no re-anchoring needed in this task):** the affected e2e specs were grepped for pinned color/class literals. `e2e/reveal-animation.spec.ts` and `e2e/reveal-animation-reduced-motion.spec.ts` import `REVEAL_FILL_SETTLED`/`REVEAL_FILL_REDUCED` symbolically and assert `fill-opacity`, never `fill-color` — the `REVEAL_WRONG` value change flows through without spec edits. `e2e/game-country-pinning.spec.ts`, `e2e/game-city-guessing.spec.ts`, `e2e/mobile-free-play.spec.ts`, `e2e/tutorial-first-click.spec.ts`, `e2e/game-over-mode-switch.spec.ts` assert only text content and `aria-label`s on `hud-score`/`hud-lives`/`game-over-score` — no color or class pins. The teal pins in `e2e/a11y-contrast.spec.ts` (header/nav chrome) and the `CORAL` pin in `e2e/compare-view-dimming.spec.ts` are owned by this plan's chrome and map-paint tasks respectively — do not touch them here. `src/lib/__tests__/layoutConstants.test.ts` pins on `HudShell`/`CityGuessingHud` reference only `TOUCH_TARGET_TEXT_XS` and the literal `text-xs`, both preserved by every edit above. `docs/systems/*` was grepped for `amber|rose|heart` — no hits, no doc staleness. **Contrast math for the new pairings (both themes AA / 1.4.11):** lost heart light `#9a3412` on HUD `sand-50` ≈ 7.1:1, dark `#ff8a4c` on `dark-400` ≈ 7.4:1; alive heart light `sand-500 #8c8578` on `sand-50` ≈ 3.5:1 (≥3:1 non-text), dark `dark-50` on `dark-400` ≈ 15:1; streak text light `#9a3412` on `signal/15`-over-`sand-50` (≈`#feece1`) ≈ 6.3:1, dark `#ff8a4c` on `signal/15`-over-`dark-400` ≈ 5.8:1; PB text light `#075985` on `sand-50` ≈ 7.4:1, dark `#7dd3fc` on `dark-400` ≈ 10.4:1; Play-again white on `#075985` ≈ 7.6:1, hover white on `#0369a1` ≈ 5.9:1; tutorial `#7dd3fc` on `dark-400/95` ≈ 10.4:1.

**Steps:**

- [ ] 1. Preflight — verify the upstream tasks of this plan landed the tokens this task consumes (do NOT define any of them here; if a name below is missing or differs, STOP and reconcile with the token/map-paint tasks of this plan before proceeding):

  ```
  grep -n "color-ice\|color-signal" src/index.css
  ```
  Expected: five `@theme` lines — `--color-ice: #7dd3fc`, `--color-ice-dim: #0369a1`, `--color-ice-accessible: #075985`, `--color-signal: #ff8a4c`, `--color-signal-accessible: #9a3412`.

  ```
  grep -n "text-readout\|text-display" src/index.css
  ```
  Expected: the `.text-readout` and `.text-display` utility definitions.

  ```
  grep -n "SIGNAL\|ICE\|TEAL\|CORAL" src/lib/mapPalette.ts src/game/hooks/useRevealMapEffects.ts
  ```
  Expected: `mapPalette.ts` exports `ICE` and `SIGNAL` (no `TEAL`/`CORAL` remain); `useRevealMapEffects.ts` imports `ICE` and uses it in `MARKER_COLOR_BY_ROLE` (the map-paint task renamed the constant when it retired teal). Also confirm the only remaining `amber` in the hook is the doc comment: `grep -n "amber\|f59e0b" src/game/hooks/useRevealMapEffects.ts` → expect exactly one comment hit (line ~35) and no hex hit.

- [ ] 2. Failing test — pin the new `REVEAL_WRONG` value. In `src/game/hooks/__tests__/useRevealMapEffects.test.tsx`, immediately after the test currently named `'paints orange wrong-country border on round-ended (wrong country reveal)'` (ends line 129), insert:

  ```ts
  it('REVEAL_WRONG is the signal accent — E4 absorbed the old amber role', () => {
    expect(REVEAL_WRONG).toBe('#ff8a4c')
    expect(REVEAL_CORRECT).toBe('#22c55e') // outcome green, not an accent — unchanged
  })
  ```

  In the same edit, update the two stale test names (rows 17–18 of the table): line 115 `'paints orange wrong-country border on round-ended (wrong country reveal)'` → `'paints signal wrong-country border on round-ended (wrong country reveal)'`; line 494 `'colors the fill amber on a wrong-country reveal'` → `'colors the fill signal on a wrong-country reveal'`. (Both tests assert the imported `REVEAL_WRONG` symbolically, so only the names change.)

- [ ] 3. Failing test — create `src/game/shared/hud/__tests__/LivesIndicator.test.tsx`:

  ```tsx
  import { describe, it, expect } from 'vitest'
  import { render, screen } from '@testing-library/react'
  import { LivesIndicator } from '../LivesIndicator'

  describe('LivesIndicator', () => {
    it('labels the remaining lives', () => {
      render(<LivesIndicator lives={2} />)
      expect(screen.getByTestId('hud-lives').getAttribute('aria-label')).toBe('2 lives remaining')
    })

    // E4 drift alarm: alive hearts are neutral (starlight in dark mode); a LOST
    // heart is the signal accent — loss is live game state. F1's heart-loss
    // animation (later plan) consumes exactly this class contract.
    it('renders alive hearts neutral and lost hearts signal', () => {
      render(<LivesIndicator lives={1} />)
      const hearts = Array.from(screen.getByTestId('hud-lives').querySelectorAll('svg'))
      expect(hearts).toHaveLength(3)
      // Heart 0 is alive (i < lives); hearts 1 and 2 are lost.
      expect(hearts[0].getAttribute('class')).toContain('text-sand-500 dark:text-dark-50')
      for (const lost of hearts.slice(1)) {
        expect(lost.getAttribute('class')).toContain('text-signal-accessible dark:text-signal')
      }
    })
  })
  ```

- [ ] 4. Failing test — create `src/game/shared/hud/__tests__/StreakBadge.test.tsx`:

  ```tsx
  import { describe, it, expect } from 'vitest'
  import { render, screen } from '@testing-library/react'
  import { StreakBadge } from '../StreakBadge'

  describe('StreakBadge', () => {
    it('renders nothing at streak 0', () => {
      const { container } = render(<StreakBadge streak={0} />)
      expect(container.firstChild).toBeNull()
    })

    // E4 drift alarm: the streak is live game state — signal accent, with the
    // dark signal-accessible variant carrying light-mode AA (≈6.3:1 on the
    // signal/15 tint over sand-50).
    it('uses the signal accent', () => {
      render(<StreakBadge streak={3} />)
      const badge = screen.getByTestId('hud-streak')
      expect(badge.textContent).toContain('3')
      expect(badge.className).toContain('bg-signal/15')
      expect(badge.className).toContain('text-signal-accessible dark:text-signal')
    })
  })
  ```

- [ ] 5. Failing test — in `src/game/shared/hud/__tests__/ScoreBadge.test.tsx`, add after the existing `'renders the score'` test (inside the `describe`):

  ```tsx
  // E2: game scores use the .text-readout role (system mono, tabular-nums).
  it('renders the numeral in the readout face', () => {
    render(<ScoreBadge score={42} />)
    expect(screen.getByTestId('hud-score').className).toContain('text-readout')
  })
  ```

- [ ] 6. Failing test — in `src/game/shared/hud/__tests__/GameOverOverlay.test.tsx`, add two tests before the closing `})` of the `describe('GameOverOverlay', …)` block:

  ```tsx
  it('applies the E2 type roles: display title, readout stats', () => {
    render(
      <GameOverOverlay
        session={{ ...baseSession, maxRounds: null }}
        personalBest={zeroBest}
        beatPersonalBest={false}
        onPlayAgain={() => {}}
        onBackToMap={() => {}}
      />,
    )
    expect(screen.getByTestId('game-over-title').className).toContain('text-display')
    expect(screen.getByTestId('game-over-score').className).toContain('text-readout')
    expect(screen.getByTestId('game-over-best-streak').className).toContain('text-readout')
  })

  it('uses the ice accent for PB text and action buttons (E4)', () => {
    render(
      <GameOverOverlay
        session={{ ...baseSession, maxRounds: null }}
        personalBest={zeroBest}
        beatPersonalBest={true}
        onPlayAgain={() => {}}
        onBackToMap={() => {}}
      />,
    )
    expect(screen.getByText(/new personal best/i).className).toContain(
      'text-ice-accessible dark:text-ice',
    )
    const playAgain = screen.getByTestId('game-over-play-again')
    expect(playAgain.className).toContain('bg-ice-accessible')
    expect(playAgain.className).toContain('hover:bg-ice-dim')
    expect(screen.getByTestId('game-over-back').className).toContain(
      'focus-visible:ring-ice/50',
    )
  })
  ```

- [ ] 7. Run the failing tests:

  ```
  npx vitest run src/game/shared/hud/__tests__ src/game/hooks/__tests__/useRevealMapEffects.test.tsx
  ```
  Expected: exactly 6 failures — `REVEAL_WRONG is the signal accent` (`expected '#f59e0b' to be '#ff8a4c'`), `renders alive hearts neutral and lost hearts signal` (class contains `text-rose-500`, not `text-sand-500 dark:text-dark-50`), `uses the signal accent` (contains `bg-teal/15`), `renders the numeral in the readout face` (no `text-readout`), `applies the E2 type roles…` (no `text-display`), `uses the ice accent…` (contains `bg-teal-accessible`). Every pre-existing test stays green.

- [ ] 8. Implement `src/lib/mapPalette.ts` (content-anchored — the token and map-paint tasks of this plan also edit this file). Two edits. First, make the file's opening doc comment exactly the normative E4 block below — replacing whatever single header comment the earlier tasks left above the accent constants (pre-plan it read `/** Warm Explorer palette — teal for exploration, coral for selection. */`):

  ```ts
  /** Observatory two-accent palette (E4) — each accent has exactly ONE meaning:
   *
   *  ICE (#7dd3fc family) — interactive & wayfinding: links, focus rings,
   *  search, basemap toggle, map selection border/glow, compare-B.
   *
   *  SIGNAL (#ff8a4c family) — live game state & loss: score/streak feedback,
   *  lost hearts, the wrong-guess reveal (absorbing the retired amber role),
   *  compare-A.
   *
   *  Region badges and A5's exception badges are data encodings, not accents —
   *  they deliberately live outside this two-accent system. */
  ```

  Second, replace the reveal-feedback block. Current code:

  ```ts
  /** Reveal-feedback palette — useRevealMapEffects colors the target-country
   *  border by outcome; the reveal arc and target marker are amber. */
  export const REVEAL_CORRECT = '#22c55e' // green-500 — correct-guess border
  export const REVEAL_WRONG = '#f59e0b' // amber-500 — wrong-guess border, reveal arc + target marker
  ```

  New code (`SIGNAL` is exported above in this same file by the map-paint task — reference it, never duplicate the hex as a second constant):

  ```ts
  /** Reveal-feedback palette — useRevealMapEffects colors the target-country
   *  border by outcome. REVEAL_CORRECT stays green: outcome encoding, not an
   *  accent. The wrong-guess reveal is SIGNAL — live game state (E4). */
  export const REVEAL_CORRECT = '#22c55e' // green-500 — correct-guess border (unchanged)
  export const REVEAL_WRONG = SIGNAL // #ff8a4c — wrong-guess border, reveal arc + target marker
  ```

- [ ] 9. Implement `src/game/hooks/useRevealMapEffects.ts` — update the stale `MARKER_COLOR_BY_ROLE` doc comment (the map-paint task renamed the `TEAL` identifier to `ICE` but this task owns the semantics wording; if that task already reworded the color names in the prose, adapt the old-string to match — the new text below is normative). Current text:

  ```ts
  /** Marker fill is role-driven so the two city-reveal markers are always
   *  distinguishable — even when a near-perfect guess lands on top of the city
   *  and the connecting arc is too short to see. The player's guess is teal; the
   *  actual city (and every country-reveal marker) falls through to amber. */
  ```

  New text:

  ```ts
  /** Marker fill is role-driven so the two city-reveal markers are always
   *  distinguishable — even when a near-perfect guess lands on top of the city
   *  and the connecting arc is too short to see. The player's guess is ice
   *  (interactive); the actual city (and every country-reveal marker) falls
   *  through to signal — live game state (E4). */
  ```

  Then verify the hook carries no hardcoded amber: `grep -n "amber\|f59e0b" src/game/hooks/useRevealMapEffects.ts` → expect no output. (All reveal colors flow from the `REVEAL_CORRECT`/`REVEAL_WRONG`/`ICE` imports — verified against the current file: the only literals are `'rgba(0,0,0,0)'` and `'#ffffff'`, which stay.)

- [ ] 10. Implement `src/game/shared/hud/LivesIndicator.tsx` — replace (line 19–21):

  ```tsx
            className={`w-5 h-5 transition-colors duration-200 ${
              active ? 'text-rose-500' : 'text-sand-300 dark:text-dark-200'
            }`}
  ```

  with (color flip only — the pre-existing `transition-colors` stays; F1 adds the loss animation later):

  ```tsx
            // E4: alive hearts are neutral (starlight in dark); a LOST heart is
            // the signal accent — loss is live game state.
            className={`w-5 h-5 transition-colors duration-200 ${
              active ? 'text-sand-500 dark:text-dark-50' : 'text-signal-accessible dark:text-signal'
            }`}
  ```

- [ ] 11. Implement `src/game/shared/hud/ScoreBadge.tsx` — replace (line 8):

  ```tsx
        className="px-2.5 py-1 rounded-full bg-sand-100/90 dark:bg-dark-400/80 border border-sand-300/50 dark:border-dark-200/30 text-sm font-semibold tabular-nums text-sand-900 dark:text-dark-50"
  ```

  with (`.text-readout` supplies the mono face + `tabular-nums`; size/weight unchanged — no layout rework):

  ```tsx
        className="px-2.5 py-1 rounded-full bg-sand-100/90 dark:bg-dark-400/80 border border-sand-300/50 dark:border-dark-200/30 text-readout text-sm font-semibold text-sand-900 dark:text-dark-50"
  ```

- [ ] 12. Implement `src/game/shared/hud/StreakBadge.tsx` — replace (line 9):

  ```tsx
        className="px-2.5 py-1 rounded-full bg-teal/15 dark:bg-teal-light/15 border border-teal/30 dark:border-teal-light/30 text-xs font-medium text-teal dark:text-teal-light tabular-nums"
  ```

  with (signal is one hue in both themes, so the `dark:` tint duplicates collapse; the 🔥 glyph and copy stay — F1 owns streak-milestone copy changes):

  ```tsx
        className="px-2.5 py-1 rounded-full bg-signal/15 border border-signal/30 text-xs font-medium text-signal-accessible dark:text-signal tabular-nums"
  ```

- [ ] 13. Implement `src/game/shared/hud/GameOverOverlay.tsx` — five content-anchored replacements:

  (a) Title, line 64: `className="text-xl font-bold text-sand-900 dark:text-dark-50 mb-1"` → `className="text-display text-xl text-sand-900 dark:text-dark-50 mb-1"` (`.text-display` supplies weight 700 + tight tracking, so `font-bold` drops).

  (b) Both stat `<dd>`s (lines 78 and 88 — identical class strings; replace both occurrences): `className="text-2xl font-bold text-sand-900 dark:text-dark-50 tabular-nums"` → `className="text-readout text-2xl font-bold text-sand-900 dark:text-dark-50"`.

  (c) PB span, line 99: `<span className="font-semibold text-teal-accessible dark:text-teal-light">` → `<span className="font-semibold text-ice-accessible dark:text-ice">`.

  (d) Play-again button, line 111: `className="flex-1 px-4 py-2 rounded-xl bg-teal-accessible text-white font-medium hover:bg-teal-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-accessible/50"` → `className="flex-1 px-4 py-2 rounded-xl bg-ice-accessible text-white font-medium hover:bg-ice-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-accessible/50"`.

  (e) Back-to-map button, line 119: within its className, `focus-visible:ring-teal/50` → `focus-visible:ring-ice/50`.

- [ ] 14. Implement the two remaining focus rings (ice = focus/interactive). In `src/game/shared/hud/HudShell.tsx` line 44 and `src/game/modes/city-guessing/CityGuessingHud.tsx` line 64, both buttons share the identical class string — in each file replace the substring `focus-visible:ring-teal/50` with `focus-visible:ring-ice/50` (rest of the line, including `${TOUCH_TARGET_TEXT_XS}` and `text-xs`, unchanged — `layoutConstants.test.ts` pins those).

- [ ] 15. Implement `src/game/shared/hud/FirstSessionTutorial.tsx` — in line 44's className replace the substring:

  ```
  border border-teal/30 dark:border-teal-light/30 text-teal-light
  ```
  with (the pill surface is `bg-dark-400/95` in both themes, so ice base text works everywhere — ≈10.4:1):
  ```
  border border-ice/30 text-ice
  ```

- [ ] 16. Run the unit suite green:

  ```
  npx vitest run src/game
  ```
  Expected: all pass, including the 6 new/changed tests. Then `npm run check` — expected green (typecheck, lint incl. the playwright e2e rules, unit tests).

- [ ] 17. Grep gate — the game surface must be accent-clean before the tranche-final global gate:

  ```
  grep -rniE "teal|coral|rose-500|amber|#f59e0b|#f43f5e" src/game
  ```
  Expected: **no output** (exit code 1). If anything prints, it is a missed migration — fix it against the enumeration table above, never suppress.

- [ ] 18. Local e2e verification (kill stray dev servers first — a background `npm run dev` gets reused by Playwright WITHOUT `VITE_TEST_HOOKS` and breaks the game test seams; check with PowerShell `Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue` and stop the owning process if present):

  ```
  npx playwright test e2e/game-country-pinning.spec.ts e2e/game-city-guessing.spec.ts e2e/game-over-mode-switch.spec.ts e2e/tutorial-first-click.spec.ts e2e/reveal-animation.spec.ts e2e/reveal-animation-reduced-motion.spec.ts --project=chromium --workers=2
  ```
  Expected: all pass unchanged — these specs assert text/aria/seam values and symbolic constants, never pinned colors (audited above). Note `reveal-animation*` and parts of the game specs are local-only per `docs/systems/testing.md` § "What Runs in CI" — this local run is their merge gate.

- [ ] 19. Commit (Bash tool):

  ```
  git add src/lib/mapPalette.ts src/game/hooks/useRevealMapEffects.ts src/game/hooks/__tests__/useRevealMapEffects.test.tsx src/game/shared/hud/LivesIndicator.tsx src/game/shared/hud/ScoreBadge.tsx src/game/shared/hud/StreakBadge.tsx src/game/shared/hud/GameOverOverlay.tsx src/game/shared/hud/HudShell.tsx src/game/shared/hud/FirstSessionTutorial.tsx src/game/modes/city-guessing/CityGuessingHud.tsx src/game/shared/hud/__tests__/LivesIndicator.test.tsx src/game/shared/hud/__tests__/StreakBadge.test.tsx src/game/shared/hud/__tests__/ScoreBadge.test.tsx src/game/shared/hud/__tests__/GameOverOverlay.test.tsx && git commit -m "$(cat <<'EOF'
  feat(game): signal owns live state + loss; ice chrome; readout type roles (E4/E2)

  REVEAL_WRONG absorbs amber into the signal family (= SIGNAL, #ff8a4c);
  REVEAL_CORRECT stays outcome-green. Hearts flip to neutral-when-alive /
  signal-when-lost (color only — F1 owns the animation). Streak badge and
  reveal comments move to signal; PB text, game-over buttons, tutorial
  pill, and HUD focus rings move teal -> ice. ScoreBadge numeral and
  game-over stats adopt .text-readout; the Game over title adopts
  .text-display. Two-accent semantics documented in the mapPalette header.
  src/game is grep-clean of teal/coral/rose-500/amber.

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  EOF
  )"
  ```

### Task 5: Map paint migration — selection/compare/markers to ice/signal (E4)

Retire teal/coral from **all MapLibre paint**: base country fill, hover border/extrusion, the selection highlight stack, the compare highlight stack, the A/B centroid markers, and the city-guess reveal marker. `src/lib/mapPalette.ts` becomes the documented canonical owner of the E4 two-accent hexes. After this task, `grep -riE "coral|teal" src/lib src/hooks` returns **zero** hits (the final-sweep task gates on this).

Semantic mapping (spec E4: ice `#7DD3FC` family = interactive/wayfinding; signal `#FF8A4C` family = live game state + loss; coral retires entirely):

| Old constant | Hex | Role | New constant | Hex |
|---|---|---|---|---|
| `TEAL` | `#14b8a6` (teal-500) | light-theme fill/hover/extrusion | `ICE_DEEP` | `#0ea5e9` (sky-500) |
| `TEAL_LIGHT` | `#5eead4` (teal-300) | dark-theme fill/hover/extrusion | `ICE` | `#7dd3fc` (sky-300 — the spec's family anchor) |
| `TEAL_DIM` | `#0d9488` (teal-600) | compare-B stack + B marker/badge | `ICE_DIM` | `#0284c7` (sky-600) |
| `CORAL` | `#f43f5e` | selection stack (light) + compare-A pin + A marker/badge | selection → theme ice (`ICE`/`ICE_DEEP`); compare-A pin + marker → `SIGNAL` | `#ff8a4c` |
| `CORAL_LIGHT` | `#fb7185` | selection stack (dark) | dropped — dark selection is `ICE` | — |

Selection moves from coral to **ice** (spec: "map selection border/glow → ice" — selection is wayfinding). Signal appears in map paint **only** as the compare-A pin/marker. The `SPOTLIGHT_DIM` scrim (`#020617`, dark neutral) and the reveal palette (`REVEAL_CORRECT`/`REVEAL_WRONG`) stay — this plan's later game-state task absorbs `REVEAL_WRONG`'s amber into the signal family; it consumes the `SIGNAL` constant this task defines. These are map paint colors, not text, so no AA text requirement applies (the light-mode **ice-accessible text** variant is owned by the chrome task in `src/index.css`); the one text-adjacent surface here — the A/B marker glyphs — gets its halo flipped to dark with contrast math below.

**Complete occurrence enumeration** (from `grep -rniE "coral|teal" src/lib src/hooks src/game` — every hit migrated in this task):

| File:line | Old | New |
|---|---|---|
| `src/lib/mapPalette.ts:1-6` | Warm Explorer header + `TEAL`/`TEAL_LIGHT`/`TEAL_DIM`/`CORAL`/`CORAL_LIGHT` exports | Observatory E4 doc block + `ICE`/`ICE_DEEP`/`ICE_DIM`/`SIGNAL` |
| `src/lib/mapLayers.ts:9` | `import { TEAL, TEAL_DIM, CORAL, SPOTLIGHT_DIM, REVEAL_WRONG }` | `import { ICE_DEEP, ICE_DIM, SIGNAL, SPOTLIGHT_DIM, REVEAL_WRONG }` |
| `src/lib/mapLayers.ts:65` | `'fill-color': TEAL` (base fill init) | `ICE_DEEP` |
| `src/lib/mapLayers.ts:167` | `'line-color': TEAL` (hover border init) | `ICE_DEEP` |
| `src/lib/mapLayers.ts:177` | `'fill-extrusion-color': TEAL` (hover extrusion init) | `ICE_DEEP` |
| `src/lib/mapLayers.ts:187-188` | comment "selection (coral) and compare (teal-dim)" | "selection (ice) and compare (ice-dim)" |
| `src/lib/mapLayers.ts:236-243` | `addSelectionLayers` → `CORAL`; `addCompareLayers` → `TEAL_DIM` (+ doc comments) | `ICE_DEEP` / `ICE_DIM` |
| `src/lib/mapLayers.ts:513` | comment "(A coral / B teal-dim; …)" | "(A signal / B ice-dim; …)" |
| `src/lib/mapLayers.ts:538` | `'text-color': ['match', ['get', 'label'], 'A', CORAL, TEAL_DIM]` | `['match', ['get', 'label'], 'A', SIGNAL, ICE_DIM]` |
| `src/lib/mapLayers.ts:539` | `'text-halo-color': '#ffffff'` | `'#0f172a'` (contrast math below) |
| `src/hooks/useMapTheme.ts:3,24-25,28-32` | teal/coral theme ternaries; `applySelectionColor(map, coral)` | single `ice` ternary; selection takes theme ice |
| `src/hooks/useCompareViewHighlight.ts:3,13-18,29-38` | pin A=`CORAL`, B=`TEAL_DIM`×4; restore `CORAL_LIGHT`/`CORAL` | pin A=`SIGNAL`, B=`ICE_DIM`×4; restore `ICE`/`ICE_DEEP` |
| `src/game/hooks/useRevealMapEffects.ts:5,34-35,40` | `TEAL` guess-marker color (import breaks if left) | `ICE_DEEP` |
| `src/hooks/__tests__/useMapTheme.test.tsx:5,26,41-42,47,58-59` | pins `TEAL`/`TEAL_LIGHT` | pins `ICE_DEEP`/`ICE` + new selection-color assertions |
| `src/hooks/__tests__/useCompareViewHighlight.test.tsx:4,27,31,34,48,51,60` | pins `CORAL`/`CORAL_LIGHT`/`TEAL_DIM` | pins `SIGNAL`/`ICE`/`ICE_DIM`/`ICE_DEEP` (full rewrite below) |
| `src/hooks/__tests__/selectionColorOrdering.test.tsx:7,9-20,64,80-84` | ordering lock on `CORAL`/`CORAL_LIGHT` | ordering lock on `SIGNAL` over theme `ICE` |
| `src/lib/__tests__/mapLayers.test.ts:22` | imports only `SPOTLIGHT_DIM` | + `ICE_DEEP, ICE_DIM, SIGNAL`; new E4 describe block |
| `e2e/compare-view-dimming.spec.ts:48-49,51,59,63,94-95,101,115,118` | pins `#f43f5e`/`#0d9488` | pins `#ff8a4c`/`#0284c7`/`#0ea5e9` — **same commit** |
| `docs/systems/map-rendering.md:62` | `coral "A" / teal-dim "B" symbols` | `signal "A" / ice-dim "B" symbols` |
| `docs/systems/ui-layout.md:109` | `(A = coral, B = teal-dim)` | `(A = signal, B = ice-dim)` |

Pinned-literal audit (rule 4): `#f43f5e` / `#0d9488` appear in exactly one e2e file, `e2e/compare-view-dimming.spec.ts` (verified: `compare-map-clicks.spec.ts` and `country-labels.spec.ts` pin **no** paint colors; `e2e/a11y-contrast.spec.ts` pins `--color-teal-accessible`/`--color-teal-light` **chrome** tokens owned and re-anchored by this plan's chrome task, not touched here; `e2e/label-contrast.spec.ts` pins basemap-theme grays, unaffected). No unit test pins the marker `circle-color` expression in `src/game`.

**Halo contrast math** (shown per E4's AA-math requirement; map symbols, WCAG-style ratio): relative luminance L(`#ff8a4c`) ≈ 0.40, L(white) = 1.0, L(`#0f172a`) ≈ 0.012, L(`#0284c7`) ≈ 0.21. Signal "A" on the old white halo: (1.0+0.05)/(0.40+0.05) ≈ **2.3:1** (illegible); on the dark halo: (0.40+0.05)/(0.012+0.05) ≈ **7.3:1**. Ice-dim "B": ≈ 4.1:1 on white vs ≈ 4.2:1 on dark. The dark halo `#0f172a` is the same halo B1's `country-labels` layer already uses, so markers and labels share one halo treatment.

**Cross-task coordination:**
- The chrome task (earlier in this plan) swapped `src/index.css` `.compare-badge-a` → `#ff8a4c` and `.compare-badge-b` → `#0284c7` (they hardcode the mapPalette hexes; before this plan they were `#f43f5e`/`#0d9488`). Step 10 verifies equality. `mapPalette.ts` is the canonical owner per the spec ("documented in mapPalette.ts") — on any mismatch, fix `index.css` to these values in this commit and say so in the commit body.
- This plan's later game-state task consumes `SIGNAL` for `REVEAL_WRONG`'s amber absorption and the lost-heart recolor. Do **not** migrate `REVEAL_WRONG` here.
- The final-sweep task greps the whole of `src/` for `coral|teal`; this task must leave `src/lib`, `src/hooks`, and `src/game/hooks/useRevealMapEffects.ts` clean.
- Intra-plan file collision: `mapPalette.ts` is touched by multiple groups — **anchor every edit on content, not line numbers** (line numbers above are pre-plan references). Step 0 verifies the quoted state.

**Files:**
- Modify: `src/lib/mapPalette.ts` (full rewrite of lines 1–6; lines 8–17 kept with comment updates)
- Modify: `src/lib/mapLayers.ts` (lines 9, 65, 167, 177, 186–188, 236–243, 511–513, 538–540)
- Modify: `src/hooks/useMapTheme.ts` (lines 3, 23–32)
- Modify: `src/hooks/useCompareViewHighlight.ts` (full rewrite, 44 lines)
- Modify: `src/game/hooks/useRevealMapEffects.ts` (lines 5, 32–42)
- Modify: `src/hooks/__tests__/useMapTheme.test.tsx`, `src/hooks/__tests__/useCompareViewHighlight.test.tsx` (full rewrite), `src/hooks/__tests__/selectionColorOrdering.test.tsx`, `src/lib/__tests__/mapLayers.test.ts`
- Modify: `e2e/compare-view-dimming.spec.ts` (lines 46–49, 51, 59, 63, 94–95, 101, 115–118)
- Modify: `docs/systems/map-rendering.md` (line 62), `docs/systems/ui-layout.md` (line 109)
- Possibly modify (mismatch contingency only): `src/index.css` (`.compare-badge-a`/`.compare-badge-b`)
- Tests: `src/lib/__tests__/mapLayers.test.ts`, `src/hooks/__tests__/{useMapTheme,useCompareViewHighlight,selectionColorOrdering}.test.tsx`, `e2e/compare-view-dimming.spec.ts`

**Interfaces:**
- Consumes: `applySelectionColor(map: maplibregl.Map, color: string): void` and `LAYER` registry from `src/lib/mapLayers.ts` (signatures unchanged); `createFakeMapRef()` from `src/test/fakeMapRef.ts`; `makeFakeMap`/`makeMapWrapper` from `src/test/fakeMapHooks.tsx`; `.compare-badge-a`/`.compare-badge-b` hexes in `src/index.css` as set by the chrome task.
- Produces (all `const string` exports from `src/lib/mapPalette.ts`, canonical for later tasks): `ICE = '#7dd3fc'`, `ICE_DEEP = '#0ea5e9'`, `ICE_DIM = '#0284c7'`, `SIGNAL = '#ff8a4c'`.
- Removes exports: `TEAL`, `TEAL_LIGHT`, `TEAL_DIM`, `CORAL`, `CORAL_LIGHT` (all importers migrated in this task; verified below).

**Steps:**

- [ ] **Step 0 — pre-flight state check.** Earlier tasks in this plan touch `src/index.css` (and possibly `mapPalette.ts`). Confirm the quoted baseline still holds:
  ```bash
  grep -rn "CORAL\|TEAL" src/lib src/hooks src/game
  ```
  Expected: hits exactly in `src/lib/mapPalette.ts` (definitions), `src/lib/mapLayers.ts` (7 code refs), `src/hooks/useMapTheme.ts`, `src/hooks/useCompareViewHighlight.ts`, `src/game/hooks/useRevealMapEffects.ts`, and the three `src/hooks/__tests__` files. If a prior task already defined `ICE`/`SIGNAL` constants in `mapPalette.ts`, **reuse those exact names/hexes instead of redefining** (canonical-owner rule) and adapt the code below; do not create duplicates.

- [ ] **Step 1 — write the failing unit tests.** Replace `src/hooks/__tests__/useCompareViewHighlight.test.tsx` with exactly:
  ```tsx
  import { describe, expect, it } from 'vitest'
  import { renderHook } from '@testing-library/react'
  import { useCompareViewHighlight } from '../useCompareViewHighlight'
  import { ICE, ICE_DEEP, ICE_DIM, SIGNAL } from '../../lib/mapPalette'
  import { makeFakeMap, makeMapWrapper } from '../../test/fakeMapHooks'

  describe('useCompareViewHighlight', () => {
    it('suppresses hover layers and pins A/B colours when compareWith is present', () => {
      const fake = makeFakeMap()
      renderHook(
        () =>
          useCompareViewHighlight({
            loaded: true,
            compareWith: { ccn3: '276' },
            resolvedTheme: 'light',
          }),
        { wrapper: makeMapWrapper(fake) },
      )
      expect(
        fake.calls.setFilter.filter(
          (c) => c[0] === 'country-hover-border' || c[0] === 'country-extrusion',
        ),
      ).toHaveLength(2)
      const selFill = fake.calls.setPaintProperty.find(
        (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
      )
      expect(selFill?.[2]).toBe(SIGNAL)
      const cmpFill = fake.calls.setPaintProperty.find(
        (c) => c[0] === 'country-compare-fill' && c[1] === 'fill-color',
      )
      expect(cmpFill?.[2]).toBe(ICE_DIM)
    })

    it('pins A to SIGNAL (not the theme ice) in dark mode while comparing', () => {
      const fake = makeFakeMap()
      renderHook(
        () =>
          useCompareViewHighlight({
            loaded: true,
            compareWith: { ccn3: '276' },
            resolvedTheme: 'dark',
          }),
        { wrapper: makeMapWrapper(fake) },
      )
      const selFill = fake.calls.setPaintProperty.find(
        (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
      )
      expect(selFill?.[2]).toBe(SIGNAL)
    })

    it('restores theme-appropriate ice on exit (dark)', () => {
      const fake = makeFakeMap()
      renderHook(
        () => useCompareViewHighlight({ loaded: true, compareWith: null, resolvedTheme: 'dark' }),
        { wrapper: makeMapWrapper(fake) },
      )
      const selFill = fake.calls.setPaintProperty.find(
        (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
      )
      expect(selFill?.[2]).toBe(ICE)
    })

    it('restores deep ice on exit in light mode', () => {
      const fake = makeFakeMap()
      renderHook(
        () => useCompareViewHighlight({ loaded: true, compareWith: null, resolvedTheme: 'light' }),
        { wrapper: makeMapWrapper(fake) },
      )
      const selFill = fake.calls.setPaintProperty.find(
        (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
      )
      expect(selFill?.[2]).toBe(ICE_DEEP)
    })

    it('does nothing when loaded is false', () => {
      const fake = makeFakeMap()
      renderHook(
        () =>
          useCompareViewHighlight({
            loaded: false,
            compareWith: { ccn3: '276' },
            resolvedTheme: 'light',
          }),
        { wrapper: makeMapWrapper(fake) },
      )
      expect(fake.setFilter).not.toHaveBeenCalled()
      expect(fake.setPaintProperty).not.toHaveBeenCalled()
    })
  })
  ```

- [ ] **Step 2 — update `src/hooks/__tests__/useMapTheme.test.tsx`.** Three edits (Edit tool, exact strings):
  1. Replace `import { TEAL, TEAL_LIGHT } from '../../lib/mapPalette'` with `import { ICE, ICE_DEEP } from '../../lib/mapPalette'`
  2. Replace
     ```ts
    // useMapTheme: LAYER.fill gets TEAL_LIGHT in dark mode
    expect(fake.calls.setPaintProperty).toContainEqual(['country-fill', 'fill-color', TEAL_LIGHT])
     ```
     with
     ```ts
    // useMapTheme: LAYER.fill gets ICE in dark mode
    expect(fake.calls.setPaintProperty).toContainEqual(['country-fill', 'fill-color', ICE])
    // E4: the selection stack takes the SAME theme ice (coral is retired)
    expect(fake.calls.setPaintProperty).toContainEqual(['country-selected', 'fill-color', ICE])
     ```
  3. Replace
     ```ts
    // useMapTheme: LAYER.fill gets TEAL in light mode
    expect(fake.calls.setPaintProperty).toContainEqual(['country-fill', 'fill-color', TEAL])
     ```
     with
     ```ts
    // useMapTheme: LAYER.fill gets deep ice in light mode
    expect(fake.calls.setPaintProperty).toContainEqual(['country-fill', 'fill-color', ICE_DEEP])
    expect(fake.calls.setPaintProperty).toContainEqual(['country-selected', 'fill-color', ICE_DEEP])
     ```
  Also rename the two test titles: `'dark: applies dark overrides, recolors symbol text/halo, sets dark sky, teal-light accents'` → `'dark: applies dark overrides, recolors symbol text/halo, sets dark sky, ice accents'`; `'light: light overrides and teal accents'` → `'light: light overrides and deep-ice accents'`.

- [ ] **Step 3 — update `src/hooks/__tests__/selectionColorOrdering.test.tsx`.** Three edits:
  1. Replace `import { CORAL, CORAL_LIGHT } from '../../lib/mapPalette'` with `import { ICE, SIGNAL } from '../../lib/mapPalette'`
  2. Replace the header comment block
     ```ts
  // Cross-hook ordering regression lock.
  //
  // useMapTheme and useCompareViewHighlight BOTH write the country-selected*
  // colours via applySelectionColor. In dark mode + compare view, useMapTheme
  // writes CORAL_LIGHT and useCompareViewHighlight must run AFTER it to pin
  // CORAL (the A-badge colour) — a guarantee that rests entirely on WorldMap
  // calling the hooks in that order (the "must run AFTER useMapTheme" comment in
  // useCompareViewHighlight). The per-hook unit tests render each hook in
  // isolation, and the compare e2e runs in light mode (where both write CORAL),
  // so the dark+compare cell — the only one where the order is load-bearing —
  // is otherwise untested. This test renders both hooks in WorldMap's order and
  // fails if the pin is ever lost (e.g. a hook reorder).
     ```
     with
     ```ts
  // Cross-hook ordering regression lock.
  //
  // useMapTheme and useCompareViewHighlight BOTH write the country-selected*
  // colours via applySelectionColor. While comparing, useMapTheme writes the
  // theme ice (ICE in dark, ICE_DEEP in light) and useCompareViewHighlight
  // must run AFTER it to pin SIGNAL (the A-badge colour) — a guarantee that
  // rests entirely on WorldMap calling the hooks in that order (the "must run
  // AFTER useMapTheme" comment in useCompareViewHighlight). Under E4 the pin
  // is load-bearing in BOTH themes; the compare e2e covers light, so this
  // test renders both hooks in WorldMap's order in dark and fails if the pin
  // is ever lost (e.g. a hook reorder).
     ```
  3. Replace the test:
     ```ts
  it('dark + compare: the selected-country fill pins CORAL, not the theme CORAL_LIGHT', () => {
     ```
     with `it('dark + compare: the selected-country fill pins SIGNAL, not the theme ice', () => {`, and replace
     ```ts
    const writes = selectionFillWrites(fake)
    // useMapTheme really wrote the dark theme coral first — so this test would
    // catch a reorder, not silently pass because the theme write never ran.
    expect(writes).toContain(CORAL_LIGHT)
    // ...and the compare pin (running after) wins: the final colour is CORAL.
    expect(writes.at(-1)).toBe(CORAL)
     ```
     with
     ```ts
    const writes = selectionFillWrites(fake)
    // useMapTheme really wrote the dark theme ice first — so this test would
    // catch a reorder, not silently pass because the theme write never ran.
    expect(writes).toContain(ICE)
    // ...and the compare pin (running after) wins: the final colour is SIGNAL.
    expect(writes.at(-1)).toBe(SIGNAL)
     ```

- [ ] **Step 4 — extend `src/lib/__tests__/mapLayers.test.ts`.** Replace `import { SPOTLIGHT_DIM } from '../mapPalette'` with `import { ICE_DEEP, ICE_DIM, SIGNAL, SPOTLIGHT_DIM } from '../mapPalette'`, then append at the end of the file:
  ```ts

  describe('E4 two-accent highlight paint', () => {
    it.each([
      ['selection', addSelectionLayers, ICE_DEEP],
      ['compare', addCompareLayers, ICE_DIM],
    ] as const)('%s stack initializes every layer with its E4 accent', (_n, add, color) => {
      const fake = createFakeMapRef()
      add(fake.map)
      expect(fake.addedLayers).toHaveLength(4)
      for (const spec of fake.addedLayers) {
        if (spec.type === 'fill') expect(spec.paint?.['fill-color']).toBe(color)
        else if (spec.type === 'line') expect(spec.paint?.['line-color']).toBe(color)
        else if (spec.type === 'fill-extrusion')
          expect(spec.paint?.['fill-extrusion-color']).toBe(color)
        else throw new Error(`unexpected layer type ${spec.type}`)
      }
    })

    it('compare markers colour A signal / B ice-dim over a dark halo (matches panel badges)', () => {
      const fake = createFakeMapRef()
      addCompareMarkerLayer(fake.map)
      const spec = fake.addedLayers.find((s) => s.id === 'country-compare-markers') as
        | maplibregl.SymbolLayerSpecification
        | undefined
      expect(spec?.paint?.['text-color']).toEqual([
        'match',
        ['get', 'label'],
        'A',
        SIGNAL,
        ICE_DIM,
      ])
      // Dark halo: SIGNAL is ~2.3:1 against white but ~7.3:1 against #0f172a
      // (B1's label halo) — one halo treatment for labels and markers.
      expect(spec?.paint?.['text-halo-color']).toBe('#0f172a')
    })
  })
  ```

- [ ] **Step 5 — run the tests, expect failure.**
  ```bash
  npx vitest run src/lib/__tests__/mapLayers.test.ts src/hooks/__tests__/useMapTheme.test.tsx src/hooks/__tests__/useCompareViewHighlight.test.tsx src/hooks/__tests__/selectionColorOrdering.test.tsx
  ```
  Expected failure: module-transform errors of the form `No matching export in "src/lib/mapPalette.ts" for import "ICE"` (all four files fail before any assertion runs — the new constants don't exist yet).

- [ ] **Step 6 — rewrite `src/lib/mapPalette.ts`** with exactly this content (this replaces the current lines 1–6 header `/** Warm Explorer palette — teal for exploration, coral for selection. */` and the five teal/coral exports; `SPOTLIGHT_DIM` keeps its value, the reveal block keeps its values with an updated comment):
  ```ts
  /** Observatory two-accent palette (E4 — 2026-07-26 UX/visual program spec).
   *
   *  Two accents, ONE MEANING EACH. This file is the canonical owner of the
   *  accent hexes; src/index.css mirrors them (the @theme chrome tokens and
   *  the .compare-badge-a / .compare-badge-b hexes MUST stay equal to these).
   *
   *  ICE (#7DD3FC family, tailwind sky) — interactive & wayfinding.
   *    Map roles: country fill / hover border / hover extrusion, the whole
   *    selection highlight stack (border, glow, fill, extrusion), compare-B.
   *
   *  SIGNAL (#FF8A4C family) — live game state & loss.
   *    Map role here: the compare-A pin (A is the active side, matching the
   *    panel's A badge). Chrome roles (score, streak, lost hearts) and the
   *    wrong-reveal absorption of REVEAL_WRONG's amber are owned by this
   *    plan's game-state task; SIGNAL below is the value it consumes.
   *
   *  Teal and coral are retired (E4). Each teal member moved to the same
   *  tailwind step of sky (teal-500→sky-500, teal-300→sky-300,
   *  teal-600→sky-600); coral's selection role moved to ice (selection is
   *  wayfinding), its compare-A role to signal. */
  export const ICE = '#7dd3fc' // sky-300 — dark-theme map accent (ex TEAL_LIGHT role)
  export const ICE_DEEP = '#0ea5e9' // sky-500 — light-theme map accent (ex TEAL role)
  export const ICE_DIM = '#0284c7' // sky-600 — compare-B stack + B marker/badge (ex TEAL_DIM role)
  export const SIGNAL = '#ff8a4c' // compare-A pin + A marker/badge (ex CORAL compare role)

  /** B4 spotlight scrim — the `country-dim` fill laid over every country
   *  EXCEPT the selection (and both compare countries). Near-black slate
   *  (tailwind slate-950) so "lights down" reads the same over satellite
   *  imagery and the vector map, in both themes. Deliberately NEUTRAL — the
   *  scrim is not an accent and stays outside the two-accent system. */
  export const SPOTLIGHT_DIM = '#020617'

  /** Reveal-feedback palette — useRevealMapEffects colors the target-country
   *  border by outcome; the reveal arc and target marker are amber. E4:
   *  REVEAL_WRONG's amber joins the SIGNAL family in this plan's game-state
   *  task (signal absorbs amber); REVEAL_CORRECT's green stays. */
  export const REVEAL_CORRECT = '#22c55e' // green-500 — correct-guess border
  export const REVEAL_WRONG = '#f59e0b' // amber-500 — wrong-guess border, reveal arc + target marker
  ```

- [ ] **Step 7 — migrate `src/lib/mapLayers.ts`** (nine content-anchored edits):
  1. Replace `import { TEAL, TEAL_DIM, CORAL, SPOTLIGHT_DIM, REVEAL_WRONG } from './mapPalette'` with `import { ICE_DEEP, ICE_DIM, SIGNAL, SPOTLIGHT_DIM, REVEAL_WRONG } from './mapPalette'`
  2. In `addBaseCountryLayers`, replace
     ```ts
    paint: {
      'fill-color': TEAL,
      'fill-opacity': DEFAULT_FILL_OPACITY,
    },
     ```
     with
     ```ts
    paint: {
      'fill-color': ICE_DEEP,
      'fill-opacity': DEFAULT_FILL_OPACITY,
    },
     ```
  3. In `addHoverLayers`, replace `paint: { 'line-color': TEAL, 'line-width': 2, 'line-opacity': 0.6 },` with `paint: { 'line-color': ICE_DEEP, 'line-width': 2, 'line-opacity': 0.6 },`
  4. In `addHoverLayers`, replace `'fill-extrusion-color': TEAL,` with `'fill-extrusion-color': ICE_DEEP,`
  5. Replace the `addHighlightStack` doc-comment lines
     ```ts
   *  shared id prefix and color. Used for both selection (coral) and compare
   *  (teal-dim). The glow id keeps the `-glow` suffix; the fill is bare prefix. */
     ```
     with
     ```ts
   *  shared id prefix and color. Used for both selection (ice) and compare
   *  (ice-dim). The glow id keeps the `-glow` suffix; the fill is bare prefix. */
     ```
  6. Replace
     ```ts
  /** Add the selection (coral) highlight stack. */
  export function addSelectionLayers(map: maplibregl.Map): void {
    addHighlightStack(map, 'country-selected', CORAL)
  }

  /** Add the compare (teal-dim) highlight stack. */
  export function addCompareLayers(map: maplibregl.Map): void {
    addHighlightStack(map, 'country-compare', TEAL_DIM)
  }
     ```
     with
     ```ts
  /** Add the selection (ice) highlight stack. Initialized with the light-theme
   *  deep ice; useMapTheme owns the per-theme value and useCompareViewHighlight
   *  pins SIGNAL over it while comparing (E4). */
  export function addSelectionLayers(map: maplibregl.Map): void {
    addHighlightStack(map, 'country-selected', ICE_DEEP)
  }

  /** Add the compare (ice-dim) highlight stack — the B badge colour (E4). */
  export function addCompareLayers(map: maplibregl.Map): void {
    addHighlightStack(map, 'country-compare', ICE_DIM)
  }
     ```
  7. In the `addCompareMarkerLayer` doc comment, replace `*  map in the compare badge colors (A coral / B teal-dim; index.css's` with `*  map in the compare badge colors (A signal / B ice-dim; index.css's`
  8. Replace `'text-color': ['match', ['get', 'label'], 'A', CORAL, TEAL_DIM],` with `'text-color': ['match', ['get', 'label'], 'A', SIGNAL, ICE_DIM],`
  9. Directly below it, replace
     ```ts
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
     ```
     with
     ```ts
      // Dark halo (B1's label halo): SIGNAL #ff8a4c is ~2.3:1 against white
      // but ~7.3:1 against #0f172a; ICE_DIM is ~4.2:1 either way (E4).
      'text-halo-color': '#0f172a',
      'text-halo-width': 1.5,
     ```

- [ ] **Step 8 — migrate the two hooks and the reveal marker.**
  1. Replace `src/hooks/useMapTheme.ts` in full with:
  ```ts
  import { useEffect } from 'react'
  import { applyMapTheme } from '../lib/mapColors'
  import { ICE, ICE_DEEP } from '../lib/mapPalette'
  import { LAYER, applySelectionColor } from '../lib/mapLayers'
  import { useMap } from './useMap'

  interface Options {
    loaded: boolean
    resolvedTheme: 'light' | 'dark'
  }

  // Baseline border/fill paint lives in useCountryBaselinePaint so that the
  // two concerns — overlay colors+sky and baseline country paint — each have
  // one owner.
  export function useMapTheme({ loaded, resolvedTheme }: Options): void {
    const { mapRef } = useMap()

    useEffect(() => {
      const map = mapRef.current
      if (!map || !loaded) return
      applyMapTheme(map, resolvedTheme)

      const isDark = resolvedTheme === 'dark'
      const ice = isDark ? ICE : ICE_DEEP

      try {
        map.setPaintProperty(LAYER.fill, 'fill-color', ice)
        map.setPaintProperty(LAYER.extrusion, 'fill-extrusion-color', ice)
        map.setPaintProperty(LAYER.hoverBorder, 'line-color', ice)

        // E4: the selection highlight is ice (wayfinding), the same family as
        // the hover accents — coral is retired. useCompareViewHighlight pins
        // SIGNAL over this while comparing.
        applySelectionColor(map, ice)

        map.setSky({
          'sky-color': isDark ? '#0a1a2e' : '#88c6fc',
          'horizon-color': isDark ? '#1a2030' : '#f0ede6',
          'fog-color': isDark ? '#10141a' : '#e8e3da',
          'fog-ground-blend': 0.5,
          'horizon-fog-blend': 0.8,
          'sky-horizon-blend': 0.8,
          'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
        })
      } catch {
        // setPaintProperty / setSky throw if the basemap style hasn't
        // committed its layers yet (e.g. fast theme toggle on a slow load).
      }
    }, [resolvedTheme, loaded, mapRef])
  }
  ```
  2. Replace `src/hooks/useCompareViewHighlight.ts` in full with:
  ```ts
  import { useEffect } from 'react'
  import { EMPTY_FILTER as EMPTY, applySelectionColor, LAYER } from '../lib/mapLayers'
  import { ICE, ICE_DEEP, ICE_DIM, SIGNAL } from '../lib/mapPalette'
  import { useMap } from './useMap'

  interface Options {
    loaded: boolean
    compareWith: { ccn3: string } | null
    resolvedTheme: 'light' | 'dark'
  }

  /** Compare-view highlight management: suppress hover layers while picking is
   *  meaningless, and pin the A/B colours to the panel badges (A = signal,
   *  B = ice-dim; E4). Baseline fill/border dimming lives in
   *  useCountryBaselinePaint, so baseline-paint call order no longer matters
   *  (#111 item 1). Call order: must still run AFTER useMapTheme — both write
   *  the selection colours, and the compare SIGNAL pin must win over the
   *  theme's ice (ICE in dark, ICE_DEEP in light). */
  export function useCompareViewHighlight({ loaded, compareWith, resolvedTheme }: Options): void {
    const { mapRef } = useMap()

    useEffect(() => {
      const map = mapRef.current
      if (!map || !loaded) return
      try {
        if (compareWith !== null) {
          map.setFilter(LAYER.hoverBorder, EMPTY)
          map.setFilter(LAYER.extrusion, EMPTY)
          // Pin A = signal badge colour, B = ice-dim badge colour, overriding
          // whatever useMapTheme set (it writes the theme ice in both themes).
          applySelectionColor(map, SIGNAL)
          map.setPaintProperty(LAYER.compareFill, 'fill-color', ICE_DIM)
          map.setPaintProperty(LAYER.compareBorder, 'line-color', ICE_DIM)
          map.setPaintProperty(LAYER.compareGlow, 'line-color', ICE_DIM)
          map.setPaintProperty(LAYER.compareExtrusion, 'fill-extrusion-color', ICE_DIM)
        } else {
          // Restore the selection highlight to the theme-appropriate ice.
          applySelectionColor(map, resolvedTheme === 'dark' ? ICE : ICE_DEEP)
        }
      } catch {
        // Layers may not exist yet.
      }
    }, [compareWith, loaded, resolvedTheme, mapRef])
  }
  ```
  3. In `src/game/hooks/useRevealMapEffects.ts` (two edits — this import breaks the build if skipped): replace `import { REVEAL_CORRECT, REVEAL_WRONG, TEAL } from '../../lib/mapPalette'` with `import { REVEAL_CORRECT, REVEAL_WRONG, ICE_DEEP } from '../../lib/mapPalette'`, and replace
  ```ts
  /** Marker fill is role-driven so the two city-reveal markers are always
   *  distinguishable — even when a near-perfect guess lands on top of the city
   *  and the connecting arc is too short to see. The player's guess is teal; the
   *  actual city (and every country-reveal marker) falls through to amber. */
  const MARKER_COLOR_BY_ROLE: maplibregl.ExpressionSpecification = [
    'match',
    ['get', 'role'],
    'guess',
    TEAL,
    REVEAL_WRONG,
  ]
  ```
  with
  ```ts
  /** Marker fill is role-driven so the two city-reveal markers are always
   *  distinguishable — even when a near-perfect guess lands on top of the city
   *  and the connecting arc is too short to see. The player's guess is deep ice
   *  (E4 — the click is the player's wayfinding act); the actual city (and
   *  every country-reveal marker) falls through to the reveal colour. */
  const MARKER_COLOR_BY_ROLE: maplibregl.ExpressionSpecification = [
    'match',
    ['get', 'role'],
    'guess',
    ICE_DEEP,
    REVEAL_WRONG,
  ]
  ```

- [ ] **Step 9 — run unit tests green.**
  ```bash
  npx vitest run src/lib/__tests__/mapLayers.test.ts src/hooks/__tests__/useMapTheme.test.tsx src/hooks/__tests__/useCompareViewHighlight.test.tsx src/hooks/__tests__/selectionColorOrdering.test.tsx
  ```
  All four files pass. Then run the full unit suite to catch any importer this enumeration missed: `npx vitest run` — expect green (the enumeration above is exhaustive; a failure here means a new importer landed since this plan was written — migrate it the same way before proceeding).

- [ ] **Step 10 — verify badge coordination with the chrome task.**
  ```bash
  grep -n -A 1 "compare-badge-a\|compare-badge-b" src/index.css
  ```
  Expected: `.compare-badge-a { background: #ff8a4c; }` and `.compare-badge-b { background: #0284c7; }` (set by this plan's earlier chrome task). If either differs, `mapPalette.ts` is canonical (spec E4: "documented in mapPalette.ts") — fix the `index.css` hex(es) to `#ff8a4c`/`#0284c7` in this commit and note the reconciliation in the commit body. Do not change mapPalette to match index.css.

- [ ] **Step 11 — re-anchor `e2e/compare-view-dimming.spec.ts` (same commit — pinned-color rule).** Four edits:
  1. Replace
     ```ts
  // Badge colours defined in src/index.css .compare-badge-a / .compare-badge-b
  const CORAL = '#f43f5e'
  const TEAL_DIM = '#0d9488'
     ```
     with
     ```ts
  // Badge colours defined in src/index.css .compare-badge-a / .compare-badge-b;
  // canonical hexes live in src/lib/mapPalette.ts (E4: A = SIGNAL, B = ICE_DIM).
  const SIGNAL = '#ff8a4c'
  const ICE_DIM = '#0284c7'
  // The light-theme selection accent (mapPalette ICE_DEEP) — exit-restore colour.
  const ICE_DEEP = '#0ea5e9'
     ```
  2. Replace the first test's title-and-assertions:
     `test('in compare mode: A (selected) is coral and B (compareWith) is teal-dim', async ({` → `test('in compare mode: A (selected) is signal and B (compareWith) is ice-dim', async ({`; then `await expect.poll(() => getFillColor(page, 'country-selected'), { timeout: 15_000 }).toBe(CORAL)` → `.toBe(SIGNAL)` (keep the rest of the line identical) and `.toBe(TEAL_DIM)` → `.toBe(ICE_DIM)`.
  3. In the distinctness test, replace
     ```ts
    expect(aColor).not.toBe(bColor)
    expect(aColor).toBe(CORAL)
    expect(bColor).toBe(TEAL_DIM)
     ```
     with
     ```ts
    expect(aColor).not.toBe(bColor)
    expect(aColor).toBe(SIGNAL)
    expect(bColor).toBe(ICE_DIM)
     ```
  4. In the light-mode exit test, replace the title `'exiting compare mode restores selection to theme-appropriate coral'` with `'exiting compare mode restores selection to theme-appropriate ice'`, and replace
     ```ts
      // Light mode → CORAL is the restored colour (matches the badge).
      // Verify that exiting compare restores the correct theme-appropriate fill-color.
      const selColor = await getFillColor(page, 'country-selected')
      expect(selColor).toBe(CORAL)
     ```
     with
     ```ts
      // Light mode → deep ice is the restored colour (the theme accent; the
      // SIGNAL badge colour belongs to compare mode only).
      const selColor = await getFillColor(page, 'country-selected')
      expect(selColor).toBe(ICE_DEEP)
     ```
  (Verified: these are the only e2e color pins this task invalidates — `compare-map-clicks.spec.ts` and `country-labels.spec.ts` pin no paint colors; `a11y-contrast.spec.ts` pins chrome tokens owned by the chrome task; `label-contrast.spec.ts` pins basemap grays.)

- [ ] **Step 12 — fix the two stale doc lines (same task — doc-staleness rule).**
  1. `docs/systems/map-rendering.md` line 62: replace the fragment `B6 — coral "A" / teal-dim "B" symbols over the compared pair` with `B6 — signal "A" / ice-dim "B" symbols over the compared pair (E4 accents)`.
  2. `docs/systems/ui-layout.md` line 109: replace the fragment `both countries are highlighted (A = coral, B = teal-dim)` with `both countries are highlighted (A = signal, B = ice-dim)`.

- [ ] **Step 13 — grep gate + typecheck.**
  ```bash
  grep -rniE "coral|teal" src/lib src/hooks && echo "GATE FAILED" || echo "clean"
  grep -rn "TEAL\|CORAL" src/game && echo "GATE FAILED" || echo "clean"
  npm run check
  ```
  Both greps must print `clean` (the second confirms `useRevealMapEffects.ts` no longer imports retired constants; Tailwind `text-teal-*` classes in `src/game` components were already migrated by the chrome task — if any remain there, that is the chrome task's regression, flag it, don't fix it here). `npm run check` must pass.

- [ ] **Step 14 — run the re-anchored e2e spec.** First make sure no stray dev server is running (project memory: a reused dev server lacks `VITE_TEST_HOOKS`) — stop any background `npm run dev` you started. Then:
  ```bash
  npx playwright test e2e/compare-view-dimming.spec.ts --project=chromium --workers=2
  ```
  Expected: all tests pass (the A/B colour polls now settle on `#ff8a4c`/`#0284c7`, exit-restore on `#0ea5e9`).

- [ ] **Step 15 — commit.**
  ```bash
  git add src/lib/mapPalette.ts src/lib/mapLayers.ts src/hooks/useMapTheme.ts src/hooks/useCompareViewHighlight.ts src/game/hooks/useRevealMapEffects.ts src/lib/__tests__/mapLayers.test.ts src/hooks/__tests__/useMapTheme.test.tsx src/hooks/__tests__/useCompareViewHighlight.test.tsx src/hooks/__tests__/selectionColorOrdering.test.tsx e2e/compare-view-dimming.spec.ts docs/systems/map-rendering.md docs/systems/ui-layout.md
  git commit -m "feat(e4): migrate map paint to the ice/signal two-accent system" -m "Selection stack takes the theme ice (coral retired); compare pins A=SIGNAL #ff8a4c / B=ICE_DIM #0284c7 matching the swapped panel badges; base fill, hover border/extrusion and the city-guess marker move to the ice family; A/B centroid markers get the dark B1 halo (signal was 2.3:1 on white, 7.3:1 on #0f172a). mapPalette.ts is the canonical E4 hex owner. Re-anchors compare-view-dimming.spec.ts pins and docs/systems/{map-rendering,ui-layout}.md in the same commit. Zero teal/coral references remain in src/lib + src/hooks." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```
  (If Step 10 required reconciling `src/index.css`, add it to the `git add` list and append a third `-m "Reconciled .compare-badge hexes in index.css to the canonical mapPalette values."`.)

### Task 6: Retire the teal/coral tokens — grep gates, both-theme AA verification, atomic tranche close-out

This is the final task of the E-foundations tranche. Tasks 1–5 defined the E4 ice/signal system and migrated every chrome, map-paint, and e2e usage. This task deletes the retired `--color-teal*` / `--color-coral*` tokens and the compare-badge legacy hexes, re-anchors the two deliberate survivors (Oceania region badge) so deletion is safe, extends the Task 1 drift alarm to assert the old system stays gone, and runs the atomic-tranche verification gates: grep gates, WCAG-AA contrast math on both themes, full unit + full local chromium e2e, and a scripted both-theme live pass. After this task, zero teal/coral chrome remains anywhere in `src/` or `e2e/`.

**Files:**

- Modify: `src/index.css` — delete the teal/coral `@theme` tokens (lines 52–61 pre-tranche; anchor on content — this file is also touched by Tasks 1 and 3 of this plan) and rewrite `.compare-badge-a` / `.compare-badge-b` (lines 364–370 pre-tranche)
- Modify: `src/components/SearchBar.tsx` — line 21, `REGION_COLORS.Oceania`
- Modify: `src/components/SingleCountryPanel.tsx` — line 63, `REGION_BADGE.Oceania`
- Modify: `src/lib/mapLayers.ts` — lines 513–514, `addCompareMarkerLayer` doc comment
- Modify: `src/lib/__tests__/themeTokens.test.ts` — append the retirement drift-alarm suite (file created by Task 1; if Task 1 landed its E4 drift alarm under a different filename, locate it with `git grep -l "color-ice" -- "src/lib/__tests__"` and append there instead)
- Modify: `docs/systems/map-rendering.md` — line 62 (compare-marker color mention)
- Modify: `docs/systems/ui-layout.md` — line 109 (compare highlight color mention)
- Tests: `src/lib/__tests__/themeTokens.test.ts` (modified); `e2e/a11y-contrast.spec.ts`, `e2e/axe-snapshot.spec.ts`, `e2e/label-contrast.spec.ts` (run, not modified — Tasks 1–5 already re-anchored their pins)

**Interfaces:**

- Consumes: `--color-ice`, `--color-ice-light`, `--color-ice-dim`, `--color-ice-accessible`, `--color-signal` `@theme` tokens — **canonical owner: Task 1's `@theme` block in `src/index.css`**. Also `SIGNAL` and `ICE_DIM` constants in `src/lib/mapPalette.ts` (the canonical hex owner for map paint, migrated earlier in this plan) and Tailwind 4's default `--color-teal-50…950` oklch scale (`node_modules/tailwindcss/theme.css` lines 94–104), which is independent of the custom bare `--color-teal` token and survives its deletion.
- Produces: `@theme` with no `--color-teal*` / `--color-coral*`; `.compare-badge-a { background: var(--color-signal); color: var(--color-sand-900) }`; `.compare-badge-b { background: var(--color-ice-dim) }`; retirement drift-alarm suite `'E4 retirement drift alarm — the teal/coral system must stay gone'` in `src/lib/__tests__/themeTokens.test.ts`.

**Allowed grep-gate survivors — enumerated (everything else must be zero):**

1. `src/data/countries.json:10731` and `:15293` — Mozambique and Sri Lanka `flagAlt` strings containing the word "teal". Source data, not chrome. Excluded from the gate via pathspec.
2. The Oceania region-badge hue in `src/components/SearchBar.tsx:21` and `src/components/SingleCountryPanel.tsx:63` — **after this task's re-anchor** these use only Tailwind's default numbered palette (`bg-teal-100`/`bg-teal-100/80`, `text-teal-800`, `dark:bg-teal-900/30`, `dark:text-teal-300`), which are region-keyed data encodings like the amber/rose/blue/emerald/slate badges, not brand tokens. Verified: Tailwind v4's default theme defines `--color-teal-100/-300/-800/-900` as oklch values in `node_modules/tailwindcss/theme.css` (lines 94–104), and deleting the custom bare `--color-teal` does not touch that scale. The **current** Oceania classes `dark:bg-teal/20 dark:text-teal-light` DO reference the brand tokens and would silently compile to nothing after deletion (Tailwind emits no CSS for unknown utilities) — which is exactly why this task re-anchors them before the tokens die.
3. `docs/superpowers/**` (historical specs/plans/notes) — exempt, not grepped, not touched.
4. The sand and dark ramps in `@theme` — they stay untouched.
5. Amber Tailwind classes on `EXCEPTION_BADGE` and the Africa region badge — data encodings, allowed (the amber *hex* `#f59e0b` for the wrong-reveal was absorbed into the signal family by an earlier task and IS gated).

**Steps:**

- [ ] **Kill stray dev servers** (project memory: a background `npm run dev` gets reused by Playwright without `VITE_TEST_HOOKS`). PowerShell:

  ```powershell
  Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -Confirm:$false }
  ```

- [ ] **Verify the interface Tasks 1–5 landed** before editing anything:

  ```powershell
  git grep -n -E "color-ice|color-signal" -- src/index.css
  git grep -n "export const" -- src/lib/mapPalette.ts
  ```

  Expected: the `@theme` block defines `--color-ice`, `--color-ice-light`, `--color-ice-dim`, `--color-ice-accessible`, and `--color-signal` (plus any family variants Task 1 added); `mapPalette.ts` exports `SIGNAL` and `ICE_DIM` (among `ICE`, `ICE_LIGHT`, `SPOTLIGHT_DIM`, `REVEAL_CORRECT`, `REVEAL_WRONG`). If Task 1 chose different member names (e.g. a different dim-variant name), substitute that exact name consistently in every step below — do NOT define a duplicate token; Task 1's `@theme` block is the single owner.

- [ ] **Write the failing retirement drift alarm.** Append to `src/lib/__tests__/themeTokens.test.ts` (Task 1's E4 drift-alarm file). Ensure these two `?raw` imports exist at the top of the file (add whichever is missing — Task 1's suite already imports the CSS):

  ```ts
  import indexCssSource from '../../index.css?raw'
  import mapPaletteSource from '../mapPalette.ts?raw'
  ```

  Append this suite (same `?raw` drift-alarm pattern as `src/lib/__tests__/layoutConstants.test.ts`, including its CRLF normalisation):

  ```ts
  describe('E4 retirement drift alarm — the teal/coral system must stay gone', () => {
    // Retired brand hexes: teal #14b8a6, teal-light #5eead4, teal-dim #0d9488,
    // teal-accessible #065f56, the dark attribution-link teal #7dd3c0,
    // coral #f43f5e, coral-light #fb7185, coral-dim #e11d48, and the amber
    // reveal #f59e0b (absorbed into the signal family by E4). The Oceania
    // region badge's teal-100/-300/-800/-900 classes are Tailwind's default
    // numbered palette (a region-keyed data encoding), NOT these tokens.
    const RETIRED_HEXES = [
      '14b8a6',
      '5eead4',
      '0d9488',
      '065f56',
      '7dd3c0',
      'f43f5e',
      'fb7185',
      'e11d48',
      'f59e0b',
    ]
    const css = indexCssSource.replace(/\r\n/g, '\n')

    it('@theme defines no --color-teal* or --color-coral* tokens (and nothing references them)', () => {
      expect(css).not.toMatch(/--color-teal/)
      expect(css).not.toMatch(/--color-coral/)
    })

    it('index.css carries no retired hex literal (includes the hex-tile backdrop data URI)', () => {
      for (const hex of RETIRED_HEXES) {
        expect(css.toLowerCase(), `retired hex #${hex} still in index.css`).not.toContain(hex)
      }
    })

    it('mapPalette exports no TEAL/CORAL constants and no retired hex', () => {
      expect(mapPaletteSource).not.toMatch(/TEAL|CORAL/)
      for (const hex of RETIRED_HEXES) {
        expect(
          mapPaletteSource.toLowerCase(),
          `retired hex #${hex} still in mapPalette.ts`,
        ).not.toContain(hex)
      }
    })

    it('compare badges consume the E4 tokens — badge ↔ map-fill match is by token, not copied hex', () => {
      expect(css).toContain('background: var(--color-signal)')
      expect(css).toContain('background: var(--color-ice-dim)')
    })
  })
  ```

- [ ] Run `npx vitest run src/lib/__tests__/themeTokens.test.ts` — expect the new suite to FAIL: the `@theme` assertion fails (teal/coral tokens still defined), the index.css hex assertion fails (`f43f5e`/`0d9488` still in `.compare-badge-a/-b`), and the badge-token assertion fails (badges still hardcode hexes). The `mapPalette` assertion should already PASS — if it fails, an earlier task of this plan did not land; stop and resolve the ordering before continuing.

- [ ] **Delete the retired tokens from `@theme`** in `src/index.css`. Anchor on content, not line numbers (Task 1 added ice/signal tokens to this block). Remove exactly this block, then collapse any doubled blank line left behind:

  ```css
    --color-teal: #14b8a6;
    --color-teal-light: #5eead4;
    --color-teal-dim: #0d9488;
    /* Deep teal: WCAG AA on white/sand-50 (≥4.5:1). Use for interactive text
       and primary CTA backgrounds in light mode where teal / teal-dim fall short. */
    --color-teal-accessible: #065f56;

    --color-coral: #f43f5e;
    --color-coral-light: #fb7185;
    --color-coral-dim: #e11d48;
  ```

- [ ] **Rewrite the compare badges** in `src/index.css`. Replace:

  ```css
  .compare-badge-a {
    background: #f43f5e;
  }

  .compare-badge-b {
    background: #0d9488;
  }
  ```

  with:

  ```css
  /* E4: A = signal (compare-A / live), B = ice-dim (compare-B / wayfinding) —
     the same tokens useCompareViewHighlight pins on the map fills
     (mapPalette.SIGNAL / mapPalette.ICE_DIM own the hexes), so badge and map
     match by construction. Letter inks are AA-checked per disc: sand-900 on
     the light signal disc (7.3:1 — white would be ~2.3:1), white on the dark
     ice-dim disc (validated by the tranche-3 contrast gate script). */
  .compare-badge-a {
    background: var(--color-signal);
    color: var(--color-sand-900);
  }

  .compare-badge-b {
    background: var(--color-ice-dim);
  }
  ```

  The shared `.compare-badge` rule keeps `color: white`; `.compare-badge-a` overrides it. `@theme` tokens are emitted as `:root` custom properties by Tailwind 4, and `src/index.css` already consumes them via `var()` (e.g. `var(--color-sand-300)`), so `var(--color-signal)` resolves at runtime.

- [ ] **Re-anchor the Oceania region badge** (data encoding stays; brand-token references go). In `src/components/SearchBar.tsx`, replace:

  ```ts
    Oceania: 'bg-teal-100 text-teal-800 dark:bg-teal/20 dark:text-teal-light',
  ```

  with (matches the `dark:bg-<hue>-900/30 dark:text-<hue>-300` pattern every other region already uses):

  ```ts
    Oceania: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  ```

  In `src/components/SingleCountryPanel.tsx`, replace:

  ```ts
    Oceania: 'bg-teal-100/80 text-teal-800 dark:bg-teal/20 dark:text-teal-light',
  ```

  with:

  ```ts
    Oceania: 'bg-teal-100/80 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  ```

  (If an earlier task of this plan already re-anchored these two lines, the old strings won't match — verify with the teal grep gate below and skip.)

- [ ] **Fix the now-stale badge comment in `src/lib/mapLayers.ts`** (doc-staleness in the same task that causes it). In the `addCompareMarkerLayer` doc comment, replace the fragment:

  ```
   *  .compare-badge-a/-b hardcode the same mapPalette hexes). Rides on B1's
  ```

  with:

  ```
   *  .compare-badge-a/-b consume the same hues via the E4 tokens). Rides on B1's
  ```

- [ ] Run `npx vitest run src/lib/__tests__/themeTokens.test.ts` — expect ALL tests green, including Task 1's existing suites.

- [ ] **Grep gate 1 — coral is extinct** (word and hexes, `src/` + `e2e/`):

  ```powershell
  git grep -n -i -E "coral|f43f5e|fb7185|e11d48" -- src e2e
  ```

  Expected: no output (exit code 1).

- [ ] **Grep gate 2 — retired teal/amber hexes are extinct:**

  ```powershell
  git grep -n -i -E "14b8a6|5eead4|0d9488|065f56|7dd3c0|f59e0b" -- src e2e
  ```

  Expected: no output. This is the gate that catches the hex-tile backdrop stroke (`%235eead4` in the body-background data URI, recolored to ice by an earlier task of this plan).

- [ ] **Grep gate 3 — the word "teal" survives only as the enumerated data encodings:**

  ```powershell
  git grep -n -i "teal" -- src e2e ':(exclude)src/data/countries.json'
  ```

  Expected output — exactly these two lines (line numbers may drift):

  ```
  src/components/SearchBar.tsx:21:  Oceania: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  src/components/SingleCountryPanel.tsx:63:  Oceania: 'bg-teal-100/80 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  ```

  **Straggler protocol:** any other hit means an earlier task of this plan missed an occurrence (candidates that existed pre-tranche: stale comments in `src/index.css` — "teal at low opacity" backdrop comment, "teal-accessible text" tooltip comment, "Search icon — teal colored" in SearchBar; test titles in `e2e/a11y-contrast.spec.ts`; the `e2e/compare-view-dimming.spec.ts` badge-colour comment). Fix stragglers in THIS commit using the E4 mapping: teal/teal-light chrome → ice / ice-light; teal-accessible → ice-accessible; teal-dim (compare-B) → ice-dim; coral (selection / compare-A) → E4 selection ice on map borders, signal for compare-A; amber wrong-reveal → signal — always consuming the existing Task 1 tokens / mapPalette constants, never new literals. If a straggler is a pinned e2e literal, re-anchor the pin to the mapPalette constant or token value in this same commit (CLAUDE.md rule: color pins move with the color).

- [ ] **Update `docs/systems/` color mentions** (the only two teal/coral hits in `docs/systems/`, verified by grep). In `docs/systems/map-rendering.md` line 62, replace the fragment:

  ```
  coral "A" / teal-dim "B" symbols over the compared pair
  ```

  with:

  ```
  signal "A" / ice-dim "B" symbols over the compared pair
  ```

  In `docs/systems/ui-layout.md` line 109, replace the fragment:

  ```
  both countries are highlighted (A = coral, B = teal-dim)
  ```

  with:

  ```
  both countries are highlighted (A = signal, B = ice-dim)
  ```

  (If an earlier task already re-worded either line, skip that edit.) Then gate:

  ```powershell
  git grep -n -i -E "teal|coral" -- docs/systems
  ```

  Expected: no output.

- [ ] Run the full unit suite: `npx vitest run` — expect green (Tasks 1–5 already updated `selectionColorOrdering.test.tsx`, `useCompareViewHighlight.test.tsx`, `useMapTheme.test.tsx`, and the component-class pins; a failure here means a missed re-anchor — fix in this commit, do not delete the pin).

- [ ] Run `npm run check` (lint + typecheck + unit) — expect green.

- [ ] **AA contrast gate — math from the landed tokens.** Write this script to your scratchpad directory as `contrast-gate.mjs` (do NOT commit it):

  ```js
  // contrast-gate.mjs — tranche-3 AA gate: WCAG ratios for the E4 accent
  // pairs, computed straight from the landed @theme tokens.
  // Run from the repo root:  node <scratchpad>/contrast-gate.mjs
  import { readFileSync } from 'node:fs'

  const css = readFileSync('src/index.css', 'utf8')
  const tokens = {}
  for (const m of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) tokens[m[1]] = m[2]

  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const lum = (hex) => {
    const [r, g, b] = rgb(hex).map((c) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  const t = (name) => {
    if (!tokens[name]) {
      console.error(`MISSING --color-${name}. Found: ${Object.keys(tokens).join(', ')}`)
      process.exit(1)
    }
    return tokens[name]
  }

  const WHITE = '#ffffff'
  const checks = [
    ['light: ice-accessible text on sand-50 (header wordmark/Play, panel links over pale surfaces)', t('ice-accessible'), t('sand-50'), 4.5],
    ['light: ice-accessible text on sand-100 (search field, country tooltip, nav-ctrl pill)', t('ice-accessible'), t('sand-100'), 4.5],
    ['light CTA: white on ice-accessible (panel Compare / game-over Play again buttons)', WHITE, t('ice-accessible'), 4.5],
    ['dark: ice-light text on dark-400 (header, toast, nav-ctrl, HUD shell)', t('ice-light'), t('dark-400'), 4.5],
    ['dark: ice-light text on dark-300 (hint pill, tutorial card, launcher chrome)', t('ice-light'), t('dark-300'), 4.5],
    ['dark HUD: signal on dark-400 (score change, streak flare, lost heart)', t('signal'), t('dark-400'), 4.5],
    ['dark HUD: signal on dark-300', t('signal'), t('dark-300'), 4.5],
    ['compare badge A: sand-900 letter on signal disc', t('sand-900'), t('signal'), 4.5],
    ['compare badge B: white letter on ice-dim disc', WHITE, t('ice-dim'), 4.5],
  ]

  let failed = false
  for (const [label, fg, bg, floor] of checks) {
    const r = ratio(fg, bg)
    if (r < floor) failed = true
    console.log(`${r >= floor ? 'PASS' : 'FAIL'}  ${r.toFixed(2)}:1 (need ${floor}:1)  ${label}  [${fg} on ${bg}]`)
  }
  process.exit(failed ? 1 : 0)
  ```

  Run `node <scratchpad>/contrast-gate.mjs` from the repo root — expect 9× PASS, exit 0. Reference math (spec-fixed hexes, precomputed): signal `#FF8A4C` on dark-400 `#161a22` = **7.5:1**; signal on dark-300 `#1e2430` = **6.6:1**; sand-900 `#1e1b18` on signal = **7.3:1**; ice `#7DD3FC` on dark-400 = **10.5:1**. The ice-accessible and ice-dim ratios depend on Task 1's chosen hexes — the script is the authority. A FAIL means Task 1's variant hex needs darkening/lightening: fix it **in the `@theme` block** (single owner) and re-run everything from grep gate 1.

- [ ] **Targeted e2e — contrast/axe/label specs** (kill stray 5173 listeners first with the preflight command; Playwright starts its own `build:e2e` + preview server):

  ```powershell
  npx playwright test e2e/a11y-contrast.spec.ts e2e/axe-snapshot.spec.ts e2e/label-contrast.spec.ts --project=chromium --workers=2
  ```

  Expect: 0 failed. CI-coverage honesty (per `playwright.config.ts` `testIgnore`): `a11y-contrast.spec.ts` IS CI-covered; `axe-snapshot.spec.ts` and `label-contrast.spec.ts` are **local-only** (excluded on CI — tracking issue #106), so this local run is the ONLY gate they get for this tranche. `label-contrast.spec.ts` pins `applyMapTheme`'s label colors (`#64748b`/`#78716c` etc.), which this tranche does not change — it must pass untouched.

- [ ] **Mixed-accent gate part 1 — full local chromium run:**

  ```powershell
  npx playwright test --project=chromium --workers=2
  ```

  Expect: 0 failed (any `fixme` annotations per config are fine). This covers the paint-pin specs Tasks 1–5 re-anchored (`compare-view-dimming`, `compare-map-clicks`, `reveal-animation`, `theme-and-responsive` — the last is also local-only).

- [ ] **Mixed-accent gate part 2 — scripted both-theme live pass.** Write this to your scratchpad as `live-pass.mjs` (do NOT commit):

  ```js
  // live-pass.mjs — tranche-3 mixed-accent gate: screenshots every core state
  // in light+dark at desktop (1280x800) and 390px mobile, against a dev
  // server on :5173.  Run from the repo root:
  //   npm run dev            (separate/background terminal — KILL IT afterwards)
  //   node <scratchpad>/live-pass.mjs <scratchpad>/tranche3-live
  import { chromium } from 'playwright-core'
  import { mkdirSync } from 'node:fs'
  import { join } from 'node:path'

  const outDir = process.argv[2]
  if (!outDir) {
    console.error('usage: node live-pass.mjs <output-dir>')
    process.exit(1)
  }
  mkdirSync(outDir, { recursive: true })

  const BASE = 'http://localhost:5173'
  const mapLoaded = (page) => page.waitForSelector('[data-map-loaded]', { timeout: 90_000 })

  const states = [
    { name: 'landing', path: '/', ready: mapLoaded },
    {
      name: 'panel',
      path: '/#FRA',
      ready: async (page) => {
        await mapLoaded(page)
        await page.waitForSelector('[data-testid="country-panel"]', { timeout: 30_000 })
      },
    },
    {
      name: 'compare',
      path: '/#FRA,DEU',
      ready: async (page) => {
        await mapLoaded(page)
        await page.waitForSelector('[data-testid="compare-sources"]', { timeout: 30_000 })
      },
    },
    {
      name: 'game',
      path: '/#game/country-pinning/play',
      ready: async (page) => {
        await mapLoaded(page)
        await page.waitForSelector('[data-testid="game-hud"]', { timeout: 30_000 })
      },
    },
    {
      name: 'game-over',
      path: '/#game/country-pinning/play',
      ready: async (page) => {
        await mapLoaded(page)
        await page.waitForSelector('[data-testid="game-end"]', { timeout: 30_000 })
        await page.click('[data-testid="game-end"]')
        await page.waitForSelector('[data-testid="game-over"]', { timeout: 30_000 })
      },
    },
  ]
  const viewports = [
    { label: 'desktop', width: 1280, height: 800 },
    { label: 'mobile', width: 390, height: 844 },
  ]

  const browser = await chromium.launch()
  for (const theme of ['light', 'dark']) {
    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      })
      await context.addInitScript((t) => window.localStorage.setItem('funworldmap-theme', t), theme)
      for (const state of states) {
        const page = await context.newPage()
        await page.goto(BASE + state.path)
        await state.ready(page)
        const file = join(outDir, `${state.name}-${theme}-${vp.label}.png`)
        await page.screenshot({ path: file })
        console.log('captured', file)
        await page.close()
      }
      await context.close()
    }
  }
  await browser.close()
  ```

  (`playwright-core` is a top-level dependency and exports `chromium` — verified against `node_modules/playwright-core/index.mjs`; it launches the browsers `@playwright/test` already installed.) Start `npm run dev` in the background, run the script, then **kill the dev server** with the preflight command (project memory: it must not survive into any later Playwright run). Review all 20 PNGs against this checklist — every item must hold in BOTH themes and BOTH viewports:

  - **No teal** (green-cyan `#14b8a6`/`#5eead4` family) on any chrome: wordmark, Play button, search icon/focus ring/dropdown, hint pill, toast, launcher title + cards, panel field labels, border chips, divider, nav controls (including the dark-mode compass/zoom icon `filter` hue), attribution links, country tooltip, backdrop hex-tile stroke — all read ice (light blue) or ice-accessible (dark blue in light mode).
  - **No coral** (pink-red `#f43f5e` family) anywhere: map selection border/glow is ice; compare-A map fill and "A" badge are signal orange.
  - Compare state: A = signal disc/fill, B = ice-dim disc/fill, badge and map hues visibly identical per column.
  - Game HUD: score/streak accents signal; hearts neutral starlight (not red/coral). The lost-heart signal recolor and the signal (not amber) wrong-reveal aren't reachable by deep link — they are covered by the earlier tasks' unit tests and the `reveal-animation`/game e2e specs in the full run above; optionally play one wrong round manually to eyeball them.
  - Allowed color survivors: satellite imagery, flag images, `REVEAL_CORRECT` green, region badges (amber/emerald/rose/blue/teal-hue/slate) and amber exception badges — data encodings by design.

- [ ] **Telemetry confirmation (one line, required by the plan):** this tranche adds **no new telemetry** — no `track()` calls, no `KNOWN_EVENTS` change, no `docs/systems/analytics.md` change. Verify: `git diff origin/main...HEAD -- src | Select-String -Pattern "track\("` returns nothing.

- [ ] **Memory-convention check (remove-obsolete):** grep gates 1–3 plus the retirement drift alarm ARE the proof — no dead `bg-teal`/`text-coral`-style classes remain to silently compile to nothing, and the alarm keeps it that way.

- [ ] Commit (code + docs only; scratchpad scripts and screenshots are not committed):

  ```powershell
  git add src/index.css src/components/SearchBar.tsx src/components/SingleCountryPanel.tsx src/lib/mapLayers.ts src/lib/__tests__/themeTokens.test.ts docs/systems/map-rendering.md docs/systems/ui-layout.md
  git commit -m "feat(e4): retire teal/coral tokens - atomic tranche close-out" -m "Deletes --color-teal*/--color-coral* from @theme, re-points the compare badges at the E4 tokens (A = signal disc with sand-900 letter, 7.3:1; B = ice-dim disc), re-anchors the Oceania region badge's dark classes to Tailwind's default teal palette (data encoding, not a brand token), updates the docs/systems color mentions, and extends the E4 drift alarm to assert the retired tokens and hexes stay gone. Grep-gated: zero teal/coral chrome in src/ and e2e/; both themes AA-verified. No new telemetry." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```