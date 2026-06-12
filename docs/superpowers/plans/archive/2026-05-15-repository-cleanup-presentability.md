# Repository Cleanup & Presentability Plan (v5 — final)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move funworldmap from "good internal project with rough external polish" to "professional open-source tool ready for contributions" while eliminating the boilerplate duplications and inconsistencies surfaced during the GameController extraction's five /simplify passes, and closing the dependency-version lag.

**Architecture:** Seven independent phases. Sequenced by visible-impact-per-cost: presentation polish (free wins) → test-fixture consolidation → app-code consistency → tooling tier-up → dependency hygiene → quarantined-tests triage. Plus an explicit "NOT in this plan" section for architectural follow-ups deferred.

**Tech Stack:** React 19, TypeScript 5.7 (target: 6), Vite 6, MapLibre GL 5.x, Vitest 4 + Playwright 1.59, ESLint 9 flat config (target: 10 with type-checked rules), Prettier, GitHub Actions.

**v3 changes from v2:** §1 numbers re-verified firsthand (mode comparisons 23→36, README score 7→5, 7 additional untracked screenshots discovered). §1.8 added — dependency-hygiene category. Phase 1 corrected (no version bump; add `license` field). Phase 3.1 promoted to required. **New Phase 5: dependency hygiene** added. Old Phase 5 (quarantine triage) renumbered to Phase 6.

**v4 changes from v3:** Verified via npm + git log:
- The 3 "abandoned" plan files **were completed** (verified via `git log` showing the corresponding PR commits). Phase 0 now archives them (`mv` to `docs/superpowers/plans/archive/`) rather than committing at root.
- `typescript-eslint@^9.0.0` doesn't exist on npm yet; the 8.59.3 line already supports ESLint 10. Phase 5.2's bump command corrected — drops the spurious `typescript-eslint@^9.0.0`.
- `eslint-plugin-react-hooks@7.0.x` peer deps cap at ESLint 9; `7.1.x` adds ESLint 10. Phase 5.2 now pins to `^7.1.0`.
- `docs/assets/` doesn't exist on `main`; Phase 1 explicitly creates it.
- Added **Task 5.3: Dependabot config** (prevents the lag from re-accumulating). §1.6 weaknesses updated to flag the missing config + CodeQL.
- Added **Task 1.4: CodeQL Analysis workflow** per user decision. OSSF Scorecard not added (user opted out).
- `docs/design-sketches/font-comparison.html` — read it, it's a one-off Google Fonts pairing exploration. **Defaulted to DELETE in Phase 0** (user can override).

