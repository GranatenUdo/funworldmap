# Operations runbook

## Verify a release

1. Identify the intended commit and its CI and CodeQL runs in [GitHub Actions](https://github.com/GranatenUdo/funworldmap/actions).
2. Check that both push workflows succeeded for the same current `main` SHA. The Pages workflow rejects other events and stale SHAs.
3. Confirm the Pages deployment succeeded, then open [funworldmap.com](https://funworldmap.com). Verify the chooser becomes playable, try a country and city round, open a country panel, and check mobile layout and both themes.
4. Record the tested SHA, deployment URL, and any limitations in the PR or release record. A dry run or green unit suite is not production verification.

## Broken release

Create a revert branch and pull request for the offending commit. Run the required checks, merge through the protected-branch process, and let CI plus CodeQL authorize the new deployment. Verify the live site after it completes. Do not push directly to protected `main` or bypass the release gate.

Record the bad SHA, symptoms, corrective PR, and resulting deployment. Preserve traces or screenshots that explain the failure.

## Optional analytics Worker

The Worker is deployed separately from Pages. The frontend remains usable with all telemetry settings empty. Use the validation commands in [Contributing](../../CONTRIBUTING.md) before any intentional Worker release; `build:check` packages locally without publishing.

The checked-in configuration defines the Analytics Engine binding at the top level and a production route under `env.production`. Wrangler environment bindings are not automatically inherited. Before an actual release, confirm the selected environment, dataset binding, route, and account configuration together; do not assume a successful top-level dry run validates production resources. See [Analytics](../systems/analytics.md).

## Data freshness

Country/city facts are bundled snapshots. Review source status and licensing in [Data](../systems/data.md) and [Data collection](../systems/data-collection.md) before refreshing.

- REST Countries: review periodically; freshness is not automatic.
- CIA World Factbook archive: frozen source, not a live feed.
- world-atlas and flags: review upstream changes and attribution alongside updates.

For an intentional refresh, run `npm run update-data` or `npm run fetch-cities`, review every changed dataset/asset, then run checks and build. Large or surprising diffs need investigation before committing. Track the review date and source changes in the PR. Do not refresh data as an incidental part of dependency maintenance.

## Map-service degradation

The basemap probe can show a degradation notice; other source or rendering failures may prevent map readiness. Country rendering is not guaranteed if initialization fails. Check browser network/console output and distinguish an external tile outage, unsupported WebGL2, context loss, and a shipped application regression.

There is no configured automatic secondary-provider failover. Retry/reload may recover a transient outage. Never label an outage resolved solely because local fixtures passed: verify the real service and live site.

## Capacity and privacy

Use measured CDN/provider traffic and current account dashboards to assess capacity. Repository visitor counts are not bandwidth measurements, and map-provider traffic is separate from Pages traffic. Check current provider terms before proposing a hosting change; this repository does not promise a particular free quota.

Keep credentials and personal data out of public issues, logs, and screenshots. Use the [security policy](../../SECURITY.md) for sensitive reports.

## Repository maintenance

Dependabot covers the frontend, Worker, and GitHub Actions. Both npm projects need a clean install and appropriate validation after updates. The weekly/manual external-link workflow reports remote link failures independently of PR correctness gates.

Before changing GitHub settings, save their current values. Main protection requires pull requests, resolved conversations, and successful checks without requiring a second person's approval. Required check names and their GitHub App must be observed before enforcement. Update documentation and required contexts together if jobs are renamed.
