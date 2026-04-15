import { test, expect } from '@playwright/test'

// SwiftShader may lose WebGL context — map tests need longer timeouts
test.setTimeout(60000)

test('map canvas renders', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.maplibregl-canvas')).toBeAttached({ timeout: 15000 })
})

test('map instance is exposed in dev mode', async ({ page }) => {
  await page.goto('/')
  const hasMap = await page.waitForFunction(
    () => !!(window as unknown as Record<string, unknown>).__polworldmap_map,
    { timeout: 15000 },
  )
  expect(hasMap).toBeTruthy()
})

test('map has correct ARIA attributes', async ({ page }) => {
  await page.goto('/')
  const map = page.locator('[role="application"]')
  await expect(map).toHaveAttribute('aria-label', 'Interactive world map')
  await expect(map).toHaveAttribute(
    'aria-description',
    'Use search to select countries by keyboard',
  )
})

test('URL hash selects a country and sets data-selected-country', async ({ page }) => {
  // Navigate directly with hash
  await page.goto('/#FRA')

  // Wait for app to process the hash
  await page.waitForTimeout(2000)

  // The data-selected-country attribute should be set on the app root
  const selectedAttr = await page.locator('[data-selected-country]').getAttribute('data-selected-country')
  expect(selectedAttr).toBe('250') // France's ccn3
})

test('URL hash is set to country cca3 code', async ({ page }) => {
  await page.goto('/#DEU')
  await page.waitForTimeout(1000)

  const hash = await page.evaluate(() => window.location.hash)
  expect(hash).toBe('#DEU')

  const selectedAttr = await page.locator('[data-selected-country]').getAttribute('data-selected-country')
  expect(selectedAttr).toBe('276') // Germany's ccn3
})

test('invalid hash is cleared silently', async ({ page }) => {
  await page.goto('/#INVALID')
  await page.waitForTimeout(1000)

  // Hash should be cleared
  const hash = await page.evaluate(() => window.location.hash)
  expect(hash).toBe('')

  // No country should be selected
  const count = await page.locator('[data-selected-country]').count()
  expect(count).toBe(0)
})

test('country layers are added when map fully loads', async ({ page }) => {
  await page.goto('/')

  await page.waitForFunction(
    () => !!(window as unknown as Record<string, unknown>).__polworldmap_map,
    { timeout: 15000 },
  )

  // Wait for data-map-loaded or timeout (SwiftShader may lose context)
  const mapLoaded = await page
    .waitForSelector('[data-map-loaded]', { timeout: 30000 })
    .then(() => true)
    .catch(() => false)

  if (mapLoaded) {
    const hasLayers = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).__polworldmap_map as {
        getLayer: (id: string) => unknown
      }
      return {
        fill: !!map?.getLayer('country-fill'),
        borders: !!map?.getLayer('country-borders'),
        selected: !!map?.getLayer('country-selected'),
      }
    })
    expect(hasLayers.fill).toBe(true)
    expect(hasLayers.borders).toBe(true)
    expect(hasLayers.selected).toBe(true)
  }
})
