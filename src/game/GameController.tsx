import { useCallback, useEffect, useMemo, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CityLike, CountryLike, GameMode, GuessInput, GuessOutcome, ModeId, RoundSpec } from './shared/types'
import { useGameSessionContext } from './shared/GameSessionProvider'
import { usePersonalBests } from './shared/usePersonalBests'
import { getMode } from './modes'
import { HudShell } from './shared/hud/HudShell'
import { GameOverOverlay } from './shared/hud/GameOverOverlay'
import { GuessByNameButton } from './shared/hud/GuessByNameButton'
import { FirstSessionTutorial } from './shared/hud/FirstSessionTutorial'
import { parseHash } from '../lib/hashState'
import { LAYER } from '../lib/mapLayers'
import { centroidFromLatLng } from './shared/distance'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../lib/mapStyles'
import { CityGuessingHudActionsContext } from './modes/city-guessing'

const REVEAL_MS_COUNTRY = 1200
const REVEAL_MS_CITY = 2000
const REVEAL_MARKER_SOURCE = 'game-reveal-marker'
const REVEAL_LINE_SOURCE = 'game-reveal-line'
const REVEAL_MARKER_LAYER = 'game-reveal-marker-layer'
const REVEAL_LINE_LAYER = 'game-reveal-line-layer'

function dispatchAnnouncement(text: string): void {
  window.dispatchEvent(new CustomEvent('funworldmap:announce', { detail: text }))
}

function writeIdleHash(): void {
  if (window.location.hash.startsWith('#game')) {
    history.replaceState(null, '', window.location.pathname)
  }
}

