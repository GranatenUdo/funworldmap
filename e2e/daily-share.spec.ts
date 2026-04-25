import { test, expect, type Page } from '@playwright/test'
import { waitForAppReady } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.setTimeout(60_000)

async function seedPlayedDaily(page: Page, date: string): Promise<void> {
  // Seed localStorage history + install a sessionStorage-visible index object
  // that the route handler can then serve as /daily/index.json.
  await page.addInitScript(
    ({ d }) => {
      const index = {
        generatedAt: new Date().toISOString(),
        window: { start: d, end: d },
        days: { [d]: { country: { cca3: 'FRA' }, city: { id: 'paris' } } },
      }
      const history = {
        version: 1,
        streak: { current: 3, longest: 3, lastActiveDate: d, lastMilestoneShown: 0 },
        days: {
          [d]: {
            'country-pinning': {
              score: 87,
              attempts: [
                { pointsEarned: 42, distanceKm: 1200 },
                { pointsEarned: 63, distanceKm: 400 },
                { pointsEarned: 91, distanceKm: 0 },
              ],
              completedAt: 1,
            },
          },
        },
      }
      localStorage.setItem('funworldmap-daily-history', JSON.stringify(history))
      ;(window as unknown as { __seededIndex?: unknown }).__seededIndex = index
    },
    { d: date },
  )
  await page.route('**/daily/index.json', async (route) => {
    const seeded = await page.evaluate(
      () => (window as unknown as { __seededIndex?: unknown }).__seededIndex,
    )
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(seeded) })
  })
}

async function installNavigatorShareMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { __lastShare?: { title: string; text: string; url: string } }).__lastShare = undefined
    // @ts-expect-error — test-time installation
    navigator.share = async (data: { title: string; text: string; url: string }) => {
      ;(window as unknown as { __lastShare?: unknown }).__lastShare = data
    }
  })
}

test.describe('Daily share block', () => {
  test('share block visible in DailyRevealOverlay with played country', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await expect(page.getByTestId('daily-share-block')).toBeVisible({ timeout: 5_000 })
    const preview = page.getByTestId('daily-share-preview')
    const text = (await preview.textContent()) ?? ''
    expect(text).toContain('funworldmap · ')
    expect(text).toContain('87/100')
    expect(text).toContain(`#daily/${today}`)
  })

  test('clicking Share uses navigator.share when present', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today)
    await installNavigatorShareMock(page)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-primary').click()
    const lastShare = await page.evaluate(
      () => (window as unknown as { __lastShare?: { title: string; text: string; url: string } }).__lastShare,
    )
    expect(lastShare?.title).toBe('funworldmap daily')
    expect(lastShare?.text ?? '').toContain('funworldmap · ')
    expect(lastShare?.url ?? '').toContain(`#daily/${today}`)
  })

  test('clicking Copy link only writes the URL to clipboard', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-copy-link').click()
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    const origin = new URL(page.url()).origin
    expect(clip).toBe(`${origin}/#daily/${today}`)
  })

  test('share block absent when no mode has been played', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await page.addInitScript(
      ({ d }) => {
        localStorage.removeItem('funworldmap-daily-history')
        const index = {
          generatedAt: new Date().toISOString(),
          window: { start: d, end: d },
          days: { [d]: { country: { cca3: 'FRA' }, city: { id: 'paris' } } },
        }
        ;(window as unknown as { __seededIndex?: unknown }).__seededIndex = index
      },
      { d: today },
    )
    await page.route('**/daily/index.json', async (route) => {
      const seeded = await page.evaluate(
        () => (window as unknown as { __seededIndex?: unknown }).__seededIndex,
      )
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(seeded) })
    })
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await expect(page.getByTestId('daily-share-block')).not.toBeAttached()
  })
})
