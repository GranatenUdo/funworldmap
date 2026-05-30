import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { GameSessionContext } from '../../game/shared/GameSessionProvider'
import type { GameSessionApi } from '../../game/shared/GameSessionProvider'
import type { GameSession } from '../../game/shared/types'
import { makeSession } from '../../game/shared/__tests__/factories'
import { useLauncherVisibility } from '../useLauncherVisibility'

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
    restart: () => {},
  }
}

function wrapper(api: GameSessionApi) {
  return ({ children }: { children: ReactNode }) => (
    <GameSessionContext.Provider value={api}>{children}</GameSessionContext.Provider>
  )
}

describe('useLauncherVisibility', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('returns visible=false initially (map-first)', () => {
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(false)
  })

  it('show() makes visible=true when session is idle', () => {
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    act(() => result.current.show())
    expect(result.current.visible).toBe(true)
  })

  it('dismiss() hides the launcher', () => {
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    act(() => result.current.show())
    expect(result.current.visible).toBe(true)
    act(() => result.current.dismiss())
    expect(result.current.visible).toBe(false)
  })

  it('show() after dismiss() re-reveals the launcher', () => {
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    act(() => result.current.show())
    act(() => result.current.dismiss())
    expect(result.current.visible).toBe(false)
    act(() => result.current.show())
    expect(result.current.visible).toBe(true)
  })

  it('visible=false when session is not idle even after show()', () => {
    const api = makeApi(makeSession({ status: 'playing' }))
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    act(() => result.current.show())
    expect(result.current.visible).toBe(false)
  })

  it('game-end transition (playing → idle) resets intent to default (not open)', () => {
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

    // While playing, visible is false.
    expect(result.current.visible).toBe(false)

    // User calls show() while game is running (no-op on visibility since session blocks it).
    act(() => result.current.show())
    expect(result.current.visible).toBe(false)

    // Game ends: swap to idle api, rerender so the wrapper picks up new value.
    act(() => {
      currentApi = makeApi(makeSession({ status: 'idle' }))
      rerender()
    })

    // Intent was reset by session-status effect; launcher stays hidden (map-first).
    expect(result.current.visible).toBe(false)
  })
})
