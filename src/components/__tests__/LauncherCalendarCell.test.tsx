import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LauncherCalendarCell } from '../LauncherCalendarCell'
import type { CellMemory } from '../LauncherHistoryPanel'

describe('LauncherCalendarCell', () => {
  it('renders a title tooltip with country + city memory when both are provided', () => {
    const memory: CellMemory = {
      country: { name: 'France', score: 87 },
      city: { name: 'Paris', score: 760 },
    }
    render(
      <LauncherCalendarCell
        date="2026-05-15"
        status="in-window"
        playedModes={new Set(['country-pinning', 'city-guessing'])}
        memory={memory}
        onActivate={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('launcher-cal-2026-05-15')
    expect(btn.getAttribute('title')).toBe('France 87/100 · Paris 760/1000')
  })

  it('renders a title tooltip with only country memory when city is unplayed', () => {
    const memory: CellMemory = {
      country: { name: 'France', score: 87 },
    }
    render(
      <LauncherCalendarCell
        date="2026-05-15"
        status="in-window"
        playedModes={new Set(['country-pinning'])}
        memory={memory}
        onActivate={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('launcher-cal-2026-05-15')
    expect(btn.getAttribute('title')).toBe('France 87/100')
  })

  it('does not render title when memory is undefined', () => {
    render(
      <LauncherCalendarCell
        date="2026-05-15"
        status="in-window"
        playedModes={new Set()}
        memory={undefined}
        onActivate={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('launcher-cal-2026-05-15')
    expect(btn.getAttribute('title')).toBeNull()
  })
})
