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

    // First guess via the test seam — counts as a wrong guess (USA is unlikely
    // to be the random round target; even if it is, the tutorial still dismisses
    // because currentAttempts.length goes 0→1 either way).
    await page.evaluate(() => window.__funworldmap_game?.submitCountryGuess?.('USA'))

    await expect(page.getByTestId('game-tutorial')).toBeHidden()
    // country-pinning uses attemptsPerRound=1, so the guess goes straight to
    // submitGuess and currentAttempts stays [] (no recordAttempt accumulation).
    // Verify the guess was processed by checking lastOutcome is non-null.
    const guessProcessed = await page.evaluate(
      () => window.__funworldmap_game?.getSession?.().lastOutcome !== null,
    )
    expect(guessProcessed).toBe(true)
  })
})
