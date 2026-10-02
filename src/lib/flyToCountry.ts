import type maplibregl from 'maplibre-gl'
import type { CountryData } from './types'
import { DEFAULT_PITCH, MAX_ZOOM } from './mapStyles'
import { prefersReducedMotion } from './motion'
import { panelScreenOffset } from './layoutConstants'

/** Area-derived zoom. Retuned 2026-07-10 (batch-1 spec §5b): the previous
 *  11 − 1.7·log₁₀ clamped everything above ~196k km² to the world view, so
 *  Japan/Germany/France "flew" to the globe. Mid-size countries now fill a
 *  meaningful share of the frame; continental giants still resolve to ~z2. */
function zoomFromArea(areaKm2: number): number {
  if (areaKm2 <= 0) return 6
  const zoom = 10.8 - Math.log10(areaKm2) * 1.35
  return Math.max(2, Math.min(MAX_ZOOM, zoom))
}

export interface FlyToCountryOptions {
  /** Never zoom out — map-click selections (2026-05-17 preserve-zoom
   *  decision). Auto selections (search, border chips, deep links) omit this
   *  and fly to the computed zoom, which may zoom out. */
  preserveZoom?: boolean
  /** Breakpoint re-center (B-1, 2026-08-04): panelScreenOffset() is evaluated
   *  at fly time, so crossing the desktop/mobile breakpoint afterwards leaves
   *  the selection displaced by the stale offset (panel-side vs sheet-top).
   *  Re-apply ONLY the offset: keep the user's current zoom and pitch,
   *  recompute center + offset for the new layout, and jump — duration 0, no
   *  autonomous animation, so reduced motion is trivially satisfied. easeTo
   *  rather than jumpTo because JumpToOptions has no `offset`; easeTo with
   *  duration 0 applies the final state synchronously. */
  recenter?: boolean
}

export function flyToCountry(
  map: maplibregl.Map,
  country: CountryData,
  { preserveZoom = false, recenter = false }: FlyToCountryOptions = {},
): void {
  const [lat, lng] = country.latlng

  if (recenter) {
    map.easeTo({
      center: [lng, lat],
      zoom: map.getZoom(),
      offset: panelScreenOffset(),
      pitch: map.getPitch(),
      duration: 0,
    })
    return
  }

  const computed = zoomFromArea(country.area)
  const zoom = preserveZoom ? Math.max(map.getZoom(), computed) : computed
  const reducedMotion = prefersReducedMotion()

  map.flyTo({
    center: [lng, lat],
    zoom,
    offset: panelScreenOffset(),
    pitch: reducedMotion ? 0 : DEFAULT_PITCH,
    duration: reducedMotion ? 0 : 1400,
    curve: 1.5,
  })
}
