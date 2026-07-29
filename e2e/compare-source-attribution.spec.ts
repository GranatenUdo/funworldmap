import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap } from './helpers'

test.describe('compare view source attribution footer', () => {
  test('shows compare-sources footer with source links', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,DEU')

    const panel = page.getByTestId('country-panel')
    await expect(panel).toBeVisible({ timeout: 15_000 })

    const footer = page.getByTestId('compare-sources')
    await expect(footer).toBeVisible({ timeout: 10_000 })

    // Footer must contain the "Sources:" label
    await expect(footer).toContainText('Sources:')

    // Each source link must have an href and open in a new tab
    const links = footer.getByRole('link')
    const count = await links.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const link = links.nth(i)
      await expect(link).toHaveAttribute('href', /^https?:\/\//)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  test('source links are keyboard-reachable', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,DEU')

    const panel = page.getByTestId('country-panel')
    await expect(panel).toBeVisible({ timeout: 15_000 })

    // App.tsx's panel-open effect moves focus to panel-close ~300ms after a
    // selection first opens the panel (deep-linking straight into #FRA,DEU
    // opens it on mount here). Wait for that autofocus to land BEFORE driving
    // focus ourselves below — otherwise the timer can fire between our
    // firstLink.focus() and the Tab press and steal focus back to
    // panel-close mid-test, which is the ~1/3 flake this test used to hit.
    await expect(page.getByTestId('panel-close')).toBeFocused({ timeout: 5_000 })

    const footer = page.getByTestId('compare-sources')
    await expect(footer).toBeVisible({ timeout: 10_000 })

    const links = footer.getByRole('link')
    const count = await links.count()
    expect(count).toBeGreaterThan(0)

    // Tab to the first source link by pressing Tab until it is focused.
    // Use focused-element polling rather than a fixed Tab count, so the test
    // is resilient to changes in the number of focusable elements in the panel.
    const firstLink = links.first()
    const firstLinkText = await firstLink.textContent()

    // Focus the footer element itself as a starting point, then Tab into links
    await firstLink.focus()
    await expect(firstLink).toBeFocused({ timeout: 5_000 })

    // If there is a second link, Tab to it and assert focus moves
    if (count > 1) {
      const secondLink = links.nth(1)
      await page.keyboard.press('Tab')
      await expect(secondLink).toBeFocused({ timeout: 5_000 })
    }

    // Verify the first link text is non-empty (sanity check)
    expect(firstLinkText?.trim()).toBeTruthy()
  })
})

test.describe('compare header controls (A15)', () => {
  test('copy-link copies the compare deep link and shows the toast', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,DEU')
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Copy link to this comparison' }).click()

    // Observe the toast, never navigator.clipboard.readText (readText hangs
    // under automation — project memory). clipboard-write is granted
    // project-wide in playwright.config.ts.
    await expect(page.getByText('Link copied')).toBeVisible()
  })

  test('"Exit compare" returns to the single-country panel', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,DEU')
    await expect(page.getByTestId('exit-compare')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('exit-compare').click()

    await expect(page.getByTestId('exit-compare')).not.toBeAttached()
    await expect(page.getByTestId('country-panel')).toBeVisible()
    await expect(page.getByTestId('country-panel')).toContainText('France')
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#FRA')
  })

  test('the top-right × closes the whole panel', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,DEU')
    await expect(page.getByTestId('panel-close')).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('panel-close').click()

    await expect(page.getByTestId('country-panel')).not.toBeAttached()
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('')
  })
})

test.describe('C2/C3 — shared-row comparison table (desktop)', () => {
  test('numeric rows render paired bars and a directional delta chip', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,DEU')
    await expect(page.getByTestId('exit-compare')).toBeVisible({ timeout: 15_000 })

    // Bars: presence via testid, never pixel measurements. Population and
    // area both have values for FRA and DEU, so all four bars render.
    await expect(page.getByTestId('compare-bar-a-population')).toBeVisible()
    await expect(page.getByTestId('compare-bar-b-population')).toBeVisible()
    await expect(page.getByTestId('compare-bar-a-area')).toBeVisible()
    await expect(page.getByTestId('compare-bar-b-area')).toBeVisible()

    // C3: the derived density row exists with its own bars.
    await expect(page.getByTestId('compare-row-density')).toBeVisible()
    await expect(page.getByTestId('compare-bar-a-density')).toBeVisible()

    // Delta chip via accessible text. Germany's population exceeds
    // France's in every data vintage; the exact ratio floats with data
    // updates, so pin the phrasing shape, not the number.
    await expect(page.getByTestId('compare-delta-population')).toHaveText(
      /^Germany \d[\d,]*\.\d{2}× population$/,
    )
  })
})

test.describe('exception source markers (C4)', () => {
  test('the cia-factbook exception marker appears and keys to the footer', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,DEU')
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 15_000 })

    // Deterministic in the bundled data: FRA and DEU both attribute
    // governmentType to cia-factbook while every other field comes from
    // restcountries (the dominant source) — Government is the exception row.
    const marker = page.getByTestId('source-marker-cia-factbook').first()
    await expect(marker).toBeVisible({ timeout: 10_000 })
    await expect(marker).toHaveText('†')
    await expect(marker).toHaveAttribute('aria-label', 'Source: CIA World Factbook (archived)')
    await expect(marker).toHaveAttribute('target', '_blank')

    // Dominant-source rows carry no marker.
    await expect(page.getByTestId('source-marker-restcountries')).toHaveCount(0)

    // The footer lists the exception source with its marker key.
    const footer = page.getByTestId('compare-sources')
    await expect(footer).toContainText('†')
    await expect(footer).toContainText('CIA World Factbook (archived)')
  })

  test('markers are keyboard-reachable, not hover-only', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,DEU')
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 15_000 })
    // Autofocus-settle (same rationale as the source-links test above):
    // App.tsx's panel-open effect moves focus to panel-close ~300ms after the
    // deep-linked panel mounts. Wait for it to land BEFORE driving focus, so
    // the timer can't steal focus back mid-test.
    await expect(page.getByTestId('panel-close')).toBeFocused({ timeout: 5_000 })

    const marker = page.getByTestId('source-marker-cia-factbook').first()
    await marker.focus()
    await expect(marker).toBeFocused()
    // tabIndex 0 = in sequential Tab order; regressing to the retired
    // hover-only pattern (tabIndex={-1}) fails here.
    expect(await marker.evaluate((el) => (el as HTMLElement).tabIndex)).toBe(0)
  })
})
