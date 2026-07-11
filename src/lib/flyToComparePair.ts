import type maplibregl from 'maplibre-gl'
import type { CountryData } from './types'
import { DEFAULT_PITCH, DEFAULT_ZOOM } from './mapStyles'
import { prefersReducedMotion } from './motion'
import { panelScreenOffset } from './layoutConstants'

/** Approximate a country's half-extent in degrees of latitude: half the side
 *  of the equivalent-area square (sqrt(area) km / 2) at ~111 km per degree.
 *  France (543,908 km²) → ~3.3°, matching its real ~6.5° half-span well
 *  enough for framing. */
function halfExtentDeg(country: CountryData): number {
  return Math.sqrt(Math.max(country.area, 0)) / 222
}

/** Frame BOTH compared countries in the area the compare panel does not
 *  cover (batch-2 spec §3). Centroid bounds are extended by area-derived
 *  half-extents because raw centroid boxes underframe adjacent pairs (live
 *  pass 2026-07-11) — 80px padding alone can't absorb the shortfall for
 *  neighbours like France/Germany. Longitudes >180° apart are shifted so
 *  the box crosses the antimeridian instead of wrapping the long way.
 *  Pairs wider than a globe face (>110°, e.g. Japan+USA) skip framing
 *  entirely and fly to the pair's midpoint at world zoom instead — no
 *  offset trick can fit both countries in one globe-projection frame
 *  (spec §3's designed fallback; live pass 2026-07-11). */
export function flyToComparePair(map: maplibregl.Map, a: CountryData, b: CountryData): void {
  const [latA, lngA] = a.latlng
  const [latB, rawLngB] = b.latlng
  const lngB = Math.abs(rawLngB - lngA) > 180 ? rawLngB + (rawLngB < lngA ? 360 : -360) : rawLngB

  const rA = halfExtentDeg(a)
  const rB = halfExtentDeg(b)
  const lngScale = (lat: number) => 1 / Math.cos((Math.min(Math.abs(lat), 75) * Math.PI) / 180)

  const bounds: [[number, number], [number, number]] = [
    [
      Math.min(lngA - rA * lngScale(latA), lngB - rB * lngScale(latB)),
      Math.min(latA - rA, latB - rB),
    ],
    [
      Math.max(lngA + rA * lngScale(latA), lngB + rB * lngScale(latB)),
      Math.max(latA + rA, latB + rB),
    ],
  ]
  const reducedMotion = prefersReducedMotion()

  const [[west], [east]] = bounds
  // A globe face cannot frame a pair this wide no matter the offset — fall
  // back to the pair's midpoint at world zoom (spec §3's designed fallback;
  // Japan+USA live pass 2026-07-11). lngB is already antimeridian-shifted,
  // so the arithmetic midpoint is the circular midpoint.
  const WIDE_PAIR_SPAN_DEG = 110
  if (east - west > WIDE_PAIR_SPAN_DEG) {
    map.flyTo({
      center: [(lngA + lngB) / 2, (latA + latB) / 2],
      zoom: DEFAULT_ZOOM,
      pitch: reducedMotion ? 0 : DEFAULT_PITCH,
      duration: reducedMotion ? 0 : 1400,
      curve: 1.5,
    })
    return
  }

  const offsetCamera = map.cameraForBounds(bounds, {
    padding: 80,
    offset: panelScreenOffset('compare'),
  })
  if (!offsetCamera) return
  // At globe-scale zooms a screen offset equates to tens of degrees of
  // rotation and swings one country past the horizon (Japan+USA, live pass
  // 2026-07-11). The un-occluded viewport still shows the whole globe face
  // there, so drop the offset instead.
  const GLOBE_SCALE_ZOOM = 2.2
  const camera =
    (offsetCamera.zoom ?? 0) < GLOBE_SCALE_ZOOM
      ? (map.cameraForBounds(bounds, { padding: 80 }) ?? offsetCamera)
      : offsetCamera

  map.flyTo({
    ...camera,
    pitch: reducedMotion ? 0 : DEFAULT_PITCH,
    duration: reducedMotion ? 0 : 1400,
    curve: 1.5,
  })
}
