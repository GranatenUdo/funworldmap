import { useEffect, useRef, type RefObject } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CountryLike, GameMode, GameSession, GuessInput } from '../shared/types'
import { LAYER } from '../../lib/mapLayers'
import { REVEAL_CORRECT, REVEAL_WRONG, REVEAL_FAR } from '../../lib/mapPalette'
import { tessellateArc } from '../shared/distance'
import { computeRevealAnimationPlan } from '../shared/revealAnimation'
import { isCityGuessing } from '../shared/modePredicates'
import { prefersReducedMotion } from '../../lib/motion'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../../lib/mapStyles'
import {
  REVEAL_MARKER_SOURCE,
  REVEAL_LINE_SOURCE,
  REVEAL_MARKER_LAYER,
  REVEAL_LINE_LAYER,
} from '../shared/revealLayers'

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
    })
    map.addLayer({
      id: REVEAL_LINE_LAYER,
      type: 'line',
      source: REVEAL_LINE_SOURCE,
      paint: {
        'line-color': REVEAL_WRONG,
        'line-width': 3,
        'line-dasharray': [2, 2],
      },
    })
  }
}

function clearRevealSources(map: maplibregl.Map): void {
  const emptyFc = { type: 'FeatureCollection' as const, features: [] }
  const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource | undefined
  const lineSrc = map.getSource(REVEAL_LINE_SOURCE) as maplibregl.GeoJSONSource | undefined
  try {
    markerSrc?.setData(emptyFc)
    lineSrc?.setData(emptyFc)
  } catch { /* no-op */ }
}

export interface UseRevealMapEffectsArgs {
  session: GameSession
  mode: GameMode | null
  mapRef: RefObject<maplibregl.Map | null>
  byCca3: Map<string, CountryLike>
  submitGuessInput: (input: GuessInput) => void
}

/**
 * Drives the MapLibre reveal layer (geometry, arc animation, intermediate
 * flashes), camera resets on round start, the city-mode any-click handler,
 * and the idle-state reveal-source clear. Owns two anchor refs that track
 * "previous status" / "previous attempt count" so transitions into the
 * intermediate-flash effect don't replay already-recorded attempts on resume.
 */
export function useRevealMapEffects({
  session,
  mode,
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
      } catch { /* layer may not exist */ }
    }

    const plan = computeRevealAnimationPlan(reveal, byCca3, reduced)

    // No animation plan: city skip renders the target marker only; country
    // skip falls through to border pulse (already done above).
    if (!plan) {
      if (reveal.kind === 'point') {
        try {
          ensureRevealSources(map)
          const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource
          markerSrc.setData({
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: { type: 'Point', coordinates: reveal.targetCentroid },
              properties: {},
            }],
          })
        } catch (err) {
          console.warn('reveal marker skipped:', err)
        }
      }
      return () => {
        if (reveal.kind === 'country') {
          try { map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], '']) } catch { /* no-op */ }
        }
      }
    }

    const arc = tessellateArc(plan.from, plan.to, 64)
    const totalPoints = arc.length
    let frameId: number | null = null

    try {
      ensureRevealSources(map)
      const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource
      const lineSrc = map.getSource(REVEAL_LINE_SOURCE) as maplibregl.GeoJSONSource

      // Target marker goes in first so it is visible from t=0.
      markerSrc.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'Point', coordinates: plan.to },
          properties: {},
        }],
      })

      // Snap camera to the wrong-guess centroid; rAF loop will track the line head.
      map.jumpTo({ center: plan.from })

      if (plan.durationMs === 0) {
        lineSrc.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: arc },
            properties: {},
          }],
        })
        map.jumpTo({ center: plan.to })
      } else {
        const start = performance.now()
        let lastIdx = -1
        const step = (now: number) => {
          const linear = Math.min(1, (now - start) / plan.durationMs)
          // Ease-out cubic on the visible-arc index so both line growth and
          // camera tracking decelerate as they approach the target — feels
          // less like a snap on long globe rotations.
          const eased = 1 - Math.pow(1 - linear, 3)
          const idx = Math.max(1, Math.ceil(eased * (totalPoints - 1)))
          // Skip setData when the visible slice hasn't changed since the last
          // frame — saves a MapLibre tile rebuild on the final frame and on
          // any frames where rAF fires faster than the per-point step.
          if (idx !== lastIdx) {
            lastIdx = idx
            try {
              lineSrc.setData({
                type: 'FeatureCollection',
                features: [{
                  type: 'Feature',
                  geometry: { type: 'LineString', coordinates: arc.slice(0, idx + 1) },
                  properties: {},
                }],
              })
              map.jumpTo({ center: arc[idx] })
            } catch { /* source may have been torn down */ }
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
        try { map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], '']) } catch { /* no-op */ }
      }
    }
  }, [session.status, session.lastOutcome, byCca3])

  // Intermediate reveal between attempts (daily only): correctness-coloured
  // guess highlight + score toast.
  useEffect(() => {
    const enteringPlaying = prevStatusForIntermediateRef.current !== 'playing' && session.status === 'playing'
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
      } catch { /* layer may not exist */ }
      const t = window.setTimeout(() => {
        try { map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], '']) } catch { /* no-op */ }
      }, holdMs)
      return () => {
        window.clearTimeout(t)
        try { map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], '']) } catch { /* no-op */ }
      }
    }

    // City mode: distance-banded marker color.
    const d = last.reveal.distanceKm
    const colour = d < 50 ? REVEAL_CORRECT : d < 500 ? REVEAL_WRONG : REVEAL_FAR
    try {
      ensureRevealSources(map)
      const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource
      const point = last.reveal.clickedPoint
      if (point) {
        markerSrc.setData({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: point }, properties: { intermediate: true } }],
        })
        try { map.setPaintProperty(REVEAL_MARKER_LAYER, 'circle-color', colour) } catch { /* no-op */ }
      }
    } catch { /* style may still be resolving */ }
    const t = window.setTimeout(() => {
      try {
        clearRevealSources(map)
        map.setPaintProperty(REVEAL_MARKER_LAYER, 'circle-color', REVEAL_WRONG)
      } catch { /* no-op */ }
    }, holdMs)
    return () => {
      window.clearTimeout(t)
      try {
        clearRevealSources(map)
        map.setPaintProperty(REVEAL_MARKER_LAYER, 'circle-color', REVEAL_WRONG)
      } catch { /* no-op */ }
    }
  }, [session.status, session.attemptsPerRound, session.attemptsRemaining, session.currentAttempts])

  // Camera reset on round start when mode requests it.
  useEffect(() => {
    if (session.status !== 'playing' || !mode) return
    if (mode.initialCameraView !== 'world') return
    const map = mapRef.current
    if (!map) return
    const reduced = prefersReducedMotion()
    map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: reduced ? 0 : 700 })
  }, [session.status, session.roundIndex, mode])

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
    return () => { map.off('click', onClick) }
  }, [session.status, session.modeId, submitGuessInput])

  // Clear reveal geometry on every transition into idle.
  useEffect(() => {
    if (session.status !== 'idle') return
    const map = mapRef.current
    if (map) clearRevealSources(map)
  }, [session.status])
}
