import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameSession } from '../useGameSession'
import type {
  AttemptRecord,
  CityRoundSpec,
  CountryRoundSpec,
  GuessInput,
  ModeGuessResult,
} from '../types'

const round = (cca3: string): CountryRoundSpec => ({
  kind: 'country-pinning',
  targetCca3: cca3,
  targetName: cca3,
  targetFlag: `flags/${cca3}.svg`,
  targetCentroid: [0, 0],
})
const countryInput = (cca3: string): GuessInput => ({
  kind: 'country',
  cca3,
  name: cca3,
  centroid: [0, 0],
})
const exact = (cca3: string): ModeGuessResult => ({
  pointsEarned: 100,
  livesDelta: 0,
  reveal: {
    kind: 'country',
    correct: true,
    targetCca3: cca3,
    clickedCca3: cca3,
    clickedName: cca3,
    distanceKm: 0,
  },
})
const miss = (target: string, clicked: string, pts = 20): ModeGuessResult => ({
  pointsEarned: pts,
  livesDelta: -1,
  reveal: {
    kind: 'country',
    correct: false,
    targetCca3: target,
    clickedCca3: clicked,
    clickedName: clicked,
    distanceKm: 1000,
  },
})

describe('useGameSession (post-collapse)', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useGameSession())
    expect(result.current.session.status).toBe('idle')
    expect(result.current.session.lives).toBe(3)
    expect(result.current.session.maxRounds).toBeNull()
  })

  it('starts with dailyDate null (free / idle has no daily date)', () => {
    const { result } = renderHook(() => useGameSession())
    expect(result.current.session.dailyDate).toBeNull()
  })

  describe('start', () => {
    it('enters playing with attemptsPerRound default 1', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.attemptsPerRound).toBe(1)
      expect(result.current.session.attemptsRemaining).toBe(1)
    })

    it('accepts attemptsPerRound=3 for daily best-of-N', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3) })
      expect(result.current.session.attemptsPerRound).toBe(3)
      expect(result.current.session.attemptsRemaining).toBe(3)
    })

    it('rejects (no-op) the unsupported combo attemptsPerRound>1 + maxRounds=null', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null, 3) })
      expect(result.current.session.status).toBe('idle')
    })

    it('stores dailyDate when passed (daily play)', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3, '2026-04-27') })
      expect(result.current.session.dailyDate).toBe('2026-04-27')
    })

    it('defaults dailyDate to null when not passed (free play)', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      expect(result.current.session.dailyDate).toBeNull()
    })
  })

  describe('attempt — free-play (attemptsPerRound=1)', () => {
    it('correct guess ends the round with full points', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      act(() => { result.current.attempt(countryInput('FRA'), exact('FRA')) })
      expect(result.current.session.status).toBe('round-ended')
      expect(result.current.session.score).toBe(100)
      expect(result.current.session.lives).toBe(3)
      expect(result.current.session.streak).toBe(1)
      expect(result.current.session.lastOutcome?.reveal.kind).toBe('country')
      if (result.current.session.lastOutcome?.reveal.kind === 'country') {
        expect(result.current.session.lastOutcome.reveal.correct).toBe(true)
      }
    })

    it('wrong guess decrements lives and resets streak', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      act(() => { result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 20)) })
      expect(result.current.session.lives).toBe(2)
      expect(result.current.session.streak).toBe(0)
      expect(result.current.session.score).toBe(20)
    })

    it('lives reaching zero ends the game', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      act(() => { result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 0)) })
      act(() => { result.current.advance(round('GBR')) })
      act(() => { result.current.attempt(countryInput('ESP'), miss('GBR', 'ESP', 0)) })
      act(() => { result.current.advance(round('ITA')) })
      act(() => { result.current.attempt(countryInput('PRT'), miss('ITA', 'PRT', 0)) })
      expect(result.current.session.status).toBe('round-ended')
      act(() => { result.current.finalize() })
      expect(result.current.session.status).toBe('game-over')
    })
  })

  describe('attempt — daily best-of-3 (attemptsPerRound=3, maxRounds=1)', () => {
    it('first attempt records but does not end the round', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3) })
      act(() => { result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 20)) })
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.attemptsRemaining).toBe(2)
      expect(result.current.session.currentAttempts).toHaveLength(1)
      expect(result.current.session.lastOutcome).toBeNull()
    })

    it('three wrong attempts: lastOutcome.reveal matches the BEST attempt, not the final', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3) })
      act(() => { result.current.attempt(countryInput('ESP'), miss('FRA', 'ESP', 50)) })
      act(() => { result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 30)) })
      act(() => { result.current.attempt(countryInput('CHN'), miss('FRA', 'CHN', 5)) })
      expect(result.current.session.status).toBe('round-ended')
      act(() => { result.current.finalize() })
      expect(result.current.session.status).toBe('game-over')
      expect(result.current.session.score).toBe(50)
      expect(result.current.session.lastOutcome?.pointsEarned).toBe(50)
      // The reveal MUST point at ESP (the best wrong guess), not CHN (the final).
      if (result.current.session.lastOutcome?.reveal.kind === 'country') {
        expect(result.current.session.lastOutcome.reveal.clickedCca3).toBe('ESP')
      }
    })

    it('correct first attempt + two wrong: round ends only after attempt 3, but lastOutcome.reveal is the correct one', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3) })
      act(() => { result.current.attempt(countryInput('FRA'), exact('FRA')) })
      expect(result.current.session.status).toBe('playing')
      act(() => { result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 30)) })
      expect(result.current.session.status).toBe('playing')
      act(() => { result.current.attempt(countryInput('CHN'), miss('FRA', 'CHN', 5)) })
      expect(result.current.session.status).toBe('round-ended')
      act(() => { result.current.finalize() })
      expect(result.current.session.status).toBe('game-over')
      expect(result.current.session.score).toBe(100)
      if (result.current.session.lastOutcome?.reveal.kind === 'country') {
        expect(result.current.session.lastOutcome.reveal.correct).toBe(true)
        expect(result.current.session.lastOutcome.reveal.clickedCca3).toBe('FRA')
      }
    })

    it('lives are NOT decremented in best-of-N regardless of livesDelta', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3) })
      act(() => { result.current.attempt(countryInput('CHN'), miss('FRA', 'CHN', 0)) })
      act(() => { result.current.attempt(countryInput('IND'), miss('FRA', 'IND', 0)) })
      act(() => { result.current.attempt(countryInput('AUS'), miss('FRA', 'AUS', 0)) })
      expect(result.current.session.lives).toBe(3)
    })
  })

  describe('completeNow', () => {
    it('after one attempt: ends the round/game with that attempt as best', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3) })
      act(() => { result.current.attempt(countryInput('FRA'), exact('FRA')) })
      act(() => { result.current.completeNow() })
      expect(result.current.session.status).toBe('round-ended')
      act(() => { result.current.finalize() })
      expect(result.current.session.status).toBe('game-over')
      expect(result.current.session.score).toBe(100)
      expect(result.current.session.currentAttempts).toHaveLength(1)
    })

    it('with no attempts: no-op (status stays playing)', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3) })
      act(() => { result.current.completeNow() })
      expect(result.current.session.status).toBe('playing')
    })

    it('in free-play (status already non-playing after attempt): no-op', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      act(() => { result.current.attempt(countryInput('FRA'), exact('FRA')) })
      act(() => { result.current.completeNow() })
      expect(result.current.session.status).toBe('round-ended')
    })
  })

  describe('resume', () => {
    it('stores dailyDate from the resume payload', () => {
      const { result } = renderHook(() => useGameSession())
      const r = round('ESP')
      const attemptInput: AttemptRecord = {
        pointsEarned: 50,
        input: countryInput('USA'),
        reveal: { kind: 'country', correct: false, targetCca3: 'ESP', clickedCca3: 'USA', clickedName: 'USA', distanceKm: 9000 },
      }
      act(() => {
        result.current.resume({
          modeId: 'country-pinning',
          round: r,
          attemptsPerRound: 3,
          attempts: [attemptInput],
          dailyDate: '2026-04-27',
        })
      })
      expect(result.current.session.dailyDate).toBe('2026-04-27')
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.currentAttempts).toHaveLength(1)
      expect(result.current.session.attemptsRemaining).toBe(2)
    })

    it('reconstructs mid-attempt state from saved attempts', () => {
      const { result } = renderHook(() => useGameSession())
      const priorAttempt: AttemptRecord = {
        pointsEarned: 50,
        input: countryInput('ESP'),
        reveal: {
          kind: 'country',
          correct: false,
          targetCca3: 'FRA',
          clickedCca3: 'ESP',
          clickedName: 'ESP',
          distanceKm: 1000,
        },
      }
      act(() => {
        result.current.resume({
          modeId: 'country-pinning',
          round: round('FRA'),
          attemptsPerRound: 3,
          attempts: [priorAttempt],
          dailyDate: '2026-04-27',
        })
      })
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.attemptsRemaining).toBe(2)
      expect(result.current.session.currentAttempts).toHaveLength(1)
    })

    it('rejects (no-op) when attemptsPerRound <= 1', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.resume({
          modeId: 'country-pinning',
          round: round('FRA'),
          attemptsPerRound: 1,
          attempts: [],
          dailyDate: '2026-04-27',
        })
      })
      expect(result.current.session.status).toBe('idle')
    })

    it('rejects (no-op) when attempts already complete', () => {
      const { result } = renderHook(() => useGameSession())
      const a = (cca3: string): AttemptRecord => ({
        pointsEarned: 0,
        input: countryInput(cca3),
        reveal: {
          kind: 'country',
          correct: false,
          targetCca3: 'FRA',
          clickedCca3: cca3,
          clickedName: cca3,
          distanceKm: 1000,
        },
      })
      act(() => {
        result.current.resume({
          modeId: 'country-pinning',
          round: round('FRA'),
          attemptsPerRound: 3,
          attempts: [a('CHN'), a('IND'), a('AUS')],
          dailyDate: '2026-04-27',
        })
      })
      expect(result.current.session.status).toBe('idle')
    })
  })

  describe('advance', () => {
    it('resets attemptsRemaining to attemptsPerRound', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null, 1) })
      act(() => { result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 20)) })
      act(() => { result.current.advance(round('GBR')) })
      expect(result.current.session.attemptsRemaining).toBe(1)
      expect(result.current.session.currentAttempts).toEqual([])
      expect(result.current.session.lastOutcome).toBeNull()
    })
  })

  describe('endGame', () => {
    it('returns to idle from any playing state', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3) })
      act(() => { result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 20)) })
      act(() => { result.current.endGame() })
      expect(result.current.session.status).toBe('idle')
    })
  })

  describe('finishFree', () => {
    it('transitions playing → game-over for a free game, preserving score', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      act(() => { result.current.attempt(countryInput('USA'), miss('FRA', 'USA', 14)) })
      // After one wrong attempt in free play (attemptsPerRound=1), status is round-ended, score 14.
      expect(result.current.session.status).toBe('round-ended')
      expect(result.current.session.score).toBe(14)
      act(() => { result.current.finishFree() })
      expect(result.current.session.status).toBe('game-over')
      expect(result.current.session.score).toBe(14)
    })

    it('refuses on idle (no-op)', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.finishFree() })
      expect(result.current.session.status).toBe('idle')
    })

    it('refuses on a daily play (preserves abandon-semantic)', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3, '2026-04-27') })
      act(() => { result.current.finishFree() })
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.dailyDate).toBe('2026-04-27')
    })

    it('refuses on game-over (no-op)', () => {
      const { result } = renderHook(() => useGameSession())
      // Drive to game-over by losing 3 lives in free play
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      act(() => { result.current.attempt(countryInput('USA'), miss('FRA', 'USA')) })
      act(() => { result.current.advance(round('ESP')) })
      act(() => { result.current.attempt(countryInput('USA'), miss('ESP', 'USA')) })
      act(() => { result.current.advance(round('DEU')) })
      act(() => { result.current.attempt(countryInput('USA'), miss('DEU', 'USA')) })
      expect(result.current.session.status).toBe('round-ended')
      act(() => { result.current.finalize() })
      expect(result.current.session.status).toBe('game-over')
      const before = result.current.session
      act(() => { result.current.finishFree() })
      expect(result.current.session).toBe(before)
    })
  })

  describe('dailyDate preservation', () => {
    it('attempt preserves dailyDate', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3, '2026-04-27') })
      act(() => { result.current.attempt(countryInput('USA'), miss('FRA', 'USA')) })
      expect(result.current.session.dailyDate).toBe('2026-04-27')
    })

    it('completeNow preserves dailyDate', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3, '2026-04-27') })
      act(() => { result.current.attempt(countryInput('USA'), miss('FRA', 'USA')) })
      act(() => { result.current.completeNow() })
      expect(result.current.session.dailyDate).toBe('2026-04-27')
    })

    it('endGame resets dailyDate to null', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3, '2026-04-27') })
      expect(result.current.session.dailyDate).toBe('2026-04-27')
      act(() => { result.current.endGame() })
      expect(result.current.session.dailyDate).toBeNull()
    })
  })

  describe('endOfRound transitions to round-ended (even when endsGame=true)', () => {
    it('best-of-3 final attempt sets status round-ended with endsGame=true', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => result.current.start('country-pinning', round('FRA'), 1, 3, '2026-05-02'))
      act(() => result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 20)))
      act(() => result.current.attempt(countryInput('ESP'), miss('FRA', 'ESP', 30)))
      act(() => result.current.attempt(countryInput('ITA'), miss('FRA', 'ITA', 40)))
      expect(result.current.session.status).toBe('round-ended')
      expect(result.current.session.lastOutcome?.endsGame).toBe(true)
    })

    it('free country lives-out attempt sets status round-ended with endsGame=true', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => result.current.start('country-pinning', round('FRA'), null))
      act(() => result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU')))
      act(() => result.current.advance(round('ITA')))
      act(() => result.current.attempt(countryInput('ESP'), miss('ITA', 'ESP')))
      act(() => result.current.advance(round('PRT')))
      act(() => result.current.attempt(countryInput('GBR'), miss('PRT', 'GBR')))
      expect(result.current.session.status).toBe('round-ended')
      expect(result.current.session.lives).toBe(0)
      expect(result.current.session.lastOutcome?.endsGame).toBe(true)
    })

    it('non-final round still returns round-ended (regression)', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => result.current.start('country-pinning', round('FRA'), null))
      act(() => result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU')))
      expect(result.current.session.status).toBe('round-ended')
      expect(result.current.session.lastOutcome?.endsGame).toBe(false)
    })
  })

  describe("finalize action", () => {
    it('transitions round-ended → game-over when lastOutcome.endsGame is true', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => result.current.start('country-pinning', round('FRA'), 1, 3, '2026-05-02'))
      act(() => result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU')))
      act(() => result.current.attempt(countryInput('ESP'), miss('FRA', 'ESP')))
      act(() => result.current.attempt(countryInput('ITA'), miss('FRA', 'ITA')))
      expect(result.current.session.status).toBe('round-ended')
      act(() => result.current.finalize())
      expect(result.current.session.status).toBe('game-over')
    })

    it('is a no-op when lastOutcome.endsGame is false', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => result.current.start('country-pinning', round('FRA'), null))
      act(() => result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU')))
      expect(result.current.session.status).toBe('round-ended')
      act(() => result.current.finalize())
      expect(result.current.session.status).toBe('round-ended')
    })

    it('is a no-op when status !== round-ended', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => result.current.start('country-pinning', round('FRA'), null))
      expect(result.current.session.status).toBe('playing')
      act(() => result.current.finalize())
      expect(result.current.session.status).toBe('playing')
    })
  })

  describe('endedEarly flag', () => {
    it('start sets endedEarly false', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => result.current.start('country-pinning', round('FRA'), null))
      expect(result.current.session.endedEarly).toBe(false)
    })

    it('finishFree sets endedEarly true', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => result.current.start('country-pinning', round('FRA'), null))
      act(() => result.current.finishFree())
      expect(result.current.session.endedEarly).toBe(true)
    })

    it('endOfRound natural ending leaves endedEarly false', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => result.current.start('country-pinning', round('FRA'), null))
      act(() => result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU')))
      act(() => result.current.advance(round('ITA')))
      act(() => result.current.attempt(countryInput('ESP'), miss('ITA', 'ESP')))
      act(() => result.current.advance(round('PRT')))
      act(() => result.current.attempt(countryInput('GBR'), miss('PRT', 'GBR')))
      expect(result.current.session.lives).toBe(0)
      expect(result.current.session.endedEarly).toBe(false)
    })
  })

  // Bug #32 — atomic restart for game-over → hash-mode-switch.
  // The two-step `endGame() + start()` sequence the hashchange handler used to
  // perform produced an intermediate `status='idle'` render between dispatches,
  // which unmounted <HudShell> and triggered a 4 s remount race on slow CI.
  // The `restart` action collapses both steps into a single reducer transition
  // (any state → fresh playing) so React commits exactly one render.
  describe('restart', () => {
    it('start → game-over → restart transitions atomically to playing in the new mode', () => {
      const { result } = renderHook(() => useGameSession())
      // Drive a free country session to game-over (lose all 3 lives).
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      act(() => { result.current.attempt(countryInput('USA'), miss('FRA', 'USA')) })
      act(() => { result.current.advance(round('ESP')) })
      act(() => { result.current.attempt(countryInput('USA'), miss('ESP', 'USA')) })
      act(() => { result.current.advance(round('DEU')) })
      act(() => { result.current.attempt(countryInput('USA'), miss('DEU', 'USA')) })
      act(() => { result.current.finalize() })
      expect(result.current.session.status).toBe('game-over')
      expect(result.current.session.modeId).toBe('country-pinning')

      // Hashchange-during-game-over → atomic restart into city mode.
      const cityRound: CityRoundSpec = {
        kind: 'city-guessing',
        targetId: 'paris',
        targetName: 'Paris',
        targetCountryName: 'France',
        targetCountryFlag: 'flags/FRA.svg',
        targetCentroid: [2.35, 48.85],
      }
      act(() => { result.current.restart('city-guessing', cityRound, 10, 1, null) })
      expect(result.current.session.modeId).toBe('city-guessing')
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.modeId).not.toBe('')
      // Fresh session: empty score/streak, lives reset, no recorded attempts.
      expect(result.current.session.score).toBe(0)
      expect(result.current.session.lives).toBe(3)
      expect(result.current.session.currentAttempts).toEqual([])
      expect(result.current.session.maxRounds).toBe(10)
      expect(result.current.session.attemptsPerRound).toBe(1)
      expect(result.current.session.attemptsRemaining).toBe(1)
      expect(result.current.session.currentRound).toEqual(cityRound)
      expect(result.current.session.dailyDate).toBeNull()
      expect(result.current.session.endedEarly).toBe(false)
    })

    it('restart from idle behaves like start (no-op-friendly initial path)', () => {
      const { result } = renderHook(() => useGameSession())
      expect(result.current.session.status).toBe('idle')
      act(() => { result.current.restart('country-pinning', round('FRA'), 10, 1, null) })
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.modeId).toBe('country-pinning')
      expect(result.current.session.maxRounds).toBe(10)
    })

    it('restart from playing collapses into a fresh playing session for the new mode', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      act(() => { result.current.attempt(countryInput('USA'), miss('FRA', 'USA', 30)) })
      // mid-session, score=30, lives=2, status=round-ended
      expect(result.current.session.score).toBe(30)
      const cityRound: CityRoundSpec = {
        kind: 'city-guessing',
        targetId: 'tokyo',
        targetName: 'Tokyo',
        targetCountryName: 'Japan',
        targetCountryFlag: 'flags/JPN.svg',
        targetCentroid: [139.69, 35.68],
      }
      act(() => { result.current.restart('city-guessing', cityRound, 10, 1, null) })
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.modeId).toBe('city-guessing')
      expect(result.current.session.score).toBe(0)
      expect(result.current.session.lives).toBe(3)
    })

    it('rejects (no-op) the unsupported attemptsPerRound>1 + maxRounds=null combo, preserving prior state', () => {
      const { result } = renderHook(() => useGameSession())
      // Drive to game-over so we can verify state is preserved on rejection.
      act(() => { result.current.start('country-pinning', round('FRA'), null) })
      act(() => { result.current.attempt(countryInput('USA'), miss('FRA', 'USA')) })
      act(() => { result.current.advance(round('ESP')) })
      act(() => { result.current.attempt(countryInput('USA'), miss('ESP', 'USA')) })
      act(() => { result.current.advance(round('DEU')) })
      act(() => { result.current.attempt(countryInput('USA'), miss('DEU', 'USA')) })
      act(() => { result.current.finalize() })
      const before = result.current.session
      expect(before.status).toBe('game-over')
      act(() => { result.current.restart('country-pinning', round('GBR'), null, 3) })
      // Unsupported combo; reducer must not transition.
      expect(result.current.session).toBe(before)
    })

    it('restart preserves dailyDate when supplied (atomic daily-mode swap)', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => { result.current.start('country-pinning', round('FRA'), 1, 3, '2026-05-02') })
      act(() => { result.current.attempt(countryInput('USA'), miss('FRA', 'USA')) })
      act(() => { result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU')) })
      act(() => { result.current.attempt(countryInput('ESP'), miss('FRA', 'ESP')) })
      act(() => { result.current.finalize() })
      expect(result.current.session.status).toBe('game-over')
      const cityRound: CityRoundSpec = {
        kind: 'city-guessing',
        targetId: 'paris',
        targetName: 'Paris',
        targetCountryName: 'France',
        targetCountryFlag: 'flags/FRA.svg',
        targetCentroid: [2.35, 48.85],
      }
      act(() => { result.current.restart('city-guessing', cityRound, 1, 3, '2026-05-02') })
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.modeId).toBe('city-guessing')
      expect(result.current.session.dailyDate).toBe('2026-05-02')
      expect(result.current.session.attemptsPerRound).toBe(3)
      expect(result.current.session.attemptsRemaining).toBe(3)
    })
  })
})
