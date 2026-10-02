import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FirstSessionTutorial } from '../FirstSessionTutorial'

const GATE_KEY = 'funworldmap-game-tutorial-shown-country-pinning-free'

describe('FirstSessionTutorial', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('auto-shows on the first session and burns the per-tab gate', () => {
    render(<FirstSessionTutorial modeId="country-pinning" firstAttemptMade={false} />)
    expect(screen.getByTestId('game-tutorial')).toBeTruthy()
    expect(sessionStorage.getItem(GATE_KEY)).toBe('1')
  })

  it('stays hidden once the gate is burned', () => {
    sessionStorage.setItem(GATE_KEY, '1')
    render(<FirstSessionTutorial modeId="country-pinning" firstAttemptMade={false} />)
    expect(screen.queryByTestId('game-tutorial')).toBeNull()
  })

  it('the first attempt closes the auto-shown card (auto-show behavior unchanged)', () => {
    const { rerender } = render(
      <FirstSessionTutorial modeId="country-pinning" firstAttemptMade={false} />,
    )
    expect(screen.getByTestId('game-tutorial')).toBeTruthy()
    rerender(<FirstSessionTutorial modeId="country-pinning" firstAttemptMade={true} />)
    expect(screen.queryByTestId('game-tutorial')).toBeNull()
  })

  it('controlled open reopens the card past the burned gate and past firstAttemptMade (C-6)', () => {
    sessionStorage.setItem(GATE_KEY, '1')
    render(<FirstSessionTutorial modeId="country-pinning" firstAttemptMade={true} open={true} />)
    expect(screen.getByTestId('game-tutorial')).toBeTruthy()
  })

  it('"Got it" while controlled-open notifies the controller via onRequestClose', () => {
    sessionStorage.setItem(GATE_KEY, '1')
    const onRequestClose = vi.fn()
    render(
      <FirstSessionTutorial
        modeId="country-pinning"
        firstAttemptMade={true}
        open={true}
        onRequestClose={onRequestClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(onRequestClose).toHaveBeenCalledTimes(1)
  })

  it('"Got it" closes the auto-shown card without a controller', () => {
    render(<FirstSessionTutorial modeId="country-pinning" firstAttemptMade={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByTestId('game-tutorial')).toBeNull()
  })
})
