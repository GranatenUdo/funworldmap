# Map Rendering System

## Technology

**MapLibre GL JS** renders the map using WebGL2 in an HTML `<canvas>` element. This means:

- GPU-accelerated rendering — smooth 60fps pan/zoom on modern hardware
- Vector tiles — basemap imagery stays crisp at any zoom level
- Client-side styling — map appearance (colors, labels, borders) controlled entirely in the browser
- No server-side rendering — the GPU does all the work

**@vis.gl/react-maplibre** provides React bindings so map state integrates cleanly with React's component model and hooks.

## Basemap

The map offers two basemaps, switched from the header (the **satellite** button):

- **Satellite + 3D terrain (default).** The app boots into satellite mode (`App.tsx` — `useState(true)`). Imagery is **EOX Sentinel-2 Cloudless** raster tiles; a terrain DEM from **AWS Terrain Tiles** drives 3D relief (`map.setTerrain`, exaggeration 1.5) with the camera pitched 20° (`DEFAULT_PITCH`; flattened to 0 under `prefers-reduced-motion`). In this mode the OpenFreeMap vector layers are hidden, country borders are tinted for contrast against the imagery, and the country-fill opacity is lowered so imagery shows through.
- **Vector map (toggle-off).** **OpenFreeMap** Positron — a clean, minimal, light vector style. In dark mode its layer colors are modified programmatically (see Dark Mode below).

All tile URLs are constants in `lib/mapStyles.ts` (`SATELLITE_TILES`, `TERRAIN_TILES`, `BASEMAP_STYLE`).

### Satellite toggle

`useSatelliteMode.ts` reacts to the `satellite` flag: it toggles `satellite-*` layer visibility, adds/removes terrain, hides/shows the vector base layers, re-tints borders, and adjusts fill opacity. The header button (`data-testid="satellite-toggle"`, with `aria-pressed`) flips the flag; `BasemapBanner.tsx` surfaces attribution and load state, and `probeBasemap.ts` checks tile availability. The choice is **not persisted** — every fresh visit starts in satellite mode (the persistence deferral is tracked in the roadmap). Covered by `e2e/satellite-default.spec.ts`.

### Resilience

Each tile URL is a single constant in `lib/mapStyles.ts`. If a provider becomes unavailable, switching to another (MapTiler, Stadia Maps, or any MapLibre-compatible source) requires changing one line.

If tiles fail to load, the map canvas still renders. Country boundary polygons (from bundled data) display regardless of basemap availability. The user sees countries but without the underlying imagery / geographic context.

## Country Boundaries

Country boundary polygons come from **Natural Earth** data, packaged as **world-atlas** (TopoJSON format), installed via npm and bundled by Vite.

### Data Pipeline

```
Natural Earth (public domain)
    ↓ pre-processed by
world-atlas npm package (TopoJSON, ~245KB gzipped)
    ↓ bundled by Vite as async chunk
    ↓ converted at runtime by
topojson-client.feature() → GeoJSON FeatureCollection
    ↓ rendered by
MapLibre GL as a GeoJSON source with multiple layers
```

### Map Layers

Three visual layers render on top of the basemap:

| Layer              | Purpose                        | Style                                                                          |
| ------------------ | ------------------------------ | ------------------------------------------------------------------------------ |
| `country-fill`     | Clickable area, hover feedback | Semi-transparent fill. Opacity increases on hover via `feature-state`.         |
| `country-borders`  | Political boundary lines       | Thin gray/white lines.                                                         |
| `country-selected` | Selected country highlight     | Thicker border + stronger fill. Filtered to show only the selected country ID. |

These are the three core layers. Hover (border + extrusion), the 4-layer selection and compare highlight stacks, and the satellite raster complete the picture — the full registry is `LAYER` in `src/lib/mapLayers.ts` (13 ids).

### Interaction Model

**Hover**: As the mouse moves over the `country-fill` layer, MapLibre's `feature-state` API sets `{ hover: true }` on the feature under the cursor. The layer paint expression reacts by increasing fill opacity. When the mouse leaves, hover is cleared. The cursor changes to `pointer` over countries.

