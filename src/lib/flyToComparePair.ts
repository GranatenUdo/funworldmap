import type maplibregl from 'maplibre-gl'
import type { CountryData } from './types'
import { DEFAULT_PITCH, DEFAULT_ZOOM } from './mapStyles'
import { prefersReducedMotion } from './motion'
import {
  COMPARE_FRAME_PADDING_PX,
  comparePanelPadding,
  DESKTOP_MEDIA_QUERY,
} from './layoutConstants'

/** Approximate a country's half-extent in degrees of latitude: half the side
 *  of the equivalent-area square (sqrt(area) km / 2) at ~111 km per degree.
 *  France (543,908 km²) → ~3.3°, matching its real ~6.5° half-span well
 *  enough for framing. */
function halfExtentDeg(country: CountryData): number {
  return Math.sqrt(Math.max(country.area, 0)) / 222
}

/** Frame BOTH compared countries in the area the compare panel does not
 *  cover. B6 (2026-07-28) replaced batch-2's screen offset with asymmetric
 *  cameraForBounds padding (the panel footprint as extra `right` padding,
 *  from comparePanelPadding): an offset only shifted the center while zoom
 *  stayed sized to the FULL viewport, so country B still slid under the
 *  panel — padding folds the occluded area into BOTH zoom and center, and
 *  the returned camera bakes the shift in, so the flyTo needs no padding.
 *  Centroid bounds are extended by area-derived half-extents because raw
 *  centroid boxes underframe adjacent pairs (live pass 2026-07-11) — padding
 *  alone can't absorb the shortfall for neighbours like France/Germany.
 *  Longitudes >180° apart are shifted so the box crosses the antimeridian
 *  instead of wrapping the long way. Pairs wider than a globe face (>110°,
 *  e.g. Japan+USA) skip framing entirely and fly to the pair's midpoint at
 *  world zoom instead — no padding trick can fit both countries in one
 *  globe-projection frame (batch-2 spec §3's designed fallback, kept by B6;
 *  live pass 2026-07-11). */
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
  // A globe face cannot frame a pair this wide no matter the padding — fall
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

  const paddedCamera = map.cameraForBounds(bounds, { padding: comparePanelPadding() })
  if (!paddedCamera) return
  // At globe-scale zooms the panel-footprint padding equates to tens of
  // degrees of rotation and can swing one country past the horizon (the
  // failure mode batch-2's offset showed on Japan+USA, live pass 2026-07-11).
  // The un-occluded viewport still shows the whole globe face there, so fall
  // back to symmetric padding. B6 keeps this guard as the CONSERVATIVE
  // DEFAULT — remove only after the live matrix in the B-core plan passes
  // without it. NOTE: padded zooms run systematically lower than the
  // offset-era zooms this 2.2 threshold was tuned against (the footprint now
  // shrinks the fitting area by ~672px), so the guard fires for more pairs
  // than before — part of what the live step evaluates.
  // DESKTOP-ONLY (C6, 2026-07-28): the guard exists for the horizontal
  // footprint swing above. On mobile the asymmetry is vertical (the sheet's
  // bottom padding) and the fitting strip is only ~20% of the viewport, so
  // padded zooms sit below 2.2 routinely — a firing guard would fall back
  // to symmetric padding and re-center the pair under the sheet, undoing
  // C6's framing. If the vertical swing ever shows a past-the-horizon case
  // on device, fix it with a mobile-specific clamp, not this fallback.
  const GLOBE_SCALE_ZOOM = 2.2
  const camera =
    window.matchMedia(DESKTOP_MEDIA_QUERY).matches && (paddedCamera.zoom ?? 0) < GLOBE_SCALE_ZOOM
      ? (map.cameraForBounds(bounds, { padding: COMPARE_FRAME_PADDING_PX }) ?? paddedCamera)
      : paddedCamera

  map.flyTo({
    ...camera,
    pitch: reducedMotion ? 0 : DEFAULT_PITCH,
    duration: reducedMotion ? 0 : 1400,
    curve: 1.5,
  })
}
