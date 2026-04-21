import { test, expect, type Page } from '@playwright/test'

test.setTimeout(120_000)

const TODAY = new Date().toISOString().slice(0, 10)

async function withDailyStub(page: Page): Promise<void> {
  await page.route('**/daily/index.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        window: { start: TODAY, end: TODAY },
        days: {
          [TODAY]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } },
        },
      }),
    })
  })
}

test.describe('Daily puzzle — country-pinning, 3 attempts', () => {
  test('clicking Play starts the daily and three guesses finalize with best-of-3', async ({ page }) => {
    await withDailyStub(page)
    await page.goto('/')
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('launcher-card-country-pinning-daily-cta').click()

    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 10_000 })
      .toContain(`daily/${TODAY}/country-pinning`)

    await page.waitForFunction(() => Boolean((window as unknown as { __funworldmap_game?: unknown }).__funworldmap_game))
    await page.evaluate(() => {
      ;(window as unknown as { __funworldmap_game: { submitCountryGuess(s: string): boolean } })
        .__funworldmap_game.submitCountryGuess('DEU')
    })
    await page.evaluate(() => {
      ;(window as unknown as { __funworldmap_game: { submitCountryGuess(s: string): boolean } })
        .__funworldmap_game.submitCountryGuess('ESP')
    })
    await page.evaluate(() => {
      ;(window as unknown as { __funworldmap_game: { submitCountryGuess(s: string): boolean } })
        .__funworldmap_game.submitCountryGuess('FRA')
    })

    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('game-over-score')).toContainText('100')
  })

  test('deep-linking to #daily/<today>/country-pinning bypasses launcher and starts', async ({ page }) => {
    await withDailyStub(page)
    await page.goto(`/#daily/${TODAY}/country-pinning`)
    await expect(page.getByTestId('launcher')).not.toBeVisible()
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 })
      .toContain(`daily/${TODAY}/country-pinning`)
  })

  test('daily history persists: playing + reloading shows played state', async ({ page }) => {
    await withDailyStub(page)
    await page.goto('/')
    await expect(page.getByTestId('launcher-card-country-pinning-daily-cta')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('launcher-card-country-pinning-daily-cta').click()
    await page.waitForFunction(() => Boolean((window as unknown as { __funworldmap_game?: unknown }).__funworldmap_game))
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        ;(window as unknown as { __funworldmap_game: { submitCountryGuess(s: string): boolean } })
          .__funworldmap_game.submitCountryGuess('FRA')
      })
    }
    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /back to map/i }).click()
    await page.reload()
    await expect(page.getByTestId('launcher-card-country-pinning')).toHaveAttribute('data-state', 'played')
  })
})

test.describe('Daily puzzle — launcher-anchored deep link', () => {
  test('#daily/<today> opens launcher anchored to today', async ({ page }) => {
    await withDailyStub(page)
    await page.goto(`/#daily/${TODAY}`)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
  })
})
