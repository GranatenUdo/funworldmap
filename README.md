# funworldmap

Free, interactive political world map. Explore countries, borders, and geopolitical facts through a map-first interface.

- ~249 countries with data from REST Countries and CIA World Factbook archive
- Fuzzy search by name, capital, region, or country code
- Per-field source attribution (every data point shows where it came from)
- Light/dark/system theme with basemap adaptation
- WCAG AA accessible: keyboard navigation, screen reader support, skip links
- Fully client-side — no backend, deployable to any CDN

## Development

```bash
npm install
npm run dev           # Start dev server at localhost:5173
npm run build         # Type-check and produce production build
npm run test:e2e      # Run Playwright end-to-end tests
npm run test:unit     # Run Vitest unit tests
npm run lint          # Check for lint errors
npm run format        # Format source files with Prettier
npm run update-data   # Regenerate countries.json from source APIs
```

## Architecture

- **Map**: MapLibre GL JS with OpenFreeMap basemap (Positron style)
- **Data**: REST Countries v3.1 + CIA World Factbook archive, merged with field-level source attribution
- **Search**: Fuse.js fuzzy search with weighted fields
- **Stack**: Vite 6, React 19, TypeScript, Tailwind CSS 4
- **Testing**: Playwright e2e (SwiftShader for headless WebGL2), Vitest unit tests

## Documentation

See [docs/index.md](docs/index.md) for the full system design documentation.

## Error reporting

Production builds can report runtime errors to Sentry. To enable:

1. Create a project at https://sentry.io/ and copy its DSN.
2. In this repo, go to Settings → Secrets and variables → Actions and add a new repository secret:
   - Name: `VITE_SENTRY_DSN`
   - Value: the DSN from step 1.
3. Trigger a new deploy (empty commit + push).

Without a DSN, the app works normally — Sentry is a no-op.

## Pre-launch checklist

Before the site goes public, replace the placeholder host `https://funworldmap.example/` with the real URL in these files:

- `index.html` (canonical, og:url, og:image, twitter:image)
- `public/robots.txt` (sitemap line)
- `public/sitemap.xml` (loc)

Grep:

```bash
grep -rn "funworldmap.example" index.html public/
```

## Follow-up work not yet in this branch

- **Basemap failover to a second provider.** Today we detect failure and show a degraded banner; the bundled country polygons remain interactive. To add a real second provider (Stadia Maps / MapTiler), sign up for an API key and wire a `FALLBACK_BASEMAP_STYLE` in `src/lib/mapStyles.ts` and a fall-through path in `WorldMap.tsx`.
- **Data refresh runbook.** `npm run update-data` is not scheduled; decide an owner and cadence before launch.
- **Bandwidth watch.** GH Pages soft-caps at ~100 GB/month. Watch repo Insights → Traffic.

## License

Source code is MIT licensed — see [LICENSE](./LICENSE).

Data, fonts, and flag assets retain their upstream licenses; see [docs/systems/data.md](docs/systems/data.md) for source-by-source attribution.
