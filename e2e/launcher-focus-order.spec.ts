import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap, waitForAppReady, waitForAnimationIdle, openLauncher } from './helpers'

test.setTimeout(60_000)

test.describe('Launcher — initial focus order', () => {
  test('initial focus lands on a Play button after launcher opens', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await waitForAppReady(page)
    await page.getByTestId('header-play').click()
    const launcher = page.getByTestId('launcher')
    await expect(launcher).toBeVisible()
    await waitForAnimationIdle(launcher)

    // Initial focus must land on one of the mode card Play buttons
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
    expect(focused).toMatch(/-play$/)
  })

  test('Tab from initial Play button reaches the next focusable element', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await waitForAppReady(page)
    await openLauncher(page)
    const launcher = page.getByTestId('launcher')
    await waitForAnimationIdle(launcher)

    // Assert starting position is a -play button
    const initial = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
    expect(initial).toMatch(/-play$/)

    // Tab once — must land on the next focusable element (another -play or launcher-close)
    await page.keyboard.press('Tab')
    const afterTab = page.locator(':focus')
    await expect(afterTab).toBeVisible()
  })

  test('launcher-close is reachable via Tab', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await waitForAppReady(page)
    await openLauncher(page)
    const launcher = page.getByTestId('launcher')
    await waitForAnimationIdle(launcher)

    // Tab through all focusable elements until we reach launcher-close (or the trap wraps)
    // The launcher has: country-pinning-play, city-guessing-play, launcher-close.
    // DOM order for focus trap: launcher-close is absolute first in the DOM,
    // but initial focus is set to a -play button. Tab through: next -play → close (wraps or not).
    // We press Tab up to 5 times and assert launcher-close is eventually focused.
    let found = false
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      const testId = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
      if (testId === 'launcher-close') {
        found = true
        break
      }
    }
    expect(found, 'launcher-close must be reachable via Tab').toBe(true)
    await expect(page.getByTestId('launcher-close')).toBeFocused()
  })
})
