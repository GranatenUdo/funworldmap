# Build and deployment

## Supported toolchain

Use Node **22.22.1**, as pinned in `.nvmrc`, and npm **10**. Install with `npm ci`; committed lockfiles cover the frontend and the optional `cloudflare-worker/` package separately. See [Contributing](../../CONTRIBUTING.md) for both setups.

Vite 8 uses Rolldown for production bundling; React 19 and TypeScript implement the application, with Tailwind CSS 4 configured in `src/index.css`. The development server does not replace TypeScript checking.

## Commands

| Command                 | Purpose                                                                  |
| ----------------------- | ------------------------------------------------------------------------ |
| `npm run dev`           | Development server with HMR on port 5173                                 |
| `npm run check`         | ESLint, TypeScript, and Vitest                                           |
| `npm run docs:check`    | Maintained-doc formatting and repository Markdown links/anchors/commands |
| `npm run docs:format`   | Format maintained documentation; preserve dated archives                 |
| `npm run build`         | Type-check and build static production output                            |
| `npm run bundle:budget` | Build and validate gzip budgets                                          |
| `npm run preview`       | Serve the production output locally                                      |
| `npm run build:e2e`     | Build with e2e-only test seams                                           |
| `npm run test:e2e`      | Playwright interaction tests                                             |
| `npm run format`        | Format source files                                                      |

Country and city data are checked in. Refresh them only as an intentional data change; builds and tests do not need source API credentials or data generation.

## Static output

`dist/` contains `index.html`, hashed application/CSS/MapLibre worker assets, a lazy world-atlas country chunk, and copied `public/` assets such as flags and fonts. MapLibre 6's worker is bundled with Vite's `?worker&url` import and configured before constructing the map.

The output can be served by a static host. The production configuration uses `/` as its base and a custom domain; deploying under a project subpath requires explicitly changing and testing the base. URL hashes carry application navigation.

Map tiles still come from external providers at runtime. Optional telemetry also makes network requests; a static build is not an offline package.

## Environment variables

See [`.env.example`](../../.env.example):

- `VITE_SENTRY_DSN`: optional browser error reporting.
- `VITE_CF_WA_TOKEN`: optional Cloudflare Web Analytics beacon.
- `VITE_ANALYTICS_ENDPOINT`: optional custom-event Worker endpoint.

Empty values disable their integration. These values are embedded in the public browser bundle, even when supplied through GitHub Actions secrets. Never place private credentials in `VITE_*` variables. `.env.e2e` enables test seams only for the e2e build; publish ordinary production output instead.

## GitHub Pages release path

The repository uses the Pages artifact API, **not a `gh-pages` branch**. The deployment workflow responds to completed CI and CodeQL runs. It verifies that both succeeded on the exact same `main` push SHA in this repository and that the SHA is still the tip of `main`.

It then checks out that SHA, builds production output with the optional telemetry settings, uploads the Pages artifact, rechecks the current branch tip, and deploys to the `github-pages` environment. PR, fork, scheduled-only, pending, failed, and stale runs cannot authorize deployment. Failed report aggregation also leaves the CI workflow unsuccessful and blocks release.

Required PR checks are the aggregate **Required checks** job and CodeQL **Analyze (javascript-typescript)**. Report merging remains visible but is not part of the correctness aggregator. The aggregate fails unless frontend checks, Worker validation, documentation, and every Chromium shard succeed.

## Budgets and hosting operations

Gzip limits live in `scripts/bundle-budget/budgets.json`; every emitted asset must be classified. Account for worker assets as real bandwidth. Budget increases require separate measurement evidence and review.

Cache policy depends on the host: prefer revalidation for HTML and long-lived caching for hashed assets where configuration is available. GitHub Pages does not expose arbitrary per-path header configuration in this repository. See the [operations runbook](../ops/runbook.md) for incident recovery and data maintenance.
