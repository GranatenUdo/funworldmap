import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DailyShareBlock } from '../DailyShareBlock'
import type { StreakState } from '../../game/daily/types'
import type { ShareResults } from '../../game/daily/shareText'
import { installAnalyticsCapture, type AnalyticsCapture } from '../../test/analyticsCapture'

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

const streak: StreakState = {
  current: 3,
  longest: 3,
  lastActiveDate: '2026-04-21',
  lastMilestoneShown: 0,
}

let captured: AnalyticsCapture

// Mutable navigator surface for tests: only the fields we touch.
interface NavigatorMock {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>
  clipboard: { writeText: ReturnType<typeof vi.fn> }
}
const nav = navigator as unknown as NavigatorMock

beforeEach(() => {
  captured = installAnalyticsCapture()
  // Reset navigator mocks
  delete nav.share
  nav.clipboard = { writeText: vi.fn().mockResolvedValue(undefined) }
})

afterEach(() => {
  captured.uninstall()
})

describe('DailyShareBlock', () => {
  it('renders a share preview containing the mode emoji and score', () => {
    render(
      <DailyShareBlock
        date="2026-04-21"
        results={results}
        streak={streak}
        originUrl="https://funworldmap.com"
      />,
    )
    const preview = screen.getByTestId('daily-share-preview')
    const text = preview.textContent ?? ''
    expect(text).toContain('funworldmap · 04-21')
    expect(text).toContain('87/100')
  })

  it('share button uses navigator.share when available', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined)
    nav.share = shareMock as unknown as NavigatorMock['share']
    render(
      <DailyShareBlock
        date="2026-04-21"
        results={results}
        streak={streak}
        originUrl="https://funworldmap.com"
      />,
    )
    fireEvent.click(screen.getByTestId('daily-share-primary'))
    await new Promise((r) => setTimeout(r, 0))
    expect(shareMock).toHaveBeenCalledTimes(1)
    const call = shareMock.mock.calls[0][0] as { title: string; text: string; url: string }
    expect(call.title).toBe('funworldmap daily')
    expect(call.text).toContain('funworldmap · 04-21')
    expect(call.url).toBe('https://funworldmap.com/#daily/2026-04-21')
    expect(captured.events).toEqual([
      { name: 'daily_shared', props: { date: '2026-04-21', modesPlayed: 1, method: 'share-api' } },
    ])
  })

  it('falls back to clipboard.writeText when navigator.share is absent', async () => {
    render(
      <DailyShareBlock
        date="2026-04-21"
        results={results}
        streak={streak}
        originUrl="https://funworldmap.com"
      />,
    )
    fireEvent.click(screen.getByTestId('daily-share-primary'))
    await new Promise((r) => setTimeout(r, 0))
    const writeText = nav.clipboard.writeText
    expect(writeText.mock.calls[0][0]).toContain('#daily/2026-04-21')
    expect(captured.events[0]).toMatchObject({
      name: 'daily_shared',
      props: { date: '2026-04-21', modesPlayed: 1, method: 'clipboard-text' },
    })
  })

  it('"Copy link only" copies just the URL and tracks clipboard-link', async () => {
    render(
      <DailyShareBlock
        date="2026-04-21"
        results={results}
        streak={streak}
        originUrl="https://funworldmap.com"
      />,
    )
    fireEvent.click(screen.getByTestId('daily-share-copy-link'))
    await new Promise((r) => setTimeout(r, 0))
    const writeText = nav.clipboard.writeText
    expect(writeText.mock.calls[0][0]).toBe('https://funworldmap.com/#daily/2026-04-21')
    expect(captured.events[0]).toMatchObject({
      name: 'daily_shared',
      props: { date: '2026-04-21', modesPlayed: 1, method: 'clipboard-link' },
    })
  })

  it('navigator.share AbortError does NOT fire daily_shared', async () => {
    const abortErr = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    const shareMock = vi.fn().mockRejectedValue(abortErr)
    nav.share = shareMock as unknown as NavigatorMock['share']
    render(
      <DailyShareBlock
        date="2026-04-21"
        results={results}
        streak={streak}
        originUrl="https://funworldmap.com"
      />,
    )
    fireEvent.click(screen.getByTestId('daily-share-primary'))
    await new Promise((r) => setTimeout(r, 0))
    expect(captured.events).toEqual([])
  })

  it('dispatches funworldmap:toast on clipboard success', async () => {
    const events: string[] = []
    const handler = (e: Event) => events.push((e as CustomEvent<string>).detail)
    window.addEventListener('funworldmap:toast', handler)
    render(
      <DailyShareBlock
        date="2026-04-21"
        results={results}
        streak={streak}
        originUrl="https://funworldmap.com"
      />,
    )
    fireEvent.click(screen.getByTestId('daily-share-copy-link'))
    await new Promise((r) => setTimeout(r, 0))
    window.removeEventListener('funworldmap:toast', handler)
    expect(events.length).toBeGreaterThan(0)
  })
})
