import { describe, expect, it } from 'vitest'
import { MARKER_GLYPHS, computeFieldSourceMarkers, dominantSource } from '../fieldSourceMarkers'

describe('dominantSource', () => {
  it('returns null for empty input', () => {
    expect(dominantSource()).toBeNull()
    expect(dominantSource({})).toBeNull()
  })

  it('returns the source attributing the most fields', () => {
    expect(
      dominantSource({
        population: 'restcountries',
        area: 'restcountries',
        governmentType: 'cia-factbook',
      }),
    ).toBe('restcountries')
  })

  it('counts across multiple records (compare passes both countries)', () => {
    // 'b' wins 2:1 only when both records are counted.
    expect(dominantSource({ x: 'a', y: 'b' }, { y: 'b' })).toBe('b')
  })

  it('breaks ties to the lexicographically smallest source key (deterministic rule)', () => {
    expect(dominantSource({ x: 'zebra', y: 'aardvark' })).toBe('aardvark')
  })
})

describe('computeFieldSourceMarkers', () => {
  it('yields an empty exception set when every field shares one source', () => {
    const m = computeFieldSourceMarkers(
      { population: 'restcountries', area: 'restcountries' },
      { population: 'restcountries', area: 'restcountries' },
    )
    expect(m.dominantSource).toBe('restcountries')
    expect(m.markerBySource.size).toBe(0)
    expect(m.markerByField.size).toBe(0)
  })

  it('marks exactly the one differing field with the first glyph', () => {
    const m = computeFieldSourceMarkers({
      population: 'restcountries',
      area: 'restcountries',
      governmentType: 'cia-factbook',
    })
    expect(m.dominantSource).toBe('restcountries')
    expect(m.markerByField.get('governmentType')).toEqual({
      glyph: MARKER_GLYPHS[0],
      source: 'cia-factbook',
    })
    expect(m.markerByField.has('population')).toBe(false)
    expect(m.markerByField.has('area')).toBe(false)
    expect(m.markerBySource.get('cia-factbook')).toBe(MARKER_GLYPHS[0])
  })

  it('marks a field when only ONE of two records differs from the dominant source', () => {
    // GNB-style: unMember is manual-override for country A, restcountries for B.
    const m = computeFieldSourceMarkers(
      { population: 'restcountries', unMember: 'manual-override' },
      { population: 'restcountries', unMember: 'restcountries' },
    )
    expect(m.dominantSource).toBe('restcountries')
    expect(m.markerByField.get('unMember')).toEqual({
      glyph: MARKER_GLYPHS[0],
      source: 'manual-override',
    })
  })

  it('assigns glyphs to exception sources in lexicographic source-key order', () => {
    const m = computeFieldSourceMarkers({
      a: 'dominant',
      b: 'dominant',
      c: 'dominant',
      d: 'zeta-source',
      e: 'alpha-source',
    })
    expect(m.markerBySource.get('alpha-source')).toBe(MARKER_GLYPHS[0])
    expect(m.markerBySource.get('zeta-source')).toBe(MARKER_GLYPHS[1])
  })
})
