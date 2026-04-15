# Build & Deploy System

## Build Tool

**Vite 6** — fast build tool with native ES modules for development and Rollup-based production bundling.

## Development

```
npm run dev
```

Starts the Vite development server at `http://localhost:5173` with:
- Hot Module Replacement (HMR) — changes reflect instantly without page reload
- TypeScript transpilation via esbuild (fast, but does NOT type-check — type errors surface during `npm run build` or in your IDE)
- Tailwind CSS 4 compilation via `@tailwindcss/vite` plugin

## Production Build

```
npm run build
```

Produces static files in `dist/`:
```
dist/
  index.html                    # Entry HTML with meta tags, favicon
  assets/
    index-[hash].js             # Main JS bundle (React, app code)
    index-[hash].css            # Tailwind CSS output
    countries-50m-[hash].js     # world-atlas TopoJSON (async chunk)
  flags/
    AF.svg                      # Bundled SVG flags (~195 files)
    AL.svg
    ...
```

Vite automatically:
- Minifies JS and CSS
- Tree-shakes unused code
- Code-splits the world-atlas data into a separate async chunk (loaded after map init)
- Hashes filenames for cache-busting
- Copies `public/` contents (flags) to `dist/`

## Tailwind CSS 4

Tailwind 4 uses CSS-first configuration — no `tailwind.config.js`. Configuration lives in `src/index.css`:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Custom design tokens if needed */
}
```

The `@tailwindcss/vite` plugin integrates directly with Vite — no PostCSS configuration required.

## TypeScript

Strict mode enabled in `tsconfig.json`. No `any` types except in test helpers where necessary.

## Linting & Formatting

- **ESLint** with `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- **Prettier** for consistent formatting

```
npm run lint        # Check for lint errors
npm run format      # Format all files with Prettier
```

## npm Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Start development server |
| `build` | `tsc -b && vite build` | Type-check and produce production build |
| `preview` | `vite preview` | Serve production build locally |
| `test:e2e` | `playwright test` | Run Playwright end-to-end tests |
| `lint` | `eslint src/` | Check for lint errors |
| `format` | `prettier --write src/` | Format source files |
| `update-data` | `tsx scripts/fetch-countries.ts` | Run data collection tool (on-demand) |

## Deployment

The `dist/` folder is a fully self-contained static site. Deploy to any static hosting:

| Provider | Method |
|----------|--------|
| **Netlify** | `netlify deploy --dir=dist --prod` or Git-connected auto-deploy |
| **Vercel** | `vercel --prod` or Git-connected auto-deploy |
| **GitHub Pages** | GitHub Actions workflow: build → deploy to `gh-pages` branch |
| **Cloudflare Pages** | Git-connected or `wrangler pages deploy dist` |
| **S3 + CloudFront** | `aws s3 sync dist/ s3://bucket && aws cloudfront create-invalidation` |

### Cache Headers
- `index.html`: `Cache-Control: no-cache` (always revalidate)
- `assets/*` (hashed filenames): `Cache-Control: max-age=31536000, immutable`
- `flags/*`: `Cache-Control: max-age=86400` (daily, flags rarely change)

Most static hosting providers set these automatically for hashed assets.

## Bundle Budget

See [System Overview — Bundle Size Budget](./overview.md) for the detailed size breakdown. Target: <700KB total gzipped including async geo data chunk.
