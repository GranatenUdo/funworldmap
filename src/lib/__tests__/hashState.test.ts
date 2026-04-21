import { describe, it, expect } from 'vitest'
import { parseHash, writeHash } from '../hashState'

describe('parseHash', () => {
  it('empty hash → empty', () => {
    expect(parseHash('')).toEqual({ kind: 'empty' })
    expect(parseHash('#')).toEqual({ kind: 'empty' })
  })

  it('single country code', () => {
    expect(parseHash('#FRA')).toEqual({ kind: 'country', cca3: 'FRA', compareWith: null })
  })

  it('country compare pair', () => {
    expect(parseHash('#FRA,DEU')).toEqual({ kind: 'country', cca3: 'FRA', compareWith: 'DEU' })
  })

  it('upper-cases lower-case codes', () => {
    expect(parseHash('#fra,deu')).toEqual({ kind: 'country', cca3: 'FRA', compareWith: 'DEU' })
  })

  it('trailing comma with missing second code', () => {
    expect(parseHash('#FRA,')).toEqual({ kind: 'country', cca3: 'FRA', compareWith: null })
  })

  it('ignores extra compare codes beyond the first two', () => {
    expect(parseHash('#FRA,DEU,JPN')).toEqual({ kind: 'country', cca3: 'FRA', compareWith: 'DEU' })
  })

  it('game hash without /play', () => {
    expect(parseHash('#game/country-pinning')).toEqual({
      kind: 'game', modeId: 'country-pinning', playing: false,
    })
  })

  it('game hash with /play', () => {
    expect(parseHash('#game/country-pinning/play')).toEqual({
      kind: 'game', modeId: 'country-pinning', playing: true,
    })
  })

  it('unknown game modeId preserves the segment', () => {
    expect(parseHash('#game/mystery-mode')).toEqual({
      kind: 'game', modeId: 'mystery-mode', playing: false,
    })
  })

  it('daily with date only', () => {
    expect(parseHash('#daily/2026-04-21')).toEqual({
      kind: 'daily', date: '2026-04-21', modeId: null, reveal: false,
    })
  })

  it('daily with date + modeId', () => {
    expect(parseHash('#daily/2026-04-21/country-pinning')).toEqual({
      kind: 'daily', date: '2026-04-21', modeId: 'country-pinning', reveal: false,
    })
  })

  it('daily with date + reveal', () => {
    expect(parseHash('#daily/2026-04-21/reveal')).toEqual({
      kind: 'daily', date: '2026-04-21', modeId: null, reveal: true,
    })
  })

  it('daily with date + modeId + reveal', () => {
    expect(parseHash('#daily/2026-04-21/city-guessing/reveal')).toEqual({
      kind: 'daily', date: '2026-04-21', modeId: 'city-guessing', reveal: true,
    })
  })

  it('daily with invalid date format falls back to empty', () => {
    expect(parseHash('#daily/21-04-2026')).toEqual({ kind: 'empty' })
    expect(parseHash('#daily/2026-4-21')).toEqual({ kind: 'empty' })
    expect(parseHash('#daily/not-a-date')).toEqual({ kind: 'empty' })
  })

  it('daily with no date falls back to empty', () => {
    expect(parseHash('#daily/')).toEqual({ kind: 'empty' })
    expect(parseHash('#daily')).toEqual({ kind: 'empty' })
  })
})

describe('writeHash', () => {
  it('empty state → empty string', () => {
    expect(writeHash({ kind: 'empty' })).toBe('')
  })

  it('country', () => {
    expect(writeHash({ kind: 'country', cca3: 'FRA', compareWith: null })).toBe('FRA')
  })

  it('compare pair', () => {
    expect(writeHash({ kind: 'country', cca3: 'FRA', compareWith: 'DEU' })).toBe('FRA,DEU')
  })

  it('game not playing', () => {
    expect(writeHash({ kind: 'game', modeId: 'country-pinning', playing: false })).toBe('game/country-pinning')
  })

  it('game playing', () => {
    expect(writeHash({ kind: 'game', modeId: 'country-pinning', playing: true })).toBe('game/country-pinning/play')
  })

  it('daily date only', () => {
    expect(writeHash({ kind: 'daily', date: '2026-04-21', modeId: null, reveal: false }))
      .toBe('daily/2026-04-21')
  })

  it('daily with modeId', () => {
    expect(writeHash({ kind: 'daily', date: '2026-04-21', modeId: 'country-pinning', reveal: false }))
      .toBe('daily/2026-04-21/country-pinning')
  })

  it('daily with reveal', () => {
    expect(writeHash({ kind: 'daily', date: '2026-04-21', modeId: null, reveal: true }))
      .toBe('daily/2026-04-21/reveal')
  })

  it('daily with modeId + reveal', () => {
    expect(writeHash({ kind: 'daily', date: '2026-04-21', modeId: 'city-guessing', reveal: true }))
      .toBe('daily/2026-04-21/city-guessing/reveal')
  })
})
