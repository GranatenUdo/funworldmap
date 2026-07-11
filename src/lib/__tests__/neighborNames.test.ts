import { describe, expect, it } from 'vitest'
import { nonSelectableNeighborName } from '../neighborNames'

describe('nonSelectableNeighborName', () => {
  it.each([
    ['ESH', 'Western Sahara'],
    ['GIB', 'Gibraltar'],
    ['GUF', 'French Guiana'],
    ['HKG', 'Hong Kong'],
    ['MAC', 'Macau'],
    ['UNK', 'Kosovo'], // not in the dataset — static fallback
  ])('%s → %s', (code, name) => {
    expect(nonSelectableNeighborName(code)).toBe(name)
  })
  it('unknown codes return undefined', () => {
    expect(nonSelectableNeighborName('ZZZ')).toBeUndefined()
  })
})
