import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CityLike, CountryLike } from './shared/types'
import type { CountryData, CountriesFile } from '../lib/types'
import { useGameSessionContext } from './shared/GameSessionProvider'
import { usePersonalBests } from './shared/usePersonalBests'
import { recordResult, type ResultReceipt } from './shared/personalBestsStore'
import { useGameTestSeams } from './hooks/useGameTestSeams'
import { useGameAnnouncements } from './hooks/useGameAnnouncements'
import { useRevealMapEffects } from './hooks/useRevealMapEffects'
import { useHashGameRouter } from './hooks/useHashGameRouter'
import { HudShell } from './shared/hud/HudShell'
import { GameOverOverlay } from './shared/hud/GameOverOverlay'
import { RoundResult } from './shared/hud/RoundResult'
import { FirstSessionTutorial } from './shared/hud/FirstSessionTutorial'
import { EndGameConfirm, isTrivialRun } from './shared/hud/EndGameConfirm'
import { useMap } from '../hooks/useMap'
import { DEFAULT_CENTER, DEFAULT_ZOOM, DEFAULT_PITCH } from '../lib/mapStyles'
import { prefersReducedMotion } from '../lib/motion'
import { CityGuessingHudActionsContext } from './modes/city-guessing'

interface Props {
  countries: CountryLike[]
  cities: CityLike[]
  byCca3: Map<string, CountryLike>
  ready: boolean
  referenceCountries: Map<string, CountryData>
  sources: CountriesFile['_sources']
  onChooseGame: () => void
  onExplore: () => void
}

