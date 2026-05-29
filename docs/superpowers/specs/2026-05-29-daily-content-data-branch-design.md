# Daily content on a `data` branch — design

**Date:** 2026-05-29
**Author:** Tobias Ens (with Claude)
**Status:** Spec — pending implementation plan

## Summary

The daily-puzzle workflow commits `public/daily/index.json` to `main` four times a day. Those `chore(daily): update daily-puzzle window` commits are now **137 of 417 commits (33%)** of `main`'s history — they bury the real development history in `git log` and the GitHub commits view, which is the most visible blemish for a showcase repository.

This change moves the generated daily index off `main` to a dedicated orphan **`data` branch**. The bot keeps committing the index there (so the GitHub Actions scheduled-workflow keepalive and the per-date content audit trail are both preserved), but `main`'s history stops accumulating bot commits going forward. Production fetches the index from the `data` branch at deploy time; local dev and e2e generate it on demand.

The reproducibility constraint that would normally complicate this is explicitly waived: the project owner confirmed that a past-but-still-in-window day's puzzle may change when the index regenerates (no meaningful userbase to protect yet). That removes any need to preserve exact past picks — the `data` branch is for provenance and keepalive, not correctness.

## Context — how it works today

- **`daily-puzzle.yml`** (cron `15 0,6,12,18 * * *`): checks out `main`, runs `daily:validate` then `daily:generate` (which reads the existing `public/daily/index.json`, rebuilds a 30-day rolling window, writes it back), and commits + pushes the file to `main` if it changed.
- **`deploy.yml`**: triggers on push to `main` and on the daily workflow's `workflow_run` completion; runs `npm run build` (Vite copies `public/daily/index.json` → `dist/daily/index.json`); deploys to GitHub Pages.
- **Runtime**: `src/game/daily/useDailyPuzzles.ts` fetches `/daily/index.json`; on failure it sets status `unavailable` (graceful — no crash).
- **Tests**: the e2e `webServer` builds via `npm run build:e2e` + `vite preview`; daily-asserting specs route-stub `**/daily/index.json` via `stubDailyIndex` / `seedDailyHistory` in `e2e/helpers.ts`.

## Goals

