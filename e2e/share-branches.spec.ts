import { test, expect, type Page } from '@playwright/test'
import { waitForAppReady } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.setTimeout(60_000)

/** Seed a played country-pinning daily for `date` and stub /daily/index.json. */
async function seedPlayedDaily(page: Page, date: string): Promise<void> {
  await page.addInitScript(
    ({ d }) => {
      ;(window as unknown as { __PLAYWRIGHT__: boolean }).__PLAYWRIGHT__ = true
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

async function installShareSuccessStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { __lastShare?: unknown }).__lastShare = undefined
    // @ts-expect-error — test-time installation
    navigator.share = async (data: { title: string; text: string; url: string }) => {
      ;(window as unknown as { __lastShare?: unknown }).__lastShare = data
    }
  })
}

async function installShareAbortStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // @ts-expect-error — test-time installation
    navigator.share = async () => {
      const err = new Error('user cancelled') as Error & { name: string }
      err.name = 'AbortError'
      throw err
    }
  })
}

async function installShareGenericFailureStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // @ts-expect-error — test-time installation
    navigator.share = async () => {
      throw new Error('share not allowed')
    }
  })
}

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
    await seedPlayedDaily(page, today)
    await installShareSuccessStub(page)
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
    await seedPlayedDaily(page, today)
    await installShareAbortStub(page)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-primary').click()
    // The click handler's promise resolves (AbortError caught, early return) —
    // assert neither toast appears and no analytics event was pushed.
    await expect(page.getByText('Shared!')).not.toBeVisible()
    await expect(page.getByText('Copied!')).not.toBeVisible()
    const events = await getAnalyticsEvents(page)
    expect(events.find((e) => e.name === 'daily_shared')).toBeUndefined()
  })

  test('share-api generic error: falls through to clipboard, toast "Copied!" + analytics method=clipboard-text', async ({
    page,
  }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today)
    await installShareGenericFailureStub(page)
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
    await seedPlayedDaily(page, today)
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
    await seedPlayedDaily(page, today)
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
    await seedPlayedDaily(page, today)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-copy-link').click()
    await expect(page.getByText('Link copied')).toBeVisible({ timeout: 5_000 })
    const events = await getAnalyticsEvents(page)
    expect(events.find((e) => e.name === 'daily_shared')?.props.method).toBe('clipboard-link')
  })

  test("copy-link clipboard failure: \"Couldn't copy\" toast", async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today)
    await installClipboardFailStub(page)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-copy-link').click()
    await expect(page.getByText(/Couldn't copy/)).toBeVisible({ timeout: 5_000 })
  })
})
