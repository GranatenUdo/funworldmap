import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap, waitForAnimationIdle, openLauncher } from './helpers'

test.setTimeout(60_000)

// Launcher focusable elements, in DOM order (as queried by the focus trap):
//   1. launcher-close          (absolute button — first in the DOM tree)
//   2. launcher-card-country-pinning-play
//   3. launcher-card-city-guessing-play  ← focus-trap "last" element
//
// Initial-focus effect: no lastMode → focuses first [data-testid$="-play"]
// = launcher-card-country-pinning-play.
//
// Tab order starting from country-pinning-play (no lastMode seed):
//   Tab 1 → city-guessing-play   (natural DOM order)
//   Tab 2 → launcher-close       (trap wraps: "last" → "first")
//   Tab 3 → country-pinning-play (natural DOM order after launcher-close)

test.describe('Launcher — initial focus order', () => {
  test('initial focus lands on country-pinning Play button after launcher opens', async ({
    page,
  }) => {
    await gotoAndWaitForMap(page, '/')
    await page.getByTestId('header-play').click()
    const launcher = page.getByTestId('launcher')
    await expect(launcher).toBeVisible()
    await waitForAnimationIdle(launcher)

    // No lastMode in a fresh navigation → initial focus is country-pinning-play
    await expect(page.getByTestId('launcher-card-country-pinning-play')).toBeFocused()
  })

  test('Tab walks the full focus order: country-pinning → city-guessing → close → country-pinning', async ({
    page,
  }) => {
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    const launcher = page.getByTestId('launcher')
    await waitForAnimationIdle(launcher)

    // Starting point: country-pinning-play (no lastMode)
    await expect(page.getByTestId('launcher-card-country-pinning-play')).toBeFocused()

    // Tab 1 → city-guessing-play
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-card-city-guessing-play')).toBeFocused()

    // Tab 2 → launcher-close (focus trap wraps: last → first in DOM)
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-close')).toBeFocused()

    // Tab 3 → country-pinning-play (natural DOM order after launcher-close)
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-card-country-pinning-play')).toBeFocused()
  })
})
