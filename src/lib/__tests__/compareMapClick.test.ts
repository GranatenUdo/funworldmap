import { describe, expect, it } from 'vitest'
import { compareMapClick, compareChipClick } from '../compareMapClick'

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

describe('compareChipClick (C1 border-chip semantics inside the compare panel)', () => {
  it('a chip in column A replaces A, keeping B', () => {
    expect(compareChipClick('a', 'ESP', 'FRA', 'DEU')).toEqual({ kind: 'replace-a', cca3: 'ESP' })
  })

  it('a chip in column B replaces B, keeping A', () => {
    expect(compareChipClick('b', 'POL', 'FRA', 'DEU')).toEqual({ kind: 'replace-b', cca3: 'POL' })
  })

  it("is a no-op when the chip names the OTHER column's country (no X-vs-X pair)", () => {
    expect(compareChipClick('a', 'DEU', 'FRA', 'DEU')).toEqual({ kind: 'noop' })
    expect(compareChipClick('b', 'FRA', 'FRA', 'DEU')).toEqual({ kind: 'noop' })
  })

  it('uppercases the incoming code', () => {
    expect(compareChipClick('b', 'pol', 'FRA', 'DEU')).toEqual({ kind: 'replace-b', cca3: 'POL' })
  })
})
