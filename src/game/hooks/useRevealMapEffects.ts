import { useEffect, useRef, type RefObject } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CountryLike, GameSession, GuessInput } from '../shared/types'
import { LAYER } from '../../lib/mapLayers'
import { REVEAL_CORRECT, REVEAL_WRONG, REVEAL_FAR } from '../../lib/mapPalette'
import { tessellateArc } from '../shared/distance'
import { computeRevealAnimationPlan } from '../shared/revealAnimation'
import { isCityGuessing } from '../shared/modePredicates'
import { prefersReducedMotion } from '../../lib/motion'
import {
  REVEAL_MARKER_SOURCE,
  REVEAL_LINE_SOURCE,
  REVEAL_MARKER_LAYER,
  REVEAL_LINE_LAYER,
} from '../shared/revealLayers'

/** Number of segments used to tessellate the reveal arc. The line-gradient
 *  quantiser uses the same value so per-frame paint updates can never resolve
 *  finer than the geometry itself. */
const ARC_SEGMENTS = 64

/** Transparent tail color for the line-gradient step expression — sits past
 *  the visible-progress boundary so the un-revealed portion of the arc is
 *  invisible. */
const TRANSPARENT = 'rgba(0,0,0,0)'

function ensureRevealSources(map: maplibregl.Map): void {
  if (!map.getSource(REVEAL_MARKER_SOURCE)) {
    map.addSource(REVEAL_MARKER_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
    map.addLayer({
      id: REVEAL_MARKER_LAYER,
      type: 'circle',
      source: REVEAL_MARKER_SOURCE,
      paint: {
        'circle-radius': 10,
        'circle-color': REVEAL_WRONG,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    })
  }
  if (!map.getSource(REVEAL_LINE_SOURCE)) {
    map.addSource(REVEAL_LINE_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      lineMetrics: true,
    })
    map.addLayer({
      id: REVEAL_LINE_LAYER,
      type: 'line',
      source: REVEAL_LINE_SOURCE,
      paint: {
        'line-color': REVEAL_WRONG, // base; overridden by line-gradient per frame
        'line-width': 3,
        'line-dasharray': [2, 2],
        'line-gradient': ['step', ['line-progress'], REVEAL_WRONG, 0, TRANSPARENT],
      },
    })
  }
}

function clearRevealSources(map: maplibregl.Map): void {
  const emptyFc = { type: 'FeatureCollection' as const, features: [] }
  const markerSrc = map.getSource<maplibregl.GeoJSONSource>(REVEAL_MARKER_SOURCE)
  const lineSrc = map.getSource<maplibregl.GeoJSONSource>(REVEAL_LINE_SOURCE)
  try {
    markerSrc?.setData(emptyFc)
    lineSrc?.setData(emptyFc)
  } catch {
    /* no-op */
  }
}

export interface UseRevealMapEffectsArgs {
  session: GameSession
  mapRef: RefObject<maplibregl.Map | null>
  byCca3: Map<string, CountryLike>
  submitGuessInput: (input: GuessInput) => void
}

/**
 * Drives the MapLibre reveal layer (geometry, arc animation, intermediate
 * flashes), the city-mode any-click handler, and the idle-state reveal-source
 * clear. Owns two anchor refs that track "previous status" / "previous attempt
 * count" so transitions into the intermediate-flash effect don't replay
 * already-recorded attempts on resume.
 */
export function useRevealMapEffects({
  session,
  mapRef,
  byCca3,
  submitGuessInput,
}: UseRevealMapEffectsArgs): void {
  const lastIntermediateAttemptCountRef = useRef(0)
  const prevStatusForIntermediateRef = useRef<typeof session.status>('idle')

  // Reveal geometry: on round-ended, update marker + line sources, snap the
  // camera to the guess centroid, and (for non-correct reveals with a known
  // guess location) animate the dashed line growing along the geodesic arc
  // while the camera tracks the line head to the target.
  useEffect(() => {
    if (session.status !== 'round-ended' || !session.lastOutcome) return
    const map = mapRef.current
    if (!map) return

    const reveal = session.lastOutcome.reveal
    const reduced = prefersReducedMotion()

    if (reveal.kind === 'country') {
      try {
        map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], reveal.targetCca3])
        const colour = reveal.correct ? REVEAL_CORRECT : REVEAL_WRONG
        map.setPaintProperty(LAYER.hoverBorder, 'line-color', colour)
        map.setPaintProperty(LAYER.hoverBorder, 'line-width', reduced ? 3 : 4)
      } catch {
        /* layer may not exist */
      }
    }

    const plan = computeRevealAnimationPlan(reveal, byCca3, reduced)

    // No animation plan: city skip renders the target marker only; country
    // skip falls through to border pulse (already done above).
    if (!plan) {
      if (reveal.kind === 'point') {
        try {
          ensureRevealSources(map)
          const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource
          map.setPaintProperty(REVEAL_MARKER_LAYER, 'circle-color', REVEAL_WRONG)
          markerSrc.setData({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: reveal.targetCentroid },
                properties: {},
              },
            ],
          })
        } catch (err) {
          console.warn('reveal marker skipped:', err)
        }
      }
      return () => {
        if (reveal.kind === 'country') {
          try {
            map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], ''])
          } catch {
            /* no-op */
          }
        }
        clearRevealSources(map)
      }
    }

    const arc = tessellateArc(plan.from, plan.to, ARC_SEGMENTS)
    let frameId: number | null = null

    try {
      ensureRevealSources(map)
      const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource
      const lineSrc = map.getSource(REVEAL_LINE_SOURCE) as maplibregl.GeoJSONSource

      // Target marker goes in first so it is visible from t=0.
      map.setPaintProperty(REVEAL_MARKER_LAYER, 'circle-color', REVEAL_WRONG)
      markerSrc.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: plan.to },
            properties: {},
          },
        ],
      })

      // Full arc loaded ONCE — line-gradient masks the visible portion per
      // frame, so no per-frame setData / tile rebuild.
      lineSrc.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: arc },
            properties: {},
          },
        ],
      })

      if (plan.durationMs === 0) {
        // Reduced-motion: snap line fully visible, jump camera to target.
        map.setPaintProperty(REVEAL_LINE_LAYER, 'line-gradient', [
          'step',
          ['line-progress'],
          REVEAL_WRONG,
          1,
          TRANSPARENT,
        ])
        map.jumpTo({ center: plan.to })
      } else {
        // Snap camera to the wrong-guess start so easeTo has a deterministic
        // starting position regardless of where the user was looking.
        map.jumpTo({ center: plan.from })
        map.easeTo({
          center: plan.to,
          duration: plan.durationMs,
          easing: (t) => 1 - Math.pow(1 - t, 3),
        })
        // Set the initial gradient synchronously (progress = 0, fully hidden)
        // so the line is in a deterministic state before the first rAF tick.
        try {
          map.setPaintProperty(REVEAL_LINE_LAYER, 'line-gradient', [
            'step',
            ['line-progress'],
            REVEAL_WRONG,
            0,
            TRANSPARENT,
          ])
        } catch {
          /* layer torn down */
        }
        const start = performance.now()
        let lastProgress = 0
        const step = (now: number) => {
          const linear = Math.min(1, (now - start) / plan.durationMs)
          const eased = 1 - Math.pow(1 - linear, 3)
          // Quantise progress to 1/64 increments to skip redundant paint-property
          // updates when rAF fires faster than a visible change.
          const quantised = Math.round(eased * ARC_SEGMENTS) / ARC_SEGMENTS
          if (quantised !== lastProgress) {
            lastProgress = quantised
            try {
              map.setPaintProperty(REVEAL_LINE_LAYER, 'line-gradient', [
                'step',
                ['line-progress'],
                REVEAL_WRONG,
                quantised,
                TRANSPARENT,
              ])
            } catch {
              /* layer torn down */
            }
          }
          frameId = linear < 1 ? window.requestAnimationFrame(step) : null
        }
        frameId = window.requestAnimationFrame(step)
      }
    } catch (err) {
      console.warn('reveal geometry skipped:', err)
    }

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      if (reveal.kind === 'country') {
        try {
          map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], ''])
        } catch {
          /* no-op */
        }
      }
      // Always clear marker + line sources. Both country wrong-guesses (when
      // clickedCca3 is known) and city reveals draw these via
      // computeRevealAnimationPlan, so the cleanup is mode-neutral.
      clearRevealSources(map)
    }
  }, [session.status, session.lastOutcome, byCca3])

  // Intermediate reveal between attempts (daily only): correctness-coloured
  // guess highlight + score toast.
  useEffect(() => {
    const enteringPlaying =
      prevStatusForIntermediateRef.current !== 'playing' && session.status === 'playing'
    prevStatusForIntermediateRef.current = session.status
    if (enteringPlaying) {
      // On fresh start: 0. On resume: the resumed attempts count, so the
      // already-recorded latest attempt does not paint a phantom flash.
      lastIntermediateAttemptCountRef.current = session.currentAttempts.length
    }
    if (session.status !== 'playing') return
    if (session.attemptsPerRound <= 1) return
    const cur = session.currentAttempts.length
    const prev = lastIntermediateAttemptCountRef.current
    lastIntermediateAttemptCountRef.current = cur
    if (cur === 0) return
    if (cur <= prev) return
    const last = session.currentAttempts[cur - 1]
    if (last.reveal.kind !== 'country') return // city handled by separate effect below
    const map = mapRef.current
    if (!map) return
    const reduced = prefersReducedMotion()
    const holdMs = reduced ? 0 : 600

    if (last.reveal.kind === 'country') {
      const colour = last.reveal.correct ? REVEAL_CORRECT : REVEAL_WRONG
      try {
        map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], last.reveal.clickedCca3 ?? ''])
        map.setPaintProperty(LAYER.hoverBorder, 'line-color', colour)
        map.setPaintProperty(LAYER.hoverBorder, 'line-width', 3)
      } catch {
        /* layer may not exist */
      }
      const t = window.setTimeout(() => {
        try {
          map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], ''])
        } catch {
          /* no-op */
        }
      }, holdMs)
      return () => {
        window.clearTimeout(t)
        try {
          map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], ''])
        } catch {
          /* no-op */
        }
      }
    }
  }, [session.status, session.attemptsPerRound, session.attemptsRemaining, session.currentAttempts])

  // Persistent intermediate marker (city best-of-N) — no timeout. Replaced by
  // the next click via setData, by the round-ended geometry effect, or by the
  // idle-clear effect on game end. The cleanup-on-timeout pattern would defeat
  // the legibility goal (the user needs to see their guess until they pick again).
  useEffect(() => {
    if (session.status !== 'playing') return
    if (session.attemptsPerRound <= 1) return
    if (!isCityGuessing(session.modeId)) return
    if (session.currentAttempts.length === 0) return
    const last = session.currentAttempts[session.currentAttempts.length - 1]
    if (last.reveal.kind !== 'point') return
    const point = last.reveal.clickedPoint
    if (point === null) return
    const map = mapRef.current
    if (!map) return
    const d = last.reveal.distanceKm
    const colour = d < 50 ? REVEAL_CORRECT : d < 500 ? REVEAL_WRONG : REVEAL_FAR
    try {
      ensureRevealSources(map)
      const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource
      markerSrc.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: point },
            properties: { intermediate: true },
          },
        ],
      })
      map.setPaintProperty(REVEAL_MARKER_LAYER, 'circle-color', colour)
    } catch {
      /* style may still be resolving */
    }
  }, [session.status, session.attemptsPerRound, session.modeId, session.currentAttempts])

  // City-mode any-click handler.
  useEffect(() => {
    if (session.status !== 'playing') return
    if (!isCityGuessing(session.modeId)) return
    const map = mapRef.current
    if (!map) return
    const onClick = (e: maplibregl.MapMouseEvent) => {
      submitGuessInput({ kind: 'point', lngLat: [e.lngLat.lng, e.lngLat.lat] })
    }
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
    }
  }, [session.status, session.modeId, submitGuessInput])

  // Clear reveal geometry on every transition into idle.
  useEffect(() => {
    if (session.status !== 'idle') return
    const map = mapRef.current
    if (map) clearRevealSources(map)
  }, [session.status])
}
