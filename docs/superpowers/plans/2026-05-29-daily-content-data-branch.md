# Daily content on a `data` branch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the generated daily index off `main` to an orphan `data` branch so `main` stops accruing `chore(daily)` bot commits, while preserving production freshness, per-date provenance, and the scheduled-workflow keepalive.

**Architecture:** The bot commits `index.json` to an orphan `data` branch 4×/day; `deploy.yml` fetches it from there at build time (with a generate-fallback); local dev and e2e generate it on demand. `main` no longer tracks the file.

**Tech Stack:** GitHub Actions (`actions/checkout@v6`), npm scripts (`tsx` generator), Vite 6 (`public/` → `dist/` copy), Playwright `webServer`.

**Spec:** [`docs/superpowers/specs/2026-05-29-daily-content-data-branch-design.md`](../specs/2026-05-29-daily-content-data-branch-design.md)

---

## Scope out (NOT in this plan)

- Rewriting the 137 existing `chore(daily)` commits in `main` (owner decision: leave them).
- Branch pruning (the 12 local + 17 remote stale branches — separate task).
- Any change to `scripts/daily-content/generate-index.ts`, `picker.ts`, or the daily algorithm.
- Any `src/` runtime change beyond the gitignore of a generated artifact.

## File Structure

| File                                                                     | Responsibility after this change                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `data` branch (new, orphan)                                              | Holds `index.json`; bot commits here; deploy reads here         |
| `.github/workflows/daily-puzzle.yml`                                     | Generate + commit the index to `data` (not `main`)              |
| `.github/workflows/deploy.yml`                                           | Fetch index from `data` (generate-fallback) before build        |
| `.gitignore`                                                             | Ignore the generated `public/daily/index.json` + `.daily-data/` |
| `package.json`                                                           | `predev` regenerates the index for local dev                    |
| `playwright.config.ts`                                                   | `webServer` regenerates the index before the e2e build          |
| `docs/systems/daily-puzzle.md`, `docs/ops/runbook.md`, `CONTRIBUTING.md` | Document the `data`-branch model                                |

## Pre-flight

- [ ] **Confirm clean starting state.**

Run: `git status --porcelain && git branch --show-current`
Expected: empty status; branch `chore/daily-content-data-branch`.

- [ ] **Confirm the seed file exists and is current.**

Run: `node -e "const j=require('./public/daily/index.json'); console.log(j.window)"`
Expected: a `{ start, end }` object whose `end` is today (UTC). This file seeds the `data` branch.

---

## Task 1: Bootstrap the orphan `data` branch

> ⚠️ This task pushes a **new remote branch** to `origin`. It is the one outward-facing action in this plan — get explicit go-ahead before the push step.

**Files:** none on `main`; creates remote branch `data`.

- [ ] **Step 1: Capture the current index as the seed.**

Run: `cp public/daily/index.json /tmp/seed-index.json && head -3 /tmp/seed-index.json`
Expected: prints the first lines of the JSON (`{`, `"generatedAt": ...`, `"window": ...`).

- [ ] **Step 2: Create the orphan branch with only `index.json`.**

```bash
git switch --orphan data
git rm -rf . >/dev/null 2>&1 || true
cp /tmp/seed-index.json index.json
git add index.json
git commit -m "chore(data): seed daily-index branch"
```

Run the commit, then: `git ls-tree --name-only HEAD`
Expected: exactly `index.json` (no other files).

- [ ] **Step 3: Push the branch (requires go-ahead).**

Run: `git push -u origin data`
Expected: `* [new branch] data -> data`.

- [ ] **Step 4: Return to the feature branch and verify the remote branch.**

```bash
git switch chore/daily-content-data-branch
git ls-remote --heads origin data
git show origin/data:index.json | head -3
```

Expected: `ls-remote` prints one `refs/heads/data` line; `git show` prints the seed JSON's first lines.