- `main` accrues **zero** new `chore(daily)` bot commits after this lands.
- The live site's `/daily/index.json` stays as fresh as it is today (window advances on the same 4×/day cadence).
- Per-date content provenance is preserved (the `data` branch's git history is the authoritative record of what was served on each date).
- The scheduled-workflow keepalive is preserved (the bot still pushes to the repo on its cron, which resets GitHub's 60-day auto-disable clock).
- e2e behavior is **identical to today** — a real index is served during the e2e run, with no dependence on the (now-removed) committed file.
- Local `npm run dev` shows a current daily with no manual setup.

## Non-goals

- **Rewriting existing history.** The 137 existing `chore(daily)` commits stay in `main`. (Owner decision: leaving them. A filter-branch/force-push rewrite is explicitly out of scope and would disrupt open PRs and clones.)
- **Branch pruning.** Cleaning up the 12 stale local + 17 stale remote branches is a separate task tracked independently; it is not part of this change.
- **Changing the daily-content algorithm.** `scripts/daily-content/generate-index.ts` and `picker.ts` are not modified. Their unit tests stay byte-identical-green.
- **Preserving exact past picks across regenerations.** Waived (see Summary).
- **New analytics, new UI, or any `src/` runtime change** beyond the gitignore of a generated artifact.

## The model

```
main (code only)                 data branch (orphan, content only)
  ├─ scripts/daily-content/...      └─ index.json   ← bot commits here 4×/day
  ├─ src/ ...                                          (provenance + keepalive)
  └─ public/daily/index.json  ← gitignored; generated on demand for dev/e2e
                                          │
deploy.yml ──fetch index.json from data──┘──► public/daily/ ──vite build──► dist/daily/index.json ──► Pages
```

`main` holds only code. The daily index is a generated artifact: produced by the bot onto the `data` branch for production, and generated locally on demand for dev and e2e. It is never committed to `main`.

---

## Component 1 — The `data` branch + one-time bootstrap

**Size:** one-time manual setup, ~5 commands.

A new **orphan** branch `data` containing a single file `index.json` at its root (no code, no shared history with `main`).

Bootstrap (run once, before the workflow changes merge so the first deploy can fetch it):

```bash
# from a clean main checkout
cp public/daily/index.json /tmp/seed-index.json   # capture the current live window
git switch --orphan data
git rm -rf . >/dev/null 2>&1 || true               # clear inherited index + working tree
cp /tmp/seed-index.json index.json
git add index.json
git commit -m "chore(data): seed daily-index branch"
git push -u origin data
git switch chore/daily-content-data-branch
```

**Verification:** `git ls-tree origin/data` lists exactly `index.json`; `git log origin/data` shows the seed commit and nothing from `main`.

## Component 2 — Rewrite `daily-puzzle.yml` to commit to `data`

**Size:** one workflow file, ~15 changed lines.

Keep `name: Daily puzzle index` **unchanged** (deploy's `workflow_run` trigger matches on this name — renaming it would silently break the deploy chain). Keep the cron and `workflow_dispatch`. Replace the commit-to-`main` step with: check out the `data` branch into a subdir, seed it as the generator's "existing" input, generate, copy the result back, commit + push to `data`.

```yaml
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
      - uses: actions/checkout@v6
        with:
          ref: data
          path: .daily-data # data branch: prior index.json
      - uses: actions/setup-node@v6
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: |
          mkdir -p public/daily
          cp .daily-data/index.json public/daily/index.json   # carry-forward seed
      - run: npm run daily:validate
      - run: npm run daily:generate # rewrites public/daily/index.json
      - name: Commit to data branch if changed
        run: |
          cp public/daily/index.json .daily-data/index.json
          cd .daily-data
          if [[ -z "$(git status --porcelain index.json)" ]]; then
            echo "No change — index already current."; exit 0
          fi
          git config user.name 'funworldmap-bot'
          git config user.email 'bot@funworldmap.com'
          git add index.json
          git commit -m "chore(data): update daily-puzzle window"
          git push origin HEAD:data
```

**Verification:** a `workflow_dispatch` run produces a commit on `origin/data` (not `main`) when the window has advanced, and exits cleanly with no commit when it has not. `main` shows no new commit.

## Component 3 — `deploy.yml` fetches the index from `data`

**Size:** one workflow file, ~8 added lines.

Triggers stay exactly as today (`push: [main]` + `workflow_run` on "Daily puzzle index"). Before `npm run build`, obtain the index from the `data` branch and place it at `public/daily/index.json`. Fall back to generating it if the `data` branch is unreachable, so the site never ships without a daily.

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
  # env: VITE_SENTRY_DSN / VITE_CF_WA_TOKEN / VITE_ANALYTICS_ENDPOINT — unchanged from current deploy.yml
```

**Verification:** a deploy run logs "Using data-branch index"; the deployed `/daily/index.json` matches `origin/data:index.json`; `dist/daily/index.json` is present in the Pages artifact.

## Component 4 — Stop tracking the generated index on `main`; generate on demand

**Size:** `.gitignore` (2 lines), `package.json` (1 script + webServer string), one `git rm --cached`.

- `git rm --cached public/daily/index.json` and add `public/daily/index.json` + `.daily-data/` to `.gitignore`. The index is a generated artifact; it is no longer a tracked source file on `main`.
- Add `"predev": "npm run daily:generate"` to `package.json` so `npm run dev` always serves a current local daily.
- Prefix the Playwright `webServer.command` with generation so the e2e preview serves a real index (preserving today's behavior):
  ```ts
  command: 'npm run daily:generate && npm run build:e2e && npm run preview -- --port 5173 --strictPort',
  ```

**Verification:** `git status` is clean after `npm run dev` (the generated file is ignored); `npm run build:e2e` followed by inspecting `dist/daily/index.json` shows a current window; the full e2e suite is green.

## Component 5 — Docs

**Size:** 3 doc edits.

- `docs/systems/daily-puzzle.md` — describe the `data`-branch model, the deploy fetch, and the dev/e2e on-demand generation.
- `docs/ops/runbook.md` — add the `data`-branch bootstrap, the fallback behavior, and a note on the 60-day scheduled-workflow keepalive (now provided by the bot's pushes to `data`; dependabot activity is a secondary safeguard).
- `CONTRIBUTING.md` — one line noting the index is generated, not committed, and that `npm run dev` produces it automatically.

**Verification:** no doc references the old "commit index.json to main" flow; `docs/index.md` links still resolve.

---

## Invariants / watch-outs (the gotchas caught during design)

- **No `prebuild` hook for generation.** Deploy runs `npm run build` after fetching the index from `data`. A `prebuild: daily:generate` would regenerate a _fresh_ index that overwrites the fetched one, silently breaking provenance (the served index would no longer match `data`). Generation is wired only into `predev` and the e2e `webServer` command — never the production `build` path.
- **`build:e2e` is a separate script.** npm `pre<name>` hooks match the exact script name, so a `build` hook does not run for `build:e2e`. e2e generation therefore lives in the Playwright `webServer` command explicitly.
- **Workflow `name:` is load-bearing.** `deploy.yml`'s `workflow_run` matches `workflows: ["Daily puzzle index"]`. Do not rename `daily-puzzle.yml`'s `name:`.
- **Bootstrap precedes the deploy change.** If `deploy.yml`'s fetch step merges before `origin/data` exists, the first deploy takes the fallback path (generates fresh) — acceptable, but the bootstrap should land first to use the seeded content.

## Risks

- **Low–medium.** The change is in CI/build wiring, not runtime code. `src/` is untouched except for one gitignore entry; the daily-content scripts and their unit tests are untouched.
- **Two-checkout commit in the daily workflow** is the most novel piece. Mitigated by the `workflow_dispatch` verification run before relying on the cron.
- **Keepalive dependency shifts** from main-commits to data-branch-commits. Both are repository pushes, so GitHub's 60-day clock is reset identically. Documented in the runbook.

## Files touched

| File                                 | Change                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `.github/workflows/daily-puzzle.yml` | Commit generated index to `data` branch instead of `main` (two-checkout pattern); `name:` unchanged |
| `.github/workflows/deploy.yml`       | Fetch index from `data` (with generate fallback) before build; triggers unchanged                   |
| `.gitignore`                         | Ignore `public/daily/index.json` and `.daily-data/`                                                 |
| `public/daily/index.json`            | `git rm --cached` (untrack; now generated on demand)                                                |
| `package.json`                       | Add `predev` → `daily:generate`                                                                     |
| `playwright.config.ts`               | Prefix `webServer.command` with `daily:generate`                                                    |
| `docs/systems/daily-puzzle.md`       | Document the `data`-branch model                                                                    |
| `docs/ops/runbook.md`                | Bootstrap, fallback, keepalive note                                                                 |
| `CONTRIBUTING.md`                    | One-line note: index is generated, not committed                                                    |
| `data` branch (new, orphan)          | One-time bootstrap holding `index.json`                                                             |

## Out of scope (named explicitly)

- Rewriting the 137 existing `chore(daily)` commits out of `main`'s history (owner: leave them).
- Branch pruning (separate task).
- Any change to `generate-index.ts` / `picker.ts` / the daily-content algorithm.
- Any `src/` runtime change beyond the gitignore.
- Preserving exact past daily picks across regenerations (waived).
