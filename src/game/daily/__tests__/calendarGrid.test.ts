import { describe, it, expect } from 'vitest'
import { calendarGrid } from '../calendarGrid'

describe('calendarGrid', () => {
  it('returns exactly 35 cells (7 cols × 5 rows)', () => {
    const cells = calendarGrid(new Date(2026, 3, 22), 30) // Wed Apr 22 2026
    expect(cells).toHaveLength(35)
  })

  it('ends on the current ISO-week Sunday', () => {
    const today = new Date(2026, 3, 22) // Wed Apr 22 2026
    const cells = calendarGrid(today, 30)
    // Wed → Sunday is +4 days → Apr 26.
    expect(cells[34].date).toBe('2026-04-26')
  })

  it('is Monday-aligned — cell 0 is a Monday', () => {
    const today = new Date(2026, 3, 22) // Wednesday
    const cells = calendarGrid(today, 30)
    // Walk back 5 weeks from Sunday Apr 26 → Mon Mar 23.
    expect(cells[0].date).toBe('2026-03-23')
  })

  it('marks cells before the retention-window start as rolled-off', () => {
    const today = new Date(2026, 3, 22)
    const cells = calendarGrid(today, 30)
    // Window start = today - 29 days = 2026-03-24.
    // So 2026-03-23 (cell 0) is rolled-off; 2026-03-24 (cell 1) is in-window.
    expect(cells[0].status).toBe('rolled-off')
    expect(cells[1].status).toBe('in-window')
  })

  it('marks today with status "today"', () => {
    const today = new Date(2026, 3, 22)
    const cells = calendarGrid(today, 30)
    const todayCell = cells.find((c) => c.date === '2026-04-22')
    expect(todayCell?.status).toBe('today')
  })

  it('cells after today within the current week have status "rolled-off" (future)', () => {
    const today = new Date(2026, 3, 22) // Wed
    const cells = calendarGrid(today, 30)
    const thu = cells.find((c) => c.date === '2026-04-23')
    const sun = cells.find((c) => c.date === '2026-04-26')
    expect(thu?.status).toBe('rolled-off')
    expect(sun?.status).toBe('rolled-off')
  })

  it('handles a Sunday "today" (last day of ISO week)', () => {
    const today = new Date(2026, 3, 26) // Sun Apr 26
    const cells = calendarGrid(today, 30)
    expect(cells[34].date).toBe('2026-04-26')
    expect(cells[34].status).toBe('today')
  })
})
