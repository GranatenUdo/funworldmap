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

| Source                          | Cadence                             | Status        |
| ------------------------------- | ----------------------------------- | ------------- |
| REST Countries v3.1             | Quarterly review                    | Live upstream |
| CIA World Factbook              | None — archive frozen Jan 2026      | Read-only     |
| world-atlas (Natural Earth 50m) | On npm upstream release             | Stable        |
| flagcdn.com (SVG flags)         | Refreshed on each `update-data` run | Static        |

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

`.github/workflows/deploy.yml` builds on every push to `main`, publishing via `actions/deploy-pages`. No manual deploy step. Secrets in use: `VITE_SENTRY_DSN`, `VITE_CF_WA_TOKEN`, `VITE_ANALYTICS_ENDPOINT` — all optional; each feature is env-gated and no-ops when unset.

The orphan `data` branch that previously held the daily content index is no longer needed. It may be deleted as optional cleanup: `git push origin --delete data`.
