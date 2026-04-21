import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useGameSession } from './useGameSession'
import type { AttemptRecord, CityLike, CountryLike, GameMode, GameSession, GuessInput, GuessOutcome, ModeId, RoundSpec } from './types'
import { getMode } from '../modes'

export type GameSessionApi = {
  session: GameSession
  mode: GameMode | null
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound?: number) => void
  submitGuess: (input: GuessInput, outcome: GuessOutcome) => void
  submitGuessInput: (input: GuessInput) => void
  recordAttempt: (attempt: AttemptRecord) => void
  revealEarly: () => void
  advance: (nextRound: RoundSpec) => void
  overrideRound: (round: RoundSpec) => void
  endGame: () => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const GameSessionContext = createContext<GameSessionApi | null>(null)

interface Props {
  pools: { countries: CountryLike[]; cities: CityLike[] }
  children: ReactNode
}

export function GameSessionProvider({ pools, children }: Props) {
  const { session, start, submitGuess, recordAttempt, revealEarly, advance, overrideRound, endGame } = useGameSession()

  const mode = useMemo<GameMode | null>(() => {
    if (session.modeId === 'country-pinning' && pools.countries.length === 0) return null
    if (session.modeId === 'city-guessing' && pools.cities.length === 0) return null
    try {
      return getMode(session.modeId, pools)
    } catch {
      return null
    }
  }, [session.modeId, pools])

  const submitGuessInput = useCallback(
    (input: GuessInput) => {
      if (!mode || session.status !== 'playing' || !session.currentRound) return
      const result = mode.onGuess(input, session.currentRound)

      if (session.attemptsPerRound > 1 && session.attemptsRemaining > 1) {
        recordAttempt({ pointsEarned: result.pointsEarned, input, reveal: result.reveal })
        return
      }

      const endsGame =
        session.maxRounds !== null
          ? session.roundIndex + 1 >= session.maxRounds
          : session.lives + result.livesDelta <= 0
      const outcome: GuessOutcome = { ...result, endsGame }
      submitGuess(input, outcome)
    },
    [mode, session.status, session.currentRound, session.maxRounds, session.roundIndex, session.lives, session.attemptsPerRound, session.attemptsRemaining, submitGuess, recordAttempt],
  )

  const api = useMemo<GameSessionApi>(
    () => ({ session, mode, start, submitGuess, submitGuessInput, recordAttempt, revealEarly, advance, overrideRound, endGame }),
    [session, mode, start, submitGuess, submitGuessInput, recordAttempt, revealEarly, advance, overrideRound, endGame],
  )

  const apiRef = useRef(api)
  apiRef.current = api

  useEffect(() => {
    const w = window as unknown as { __funworldmap_game?: Record<string, unknown> }
    if (!w.__funworldmap_game) w.__funworldmap_game = {}
    w.__funworldmap_game.getSession = () => apiRef.current.session
    w.__funworldmap_game.endGame = () => apiRef.current.endGame()
    return () => {
      if (w.__funworldmap_game) {
        delete w.__funworldmap_game.getSession
        delete w.__funworldmap_game.endGame
      }
    }
  }, [])

  return <GameSessionContext.Provider value={api}>{children}</GameSessionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGameSessionContext(): GameSessionApi {
  const ctx = useContext(GameSessionContext)
  if (!ctx) throw new Error('useGameSessionContext must be used within <GameSessionProvider>')
  return ctx
}
