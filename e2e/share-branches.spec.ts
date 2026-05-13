import { test, expect, type Page } from '@playwright/test'
import { waitForAppReady, seedPlayedDaily, installShareStub } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.setTimeout(60_000)

async function removeNavigatorShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // `delete navigator.share` doesn't work when share is defined on the prototype;
    // override it with undefined so the app's `typeof navigator.share === 'function'` check returns false.
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    })
  })
}

async function installClipboardFailStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async () => {
        throw new Error('clipboard blocked')
      },
    })
  })
}

async function getAnalyticsEvents(
  page: Page,
): Promise<Array<{ name: string; props: Record<string, unknown> }>> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __testAnalytics: Array<{ name: string; props: Record<string, unknown> }>
        }
      ).__testAnalytics ?? [],
  )
}

test.describe('Daily share-button branches', () => {
  test('share-api success: toast "Shared!" + analytics method=share-api', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today, { captureAnalytics: true })
    await installShareStub(page, 'success')
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-primary').click()
    await expect(page.getByText('Shared!')).toBeVisible({ timeout: 5_000 })
    const events = await getAnalyticsEvents(page)
    const shared = events.find((e) => e.name === 'daily_shared')
    expect(shared?.props.method).toBe('share-api')
  })

  test('share-api AbortError: no toast, no clipboard fallback, no analytics', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today, { captureAnalytics: true })
    await installShareStub(page, 'abort')
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-primary').click()
    // Let the async handler (and its catch) complete. Two animation frames is
    // enough for the catch to settle and any toast event to be dispatched —
    // if one were going to be.
    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
    // Load-bearing assertion: no analytics event means the handler took the
    // silent-abort branch. A regression that fires the toast would also fire
    // analytics (per the source — both happen together).
    const events = await getAnalyticsEvents(page)
    expect(events.find((e) => e.name === 'daily_shared')).toBeUndefined()
    // Belt-and-suspenders: toast text never rendered (toHaveCount(0) is
    // deterministic at the moment of check, not auto-retrying).
    await expect(page.getByText('Shared!')).toHaveCount(0)
    await expect(page.getByText('Copied!')).toHaveCount(0)
  })

  test('share-api generic error: falls through to clipboard, toast "Copied!" + analytics method=clipboard-text', async ({
    page,
  }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today, { captureAnalytics: true })
    await installShareStub(page, 'fail')
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-primary').click()
    await expect(page.getByText('Copied!')).toBeVisible({ timeout: 5_000 })
    const events = await getAnalyticsEvents(page)
    expect(events.find((e) => e.name === 'daily_shared')?.props.method).toBe('clipboard-text')
  })

  test('navigator.share missing: clipboard path with toast "Copied!" + analytics method=clipboard-text', async ({
    page,
  }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today, { captureAnalytics: true })
    await removeNavigatorShare(page)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-primary').click()
    await expect(page.getByText('Copied!')).toBeVisible({ timeout: 5_000 })
    const events = await getAnalyticsEvents(page)
    expect(events.find((e) => e.name === 'daily_shared')?.props.method).toBe('clipboard-text')
  })

  test("clipboard also fails: toast \"Couldn't copy\" + no analytics", async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today, { captureAnalytics: true })
    await removeNavigatorShare(page)
    await installClipboardFailStub(page)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-primary').click()
    await expect(page.getByText(/Couldn't copy/)).toBeVisible({ timeout: 5_000 })
    const events = await getAnalyticsEvents(page)
    expect(events.find((e) => e.name === 'daily_shared')).toBeUndefined()
  })

  test('copy-link: toast "Link copied" + analytics method=clipboard-link', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today, { captureAnalytics: true })
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-copy-link').click()
    await expect(page.getByText('Link copied')).toBeVisible({ timeout: 5_000 })
    const events = await getAnalyticsEvents(page)
    expect(events.find((e) => e.name === 'daily_shared')?.props.method).toBe('clipboard-link')
  })

  test("copy-link clipboard failure: \"Couldn't copy\" toast", async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today, { captureAnalytics: true })
    await installClipboardFailStub(page)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-copy-link').click()
    await expect(page.getByText(/Couldn't copy/)).toBeVisible({ timeout: 5_000 })
  })
})
