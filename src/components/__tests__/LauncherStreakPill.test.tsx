import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LauncherStreakPill } from '../LauncherStreakPill'

describe('LauncherStreakPill', () => {
  const noop = () => {}

  it('shows the broken-state copy', () => {
    render(
      <LauncherStreakPill
        current={0}
        longest={5}
        totalDays={5}
        streakMode="broken"
        onOpenHistory={noop}
      />,
    )
    expect(screen.getByText(/Your streak.s reset/i)).toBeTruthy()
  })

  it('shows the first-state copy', () => {
    render(
      <LauncherStreakPill
        current={0}
        longest={0}
        totalDays={0}
        streakMode="first"
        onOpenHistory={noop}
      />,
    )
    expect(screen.getByText(/You haven.t played today yet/i)).toBeTruthy()
  })

  it('still shows active streak unchanged', () => {
    render(
      <LauncherStreakPill
        current={5}
        longest={5}
        totalDays={5}
        streakMode="active"
        onOpenHistory={noop}
      />,
    )
    expect(screen.getByText(/5-day streak/i)).toBeTruthy()
  })
})
