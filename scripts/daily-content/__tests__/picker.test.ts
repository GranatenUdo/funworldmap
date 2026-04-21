import { describe, it, expect } from 'vitest'
import { pickDaily } from '../picker'

const pool = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

describe('pickDaily', () => {
  it('is deterministic for the same (date, pool, recent) triple', () => {
    const a = pickDaily('2026-04-21', pool, [])
    const b = pickDaily('2026-04-21', pool, [])
    expect(a).toBe(b)
  })

  it('produces different picks for at least two different dates', () => {
    const a = pickDaily('2026-04-21', pool, [])
    const b = pickDaily('2026-05-21', pool, [])
    const c = pickDaily('2027-04-21', pool, [])
    expect(new Set([a, b, c]).size).toBeGreaterThanOrEqual(2)
  })

  it('avoids entries listed in the "recent" argument', () => {
    const recent = ['A', 'B', 'C']
    for (let d = 1; d <= 20; d++) {
      const date = `2026-04-${String(d).padStart(2, '0')}`
      const pick = pickDaily(date, pool, recent)
      expect(recent).not.toContain(pick)
    }
  })

  it('falls back to the raw pool when every entry is in recent (defensive)', () => {
    const pick = pickDaily('2026-04-21', pool, pool)
    expect(pool).toContain(pick)
  })

  it('throws on empty pool', () => {
    expect(() => pickDaily('2026-04-21', [], [])).toThrow(/empty pool/i)
  })
})
