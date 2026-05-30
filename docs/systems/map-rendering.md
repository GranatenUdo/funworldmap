# Map Rendering System

## Technology

**MapLibre GL JS** renders the map using WebGL2 in an HTML `<canvas>` element. This means:

- GPU-accelerated rendering — smooth 60fps pan/zoom on modern hardware
- Vector tiles — basemap imagery stays crisp at any zoom level
- Client-side styling — map appearance (colors, labels, borders) controlled entirely in the browser
- No server-side rendering — the GPU does all the work

**@vis.gl/react-maplibre** provides React bindings so map state integrates cleanly with React's component model and hooks.

## Basemap

The basemap provides the underlying geographic context — landmasses, water, country labels, major geographic features. It comes from **OpenFreeMap**, a free vector tile service.

### Style

**Positron** — clean, minimal, light background. Used as the base style. In dark mode, basemap layer colors are modified programmatically (see Dark Mode below).

### Resilience

The basemap URL is a single constant in `lib/mapStyles.ts`. If OpenFreeMap becomes unavailable, switching to another provider (MapTiler, Stadia Maps, or any MapLibre-compatible style URL) requires changing one line.

If tiles fail to load, the map canvas still renders. Country boundary polygons (from bundled data) display regardless of basemap availability. The user sees countries but without the underlying geographic context.

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
  duration: 1500
})
```

**Reduced motion**: When the user's system preference is `prefers-reduced-motion: reduce`, `duration` is set to `0` — the camera jumps instantly without animation. The application checks this preference, not MapLibre's built-in handling.

**Zoom calculation**: The zoom level is derived from the country's area in km² using a logarithmic scale. Approximate targets:

| Country      | Area (km²) | Approximate Zoom |
| ------------ | ---------- | ---------------- |
| Russia       | 17,098,242 | ~3               |
| Brazil       | 8,515,767  | ~4               |
| France       | 551,695    | ~6               |
| Luxembourg   | 2,586      | ~10              |
| Vatican City | 0.44       | ~15              |

Exact values are tuned during implementation to feel natural at each scale.

**Coordinate swap**: REST Countries stores coordinates as `[latitude, longitude]` but MapLibre expects `[longitude, latitude]`. The `flyToCountry()` function handles this swap. See [Data System — Coordinate System](data.md).

## Dark Mode

In dark mode, the basemap is darkened using MapLibre's native `setPaintProperty()` API. This modifies individual basemap layer colors at runtime without destroying layers or sources.

### Approach

On theme toggle, iterate over known basemap layers and modify their paint properties:

- Background → dark gray
- Water layers → dark blue
- Land/landuse layers → dark tones
- Road/path layers → muted dark lines
- Text/label layers → white/light gray

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
