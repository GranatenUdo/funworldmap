import type maplibregl from 'maplibre-gl'
import type { CountryData } from './types'
import { DEFAULT_PITCH } from './mapStyles'
import { prefersReducedMotion } from './motion'
import { panelScreenOffset } from './layoutConstants'

/** Frame BOTH compared countries in the area the compare panel does not
 *  cover (batch-2 spec §3). Centroid bounds + 80px padding absorb the
 *  centroid-vs-outline underframing; longitudes >180° apart are shifted so
 *  the box crosses the antimeridian instead of wrapping the long way. */
export function flyToComparePair(map: maplibregl.Map, a: CountryData, b: CountryData): void {
  const [latA, lngA] = a.latlng
  const [latB, rawLngB] = b.latlng
  const lngB = Math.abs(rawLngB - lngA) > 180 ? rawLngB + (rawLngB < lngA ? 360 : -360) : rawLngB

  const bounds: [[number, number], [number, number]] = [
    [Math.min(lngA, lngB), Math.min(latA, latB)],
    [Math.max(lngA, lngB), Math.max(latA, latB)],
  ]
  const camera = map.cameraForBounds(bounds, {
    padding: 80,
    offset: panelScreenOffset('compare'),
  })
  if (!camera) return

  const reducedMotion = prefersReducedMotion()
  map.flyTo({
    ...camera,
    pitch: reducedMotion ? 0 : DEFAULT_PITCH,
    duration: reducedMotion ? 0 : 1400,
    curve: 1.5,
  })
}
