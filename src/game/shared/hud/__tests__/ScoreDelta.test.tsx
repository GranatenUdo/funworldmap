import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ScoreDelta } from '../ScoreDelta'
import { stubMatchMedia } from '../../../../test/matchMediaStub'

// prefersReducedMotion() reads window.matchMedia (absent in jsdom).
let restoreMatchMedia: () => void

beforeEach(() => {
  vi.useFakeTimers()
  restoreMatchMedia = stubMatchMedia() // default: reduced motion off
})

afterEach(() => {
  restoreMatchMedia()
  vi.useRealTimers()
})

describe('ScoreDelta', () => {
  it('appears with +N (readout face, signal, drift animation) when the score increases', () => {
    const { rerender } = render(<ScoreDelta score={0} pointsEarned={0} />)
    rerender(<ScoreDelta score={100} pointsEarned={100} />)
    const chip = screen.getByTestId('hud-score-delta')
    expect(chip.textContent).toBe('+100')
    // A-1 class contract: readout face, signal value, drift keyframe.
    expect(chip.className).toContain('text-readout')
    expect(chip.className).toContain('text-signal-accessible dark:text-signal')
    expect(chip.className).toContain('score-delta-drift')
  })

  it('does not appear when no points were earned (score unchanged)', () => {
    const { rerender } = render(<ScoreDelta score={40} pointsEarned={0} />)
    rerender(<ScoreDelta score={40} pointsEarned={0} />)
    expect(screen.queryByTestId('hud-score-delta')).toBeNull()
  })

  it('does not fire on mount, even with a positive score and outcome', () => {
    // Guards HUD (re)mounts mid-session — the chip celebrates increases only.
    render(<ScoreDelta score={250} pointsEarned={100} />)
    expect(screen.queryByTestId('hud-score-delta')).toBeNull()
  })

  it('does not fire when the score drops (restart)', () => {
    const { rerender } = render(<ScoreDelta score={300} pointsEarned={0} />)
    rerender(<ScoreDelta score={0} pointsEarned={0} />)
    expect(screen.queryByTestId('hud-score-delta')).toBeNull()
  })

  it('unmounts on animationend', () => {
    const { rerender } = render(<ScoreDelta score={0} pointsEarned={0} />)
    rerender(<ScoreDelta score={100} pointsEarned={100} />)
    fireEvent.animationEnd(screen.getByTestId('hud-score-delta'))
    expect(screen.queryByTestId('hud-score-delta')).toBeNull()
  })

  it('unmounts via the fallback timeout when animationend never fires', () => {
    const { rerender } = render(<ScoreDelta score={0} pointsEarned={0} />)
    rerender(<ScoreDelta score={100} pointsEarned={100} />)
    act(() => {
      vi.advanceTimersByTime(1199)
    })
    expect(screen.queryByTestId('hud-score-delta')).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByTestId('hud-score-delta')).toBeNull()
  })

  it('restarts with the new value on back-to-back score increases', () => {
    const { rerender } = render(<ScoreDelta score={0} pointsEarned={0} />)
    rerender(<ScoreDelta score={100} pointsEarned={100} />)
    rerender(<ScoreDelta score={250} pointsEarned={150} />)
    expect(screen.getByTestId('hud-score-delta').textContent).toBe('+150')
    // The fallback window restarts with the new burst.
    act(() => {
      vi.advanceTimersByTime(1199)
    })
    expect(screen.queryByTestId('hud-score-delta')).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByTestId('hud-score-delta')).toBeNull()
  })

  it('reduced motion: renders statically (no drift class) and clears after the static window', () => {
    restoreMatchMedia()
    restoreMatchMedia = stubMatchMedia((query) => query === '(prefers-reduced-motion: reduce)')
    const { rerender } = render(<ScoreDelta score={0} pointsEarned={0} />)
    rerender(<ScoreDelta score={100} pointsEarned={100} />)
    const chip = screen.getByTestId('hud-score-delta')
    expect(chip.textContent).toBe('+100')
    // Static: the global reduced-motion kill-switch collapses CSS animations
    // (animationend would fire instantly), so the component must not rely on
    // the drift animation here — a timeout provides information parity.
    expect(chip.className).not.toContain('score-delta-drift')
    act(() => {
      vi.advanceTimersByTime(899)
    })
    expect(screen.queryByTestId('hud-score-delta')).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByTestId('hud-score-delta')).toBeNull()
  })
})
