import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreBadge } from '../ScoreBadge'

describe('ScoreBadge', () => {
  it('renders the score', () => {
    render(<ScoreBadge score={42} />)
    expect(screen.getByTestId('hud-score').textContent).toBe('42')
  })
})
