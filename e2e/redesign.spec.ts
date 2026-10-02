import type { GameSession } from '../src/game/shared/types'
import { test, expect, type Page } from '@playwright/test'
import {
  gotoAndWaitForMap,
  waitForGameTestHook,
  ensureLauncherDismissed,
  submitAndWait,
} from './helpers'

test('fresh entry is game-first and the chooser remains usable on short screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 568, height: 320 })
  await gotoAndWaitForMap(page, '/')
  await expect(
    page.getByRole('heading', { name: 'How well do you know your world?' }),
  ).toBeVisible()
  await expect(page.getByTestId('launcher-card-city-guessing-play')).toBeEnabled()
  await page.getByRole('button', { name: 'Explore the map' }).click()
  await expect(page.getByTestId('launcher')).not.toBeAttached()
  await expect(page.getByTestId('header-play')).toBeVisible()
  await expect(page.locator('main')).not.toHaveAttribute('inert', '')
})

test('manual country results, facts dismissal, map review and replay preserve one result', async ({
  page,
}) => {
  await gotoAndWaitForMap(page, '/#game/country-pinning')
  await waitForGameTestHook(page)
  await expect(page.getByTestId('game-hud')).toHaveAttribute('data-game-status', 'playing')
  const tutorial = page.getByTestId('game-tutorial')
  if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'Got it' }).click()
  await page.evaluate(() => window.__funworldmap_game?.setRound?.('FRA'))
  await expect(page.getByTestId('game-prompt-name')).toHaveText('France')
  await submitAndWait(page, 'DEU')
  await expect(page.getByTestId('round-result')).toContainText('France')
  const hudBox = await page.getByTestId('game-hud').boundingBox()
  expect(hudBox?.x).toBeGreaterThanOrEqual(0)
  await page.getByText('Learn about France', { exact: true }).click()
  await expect(
    page.getByText('Country facts; dataset updates are not measurement dates.'),
  ).toBeVisible()
  await page.getByText('Learn about France', { exact: true }).press('Escape')
  await expect(page.getByTestId('round-next')).toHaveText(/Next round/)
  await page.getByTestId('round-next').click()
  await expect(page.getByTestId('game-hud')).toHaveAttribute('data-game-status', 'playing')
  await page.getByTestId('game-end').click()
  await page.getByTestId('end-confirm').click()
  await expect(page.getByTestId('game-over')).toHaveAttribute('aria-modal', 'true')
  const score = await page.getByTestId('game-over-score').innerText()
  await page.getByRole('button', { name: 'Review answers on the map' }).click()
  await expect(page.getByRole('region', { name: 'Review your answers' })).toBeVisible()
  await expect(page.getByRole('application')).not.toHaveAttribute('inert', '')
  await expect(page.getByRole('button', { name: 'Next answer' })).toBeDisabled()
  await page.getByRole('button', { name: 'Back to results' }).click()
  await expect(page.getByTestId('game-over-score')).toHaveText(score)
  await page.getByTestId('game-over-play-again').click()
  await expect(page.getByTestId('game-hud')).toHaveAttribute('data-game-status', 'playing')
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window.__funworldmap_game?.getSession?.() as GameSession | undefined)?.completedRounds
            .length,
      ),
    )
    .toBe(0)
})

