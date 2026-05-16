import { render, screen, act, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LauncherMilestoneOverlay } from '../LauncherMilestoneOverlay'

describe('LauncherMilestoneOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.__PLAYWRIGHT__ = true
    window.__testAnalytics = []
  })
  afterEach(() => {
    vi.useRealTimers()
    delete window.__PLAYWRIGHT__
    delete window.__testAnalytics
  })

  it('renders milestone copy for each threshold', () => {
    const copies: Record<number, RegExp> = {
      3: /off to a strong start/i,
      7: /a full week/i,
      14: /two weeks/i,
      30: /a full month/i,
      100: /a hundred days/i,
    }
    for (const [days, regex] of Object.entries(copies)) {
      const { unmount } = render(
        <LauncherMilestoneOverlay days={Number(days) as 3 | 7 | 14 | 30 | 100} onDismiss={() => {}} />,
      )
      expect(screen.getByTestId('launcher-milestone').textContent ?? '').toMatch(regex)
      unmount()
    }
  })

  it('fires streak_reached_milestone on mount', () => {
    render(<LauncherMilestoneOverlay days={7} onDismiss={() => {}} />)
    expect(window.__testAnalytics).toContainEqual({
      name: 'streak_reached_milestone',
      props: { days: 7 },
    })
  })

  it('auto-dismisses after 2500 ms', () => {
    const onDismiss = vi.fn()
    render(<LauncherMilestoneOverlay days={3} onDismiss={onDismiss} />)
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(2499) })
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('dismisses on click', () => {
    const onDismiss = vi.fn()
    render(<LauncherMilestoneOverlay days={3} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByTestId('launcher-milestone'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
