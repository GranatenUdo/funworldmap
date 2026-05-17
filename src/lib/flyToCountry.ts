import type maplibregl from 'maplibre-gl'
import type { CountryData } from './types'
import { DEFAULT_PITCH, MAX_ZOOM } from './mapStyles'
import { prefersReducedMotion } from './motion'

function zoomFromArea(areaKm2: number): number {
  if (areaKm2 <= 0) return 6
  const zoom = 11 - Math.log10(areaKm2) * 1.7
  return Math.max(2, Math.min(MAX_ZOOM, zoom))
}

export function flyToCountry(map: maplibregl.Map, country: CountryData): void {
  const [lat, lng] = country.latlng
  const computed = zoomFromArea(country.area)
  const zoom = Math.max(map.getZoom(), computed)
  const reducedMotion = prefersReducedMotion()

  map.flyTo({
    center: [lng, lat],
    zoom,
    pitch: reducedMotion ? 0 : DEFAULT_PITCH,
    duration: reducedMotion ? 0 : 1400,
    curve: 1.5,
  })
}
