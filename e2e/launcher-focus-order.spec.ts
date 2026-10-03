import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap, openLauncher, ensureLauncherDismissed } from './helpers'

test('reopened chooser focuses the preferred Play action', async ({page}) => {
  await gotoAndWaitForMap(page,'/')
  await ensureLauncherDismissed(page)
  await openLauncher(page)
  await expect(page.getByTestId('launcher-card-country-pinning-play')).toBeFocused()
})

test('chooser keyboard order includes Explore and wraps within the modal',async ({page}) => {
  await gotoAndWaitForMap(page,'/')
  await ensureLauncherDismissed(page)
  await openLauncher(page)
  await expect(page.getByTestId('launcher-card-country-pinning-play')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('launcher-card-city-guessing-play')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button',{name:'Explore the map',exact:true})).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('launcher-close')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('launcher-card-country-pinning-play')).toBeFocused()
})
