# Findings Implementation & Voting Removal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the voting feature from all repo and user-memory docs, close the structural / testing / documentation / UX findings from the 2026-04-17 assessment, and ship the work as seven independently-revertable commit clusters.

**Architecture:** Seven sequential phases, low-risk-first. Phase 1–3 are documentation-only. Phase 4 establishes hook unit-test coverage and switches e2e to the production preview bundle. Phase 5 splits `WorldMap.tsx` (786 LOC) into three lib modules and six hooks, using a `useMap()` context to thread shared refs. Phase 6 splits `CountryPanel.tsx` (490 LOC) by layout variant. Phase 7 adds map-focus affordances, panel focus management, and a richer basemap banner. Each phase leaves `main` green before the next begins.

**Tech Stack:** React 19 + Vite 6 + TypeScript 5.7, MapLibre GL 5.23, Tailwind 4, Vitest 4 (node env), Playwright 1.59 (two projects: SwiftShader DOM, ANGLE for WebGL2), Fuse.js 7.

**Design reference:** `docs/superpowers/specs/2026-04-17-findings-implementation-and-voting-removal-design.md`.

**Scope out:** secondary basemap provider; voting backend / data-model migration; performance work beyond refactor fallout; visual redesign; brand changes; CHANGELOG / ROADMAP; content ADRs for decisions not being revisited; bulk-moving existing plans to `retrospectives/` (self-review determined they are forward specs).

---

## File Structure

**Files to create (new):**

Phase 1 touches only existing files and the user auto-memory file.

Phase 2:
- `CONTRIBUTING.md` — contributor guide
- `SECURITY.md` — security reporting policy (minimal)
- `docs/ops/runbook.md` — operational runbook
- `docs/adr/README.md` — ADR filing convention (no content ADRs)

Phase 3:
- `docs/superpowers/README.md` — planning convention

Phase 4:
- `src/hooks/__tests__/useSelectedCountry.test.ts`
- `src/hooks/__tests__/useCountryData.test.ts`
- `src/hooks/__tests__/useCountrySearch.test.ts`
- `src/hooks/__tests__/useTheme.test.ts`

Phase 5:
- `src/lib/mapPalette.ts` — palette constants (TEAL, CORAL, variants)
- `src/lib/mapLayers.ts` — layer definition factories
- `src/lib/loadCountryGeojson.ts` — topojson import + antimeridian fix
- `src/lib/__tests__/loadCountryGeojson.test.ts`
- `src/lib/resetViewControl.ts` — IControl class extracted verbatim
- `src/hooks/useMap.tsx` — context provider + shared-ref hook
- `src/hooks/useMapInstance.ts` — init + lifecycle
- `src/hooks/__tests__/useMapInstance.test.tsx`
- `src/hooks/useMapInteractions.ts` — hover + tooltip + click + cursor
- `src/hooks/useSelectionHighlight.ts` — selection + compare filters + dim-on-compare
- `src/hooks/__tests__/useSelectionHighlight.test.tsx`
- `src/hooks/useMapTheme.ts` — theme-aware paint updates
- `src/hooks/useSatelliteMode.ts` — satellite + terrain toggle

Phase 6:
- `src/components/CountryColumn.tsx` — extracted verbatim from `CountryPanel.tsx`
- `src/components/SingleCountryPanel.tsx` — single-country layout
- `src/components/CompareCountryPanel.tsx` — compare layout

Phase 7:
- `e2e/keyboard-map-nav.spec.ts`
- `e2e/panel-focus.spec.ts`

**Files to modify:**

- `docs/purpose.md:66` — delete voting bullet
- `docs/systems/data-collection.md:125-127` — delete voting section
- `C:\Users\renade\.claude\projects\E--polworldmap\memory\project_polworldmap_purpose.md` (user auto-memory, not tracked in git)
- `C:\Users\renade\.claude\projects\E--polworldmap\memory\MEMORY.md` (index line)
- `README.md` — add Contributing / Security / Decision Records links
- `docs/index.md` — add runbook / ADR / superpowers README to reading guide
- `playwright.config.ts` — switch `webServer` to preview the built bundle
- `src/components/WorldMap.tsx` — reduce to ~150 LOC composition shell
- `src/components/CountryPanel.tsx` — reduce to ~50 LOC router
- `src/App.tsx` — add focus management on panel open/close, keyboard announcements
- `src/components/BasemapBanner.tsx` — add Retry, improve message, session dismissal

**Files NOT modified:**

- `src/data/countries.json` — data layer unchanged
- Any plan file under `docs/superpowers/plans/` other than this one
- Git workflows — custom domain (`funworldmap.com`) means no base-path toggling is needed in CI

---

## Pre-flight

- [ ] **Step 0.1: Verify clean working tree on `main`**

Run:
```bash
git -C E:/polworldmap status
```
Expected: `On branch main` + `nothing to commit, working tree clean` (or only the untracked plan files that already exist). If dirty with other changes, stop — this plan assumes a clean starting point.

- [ ] **Step 0.2: Verify CI is green on the current `main` commit**

Run:
```bash
git -C E:/polworldmap log -1 --oneline
```
Note the SHA. Check GitHub Actions that this SHA's `CI` run passed. If it didn't, fix that first — this plan assumes a green baseline.

- [ ] **Step 0.3: Install dependencies and run full verification**

Run:
```bash
cd E:/polworldmap
npm ci
npm run lint
tsc -b
npm run test:unit
npm run build
npm run test:e2e
```
Expected: all green. If any fails, stop and fix before starting the plan.

- [ ] **Step 0.4: Create a working branch**

Run:
```bash
git -C E:/polworldmap checkout -b plan/findings-and-voting-removal
```
Expected: switched to the new branch.

---

# Phase 1 — Voting Removal

Intent: silent scrub. No replacement marker anywhere.

### Task 1.1: Delete the voting bullet from `docs/purpose.md`

**Files:**
- Modify: `docs/purpose.md:66`

- [ ] **Step 1.1.1: Remove the "Government type sentiment" bullet**

Open `docs/purpose.md`. Delete line 66 in its entirety:

```markdown
- **Government type sentiment**: Users vote on what they believe the government type to be. Aggregated alongside NGO classifications. Shows community perception vs. official designations. Requires a backend service — separate phase.
```

After deletion, the "Future Vision" section should read:
```markdown
### Future Vision
- Multi-language support, regional groupings (EU, NATO, ASEAN), sub-national divisions, economic comparisons, historical boundary timelines.
```

- [ ] **Step 1.1.2: Verify the file no longer contains voting language**

Run:
```bash
grep -n "Government type sentiment\|Users vote\|community perception" docs/purpose.md
```
Expected: no output (zero matches).

### Task 1.2: Delete the voting section from `docs/systems/data-collection.md`

**Files:**
- Modify: `docs/systems/data-collection.md:125-127`

- [ ] **Step 1.2.1: Remove the "Future: Voting & NGO Sentiment" section**

Delete lines 125-127 inclusive:

```markdown
## Future: Voting & NGO Sentiment

A future phase will add user-submitted government type classifications alongside official data. This requires a backend service (undefined) and changes the data model to support multiple opinions per field rather than a single source of truth. Documented here for architectural awareness — not part of the current data collection pipeline.
```

Also delete any trailing blank line that the section leaves behind. The file should end at the previous paragraph ending with `The architecture supports adding sources like Wikidata, World Bank, or UN data in future.`

- [ ] **Step 1.2.2: Verify clean ending**

Run:
```bash
tail -5 docs/systems/data-collection.md
```
Expected: the tail should not contain "Voting", "NGO", "Sentiment", "vote".

### Task 1.3: Re-grep the repo for any remaining references

- [ ] **Step 1.3.1: Search for voting / sentiment / NGO patterns**

Run:
```bash
cd E:/polworldmap
git grep -nE "(?i)vot(e|ing)|sentiment|NGO classification|community perception|government.type.sentiment" -- 'docs/*.md' 'docs/systems/*.md' 'README.md' 'src/'
```
Expected: zero matches. If matches appear in `docs/superpowers/plans/*.md` (historical plans), **do not remove them** — leave historical plans alone. If matches appear elsewhere, remove them now.

### Task 1.4: Update the user auto-memory

**Files:**
- Modify: `C:\Users\renade\.claude\projects\E--polworldmap\memory\project_polworldmap_purpose.md` (not in repo)
- Modify: `C:\Users\renade\.claude\projects\E--polworldmap\memory\MEMORY.md` (not in repo)

- [ ] **Step 1.4.1: Read the memory file**

Read `C:\Users\renade\.claude\projects\E--polworldmap\memory\project_polworldmap_purpose.md` to see its current content.

- [ ] **Step 1.4.2: Remove the voting-feature phrasing**

Edit the file so it no longer mentions "voting feature future phase" or similar. The memory should describe the project as: an interactive political world map with multi-source data and field-level attribution. No voting.

- [ ] **Step 1.4.3: Update the index line in `MEMORY.md`**

Edit the pointer line for `project_polworldmap_purpose.md` so the one-line hook no longer says "voting feature future phase." Replace with something like: `polworldmap purpose — Interactive political world map with multi-source data and field-level attribution`.

### Task 1.5: Verify and commit Phase 1

- [ ] **Step 1.5.1: Run lint + tsc + unit tests + build**

Run:
```bash
cd E:/polworldmap
npm run lint && tsc -b && npm run test:unit && npm run build
```
Expected: all green. (No code was touched; this is sanity.)

- [ ] **Step 1.5.2: Commit**

Run:
```bash
git -C E:/polworldmap add docs/purpose.md docs/systems/data-collection.md
git -C E:/polworldmap commit -m "$(cat <<'EOF'
docs: remove voting feature from roadmap

Removes the "Government type sentiment" future-vision bullet from
purpose.md and the "Future: Voting & NGO Sentiment" section from
data-collection.md. The feature was documented but never designed or
implemented; the project now advertises a focused, scoped product.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 1.5.3: Confirm the commit**

Run:
```bash
git -C E:/polworldmap log -1 --stat
```
Expected: one commit, two files changed (purpose.md, data-collection.md), a small number of deletions.

---

# Phase 2 — Documentation Additions

Intent: fill contributor / security / ops / ADR-convention gaps. No speculative content ADRs.

### Task 2.1: Write `CONTRIBUTING.md`

**Files:**
- Create: `CONTRIBUTING.md`

- [ ] **Step 2.1.1: Create the file with the full content below**

```markdown
# Contributing to funworldmap

Thanks for your interest. funworldmap is an interactive political world map — static frontend, no backend, no accounts. Contributions that keep it fast, accessible, and honest about its data are welcome.

## Local Development

Requirements: Node.js 22, npm 10+.

```bash
git clone https://github.com/granatenudo/funworldmap.git
cd funworldmap
npm ci
npm run dev    # http://localhost:5173
```

Scripts:
- `npm run dev` — Vite dev server with HMR
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the production bundle locally
- `npm run lint` — ESLint
- `tsc -b` — TypeScript build/check
- `npm run test:unit` — Vitest (jsdom environment)
- `npm run test:e2e` — Playwright (two projects: `chromium` DOM, `chromium-gpu` WebGL)
- `npm run update-data` — refresh `src/data/countries.json` from upstream sources

## Pull Request Expectations

Before opening a PR:
- `npm run lint` — zero warnings
- `tsc -b` — zero errors
- `npm run test:unit` — all green
- `npm run test:e2e` — all green
- `npm run build` — succeeds

PR title uses the repo's observed convention: `type(scope): subject`, where `type` is one of `feat`, `fix`, `docs`, `test`, `chore`, `perf`, `refactor`, `revert`. Scope is optional but encouraged.

Keep the PR description focused on *why*. The diff shows *what*.

## Code Style

- Prettier and ESLint are authoritative. Run `npm run format` before committing if in doubt.
- TypeScript is strict. Do not introduce `any` or new `@ts-ignore`.
- Follow the file/folder conventions already in the repo. If a file you're modifying has grown unwieldy, a targeted split in the same PR is welcome.

## Proposing a New Data Source

funworldmap bundles `src/data/countries.json` at build time. The merge pipeline lives in `scripts/`. See `docs/systems/data-collection.md` for the full architecture.

To propose a new source:
1. Prefer sources with CC0 / permissive licenses. Document the license.
2. Add a fetch module under `scripts/sources/` that returns normalized `CountryData`.
3. Register the source key and merge priority. Update `_sources` metadata in the output.
4. Run `npm run update-data` and commit the resulting diff alongside the code change.
5. Every new field must have a `_fieldSources` entry and a `SourceTooltip`-visible source.

Open an issue first if the source brings a new field shape — this helps align on the merge priority before you write the integration.

## Reporting Data Errors

Open an issue with:
- Country (name + ISO cca3)
- Field in question
- Current value shown by funworldmap
- Expected value and the authoritative source

## Security

See `SECURITY.md` for reporting procedure.
```

- [ ] **Step 2.1.2: Verify markdown begins as expected**

Run:
```bash
head -5 CONTRIBUTING.md
```
Expected: the first heading and opening paragraph as written.

### Task 2.2: Write `SECURITY.md`

**Files:**
- Create: `SECURITY.md`

- [ ] **Step 2.2.1: Create the file with the full content below**

```markdown
# Security Policy

funworldmap is a static-site frontend. There is no backend, no user accounts, no user-submitted data. The attack surface is small but not zero.

## In Scope

- Frontend vulnerabilities (XSS, prototype pollution, clickjacking)
- Dependency CVEs reachable via the bundled code paths
- Incidents involving the basemap tile provider that affect this site
- Supply-chain concerns in `package.json` / `package-lock.json`

## Out of Scope

- Social-engineering of GitHub Pages / the custom domain registrar
- Issues in upstream MapLibre GL / React / Vite that are not reproducible here
- Rate limiting of GitHub Pages itself

## Reporting

Email: tobias.ens@docuware.com (subject line starting with `[funworldmap security]`).

This is a best-effort project with no SLA. I aim to acknowledge reports within seven days.

## Disclosure

Ninety-day coordinated disclosure. Credit will be given in the fix commit unless you prefer anonymity.
```

### Task 2.3: Write `docs/ops/runbook.md`

**Files:**
- Create: `docs/ops/runbook.md`

- [ ] **Step 2.3.1: Create the directory**

Run:
```bash
mkdir -p E:/polworldmap/docs/ops
```
Expected: directory created (no error if it already exists).

- [ ] **Step 2.3.2: Create the file with the full content below**

```markdown
# Operations Runbook

Practical guidance for keeping funworldmap running.

## Bandwidth Watch

GitHub Pages soft-caps free bandwidth at ~100 GB/month. Custom domains route through the same limit.

**How to check.** GitHub repo → Insights → Traffic. Daily unique visitors × average page weight (~680 KB gzipped main bundle + basemap tiles). Flag if monthly cumulative approaches 70 GB.

