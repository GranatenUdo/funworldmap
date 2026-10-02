import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HudShell } from '../HudShell'
import { makeSession } from '../../__tests__/factories'
import { stubMatchMedia } from '../../../../test/matchMediaStub'

// ScoreDelta (rendered by HudShell) reads window.matchMedia via
// prefersReducedMotion(); jsdom has neither matchMedia nor rAF-as-timer.
let restoreMatchMedia: () => void

beforeEach(() => {
  // Same pattern as SingleCountryPanel.focus.test.tsx: fake rAF so the
  // focus-deferring frame can be flushed deterministically.
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  })
  restoreMatchMedia = stubMatchMedia()
})

afterEach(() => {
  restoreMatchMedia()
  vi.useRealTimers()
})

const session = makeSession({ status: 'playing' })

function renderShell(overrides: { onEndGame?: () => void; onOpenHelp?: () => void } = {}) {
  return render(
    <HudShell
      session={session}
      onEndGame={overrides.onEndGame ?? (() => {})}
      onOpenHelp={overrides.onOpenHelp ?? (() => {})}
    >
      <div />
    </HudShell>,
  )
}

describe('HudShell — focus management on mount (C-3a)', () => {
  it('moves focus to the HUD region on mount', () => {
    renderShell()
    // Flush the rAF that defers the focus call.
    vi.advanceTimersByTime(50)
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Game HUD' }))
  })

  it('region has tabIndex=-1 (programmatically focusable, not a tab stop) and suppresses the focus outline', () => {
    renderShell()
    const region = screen.getByRole('region', { name: 'Game HUD' })
    expect(region.getAttribute('tabIndex')).toBe('-1')
    expect(region.className).toContain('focus:outline-none')
  })
})

describe('HudShell — re-openable help (C-6)', () => {
  it('renders the "How to play" fitted button and forwards clicks to onOpenHelp', () => {
    const onOpenHelp = vi.fn()
    renderShell({ onOpenHelp })
    const help = screen.getByTestId('game-help')
    expect(help.getAttribute('aria-label')).toBe('How to play')
    fireEvent.click(help)
    expect(onOpenHelp).toHaveBeenCalledTimes(1)
  })
})
