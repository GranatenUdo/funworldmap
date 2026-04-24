import { describe, it, expect } from 'vitest'
import { cca3ToFips } from '../fips-codes'

// Spot-check common divergent codes. cca2 passed as second arg is the
// fallback used when the cca3 is not in the override table.
describe('cca3ToFips', () => {
  it('known divergent codes resolve via the override table', () => {
    expect(cca3ToFips('DEU', 'DE')).toBe('GM') // Germany
    expect(cca3ToFips('SWE', 'SE')).toBe('SW') // Sweden
    expect(cca3ToFips('CHN', 'CN')).toBe('CH') // China
    expect(cca3ToFips('CHE', 'CH')).toBe('SZ') // Switzerland
    expect(cca3ToFips('ESP', 'ES')).toBe('SP') // Spain
    expect(cca3ToFips('GBR', 'GB')).toBe('UK') // UK
    expect(cca3ToFips('KOR', 'KR')).toBe('KS') // South Korea
    expect(cca3ToFips('PRK', 'KP')).toBe('KN') // North Korea
    expect(cca3ToFips('AUS', 'AU')).toBe('AS') // Australia
    expect(cca3ToFips('PRT', 'PT')).toBe('PO') // Portugal
  })

  it('cca3 not in overrides falls back to cca2', () => {
    expect(cca3ToFips('USA', 'US')).toBe('US') // identity
    expect(cca3ToFips('FRA', 'FR')).toBe('FR') // identity
    expect(cca3ToFips('ITA', 'IT')).toBe('IT') // identity
    expect(cca3ToFips('CAN', 'CA')).toBe('CA') // identity
  })

  it('returns null when override is explicitly null (no FIPS code)', () => {
    // Territories with no FIPS code assigned (confirmed via Wikipedia's FIPS list)
    expect(cca3ToFips('BVT', 'BV')).toBeNull() // Bouvet Island
    expect(cca3ToFips('BES', 'BQ')).toBeNull() // Caribbean Netherlands
    expect(cca3ToFips('ATA', 'AQ')).toBeNull() // Antarctica
    expect(cca3ToFips('ALA', 'AX')).toBeNull() // Åland Islands
  })
})
