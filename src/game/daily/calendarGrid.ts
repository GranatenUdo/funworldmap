import { toLocalDateString } from './dates'

export type CalendarCellStatus = 'rolled-off' | 'in-window' | 'today'

export interface CalendarCell {
  date: string // YYYY-MM-DD
  status: CalendarCellStatus
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

/**
 * Build a 5×7 Monday-aligned calendar grid ending on the ISO-week Sunday
 * that contains `today`. Cells before the retention window or after `today`
 * are marked 'rolled-off'; cells within the window up to and including
 * today are 'in-window' (with today itself marked 'today').
 */
export function calendarGrid(today: Date, retentionDays: number): CalendarCell[] {
  // JS getDay(): 0 = Sunday, 1 = Monday, ... 6 = Saturday.
  // We want the ISO-week Sunday that contains `today`.
  const dow = today.getDay() // 0..6
  const daysUntilSunday = dow === 0 ? 0 : 7 - dow
  const endSunday = addDays(today, daysUntilSunday)
  const gridStart = addDays(endSunday, -34) // 35 days total, inclusive both ends

  const todayStr = toLocalDateString(today)
  const windowStart = toLocalDateString(addDays(today, -(retentionDays - 1)))

  const out: CalendarCell[] = []
  for (let i = 0; i < 35; i++) {
    const date = toLocalDateString(addDays(gridStart, i))
    let status: CalendarCellStatus
    if (date === todayStr) status = 'today'
    else if (date < windowStart) status = 'rolled-off'
    else if (date > todayStr) status = 'rolled-off'
    else status = 'in-window'
    out.push({ date, status })
  }
  return out
}
