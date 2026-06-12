/**
 * Approach note: the plan offered two options for the characterization phase —
 * (a) render <GameController> in providers, or (b) use renderHook against the
 * isolated hook. Option (b) was chosen because GameController's useMap() call
 * requires <MapProvider>, which creates a maplibre-gl ref; while the ref itself
 * never calls into the GL library at construction time, the GameController body
 * also calls into several mapRef.current branches that can throw in JSDOM if the
 * guard isn't perfect. Adding workaround mocks for maplibre-gl
 * would diverge significantly from all other unit tests in this repo, which
 * avoid rendering full-page orchestrators. The renderHook tests below exercise
 * the same window-registration contract the e2e suite depends on, and the e2e
 * suite itself is the loudest regression signal for the seam's wiring.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, cleanup, act } from '@testing-library/react'
import { useRef } from 'react'
import { useGameTestSeams, type UseGameTestSeamsArgs } from '../useGameTestSeams'
import { makeSession } from '../../shared/__tests__/factories'
import { citiesFixture, byCca3Fixture } from './fixtures'
import type { GameMode, GuessInput } from '../../shared/types'

function makeMode(overrides: Partial<GameMode> = {}): GameMode {
  return {
    id: 'country-pinning',
    maxRounds: null,
    HudComponent: () => null,
    nextRound: () => ({
      kind: 'country-pinning',
      targetCca3: 'USA',
      targetName: 'United States',
      targetFlag: 'flags/US.svg',
      targetCentroid: [-97, 38],
    }),
    onGuess: () => ({
      pointsEarned: 100,
      livesDelta: 0,
      reveal: {
        kind: 'country',
        correct: true,
        targetCca3: 'USA',
        clickedCca3: 'USA',
        clickedName: 'United States',
        distanceKm: 0,
      },
    }),
    ...overrides,
  }
}

interface BuildArgs {
  submitGuessInput?: UseGameTestSeamsArgs['submitGuessInput']
  start?: UseGameTestSeamsArgs['start']
  overrideRound?: UseGameTestSeamsArgs['overrideRound']
  modeId?: 'country-pinning' | 'city-guessing'
  status?: 'idle' | 'playing' | 'round-ended' | 'game-over'
  mode?: GameMode | null
}

type SeamArgs = Omit<UseGameTestSeamsArgs, 'statusRef'>

function buildTestSeamArgs(overrides: BuildArgs = {}): SeamArgs {
  const {
    submitGuessInput = vi.fn(),
    start = vi.fn(),
    overrideRound = vi.fn(),
    modeId = 'country-pinning',
    status = 'idle',
    mode = makeMode(),
  } = overrides
  return {
    session: makeSession({ modeId, status }),
    mode,
    byCca3: byCca3Fixture,
    cities: citiesFixture,
    start,
    overrideRound,
    submitGuessInput,
  }
}

function renderSeamHook(args: SeamArgs) {
  return renderHook(() => {
    const statusRef = useRef(args.session.status)
    useGameTestSeams({ ...args, statusRef })
  })
}

describe('useGameTestSeams', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_TEST_HOOKS', '1')
    delete window.__funworldmap_game
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    delete window.__funworldmap_game
  })

  it('registers submitGuess, submitCountryGuess, setRound on window when VITE_TEST_HOOKS=1', () => {
    renderSeamHook(buildTestSeamArgs())
    expect(window.__funworldmap_game).toBeDefined()
    expect(typeof window.__funworldmap_game!.submitGuess).toBe('function')
    expect(typeof window.__funworldmap_game!.submitCountryGuess).toBe('function')
    expect(typeof window.__funworldmap_game!.setRound).toBe('function')
  })

  it('does NOT register seams when VITE_TEST_HOOKS is unset', () => {
    vi.stubEnv('VITE_TEST_HOOKS', '')
    renderSeamHook(buildTestSeamArgs())
    expect(window.__funworldmap_game?.submitGuess).toBeUndefined()
  })

  it('cleans up seam keys on unmount', () => {
    const { unmount } = renderSeamHook(buildTestSeamArgs())
    expect(window.__funworldmap_game!.submitGuess).toBeDefined()
    unmount()
    expect(window.__funworldmap_game!.submitGuess).toBeUndefined()
    expect(window.__funworldmap_game!.submitCountryGuess).toBeUndefined()
    expect(window.__funworldmap_game!.setRound).toBeUndefined()
  })

  it('submitCountryGuess returns false when modeId is not country-pinning', () => {
    renderSeamHook(buildTestSeamArgs({ modeId: 'city-guessing' }))
    const result = (window.__funworldmap_game!.submitCountryGuess as (s: string) => boolean)('USA')
    expect(result).toBe(false)
  })

  it('setRound returns false when mode is null', () => {
    renderSeamHook(buildTestSeamArgs({ mode: null }))
    const result = (window.__funworldmap_game!.setRound as (s: string) => boolean)('USA')
    expect(result).toBe(false)
  })

  it('submitCountryGuess dispatches a country input via submitGuessInput', () => {
    const submitGuessInput = vi.fn()
    renderSeamHook(buildTestSeamArgs({ submitGuessInput }))
    const result = (window.__funworldmap_game!.submitCountryGuess as (s: string) => boolean)('USA')
    expect(result).toBe(true)
    expect(submitGuessInput).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'country', cca3: 'USA' }),
    )
  })

  it('submitCountryGuess accepts lowercase cca3 and normalises to uppercase', () => {
    const submitGuessInput = vi.fn()
    renderSeamHook(buildTestSeamArgs({ submitGuessInput }))
    const result = (window.__funworldmap_game!.submitCountryGuess as (s: string) => boolean)('fra')
    expect(result).toBe(true)
    expect(submitGuessInput).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'country', cca3: 'FRA' }),
    )
  })

  it('setRound calls start() when status is idle', () => {
    const start = vi.fn()
    renderSeamHook(buildTestSeamArgs({ start, status: 'idle' }))
    const result = (window.__funworldmap_game!.setRound as (s: string) => boolean)('USA')
    expect(result).toBe(true)
    expect(start).toHaveBeenCalled()
  })

  it('setRound calls overrideRound() when status is playing', () => {
    const overrideRound = vi.fn()
    renderSeamHook(buildTestSeamArgs({ overrideRound, status: 'playing' }))
    const result = (window.__funworldmap_game!.setRound as (s: string) => boolean)('USA')
    expect(result).toBe(true)
    expect(overrideRound).toHaveBeenCalled()
  })

  it('setRound returns false when country cca3 is not found in byCca3', () => {
    renderSeamHook(buildTestSeamArgs())
    const result = (window.__funworldmap_game!.setRound as (s: string) => boolean)('ZZZ')
    expect(result).toBe(false)
  })

  it('setRound for city-guessing mode looks up city by id', () => {
    const start = vi.fn()
    const cityMode = makeMode({ id: 'city-guessing' })
    renderSeamHook(
      buildTestSeamArgs({ start, modeId: 'city-guessing', status: 'idle', mode: cityMode }),
    )
    const result = (window.__funworldmap_game!.setRound as (s: string) => boolean)('FRA-paris')
    expect(result).toBe(true)
    expect(start).toHaveBeenCalledWith(
      'city-guessing',
      expect.objectContaining({ kind: 'city-guessing', targetId: 'FRA-paris' }),
      cityMode.maxRounds,
    )
  })

  it('submitGuess forwards the input to submitGuessInput', () => {
    const submitGuessInput = vi.fn()
    renderSeamHook(buildTestSeamArgs({ submitGuessInput }))
    const input: GuessInput = { kind: 'skip' }
    act(() => {
      ;(window.__funworldmap_game!.submitGuess as (i: GuessInput) => void)(input)
    })
    expect(submitGuessInput).toHaveBeenCalledWith(input)
  })
})
