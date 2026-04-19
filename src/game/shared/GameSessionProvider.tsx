import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useGameSession } from './useGameSession'
import type { GameSession, GuessOutcome, ModeId, RoundSpec } from './types'

export type GameSessionApi = {
  session: GameSession
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null) => void
  submitGuess: (outcome: GuessOutcome) => void
  advance: (nextRound: RoundSpec) => void
  overrideRound: (round: RoundSpec) => void
  endGame: () => void
}

const GameSessionContext = createContext<GameSessionApi | null>(null)

export function GameSessionProvider({ children }: { children: ReactNode }) {
  const api = useGameSession()
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

  const value = useMemo(() => api, [api])
  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>
}

export function useGameSessionContext(): GameSessionApi {
  const ctx = useContext(GameSessionContext)
  if (!ctx) throw new Error('useGameSessionContext must be used within <GameSessionProvider>')
  return ctx
}
