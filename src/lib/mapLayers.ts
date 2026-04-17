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
    id: 'country-fill',
    type: 'fill',
    source: 'countries',
    paint: {
      'fill-color': TEAL,
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.28,
        0.05,
      ],
    },
  })

  map.addLayer({
    id: 'country-borders',
    type: 'line',
    source: 'countries',
    paint: { 'line-color': '#334155', 'line-width': 0.5, 'line-opacity': 0.4 },
  })
}

/** Add hover / extrusion overlays for the currently hovered country. */
export function addHoverLayers(map: maplibregl.Map): void {
  map.addLayer({
    id: 'country-hover-border',
    type: 'line',
    source: 'countries',
    paint: { 'line-color': TEAL, 'line-width': 2, 'line-opacity': 0.6 },
    filter: EMPTY_FILTER,
  })

  map.addLayer({
    id: 'country-extrusion',
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

/** Add the selection layer stack (fill / border / glow / extrusion). */
export function addSelectionLayers(map: maplibregl.Map): void {
  map.addLayer({
    id: 'country-selected-glow',
    type: 'line',
    source: 'countries',
    paint: { 'line-color': CORAL, 'line-width': 10, 'line-blur': 5, 'line-opacity': 0.3 },
    filter: EMPTY_FILTER,
  })
  map.addLayer({
    id: 'country-selected',
    type: 'fill',
    source: 'countries',
    paint: { 'fill-color': CORAL, 'fill-opacity': 0.32 },
    filter: EMPTY_FILTER,
  })
  map.addLayer({
    id: 'country-selected-border',
    type: 'line',
    source: 'countries',
    paint: { 'line-color': CORAL, 'line-width': 2.5 },
    filter: EMPTY_FILTER,
  })
  map.addLayer({
    id: 'country-selected-extrusion',
    type: 'fill-extrusion',
    source: 'countries',
    paint: {
      'fill-extrusion-color': CORAL,
      'fill-extrusion-height': 80000,
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.55,
    },
    filter: EMPTY_FILTER,
  })
}

/** Add the compare layer stack (same shape as selection, using teal-dim). */
export function addCompareLayers(map: maplibregl.Map): void {
  map.addLayer({
    id: 'country-compare-glow',
    type: 'line',
    source: 'countries',
    paint: { 'line-color': TEAL_DIM, 'line-width': 10, 'line-blur': 5, 'line-opacity': 0.3 },
    filter: EMPTY_FILTER,
  })
  map.addLayer({
    id: 'country-compare-fill',
    type: 'fill',
    source: 'countries',
    paint: { 'fill-color': TEAL_DIM, 'fill-opacity': 0.32 },
    filter: EMPTY_FILTER,
  })
  map.addLayer({
    id: 'country-compare-border',
    type: 'line',
    source: 'countries',
    paint: { 'line-color': TEAL_DIM, 'line-width': 2.5 },
    filter: EMPTY_FILTER,
  })
  map.addLayer({
    id: 'country-compare-extrusion',
    type: 'fill-extrusion',
    source: 'countries',
    paint: {
      'fill-extrusion-color': TEAL_DIM,
      'fill-extrusion-height': 80000,
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.55,
    },
    filter: EMPTY_FILTER,
  })
}

/** Apply the warm directional lighting. */
export function applyWarmLighting(map: maplibregl.Map): void {
  map.setLight({
    anchor: 'viewport',
    position: [1.5, 210, 30],
    intensity: 0.3,
  })
}

export { EMPTY_FILTER }