_No commit on the feature branch in this task — the commit lives on `data`._

---

## Task 2: Rewrite `daily-puzzle.yml` to commit to `data`

**Files:** Modify `.github/workflows/daily-puzzle.yml` (full replacement of the `jobs:` body).

- [ ] **Step 1: Replace the workflow file with the data-branch version.**

Write `.github/workflows/daily-puzzle.yml` exactly:

```yaml
name: Daily puzzle index

on:
  schedule:
    # 00:15, 06:15, 12:15, 18:15 UTC — caps the worst-case timezone-ahead gap at ~6h.
    - cron: '15 0,6,12,18 * * *'
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: daily-puzzle
  cancel-in-progress: false

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6 # main: generator + pools

      - uses: actions/checkout@v6 # data branch: prior index.json + push target
        with:
          ref: data
          path: .daily-data
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Seed prior window for carry-forward (tolerant if absent)
        run: |
          mkdir -p public/daily
          cp .daily-data/index.json public/daily/index.json 2>/dev/null \
            || echo "No prior index on data branch — generating fresh (no carry-forward)."

      - name: Validate pools
        run: npm run daily:validate

      - name: Generate index
        run: npm run daily:generate

      - name: Commit to data branch if changed
        run: |
          cp public/daily/index.json .daily-data/index.json
          cd .daily-data
          if [[ -z "$(git status --porcelain index.json)" ]]; then
            echo "No changes — index already current."
            exit 0
          fi
          git config user.name 'funworldmap-bot'
          git config user.email 'bot@funworldmap.com'
          git add index.json
          git commit -m "chore(data): update daily-puzzle window"
          git push origin HEAD:data
```

- [ ] **Step 2: Structural sanity check (tooling-free — `js-yaml` is not installed).**

