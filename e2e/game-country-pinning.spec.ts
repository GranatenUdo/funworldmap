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

  test('guess-by-name input submits like a map click', async ({ page }) => {
    await page.goto('/#game/country-pinning/play')
    await waitForMap(page)

    await setRoundAndWait(page, 'FRA', 'France')

    await page.getByTestId('game-guess-by-name').click()
    await page.getByTestId('game-guess-input').fill('France')
    // Fuse.js debounces search results by ~150 ms; wait for them to appear
    // before pressing Enter (otherwise results[0] is still undefined). CI
    // latency can stretch this well past 5 s, so use a 10 s ceiling.
    await expect(page.getByTestId('game-guess-results')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('game-guess-input').press('Enter')

    await expect(page.getByTestId('hud-score')).toHaveText('100', { timeout: 10_000 })
  })

  test('guess-by-name search matches capital cities', async ({ page }) => {
    // Verifies that GuessByNameButton receives the full CountryData shape
    // so Fuse indexes name.official, capital, region, subregion, cca2, cca3
    // — not only name.common and cca3 as the prior CountryLike cast forced.
    await page.goto('/#game/country-pinning/play')
    await waitForMap(page)
    await setRoundAndWait(page, 'FRA', 'France')

    await page.getByTestId('game-guess-by-name').click()
    await page.getByTestId('game-guess-input').fill('Paris')
    await expect(page.getByTestId('game-guess-results')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('game-guess-results')).toContainText('France')
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
})
