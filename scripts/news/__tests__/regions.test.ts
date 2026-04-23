import { describe, it, expect } from 'vitest'
import { regionToGuardianTag } from '../regions'

describe('regionToGuardianTag', () => {
  it('Africa → world/africa', () => {
    expect(regionToGuardianTag('Africa')).toBe('world/africa')
  })
  it('Europe → world/europe', () => {
    expect(regionToGuardianTag('Europe')).toBe('world/europe')
  })
  it('Asia → world/asia-pacific', () => {
    expect(regionToGuardianTag('Asia')).toBe('world/asia-pacific')
  })
  it('Oceania → world/asia-pacific', () => {
    expect(regionToGuardianTag('Oceania')).toBe('world/asia-pacific')
  })
  it('Americas → null (no Guardian region tag)', () => {
    expect(regionToGuardianTag('Americas')).toBeNull()
  })
  it('Antarctic → null', () => {
    expect(regionToGuardianTag('Antarctic')).toBeNull()
  })
  it('unknown region → null', () => {
    expect(regionToGuardianTag('Martian' as never)).toBeNull()
  })
})
