/**
 * One-time, idempotent removal of localStorage keys left behind by the
 * retired daily-puzzle feature. Safe in private mode / quota-restricted
 * contexts. Mirrors the v1 self-clean in personalBestsStore.ts.
 */
const LEGACY_DAILY_KEYS = ['funworldmap-daily-history', 'funworldmap-daily-resume'] as const

export function cleanupLegacyDailyStorage(): void {
  for (const key of LEGACY_DAILY_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* private-mode / unavailable — best effort */
    }
  }
}
