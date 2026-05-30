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

> The daily puzzle index (`public/daily/index.json`) is a generated artifact —
> it is not committed to `main`. `npm run dev` regenerates it automatically (via
> the `predev` hook); in production it is served from the `data` branch. If you
> run `npm run build` / `preview` / `build:e2e` directly without having run
> `npm run dev` first, run `npm run daily:generate` once to produce it. See
> `docs/systems/daily-puzzle.md`.

## Pull Request Expectations

Before opening a PR:

- `npm run lint` — zero warnings
- `tsc -b` — zero errors
- `npm run test:unit` — all green
- `npm run test:e2e` — all green
- `npm run build` — succeeds

PR title uses the repo's observed convention: `type(scope): subject`, where `type` is one of `feat`, `fix`, `docs`, `test`, `chore`, `perf`, `refactor`, `revert`. Scope is optional but encouraged.

Keep the PR description focused on _why_. The diff shows _what_.

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
