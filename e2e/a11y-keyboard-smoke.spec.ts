import { test, expect, Page } from '@playwright/test'
import { waitForAppReady, seedDailyHistory, stubDailyIndex } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.setTimeout(60_000)

const TODAY = toLocalDateString(new Date())

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function openLauncherFresh(page: Page) {
  await page.goto('/')
  await waitForAppReady(page)
  await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
}

async function openLauncherWithHistory(page: Page) {
  await seedDailyHistory(page, { date: TODAY })
  await openLauncherFresh(page)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Keyboard-only smoke — retention v1 golden path', () => {
  test('Enter on launcher-dismiss closes the launcher', async ({ page }) => {
    await openLauncherFresh(page)
    const dismiss = page.getByTestId('launcher-dismiss')
    await dismiss.focus()
    await expect(dismiss).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })
  })

  test('Escape dismisses the launcher (hash root)', async ({ page }) => {
    await openLauncherFresh(page)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })
  })

  test('History panel opens via Enter on launcher-history-link and Escape closes it', async ({ page }) => {
    await openLauncherWithHistory(page)
    const historyButton = page.getByTestId('launcher-history-link')
    await historyButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('launcher-history')).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('launcher-history')).not.toBeAttached({ timeout: 5_000 })
    await expect(page.getByTestId('launcher')).toBeVisible()
  })

  test('Calendar arrow keys move focus to a neighbour cell', async ({ page }) => {
    await openLauncherWithHistory(page)
    await page.getByTestId('launcher-history-link').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('launcher-history')).toBeVisible({ timeout: 5_000 })
    const todayCell = page.getByTestId(`launcher-cal-${TODAY}`)
    await todayCell.focus()
    await expect(todayCell).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    const focusedTestId = await page.evaluate(
      () => document.activeElement?.getAttribute('data-testid') ?? '',
    )
    expect(focusedTestId).toMatch(/^launcher-cal-\d{4}-\d{2}-\d{2}$/)
    expect(focusedTestId).not.toBe(`launcher-cal-${TODAY}`)
  })

  test('Reveal route: Tab from close button reaches share primary', async ({ page }) => {
    await seedDailyHistory(page, { date: TODAY })
    await stubDailyIndex(page, TODAY)
    await page.goto(`/#daily/${TODAY}/reveal`)
    await waitForAppReady(page)
    await expect(page.getByTestId('daily-reveal')).toBeVisible({ timeout: 5_000 })
    // The reveal overlay's close button is the first focusable element; Tab moves to share primary.
    await page.getByTestId('daily-reveal-close').focus()
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('daily-share-primary')).toBeFocused({ timeout: 5_000 })
  })
})
