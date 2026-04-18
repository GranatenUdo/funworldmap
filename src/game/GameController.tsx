import { useCallback, useEffect, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import type { CountryLike } from './shared/types'
import { useGameSessionContext } from './shared/GameSessionProvider'
import { usePersonalBests } from './shared/usePersonalBests'
import { getMode } from './modes'
import { HudShell } from './shared/hud/HudShell'
import { GameOverOverlay } from './shared/hud/GameOverOverlay'
import { GuessByNameButton } from './shared/hud/GuessByNameButton'
import { FirstSessionTutorial } from './shared/hud/FirstSessionTutorial'
import { parseHash } from '../lib/hashState'

const REVEAL_MS = 1200

function dispatchAnnouncement(text: string): void {
  window.dispatchEvent(new CustomEvent('funworldmap:announce', { detail: text }))
}

interface Props {
  pool: CountryLike[]
  byCca3: Map<string, CountryLike>
  onGameStart: () => void
  onGameEnd: () => void
}

export function GameController({ pool, byCca3, onGameStart, onGameEnd }: Props) {
  const { session, start, submitGuess, advance, endGame } = useGameSessionContext()
  const { best, record } = usePersonalBests('country-pinning')
  const recordedRef = useRef(false)
  const onGameStartRef = useRef(onGameStart)
  onGameStartRef.current = onGameStart
  const onGameEndRef = useRef(onGameEnd)
  onGameEndRef.current = onGameEnd

  const mode = getMode('country-pinning', pool)

  // Hash → session bootstrap.
  useEffect(() => {
    const check = () => {
      const state = parseHash(window.location.hash)
      if (state.kind === 'game' && session.status === 'idle') {
        const firstRound = mode.nextRound(new Set(), pool)
        start('country-pinning', firstRound)
      }
      if (state.kind !== 'game' && session.status !== 'idle') {
        endGame()
      }
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Side effects on status change.
  useEffect(() => {
    if (session.status === 'playing' && session.roundIndex === 0 && session.currentRound) {
      recordedRef.current = false
      onGameStartRef.current()
      dispatchAnnouncement(`Pin: ${session.currentRound.targetName}`)
    }
    if (session.status === 'playing' && session.roundIndex > 0 && session.currentRound) {
      dispatchAnnouncement(`Pin: ${session.currentRound.targetName}`)
    }
    if (session.status === 'round-ended' && session.lastOutcome) {
      const o = session.lastOutcome
      const remain = session.lives
      dispatchAnnouncement(
        o.correct
          ? `Correct. Plus ${o.pointsEarned} points.`
          : `Wrong. Plus ${o.pointsEarned} points. ${remain === 1 ? 'One life remaining.' : `${remain} lives remaining.`}`,
      )
      const t = window.setTimeout(() => {
        const next = mode.nextRound(session.used, pool)
        advance(next)
      }, REVEAL_MS)
      return () => window.clearTimeout(t)
    }
    if (session.status === 'game-over' && !recordedRef.current) {
      recordedRef.current = true
      record(session.score, session.bestStreak)
      dispatchAnnouncement(`Game over. Final score ${session.score}.`)
    }
    if (session.status === 'idle') {
      onGameEndRef.current()
    }
  }, [session.status, session.roundIndex, session.lastOutcome, session.score, session.bestStreak, session.lives, session.used, session.currentRound, advance, mode, pool, record])

  // Expose setRound for e2e determinism (attached alongside the provider's hook).
  useEffect(() => {
    const existing = (window as unknown as { __funworldmap_game?: Record<string, unknown> }).__funworldmap_game
    if (!existing) return
    existing.setRound = (cca3: string) => {
      const country = byCca3.get(cca3.toUpperCase())
      if (!country) return false
      const round = {
        targetCca3: country.cca3,
        targetName: country.name.common,
        targetFlag: country.flag,
        targetCentroid: [country.latlng[1], country.latlng[0]] as [number, number],
      }
      if (session.status === 'idle') {
        start('country-pinning', round)
      } else if (session.status === 'playing' || session.status === 'round-ended') {
        advance(round)
      }
      return true
    }
  }, [byCca3, start, advance, session.status])

  const handleGuessByCca3 = useCallback((clickedCca3: string) => {
    if (session.status !== 'playing' || !session.currentRound) return
    const clickedCountry = byCca3.get(clickedCca3.toUpperCase())
    const clickedCentroid = clickedCountry
      ? ([clickedCountry.latlng[1], clickedCountry.latlng[0]] as [number, number])
      : null
    const outcome = mode.onGuess(clickedCca3.toUpperCase(), clickedCentroid, session.currentRound)
    submitGuess(outcome)
  }, [session.status, session.currentRound, byCca3, mode, submitGuess])

  // Expose guess dispatcher on window so App.tsx can call it from onMapSelect.
  useEffect(() => {
    ;(window as unknown as { __funworldmap_guess?: (cca3: string) => void }).__funworldmap_guess = handleGuessByCca3
    return () => {
      delete (window as unknown as { __funworldmap_guess?: (cca3: string) => void }).__funworldmap_guess
    }
  }, [handleGuessByCca3])

  // Escape exits the game.
  useEffect(() => {
    if (session.status === 'idle') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const tgt = e.target as HTMLElement | null
      if (tgt && tgt.matches('input, textarea, [contenteditable]')) return
      e.preventDefault()
      endGame()
      if (window.location.hash.startsWith('#game')) {
        history.replaceState(null, '', window.location.pathname)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session.status, endGame])

  // Target-polygon reveal pulse on round-ended.
  useEffect(() => {
    if (session.status !== 'round-ended' || !session.lastOutcome) return
    const map = (window as unknown as { __funworldmap_map?: maplibregl.Map }).__funworldmap_map
    if (!map) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const layer = 'country-hover-border'  // LAYER.hoverBorder
    try {
      map.setFilter(layer, ['==', ['get', 'id'], session.lastOutcome.reveal.targetCca3])
      const colour = session.lastOutcome.correct ? '#22c55e' : '#f59e0b'
      map.setPaintProperty(layer, 'line-color', colour)
      map.setPaintProperty(layer, 'line-width', reduced ? 3 : 4)
    } catch {
      /* layer may be named differently on older builds */
    }
    return () => {
      try {
        map.setFilter(layer, ['==', ['get', 'id'], ''])
      } catch { /* no-op */ }
    }
  }, [session.status, session.lastOutcome])

  const writeIdleHash = () => {
    if (window.location.hash.startsWith('#game')) {
      history.replaceState(null, '', window.location.pathname)
    }
  }

  const onEndGame = () => {
    endGame()
    writeIdleHash()
  }
  const onPlayAgain = () => {
    const firstRound = mode.nextRound(new Set(), pool)
    start('country-pinning', firstRound)
  }
  const onBackToMap = () => {
    endGame()
    writeIdleHash()
  }

  if (session.status === 'idle') return null

  const Hud = mode.HudComponent

  const beatPB =
    session.score > best.bestScore || session.bestStreak > best.bestStreak

  return (
    <>
      {(session.status === 'playing' || session.status === 'round-ended') && (
        <FirstSessionTutorial />
      )}
      <HudShell session={session} onEndGame={onEndGame}>
        <Hud session={session} />
        {session.status === 'playing' && (
          <GuessByNameButton
            pool={pool}
            used={session.used}
            onGuess={handleGuessByCca3}
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
    </>
  )
}
