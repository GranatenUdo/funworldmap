import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { GameSessionContext } from '../../game/shared/GameSessionProvider'
import type { GameSessionApi } from '../../game/shared/GameSessionProvider'
import type { GameSession } from '../../game/shared/types'
import { useLauncherVisibility } from '../useLauncherVisibility'

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
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
    ...overrides,
  }
}

function makeApi(session: GameSession): GameSessionApi {
  return {
    session,
    mode: null,
    start: () => {},
    submitGuessInput: () => {},
    completeNow: () => {},
    resume: () => {},
    advance: () => {},
    overrideRound: () => {},
    endGame: () => {},
    finishFree: () => {},
    finalize: () => {},
  }
}

function wrapper(api: GameSessionApi) {
  return ({ children }: { children: ReactNode }) => (
    <GameSessionContext.Provider value={api}>{children}</GameSessionContext.Provider>
  )
}

function setHash(hash: string) {
  window.history.replaceState(null, '', hash === '' ? window.location.pathname : `${window.location.pathname}${hash}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

describe('useLauncherVisibility', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('visible at /', () => {
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(true)
  })

  it('visible at /# (bare hash)', () => {
    window.history.replaceState(null, '', '/#')
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(true)
  })

  it('hidden at /#FRA (deep-link bypass)', () => {
    window.history.replaceState(null, '', '/#FRA')
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(false)
  })

  it('hidden at /#game/country-pinning/play', () => {
    window.history.replaceState(null, '', '/#game/country-pinning/play')
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(false)
  })

  it('dismiss() hides launcher', () => {
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(true)
    act(() => result.current.dismiss())
    expect(result.current.visible).toBe(false)
  })

  it('show() re-reveals when on bare root', () => {
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    act(() => result.current.dismiss())
    expect(result.current.visible).toBe(false)
    act(() => result.current.show())
    expect(result.current.visible).toBe(true)
  })

  it('game-end transition (playing → idle) resets dismissed', () => {
    // Mutable holder the wrapper reads from each render. `rerender()` re-invokes
    // the wrapper, which re-reads this ref and provides a fresh context value —
    // triggering the hook's session.status effect.
    let currentApi = makeApi(makeSession({ status: 'playing' }))
    const DynamicWrapper = ({ children }: { children: ReactNode }) => (
      <GameSessionContext.Provider value={currentApi}>{children}</GameSessionContext.Provider>
    )

    const { result, rerender } = renderHook(() => useLauncherVisibility(), {
      wrapper: DynamicWrapper,
    })

    // While playing, visible is false regardless of hash.
    expect(result.current.visible).toBe(false)

    // User dismisses (no-op effect on visibility since already hidden; sets the flag).
    act(() => result.current.dismiss())

    // Game ends: swap to idle api, rerender so the wrapper picks up new value.
    act(() => {
      currentApi = makeApi(makeSession({ status: 'idle' }))
      rerender()
    })

    // dismissed has been reset by the session-status effect; at bare root, visible === true.
    expect(result.current.visible).toBe(true)
  })

  it('hashchange from / to /#FRA hides launcher', () => {
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(true)
    act(() => setHash('#FRA'))
    expect(result.current.visible).toBe(false)
  })

  it('hashchange from /#FRA back to / with dismissed=false shows launcher', () => {
    window.history.replaceState(null, '', '/#FRA')
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(false)
    act(() => setHash(''))
    expect(result.current.visible).toBe(true)
  })

  it('isDailyRoot matches #daily/YYYY-MM-DD', () => {
    window.location.hash = '#daily/2026-04-21'
    const api = makeApi(makeSession({ status: 'idle' }))
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(true)
    expect(result.current.anchorDate).toBe('2026-04-21')
  })

  it('isDailyRoot does NOT match #daily/YYYY-MM-DD/modeId', () => {
    window.location.hash = '#daily/2026-04-21/country-pinning'
    const api = makeApi(makeSession({ status: 'idle' }))
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(false)
    expect(result.current.anchorDate).toBeNull()
  })
})
