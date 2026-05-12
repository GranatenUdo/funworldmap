import { test, expect, type Page } from '@playwright/test'
import { waitForAppReady, waitForGameTestHook } from './helpers'

interface MinimalSession {
  status: string
  modeId: string
  attemptsPerRound: number
  maxRounds: number | null
  dailyDate: string | null
}

function getSession(page: Page): Promise<MinimalSession> {
  return page.evaluate(() => {
    const w = window as unknown as { __funworldmap_game: { getSession: () => MinimalSession } }
    return w.__funworldmap_game.getSession()
  }) as Promise<MinimalSession>
}

test.describe('Cold-load deep links bootstrap their target state', () => {
  test('navigating directly to #game/country-pinning starts the game', async ({ page }) => {
    await page.goto('/#game/country-pinning')
    await waitForAppReady(page)
    await waitForGameTestHook(page)

    const session = await getSession(page)
    expect(session.status).toBe('playing')
    expect(session.modeId).toBe('country-pinning')
    expect(session.attemptsPerRound).toBe(1)
    expect(session.maxRounds).toBeNull()
    expect(session.dailyDate).toBeNull()

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
    expect(session.attemptsPerRound).toBe(1)
    expect(session.maxRounds).toBe(10)
    expect(session.dailyDate).toBeNull()

    await expect(page.getByTestId('game-prompt-name')).toBeVisible()
    await expect(page.getByTestId('launcher')).not.toBeAttached()
  })
})