test('mobile reference switches between details and map without losing selection', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoAndWaitForMap(page, '/#FRA')
  await ensureLauncherDismissed(page)
  await expect(page.getByRole('button', { name: 'View map', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'View map', exact: true }).click()
  await expect(page.getByTestId('country-panel')).toBeHidden()
  await page.getByRole('button', { name: 'View details', exact: true }).click()
  await expect(page.getByTestId('country-panel')).toBeVisible()
  await expect(page).toHaveURL(/#FRA$/)
})

test('launching a game restores map input after the modal chooser closes', async ({ page }) => {
  await gotoAndWaitForMap(page, '/')
  await page.getByTestId('launcher-card-country-pinning-play').click()
  await expect(page.getByTestId('game-hud')).toHaveAttribute('data-game-status', 'playing')
  await expect(page.locator('main')).not.toHaveAttribute('inert', '')
})

test('review survives map failure, recovery, resize, and ordinary-motion replay', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoAndWaitForMap(page, '/#game/country-pinning')
  await waitForGameTestHook(page)
  await expect(page.getByTestId('game-hud')).toHaveAttribute('data-game-status', 'playing')
  const tutorial = page.getByTestId('game-tutorial')
  if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'Got it' }).click()
  await page.evaluate(() => window.__funworldmap_game?.setRound?.('FRA'))
  await expect(page.getByTestId('game-prompt-name')).toHaveText('France')
  await submitAndWait(page, 'DEU')
  await page.getByTestId('game-end').click()
  await page.getByTestId('end-confirm').click()
  const savedScore = await page.getByTestId('game-over-score').innerText()
  // Exercise the readiness/error signal without actually losing the test GPU context.
  await page
    .locator('[data-map-loaded]')
    .evaluate((el) => el.setAttribute('data-map-error', 'webgl-lost'))
  await expect(page.getByTestId('game-over-play-again')).toBeDisabled()
  await expect(
    page.getByTestId('game-over').getByRole('button', { name: 'Retry map' }),
  ).toBeVisible()
  await page.locator('[data-map-loaded]').evaluate((el) => el.removeAttribute('data-map-error'))
  await expect(page.getByTestId('game-over-play-again')).toBeEnabled()
  await expect(page.getByTestId('game-over-score')).toHaveText(savedScore)
  await page.getByRole('button', { name: 'Review answers on the map' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(() =>
      page.evaluate(() => {
        const map = window.__funworldmap_map as {
          project: (p: [number, number]) => { x: number; y: number }
        }
        const p = map.project([2, 46])
        return p.x > 0 && p.x < 390 && p.y > 60 && p.y < 460
      }),
    )
    .toBe(true)
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect
    .poll(() =>
      page.evaluate(() => {
        const map = window.__funworldmap_map as {
          project: (p: [number, number]) => { x: number; y: number }
        }
        const p = map.project([2, 46])
        return p.x > 0 && p.x < 1000 && p.y > 60 && p.y < 880
      }),
    )
    .toBe(true)
  await page.getByTestId('game-over-play-again').click()
  await expect(page.getByTestId('game-hud')).toHaveAttribute('data-game-status', 'playing')
  await expect
    .poll(() =>
      page.evaluate(() => {
        const map = window.__funworldmap_map as {
          getCenter: () => { lng: number; lat: number }
          getZoom: () => number
        }
        const c = map.getCenter()
        return {
          lng: Math.round(c.lng),
          lat: Math.round(c.lat),
          zoom: Math.round(map.getZoom() * 10) / 10,
        }
      }),
    )
    .toEqual({ lng: 0, lat: 20, zoom: 1.8 })
})

async function enterHistoricalReview(page: Page) {
  await gotoAndWaitForMap(page, '/#game/country-pinning')
  await waitForGameTestHook(page)
  await expect(page.getByTestId('game-hud')).toHaveAttribute('data-game-status', 'playing')
  const tutorial = page.getByTestId('game-tutorial')
  if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'Got it' }).click()
  await page.evaluate(() => window.__funworldmap_game?.setRound?.('FRA'))
  await expect(page.getByTestId('game-prompt-name')).toHaveText('France')
  await submitAndWait(page, 'DEU')
  await page.getByTestId('game-end').click()
  await page.getByTestId('end-confirm').click()
  await page.getByRole('button', { name: 'Review answers on the map' }).click()
}

test('review camera follows the desktop-to-phone panel transition', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await enterHistoricalReview(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(() =>
      page.evaluate(() => {
        const map = window.__funworldmap_map as {
          project: (p: [number, number]) => { x: number; y: number }
        }
        const p = map.project([2, 46])
        return p.x > 0 && p.x < 390 && p.y > 60 && p.y < 460
      }),
    )
    .toBe(true)
})

test('replay from review completes the home reset with ordinary motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await enterHistoricalReview(page)
  await page.getByTestId('game-over-play-again').click()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const map = window.__funworldmap_map as {
          getCenter: () => { lng: number; lat: number }
          getZoom: () => number
        }
        const c = map.getCenter()
        return {
          lng: Math.round(c.lng),
          lat: Math.round(c.lat),
          zoom: Math.round(map.getZoom() * 10) / 10,
        }
      }),
    )
    .toEqual({ lng: 0, lat: 20, zoom: 1.8 })
})
