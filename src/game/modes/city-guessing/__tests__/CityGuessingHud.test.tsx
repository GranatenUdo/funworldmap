import { describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import CityGuessingHud from '../CityGuessingHud'
import { makeSession, makeCityRound, makePointReveal } from '../../../shared/__tests__/factories'

afterEach(() => cleanup())

describe('CityGuessingHud — revealLine gate', () => {
  it('renders no game-reveal during playing with attemptsPerRound=1 (free city)', () => {
    const session = makeSession({
      status: 'playing',
      modeId: 'city-guessing',
      attemptsPerRound: 1,
      attemptsRemaining: 1,
      currentAttempts: [],
      currentRound: makeCityRound(),
    })
    render(<CityGuessingHud session={session} onSkip={() => {}} />)
    expect(screen.queryByTestId('game-reveal')).toBeNull()
  })

  it('renders no game-reveal during playing with attemptsPerRound>1 and no attempts yet', () => {
    const session = makeSession({
      status: 'playing',
      modeId: 'city-guessing',
      attemptsPerRound: 3,
      attemptsRemaining: 3,
      currentAttempts: [],
      currentRound: makeCityRound(),
    })
    render(<CityGuessingHud session={session} onSkip={() => {}} />)
    expect(screen.queryByTestId('game-reveal')).toBeNull()
  })

  it('renders game-reveal with latest attempt during playing best-of-N (near band)', () => {
    const reveal = makePointReveal({ clickedPoint: [4, 50], distanceKm: 750 })
    const session = makeSession({
      status: 'playing',
      modeId: 'city-guessing',
      attemptsPerRound: 3,
      attemptsRemaining: 2,
      currentAttempts: [
        {
          pointsEarned: 22,
          input: { kind: 'point', lngLat: [4, 50] },
          reveal,
        },
      ],
      currentRound: makeCityRound({ targetName: 'Paris' }),
    })
    render(<CityGuessingHud session={session} onSkip={() => {}} />)
    const el = screen.getByTestId('game-reveal')
    expect(el.textContent).toContain('750 km off')
    expect(el.textContent).toContain('+22 points')
    expect(el.textContent).toContain('Paris')
  })

  it('renders game-reveal with latest attempt during playing best-of-N (far band)', () => {
    const reveal = makePointReveal({ clickedPoint: [-74, 40], distanceKm: 5800 })
    const session = makeSession({
      status: 'playing',
      modeId: 'city-guessing',
      attemptsPerRound: 3,
      attemptsRemaining: 1,
      currentAttempts: [
        {
          pointsEarned: 0,
          input: { kind: 'point', lngLat: [4, 50] },
          reveal: makePointReveal({ clickedPoint: [4, 50], distanceKm: 750 }),
        },
        {
          pointsEarned: 0,
          input: { kind: 'point', lngLat: [-74, 40] },
          reveal,
        },
      ],
      currentRound: makeCityRound({ targetName: 'Paris' }),
    })
    render(<CityGuessingHud session={session} onSkip={() => {}} />)
    // Renders the LATEST attempt (the second one — far band), not the first.
    const el = screen.getByTestId('game-reveal')
    expect(el.textContent).toContain('5800 km off')
    expect(el.textContent).toContain('+0 points')
  })

  it('renders game-reveal from outcome on round-ended (unchanged behaviour)', () => {
    const reveal = makePointReveal({ clickedPoint: [4, 50], distanceKm: 750 })
    const session = makeSession({
      status: 'round-ended',
      modeId: 'city-guessing',
      attemptsPerRound: 3,
      attemptsRemaining: 0,
      currentAttempts: [
        {
          pointsEarned: 22,
          input: { kind: 'point', lngLat: [4, 50] },
          reveal,
        },
      ],
      lastOutcome: { pointsEarned: 22, livesDelta: 0, endsGame: true, reveal },
      currentRound: makeCityRound({ targetName: 'Paris' }),
    })
    render(<CityGuessingHud session={session} onSkip={() => {}} />)
    expect(screen.getByTestId('game-reveal').textContent).toContain('750 km off')
  })
})
