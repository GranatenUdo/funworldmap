import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DailyShareBlock } from '../DailyShareBlock'
import type { StreakState } from '../../game/daily/types'
import type { ShareResults } from '../../game/daily/shareText'

const results: ShareResults = {
  'country-pinning': {
    score: 87,
    attempts: [
      { pointsEarned: 42, distanceKm: 1200 },
      { pointsEarned: 63, distanceKm: 400 },
      { pointsEarned: 91, distanceKm: 0 },
    ],
    completedAt: 0,
  },
}

const streak: StreakState = { current: 3, longest: 3, lastActiveDate: '2026-04-21', lastMilestoneShown: 0 }

declare global {
  interface Window {
    __testAnalytics?: Array<{ name: string; props: Record<string, string | number> }>
  }
}

beforeEach(() => {
  // Enable test analytics capture (analytics.ts gates on __PLAYWRIGHT__)
  ;(window as Window & { __PLAYWRIGHT__: boolean }).__PLAYWRIGHT__ = true
  window.__testAnalytics = []
  // Reset navigator mocks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (navigator as any).share
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(navigator as any).clipboard = { writeText: vi.fn().mockResolvedValue(undefined) }
})

describe('DailyShareBlock', () => {
  it('renders a share preview containing the mode emoji and score', () => {
    render(<DailyShareBlock date="2026-04-21" results={results} streak={streak} originUrl="https://funworldmap.com" />)
    const preview = screen.getByTestId('daily-share-preview')
    const text = preview.textContent ?? ''
    expect(text).toContain('funworldmap · 04-21')
    expect(text).toContain('87/100')
  })

  it('share button uses navigator.share when available', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(navigator as any).share = shareMock
    render(<DailyShareBlock date="2026-04-21" results={results} streak={streak} originUrl="https://funworldmap.com" />)
    fireEvent.click(screen.getByTestId('daily-share-primary'))
    await new Promise((r) => setTimeout(r, 0))
    expect(shareMock).toHaveBeenCalledTimes(1)
    const call = shareMock.mock.calls[0][0]
    expect(call.title).toBe('funworldmap daily')
    expect(call.text).toContain('funworldmap · 04-21')
    expect(call.url).toBe('https://funworldmap.com/#daily/2026-04-21')
    expect(window.__testAnalytics).toEqual([
      { name: 'daily_shared', props: { date: '2026-04-21', modesPlayed: 1, method: 'share-api' } },
    ])
  })

  it('falls back to clipboard.writeText when navigator.share is absent', async () => {
    render(<DailyShareBlock date="2026-04-21" results={results} streak={streak} originUrl="https://funworldmap.com" />)
    fireEvent.click(screen.getByTestId('daily-share-primary'))
    await new Promise((r) => setTimeout(r, 0))
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>
    expect(writeText.mock.calls[0][0]).toContain('#daily/2026-04-21')
    expect(window.__testAnalytics?.[0]).toMatchObject({
      name: 'daily_shared',
      props: { date: '2026-04-21', modesPlayed: 1, method: 'clipboard-text' },
    })
  })

  it('"Copy link only" copies just the URL and tracks clipboard-link', async () => {
    render(<DailyShareBlock date="2026-04-21" results={results} streak={streak} originUrl="https://funworldmap.com" />)
    fireEvent.click(screen.getByTestId('daily-share-copy-link'))
    await new Promise((r) => setTimeout(r, 0))
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>
    expect(writeText.mock.calls[0][0]).toBe('https://funworldmap.com/#daily/2026-04-21')
    expect(window.__testAnalytics?.[0]).toMatchObject({
      name: 'daily_shared',
      props: { date: '2026-04-21', modesPlayed: 1, method: 'clipboard-link' },
    })
  })

  it('navigator.share AbortError does NOT fire daily_shared', async () => {
    const abortErr = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    const shareMock = vi.fn().mockRejectedValue(abortErr)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(navigator as any).share = shareMock
    render(<DailyShareBlock date="2026-04-21" results={results} streak={streak} originUrl="https://funworldmap.com" />)
    fireEvent.click(screen.getByTestId('daily-share-primary'))
    await new Promise((r) => setTimeout(r, 0))
    expect(window.__testAnalytics).toEqual([])
  })

  it('dispatches funworldmap:toast on clipboard success', async () => {
    const events: string[] = []
    const handler = (e: Event) => events.push((e as CustomEvent<string>).detail)
    window.addEventListener('funworldmap:toast', handler)
    render(<DailyShareBlock date="2026-04-21" results={results} streak={streak} originUrl="https://funworldmap.com" />)
    fireEvent.click(screen.getByTestId('daily-share-copy-link'))
    await new Promise((r) => setTimeout(r, 0))
    window.removeEventListener('funworldmap:toast', handler)
    expect(events.length).toBeGreaterThan(0)
  })
})
