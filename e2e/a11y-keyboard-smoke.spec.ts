import { test, expect, Page } from '@playwright/test'
import { waitForAppReady, openLauncher, gotoAndWaitForMap } from './helpers'

test.setTimeout(60_000)

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function openLauncherFresh(page: Page) {
  await gotoAndWaitForMap(page, '/')
  await waitForAppReady(page)
  await openLauncher(page)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Keyboard-only smoke — free-play launcher', () => {
  test('Enter on launcher-close closes the launcher', async ({ page }) => {
    await openLauncherFresh(page)
    const close = page.getByTestId('launcher-close')
    await close.focus()
    await expect(close).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })
  })

  test('Escape dismisses the launcher (hash root)', async ({ page }) => {
    await openLauncherFresh(page)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })
  })

  test('Tab from country-pinning Play button moves to city-guessing Play button', async ({
    page,
  }) => {
    await openLauncherFresh(page)
    // Initial focus is on a Play button (last-played mode or first card)
    await page.getByTestId('launcher-card-country-pinning-play').focus()
    await expect(page.getByTestId('launcher-card-country-pinning-play')).toBeFocused()
    await page.keyboard.press('Tab')
    // Next focusable is city-guessing Play
    await expect(page.getByTestId('launcher-card-city-guessing-play')).toBeFocused()
  })
})
