import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import { waitForMapLoaded, waitForGameTestHook, submitAndWait } from './helpers'

async function settled(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const map = window.__funworldmap_map as {
            loaded: () => boolean
            isMoving: () => boolean
            areTilesLoaded: () => boolean
          }
          return map.loaded() && !map.isMoving() && map.areTilesLoaded()
        }),
      { timeout: 45000 },
    )
    .toBe(true)
}

test('real-map visual evidence for entry, reveals and mobile layouts', async ({ page }) => {
  test.setTimeout(120000)
  await mkdir('screenshots/playful-geography', { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('/')
  await waitForMapLoaded(page)
  // Real external tiles, unlike the deterministic interaction-suite fixtures.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const map = window.__funworldmap_map as { areTilesLoaded: () => boolean } | undefined
          return map?.areTilesLoaded()
        }),
      { timeout: 45000 },
    )
    .toBe(true)
  await settled(page)
  await page.screenshot({ path: 'screenshots/playful-geography/desktop-entry.png' })
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await settled(page)
  await page.screenshot({ path: 'screenshots/playful-geography/desktop-dark.png' })
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.getByTestId('launcher-card-country-pinning-play').click()
  await waitForGameTestHook(page)
  await expect(page.getByTestId('game-hud')).toHaveAttribute('data-game-status', 'playing')
  const tutorial = page.getByTestId('game-tutorial')
  if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'Got it' }).click()
  await page.evaluate(() => window.__funworldmap_game?.setRound?.('FRA'))
  await expect(page.getByTestId('game-prompt-name')).toHaveText('France')
  await submitAndWait(page, 'DEU')
  await expect(page.getByTestId('round-next')).toBeVisible()
  await settled(page)
  await page.screenshot({ path: 'screenshots/playful-geography/desktop-reveal.png' })
  await page.getByTestId('game-end').click()
  await page.getByTestId('end-confirm').click()
  await page.getByRole('button', { name: 'Review answers on the map' }).click()
  await expect(page.getByRole('region', { name: 'Review your answers' })).toBeVisible()
  await settled(page)
  await page.screenshot({ path: 'screenshots/playful-geography/desktop-review.png' })
  await page.getByRole('button', { name: 'Explore the map', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId('header-play').click()
  await settled(page)
  await page.screenshot({ path: 'screenshots/playful-geography/mobile-entry.png' })
  await page.getByRole('button', { name: 'Explore the map', exact: true }).click()
  await page.goto('/#FRA')
  await waitForMapLoaded(page)
  await expect(page.getByRole('button', { name: 'View map', exact: true })).toBeVisible()
  await settled(page)
  await page.screenshot({ path: 'screenshots/playful-geography/mobile-details.png' })
  await page.getByRole('button', { name: 'View map', exact: true }).click()
  await settled(page)
  await page.screenshot({ path: 'screenshots/playful-geography/mobile-map.png' })
  const renderer = await page
    .locator('canvas')
    .first()
    .evaluate((canvas) => {
      const gl = (canvas as HTMLCanvasElement).getContext('webgl2')
      if (!gl) return 'WebGL2 renderer unavailable'
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
    })
  console.log('Visual capture renderer:', renderer)
})