**Response if approaching the cap.**
1. Post a rate-limit advisory banner (extend `BasemapBanner` pattern).
2. Migrate static hosting to Cloudflare Pages (free unlimited bandwidth). Custom-domain DNS can be re-pointed without rebuilding the bundle.
3. Consider deferring any marketing / social push until migration is done.

## Data Freshness

`src/data/countries.json` is bundled at build time from multiple sources.

| Source | Cadence | Status |
|---|---|---|
| REST Countries v3.1 | Quarterly review | Live upstream |
| CIA World Factbook | None — archive frozen Jan 2026 | Read-only |
| world-atlas (Natural Earth 50m) | On npm upstream release | Stable |
| flagcdn.com | Hotlinked at runtime | No-op |

> **Action:** `OWNER_TBD` for quarterly review. First review due 2026-07-17. Replace this line once an owner is assigned.

**Refresh procedure.**
```bash
npm run update-data
git diff src/data/countries.json  # review field-by-field
npm run test:unit && npm run build
git add src/data/countries.json && git commit -m "chore(data): refresh from upstream sources"
```

If the diff is large (>10% of lines changed), bisect by source to find which upstream changed significantly before committing.

## Basemap Degradation

`probeBasemap` runs on map init with a 3s timeout. If the OpenFreeMap Positron CDN fails to respond, `BasemapBanner` surfaces a visible notice. Country polygons remain interactive; only the tile backdrop is unavailable.

**How to confirm.** Open the deployed site in a browser. If `BasemapBanner` is visible for multiple users without a regional network pattern, check OpenFreeMap status (https://openfreemap.org/). Cross-check by opening `https://tiles.openfreemap.org/styles/positron` directly in a browser — if it 5xx's, the CDN is the cause.

**Recovery today.** User-initiated reload via the banner's Retry action. There is no automated failover to a secondary basemap provider; this is tracked as future work (out of scope for the current spec).

## Incident Response (Broken Deploy)

If a `main` commit ships a broken deploy:

1. Open the GitHub Actions `Deploy to GitHub Pages` workflow for the bad SHA. Confirm it published.
2. Revert the commit on `main`:
   ```bash
   git revert <SHA>
   git push origin main
   ```
3. The deploy workflow will re-run on the revert commit and publish the prior good state.
4. Post-mortem: open an issue with the SHA, the symptom, and the revert SHA. If the root cause needs a forward fix, track it separately from the revert.

## Deploy Workflow

`.github/workflows/deploy.yml` builds on every push to `main` and publishes via `actions/deploy-pages`. No manual deploy step. Secrets in use: `VITE_SENTRY_DSN` (optional — the Sentry init is env-gated and no-ops without a DSN).
```

### Task 2.4: Write `docs/adr/README.md`

**Files:**
- Create: `docs/adr/README.md`

- [ ] **Step 2.4.1: Create the directory**

Run:
```bash
mkdir -p E:/polworldmap/docs/adr
```

- [ ] **Step 2.4.2: Create the file with the full content below**

```markdown
# Architecture Decision Records

This directory holds ADRs — short documents recording genuinely load-bearing architectural decisions, especially ones that are being revisited or contested.

## Filing Convention

Filename: `NNNN-short-kebab-slug.md`, where `NNNN` is a four-digit zero-padded sequence number (`0001`, `0002`, …). The next available number wins.

Required sections:
- **Context** — the situation and forces that motivate the decision
- **Decision** — the chosen approach, stated as a present-tense fact
- **Consequences** — what becomes easy, what becomes hard, what's locked in
- **Alternatives** — other paths considered and why they were rejected
- **Status** — one of `Proposed`, `Accepted`, `Superseded by NNNN`, `Deprecated`
- **Date** — ISO 8601 date of the decision

## When to Write an ADR

Good reasons:
- A genuinely load-bearing decision is being made (framework, data layer, deployment target)
- A previously-accepted decision is being revisited
- A tradeoff needs to survive a project handoff

Poor reasons:
- Historical backfill for decisions nobody is contesting
- Documenting every minor library choice
- Replacing inline comments in code

If the decision can live as a paragraph in a system doc under `docs/systems/`, prefer that. ADRs are for decisions that need to be discoverable as decisions.

## Superseding

A superseded ADR is kept in place for historical continuity. The newer ADR's Status line names the superseded record's number; the superseded record's Status is updated to `Superseded by NNNN`.
```

### Task 2.5: Update `README.md` with links

**Files:**
- Modify: `README.md`

- [ ] **Step 2.5.1: Read the current README**

Run:
```bash
cat E:/polworldmap/README.md
```
Note the current structure so the edit fits the existing shape.

- [ ] **Step 2.5.2: Add a "Contributing" link section**

Append (or replace the equivalent existing section) so the README includes a short paragraph near the end:

```markdown
## Contributing

See `CONTRIBUTING.md` for setup, PR expectations, and how to propose a new data source.

## Security

See `SECURITY.md` for reporting procedure.

## Decision Records

Architectural decisions live under `docs/adr/`. See `docs/adr/README.md` for filing conventions.
```

Choose the insertion point that fits the existing flow — typically after the main "What's here" / usage content and before any License footer.

- [ ] **Step 2.5.3: Remove any follow-up-work bullets now covered by `docs/ops/runbook.md`**

If the README mentions "bandwidth watch TBD", "data refresh runbook TBD", or similar future-work bullets that the runbook now addresses, remove them. Leave the README honest about the current state.

### Task 2.6: Update `docs/index.md` reading guide

**Files:**
- Modify: `docs/index.md`

- [ ] **Step 2.6.1: Read the current index**

Run:
```bash
cat E:/polworldmap/docs/index.md
```

- [ ] **Step 2.6.2: Add entries for the new docs**

Add links for:
- `docs/ops/runbook.md` — Operations runbook
- `docs/adr/README.md` — Architecture decision records
- `docs/superpowers/README.md` — Planning conventions (will be created in Phase 3; list it here now, or append in Phase 3 if you prefer to avoid forward references)

Match the existing list style (bullet list, one-line description per link).

### Task 2.7: Verify and commit Phase 2

- [ ] **Step 2.7.1: Link-check new docs**

Run:
```bash
cd E:/polworldmap
grep -nE '\]\((\.\./|\./)?docs/|\]\((\.\./|\./)?CONTRIBUTING|\]\((\.\./|\./)?SECURITY' CONTRIBUTING.md SECURITY.md docs/ops/runbook.md docs/adr/README.md README.md docs/index.md 2>/dev/null
```
Expected: every referenced path should exist on disk. Validate each hit manually if the list is short.

- [ ] **Step 2.7.2: Verify no stray placeholders**

Run:
```bash
cd E:/polworldmap
grep -nE 'TODO|FIXME|XXX|TBD' CONTRIBUTING.md SECURITY.md docs/ops/runbook.md docs/adr/README.md
```
Expected: only one match — the deliberate `OWNER_TBD` call-out in `docs/ops/runbook.md`. Any others must be filled in or removed.

- [ ] **Step 2.7.3: Run lint + tsc + unit + build**

Run:
```bash
cd E:/polworldmap
npm run lint && tsc -b && npm run test:unit && npm run build
```
Expected: all green.

- [ ] **Step 2.7.4: Commit**

Run:
```bash
git -C E:/polworldmap add CONTRIBUTING.md SECURITY.md docs/ops/runbook.md docs/adr/README.md README.md docs/index.md
git -C E:/polworldmap commit -m "$(cat <<'EOF'
docs: add contributor guide, security policy, ops runbook, and ADR convention

Closes the documentation gaps surfaced by the 2026-04-17 assessment:
contributor onboarding, security reporting, operational guidance (bandwidth,
data freshness, basemap degradation), and an ADR filing convention with no
speculative content records.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 3 — Planning Convention

Intent: document the norm that `docs/superpowers/plans/` contains forward specs. No file moves.

### Task 3.1: Write `docs/superpowers/README.md`

**Files:**
- Create: `docs/superpowers/README.md`

- [ ] **Step 3.1.1: Create the file with the full content below**

```markdown
# Superpowers Workspace

This directory holds planning and design artifacts used by the repo's agentic workflow.

## Layout

- `plans/` — **forward implementation plans** written before or alongside active work. Each plan is a checkbox-driven task list with exact file paths and code. Named `YYYY-MM-DD-<slug>.md`.
- `specs/` — **design documents** that precede a plan. Output of a brainstorming pass. Named `YYYY-MM-DD-<topic>-design.md`.

## Plans Are Forward-Looking

Files under `plans/` describe work that has not yet landed or is in active progress. They are not retrospectives. If you want to document work after the fact, do one of:
- Update the relevant system doc under `docs/systems/`
- Open an ADR under `docs/adr/` if a genuinely load-bearing decision was made
- Add a paragraph to the commit message or PR description

A document that starts with "We shipped X" does not belong in `plans/`.

## Checklist for a Well-Formed Plan

- Header names the required sub-skill (`superpowers:subagent-driven-development` or `superpowers:executing-plans`)
- Goal is one sentence
- Architecture is two to three sentences
- Tech Stack names the load-bearing libraries
- `Scope out` section lists what this plan does NOT cover
- File Structure section enumerates every file to create or modify
- Pre-flight section verifies a clean starting state
- Tasks use `- [ ]` checkboxes and are scoped to 2-5 minutes per step
- Code steps include the actual code, not placeholders
- Commands include expected output
- Each task ends with a commit step

## Checklist for a Well-Formed Spec

- Dated, with a Status line (Draft / Accepted / Superseded)
- Context, Goals, Non-Goals explicit
- Phases or components enumerated with sizes
- Verification criteria for each component
- Risks / watch-outs surfaced
- Out-of-scope items called out

## Executing Plans

Plans are executed via `superpowers:subagent-driven-development` (fresh subagent per task, with review between) or `superpowers:executing-plans` (inline execution with checkpoints). Pick based on the plan's size and the caller's preference.
```

### Task 3.2: Verify and commit Phase 3

- [ ] **Step 3.2.1: Confirm no file moves were performed**

Run:
```bash
git -C E:/polworldmap status
```
Expected: only `docs/superpowers/README.md` is new; nothing under `plans/` has moved.

- [ ] **Step 3.2.2: Commit**

Run:
```bash
git -C E:/polworldmap add docs/superpowers/README.md
git -C E:/polworldmap commit -m "$(cat <<'EOF'
docs: add superpowers planning convention

Plans under docs/superpowers/plans/ are forward specs; retrospectives
belong in system docs or ADRs. Checklists for well-formed plans and
specs are included.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 4 — Test Infrastructure

Intent: add hook unit tests; switch e2e to run against the preview of the built bundle.

**Prerequisite check:** Vitest is configured with `environment: 'node'` (`vite.config.ts:17`). Hook tests that call `renderHook` need the JSDOM environment. Task 4.1 adjusts the config.

### Task 4.1: Add a JSDOM environment for hook tests

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json` (new devDependencies: `jsdom` + `@testing-library/react`)

- [ ] **Step 4.1.1: Install testing-library and jsdom**

Run:
```bash
cd E:/polworldmap
npm install --save-dev @testing-library/react@^16 jsdom@^25
```
Expected: both packages added to `devDependencies`.

- [ ] **Step 4.1.2: Switch Vitest environment to jsdom**

Edit `vite.config.ts` test block:

```typescript
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: ['e2e/**', 'node_modules/**'],
  },
```

- [ ] **Step 4.1.3: Verify existing tests still pass under jsdom**

Run:
```bash
npm run test:unit
```
Expected: the existing `parseHash`, `initSentry`, `probeBasemap` tests all pass under the new environment. If any fail, diagnose (typically a missing `window` reference previously mocked) before continuing.

### Task 4.2: Unit test for `useSelectedCountry`

**Files:**
- Create: `src/hooks/__tests__/useSelectedCountry.test.ts`
- Reference: `src/hooks/useSelectedCountry.ts`, `src/lib/hashState.ts`

- [ ] **Step 4.2.1: Write the test file**

Create the file with:

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSelectedCountry } from '../useSelectedCountry'
import type { CountryData } from '../../lib/types'

function makeCountry(cca3: string, ccn3: string, name: string): CountryData {
  return {
    cca3,
    ccn3,
    cca2: cca3.slice(0, 2),
    name: { common: name, official: name },
    capital: [],
    region: 'Europe',
    subregion: '',
    languages: {},
    currencies: {},
    timezones: [],
    borders: [],
    flag: '',
    flagAlt: '',
    population: 0,
    area: 0,
    unMember: true,
    independent: true,
    governmentType: '',
    _fieldSources: {},
  } as unknown as CountryData
}

const FRA = makeCountry('FRA', '250', 'France')
const DEU = makeCountry('DEU', '276', 'Germany')

function makeByCca3() {
  const m = new Map<string, CountryData>()
  m.set('FRA', FRA)
  m.set('DEU', DEU)
  return m
}

describe('useSelectedCountry', () => {
  beforeEach(() => {
    window.location.hash = ''
  })

  afterEach(() => {
    window.location.hash = ''
  })

  it('returns null selected and null compareWith when hash is empty', () => {
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    expect(result.current.selected).toBeNull()
    expect(result.current.compareWith).toBeNull()
  })

  it('resolves selected from an initial hash', () => {
    window.location.hash = '#FRA'
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    expect(result.current.selected).toBe(FRA)
    expect(result.current.compareWith).toBeNull()
  })

  it('resolves selected + compareWith from a two-code hash', () => {
    window.location.hash = '#FRA,DEU'
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    expect(result.current.selected).toBe(FRA)
    expect(result.current.compareWith).toBe(DEU)
  })

  it('silently clears an invalid selected code and resets the hash', () => {
    window.location.hash = '#ZZZ'
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    expect(result.current.selected).toBeNull()
    expect(result.current.compareWith).toBeNull()
    expect(window.location.hash).toBe('')
  })

  it('select() writes uppercased code to hash and updates selected on hashchange', () => {
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    act(() => {
      result.current.select('fra')
    })
    expect(window.location.hash).toBe('#FRA')
    expect(result.current.selected).toBe(FRA)
  })

  it('select() clears any existing compareWith', () => {
    window.location.hash = '#FRA,DEU'
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    expect(result.current.compareWith).toBe(DEU)
    act(() => {
      result.current.select('DEU')
    })
    expect(result.current.selected).toBe(DEU)
    expect(result.current.compareWith).toBeNull()
  })

  it('compareSelect() is a no-op when nothing is selected', () => {
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    act(() => {
      result.current.compareSelect('FRA')
    })
    expect(window.location.hash).toBe('')
    expect(result.current.selected).toBeNull()
  })

  it('compareSelect() pairs the new code with the existing selected', () => {
    window.location.hash = '#FRA'
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    act(() => {
      result.current.compareSelect('deu')
    })
    expect(window.location.hash).toBe('#FRA,DEU')
    expect(result.current.compareWith).toBe(DEU)
  })

  it('clearCompare() drops compareWith and leaves selected intact', () => {
    window.location.hash = '#FRA,DEU'
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    act(() => {
      result.current.clearCompare()
    })
    expect(result.current.selected).toBe(FRA)
    expect(result.current.compareWith).toBeNull()
    expect(window.location.hash).toBe('#FRA')
  })

  it('deselect() clears both and empties the hash', () => {
    window.location.hash = '#FRA,DEU'
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    act(() => {
      result.current.deselect()
    })
    expect(result.current.selected).toBeNull()
    expect(result.current.compareWith).toBeNull()
    expect(window.location.hash).toBe('')
  })
})
```

- [ ] **Step 4.2.2: Run the test and verify it passes**

Run:
```bash
npm run test:unit -- src/hooks/__tests__/useSelectedCountry.test.ts
```
Expected: 10 passing tests. If any fail, do not modify the hook yet — read the failure carefully. The hook's current behavior is the spec here. If a test expectation is wrong, fix the test.

### Task 4.3: Unit test for `useCountryData`

**Files:**
- Create: `src/hooks/__tests__/useCountryData.test.ts`

- [ ] **Step 4.3.1: Write the test file**

```typescript
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCountryData } from '../useCountryData'

