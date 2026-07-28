import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hintCopy, useFirstVisitHint } from '../useFirstVisitHint'

interface HintArgs {
  mapReady: boolean
  selectedCca3: string | null
  gameActive: boolean
  compareActive: boolean
  isDesktop: boolean
}

const args = (o: Partial<HintArgs> = {}): HintArgs => ({
  mapReady: true,
  selectedCca3: null,
  gameActive: false,
  compareActive: false,
  isDesktop: true,
  ...o,
})

describe('useFirstVisitHint', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('explore hint', () => {
    it('shows 1.5s after map-ready when idle and persists the gate in localStorage', () => {
      const { result } = renderHook(() => useFirstVisitHint(args()))
      expect(result.current.hint).toBe(null)
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      expect(result.current.hint).toBe('explore')
      expect(localStorage.getItem('funworldmap-hint-explore-shown')).toBe('1')
    })

    it('does not show if the map is not ready', () => {
      const { result } = renderHook(() => useFirstVisitHint(args({ mapReady: false })))
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(result.current.hint).toBe(null)
    })

    it('does not show again on a later pageload — localStorage gate, not per-tab', () => {
      localStorage.setItem('funworldmap-hint-explore-shown', '1')
      const { result } = renderHook(() => useFirstVisitHint(args()))
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(result.current.hint).toBe(null)
    })

    it('dismisses (and suppresses) once a selection or game starts', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args(),
      })
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      expect(result.current.hint).toBe('explore')
      rerender(args({ gameActive: true }))
      expect(result.current.hint).toBe(null)
      // stays dismissed even back at idle
      rerender(args())
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(result.current.hint).toBe(null)
    })
  })

  describe('game hint', () => {
    it('shows when the first country panel closes and persists the gate in localStorage', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args({ selectedCca3: 'FRA' }),
      })
      expect(result.current.hint).toBe(null)
      rerender(args())
      expect(result.current.hint).toBe('game')
      expect(localStorage.getItem('funworldmap-hint-game-shown')).toBe('1')
    })

    it('never shows twice — gate honored on a later pageload', () => {
      localStorage.setItem('funworldmap-hint-game-shown', '1')
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args({ selectedCca3: 'FRA' }),
      })
      rerender(args())
      expect(result.current.hint).toBe(null)
    })

    it('shows even after the explore hint was shown and dismissed', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args(),
      })
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      expect(result.current.hint).toBe('explore')
      rerender(args({ selectedCca3: 'FRA' })) // selecting dismisses the explore hint
      expect(result.current.hint).toBe(null)
      rerender(args()) // first panel close
      expect(result.current.hint).toBe('game')
    })

    it('a game session marks it moot without showing it', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args(),
      })
      rerender(args({ gameActive: true }))
      expect(localStorage.getItem('funworldmap-hint-game-shown')).toBe('1')
      rerender(args())
      rerender(args({ selectedCca3: 'FRA' }))
      rerender(args()) // panel close after having played
      expect(result.current.hint).toBe(null)
    })

    it('dismisses on the next selection and never re-shows', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args({ selectedCca3: 'FRA' }),
      })
      rerender(args())
      expect(result.current.hint).toBe('game')
      rerender(args({ selectedCca3: 'FRA' }))
      expect(result.current.hint).toBe(null)
      rerender(args())
      expect(result.current.hint).toBe(null)
    })
  })

  describe('compare tip (C5)', () => {
    it('fires on the second DISTINCT selection while the panel is open and persists the gate', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args({ selectedCca3: 'FRA' }),
      })
      expect(result.current.hint).toBe(null)
      rerender(args({ selectedCca3: 'DEU' }))
      expect(result.current.hint).toBe('compare')
      expect(localStorage.getItem('funworldmap-hint-compare-shown')).toBe('1')
    })

    it('re-selecting the same country never counts twice', () => {
      localStorage.setItem('funworldmap-hint-game-shown', '1') // isolate from the game hint
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args({ selectedCca3: 'FRA' }),
      })
      rerender(args())
      rerender(args({ selectedCca3: 'FRA' })) // same country again — still 1 distinct
      expect(result.current.hint).toBe(null)
      rerender(args({ selectedCca3: 'DEU' })) // genuinely distinct — 2nd
      expect(result.current.hint).toBe('compare')
    })

    it('gate honored on a later pageload', () => {
      localStorage.setItem('funworldmap-hint-compare-shown', '1')
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args({ selectedCca3: 'FRA' }),
      })
      rerender(args({ selectedCca3: 'DEU' }))
      expect(result.current.hint).toBe(null)
    })

    it('never fires during games, and game-time selections do not count', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args({ gameActive: true, selectedCca3: 'FRA' }),
      })
      rerender(args({ gameActive: true, selectedCca3: 'DEU' }))
      expect(result.current.hint).toBe(null)
      // After the game, two distinct selections are still required.
      rerender(args({ selectedCca3: 'ITA' }))
      expect(result.current.hint).toBe(null)
      rerender(args({ selectedCca3: 'ESP' }))
      expect(result.current.hint).toBe('compare')
    })

    it('desktop-only (C5 scope) — and the gate is NOT burned on mobile, so D4 can revisit', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args({ isDesktop: false, selectedCca3: 'FRA' }),
      })
      rerender(args({ isDesktop: false, selectedCca3: 'DEU' }))
      expect(result.current.hint).toBe(null)
      expect(localStorage.getItem('funworldmap-hint-compare-shown')).toBe(null)
    })

    it('entering compare before the tip ever showed marks it moot', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args({ selectedCca3: 'FRA' }),
      })
      rerender(args({ selectedCca3: 'FRA', compareActive: true }))
      expect(localStorage.getItem('funworldmap-hint-compare-shown')).toBe('1')
      rerender(args({ selectedCca3: 'DEU' })) // 2nd distinct, but gate already burned
      expect(result.current.hint).toBe(null)
    })

    it('dismisses on panel close and never re-shows', () => {
      localStorage.setItem('funworldmap-hint-game-shown', '1') // isolate from the game hint
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args({ selectedCca3: 'FRA' }),
      })
      rerender(args({ selectedCca3: 'DEU' }))
      expect(result.current.hint).toBe('compare')
      rerender(args())
      expect(result.current.hint).toBe(null)
      rerender(args({ selectedCca3: 'ESP' })) // 3rd distinct — gate is burned
      expect(result.current.hint).toBe(null)
    })

    it('precedence: a visible game hint yields to the compare tip on the second distinct selection', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args({ selectedCca3: 'FRA' }),
      })
      rerender(args()) // first panel close → game hint
      expect(result.current.hint).toBe('game')
      rerender(args({ selectedCca3: 'DEU' })) // 2nd distinct selection
      expect(result.current.hint).toBe('compare')
    })

    it('precedence: on panel close a visible compare tip yields to a not-yet-shown game hint (sequential, never racing)', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args({ selectedCca3: 'FRA' }),
      })
      rerender(args({ selectedCca3: 'DEU' }))
      expect(result.current.hint).toBe('compare')
      rerender(args())
      expect(result.current.hint).toBe('game')
    })
  })

  describe('hintCopy', () => {
    it('gives fine pointers the click + slash copy', () => {
      expect(hintCopy('explore', true)).toBe('Click a country to explore — or press / to search')
    })

    it('gives coarse pointers tap copy without the slash clause', () => {
      expect(hintCopy('explore', false)).toBe('Tap a country to explore')
    })

    it('game copy is pointer-independent', () => {
      expect(hintCopy('game', true)).toBe('Try a game — guess countries and cities')
      expect(hintCopy('game', false)).toBe('Try a game — guess countries and cities')
    })

    it('compare copy is pointer-independent — names no input modality, so no capability gating (A14) is needed', () => {
      expect(hintCopy('compare', true)).toBe('Tip: compare two countries side by side')
      expect(hintCopy('compare', false)).toBe('Tip: compare two countries side by side')
    })
  })
})
