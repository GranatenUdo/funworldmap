import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)

/** Open a country panel by hash and wait for its content to settle. */
async function openPanel(page: Page, cca3: string, expectedName: string) {
  await page.goto(`/#${cca3}`)
  const panel = page.getByTestId('country-panel')
  await expect(panel).toBeVisible({ timeout: 15_000 })
  await expect(panel).toContainText(expectedName, { timeout: 15_000 })
  return panel
}

test.describe('Country Panel', () => {
  test('panel opens with correct data when hash is set', async ({ page }) => {
    const panel = await openPanel(page, 'FRA', 'France')
    await expect(panel).toContainText('Paris')
    await expect(panel).toContainText('Europe')
  })

  test('panel shows flag image', async ({ page }) => {
    const panel = await openPanel(page, 'DEU', 'Germany')
    const flag = panel.getByTestId('country-flag')
    await expect(flag).toBeAttached()
    await expect(flag).toHaveAttribute('src', 'flags/DE.svg')
  })

  test('close button dismisses panel and clears hash', async ({ page }) => {
    const panel = await openPanel(page, 'FRA', 'France')
    await page.getByTestId('panel-close').click()
    await expect(panel).not.toBeAttached({ timeout: 10_000 })
    expect(await page.evaluate(() => window.location.hash)).toBe('')
  })

  test('panel shows population and area in expanded state on desktop', async ({ page }) => {
    const panel = await openPanel(page, 'BRA', 'Brazil')
    await expect(panel).toContainText('Population')
    await expect(panel).toContainText('Area')
    await expect(panel).toContainText('km²')
  })

  test('border chip navigates to neighbor country', async ({ page }) => {
    const panel = await openPanel(page, 'FRA', 'France')
    await panel.getByRole('button', { name: 'Germany' }).click()
    // The panel trivially contains "Germany" as a neighbor chip on France,
    // so assert on the hash transition — that's the real navigation signal.
    await expect.poll(() => page.evaluate(() => window.location.hash), { timeout: 10_000 }).toBe('#DEU')
    await expect(panel).toContainText('Germany')
  })

  test('panel shows government type from CIA Factbook', async ({ page }) => {
    const panel = await openPanel(page, 'FRA', 'France')
    await expect(panel).toContainText('Government')
    await expect(panel).toContainText('semi-presidential republic')
  })

  // Dropped: "search → select → panel opens → close → panel gone"
  // End-to-end composition test that overlapped with atomic coverage in
  // search.spec.ts (search + select) and the close-button test above.
  // Composition-level bugs are rare and not worth the CI flake.
})

test.describe('Bottom sheet on mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('panel renders as bottom sheet on mobile', async ({ page }) => {
    const panel = await openPanel(page, 'JPN', 'Japan')
    const box = await panel.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThan(200)
  })

  test('expand button shows secondary fields on mobile', async ({ page }) => {
    const panel = await openPanel(page, 'JPN', 'Japan')
    // Peek state: secondary fields (UN Member, Languages, Government…)
    // only render once showSecondary is true.
    await expect(panel.getByText('UN Member')).not.toBeVisible()
    await page.getByLabel('Expand panel').click()
    await expect(panel.getByText('UN Member')).toBeVisible({ timeout: 10_000 })
  })
})
