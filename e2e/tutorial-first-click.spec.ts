import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

test.describe('first-session tutorial', () => {
  test('dismisses on first guess and the attempt counts', async ({ page }) => {
    // Sessionstorage scoped to origin — clearing localStorage isn't enough; the
    // tutorial uses sessionStorage. Visit a benign page first so we can clear it
    // before the tutorial mounts.
    await page.goto('/')
    await page.evaluate(() => sessionStorage.clear())

    await page.goto('/#game/country-pinning/play')
    await waitForMap(page)
    await expect(page.getByTestId('game-tutorial')).toBeVisible({ timeout: 10_000 })

    // USA is unlikely to be the round target; even if it is, the tutorial
    // still dismisses because the dismiss signal flips on any guess.
    await page.evaluate(() => window.__funworldmap_game?.submitCountryGuess?.('USA'))

    await expect(page.getByTestId('game-tutorial')).toBeHidden()
    // `attempt` runs once and immediately ends the round; lastOutcome is set
    // when the round transitions to `round-ended`. Use it to confirm the guess
    // was processed before asserting the tutorial state.
    const guessProcessed = await page.evaluate(
      () => window.__funworldmap_game?.getSession?.().lastOutcome !== null,
    )
    expect(guessProcessed).toBe(true)
  })
})
