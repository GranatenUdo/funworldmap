import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap, seedDailyHistory, stubDailyIndex } from './helpers'

test.setTimeout(60_000)

test.describe('header CTA states', () => {
  test('unplayed state — solid dot, label "Play today"', async ({ page }) => {
    await stubDailyIndex(page, '2026-05-17')
    await gotoAndWaitForMap(page, '/')
    const pill = page.getByTestId('header-play')
    await expect(pill).toHaveAttribute('data-state', 'unplayed')
    await expect(pill).toContainText('Play today')
  })

  test('partial state — one mode played', async ({ page }) => {
    await stubDailyIndex(page, '2026-05-17')
    await seedDailyHistory(page, { date: '2026-05-17', modes: ['country-pinning'] })
    await gotoAndWaitForMap(page, '/')
    await expect(page.getByTestId('header-play')).toHaveAttribute('data-state', 'partial')
  })

  test('done state — both modes played', async ({ page }) => {
    await stubDailyIndex(page, '2026-05-17')
    await seedDailyHistory(page, {
      date: '2026-05-17',
      modes: ['country-pinning', 'city-guessing'],
    })
    await gotoAndWaitForMap(page, '/')
    const pill = page.getByTestId('header-play')
    await expect(pill).toHaveAttribute('data-state', 'done')
    await expect(pill).toContainText('Today done')
  })
})
