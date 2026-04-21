import { describe, it, expect } from 'vitest'
import { toLocalDateString } from '../dates'

describe('toLocalDateString', () => {
  it('formats a date as YYYY-MM-DD regardless of browser locale', () => {
    const d = new Date(2026, 3, 21, 12, 0, 0) // April 21 2026 local time
    expect(toLocalDateString(d)).toBe('2026-04-21')
  })

  it('zero-pads single-digit months and days', () => {
    const d = new Date(2026, 0, 5, 12, 0, 0) // January 5 2026
    expect(toLocalDateString(d)).toBe('2026-01-05')
  })

  it('uses local date components, not UTC', () => {
    const d = new Date(2026, 3, 21, 23, 59, 0)
    expect(toLocalDateString(d)).toBe('2026-04-21')
  })

  it('handles year boundaries', () => {
    const d = new Date(2025, 11, 31, 23, 59, 0) // December 31 2025
    expect(toLocalDateString(d)).toBe('2025-12-31')
  })
})