**Click**: Clicking on the `country-fill` layer extracts the feature ID (ISO 3166-1 numeric code). This triggers country selection — see [System Overview — On Country Click](overview.md) for the full flow.

**Deselect**: Clicking on empty space (ocean, no feature) clears the selection.

### Touch Interaction

On touch devices, there is no hover state — no opacity feedback before tapping. Touch interactions map directly to their pointer equivalents:

- **Tap on a country** = selection (same as click)
- **Tap on empty space** (ocean) = deselect (same as click)
- **Pinch-to-zoom** and **drag-to-pan** are handled natively by MapLibre
- **No long-press interactions** — tap is the only selection gesture

The cursor does not change on touch devices (no `pointer` cursor). Visual feedback for selection is provided by the `country-selected` layer highlight, which appears immediately on tap.

### Feature Identification

Each country polygon has a top-level `id` property containing the ISO 3166-1 numeric code as a string (e.g., `"250"` for France). This is the join key to country metadata — see [Data System — Data Join](data.md) for the bidirectional lookup strategy.

## Camera Animations

When a country is selected (via click or search), the map smoothly animates to center on that country:

```
flyTo({
  center: [longitude, latitude],
  zoom: calculated from country area,
  duration: 1400
})
```

**Reduced motion**: When the user's system preference is `prefers-reduced-motion: reduce`, `duration` is set to `0` — the camera jumps instantly without animation. The application checks this preference, not MapLibre's built-in handling.

**Zoom calculation**: `flyToCountry` derives a target zoom from the country's area — `zoom = clamp(11 − 1.7·log₁₀(areaKm²), 2, 12)` — and never zooms _out_ below the user's current zoom (`Math.max(map.getZoom(), computed)`; see the 2026-05-17 country-click-preserve-zoom spec). Large countries resolve to the clamp floor (zoom 2); only countries below roughly 100,000 km² pull the camera in meaningfully (Luxembourg ≈ 5.2, Vatican ≈ 11.6).

**Coordinate swap**: REST Countries stores coordinates as `[latitude, longitude]` but MapLibre expects `[longitude, latitude]`. The `flyToCountry()` function handles this swap. See [Data System — Coordinate System](data.md).

## Dark Mode

In dark mode, the basemap is darkened using MapLibre's native `setPaintProperty()` API. This modifies individual basemap layer colors at runtime without destroying layers or sources.

### Approach

On theme toggle, `applyMapTheme` (`src/lib/mapColors.ts`) overrides a fixed set of basemap layers — background, water, waterway, park, building — with warm dark (or sand-light) fills, and recolors every symbol layer's text + halo. Layers outside that set keep their style defaults.

This uses `map.setPaintProperty(layerId, property, value)` which is non-destructive — all sources, layers, and state are preserved. No style reload occurs.

### Why Not CSS Filter

A CSS filter on `.maplibregl-canvas` would transform the entire canvas — including our country overlay layers (fills, borders, selection highlight). Overlay colors would become unpredictable and uncontrollable. The `setPaintProperty` approach keeps basemap and overlay layers independent.

### Overlay Layer Adaptation

Country overlay layers (country-fill, country-borders, country-selected) are independently adjusted for dark mode:

- Fill colors use lighter, more muted tones
- Border lines use brighter colors for visibility
- Selected country highlight uses a contrasting accent

These changes are applied through the same `setPaintProperty` calls, fully independent of basemap darkening.

### Fallback

The specific basemap layer IDs to modify depend on OpenFreeMap's positron style spec. If layer IDs cannot be identified (e.g., style spec changes), the basemap remains light while UI chrome (header, sidebar) still darkens. This is a graceful degradation — dark UI with a light map is functional.

## WebGL2 Requirement

MapLibre GL JS requires WebGL2 support in the browser. The `maplibregl.Map` constructor throws when WebGL2 is unavailable; `useMapInstance` catches it and shows a fallback message with browser-upgrade guidance instead of a blank canvas (rare — mainly enterprise browsers with GPU disabled, or very old devices). Note that some older browsers support WebGL1 but not WebGL2 — the error message specifically mentions WebGL2. See [System Overview — Error Handling](overview.md).
