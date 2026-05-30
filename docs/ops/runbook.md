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

| Source                          | Cadence                        | Status        |
| ------------------------------- | ------------------------------ | ------------- |
| REST Countries v3.1             | Quarterly review               | Live upstream |
| CIA World Factbook              | None — archive frozen Jan 2026 | Read-only     |
| world-atlas (Natural Earth 50m) | On npm upstream release        | Stable        |
| flagcdn.com                     | Hotlinked at runtime           | No-op         |

> **Action:** Quarterly review is currently unowned. When a review is due, file an issue against the repo with label `data-freshness` and assign to a maintainer.

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

`.github/workflows/deploy.yml` builds on every push to `main` and after the `Daily puzzle index` workflow completes (`workflow_run`), publishing via `actions/deploy-pages`. No manual deploy step. Before building, it fetches the daily index from the `data` branch (see below). Secrets in use: `VITE_SENTRY_DSN`, `VITE_CF_WA_TOKEN`, `VITE_ANALYTICS_ENDPOINT` — all optional; each feature is env-gated and no-ops when unset.

## Daily content (`data` branch)

The generated daily index (`/daily/index.json`) is **not** committed to `main`. It lives on an orphan `data` branch, written there 4×/day by `daily-puzzle.yml`. This keeps `main`'s history free of bot commits while preserving (a) a per-date provenance trail and (b) repository activity that resets GitHub's 60-day scheduled-workflow auto-disable clock.

**Bootstrap (one-time / recovery).** If the `data` branch is lost, recreate it:

Recreate it from a throwaway repo so your working tree is never touched.
(Do **not** use `git switch --orphan data` + `git rm -rf .` in place: that
strips your tracked files — including `.gitignore` — and leaves untracked
artifacts that a stray `git add -A` could commit into the branch.)

```bash
npm run daily:generate                          # produce a current public/daily/index.json
tmp=$(mktemp -d)
cp public/daily/index.json "$tmp/index.json"
git -C "$tmp" init -q
git -C "$tmp" add index.json
git -C "$tmp" -c user.name='funworldmap-bot' -c user.email='bot@funworldmap.com' \
  commit -qm "chore(data): seed daily-index branch"
git -C "$tmp" push "$(git remote get-url origin)" HEAD:data
rm -rf "$tmp"
```

**Fallback.** If `deploy.yml` cannot read `origin/data:index.json`, it generates a fresh index at build time so the site never ships without a daily — but that index is not recorded on the `data` branch. A deploy log line `data branch unavailable — generating fresh.` means the `data` branch needs re-bootstrapping.
