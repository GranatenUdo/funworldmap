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
      kind: 'game',
      modeId: 'country-pinning',
    })
  })

  it('game hash with /play (forward-compat)', () => {
    expect(parseHash('#game/country-pinning/play')).toEqual({
      kind: 'game',
      modeId: 'country-pinning',
    })
  })

  it('unknown game modeId preserves the segment', () => {
    expect(parseHash('#game/mystery-mode')).toEqual({
      kind: 'game',
      modeId: 'mystery-mode',
    })
  })

  it('daily hashes (removed feature) all fall back to empty', () => {
    expect(parseHash('#daily/2026-04-21')).toEqual({ kind: 'empty' })
    expect(parseHash('#daily/2026-04-21/country-pinning')).toEqual({ kind: 'empty' })
    expect(parseHash('#daily/2026-04-21/reveal')).toEqual({ kind: 'empty' })
    expect(parseHash('#daily')).toEqual({ kind: 'empty' })
    expect(parseHash('#daily/')).toEqual({ kind: 'empty' })
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

  it('game', () => {
    expect(writeHash({ kind: 'game', modeId: 'country-pinning' })).toBe('game/country-pinning')
  })
})
