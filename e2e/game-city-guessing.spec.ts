import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

async function openCityGuessing(page: Page) {
  await page.goto('/')
  await waitForMap(page)
  await page.getByTestId('header-play').click()
  await page.getByTestId('play-menu-city-guessing').click()
  await expect(page.getByTestId('game-hud')).toBeVisible()
  await expect(page.getByTestId('hud-round-counter')).toContainText('1')
}

async function setRoundAndWait(page: Page, id: string, expectedName: string) {
  await expect(page.getByTestId('game-prompt-name')).toBeVisible()
  const ok = await page.evaluate((c) => {
    type Hook = { setRound?: (c: string) => boolean }
    const g = (window as unknown as { __funworldmap_game?: Hook }).__funworldmap_game
    if (!g || typeof g.setRound !== 'function') return false
    return g.setRound(c)
  }, id)
  if (!ok) throw new Error(`setRound('${id}') returned false`)
  await expect(page.getByTestId('game-prompt-name')).toHaveText(expectedName, { timeout: 10_000 })
}

async function clickAt(page: Page, lng: number, lat: number) {
  await page.evaluate((p) => {
    type Hook = { submitGuess?: (i: { kind: 'point'; lngLat: [number, number] }) => void }
    const g = (window as unknown as { __funworldmap_game?: Hook }).__funworldmap_game
    g?.submitGuess?.({ kind: 'point', lngLat: [p.lng, p.lat] })
  }, { lng, lat })
}

test.describe('City Guessing game', () => {
  test('enter via Play menu, HUD shows round counter', async ({ page }) => {
    await openCityGuessing(page)
    await expect(page.getByTestId('hud-round-counter')).toContainText('/10')
    await expect(page.getByTestId('hud-score')).toHaveText('0')
    await expect(page.getByTestId('city-skip')).toBeVisible()
  })

  test('deep link #game/city-guessing/play boots into playing', async ({ page }) => {
    await page.goto('/#game/city-guessing/play')
    await waitForMap(page)
    await expect(page.getByTestId('game-hud')).toBeVisible()
    await expect(page.getByTestId('hud-round-counter')).toContainText('1')
  })

  test('exact click at target scores 100', async ({ page }) => {
    await openCityGuessing(page)
    await setRoundAndWait(page, 'FRA-paris', 'Paris')
    await clickAt(page, 2.3522, 48.8566)
    await expect(page.getByTestId('hud-score')).toHaveText('100', { timeout: 10_000 })
  })

  test('far click scores low and shows distance', async ({ page }) => {
    await openCityGuessing(page)
    await setRoundAndWait(page, 'FRA-paris', 'Paris')
    await clickAt(page, 0, 0)   // Gulf of Guinea, ~5400 km from Paris
    await expect(page.getByTestId('game-reveal')).toContainText('km off', { timeout: 10_000 })
    const score = await page.getByTestId('hud-score').innerText()
    expect(Number(score)).toBeGreaterThanOrEqual(0)
    expect(Number(score)).toBeLessThan(30)
  })

  test('skip round scores 0 and advances', async ({ page }) => {
    await openCityGuessing(page)
    await setRoundAndWait(page, 'FRA-paris', 'Paris')
    await page.getByTestId('city-skip').click({ force: true })
    // Wait for React to commit the 'round-ended' state before probing the
    // reveal text — on slow CI the status transition races assertion retries.
    await expect
      .poll(
        async () => await page.evaluate(() => {
          type H = { getSession?: () => { status?: string } }
          return (window as unknown as { __funworldmap_game?: H }).__funworldmap_game?.getSession?.()?.status
        }),
        { timeout: 10_000 },
      )
      .toBe('round-ended')
    await expect(page.getByTestId('game-reveal')).toContainText('Skipped', { timeout: 10_000 })
    await expect(page.getByTestId('hud-score')).toHaveText('0')
  })

  test('ten rounds end the game', async ({ page }) => {
    await openCityGuessing(page)
    // Between iterations, setRoundAndWait() calls setRound() → overrideRound
    // which forces status back to 'playing' directly. Bypasses the natural
    // REVEAL_MS → advance round-trip which races with re-renders on slow CI.
    // This test verifies the round-exhaustion path, not the reveal timing.
    for (let i = 0; i < 10; i++) {
      await setRoundAndWait(page, 'FRA-paris', 'Paris')
      await page.getByTestId('city-skip').click({ force: true })
    }
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('game-over-score')).toHaveText('0')
  })

  test('Play menu shows last-played mode first', async ({ page, context }) => {
    await context.addInitScript(() => {
      localStorage.setItem('funworldmap-game-last-mode', 'city-guessing')
    })
    await page.goto('/')
    await waitForMap(page)
    await page.getByTestId('header-play').click()
    const menu = page.getByTestId('play-menu')
    const items = menu.getByRole('menuitem')
    await expect(items.first()).toContainText('City Guessing')
  })

  test('Back to map exits cleanly and clears hash', async ({ page }) => {
    await page.goto('/#game/city-guessing/play')
    await waitForMap(page)
    await page.getByTestId('game-end').click()
    await expect(page.getByTestId('game-hud')).toHaveCount(0)
    expect(page.url().endsWith('/')).toBe(true)
  })
})