describe('useCountryData', () => {
  it('returns a non-empty countries array', () => {
    const { result } = renderHook(() => useCountryData())
    expect(result.current.countries.length).toBeGreaterThan(100)
  })

  it('byNumeric maps ccn3 to country', () => {
    const { result } = renderHook(() => useCountryData())
    const france = result.current.byNumeric.get('250')
    expect(france).toBeDefined()
    expect(france?.cca3).toBe('FRA')
  })

  it('byCca3 maps cca3 to country', () => {
    const { result } = renderHook(() => useCountryData())
    const germany = result.current.byCca3.get('DEU')
    expect(germany).toBeDefined()
    expect(germany?.name.common).toBe('Germany')
  })

  it('byNumeric and byCca3 have identical sizes', () => {
    const { result } = renderHook(() => useCountryData())
    expect(result.current.byNumeric.size).toBe(result.current.byCca3.size)
  })

  it('sources registry is present and populated', () => {
    const { result } = renderHook(() => useCountryData())
    expect(result.current.sources).toBeDefined()
    expect(Object.keys(result.current.sources).length).toBeGreaterThan(0)
  })

  it('is stable across rerenders (memoized)', () => {
    const { result, rerender } = renderHook(() => useCountryData())
    const first = result.current
    rerender()
    expect(result.current.countries).toBe(first.countries)
    expect(result.current.byCca3).toBe(first.byCca3)
  })
})
```

- [ ] **Step 4.3.2: Run and verify**

Run:
```bash
npm run test:unit -- src/hooks/__tests__/useCountryData.test.ts
```
Expected: 6 passing tests.

### Task 4.4: Unit test for `useCountrySearch`

**Files:**
- Create: `src/hooks/__tests__/useCountrySearch.test.ts`

- [ ] **Step 4.4.1: Write the test file**

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCountrySearch } from '../useCountrySearch'
import type { CountryData } from '../../lib/types'

function c(cca3: string, ccn3: string, common: string, capital: string[] = []): CountryData {
  return {
    cca3,
    ccn3,
    cca2: cca3.slice(0, 2),
    name: { common, official: common },
    capital,
    region: 'Europe',
    subregion: '',
    languages: {},
    currencies: {},
    timezones: [],
    borders: [],
    flag: '',
    flagAlt: '',
    population: 0,
    area: 0,
    unMember: true,
    independent: true,
    governmentType: '',
    _fieldSources: {},
  } as unknown as CountryData
}

const dataset: CountryData[] = [
  c('FRA', '250', 'France', ['Paris']),
  c('DEU', '276', 'Germany', ['Berlin']),
  c('ESP', '724', 'Spain', ['Madrid']),
  c('ITA', '380', 'Italy', ['Rome']),
]

describe('useCountrySearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty results for empty query', () => {
    const { result } = renderHook(() => useCountrySearch(dataset, ''))
    expect(result.current).toEqual([])
  })

  it('debounces by 150ms before producing results', () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useCountrySearch(dataset, query),
      { initialProps: { query: '' } },
    )
    rerender({ query: 'Fra' })
    expect(result.current).toEqual([])
    act(() => {
      vi.advanceTimersByTime(149)
    })
    expect(result.current).toEqual([])
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.length).toBeGreaterThan(0)
  })

  it('matches country names (common) above 0.4 threshold', () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useCountrySearch(dataset, query),
      { initialProps: { query: '' } },
    )
    rerender({ query: 'France' })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current[0]?.country.cca3).toBe('FRA')
  })

  it('matches capitals', () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useCountrySearch(dataset, query),
      { initialProps: { query: '' } },
    )
    rerender({ query: 'Madrid' })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current[0]?.country.cca3).toBe('ESP')
  })

  it('matches cca3 codes', () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useCountrySearch(dataset, query),
      { initialProps: { query: '' } },
    )
    rerender({ query: 'ITA' })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current[0]?.country.cca3).toBe('ITA')
  })

  it('caps results at 8', () => {
    const large: CountryData[] = Array.from({ length: 20 }, (_, i) =>
      c(`C${i.toString().padStart(2, '0')}`, `${i}`, `Country${i}`),
    )
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useCountrySearch(large, query),
      { initialProps: { query: '' } },
    )
    rerender({ query: 'Country' })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current.length).toBeLessThanOrEqual(8)
  })

  it('clears results when query becomes empty', () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useCountrySearch(dataset, query),
      { initialProps: { query: 'France' } },
    )
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current.length).toBeGreaterThan(0)
    rerender({ query: '' })
    expect(result.current).toEqual([])
  })
})
```

- [ ] **Step 4.4.2: Run and verify**

Run:
```bash
npm run test:unit -- src/hooks/__tests__/useCountrySearch.test.ts
```
Expected: 7 passing tests.

### Task 4.5: Unit test for `useTheme`

**Files:**
- Create: `src/hooks/__tests__/useTheme.test.ts`

- [ ] **Step 4.5.1: Write the test file**

```typescript
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from '../useTheme'

function mockMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('dark') ? prefersDark : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    mockMatchMedia(false)
  })

  it('defaults to "system" with light resolved when no stored preference and system is light', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('system')
    expect(result.current.resolved).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('defaults to "system" with dark resolved when system prefers dark', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('system')
    expect(result.current.resolved).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('reads stored preference on mount', () => {
    localStorage.setItem('funworldmap-theme', 'dark')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(result.current.resolved).toBe('dark')
  })

  it('cycle() moves light → dark → system → light and persists', () => {
    localStorage.setItem('funworldmap-theme', 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')

    act(() => result.current.cycle())
    expect(result.current.theme).toBe('dark')
    expect(localStorage.getItem('funworldmap-theme')).toBe('dark')

    act(() => result.current.cycle())
    expect(result.current.theme).toBe('system')
    expect(localStorage.getItem('funworldmap-theme')).toBe('system')

    act(() => result.current.cycle())
    expect(result.current.theme).toBe('light')
    expect(localStorage.getItem('funworldmap-theme')).toBe('light')
  })

  it('applies the dark class on <html> when resolved is dark', () => {
    localStorage.setItem('funworldmap-theme', 'dark')
    renderHook(() => useTheme())
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes the dark class when switching to light', () => {
    localStorage.setItem('funworldmap-theme', 'dark')
    const { result } = renderHook(() => useTheme())
    act(() => result.current.cycle()) // dark → system (light underlying)
    act(() => result.current.cycle()) // system → light
    expect(result.current.resolved).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
```

- [ ] **Step 4.5.2: Run and verify**

Run:
```bash
npm run test:unit -- src/hooks/__tests__/useTheme.test.ts
```
Expected: 6 passing tests.

### Task 4.6: Switch e2e webServer to preview the built bundle

**Files:**
- Modify: `playwright.config.ts`

**Context:** Recent commit `3c9ab21` wired the `funworldmap.com` custom domain. The site is served from the root path, so the prior base-path concern that caused the `vite preview` revert no longer applies. Current `vite.config.ts` has `base: '/'` unconditionally; no conditional base-path work is needed.

- [ ] **Step 4.6.1: Replace the `webServer` block**

Open `playwright.config.ts`. Replace the entire `webServer` block (current lines 46–56) with:

```typescript
  webServer: {
    command: 'npm run build && npm run preview -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
```

Remove the stale `env: { GITHUB_ACTIONS: '' }` block and its comment — it referenced behavior that no longer exists in `vite.config.ts`.

- [ ] **Step 4.6.2: Scope-out gate**

If running e2e against preview surfaces failures that require restructuring asset imports, router base, or downstream code (beyond `playwright.config.ts`), **stop this task, revert the change, and open a follow-up spec.** Do not sink more than one working day into this sub-task.

- [ ] **Step 4.6.3: Run e2e locally**

Run:
```bash
cd E:/polworldmap
npm run test:e2e
```
Expected: all projects (`chromium`, `chromium-gpu`) pass. First run will build the bundle (~30s) then run tests. Subsequent runs reuse the server.

If a small number of tests fail with timing differences (no HMR, no source maps in preview), fix them by adjusting the test (not the app). Typical fixes: a `waitForSelector` that assumed dev-mode speed needs a longer timeout, or a `waitForURL` that races against the slower initial load.

### Task 4.7: Verify and commit Phase 4

- [ ] **Step 4.7.1: Run full verification**

Run:
```bash
cd E:/polworldmap
npm run lint && tsc -b && npm run test:unit && npm run build && npm run test:e2e
```
Expected: all green.

- [ ] **Step 4.7.2: Commit the test infrastructure**

Run:
```bash
git -C E:/polworldmap add package.json package-lock.json vite.config.ts playwright.config.ts src/hooks/__tests__/
git -C E:/polworldmap commit -m "$(cat <<'EOF'
test: add hook unit tests and switch e2e to preview bundle

Adds ~30 unit tests across useSelectedCountry, useCountryData,
useCountrySearch, and useTheme. Switches the Vitest environment to
jsdom to support renderHook. Switches the Playwright webServer from
vite dev to a vite preview of the built bundle so e2e exercises the
production artifact.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 5 — WorldMap Refactor

Intent: split `src/components/WorldMap.tsx` (786 LOC) into three lib modules and six hooks with a `useMap()` shared-context pattern. Behavior-preserving.

**Execution approach:** land each extraction as a separate sub-commit on this branch. After all extractions, one final commit updates `WorldMap.tsx` to consume the new modules. The final `WorldMap.tsx` lands around 120–170 LOC.

### Task 5.1: Extract the palette constants

**Files:**
- Create: `src/lib/mapPalette.ts`
- Modify: `src/components/WorldMap.tsx:29-34`

- [ ] **Step 5.1.1: Create `src/lib/mapPalette.ts`**

```typescript
/** Warm Explorer palette — teal for exploration, coral for selection. */
export const TEAL = '#14b8a6'
export const TEAL_LIGHT = '#5eead4'
export const TEAL_DIM = '#0d9488'
export const CORAL = '#f43f5e'
export const CORAL_LIGHT = '#fb7185'
```

- [ ] **Step 5.1.2: Replace the inline constants in `WorldMap.tsx`**

Delete the inline constants (`TEAL`, `TEAL_LIGHT`, `TEAL_DIM`, `CORAL`, `CORAL_LIGHT` at lines 29–34) and import from the new module:

```typescript
import { TEAL, TEAL_LIGHT, TEAL_DIM, CORAL, CORAL_LIGHT } from '../lib/mapPalette'
```

- [ ] **Step 5.1.3: Verify and commit**

Run:
```bash
cd E:/polworldmap
npm run lint && tsc -b && npm run test:unit
```
Expected: green.

```bash
git -C E:/polworldmap add src/lib/mapPalette.ts src/components/WorldMap.tsx
git -C E:/polworldmap commit -m "refactor(map): extract palette constants to mapPalette.ts"
```

### Task 5.2: Extract the ResetViewControl

**Files:**
- Create: `src/lib/resetViewControl.ts`
- Modify: `src/components/WorldMap.tsx:47-112`

- [ ] **Step 5.2.1: Create `src/lib/resetViewControl.ts`**

Move the `prefersReducedMotion` function (lines 47–49) and the `ResetViewControl` class (lines 51–112) into the new file:

```typescript
import maplibregl from 'maplibre-gl'
import { DEFAULT_CENTER, DEFAULT_ZOOM, DEFAULT_PITCH } from './mapStyles'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Custom MapLibre control — reset to world view. */
export class ResetViewControl implements maplibregl.IControl {
  _container?: HTMLDivElement

  onAdd(map: maplibregl.Map): HTMLElement {
    this._container = document.createElement('div')
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group'

    const button = document.createElement('button')
    button.type = 'button'
    button.title = 'Reset to world view'
    button.setAttribute('aria-label', 'Reset to world view')
    button.style.cssText = 'display:flex;align-items:center;justify-content:center;cursor:pointer;'

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('width', '22')
    svg.setAttribute('height', '22')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '2')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', '12')
    circle.setAttribute('cy', '12')
    circle.setAttribute('r', '7')

    const meridian = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
    meridian.setAttribute('cx', '12')
    meridian.setAttribute('cy', '12')
    meridian.setAttribute('rx', '3')
    meridian.setAttribute('ry', '7')

    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    arrow.setAttribute('d', 'M20 4 L20 9 L15 9')

    svg.appendChild(circle)
    svg.appendChild(meridian)
    svg.appendChild(arrow)
    button.appendChild(svg)

    button.addEventListener('click', () => {
      map.flyTo({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: prefersReducedMotion() ? 0 : DEFAULT_PITCH,
        bearing: 0,
        duration: prefersReducedMotion() ? 0 : 1400,
      })
    })

    this._container.appendChild(button)
    return this._container
  }

  onRemove(): void {
    this._container?.remove()
  }
}

export { prefersReducedMotion }
```

- [ ] **Step 5.2.2: Remove the moved code from `WorldMap.tsx`**

Delete lines 47–112 in the original `WorldMap.tsx` (the `prefersReducedMotion` function and the `ResetViewControl` class) and add an import:

```typescript
import { ResetViewControl, prefersReducedMotion } from '../lib/resetViewControl'
```

- [ ] **Step 5.2.3: Verify and commit**

```bash
npm run lint && tsc -b && npm run test:unit
git -C E:/polworldmap add src/lib/resetViewControl.ts src/components/WorldMap.tsx
git -C E:/polworldmap commit -m "refactor(map): extract ResetViewControl to lib/resetViewControl.ts"
```

### Task 5.3: Extract GeoJSON loader + antimeridian fix

**Files:**
- Create: `src/lib/loadCountryGeojson.ts`
- Create: `src/lib/__tests__/loadCountryGeojson.test.ts`
- Modify: `src/components/WorldMap.tsx:131-177`

- [ ] **Step 5.3.1: Create the loader module**

```typescript
import type * as GeoJSON from 'geojson'

