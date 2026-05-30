import { describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import CityGuessingHud from '../CityGuessingHud'
import { makeSession, makeCityRound, makePointReveal } from '../../../shared/__tests__/factories'

afterEach(() => cleanup())

describe('CityGuessingHud — revealLine gate', () => {
  it('renders no game-reveal during playing (free city)', () => {
    const session = makeSession({
      status: 'playing',
      modeId: 'city-guessing',
      currentRound: makeCityRound(),
    })
    render(<CityGuessingHud session={session} onSkip={() => {}} />)
    expect(screen.queryByTestId('game-reveal')).toBeNull()
  })

  it('renders game-reveal from outcome on round-ended', () => {
    const reveal = makePointReveal({ clickedPoint: [4, 50], distanceKm: 750 })
    const session = makeSession({
      status: 'round-ended',
      modeId: 'city-guessing',
      lastOutcome: { pointsEarned: 22, livesDelta: 0, endsGame: true, reveal },
      currentRound: makeCityRound({ targetName: 'Paris' }),
    })
    render(<CityGuessingHud session={session} onSkip={() => {}} />)
    expect(screen.getByTestId('game-reveal').textContent).toContain('750 km off')
  })
})
