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

function setHash(hash: string) {
  window.history.replaceState(
    null,
    '',
    hash === '' ? window.location.pathname : `${window.location.pathname}${hash}`,
  )
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

describe('useLauncherVisibility', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('returns visible=false for bare hash (map-first)', () => {
    history.replaceState(null, '', '/')
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(false)
  })

  it('still returns visible=true for #daily/YYYY-MM-DD', () => {
    history.replaceState(null, '', '/#daily/2026-05-17')
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

  it('dismiss() hides launcher on daily route', () => {
    window.history.replaceState(null, '', '/#daily/2026-05-17')
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(true)
    act(() => result.current.dismiss())
    expect(result.current.visible).toBe(false)
  })

  it('show() re-reveals when on daily route', () => {
    window.history.replaceState(null, '', '/#daily/2026-05-17')
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

    // dismissed has been reset by the session-status effect; at bare root, visible === false (map-first).
    expect(result.current.visible).toBe(false)
  })

  it('hashchange from /#daily/2026-05-17 to /#FRA hides launcher', () => {
    window.history.replaceState(null, '', '/#daily/2026-05-17')
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(true)
    act(() => setHash('#FRA'))
    expect(result.current.visible).toBe(false)
  })

  it('hashchange from /#FRA back to / stays hidden (bare root is map-first)', () => {
    window.history.replaceState(null, '', '/#FRA')
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.visible).toBe(false)
    act(() => setHash(''))
    expect(result.current.visible).toBe(false)
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

  it('show({ historyOpen: true }) sets initialHistoryOpen', () => {
    history.replaceState(null, '', '/')
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    expect(result.current.initialHistoryOpen).toBe(false)
    act(() => {
      result.current.show({ historyOpen: true })
    })
    expect(result.current.initialHistoryOpen).toBe(true)
  })

  it('show() with no args leaves initialHistoryOpen false', () => {
    history.replaceState(null, '', '/')
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    act(() => {
      result.current.show()
    })
    expect(result.current.initialHistoryOpen).toBe(false)
  })

  it('dismiss() resets initialHistoryOpen to false', () => {
    history.replaceState(null, '', '/')
    const api = makeApi(makeSession())
    const { result } = renderHook(() => useLauncherVisibility(), { wrapper: wrapper(api) })
    act(() => {
      result.current.show({ historyOpen: true })
    })
    act(() => {
      result.current.dismiss()
    })
    expect(result.current.initialHistoryOpen).toBe(false)
  })
})