/** Load the world-atlas 50m countries topology and return a normalized GeoJSON
 *  FeatureCollection with antimeridian wrapping fixed for non-polar polygons.
 *  Each feature has its numeric id promoted to `properties.id` (string). */
export async function loadCountryGeojson(): Promise<GeoJSON.FeatureCollection> {
  const [topojsonClient, worldAtlas] = await Promise.all([
    import('topojson-client'),
    import('world-atlas/countries-50m.json'),
  ])

  const topology = worldAtlas.default as unknown as TopoJSON.Topology
  const geojson = topojsonClient.feature(
    topology,
    topology.objects.countries,
  ) as GeoJSON.FeatureCollection

  for (const feature of geojson.features) {
    if (feature.id != null && feature.properties) {
      feature.properties.id = String(feature.id)
    }
  }

  fixAntimeridian(geojson)
  return geojson
}

/** Shift any non-polar polygon that straddles the antimeridian into a
 *  continuous 0..360 longitude range so MapLibre renders it without
 *  drawing horizontal slivers across the map. */
export function fixAntimeridian(collection: GeoJSON.FeatureCollection): void {
  for (const feature of collection.features) {
    const polygons =
      feature.geometry.type === 'MultiPolygon'
        ? (feature.geometry as GeoJSON.MultiPolygon).coordinates
        : feature.geometry.type === 'Polygon'
          ? [(feature.geometry as GeoJSON.Polygon).coordinates]
          : []

    for (const polygon of polygons) {
      let hasHighPositive = false
      let hasHighNegative = false
      let touchesPole = false
      for (const ring of polygon) {
        for (const coord of ring) {
          if (coord[0] > 170) hasHighPositive = true
          if (coord[0] < -170) hasHighNegative = true
          if (coord[1] <= -85 || coord[1] >= 85) touchesPole = true
        }
      }
      if (hasHighPositive && hasHighNegative && !touchesPole) {
        for (const ring of polygon) {
          for (const coord of ring) {
            if (coord[0] < 0) coord[0] += 360
          }
        }
      }
    }
  }
}
```

- [ ] **Step 5.3.2: Create the test file**

```typescript
import { describe, expect, it } from 'vitest'
import { fixAntimeridian } from '../loadCountryGeojson'
import type * as GeoJSON from 'geojson'

function makePolygonFeature(coords: [number, number][][]): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: coords },
  }
}

describe('fixAntimeridian', () => {
  it('shifts negative longitudes into 0..360 for non-polar spanning polygons', () => {
    const f = makePolygonFeature([
      [
        [179, 0],
        [-179, 0],
        [-179, 1],
        [179, 1],
        [179, 0],
      ],
    ])
    const collection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [f] }
    fixAntimeridian(collection)
    const ring = (f.geometry as GeoJSON.Polygon).coordinates[0]
    const longitudes = ring.map((c) => c[0])
    expect(longitudes).toEqual([179, 181, 181, 179, 179])
  })

  it('does NOT shift polar polygons that touch -85 or +85', () => {
    const f = makePolygonFeature([
      [
        [179, 89],
        [-179, 89],
        [-179, 90],
        [179, 90],
        [179, 89],
      ],
    ])
    const collection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [f] }
    fixAntimeridian(collection)
    const ring = (f.geometry as GeoJSON.Polygon).coordinates[0]
    const longitudes = ring.map((c) => c[0])
    expect(longitudes).toEqual([179, -179, -179, 179, 179])
  })

  it('is a no-op for polygons that do not span the antimeridian', () => {
    const f = makePolygonFeature([
      [
        [-10, 40],
        [10, 40],
        [10, 50],
        [-10, 50],
        [-10, 40],
      ],
    ])
    const before = JSON.stringify(f.geometry)
    const collection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [f] }
    fixAntimeridian(collection)
    expect(JSON.stringify(f.geometry)).toBe(before)
  })
})
```

- [ ] **Step 5.3.3: Run the test**

```bash
npm run test:unit -- src/lib/__tests__/loadCountryGeojson.test.ts
```
Expected: 3 passing tests.

- [ ] **Step 5.3.4: Use the loader in `WorldMap.tsx`**

In `WorldMap.tsx`, delete lines 131–177 (the inline topojson import, feature-id normalization, and antimeridian fix blocks). Replace with a call to the new loader inside the existing `addCountryLayers` callback:

```typescript
const addCountryLayers = useCallback(async (map: maplibregl.Map) => {
  const geojson = await loadCountryGeojson()
  // ... rest of addCountryLayers follows unchanged
```

Add the import at the top:

```typescript
import { loadCountryGeojson } from '../lib/loadCountryGeojson'
```

- [ ] **Step 5.3.5: Verify and commit**

```bash
npm run lint && tsc -b && npm run test:unit && npm run build
git -C E:/polworldmap add src/lib/loadCountryGeojson.ts src/lib/__tests__/loadCountryGeojson.test.ts src/components/WorldMap.tsx
git -C E:/polworldmap commit -m "refactor(map): extract country geojson loader with antimeridian fix"
```

### Task 5.4: Extract layer definition factories

**Files:**
- Create: `src/lib/mapLayers.ts`
- Modify: `src/components/WorldMap.tsx:179-352` (layer addition blocks)

- [ ] **Step 5.4.1: Create `src/lib/mapLayers.ts`**

```typescript
import type maplibregl from 'maplibre-gl'
import {
  SATELLITE_TILES,
  SATELLITE_ATTRIBUTION,
  TERRAIN_TILES,
  TERRAIN_ATTRIBUTION,
} from './mapStyles'
import { TEAL, TEAL_DIM, CORAL } from './mapPalette'

const EMPTY_FILTER: maplibregl.FilterSpecification = ['==', ['get', 'id'], '']

/** Add all non-country raster/DEM sources the map needs. */
export function addRasterSources(map: maplibregl.Map): void {
  map.addSource('satellite', {
    type: 'raster',
    tiles: [SATELLITE_TILES],
    tileSize: 256,
    attribution: SATELLITE_ATTRIBUTION,
  })
  map.addLayer({
    id: 'satellite-layer',
    type: 'raster',
    source: 'satellite',
    layout: { visibility: 'none' },
  })
  map.addSource('terrain-dem', {
    type: 'raster-dem',
    tiles: [TERRAIN_TILES],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 15,
    attribution: TERRAIN_ATTRIBUTION,
  })
}

/** Add the country polygon source (caller supplies the fetched geojson). */
export function addCountrySource(map: maplibregl.Map, geojson: GeoJSON.FeatureCollection): void {
  map.addSource('countries', {
    type: 'geojson',
    data: geojson,
    promoteId: 'id',
  })
}

/** Add the base fill and border layers. */
export function addBaseCountryLayers(map: maplibregl.Map): void {
  map.addLayer({
    id: 'country-fill',
    type: 'fill',
    source: 'countries',
    paint: {
      'fill-color': TEAL,
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.28,
        0.05,
      ],
    },
  })

  map.addLayer({
    id: 'country-borders',
    type: 'line',
    source: 'countries',
    paint: { 'line-color': '#334155', 'line-width': 0.5, 'line-opacity': 0.4 },
  })
}

/** Add hover / extrusion overlays for the currently hovered country. */
export function addHoverLayers(map: maplibregl.Map): void {
  map.addLayer({
    id: 'country-hover-border',
    type: 'line',
    source: 'countries',
    paint: { 'line-color': TEAL, 'line-width': 2, 'line-opacity': 0.6 },
    filter: EMPTY_FILTER,
  })

  map.addLayer({
    id: 'country-extrusion',
    type: 'fill-extrusion',
    source: 'countries',
    paint: {
      'fill-extrusion-color': TEAL,
      'fill-extrusion-height': 60000,
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.65,
    },
    filter: EMPTY_FILTER,
  })
}

/** Add the selection layer stack (fill / border / glow / extrusion). */
export function addSelectionLayers(map: maplibregl.Map): void {
  map.addLayer({
    id: 'country-selected-glow',
    type: 'line',
    source: 'countries',
    paint: { 'line-color': CORAL, 'line-width': 10, 'line-blur': 5, 'line-opacity': 0.3 },
    filter: EMPTY_FILTER,
  })
  map.addLayer({
    id: 'country-selected',
    type: 'fill',
    source: 'countries',
    paint: { 'fill-color': CORAL, 'fill-opacity': 0.32 },
    filter: EMPTY_FILTER,
  })
  map.addLayer({
    id: 'country-selected-border',
    type: 'line',
    source: 'countries',
    paint: { 'line-color': CORAL, 'line-width': 2.5 },
    filter: EMPTY_FILTER,
  })
  map.addLayer({
    id: 'country-selected-extrusion',
    type: 'fill-extrusion',
    source: 'countries',
    paint: {
      'fill-extrusion-color': CORAL,
      'fill-extrusion-height': 80000,
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.55,
    },
    filter: EMPTY_FILTER,
  })
}

/** Add the compare layer stack (same shape as selection, using teal-dim). */
export function addCompareLayers(map: maplibregl.Map): void {
  map.addLayer({
    id: 'country-compare-glow',
    type: 'line',
    source: 'countries',
    paint: { 'line-color': TEAL_DIM, 'line-width': 10, 'line-blur': 5, 'line-opacity': 0.3 },
    filter: EMPTY_FILTER,
  })
  map.addLayer({
    id: 'country-compare-fill',
    type: 'fill',
    source: 'countries',
    paint: { 'fill-color': TEAL_DIM, 'fill-opacity': 0.32 },
    filter: EMPTY_FILTER,
  })
  map.addLayer({
    id: 'country-compare-border',
    type: 'line',
    source: 'countries',
    paint: { 'line-color': TEAL_DIM, 'line-width': 2.5 },
    filter: EMPTY_FILTER,
  })
  map.addLayer({
    id: 'country-compare-extrusion',
    type: 'fill-extrusion',
    source: 'countries',
    paint: {
      'fill-extrusion-color': TEAL_DIM,
      'fill-extrusion-height': 80000,
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.55,
    },
    filter: EMPTY_FILTER,
  })
}

/** Apply the warm directional lighting. */
export function applyWarmLighting(map: maplibregl.Map): void {
  map.setLight({
    anchor: 'viewport',
    position: [1.5, 210, 30],
    intensity: 0.3,
  })
}

export { EMPTY_FILTER }
```

- [ ] **Step 5.4.2: Use the factories in `WorldMap.tsx`**

Replace lines 179–352 (from `// Satellite raster source` through the `setLight` call) with sequential factory calls:

```typescript
import {
  addRasterSources,
  addCountrySource,
  addBaseCountryLayers,
  addHoverLayers,
  addSelectionLayers,
  addCompareLayers,
  applyWarmLighting,
} from '../lib/mapLayers'

// ... inside addCountryLayers:
const geojson = await loadCountryGeojson()
addRasterSources(map)
addCountrySource(map, geojson)
addBaseCountryLayers(map)
addHoverLayers(map)
addSelectionLayers(map)
addCompareLayers(map)
applyWarmLighting(map)
// ... rest of addCountryLayers (hover/click handlers) follows unchanged
```

- [ ] **Step 5.4.3: Verify and commit**

```bash
npm run lint && tsc -b && npm run test:unit && npm run build && npm run test:e2e
git -C E:/polworldmap add src/lib/mapLayers.ts src/components/WorldMap.tsx
git -C E:/polworldmap commit -m "refactor(map): extract layer factories to mapLayers.ts"
```

If e2e surfaces any visual regression, stop — the factory extraction should be byte-equivalent. Revert and diff carefully.

### Task 5.5: Add the `useMap` context provider

**Files:**
- Create: `src/hooks/useMap.tsx`

- [ ] **Step 5.5.1: Create the context module**

```typescript
import { createContext, useContext, useRef, type ReactNode, type MutableRefObject } from 'react'
import type maplibregl from 'maplibre-gl'

interface MapRefs {
  mapRef: MutableRefObject<maplibregl.Map | null>
  hoveredRef: MutableRefObject<string | null>
  tooltipRef: MutableRefObject<HTMLDivElement | null>
}

const MapContext = createContext<MapRefs | null>(null)

export function MapProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const hoveredRef = useRef<string | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  return (
    <MapContext.Provider value={{ mapRef, hoveredRef, tooltipRef }}>
      {children}
    </MapContext.Provider>
  )
}

export function useMap(): MapRefs {
  const ctx = useContext(MapContext)
  if (!ctx) throw new Error('useMap must be used inside <MapProvider>')
  return ctx
}
```

- [ ] **Step 5.5.2: Verify it compiles**

```bash
tsc -b
```
Expected: no errors. No behavior change yet — this is a scaffold for the next tasks.

### Task 5.6: Extract `useMapInstance` hook

**Files:**
- Create: `src/hooks/useMapInstance.ts`
- Create: `src/hooks/__tests__/useMapInstance.test.tsx`
- Modify: `src/components/WorldMap.tsx` (init/cleanup effect)

- [ ] **Step 5.6.1: Create `src/hooks/useMapInstance.ts`**

```typescript
import { useEffect, useState, type RefObject } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  BASEMAP_STYLE,
  BASEMAP_LOAD_TIMEOUT_MS,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  DEFAULT_PITCH,
  MIN_ZOOM,
  MAX_ZOOM,
  MAX_PITCH,
} from '../lib/mapStyles'
import { probeBasemap } from '../lib/probeBasemap'
import { ResetViewControl, prefersReducedMotion } from '../lib/resetViewControl'
import { useMap } from './useMap'

export type MapErrorReason = 'timeout' | 'style' | 'country-data'
const BASEMAP_PROBE_TIMEOUT_MS = 3_000

interface UseMapInstanceOptions {
  containerRef: RefObject<HTMLDivElement | null>
  onLoad: (map: maplibregl.Map) => Promise<void> | void
}

interface UseMapInstanceResult {
  supported: boolean
  loaded: boolean
  mapError: MapErrorReason | null
  basemapDegraded: boolean
  setMapError: (reason: MapErrorReason) => void
}

export function useMapInstance({
  containerRef,
  onLoad,
}: UseMapInstanceOptions): UseMapInstanceResult {
  const { mapRef, tooltipRef } = useMap()
  const [supported, setSupported] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [mapError, setMapErrorState] = useState<MapErrorReason | null>(null)
  const [basemapDegraded, setBasemapDegraded] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    let cancelled = false
    probeBasemap(BASEMAP_STYLE, BASEMAP_PROBE_TIMEOUT_MS).then((result) => {
      if (cancelled) return
      if (result === 'fail') setBasemapDegraded(true)
    })

    const reducedMotion = prefersReducedMotion()

    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: BASEMAP_STYLE,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: reducedMotion ? 0 : DEFAULT_PITCH,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        maxPitch: MAX_PITCH,
        attributionControl: false,
      })
    } catch {
      setSupported(false)
      return
    }

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.addControl(new ResetViewControl(), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    mapRef.current = map

    const tooltip = document.createElement('div')
    tooltip.className = 'country-tooltip'
    containerRef.current!.parentElement!.appendChild(tooltip)
    tooltipRef.current = tooltip

    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__funworldmap_map = map
    }

    const watchdog = window.setTimeout(() => {
      setMapErrorState((prev) => prev ?? 'timeout')
    }, BASEMAP_LOAD_TIMEOUT_MS)

    map.on('load', () => {
      window.clearTimeout(watchdog)
      map.setProjection({ type: 'globe' })
      map.scrollZoom.setZoomRate(1 / 150)
      Promise.resolve(onLoad(map))
        .then(() => setLoaded(true))
        .catch((err: unknown) => {
          console.error(err)
          setMapErrorState((prev) => prev ?? 'country-data')
        })
    })

    map.on('error', (e) => {
      console.warn('Map error:', e.error?.message || e)
      setMapErrorState((prev) => {
        // Don't overwrite a real failure with a transient post-load tile issue.
        if (prev !== null) return prev
        return loaded ? prev : 'style'
      })
    })

    return () => {
      cancelled = true
      window.clearTimeout(watchdog)
      tooltipRef.current?.remove()
      tooltipRef.current = null
      map.remove()
      mapRef.current = null
      if (import.meta.env.DEV) {
        delete (window as unknown as Record<string, unknown>).__funworldmap_map
      }
    }
    // onLoad intentionally not in deps — it must be stable from caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef])

  return {
    supported,
    loaded,
    mapError,
    basemapDegraded,
    setMapError: (reason) => setMapErrorState((prev) => prev ?? reason),
  }
}
```

- [ ] **Step 5.6.2: Create the test file**

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRef, type ReactNode } from 'react'
import { MapProvider } from '../useMap'
import { useMapInstance } from '../useMapInstance'

