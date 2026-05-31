import type { ModeId, PersonalBest } from './types'
import { isCountryPinning } from './modePredicates'

/**
 * Canonical personal-best summary, shared by the launcher mode card and the
 * game-over overlay so the two surfaces never drift.
 *
 * - Score is always shown with locale grouping ("1,240 pts").
 * - Streak is a country-pinning metric (consecutive 100-pt rounds); it is
 *   omitted for city-guessing and when no streak has been achieved, so a
 *   never-streaked player never sees a noisy "· 0 streak".
 */
export function formatPersonalBest(best: PersonalBest, modeId: ModeId): string {
  const score = `${best.bestScore.toLocaleString()} pts`
  return isCountryPinning(modeId) && best.bestStreak > 0
    ? `${score} · ${best.bestStreak} streak`
    : score
}
