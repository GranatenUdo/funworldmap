import { useCallback, useEffect, useMemo, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CityLike, CountryLike, ModeId, RoundSpec } from './shared/types'
import { useGameSessionContext } from './shared/GameSessionProvider'
import { usePersonalBests } from './shared/usePersonalBests'
import { useGameTestSeams } from './hooks/useGameTestSeams'
import { useDailyResumePersistence } from './hooks/useDailyResumePersistence'
import { useGameAnnouncements } from './hooks/useGameAnnouncements'
import { getMode } from './modes'
import { HudShell } from './shared/hud/HudShell'
import { GameOverOverlay } from './shared/hud/GameOverOverlay'
import { FirstSessionTutorial } from './shared/hud/FirstSessionTutorial'
import { useMap } from '../hooks/useMap'
import { parseHash } from '../lib/hashState'
import { LAYER } from '../lib/mapLayers'
import { tessellateArc } from './shared/distance'
import { computeRevealAnimationPlan } from './shared/revealAnimation'
import { prefersReducedMotion } from '../lib/motion'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../lib/mapStyles'
import { CityGuessingHudActionsContext } from './modes/city-guessing'
import { buildCountryDailyRound, buildCityDailyRound } from './daily/dailyRound'
import { toLocalDateString, classifyDate } from './daily/dates'
import { useDailyPuzzlesContext } from './daily/DailyPuzzlesProvider'
import { useDailyHistory } from './daily/useDailyHistory'
import { readResume, clearResume } from './daily/resume'
import { track } from '../lib/analytics'
import { dispatchToast } from '../lib/toast'

import {
  REVEAL_MARKER_SOURCE,
  REVEAL_LINE_SOURCE,
  REVEAL_MARKER_LAYER,
  REVEAL_LINE_LAYER,
} from './shared/revealLayers'

const DAILY_ATTEMPTS_PER_ROUND = 3

