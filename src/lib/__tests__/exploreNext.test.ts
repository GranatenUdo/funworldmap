import { describe, it, expect } from 'vitest'
import countriesFile from '../../data/countries.json'
import { CANONICAL_CCA3 } from '../canonicalCountries'
import type { CountriesFile, CountryData } from '../types'
import { makeCountryData } from '../../test/countryFixtures'
import { exploreNext, MAX_SUBREGION_PEERS } from '../exploreNext'

const canonical = (countriesFile as unknown as CountriesFile).countries.filter((c) =>
  CANONICAL_CCA3.has(c.cca3),
)

function canonicalCountry(cca3: string): CountryData {
  const c = canonical.find((x) => x.cca3 === cca3)
  if (!c) throw new Error(`canonical set is missing ${cca3}`)
  return c
}

describe('exploreNext — real canonical data', () => {
  it('France: Coastal fact; Western Europe peers are exactly [NLD, LIE], population-descending', () => {
    const s = exploreNext(canonicalCountry('FRA'), canonical)
    expect(s.fact).toBe('Coastal')
    // The canonical Western Europe peers minus France's 8 borders leave exactly
    // Netherlands (~18.1M) and Liechtenstein (~41K) — three orders of magnitude
    // apart, so this population-descending pin is stable across data refreshes.
    expect(s.subregionPeers.map((c) => c.cca3)).toEqual(['NLD', 'LIE'])
  })

  it('France: similar-population pick is a non-border, non-suggested country within 3M of France', () => {
    const fra = canonicalCountry('FRA')
    const s = exploreNext(fra, canonical)
    const pick = s.similarPopulation
    if (!pick) throw new Error('expected a similar-population pick')
    expect(pick.cca3).not.toBe('FRA')
    expect(fra.borders).not.toContain(pick.cca3)
    expect(s.subregionPeers.map((c) => c.cca3)).not.toContain(pick.cca3)
    // Range-asserted, not pinned to a country: the 60–70M population cluster
    // (Thailand, UK, Tanzania, South Africa) guarantees a sub-3M delta even as
    // the dataset refreshes. (Today's pick is Thailand, Δ ≈ 0.5M.)
    expect(Math.abs(pick.population - fra.population)).toBeLessThan(3_000_000)
  })

  it('Nigeria: caps at 4 peers, all Western Africa non-borders, population-descending', () => {
    const nga = canonicalCountry('NGA')
    const s = exploreNext(nga, canonical)
    expect(s.subregionPeers).toHaveLength(MAX_SUBREGION_PEERS)
    for (const c of s.subregionPeers) {
      expect(c.subregion).toBe('Western Africa')
      expect(nga.borders).not.toContain(c.cca3)
      expect(c.cca3).not.toBe('NGA')
    }
    const pops = s.subregionPeers.map((c) => c.population)
    expect([...pops].sort((a, b) => b - a)).toEqual(pops)
  })

  it('Switzerland is Landlocked; Japan (zero borders) gets all four Eastern Asia peers', () => {
    expect(exploreNext(canonicalCountry('CHE'), canonical).fact).toBe('Landlocked')
    const jpn = exploreNext(canonicalCountry('JPN'), canonical)
    expect(jpn.fact).toBe('Coastal')
    expect(jpn.subregionPeers.map((c) => c.cca3).sort()).toEqual(['CHN', 'KOR', 'MNG', 'PRK'])
  })
})

describe('exploreNext — determinism and exclusions (synthetic)', () => {
  const self = makeCountryData({
    cca3: 'AAA',
    subregion: 'Testland',
    population: 1_000,
    borders: ['BBB'],
  })
  const mk = (cca3: string, population: number, subregion = 'Testland') =>
    makeCountryData({ cca3, population, subregion, borders: [] })

  it('orders equal-population peers by cca3 ascending and is input-order invariant', () => {
    const pool = [
      self,
      mk('DDD', 500),
      mk('BBB', 500), // border of self — must never be suggested
      mk('CCC', 500),
      mk('EEE', 900),
      mk('FFF', 500),
      mk('GGG', 500, 'Elsewhere'),
    ]
    const forward = exploreNext(self, pool)
    const reversed = exploreNext(self, [...pool].reverse())
    // EEE (900) first, then the 500-tie in cca3 order; BBB excluded (border).
    expect(forward.subregionPeers.map((c) => c.cca3)).toEqual(['EEE', 'CCC', 'DDD', 'FFF'])
    expect(reversed.subregionPeers.map((c) => c.cca3)).toEqual(['EEE', 'CCC', 'DDD', 'FFF'])
    // All four Testland slots are suggested → similar-pop falls to GGG.
    expect(forward.similarPopulation?.cca3).toBe('GGG')
    expect(reversed.similarPopulation?.cca3).toBe('GGG')
  })

  it('similar-population skips already-suggested peers and breaks equal deltas by cca3', () => {
    // CCC (Δ10) is the closest by population but is the suggested Testland
    // peer → skipped. XXX (Δ200) and YYY (Δ200) tie → cca3 ascending → XXX.
    const pool = [self, mk('CCC', 990), mk('YYY', 800, 'Elsewhere'), mk('XXX', 1_200, 'Elsewhere')]
    const s = exploreNext(self, pool)
    expect(s.subregionPeers.map((c) => c.cca3)).toEqual(['CCC'])
    expect(s.similarPopulation?.cca3).toBe('XXX')
  })

  it('empty-subregion guard: never matches other empty subregions; empty pool → null similar', () => {
    // The canonical 195 all carry a subregion today — this pins the guard.
    const bare = makeCountryData({ cca3: 'AAA', subregion: '', population: 1_000, borders: [] })
    const other = makeCountryData({ cca3: 'BBB', subregion: '', population: 900, borders: [] })
    const s = exploreNext(bare, [bare, other])
    expect(s.subregionPeers).toEqual([])
    expect(s.similarPopulation?.cca3).toBe('BBB')
    expect(exploreNext(bare, [bare])).toEqual({
      fact: 'Coastal',
      subregionPeers: [],
      similarPopulation: null,
    })
  })
})
