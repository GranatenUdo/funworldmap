import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

// Open Country Pinning via the launcher mode card. The launcher is shown
// by default on cold load at /.
async function openCountryPinning(page: Page) {
  await page.getByTestId('launcher-card-country-pinning-free-link').click()
}

// Dispatch the guess via the controller's submitCountryGuess test hook
// instead of synthesising a canvas pixel click. Keeps the test
// deterministic (no polygon-vertex math) while exercising the full guess
// pipeline through the GameSessionProvider's submitGuessInput.
async function clickCountryPolygon(page: Page, cca3: string) {
  const ok = await page.evaluate((code) => {
    type H = { submitCountryGuess?: (cca3: string) => boolean }
    const g = (window as unknown as { __funworldmap_game?: H }).__funworldmap_game
    if (!g || typeof g.submitCountryGuess !== 'function') return false
    return g.submitCountryGuess(code)
  }, cca3)
  if (!ok) throw new Error(`submitCountryGuess('${cca3}') returned false — not in pool or hook missing`)
}

// Wait until the HUD shows a round (any country), then force a specific target
// and wait for React to reflect it. Waiting first ensures the hashchange
// bootstrap has already dispatched its initial start, so our setRound lands
// last and wins in the reducer queue.
async function setRoundAndWait(page: Page, cca3: string, expectedName: string) {
  await expect(page.getByTestId('game-prompt-name')).toBeVisible()
  const ok = await page.evaluate((c) => {
    type Hook = { setRound?: (c: string) => boolean }
    const g = (window as unknown as { __funworldmap_game?: Hook }).__funworldmap_game
    if (!g || typeof g.setRound !== 'function') return false
    return g.setRound(c)
  }, cca3)
  if (!ok) throw new Error(`setRound('${cca3}') returned false — country not in pool or hook missing`)
  await expect(page.getByTestId('game-prompt-name')).toHaveText(expectedName, { timeout: 10_000 })
}

test.describe('Country Pinning game', () => {
  test('enter via launcher mode card, HUD appears and search hides', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)

    await openCountryPinning(page)
    await expect(page.getByTestId('game-hud')).toBeVisible()
    await expect(page.getByTestId('search-input')).toHaveCount(0)
    await expect(page.getByTestId('hud-lives')).toBeVisible()
    await expect(page.getByTestId('hud-score')).toHaveText('0')
  })

  test('deep link #game/country-pinning/play boots into playing', async ({ page }) => {
    await page.goto('/#game/country-pinning/play')
    await waitForMap(page)
    await expect(page.getByTestId('game-hud')).toBeVisible()
  })

  test('correct guess scores 100, streak 1, no life lost', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)
    await openCountryPinning(page)

    await setRoundAndWait(page, 'FRA', 'France')

    await clickCountryPolygon(page, 'FRA')

    await expect(page.getByTestId('hud-score')).toHaveText('100')
    await expect(page.getByTestId('hud-streak')).toContainText('1')
    const lives = page.getByTestId('hud-lives')
    await expect(lives).toHaveAttribute('aria-label', '3 lives remaining')
  })

  test('wrong guess costs a life, resets streak, still scores proximity', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)
    await openCountryPinning(page)

    await setRoundAndWait(page, 'FRA', 'France')

    await clickCountryPolygon(page, 'AUS')

    await expect(page.getByTestId('hud-lives')).toHaveAttribute('aria-label', '2 lives remaining')
    const score = await page.getByTestId('hud-score').innerText()
    expect(Number(score)).toBeGreaterThanOrEqual(0)
    expect(Number(score)).toBeLessThan(100)
  })

  test('three wrong guesses end the game', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)
    await openCountryPinning(page)

    // Between guesses, setRoundAndWait() calls setRound() → overrideRound
    // which forces status back to 'playing' directly. This bypasses the
    // natural REVEAL_MS timer → advance round-trip, which is React-effect-
    // driven and races with re-renders on slow CI. What this test verifies
    // is the lives-exhaustion path, not the reveal animation timing.
    await setRoundAndWait(page, 'FRA', 'France')
    await clickCountryPolygon(page, 'AUS')
    await setRoundAndWait(page, 'FRA', 'France')
    await clickCountryPolygon(page, 'AUS')
    await setRoundAndWait(page, 'FRA', 'France')
    await clickCountryPolygon(page, 'AUS')

    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })
  })

  test('Back to map exits cleanly and clears hash', async ({ page }) => {
    await page.goto('/#game/country-pinning/play')
    await waitForMap(page)
    await page.getByTestId('game-end').click()
    await expect(page.getByTestId('game-hud')).toHaveCount(0)
    expect(page.url().endsWith('/')).toBe(true)
  })

  test('game-over overlay moves focus to Play again', async ({ page }) => {
    await page.goto('/#game/country-pinning/play')
    await waitForMap(page)

    await setRoundAndWait(page, 'FRA', 'France')
    await clickCountryPolygon(page, 'AUS')
    await setRoundAndWait(page, 'FRA', 'France')
    await clickCountryPolygon(page, 'AUS')
    await setRoundAndWait(page, 'FRA', 'France')
    await clickCountryPolygon(page, 'AUS')

    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })
    // Effect focuses the Play again button on mount.
    await expect
      .poll(
        () => page.evaluate(() => document.activeElement?.getAttribute('data-testid')),
        { timeout: 5_000 },
      )
      .toBe('game-over-play-again')
  })

  test('tooltip identity hidden during country-pinning guess phase', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)
    await openCountryPinning(page)
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    const mapContainer = page.locator('.maplibregl-canvas').first()
    await mapContainer.hover({ position: { x: 400, y: 300 } })
    await page.waitForTimeout(500)

    const tooltipVisible = await page.evaluate(() => {
      const t = document.querySelector('.country-tooltip')
      return t?.classList.contains('visible') ?? false
    })
    expect(tooltipVisible).toBe(false)
  })

  test('round-end on wrong guess opens target panel; Continue advances', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)
    await openCountryPinning(page)
    await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })

    await page.evaluate(() => {
      const game = (window as unknown as {
        __funworldmap_game?: { submitCountryGuess: (cca3: string) => boolean }
      }).__funworldmap_game
      game?.submitCountryGuess('USA')
    })

    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('button[aria-label="Compare with another country"]')).not.toBeAttached()
    await expect(page.locator('button[aria-label="Copy link to this country"]')).not.toBeAttached()

    const continueBtn = page.getByTestId('game-continue')
    await expect(continueBtn).toBeVisible()
    await continueBtn.click()

    await expect(page.getByTestId('country-panel')).not.toBeAttached({ timeout: 5_000 })
  })
})
