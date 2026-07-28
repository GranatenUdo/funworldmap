import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreBadge } from '../ScoreBadge'

describe('ScoreBadge', () => {
  it('renders the score', () => {
    render(<ScoreBadge score={42} />)
    expect(screen.getByTestId('hud-score').textContent).toBe('42')
  })

  // E2: game scores use the .text-readout role (system mono, tabular-nums).
  it('renders the numeral in the readout face', () => {
    render(<ScoreBadge score={42} />)
    expect(screen.getByTestId('hud-score').className).toContain('text-readout')
  })
})
