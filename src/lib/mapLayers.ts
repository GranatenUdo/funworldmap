import type maplibregl from 'maplibre-gl'
import {
  SATELLITE_TILES,
  SATELLITE_ATTRIBUTION,
  TERRAIN_TILES,
  TERRAIN_ATTRIBUTION,
} from './mapStyles'
import { TEAL, TEAL_DIM, CORAL } from './mapPalette'

const EMPTY_FILTER: maplibregl.FilterSpecification = ['==', ['get', 'id'], '']

/** Backstop zoom for the highlight extrusions. The lift fades to 0 via
 *  extrusionHeightExpression well before this; the maxzoom only guards
 *  against a zero-height top-face render at high zoom. */
export const EXTRUSION_MAX_ZOOM = 7

/** Zoom-interpolated lift: full at z4.5, gone at z6.5. Replaces the hard
 *  z6 cliff that popped the column off in one frame mid-flight
 *  (2026-07-10 batch-2 spec §4.3). */
export function extrusionHeightExpression(peakMeters: number): maplibregl.ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], 4.5, peakMeters, 6.5, 0]
}

/** Add all non-country raster/DEM sources the map needs. */
export function addRasterSources(map: maplibregl.Map): void {
  map.addSource('satellite', {
    type: 'raster',
    tiles: [SATELLITE_TILES],
    tileSize: 256,
    attribution: SATELLITE_ATTRIBUTION,
  })
  map.addLayer({
    id: 'satellite-layer',
    type: 'raster',
    source: 'satellite',
    layout: { visibility: 'none' },
  })
  map.addSource('terrain-dem', {
    type: 'raster-dem',
    tiles: [TERRAIN_TILES],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 15,
    attribution: TERRAIN_ATTRIBUTION,
  })
}

/** Add the country polygon source (caller supplies the fetched geojson). */
export function addCountrySource(map: maplibregl.Map, geojson: GeoJSON.FeatureCollection): void {
  map.addSource('countries', {
    type: 'geojson',
    data: geojson,
    promoteId: 'id',
  })
}

/** Add the base fill and border layers. */
export function addBaseCountryLayers(map: maplibregl.Map): void {
  map.addLayer({
    id: LAYER.fill,
    type: 'fill',
    source: 'countries',
    paint: {
      'fill-color': TEAL,
      'fill-opacity': DEFAULT_FILL_OPACITY,
    },
  })

  map.addLayer({
    id: LAYER.borders,
    type: 'line',
    source: 'countries',
    paint: { 'line-color': '#334155', 'line-width': 0.5, 'line-opacity': 0.4 },
  })
}

/** Add hover / extrusion overlays for the currently hovered country. */
export function addHoverLayers(map: maplibregl.Map): void {
  map.addLayer({
    id: LAYER.hoverBorder,
    type: 'line',
    source: 'countries',
    paint: { 'line-color': TEAL, 'line-width': 2, 'line-opacity': 0.6 },
    filter: EMPTY_FILTER,
  })

  map.addLayer({
    id: LAYER.extrusion,
    type: 'fill-extrusion',
    source: 'countries',
    maxzoom: EXTRUSION_MAX_ZOOM,
    paint: {
      'fill-extrusion-color': TEAL,
      'fill-extrusion-height': extrusionHeightExpression(60000),
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.65,
    },
    filter: EMPTY_FILTER,
  })
}

/** Add a 4-layer highlight stack (glow / fill / border / extrusion) under a
 *  shared id prefix and color. Used for both selection (coral) and compare
 *  (teal-dim). The glow id keeps the `-glow` suffix; the fill is bare prefix. */
function addHighlightStack(
  map: maplibregl.Map,
  prefix: 'country-selected' | 'country-compare',
  color: string,
): void {
  map.addLayer({
    id: `${prefix}-glow`,
    type: 'line',
    source: 'countries',
    paint: { 'line-color': color, 'line-width': 10, 'line-blur': 5, 'line-opacity': 0.3 },
    filter: EMPTY_FILTER,
  })
  // Compare's fill keeps the '-fill' suffix to preserve historic ids.
  const fillId = prefix === 'country-compare' ? `${prefix}-fill` : prefix
  map.addLayer({
    id: fillId,
    type: 'fill',
    source: 'countries',
    paint: { 'fill-color': color, 'fill-opacity': 0.32 },
    filter: EMPTY_FILTER,
  })
  map.addLayer({
    id: `${prefix}-border`,
    type: 'line',
    source: 'countries',
    paint: { 'line-color': color, 'line-width': 2.5 },
    filter: EMPTY_FILTER,
  })
  map.addLayer({
    id: `${prefix}-extrusion`,
    type: 'fill-extrusion',
    source: 'countries',
    maxzoom: EXTRUSION_MAX_ZOOM,
    paint: {
      'fill-extrusion-color': color,
      'fill-extrusion-height': extrusionHeightExpression(80000),
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.55,
    },
    filter: EMPTY_FILTER,
  })
}

/** Add the selection (coral) highlight stack. */
export function addSelectionLayers(map: maplibregl.Map): void {
  addHighlightStack(map, 'country-selected', CORAL)
}

/** Add the compare (teal-dim) highlight stack. */
export function addCompareLayers(map: maplibregl.Map): void {
  addHighlightStack(map, 'country-compare', TEAL_DIM)
}

/** Apply the warm directional lighting. */
export function applyWarmLighting(map: maplibregl.Map): void {
  map.setLight({
    anchor: 'viewport',
    position: [1.5, 210, 30],
    intensity: 0.3,
  })
}

