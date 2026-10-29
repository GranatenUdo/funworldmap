# Contributing to funworldmap

Contributions that make geography more enjoyable, the data more transparent, or the project easier to maintain are welcome. Read the [code of conduct](CODE_OF_CONDUCT.md) and [product purpose](docs/purpose.md) first.

## Set up

Use Node.js **22.22.1** (`.nvmrc`) and its bundled npm **10**. Package engine declarations apply to both the app and Worker. Other Node major versions are not supported; when debugging localStorage/test-environment failures, check `node --version` first.

```bash
git clone https://github.com/GranatenUdo/funworldmap.git
cd funworldmap
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173). With nvm, run `nvm install` and `nvm use`; nvm-windows users can run `nvm install 22.22.1` and `nvm use 22.22.1`. The app's bundled datasets need no generation step.

`.env.example` lists optional telemetry settings. Copy it to `.env.local` only if needed. All `VITE_*` values are included in browser builds: never put private credentials there. Leave telemetry empty for local development and tests.

## Check a change

```bash
npm run check
npm run docs:check
npm run bundle:budget
```

`check` runs lint, type checking, and Vitest. `bundle:budget` builds production files in `dist/` and enforces the existing gzip ceilings. `npm run format` formats source files; `npm run docs:format` formats maintained documentation. Husky runs lint-staged on commits. Review formatter changes before committing.

### Browser tests

```bash
npx playwright install chromium firefox webkit
npm run test:e2e -- --project=chromium --workers=2
npm run test:e2e -- --project=mobile-chromium --project=mobile-webkit --project=desktop-firefox-touch --workers=2
```

On Linux, browser installation may require `npx playwright install --with-deps`. Playwright builds an e2e-specific bundle and starts its preview server. Set `E2E_PORT` if 5173 is occupied. Do not point tests at an ordinary production build: it has no test seams.

CI runs a sharded Chromium subset. GPU-sensitive exclusions and the other browser projects require local checks; a green CI badge does not cover them. See [testing](docs/systems/testing.md), the [project matrix](docs/testing/playwright-matrix.md), and the deterministic-test rules in [AGENTS.md](AGENTS.md). Use readiness helpers and test seams; never add arbitrary sleeps, force-click workarounds, or extra retries to conceal failures.

### Optional analytics Worker

The frontend runs without this service. To validate Worker changes without deployment:

```bash
npm ci --prefix cloudflare-worker
npm run typecheck --prefix cloudflare-worker
npm test --prefix cloudflare-worker
npm run build:check --prefix cloudflare-worker
```

Install the root dependencies first: Worker tests use root Vitest. The dry run packages the top-level Worker configuration; it neither publishes code nor proves production bindings exist. Both npm lockfiles are committed and both dependency trees must be checked when affected.

## Make a focused pull request

1. Open an issue before proposing major behavior, new data fields, or architecture changes.
2. Branch from `main`. For a non-trivial change, commit the specification and reviewed implementation plan before code; see the [planning workflow](docs/superpowers/README.md).
3. Add regression coverage for behavior changes, update the owning documentation, and remove obsolete code/tests in the same change.
4. Run the relevant checks above. Report failures, browser/environment limitations, and checks you did not run.
5. Explain the problem and resulting behavior in the PR, with screenshots for visual changes and issue/spec links where applicable.

Use `type(scope): subject` titles (`feat`, `fix`, `docs`, `test`, `chore`, `perf`, `refactor`, or `revert`; scope is optional). Maintained documentation lives outside dated planning artifacts. Preserve historical decisions when repairing archive links.

The repository supports a solo maintainer: pull requests and successful required checks are expected; a second person's approval is not mandatory. Merge and deployment are separate from preparing a change.

## Data contributions

Use the data-correction issue form with the country/ISO code, field, observed value, expected value, and an authoritative source. Avoid changing the canonical country scope incidentally.

New sources must have documented licensing, normalized data, merge priority, and per-field attribution. The pipeline lives under `scripts/`; see [Data collection](docs/systems/data-collection.md). Run `npm run update-data` only for an intentional country-data refresh, review the data and flag changes, and commit them together. City refreshes use `npm run fetch-cities`.

## Help and security

See [Support](SUPPORT.md) for questions and [Security](SECURITY.md) for private vulnerability reports. Contact: [tobias.ens@proton.me](mailto:tobias.ens@proton.me).
