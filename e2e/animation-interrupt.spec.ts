import { test, expect, type Page } from '@playwright/test'
import { waitForAppReady, waitForGameTestHook, getSession } from './helpers'

test.setTimeout(60_000)

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

async function startCountryPinningWithFRA(page: Page): Promise<void> {
  // Override the project's global reducedMotion:'reduce' so the panel slide-in
  // animation actually happens. These tests assert behavior keyed on the
  // animation timing (data-animation-state='entering' and the ~3s reveal hold).
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await waitForMap(page)
  await page.getByTestId('launcher-card-country-pinning-free-link').click()
  await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })
  await waitForGameTestHook(page)
  await page.evaluate(() => window.__funworldmap_game?.setRound?.('FRA'))
  await expect(page.getByTestId('game-prompt-name')).toHaveText('France', { timeout: 10_000 })
}

test.describe('Animation interrupt: clean abort, no half-rendered state', () => {
  test('rapid Continue click during panel slide-in (wrong guess)', async ({ page }) => {
    // Quarantined on CI pending tracking issue #47 — data-animation-state='entering'
    // and round-ended timing race. CI's reducedMotion:'reduce' baseline + MapLibre's
    // cached prefers-reduced-motion check make the mid-animation state unobservable.
    // Test stays runnable locally where animations have real duration.
    test.fixme(!!process.env.CI, 'tracking issue: https://github.com/GranatenUdo/funworldmap/issues/47')
    await startCountryPinningWithFRA(page)
    await page.evaluate(() => window.__funworldmap_game?.submitCountryGuess?.('DEU'))

    const panel = page.getByRole('complementary')
    await expect(panel).toHaveAttribute('data-animation-state', 'entering', { timeout: 5_000 })

    await panel.getByRole('button', { name: 'Continue' }).click()

    await expect(panel).not.toBeAttached({ timeout: 5_000 })
    await expect.poll(async () => (await getSession(page)).status, { timeout: 5_000 }).toBe('playing')
    await expect.poll(async () => (await getSession(page)).roundIndex, { timeout: 5_000 }).toBe(1)
  })

  /**
   * Escape during a correct-guess reveal hold is documented as "skip the hold,
   * advance to next round" (GameController.tsx:407, holdThenAdvance). It does
   * NOT abort to the launcher — the global exit handler explicitly excludes
   * country-pinning round-ended from the exit path.
   */
  test('Escape mid-reveal (correct guess) skips the hold and advances to next round', async ({ page }) => {
    // Quarantined on CI — see issue #47. The round-ended → playing transition
    // collapses under CI's reduced-motion baseline; the poll can't observe it.
    test.fixme(!!process.env.CI, 'tracking issue: https://github.com/GranatenUdo/funworldmap/issues/47')
    await startCountryPinningWithFRA(page)
    await page.evaluate(() => window.__funworldmap_game?.submitCountryGuess?.('FRA'))

    await expect.poll(async () => (await getSession(page)).status, { timeout: 5_000 }).toBe('round-ended')

    // Wall-clock NOT elapsed enough to trigger auto-advance (which is ~3s).
    // Escape should short-circuit the hold and advance synchronously.
    await page.keyboard.press('Escape')

    // Advanced to next round, not aborted.
    await expect.poll(async () => (await getSession(page)).status, { timeout: 2_000 }).toBe('playing')
    await expect.poll(async () => (await getSession(page)).roundIndex, { timeout: 2_000 }).toBe(1)
    // Hash still on the game route — we did NOT abort to launcher.
    expect(page.url()).toContain('#game/country-pinning')
  })

  /**
   * Same skip-the-hold contract as the correct-guess test above, but from the
   * wrong-guess state where the country panel is mid-slide-in. The Escape
   * handler in GameController.tsx covers all country-pinning round-ended
   * sub-states.
   */
  test('Escape mid-panel-slide-in (wrong guess) skips the hold and advances', async ({ page }) => {
    // Quarantined on CI — see issue #47. Same root cause as Test 1.
    test.fixme(!!process.env.CI, 'tracking issue: https://github.com/GranatenUdo/funworldmap/issues/47')
    await startCountryPinningWithFRA(page)
    await page.evaluate(() => window.__funworldmap_game?.submitCountryGuess?.('DEU'))

    const panel = page.getByRole('complementary')
    await expect(panel).toHaveAttribute('data-animation-state', 'entering', { timeout: 5_000 })

    await page.keyboard.press('Escape')

    // Same advance contract as the correct-guess case.
    await expect.poll(async () => (await getSession(page)).status, { timeout: 2_000 }).toBe('playing')
    await expect.poll(async () => (await getSession(page)).roundIndex, { timeout: 2_000 }).toBe(1)
    await expect(panel).not.toBeAttached({ timeout: 5_000 })
  })
})
