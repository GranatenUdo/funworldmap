import { useCallback, useReducer } from 'react'
import type { AttemptRecord, GameSession, GuessInput, GuessOutcome, ModeId, RoundSpec } from './types'

type Action =
  | { type: 'start'; modeId: ModeId; firstRound: RoundSpec; maxRounds: number | null; attemptsPerRound: number }
  | { type: 'attempt'; attempt: AttemptRecord }
  | { type: 'guess'; input: GuessInput; outcome: GuessOutcome }
  | { type: 'revealEarly' }
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
  attemptsPerRound: 1,
  attemptsRemaining: 1,
  currentAttempts: [],
  currentRound: null,
  lastOutcome: null,
  used: new Set(),
}

function roundKey(round: RoundSpec): string {
  return round.kind === 'country-pinning' ? round.targetCca3 : round.targetId
}

function bestPoints(attempts: AttemptRecord[]): number {
  return attempts.reduce((m, a) => Math.max(m, a.pointsEarned), 0)
}

function reducer(state: GameSession, action: Action): GameSession {
  switch (action.type) {
    case 'start': {
      return {
        ...EMPTY,
        modeId: action.modeId,
        status: 'playing',
        maxRounds: action.maxRounds,
        attemptsPerRound: action.attemptsPerRound,
        attemptsRemaining: action.attemptsPerRound,
        currentRound: action.firstRound,
        used: new Set([roundKey(action.firstRound)]),
      }
    }
    case 'attempt': {
      if (state.status !== 'playing') return state
      if (state.attemptsRemaining <= 0) return state
      return {
        ...state,
        attemptsRemaining: state.attemptsRemaining - 1,
        currentAttempts: [...state.currentAttempts, action.attempt],
      }
    }
    case 'guess': {
      if (state.attemptsPerRound > 1 && state.attemptsRemaining > 1) return state

      const finalAttempt: AttemptRecord = {
        pointsEarned: action.outcome.pointsEarned,
        input: action.input,
        reveal: action.outcome.reveal,
      }
      const attemptsWithFinal =
        state.attemptsPerRound > 1
          ? [...state.currentAttempts, finalAttempt]
          : state.currentAttempts
      const points = state.attemptsPerRound > 1 ? bestPoints(attemptsWithFinal) : action.outcome.pointsEarned
      const nextLives = Math.max(0, state.lives + action.outcome.livesDelta) as GameSession['lives']
      const nextStreak = action.outcome.pointsEarned >= 100 ? state.streak + 1 : 0
      return {
        ...state,
        status: action.outcome.endsGame ? 'game-over' : 'round-ended',
        lives: nextLives,
        score: state.score + points,
        streak: nextStreak,
        bestStreak: Math.max(state.bestStreak, nextStreak),
        attemptsRemaining: 0,
        currentAttempts: attemptsWithFinal,
        lastOutcome: { ...action.outcome, pointsEarned: points },
      }
    }
    case 'revealEarly': {
      if (state.status !== 'playing') return state
      if (state.currentAttempts.length === 0) return state
      const points = bestPoints(state.currentAttempts)
      return {
        ...state,
        status: 'game-over',
        score: state.score + points,
        attemptsRemaining: 0,
        lastOutcome: {
          pointsEarned: points,
          livesDelta: 0,
          endsGame: true,
          reveal: state.currentAttempts[state.currentAttempts.length - 1].reveal,
        },
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
        attemptsRemaining: state.attemptsPerRound,
        currentAttempts: [],
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
        attemptsRemaining: state.attemptsPerRound,
        currentAttempts: [],
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
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound?: number) => void
  recordAttempt: (attempt: AttemptRecord) => void
  submitGuess: (input: GuessInput, outcome: GuessOutcome) => void
  revealEarly: () => void
  advance: (nextRound: RoundSpec) => void
  overrideRound: (round: RoundSpec) => void
  endGame: () => void
} {
  const [session, dispatch] = useReducer(reducer, EMPTY)
  const start = useCallback(
    (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound = 1) =>
      dispatch({ type: 'start', modeId, firstRound, maxRounds, attemptsPerRound }),
    [],
  )
  const recordAttempt = useCallback((attempt: AttemptRecord) => dispatch({ type: 'attempt', attempt }), [])
  const submitGuess = useCallback(
    (input: GuessInput, outcome: GuessOutcome) => dispatch({ type: 'guess', input, outcome }),
    [],
  )
  const revealEarly = useCallback(() => dispatch({ type: 'revealEarly' }), [])
  const advance = useCallback((nextRound: RoundSpec) => dispatch({ type: 'advance', nextRound }), [])
  const overrideRound = useCallback((round: RoundSpec) => dispatch({ type: 'overrideRound', round }), [])
  const endGame = useCallback(() => dispatch({ type: 'endGame' }), [])
  return { session, start, recordAttempt, submitGuess, revealEarly, advance, overrideRound, endGame }
}
