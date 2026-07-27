import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { LauncherModeCard } from '../LauncherModeCard'
import { record, __resetForTests } from '../../game/shared/personalBestsStore'

afterEach(() => {
  cleanup()
  __resetForTests()
  localStorage.clear()
})

describe('LauncherModeCard (free-play)', () => {
  it('shows the mode title and a Play button that calls onPlay', () => {
    const onPlay = vi.fn()
    render(<LauncherModeCard modeId="country-pinning" onPlay={onPlay} />)
    expect(screen.getByText('Country')).toBeTruthy()
    screen.getByTestId('launcher-card-country-pinning-play').click()
    expect(onPlay).toHaveBeenCalledTimes(1)
  })

  it('shows the fresh-player state when no games have been played', () => {
    render(<LauncherModeCard modeId="city-guessing" onPlay={vi.fn()} />)
    expect(screen.getByTestId('launcher-card-city-guessing-best').textContent).toMatch(
      /no games yet/i,
    )
  })

  it('shows the personal best once games are recorded', () => {
    record('country-pinning', 1240, 31)
    render(<LauncherModeCard modeId="country-pinning" onPlay={vi.fn()} />)
    const best = screen.getByTestId('launcher-card-country-pinning-best').textContent ?? ''
    expect(best).toMatch(/1,?240/)
    expect(best).toMatch(/31/) // longest streak surfaced for country-pinning
  })

  it('shows the best score for city-guessing without a streak line', () => {
    record('city-guessing', 920, 0)
    render(<LauncherModeCard modeId="city-guessing" onPlay={vi.fn()} />)
    const best = screen.getByTestId('launcher-card-city-guessing-best').textContent ?? ''
    expect(best).toMatch(/920/)
    expect(best).not.toMatch(/streak/i) // streak is country-pinning only
  })

  it('shows only the games count when games were played but the best score is 0', () => {
    record('city-guessing', 0, 0)
    render(<LauncherModeCard modeId="city-guessing" onPlay={vi.fn()} />)
    const best = screen.getByTestId('launcher-card-city-guessing-best').textContent ?? ''
    expect(best).not.toMatch(/best/i) // no "Best 0 pts" noise
    expect(best).toMatch(/1 game played/)
  })
})
