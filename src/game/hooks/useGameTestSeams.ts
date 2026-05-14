import { useEffect, type RefObject } from 'react'
import type { CityLike, CountryLike, GameMode, GameSession, GuessInput, ModeId, RoundSpec } from '../shared/types'
import { centroidFromLatLng } from '../shared/distance'

export interface UseGameTestSeamsArgs {
  session: GameSession
  mode: GameMode | null
  byCca3: Map<string, CountryLike>
  cities: CityLike[]
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null, attemptsPerRound?: number, dailyDate?: string | null) => void
  overrideRound: (round: RoundSpec) => void
  submitGuessInput: (input: GuessInput) => void
  /** Synchronous mirror of session.status (provided by useHashGameRouter once Phase 5 lands; until then, plumbed from GameController). */
  statusRef: RefObject<GameSession['status']>
}

/**
 * Registers `window.__funworldmap_game.{submitGuess,submitCountryGuess,setRound}`
 * when `VITE_TEST_HOOKS=1`. Both `submitGuess` and `submitCountryGuess` exist
 * for e2e backward-compat — the names predate the collapsed `attempt` action
 * and are still referenced by the Playwright suite.
 */
export function useGameTestSeams({
  session, mode, byCca3, cities, start, overrideRound, submitGuessInput, statusRef,
}: UseGameTestSeamsArgs): void {
  useEffect(() => {
    if (!import.meta.env.VITE_TEST_HOOKS) return
    const w = window as unknown as { __funworldmap_game?: Record<string, unknown> }
    if (!w.__funworldmap_game) w.__funworldmap_game = {}
    w.__funworldmap_game.submitGuess = (input: GuessInput) => submitGuessInput(input)
    w.__funworldmap_game.submitCountryGuess = (cca3: string): boolean => {
      if (session.modeId !== 'country-pinning') return false
      const country = byCca3.get(cca3.toUpperCase())
      if (!country) return false
      submitGuessInput({
        kind: 'country',
        cca3: cca3.toUpperCase(),
        name: country.name.common,
        centroid: centroidFromLatLng(country.latlng),
      })
      return true
    }
    w.__funworldmap_game.setRound = (id: string): boolean => {
      if (!mode) return false
      let round: RoundSpec | null = null
      if (session.modeId === 'country-pinning') {
        const country = byCca3.get(id.toUpperCase())
        if (!country) return false
        round = {
          kind: 'country-pinning',
          targetCca3: country.cca3,
          targetName: country.name.common,
          targetFlag: country.flag,
          targetCentroid: centroidFromLatLng(country.latlng),
        }
      } else {
        const city = cities.find((c) => c.id === id)
        if (!city) return false
        round = {
          kind: 'city-guessing',
          targetId: city.id,
          targetName: city.name,
          targetCountryName: city.countryName,
          targetCountryFlag: city.countryFlag,
          targetCentroid: centroidFromLatLng(city.latlng),
        }
      }
      if (statusRef.current === 'idle') {
        start(session.modeId, round, mode.maxRounds)
      } else {
        overrideRound(round)
      }
      return true
    }
    return () => {
      if (w.__funworldmap_game) {
        delete w.__funworldmap_game.submitGuess
        delete w.__funworldmap_game.submitCountryGuess
        delete w.__funworldmap_game.setRound
      }
    }
  }, [mode, session.modeId, byCca3, cities, start, overrideRound, submitGuessInput, statusRef])
}
