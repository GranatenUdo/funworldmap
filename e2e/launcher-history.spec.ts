import { test, expect } from '@playwright/test'
import { toLocalDateString } from '../src/game/daily/dates'
import { openLauncher, gotoAndWaitForMap, seedDailyHistory, stubDailyIndex } from './helpers'

test.setTimeout(120_000)
const TODAY = toLocalDateString(new Date())

async function seedDailyAndHistory(page: import('@playwright/test').Page) {
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
  await page.addInitScript((today) => {
    localStorage.setItem(
      'funworldmap-daily-history',
      JSON.stringify({
        version: 1,
        streak: { current: 1, longest: 1, lastActiveDate: today, lastMilestoneShown: 0 },
        days: { [today]: { 'country-pinning': { score: 87, attempts: [], completedAt: 1 } } },
      }),
    )
  }, TODAY)
}

test.describe('Launcher history panel', () => {
  test('history link opens the panel', async ({ page }) => {
    await seedDailyAndHistory(page)
    await page.goto('/')
    await openLauncher(page)
    await expect(page.getByTestId('launcher-history-link')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('launcher-history-link').click()
    await expect(page.getByTestId('launcher-history')).toBeVisible()
  })

  test('close button closes the panel', async ({ page }) => {
    await seedDailyAndHistory(page)
    await page.goto('/')
    await openLauncher(page)
    await page.getByTestId('launcher-history-link').click()
    await page.getByTestId('launcher-history-close').click()
    await expect(page.getByTestId('launcher-history')).not.toBeVisible()
  })

  test('Escape closes the panel first, then the launcher', async ({ page }) => {
    await seedDailyAndHistory(page)
    await page.goto('/')
    await openLauncher(page)
    await page.getByTestId('launcher-history-link').click()
    await expect(page.getByTestId('launcher-history')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('launcher-history')).not.toBeVisible()
    await expect(page.getByTestId('launcher')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('launcher')).not.toBeVisible()
  })

  test('clicking today cell navigates to reveal', async ({ page }) => {
    await seedDailyAndHistory(page)
    await page.goto('/')
    await openLauncher(page)
    await page.getByTestId('launcher-history-link').click()
    await page.getByTestId(`launcher-cal-${TODAY}`).click()
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 })
      .toBe(`#daily/${TODAY}/reveal`)
  })

  test('rolled-off cell is inert', async ({ page }) => {
    await seedDailyAndHistory(page)
    await page.goto('/')
    await openLauncher(page)
    await page.getByTestId('launcher-history-link').click()
    // The first cell in the grid is Monday of 5 weeks ago — definitely rolled-off.
    const rolledOff = page
      .getByTestId('launcher-history')
      .locator('[data-status="rolled-off"]')
      .first()
    await expect(rolledOff).toHaveAttribute('disabled', '')
  })

  test('played cell exposes a memory tooltip via title attribute', async ({ page }) => {
    const playedDate = '2026-05-15'
    await stubDailyIndex(page, playedDate)
    await seedDailyHistory(page, { date: playedDate, modes: ['country-pinning', 'city-guessing'] })
    await gotoAndWaitForMap(page, '/')
    await openLauncher(page)
    await page.getByTestId('launcher-history-link').click()
    const cell = page.getByTestId(`launcher-cal-${playedDate}`)
    await expect(cell).toBeVisible()
    const title = await cell.getAttribute('title')
    expect(title).toBeTruthy()
    expect(title).toMatch(/\d+\/100/)
    expect(title).toMatch(/\d+\/1000/)
  })
})
