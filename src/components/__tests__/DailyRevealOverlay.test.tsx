import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DailyRevealOverlay } from '../DailyRevealOverlay'
import { __resetForTests as resetHistoryStore, setHistory } from '../../game/daily/historyStore'
import type { CountryLike, CityLike } from '../../game/shared/types'
import type { DailyPuzzleRef } from '../../game/daily/types'

const countries: CountryLike[] = [
  {
    cca3: 'FRA',
    name: { common: 'France' },
    flag: 'flags/FR.svg',
    latlng: [46, 2],
    independent: true,
  },
]
const cities: CityLike[] = [
  {
    id: 'FR-paris',
    name: 'Paris',
    countryCca3: 'FRA',
    countryName: 'France',
    countryFlag: 'flags/FR.svg',
    latlng: [48.85, 2.35],
    scalerank: 1,
  },
]
const puzzle: DailyPuzzleRef = { country: { cca3: 'FRA' }, city: { id: 'FR-paris' } }

describe('DailyRevealOverlay spoiler gate', () => {
  beforeEach(() => {
    resetHistoryStore()
    cleanup()
  })

  it('today + unplayed: country headline hidden', () => {
    render(
      <DailyRevealOverlay
        date="2026-05-02"
        today="2026-05-02"
        modeId={null}
        puzzle={puzzle}
        countries={countries}
        cities={cities}
        onClose={() => {}}
        onPlayUnlimited={() => {}}
      />,
    )
    expect(screen.queryByText('France')).toBeNull()
    expect(screen.getAllByText(/Finish today's daily/i).length).toBeGreaterThan(0)
  })

  it('today + played country: country headline rendered', () => {
    setHistory((p) => ({
      ...p,
      days: {
        ...p.days,
        '2026-05-02': { 'country-pinning': { score: 80, attempts: [], completedAt: 0 } },
      },
    }))
    render(
      <DailyRevealOverlay
        date="2026-05-02"
        today="2026-05-02"
        modeId={null}
        puzzle={puzzle}
        countries={countries}
        cities={cities}
        onClose={() => {}}
        onPlayUnlimited={() => {}}
      />,
    )
    expect(screen.getByText('France')).toBeTruthy()
  })

  it('past + unplayed: headline rendered (past days are inert)', () => {
    render(
      <DailyRevealOverlay
        date="2026-04-25"
        today="2026-05-02"
        modeId={null}
        puzzle={puzzle}
        countries={countries}
        cities={cities}
        onClose={() => {}}
        onPlayUnlimited={() => {}}
      />,
    )
    expect(screen.getByText('France')).toBeTruthy()
  })
})

describe('DailyRevealOverlay play-unlimited CTA', () => {
  beforeEach(() => {
    resetHistoryStore()
    cleanup()
  })

  it('renders the "Play unlimited rounds" button', () => {
    render(
      <DailyRevealOverlay
        date="2026-05-02"
        today="2026-05-02"
        modeId="city-guessing"
        puzzle={puzzle}
        countries={countries}
        cities={cities}
        onClose={() => {}}
        onPlayUnlimited={() => {}}
      />,
    )
    const btn = screen.getByTestId('daily-reveal-play-unlimited')
    expect(btn.textContent).toBe('Play unlimited rounds')
  })

  it('clicking the Play unlimited button calls onPlayUnlimited', () => {
    const onPlayUnlimited = vi.fn()
    render(
      <DailyRevealOverlay
        date="2026-05-02"
        today="2026-05-02"
        modeId="city-guessing"
        puzzle={puzzle}
        countries={countries}
        cities={cities}
        onClose={() => {}}
        onPlayUnlimited={onPlayUnlimited}
      />,
    )
    screen.getByTestId('daily-reveal-play-unlimited').click()
    expect(onPlayUnlimited).toHaveBeenCalledTimes(1)
  })

  it('initial focus lands on the Play unlimited button, not Close', () => {
    render(
      <DailyRevealOverlay
        date="2026-05-02"
        today="2026-05-02"
        modeId="city-guessing"
        puzzle={puzzle}
        countries={countries}
        cities={cities}
        onClose={() => {}}
        onPlayUnlimited={() => {}}
      />,
    )
    const btn = screen.getByTestId('daily-reveal-play-unlimited')
    expect(document.activeElement).toBe(btn)
  })

  it('clicking Close calls onClose, not onPlayUnlimited', () => {
    const onClose = vi.fn()
    const onPlayUnlimited = vi.fn()
    render(
      <DailyRevealOverlay
        date="2026-05-02"
        today="2026-05-02"
        modeId="city-guessing"
        puzzle={puzzle}
        countries={countries}
        cities={cities}
        onClose={onClose}
        onPlayUnlimited={onPlayUnlimited}
      />,
    )
    screen.getByTestId('daily-reveal-close').click()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPlayUnlimited).not.toHaveBeenCalled()
  })
})