vi.mock('maplibre-gl', () => {
  class FakeMap {
    _handlers: Record<string, ((e: unknown) => void)[]> = {}
    constructor() {}
    addControl() {}
    on(evt: string, h: (e: unknown) => void) {
      ;(this._handlers[evt] ??= []).push(h)
    }
    off() {}
    remove() {}
    setProjection() {}
    get scrollZoom() {
      return { setZoomRate: () => {} }
    }
    getCanvas() {
      return { style: { cursor: 'grab' } }
    }
  }
  class FakeControl {}
  return {
    default: {
      Map: FakeMap,
      NavigationControl: FakeControl,
      AttributionControl: FakeControl,
    },
    Map: FakeMap,
    NavigationControl: FakeControl,
    AttributionControl: FakeControl,
  }
})

vi.mock('../../lib/probeBasemap', () => ({
  probeBasemap: vi.fn().mockResolvedValue('ok'),
}))

function setupDom() {
  document.body.replaceChildren()
  const host = document.createElement('div')
  host.id = 'host'
  const c = document.createElement('div')
  c.id = 'c'
  host.appendChild(c)
  document.body.appendChild(host)
}

function Wrapper({ children }: { children: ReactNode }) {
  return <MapProvider>{children}</MapProvider>
}

describe('useMapInstance', () => {
  beforeEach(() => {
    setupDom()
  })

  it('starts with supported=true, loaded=false, mapError=null', () => {
    const { result } = renderHook(
      () => {
        const ref = useRef<HTMLDivElement | null>(document.getElementById('c') as HTMLDivElement)
        return useMapInstance({ containerRef: ref, onLoad: () => Promise.resolve() })
      },
      { wrapper: Wrapper },
    )
    expect(result.current.supported).toBe(true)
    expect(result.current.loaded).toBe(false)
    expect(result.current.mapError).toBeNull()
  })

  it('surfaces basemapDegraded when probe fails', async () => {
    const { probeBasemap } = await import('../../lib/probeBasemap')
    vi.mocked(probeBasemap).mockResolvedValueOnce('fail')
    const { result } = renderHook(
      () => {
        const ref = useRef<HTMLDivElement | null>(document.getElementById('c') as HTMLDivElement)
        return useMapInstance({ containerRef: ref, onLoad: () => Promise.resolve() })
      },
      { wrapper: Wrapper },
    )
    await vi.waitFor(() => expect(result.current.basemapDegraded).toBe(true))
  })
})
```

- [ ] **Step 5.6.3: Run the test**

```bash
npm run test:unit -- src/hooks/__tests__/useMapInstance.test.tsx
```
Expected: 2 passing tests.

- [ ] **Step 5.6.4: Commit the hook and tests**

```bash
git -C E:/polworldmap add src/hooks/useMap.tsx src/hooks/useMapInstance.ts src/hooks/__tests__/useMapInstance.test.tsx
git -C E:/polworldmap commit -m "refactor(map): add useMap context and useMapInstance hook"
```

### Task 5.7: Extract `useMapInteractions` hook

**Files:**
- Create: `src/hooks/useMapInteractions.ts`

- [ ] **Step 5.7.1: Create the hook**

```typescript
import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CountryData } from '../lib/types'
import { useMap } from './useMap'

interface Options {
  loaded: boolean
  byNumeric: Map<string, CountryData>
  onSelect: (cca3: string) => void
  onDeselect: () => void
}

/** Attach hover, click, tooltip, and cursor behaviors to the map.
 *  Must run after country layers are added (i.e. `loaded === true`). */
export function useMapInteractions({ loaded, byNumeric, onSelect, onDeselect }: Options): void {
  const { mapRef, hoveredRef, tooltipRef } = useMap()

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    const mousemoveHover = (e: maplibregl.MapLayerMouseEvent) => {
      if (e.features && e.features.length > 0) {
        const id = String(e.features[0].id)
        if (hoveredRef.current !== null && hoveredRef.current !== id) {
          map.setFeatureState({ source: 'countries', id: hoveredRef.current }, { hover: false })
        }
        hoveredRef.current = id
        map.setFeatureState({ source: 'countries', id }, { hover: true })
        map.setFilter('country-extrusion', ['==', ['get', 'id'], id])
        map.setFilter('country-hover-border', ['==', ['get', 'id'], id])
        const canvas = map.getCanvas()
        if (canvas.style.cursor !== 'crosshair') canvas.style.cursor = 'pointer'

        const tooltip = tooltipRef.current
        if (tooltip) {
          const country = byNumeric.get(id)
          if (country) {
            tooltip.replaceChildren()
            const img = document.createElement('img')
            img.src = country.flag
            img.alt = ''
            tooltip.appendChild(img)

            const textWrap = document.createElement('div')
            textWrap.className = 'tooltip-text'

            const nameEl = document.createElement('div')
            nameEl.className = 'tooltip-name'
            nameEl.textContent = country.name.common
            textWrap.appendChild(nameEl)

            if (country.capital.length > 0) {
              const capitalEl = document.createElement('div')
              capitalEl.className = 'tooltip-capital'
              capitalEl.textContent = country.capital[0]
              textWrap.appendChild(capitalEl)
            }

            tooltip.appendChild(textWrap)
            tooltip.classList.add('visible')
          }
        }
      }
    }

    const mousemovePosition = (e: maplibregl.MapMouseEvent) => {
      const tooltip = tooltipRef.current
      if (tooltip && tooltip.classList.contains('visible')) {
        tooltip.style.left = `${e.point.x + 15}px`
        tooltip.style.top = `${e.point.y + 15}px`
      }
    }

    const mouseleaveHover = () => {
      if (hoveredRef.current !== null) {
        map.setFeatureState({ source: 'countries', id: hoveredRef.current }, { hover: false })
        hoveredRef.current = null
      }
      map.setFilter('country-extrusion', ['==', ['get', 'id'], ''])
      map.setFilter('country-hover-border', ['==', ['get', 'id'], ''])
      const canvas = map.getCanvas()
      if (canvas.style.cursor !== 'crosshair') canvas.style.cursor = 'grab'

      const tooltip = tooltipRef.current
      if (tooltip) tooltip.classList.remove('visible')
    }

    const clickCountry = (e: maplibregl.MapLayerMouseEvent) => {
      if (e.features && e.features.length > 0) {
        const featureId = String(e.features[0].id)
        const country = byNumeric.get(featureId)
        if (country) onSelect(country.cca3)
      }
    }

    const clickMap = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['country-fill'] })
      if (features.length === 0) onDeselect()
    }

    const dragStart = () => {
      map.getCanvas().style.cursor = 'grabbing'
    }
    const dragEnd = () => {
      const canvas = map.getCanvas()
      if (canvas.style.cursor !== 'crosshair') {
        canvas.style.cursor = hoveredRef.current ? 'pointer' : 'grab'
      }
    }

    map.on('mousemove', 'country-fill', mousemoveHover)
    map.on('mousemove', mousemovePosition)
    map.on('mouseleave', 'country-fill', mouseleaveHover)
    map.on('click', 'country-fill', clickCountry)
    map.on('click', clickMap)
    map.on('dragstart', dragStart)
    map.on('dragend', dragEnd)

    map.getCanvas().style.cursor = 'grab'
    map.doubleClickZoom.disable()

    return () => {
      map.off('mousemove', 'country-fill', mousemoveHover)
      map.off('mousemove', mousemovePosition)
      map.off('mouseleave', 'country-fill', mouseleaveHover)
      map.off('click', 'country-fill', clickCountry)
      map.off('click', clickMap)
      map.off('dragstart', dragStart)
      map.off('dragend', dragEnd)
    }
  }, [loaded, byNumeric, onSelect, onDeselect, mapRef, hoveredRef, tooltipRef])
}
```

- [ ] **Step 5.7.2: Commit**

```bash
git -C E:/polworldmap add src/hooks/useMapInteractions.ts
git -C E:/polworldmap commit -m "refactor(map): extract useMapInteractions hook"
```

### Task 5.8: Extract `useSelectionHighlight` hook

**Files:**
- Create: `src/hooks/useSelectionHighlight.ts`
- Create: `src/hooks/__tests__/useSelectionHighlight.test.tsx`

- [ ] **Step 5.8.1: Create the hook**

```typescript
import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CountryData } from '../lib/types'
import { flyToCountry } from '../lib/flyToCountry'
import { useMap } from './useMap'

const EMPTY: maplibregl.FilterSpecification = ['==', ['get', 'id'], '']

interface Options {
  loaded: boolean
  selected: CountryData | null
  compareWith: CountryData | null
  satellite: boolean
  resolvedTheme: 'light' | 'dark'
}

/** Apply selection + compare filters and adjust base-layer dimming when in
 *  compare view. Flies camera to the selected country. */
export function useSelectionHighlight({
  loaded,
  selected,
  compareWith,
  satellite,
  resolvedTheme,
}: Options): void {
  const { mapRef } = useMap()

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    if (selected) {
      const filter: maplibregl.FilterSpecification = ['==', ['get', 'id'], selected.ccn3]
      map.setFilter('country-selected', filter)
      map.setFilter('country-selected-border', filter)
      map.setFilter('country-selected-glow', filter)
      map.setFilter('country-selected-extrusion', filter)
      flyToCountry(map, selected)
    } else {
      map.setFilter('country-selected', EMPTY)
      map.setFilter('country-selected-border', EMPTY)
      map.setFilter('country-selected-glow', EMPTY)
      map.setFilter('country-selected-extrusion', EMPTY)
    }
  }, [selected, loaded, mapRef])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    if (compareWith) {
      const filter: maplibregl.FilterSpecification = ['==', ['get', 'id'], compareWith.ccn3]
      map.setFilter('country-compare-fill', filter)
      map.setFilter('country-compare-border', filter)
      map.setFilter('country-compare-glow', filter)
      map.setFilter('country-compare-extrusion', filter)
    } else {
      map.setFilter('country-compare-fill', EMPTY)
      map.setFilter('country-compare-border', EMPTY)
      map.setFilter('country-compare-glow', EMPTY)
      map.setFilter('country-compare-extrusion', EMPTY)
    }
  }, [compareWith, loaded, mapRef])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    const inCompareView = compareWith !== null
    try {
      if (inCompareView) {
        map.setPaintProperty('country-fill', 'fill-opacity', 0.05)
        map.setFilter('country-hover-border', EMPTY)
        map.setFilter('country-extrusion', EMPTY)
        map.setPaintProperty('country-borders', 'line-opacity', 0.15)
      } else if (!satellite) {
        map.setPaintProperty('country-fill', 'fill-opacity', [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.28,
          0.05,
        ])
        const isDark = resolvedTheme === 'dark'
        map.setPaintProperty('country-borders', 'line-opacity', isDark ? 0.5 : 0.35)
      }
    } catch {
      // Layers may not exist yet.
    }
  }, [compareWith, loaded, satellite, resolvedTheme, mapRef])
}
```

- [ ] **Step 5.8.2: Create the test file**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { MapProvider, useMap } from '../useMap'
import { useSelectionHighlight } from '../useSelectionHighlight'
import type { CountryData } from '../../lib/types'

vi.mock('../../lib/flyToCountry', () => ({
  flyToCountry: vi.fn(),
}))

function makeCountry(ccn3: string): CountryData {
  return {
    cca3: 'FRA',
    ccn3,
    name: { common: 'France', official: 'France' },
    capital: [],
    region: 'Europe',
    subregion: '',
    languages: {},
    currencies: {},
    timezones: [],
    borders: [],
    flag: '',
    flagAlt: '',
    population: 0,
    area: 0,
    unMember: true,
    independent: true,
    governmentType: '',
    _fieldSources: {},
  } as unknown as CountryData
}

function makeFakeMap() {
  const calls: Record<string, unknown[][]> = { setFilter: [], setPaintProperty: [] }
  return {
    setFilter: vi.fn((...args: unknown[]) => calls.setFilter.push(args)),
    setPaintProperty: vi.fn((...args: unknown[]) => calls.setPaintProperty.push(args)),
    calls,
  }
}

function Injector({ children, map }: { children: ReactNode; map: unknown }) {
  const refs = useMap()
  refs.mapRef.current = map as never
  return <>{children}</>
}

function makeWrapper(map: unknown) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MapProvider>
        <Injector map={map}>{children}</Injector>
      </MapProvider>
    )
  }
}

describe('useSelectionHighlight', () => {
  it('sets selection filter with ccn3 when a country is selected', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useSelectionHighlight({
          loaded: true,
          selected: makeCountry('250'),
          compareWith: null,
          satellite: false,
          resolvedTheme: 'light',
        }),
      { wrapper: makeWrapper(fake) },
    )
    const call = fake.calls.setFilter.find((c) => c[0] === 'country-selected')
    expect(call?.[1]).toEqual(['==', ['get', 'id'], '250'])
  })

  it('sets empty selection filters when nothing is selected', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useSelectionHighlight({
          loaded: true,
          selected: null,
          compareWith: null,
          satellite: false,
          resolvedTheme: 'light',
        }),
      { wrapper: makeWrapper(fake) },
    )
    const call = fake.calls.setFilter.find((c) => c[0] === 'country-selected')
    expect(call?.[1]).toEqual(['==', ['get', 'id'], ''])
  })

  it('dims base fill when compareWith is present', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useSelectionHighlight({
          loaded: true,
          selected: makeCountry('250'),
          compareWith: makeCountry('276'),
          satellite: false,
          resolvedTheme: 'light',
        }),
      { wrapper: makeWrapper(fake) },
    )
    const call = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-fill' && c[1] === 'fill-opacity',
    )
    expect(call?.[2]).toBe(0.05)
  })

  it('does nothing when loaded is false', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useSelectionHighlight({
          loaded: false,
          selected: makeCountry('250'),
          compareWith: null,
          satellite: false,
          resolvedTheme: 'light',
        }),
      { wrapper: makeWrapper(fake) },
    )
    expect(fake.setFilter).not.toHaveBeenCalled()
    expect(fake.setPaintProperty).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 5.8.3: Run and commit**

```bash
npm run test:unit -- src/hooks/__tests__/useSelectionHighlight.test.tsx
```
Expected: 4 passing tests.

```bash
git -C E:/polworldmap add src/hooks/useSelectionHighlight.ts src/hooks/__tests__/useSelectionHighlight.test.tsx
git -C E:/polworldmap commit -m "refactor(map): extract useSelectionHighlight hook with unit tests"
```

### Task 5.9: Extract `useMapTheme` hook

**Files:**
- Create: `src/hooks/useMapTheme.ts`

- [ ] **Step 5.9.1: Create the hook**

```typescript
import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import { applyMapTheme } from '../lib/mapColors'
import { TEAL, TEAL_LIGHT, CORAL, CORAL_LIGHT } from '../lib/mapPalette'
import { useMap } from './useMap'

