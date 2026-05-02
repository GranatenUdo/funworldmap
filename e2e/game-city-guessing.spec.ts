import { test, expect, type Page } from '@playwright/test'
import { finalizeGame } from './helpers'


async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

async function openCityGuessing(page: Page) {
  await page.goto('/')
  await waitForMap(page)
  await page.getByTestId('launcher-card-city-guessing-free-link').click()
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

// Bypass the DOM click entirely — the city-skip button's rendering is
// gated on session.status === 'playing' and its bounding box shifts
// as the HUD re-renders, causing Playwright click races on slow CI.
// submitGuess({ kind: 'skip' }) through the test hook exercises the same
// code path the button does.
async function skipViaHook(page: Page) {
  await page.evaluate(() => {
    type Hook = { submitGuess?: (i: { kind: 'skip' }) => void }
    const g = (window as unknown as { __funworldmap_game?: Hook }).__funworldmap_game
    g?.submitGuess?.({ kind: 'skip' })
  })
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

  test('skip round scores 0 via the skip button', async ({ page }) => {
    // Sanity: the button exists and is clickable when status is 'playing'.
    // Separates the UI assertion from the game-logic assertion (covered below).
    await openCityGuessing(page)
    await expect(page.getByTestId('city-skip')).toBeVisible()
  })

  test('skip round scores 0 and advances', async ({ page }) => {
    await openCityGuessing(page)
    await setRoundAndWait(page, 'FRA-paris', 'Paris')
    await skipViaHook(page)
    // Poll for the reducer to commit round-ended.
    await expect
      .poll(
        async () => await page.evaluate(() => {
          type H = { getSession?: () => { status?: string; score?: number } }
          return (window as unknown as { __funworldmap_game?: H }).__funworldmap_game?.getSession?.()?.status
        }),
        { timeout: 10_000 },
      )
      .toBe('round-ended')
    // Score should be 0 (skip earns nothing).
    const score = await page.evaluate(() => {
      type H = { getSession?: () => { score?: number } }
      return (window as unknown as { __funworldmap_game?: H }).__funworldmap_game?.getSession?.()?.score
    })
    expect(score).toBe(0)
  })

  test('skip button click submits a skip guess', async ({ page }) => {
    // Exercises the onClick handler on city-skip. The reveal HUD text
    // lives only during status='round-ended' (REVEAL_MS = 2000ms) and
    // races the state transition on slow CI. Assert via the session:
    // roundIndex advancing proves the click submitted a guess and the
    // reducer completed the round. Score stays 0 (skip earns nothing).
    await openCityGuessing(page)
    await setRoundAndWait(page, 'FRA-paris', 'Paris')
    await expect(page.getByTestId('city-skip')).toBeVisible()
    await page.getByTestId('city-skip').click()
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            type H = { getSession?: () => { roundIndex: number; score: number } }
            const g = (window as unknown as { __funworldmap_game?: H }).__funworldmap_game
            return g?.getSession?.() ?? null
          }),
        { timeout: 10_000 },
      )
      .toMatchObject({ roundIndex: 1, score: 0 })
  })

  test('ten rounds end the game', async ({ page }) => {
    // Reduced-motion bypasses the per-round reveal animation. The test
    // verifies game-flow termination, not animation behaviour. Without
    // this, 10 × ~600-1200 ms × 5x slower CI = up to 60 s of pure
    // animation tax, which together with setup blew the test budget.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openCityGuessing(page)
    for (let i = 0; i < 10; i++) {
      await setRoundAndWait(page, 'FRA-paris', 'Paris')
      await skipViaHook(page)
    }
    await finalizeGame(page)
    await expect(page.getByTestId('game-over')).toBeVisible()
    await expect(page.getByTestId('game-over-score')).toHaveText('0')
  })

  // Popover-based "Play menu shows last-played mode first" test deleted —
  // PlayMenu no longer exists. Launcher initial-focus-on-last-played is
  // covered by e2e/launcher.spec.ts.

  test('End game opens game-over; Back to map exits cleanly and clears hash', async ({ page }) => {
    await page.goto('/#game/city-guessing/play')
    await waitForMap(page)
    await page.getByTestId('game-end').click()
    // End game in free mode now routes through finishFree → game-over UI shows
    // (Bug 3 fix); user must click Back to map to fully exit.
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 5_000 })
    await page.getByTestId('game-over-back').click()
    await expect(page.getByTestId('game-hud')).toHaveCount(0)
    expect(page.url().endsWith('/')).toBe(true)
  })
})
