import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LauncherModeCard } from '../LauncherModeCard'

const baseBest = { bestScore: 432, bestStreak: 5, gamesPlayed: 3 }

describe('LauncherModeCard', () => {
  it('country-pinning best is shown without /1000 denominator', () => {
    render(<LauncherModeCard modeId="country-pinning" todayDate="2026-05-02" state="unplayed" freeBest={baseBest} onStartDaily={() => {}} onStartFree={() => {}} />)
    expect(screen.getByTestId('launcher-card-country-pinning-free-best').textContent).toMatch(/432\s*pts/)
    expect(screen.getByTestId('launcher-card-country-pinning-free-best').textContent).not.toContain('/ 1000')
  })

  it('city-guessing best keeps the /1000 denominator', () => {
    render(<LauncherModeCard modeId="city-guessing" todayDate="2026-05-02" state="unplayed" freeBest={baseBest} onStartDaily={() => {}} onStartFree={() => {}} />)
    expect(screen.getByTestId('launcher-card-city-guessing-free-best').textContent).toMatch(/432\s*\/\s*1000/)
  })

  it("past-unplayed state renders 'See reveal' CTA, not Play", () => {
    render(<LauncherModeCard modeId="country-pinning" anchorDate="2026-04-25" todayDate="2026-05-02" state="past-unplayed" freeBest={baseBest} onStartDaily={() => {}} onStartFree={() => {}} onSeeReveal={() => {}} />)
    expect(screen.queryByText(/Play\s*·\s*3 attempts/)).toBeNull()
    expect(screen.getByTestId('launcher-card-country-pinning-see-reveal')).toBeTruthy()
  })
})
