import { describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import CountryPinningHud from '../CountryPinningHud'
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
