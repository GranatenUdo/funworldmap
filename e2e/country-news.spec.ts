import { test, expect } from '@playwright/test'

test.setTimeout(60_000)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to the DEU country panel and wait for it to settle. */
async function openDEUPanel(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[0] : never) {
  await page.goto('/#DEU')
  const panel = page.getByTestId('country-panel')
  await expect(panel).toBeVisible({ timeout: 15_000 })
  await expect(panel).toContainText('Germany', { timeout: 15_000 })
  return panel
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('renders articles with scope badge in CountryPanel', async ({ page }) => {
  // Stub the news feed before the page loads so the fetch hits our mock.
  await page.route('**/news/DEU.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        updatedAt: new Date().toISOString(),
        country: { cca3: 'DEU', name: 'Germany' },
        guardianTag: 'world/germany',
        articles: [
          {
            id: 'world/germany/2024/apr/01/article-one',
            title: 'Germany leads climate talks',
            trailText: 'Berlin hosts EU energy summit.',
            url: 'https://www.theguardian.com/world/germany/2024/apr/01/article-one',
            publishedAt: new Date(Date.now() - 3_600_000).toISOString(), // 1 h ago
            section: 'world',
            thumbnail: null,
            scope: 'country',
          },
          {
            id: 'world/europe/2024/apr/01/article-two',
            title: 'European markets rally after ECB decision',
            trailText: 'Stocks surge across the continent.',
            url: 'https://www.theguardian.com/world/europe/2024/apr/01/article-two',
            publishedAt: new Date(Date.now() - 7_200_000).toISOString(), // 2 h ago
            section: 'world',
            thumbnail: null,
            scope: 'region',
          },
        ],
      }),
    })
  })

  await openDEUPanel(page)

  const section = page.getByTestId('country-news-section')
  await expect(section).toBeVisible({ timeout: 10_000 })

  // Both articles rendered as links
  const links = section.getByRole('link')
  await expect(links).toHaveCount(2, { timeout: 10_000 })

  // All links open in a new tab with proper rel
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', /noopener/)
  }

  // Region badge visible for the second (region-scoped) article
  await expect(section.getByText('Region')).toBeVisible()
})

test('renders empty state when articles array is empty', async ({ page }) => {
  await page.route('**/news/TUV.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        updatedAt: new Date().toISOString(),
        country: { cca3: 'TUV', name: 'Tuvalu' },
        guardianTag: null,
        articles: [],
      }),
    })
  })

  await page.goto('/#TUV')
  const panel = page.getByTestId('country-panel')
  await expect(panel).toBeVisible({ timeout: 15_000 })

  const section = page.getByTestId('country-news-section')
  await expect(section).toBeVisible({ timeout: 10_000 })
  await expect(section).toContainText('No recent Guardian stories', { timeout: 10_000 })
  // No "Browse all coverage" link because guardianTag is null
  await expect(section.getByRole('link', { name: /Browse all coverage/ })).not.toBeAttached()
})

test('renders "News unavailable" on 404', async ({ page }) => {
  await page.route('**/news/DEU.json', async (route) => {
    await route.fulfill({ status: 404, body: '' })
  })

  await openDEUPanel(page)

  const section = page.getByTestId('country-news-section')
  await expect(section).toBeVisible({ timeout: 10_000 })
  await expect(section).toContainText('News unavailable', { timeout: 10_000 })
})
