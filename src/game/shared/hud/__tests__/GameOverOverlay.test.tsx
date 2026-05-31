import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GameOverOverlay } from '../GameOverOverlay'
import type { PersonalBest } from '../../types'
import { makeSession } from '../../__tests__/factories'

const baseSession = makeSession({
  status: 'game-over',
  lives: 0,
  score: 100,
  maxRounds: 1,
})

const zeroBest: PersonalBest = { bestScore: 0, bestStreak: 0, gamesPlayed: 0 }

describe('GameOverOverlay', () => {
  beforeEach(() => {
    localStorage.clear()
    window.location.hash = ''
  })

  it('still says "Game over" on unlimited mode', () => {
    render(
      <GameOverOverlay
        session={{ ...baseSession, maxRounds: 10 }}
        personalBest={zeroBest}
        beatPersonalBest={false}
        onPlayAgain={() => {}}
        onBackToMap={() => {}}
      />,
    )
    expect(screen.getByTestId('game-over-title').textContent).toBe('Game over')
    expect(screen.getByText('10 rounds complete.')).toBeTruthy()
  })

  it('says "10 rounds complete." when maxRounds is 10', () => {
    render(
      <GameOverOverlay
        session={{ ...baseSession, maxRounds: 10 }}
        personalBest={zeroBest}
        beatPersonalBest={false}
        onPlayAgain={() => {}}
        onBackToMap={() => {}}
      />,
    )
    expect(screen.getByText('10 rounds complete.')).toBeTruthy()
  })

  it('shows the personal-best block on free plays', () => {
    render(
      <GameOverOverlay
        session={{ ...baseSession, maxRounds: null }}
        personalBest={zeroBest}
        beatPersonalBest={true}
        onPlayAgain={() => {}}
        onBackToMap={() => {}}
      />,
    )
    expect(screen.getByTestId('game-over-pb')).toBeTruthy()
    expect(screen.getByText(/new personal best/i)).toBeTruthy()
  })

  it('keeps "New personal best!" when beatPersonalBest later flips to false (post-record re-render)', () => {
    const session = { ...baseSession, maxRounds: null }
    const { rerender } = render(
      <GameOverOverlay
        session={session}
        personalBest={zeroBest}
        beatPersonalBest={true}
        onPlayAgain={() => {}}
        onBackToMap={() => {}}
      />,
    )
    expect(screen.getByText(/new personal best/i)).toBeTruthy()

    // Simulate the post-record re-render: PB now equals the score, beatPB flipped to false.
    rerender(
      <GameOverOverlay
        session={session}
        personalBest={{ bestScore: 100, bestStreak: 0, gamesPlayed: 1 }}
        beatPersonalBest={false}
        onPlayAgain={() => {}}
        onBackToMap={() => {}}
      />,
    )
    expect(screen.getByText(/new personal best/i)).toBeTruthy()
    expect(screen.queryByText(/best: 100 pts/i)).toBeNull()
  })

  it('shows "Best: N pts" stably when beatPersonalBest started false', () => {
    const session = { ...baseSession, maxRounds: null, score: 14 }
    render(
      <GameOverOverlay
        session={session}
        personalBest={{ bestScore: 50, bestStreak: 2, gamesPlayed: 3 }}
        beatPersonalBest={false}
        onPlayAgain={() => {}}
        onBackToMap={() => {}}
      />,
    )
    expect(screen.getByText(/best: 50 pts/i)).toBeTruthy()
  })

  it('renders "Game ended early." when session.endedEarly is true', () => {
    render(
      <GameOverOverlay
        session={{ ...baseSession, maxRounds: null, endedEarly: true }}
        personalBest={zeroBest}
        beatPersonalBest={false}
        onPlayAgain={() => {}}
        onBackToMap={() => {}}
      />,
    )
    expect(screen.getByText('Game ended early.')).toBeTruthy()
  })
})
