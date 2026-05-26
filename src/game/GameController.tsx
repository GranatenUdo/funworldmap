import { useCallback, useEffect, useMemo } from 'react'
import type { CityLike, CountryLike } from './shared/types'
import { useGameSessionContext } from './shared/GameSessionProvider'
import { isCityGuessing, isCountryPinning } from './shared/modePredicates'
import { usePersonalBests } from './shared/usePersonalBests'
import { useGameTestSeams } from './hooks/useGameTestSeams'
import { useDailyResumePersistence } from './hooks/useDailyResumePersistence'
import { useGameAnnouncements } from './hooks/useGameAnnouncements'
import { useRevealMapEffects } from './hooks/useRevealMapEffects'
import { useHashGameRouter } from './hooks/useHashGameRouter'
import { HudShell } from './shared/hud/HudShell'
import { GameOverOverlay } from './shared/hud/GameOverOverlay'
import { FirstSessionTutorial } from './shared/hud/FirstSessionTutorial'
import { useMap } from '../hooks/useMap'
import { CityGuessingHudActionsContext } from './modes/city-guessing'
import { useDailyPuzzlesContext } from './daily/DailyPuzzlesProvider'
import { useDailyHistory } from './daily/useDailyHistory'
import { clearResume } from './daily/resume'
import { writeLastMode } from './shared/lastMode'
import { DailyRevealOverlay } from '../components/DailyRevealOverlay'
import { toLocalDateString } from './daily/dates'
import { writeHash } from '../lib/hashState'

function writeIdleHash(): void {
  const h = window.location.hash
  if (h.startsWith('#game') || h.startsWith('#daily')) {
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
    completeNow,
    resume,
    advance,
    overrideRound,
    endGame,
    finishFree,
    finalize,
    restart,
  } = useGameSessionContext()
  const { best, record } = usePersonalBests(session.modeId || 'country-pinning')
  const dailyPuzzles = useDailyPuzzlesContext()
  const { record: recordDailyResult, get: dailyHistoryGet } = useDailyHistory()

  // Pool derivation shared with the hash-router hook (which needs `getMode` for
  // the first round ahead of the reducer running).
  const pools = useMemo(() => ({ countries, cities }), [countries, cities])

  const { statusRef } = useHashGameRouter({
    session,
    pools,
    dailyPuzzles,
    dailyHistoryGet,
    start,
    resume,
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
  useDailyResumePersistence(session)
  useGameAnnouncements({
    session,
    mode,
    byCca3,
    advance,
    finalize,
    record,
    recordDailyResult,
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
  const onPlayUnlimited = useCallback(() => {
    // Atomic restart via hash-router: avoids the intermediate idle render.
    writeLastMode(session.modeId)
    window.location.hash = writeHash({ kind: 'game', modeId: session.modeId })
  }, [session.modeId])

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
      {session.status === 'game-over' &&
        (session.dailyDate !== null && isCityGuessing(session.modeId) ? (
          <DailyRevealOverlay
            date={session.dailyDate}
            modeId={session.modeId}
            puzzle={dailyPuzzles.byDate(session.dailyDate) ?? null}
            today={toLocalDateString(new Date())}
            countries={countries}
            cities={cities}
            onClose={onBackToMap}
            onPlayUnlimited={onPlayUnlimited}
          />
        ) : (
          <GameOverOverlay
            session={session}
            personalBest={best}
            beatPersonalBest={beatPB}
            onPlayAgain={onPlayAgain}
            onBackToMap={onBackToMap}
          />
        ))}
    </CityGuessingHudActionsContext.Provider>
  )
}
