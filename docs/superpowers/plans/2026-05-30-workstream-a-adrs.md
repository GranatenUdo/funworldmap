# Workstream A — ADRs & doc reconcile · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate `docs/adr/` with four foundational Architecture Decision Records, reconcile the ADR README so its guidance no longer contradicts the backfilled records, and correct two stale doc references (`overview.md`, `CONTRIBUTING.md`) that the corrected ADR 0001 would otherwise contradict.

**Architecture:** Pure documentation. Four new markdown files following the repo's ADR convention (`NNNN-slug.md`; Context / Decision / Consequences / Alternatives / Status / Date), plus a one-paragraph note in `docs/adr/README.md`. No code, no tests; verification is link integrity + prettier formatting (husky runs prettier on `*.md` at commit).

**Tech Stack:** Markdown; the repo's `docs/adr/README.md` filing convention.

**Spec:** [`docs/superpowers/specs/2026-05-30-flagship-continuation-roadmap-design.md`](../specs/2026-05-30-flagship-continuation-roadmap-design.md) (Workstream A)

---

## Scope out (NOT in this plan)

- Workstreams B (Sentry), C (lint / `App.tsx`), D (release) — separate plans.
- Any change to the top-level `README.md` (its "Decision Records" section already links to `docs/adr/` and `docs/adr/README.md`, both of which exist — adding ADRs makes that link resolve to real content with no edit needed).
- New ADR sequence numbers beyond 0001–0004.

## File Structure

| File                                               | Responsibility                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `docs/adr/0001-maplibre-webgl2-basemap.md`         | Records the MapLibre GL + WebGL2-required vector basemap choice                  |
| `docs/adr/0002-url-hash-single-source-of-truth.md` | Records URL-hash-as-single-source-of-truth for selection/routing                 |
| `docs/adr/0003-usegamesession-reducer-model.md`    | Records the single-reducer game-session model                                    |
| `docs/adr/0004-daily-content-data-branch.md`       | Records the orphan `data`-branch daily-content decision (this session)           |
| `docs/adr/README.md` (modify)                      | Add a note reconciling the "no backfill" guidance with the foundational backfill |

---

## Pre-flight

- [ ] **Confirm branch + clean tree.**

Run: `git branch --show-current && git status --porcelain`
Expected: `docs/flagship-continuation-roadmap` (or a dedicated workstream-A branch if you prefer), clean tree.

- [ ] **Confirm the ADR dir currently holds only the README (so 0001–0004 are the first records).**

Run: `ls docs/adr/`
Expected: `README.md` only.

---

## Task 1: Create the four ADRs

**Files:** Create the four files listed in File Structure.

- [ ] **Step 1: Write `docs/adr/0001-maplibre-webgl2-basemap.md`**

```markdown
# 1. MapLibre GL with a WebGL2-required vector basemap

**Status:** Accepted
**Date:** 2026-05-30 (records a decision made at project inception)

## Context

funworldmap is a fully client-side, static-hosted map application with no backend.
It needs: crisp rendering at any zoom, runtime-themeable map styling (light/dark),
interactive per-feature hit-testing for country selection, smooth camera animation,
and a permissively-licensed stack with no account or API key.

## Decision

Render with **MapLibre GL JS** (the open-source fork of Mapbox GL JS) over an
**OpenFreeMap "Positron" vector basemap**. MapLibre requires a WebGL2 context; before
creating the map the app probes for one (`canvas.getContext('webgl2')` in
`useMapInstance`) and, when unavailable, renders a "WebGL2 Not Supported" overlay
(`WorldMap.tsx`) instead of a blank canvas.

## Consequences

- Vector rendering gives crisp output at any zoom and runtime theming via paint
  properties; `queryRenderedFeatures` powers country hit-testing.
- MapLibre ships as a single, non-tree-shakeable bundle (~275 KB gzip) — the
  dominant bundle cost (see `docs/systems/overview.md` § Bundle Size Budget).
- The WebGL2 requirement excludes some older WebGL1-only browsers; accepted, with a
  graceful unsupported-message fallback rather than a crash.
- The basemap depends on the OpenFreeMap CDN; if tiles fail, country polygons still
  render from bundled data and `BasemapBanner` surfaces the degradation.

## Alternatives

- **Leaflet + raster tiles** — smaller and simpler, but raster tiles blur on zoom,
  offer no runtime theming, and have weaker vector feature interaction. Rejected:
  vector rendering + theming are core to the experience.
- **Mapbox GL JS** — same technology, but a proprietary license requiring an access
  token and billing. Rejected: funworldmap is free, static, and account-free.
- **Google Maps / other proprietary SDKs** — cost, closed source, and mandatory API
  keys. Rejected for the same reasons.
```

