# Globe + Terrain + Navigation Modernization

**Date:** 2026-04-16
**Status:** Approved
**Approach:** Globe-first (always on), terrain linked to satellite toggle

## Overview

Upgrade polworldmap from flat Mercator rendering to a 3D globe with atmospheric effects, satellite-linked terrain, and polished mouse navigation. Zero new dependencies — all features are built into MapLibre GL JS 5.23.0.

## 1. Globe Projection

Globe is always active. The map renders as a 3D sphere at low zoom (0-12) and seamlessly transitions to Mercator at higher zoom for detail work.

- `projection: { type: 'globe' }` in Map constructor style
- Starting view: center `[0, 20]`, zoom `1.8`, pitch `20°`
- All existing layers (fill, borders, extrusion, selection, satellite) work on globe without changes
- Fill-extrusions point radially outward from the globe surface
- `flyToCountry()` continues to work — MapLibre handles globe camera math

## 2. Atmosphere & Sky

Atmospheric rendering makes the globe look like a real planet.

- `map.setSky()` with `atmosphere-blend` expression: `['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0]`
- Light mode: sky `#88c6fc`, horizon warm white
- Dark mode: sky `#0a1a2e`, horizon dark gray
- `setSky()` called on theme change alongside existing `setFog()` calls
- Fog remains for Mercator zoom levels (>12); may be inactive on globe (atmosphere replaces it)
- Respects `prefers-reduced-motion` (atmosphere is static, not animated)

## 3. Terrain (Satellite-linked)

3D terrain activates only when satellite view is toggled on.

**Source:** AWS Terrain Tiles (AWS Open Data program, no API key)
- URL: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`
- Encoding: `terrarium`
- Tile size: 256px
- Max zoom: 15

**Behavior:**
- `raster-dem` source added at map load, terrain inactive (`setTerrain(null)`)
- Satellite ON: `setTerrain({ source: 'terrain-dem', exaggeration: 1.5 })`
- Satellite OFF: `setTerrain(null)`
- First activation: satellite imagery appears immediately, terrain fills in progressively as DEM tiles download (1-3s). Subsequent toggles are instant (cached).
- No separate terrain toggle button — satellite toggle controls both.

## 4. Mouse Navigation

### Constraints
- `minZoom: 1.5` — can't zoom out past the globe
- `maxZoom: 12` — can't zoom into blank tiles
- `minPitch: 0` — flat view always available
- `maxPitch: 60` — comfortable range for globe + extrusion

### Scroll Zoom
- Trackpad zoom rate: `map.scrollZoom.setZoomRate(1/150)` (smoother)
- Mouse wheel: keep default (already smooth)

### Cursors
- Default (idle): `grab`
- Dragging: `grabbing`
- Country hover: `pointer` (existing)

### Double-Click
- Disabled entirely (`map.doubleClickZoom.disable()`)
- Prevents race condition with country selection click handler

### Country Name Tooltip
- Raw DOM `<div>` positioned at cursor (not React — no re-render on mousemove)
- Content: country common name + small flag (24x16px)
- Style: dark pill with teal text, matching warm explorer aesthetic
- Position: 15px offset from cursor (bottom-right)
- Fade-in: 100ms
- Hidden on touch devices (no hover equivalent)

### Reset View Button
- Custom MapLibre `IControl` implementation
- Home icon, positioned bottom-right (above zoom controls)
- Flies to default world view: center `[0, 20]`, zoom `1.8`, pitch `20°`, bearing `0°`

### NavigationControl
- `{ visualizePitch: true }` — compass tilts to show current pitch angle

## 5. Files Modified

| File | Changes |
|---|---|
| `src/components/WorldMap.tsx` | Globe projection, terrain source, sky, zoom/pitch constraints, cursors, tooltip, double-click disable, reset view control |
| `src/lib/mapStyles.ts` | Terrain tile URL + attribution constants, constraint exports |
| `src/index.css` | Tooltip styles |

## 6. Not Included

| Omitted | Reason |
|---|---|
| `maxBounds` | World map should allow free panning |
| Cooperative gestures | Standalone site, not embedded |
| Custom keyboard bindings | Existing defaults (arrows, +/-) are standard |
| Terrain on vector basemap | Flat colors on 3D terrain looks unnatural |
| Globe as opt-in toggle | Users would miss the headline feature |
| Separate terrain toggle | Satellite toggle already controls it |
| Pan momentum tuning | MapLibre defaults are already smooth |

## 7. Constraints

- Zero new npm dependencies
- All accessibility preserved (ARIA, keyboard, screen reader, reduced-motion)
- All `data-testid` attributes preserved
- Existing tests must continue to pass or be updated
- Bundle size increase: zero (APIs are built into MapLibre 5.23.0)
