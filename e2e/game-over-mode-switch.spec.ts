import { test, expect, type Page } from '@playwright/test'
import { submitAndWait } from './helpers'

test.setTimeout(60_000)

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

async function waitForGameReady(page: Page) {
  // Wait for the HUD to appear and be in playing state (game session started).
  await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('game-hud')).toHaveAttribute('data-game-status', 'playing', { timeout: 15_000 })
  // Then wait for the submitCountryGuess test hook to be registered.
  await expect.poll(
    () => page.evaluate(() => {
      const g = (window as unknown as { __funworldmap_game?: Record<string, unknown> }).__funworldmap_game
      if (!g) return 'no-object'
      return typeof g.submitCountryGuess === 'function' ? 'ready' : Object.keys(g).join(',')
    }),
    { timeout: 15_000 },
  ).toBe('ready')
}

test.describe('game-over → new mode', () => {
  test('hash-changing to a different #game URL during game-over starts the new mode', async ({ page }) => {
    await page.goto('/#game/country-pinning')
    await waitForMap(page)
    await waitForGameReady(page)

    // Burn three lives. Escape advances after wrong guesses #1 and #2;
    // on #3 the session is already game-over and the *other* Escape handler
    // (exit) would clear it, so skip Escape on the final iteration.
    for (let i = 0; i < 2; i++) {
      await submitAndWait(page, 'USA', 1)
      // Wait for the round-ended effect to register the advance Escape
      // handler — otherwise Escape can race against the previous-state
      // EXIT handler and end the game instead of advancing the round.
      await expect
        .poll(
          () => page.evaluate(() => {
            const g = (window as unknown as { __funworldmap_game?: { getSession: () => { status: string } } }).__funworldmap_game
            return g?.getSession().status ?? 'no-game'
          }),
          { timeout: 5_000 },
        )
        .toBe('round-ended')
      await page.keyboard.press('Escape')
      // Wait for advance to the next round (status flips back to 'playing').
      await expect
        .poll(
          () => page.evaluate(() => {
            const g = (window as unknown as { __funworldmap_game?: { getSession: () => { status: string } } }).__funworldmap_game
            return g?.getSession().status ?? 'no-game'
          }),
          { timeout: 5_000 },
        )
        .toBe('playing')
    }
    await submitAndWait(page, 'USA', 1)

    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 5_000 })

    // Hash-only nav — does NOT reload the page, so the in-memory game-over
    // state is preserved up to the moment the bootstrap effect re-runs.
    await page.evaluate(() => {
      window.location.hash = '#game/city-guessing'
    })

    await expect(page.getByTestId('game-over')).toBeHidden({ timeout: 5_000 })
    await expect(page.getByTestId('game-hud')).toHaveAttribute('data-game-mode', 'city-guessing')
    await expect(page.getByTestId('game-hud')).toHaveAttribute('data-game-status', 'playing')
  })
})
