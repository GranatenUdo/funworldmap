import { describe, it, expect } from 'vitest'
import { parseHash, writeHash } from '../hashState'

describe('parseHash', () => {
  it('returns empty state for empty hash', () => {
    expect(parseHash('')).toEqual({ selected: null, compareWith: null })
    expect(parseHash('#')).toEqual({ selected: null, compareWith: null })
  })

  it('parses single country', () => {
    expect(parseHash('#FRA')).toEqual({ selected: 'FRA', compareWith: null })
  })

  it('parses compare pair', () => {
    expect(parseHash('#FRA,DEU')).toEqual({ selected: 'FRA', compareWith: 'DEU' })
  })

  it('uppercases codes', () => {
    expect(parseHash('#fra,deu')).toEqual({ selected: 'FRA', compareWith: 'DEU' })
  })

  it('ignores empty second segment', () => {
    expect(parseHash('#FRA,')).toEqual({ selected: 'FRA', compareWith: null })
  })

  it('ignores trailing extra segments', () => {
    expect(parseHash('#FRA,DEU,JPN')).toEqual({ selected: 'FRA', compareWith: 'DEU' })
  })
})

describe('writeHash', () => {
  it('empty state returns empty string', () => {
    expect(writeHash(null, null)).toBe('')
  })

  it('single country', () => {
    expect(writeHash('FRA', null)).toBe('FRA')
  })

  it('compare pair', () => {
    expect(writeHash('FRA', 'DEU')).toBe('FRA,DEU')
  })

  it('ignores compareWith when selected is null', () => {
    expect(writeHash(null, 'DEU')).toBe('')
  })
})
