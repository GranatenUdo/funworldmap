# 1. MapLibre GL with a WebGL2-required vector basemap

**Status:** Accepted
**Date:** 2026-05-30 (records a decision made at project inception)

## Context

funworldmap is a fully client-side, static-hosted map application with no backend.
It needs: crisp rendering at any zoom, runtime-themeable map styling (light/dark),
interactive per-feature hit-testing for country selection, smooth camera animation,
and a permissively-licensed stack with no account or API key.

## Decision

Render with **MapLibre GL JS** (the open-source fork of Mapbox GL JS) over an
**OpenFreeMap "Positron" vector basemap**. MapLibre requires a WebGL2 context; before
creating the map the app probes for one (`canvas.getContext('webgl2')` in
`useMapInstance`) and, when unavailable, renders a "WebGL2 Not Supported" overlay
(`WorldMap.tsx`) instead of a blank canvas.

## Consequences

- Vector rendering gives crisp output at any zoom and runtime theming via paint
  properties; `queryRenderedFeatures` powers country hit-testing.
- MapLibre ships as a single, non-tree-shakeable bundle (~275 KB gzip) — the
  dominant bundle cost (see `docs/systems/overview.md` § Bundle Size Budget).
- The WebGL2 requirement excludes some older WebGL1-only browsers; accepted, with a
  graceful unsupported-message fallback rather than a crash.
- The basemap depends on the OpenFreeMap CDN; if tiles fail, country polygons still
  render from bundled data and `BasemapBanner` surfaces the degradation.

## Alternatives

- **Leaflet + raster tiles** — smaller and simpler, but raster tiles blur on zoom,
  offer no runtime theming, and have weaker vector feature interaction. Rejected:
  vector rendering + theming are core to the experience.
- **Mapbox GL JS** — same technology, but a proprietary license requiring an access
  token and billing. Rejected: funworldmap is free, static, and account-free.
- **Google Maps / other proprietary SDKs** — cost, closed source, and mandatory API
  keys. Rejected for the same reasons.
