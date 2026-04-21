import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readHistory, writeHistory, pruneOlderThan, mergeDay, updateStreak, emptyHistory } from '../storage'
import { STORAGE_KEY } from '../types'
import type { DailyHistoryV1 } from '../types'

function makeDay(score: number): { score: number; attempts: never[]; completedAt: number } {
  return { score, attempts: [], completedAt: Date.now() }
}

describe('emptyHistory', () => {
  it('has version 1, zero streak, no days', () => {
    const h = emptyHistory()
    expect(h.version).toBe(1)
    expect(h.streak).toEqual({
      current: 0, longest: 0, lastActiveDate: null, lastMilestoneShown: 0,
    })
    expect(h.days).toEqual({})
  })
})

describe('readHistory / writeHistory', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { localStorage.clear() })

  it('returns an empty history when the key is absent', () => {
    expect(readHistory()).toEqual(emptyHistory())
  })

  it('round-trips a history through localStorage', () => {
    const h = emptyHistory()
    h.days['2026-04-21'] = { 'country-pinning': makeDay(87) }
    writeHistory(h)
    expect(readHistory()).toEqual(h)
  })

  it('returns an empty history when the stored value fails to parse', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json')
    expect(readHistory()).toEqual(emptyHistory())
  })

  it('returns an empty history on unknown version (future-proof migration)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, days: {}, streak: {} }))
    expect(readHistory()).toEqual(emptyHistory())
  })
})

describe('mergeDay', () => {
  it('creates a day entry when none exists', () => {
    const h = emptyHistory()
    const out = mergeDay(h, '2026-04-21', 'country-pinning', makeDay(87))
    expect(out.days['2026-04-21']?.['country-pinning']?.score).toBe(87)
  })

  it('preserves the other mode when merging one mode', () => {
    let h = emptyHistory()
    h = mergeDay(h, '2026-04-21', 'country-pinning', makeDay(87))
    h = mergeDay(h, '2026-04-21', 'city-guessing', makeDay(72))
    expect(h.days['2026-04-21']?.['country-pinning']?.score).toBe(87)
    expect(h.days['2026-04-21']?.['city-guessing']?.score).toBe(72)
  })

  it('overwrites a same-day same-mode entry (last write wins)', () => {
    let h = emptyHistory()
    h = mergeDay(h, '2026-04-21', 'country-pinning', makeDay(87))
    h = mergeDay(h, '2026-04-21', 'country-pinning', makeDay(99))
    expect(h.days['2026-04-21']?.['country-pinning']?.score).toBe(99)
  })

  it('does not mutate the input history', () => {
    const h = emptyHistory()
    const before = JSON.stringify(h)
    mergeDay(h, '2026-04-21', 'country-pinning', makeDay(87))
    expect(JSON.stringify(h)).toBe(before)
  })
})

describe('updateStreak', () => {
  it('first-ever play sets current = 1, longest = 1', () => {
    const h = emptyHistory()
    const out = updateStreak(h, '2026-04-21')
    expect(out.streak.current).toBe(1)
    expect(out.streak.longest).toBe(1)
    expect(out.streak.lastActiveDate).toBe('2026-04-21')
  })

  it('yesterday → today increments current', () => {
    let h = emptyHistory()
    h = updateStreak(h, '2026-04-20')
    h = updateStreak(h, '2026-04-21')
    expect(h.streak.current).toBe(2)
    expect(h.streak.longest).toBe(2)
  })

  it('same-day no-op (second call returns unchanged state)', () => {
    let h = emptyHistory()
    h = updateStreak(h, '2026-04-21')
    const after = updateStreak(h, '2026-04-21')
    expect(after.streak.current).toBe(1)
    expect(after.streak.longest).toBe(1)
  })

  it('gap of 2 or more resets current to 1', () => {
    let h = emptyHistory()
    h = updateStreak(h, '2026-04-20')
    h = updateStreak(h, '2026-04-21')
    h = updateStreak(h, '2026-04-24')
    expect(h.streak.current).toBe(1)
    expect(h.streak.longest).toBe(2)
  })

  it('preserves longest across a reset', () => {
    let h = emptyHistory()
    for (const d of ['2026-04-18', '2026-04-19', '2026-04-20', '2026-04-21']) {
      h = updateStreak(h, d)
    }
    h = updateStreak(h, '2026-04-25')
    expect(h.streak.current).toBe(1)
    expect(h.streak.longest).toBe(4)
  })
})

describe('pruneOlderThan', () => {
  it('drops day entries with keys before the cutoff', () => {
    let h: DailyHistoryV1 = emptyHistory()
    h.days['2026-01-01'] = { 'country-pinning': makeDay(50) }
    h.days['2026-04-20'] = { 'country-pinning': makeDay(80) }
    h = pruneOlderThan(h, 30, new Date('2026-04-21T12:00:00'))
    expect(h.days['2026-01-01']).toBeUndefined()
    expect(h.days['2026-04-20']).toBeDefined()
  })
})