export function GameController({
  countries,
  cities,
  byCca3,
  ready,
  referenceCountries,
  sources,
  onChooseGame,
  onExplore,
}: Props) {
  const { mapRef, retryRef } = useMap()
  const {
    session,
    mode,
    submitGuessInput,
    advance,
    overrideRound,
    endGame,
    finishFree,
    finalize,
    restart,
  } = useGameSessionContext()
  const { best } = usePersonalBests(session.modeId)
  const [receipt, setReceipt] = useState<ResultReceipt | null>(null)
  const [reviewIndex, setReviewIndex] = useState<number | null>(null)
  const [endConfirmOpen, setEndConfirmOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const pools = useMemo(() => ({ countries, cities }), [countries, cities])
  const begin: typeof restart = useCallback(
    (id, first, max) => {
      setReceipt(null)
      setReviewIndex(null)
      setHelpOpen(false)
      setEndConfirmOpen(false)
      if (mapRef.current) {
        mapRef.current.stop()
        mapRef.current.jumpTo({
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          pitch: prefersReducedMotion() ? 0 : DEFAULT_PITCH,
          bearing: 0,
        })
      }
      restart(id, first, max)
    },
    [restart, mapRef],
  )
  const { statusRef } = useHashGameRouter({
    session,
    pools,
    ready,
    start: begin,
    restart: begin,
    endGame,
  })
  useGameTestSeams({
    session,
    mode,
    byCca3,
    cities,
    start: begin,
    overrideRound,
    submitGuessInput,
    statusRef,
  })
  const record = useCallback(
    (score: number, streak: number) => {
      setReceipt(recordResult(session.modeId, score, streak))
    },
    [session.modeId],
  )
  useGameAnnouncements({ session, mode, byCca3, advance, finalize, record })
  const reviewEntry =
    session.status === 'game-over' && reviewIndex !== null
      ? (session.completedRounds[reviewIndex] ?? null)
      : null
  useRevealMapEffects({ session, mapRef, byCca3, submitGuessInput, review: reviewEntry, ready })

  const leave = useCallback(
    (choose: boolean) => {
      setReviewIndex(null)
      endGame()
      // Clear even unchanged game hashes before a same-mode choice.
      history.pushState(null, '', window.location.pathname + window.location.search)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      if (choose) onChooseGame()
      else onExplore()
    },
    [endGame, onChooseGame, onExplore],
  )
  const requestEnd = useCallback(() => {
    if (isTrivialRun(session)) finishFree()
    else setEndConfirmOpen(true)
  }, [session, finishFree])
  const keyActions = useRef({ session, endConfirmOpen, helpOpen, reviewIndex, requestEnd, leave })
  keyActions.current = { session, endConfirmOpen, helpOpen, reviewIndex, requestEnd, leave }
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const a = keyActions.current
      if (a.session.status === 'idle') return
      if (a.endConfirmOpen) return // confirmation owns dismissal
      const openFacts = document.querySelector<HTMLDetailsElement>('.learn-details[open]')
      if (openFacts) {
        openFacts.open = false
        openFacts.querySelector('summary')?.focus()
        e.preventDefault()
        return
      }
      const tutorial = document.querySelector<HTMLButtonElement>(
        '[data-testid="game-tutorial"] button',
      )
      if (tutorial) {
        tutorial.click()
        e.preventDefault()
        return
      }
      if (a.helpOpen) {
        setHelpOpen(false)
        e.preventDefault()
        return
      }
      if (a.reviewIndex !== null) {
        setReviewIndex(null)
        e.preventDefault()
        return
      }
      e.preventDefault()
      if (a.session.status === 'game-over') a.leave(false)
      else a.requestEnd()
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [])
  const continueRound = () => {
    if (session.status !== 'round-ended' || !mode) return
    if (session.lastOutcome?.endsGame) finalize()
    else advance(mode.nextRound(session.used))
  }
  const countryFor = (record: NonNullable<typeof reviewEntry>) =>
    referenceCountries.get(
      record.round.kind === 'country-pinning'
        ? record.round.targetCca3
        : record.round.targetCountryCca3,
    )
  if (session.status === 'idle' || !mode) return null
  const Hud = mode.HudComponent
  const liveEntry = session.completedRounds[session.completedRounds.length - 1]
  return (
    <CityGuessingHudActionsContext.Provider
      value={{ onSkip: () => submitGuessInput({ kind: 'skip' }) }}
    >
      {session.status !== 'game-over' && (
        <>
          <FirstSessionTutorial
            modeId={session.modeId}
            firstAttemptMade={session.lastOutcome !== null}
            open={helpOpen}
            onRequestClose={() => setHelpOpen(false)}
          />
          <HudShell session={session} onEndGame={requestEnd} onOpenHelp={() => setHelpOpen(true)}>
            {session.status === 'playing' ? (
              <Hud session={session} />
            ) : (
              liveEntry && (
                <RoundResult
                  entry={liveEntry}
                  country={countryFor(liveEntry)}
                  sources={sources}
                  onContinue={continueRound}
                />
              )
            )}
          </HudShell>
        </>
      )}
      {endConfirmOpen && session.status !== 'game-over' && (
        <EndGameConfirm
          onConfirm={() => {
            setEndConfirmOpen(false)
            finishFree()
          }}
          onKeepPlaying={() => setEndConfirmOpen(false)}
        />
      )}
      {session.status === 'game-over' && (
        <GameOverOverlay
          session={session}
          personalBest={best}
          beatPersonalBest={false}
          receipt={receipt}
          mapReady={ready}
          onRetryMap={() => retryRef.current?.()}
          onPlayAgain={() => {
            if (ready) begin(session.modeId, mode.nextRound(new Set()), mode.maxRounds)
          }}
          onBackToMap={() => leave(false)}
          onChooseGame={() => leave(true)}
          reviewIndex={reviewIndex}
          onReview={setReviewIndex}
        >
          {reviewEntry && (
            <RoundResult
              entry={reviewEntry}
              country={countryFor(reviewEntry)}
              sources={sources}
              historical
            />
          )}
        </GameOverOverlay>
      )}
    </CityGuessingHudActionsContext.Provider>
  )
}
