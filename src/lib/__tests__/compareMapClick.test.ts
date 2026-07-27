import { describe, expect, it } from 'vitest'
import { compareMapClick } from '../compareMapClick'

describe('compareMapClick (A8 map-click semantics while a compare pair is active)', () => {
  it('replaces B when a third country is clicked', () => {
    expect(compareMapClick('ESP', 'FRA', 'DEU')).toEqual({ kind: 'replace-b', cca3: 'ESP' })
  })

  it('uppercases the incoming code', () => {
    expect(compareMapClick('esp', 'FRA', 'DEU')).toEqual({ kind: 'replace-b', cca3: 'ESP' })
  })

  it('is a no-op when A (the selected country) is clicked', () => {
    expect(compareMapClick('FRA', 'FRA', 'DEU')).toEqual({ kind: 'noop' })
  })

  it('is a no-op when the current B is clicked (replacing B with itself is a dead hash write)', () => {
    expect(compareMapClick('DEU', 'FRA', 'DEU')).toEqual({ kind: 'noop' })
  })
})
