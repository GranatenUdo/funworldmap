/**
 * Regression guard for the Toast z-index fix.
 *
 * This spec tested the DailyShareBlock toast path which was removed in Phase A
 * (daily feature removal). The toast z-index regression guard will be rewritten
 * in Phase B to exercise a free-game share / copy-link path instead.
 *
 * Quarantined pending Phase B rewrite (tracking: Phase B5 e2e sweep).
 */
import { test } from '@playwright/test'
import { gotoAndWaitForMap, waitForAppReady, waitForGameTestHook, finalizeGame } from './helpers'

test.setTimeout(60_000)

test('toast dispatched during game-over modal renders above the modal', async ({ page }) => {
  // Quarantined pending Phase B rewrite — the DailyShareBlock that produced the
  // 'Copied!' toast is gone; the replacement free-game toast path is Phase B.
  test.fixme(true, 'tracking: Phase B5 — rewrite for free-game toast z-index after daily removal')

  await gotoAndWaitForMap(page, '/')
  await waitForAppReady(page)
  await waitForGameTestHook(page)
  await finalizeGame(page)
})

test('toast dispatched via navigator.share (success) renders above the modal', async ({ page }) => {
  // Quarantined pending Phase B rewrite — same reason as above.
  test.fixme(
    true,
    'tracking: Phase B5 — rewrite for free-game share toast z-index after daily removal',
  )

  await gotoAndWaitForMap(page, '/')
  await waitForAppReady(page)
  await waitForGameTestHook(page)
  await finalizeGame(page)
})
