/**
 * Mobile country-panel header — D4 restructure.
 *
 * The sheet header is one inline row: flag + name left; share, expand
 * chevron, close right. Compare is a labeled chip below the prime grid
 * (same accessible name as the desktop pill). D1's hero stats must be
 * answerable in the collapsed sheet without expanding.
 *
 * The width loop verifies the country name is not truncated (scrollWidth
 * vs clientWidth on the <h2> — geometry, not wrap points) and that every
 * action is reachable at 360/375/414px.
 */

import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap, waitForAnimationIdle, openLauncher } from './helpers'

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
      expect(isTruncated, `h2 scrollWidth > clientWidth at ${width}px — text is truncated`).toBe(
        false,
      )
    })

    test(`action buttons are visible and clickable at ${width}px`, async ({ page }) => {
      await gotoAndWaitForMap(page, '/#FRA')

      const panel = page.getByTestId('country-panel')
      await expect(panel).toBeVisible({ timeout: 15_000 })
      await waitForAnimationIdle(panel)

      // Compare entry (D4: labeled chip below the grid — same accessible
      // name as the desktop pill; hidden while picking / in-round).
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

test.describe('Sheet grabber (G1) at 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('grabber expands the sheet and the chevron reflects the state', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA')
    const panel = page.getByTestId('country-panel')
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await waitForAnimationIdle(panel)

    // Collapsed: 40dvh of 844 ≈ 338px (dvh === vh in an emulated viewport).
    await expect.poll(async () => (await panel.boundingBox())?.height ?? 0).toBeLessThan(844 * 0.5)
    await expect(page.getByLabel('Expand panel')).toHaveAttribute('aria-expanded', 'false')

    await page.getByTestId('sheet-grabber').click()

    // Expanded: 80dvh ≈ 675px. expect.poll rides out the height transition
    // (collapsed to ~0ms by this project's reducedMotion baseline — but
    // never assume wallclock).
    await expect
      .poll(async () => (await panel.boundingBox())?.height ?? 0)
      .toBeGreaterThan(844 * 0.7)
    await expect(page.getByLabel('Collapse panel')).toHaveAttribute('aria-expanded', 'true')
  })
})

test.describe('D4 sheet header restructure at 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('compare is a labeled chip that enters picking mode', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA')
    const panel = page.getByTestId('country-panel')
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await waitForAnimationIdle(panel)

    const chip = page.getByTestId('compare-entry')
    await expect(chip).toHaveText('Compare')
    await chip.click()
    // The A7 picking banner appears and the chip unmounts (its gating).
    await expect(panel.getByRole('status')).toContainText('Pick a country to compare with')
    await expect(page.getByTestId('compare-entry')).not.toBeAttached()
  })

  test('hero stats sit inside the collapsed sheet viewport', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA')
    const panel = page.getByTestId('country-panel')
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await waitForAnimationIdle(panel)

    // D1's hero row (Task 2 seam: data-testid="hero-stats", first block of
    // the panel body, ungated by showSecondary) answers population/area
    // WITHOUT expanding: its bottom edge stays inside the 844px viewport
    // while the sheet is collapsed (40dvh → sheet top ≈ 506px, ~140px of
    // slack). Geometry-based on purpose — robust to Linux font metrics.
    const hero = page.getByTestId('hero-stats')
    await expect(hero).toBeVisible()
    const box = await hero.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y + box!.height).toBeLessThanOrEqual(844)
  })

  // Regression test (Task 7 live-pass finding): the compare tip (C5,
  // mobile-enabled by D4/Task 6) fires while a country panel is open — on
  // mobile the panel is a full-width `bottom-0` sheet that spatially
  // overlaps the tip's fixed bottom-center position. Before the App.tsx
  // z-[300] fix (matching Toast.tsx's precedent for this exact bottom-pill
  // pattern), the tip was fully occluded by the panel: attached, visible
  // per Playwright's CSS-only definition, but not the topmost element at
  // its own coordinates. elementFromPoint is the honest visibility check.
  test('the mobile compare tip is not occluded by the panel it renders over', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA')
    const panel = page.getByTestId('country-panel')
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await waitForAnimationIdle(panel)

    // Second distinct selection of the session — the compare tip's trigger.
    await page.evaluate(() => {
      window.location.hash = '#DEU'
    })
    await expect(panel).toContainText('Germany')

    const tip = page.getByTestId('onboarding-hint')
    await expect(tip).toBeVisible()
    await expect(tip).toHaveText('Tip: compare two countries side by side')

    // elementFromPoint is the honest visual-stacking check, but the tip is
    // deliberately `pointer-events-none` (it "can never intercept clicks" —
    // see the App.tsx comment), and elementFromPoint's hit-test skips
    // pointer-events:none elements regardless of z-index/paint order. That's
    // correct for interaction but would make this assertion pass or fail on
    // the wrong signal. pointer-events doesn't affect painting, so
    // temporarily neutralizing it just for the hit-test reveals the true
    // paint order without altering production behavior (restored after).
    const isTopmostAtOwnCenter = await tip.evaluate((el) => {
      const original = el.style.pointerEvents
      el.style.pointerEvents = 'auto'
      const r = el.getBoundingClientRect()
      const topEl = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      el.style.pointerEvents = original
      return el === topEl || el.contains(topEl)
    })
    expect(
      isTopmostAtOwnCenter,
      'compare tip is occluded by another element (likely the panel) at its own coordinates',
    ).toBe(true)
  })

  // Regression test (final-review finding): 8cf6ad2's z-[300] bump fixed the
  // panel occlusion above but over-corrected — the hint pill then painted
  // OVER the launcher dialog (z-[210]) too. A first-timer who closes their
  // first panel gets the 'game' hint ("Try a game…"), and opening the
  // launcher from there left the pill floating over the modal indefinitely.
  // Same elementFromPoint technique as the panel-occlusion test above, but
  // the expectation is inverted: with the launcher open, the pill must NOT
  // be the topmost element at its own coordinates — it belongs behind the
  // modal, not in front of it.
  test('the hint pill is occluded by the launcher when opened over it', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA')
    const panel = page.getByTestId('country-panel')
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await waitForAnimationIdle(panel)

    // Closing the only panel of the session fires the 'game' hint.
    await page.getByTestId('panel-close').click()
    await expect(panel).not.toBeAttached()

    const pill = page.getByTestId('onboarding-hint')
    await expect(pill).toBeVisible()
    await expect(pill).toHaveText('Try a game — guess countries and cities')

    await openLauncher(page)
    const launcher = page.getByTestId('launcher')
    await expect(launcher).toBeVisible()

    // The pill still renders (hint state is untouched by opening the
    // launcher) — only its stacking relative to the modal is under test.
    await expect(pill).toBeAttached()

    const isTopmostAtOwnCenter = await pill.evaluate((el) => {
      const original = el.style.pointerEvents
      el.style.pointerEvents = 'auto'
      const r = el.getBoundingClientRect()
      const topEl = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      el.style.pointerEvents = original
      return el === topEl || el.contains(topEl)
    })
    expect(
      isTopmostAtOwnCenter,
      'hint pill paints over the launcher dialog instead of staying behind it',
    ).toBe(false)
  })
})
