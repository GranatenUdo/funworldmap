import { test, expect } from '@playwright/test'
import { gotoAndWaitForMap } from './helpers'

test.describe('SourceTooltip keyboard reachability', () => {
  test('tab to source icon opens tooltip; tab away closes it', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA')
    // Wait for the country panel to be visible
    await expect(page.getByTestId('country-panel')).toBeVisible()

    // Find the first source-tooltip "i" button (any field). Use the aria-label.
    const firstIcon = page.getByRole('button', { name: /^Source: / }).first()
    await expect(firstIcon).toBeVisible()

    // Focus the icon directly (don't count Tabs from start of doc — just verify the hover semantic)
    await firstIcon.focus()
    await expect(firstIcon).toBeFocused()

    // Tooltip should appear (Floating UI's useFocus opens on focus)
    const tooltip = page.getByRole('tooltip')
    await expect(tooltip).toBeVisible()

    // Tooltip should contain the source name (which matches the icon's aria-label)
    const ariaLabel = await firstIcon.getAttribute('aria-label')
    const sourceName = ariaLabel?.replace(/^Source: /, '') ?? ''
    await expect(tooltip).toContainText(sourceName)

    // Tab away — tooltip should close
    await page.keyboard.press('Tab')
    await expect(firstIcon).not.toBeFocused()
    await expect(tooltip).toBeHidden()
  })
})
