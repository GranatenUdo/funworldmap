import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { type ReactNode } from 'react'
import { GameSessionProvider, useGameSessionContext } from '../GameSessionProvider'
import { countriesFixture, citiesFixture } from '../../hooks/__tests__/fixtures'

function wrapperWith(pools: { countries: typeof countriesFixture; cities: typeof citiesFixture }) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <GameSessionProvider pools={pools}>{children}</GameSessionProvider>
  }
}

describe('GameSessionProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('mode is null while the active mode pool is empty', () => {
    const { result } = renderHook(() => useGameSessionContext(), {
      wrapper: wrapperWith({ countries: [], cities: citiesFixture }),
    })
    // Default modeId is country-pinning; its pool is empty.
    expect(result.current.mode).toBeNull()
  })

  it('submitGuessInput is a no-op unless status is playing', () => {
    const { result } = renderHook(() => useGameSessionContext(), {
      wrapper: wrapperWith({ countries: countriesFixture, cities: citiesFixture }),
    })
    act(() => {
      result.current.submitGuessInput({ kind: 'skip' })
    })
    expect(result.current.session.status).toBe('idle')
    expect(result.current.session.lastOutcome).toBeNull()
  })

  it('registers and tears down the window seam under VITE_TEST_HOOKS', () => {
    vi.stubEnv('VITE_TEST_HOOKS', '1')
    const { result, unmount } = renderHook(() => useGameSessionContext(), {
      wrapper: wrapperWith({ countries: countriesFixture, cities: citiesFixture }),
    })
    const seam = (window as { __funworldmap_game?: Record<string, unknown> }).__funworldmap_game
    expect(typeof seam?.getSession).toBe('function')
    expect(typeof seam?.endGame).toBe('function')
    expect(typeof seam?.finalize).toBe('function')
    expect(typeof seam?.restart).toBe('function')
    // getSession reads the LIVE session through the ref — drive a transition
    // via the seam's own restart and observe it (a stale snapshot would
    // still report 'idle').
    expect((seam!.getSession as () => { status: string })().status).toBe('idle')
    act(() => {
      ;(seam!.restart as (m: string, r: unknown, n: number | null) => void)(
        'country-pinning',
        {
          kind: 'country-pinning',
          targetCca3: 'FRA',
          targetName: 'France',
          targetFlag: '',
          targetCentroid: [0, 0],
        },
        null,
      )
    })
    expect((seam!.getSession as () => { status: string })().status).toBe('playing')
    expect(result.current.session.status).toBe('playing')
    unmount()
    // Teardown deletes per-key, so __funworldmap_game still exists but keys are gone.
    const after = (window as { __funworldmap_game?: Record<string, unknown> }).__funworldmap_game
    expect(after).toBeDefined()
    expect(after?.getSession).toBeUndefined()
  })
})
