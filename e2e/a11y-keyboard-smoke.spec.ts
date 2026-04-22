import { test, expect } from '@playwright/test'
import { waitForAppReady, seedDailyHistory, stubDailyIndex } from './helpers'

test.setTimeout(60_000)

const TODAY = new Date().toISOString().slice(0, 10)

test.describe('Keyboard-only smoke — retention v1 golden path', () => {
  test('Tab through launcher lands on a focusable element in order', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })

    for (let i = 0; i < 10; i++) {
      const active = await page.evaluate(
        () => document.activeElement?.getAttribute('data-testid') ?? '',
      )
      if (active.startsWith('launcher-')) return
      await page.keyboard.press('Tab')
    }
    throw new Error('No launcher-* focusable received focus within 10 Tab presses')
  })

  test('Enter on launcher-dismiss closes the launcher', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
    const dismiss = page.getByTestId('launcher-dismiss')
    await dismiss.focus()
    await expect(dismiss).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })
  })

  test('Escape dismisses the launcher (hash root)', async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('launcher')).not.toBeAttached({ timeout: 5_000 })
  })

  test('History panel opens via Enter on launcher-history-link and Escape closes it', async ({ page }) => {
    await seedDailyHistory(page, { date: TODAY })
    await page.goto('/')
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
    const historyButton = page.getByTestId('launcher-history-link')
    await historyButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('launcher-history')).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('launcher-history')).not.toBeAttached({ timeout: 5_000 })
    await expect(page.getByTestId('launcher')).toBeVisible()
  })

  test('Calendar arrow keys move focus to a neighbour cell', async ({ page }) => {
    await seedDailyHistory(page, { date: TODAY })
    await page.goto('/')
    await waitForAppReady(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 5_000 })
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

  test('Reveal route: Tab reaches daily-share-primary without a focus trap', async ({ page }) => {
    await seedDailyHistory(page, { date: TODAY })
    await stubDailyIndex(page, TODAY)
    await page.goto(`/#daily/${TODAY}/reveal`)
    await waitForAppReady(page)
    await expect(page.getByTestId('daily-reveal')).toBeVisible({ timeout: 5_000 })
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab')
      const active = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '')
      if (active === 'daily-share-primary') return
    }
    throw new Error('daily-share-primary was not reachable via Tab within 20 presses')
  })
})
