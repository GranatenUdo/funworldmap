import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LauncherModeCard } from '../LauncherModeCard'

const baseBest = { bestScore: 432, bestStreak: 5, gamesPlayed: 3 }

const defaultProps = {
  modeId: 'country-pinning' as const,
  todayDate: '2026-05-17',
  freeBest: baseBest,
  onStartDaily: () => {},
  onStartFree: () => {},
}

describe('LauncherModeCard', () => {
  it('country-pinning best is shown without /1000 denominator', () => {
    render(
      <LauncherModeCard
        modeId="country-pinning"
        todayDate="2026-05-02"
        state="unplayed"
        freeBest={baseBest}
        onStartDaily={() => {}}
        onStartFree={() => {}}
      />,
    )
    expect(screen.getByTestId('launcher-card-country-pinning-free-best').textContent).toMatch(
      /432\s*pts/,
    )
    expect(screen.getByTestId('launcher-card-country-pinning-free-best').textContent).not.toContain(
      '/ 1000',
    )
  })

  it('city-guessing best keeps the /1000 denominator', () => {
    render(
      <LauncherModeCard
        modeId="city-guessing"
        todayDate="2026-05-02"
        state="unplayed"
        freeBest={baseBest}
        onStartDaily={() => {}}
        onStartFree={() => {}}
      />,
    )
    expect(screen.getByTestId('launcher-card-city-guessing-free-best').textContent).toMatch(
      /432\s*\/\s*1000/,
    )
  })

  it("past-unplayed state renders 'See reveal' CTA, not Play", () => {
    render(
      <LauncherModeCard
        modeId="country-pinning"
        anchorDate="2026-04-25"
        todayDate="2026-05-02"
        state="past-unplayed"
        freeBest={baseBest}
        onStartDaily={() => {}}
        onStartFree={() => {}}
        onSeeReveal={() => {}}
      />,
    )
    expect(screen.queryByText(/Play\s*·\s*3 attempts/)).toBeNull()
    expect(screen.getByTestId('launcher-card-country-pinning-see-reveal')).toBeTruthy()
  })

  it("loading state renders 'Loading…' copy", () => {
    render(
      <LauncherModeCard
        modeId="country-pinning"
        todayDate="2026-05-02"
        state="loading"
        freeBest={baseBest}
        onStartDaily={() => {}}
        onStartFree={() => {}}
      />,
    )
    expect(screen.getByTestId('launcher-card-country-pinning-loading').textContent).toMatch(
      /Loading/,
    )
    expect(screen.queryByTestId('launcher-card-country-pinning-error')).toBeNull()
    expect(screen.queryByTestId('launcher-card-country-pinning-no-puzzle')).toBeNull()
  })

  it("unavailable-error state renders 'Couldn't load' copy", () => {
    render(
      <LauncherModeCard
        modeId="country-pinning"
        todayDate="2026-05-02"
        state="unavailable-error"
        freeBest={baseBest}
        onStartDaily={() => {}}
        onStartFree={() => {}}
      />,
    )
    expect(screen.getByTestId('launcher-card-country-pinning-error').textContent).toMatch(
      /Couldn’t load/,
    )
    expect(screen.queryByTestId('launcher-card-country-pinning-loading')).toBeNull()
  })

  it("no-puzzle-today state renders 'not ready yet' copy without link when no latestAvailableDate", () => {
    render(
      <LauncherModeCard
        modeId="country-pinning"
        todayDate="2026-05-02"
        state="no-puzzle-today"
        freeBest={baseBest}
        onStartDaily={() => {}}
        onStartFree={() => {}}
      />,
    )
    expect(screen.getByTestId('launcher-card-country-pinning-no-puzzle').textContent).toMatch(
      /isn't ready yet/,
    )
    expect(screen.queryByTestId('launcher-card-country-pinning-no-puzzle-link')).toBeNull()
  })

  it("no-puzzle-today state renders 'try [date]' link when latestAvailableDate is provided", () => {
    render(
      <LauncherModeCard
        modeId="country-pinning"
        todayDate="2026-05-02"
        state="no-puzzle-today"
        latestAvailableDate="2026-05-01"
        freeBest={baseBest}
        onStartDaily={() => {}}
        onStartFree={() => {}}
      />,
    )
    const link = screen.getByTestId('launcher-card-country-pinning-no-puzzle-link')
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('#daily/2026-05-01/reveal')
    expect(link.textContent).toMatch(/May 1/)
  })

  it("no-puzzle-today state shows 'no longer available' copy when deep-linked to rolled-off date", () => {
    render(
      <LauncherModeCard
        modeId="country-pinning"
        anchorDate="2026-04-15"
        todayDate="2026-05-02"
        state="no-puzzle-today"
        latestAvailableDate="2026-05-01"
        freeBest={baseBest}
        onStartDaily={() => {}}
        onStartFree={() => {}}
      />,
    )
    expect(screen.getByTestId('launcher-card-country-pinning-no-puzzle').textContent).toMatch(
      /no longer available/,
    )
    expect(screen.getByTestId('launcher-card-country-pinning-no-puzzle').textContent).not.toMatch(
      /isn't ready yet/,
    )
  })

  it("no-puzzle-today state shows 'not ready yet' copy when on today (no anchorDate)", () => {
    render(
      <LauncherModeCard
        modeId="country-pinning"
        todayDate="2026-05-02"
        state="no-puzzle-today"
        latestAvailableDate="2026-05-01"
        freeBest={baseBest}
        onStartDaily={() => {}}
        onStartFree={() => {}}
      />,
    )
    expect(screen.getByTestId('launcher-card-country-pinning-no-puzzle').textContent).toMatch(
      /isn't ready yet/,
    )
    expect(screen.getByTestId('launcher-card-country-pinning-no-puzzle').textContent).not.toMatch(
      /no longer available/,
    )
  })

  it("no-puzzle-today state shows 'not ready yet' copy when anchorDate equals todayDate", () => {
    render(
      <LauncherModeCard
        modeId="country-pinning"
        anchorDate="2026-05-02"
        todayDate="2026-05-02"
        state="no-puzzle-today"
        latestAvailableDate="2026-05-01"
        freeBest={baseBest}
        onStartDaily={() => {}}
        onStartFree={() => {}}
      />,
    )
    expect(screen.getByTestId('launcher-card-country-pinning-no-puzzle').textContent).toMatch(
      /isn't ready yet/,
    )
    expect(screen.getByTestId('launcher-card-country-pinning-no-puzzle').textContent).not.toMatch(
      /no longer available/,
    )
  })

  it('shows the country title with subtitle copy', () => {
    render(
      <LauncherModeCard
        modeId="country-pinning"
        todayDate="2026-05-02"
        state="unplayed"
        freeBest={baseBest}
        onStartDaily={() => {}}
        onStartFree={() => {}}
      />,
    )
    expect(screen.getByText('Country')).toBeTruthy()
    expect(screen.getByText(/Click the right country on the map/)).toBeTruthy()
  })

  it('shows the city title with subtitle copy', () => {
    render(
      <LauncherModeCard
        modeId="city-guessing"
        todayDate="2026-05-02"
        state="unplayed"
        freeBest={baseBest}
        onStartDaily={() => {}}
        onStartFree={() => {}}
      />,
    )
    expect(screen.getByText('City')).toBeTruthy()
    expect(screen.getByText(/Pin where the city is/)).toBeTruthy()
  })

  it('does not render the eyebrow label for today', () => {
    render(
      <LauncherModeCard
        modeId="country-pinning"
        anchorDate={undefined}
        todayDate="2026-05-17"
        state="unplayed"
        freeBest={baseBest}
        onStartDaily={() => {}}
        onStartFree={() => {}}
      />,
    )
    expect(screen.queryByText('TODAY · COUNTRY')).toBeNull()
    expect(screen.queryByText('TODAY · CITY')).toBeNull()
  })

  it('renders the eyebrow as the bare date for past days', () => {
    render(
      <LauncherModeCard
        modeId="country-pinning"
        anchorDate="2026-05-16"
        todayDate="2026-05-17"
        state="past-unplayed"
        freeBest={baseBest}
        onStartDaily={() => {}}
        onStartFree={() => {}}
        onSeeReveal={() => {}}
      />,
    )
    expect(screen.getByText(/MAY 16/)).toBeTruthy()
    expect(screen.queryByText(/COUNTRY/)).toBeNull()
  })

  it('renders the Play button with caption', () => {
    render(<LauncherModeCard {...defaultProps} state="unplayed" />)
    const btn = screen.getByTestId('launcher-card-country-pinning-daily-cta')
    expect(btn.textContent).toBe('Play')
    expect(btn.textContent).not.toContain('3 attempts')
    expect(screen.getByText('3 tries · best one counts')).toBeTruthy()
  })

  it('renders Retry button in unavailable-error state', () => {
    const onRetry = vi.fn()
    render(<LauncherModeCard {...defaultProps} state="unavailable-error" onRetry={onRetry} />)
    expect(screen.getByText('Couldn’t load today’s puzzle.')).toBeTruthy()
    expect(screen.queryByText(/Refresh to retry/)).toBeNull()
    const btn = screen.getByTestId('launcher-card-country-pinning-retry')
    btn.click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('no longer renders the per-card free-mode link', () => {
    render(<LauncherModeCard {...defaultProps} state="unplayed" />)
    expect(screen.queryByTestId('launcher-card-country-pinning-free-link')).toBeNull()
  })
})