interface Options {
  loaded: boolean
  resolvedTheme: 'light' | 'dark'
}

export function useMapTheme({ loaded, resolvedTheme }: Options): void {
  const { mapRef } = useMap()

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    applyMapTheme(map, resolvedTheme)

    const isDark = resolvedTheme === 'dark'
    const teal = isDark ? TEAL_LIGHT : TEAL
    const coral = isDark ? CORAL_LIGHT : CORAL

    try {
      map.setPaintProperty('country-fill', 'fill-color', teal)
      map.setPaintProperty('country-extrusion', 'fill-extrusion-color', teal)
      map.setPaintProperty('country-hover-border', 'line-color', teal)

      map.setPaintProperty('country-selected', 'fill-color', coral)
      map.setPaintProperty('country-selected-border', 'line-color', coral)
      map.setPaintProperty('country-selected-glow', 'line-color', coral)
      map.setPaintProperty('country-selected-extrusion', 'fill-extrusion-color', coral)

      map.setPaintProperty('country-borders', 'line-color', isDark ? '#1e293b' : '#94a3b8')
      map.setPaintProperty('country-borders', 'line-opacity', isDark ? 0.5 : 0.35)

      ;(map as never as { setFog: (fog: Record<string, unknown>) => void }).setFog({
        range: [1.5, 10],
        color: isDark ? 'rgba(16, 20, 26, 0.7)' : 'rgba(232, 227, 218, 0.5)',
        'high-color': isDark ? '#10141a' : '#c4d8e6',
        'horizon-blend': 0.1,
      })

      ;(map as never as { setSky: (sky: Record<string, unknown>) => void }).setSky({
        'sky-color': isDark ? '#0a1a2e' : '#88c6fc',
        'horizon-color': isDark ? '#1a2030' : '#f0ede6',
        'fog-color': isDark ? '#10141a' : '#e8e3da',
        'fog-ground-blend': 0.5,
        'horizon-fog-blend': 0.8,
        'sky-horizon-blend': 0.8,
        'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
      })
    } catch {
      // Layers may not exist yet.
    }
  }, [resolvedTheme, loaded, mapRef])
}
```

- [ ] **Step 5.9.2: Commit**

```bash
git -C E:/polworldmap add src/hooks/useMapTheme.ts
git -C E:/polworldmap commit -m "refactor(map): extract useMapTheme hook"
```

### Task 5.10: Extract `useSatelliteMode` hook

**Files:**
- Create: `src/hooks/useSatelliteMode.ts`

- [ ] **Step 5.10.1: Create the hook**

```typescript
import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import { useMap } from './useMap'

interface Options {
  loaded: boolean
  satellite: boolean
  resolvedTheme: 'light' | 'dark'
  comparePickingMode: boolean
}

export function useSatelliteMode({
  loaded,
  satellite,
  resolvedTheme,
  comparePickingMode,
}: Options): void {
  const { mapRef, hoveredRef } = useMap()

  // Crosshair cursor during compare-picking.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    if (comparePickingMode) {
      map.getCanvas().style.cursor = 'crosshair'
    } else {
      map.getCanvas().style.cursor = hoveredRef.current ? 'pointer' : 'grab'
    }
  }, [comparePickingMode, loaded, mapRef, hoveredRef])

  // Satellite layer + terrain + base-layer hide/show + border tint.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    try {
      map.setLayoutProperty(
        'satellite-layer',
        'visibility',
        satellite ? 'visible' : 'none',
      )

      if (satellite) {
        map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 })
      } else {
        map.setTerrain(null)
      }

      const style = map.getStyle()
      if (style?.layers) {
        const customPrefixes = ['country-', 'satellite-']
        for (const layer of style.layers) {
          const isCustom = customPrefixes.some((p) => layer.id.startsWith(p))
          if (!isCustom) {
            try {
              map.setLayoutProperty(
                layer.id,
                'visibility',
                satellite ? 'none' : 'visible',
              )
            } catch {
              /* some layers don't support visibility */
            }
          }
        }
      }

      if (satellite) {
        map.setPaintProperty('country-borders', 'line-color', 'rgba(255,255,255,0.35)')
        map.setPaintProperty('country-borders', 'line-opacity', 0.6)
        map.setPaintProperty('country-fill', 'fill-opacity', [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.32,
          0.03,
        ])
      } else {
        const isDark = resolvedTheme === 'dark'
        map.setPaintProperty('country-borders', 'line-color', isDark ? '#1e293b' : '#94a3b8')
        map.setPaintProperty('country-borders', 'line-opacity', isDark ? 0.5 : 0.35)
        map.setPaintProperty('country-fill', 'fill-opacity', [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.28,
          0.05,
        ])
      }
    } catch {
      // Layers may not exist yet.
    }
  }, [satellite, loaded, resolvedTheme, mapRef])
}
```

- [ ] **Step 5.10.2: Commit**

```bash
git -C E:/polworldmap add src/hooks/useSatelliteMode.ts
git -C E:/polworldmap commit -m "refactor(map): extract useSatelliteMode hook"
```

### Task 5.11: Rewrite `WorldMap.tsx` as a thin composer

**Files:**
- Modify: `src/components/WorldMap.tsx` (replace the entire body)
- Modify: `src/App.tsx` (wrap `<WorldMap>` in `<MapProvider>`)

- [ ] **Step 5.11.1: Replace `WorldMap.tsx` with the composition shell**

```typescript
import { useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CountryData } from '../lib/types'
import { MapErrorOverlay } from './MapErrorOverlay'
import { BasemapBanner } from './BasemapBanner'
import { loadCountryGeojson } from '../lib/loadCountryGeojson'
import {
  addRasterSources,
  addCountrySource,
  addBaseCountryLayers,
  addHoverLayers,
  addSelectionLayers,
  addCompareLayers,
  applyWarmLighting,
} from '../lib/mapLayers'
import { useMapInstance } from '../hooks/useMapInstance'
import { useMapInteractions } from '../hooks/useMapInteractions'
import { useSelectionHighlight } from '../hooks/useSelectionHighlight'
import { useMapTheme } from '../hooks/useMapTheme'
import { useSatelliteMode } from '../hooks/useSatelliteMode'

interface Props {
  byNumeric: Map<string, CountryData>
  selected: CountryData | null
  compareWith: CountryData | null
  comparePickingMode: boolean
  resolvedTheme: 'light' | 'dark'
  satellite: boolean
  onSelect: (cca3: string) => void
  onDeselect: () => void
}

export default function WorldMap({
  byNumeric,
  selected,
  compareWith,
  comparePickingMode,
  resolvedTheme,
  satellite,
  onSelect,
  onDeselect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const onLoad = useCallback(async (map: maplibregl.Map) => {
    const geojson = await loadCountryGeojson()
    addRasterSources(map)
    addCountrySource(map, geojson)
    addBaseCountryLayers(map)
    addHoverLayers(map)
    addSelectionLayers(map)
    addCompareLayers(map)
    applyWarmLighting(map)
  }, [])

  const { supported, loaded, mapError, basemapDegraded } = useMapInstance({
    containerRef,
    onLoad,
  })

  useMapInteractions({ loaded, byNumeric, onSelect, onDeselect })
  useSelectionHighlight({ loaded, selected, compareWith, satellite, resolvedTheme })
  useMapTheme({ loaded, resolvedTheme })
  useSatelliteMode({ loaded, satellite, resolvedTheme, comparePickingMode })

  if (!supported) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-sand-100 dark:bg-dark-500 text-sand-700 dark:text-dark-50 p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-4">WebGL2 Not Supported</h1>
          <p>
            funworldmap requires WebGL2 to render the map. Please update your browser or enable
            hardware acceleration in your browser settings.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-screen">
      <div
        ref={containerRef}
        className="h-full w-full"
        data-map-loaded={loaded || undefined}
        data-map-error={mapError ?? undefined}
        tabIndex={0}
        role="application"
        aria-label="Interactive world map"
        aria-description="Use search to select countries by keyboard"
      />
      {basemapDegraded && mapError === null && <BasemapBanner />}
      {mapError !== null && (
        <MapErrorOverlay reason={mapError} onRetry={() => window.location.reload()} />
      )}
    </div>
  )
}
```

- [ ] **Step 5.11.2: Wrap `<WorldMap>` with `<MapProvider>` in `App.tsx`**

In `src/App.tsx`, import `MapProvider`:
```typescript
import { MapProvider } from './hooks/useMap'
```

Replace the `<main>` block:
```tsx
<main>
  <MapProvider>
    <WorldMap
      byNumeric={byNumeric}
      selected={selected}
      compareWith={compareWith}
      comparePickingMode={comparePickingMode}
      resolvedTheme={resolved}
      satellite={satellite}
      onSelect={onMapSelect}
      onDeselect={deselect}
    />
  </MapProvider>
</main>
```

- [ ] **Step 5.11.3: Full verification**

```bash
cd E:/polworldmap
npm run lint && tsc -b && npm run test:unit && npm run build && npm run test:e2e
```
Expected: all green. E2E is the critical gate — this refactor is behavior-preserving, so every prior test should pass unchanged. If an e2e test fails, diff the handler attachment between the old `WorldMap.tsx` and the new hooks — most refactor bugs at this level come from dropped event listeners or wrong `map.off` signatures.

- [ ] **Step 5.11.4: Verify file size target**

Run:
```bash
wc -l E:/polworldmap/src/components/WorldMap.tsx
```
Expected: < 200 lines.

- [ ] **Step 5.11.5: Commit**

```bash
git -C E:/polworldmap add src/components/WorldMap.tsx src/App.tsx
git -C E:/polworldmap commit -m "$(cat <<'EOF'
refactor(map): collapse WorldMap into a thin composer

WorldMap.tsx drops from 786 to ~140 LOC. All logic now lives in the
previously-extracted lib modules and hooks, composed via the
useMap context. No behavior change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 6 — CountryPanel Split

Intent: split `src/components/CountryPanel.tsx` (490 LOC) by layout variant. Extract `CountryColumn` first, then separate single and compare layouts.

### Task 6.1: Extract `CountryColumn` to its own file

**Files:**
- Create: `src/components/CountryColumn.tsx`
- Modify: `src/components/CountryPanel.tsx` (remove inline definition)

- [ ] **Step 6.1.1: Create `src/components/CountryColumn.tsx`**

Move the `CompareField` and `CountryColumn` components from `CountryPanel.tsx` (lines 61–179) into the new file. The full contents:

