import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)

async function waitForMap(page: Page) {
  // Accept either a clean load or a map error (timeout / style failure) so that
  // tests are not held up by basemap network variance. The country panel and news
  // section render independently of the map tile state.
  await page.waitForSelector('[data-map-loaded], [data-map-error]', { timeout: 60_000 })
}

async function stubNewsDEU(page: Page) {
  await page.route('**/news/DEU.json', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        updatedAt: new Date().toISOString(),
        country: { cca3: 'DEU', name: 'Germany' },
        articles: [
          {
            id: 'https://www.bbc.com/germany-coalition',
            title: 'Germany coalition reached',
            url: 'https://www.bbc.com/germany-coalition',
            publishedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
            domain: 'bbc.com',
            thumbnail: null,
          },
          {
            id: 'https://www.reuters.com/eu-summit',
            title: 'EU summit concludes',
            url: 'https://www.reuters.com/eu-summit',
            publishedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
            domain: 'reuters.com',
            thumbnail: null,
          },
        ],
      }),
    })
  })
}

test.describe('Country news feed', () => {
  test('renders articles with domain label + GDELT attribution', async ({ page }) => {
    await stubNewsDEU(page)
    await page.goto('/#DEU')
    await waitForMap(page)
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('country-news-section')).toBeVisible({ timeout: 5_000 })

    const section = page.getByTestId('country-news-section')
    // 2 article links + 1 GDELT attribution link = 3 links total
    await expect(section.getByRole('link')).toHaveCount(3, { timeout: 5_000 })

    // Domain labels visible
    await expect(section.getByText('bbc.com')).toBeVisible()
    await expect(section.getByText('reuters.com')).toBeVisible()

    // GDELT attribution
    await expect(section.getByText(/GDELT Project/i)).toBeVisible()

    // External link behavior
    const firstArticleLink = section.getByRole('link').first()
    await expect(firstArticleLink).toHaveAttribute('target', '_blank')
    const rel = await firstArticleLink.getAttribute('rel')
    expect(rel ?? '').toContain('noopener')
  })

  test('renders empty state when articles array is empty', async ({ page }) => {
    await page.route('**/news/TUV.json', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          updatedAt: new Date().toISOString(),
          country: { cca3: 'TUV', name: 'Tuvalu' },
          articles: [],
        }),
      })
    })
    await page.goto('/#TUV')
    await waitForMap(page)
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByTestId('country-news-section').getByText(/No recent English-language news/i),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('renders "News unavailable" on 404', async ({ page }) => {
    await page.route('**/news/FRA.json', (route) => route.fulfill({ status: 404 }))
    await page.goto('/#FRA')
    await waitForMap(page)
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByTestId('country-news-section').getByText(/News unavailable/i),
    ).toBeVisible({ timeout: 5_000 })
  })
})
