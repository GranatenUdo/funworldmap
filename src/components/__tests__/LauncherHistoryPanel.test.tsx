import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode, ReactElement } from 'react'
import { LauncherHistoryPanel } from '../LauncherHistoryPanel'
import { __resetForTests as resetHistoryStore } from '../../game/daily/historyStore'
import { DailyPuzzlesContext } from '../../game/daily/DailyPuzzlesProvider'

const stubPuzzlesValue = {
  status: 'ready' as const,
  index: null,
  byDate: () => null,
  refetch: async () => {},
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <DailyPuzzlesContext.Provider value={stubPuzzlesValue}>{children}</DailyPuzzlesContext.Provider>
  )
}

function renderPanel(ui: ReactElement) {
  return render(ui, { wrapper: Wrapper })
}

function seedHistory(today: string) {
  localStorage.setItem(
    'funworldmap-daily-history',
    JSON.stringify({
      version: 1,
      streak: { current: 1, longest: 1, lastActiveDate: today, lastMilestoneShown: 0 },
      days: { [today]: { 'country-pinning': { score: 87, attempts: [], completedAt: 1 } } },
    }),
  )
  resetHistoryStore()
}

describe('LauncherHistoryPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    resetHistoryStore()
  })
  afterEach(() => {
    localStorage.clear()
    resetHistoryStore()
  })

  it('renders a grid of 35 cells', () => {
    const onClose = vi.fn()
    const onCellActivate = vi.fn()
    renderPanel(
      <LauncherHistoryPanel
        today="2026-04-22"
        countries={[]}
        cities={[]}
        onClose={onClose}
        onCellActivate={onCellActivate}
      />,
    )
    const cells = screen.getAllByRole('gridcell')
    expect(cells).toHaveLength(35)
  })

  it('shows streak captions', () => {
    seedHistory('2026-04-22')
    const onClose = vi.fn()
    const onCellActivate = vi.fn()
    renderPanel(
      <LauncherHistoryPanel
        today="2026-04-22"
        countries={[]}
        cities={[]}
        onClose={onClose}
        onCellActivate={onCellActivate}
      />,
    )
    const captions = screen.getByTestId('launcher-history-captions')
    const text = captions.textContent ?? ''
    expect(text).toMatch(/current[^\d]*1/i)
    expect(text).toMatch(/days played[^\d]*1/i)
  })

  it('activating a cell fires onCellActivate with the date + kind', () => {
    seedHistory('2026-04-22')
    const onClose = vi.fn()
    const onCellActivate = vi.fn()
    renderPanel(
      <LauncherHistoryPanel
        today="2026-04-22"
        countries={[]}
        cities={[]}
        onClose={onClose}
        onCellActivate={onCellActivate}
      />,
    )
    fireEvent.click(screen.getByTestId('launcher-cal-2026-04-22'))
    expect(onCellActivate).toHaveBeenCalledWith('2026-04-22', 'played')
  })

  it('close button fires onClose', () => {
    const onClose = vi.fn()
    const onCellActivate = vi.fn()
    renderPanel(
      <LauncherHistoryPanel
        today="2026-04-22"
        countries={[]}
        cities={[]}
        onClose={onClose}
        onCellActivate={onCellActivate}
      />,
    )
    fireEvent.click(screen.getByTestId('launcher-history-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders spelled-out day headers (desktop) and single-letter headers (mobile)', () => {
    renderPanel(
      <LauncherHistoryPanel
        today="2026-05-17"
        countries={[]}
        cities={[]}
        onClose={() => {}}
        onCellActivate={vi.fn()}
      />,
    )
    expect(screen.getByTestId('dow-row-full')).toBeTruthy()
    expect(screen.getByTestId('dow-row-mobile')).toBeTruthy()
    expect(screen.getByText('Mon')).toBeTruthy()
    expect(screen.getByText('Sun')).toBeTruthy()
  })
})
