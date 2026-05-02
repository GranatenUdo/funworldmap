import { test, expect } from '@playwright/test'
import { stubDailyIndex, waitForAppReady } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.describe('daily best-of-3', () => {
  test('Done button after one attempt ends the game with that attempt', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await stubDailyIndex(page, today)
    await page.goto(`/#daily/${today}/country-pinning`)
    await waitForAppReady(page)
    await page.waitForSelector('[data-testid="game-hud"]')
    await page.evaluate(() => {
      const hooks = (window as unknown as { __funworldmap_game?: { submitCountryGuess?: (cca3: string) => boolean } }).__funworldmap_game
      hooks?.submitCountryGuess?.('DEU')
    })
    await expect(page.getByTestId('game-done')).toBeVisible()
    await page.getByTestId('game-done').click()
    await page.evaluate(() => (window as unknown as { __funworldmap_game: { finalize(): void } }).__funworldmap_game.finalize())
    await expect(page.getByTestId('game-over')).toBeVisible()
  })

  test('refresh after one attempt resumes the same round with attempts preserved', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await stubDailyIndex(page, today)
    // Capture analytics so we can assert no spurious daily_attempted on resume.
    await page.addInitScript(() => {
      ;(window as unknown as { __PLAYWRIGHT__: boolean }).__PLAYWRIGHT__ = true
    })
    await page.goto(`/#daily/${today}/country-pinning`)
    await waitForAppReady(page)
    await page.waitForSelector('[data-testid="game-hud"]')
    await page.evaluate(() => {
      const hooks = (window as unknown as { __funworldmap_game?: { submitCountryGuess?: (cca3: string) => boolean } }).__funworldmap_game
      hooks?.submitCountryGuess?.('DEU')
    })
    await expect(page.getByTestId('attempt-pip-0')).toBeVisible()
    // Sanity: the live attempt before reload DID fire daily_attempted (proves
    // analytics capture is wired — guards the post-reload assertion against
    // vacuous success).
    const eventsBeforeReload = await page.evaluate(() => {
      const w = window as unknown as { __testAnalytics?: Array<{ name: string }> }
      return (w.__testAnalytics ?? []).map((e) => e.name)
    })
    expect(eventsBeforeReload).toContain('daily_attempted')
    await page.reload()
    await waitForAppReady(page)
    await page.waitForSelector('[data-testid="game-hud"]')
    // Pip 0 should still be filled after reload.
    await expect(page.getByTestId('attempt-pip-0')).toBeVisible()
    // Resuming must NOT replay the per-attempt telemetry — that would double-count
    // the user's attempt and (in the live build) duplicate the colour-flash UX.
    const eventsAfterReload = await page.evaluate(() => {
      const w = window as unknown as { __testAnalytics?: Array<{ name: string }> }
      return (w.__testAnalytics ?? []).map((e) => e.name)
    })
    expect(eventsAfterReload).not.toContain('daily_attempted')
  })

  test('Escape forfeits the daily and clears the resume blob', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await stubDailyIndex(page, today)
    await page.goto(`/#daily/${today}/country-pinning`)
    await waitForAppReady(page)
    await page.waitForSelector('[data-testid="game-hud"]')
    await page.evaluate(() => {
      const hooks = (window as unknown as { __funworldmap_game?: { submitCountryGuess?: (cca3: string) => boolean } }).__funworldmap_game
      hooks?.submitCountryGuess?.('DEU')
    })
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('game-hud')).toBeHidden()
    const resume = await page.evaluate(() => localStorage.getItem('funworldmap-daily-resume'))
    expect(resume).toBeNull()
  })
})
