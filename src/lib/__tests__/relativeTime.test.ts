import { describe, it, expect } from 'vitest'
import { relativeTime } from '../relativeTime'

const NOW = Date.UTC(2026, 3, 23, 12, 0, 0) // 2026-04-23T12:00:00Z

describe('relativeTime', () => {
  it('< 60 s → "just now"', () => {
    expect(relativeTime(new Date(NOW - 30_000).toISOString(), NOW)).toBe('just now')
  })
  it('1-59 min → "N minutes ago"', () => {
    expect(relativeTime(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe('5 minutes ago')
    expect(relativeTime(new Date(NOW - 1 * 60_000).toISOString(), NOW)).toBe('1 minute ago')
  })
  it('1-23 h → "N hours ago"', () => {
    expect(relativeTime(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe('3 hours ago')
    expect(relativeTime(new Date(NOW - 1 * 3_600_000).toISOString(), NOW)).toBe('1 hour ago')
  })
  it('1-6 d → "N days ago"', () => {
    expect(relativeTime(new Date(NOW - 2 * 86_400_000).toISOString(), NOW)).toBe('2 days ago')
    expect(relativeTime(new Date(NOW - 1 * 86_400_000).toISOString(), NOW)).toBe('1 day ago')
  })
  it('>= 7 d → absolute YYYY-MM-DD', () => {
    expect(relativeTime(new Date(NOW - 8 * 86_400_000).toISOString(), NOW)).toBe('2026-04-15')
  })
  it('future date (clock skew) → "just now"', () => {
    expect(relativeTime(new Date(NOW + 5000).toISOString(), NOW)).toBe('just now')
  })
})
