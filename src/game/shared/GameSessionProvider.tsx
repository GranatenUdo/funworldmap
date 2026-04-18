import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useGameSession } from './useGameSession'
import type { GameSession, GuessOutcome, ModeId, RoundSpec } from './types'

export type GameSessionApi = {
  session: GameSession
  start: (modeId: ModeId, firstRound: RoundSpec) => void
  submitGuess: (outcome: GuessOutcome) => void
  advance: (nextRound: RoundSpec) => void
  endGame: () => void
}

const GameSessionContext = createContext<GameSessionApi | null>(null)

export function GameSessionProvider({ children }: { children: ReactNode }) {
  const api = useGameSession()
  const apiRef = useRef(api)
  apiRef.current = api

  useEffect(() => {
    const hook = {
      getSession: () => apiRef.current.session,
      endGame: () => apiRef.current.endGame(),
    }
    ;(window as unknown as { __funworldmap_game?: typeof hook }).__funworldmap_game = hook
    return () => {
      delete (window as unknown as { __funworldmap_game?: typeof hook }).__funworldmap_game
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
