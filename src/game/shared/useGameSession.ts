import { useCallback, useReducer } from 'react'
import type { GameSession, GuessOutcome, ModeId, RoundSpec } from './types'

type Action =
  | { type: 'start'; modeId: ModeId; firstRound: RoundSpec }
  | { type: 'guess'; outcome: GuessOutcome }
  | { type: 'advance'; nextRound: RoundSpec }
  | { type: 'endGame' }

const EMPTY: GameSession = {
  modeId: 'country-pinning',
  status: 'idle',
  lives: 3,
  score: 0,
  streak: 0,
  bestStreak: 0,
  roundIndex: 0,
  currentRound: null,
  lastOutcome: null,
  used: new Set(),
}

function reducer(state: GameSession, action: Action): GameSession {
  switch (action.type) {
    case 'start': {
      return {
        ...EMPTY,
        modeId: action.modeId,
        status: 'playing',
        currentRound: action.firstRound,
        used: new Set([action.firstRound.targetCca3]),
      }
    }
    case 'guess': {
      const nextLives = (state.lives + action.outcome.livesDelta) as GameSession['lives']
      const nextStreak = action.outcome.correct ? state.streak + 1 : 0
      const livesSpent = nextLives <= 0
      return {
        ...state,
        status: livesSpent ? 'game-over' : 'round-ended',
        lives: livesSpent ? 0 : nextLives,
        score: state.score + action.outcome.pointsEarned,
        streak: nextStreak,
        bestStreak: Math.max(state.bestStreak, nextStreak),
        lastOutcome: action.outcome,
      }
    }
    case 'advance': {
      if (state.status !== 'round-ended') return state
      return {
        ...state,
        status: 'playing',
        currentRound: action.nextRound,
        used: new Set([...state.used, action.nextRound.targetCca3]),
        roundIndex: state.roundIndex + 1,
        lastOutcome: null,
      }
    }
    case 'endGame': {
      return { ...EMPTY, used: new Set() }
    }
  }
}

export function useGameSession(): {
  session: GameSession
  start: (modeId: ModeId, firstRound: RoundSpec) => void
  submitGuess: (outcome: GuessOutcome) => void
  advance: (nextRound: RoundSpec) => void
  endGame: () => void
} {
  const [session, dispatch] = useReducer(reducer, EMPTY)
  const start = useCallback((modeId: ModeId, firstRound: RoundSpec) =>
    dispatch({ type: 'start', modeId, firstRound }), [])
  const submitGuess = useCallback((outcome: GuessOutcome) =>
    dispatch({ type: 'guess', outcome }), [])
  const advance = useCallback((nextRound: RoundSpec) =>
    dispatch({ type: 'advance', nextRound }), [])
  const endGame = useCallback(() => dispatch({ type: 'endGame' }), [])
  return { session, start, submitGuess, advance, endGame }
}
