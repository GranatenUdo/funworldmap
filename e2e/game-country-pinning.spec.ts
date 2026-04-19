import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

// We dispatch the guess via the controller's exposed hook instead of
// synthesising a canvas pixel click. This keeps the test deterministic
// (no polygon-vertex math) while still exercising the full guess pipeline
// through App.tsx's onMapSelect branch.
async function clickCountryPolygon(page: Page, cca3: string) {
  await page.evaluate((code) => {
    const guess = (window as unknown as { __funworldmap_guess?: (c: string) => void }).__funworldmap_guess
    if (!guess) throw new Error('__funworldmap_guess not exposed; is the game active?')
    guess(code)
  }, cca3)
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
  test('enter via header Play button, HUD appears and search hides', async ({ page }) => {
    await page.goto('/')
    await waitForMap(page)

    await page.getByTestId('header-play').click()
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
    await page.getByTestId('header-play').click()

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
    await page.getByTestId('header-play').click()

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
    await page.getByTestId('header-play').click()

    for (let i = 0; i < 3; i++) {
      await setRoundAndWait(page, 'FRA', 'France')
      await clickCountryPolygon(page, 'AUS')
      if (i < 2) {
        await expect.poll(
          async () => await page.evaluate(() => {
            type H = { getSession?: () => { status?: string } }
            return (window as unknown as { __funworldmap_game?: H }).__funworldmap_game?.getSession?.()?.status
          }),
          // CI's Ubuntu runners are notably slower than local dev machines;
          // 10 s comfortably covers the REVEAL_MS (1200 ms) round-trip plus
          // any dispatch/render latency under load.
          { timeout: 10_000 },
        ).toBe('playing')
      }
    }

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
})
