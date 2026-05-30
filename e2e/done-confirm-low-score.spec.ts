/**
 * Confirm-on-low-score before "Done" in daily best-of-3.
 *
 * This spec tested the daily best-of-3 "Done" button confirm flow. The daily
 * feature was removed in Phase A. The `game-done` / `done-confirm` HUD
 * elements only existed in best-of-N mode which is removed in Phase B.
 *
 * Quarantined pending Phase B — the best-of-N machinery (attemptsPerRound,
 * currentAttempts, completeNow) is cleaned up in Phase B tasks B1–B5 and this
 * spec will be deleted or replaced at that time.
 */
import { test } from '@playwright/test'

test.describe('Done button — low-score confirm (daily best-of-3)', () => {
  test('low score + attempts remaining: first Done click shows inline confirm', async () => {
    // Quarantined pending Phase B — daily best-of-3 removed in Phase A.
    test.fixme(
      true,
      'tracking: Phase B5 — delete this spec; game-done/done-confirm removed with best-of-N machinery',
    )
  })

  test('"Done anyway" on the confirm ends the round immediately', async () => {
    test.fixme(
      true,
      'tracking: Phase B5 — delete this spec; game-done/done-confirm removed with best-of-N machinery',
    )
  })

  test('high score (>= 30): Done ends immediately without prompt', async () => {
    test.fixme(
      true,
      'tracking: Phase B5 — delete this spec; game-done/done-confirm removed with best-of-N machinery',
    )
  })

  test('dismissing with "Use attempts" then clicking Done again ends game without re-prompting', async () => {
    test.fixme(
      true,
      'tracking: Phase B5 — delete this spec; game-done/done-confirm removed with best-of-N machinery',
    )
  })

  test('confirm prompt uses singular "attempt" when 1 remaining, plural "attempts" when 2', async () => {
    test.fixme(
      true,
      'tracking: Phase B5 — delete this spec; game-done/done-confirm removed with best-of-N machinery',
    )
  })

  test('confirm prompt shows singular "attempt" when 1 remaining', async () => {
    test.fixme(
      true,
      'tracking: Phase B5 — delete this spec; game-done/done-confirm removed with best-of-N machinery',
    )
  })

  test('analytics event fired when prompt is shown', async () => {
    test.fixme(
      true,
      'tracking: Phase B5 — delete this spec; game-done/done-confirm removed with best-of-N machinery',
    )
  })

  test('analytics event NOT fired when high-score Done ends immediately', async () => {
    test.fixme(
      true,
      'tracking: Phase B5 — delete this spec; game-done/done-confirm removed with best-of-N machinery',
    )
  })
})
