import { test, expect } from '@playwright/test'
import { toLocalDateString } from '../src/game/daily/dates'
import { waitForAnimationIdle } from './helpers'

test.setTimeout(120_000)
const TODAY = toLocalDateString(new Date())

test.describe('Daily streak', () => {
  test('streak pill shows current streak when localStorage has a streak', async ({ page }) => {
    await page.addInitScript((today) => {
      localStorage.setItem(
        'funworldmap-daily-history',
        JSON.stringify({
          version: 1,
          streak: { current: 5, longest: 5, lastActiveDate: today, lastMilestoneShown: 3 },
          days: { [today]: { 'country-pinning': { score: 87, attempts: [], completedAt: 1 } } },
        }),
      )
    }, TODAY)
    await page.goto('/')
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('launcher-streak')).toContainText(/5-day streak/)
  })

  test('streak pill shows broken-streak invite when lastActiveDate < yesterday', async ({
    page,
  }) => {
    // Phase 2's updateStreak never sets current to 0 — it resets to 1 on the
    // next play after a gap. So a stale streak has current >= 1 AND a
    // lastActiveDate that's more than one day old. The "broken" UI mode is
    // derived at render time from lastActiveDate vs. yesterday.
    await page.addInitScript(() => {
      localStorage.setItem(
        'funworldmap-daily-history',
        JSON.stringify({
          version: 1,
          streak: { current: 3, longest: 3, lastActiveDate: '2026-04-18', lastMilestoneShown: 3 },
          days: {
            '2026-04-18': { 'country-pinning': { score: 87, attempts: [], completedAt: 1 } },
          },
        }),
      )
    })
    await page.goto('/')
    await expect(page.getByTestId('launcher-streak')).toHaveAttribute('data-streak-mode', 'broken')
    await expect(page.getByTestId('launcher-streak')).toContainText(/start your streak/i)
  })

  test('milestone overlay fires at streak 7 with a fresh lastMilestoneShown', async ({ page }) => {
    await page.addInitScript((today) => {
      localStorage.setItem(
        'funworldmap-daily-history',
        JSON.stringify({
          version: 1,
          streak: { current: 7, longest: 7, lastActiveDate: today, lastMilestoneShown: 3 },
          days: { [today]: { 'country-pinning': { score: 87, attempts: [], completedAt: 1 } } },
        }),
      )
    }, TODAY)
    await page.goto('/')
    await expect(page.getByTestId('launcher-milestone')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('launcher-milestone')).toContainText(/a full week/i)
  })

  test('milestone overlay auto-dismisses and persists lastMilestoneShown', async ({ page }) => {
    await page.addInitScript((today) => {
      localStorage.setItem(
        'funworldmap-daily-history',
        JSON.stringify({
          version: 1,
          streak: { current: 3, longest: 3, lastActiveDate: today, lastMilestoneShown: 0 },
          days: { [today]: { 'country-pinning': { score: 87, attempts: [], completedAt: 1 } } },
        }),
      )
    }, TODAY)
    await page.goto('/')
    const milestone = page.getByTestId('launcher-milestone')
    await expect(milestone).toBeVisible({ timeout: 5_000 })
    // Wait for the 260ms entrance animation to complete before starting the
    // auto-dismiss clock — avoids the race where the 5_000ms window is eaten
    // up by slow-CI animation + 2500ms dismiss timer together.
    await waitForAnimationIdle(milestone)
    await expect(milestone).not.toBeAttached({ timeout: 5_000 })
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('funworldmap-daily-history')
      return raw
        ? (JSON.parse(raw) as { streak: { lastMilestoneShown: number } }).streak.lastMilestoneShown
        : null
    })
    expect(stored).toBe(3)
  })
})