function writeIdleHash(): void {
  const h = window.location.hash
  if (h.startsWith('#game') || h.startsWith('#daily')) {
    history.replaceState(null, '', window.location.pathname)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
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

interface Props {
  countries: CountryLike[]
  cities: CityLike[]
  byCca3: Map<string, CountryLike>
}

export function GameController({ countries, cities, byCca3 }: Props) {
  const { mapRef } = useMap()
  const { session, mode, start, submitGuessInput, completeNow, resume, advance, overrideRound, endGame, finishFree, finalize, restart } = useGameSessionContext()
  const { best, record } = usePersonalBests(session.modeId || 'country-pinning')
  const dailyPuzzles = useDailyPuzzlesContext()
  const { record: recordDailyResult, get: dailyHistoryGet } = useDailyHistory()
  const pendingStartRef = useRef<ModeId | null>(null)
  // Guard the reveal-route deep_link_opened emit against re-fires when deps
  // change (e.g. byDate reference update after index load). Set once per unique
  // hash for the lifetime of this GameController mount. Re-visiting the same
  // /reveal hash within one mount won't re-emit; this matches funnel-counting
  // semantics (deep-link arrival, not view-count).
  const lastRevealEmitHashRef = useRef<string | null>(null)

  // Pool derivation for the hash-bootstrap path (which needs `getMode` for
  // the first round ahead of the reducer running).
  const pools = useMemo(() => ({ countries, cities }), [countries, cities])

  // Start a daily round, resuming from a saved blob if the date+mode match.
  // Used by both the immediate hash-bootstrap and the deferred-pool drain path.
  // When `atomicRestart` is true, the fresh-start branch dispatches the atomic
  // `restart` reducer action instead of `start`, collapsing what would
  // otherwise be a two-render endGame+start sequence into a single render.
  // (See bug #32: the intermediate `status='idle'` render between dispatches
  // unmounts the HUD and triggers a remount race on slow CI.)
  const startOrResumeDaily = useCallback(
    (id: ModeId, date: string, firstRound: RoundSpec, atomicRestart = false): void => {
      const resumed = readResume()
      if (resumed && resumed.date === date && resumed.modeId === id && resumed.attempts.length > 0) {
        // `resume` already replaces state atomically regardless of prior status,
        // so it is safe from any state including game-over.
        resume({
          modeId: id,
          round: firstRound,
          attemptsPerRound: DAILY_ATTEMPTS_PER_ROUND,
          attempts: resumed.attempts,
          dailyDate: date,
        })
        track('deep_link_opened', { dateKind: 'today', outcome: 'resume' })
        return
      }
      if (atomicRestart) {
        restart(id, firstRound, 1, DAILY_ATTEMPTS_PER_ROUND, date)
      } else {
        start(id, firstRound, 1, DAILY_ATTEMPTS_PER_ROUND, date)
      }
      track('deep_link_opened', { dateKind: 'today', outcome: 'start' })
      track('daily_started', { mode: id })
    },
    [start, resume, restart],
  )

  // Hash → session bootstrap. Read status via ref (hashchange closure-staleness fix).
  const statusRef = useRef(session.status)
  statusRef.current = session.status

  useGameTestSeams({ session, mode, byCca3, cities, start, overrideRound, submitGuessInput, statusRef })
  useDailyResumePersistence(session)
  useGameAnnouncements({
    session, mode, byCca3,
    advance, finalize, record, recordDailyResult,
  })

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
          track('deep_link_opened', {
            dateKind: classifyDate(state.date, toLocalDateString(new Date())),
            outcome: 'reveal',
          })
        }
        return
      }
      // If a game/daily route arrives while the previous session is still in
      // game-over (e.g. user pasted a different mode URL or used browser
      // back/forward), capture that as a one-shot flag so the start branches
      // below dispatch the atomic `restart` action instead of the two-step
      // `endGame + start` sequence. Bug #32: the intermediate `status='idle'`
      // commit between the two dispatches unmounts the HUD and races on slow
      // CI; `restart` collapses both into a single reducer transition.
      const isPlayableRoute =
        (state.kind === 'game' && state.modeId) ||
        (state.kind === 'daily' && state.modeId && !state.reveal)
      const wasGameOver = statusRef.current === 'game-over' && !!isPlayableRoute
      if (wasGameOver) {
        clearResume()
        // Mirror the upcoming reducer transition into the local statusRef so
        // the `=== 'idle'` guards below pass on this same check() invocation.
        // The actual dispatch happens via `restart` in the start branches.
        statusRef.current = 'idle'
      }

      // Today-only playable routes: past/future redirect to /reveal or root.
      if (state.kind === 'daily' && state.modeId && !state.reveal && statusRef.current === 'idle') {
        const id = state.modeId as ModeId
        if (id !== 'country-pinning' && id !== 'city-guessing') {
          if (wasGameOver) endGame()
          return
        }

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
          // alreadyPlayed implies state.date <= todayStr; classifyDate yields today or past, never future.
          track('deep_link_opened', {
            dateKind: classifyDate(state.date, todayStr) as 'today' | 'past',
            outcome: 'redirect',
          })
          window.location.hash = `daily/${state.date}/${id}/reveal`
          return
        }

        const hasPool = id === 'country-pinning' ? countries.length > 0 : cities.length > 0
        if (!hasPool) {
          // Pool not yet loaded; defer and let the drain effect pick up once
          // it arrives. If we were transitioning out of game-over, fall back
          // to the legacy two-step path here (endGame so the drain effect's
          // `status==='idle'` guard passes). The atomic restart only matters
          // when the start dispatches synchronously; the deferred path always
          // runs in a separate render tick anyway.
          if (wasGameOver) endGame()
          pendingStartRef.current = id
          return
        }
        const puzzle = dailyPuzzles.byDate(state.date)
        if (!puzzle) {
          if (wasGameOver) endGame()
          return
        }
        const firstRound =
          id === 'country-pinning'
            ? buildCountryDailyRound(puzzle.country.cca3, countries)
            : buildCityDailyRound(puzzle.city.id, cities)
        if (!firstRound) {
          if (wasGameOver) endGame()
          dispatchToast('Daily content unavailable — try again shortly.')
          return
        }
        startOrResumeDaily(id, state.date, firstRound, wasGameOver)
        return
      }
      if (state.kind === 'game' && statusRef.current === 'idle') {
        const id = state.modeId as ModeId
        if (id !== 'country-pinning' && id !== 'city-guessing') {
          if (wasGameOver) endGame()
          return
        }
        const hasPool = id === 'country-pinning' ? countries.length > 0 : cities.length > 0
        if (!hasPool) {
          // See daily-branch comment above: defer + endGame fallback.
          if (wasGameOver) endGame()
          pendingStartRef.current = id
          return
        }
        const m = getMode(id, pools)
        const firstRound = m.nextRound(new Set())
        if (wasGameOver) {
          restart(id, firstRound, m.maxRounds)
        } else {
          start(id, firstRound, m.maxRounds)
        }
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
        dispatchToast('Daily content unavailable — try again shortly.')
        return
      }
      startOrResumeDaily(pending, state.date, firstRound)
      return
    }
    pendingStartRef.current = null
    const m = getMode(pending, pools)
    const firstRound = m.nextRound(new Set())
    start(pending, firstRound, m.maxRounds)
    track('free_started', { mode: pending })
  }, [countries, cities, session.status, pools, start, startOrResumeDaily, dailyPuzzles])

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
          attemptIndex: prev + 1,
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
    const reduced = prefersReducedMotion()
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

  const onEndGame = () => {
    // Free games: route through game-over so the user sees their score and
    // PB is recorded. Daily plays keep abandon-semantic (Done is the
    // explicit save action there); idle / already game-over no-ops.
    if (session.dailyDate === null && session.status !== 'idle' && session.status !== 'game-over') {
      finishFree()
      return
    }
    clearResume()
    endGame()
    writeIdleHash()
  }
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
