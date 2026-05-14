import { test, expect } from '@playwright/test'
import { waitForAppReady, seedPlayedDaily, installShareStub } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.setTimeout(60_000)

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
    await installShareStub(page, 'success')
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
