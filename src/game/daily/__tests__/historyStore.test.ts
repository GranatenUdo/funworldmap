import { describe, it, expect, beforeEach } from 'vitest'
import { subscribe, getSnapshot, setHistory, __resetForTests } from '../historyStore'
import { emptyHistory } from '../storage'
import type { DailyHistoryV1 } from '../types'

describe('historyStore', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetForTests()
  })

  it('returns empty history on first read with no localStorage', () => {
    expect(getSnapshot()).toEqual(emptyHistory())
  })

  it('hydrates from localStorage on first read', () => {
    localStorage.setItem(
      'funworldmap-daily-history',
      JSON.stringify({
        version: 1,
        streak: { current: 4, longest: 4, lastActiveDate: '2026-04-21', lastMilestoneShown: 3 },
        days: {},
      }),
    )
    __resetForTests()
    expect(getSnapshot().streak.current).toBe(4)
  })

  it('setHistory replaces snapshot, persists to localStorage, and notifies all subscribers exactly once', () => {
    let countA = 0
    let countB = 0
    const unA = subscribe(() => {
      countA++
    })
    const unB = subscribe(() => {
      countB++
    })

    setHistory((prev) => ({
      ...prev,
      streak: {
        ...prev.streak,
        current: 7,
        longest: 7,
        lastActiveDate: '2026-04-27',
        lastMilestoneShown: 0,
      },
    }))

    expect(getSnapshot().streak.current).toBe(7)
    expect(countA).toBe(1)
    expect(countB).toBe(1)
    const stored = JSON.parse(
      localStorage.getItem('funworldmap-daily-history') ?? '{}',
    ) as DailyHistoryV1
    expect(stored.streak.current).toBe(7)

    unA()
    unB()
  })

  it('setHistory with identity-equal return is a no-op (no notify, no write)', () => {
    let count = 0
    const un = subscribe(() => {
      count++
    })
    const before = getSnapshot()

    setHistory((prev) => prev)

    expect(getSnapshot()).toBe(before)
    expect(count).toBe(0)
    un()
  })

  it('subscribe returns an unsubscribe that stops further notifications', () => {
    let count = 0
    const un = subscribe(() => {
      count++
    })
    setHistory((prev) => ({ ...prev, days: { ...prev.days, '2026-04-27': {} } }))
    expect(count).toBe(1)
    un()
    setHistory((prev) => ({ ...prev, days: { ...prev.days, '2026-04-26': {} } }))
    expect(count).toBe(1)
  })
})
