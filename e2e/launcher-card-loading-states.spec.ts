import { test, expect } from '@playwright/test'
import { toLocalDateString } from '../src/game/daily/dates'
import { waitForAppReady } from './helpers'

test.setTimeout(60_000)

const TODAY = toLocalDateString(new Date())
const YESTERDAY = toLocalDateString(
  new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1),
)

test.describe('Launcher card — loading states', () => {
  test('loading state: shows "Loading…" while index never resolves', async ({ page }) => {
    // Stub index to never resolve so the app stays in 'loading' status
    await page.route('**/daily/index.json', () => new Promise(() => {}))
    await page.goto('/')
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })

    // Both mode cards must be in loading state
    await expect(page.getByTestId('launcher-card-country-pinning')).toHaveAttribute('data-state', 'loading')
    await expect(page.getByTestId('launcher-card-city-guessing')).toHaveAttribute('data-state', 'loading')

    // Loading copy must be visible
    await expect(page.getByTestId('launcher-card-country-pinning-loading')).toBeVisible()
    await expect(page.getByTestId('launcher-card-city-guessing-loading')).toBeVisible()

    await expect(page.getByTestId('launcher-card-country-pinning-loading')).toContainText('Loading')

    // No error or no-puzzle elements
    await expect(page.getByTestId('launcher-card-country-pinning-error')).not.toBeAttached()
    await expect(page.getByTestId('launcher-card-country-pinning-no-puzzle')).not.toBeAttached()
  })

  test('unavailable-error state: shows "Couldn\'t load" copy on 404', async ({ page }) => {
    // Stub index to return 404 so fetch fails
    await page.route('**/daily/index.json', (route) => route.fulfill({ status: 404, body: '' }))
    await page.goto('/')
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })

    // Both mode cards must be in error state
    await expect(page.getByTestId('launcher-card-country-pinning')).toHaveAttribute('data-state', 'unavailable-error')
    await expect(page.getByTestId('launcher-card-city-guessing')).toHaveAttribute('data-state', 'unavailable-error')

    // Error copy must be visible
    await expect(page.getByTestId('launcher-card-country-pinning-error')).toBeVisible()
    await expect(page.getByTestId('launcher-card-city-guessing-error')).toBeVisible()

    await expect(page.getByTestId('launcher-card-country-pinning-error')).toContainText("Couldn't load today's puzzle")
    await expect(page.getByTestId('launcher-card-country-pinning-error')).toContainText('Refresh to retry')

    // No loading or no-puzzle elements
    await expect(page.getByTestId('launcher-card-country-pinning-loading')).not.toBeAttached()
    await expect(page.getByTestId('launcher-card-country-pinning-no-puzzle')).not.toBeAttached()
  })

  test('no-puzzle-today state: shows "not ready yet" copy and yesterday link', async ({ page }) => {
    // Stub index: loaded successfully but window ends before today (yesterday is latest entry)
    await page.route('**/daily/index.json', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: `${YESTERDAY}T00:00:00.000Z`,
          window: { start: YESTERDAY, end: YESTERDAY },
          days: { [YESTERDAY]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } } },
        }),
      }),
    )
    await page.goto('/')
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })

    // Both mode cards must be in no-puzzle-today state
    await expect(page.getByTestId('launcher-card-country-pinning')).toHaveAttribute('data-state', 'no-puzzle-today')
    await expect(page.getByTestId('launcher-card-city-guessing')).toHaveAttribute('data-state', 'no-puzzle-today')

    // "Not ready yet" copy must be visible
    await expect(page.getByTestId('launcher-card-country-pinning-no-puzzle')).toBeVisible()
    await expect(page.getByTestId('launcher-card-country-pinning-no-puzzle')).toContainText("isn't ready yet")

    // "Try [yesterday]'s daily →" link must be present and point to the right hash
    const link = page.getByTestId('launcher-card-country-pinning-no-puzzle-link')
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', `#daily/${YESTERDAY}/reveal`)

    // No loading or error elements
    await expect(page.getByTestId('launcher-card-country-pinning-loading')).not.toBeAttached()
    await expect(page.getByTestId('launcher-card-country-pinning-error')).not.toBeAttached()
  })
})
