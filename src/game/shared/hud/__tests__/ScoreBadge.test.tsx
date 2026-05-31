import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreBadge } from '../ScoreBadge'

describe('ScoreBadge', () => {
  it('renders the score', () => {
    render(<ScoreBadge score={42} />)
    expect(screen.getByTestId('hud-score').textContent).toBe('42')
  })

  it('marks the badge as pending when the pending prop is set', () => {
    render(<ScoreBadge score={75} pending />)
    const badge = screen.getByTestId('hud-score')
    expect(badge.getAttribute('data-pending')).toBe('true')
    expect(badge.textContent).toBe('75')
  })
})
