import { test, expect } from '@playwright/test'

test.describe('head metadata', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('has Open Graph tags', async ({ page }) => {
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /funworldmap/i)
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /.{40,}/)
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website')
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-image\.png$/)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /^https?:\/\//)
  })

  test('has Twitter Card tags', async ({ page }) => {
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', /funworldmap/i)
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', /og-image\.png$/)
  })

  test('has theme-color and canonical', async ({ page }) => {
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', /^#[0-9a-f]{3,6}$/i)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https?:\/\//)
  })

  test('preloads Outfit font', async ({ page }) => {
    const preload = page.locator('link[rel="preload"][as="font"]').first()
    await expect(preload).toHaveAttribute('href', /outfit-latin\.woff2$/)
    await expect(preload).toHaveAttribute('crossorigin', '')
  })
})

test.describe('static files', () => {
  test('robots.txt is served', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('User-agent: *')
    expect(body).toMatch(/Sitemap:\s*https?:\/\//)
  })

  test('sitemap.xml is served and well-formed', async ({ request }) => {
    const res = await request.get('/sitemap.xml')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('<urlset')
    expect(body).toMatch(/<loc>https?:\/\/[^<]+<\/loc>/)
  })
})
