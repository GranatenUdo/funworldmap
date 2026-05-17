import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LauncherCountdown } from '../LauncherCountdown'

describe('LauncherCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 17, 20, 37, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('renders the all-played message and the countdown', () => {
    render(<LauncherCountdown />)
    expect(screen.getByText(/All played today/i)).toBeTruthy()
    expect(screen.getByText(/Next puzzle in 3h 23m/)).toBeTruthy()
  })
})
