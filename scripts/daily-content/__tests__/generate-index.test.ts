import { describe, it, expect } from 'vitest'
import { buildIndex } from '../generate-index'

const pool = {
  country: { version: 1, cca3: ['FRA', 'PER', 'DEU', 'JPN', 'ARG'] },
  city: { version: 1, ids: ['fra-paris', 'per-lima', 'deu-berlin', 'jpn-tokyo', 'arg-ba'] },
}

describe('buildIndex', () => {
  it('assembles a past+today window with one entry per date', () => {
    const today = new Date(2026, 3, 21, 12, 0, 0)
    const result = buildIndex({ today, pool, retentionDays: 5, existing: null })
    expect(result.window.start).toBe('2026-04-17')
    expect(result.window.end).toBe('2026-04-21')
    expect(Object.keys(result.days).sort()).toEqual([
      '2026-04-17',
      '2026-04-18',
      '2026-04-19',
      '2026-04-20',
      '2026-04-21',
    ])
    for (const day of Object.values(result.days)) {
      expect(pool.country.cca3).toContain(day.country.cca3)
      expect(pool.city.ids).toContain(day.city.id)
    }
  })

  it('preserves existing past entries verbatim (never rewrites history)', () => {
    const today = new Date(2026, 3, 21, 12, 0, 0)
    const existing = {
      generatedAt: '2026-04-20T00:15:00Z',
      window: { start: '2026-04-17', end: '2026-04-20' },
      days: {
        '2026-04-17': { country: { cca3: 'FRA' }, city: { id: 'fra-paris' } },
        '2026-04-18': { country: { cca3: 'PER' }, city: { id: 'per-lima' } },
        '2026-04-19': { country: { cca3: 'DEU' }, city: { id: 'deu-berlin' } },
        '2026-04-20': { country: { cca3: 'JPN' }, city: { id: 'jpn-tokyo' } },
      },
    }
    const result = buildIndex({ today, pool, retentionDays: 5, existing })
    expect(result.days['2026-04-17']).toEqual({ country: { cca3: 'FRA' }, city: { id: 'fra-paris' } })
    expect(result.days['2026-04-18']).toEqual({ country: { cca3: 'PER' }, city: { id: 'per-lima' } })
    expect(result.days['2026-04-19']).toEqual({ country: { cca3: 'DEU' }, city: { id: 'deu-berlin' } })
    expect(result.days['2026-04-20']).toEqual({ country: { cca3: 'JPN' }, city: { id: 'jpn-tokyo' } })
    expect(result.days['2026-04-21']).toBeDefined()
  })

  it('drops entries older than the retention window', () => {
    const today = new Date(2026, 3, 21, 12, 0, 0)
    const existing = {
      generatedAt: '2026-04-20T00:15:00Z',
      window: { start: '2026-04-01', end: '2026-04-20' },
      days: {
        '2026-04-01': { country: { cca3: 'ARG' }, city: { id: 'arg-ba' } },
        '2026-04-15': { country: { cca3: 'FRA' }, city: { id: 'fra-paris' } },
        '2026-04-20': { country: { cca3: 'JPN' }, city: { id: 'jpn-tokyo' } },
      },
    }
    const result = buildIndex({ today, pool, retentionDays: 5, existing })
    expect(result.days['2026-04-01']).toBeUndefined()
    expect(result.days['2026-04-15']).toBeUndefined()
    expect(result.days['2026-04-20']).toBeDefined()
  })

  it('does NOT emit future entries', () => {
    const today = new Date(2026, 3, 21, 12, 0, 0)
    const result = buildIndex({ today, pool, retentionDays: 5, existing: null })
    const future = Object.keys(result.days).filter((d) => d > '2026-04-21')
    expect(future).toEqual([])
  })

  it('avoids repeating a country within the retention window', () => {
    const today = new Date(2026, 3, 21, 12, 0, 0)
    const result = buildIndex({
      today,
      pool,
      retentionDays: 5,
      existing: null,
    })
    const cca3s = Object.values(result.days).map((d) => d.country.cca3)
    expect(new Set(cca3s).size).toBe(cca3s.length)
  })
})