```tsx
import type { CountryData } from '../lib/types'

function CompareField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light">
        {label}
      </div>
      <div className="text-sm text-sand-800 dark:text-dark-50">{children}</div>
    </div>
  )
}

interface Props {
  country: CountryData
  byCca3: Map<string, CountryData>
  onSelect: (cca3: string) => void
  onClose: () => void
  badgeLetter: 'A' | 'B'
  badgeColor: 'a' | 'b'
  showColumnClose: boolean
}

export function CountryColumn({
  country,
  byCca3,
  onSelect,
  onClose,
  badgeLetter,
  badgeColor,
  showColumnClose,
}: Props) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="sticky top-0 bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-md px-5 py-4 z-10">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex items-start gap-3 min-w-0"
            style={{ animation: 'fade-up 200ms ease-out' }}
          >
            <span className={`compare-badge compare-badge-${badgeColor} mt-1`}>{badgeLetter}</span>
            <img
              data-testid="country-flag"
              src={country.flag}
              alt={country.flagAlt || `Flag of ${country.name.common}`}
              className="w-[56px] h-[38px] object-cover rounded-lg shadow-md shrink-0"
            />
            <div className="min-w-0 pt-0.5">
              <h2 className="text-lg font-bold text-sand-900 dark:text-dark-50 truncate tracking-tight leading-tight">
                {country.name.common}
              </h2>
              {country.capital.length > 0 && (
                <p className="text-xs text-teal dark:text-teal-light truncate mt-0.5">
                  {country.capital[0]}
                </p>
              )}
              <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1.5 bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100">
                {country.region}
              </span>
            </div>
          </div>
          {showColumnClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-500 dark:text-dark-100 transition-colors"
              aria-label="Exit compare"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-3 space-y-2">
        <CompareField label="Population">{country.population.toLocaleString('en-US')}</CompareField>
        <CompareField label="Area">{`${country.area.toLocaleString('en-US')} km\u00B2`}</CompareField>
        <CompareField label="Region">
          {country.region}
          {country.subregion && ` / ${country.subregion}`}
        </CompareField>
        {country.governmentType && (
          <CompareField label="Government">{country.governmentType}</CompareField>
        )}
        {Object.keys(country.languages).length > 0 && (
          <CompareField label="Languages">{Object.values(country.languages).join(', ')}</CompareField>
        )}
        {Object.keys(country.currencies).length > 0 && (
          <CompareField label="Currencies">
            {Object.values(country.currencies).map((c) => `${c.name} (${c.symbol})`).join(', ')}
          </CompareField>
        )}
        <CompareField label="UN Member">{country.unMember ? 'Yes' : 'No'}</CompareField>
        {country.borders.length > 0 && (
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light mb-1.5">
              Borders
            </div>
            <div className="flex flex-wrap gap-1">
              {country.borders.slice(0, 6).map((code) => {
                const neighbor = byCca3.get(code)
                return (
                  <button
                    key={code}
                    onClick={() => onSelect(code)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border border-teal/20 dark:border-teal-light/15 bg-teal/5 dark:bg-teal-light/5 text-teal-dim dark:text-teal-light hover:bg-teal/12 dark:hover:bg-teal-light/12 transition-colors"
                  >
                    {neighbor ? neighbor.name.common : code}
                  </button>
                )
              })}
              {country.borders.length > 6 && (
                <span className="px-2 py-0.5 text-[11px] text-sand-400 dark:text-dark-100">
                  +{country.borders.length - 6}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6.1.2: Remove the inline definition from `CountryPanel.tsx`**

Delete lines 61–179 (the `CompareField` and `CountryColumn` functions) and add an import at the top:

```typescript
import { CountryColumn } from './CountryColumn'
```

- [ ] **Step 6.1.3: Verify and commit**

```bash
npm run lint && tsc -b && npm run test:unit && npm run build && npm run test:e2e
git -C E:/polworldmap add src/components/CountryColumn.tsx src/components/CountryPanel.tsx
git -C E:/polworldmap commit -m "refactor(panel): extract CountryColumn to its own file"
```

### Task 6.2: Create `CompareCountryPanel`

**Files:**
- Create: `src/components/CompareCountryPanel.tsx`

- [ ] **Step 6.2.1: Create the file**

```tsx
import type { CountryData } from '../lib/types'
import { CountryColumn } from './CountryColumn'

interface Props {
  country: CountryData
  compareWith: CountryData
  isDesktop: boolean
  onSelect: (cca3: string) => void
  onClose: () => void
  onExitCompare: () => void
  byCca3: Map<string, CountryData>
}

