# System Overview

funworldmap is a client-side single-page application: all code, data, and assets are delivered as static files from a CDN, and the browser does all the work. No application backend is required to run it — the only server-side component is an optional analytics Worker (see [Analytics](analytics.md)). At runtime the map pulls tiles from third-party CDNs (see External Dependencies below).

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     React Application                       │  │
│  │                                                             │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │  WorldMap    │  │  CountryPanel │  │  Header          │  │  │
│  │  │  (MapLibre)  │  │  (sidebar/   │  │  (SearchBar +    │  │  │
│  │  │             │  │   bottom sheet)│  │   ThemeToggle)   │  │  │
│  │  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘  │  │
│  │         │                │                    │             │  │
│  │  ┌──────▼────────────────▼────────────────────▼──────────┐ │  │
│  │  │                   Hooks (state)                        │ │  │
│  │  │  useMapInteraction · useCountryData · useCountrySearch │ │  │
│  │  │  useTheme · useMediaQuery · URL hash sync              │ │  │
│  │  └───────────────────────┬───────────────────────────────┘ │  │
│  │                          │                                  │  │
│  │  ┌───────────────────────▼───────────────────────────────┐ │  │
│  │  │                  Bundled Data                           │ │  │
│  │  │  countries.json (metadata + source attribution)         │ │  │
│  │  │  SVG flags (bundled at build time)                      │ │  │
│  │  │  world-atlas TopoJSON → GeoJSON (async chunk)           │ │  │
│  │  │  Fuse.js search index (built on load)                   │ │  │
│  │  └───────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS — tile CDNs (incl. satellite + terrain) + optional telemetry
                    ┌──────────▼──────────┐
                    │  OpenFreeMap CDN     │
                    │  Vector tiles        │
                    │  (positron style)    │
                    └─────────────────────┘
```

## External Dependencies at Runtime

> The diagram above shows a single representative tile CDN; the full runtime dependency list is below.

| Dependency                                          | Purpose                                         | Optional?                                                                                                                  | Failure Impact                                                                                 |
| --------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| EOX Sentinel-2 (`tiles.maps.eox.at`)                | Satellite imagery — the **default** basemap     | No (default view)                                                                                                          | Satellite layer blank; country polygons still render. User can switch to the vector map.       |
| AWS Terrain Tiles (`elevation-tiles-prod`)          | 3D terrain DEM (used in satellite mode)         | No (default view)                                                                                                          | Terrain falls back to flat; map stays functional.                                              |
| OpenFreeMap (`tiles.openfreemap.org`)               | Positron vector tiles — the toggle-off map view | No (when in map view)                                                                                                      | Map canvas renders but no basemap imagery; country boundaries still display from bundled data. |
| Analytics Worker (`funworldmap.com/api/event`)      | Anonymous, cookieless usage events              | Yes — no-op unless `VITE_ANALYTICS_ENDPOINT` is set                                                                        | None — fire-and-forget beacons; failures are swallowed.                                        |
| Sentry                                              | Error reporting                                 | Yes — no-op unless `VITE_SENTRY_DSN` is set                                                                                | None.                                                                                          |
| Cloudflare Web Analytics (`cloudflareinsights.com`) | Passive page-view / Web-Vitals beacon           | Loaded in every production build (stripped only in `vite dev`); `VITE_CF_WA_TOKEN` only sets whether CF attributes the hit | Async beacon; none.                                                                            |

Flag images and country metadata are bundled into the build. Beyond the tile CDNs above, network traffic is limited to cookieless telemetry. Sentry and the analytics Worker are true no-ops when their env vars are unset (dev and CI e2e builds); the Cloudflare Web Analytics beacon, however, ships in every production build (it is stripped only in `vite dev`), so a prod build fetches it from `cloudflareinsights.com` regardless of `VITE_CF_WA_TOKEN` — the token only controls whether CF attributes the hit. See [Analytics](analytics.md).

## Data Flow

### On Page Load

1. Browser loads static HTML + JS + CSS from CDN
2. React initializes, MapLibre GL creates a WebGL2 context; if the browser lacks WebGL2 the `maplibregl.Map` constructor throws and the app shows an unsupported message (see Error Handling)
3. Basemap tiles stream from OpenFreeMap as user pans/zooms
4. world-atlas TopoJSON loads asynchronously (Vite code-split chunk). While it loads, the user sees the basemap without country boundaries — no loading indicator is shown, as the basemap provides immediate visual content and country polygons appear within seconds.
5. TopoJSON converted to GeoJSON via `topojson-client`, added as map source
6. Country boundaries render as interactive layers
7. If URL has hash (e.g., `#FRA`), cca3 code is looked up → ccn3 numeric ID resolved → country selected and camera flies to it via `flyToCountry()`. Hash resolution is deferred until step 6 completes — the GeoJSON source must be loaded before a country can be selected and highlighted.
8. If no hash, map shows default view: satellite basemap, centered at longitude 0, latitude 20, zoom 1.8, pitch 20° (3D; pitch 0 under `prefers-reduced-motion`)

### On Country Click

1. MapLibre identifies clicked feature via `queryRenderedFeatures`
2. Feature ID (ISO 3166-1 numeric, e.g., "250") extracted
3. Country metadata looked up via ccn3 join key (see [Data System](data.md))
4. Numeric ID converted to cca3 code (e.g., "250" → "FRA") for URL hash
5. Map animates to country center (`flyTo`, respects reduced motion)
6. Panel slides in with country information (each field shows source via 'i' tooltip)
7. URL hash updates (`#FRA`)

### On Search

