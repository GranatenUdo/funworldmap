import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Launcher } from '../Launcher'
import { record, __resetForTests } from '../../game/shared/personalBestsStore'
import { stubGetAnimations } from './singleCountryPanelTestUtils'

// jsdom doesn't implement Element.getAnimations; the launcher's
// animation-state effect calls it inside a rAF.
let animationsStub: { restore: () => void }
beforeAll(() => {
  animationsStub = stubGetAnimations()
})
afterAll(() => animationsStub.restore())

afterEach(() => {
  cleanup()
  __resetForTests()
  localStorage.clear()
})

describe('Launcher subtitle first-run gate (A16)', () => {
  it('addresses first-time visitors while neither mode has been played', () => {
    render(<Launcher onDismiss={vi.fn()} />)
    expect(screen.getByTestId('launcher-subtitle').textContent).toBe('Two quick geography games')
  })

  it('switches to the beat-your-best subtitle once country-pinning has a game', () => {
    record('country-pinning', 300, 2)
    render(<Launcher onDismiss={vi.fn()} />)
    expect(screen.getByTestId('launcher-subtitle').textContent).toBe(
      'Pick a mode and beat your best',
    )
  })

  it('a played city-guessing game also flips the subtitle (either mode counts)', () => {
    record('city-guessing', 0, 0) // even a 0-score run counts as played
    render(<Launcher onDismiss={vi.fn()} />)
    expect(screen.getByTestId('launcher-subtitle').textContent).toBe(
      'Pick a mode and beat your best',
    )
  })
})