- [ ] **Step 2: Write `docs/adr/0002-url-hash-single-source-of-truth.md`**

```markdown
# 2. URL hash as the single source of truth for selection and routing

**Status:** Accepted
**Date:** 2026-05-30 (records a decision made at project inception)

## Context

The app must support deep-linkable country selection (e.g. `#FRA`), shareable daily
and game routes (`#daily/<date>/<mode>`, `#game/<mode>`), and working browser
back/forward — all on a static host with no server-side routing.

## Decision

The **URL hash is the single source of truth** for the current selection and route.
Every entry point — map click, search result, border chip, initial page load —
writes the hash; all consuming components react to `hashchange`. There is no parallel
in-memory selection state that can diverge from the hash. Parsing and serialization
live in `src/lib/hashState.ts` (`parseHash` / `writeHash`).

## Consequences

- Deep links, sharing, and back/forward all work with no extra machinery.
- Discipline cost: every new way to select/route must converge on the hash rather
  than holding its own state (see `docs/systems/overview.md` § Selection Flow).
- Routing is hand-rolled string parsing rather than a router library — minimal
  surface, but the parsing rules live in one module that must stay authoritative.

## Alternatives

- **React state/context only** — simplest in-app, but no deep-linking, sharing, or
  back/forward. Rejected: deep links are a product requirement.
- **A router library (e.g. React Router)** — designed for path-based routing and
  heavier than needed for a single-page static map keyed on a hash. Rejected: YAGNI.
```

- [ ] **Step 3: Write `docs/adr/0003-usegamesession-reducer-model.md`**

```markdown
# 3. Single useGameSession reducer with a discriminated-union action set

**Status:** Accepted
**Date:** 2026-05-30 (records a decision made during the retention-v1 build)

## Context

The game spans modes (country-pinning, city-guessing) and a daily best-of-N layer,
with non-trivial state: lives, score, streak, round index, per-round attempts, the
daily date, and round outcomes. Transitions must stay consistent — e.g. the score
and the reveal animation must always agree on the best attempt.

## Decision

Model the session as a single `useReducer` in `src/game/shared/useGameSession.ts`
with a **discriminated-union action set**: `start | attempt | completeNow | resume |
advance | overrideRound | endGame | finishFree | finalize | restart`. The reducer is
a pure function; modes plug in through the `GameMode` contract; orchestration (timers,
reveal effects, persistence) lives outside the reducer in `GameController` and hooks.

## Consequences

- Transitions are pure and unit-testable in isolation; cross-cutting invariants (e.g.
  best-of-N derivation) live in one place.
