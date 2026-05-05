/**
 * Phase 3.5 — Mobile country-panel header reflow.
 *
 * Verifies that the country name in the bottom-sheet header is NOT truncated
 * at narrow mobile widths (360, 375, 414 px). Before the fix, the action-button
 * row consumed too much horizontal space, leaving < 100 px for the title and
 * forcing an ellipsis.
 *
 * Truncation detection: compare scrollWidth vs clientWidth on the <h2>. If the
 * text is clipped, scrollWidth > clientWidth. We assert they're equal (or
 * scrollWidth ≤ clientWidth).
 *
 * The tests also assert that every action button (compare, share, expand,
 * close) is reachable (visible + enabled) at each width.
 */

import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap, waitForAnimationIdle } from './helpers'

const WIDTHS = [360, 375, 414] as const

for (const width of WIDTHS) {
  test.describe(`Bottom-sheet header at ${width}px`, () => {
    test.use({ viewport: { width, height: 667 } })

    test(`country name "France" is not truncated at ${width}px`, async ({ page }) => {
      await gotoAndWaitForMap(page, '/#FRA')

      const panel = page.getByTestId('country-panel')
      await expect(panel).toBeVisible({ timeout: 15_000 })

      // Wait for the entrance animation to settle before measuring layout.
      await waitForAnimationIdle(panel)

      // Assert the visible text contains the full name (not "Fr…").
      const h2 = panel.locator('h2').first()
      await expect(h2).toContainText('France', { timeout: 10_000 })

      // Measure scrollWidth vs clientWidth: if scrollWidth > clientWidth the
      // text is being clipped by the truncate class.
      const isTruncated = await h2.evaluate((el) => el.scrollWidth > el.clientWidth)
      expect(isTruncated, `h2 scrollWidth > clientWidth at ${width}px — text is truncated`).toBe(false)
    })

    test(`action buttons are visible and clickable at ${width}px`, async ({ page }) => {
      await gotoAndWaitForMap(page, '/#FRA')

      const panel = page.getByTestId('country-panel')
      await expect(panel).toBeVisible({ timeout: 15_000 })
      await waitForAnimationIdle(panel)

      // Compare button (only when not in comparePickingMode / inGameRound).
      const compareBtn = page.getByRole('button', { name: 'Compare with another country' })
      await expect(compareBtn).toBeVisible()
      await expect(compareBtn).toBeEnabled()

      // Share / copy-link button.
      const shareBtn = page.getByRole('button', { name: 'Copy link to this country' })
      await expect(shareBtn).toBeVisible()
      await expect(shareBtn).toBeEnabled()

      // Expand button (mobile-only).
      const expandBtn = page.getByLabel('Expand panel')
      await expect(expandBtn).toBeVisible()
      await expect(expandBtn).toBeEnabled()

      // Close button.
      const closeBtn = page.getByTestId('panel-close')
      await expect(closeBtn).toBeVisible()
      await expect(closeBtn).toBeEnabled()
    })

    test(`close button dismisses panel at ${width}px`, async ({ page }) => {
      await gotoAndWaitForMap(page, '/#FRA')

      const panel = page.getByTestId('country-panel')
      await expect(panel).toBeVisible({ timeout: 15_000 })
      await waitForAnimationIdle(panel)

      // Wait for close button (not occluded by any overlay).
      const closeBtn = page.getByTestId('panel-close')
      await expect(closeBtn).toBeVisible()
      await closeBtn.click()
      await expect(panel).not.toBeAttached({ timeout: 10_000 })
    })
  })
}
