import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LivesIndicator } from '../LivesIndicator'

describe('LivesIndicator', () => {
  it('labels the remaining lives', () => {
    render(<LivesIndicator lives={2} />)
    expect(screen.getByTestId('hud-lives').getAttribute('aria-label')).toBe('2 lives remaining')
  })

  // E4 drift alarm: alive hearts are neutral (starlight in dark mode); a LOST
  // heart is the signal accent — loss is live game state. F1's heart-loss
  // animation (later plan) consumes exactly this class contract.
  it('renders alive hearts neutral and lost hearts signal', () => {
    render(<LivesIndicator lives={1} />)
    const hearts = Array.from(screen.getByTestId('hud-lives').querySelectorAll('svg'))
    expect(hearts).toHaveLength(3)
    // Heart 0 is alive (i < lives); hearts 1 and 2 are lost.
    expect(hearts[0].getAttribute('class')).toContain('text-sand-500 dark:text-dark-50')
    for (const lost of hearts.slice(1)) {
      expect(lost.getAttribute('class')).toContain('text-signal-accessible dark:text-signal')
    }
  })
})
