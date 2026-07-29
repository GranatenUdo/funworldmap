import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap } from './helpers'

/**
 * D2 — the single panel's consolidated source attribution.
 *
 * Replaces source-tooltip-edge.spec.ts + source-tooltip-keyboard.spec.ts,
 * which pinned the retired per-field "i"-ring scheme (hover tooltips,
 * tabIndex={-1}). Their INTENT carries over:
 *   - edge positioning: attribution UI must never clip outside the
 *     viewport (was: the Floating UI tooltip; now: the expanded
 *     field → source table)
 *   - keyboard reachability: attribution must be operable from the
 *     keyboard (was: focus-opened tooltip; now: real links plus an
 *     aria-expanded disclosure button in the Tab order)
 *
 * Hash-driven (deep link, no UI-click chains) and free of exact-text
 * wrap assumptions — robust to Linux font metrics.
 */
test.describe('single panel consolidated source attribution (D2)', () => {
  test('footer lists linked sources; the exception field carries the † marker; rings are gone', async ({
    page,
  }) => {
    await gotoAndWaitForMap(page, '/#FRA')
    const panel = page.getByTestId('country-panel')
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await expect(panel).toContainText('France', { timeout: 10_000 })

    const footer = page.getByTestId('panel-sources')
    await expect(footer).toContainText('Sources:')
    const links = footer.getByRole('link')
    const count = await links.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const link = links.nth(i)
      await expect(link).toHaveAttribute('href', /^https?:\/\//)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }

    // Deterministic in the bundled data: every FRA field is restcountries
    // except governmentType (cia-factbook) — Government is the exception.
    const marker = page.getByTestId('source-marker-cia-factbook')
    await expect(marker).toBeVisible({ timeout: 10_000 })
    await expect(marker).toHaveText('†')
    await expect(marker).toHaveAttribute('aria-label', 'Source: CIA World Factbook (archived)')
    await expect(page.getByTestId('source-marker-restcountries')).toHaveCount(0)
    await expect(footer).toContainText('†')
    await expect(footer).toContainText('CIA World Factbook (archived)')

    // The retired ring scheme must not resurface.
    await expect(panel.getByRole('button', { name: /^Source:/ })).toHaveCount(0)
  })

  test('disclosure expands keyboard-driven into the field table, contained in the viewport', async ({
    page,
  }) => {
    await gotoAndWaitForMap(page, '/#FRA')
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 15_000 })
    // Autofocus-settle (same rationale as compare-source-attribution):
    // App.tsx moves focus to panel-close ~300ms after the deep-linked
    // panel mounts. Wait for it to land BEFORE driving focus, so the
    // timer can't steal focus back mid-test.
    await expect(page.getByTestId('panel-close')).toBeFocused({ timeout: 5_000 })

    const toggle = page.getByTestId('panel-sources-toggle')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('panel-sources-detail')).not.toBeAttached()

    await toggle.focus()
    await expect(toggle).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const table = page.getByTestId('panel-sources-detail')
    await expect(table).toBeVisible()
    // Complete granularity one interaction away: the caption-only capital
    // and the exception Government field both resolve here.
    await expect(table.getByRole('rowheader', { name: 'Capital' })).toBeVisible()
    await expect(table.getByRole('row').filter({ hasText: 'Government' })).toContainText(
      'CIA World Factbook (archived)',
    )

    // Edge-positioning intent from the retired tooltip spec: the expanded
    // attribution UI stays horizontally inside the viewport.
    const viewport = page.viewportSize()!
    const rect = await table.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right }
    })
    expect(rect.left, 'table must not clip on the left').toBeGreaterThanOrEqual(0)
    expect(rect.right, 'table must not overflow on the right').toBeLessThanOrEqual(viewport.width)

    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(table).not.toBeAttached()
  })

  test('footer links and the exception marker are Tab-reachable, not hover-only', async ({
    page,
  }) => {
    await gotoAndWaitForMap(page, '/#FRA')
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('panel-close')).toBeFocused({ timeout: 5_000 })

    const marker = page.getByTestId('source-marker-cia-factbook')
    await marker.focus()
    await expect(marker).toBeFocused()
    // tabIndex 0 = in sequential Tab order; regressing to the retired
    // hover-only pattern (tabIndex={-1}) fails here.
    expect(await marker.evaluate((el) => (el as HTMLElement).tabIndex)).toBe(0)

    const footer = page.getByTestId('panel-sources')
    const footerLinks = footer.getByRole('link')
    // Source registry order is deterministic JSON order (restcountries
    // first) — not a Fuse-scoring order, so nth-indexing is safe here.
    const firstLink = footerLinks.first()
    await firstLink.focus()
    await expect(firstLink).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(footerLinks.nth(1)).toBeFocused()
  })
})
