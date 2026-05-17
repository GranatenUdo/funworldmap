/**
 * Returns a local-date YYYY-MM-DD string for the given Date.
 * Deliberately avoids toLocaleDateString, which varies by browser locale
 * (Finnish → "21.4.2026", Japanese → "2026/4/21").
 */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Parses a YYYY-MM-DD string as a local Date. `new Date('2026-04-26')` parses
 * as UTC midnight which shifts to the previous day in negative-UTC locales.
 */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Classifies a YYYY-MM-DD date relative to today's YYYY-MM-DD string. */
export function classifyDate(date: string, today: string): 'today' | 'past' | 'future' {
  return date === today ? 'today' : date < today ? 'past' : 'future'
}

/** Returns today's local date as a YYYY-MM-DD string. */
export function getToday(now: Date = new Date()): string {
  return toLocalDateString(now)
}

/** Returns yesterday's local date as a YYYY-MM-DD string. */
export function getYesterday(now: Date = new Date()): string {
  return toLocalDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
}
