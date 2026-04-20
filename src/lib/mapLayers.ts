import type maplibregl from 'maplibre-gl'
import {
  SATELLITE_TILES,
  SATELLITE_ATTRIBUTION,
  TERRAIN_TILES,
  TERRAIN_ATTRIBUTION,
} from './mapStyles'
import { TEAL, TEAL_DIM, CORAL } from './mapPalette'

const EMPTY_FILTER: maplibregl.FilterSpecification = ['==', ['get', 'id'], '']

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
    paint: {
      'fill-extrusion-color': TEAL,
      'fill-extrusion-height': 60000,
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
    paint: {
      'fill-extrusion-color': color,
      'fill-extrusion-height': 80000,
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
export const DEFAULT_FILL_OPACITY: maplibregl.ExpressionSpecification = [
  'case',
  ['boolean', ['feature-state', 'hover'], false],
  0.28,
  0.05,
]

/** Apply the theme-appropriate paint to `country-borders` (color + opacity). */
export function applyDefaultBorderPaint(map: maplibregl.Map, isDark: boolean): void {
  map.setPaintProperty(LAYER.borders, 'line-color', isDark ? '#1e293b' : '#94a3b8')
  map.setPaintProperty(LAYER.borders, 'line-opacity', isDark ? 0.5 : 0.35)
}

/** Apply border paint for the current visual mode. Satellite mode uses a
 *  white-ish translucent border over imagery; vector mode uses the theme's
 *  default border color and opacity. One edit-point so the three hooks
 *  that care (theme, satellite, compare-dimming) agree on the baseline. */
export function applyBorderPaintForMode(
  map: maplibregl.Map,
  opts: { isDark: boolean; satellite: boolean },
): void {
  if (opts.satellite) {
    map.setPaintProperty(LAYER.borders, 'line-color', 'rgba(255,255,255,0.35)')
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
