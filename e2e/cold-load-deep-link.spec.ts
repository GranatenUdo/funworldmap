import { test, expect } from '@playwright/test'
import { getSession, waitForAppReady, waitForGameTestHook } from './helpers'

test.describe('Cold-load deep links bootstrap their target state', () => {
  test('navigating directly to #game/country-pinning starts the game', async ({ page }) => {
    await page.goto('/#game/country-pinning')
    await waitForAppReady(page)
    await waitForGameTestHook(page)

    const session = await getSession(page)
    expect(session.status).toBe('playing')
    expect(session.modeId).toBe('country-pinning')
    expect(session.maxRounds).toBeNull()

    await expect(page.getByTestId('game-prompt-name')).toBeVisible()
    await expect(page.getByTestId('launcher')).not.toBeAttached()
  })

  test('navigating directly to #game/city-guessing starts the game', async ({ page }) => {
    await page.goto('/#game/city-guessing')
    await waitForAppReady(page)
    await waitForGameTestHook(page)

    const session = await getSession(page)
    expect(session.status).toBe('playing')
    expect(session.modeId).toBe('city-guessing')
    expect(session.maxRounds).toBe(10)

    await expect(page.getByTestId('game-prompt-name')).toBeVisible()
    await expect(page.getByTestId('launcher')).not.toBeAttached()
  })
})