**v5 changes from v4** — verified via WebFetch + npm view (changelog research):
- **`@vitejs/plugin-react` bump DROPPED**: v5+ requires Vite 8+; this repo is on Vite 6.4.2. Current `4.7.0` is the latest compatible. Bumping plugin-react requires bumping Vite first, deferred to a separate plan. Added §5 item 11 documenting the deferral.
- **TypeScript 6 risk re-rated LOW**: repo already has explicit `"strict": true` / `"moduleResolution": "bundler"` / `"types": ["vite/client"]`, so v6's default changes are no-ops here.
- **jsdom 29 risk re-rated LOW**: `grep -rn getComputedStyle src/` returned 0 results, so v29 CSSOM overhaul has no direct impact. v28 resource-loading overhaul: repo doesn't intercept XHR/WebSocket.
- **ESLint 10 risk re-rated MEDIUM with concrete pre-flight steps**: requires `name` property on each config object (repo doesn't have this today); eslintrc completely removed (repo already on flat config ✓); Node `>=22.13` (CI uses Node 22 ✓); `eslint-env` comments would now error (none in `src/` — verified). Phase 5.2 expanded with explicit pre-flight checklist.
- **eslint-plugin-react-hooks 7.1**: verified peer-dep accepts ESLint 9 or 10; stricter `set-state-in-effect` and ref validation may surface findings against the 9 ref-mirrors. Phase 5.2 now calls them out specifically.

---

## 1. Critical assessment

The repo is internally rigorous and externally underdeveloped. Internal documentation discipline (specs → plans → archived), test-strategy maturity (431 unit + 226 e2e, two-tier with map-via-page.evaluate), and operational realism (`SECURITY.md`, `ops/runbook.md`) are at a high standard rare in public projects. But a developer landing on the GitHub repo page sees no demo, no embedded screenshot, no CI badges, and `"private": true` in `package.json` — friction that obscures the project's actual maturity.

Findings are grouped below by category. Each item is cited with file:line evidence. **Verified** items are concrete maintainability costs; **trade-offs** are documented past decisions worth knowing about but not necessarily "violations"; **nitpicks** are noted for transparency but not load-bearing.

### 1.1 Presentation (external-facing)

- **README is thin** — 74 lines, no diagrams, no embedded screenshot, no demo URL, no CI badges. Architecture section is one-line-per-bullet. First-time visitors cannot validate "this works" without cloning. Score: ~5/10.
- **`package.json` missing `license`, `description`, `homepage`, `repository`, `keywords`** despite the LICENSE file existing at the repo root. `"private": true` and `"version": "0.0.0"` are correct for an unpublished GitHub-Pages app (prevents accidental `npm publish`) — keep both, just populate the metadata fields. Verified at `package.json:1-10`.
- **No `CODE_OF_CONDUCT.md`** — standard for projects accepting external contributions. `CONTRIBUTING.md` exists and is solid; the CoC absence is a governance gap, not a content gap.
- **No `.github/ISSUE_TEMPLATE/`, no `pull_request_template.md`** — `CONTRIBUTING.md` documents expectations (lint/type/test standards) but issue triage and PR shape would benefit from templates.
- **No `CHANGELOG.md`** — git history is clean enough that this is optional; flag for visibility, not action.

### 1.2 Working-tree hygiene

Untracked files have persisted in the working tree across this multi-day session. **16 files total** (revised up from 9 after firsthand audit revealed 7 additional abandoned screenshots):

| File / Dir | Verdict | Reason |
|---|---|---|
| `.tmp-locked-node/lightningcss.win32-x64-msvc.node.bak` | **DELETE** | Corrupt build artifact (9.5 MB). Add `/.tmp-*/` to `.gitignore`. |
| `docs/design-sketches/font-comparison.html` | **NEEDS DECISION** | Inline visual scratch from 2026-05-14. Keep if design is active; otherwise delete. |
| `docs/superpowers/plans/2026-05-12-fix-pipelines-and-verified-bugs.md` | **ARCHIVE** | **Completed** plan (verified via `git log` — PRs landed: News drop, Sentry breadcrumbs, reduced-motion gate, workflow_run trigger). Move to `docs/superpowers/plans/archive/`. |
| `docs/superpowers/plans/2026-05-13-verify-animations-and-share.md` | **ARCHIVE** | **Completed** plan (share-branch e2e + animation-interrupt tests landed). Move to archive. |
| `docs/superpowers/plans/2026-05-14-tier-1-continuation.md` | **ARCHIVE** | **Completed** plan (panel-focus a11y + countries-50m + bundle-budget gate landed). Move to archive. |
| `docs/testing/game-divergences-2026-05-11.md` | **COMMIT at `docs/testing/`** | Companion to existing tracked `docs/testing/playwright-matrix.md`, `game-unhappy-paths.md`. Assessment artifact with retracted-bug memo. |
| `docs/testing/game-happy-paths.md` | **COMMIT at `docs/testing/`** | Test-contract document referenced by CLAUDE.md. Pairs with already-tracked `game-unhappy-paths.md`. |
| `share-toast-visible.png`, `share-toast-visual.png` | **DELETE** | Dev screenshots from one-off share-toast investigation. `.gitignore` covers `/screenshot-*.png` but not `/share-*.png`. |
| `screenshot-{dark-germany,dark-mode-france,france-selected,initial-load,light-mode,mobile-dark,search-dropdown}.png` | **DELETE all 7** | Already gitignored via `/screenshot-*.png`. Abandoned in working tree since 2026-04-15 (~4 MB). Phase 1 will generate a fresh hero screenshot from the current dev server. |

`.gitignore` should grow `/share-*.png` and optionally `/.tmp-*/`.

### 1.3 Test-infrastructure boilerplate (verified)

Cited from the four /simplify passes that ran during the GameController extraction; re-verified by the Phase-5 surveys.

- **`Window.__funworldmap_game` augmentation** re-declared via inline `as unknown as { __funworldmap_game?: ... }` cast in **3 production-code sites** (`src/game/hooks/useGameTestSeams.ts:28`, `src/game/shared/GameSessionProvider.tsx:62`, `e2e/helpers.ts:178,185`) without a shared `declare global` interface. TypeScript gets no compile-time safety on property names or signatures.
- **`Window.__testAnalytics` / `__PLAYWRIGHT__` augmentation** re-declared in **5 sites** (`src/lib/analytics.ts:23-26` defines a private `TestAnalyticsWindow` interface that isn't re-used; `src/lib/__tests__/analytics.test.ts:4-8`, `src/components/__tests__/DailyShareBlock.test.tsx:28-29`, `src/components/__tests__/LauncherMilestoneOverlay.test.tsx:7-9`, `src/game/hooks/__tests__/useHashGameRouter.test.tsx:61-62` each redeclare).
- **`__testAnalytics`/`__PLAYWRIGHT__` setup boilerplate** (the `beforeEach`/`afterEach` lifecycle around the augmentation above) duplicated across the same **3 test files**.
- **`makeCountryReveal` / `makePointReveal` / `makeOutcome` factories** duplicated **byte-identical** between `src/game/hooks/__tests__/useGameAnnouncements.test.tsx:70-94` and `src/game/hooks/__tests__/useRevealMapEffects.test.tsx:46-60`. `factories.ts` already exports `makeAttempt`/`makeSession`/`makeCountryRound`/`makeCityRound` — these three belong alongside them.
- **`makeFakeMap` helper** copy-pasted verbatim in `src/hooks/__tests__/useCompareViewDimming.test.tsx:8-14` and `src/hooks/__tests__/useSelectionHighlight.test.tsx:35-41`. Separately, `src/game/hooks/__tests__/fakeMapRef.ts` provides a richer 9-method version with call-tracking. Three implementations of the same idea.
- **Inline `CountryRoundSpec` / `CityRoundSpec` literals in tests** despite `makeCountryRound` / `makeCityRound` factories existing in `factories.ts`. Examples: `useGameTestSeams.test.tsx:39`, `useGameTestSeams.test.tsx:189`, scoring tests in both mode directories.

### 1.4 Application code consistency (verified)

- **36 stringly-typed mode-ID comparisons** scattered across the codebase (re-verified firsthand; previous estimate was 23). Worst offender: `src/game/hooks/useHashGameRouter.ts` (5+ sites at lines 162, 180, 197, 227, 236). Also: `useRevealMapEffects.ts:293`, `DailyRevealOverlay.tsx:52-53`, `lastMode.ts:8`, and many more. `ModeId` is defined as a string union in `src/game/shared/types.ts:5` — TypeScript catches typos but the literal-string sites pile up across the codebase. **Per user decision: predicate helpers promoted to Phase 3.1 REQUIRED at this count.**
- **10 reveal-color hex codes inline** in `src/game/hooks/useRevealMapEffects.ts` (lines 28, 44, 102, 235, 252, 268, 275) and the matching test file (3 more sites). Three semantic colors (`#22c55e` correct, `#f59e0b` warn, `#ef4444` far) but no semantic constants. `src/lib/mapPalette.ts` exists but only carries the TEAL/CORAL brand-palette family — reveal feedback isn't there.
- **Naming inconsistency in hook arg interfaces**: 3 hooks use `Args` (`UseGameTestSeamsArgs`, `UseGameAnnouncementsArgs`, `UseRevealMapEffectsArgs`); 1 hook uses `Options` (`UseHashGameRouterOptions`). **Trade-off, not violation** — plan amendment #5 explicitly mandated `Options` for the extraction's final phase. Harmonization is cosmetic and deferrable.
- **`useDailyResumePersistence(session: GameSession)`** takes a raw session arg rather than an args interface. **Trade-off, not violation** — the prior /simplify reviewer explicitly endorsed this (single call site, cohesive record).
- **`prefersReducedMotion()` called synchronously at 8 sites** (`App.tsx:201`, `useRevealMapEffects.ts:97,231,286`, `useGameAnnouncements.ts:110`, `flyToCountry.ts:15`, `resetViewControl.ts:7`, `useMapInstance.ts:64`) without memoization. Browsers cache `matchMedia` results internally so the cost is microscopic, but the design smell is that "user motion preference" reads can drift between effects within a render. **Nitpick.**
- **9 ref-mirrors of reducer state** across the 5 extracted hooks (`statusRef`, `pendingStartRef`, `lastRevealEmitHashRef`, `lastAttemptCountRef`, `prevStatusForTelemetryRef`, `recordedRef`, `lastAnnouncedRoundKeyRef`, `lastIntermediateAttemptCountRef`, `prevStatusForIntermediateRef`). **Documented out-of-scope** in the GameController extraction plan §"What's NOT in this plan" item 5. Replacement via `useSyncExternalStore` or commit-driven patterns is a separate architectural refactor.

### 1.5 Quarantined e2e tests (verified — 4-5 tests, 3 issues)

- `e2e/animation-interrupt.spec.ts:30,53,78` — 3 tests, all citing issue **#47** (animation state unobservable under CI's reduced-motion baseline).
- `e2e/game-over-mode-switch.spec.ts:36` — 1 test, citing issue **#32** (timeout-dependent mode switch).
- `e2e/launcher.spec.ts:87` — 1 test, citing issue **#31** (compositor frame production / ANGLE renderer flake).

All quarantined via `test.fixme(!!process.env.CI, '<issue link>')` per CLAUDE.md policy. Tests run locally; CI is honestly green. The underlying causes have not been resolved.

### 1.6 Tooling and CI

- **No `typecheck` npm script.** Type-checking happens implicitly via `tsc -b` inside `build`. A dedicated `npm run typecheck` would be discoverable for contributors.
- **No pre-commit hooks** (Husky absent). Avoidable CI noise from formatting/lint failures.
- **No `.editorconfig`** — relies on IDE plugin configuration for consistent indent/EOL.
- **ESLint `recommended-type-checked` ruleset deferred** — documented in `docs/superpowers/plans/2026-05-12-fix-pipelines-and-verified-bugs.md` §Section 4 (deferred). The upgrade surfaces many findings to fix first.
- **13 specs in CI testIgnore list** — documented gap waiting on a self-hosted GPU runner per `playwright.config.ts:115-127` and the flake-watch notes. Tracked, not a regression.
- **Bundle budgets pegged at "measured + 10%"** per the 2026-05-14 deployment plan. No automated review cadence to re-baseline.
- **No Dependabot / Renovate config** — verified absent (no `.github/dependabot.yml`, no `renovate.json`). Dep-version drift accumulates manually (see §1.8). Addressed in Phase 5.3.
- **No CodeQL Analysis workflow** — verified absent. Addressed in Phase 1 Task 1.4.
- **No OSSF Scorecard** — verified absent. Publishes a security-best-practices score; useful for "credibility at a glance" but not load-bearing.

### 1.8 Dependency hygiene (verified via `npm outdated` + changelog research)

**Substantial major-version lag** across the tooling stack:

| Package | Current | Latest | Lag | Risk after changelog research |
|---|---|---|---|---|
| `typescript` | 5.7.3 | 6.0.3 | 1 major | **LOW**: TS 6 changes mostly defaults; this repo already has explicit `"strict": true`, `"moduleResolution": "bundler"`, `"types": ["vite/client"]`. Migration trivial. |
| `eslint` | 9.39.4 | 10.3.0 | 1 major | **MEDIUM**: requires `name` property on each config object; eslintrc support fully removed (already on flat config ✓); Node `>=20.19 \|\| >=22.13` (CI uses Node 22 — verify is 22.13+); JSX reference tracking now default. No `eslint-env` comments in `src/` (verified) so that breaking change doesn't bite. |
| `eslint-plugin-react-hooks` | 5.2.0 | 7.1.1 | **2 major** | **MEDIUM**: v6.1 dropped Node <18 (fine); v7.0 removed `recommended-latest-legacy` config; v7.1 added stricter `set-state-in-effect` and ref validation — may surface new findings against the 9 ref-mirrors. |
| `jsdom` | 25.0.1 | 29.1.1 | **4 major** | **MEDIUM**: v28 overhauled resource-loading API (no impact — repo doesn't intercept XHR/WebSocket); v29 overhauled CSSOM. **No `getComputedStyle` calls in `src/` (verified)** so direct CSSOM impact is low. Indirect impact via testing-library is possible. |
| `@vitejs/plugin-react` | 4.7.0 | 6.0.2 | 2 major | **BLOCKED**: v5+ requires Vite 8+. Repo is on Vite 6.4.2. **4.7 is the latest version compatible with Vite 6.** Defer plugin-react bump to a future Vite-bump plan. |
| `globals` | 15.15.0 | 17.6.0 | 2 major | **LOW**: type-only package; new globals added, none removed. |
| `@eslint/js` | 9.39.4 | 10.0.1 | 1 major | Paired with `eslint` bump. |
| `vite` | 6.4.2 | 8.0.13 | **2 major** | Out of scope for this plan; tracked in §5 "What's NOT in this plan" as a separate Vite-bump plan because v7→v8 has its own breaking changes worth its own assessment. |
| Various minor | | | | `@sentry/react` 10.49→10.53, `maplibre-gl` 5.23→5.24, `typescript-eslint` 8.59 (latest in 8 line). |

**Updated framing**: not security CVEs but a maintainability cost. Per user decision: dedicated Phase 5 for dep updates, sequenced after the ESLint type-checked upgrade so the rule-set bump and ESLint major bump can be coordinated. **The vitejs-plugin-react and Vite bumps are explicitly deferred** to a future plan.

### 1.9 Strengths to preserve

- **Documentation discipline** (`docs/purpose.md`, `docs/systems/*.md`, `docs/superpowers/{specs,plans,notes,archive}` separation). New contributors get a guided tour via `docs/index.md`.
- **CLAUDE.md as a load-bearing conventions file** — locks in flake-prevention rules, animation-state patterns, and bot-commit deploy-trigger gotchas.
- **No `waitForTimeout` or `force: true` in any e2e test** (`grep -r` confirms). The 2026-04-28 flake regression playbook is being followed.
- **No `console.*` noise in production paths** — 5 console calls in `src/**` (excluding tests), all justified (error context or config validation).
- **No `it.skip`/`describe.skip` anywhere** — quarantines are explicit `test.fixme` with issue links per CLAUDE.md policy.
- **Zero `@ts-ignore`/`@ts-expect-error` in `src/`** — TypeScript discipline is genuine (verified via grep).
- **Sentry integration is solid** — `src/lib/initSentry.ts` no-ops cleanly when `VITE_SENTRY_DSN` is absent; has dedicated unit tests; daily-storage breadcrumbs are tested in isolation.
- **GameController.tsx post-extraction is genuinely clean** — 124 lines, 5 hook calls, one effect (Escape handler), one component body. No dead code, no orphaned imports.

---

## 2. Scope check — why one plan with 7 phases

The phases share **the same target** (the repo as a whole) but are otherwise mostly independent:

- Phase 0 (working-tree hygiene) → 1 PR, no code change in `src/`.
- Phase 1 (presentation polish) → 1 PR, touches only `README.md`, `package.json`, `.github/`, root-level governance files, `docs/assets/`.
- Phase 2 (test fixtures) → 1–2 PRs, touches `src/**/__tests__/` and `src/test/` (new).
- Phase 3 (app consistency) → 2 PRs, touches `src/` modules.
- Phase 4 (tooling tier-up) → 2 PRs, touches config files + pre-commit + ESLint config.
- Phase 5 (dependency hygiene) → 2 PRs, touches `package.json` + migration deltas. **Sequenced after Phase 4** because ESLint 10 + react-hooks 7 should land alongside the type-checked ruleset.
- Phase 6 (quarantined tests triage) → variable, may be blocked on GPU-runner availability.

Phases 0–4 share **no code-level dependencies** and can land in any order. Phase 5 has one ordering constraint (after 4.2). Splitting into 7 separate plans would force each to re-establish assessment context; one plan with 7 phases keeps the diagnosis adjacent to the prescription.

**Cadence:** ~1–2 phases per week. Phase 4.2 + 5 may stretch longer due to remediation work.

---

## 3. File map

| Phase | Files created | Files modified | Files deleted |
|---|---|---|---|
| 0 | — | `.gitignore` (+ `/share-*.png`, `/.tmp-*/`); commit 5 docs | `.tmp-locked-node/`, `share-toast-{visible,visual}.png`, 7× `screenshot-*.png` |
| 1 | `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/{bug_report,feature_request}.md`, `.github/pull_request_template.md`, `.github/workflows/codeql.yml`, `docs/assets/hero.png` (fresh screenshot) | `README.md`, `package.json` (metadata only — keep `private`/`version`) | — |
| 2 | `src/test/analyticsCapture.ts`, `src/test/fakeMapRef.ts` (move), `src/test/window-globals.d.ts` | `src/game/shared/__tests__/factories.ts` (+3 factories), 5 test files (use new util), 2 production-code files (drop inline Window casts), `src/hooks/__tests__/{useCompareViewDimming,useSelectionHighlight}.test.tsx` (use shared fake) | `src/game/hooks/__tests__/fakeMapRef.ts` (moved) |
| 3a | `src/game/shared/modePredicates.ts` | ~15 files using `=== 'country-pinning'` / `=== 'city-guessing'` (36 sites total — **REQUIRED**, not optional) | — |
| 3b | — | `src/lib/mapPalette.ts` (+3 reveal constants), `src/game/hooks/useRevealMapEffects.ts`, its test | — |
| 4a | `.editorconfig`, `.husky/pre-commit` | `package.json` (add `typecheck` script, husky+lint-staged devDeps) | — |
| 4b | — | `eslint.config.js` (enable `recommended-type-checked`), 10–50 src files for type-safety findings | — |
| 5 | `.github/dependabot.yml` | `package.json` (major dep bumps), various src files for migration deltas | — |
| 6 | — | issue-specific (3 PRs likely for #31/#32/#47) | — |

---

## 4. Phased plan

### Phase 0 — Working-tree hygiene (1 PR, ~30 min)

**Goal:** Decide-or-delete the 9 untracked files; tighten `.gitignore`.

**Files:**
- Modify: `.gitignore`
- Commit (add): the 5 plan/test-doc files listed in §1.2
- Delete: `.tmp-locked-node/` directory, `share-toast-visible.png`, `share-toast-visual.png`
- **Decision required**: `docs/design-sketches/font-comparison.html` — commit if reference, delete if scratch

#### Task 0.1: Audit and stage

- [ ] **Step 1**: Branch from main.

```bash
git checkout main && git pull --ff-only origin main && git checkout -b chore/working-tree-hygiene
```

- [ ] **Step 2**: Update `.gitignore`.

Append to `.gitignore`:
```
# Local debug screenshots from one-off investigations.
/share-*.png

# Build-tool .bak corruption artefacts on Windows.
/.tmp-*/
```

- [ ] **Step 3**: Move the 3 completed plan files into the archive folder, then stage everything.

```bash
mv docs/superpowers/plans/2026-05-12-fix-pipelines-and-verified-bugs.md docs/superpowers/plans/archive/
mv docs/superpowers/plans/2026-05-13-verify-animations-and-share.md docs/superpowers/plans/archive/
mv docs/superpowers/plans/2026-05-14-tier-1-continuation.md docs/superpowers/plans/archive/

git add docs/superpowers/plans/archive/2026-05-12-fix-pipelines-and-verified-bugs.md
git add docs/superpowers/plans/archive/2026-05-13-verify-animations-and-share.md
git add docs/superpowers/plans/archive/2026-05-14-tier-1-continuation.md
git add docs/testing/game-divergences-2026-05-11.md
git add docs/testing/game-happy-paths.md
```

(Verification: `docs/testing/` is already tracked at HEAD with sibling files like `playwright-matrix.md`, `game-unhappy-paths.md`. The two new test docs land alongside.)

- [ ] **Step 4**: Delete the dead artefacts. (These files are all currently untracked, so `git` won't capture the deletions — the `.gitignore` patterns prevent re-introduction.)

```bash
rm -rf .tmp-locked-node/
rm share-toast-visible.png share-toast-visual.png
rm screenshot-dark-germany.png screenshot-dark-mode-france.png screenshot-france-selected.png screenshot-initial-load.png screenshot-light-mode.png screenshot-mobile-dark.png screenshot-search-dropdown.png
```

- [ ] **Step 5**: Decide on `docs/design-sketches/font-comparison.html`. Either:
  - `git add docs/design-sketches/font-comparison.html` (commit as reference) OR
  - `rm -rf docs/design-sketches/` (delete as scratch)

- [ ] **Step 6**: Commit and push.

```bash
git add .gitignore
git status   # verify only intended changes staged
git commit -m "chore: working-tree hygiene (commit active plans, remove debug artefacts)"
git push -u origin chore/working-tree-hygiene
gh pr create --base main --title "chore: working-tree hygiene"
```

---

### Phase 1 — Presentation polish (1 PR, ~2 hours)

**Goal:** Make the GitHub project page communicate "this is a real, working tool" within 10 seconds of arrival.

**Files:**
- Modify: `README.md`, `package.json`
- Create: `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`, `.github/pull_request_template.md`

#### Task 1.1: README

- [ ] **Step 1**: Add a top-of-README hero block.

After the title, before the existing "## What it is" section, insert:
```md
> **[Live demo →](https://funworldmap.com)** · Interactive political world map with daily geography puzzles.

![funworldmap launcher](docs/assets/hero.png)

[![CI](https://github.com/GranatenUdo/funworldmap/actions/workflows/ci.yml/badge.svg)](https://github.com/GranatenUdo/funworldmap/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
```

- [ ] **Step 2**: Create the assets folder and a fresh hero screenshot.

```bash
mkdir -p docs/assets
npm run dev
# Visit http://localhost:5173, take a screenshot at the initial launcher view
# Save to docs/assets/hero.png (1200×675 ideal for OG-image-friendly aspect ratio)
git add docs/assets/hero.png
```

`docs/assets/` does **not** exist on `main` today; create it. The 7 abandoned repo-root screenshots were deleted in Phase 0; this generates a fresh one matching the current UI. Optionally also generate a dark-mode and a panel-open screenshot for a small gallery if you elect the "fuller README" option.

- [ ] **Step 3**: Replace the "Follow-up work not yet in this branch" section (lines 65-67) with a single link to `docs/roadmap.md`.

#### Task 1.2: `package.json` metadata

**Decision baked in (v3):** keep `"private": true` and `"version": "0.0.0"`. This is correct shape for an unpublished GitHub-Pages app — prevents accidental `npm publish` while tooling (Renovate, OSSF Scorecard, GitHub repo card) reads the new metadata fields below.

- [ ] **Step 1**: Add metadata fields ONLY. Do NOT touch `name`, `private`, `version`, `type`.

```json
{
  "name": "funworldmap",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "description": "Interactive political world map with daily geography puzzles. Fully client-side; deployable to any static host.",
  "homepage": "https://funworldmap.com",
  "repository": {
    "type": "git",
    "url": "https://github.com/GranatenUdo/funworldmap.git"
  },
  "bugs": {
    "url": "https://github.com/GranatenUdo/funworldmap/issues"
  },
  "keywords": ["world-map", "geography", "maplibre", "react", "daily-puzzle", "wcag-aa"],
  "license": "MIT",
  "author": "Tobias Ens",
  ...
}
```

The `license` field is the most important: it matches the LICENSE file at the repo root that currently isn't referenced from `package.json` (LICENSE-detection tools that read package.json miss it today).

#### Task 1.3: Governance files

- [ ] **Step 1**: Create `CODE_OF_CONDUCT.md` (use Contributor Covenant v2.1 verbatim — `https://www.contributor-covenant.org/version/2/1/code_of_conduct.md`).

- [ ] **Step 2**: Create `.github/ISSUE_TEMPLATE/bug_report.md` with sections: "What happened?", "Steps to reproduce", "Expected", "Browser/OS", "Console output / screenshots".

- [ ] **Step 3**: Create `.github/ISSUE_TEMPLATE/feature_request.md` with sections: "Use case", "Proposed shape", "Alternatives considered".

- [ ] **Step 4**: Create `.github/pull_request_template.md` matching the existing PR-body convention used in this conversation's PRs (Summary / Test plan / sub-skill attribution).

#### Task 1.4: CodeQL Analysis workflow

- [ ] **Step 1**: Create `.github/workflows/codeql.yml`.

```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '17 4 * * 1' # Weekly Monday 04:17 UTC

permissions:
  actions: read
  contents: read
  security-events: write

jobs:
  analyze:
    name: Analyze
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        language: ['javascript-typescript']
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/analyze@v3
        with:
          category: '/language:${{ matrix.language }}'
```

GitHub-native, free for public repos. First scan may take 8-12 minutes; subsequent scans are incremental. Findings surface in the repo's Security tab. The 04:17 UTC cron offsets from the daily-puzzle/health-smoke schedules.

#### Task 1.5: Verify and commit

- [ ] **Step 1**: Run the dev server, screenshot the launcher to confirm `docs/assets/hero.png` is current.

- [ ] **Step 2**: `npm run build` to confirm no broken docs paths.

- [ ] **Step 3**: Commit.

```bash
git add README.md package.json CODE_OF_CONDUCT.md .github/
git commit -m "docs: README hero block, npm metadata, governance templates"
```

---

### Phase 2 — Test-fixture consolidation (1–2 PRs, ~3 hours)

**Goal:** Remove the boilerplate duplications surfaced during the GameController extraction's /simplify passes. Land in two PRs to keep diffs reviewable.

**Files:**
- Create: `src/test/window-globals.d.ts`, `src/test/analyticsCapture.ts`, `src/test/fakeMapRef.ts` (moved from `src/game/hooks/__tests__/`)
- Modify: `src/game/shared/__tests__/factories.ts` (add `makeCountryReveal`, `makePointReveal`, `makeOutcome`)
- Update: 8 test files to import shared utilities

#### Task 2.1 (PR 1): Centralize `Window` augmentations + factory promotions

- [ ] **Step 1**: Create `src/test/window-globals.d.ts`.

```ts
// Triple-slash include via tsconfig.app.json's "include"; covered by src/**.
declare global {
  interface Window {
    /** funworldmap analytics test seam — enabled in e2e and unit tests by setting __PLAYWRIGHT__ = true. */
    __PLAYWRIGHT__?: boolean
    __testAnalytics?: Array<{ name: string; props: Record<string, unknown> }>
    /** Game-controller test seam — registered when VITE_TEST_HOOKS=1. */
    __funworldmap_game?: {
      submitGuess?: (input: unknown) => void
      submitCountryGuess?: (cca3: string) => boolean
      setRound?: (id: string) => boolean
      getSession?: () => unknown
      endGame?: () => void
      completeNow?: () => void
      finalize?: () => void
      restart?: () => void
    }
    /** Map test seam — raw MapLibre instance, exposed when VITE_TEST_HOOKS=1. */
    __funworldmap_map?: unknown
  }
}
export {}
```

Reference it from `tsconfig.app.json`'s `include` if needed (likely already auto-included since `src/**`).

- [ ] **Step 2**: Update the 5 test files that locally declare `Window` augmentation to drop their local declarations and rely on the global. Specifically:
  - `src/lib/__tests__/analytics.test.ts:4-8` — delete the `interface Window` block
  - `src/components/__tests__/DailyShareBlock.test.tsx:28-29` — drop the inline cast
  - `src/components/__tests__/LauncherMilestoneOverlay.test.tsx:7-9` — drop the local interface
  - `src/game/hooks/__tests__/useHashGameRouter.test.tsx:61-62` — drop the inline cast (assignments stay)
  - `src/game/hooks/useGameTestSeams.ts:28` and `src/game/shared/GameSessionProvider.tsx:62` — drop the `as unknown as { __funworldmap_game?: ... }` cast; use plain `window.__funworldmap_game`
  - **Skip `e2e/helpers.ts`** — `e2e/test-globals.d.ts` already typed-augments `Window` for the Playwright project (separate tsconfig). The 2 casts there are redundant *within e2e* and can be cleaned up as a follow-up, but don't belong in this PR since `src/test/window-globals.d.ts` isn't included by e2e's tsconfig.

- [ ] **Step 3**: Add `makeCountryReveal`, `makePointReveal`, `makeOutcome` to `src/game/shared/__tests__/factories.ts` (copy verbatim from `useGameAnnouncements.test.tsx:70-94`).

- [ ] **Step 4**: Replace the inline factories in `useGameAnnouncements.test.tsx:70-94` and `useRevealMapEffects.test.tsx:46-60` with imports from `factories.ts`.

- [ ] **Step 5**: Run `npm run test:unit` — must be 431 green (no regressions). Run `npx tsc --noEmit` — clean.

- [ ] **Step 6**: Commit and PR.

```bash
git commit -m "refactor(test): centralize Window globals + promote reveal factories"
```

#### Task 2.2 (PR 2): `analyticsCapture` helper + shared `fakeMapRef`

- [ ] **Step 1**: Create `src/test/analyticsCapture.ts`.

```ts
import type { EventName, EventSchema } from '../lib/analytics'

export interface CapturedAnalytics {
  events: Array<{ name: EventName; props: EventSchema[EventName] }>
  reset(): void
}

export function installAnalyticsCapture(): CapturedAnalytics {
  window.__PLAYWRIGHT__ = true
  window.__testAnalytics = []
  return {
    events: window.__testAnalytics!,
    reset() {
      window.__testAnalytics = []
    },
  }
}

export function uninstallAnalyticsCapture(): void {
  delete window.__PLAYWRIGHT__
  delete window.__testAnalytics
}
```

- [ ] **Step 2**: Update the 3 test files that own this pattern:
  - `src/components/__tests__/DailyShareBlock.test.tsx`
  - `src/components/__tests__/LauncherMilestoneOverlay.test.tsx`
  - `src/game/hooks/__tests__/useHashGameRouter.test.tsx`

Replace their per-test setup with `const captured = installAnalyticsCapture()` / `uninstallAnalyticsCapture()`.

- [ ] **Step 3**: Move `src/game/hooks/__tests__/fakeMapRef.ts` → `src/test/fakeMapRef.ts`.

- [ ] **Step 4**: Update imports in `src/game/hooks/__tests__/useRevealMapEffects.test.tsx`.

- [ ] **Step 5**: Replace the 2 inline `makeFakeMap` copies in `src/hooks/__tests__/{useCompareViewDimming,useSelectionHighlight}.test.tsx` with imports from `src/test/fakeMapRef.ts`. **If the shapes diverge** (richer fakeMapRef vs minimal makeFakeMap), keep both for now and document — promoting them costs more than the win.

- [ ] **Step 6**: Verify and commit.

```bash
npm run test:unit  # 431 green
npx tsc --noEmit  # clean
git commit -m "refactor(test): shared analyticsCapture helper, move fakeMapRef into src/test"
```

---

### Phase 3 — Application code consistency (2 PRs, ~5 hours)

**Goal:** Stop spreading magic-string mode IDs and stop scattering reveal-color literals.

#### Task 3.1 (PR 1, **REQUIRED**): Mode-ID stringification reduction (~3 hours)

**Status:** Required in v3. The 36 sites verified firsthand exceed the threshold ("pile up further") flagged in v2. Per user decision, predicate helpers land in this phase.

**Honest caveat preserved:** `ModeId` is a TypeScript string-literal union so typos are already compile-time-caught. The cumulative friction at 36 sites — not type-safety — is the justification. The narrower "Out of scope" item #2 (polymorphic-on-mode design) remains the long-term answer.

- [ ] **Step 1**: Add a small predicate module.

`src/game/shared/modePredicates.ts`:
```ts
import type { ModeId } from './types'

export const isCountryPinning = (id: ModeId): id is 'country-pinning' => id === 'country-pinning'
export const isCityGuessing = (id: ModeId): id is 'city-guessing' => id === 'city-guessing'
```

These are type-guards so they narrow `ModeId` inside conditional branches.

- [ ] **Step 2**: Replace bare comparisons at the 23 documented sites — start with the worst offender `src/game/hooks/useHashGameRouter.ts:162,180,197,227,236`.

```ts
// Before
if (session.modeId === 'country-pinning') { ... }
// After
if (isCountryPinning(session.modeId)) { ... }
```

Keep the literal string when it's a discriminator on a literal type (e.g. `{ kind: 'country-pinning', ... }` in `RoundSpec`) — those are NOT what we're targeting.

- [ ] **Step 3**: Run tests + tsc — no regressions expected (pure rename).

- [ ] **Step 4**: Commit.

```bash
git commit -m "refactor: introduce modePredicates, replace 20+ bare mode-ID comparisons"
```

#### Task 3.2 (PR 2): Reveal color constants (~2 hours)

- [ ] **Step 1**: Add reveal-feedback colors to `src/lib/mapPalette.ts`.

```ts
// Reveal feedback (used by useRevealMapEffects):
export const REVEAL_CORRECT = '#22c55e' // green-500 — correct guess border
export const REVEAL_WRONG = '#f59e0b'   // amber-500 — wrong-guess border + near-distance band
export const REVEAL_FAR = '#ef4444'     // red-500 — far-distance band (>500km)
```

- [ ] **Step 2**: Replace the 7 inline hex sites in `src/game/hooks/useRevealMapEffects.ts` and the 3 in its test.

- [ ] **Step 3**: Verify visual parity — run the dev server, play one country round, confirm the reveal arc colors match the prior commit (`git stash` + `git diff` for sanity).

- [ ] **Step 4**: Commit.

```bash
git commit -m "refactor: centralize reveal colors in mapPalette"
```

---

### Phase 4 — Tooling tier-up (2 PRs, ~6 hours)

#### Task 4.1 (PR 1): Discoverability + pre-commit (~1 hour)

- [ ] **Step 1**: Add to `package.json` scripts:
```json
"typecheck": "tsc -b",
"check": "npm run lint && npm run typecheck && npm run test:unit",
```

- [ ] **Step 2**: Create `.editorconfig`.

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 3**: Set up Husky pre-commit.

```bash
npm install --save-dev husky lint-staged
npx husky init
```

Configure `.husky/pre-commit` to run `npx lint-staged`.

Add to `package.json`:
```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix"],
  "*.{ts,tsx,json,md}": ["prettier --write"]
}
```

- [ ] **Step 4**: Commit.

```bash
git commit -m "chore: husky pre-commit, typecheck script, editorconfig"
```

#### Task 4.2 (PR 2): ESLint `recommended-type-checked` upgrade (~5 hours)

This is the deferred work from `docs/superpowers/plans/2026-05-12-fix-pipelines-and-verified-bugs.md` §Section 4. Execute as a dedicated PR.

- [ ] **Step 1**: Enable the type-checked ruleset in `eslint.config.js`.

```js
import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // existing config...
)
```

- [ ] **Step 2**: Run `npm run lint` — expect many findings (the 2026-05-12 plan warned "many findings to fix first"; estimate 50–200 per rule depending on the codebase shape). Categorize by rule:
  - `no-unsafe-assignment` / `no-unsafe-member-access` — usually fixable by adding type guards or narrower types
  - `no-floating-promises` — add `void` or `await`
  - `no-misused-promises` — fix event handler signatures
  - `restrict-template-expressions` — wrap non-string values
  - Some may be appropriate to silence per-line with `// eslint-disable-next-line` and a WHY comment.

- [ ] **Step 3**: **Consider splitting per rule-family** into separate PRs to keep each diff reviewable:
  - PR 4.2a — `no-unsafe-*` family
  - PR 4.2b — `no-floating-promises` + `no-misused-promises`
  - PR 4.2c — `restrict-template-expressions` + remaining

  Each PR enables a subset of rules in the config and remediates them. Final PR flips the master switch to `recommendedTypeChecked` and removes the per-rule overrides.

  Fix findings file-by-file within each PR. Group related fixes into atomic commits.

- [ ] **Step 4**: Verify CI lint step still green-fast, no test regressions.

- [ ] **Step 5**: Commit and PR.

```bash
git commit -m "chore(eslint): enable recommended-type-checked + remediate findings"
```

---

### Phase 5 — Dependency hygiene (2 PRs, ~5 hours)

**Goal:** Close the major-version lag surfaced in §1.8. Sequence AFTER Phase 4.2 (ESLint type-checked) so ESLint 10 + react-hooks 7 land together and any stricter exhaustive-deps findings are fixed alongside the existing type-checked-rule findings.

**Files:**
- Modify: `package.json` (`dependencies` + `devDependencies` version pins)
- Modify: any src files needing migration deltas

**Sequencing strategy:** group bumps by interaction risk, not alphabetically.

#### Task 5.1 (PR 1): Build-tool + test-runner bumps (~2 hours)

**Scope corrected after changelog research (v5):** dropped `@vitejs/plugin-react` — its v5+ requires Vite 8+, but this repo is on Vite 6. The current `4.7.0` is the latest version compatible with Vite 6. Bumping it requires bumping Vite first, which is deferred to a separate plan (§5 item 7).

- [ ] **Step 1**: Bump in one transaction.

```bash
npm install --save-dev \
  typescript@^6.0.0 \
  jsdom@^29.0.0 \
  globals@^17.0.0
```

- [ ] **Step 2**: Run the standard verification ladder.

```bash
npm run typecheck   # (will exist after Phase 4.1) — must be clean
npm run lint        # must be clean (no new findings from TypeScript 6)
npm run test:unit   # 431 passing
npm run test:e2e    # green (locally; CI excludes GPU-runner specs already)
```

**Risk-mitigation guidance from research**:

- **TypeScript 6** — verified low-risk: this repo already has explicit `"strict": true`, `"moduleResolution": "bundler"`, `"types": ["vite/client"]` in `tsconfig.app.json`, so the v6 default changes don't affect it. If new strict-narrowing warnings appear (e.g. `unknown` handling), fix inline — they're usually genuine bugs the older checker missed.
- **jsdom 29** — verified low-risk: v28 overhauled the resource-loading API (no impact — repo doesn't intercept XHR/WebSocket); v29 overhauled CSSOM but no `getComputedStyle` calls exist in `src/`. If a `@testing-library/react` query reads styles and fails, pin jsdom at 27 or 28 and document.
- **globals 17** — type-only; new browser globals added, none removed.

- [ ] **Step 3**: Commit and PR.

```bash
git add package.json package-lock.json
git commit -m "chore(deps): bump TypeScript 6, jsdom 29, vitejs-plugin-react 6, globals 17"
```

#### Task 5.2 (PR 2): ESLint ecosystem bumps (~3 hours)

Lands after Task 5.1 (so TypeScript 6 + globals 17 are settled) and after Phase 4.2 (so the type-checked ruleset is already in place).

**Verified-via-npm peer-dep coordination (2026-05-15):**
- `eslint-plugin-react-hooks@7.1.1` peer: `eslint: ^9.0.0 || ^10.0.0` — supports both ESLint 9 and 10 ✓
- `typescript-eslint@8.59.3` peer: `eslint: ^8.57.0 || ^9.0.0 || ^10.0.0` — already supports ESLint 10; stays on 8.x (v9 not released yet)
- `eslint-plugin-react-hooks@5.2.0` (current) peer maxes out at ESLint 9 — must bump to 7.x before bumping ESLint to 10

So the upgrade transaction is:

- [ ] **Step 1**: Bump in one transaction.

```bash
npm install --save-dev \
  eslint@^10.0.0 \
  @eslint/js@^10.0.0 \
  eslint-plugin-react-hooks@^7.1.0 \
  eslint-plugin-react-refresh@^0.5.0
```

`typescript-eslint` stays at its current major (8.x); just allow `npm update` to pick up the latest patch within 8.x. Don't pin to `^9.0.0` — that version doesn't exist on npm yet (latest is 8.59.3).

- [ ] **Step 2**: Pre-flight ESLint 10 changes per the verified breaking-change list (researched 2026-05-15):

  **a. Add `name` property to each config object** in `eslint.config.js` — ESLint 10 makes this required. E.g.:
  ```js
  export default tseslint.config(
    { name: 'ignores', ignores: ['dist'] },
    {
      name: 'app',
      extends: [js.configs.recommended, ...tseslint.configs.recommended],
      ...
    },
  )
  ```

  **b. Verify CI Node version is `>=22.13` or `>=20.19`** — current CI uses `node-version: 22` which auto-resolves to the latest 22.x (likely 22.20+ by now, fine). Pin to `22.13` in CI if uncertainty.

  **c. JSX reference tracking** now default — no action required; just expect new findings if any.

  **d. No `eslint-env` comments in `src/`** (verified by grep) — that breaking change doesn't affect us.

- [ ] **Step 3**: Review release notes for plugin behavior changes:
  - `eslint-plugin-react-hooks` 7.1 → stricter `set-state-in-effect` validation; improved ref validation for non-mutating functions. **Specifically check** the pre-existing `// eslint-disable-next-line react-hooks/exhaustive-deps` at `src/game/hooks/useHashGameRouter.ts:220` and the 9 ref-mirrors across `src/game/hooks/*` for new findings — each is either a real bug or warrants an inhibition with a WHY comment.
  - `eslint-plugin-react-refresh` 0.5 → minor cleanup of false-positive cases.

- [ ] **Step 3**: Run lint; remediate findings.

```bash
npm run lint
# Categorize:
#   - Real bugs (missing dep, wrong dep): FIX
#   - Justified inhibition (closure-staleness like statusRef): disable inline with WHY comment
#   - Outdated rule semantics: file separately if unclear
```

- [ ] **Step 4**: Full verification ladder.

```bash
npm run typecheck && npm run lint && npm run test:unit && npm run test:e2e
```

- [ ] **Step 5**: Commit and PR.

```bash
git commit -m "chore(deps): bump ESLint 10, react-hooks 7, typescript-eslint 9"
```

#### Task 5.3 (PR 3): Dependabot config (~30 min)

To prevent re-accumulation of the lag this phase is closing.

- [ ] **Step 1**: Create `.github/dependabot.yml`.

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      eslint-ecosystem:
        patterns:
          - "eslint*"
          - "@eslint/*"
          - "typescript-eslint"
      vite-ecosystem:
        patterns:
          - "vite"
          - "@vitejs/*"
      sentry:
        patterns:
          - "@sentry/*"
    open-pull-requests-limit: 5

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

The grouping prevents Dependabot from opening 6 PRs when the ESLint ecosystem releases coordinated bumps — they land in one PR.

- [ ] **Step 2**: Commit.

```bash
git add .github/dependabot.yml
git commit -m "chore: add Dependabot config for npm + github-actions"
```

#### Decisions deferred to runtime

- **Minor-version bumps** (e.g. `@sentry/react` 10.49 → 10.53, `maplibre-gl` 5.23 → 5.24) are safe-to-batch in a small PR if scope permits. With Dependabot configured (Task 5.3), this happens automatically.
- **Renovate alternative**: more powerful than Dependabot but external app. Dependabot is GitHub-native and sufficient for this project's needs.

---

### Phase 6 — Quarantined tests triage (variable, may be blocked)

**Goal:** Resolve or document the 4-5 quarantined e2e tests. Some may genuinely require self-hosted GPU runner availability.

**Per-issue blocker map** (gathered from the existing diagnosis notes in `docs/superpowers/notes/`):

| Issue | Tests | Blocker | Estimated unblock cost |
|---|---|---|---|
| **#47** (animation timing) | `e2e/animation-interrupt.spec.ts:30,53,78` | CI's `reducedMotion: 'reduce'` baseline collapses `data-animation-state` to never enter `entering`. Either rewrite tests to assert end-state only OR install a per-test `reducedMotion: 'no-preference'` override. | Test rewrite — 2-4 hours |
| **#32** (mode switch) | `e2e/game-over-mode-switch.spec.ts:36` | Timing-dependent reducer commit between `endGame` + `start`. Bug-#32's atomicRestart workaround addresses one path but the test exercises a different one. | Diagnose — 1-2 hours; fix unknown |
| **#31** (launcher frame) | `e2e/launcher.spec.ts:87` | Compositor frame production unreliable on ubuntu-latest's headless ANGLE. Either rewrite to assert state, not frames, OR wait on self-hosted GPU runner. | Test rewrite — 1-2 hours OR infra block |

#### Task 6.1: Per-issue triage

For each of the 3 issues (#31, #32, #47), produce a triage note in `docs/superpowers/notes/2026-05-15-quarantine-triage.md` containing:
- The failing test name(s) and location
- Reproduction steps locally
- Root cause hypothesis
- Resolution options: (a) fix the underlying bug, (b) rewrite the test to use a timing-agnostic seam, (c) accept permanent quarantine with `test.skip` and a clear note
- Estimated effort

- [ ] **Step 1**: Write the triage doc. Reference the existing diagnosis notes in `docs/superpowers/notes/`.

- [ ] **Step 2**: For each issue, open a tracking PR or update the existing issue with the triage note's link.

- [ ] **Step 3**: If a quarantine can be resolved with a small test rewrite, do that in a focused PR. **Do not** convert `test.fixme` → `test.skip` without a CLEAR signal that the test will never be fixed (per CLAUDE.md policy).

---

## 5. What's NOT in this plan

These items came up during the survey but are deliberately out of scope. Adding them would expand the plan beyond "cleanup to make presentable":

1. **`useSyncExternalStore` replacement of the 9 ref-mirrors.** Each ref documents a closure-staleness or commit-timing concern. Replacing them en-masse risks behavior changes that the GameController extraction's characterization tests were specifically designed to prevent. Tracked as the original GameController extraction plan's §"What's NOT in this plan" item 5.

2. **Mode-name de-branching (full polymorphic-on-mode design).** Phase 3 above does the narrower "introduce predicates" version. The full refactor (each mode owns its own announcement, reveal-paint, and resume shapes) is a separate plan.

3. **Reducer redesign to eliminate the `restart` action.** Bug-#32's atomic-restart workaround works; replacing it with `useTransition` or `idle`-tolerant HUDs is architectural.

4. **`GameController.tsx → GameController/index.tsx` folder rename.** Cosmetic; codebase hasn't committed to that style yet.

5. **App.tsx decomposition.** The post-extraction `App.tsx` is 450 lines. Splitting it (LauncherContainer, CompareToolbar, etc.) is a separate breakdown plan when it becomes painful to work in.

6. **Bundle budget cadence review.** The current budgets are "measured + 10%" from 2026-05-14. A separate plan should define when/how to re-baseline.

7. **Self-hosted GPU runner provisioning.** Resolves the 13 CI-ignored specs. Infrastructure work outside this plan's scope.

8. **`useDailyResumePersistence` signature harmonization** (raw session vs args interface). Explicitly endorsed by a prior /simplify reviewer; no concrete cost.

9. **`Args` vs `Options` naming harmonization** across the 5 extracted hooks. Plan amendment #5 mandated `Options` for the hash router; cosmetic-only.

10. **`prefersReducedMotion()` memoization.** Browsers cache `matchMedia` results; the 8 sites cost effectively nothing.

11. **Vite 6 → 8 upgrade.** Discovered during v5 changelog research: `@vitejs/plugin-react` v5+ requires Vite 8+. Bumping the React plugin requires bumping Vite first, which is a much bigger surface (plugin API breaking changes between Vite 6/7/8, Rollup major bumps, dev-server semantics). Defer to a dedicated Vite-bump plan; this plan stays on Vite 6 + `@vitejs/plugin-react@4.7.0` (the latest compatible).

---

## 6. Success criteria

When all phases (0–5) land, the repo passes this check:

- [ ] A first-time visitor lands on the GitHub repo page and sees: hero screenshot, demo URL, CI badge, license badge.
- [ ] `git status` on a clean checkout shows zero untracked files (8 abandoned PNGs deleted; 5 docs committed).
- [ ] `package.json` has `description`, `homepage`, `repository`, `bugs`, `keywords`, `license`, `author` populated (with `private: true` and `version: 0.0.0` preserved).
- [ ] `grep -r 'window as unknown as { __funworldmap_game' src/ | wc -l` returns 0 (down from 3+).
- [ ] `grep -r 'declare global.*Window' src/**/__tests__/ | wc -l` returns 0 or 1 (down from 5+).
- [ ] `factories.ts` exports `makeCountryReveal`, `makePointReveal`, `makeOutcome` and the two test files that previously duplicated them import from there.
- [ ] `src/lib/mapPalette.ts` exports `REVEAL_CORRECT`/`REVEAL_WRONG`/`REVEAL_FAR` and `useRevealMapEffects.ts` references them.
- [ ] `grep -rn "=== 'country-pinning'\|=== 'city-guessing'" src/ | wc -l` returns ≤5 (down from 36; non-zero because discriminated-union pattern-matching on `kind` literals stays).
- [ ] `npm run typecheck` is documented in `package.json` scripts.
- [ ] Husky pre-commit hook runs on `git commit`.
- [ ] `.editorconfig` exists.
- [ ] `eslint.config.js` enables `recommended-type-checked` (after Phase 4.2).
- [ ] `npm outdated` shows zero `major` lag for ESLint ecosystem, TypeScript, jsdom, vitejs-plugin-react (after Phase 5).
- [ ] `CODE_OF_CONDUCT.md` + issue/PR templates present.
- [ ] Phase 6 quarantine triage doc exists; each quarantine has either a resolution PR or a tracked-as-permanent-block status.

The repo is "presentable" when the README hero block + governance files are in place (Phases 0–1). The repo is "clean" when Phases 2–3 land. The tooling is current when Phases 4–5 land. Phase 6 closes the open-CI-quarantine loop.

---

## 7. Self-review (run by the plan author after writing)

**Spec coverage**

- Diagnosis section present? Yes — §1, six categories.
- Strengths section present? Yes — §1.7.
- Each weakness cited with file:line? Yes (verified items); trade-offs and nitpicks are labeled.
- Phase structure justifies "one plan"? Yes — §2 (shared assessment context, independent phases).
- Explicit "out of scope" section? Yes — §5, 10 items.
- File map present? Yes — §3.
- Per-phase TDD or task shape? Yes — each phase has numbered tasks with checkboxes.

**Placeholder scan**

- "TBD" / "TODO" / "fill in details"? None.
- "Similar to Task N"? None.
- Steps without code blocks where code is expected? None.

**Type / naming consistency**

- `isCountryPinning` / `isCityGuessing` referenced in Phase 3a; usage example provided.
- `REVEAL_CORRECT` / `REVEAL_WRONG` / `REVEAL_FAR` names defined in Phase 3b; consistent with existing `mapPalette.ts` naming style (`TEAL`, `CORAL`).
- `installAnalyticsCapture` / `uninstallAnalyticsCapture` signatures consistent between definition and usage.

**Honesty check**

- Did I label trade-offs as "violations"? Re-read §1.4: `Args`-vs-`Options`, `useDailyResumePersistence` signature, and `prefersReducedMotion` are all labeled trade-offs/nitpicks per the prior /simplify reviewer guidance.
- Did I include the deferred items from prior plans? Yes — ESLint upgrade (Phase 4.2), §"What's NOT in this plan" 1–10.
- Are the costs realistic? Cross-checked Phase 4.2 against the original deferral note ("disruptive, many findings to fix first") — 5 hours is a guess; could be 2x.

**Gap that surfaced during self-review:** Phase 2 Task 2.1 deletes the duplicated `Window` casts from production code (`useGameTestSeams.ts`, `GameSessionProvider.tsx`) — those changes are in `src/`, not under `__tests__/`. Phase 2 is described as "test-fixture consolidation" but the centralized `Window` augmentation reaches production. Acceptable scope creep — the `Window` augmentation is the same hazard surface; flag this in the PR description so reviewers know.

**Gap that surfaced during self-review:** Phase 1's "Move screenshots to `docs/assets/`" assumes 9 PNGs at the repo root, but the working-tree audit only saw the 2 `share-toast-*.png` files. The 7 `screenshot-*.png` mentions came from the README survey — those must already be tracked. Verified-by-grep: yes, they're tracked. Move them in Phase 1; no ambiguity.

---

**Status:** v2 (post-self-review). Ready to execute.
