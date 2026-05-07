import type { CountryLike, CountryReveal, PointReveal } from './types'
import { centroidFromLatLng } from './distance'

export interface RevealAnimationPlan {
  from: [number, number]
  to: [number, number]
  durationMs: number
}

const MIN_MS = 1500
const MAX_MS = 3000
const DIST_REF_KM = 10_000

function scaledDuration(distanceKm: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0
  const raw = (distanceKm / DIST_REF_KM) * MAX_MS
  return Math.max(MIN_MS, Math.min(MAX_MS, raw))
}

/**
 * Returns the endpoints and duration for a distance-reveal line animation, or
 * null when no animation should run (correct guess, skipped round, unknown
 * country).
 */
export function computeRevealAnimationPlan(
  reveal: CountryReveal | PointReveal,
  byCca3: Map<string, CountryLike>,
  reducedMotion: boolean,
): RevealAnimationPlan | null {
  if (reveal.kind === 'country') {
    if (reveal.correct) return null
    if (reveal.clickedCca3 === null) return null
    const fromC = byCca3.get(reveal.clickedCca3)
    const toC = byCca3.get(reveal.targetCca3)
    if (!fromC || !toC) return null
    const from = centroidFromLatLng(fromC.latlng)
    const to = centroidFromLatLng(toC.latlng)
    return { from, to, durationMs: scaledDuration(reveal.distanceKm ?? 0, reducedMotion) }
  }
  if (reveal.clickedPoint === null) return null
  return {
    from: reveal.clickedPoint,
    to: reveal.targetCentroid,
    durationMs: scaledDuration(reveal.distanceKm, reducedMotion),
  }
}
