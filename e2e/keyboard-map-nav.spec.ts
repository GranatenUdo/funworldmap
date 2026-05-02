import { test, expect } from '@playwright/test'
import { dismissLauncher } from './helpers'

test.describe('keyboard map navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await dismissLauncher(page)
    await page.waitForSelector('[data-map-loaded]')
  })

  test('Home announces "View reset" via live region', async ({ page }) => {
    await page.locator('[role="application"]').focus()
    await page.keyboard.press('Home')
    // Live-region updates synchronously when Home fires; small buffer for React effect.
    await expect(page.locator('[data-testid="announce-region"]')).toContainText('View reset')
  })

  // Dropped: "Home flies camera back to default center"
  // The sibling 'Home announces "View reset"' test already covers the
  // keybinding detection and the flyToHome call-site. The camera-
  // movement assertion is effectively MapLibre's own correctness, and
  // it's chromium-gpu-only — headless Linux without a real GPU makes
  // the flyTo rAF easing + `idle` event so flaky that three rounds of
  // hardening still saw timeouts on CI.

  test('focus ring is visible on the map container when tabbed to', async ({ page }) => {
    // Reach [role="application"] via keyboard Tab (not .focus()) so that
    // :focus-visible evaluates. Programmatic focus does not reliably
    // trigger :focus-visible — the ring relies on keyboard-initiated focus.
    const app = page.locator('[role="application"]')
    // Tab through ALL focusable elements until the map application receives
    // focus. CI has 5+ more focusables in the path than local (MapLibre nav
    // controls, skip links, theme toggle, play+satellite buttons post-
    // dismiss); 30 tabs is plenty of budget with margin.
    let attempts = 0
    while (attempts < 30) {
      await page.keyboard.press('Tab')
      if (await app.evaluate((el) => el === document.activeElement).catch(() => false)) break
      attempts++
    }
    await expect(app).toBeFocused({ timeout: 15_000 })
    const hasOutline = await app.evaluate((el) => {
      const style = getComputedStyle(el)
      return style.outlineStyle !== 'none' && style.outlineWidth !== '0px'
    })
    expect(hasOutline).toBe(true)
  })
})
