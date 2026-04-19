import { test, expect } from '@playwright/test'

// Map interaction tests need the map to FULLY load.
// If these fail, that's a real bug — not silently skipped.
test.setTimeout(60000)

/** Wait for the map to be fully loaded with country layers */
async function waitForMapReady(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 45000 })
}

test.describe('Map rendering', () => {
  test('map loads with country boundary layers', async ({ page }) => {
    await page.goto('/')
    await waitForMapReady(page)

    const hasLayers = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).__funworldmap_map as {
        getLayer: (id: string) => unknown
        getSource: (id: string) => unknown
      }
      return {
        source: !!map.getSource('countries'),
        fill: !!map.getLayer('country-fill'),
        borders: !!map.getLayer('country-borders'),
        selected: !!map.getLayer('country-selected'),
      }
    })

    expect(hasLayers.source).toBe(true)
    expect(hasLayers.fill).toBe(true)
    expect(hasLayers.borders).toBe(true)
    expect(hasLayers.selected).toBe(true)
  })

  test('GeoJSON features have valid IDs in properties', async ({ page }) => {
    await page.goto('/')
    await waitForMapReady(page)

    // Wait for tiles to render
    await page.waitForTimeout(2000)

    const result = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).__funworldmap_map as {
        queryRenderedFeatures: (
          point: [number, number],
          options: { layers: string[] },
        ) => Array<{ id: unknown; properties: Record<string, unknown> }>
        getCanvas: () => HTMLCanvasElement
      }

      // Query at center of viewport to find rendered features
      const canvas = map.getCanvas()
      const cx = canvas.clientWidth / 2
      const cy = canvas.clientHeight / 2

      for (let dx = -100; dx <= 100; dx += 20) {
        for (let dy = -100; dy <= 100; dy += 20) {
          const features = map.queryRenderedFeatures([cx + dx, cy + dy], {
            layers: ['country-fill'],
          })
          if (features.length > 0) {
            const f = features[0]
            return {
              count: features.length,
              sampleId: f.id,
              hasPropsId: 'id' in f.properties,
              propsIdValue: f.properties.id,
              idsMatch: String(f.id) === String(f.properties.id),
            }
          }
        }
      }
      return { count: 0, sampleId: null, hasPropsId: false, propsIdValue: null, idsMatch: false }
    })

    expect(result.count).toBeGreaterThan(0)
    expect(result.hasPropsId).toBe(true)
    expect(result.idsMatch).toBe(true)
  })
})

