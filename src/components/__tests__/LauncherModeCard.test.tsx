import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LauncherModeCard } from '../LauncherModeCard'

const defaultProps = {
  modeId: 'country-pinning' as const,
  todayDate: '2026-05-17',
  onStartDaily: () => {},
  onStartFree: () => {},
}

describe('LauncherModeCard', () => {
  it('country-pinning does not render a free-best testid', () => {
    render(
      <LauncherModeCard
        modeId="country-pinning"
        todayDate="2026-05-02"
        state="unplayed"
        onStartDaily={() => {}}
        onStartFree={() => {}}
      />,
    )
    expect(screen.queryByTestId('launcher-card-country-pinning-free-best')).toBeNull()
  })

  it('city-guessing does not render a free-best testid', () => {
    render(
      <LauncherModeCard
        modeId="city-guessing"
        todayDate="2026-05-02"
        state="unplayed"
        onStartDaily={() => {}}
        onStartFree={() => {}}
      />,
    )
    expect(screen.queryByTestId('launcher-card-city-guessing-free-best')).toBeNull()
  })

  it("past-unplayed state renders 'See reveal' CTA, not Play", () => {
    render(
      <LauncherModeCard
        modeId="country-pinning"
        anchorDate="2026-04-25"
        todayDate="2026-05-02"
        state="past-unplayed"
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

  it('does not render the Best (free) footer', () => {
    render(<LauncherModeCard {...defaultProps} state="unplayed" />)
    expect(screen.queryByText(/Best \(free\)/i)).toBeNull()
    expect(screen.queryByText(/Unlimited best/i)).toBeNull()
    expect(screen.queryByTestId('launcher-card-country-pinning-free-best')).toBeNull()
  })

  it('renders played state as a single full-width See reveal button with score', () => {
    render(
      <LauncherModeCard
        {...defaultProps}
        state="played"
        played={{ targetName: 'France', score: 87 }}
        onSeeReveal={vi.fn()}
      />,
    )
    const btn = screen.getByTestId('launcher-card-country-pinning-see-reveal')
    expect(btn.textContent).toMatch(/✓\s*87\s*\/\s*100\s*·\s*See reveal/)
    // The old "✓ France · 87/100" text line should be gone (consolidated into the button)
    expect(screen.queryByText(/France · 87/)).toBeNull()
  })
})
