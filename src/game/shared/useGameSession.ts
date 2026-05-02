import { useCallback, useReducer } from 'react'
import type { AttemptRecord, GameSession, GuessInput, ModeGuessResult, ModeId, RoundSpec } from './types'

/**
 * Reducer action set. The collapsed `attempt` action subsumes the old
 * `recordAttempt` / `submitGuess` split. `completeNow` is the user-driven
 * early-end for best-of-N rounds. `resume` rehydrates a daily session from
 * persisted state.
 *
 * Configuration guard: the combination `attemptsPerRound > 1 && maxRounds === null`
 * is structurally unsupported (lives never decrement; endsGame falls through
 * to a permanently-false condition). The `start` action rejects this combo.
 */
type Action =
  | { type: 'start'; modeId: ModeId; firstRound: RoundSpec; maxRounds: number | null; attemptsPerRound: number; dailyDate: string | null }
  | { type: 'attempt'; input: GuessInput; result: ModeGuessResult }
  | { type: 'completeNow' }
  | { type: 'resume'; modeId: ModeId; round: RoundSpec; attemptsPerRound: number; attempts: AttemptRecord[]; dailyDate: string }
  | { type: 'advance'; nextRound: RoundSpec }
  | { type: 'overrideRound'; round: RoundSpec }
  | { type: 'endGame' }
  | { type: 'finishFree' }
  | { type: 'finalize' }

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
  dailyDate: null,
  endedEarly: false,
  used: new Set(),
}

function roundKey(round: RoundSpec): string {
  return round.kind === 'country-pinning' ? round.targetCca3 : round.targetId
}

export function deriveBest(attempts: AttemptRecord[]): AttemptRecord {
  return attempts.reduce((best, a) => (a.pointsEarned > best.pointsEarned ? a : best), attempts[0])
}

function endOfRound(state: GameSession, attempts: AttemptRecord[], finalResult: ModeGuessResult | null): GameSession {
  const best = deriveBest(attempts)
  const livesDelta = state.attemptsPerRound === 1 && finalResult ? finalResult.livesDelta : 0
  const nextLives = Math.max(0, state.lives + livesDelta) as GameSession['lives']
  const nextStreak = best.pointsEarned >= 100 ? state.streak + 1 : 0
  const endsGame =
    state.maxRounds !== null
      ? state.roundIndex + 1 >= state.maxRounds
      : nextLives <= 0
  return {
    ...state,
    status: 'round-ended',
    lives: nextLives,
    score: state.score + best.pointsEarned,
    streak: nextStreak,
    bestStreak: Math.max(state.bestStreak, nextStreak),
    attemptsRemaining: 0,
    currentAttempts: attempts,
    lastOutcome: {
      pointsEarned: best.pointsEarned,
      livesDelta,
      endsGame,
      reveal: best.reveal,
    },
  }
}

function reducer(state: GameSession, action: Action): GameSession {
  switch (action.type) {
    case 'start': {
      if (action.attemptsPerRound > 1 && action.maxRounds === null) {
        if (typeof console !== 'undefined') {
          console.error('useGameSession: attemptsPerRound>1 with maxRounds=null is unsupported')
        }
        return state
      }
      return {
        ...EMPTY,
        modeId: action.modeId,
        status: 'playing',
        maxRounds: action.maxRounds,
        attemptsPerRound: action.attemptsPerRound,
        attemptsRemaining: action.attemptsPerRound,
        currentRound: action.firstRound,
        dailyDate: action.dailyDate,
        used: new Set([roundKey(action.firstRound)]),
      }
    }

    case 'attempt': {
      if (state.status !== 'playing' || !state.currentRound) return state
      if (state.attemptsRemaining <= 0) return state
      const newAttempt: AttemptRecord = {
        pointsEarned: action.result.pointsEarned,
        input: action.input,
        reveal: action.result.reveal,
      }
      const attemptsAfter = [...state.currentAttempts, newAttempt]
      const remaining = state.attemptsRemaining - 1
      const roundEnds = state.attemptsPerRound === 1 || remaining === 0
      if (!roundEnds) {
        return {
          ...state,
          currentAttempts: attemptsAfter,
          attemptsRemaining: remaining,
        }
      }
      return endOfRound(state, attemptsAfter, action.result)
    }

    case 'completeNow': {
      if (state.status !== 'playing') return state
      if (state.attemptsPerRound <= 1) return state
      if (state.currentAttempts.length === 0) return state
      return endOfRound(state, state.currentAttempts, null)
    }

    case 'resume': {
      if (action.attemptsPerRound <= 1) return state
      if (action.attempts.length >= action.attemptsPerRound) return state
      return {
        ...EMPTY,
        modeId: action.modeId,
        status: 'playing',
        maxRounds: 1,
        attemptsPerRound: action.attemptsPerRound,
        attemptsRemaining: action.attemptsPerRound - action.attempts.length,
        currentAttempts: action.attempts,
        currentRound: action.round,
        dailyDate: action.dailyDate,
        used: new Set([roundKey(action.round)]),
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

    case 'finishFree': {
      if (state.status === 'idle' || state.status === 'game-over') return state
      if (state.dailyDate !== null) return state
      return { ...state, status: 'game-over', endedEarly: true }
    }

    case 'finalize': {
      if (state.status !== 'round-ended') return state
      if (!state.lastOutcome?.endsGame) return state
      return { ...state, status: 'game-over' }
    }
  }
}

export function useGameSession(): {
  session: GameSession
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound?: number, dailyDate?: string | null) => void
  attempt: (input: GuessInput, result: ModeGuessResult) => void
  completeNow: () => void
  resume: (payload: { modeId: ModeId; round: RoundSpec; attemptsPerRound: number; attempts: AttemptRecord[]; dailyDate: string }) => void
  advance: (nextRound: RoundSpec) => void
  overrideRound: (round: RoundSpec) => void
  endGame: () => void
  finishFree: () => void
  finalize: () => void
} {
  const [session, dispatch] = useReducer(reducer, EMPTY)
  const start = useCallback(
    (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound = 1, dailyDate: string | null = null) =>
      dispatch({ type: 'start', modeId, firstRound, maxRounds, attemptsPerRound, dailyDate }),
    [],
  )
  const attempt = useCallback(
    (input: GuessInput, result: ModeGuessResult) => dispatch({ type: 'attempt', input, result }),
    [],
  )
  const completeNow = useCallback(() => dispatch({ type: 'completeNow' }), [])
  const resume = useCallback(
    (payload: { modeId: ModeId; round: RoundSpec; attemptsPerRound: number; attempts: AttemptRecord[]; dailyDate: string }) =>
      dispatch({ type: 'resume', ...payload }),
    [],
  )
  const advance = useCallback((nextRound: RoundSpec) => dispatch({ type: 'advance', nextRound }), [])
  const overrideRound = useCallback((round: RoundSpec) => dispatch({ type: 'overrideRound', round }), [])
  const endGame = useCallback(() => dispatch({ type: 'endGame' }), [])
  const finishFree = useCallback(() => dispatch({ type: 'finishFree' }), [])
  const finalize = useCallback(() => dispatch({ type: 'finalize' }), [])
  return { session, start, attempt, completeNow, resume, advance, overrideRound, endGame, finishFree, finalize }
}
