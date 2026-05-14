import { centroidFromLatLng } from '../game/shared/distance'
import missingFromFiftym from '../data/missing-from-50m.json'

interface MissingEntry {
  cca3: string
  ccn3: string
  name: string
  latlng: [number, number]   // [lat, lng] per the countries.json convention
}

const MARKER_HALF_DEG = 0.5

/**
 * Synthesize a small square polygon around each canonical country's centroid
 * for the IDs that countries-50m omits. We need every canonical-195 to be
 * present and clickable; the polygon shape doesn't need to be geographically
 * accurate, just hit-testable. Per the 2026-05-14 plan decision, the visual-
 * fidelity tradeoff (squares at high zoom on remote islands) is accepted in
 * exchange for the bundle savings (~700 KB gzip vs countries-10m).
 *
 * See scripts/inventory-50m.ts (one-off, deleted) for how the missing list
 * was derived, and src/data/missing-from-50m.json for the data.
 */
export function buildMissingFeatures(): GeoJSON.Feature[] {
  const list = missingFromFiftym as unknown as ReadonlyArray<MissingEntry>
  return list.map((entry) => {
    const [lng, lat] = centroidFromLatLng(entry.latlng)
    const ring: [number, number][] = [
      [lng - MARKER_HALF_DEG, lat - MARKER_HALF_DEG],
      [lng + MARKER_HALF_DEG, lat - MARKER_HALF_DEG],
      [lng + MARKER_HALF_DEG, lat + MARKER_HALF_DEG],
      [lng - MARKER_HALF_DEG, lat + MARKER_HALF_DEG],
      [lng - MARKER_HALF_DEG, lat - MARKER_HALF_DEG],
    ]
    return {
      type: 'Feature' as const,
      id: Number(entry.ccn3),
      properties: { id: entry.ccn3 },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [ring],
      },
    }
  })
}
