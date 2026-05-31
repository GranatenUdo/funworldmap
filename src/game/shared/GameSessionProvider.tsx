import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useGameSession } from './useGameSession'
import type {
  CityLike,
  CountryLike,
  GameMode,
  GameSession,
  GuessInput,
  ModeId,
  RoundSpec,
} from './types'
import { getMode } from '../modes'
import { isCountryPinning, isCityGuessing } from './modePredicates'

export type GameSessionApi = {
  session: GameSession
  mode: GameMode | null
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null) => void
  submitGuessInput: (input: GuessInput) => void
  advance: (nextRound: RoundSpec) => void
  overrideRound: (round: RoundSpec) => void
  endGame: () => void
  finishFree: () => void
  finalize: () => void
  restart: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null) => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const GameSessionContext = createContext<GameSessionApi | null>(null)

interface Props {
  pools: { countries: CountryLike[]; cities: CityLike[] }
  children: ReactNode
}

export function GameSessionProvider({ pools, children }: Props) {
  const {
    session,
    start,
    attempt,
    advance,
    overrideRound,
    endGame,
    finishFree,
    finalize,
    restart,
  } = useGameSession()

  const mode = useMemo<GameMode | null>(() => {
    if (isCountryPinning(session.modeId) && pools.countries.length === 0) return null
    if (isCityGuessing(session.modeId) && pools.cities.length === 0) return null
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
      attempt(input, result)
    },
    [mode, session.status, session.currentRound, attempt],
  )

  const api = useMemo<GameSessionApi>(
    () => ({
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
    }),
    [
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
    ],
  )

  const apiRef = useRef(api)
  apiRef.current = api

  useEffect(() => {
    if (!import.meta.env.VITE_TEST_HOOKS) return
    if (!window.__funworldmap_game) window.__funworldmap_game = {}
    window.__funworldmap_game.getSession = () => apiRef.current.session
    window.__funworldmap_game.endGame = () => apiRef.current.endGame()
    window.__funworldmap_game.finalize = () => apiRef.current.finalize()
    window.__funworldmap_game.restart = (
      modeId: ModeId,
      firstRound: RoundSpec,
      maxRounds: number | null,
    ) => apiRef.current.restart(modeId, firstRound, maxRounds)
    return () => {
      if (window.__funworldmap_game) {
        delete window.__funworldmap_game.getSession
        delete window.__funworldmap_game.endGame
        delete window.__funworldmap_game.finalize
        delete window.__funworldmap_game.restart
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
