/**
 * Free-play DOM smoke — confirms both mode cards render with expected structure.
 * Filename kept so mobile-webkit and desktop-firefox-touch testMatch entries
 * in playwright.config.ts remain valid.
 */
import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap, waitForAppReady, openLauncher } from './helpers'

test.setTimeout(60_000)

test.describe('Launcher cards (free-play smoke)', () => {
  test('both mode cards render with a title, Play button, and best-score line', async ({
    page,
  }) => {
    await gotoAndWaitForMap(page, '/')
    await waitForAppReady(page)
    await openLauncher(page)

    // Country-pinning card
    const cpCard = page.getByTestId('launcher-card-country-pinning')
    await expect(cpCard).toBeVisible()
    // Title text is present inside the card
    await expect(cpCard).toContainText('Country')
    // Play button is present and visible
    await expect(page.getByTestId('launcher-card-country-pinning-play')).toBeVisible()
    // Best-score line is present (shows "No games yet" for fresh state)
    await expect(page.getByTestId('launcher-card-country-pinning-best')).toBeVisible()

    // City-guessing card
    const cgCard = page.getByTestId('launcher-card-city-guessing')
    await expect(cgCard).toBeVisible()
    await expect(cgCard).toContainText('City')
    await expect(page.getByTestId('launcher-card-city-guessing-play')).toBeVisible()
    await expect(page.getByTestId('launcher-card-city-guessing-best')).toBeVisible()
  })

  test('fresh-player state shows "No games yet" in best-score line', async ({ page }) => {
    await gotoAndWaitForMap(page, '/')
    await waitForAppReady(page)
    await openLauncher(page)

    await expect(page.getByTestId('launcher-card-country-pinning-best')).toContainText(
      /no games yet/i,
    )
    await expect(page.getByTestId('launcher-card-city-guessing-best')).toContainText(
      /no games yet/i,
    )
  })
})
