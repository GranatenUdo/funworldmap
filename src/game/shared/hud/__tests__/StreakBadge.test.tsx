import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StreakBadge } from '../StreakBadge'

describe('StreakBadge', () => {
  it('renders nothing at streak 0', () => {
    const { container } = render(<StreakBadge streak={0} />)
    expect(container.firstChild).toBeNull()
  })

  // E4 drift alarm: the streak is live game state — signal accent, with the
  // dark signal-accessible variant carrying light-mode AA (≈6.3:1 on the
  // signal/15 tint over sand-50).
  it('uses the signal accent', () => {
    render(<StreakBadge streak={3} />)
    const badge = screen.getByTestId('hud-streak')
    expect(badge.textContent).toContain('3')
    expect(badge.className).toContain('bg-signal/15')
    expect(badge.className).toContain('text-signal-accessible dark:text-signal')
  })
})
