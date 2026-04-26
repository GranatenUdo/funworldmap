import { useEffect, useMemo, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import type { AttemptRecord, CityLike, CountryLike, GuessInput, ModeId, RoundSpec } from './shared/types'
import { useGameSessionContext } from './shared/GameSessionProvider'
import { usePersonalBests } from './shared/usePersonalBests'
import { getMode } from './modes'
import { HudShell } from './shared/hud/HudShell'
import { GameOverOverlay } from './shared/hud/GameOverOverlay'
import { FirstSessionTutorial } from './shared/hud/FirstSessionTutorial'
import { useMap } from '../hooks/useMap'
import { parseHash } from '../lib/hashState'
import { LAYER } from '../lib/mapLayers'
import { centroidFromLatLng, tessellateArc } from './shared/distance'
import { computeRevealAnimationPlan } from './shared/revealAnimation'
import { prefersReducedMotion } from '../lib/motion'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../lib/mapStyles'
import { CityGuessingHudActionsContext } from './modes/city-guessing'
import { buildCountryDailyRound, buildCityDailyRound } from './daily/dailyRound'
import { toLocalDateString } from './daily/dates'
import { useDailyPuzzlesContext } from './daily/DailyPuzzlesProvider'
import { useDailyHistory } from './daily/useDailyHistory'
import { readResume, writeResume, clearResume } from './daily/resume'
import { track } from '../lib/analytics'

import {
  REVEAL_MARKER_SOURCE,
  REVEAL_LINE_SOURCE,
  REVEAL_MARKER_LAYER,
  REVEAL_LINE_LAYER,
} from './shared/revealLayers'

const REVEAL_MS_COUNTRY = 1200
const REVEAL_MS_CITY = 2000

function dispatchAnnouncement(text: string): void {
  window.dispatchEvent(new CustomEvent('funworldmap:announce', { detail: text }))
}

function writeIdleHash(): void {
  const h = window.location.hash
  if (h.startsWith('#game') || h.startsWith('#daily')) {
    history.replaceState(null, '', window.location.pathname)
  }
}

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
        'circle-color': '#f59e0b',
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
        'line-color': '#f59e0b',
        'line-width': 2,
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

interface Props {
  countries: CountryLike[]
  cities: CityLike[]
  byCca3: Map<string, CountryLike>
}

export function GameController({ countries, cities, byCca3 }: Props) {
  const { mapRef } = useMap()
  const { session, mode, start, submitGuessInput, completeNow, resume, advance, overrideRound, endGame } = useGameSessionContext()
  const { best, record } = usePersonalBests(session.modeId || 'country-pinning')
  const dailyPuzzles = useDailyPuzzlesContext()
  const { record: recordDailyResult, get: dailyHistoryGet } = useDailyHistory()
  const recordedRef = useRef(false)
  const pendingStartRef = useRef<ModeId | null>(null)
  // Guard the reveal-route deep_link_opened emit against re-fires when deps
  // change (e.g. byDate reference update after index load). Stores the last
  // hash string for which the event was emitted — reset on hashchange.
  const lastRevealEmitHashRef = useRef<string | null>(null)

  // Pool derivation for the hash-bootstrap path (which needs `getMode` for
  // the first round ahead of the reducer running).
  const pools = useMemo(() => ({ countries, cities }), [countries, cities])

  // Hash → session bootstrap. Read status via ref (hashchange closure-staleness fix).
  const statusRef = useRef(session.status)
  statusRef.current = session.status
  useEffect(() => {
    const check = () => {
      const state = parseHash(window.location.hash)
      // Early reveal-route emit: fires before modeId check since reveal-only routes
      // may have modeId null (e.g. /#daily/<date>/reveal).
      // Deduped by hash string so re-runs triggered by deps changes (e.g. byDate
      // reference update when the daily index loads) don't double-count.
      if (state.kind === 'daily' && state.reveal) {
        const currentHash = window.location.hash
        if (lastRevealEmitHashRef.current !== currentHash) {
          lastRevealEmitHashRef.current = currentHash
          const todayStr = toLocalDateString(new Date())
          const dateKind: 'today' | 'past' | 'future' =
            state.date === todayStr ? 'today' : state.date < todayStr ? 'past' : 'future'
          track('deep_link_opened', { dateKind, outcome: 'reveal' })
        }
        return
      }
      // Daily routes (Phase 2 handles /#daily/<date>/<modeId> for TODAY only;
      // /#daily/<date> is launcher-anchored; past/future are Phase 3 reveal territory).
      if (state.kind === 'daily' && state.modeId && !state.reveal && statusRef.current === 'idle') {
        const id = state.modeId as ModeId
        if (id !== 'country-pinning' && id !== 'city-guessing') return

        const todayStr = toLocalDateString(new Date())

        if (state.date > todayStr) {
          // Future: send to root (handled by launcher when hash clears).
          track('deep_link_opened', { dateKind: 'future', outcome: 'redirect' })
          history.replaceState(null, '', window.location.pathname)
          window.dispatchEvent(new HashChangeEvent('hashchange'))
          return
        }

        const alreadyPlayed = dailyHistoryGet(state.date, id) !== null
        if (state.date < todayStr || alreadyPlayed) {
          const dateKind: 'today' | 'past' = state.date < todayStr ? 'past' : 'today'
          track('deep_link_opened', { dateKind, outcome: 'redirect' })
          window.location.hash = `daily/${state.date}/${id}/reveal`
          return
        }

        const hasPool = id === 'country-pinning' ? countries.length > 0 : cities.length > 0
        if (!hasPool) {
          pendingStartRef.current = id
          return
        }
        const puzzle = dailyPuzzles.byDate(state.date)
        if (!puzzle) return
        const firstRound =
          id === 'country-pinning'
            ? buildCountryDailyRound(puzzle.country.cca3, countries)
            : buildCityDailyRound(puzzle.city.id, cities)
        if (!firstRound) {
          window.dispatchEvent(new CustomEvent('funworldmap:toast', {
            detail: 'Daily content unavailable — try again shortly.',
          }))
          return
        }

        const resumed = readResume()
        if (resumed && resumed.date === state.date && resumed.modeId === id && resumed.attempts.length > 0) {
          resume({ modeId: id, round: firstRound, attemptsPerRound: 3, attempts: resumed.attempts })
          track('deep_link_opened', { dateKind: 'today', outcome: 'resume' })
          return
        }
        start(id, firstRound, 1, 3)
        track('deep_link_opened', { dateKind: 'today', outcome: 'start' })
        track('daily_started', { mode: id })
        return
      }
      if (state.kind === 'game' && statusRef.current === 'idle') {
        const id = state.modeId as ModeId
        if (id !== 'country-pinning' && id !== 'city-guessing') return
        const hasPool = id === 'country-pinning' ? countries.length > 0 : cities.length > 0
        if (!hasPool) {
          pendingStartRef.current = id
          return
        }
        const m = getMode(id, pools)
        const firstRound = m.nextRound(new Set())
        start(id, firstRound, m.maxRounds)
        track('free_started', { mode: id })
      }
      if (state.kind !== 'game' && state.kind !== 'daily' && statusRef.current !== 'idle') {
        endGame()
      }
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries.length, cities.length, dailyPuzzles.byDate, dailyHistoryGet])

  // Drain deferred start once the relevant pool arrives.
  useEffect(() => {
    const pending = pendingStartRef.current
    if (!pending || session.status !== 'idle') return
    const hasPool = pending === 'country-pinning' ? countries.length > 0 : cities.length > 0
    if (!hasPool) return
    // Check what kind of start we need based on current hash:
    const state = parseHash(window.location.hash)
    if (state.kind === 'daily' && state.modeId && state.date === toLocalDateString(new Date())) {
      const puzzle = dailyPuzzles.byDate(state.date)
      if (!puzzle) return
      pendingStartRef.current = null
      const firstRound =
        pending === 'country-pinning'
          ? buildCountryDailyRound(puzzle.country.cca3, countries)
          : buildCityDailyRound(puzzle.city.id, cities)
      if (!firstRound) {
        window.dispatchEvent(new CustomEvent('funworldmap:toast', {
          detail: 'Daily content unavailable — try again shortly.',
        }))
        return
      }
      const resumed = readResume()
      if (resumed && resumed.date === state.date && resumed.modeId === pending && resumed.attempts.length > 0) {
        resume({ modeId: pending, round: firstRound, attemptsPerRound: 3, attempts: resumed.attempts })
        track('deep_link_opened', { dateKind: 'today', outcome: 'resume' })
        return
      }
      start(pending, firstRound, 1, 3)
      track('deep_link_opened', { dateKind: 'today', outcome: 'start' })
      track('daily_started', { mode: pending })
      return
    }
    pendingStartRef.current = null
    const m = getMode(pending, pools)
    const firstRound = m.nextRound(new Set())
    start(pending, firstRound, m.maxRounds)
    track('free_started', { mode: pending })
  }, [countries, cities, session.status, pools, start, resume, dailyPuzzles])

  // Persist daily best-of-N progress to localStorage so refresh resumes.
  useEffect(() => {
    if (session.status !== 'playing') return
    if (session.attemptsPerRound <= 1) return
    if (session.currentAttempts.length === 0) return
    const state = parseHash(window.location.hash)
    if (state.kind !== 'daily' || !state.modeId) return
    writeResume({
      version: 1,
      date: state.date,
      modeId: state.modeId as ModeId,
      attempts: session.currentAttempts,
    })
  }, [session.status, session.attemptsPerRound, session.currentAttempts])

  // Side effects on status change.
  useEffect(() => {
    if (!mode) return
    if (session.status === 'playing' && session.currentRound) {
      if (session.roundIndex === 0) recordedRef.current = false
      if (session.currentRound.kind === 'country-pinning') {
        dispatchAnnouncement(`Pin: ${session.currentRound.targetName}`)
      } else {
        const r = session.currentRound
        dispatchAnnouncement(`Round ${session.roundIndex + 1}. Where is ${r.targetName}, ${r.targetCountryName}? Click anywhere on the map.`)
      }
    }
    if (session.status === 'round-ended' && session.lastOutcome) {
      const o = session.lastOutcome
      if (o.reveal.kind === 'country') {
        dispatchAnnouncement(
          o.reveal.correct
            ? `Correct. Plus ${o.pointsEarned} points.`
            : `Wrong. Plus ${o.pointsEarned} points. ${session.lives === 1 ? 'One life remaining.' : `${session.lives} lives remaining.`}`,
        )
      } else {
        const d = o.reveal.distanceKm
        if (o.reveal.clickedPoint === null) {
          dispatchAnnouncement(`Skipped round.`)
        } else {
          dispatchAnnouncement(`${Math.round(d)} kilometres off. Plus ${o.pointsEarned} points.`)
        }
      }
      const isFinalOutcome =
        session.attemptsPerRound === 1 || session.attemptsRemaining === 0
      const isCountryPinning = session.modeId === 'country-pinning'
      const isCorrect =
        session.lastOutcome.reveal?.kind === 'country'
          ? session.lastOutcome.reveal.correct
          : false

      const advanceNow = () => {
        const next = mode.nextRound(session.used)
        advance(next)
      }

      // Auto-advance timing: derived from the animation duration when a line
      // animation is firing; otherwise the existing per-mode constant.
      const plan = session.lastOutcome
        ? computeRevealAnimationPlan(session.lastOutcome.reveal, byCca3, prefersReducedMotion())
        : null
      const animatedMs = plan ? Math.max(plan.durationMs + 300, 1800) : null

      if (isCountryPinning && !isFinalOutcome) {
        const ms = animatedMs ?? REVEAL_MS_COUNTRY
        const t = window.setTimeout(advanceNow, ms)
        return () => window.clearTimeout(t)
      }
      if (!isCountryPinning) {
        const ms = animatedMs ?? REVEAL_MS_CITY
        const t = window.setTimeout(advanceNow, ms)
        return () => window.clearTimeout(t)
      }

      // Country-pinning final outcome + correct → 3000ms auto-advance, scoped keyboard early-skip.
      if (isCorrect) {
        const t = window.setTimeout(advanceNow, 3000)
        const onKey = (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
            window.clearTimeout(t)
            window.removeEventListener('keydown', onKey)
            advanceNow()
          }
        }
        window.addEventListener('keydown', onKey)
        return () => {
          window.clearTimeout(t)
          window.removeEventListener('keydown', onKey)
        }
      }

      // Country-pinning final outcome + wrong → no timer; Escape advances (Continue button is the primary click path).
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') advanceNow()
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }
    if (session.status === 'game-over' && !recordedRef.current) {
      recordedRef.current = true
      const hash = parseHash(window.location.hash)
      const isDaily = hash.kind === 'daily'
      if (!isDaily) record(session.score, session.bestStreak)
      // Daily-specific recording:
      if (hash.kind === 'daily' && hash.modeId) {
        const attempts: AttemptRecord[] = session.currentAttempts
        recordDailyResult(hash.date, hash.modeId as ModeId, {
          score: session.score,
          attempts: attempts.map((a) => ({
            pointsEarned: a.pointsEarned,
            guessCca3: a.input.kind === 'country' ? a.input.cca3 : undefined,
            guessLngLat: a.input.kind === 'point' ? a.input.lngLat : undefined,
            distanceKm: a.reveal.distanceKm,
          })),
          completedAt: Date.now(),
        })
        track('daily_completed', {
          mode: session.modeId,
          bestScoreBucket: Math.min(4, Math.floor(session.score / 20)),
          attemptsUsed: attempts.length,
        })
      }
      dispatchAnnouncement(`Game over. Final score ${session.score}.`)
    }
  }, [
    session.status, session.roundIndex, session.lastOutcome, session.score,
    session.bestStreak, session.lives, session.used, session.currentRound, session.modeId,
    session.currentAttempts,
    advance, mode, record, recordDailyResult, byCca3,
  ])

  // Fire daily_attempted per intermediate attempt (only when attemptsPerRound > 1).
  // Tracks per-effect "previous status" so a transition into 'playing' anchors
  // the count to currentAttempts.length — fresh starts begin at 0; resumes
  // begin at the resumed attempts count, so replayed attempts don't fire.
  const lastAttemptCountRef = useRef(0)
  const prevStatusForTelemetryRef = useRef<typeof session.status>('idle')
  // Same anchor for the intermediate-reveal effect.
  const lastIntermediateAttemptCountRef = useRef(0)
  const prevStatusForIntermediateRef = useRef<typeof session.status>('idle')
  useEffect(() => {
    const enteringPlaying = prevStatusForTelemetryRef.current !== 'playing' && session.status === 'playing'
    prevStatusForTelemetryRef.current = session.status
    if (enteringPlaying) {
      lastAttemptCountRef.current = session.currentAttempts.length
    }
    if (session.status !== 'playing' && session.status !== 'round-ended' && session.status !== 'game-over') {
      return
    }
    const prev = lastAttemptCountRef.current
    const cur = session.currentAttempts.length
    if (cur > prev) {
      const a = session.currentAttempts[cur - 1]
      if (session.attemptsPerRound > 1) {
        track('daily_attempted', {
          mode: session.modeId,
          attemptIndex: prev,
          scoreBucket: Math.min(4, Math.floor(a.pointsEarned / 20)),
        })
      }
    }
    lastAttemptCountRef.current = cur
  }, [session.status, session.currentAttempts, session.attemptsPerRound, session.modeId])

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
        const colour = reveal.correct ? '#22c55e' : '#f59e0b'
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
          const progress = Math.min(1, (now - start) / plan.durationMs)
          const idx = Math.max(1, Math.ceil(progress * (totalPoints - 1)))
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
          frameId = progress < 1 ? window.requestAnimationFrame(step) : null
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
      const colour = last.reveal.correct ? '#22c55e' : '#f59e0b'
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
    const colour = d < 50 ? '#22c55e' : d < 500 ? '#f59e0b' : '#ef4444'
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
        map.setPaintProperty(REVEAL_MARKER_LAYER, 'circle-color', '#f59e0b')
      } catch { /* no-op */ }
    }, holdMs)
    return () => {
      window.clearTimeout(t)
      try {
        clearRevealSources(map)
        map.setPaintProperty(REVEAL_MARKER_LAYER, 'circle-color', '#f59e0b')
      } catch { /* no-op */ }
    }
  }, [session.status, session.attemptsPerRound, session.attemptsRemaining, session.currentAttempts])

  // Camera reset on round start when mode requests it.
  useEffect(() => {
    if (session.status !== 'playing' || !mode) return
    if (mode.initialCameraView !== 'world') return
    const map = mapRef.current
    if (!map) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: reduced ? 0 : 700 })
  }, [session.status, session.roundIndex, mode])

  // City-mode any-click handler.
  useEffect(() => {
    if (session.status !== 'playing') return
    if (session.modeId !== 'city-guessing') return
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

  // Expose submitGuess + setRound on window for tests.
  useEffect(() => {
    if (!import.meta.env.VITE_TEST_HOOKS) return
    const w = window as unknown as { __funworldmap_game?: Record<string, unknown> }
    if (!w.__funworldmap_game) w.__funworldmap_game = {}
    w.__funworldmap_game.submitGuess = (input: GuessInput) => submitGuessInput(input)
    // Test shorthand: takes cca3 alone and looks up name + centroid.
    w.__funworldmap_game.submitCountryGuess = (cca3: string): boolean => {
      if (session.modeId !== 'country-pinning') return false
      const country = byCca3.get(cca3.toUpperCase())
      if (!country) return false
      submitGuessInput({
        kind: 'country',
        cca3: cca3.toUpperCase(),
        name: country.name.common,
        centroid: centroidFromLatLng(country.latlng),
      })
      return true
    }
    w.__funworldmap_game.setRound = (id: string): boolean => {
      if (!mode) return false
      let round: RoundSpec | null = null
      if (session.modeId === 'country-pinning') {
        const country = byCca3.get(id.toUpperCase())
        if (!country) return false
        round = {
          kind: 'country-pinning',
          targetCca3: country.cca3,
          targetName: country.name.common,
          targetFlag: country.flag,
          targetCentroid: centroidFromLatLng(country.latlng),
        }
      } else {
        const city = cities.find((c) => c.id === id)
        if (!city) return false
        round = {
          kind: 'city-guessing',
          targetId: city.id,
          targetName: city.name,
          targetCountryName: city.countryName,
          targetCountryFlag: city.countryFlag,
          targetCentroid: centroidFromLatLng(city.latlng),
        }
      }
      if (statusRef.current === 'idle') {
        start(session.modeId, round, mode.maxRounds)
      } else {
        overrideRound(round)
      }
      return true
    }
    return () => {
      if (w.__funworldmap_game) {
        delete w.__funworldmap_game.submitGuess
        delete w.__funworldmap_game.submitCountryGuess
        delete w.__funworldmap_game.setRound
      }
    }
  }, [mode, session.modeId, byCca3, cities, start, overrideRound, submitGuessInput])

  // Escape exits.
  // Country-pinning round-ended: Escape is owned by the round-end effect above (advance, not exit).
  useEffect(() => {
    if (session.status === 'idle') return
    if (session.status === 'round-ended' && session.modeId === 'country-pinning') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const tgt = e.target as HTMLElement | null
      if (tgt && tgt.matches('input, textarea, [contenteditable]')) return
      e.preventDefault()
      clearResume()
      endGame()
      writeIdleHash()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session.status, session.modeId, endGame])

  const onEndGame = () => { clearResume(); endGame(); writeIdleHash() }
  const onPlayAgain = () => {
    if (!mode) return
    const firstRound = mode.nextRound(new Set())
    start(session.modeId, firstRound, mode.maxRounds)
  }
  const onBackToMap = onEndGame
  const onSkip = () => submitGuessInput({ kind: 'skip' })

  if (session.status === 'idle' || !mode) return null

  const Hud = mode.HudComponent
  const beatPB = session.score > best.bestScore || session.bestStreak > best.bestStreak

  return (
    <CityGuessingHudActionsContext.Provider value={{ onSkip }}>
      {(session.status === 'playing' || session.status === 'round-ended') && (
        <FirstSessionTutorial
          modeId={session.modeId}
          attemptsPerRound={session.attemptsPerRound}
          firstAttemptMade={session.currentAttempts.length > 0 || session.lastOutcome !== null}
        />
      )}
      <HudShell session={session} onEndGame={onEndGame} onDone={completeNow}>
        <Hud session={session} />
      </HudShell>
      {session.status === 'game-over' && (
        <GameOverOverlay
          session={session}
          personalBest={best}
          beatPersonalBest={beatPB}
          onPlayAgain={onPlayAgain}
          onBackToMap={onBackToMap}
        />
      )}
    </CityGuessingHudActionsContext.Provider>
  )
}
