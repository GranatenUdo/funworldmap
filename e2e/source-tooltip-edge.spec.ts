import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap } from './helpers'

/**
 * Phase 3.4 — Source tooltip edge collision regression test.
 *
 * Verifies that the SourceTooltip (now using Floating UI) never extends past
 * the viewport edges when a tooltip button in the left column of the country
 * panel is activated.
 *
 * The original bug: `absolute bottom-full left-1/2 -translate-x-1/2` on a
 * left-column field caused the tooltip to be clipped at the left viewport edge.
 * Visible symptom: "ORLD FACTBOOK" and "://GITHUB.COM/..." (W and HTTPS cut).
 *
 * This test targets the "Population" field source button on France (/#FRA) —
 * the first D1 hero stat (leftmost column of the hero row) — which triggers
 * the same left-edge geometry as the original "Capital" cell.
 */
test.describe('Source tooltip edge collision', () => {
  test('tooltip for left-column field stays within viewport bounds', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA')

    const panel = page.getByTestId('country-panel')
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await expect(panel).toContainText('France', { timeout: 10_000 })

    // Population is the leftmost D1 hero stat (it left the DataCell grid but
    // kept its FieldLabel). Anchor via data-field so the header caption's
    // capital tooltip (the first Source button in DOM order) can't shift
    // this test's target.
    const populationSourceBtn = panel
      .locator('[data-field="population"]')
      .getByRole('button', { name: /^Source:/i })
    await expect(populationSourceBtn).toBeVisible({ timeout: 10_000 })

    // Hover to trigger the tooltip (Floating UI useHover handles this on
    // pointer-capable devices; desktop Chromium always has hover: hover).
    await populationSourceBtn.hover()

    // Wait for the tooltip to appear — no waitForTimeout, use role assertion.
    const tooltip = page.getByRole('tooltip')
    await expect(tooltip).toBeVisible({ timeout: 5_000 })

    // Read viewport dimensions.
    const viewport = page.viewportSize()!

    // Use expect.poll so that if Floating UI is still computing its first
    // auto-position frame, we retry until the position stabilises.
    // We poll until `left >= 0` which is the key regression signal — if
    // Floating UI has positioned the element, the left edge will be ≥ 0.
    await expect
      .poll(() => tooltip.evaluate((el) => el.getBoundingClientRect().left), {
        timeout: 5_000,
        message: 'Tooltip left edge should be ≥ 0',
      })
      .toBeGreaterThanOrEqual(0)

    // Read the final stable rect and assert all four edges.
    const rect = await tooltip.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    })

    expect(rect.left, 'tooltip must not be clipped on the left').toBeGreaterThanOrEqual(0)
    expect(rect.right, 'tooltip must not overflow on the right').toBeLessThanOrEqual(viewport.width)
    expect(rect.top, 'tooltip must not overflow above viewport').toBeGreaterThanOrEqual(0)
    expect(rect.bottom, 'tooltip must not overflow below viewport').toBeLessThanOrEqual(
      viewport.height,
    )
  })

  test('tooltip closes when focus moves away (useDismiss)', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA')

    const panel = page.getByTestId('country-panel')
    await expect(panel).toBeVisible({ timeout: 15_000 })

    // Focus the first Source button (after A4/A5 this is the header caption's
    // capital tooltip) — any Source button exercises the useDismiss path.
    const firstSourceBtn = page.getByRole('button', { name: /^Source:/i }).first()
    await firstSourceBtn.focus()
    await expect(page.getByRole('tooltip')).toBeVisible({ timeout: 5_000 })

    // Move focus away — tooltip should close
    await page.keyboard.press('Escape')
    await expect(page.getByRole('tooltip')).not.toBeAttached({ timeout: 5_000 })
  })
})
