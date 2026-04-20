import { expect, type Page } from '@playwright/test'

/**
 * Dismiss the launcher if it is visible. No-op if the test uses a deep-link
 * URL (e.g. /#FRA) that bypasses the launcher.
 *
 * Call from beforeEach in any spec that relies on map-first entry via
 * page.goto('/') — after the launcher landing-state PR, '/' shows the
 * launcher by default.
 */
export async function dismissLauncher(page: Page): Promise<void> {
  const launcher = page.getByTestId('launcher')
  const isVisible = await launcher.isVisible().catch(() => false)
  if (!isVisible) return
  await page.getByTestId('launcher-dismiss').click()
  await expect(launcher).not.toBeVisible({ timeout: 5_000 })
}
