# Flagship continuation — roadmap

**Date:** 2026-05-30
**Author:** Tobias Ens (with Claude)
**Status:** Roadmap — pending per-workstream implementation plans

## Context

The repository was assessed as a flagship ("Aushängeschild") candidate. Two highest-leverage items shipped first: the daily index moved off `main` to a `data` branch (PR #93, clean `main` history going forward) and the stale-branch cleanup (13→1 local, stale remotes removed). This roadmap covers the remaining polish identified in that assessment, decomposed into independent workstreams.

This is an **umbrella roadmap**, not a single implementation plan. Each workstream is independently shippable and gets its own detailed plan (and PR) when executed, in the sequence below. The roadmap fixes scope, sequencing, and acceptance criteria so the per-workstream plans stay small and focused.

## Goals

- Close the gaps that keep the repo below flagship grade: an empty-but-advertised ADR directory, a `~60 KB` always-bundled dependency, a 550-LOC orchestration component, 6 tolerated lint warnings, and no versioning story.
- Each workstream lands as a self-contained PR that passes CI and is independently revertable.
- No user-facing behavior regressions; `src/` changes are behavior-preserving and covered by unit + e2e tests.

## Non-goals

- No new product features. This is polish/quality/docs only.
- No change to the daily-content / `data`-branch mechanism (just shipped).
- No broad restructuring beyond the named `App.tsx` effect extractions.
- No dependency upgrades (the open dependabot PRs are handled separately).

## Sequencing

Risk-ascending, so the cheapest/safest work lands first and the release tag captures the fully-polished state:

**A — ADRs & doc reconcile** → **B — Lazy-load Sentry** → **C — Code quality (lint, then `App.tsx`)** → **D — Release `v1.0.0`** (last).

Workstreams are independent; this order is a recommendation, not a hard dependency — except **D must be last** (the tag should reflect A–C merged).

---

## Workstream A — ADRs & doc reconcile

**Size:** S (docs only). **Risk:** none.

**Owner decision:** broader backfill — file **4 ADRs** under `docs/adr/`, following the existing convention (`NNNN-slug.md`; sections Context / Decision / Consequences / Alternatives / Status / Date):

1. `0001-maplibre-webgl2-basemap.md` — MapLibre GL + WebGL2-required basemap (load-bearing framework/deployment choice; the WebGL2 requirement excludes some older browsers — a real tradeoff). Status: Accepted.
2. `0002-url-hash-single-source-of-truth.md` — the URL hash as the single source of truth for selection/routing.
3. `0003-usegamesession-reducer-model.md` — the single-reducer game-session model with the discriminated-union action set.
4. `0004-daily-content-data-branch.md` — daily index served from an orphan `data` branch (decided 2026-05-30; supersedes the commit-to-`main` approach). Cross-links the spec/plan and PR #93.

**Convention reconcile:** `docs/adr/README.md` currently lists "historical backfill for decisions nobody is contesting" as a _poor reason_. Because 0001–0003 are exactly that kind of backfill, add a short note to the README acknowledging that a small set of foundational decisions were recorded once for discoverability, so the guidance and the directory contents don't contradict each other.

**Also in A (surfaced during plan review):** fix two stale doc references the ADRs would otherwise contradict — `docs/systems/overview.md` cites `maplibregl.supported()` (removed in MapLibre v5; the real check is `canvas.getContext('webgl2')` in `useMapInstance`), and `CONTRIBUTING.md` describes the old `chromium`/`chromium-gpu` e2e split (since consolidated). Both are in the workstream-A plan, Task 3.

**Acceptance:** 4 ADRs present and well-formed; `docs/adr/README.md` no longer contradicts the directory; README's "Decision Records" link resolves to real content; no broken cross-links; no `maplibregl.supported()` / `chromium-gpu` references remain in the touched docs.

---

## Workstream B — Lazy-load Sentry

**Size:** L (larger than first scoped — see below). **Risk:** medium (must preserve crash-recovery UI and the daily error telemetry).

**Today:** `@sentry/react` is statically imported at **three** sites, so its ~60 KB gzip ships in the initial chunk even when `VITE_SENTRY_DSN` is unset (local/CI/most prod builds):

1. `src/main.tsx` — wraps the app in `<Sentry.ErrorBoundary>` (rendered from first paint, independent of DSN) and calls `initSentry(...)`.
2. `src/lib/initSentry.ts` — the init, already DSN-gated at runtime (but the static import still bundles it).
3. The daily-storage telemetry path (`src/game/daily/storage.ts` and its helper) — `captureException` / `addBreadcrumb` on localStorage errors.

DSN-gating the init alone does **not** remove Sentry from the bundle: the always-rendered `Sentry.ErrorBoundary` is a static import that pins it. Removing the ~60 KB requires restructuring all three sites.

**Change (real approach):**

- (0) **Measurement gate (do first).** Build and measure Sentry's actual contribution to `main-js-gzip` (e.g. inspect the chunk / temporarily strip Sentry and diff the budget). The ~60 KB is an estimate from the 2026-04-19 budget; the installed `@sentry/react ^10.x` may differ. If the real saving is materially below ~60 KB, descope to (c)-only or defer — don't spend L effort on an unverified payoff.
- (a) Replace `Sentry.ErrorBoundary` with a small dependency-free error boundary that always renders the fallback UI, and forwards the error to Sentry only if/when Sentry has been loaded. This is the crux — without it, the chunk won't split.
- (b) Lazy-load `@sentry/react` via dynamic `import()` inside `initSentry`, only when a DSN is present.
- (c) In the daily-storage telemetry path, dynamic-import Sentry inside the (rare) error branch rather than at module top.
- (d) Re-baseline `scripts/bundle-budget/budgets.json` with measurement evidence in the commit message (per the budget file's own update protocol).

**Cost/benefit to confirm at review:** the ~60 KB win comes at the cost of a hand-rolled error boundary and slightly-lazier crash reporting (an error before Sentry finishes loading is shown to the user but reported only once Sentry is up). Against MapLibre's unavoidable ~275 KB floor, this is a real but not dramatic reduction. **Descope options if the tradeoff isn't worth it:** (i) do only (c) — dynamic-import in the storage error path, a smaller saving with no ErrorBoundary change; or (ii) defer B entirely. To be reconfirmed at the spec-review gate now that B is L, not M.

**Acceptance:** with a DSN set, an init smoke confirms Sentry initializes and the boundary reports a thrown error; with no DSN, the app and its crash-fallback UI are unaffected; measured `main-js-gzip` drops materially and the budget check passes against the new baseline; full unit + e2e green.

---

## Workstream C — Code quality

Two **independent** parts (different files); land lint first (smaller/lower-risk), then the `App.tsx` extraction.

### C1 — Clear the 6 lint warnings

**Size:** S. **Risk:** low (deps-array changes can alter effect timing — verify).

- **5× `react-hooks/exhaustive-deps` — missing `mapRef`** in `src/game/hooks/useRevealMapEffects.ts` (lines ~268, 320, 356, 371, 378). First confirm `mapRef` is a stable ref object from `useMap()` (identity never changes). If stable, add `mapRef` to each deps array — harmless (no extra re-runs) and silences the warning. If a deps-array change would alter timing, instead add a scoped `// eslint-disable-next-line` with a one-line justification. Do **not** blanket-disable.
- **1× `react-refresh/only-export-components`** in `src/game/modes/city-guessing/index.tsx:20` — the file exports a component plus a non-component (context/value). Move the non-component export to a sibling module so the file exports only components.

**Acceptance:** `npm run lint` reports **0 warnings, 0 errors**; unit + e2e green (confirms no effect-timing regression in the reveal map effects).

### C2 — `App.tsx` effect extraction

**Size:** M–L. **Risk:** medium (`AppInner` is the orchestration hub).

`AppInner` is ~550 LOC with ~10 `useEffect`s. Extract **2–3 self-contained effects** into named, unit-tested hooks (the exact set chosen in the plan; candidates, each cohesive and testable in isolation):

- `useFirstVisitHint` — the show/dismiss hint logic (`showHint`/`hintDismissed` state + its two effects + the `sessionStorage` guard).
- `useAppKeyboardShortcuts` — the global `keydown` handler (Escape cascade, `/`-to-search).
- `useAnnouncer` (live region) — the `funworldmap:announce` event listener + clear-timer.

**Constraint:** behavior-preserving — no change to what the app does, only where the logic lives. Each extracted hook gets focused unit tests; the existing e2e suite (keyboard nav, a11y, launcher, hint) must stay green as the regression net.

**Acceptance:** `AppInner` is meaningfully smaller (target: each extracted hook is self-contained with a clear interface); new hooks have unit tests; full unit + e2e green; no behavior change observable in e2e.

---

## Workstream D — Release `v1.0.0` (last)

**Size:** S. **Risk:** none.

After A–C merge: set `package.json` `version` to `1.0.0`, create an annotated git tag `v1.0.0` on `main`, and publish a GitHub Release whose notes summarize the shipped state (retention-v1 daily puzzles, the `data`-branch architecture, the cleanup, and this polish pass). This gives the "launch-prep" work a versioning narrative. (`v1.0.0` signals a stable public launch; if you'd rather signal pre-stable, `0.1.0` is the alternative — owner's call, decided when D is planned.)

**Acceptance:** `package.json` shows `1.0.0`; `git tag` lists `v1.0.0` pointing at the post-C `main`; a GitHub Release exists with notes; README/docs version references (if any) are consistent.

---

## Workstream E — Resolve the open dependency PRs (optional, independent)

**Size:** S–M (depends on the upgrade). **Risk:** low.

Two dependabot PRs are open; the `vite-ecosystem` group bump (#84) has been failing CI for weeks. A perpetually-red PR is a visible blemish on a flagship repo's PR list — surfaced during this review, not in the original assessment's five items. Investigate why the bump fails (likely a breaking change in the Vite/Vitest ecosystem needing a small config/code adjustment), then either land it or close it with a one-line rationale. The `actions/cache` bump (#83) is likely a clean merge. Independent of A–D; can run anytime.

**Acceptance:** no open red PRs — each dependabot PR is either merged (CI green) or closed with a documented reason.

---

## Risks & rationale

- **Ordering:** A and D are zero-code-risk. B turned out **L** (a hand-rolled error boundary + dynamic imports across three sites) with a crash-reporting tradeoff — reconfirm or descope it at the review gate. C2 is the only change touching the orchestration hub, so it lands late with the full test suite as the net. D is strictly last so `v1.0.0` reflects A–C. The A→B→C→D order is risk-ascending but flexible per-workstream (e.g. the tiny C1 lint fix could slot earlier as a quick win); only D is pinned to the end.
- **Bundle baseline (B):** the budget check fails closed on unaccounted assets, so the re-baseline must be done deliberately with measurement evidence, not by loosening the check.
- **Effect extraction (C2):** the risk is subtle timing/focus regressions not caught by unit tests; the e2e a11y/keyboard/launcher specs are the backstop, and extraction is strictly behavior-preserving.

## Out of scope (named)

- Product features; daily-content mechanism changes; dependency upgrades (dependabot handles those); any `App.tsx` change beyond the named extractions; cross-browser CI expansion (tracked separately in `docs/roadmap.md`).

## Per-workstream plans

Each workstream gets its own `docs/superpowers/plans/YYYY-MM-DD-<slug>.md` when executed, in the A→B→C→D order. This roadmap is the index; the plans carry the step-by-step detail.
