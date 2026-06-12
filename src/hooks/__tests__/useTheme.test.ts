import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from '../useTheme'
import { stubMatchMedia } from '../../test/matchMediaStub'

function mockMatchMedia(prefersDark: boolean) {
  stubMatchMedia((q) => q.includes('dark') && prefersDark)
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    mockMatchMedia(false)
  })

  it('defaults to "system" with light resolved when no stored preference and system is light', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('system')
    expect(result.current.resolved).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('defaults to "system" with dark resolved when system prefers dark', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('system')
    expect(result.current.resolved).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('reads stored preference on mount', () => {
    localStorage.setItem('funworldmap-theme', 'dark')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(result.current.resolved).toBe('dark')
  })

  it('cycle() moves light → dark → system → light and persists', () => {
    localStorage.setItem('funworldmap-theme', 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')

    act(() => result.current.cycle())
    expect(result.current.theme).toBe('dark')
    expect(localStorage.getItem('funworldmap-theme')).toBe('dark')

    act(() => result.current.cycle())
    expect(result.current.theme).toBe('system')
    expect(localStorage.getItem('funworldmap-theme')).toBe('system')

    act(() => result.current.cycle())
    expect(result.current.theme).toBe('light')
    expect(localStorage.getItem('funworldmap-theme')).toBe('light')
  })

  it('applies the dark class on <html> when resolved is dark', () => {
    localStorage.setItem('funworldmap-theme', 'dark')
    renderHook(() => useTheme())
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes the dark class when switching to light', () => {
    localStorage.setItem('funworldmap-theme', 'dark')
    const { result } = renderHook(() => useTheme())
    act(() => result.current.cycle()) // dark → system (light underlying)
    act(() => result.current.cycle()) // system → light
    expect(result.current.resolved).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