- Atomic multi-effect transitions are expressible — e.g. `restart` collapses
  endGame+start into one dispatch to avoid an intermediate `idle` render (the fix for
  bug #32, the game-over → hash-mode-switch race).
- Side-effect choreography stays outside the reducer, which keeps it pure but spreads
  timing logic across the controller/hook layer.

## Alternatives

- **Multiple `useState` values** — state scatters and invariants become hard to keep
  consistent across transitions. Rejected.
- **A state-machine library (e.g. XState)** — formal and expressive, but adds a
  dependency and conceptual overhead disproportionate to a state set this size.
  Rejected: a plain reducer suffices (YAGNI).
```

- [ ] **Step 4: Write `docs/adr/0004-daily-content-data-branch.md`**

```markdown
# 4. Daily content served from an orphan `data` branch

**Status:** Accepted
**Date:** 2026-05-30

## Context

The daily puzzle index (`/daily/index.json`) is regenerated four times a day and must
be served from the static site. The original approach committed it to `main`, which
accumulated ~137 `chore(daily)` bot commits — about a third of `main`'s history —
burying the real development history. For a showcase repository, that history noise is
a cleanliness problem.

## Decision

The generated index lives on an **orphan `data` branch**, never tracked on `main`:

- `daily-puzzle.yml` generates the index and commits it to `data` (two-checkout
  pattern), not `main`.
- `deploy.yml` obtains the index by **checking out** the `data` branch
  (`actions/checkout`), not `git fetch origin data` — under actions/checkout's
  single-branch refspec a bare fetch only updates `FETCH_HEAD` and never resolves
  `origin/data`, which would silently fall back to regenerating. A generate fallback
  covers a missing branch.
- Locally and in e2e the index is generated on demand (`predev` / the Playwright
  `webServer`); it is gitignored.

This supersedes the previous commit-to-`main` approach.

## Consequences

- `main`'s history stays free of bot commits going forward.
- Per-date content provenance is preserved (the `data` branch's git history) and the
  GitHub scheduled-workflow keepalive is preserved (commits to `data` count as
  repository activity that resets the 60-day auto-disable clock).
- Past-but-in-window daily picks may change when the index regenerates
  (reproducibility waived — no meaningful userbase to protect).
- Two workflows now reference the `data` branch; a lost branch needs the runbook
  bootstrap; deploy's generate fallback ensures the site never ships without a daily.

## Alternatives

- **Keep committing to `main`** — simplest, but the history noise is the problem being
  solved. Rejected.
- **Generate at deploy, commit nowhere** — clean `main`, but loses both the provenance
  trail and the scheduled-workflow keepalive. Rejected: both were valued.
- **Commit to `main` less frequently** — reduces but does not eliminate the noise.
  Rejected: half-measure.

## References

- Spec: `docs/superpowers/specs/2026-05-29-daily-content-data-branch-design.md`
- Plan: `docs/superpowers/plans/2026-05-29-daily-content-data-branch.md`
- PR #93
```

- [ ] **Step 5: Verify the four files exist and are well-formed.**

Run:

```bash
ls docs/adr/000*.md
for f in docs/adr/000*.md; do echo "== $f =="; grep -cE '^## (Context|Decision|Consequences|Alternatives)$' "$f"; grep -E '^\*\*Status:|^\*\*Date:' "$f"; done
```

Expected: four files listed; each reports `4` (all four required `##` sections present) and shows a `**Status:**` + `**Date:**` line.

- [ ] **Step 6: Commit.**

```bash
git add docs/adr/0001-maplibre-webgl2-basemap.md docs/adr/0002-url-hash-single-source-of-truth.md docs/adr/0003-usegamesession-reducer-model.md docs/adr/0004-daily-content-data-branch.md
git commit -m "docs(adr): record four foundational architecture decisions"
```

---

## Task 2: Reconcile the ADR README

**Files:** Modify `docs/adr/README.md`.

- [ ] **Step 1: Add the backfill-reconcile note.**

In `docs/adr/README.md`, immediately after the `## When to Write an ADR` section's "Poor reasons" list (before the `## Superseding` heading), insert:

```markdown
> **On the existing records.** ADRs `0001`–`0003` deliberately record foundational
> decisions after the fact, for discoverability in this showcase repository — a
> one-time exception to the "no historical backfill" guidance above. `0004` onward
> follow the guidance: written when a load-bearing decision is actually made.
```

- [ ] **Step 2: Verify the README no longer contradicts the directory, and all links resolve.**

Run:

```bash
grep -n "one-time exception" docs/adr/README.md && echo "reconcile note present"
# top-level README's Decision Records link targets resolve:
for t in docs/adr/ docs/adr/README.md; do test -e "$t" && echo "OK $t" || echo "MISSING $t"; done
# the data-branch ADR's cross-links resolve:
for t in docs/superpowers/specs/2026-05-29-daily-content-data-branch-design.md docs/superpowers/plans/2026-05-29-daily-content-data-branch.md; do test -e "$t" && echo "OK $t" || echo "MISSING $t"; done
```

Expected: "reconcile note present"; all `OK` lines, no `MISSING`.

- [ ] **Step 3: Commit.**

```bash
git add docs/adr/README.md
git commit -m "docs(adr): reconcile backfill note with filing convention"
```

---

## Task 3: Fix stale doc references the ADRs would contradict

**Files:** Modify `docs/systems/overview.md`, `CONTRIBUTING.md`.

Two pre-existing inaccuracies: `maplibregl.supported()` was removed in MapLibre v5 (the repo is on `^5.23.0`; the real check is `canvas.getContext('webgl2')` in `useMapInstance.ts:226`), and the e2e projects were consolidated away from the old `chromium`/`chromium-gpu` split. ADR 0001 now states the correct mechanism, so the system docs must match.

- [ ] **Step 1: Fix `overview.md`'s two `maplibregl.supported()` mentions.**

In `docs/systems/overview.md`:

- Line ~56 — replace `MapLibre GL creates WebGL2 context (with \`maplibregl.supported()\` check — see Error Handling)`with`MapLibre GL creates a WebGL2 context (the app first probes for one via \`canvas.getContext('webgl2')\` — see Error Handling)`.
- Line ~110 (Error Handling table) — replace the cell's `\`maplibregl.supported()\` returns false →`with`the \`canvas.getContext('webgl2')\` probe in \`useMapInstance\` fails →`, leaving the rest of the cell (browser-upgrade guidance, WebGL1 note) unchanged.

- [ ] **Step 2: Fix `CONTRIBUTING.md`'s stale e2e-projects line.**

In `CONTRIBUTING.md`, replace:
`- \`npm run test:e2e\` — Playwright (two projects: \`chromium\` DOM, \`chromium-gpu\` WebGL)`with:`- \`npm run test:e2e\` — Playwright (chromium on CI; mobile + firefox projects available locally — see \`playwright.config.ts\`)`

- [ ] **Step 3: Verify + commit.**

Run: `grep -rn "maplibregl.supported\|chromium-gpu" docs/systems/overview.md CONTRIBUTING.md || echo "NONE remain"`
Expected: `NONE remain`.

```bash
git add docs/systems/overview.md CONTRIBUTING.md
git commit -m "docs: fix stale WebGL2-detection + e2e-project references"
```

---

## Acceptance (workstream A)

- `docs/adr/` contains `README.md` + `0001`–`0004`, each with the four required sections and a Status + Date.
- `docs/adr/README.md` acknowledges the foundational backfill, so guidance and contents agree.
- The top-level `README.md` "Decision Records" link resolves to real content (no edit needed; verified it points at `docs/adr/`).
- `npm run lint` / `tsc` / tests are untouched by this docs-only change (no need to re-run, but `git status` is clean after commits and prettier has formatted the markdown via husky).

---

## Self-review notes (author)

- **Spec coverage:** Workstream A requires 4 ADRs (0001 MapLibre/WebGL2, 0002 hash, 0003 reducer, 0004 data-branch) → Task 1 steps 1–4; README reconcile → Task 2. Both spec requirements have tasks.
- **No placeholders:** each ADR's full content is in the plan; the README insert text is verbatim.
- **Convention consistency:** all four files use `NNNN-slug.md` naming and the exact section set the convention requires (Context / Decision / Consequences / Alternatives / Status / Date); the H1 uses the `N. Title` numbered form.
