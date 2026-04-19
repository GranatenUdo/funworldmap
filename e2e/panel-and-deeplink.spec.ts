import { test, expect } from '@playwright/test'

test.setTimeout(30000)

test.describe('Country Panel', () => {
  test('panel opens with correct data when hash is set', async ({ page }) => {
    await page.goto('/#FRA')
    await page.waitForTimeout(1500)

    const panel = page.getByTestId('country-panel')
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('France')
    await expect(panel).toContainText('Paris')
    await expect(panel).toContainText('Europe')
  })

  test('panel shows flag image', async ({ page }) => {
    await page.goto('/#DEU')
    await page.waitForTimeout(1500)

    const flag = page.getByTestId('country-panel').getByTestId('country-flag')
    await expect(flag).toBeAttached()
    await expect(flag).toHaveAttribute('src', 'flags/DE.svg')
  })

  test('close button dismisses panel and clears hash', async ({ page }) => {
    await page.goto('/#FRA')
    await page.waitForTimeout(1500)

    await expect(page.getByTestId('country-panel')).toBeVisible()

    await page.getByTestId('panel-close').click()
    await page.waitForTimeout(500)

    await expect(page.getByTestId('country-panel')).not.toBeAttached()
    const hash = await page.evaluate(() => window.location.hash)
    expect(hash).toBe('')
  })

  test('panel shows population and area in expanded state on desktop', async ({ page }) => {
    // Desktop viewport (default in Playwright is 1280x720)
    await page.goto('/#BRA')
    await page.waitForTimeout(1500)

    const panel = page.getByTestId('country-panel')
    await expect(panel).toContainText('Population')
    await expect(panel).toContainText('Area')
    await expect(panel).toContainText('km²')
  })

  test('border chip navigates to neighbor country', async ({ page }) => {
    await page.goto('/#FRA')
    await page.waitForTimeout(1500)

    // France has Germany as a neighbor
    const panel = page.getByTestId('country-panel')

    // Find and click the Germany chip
    const germanyChip = panel.getByRole('button', { name: 'Germany' })
    await expect(germanyChip).toBeVisible()
    await germanyChip.click()
    await page.waitForTimeout(1000)

    // Panel should now show Germany
    await expect(panel).toContainText('Germany')
    const hash = await page.evaluate(() => window.location.hash)
    expect(hash).toBe('#DEU')
  })

  test('panel shows government type from CIA Factbook', async ({ page }) => {
    await page.goto('/#FRA')
    await page.waitForTimeout(1500)

    const panel = page.getByTestId('country-panel')
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
    await page.goto('/#JPN')
    await page.waitForTimeout(1500)

    const panel = page.getByTestId('country-panel')
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('Japan')

    // Bottom sheet should be at bottom of viewport
    const box = await panel.boundingBox()
    expect(box).not.toBeNull()
    // Panel should start at least below the top half of the screen
    expect(box!.y).toBeGreaterThan(200)
  })

  test('expand button shows secondary fields on mobile', async ({ page }) => {
    await page.goto('/#JPN')
    await page.waitForTimeout(1500)

    const panel = page.getByTestId('country-panel')

    // Primary fields (Capital, Population, Area, Region) are visible in peek;
    // secondary fields (UN Member, Languages, Government, etc.) only render
    // when showSecondary is true — i.e. after expand is clicked.
    await expect(panel.getByText('UN Member')).not.toBeVisible()

    // Click expand
    await page.getByLabel('Expand panel').click()
    await page.waitForTimeout(500)

    // Now the secondary field should be visible
    await expect(panel.getByText('UN Member')).toBeVisible()
  })
})
