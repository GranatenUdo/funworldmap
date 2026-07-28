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

/** Reveal fill pulse (B5) — fill-opacity waveform for the dedicated
 *  `country-reveal-fill` layer (see ensureRevealFillLayer in
 *  src/lib/mapLayers.ts; driven by useRevealMapEffects). Map paint
 *  animations are invisible to Element.getAnimations, so this pure
 *  function is the unit-tested animation contract — the same pattern as
 *  computeRevealAnimationPlan above. */
export const REVEAL_FILL_PEAK = 0.35
export const REVEAL_FILL_TROUGH = 0.12
export const REVEAL_FILL_SETTLED = 0.15
/** Static fill under prefers-reduced-motion — no rAF loop runs at all. */
export const REVEAL_FILL_REDUCED = 0.2
/** Two beats of 600 ms each. */
export const REVEAL_FILL_PULSE_MS = 1200
const PULSE_BEATS = 2

/**
 * Fill opacity at `elapsedMs` since reveal: two cosine beats
 * (peak → trough → peak → trough) blended linearly toward the settled
 * value, so the pulse visibly decays and lands exactly on
 * REVEAL_FILL_SETTLED at REVEAL_FILL_PULSE_MS with no discontinuity.
 */
export function revealFillOpacityAt(elapsedMs: number): number {
  if (elapsedMs >= REVEAL_FILL_PULSE_MS) return REVEAL_FILL_SETTLED
  const t = Math.max(0, elapsedMs) / REVEAL_FILL_PULSE_MS
  const wave =
    REVEAL_FILL_TROUGH +
    ((REVEAL_FILL_PEAK - REVEAL_FILL_TROUGH) * (1 + Math.cos(2 * Math.PI * PULSE_BEATS * t))) / 2
  return wave + (REVEAL_FILL_SETTLED - wave) * t
}
