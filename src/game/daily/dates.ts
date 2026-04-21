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
