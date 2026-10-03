import { describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { afterEach } from 'vitest'
import CountryPinningHud from '../CountryPinningHud'
import { dispatchOceanMiss } from '../oceanMiss'
import {
  makeSession,
  makeCountryRound,
  makeCountryReveal,
} from '../../../shared/__tests__/factories'

afterEach(() => cleanup())

describe('CountryPinningHud — wrong-guess reveal line (A6)', () => {
  it('threads reveal.distanceKm into the distance-led copy on the role=status line', () => {
    const reveal = makeCountryReveal({
      correct: false,
      clickedName: 'Germany',
      distanceKm: 7050,
    })
    const session = makeSession({
      status: 'round-ended',
      modeId: 'country-pinning',
      lastOutcome: { pointsEarned: 9, livesDelta: -1, endsGame: false, reveal },
      currentRound: makeCountryRound({ targetName: 'Bangladesh' }),
    })
    render(<CountryPinningHud session={session} />)
    const line = screen.getByTestId('game-reveal')
    // role="status" makes this same line the screen-reader announcement — no
    // separate announce path needed for the reveal copy.
    expect(line.getAttribute('role')).toBe('status')
    expect(line.textContent).toContain(
      `That was Germany — ${(7050).toLocaleString()} km from Bangladesh`,
    )
    expect(line.textContent).not.toContain('The answer was')
  })
})

describe('CountryPinningHud — ocean-miss status line (C-5)', () => {
  const playingSession = () =>
    makeSession({
      status: 'playing',
      modeId: 'country-pinning',
      currentRound: makeCountryRound(),
    })

  it('shows the transient role=status line on an ocean miss and auto-clears after 1600ms', () => {
    vi.useFakeTimers()
    try {
      render(<CountryPinningHud session={playingSession()} />)
      expect(screen.queryByTestId('game-ocean-miss')).toBeNull()

      act(() => {
        dispatchOceanMiss()
      })

      const line = screen.getByTestId('game-ocean-miss')
      expect(line.getAttribute('role')).toBe('status')
      expect(line.textContent).toBe('Ocean — pick a country')

      // Information timing, not animation — the same clock under reduced motion.
      act(() => {
        vi.advanceTimersByTime(1600)
      })
      expect(screen.queryByTestId('game-ocean-miss')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('clears when the round ends, never sits beside the reveal line, and does not resurface next round', () => {
    const { rerender } = render(<CountryPinningHud session={playingSession()} />)

    act(() => {
      dispatchOceanMiss()
    })
    expect(screen.getByTestId('game-ocean-miss')).toBeTruthy()

    const ended = makeSession({
      status: 'round-ended',
      modeId: 'country-pinning',
      currentRound: makeCountryRound(),
      lastOutcome: {
        pointsEarned: 12,
        livesDelta: 0,
        endsGame: false,
        reveal: makeCountryReveal({ correct: true, clickedName: 'France', distanceKm: 0 }),
      },
    })
    rerender(<CountryPinningHud session={ended} />)
    expect(screen.queryByTestId('game-ocean-miss')).toBeNull()
    expect(screen.getByTestId('game-reveal')).toBeTruthy()

    // A fast Continue inside the 1600ms window must not resurrect the residue
    // of the previous round's miss.
    rerender(
      <CountryPinningHud
        session={makeSession({
          status: 'playing',
          modeId: 'country-pinning',
          currentRound: makeCountryRound({ targetName: 'Spain', targetCca3: 'ESP' }),
        })}
      />,
    )
    expect(screen.queryByTestId('game-ocean-miss')).toBeNull()
  })
})
