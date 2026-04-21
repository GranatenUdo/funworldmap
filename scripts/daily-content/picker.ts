import { createHash } from 'node:crypto'

/**
 * Pick one entry from `pool` deterministically based on the date.
 * Rejection-samples past `recent` entries to avoid repeats within
 * the retention window. Falls back to the unfiltered pick if every
 * candidate is in `recent`.
 */
export function pickDaily(date: string, pool: string[], recent: string[]): string {
  if (pool.length === 0) {
    throw new Error('empty pool')
  }
  const recentSet = new Set(recent)
  let salt = 0
  while (salt < 64) {
    const hash = createHash('sha256').update(`${date}:${salt}`).digest()
    const n = hash.readUInt32BE(0)
    const pick = pool[n % pool.length]
    if (!recentSet.has(pick)) return pick
    salt++
  }
  // Defensive fallback: every pool entry was in recent.
  const h = createHash('sha256').update(date).digest().readUInt32BE(0)
  return pool[h % pool.length]
}
