import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFirstVisitHint } from '../useFirstVisitHint'

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
    sessionStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the hint 1.5s after map-ready when idle, once per session', () => {
    const { result } = renderHook(() => useFirstVisitHint(args()))
    expect(result.current.showHint).toBe(false)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(result.current.showHint).toBe(true)
    expect(sessionStorage.getItem('funworldmap-hint-shown')).toBe('1')
  })

  it('does not show if the map is not ready', () => {
    const { result } = renderHook(() => useFirstVisitHint(args({ mapReady: false })))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.showHint).toBe(false)
  })

  it('does not show if a hint was already shown this session', () => {
    sessionStorage.setItem('funworldmap-hint-shown', '1')
    const { result } = renderHook(() => useFirstVisitHint(args()))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.showHint).toBe(false)
  })

  it('dismisses (and suppresses) once a selection or game starts', () => {
    const { result, rerender } = renderHook((p) => useFirstVisitHint(p), { initialProps: args() })
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(result.current.showHint).toBe(true)
    rerender(args({ hasSelection: true }))
    expect(result.current.showHint).toBe(false)
    // stays dismissed even back at idle
    rerender(args({ hasSelection: false }))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.showHint).toBe(false)
  })
})
