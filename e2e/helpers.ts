import { expect, type Page } from '@playwright/test'

/**
 * Dismiss the launcher if it is visible. No-op if the test uses a deep-link
 * URL (e.g. /#FRA) that bypasses the launcher.
 *
 * Call from beforeEach in any spec that relies on map-first entry via
 * page.goto('/') — after the launcher landing-state PR, '/' shows the
 * launcher by default.
 *
 * Implementation notes:
 * - Uses waitFor({ state: 'visible' }) with a 2s budget instead of a one-shot
 *   isVisible() — the latter races against the launcher's 260ms staggered
 *   entrance animation on slow renderers (Linux CI, headless xvfb).
 * - Awaits not.toBeAttached after dismiss so the caller can rely on the
 *   launcher's backdrop being fully removed before performing clicks that
 *   would otherwise be absorbed by the still-present backdrop.
 * - Final 150ms settle lets React batch-commit the post-dismiss header
 *   re-render (play + satellite buttons reappearing) before the caller
 *   interacts.
 */
export async function dismissLauncher(page: Page): Promise<void> {
  const launcher = page.getByTestId('launcher')
  try {
    await launcher.waitFor({ state: 'visible', timeout: 2_000 })
  } catch {
    // Launcher never appeared within 2s — deep-link test or already dismissed.
    return
  }
  await page.getByTestId('launcher-dismiss').click()
  await expect(launcher).not.toBeAttached({ timeout: 5_000 })
  await page.waitForTimeout(150)
}
