import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)

async function freshTab(page: Page, hash = ''): Promise<void> {
  await page.goto(hash === '' ? '/' : `/${hash}`)
}

test.describe('Launcher — visibility', () => {
  test('appears on cold load at /', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
  })

  test('does NOT appear on cold load at /#FRA (deep-link bypass)', async ({ page }) => {
    await freshTab(page, '#FRA')
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('launcher')).not.toBeVisible()
  })

  test('does NOT appear on cold load at /#game/country-pinning', async ({ page }) => {
    await freshTab(page, '#game/country-pinning')
    await expect(page.getByTestId('launcher')).not.toBeVisible()
  })
})

test.describe('Launcher — dismiss paths', () => {
  test('clicking "Just explore the map" dismisses and focuses search', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('launcher-dismiss').click()
    await expect(page.getByTestId('launcher')).not.toBeVisible()
    await expect(page.getByTestId('search-input')).toBeFocused()
  })

  test('typing in search dismisses on first non-empty change', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('search-input').fill('F')
    await expect(page.getByTestId('launcher')).not.toBeVisible({ timeout: 3_000 })
    await expect(page.getByTestId('search-input')).toBeFocused()
  })

  test('focusing search without typing does NOT dismiss', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('search-input').focus()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('launcher')).toBeVisible()
  })

  test('clicking a mode card dismisses and starts that game', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('launcher-mode-country-pinning').click()
    await expect(page.getByTestId('launcher')).not.toBeVisible({ timeout: 3_000 })
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 5_000 })
      .toContain('game/country-pinning')
  })

  test('pressing Escape dismisses and focuses search', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('launcher')).not.toBeVisible({ timeout: 3_000 })
    await expect(page.getByTestId('search-input')).toBeFocused()
  })

  test('clicking the backdrop area does NOT dismiss', async ({ page }) => {
    await freshTab(page)
    const launcher = page.getByTestId('launcher')
    await expect(launcher).toBeVisible({ timeout: 10_000 })
    const viewport = page.viewportSize() || { width: 1280, height: 720 }
    await page.mouse.click(10, 10)
    await page.waitForTimeout(400)
    await expect(launcher).toBeVisible()
    await page.mouse.click(viewport.width - 10, viewport.height - 10)
    await page.waitForTimeout(400)
    await expect(launcher).toBeVisible()
  })
})

test.describe('Launcher — session scope', () => {
  test('dismissing + reloading re-shows launcher', async ({ page }) => {
    await freshTab(page)
    await page.getByTestId('launcher-dismiss').click()
    await expect(page.getByTestId('launcher')).not.toBeVisible()
    await page.reload()
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
  })

  test('dismissing + closing a country panel does NOT re-show launcher', async ({ page }) => {
    await freshTab(page)
    await page.getByTestId('launcher-dismiss').click()
    await page.getByTestId('search-input').fill('France')
    const firstResult = page.getByTestId('search-results').getByRole('option').first()
    await expect(firstResult).toBeVisible({ timeout: 10_000 })
    await firstResult.click({ force: true })
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('panel-close').click()
    await page.waitForTimeout(500)
    await expect(page.getByTestId('launcher')).not.toBeVisible()
  })
})

test.describe('Launcher — header behaviour', () => {
  test('play + satellite hidden while launcher visible', async ({ page }) => {
    await freshTab(page)
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('header-play')).not.toBeVisible()
    await expect(page.getByTestId('satellite-toggle')).not.toBeVisible()
  })

  test('play + satellite restored after dismiss', async ({ page }) => {
    await freshTab(page)
    await page.getByTestId('launcher-dismiss').click()
    await expect(page.getByTestId('header-play')).toBeVisible()
    await expect(page.getByTestId('satellite-toggle')).toBeVisible()
  })

  test('play button re-opens launcher', async ({ page }) => {
    await freshTab(page)
    await page.getByTestId('launcher-dismiss').click()
    await expect(page.getByTestId('launcher')).not.toBeVisible()
    await page.getByTestId('header-play').click()
    await expect(page.getByTestId('launcher')).toBeVisible({ timeout: 3_000 })
  })
})

test.describe('Launcher — personal bests', () => {
  test('first-play state shows em-dash placeholder', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('funworldmap-game-country-pinning-bests')
      localStorage.removeItem('funworldmap-game-city-guessing-bests')
    })
    await freshTab(page)
    const cpBest = page.getByTestId('launcher-best-country-pinning')
    await expect(cpBest).toContainText('—')
    await expect(cpBest).toContainText('/ 1000')
  })

  test('numeric best displays when stored', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'funworldmap-game-country-pinning-bests',
        JSON.stringify({ bestScore: 920, bestStreak: 6, gamesPlayed: 3 }),
      )
    })
    await freshTab(page)
    const cpBest = page.getByTestId('launcher-best-country-pinning')
    await expect(cpBest).toContainText('920')
  })
})

test.describe('Launcher — accessibility', () => {
  test('has dialog role + aria-modal + aria-label', async ({ page }) => {
    await freshTab(page)
    const launcher = page.getByTestId('launcher')
    await expect(launcher).toBeVisible({ timeout: 10_000 })
    await expect(launcher).toHaveAttribute('role', 'dialog')
    await expect(launcher).toHaveAttribute('aria-modal', 'true')
    await expect(launcher).toHaveAttribute('aria-label', 'Choose how to play')
  })

  test('initial focus lands on last-played mode card', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('funworldmap-game-last-mode', 'city-guessing')
    })
    await freshTab(page)
    await expect(page.getByTestId('launcher-mode-city-guessing')).toBeFocused({ timeout: 5_000 })
  })

  test('Tab cycles through mode card 1, mode card 2, dismiss link, wraps', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('funworldmap-game-last-mode', 'country-pinning')
    })
    await freshTab(page)
    await expect(page.getByTestId('launcher-mode-country-pinning')).toBeFocused({ timeout: 5_000 })
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-mode-city-guessing')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-dismiss')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('launcher-mode-country-pinning')).toBeFocused()
  })
})
