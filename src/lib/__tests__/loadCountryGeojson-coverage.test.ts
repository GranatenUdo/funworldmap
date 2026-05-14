import { describe, it, expect } from 'vitest'
import { loadCountryGeojson } from '../loadCountryGeojson'
import { CANONICAL_NUMERIC_IDS } from '../canonicalCountries'

describe('loadCountryGeojson — coverage of canonical 195', () => {
  it('returns a feature for every canonical numeric ID', async () => {
    const geojson = await loadCountryGeojson()
    const featureIds = new Set<number>()
    for (const f of geojson.features) {
      if (f.id != null) featureIds.add(Number(f.id))
    }
    const missing: number[] = []
    for (const id of CANONICAL_NUMERIC_IDS) {
      if (!featureIds.has(id)) missing.push(id)
    }
    expect(missing).toEqual([])
  })

  it('returns exactly the canonical 195 unique IDs (no extras)', async () => {
    const geojson = await loadCountryGeojson()
    const uniqueIds = new Set<number>()
    for (const f of geojson.features) {
      if (f.id != null) uniqueIds.add(Number(f.id))
    }
    // Some IDs may appear in multiple features (e.g. world-atlas splits
    // Australia mainland + Ashmore & Cartier Islands into two features sharing
    // id=36). What matters is that there are no extra canonical IDs beyond 195
    // and no non-canonical IDs.
    expect(uniqueIds.size).toBe(CANONICAL_NUMERIC_IDS.size)
    for (const id of uniqueIds) {
      expect(CANONICAL_NUMERIC_IDS.has(id)).toBe(true)
    }
  })
})