Run: `f=.github/workflows/daily-puzzle.yml; grep -qE '^name: Daily puzzle index' $f && grep -q 'ref: data' $f && grep -q 'git push origin HEAD:data' $f && echo "STRUCTURE OK"`
Expected: prints `STRUCTURE OK` — confirms the `name:` is preserved (deploy's `workflow_run` matches on it), the data checkout is present, and the push targets `data`. YAML validity is enforced authoritatively by the GitHub Actions parser on push; the pre-merge `workflow_dispatch` in Task 6 is the real behavioral check.

- [ ] **Step 3: Commit.**

```bash
git add .github/workflows/daily-puzzle.yml
git commit -m "chore(ci): daily workflow commits index to data branch"
```

---

## Task 3: `deploy.yml` fetches the index from `data`

**Files:** Modify `.github/workflows/deploy.yml` — insert one step between `npm ci` and `Build`.

- [ ] **Step 1: Insert the fetch-from-data step.**

`.github/workflows/deploy.yml` currently has (lines 32–34, inside `jobs.build.steps`, indented **6 spaces**):

```yaml
- run: npm ci
- name: Build
  run: npm run build
```

Insert a new step **between** `- run: npm ci` and `- name: Build`, at the same **6-space** step indentation. After the edit the region reads exactly (mind the indentation — the fenced sample below may render dedented, but the real file uses 6 spaces for `- name:` and 8 for `run:`):

```yaml
- run: npm ci

- name: Fetch daily index from data branch
  run: |
    mkdir -p public/daily
    if git fetch origin data && git cat-file -e origin/data:index.json 2>/dev/null; then
      git show origin/data:index.json > public/daily/index.json
      echo "Using data-branch index."
    else
      echo "data branch unavailable — generating fresh."
      npm run daily:generate
    fi

- name: Build
  run: npm run build
```

Do not touch the `env:` block under `Build` or any other line.

- [ ] **Step 2: Verify the fetch command works locally against the real `data` branch.**

Run:

```bash
git fetch origin data && git cat-file -e origin/data:index.json && echo "EXISTS"
git show origin/data:index.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('window:', JSON.parse(s).window))"
```

Expected: prints `EXISTS` then `window: { start: ..., end: ... }`. This is exactly what the deploy step runs.

- [ ] **Step 3: Commit.**

```bash
git add .github/workflows/deploy.yml
git commit -m "chore(ci): deploy fetches daily index from data branch"
```

---

## Task 4: Untrack the index; generate it on demand for dev + e2e

**Files:** Modify `.gitignore`, `package.json`, `playwright.config.ts`; untrack `public/daily/index.json`.

This is one commit — untracking without the e2e/dev generation would break those paths, so they land together.

- [ ] **Step 1: Add the gitignore entries.**

Append to `.gitignore`:

```
# Daily content — generated on demand (lives on the `data` branch in prod)
public/daily/index.json
.daily-data/
```

- [ ] **Step 2: Untrack the file (keep it in the working tree).**

Run: `git rm --cached public/daily/index.json`
Expected: `rm 'public/daily/index.json'` (staged deletion; the file remains on disk).

- [ ] **Step 3: Verify it is now ignored.**

Run: `git check-ignore public/daily/index.json`
Expected: prints `public/daily/index.json` (confirms the ignore rule matches).

- [ ] **Step 4: Add the `predev` script.**

In `package.json` `scripts`, add the line immediately above `"dev": "vite",`:

```json
    "predev": "npm run daily:generate",
```

- [ ] **Step 5: Prefix the Playwright webServer with generation.**

In `playwright.config.ts`, change the `webServer.command` from:

```ts
    command: 'npm run build:e2e && npm run preview -- --port 5173 --strictPort',
```

to:

```ts
    command: 'npm run daily:generate && npm run build:e2e && npm run preview -- --port 5173 --strictPort',
```

- [ ] **Step 6: Verify generation + build produces the served file.**

Run: `npm run daily:generate && npm run build && test -f dist/daily/index.json && echo "DIST OK"`
Expected: build completes; prints `DIST OK`. Then confirm the working tree stays clean (file ignored):
Run: `git status --porcelain public/daily/index.json`
Expected: empty output.

- [ ] **Step 7: Commit.**

```bash
git add .gitignore package.json playwright.config.ts
git commit -m "chore(daily): generate index on demand; untrack from main"
```

---

## Task 5: Update the docs

**Files:** Modify `docs/systems/daily-puzzle.md`, `docs/ops/runbook.md`, `CONTRIBUTING.md`.

- [ ] **Step 1: `daily-puzzle.md` — Lifecycle step 1.**

Replace the "Content generation" bullet (currently item 1 under `## Lifecycle`) with:

```markdown
1. **Content generation.** A GitHub Actions workflow
   (`.github/workflows/daily-puzzle.yml`) runs four times a day to regenerate
   the daily index from the curated pools in `scripts/daily-content/` and
   commits it to the orphan **`data` branch** — not `main`, so `main`'s
   history stays free of bot commits. The picker is deterministic: seeded by
   date and falls through to a salted retry on collisions with the last 30
   days. `deploy.yml` fetches the index from the `data` branch at build time
   and serves it as `/daily/index.json`. Locally and in e2e the index is
   generated on demand (`predev` / the Playwright `webServer`), never
   committed to `main`.
```

- [ ] **Step 2: `daily-puzzle.md` — Rollback step 3.**

Replace the "Daily index." bullet under `### Rollback` with:

```markdown
3. **Daily index.** The index lives on the `data` branch and is regenerated
   every 6 h by `daily-puzzle.yml`. To pause daily content delivery, disable
   that workflow. To serve a specific frozen index, commit it to the `data`
   branch and disable regeneration; `deploy.yml` picks it up on the next
   deploy. See `docs/ops/runbook.md` § "Daily content (`data` branch)" for the
   bootstrap and fallback.
```

- [ ] **Step 3: `runbook.md` — Deploy Workflow section + new Daily content section.**

(a) Replace the body of `## Deploy Workflow` with this prose (plain markdown paragraph — no code fence):

> `.github/workflows/deploy.yml` builds on every push to `main` and after the `Daily puzzle index` workflow completes (`workflow_run`), publishing via `actions/deploy-pages`. No manual deploy step. Before building, it fetches the daily index from the `data` branch (see below). Secrets in use: `VITE_SENTRY_DSN`, `VITE_CF_WA_TOKEN`, `VITE_ANALYTICS_ENDPOINT` — all optional; each feature is env-gated and no-ops when unset.

(b) Then append a new section. Its heading + prose (plain markdown):

> ## Daily content (`data` branch)
>
> The generated daily index (`/daily/index.json`) is **not** committed to `main`. It lives on an orphan `data` branch, written there 4×/day by `daily-puzzle.yml`. This keeps `main`'s history free of bot commits while preserving (a) a per-date provenance trail and (b) repository activity that resets GitHub's 60-day scheduled-workflow auto-disable clock.
>
> **Bootstrap (one-time / recovery).** If the `data` branch is lost, recreate it with the bash snippet below.
>
> **Fallback.** If `deploy.yml` cannot read `origin/data:index.json`, it generates a fresh index at build time so the site never ships without a daily — but that index is not recorded on the `data` branch. A deploy log line `data branch unavailable — generating fresh.` means the `data` branch needs re-bootstrapping.

(c) Under the **Bootstrap** sentence, insert this as a normal ` ```bash ` fenced block in the doc:

```
npm run daily:generate                              # produces public/daily/index.json
cp public/daily/index.json /tmp/seed-index.json
git switch --orphan data
git rm -rf . >/dev/null 2>&1 || true
cp /tmp/seed-index.json index.json
git add index.json && git commit -m "chore(data): seed daily-index branch"
git push -u origin data
```

- [ ] **Step 4: `CONTRIBUTING.md` — note the generated artifact.**

Immediately after the `Scripts:` list (after the `npm run update-data` line), add:

```markdown
> The daily puzzle index (`public/daily/index.json`) is a generated artifact —
> it is not committed to `main`. `npm run dev` regenerates it automatically
> (via the `predev` hook); in production it is served from the `data` branch.
> See `docs/systems/daily-puzzle.md`.
```

- [ ] **Step 5: Verify no stale references remain.**

Run: `grep -rn "push it to .main. and disable\|commits + pushes the file to .main\|regenerated every 6 h by\s*$" docs/ || echo "NONE"`
Expected: `NONE` (the old commit-to-main phrasing is gone). Also confirm links resolve:
Run: `grep -rn "data. branch" docs/systems/daily-puzzle.md docs/ops/runbook.md | head`
Expected: the new `data`-branch references are present.

- [ ] **Step 6: Commit.**

```bash
git add docs/systems/daily-puzzle.md docs/ops/runbook.md CONTRIBUTING.md
git commit -m "docs(daily): document data-branch model"
```

---

## Task 6: Full verification + open PR

**Files:** none (verification + PR).

- [ ] **Step 1: Static checks.**

Run: `npm run lint && tsc -b && npm run test:unit`
Expected: lint 0 errors; `tsc` exits 0; vitest `487 passed` (the generator's unit tests are unchanged and stay green).

- [ ] **Step 2: Kill any stray dev server (avoids the reuseExistingServer trap).**

Run: `npx --yes kill-port 5173 2>/dev/null || true`
Expected: port 5173 free (no background `npm run dev` that Playwright would reuse without `VITE_TEST_HOOKS`).

- [ ] **Step 3: Run the chromium e2e project.**

Run: `npx playwright test --project=chromium`
Expected: all pass (the `webServer` now generates the index first; daily specs that stub are unaffected, non-stubbing specs get a real index exactly as before). If anything fails, read the trace per CLAUDE.md — do not re-run blindly.

- [ ] **Step 4: Push the feature branch and open the PR.**

```bash
git push -u origin chore/daily-content-data-branch
gh pr create --base main --title "chore(ci): daily content on a data branch" \
  --body "Implements docs/superpowers/specs/2026-05-29-daily-content-data-branch-design.md. Moves the generated daily index off main to an orphan \`data\` branch (provenance + keepalive preserved); deploy fetches from there; dev/e2e generate on demand. Existing history left untouched per owner decision.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Expected: PR URL printed. Confirm CI (fast + e2e + merge-reports) goes green on the PR.

- [ ] **Step 5: Pre-merge validation of the data-branch push (de-risks the only un-local-testable part).**

> ⚠️ Outward-facing: dispatches a real workflow run that pushes to the `data` branch. Get go-ahead (same as Task 1's push).

This validates the Task 2 two-checkout push mechanism **before** merging, while it can do no harm to production. `daily-puzzle.yml` is already registered on `main` (this is a modification, not a new file), so it is dispatchable; `--ref` runs the feature branch's version. The run pushes to `data` (advancing the window — the intended behavior) and does **not** trigger deploy: deploy's `workflow_run` filters `branches: [main]`, and this run's head branch is the feature branch.

```bash
gh workflow run "Daily puzzle index" --ref chore/daily-content-data-branch
# wait for it to finish, then:
gh run list --workflow="Daily puzzle index" --branch chore/daily-content-data-branch --limit 1
git fetch origin
git log origin/data -1 --oneline      # new chore(data) commit (or unchanged if window current)
git log origin/main -1 --oneline      # MUST be unchanged — no chore(daily) on main
```

Expected: the run concludes `success`; `origin/data` carries the bot commit (or is unchanged if the window was already current); `origin/main` is untouched. If the run fails at the push step, the cause is almost always credentials on the data checkout — confirm `persist-credentials`/`token` on the second `actions/checkout`, fix on the branch, and re-dispatch before merging.

---

## Post-merge verification (after the PR merges to `main`)

The push mechanism is validated pre-merge (Step 5). These remaining checks exercise the live **deploy** path and can only run after merge. Run them once and record the result on the PR.

- [ ] **Deploy uses the data-branch index.** The triggered "Deploy to GitHub Pages" run logs `Using data-branch index.` (not the fallback line), and `curl -fsSL https://funworldmap.com/daily/index.json | jq .window.end` equals today (UTC).
- [ ] **Production health smoke still green.** The next scheduled `Production Health Smoke` run passes (it validates the live `index.json` window).

---

## Self-review notes (author)

- **Spec coverage:** Component 1 → Task 1; Component 2 → Task 2; Component 3 → Task 3; Component 4 → Task 4; Component 5 → Task 5; verification criteria → Tasks 2/3/4 steps + Task 6 + Post-merge. All five spec components have a task.
- **Invariants honored:** no `prebuild` hook anywhere (generation is only in `predev` + the `webServer` command); `build:e2e` generation is in the Playwright command, not an npm hook; `daily-puzzle.yml`'s `name:` is unchanged so the `workflow_run` deploy trigger still matches.
- **Type/string consistency:** the `data` branch file is `index.json` at the branch root in every reference (Task 1 creates it, Task 2 reads/writes `.daily-data/index.json`, Task 3 reads `origin/data:index.json`).
- **Residual risk gated:** the only part not verifiable on a local machine is the GitHub Actions two-checkout push (Task 2). Task 6 Step 5 dispatches that workflow on the feature branch _before_ merge — it pushes to `data` but cannot trigger deploy — so a credentials/auth failure surfaces pre-merge with a contained blast radius, not in production.
- **Self-heal:** the daily workflow's seed `cp` tolerates a missing prior index (generates fresh), and `deploy.yml` falls back to generating if `data` is unreachable — neither path can ship an empty daily.