/** The "no country selected" feature filter — used to clear filters on
 *  selection / compare / hover layers. */
export { EMPTY_FILTER }

/** The default `fill-opacity` expression for `country-fill`: 5% by default,
 *  28% when the country has the `hover` feature state. */
const DEFAULT_FILL_OPACITY: maplibregl.ExpressionSpecification = [
  'case',
  ['boolean', ['feature-state', 'hover'], false],
  0.28,
  0.05,
]

/** The `country-fill` opacity in satellite mode: near-transparent base (3%)
 *  so imagery shows through, 32% on hover. */
const SATELLITE_FILL_OPACITY: maplibregl.ExpressionSpecification = [
  'case',
  ['boolean', ['feature-state', 'hover'], false],
  0.32,
  0.03,
]

/** The `country-fill` opacity for the current visual mode. One edit-point so
 *  applyCountryBaselinePaint applies the same baseline in every mode
 *  (mirrors applyBorderPaintForMode for borders). Not exported —
 *  applyCountryBaselinePaint is the doorway. */
function fillOpacityForMode(satellite: boolean): maplibregl.ExpressionSpecification {
  return satellite ? SATELLITE_FILL_OPACITY : DEFAULT_FILL_OPACITY
}

/** The mode/theme-appropriate `country-borders` line colour. Single source so
 *  the compare-view path can set the colour without also writing the mode
 *  opacity (which it immediately overrides to 0.15). */
function borderLineColorForMode(isDark: boolean, satellite: boolean): string {
  return satellite ? 'rgba(255,255,255,0.35)' : isDark ? '#1e293b' : '#94a3b8'
}

/** Apply the theme-appropriate paint to `country-borders` (color + opacity). */
export function applyDefaultBorderPaint(map: maplibregl.Map, isDark: boolean): void {
  map.setPaintProperty(LAYER.borders, 'line-color', borderLineColorForMode(isDark, false))
  map.setPaintProperty(LAYER.borders, 'line-opacity', isDark ? 0.5 : 0.35)
}

/** Apply border paint for the current visual mode. Satellite mode uses a
 *  white-ish translucent border over imagery; vector mode uses the theme's
 *  default border color and opacity. Called from applyCountryBaselinePaint,
 *  the single owner of the country baseline paint. */
export function applyBorderPaintForMode(
  map: maplibregl.Map,
  opts: { isDark: boolean; satellite: boolean },
): void {
  if (opts.satellite) {
    map.setPaintProperty(LAYER.borders, 'line-color', borderLineColorForMode(opts.isDark, true))
    map.setPaintProperty(LAYER.borders, 'line-opacity', 0.6)
  } else {
    applyDefaultBorderPaint(map, opts.isDark)
  }
}

/** Typed layer ID registry. Use these constants when calling `setFilter`,
 *  `setPaintProperty`, `setLayoutProperty`, etc. so renames stay consistent
 *  and typos fail at compile time. */
export const LAYER = {
  fill: 'country-fill',
  borders: 'country-borders',
  hoverBorder: 'country-hover-border',
  extrusion: 'country-extrusion',
  selected: 'country-selected',
  selectedBorder: 'country-selected-border',
  selectedGlow: 'country-selected-glow',
  selectedExtrusion: 'country-selected-extrusion',
  compareFill: 'country-compare-fill',
  compareBorder: 'country-compare-border',
  compareGlow: 'country-compare-glow',
  compareExtrusion: 'country-compare-extrusion',
  satellite: 'satellite-layer',
} as const

/** Single owner of the country-fill opacity + country-borders baseline paint.
 *  Called from useCountryBaselinePaint for every {satellite, compare, theme}
 *  change, so the winning value is decided by THIS logic — not by which hook's
 *  effect happened to run last (the pre-2026-06 ordering bug class). */
export function applyCountryBaselinePaint(
  map: maplibregl.Map,
  opts: { satellite: boolean; inCompareView: boolean; isDark: boolean },
): void {
  if (opts.inCompareView) {
    // Compare view keeps the mode/theme border COLOUR but dims to a flat 0.15.
    // Set the colour directly rather than via applyBorderPaintForMode, so we
    // don't write the mode opacity (0.6 / 0.5 / 0.35) only to overwrite it.
    map.setPaintProperty(
      LAYER.borders,
      'line-color',
      borderLineColorForMode(opts.isDark, opts.satellite),
    )
    map.setPaintProperty(LAYER.borders, 'line-opacity', 0.15)
    // Hover layers are suppressed in compare view (useCompareViewHighlight),
    // so a scalar dim is fine — matched to the mode's baseline (satellite base
    // is 0.03; the vector 0.05 would brighten over imagery).
    map.setPaintProperty(LAYER.fill, 'fill-opacity', opts.satellite ? 0.03 : 0.05)
  } else {
    applyBorderPaintForMode(map, { isDark: opts.isDark, satellite: opts.satellite })
    map.setPaintProperty(LAYER.fill, 'fill-opacity', fillOpacityForMode(opts.satellite))
  }
}

/** Apply a uniform color to all four selection-highlight layers in one call.
 *  Used by useMapTheme (theme change) and useCompareViewHighlight (compare
 *  enter/exit) so the four setPaintProperty calls have a single definition. */
export function applySelectionColor(map: maplibregl.Map, color: string): void {
  map.setPaintProperty(LAYER.selected, 'fill-color', color)
  map.setPaintProperty(LAYER.selectedBorder, 'line-color', color)
  map.setPaintProperty(LAYER.selectedGlow, 'line-color', color)
  map.setPaintProperty(LAYER.selectedExtrusion, 'fill-extrusion-color', color)
}