function fitPadding(): number {
  const vw = window.innerWidth
  const vh = window.innerHeight
  return Math.max(40, Math.min(120, Math.min(vw, vh) * 0.1))
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
  const { session, start, submitGuess, advance, overrideRound, endGame } = useGameSessionContext()
  const { best, record } = usePersonalBests(session.modeId || 'country-pinning')
  const recordedRef = useRef(false)
  const pendingStartRef = useRef<ModeId | null>(null)

  const pools = useMemo(() => ({ countries, cities }), [countries, cities])
  const mode = useMemo<GameMode | null>(() => {
    if (session.modeId === 'country-pinning' && countries.length === 0) return null
    if (session.modeId === 'city-guessing' && cities.length === 0) return null
    try {
      return getMode(session.modeId, pools)
    } catch {
      return null
    }
  }, [session.modeId, countries.length, cities.length, pools])

  // Hash → session bootstrap. Read status via ref (hashchange closure-staleness fix).
  const statusRef = useRef(session.status)
  statusRef.current = session.status
  useEffect(() => {
    const check = () => {
      const state = parseHash(window.location.hash)
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
      }
      if (state.kind !== 'game' && statusRef.current !== 'idle') {
        endGame()
      }
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries.length, cities.length])

  // Drain deferred start once the relevant pool arrives.
  useEffect(() => {
    const pending = pendingStartRef.current
    if (!pending || session.status !== 'idle') return
    const hasPool = pending === 'country-pinning' ? countries.length > 0 : cities.length > 0
    if (!hasPool) return
    pendingStartRef.current = null
    const m = getMode(pending, pools)
    const firstRound = m.nextRound(new Set())
    start(pending, firstRound, m.maxRounds)
  }, [countries.length, cities.length, session.status, pools, start])

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
      const revealMs = session.modeId === 'city-guessing' ? REVEAL_MS_CITY : REVEAL_MS_COUNTRY
      const t = window.setTimeout(() => {
        const next = mode.nextRound(session.used)
        advance(next)
      }, revealMs)
      return () => window.clearTimeout(t)
    }
    if (session.status === 'game-over' && !recordedRef.current) {
      recordedRef.current = true
      record(session.score, session.bestStreak)
      dispatchAnnouncement(`Game over. Final score ${session.score}.`)
    }
  }, [
    session.status, session.roundIndex, session.lastOutcome, session.score,
    session.bestStreak, session.lives, session.used, session.currentRound, session.modeId,
    advance, mode, record,
  ])

  // Reveal geometry: when round-ended, update marker + line sources and fitBounds.
  useEffect(() => {
    if (session.status !== 'round-ended' || !session.lastOutcome) return
    const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
    if (!map) return

    const reveal = session.lastOutcome.reveal

    if (reveal.kind === 'country') {
      // Country Pinning: pulse target border as before.
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      try {
        map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], reveal.targetCca3])
        const colour = reveal.correct ? '#22c55e' : '#f59e0b'
        map.setPaintProperty(LAYER.hoverBorder, 'line-color', colour)
        map.setPaintProperty(LAYER.hoverBorder, 'line-width', reduced ? 3 : 4)
      } catch { /* layer may not exist */ }
      return () => {
        try { map.setFilter(LAYER.hoverBorder, ['==', ['get', 'id'], '']) } catch { /* no-op */ }
      }
    }

    // City Guessing: marker + line + fitBounds. Wrapped in try/catch because
    // map style may still be resolving on slow CI when the first reveal
    // fires — a throw here shouldn't stall the React tree.
    try {
      ensureRevealSources(map)
      const markerSrc = map.getSource(REVEAL_MARKER_SOURCE) as maplibregl.GeoJSONSource
      const lineSrc = map.getSource(REVEAL_LINE_SOURCE) as maplibregl.GeoJSONSource
      const target = reveal.targetCentroid
      markerSrc.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: target }, properties: {} }],
      })
      if (reveal.clickedPoint) {
        lineSrc.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: [reveal.clickedPoint, target] },
              properties: {},
            },
          ],
        })
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const lngs = [reveal.clickedPoint[0], target[0]]
        const lats = [reveal.clickedPoint[1], target[1]]
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { duration: reduced ? 0 : 1000, padding: fitPadding(), maxZoom: 6 },
        )
      } else {
        lineSrc.setData({ type: 'FeatureCollection', features: [] })
      }
    } catch (err) {
      /* Map not fully ready; reveal text in HUD is still the authoritative feedback */
      console.warn('reveal geometry skipped:', err)
    }
  }, [session.status, session.lastOutcome])

  // Camera reset on round start when mode requests it.
  useEffect(() => {
    if (session.status !== 'playing' || !mode) return
    if (mode.initialCameraView !== 'world') return
    const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
    if (!map) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: reduced ? 0 : 700 })
  }, [session.status, session.roundIndex, mode])

  // Submit-guess wrapper that computes endsGame.
  const submitGuessWithInput = useCallback((input: GuessInput) => {
    if (!mode || session.status !== 'playing' || !session.currentRound) return
    const result = mode.onGuess(input, session.currentRound)
    const endsGame = session.maxRounds !== null
      ? session.roundIndex + 1 >= session.maxRounds
      : session.lives + result.livesDelta <= 0
    const outcome: GuessOutcome = { ...result, endsGame }
    submitGuess(outcome)
  }, [mode, session.status, session.currentRound, session.maxRounds, session.roundIndex, session.lives, submitGuess])

  // City-mode any-click handler.
  useEffect(() => {
    if (session.status !== 'playing') return
    if (session.modeId !== 'city-guessing') return
    const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
    if (!map) return
    const onClick = (e: maplibregl.MapMouseEvent) => {
      submitGuessWithInput({ kind: 'point', lngLat: [e.lngLat.lng, e.lngLat.lat] })
    }
    map.on('click', onClick)
    return () => { map.off('click', onClick) }
  }, [session.status, session.modeId, submitGuessWithInput])

  // Clear reveal geometry on every transition into idle.
  useEffect(() => {
    if (session.status !== 'idle') return
    const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
    if (map) clearRevealSources(map)
  }, [session.status])

  // Expose submitGuess + setRound on window for tests.
  useEffect(() => {
    const w = window as unknown as { __funworldmap_game?: Record<string, unknown> }
    if (!w.__funworldmap_game) w.__funworldmap_game = {}
    w.__funworldmap_game.submitGuess = (input: GuessInput) => submitGuessWithInput(input)
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
          targetCentroid: [city.latlng[1], city.latlng[0]],
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
        delete w.__funworldmap_game.setRound
      }
    }
  }, [mode, session.modeId, byCca3, cities, start, overrideRound, submitGuessWithInput])

  // Legacy alias for Country Pinning e2e tests.
  useEffect(() => {
    ;(window as unknown as { __funworldmap_guess?: (cca3: string) => void }).__funworldmap_guess = (cca3) => {
      if (session.modeId !== 'country-pinning') return
      const country = byCca3.get(cca3.toUpperCase())
      if (!country) return
      submitGuessWithInput({
        kind: 'country',
        cca3: cca3.toUpperCase(),
        name: country.name.common,
        centroid: centroidFromLatLng(country.latlng),
      })
    }
    return () => {
      delete (window as unknown as { __funworldmap_guess?: (cca3: string) => void }).__funworldmap_guess
    }
  }, [session.modeId, byCca3, submitGuessWithInput])

  // Escape exits.
  useEffect(() => {
    if (session.status === 'idle') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const tgt = e.target as HTMLElement | null
      if (tgt && tgt.matches('input, textarea, [contenteditable]')) return
      e.preventDefault()
      endGame()
      writeIdleHash()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session.status, endGame])

  const onEndGame = () => { endGame(); writeIdleHash() }
  const onPlayAgain = () => {
    if (!mode) return
    const firstRound = mode.nextRound(new Set())
    start(session.modeId, firstRound, mode.maxRounds)
  }
  const onBackToMap = onEndGame
  const onSkip = () => submitGuessWithInput({ kind: 'skip' })

  if (session.status === 'idle' || !mode) return null

  const Hud = mode.HudComponent
  const beatPB = session.score > best.bestScore || session.bestStreak > best.bestStreak

  return (
    <CityGuessingHudActionsContext.Provider value={{ onSkip }}>
      {(session.status === 'playing' || session.status === 'round-ended') && (
        <FirstSessionTutorial />
      )}
      <HudShell session={session} onEndGame={onEndGame}>
        <Hud session={session} />
        {session.status === 'playing' && session.modeId === 'country-pinning' && (
          <GuessByNameButton
            pool={countries}
            onGuess={(cca3) => {
              const c = byCca3.get(cca3.toUpperCase())
              if (!c) return
              submitGuessWithInput({
                kind: 'country',
                cca3: cca3.toUpperCase(),
                name: c.name.common,
                centroid: centroidFromLatLng(c.latlng),
              })
            }}
          />
        )}
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
