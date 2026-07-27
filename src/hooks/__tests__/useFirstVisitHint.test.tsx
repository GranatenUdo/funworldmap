import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hintCopy, useFirstVisitHint } from '../useFirstVisitHint'

const args = (
  o: Partial<{ mapReady: boolean; hasSelection: boolean; gameActive: boolean }> = {},
) => ({
  mapReady: true,
  hasSelection: false,
  gameActive: false,
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
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), { initialProps: args() })
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
        initialProps: args({ hasSelection: true }),
      })
      expect(result.current.hint).toBe(null)
      rerender(args({ hasSelection: false }))
      expect(result.current.hint).toBe('game')
      expect(localStorage.getItem('funworldmap-hint-game-shown')).toBe('1')
    })

    it('never shows twice — gate honored on a later pageload', () => {
      localStorage.setItem('funworldmap-hint-game-shown', '1')
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args({ hasSelection: true }),
      })
      rerender(args({ hasSelection: false }))
      expect(result.current.hint).toBe(null)
    })

    it('shows even after the explore hint was shown and dismissed', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), { initialProps: args() })
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      expect(result.current.hint).toBe('explore')
      rerender(args({ hasSelection: true })) // selecting dismisses the explore hint
      expect(result.current.hint).toBe(null)
      rerender(args({ hasSelection: false })) // first panel close
      expect(result.current.hint).toBe('game')
    })

    it('a game session marks it moot without showing it', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args(),
      })
      rerender(args({ gameActive: true }))
      expect(localStorage.getItem('funworldmap-hint-game-shown')).toBe('1')
      rerender(args())
      rerender(args({ hasSelection: true }))
      rerender(args({ hasSelection: false })) // panel close after having played
      expect(result.current.hint).toBe(null)
    })

    it('dismisses on the next selection and never re-shows', () => {
      const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
        initialProps: args({ hasSelection: true }),
      })
      rerender(args({ hasSelection: false }))
      expect(result.current.hint).toBe('game')
      rerender(args({ hasSelection: true }))
      expect(result.current.hint).toBe(null)
      rerender(args({ hasSelection: false }))
      expect(result.current.hint).toBe(null)
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
  })
})
