import { useCallback, useReducer } from 'react'
import type { GameSession, GuessOutcome, ModeId, RoundSpec } from './types'

type Action =
  | { type: 'start'; modeId: ModeId; firstRound: RoundSpec; maxRounds: number | null }
  | { type: 'guess'; outcome: GuessOutcome }
  | { type: 'advance'; nextRound: RoundSpec }
  | { type: 'overrideRound'; round: RoundSpec }
  | { type: 'endGame' }

const EMPTY: GameSession = {
  modeId: 'country-pinning',
  status: 'idle',
  lives: 3,
  score: 0,
  streak: 0,
  bestStreak: 0,
  roundIndex: 0,
  maxRounds: null,
  currentRound: null,
  lastOutcome: null,
  used: new Set(),
}

function roundKey(round: RoundSpec): string {
  return round.kind === 'country-pinning' ? round.targetCca3 : round.targetId
}

function reducer(state: GameSession, action: Action): GameSession {
  switch (action.type) {
    case 'start': {
      return {
        ...EMPTY,
        modeId: action.modeId,
        status: 'playing',
        maxRounds: action.maxRounds,
        currentRound: action.firstRound,
        used: new Set([roundKey(action.firstRound)]),
      }
    }
    case 'guess': {
      const nextLives = Math.max(0, state.lives + action.outcome.livesDelta) as GameSession['lives']
      const nextStreak = action.outcome.pointsEarned >= 100 ? state.streak + 1 : 0
      return {
        ...state,
        status: action.outcome.endsGame ? 'game-over' : 'round-ended',
        lives: nextLives,
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
        used: new Set([...state.used, roundKey(action.nextRound)]),
        roundIndex: state.roundIndex + 1,
        lastOutcome: null,
      }
    }
    case 'overrideRound': {
      if (state.status === 'idle') return state
      // From 'round-ended' we're effectively advancing to a new round;
      // increment roundIndex so endsGame checks based on round count
      // (city-guessing) work correctly under test-override paths.
      const isAdvancing = state.status === 'round-ended'
      return {
        ...state,
        status: 'playing',
        currentRound: action.round,
        used: new Set([...state.used, roundKey(action.round)]),
        roundIndex: isAdvancing ? state.roundIndex + 1 : state.roundIndex,
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
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null) => void
  submitGuess: (outcome: GuessOutcome) => void
  advance: (nextRound: RoundSpec) => void
  overrideRound: (round: RoundSpec) => void
  endGame: () => void
} {
  const [session, dispatch] = useReducer(reducer, EMPTY)
  const start = useCallback(
    (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null) =>
      dispatch({ type: 'start', modeId, firstRound, maxRounds }),
    [],
  )
  const submitGuess = useCallback((outcome: GuessOutcome) =>
    dispatch({ type: 'guess', outcome }), [])
  const advance = useCallback((nextRound: RoundSpec) =>
    dispatch({ type: 'advance', nextRound }), [])
  const overrideRound = useCallback((round: RoundSpec) =>
    dispatch({ type: 'overrideRound', round }), [])
  const endGame = useCallback(() => dispatch({ type: 'endGame' }), [])
  return { session, start, submitGuess, advance, overrideRound, endGame }
}
