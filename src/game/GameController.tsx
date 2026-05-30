import { useEffect, useMemo } from 'react'
import type { CityLike, CountryLike } from './shared/types'
import { useGameSessionContext } from './shared/GameSessionProvider'
import { isCountryPinning } from './shared/modePredicates'
import { usePersonalBests } from './shared/usePersonalBests'
import { useGameTestSeams } from './hooks/useGameTestSeams'
import { useGameAnnouncements } from './hooks/useGameAnnouncements'
import { useRevealMapEffects } from './hooks/useRevealMapEffects'
import { useHashGameRouter } from './hooks/useHashGameRouter'
import { HudShell } from './shared/hud/HudShell'
import { GameOverOverlay } from './shared/hud/GameOverOverlay'
import { FirstSessionTutorial } from './shared/hud/FirstSessionTutorial'
import { useMap } from '../hooks/useMap'
import { CityGuessingHudActionsContext } from './modes/city-guessing'

function writeIdleHash(): void {
  const h = window.location.hash
  if (h.startsWith('#game')) {
    history.replaceState(null, '', window.location.pathname)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }
}

interface Props {
  countries: CountryLike[]
  cities: CityLike[]
  byCca3: Map<string, CountryLike>
}

export function GameController({ countries, cities, byCca3 }: Props) {
  const { mapRef } = useMap()
  const {
    session,
    mode,
    start,
    submitGuessInput,
    advance,
    overrideRound,
    endGame,
    finishFree,
    finalize,
    restart,
  } = useGameSessionContext()
  const { best, record } = usePersonalBests(session.modeId || 'country-pinning')

  // Pool derivation shared with the hash-router hook (which needs `getMode` for
  // the first round ahead of the reducer running).
  const pools = useMemo(() => ({ countries, cities }), [countries, cities])

  const { statusRef } = useHashGameRouter({
    session,
    pools,
    start,
    restart,
    endGame,
  })

  useGameTestSeams({
    session,
    mode,
    byCca3,
    cities,
    start,
    overrideRound,
    submitGuessInput,
    statusRef,
  })
  useGameAnnouncements({
    session,
    mode,
    byCca3,
    advance,
    finalize,
    record,
  })
  useRevealMapEffects({ session, mapRef, byCca3, submitGuessInput })

  // Escape exits.
  // Country-pinning round-ended: Escape is owned by the round-end effect above (advance, not exit).
  useEffect(() => {
    if (session.status === 'idle') return
    if (session.status === 'round-ended' && isCountryPinning(session.modeId)) return
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
  }, [session.status, session.modeId, endGame])

  const onEndGame = () => {
    if (session.status !== 'idle' && session.status !== 'game-over') {
      finishFree()
      return
    }
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
          firstAttemptMade={session.lastOutcome !== null}
        />
      )}
      <HudShell session={session} onEndGame={onEndGame}>
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
