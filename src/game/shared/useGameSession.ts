import { useCallback, useReducer } from 'react'
import type { GameSession, GuessInput, ModeGuessResult, ModeId, RoundSpec } from './types'

/**
 * Reducer action set. One attempt per round — the round ends immediately on
 * each guess. `finalize` advances round-ended → game-over when
 * `lastOutcome.endsGame` is true. `finishFree` ends an in-progress free-play
 * session early (endedEarly=true).
 */
type Action =
  | { type: 'start'; modeId: ModeId; firstRound: RoundSpec; maxRounds: number | null }
  // `input` is the guess that produced `result`; the reducer only consumes
  // `result`, but the action carries `input` as its event record (kept for
  // analytics/replay seams — it is intentionally not stored in session state).
  | { type: 'attempt'; input: GuessInput; result: ModeGuessResult }
  | { type: 'advance'; nextRound: RoundSpec }
  | { type: 'overrideRound'; round: RoundSpec }
  | { type: 'endGame' }
  | { type: 'finishFree' }
  | { type: 'finalize' }
  | { type: 'restart'; modeId: ModeId; firstRound: RoundSpec; maxRounds: number | null }

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
  endedEarly: false,
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

    case 'attempt': {
      if (state.status !== 'playing' || !state.currentRound) return state
      const nextLives = Math.max(0, state.lives + action.result.livesDelta) as GameSession['lives']
      const nextStreak = action.result.pointsEarned >= 100 ? state.streak + 1 : 0
      const endsGame =
        state.maxRounds !== null ? state.roundIndex + 1 >= state.maxRounds : nextLives <= 0
      return {
        ...state,
        status: 'round-ended',
        lives: nextLives,
        score: state.score + action.result.pointsEarned,
        streak: nextStreak,
        bestStreak: Math.max(state.bestStreak, nextStreak),
        lastOutcome: {
          pointsEarned: action.result.pointsEarned,
          livesDelta: action.result.livesDelta,
          endsGame,
          reveal: action.result.reveal,
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
        lastOutcome: null,
      }
    }

    case 'endGame': {
      return { ...EMPTY, used: new Set() }
    }

    case 'finishFree': {
      if (state.status === 'idle' || state.status === 'game-over') return state
      return { ...state, status: 'game-over', endedEarly: true }
    }

    case 'finalize': {
      if (state.status !== 'round-ended') return state
      if (!state.lastOutcome?.endsGame) return state
      return { ...state, status: 'game-over' }
    }

    case 'restart': {
      // Atomic transition from any state (including game-over) directly into
      // a fresh playing session for a new mode. Collapsing endGame+start into
      // a single dispatch avoids the intermediate `status='idle'` render that
      // would otherwise unmount the HUD between the two reducer ticks — the
      // root cause of bug #32 (game-over → hash-mode-switch race).
      return {
        ...EMPTY,
        modeId: action.modeId,
        status: 'playing',
        maxRounds: action.maxRounds,
        currentRound: action.firstRound,
        used: new Set([roundKey(action.firstRound)]),
      }
    }
  }
}

export function useGameSession(): {
  session: GameSession
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null) => void
  attempt: (input: GuessInput, result: ModeGuessResult) => void
  advance: (nextRound: RoundSpec) => void
  overrideRound: (round: RoundSpec) => void
  endGame: () => void
  finishFree: () => void
  finalize: () => void
  restart: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null) => void
} {
  const [session, dispatch] = useReducer(reducer, EMPTY)
  const start = useCallback(
    (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null) =>
      dispatch({ type: 'start', modeId, firstRound, maxRounds }),
    [],
  )
  const attempt = useCallback(
    (input: GuessInput, result: ModeGuessResult) => dispatch({ type: 'attempt', input, result }),
    [],
  )
  const advance = useCallback(
    (nextRound: RoundSpec) => dispatch({ type: 'advance', nextRound }),
    [],
  )
  const overrideRound = useCallback(
    (round: RoundSpec) => dispatch({ type: 'overrideRound', round }),
    [],
  )
  const endGame = useCallback(() => dispatch({ type: 'endGame' }), [])
  const finishFree = useCallback(() => dispatch({ type: 'finishFree' }), [])
  const finalize = useCallback(() => dispatch({ type: 'finalize' }), [])
  const restart = useCallback(
    (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null) =>
      dispatch({ type: 'restart', modeId, firstRound, maxRounds }),
    [],
  )
  return { session, start, attempt, advance, overrideRound, endGame, finishFree, finalize, restart }
}
