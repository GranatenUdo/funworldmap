import { describe, expect, it } from 'vitest'
import { CANONICAL_CCA3, CANONICAL_NUMERIC_IDS } from '../canonicalCountries'

describe('canonicalCountries', () => {
  it('contains exactly 195 countries (193 UN + VAT + PSE)', () => {
    expect(CANONICAL_CCA3.size).toBe(195)
    expect(CANONICAL_NUMERIC_IDS.size).toBe(195)
  })
  it('includes Vatican and Palestine', () => {
    expect(CANONICAL_CCA3.has('VAT')).toBe(true)
    expect(CANONICAL_CCA3.has('PSE')).toBe(true)
  })
  it('excludes Taiwan, Greenland, Hong Kong, Western Sahara', () => {
    expect(CANONICAL_CCA3.has('TWN')).toBe(false)
    expect(CANONICAL_CCA3.has('GRL')).toBe(false)
    expect(CANONICAL_CCA3.has('HKG')).toBe(false)
    expect(CANONICAL_CCA3.has('ESH')).toBe(false)
  })
  it('includes Guinea-Bissau (regression guard for restcountries data error)', () => {
    expect(CANONICAL_CCA3.has('GNB')).toBe(true)
  })
})
