import { test, expect } from '@playwright/test'

test.setTimeout(120_000)
const TODAY = new Date().toISOString().slice(0, 10)

async function stubDaily(page: import('@playwright/test').Page) {
  await page.route('**/daily/index.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        window: { start: TODAY, end: TODAY },
        days: { [TODAY]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } } },
      }),
    }),
  )
}

test.describe('Daily reveal', () => {
  test('/#daily/<today>/reveal shows both modes reveal', async ({ page }) => {
    await stubDaily(page)
    await page.goto(`/#daily/${TODAY}/reveal`)
    await expect(page.getByTestId('daily-reveal')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('daily-reveal-country')).toBeVisible()
    await expect(page.getByTestId('daily-reveal-city')).toBeVisible()
  })

  test('/#daily/<today>/country-pinning/reveal shows only country', async ({ page }) => {
    await stubDaily(page)
    await page.goto(`/#daily/${TODAY}/country-pinning/reveal`)
    await expect(page.getByTestId('daily-reveal')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('daily-reveal-country')).toBeVisible()
    await expect(page.getByTestId('daily-reveal-city')).not.toBeVisible()
  })

  test('stored attempts render as emoji strip', async ({ page }) => {
    await stubDaily(page)
    await page.addInitScript((today) => {
      localStorage.setItem('funworldmap-daily-history', JSON.stringify({
        version: 1,
        streak: { current: 1, longest: 1, lastActiveDate: today, lastMilestoneShown: 0 },
        days: {
          [today]: {
            'country-pinning': {
              score: 100,
              attempts: [
                { pointsEarned: 40, distanceKm: 800, guessCca3: 'ESP' },
                { pointsEarned: 70, distanceKm: 500, guessCca3: 'DEU' },
                { pointsEarned: 100, distanceKm: 0, guessCca3: 'FRA' },
              ],
              completedAt: 1,
            },
          },
        },
      }))
    }, TODAY)
    await page.goto(`/#daily/${TODAY}/country-pinning/reveal`)
    await expect(page.getByTestId('daily-reveal-country')).toContainText(/100\/100/)
  })

  test('close button clears the hash', async ({ page }) => {
    await stubDaily(page)
    await page.goto(`/#daily/${TODAY}/reveal`)
    await page.getByTestId('daily-reveal-close').click()
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 })
      .toBe('')
  })

  test('unavailable puzzle shows fallback message', async ({ page }) => {
    await page.route('**/daily/index.json', (route) => route.fulfill({ status: 500, body: '' }))
    await page.goto(`/#daily/${TODAY}/reveal`)
    await expect(page.getByTestId('daily-reveal-unavailable')).toBeVisible({ timeout: 10_000 })
  })
})