export function CompareCountryPanel({
  country,
  compareWith,
  isDesktop,
  onSelect,
  onClose,
  onExitCompare,
  byCca3,
}: Props) {
  const panelClasses = isDesktop
    ? 'fixed right-4 top-16 bottom-4 w-[656px] bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl shadow-[0_25px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_50px_rgba(0,0,0,0.6)] z-40 rounded-2xl border border-sand-200/50 dark:border-dark-200/20 overflow-hidden'
    : 'fixed bottom-0 left-0 right-0 bg-sand-50 dark:bg-dark-400 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 rounded-t-2xl h-[80vh] overflow-hidden'

  return (
    <div
      className={panelClasses}
      role="complementary"
      aria-label="Country comparison"
      data-testid="country-panel"
      style={isDesktop ? { animation: 'panel-card-in 250ms cubic-bezier(0.34, 1.3, 0.64, 1)' } : undefined}
    >
      <div className={isDesktop ? 'grid grid-cols-2 h-full' : 'flex flex-col h-full'}>
        <div
          className={
            isDesktop
              ? 'border-r border-sand-200/50 dark:border-dark-200/30'
              : 'flex-1 border-b-2 border-dashed border-sand-300/50 dark:border-dark-200/30 min-h-0'
          }
        >
          <CountryColumn
            country={country}
            byCca3={byCca3}
            onSelect={onSelect}
            onClose={onClose}
            badgeLetter="A"
            badgeColor="a"
            showColumnClose={false}
          />
        </div>
        <div className={isDesktop ? '' : 'flex-1 min-h-0'}>
          <CountryColumn
            country={compareWith}
            byCca3={byCca3}
            onSelect={onSelect}
            onClose={onExitCompare}
            badgeLetter="B"
            badgeColor="b"
            showColumnClose={true}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6.2.2: Compile and commit**

```bash
tsc -b
git -C E:/polworldmap add src/components/CompareCountryPanel.tsx
git -C E:/polworldmap commit -m "refactor(panel): add CompareCountryPanel component"
```

### Task 6.3: Create `SingleCountryPanel`

**Files:**
- Create: `src/components/SingleCountryPanel.tsx`

- [ ] **Step 6.3.1: Create the file**

Copy the single-country rendering branch (lines 265–488 in the original `CountryPanel.tsx`, plus the `DataCell` helper, the formatters, and the region-badge map) into the new file. Full contents:

```tsx
import { useState } from 'react'
import type { CountryData, CountriesFile } from '../lib/types'
import SourceTooltip from './SourceTooltip'

interface Props {
  country: CountryData
  comparePickingMode: boolean
  sources: CountriesFile['_sources']
  isDesktop: boolean
  onSelect: (cca3: string) => void
  onClose: () => void
  onEnterCompare: () => void
  byCca3: Map<string, CountryData>
}

function DataCell({
  label,
  children,
  field,
  country,
  sources,
}: {
  label: string
  children: React.ReactNode
  field: string
  country: CountryData
  sources: CountriesFile['_sources']
}) {
  return (
    <div className="py-1.5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light mb-0.5 flex items-center gap-1">
        {label}
        <SourceTooltip field={field} fieldSources={country._fieldSources} sources={sources} />
      </div>
      <div className="text-[15px] text-sand-800 dark:text-dark-50">{children}</div>
    </div>
  )
}

function formatPopulation(n: number): string {
  return n.toLocaleString('en-US')
}

function formatArea(n: number): string {
  return `${n.toLocaleString('en-US')} km\u00B2`
}

const REGION_BADGE: Record<string, string> = {
  Africa: 'bg-amber-100/80 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Americas: 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  Asia: 'bg-rose-100/80 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  Europe: 'bg-blue-100/80 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Oceania: 'bg-teal-100/80 text-teal-800 dark:bg-teal/20 dark:text-teal-light',
  Antarctic: 'bg-slate-100/80 text-slate-800 dark:bg-slate-800/30 dark:text-slate-300',
}

export function SingleCountryPanel({
  country,
  comparePickingMode,
  sources,
  isDesktop,
  onSelect,
  onClose,
  onEnterCompare,
  byCca3,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const showSecondary = isDesktop || expanded

  const onShareLink = () => {
    const base = `${window.location.origin}${window.location.pathname}`
    const hash = `#${country.cca3}`
    const url = base + hash
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).catch(() => window.prompt('Copy this link:', url))
    } else {
      window.prompt('Copy this link:', url)
    }
    window.dispatchEvent(new CustomEvent('funworldmap:toast', { detail: 'Link copied' }))
  }

  const panelClasses = isDesktop
    ? 'fixed right-4 top-16 bottom-4 w-[360px] bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl shadow-[0_25px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_50px_rgba(0,0,0,0.6)] z-40 overflow-y-auto rounded-2xl border border-sand-200/50 dark:border-dark-200/20'
    : `fixed bottom-0 left-0 right-0 bg-sand-50 dark:bg-dark-400 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 overflow-y-auto rounded-t-2xl transition-[height] duration-200 ${
        expanded ? 'h-[80vh]' : 'h-[40vh]'
      }`

  return (
    <div
      className={panelClasses}
      role="complementary"
      aria-label="Country information"
      data-testid="country-panel"
      style={isDesktop ? { animation: 'panel-card-in 250ms cubic-bezier(0.34, 1.3, 0.64, 1)' } : undefined}
    >
      <div className="sticky top-0 bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-md px-5 py-4 z-10">
        {comparePickingMode && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-teal/10 dark:bg-teal-light/10 border border-teal/20 dark:border-teal-light/20 text-xs text-teal dark:text-teal-light">
            Pick a country to compare with...
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex items-start gap-3.5 min-w-0"
            style={{ animation: 'fade-up 200ms ease-out' }}
          >
            <img
              data-testid="country-flag"
              src={country.flag}
              alt={country.flagAlt || `Flag of ${country.name.common}`}
              className="w-[72px] h-[50px] object-cover rounded-xl shadow-lg shrink-0"
            />
            <div className="min-w-0 pt-0.5">
              <h2 className="text-2xl font-bold text-sand-900 dark:text-dark-50 truncate tracking-tight leading-tight">
                {country.name.common}
              </h2>
              {country.name.official !== country.name.common && (
                <p className="text-xs text-sand-500 dark:text-dark-100 truncate mt-0.5">
                  {country.name.official}
                </p>
              )}
              {country.capital.length > 0 && (
                <p className="text-xs text-teal dark:text-teal-light truncate mt-0.5">
                  {country.capital[0]}
                </p>
              )}
              <span
                className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1.5 ${
                  REGION_BADGE[country.region] ||
                  'bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100'
                }`}
              >
                {country.region}
                {country.subregion && ` / ${country.subregion}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!comparePickingMode && (
              <button
                onClick={onEnterCompare}
                className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-teal dark:text-teal-light transition-colors"
                aria-label="Compare with another country"
                title="Compare"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="9" cy="12" r="6" strokeWidth="1.75" />
                  <circle cx="15" cy="12" r="6" strokeWidth="1.75" />
                </svg>
              </button>
            )}

            <button
              onClick={onShareLink}
              className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-500 dark:text-dark-100 transition-colors"
              aria-label="Copy link to this country"
              title="Copy link"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>

            {!isDesktop && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-500 dark:text-dark-100 transition-colors"
                aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
              >
                <svg
                  className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-500 dark:text-dark-100 transition-colors"
              aria-label="Close panel"
              data-testid="panel-close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-5 h-px bg-teal/10 dark:bg-teal-light/10" />

      <div className="px-5 py-3">
        <div
          className="grid grid-cols-2 gap-x-4"
          style={{ animation: 'panel-field-in 200ms ease-out 50ms both' }}
        >
          <DataCell label="Capital" field="capital" country={country} sources={sources}>
            {country.capital.length > 0 ? country.capital.join(', ') : '\u2014'}
          </DataCell>
          <DataCell label="Population" field="population" country={country} sources={sources}>
            {formatPopulation(country.population)}
          </DataCell>
          <DataCell label="Area" field="area" country={country} sources={sources}>
            {formatArea(country.area)}
          </DataCell>
          <DataCell label="Region" field="region" country={country} sources={sources}>
            {country.region}
          </DataCell>
        </div>

        {showSecondary && (
          <>
            <div className="my-2 border-t border-dotted border-sand-300/50 dark:border-dark-200/30" />

            <div style={{ animation: 'panel-field-in 200ms ease-out 100ms both' }}>
              {country.governmentType && (
                <DataCell
                  label="Government"
                  field="governmentType"
                  country={country}
                  sources={sources}
                >
                  {country.governmentType}
                </DataCell>
              )}
              <div className="grid grid-cols-2 gap-x-4">
                <DataCell label="UN Member" field="unMember" country={country} sources={sources}>
                  {country.unMember ? 'Yes' : 'No'}
                </DataCell>
                <DataCell
                  label="Independent"
                  field="independent"
                  country={country}
                  sources={sources}
                >
                  {country.independent ? 'Yes' : 'No'}
                </DataCell>
              </div>
            </div>

            <div className="my-2 border-t border-dotted border-sand-300/50 dark:border-dark-200/30" />

            <div style={{ animation: 'panel-field-in 200ms ease-out 150ms both' }}>
              <div className="grid grid-cols-2 gap-x-4">
                {Object.keys(country.languages).length > 0 && (
                  <DataCell label="Languages" field="languages" country={country} sources={sources}>
                    {Object.values(country.languages).join(', ')}
                  </DataCell>
                )}
                {Object.keys(country.currencies).length > 0 && (
                  <DataCell
                    label="Currencies"
                    field="currencies"
                    country={country}
                    sources={sources}
                  >
                    {Object.values(country.currencies)
                      .map((c) => `${c.name} (${c.symbol})`)
                      .join(', ')}
                  </DataCell>
                )}
              </div>
              <DataCell label="Timezones" field="timezones" country={country} sources={sources}>
                {country.timezones.join(', ')}
              </DataCell>
            </div>

            {country.borders.length > 0 && (
              <>
                <div className="my-2 border-t border-dotted border-sand-300/50 dark:border-dark-200/30" />
                <div style={{ animation: 'panel-field-in 200ms ease-out 200ms both' }}>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light mb-2 flex items-center gap-1">
                    Borders
                    <SourceTooltip
                      field="borders"
                      fieldSources={country._fieldSources}
                      sources={sources}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {country.borders.map((code) => {
                      const neighbor = byCca3.get(code)
                      if (neighbor) {
                        return (
                          <button
                            key={code}
                            onClick={() => onSelect(code)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-full border border-teal/20 dark:border-teal-light/15 bg-teal/5 dark:bg-teal-light/5 text-teal-dim dark:text-teal-light hover:bg-teal/12 dark:hover:bg-teal-light/12 hover:scale-[1.03] active:scale-100 transition-all duration-150"
                          >
                            <img
                              src={neighbor.flag}
                              alt=""
                              className="w-4 h-3 object-cover rounded-sm shrink-0"
                            />
                            {neighbor.name.common}
                          </button>
                        )
                      }
                      return (
                        <span
                          key={code}
                          className="px-2.5 py-1.5 text-xs rounded-full bg-sand-200 dark:bg-dark-300 text-sand-500 dark:text-dark-100"
                        >
                          {code}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6.3.2: Compile and commit**

```bash
tsc -b
git -C E:/polworldmap add src/components/SingleCountryPanel.tsx
git -C E:/polworldmap commit -m "refactor(panel): add SingleCountryPanel component"
```

### Task 6.4: Collapse `CountryPanel` to a thin router

**Files:**
- Modify: `src/components/CountryPanel.tsx` (replace entire body)

- [ ] **Step 6.4.1: Replace `CountryPanel.tsx` with the router**

```tsx
import type { CountryData, CountriesFile } from '../lib/types'
import { SingleCountryPanel } from './SingleCountryPanel'
import { CompareCountryPanel } from './CompareCountryPanel'

interface Props {
  country: CountryData
  compareWith: CountryData | null
  comparePickingMode: boolean
  sources: CountriesFile['_sources']
  isDesktop: boolean
  onSelect: (cca3: string) => void
  onClose: () => void
  onEnterCompare: () => void
  onExitCompare: () => void
  byCca3: Map<string, CountryData>
}

export default function CountryPanel({
  country,
  compareWith,
  comparePickingMode,
  sources,
  isDesktop,
  onSelect,
  onClose,
  onEnterCompare,
  onExitCompare,
  byCca3,
}: Props) {
  if (compareWith) {
    return (
      <CompareCountryPanel
        country={country}
        compareWith={compareWith}
        isDesktop={isDesktop}
        onSelect={onSelect}
        onClose={onClose}
        onExitCompare={onExitCompare}
        byCca3={byCca3}
      />
    )
  }

  return (
    <SingleCountryPanel
      country={country}
      comparePickingMode={comparePickingMode}
      sources={sources}
      isDesktop={isDesktop}
      onSelect={onSelect}
      onClose={onClose}
      onEnterCompare={onEnterCompare}
      byCca3={byCca3}
    />
  )
}
```

- [ ] **Step 6.4.2: Verify file sizes**

Run:
```bash
wc -l E:/polworldmap/src/components/CountryPanel.tsx E:/polworldmap/src/components/SingleCountryPanel.tsx E:/polworldmap/src/components/CompareCountryPanel.tsx E:/polworldmap/src/components/CountryColumn.tsx
```
Expected: `CountryPanel.tsx` under 60 lines; `SingleCountryPanel.tsx` around 250–300; `CompareCountryPanel.tsx` around 80–100; `CountryColumn.tsx` around 120–150.

- [ ] **Step 6.4.3: Full verification**

```bash
cd E:/polworldmap
npm run lint && tsc -b && npm run test:unit && npm run build && npm run test:e2e
```
Expected: all green. All panel / deeplink / compare e2e tests should pass unchanged.

- [ ] **Step 6.4.4: Commit**

```bash
git -C E:/polworldmap add src/components/CountryPanel.tsx
git -C E:/polworldmap commit -m "$(cat <<'EOF'
refactor(panel): collapse CountryPanel to a layout-variant router

CountryPanel.tsx drops from 490 to ~50 LOC, delegating to
SingleCountryPanel or CompareCountryPanel based on compareWith.
Behavior-preserving.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 7 — UX Fixes

Intent: close remaining UX findings. Map-canvas focus affordance + `Home` binding + ARIA announcements; panel focus management on open/close; richer basemap banner.

### Task 7.1: Visible focus ring on the map canvas container

**Files:**
- Modify: `src/components/WorldMap.tsx` (focus-visible classes on the map container)

**Context:** MapLibre's `KeyboardHandler` is enabled by default and already binds arrows (pan), `+`/`-` (zoom), `Shift+Arrows` (rotate/pitch). The canvas has `tabIndex={0}`. The missing piece is a *visible* focus indicator.

- [ ] **Step 7.1.1: Add a Tailwind focus-visible ring**

In `src/components/WorldMap.tsx`, change the `className` on the map container div:

```tsx
<div
  ref={containerRef}
  className="h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-teal dark:focus-visible:outline-teal-light"
  data-map-loaded={loaded || undefined}
  data-map-error={mapError ?? undefined}
  tabIndex={0}
  role="application"
  aria-label="Interactive world map"
  aria-description="Pan with arrow keys, zoom with plus/minus, reset view with Home, deselect with Escape"
>
```

`aria-description` is updated to mention the actual keyboard bindings.

- [ ] **Step 7.1.2: Verify and commit**

```bash
npm run lint && tsc -b
git -C E:/polworldmap add src/components/WorldMap.tsx
git -C E:/polworldmap commit -m "feat(a11y): visible focus ring on map container with keyboard hints in aria-description"
```

### Task 7.2: Bind `Home` to reset view; add live-region announcements

**Files:**
- Modify: `src/hooks/useMapInstance.ts`
- Modify: `src/App.tsx`

- [ ] **Step 7.2.1: Add a window-level `Home` listener inside `useMapInstance`**

Inside the `map.on('load', ...)` handler in `src/hooks/useMapInstance.ts`, register a window-level keyboard listener that fires only when the map container has focus:

```typescript
const keyHandler = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement | null
  if (target && target.matches('input, textarea, [contenteditable]')) return
  const mapContainer = containerRef.current
  if (!mapContainer || !mapContainer.contains(document.activeElement)) return

  if (e.key === 'Home') {
    e.preventDefault()
    map.flyTo({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: prefersReducedMotion() ? 0 : DEFAULT_PITCH,
      bearing: 0,
      duration: prefersReducedMotion() ? 0 : 1400,
    })
    window.dispatchEvent(new CustomEvent('funworldmap:announce', { detail: 'View reset' }))
  }
}
window.addEventListener('keydown', keyHandler)
;(map as unknown as { _funHomeHandler?: typeof keyHandler })._funHomeHandler = keyHandler
```

Update the cleanup return in the same effect to remove the listener:

```typescript
const handler = (map as unknown as { _funHomeHandler?: (e: KeyboardEvent) => void })._funHomeHandler
if (handler) window.removeEventListener('keydown', handler)
```

- [ ] **Step 7.2.2: Wire announcements to the existing live region in `App.tsx`**

Add an effect to `App.tsx` after the existing selection-announcement effect:

```typescript
useEffect(() => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<string>).detail
    if (liveRegionRef.current && detail) {
      liveRegionRef.current.textContent = detail
    }
  }
  window.addEventListener('funworldmap:announce', handler)
  return () => window.removeEventListener('funworldmap:announce', handler)
}, [])
```

- [ ] **Step 7.2.3: Verify and commit**

```bash
npm run lint && tsc -b && npm run test:unit
git -C E:/polworldmap add src/hooks/useMapInstance.ts src/App.tsx
git -C E:/polworldmap commit -m "feat(a11y): bind Home to reset view and announce via live region"
```

### Task 7.3: Panel focus management on open and close

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 7.3.1: Capture activeElement on panel open; restore on close**

Add to `App.tsx` after the selection live-region effect:

```typescript
const focusReturnRef = useRef<HTMLElement | null>(null)

useEffect(() => {
  if (selected && !focusReturnRef.current) {
    focusReturnRef.current = document.activeElement as HTMLElement | null
    requestAnimationFrame(() => {
      const close = document.querySelector<HTMLButtonElement>('[data-testid="panel-close"]')
      close?.focus()
    })
  } else if (!selected && focusReturnRef.current) {
    const target = focusReturnRef.current
    focusReturnRef.current = null
    if (target && document.body.contains(target) && typeof (target as HTMLElement).focus === 'function') {
      ;(target as HTMLElement).focus()
    } else {
      document.getElementById('search-input')?.focus()
    }
  }
}, [selected])
```

- [ ] **Step 7.3.2: Verify and commit**

```bash
npm run lint && tsc -b && npm run test:unit
git -C E:/polworldmap add src/App.tsx
git -C E:/polworldmap commit -m "feat(a11y): manage focus on panel open and restore on close"
```

### Task 7.4: Enhanced `BasemapBanner`

**Files:**
- Modify: `src/components/BasemapBanner.tsx`

- [ ] **Step 7.4.1: Rewrite the component with Retry + session-persistent dismissal**

```tsx
import { useState } from 'react'
import { probeBasemap } from '../lib/probeBasemap'
import { BASEMAP_STYLE } from '../lib/mapStyles'

const SESSION_KEY = 'funworldmap-basemap-banner-dismissed'
const PROBE_TIMEOUT_MS = 3_000

export function BasemapBanner() {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem(SESSION_KEY) === '1',
  )
  const [retrying, setRetrying] = useState(false)
  const [lastRetryAt, setLastRetryAt] = useState<Date | null>(null)

  const onDismiss = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      /* private mode */
    }
    setDismissed(true)
  }

  const onRetry = async () => {
    setRetrying(true)
    try {
      const result = await probeBasemap(BASEMAP_STYLE, PROBE_TIMEOUT_MS)
      if (result === 'ok') {
        window.location.reload()
        return
      }
    } catch {
      /* fall through */
    }
    setLastRetryAt(new Date())
    setRetrying(false)
  }

  if (dismissed) return null

  return (
    <div
      data-testid="basemap-banner"
      role="status"
      className="pointer-events-auto fixed inset-x-2 top-20 z-[60] rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 shadow-md dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
    >
      <span>
        Basemap tiles are slow or unavailable. Country outlines remain interactive.
        {lastRetryAt && (
          <span className="ml-2 text-[11px] opacity-75">
            (last retry {lastRetryAt.toLocaleTimeString()})
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="ml-3 underline underline-offset-2 hover:no-underline disabled:opacity-50"
        aria-label="Retry loading basemap tiles"
      >
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-2 underline underline-offset-2 hover:no-underline"
        aria-label="Dismiss basemap notice"
      >
        Dismiss
      </button>
    </div>
  )
}
```

- [ ] **Step 7.4.2: Verify and commit**

```bash
npm run lint && tsc -b && npm run test:unit && npm run build
git -C E:/polworldmap add src/components/BasemapBanner.tsx
git -C E:/polworldmap commit -m "feat(a11y): BasemapBanner retry + clearer message + session dismissal"
```

### Task 7.5: E2E coverage for keyboard map nav

**Files:**
- Create: `e2e/keyboard-map-nav.spec.ts`
- Modify: `playwright.config.ts` (add the new spec to the `chromium-gpu` project)

- [ ] **Step 7.5.1: Create the spec**

```typescript
import { test, expect } from '@playwright/test'

test.describe('keyboard map navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded]')
  })

  test('Home resets view and announces via live region', async ({ page }) => {
    await page.locator('[role="application"]').focus()

    const mapEval = async () => {
      return page.evaluate(() => {
        const map = (window as unknown as { __funworldmap_map?: { getCenter: () => { lng: number; lat: number } } }).__funworldmap_map
        return map ? map.getCenter() : null
      })
    }
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(200)
    const shifted = await mapEval()

    await page.keyboard.press('Home')
    await page.waitForTimeout(1600)
    const reset = await mapEval()

    expect(shifted).not.toBeNull()
    expect(reset).not.toBeNull()
    if (shifted && reset) {
      expect(Math.abs(shifted.lng - reset.lng)).toBeGreaterThan(0.1)
    }

    const liveText = await page.locator('[aria-live="polite"]').textContent()
    expect(liveText).toContain('View reset')
  })

  test('focus ring is visible on the map container when tabbed to', async ({ page }) => {
    await page.locator('[role="application"]').focus()
    const hasOutline = await page.locator('[role="application"]').evaluate((el) => {
      const style = getComputedStyle(el)
      return style.outlineStyle !== 'none' && style.outlineWidth !== '0px'
    })
    expect(hasOutline).toBe(true)
  })
})
```

- [ ] **Step 7.5.2: Add the spec to the GPU project**

Edit `playwright.config.ts`, the `testMatch` for the `chromium-gpu` project:

```typescript
testMatch: ['map-and-countries.spec.ts', 'map-reliability.spec.ts', 'keyboard-map-nav.spec.ts'],
```

- [ ] **Step 7.5.3: Run the spec**

```bash
npx playwright test keyboard-map-nav.spec.ts
```
Expected: both tests pass.

### Task 7.6: E2E coverage for panel focus

**Files:**
- Create: `e2e/panel-focus.spec.ts`
- Modify: `playwright.config.ts` (add to `chromium` project)

- [ ] **Step 7.6.1: Create the spec**

```typescript
import { test, expect } from '@playwright/test'

test.describe('panel focus management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-map-loaded], [data-map-error]')
  })

  test('opening panel via search moves focus into panel', async ({ page }) => {
    await page.locator('#search-input').fill('France')
    await page.keyboard.press('Enter')
    await page.waitForSelector('[data-testid="country-panel"]')

    const active = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
    expect(active).toBe('panel-close')
  })

  test('Esc closes panel and returns focus to search', async ({ page }) => {
    await page.locator('#search-input').fill('France')
    await page.keyboard.press('Enter')
    await page.waitForSelector('[data-testid="country-panel"]')

    await page.keyboard.press('Escape')
    await page.waitForSelector('[data-testid="country-panel"]', { state: 'detached' })

    const activeId = await page.evaluate(() => document.activeElement?.id)
    expect(activeId).toBe('search-input')
  })
})
```

- [ ] **Step 7.6.2: Add to the `chromium` project**

Edit `playwright.config.ts`, append `'panel-focus.spec.ts'` to the `testMatch` for the `chromium` project.

- [ ] **Step 7.6.3: Run**

```bash
npx playwright test panel-focus.spec.ts --project=chromium
```
Expected: both tests pass.

### Task 7.7: Final verification and commit

- [ ] **Step 7.7.1: Full verification**

```bash
cd E:/polworldmap
npm run lint && tsc -b && npm run test:unit && npm run build && npm run test:e2e
```
Expected: all green across both Playwright projects.

- [ ] **Step 7.7.2: Manual keyboard-only smoke test**

In a browser:
1. Load the site. Use `Tab` repeatedly — skip links should appear.
2. Tab to the map container. Confirm a visible teal/teal-light focus ring.
3. Press `Home`. Camera flies to world view. Live-region announces (use a screen reader or inspect the DOM).
4. Press `+` and `-`. Camera zooms. No errors in console.
5. Press `/`. Search input receives focus.
6. Type `France`, press `Enter`. Panel opens; focus moves to the close button.
7. Press `Esc`. Panel closes; focus returns to search input.
8. Trigger `BasemapBanner` by blocking `tiles.openfreemap.org` in devtools → Network → Block request URL; reload. Banner appears with Retry and Dismiss.

- [ ] **Step 7.7.3: Commit the e2e additions**

```bash
git -C E:/polworldmap add e2e/keyboard-map-nav.spec.ts e2e/panel-focus.spec.ts playwright.config.ts
git -C E:/polworldmap commit -m "$(cat <<'EOF'
test(a11y): e2e coverage for keyboard map nav and panel focus management

Adds map-nav spec (Home reset, focus-ring presence) to chromium-gpu,
and panel-focus spec (focus moves in on open, returns to search on
close) to chromium.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Final Gate

- [ ] **Step F.1: Summary diff review**

Run:
```bash
git -C E:/polworldmap log --oneline main..HEAD
```
Expected: ~25–30 commits, each small and focused. No commit should mix unrelated phases.

- [ ] **Step F.2: Final full verification**

```bash
cd E:/polworldmap
npm run lint && tsc -b && npm run test:unit && npm run build && npm run test:e2e
```
Expected: all green.

- [ ] **Step F.3: Merge strategy**

Open a PR from `plan/findings-and-voting-removal` to `main`. Review the commit list (not a squash) — each commit is an independently-revertable unit.

If review requests per-phase rollback, cherry-pick. If the review passes wholesale, merge with the `--no-ff` strategy to preserve the branch shape.