test.describe('Country click interaction', () => {
  test('clicking a country sets URL hash and opens panel', async ({ page }) => {
    await page.goto('/')
    await waitForMapReady(page)

    // Find a country feature at the center of the viewport and click it
    const clicked = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).__funworldmap_map as {
        queryRenderedFeatures: (
          point: [number, number],
          options: { layers: string[] },
        ) => Array<{ id: unknown; properties: Record<string, unknown> }>
        getCanvas: () => HTMLCanvasElement
      }
      const canvas = map.getCanvas()
      const cx = canvas.clientWidth / 2
      const cy = canvas.clientHeight / 2

      // Search in a grid around center to find a country
      for (let dx = -100; dx <= 100; dx += 20) {
        for (let dy = -100; dy <= 100; dy += 20) {
          const features = map.queryRenderedFeatures([cx + dx, cy + dy], {
            layers: ['country-fill'],
          })
          if (features.length > 0) {
            return { x: cx + dx, y: cy + dy, featureId: String(features[0].id) }
          }
        }
      }
      return null
    })

    expect(clicked).not.toBeNull()

    // Click at the found coordinates
    await page.mouse.click(clicked!.x, clicked!.y)
    await page.waitForTimeout(1000)

    // Hash should be set (some 3-letter country code)
    const hash = await page.evaluate(() => window.location.hash)
    expect(hash).toMatch(/^#[A-Z]{3}$/)

    // Panel should be open
    await expect(page.getByTestId('country-panel')).toBeVisible()
  })

  test('clicking ocean deselects country and closes panel', async ({ page }) => {
    // Start with default view (no hash)
    await page.goto('/')
    await waitForMapReady(page)

    // First, click a country to select it
    const countryPoint = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).__funworldmap_map as {
        queryRenderedFeatures: (
          point: [number, number],
          options: { layers: string[] },
        ) => Array<{ id: unknown }>
        getCanvas: () => HTMLCanvasElement
      }
      const canvas = map.getCanvas()
      const cx = canvas.clientWidth / 2
      const cy = canvas.clientHeight / 2

      for (let dx = -100; dx <= 100; dx += 20) {
        for (let dy = -100; dy <= 100; dy += 20) {
          const features = map.queryRenderedFeatures([cx + dx, cy + dy], {
            layers: ['country-fill'],
          })
          if (features.length > 0) return { x: cx + dx, y: cy + dy }
        }
      }
      return null
    })

    expect(countryPoint).not.toBeNull()
    await page.mouse.click(countryPoint!.x, countryPoint!.y)
    await page.waitForTimeout(1500)

    // Verify a country is now selected
    const hashAfterSelect = await page.evaluate(() => window.location.hash)
    expect(hashAfterSelect).toMatch(/^#[A-Z]{3}$/)
    await expect(page.getByTestId('country-panel')).toBeVisible()

    // Jump camera to mid-Pacific (guaranteed ocean) without changing hash.
    // Resolve on `idle` but also on a 5 s timeout — under headless Chrome
    // without a GPU, `idle` can be delayed indefinitely if tile fetches
    // stall, and the subsequent click is what matters (not bytes arriving).
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const map = (window as unknown as Record<string, unknown>).__funworldmap_map as {
          jumpTo: (opts: { center: [number, number]; zoom: number }) => void
          once: (event: string, fn: () => void) => void
        }
        const done = (): void => resolve()
        map.jumpTo({ center: [-170, 0], zoom: 4 })
        map.once('idle', done)
        setTimeout(done, 5000)
      })
    })
    await page.waitForTimeout(500)

    // Click center of viewport — should be ocean
    const canvas = page.locator('.maplibregl-canvas')
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.waitForTimeout(1000)

    // Hash should be cleared
    const hash = await page.evaluate(() => window.location.hash)
    expect(hash).toBe('')

    // Panel should be gone
    await expect(page.getByTestId('country-panel')).not.toBeAttached()
  })
})

test.describe('Country selection via hash', () => {
  test('navigating to #FRA selects France with highlight', async ({ page }) => {
    await page.goto('/#FRA')
    await waitForMapReady(page)

    // data-selected-country should be set
    const attr = await page
      .locator('[data-selected-country]')
      .getAttribute('data-selected-country')
    expect(attr).toBe('250')

    // The country-selected layer filter should match France's ID
    const filter = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).__funworldmap_map as {
        getFilter: (layerId: string) => unknown
      }
      return map.getFilter('country-selected')
    })
    expect(filter).toEqual(['==', ['get', 'id'], '250'])

    // Panel should show France
    await expect(page.getByTestId('country-panel')).toContainText('France')
  })

  test('invalid hash is cleared and no panel shown', async ({ page }) => {
    await page.goto('/#INVALID')
    await page.waitForTimeout(1000)

    const hash = await page.evaluate(() => window.location.hash)
    expect(hash).toBe('')
    await expect(page.getByTestId('country-panel')).not.toBeAttached()
  })
})

test.describe('Hover interaction', () => {
  test('hovering over a country changes cursor to pointer', async ({ page }) => {
    await page.goto('/')
    await waitForMapReady(page)

    // Find a country feature
    const point = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).__funworldmap_map as {
        queryRenderedFeatures: (
          point: [number, number],
          options: { layers: string[] },
        ) => unknown[]
        getCanvas: () => HTMLCanvasElement
      }
      const canvas = map.getCanvas()
      const cx = canvas.clientWidth / 2
      const cy = canvas.clientHeight / 2

      for (let dx = -100; dx <= 100; dx += 20) {
        for (let dy = -100; dy <= 100; dy += 20) {
          const features = map.queryRenderedFeatures([cx + dx, cy + dy], {
            layers: ['country-fill'],
          })
          if (features.length > 0) return { x: cx + dx, y: cy + dy }
        }
      }
      return null
    })

    expect(point).not.toBeNull()

    // Move mouse to the country
    await page.mouse.move(point!.x, point!.y)
    await page.waitForTimeout(500)

    // Canvas cursor should be 'pointer'
    const cursor = await page.evaluate(() => {
      const canvas = document.querySelector('.maplibregl-canvas') as HTMLCanvasElement
      return canvas?.style.cursor
    })
    expect(cursor).toBe('pointer')
  })
})
