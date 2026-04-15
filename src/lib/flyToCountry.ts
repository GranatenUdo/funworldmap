import type maplibregl from 'maplibre-gl'
import type { CountryData } from './types'

/**
 * Calculate zoom level from country area using a logarithmic scale.
 * ~zoom 3 for Russia (17M km²), ~zoom 6 for France (551K km²), ~zoom 15 for Vatican (0.44 km²)
 */
function zoomFromArea(areaKm2: number): number {
  if (areaKm2 <= 0) return 6
  // log scale: large areas get low zoom, small areas get high zoom
  const zoom = 11 - Math.log10(areaKm2) * 1.7
  return Math.max(2, Math.min(16, zoom))
}

/** Check if user prefers reduced motion */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Fly the map camera to a country.
 * Handles the REST Countries [lat, lng] → MapLibre [lng, lat] coordinate swap.
 */
export function flyToCountry(map: maplibregl.Map, country: CountryData): void {
  const [lat, lng] = country.latlng
  const zoom = zoomFromArea(country.area)
  const duration = prefersReducedMotion() ? 0 : 1500

  map.flyTo({
    center: [lng, lat],
    zoom,
    duration,
  })
}