1. User types in search bar
2. Fuse.js queries pre-built index (see [Search System](search.md))
3. Fuzzy-matched results displayed in dropdown (max 8)
4. User selects result → country selected in state, camera flies to country, panel opens, URL hash updates. Metadata is already available from the search result — no additional lookup needed.

## State Management

The URL hash is the single source of truth for country selection. All selection actions — map click, search, border chip, initial load — update the hash. All consuming components react to the hash change.

### Hook Responsibilities

| Hook                      | Source of Truth                                                | Consumers                                                               |
| ------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `useSelectedCountry()`    | `window.location.hash` → `byCca3` lookup → CountryData or null | WorldMap (highlight + camera), CountryPanel (content)                   |
| `useCountryData()`        | Bundled `countries.json` (parsed once at startup)              | Builds `byNumeric` + `byCca3` lookup maps, provides them to other hooks |
| `useCountrySearch(query)` | Fuse.js index (built once at startup)                          | SearchBar dropdown                                                      |
| `useTheme()`              | `localStorage` + `prefers-color-scheme`                        | ThemeToggle, `<html>` class, MapLibre basemap paint properties          |
| `useMediaQuery()`         | `window.matchMedia('(min-width: 1024px)')`                     | CountryPanel layout (sidebar vs bottom sheet)                           |

### Selection Flow

Every path to selecting a country converges on the URL hash:

- **Map click**: `queryRenderedFeatures` → feature ID (ccn3) → `byNumeric` lookup → `country.cca3` → set hash
- **Search select**: Result already has `cca3` → set hash
- **Border chip**: Chip carries `cca3` → set hash
- **URL load**: Hash is already set → `useSelectedCountry()` resolves it

The `useSelectedCountry()` hook reads the hash, resolves the cca3 code to a CountryData object via the `byCca3` lookup map, and triggers `flyToCountry()` for camera animation. All camera movement goes through `flyToCountry()`, which handles the coordinate swap (see [Data System — Coordinate System](data.md)).

When the hash is cleared (clicking ocean, closing the panel, or reset view), `useSelectedCountry()` returns null and the map clears the selection highlight.

## Error Handling

| Failure                              | Behavior                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WebGL2 not supported**             | the `maplibregl.Map` constructor throws (caught in `useMapInstance`) → show error message with browser upgrade guidance instead of blank canvas. Note: MapLibre GL JS requires WebGL2, not just WebGL1 — some older browsers support WebGL1 but not WebGL2.                                                                                        |
| **Invalid URL hash**                 | Hash contains an unrecognized cca3 code (e.g., `#INVALID`) → `byCca3` lookup returns no match → hash is silently cleared, no country selected, default view shown.                                                                                                                                                                                 |
| **Basemap tiles fail to load**       | Map canvas renders with country polygons from bundled data, but no underlying geography (no water, labels, roads). Functional but visually sparse.                                                                                                                                                                                                 |
| **TopoJSON fails to load/parse**     | Map shows basemap only with no interactive country layers. Error state displayed: "Country data unavailable." Search and panel non-functional.                                                                                                                                                                                                     |
| **Country ID has no metadata match** | Defensive only — rendered polygons are filtered to the canonical 195 (`loadCountryGeojson.ts`), all of which carry metadata, so this is not reachable via normal map clicks. Were it ever hit, the panel would show the world-atlas `properties.name` with "Limited data available." No crash. See [Data System — Unmatched Territories](data.md). |
| **WebGL2 context lost mid-session**  | MapLibre fires `webglcontextlost` event. Display "Map temporarily unavailable" overlay. Attempt restore on `webglcontextrestored`.                                                                                                                                                                                                                 |

## Bundle Size Budget

MapLibre GL JS is NOT tree-shakeable — it ships as a single pre-bundled file. `@sentry/react` is statically imported and bundled regardless of whether a DSN is configured at runtime.

Measured against the 2026-04-19 build:

| Component                                       | Gzipped Size                |
| ----------------------------------------------- | --------------------------- |
| maplibre-gl (entire library)                    | ~275 KB                     |
| React 19 + ReactDOM                             | ~45 KB                      |
| @sentry/react (tree-shaken; tracing/replay off) | ~6 KB (measured 2026-05-30) |
| @vis.gl/react-maplibre                          | ~15 KB                      |
| Tailwind CSS output (CSS bundle)                | ~20 KB                      |
| fuse.js                                         | ~8 KB                       |
| topojson-client                                 | ~5 KB                       |
| Application code                                | ~15 KB                      |
| countries.json (metadata + \_fieldSources)      | ~65 KB                      |
| cities.json (Natural Earth top-500)             | ~25 KB                      |
| **Total initial JS+CSS (measured)**             | **~477 KB**                 |
| world-atlas countries-50m (async chunk)         | ~233 KB                     |
| **Total with async data (measured)**            | **~710 KB**                 |

The per-component figures are estimates summing to the measured totals. MapLibre dominates. The geo data loads asynchronously after the map initializes, so the user sees the basemap first. The original <700 KB target predates Sentry and `cities.json`; re-baselining against a measured CI build is tracked as a roadmap item (bundle-size budgets in CI).

## Game system

The game runs on a single `useGameSession` reducer with a small action set
(`start | attempt | advance | overrideRound | endGame | finishFree | finalize | restart`).
Modes plug in via the `GameMode` contract
(`src/game/modes/{country-pinning,city-guessing}/index.tsx`).

Key files:

- `src/game/shared/useGameSession.ts` — reducer
- `src/game/shared/GameSessionProvider.tsx` — context API + computed mode
- `src/game/GameController.tsx` — hash bootstrap, reveal effects, telemetry
