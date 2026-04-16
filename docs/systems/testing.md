# Testing System

## Tool

**Playwright** — browser automation framework for end-to-end testing. Tests run against the Vite development server (`npm run dev`) in a real browser (Chromium). Tier 2 map integration tests require the development build because the map instance is only exposed via `window.__funworldmap_map` when `import.meta.env.DEV` is true (see Exposing the Map Instance below).

## The Canvas Challenge

MapLibre GL JS renders everything to a WebGL2 `<canvas>`. Unlike DOM-based UIs, you cannot:
- Query elements inside the canvas with CSS selectors
- Assert CSS states (hover, active) on rendered features
- Use standard Playwright locators to find map features

This shapes the entire testing strategy.

## Two-Tier Approach

### Tier 1: DOM Tests (Fast, Reliable)

Test everything outside the canvas — panels, search, header, theme toggle, URL routing.

**Techniques:**
- `data-testid` attributes on React components
- Standard Playwright locators (`getByRole`, `getByText`, `getByTestId`)
- Data attributes reflecting map state on the app root:
  - `data-map-loaded="true"` — set after MapLibre's `onLoad` fires
  - `data-selected-country="250"` — set when a country is selected
- URL hash assertions for deep linking

**Examples:**
- Search bar accepts input and shows dropdown
- Clicking a search result opens the panel with correct data
- Panel shows formatted population, flag, capital
- Close button hides the panel
- Theme toggle switches class on `<html>`

### Tier 2: Map Integration Tests (Slower, via page.evaluate)

Test map state by reaching into the MapLibre API through the browser's JavaScript context.

**Techniques:**
- `page.evaluate(() => (window as any).__funworldmap_map.getZoom())` — verify zoom level
- `page.evaluate(() => (window as any).__funworldmap_map.getCenter())` — verify camera position
- `page.evaluate(([x, y]) => (window as any).__funworldmap_map.queryRenderedFeatures([x, y]), [x, y])` — check what features exist at a pixel
- `page.mouse.click(x, y)` at known country coordinates — trigger map interactions
- `expect(page).toHaveScreenshot()` — visual regression testing

**Examples:**
- Zoom in button increases `map.getZoom()`
- Clicking at France's coordinates selects France
- After selecting France, `map.getCenter()` is near France
- Reset view returns to initial zoom and center

### Exposing the Map Instance

For Tier 2 tests to work, the map instance must be accessible from `page.evaluate`. The `WorldMap` component stores the map reference on `window` in development:

```ts
// In WorldMap.tsx onLoad handler:
if (import.meta.env.DEV) {
  (window as any).__funworldmap_map = mapRef.current;
}
```

Tests access it via:
```ts
const zoom = await page.evaluate(() => (window as any).__funworldmap_map.getZoom());
```

This is only available in development builds — production builds do not expose the map.

## WebGL2 in Headless Browsers

MapLibre needs WebGL2, which requires GPU access. Headless Chromium doesn't have a GPU by default.

**Solution**: Launch Chromium with `--use-gl=swiftshader`.

SwiftShader is a software-based GPU emulator bundled with Chromium. It makes WebGL2 work in headless mode but:
- Renders 5-10x slower than a real GPU
- May produce slightly different pixel output (antialiasing differences)
- Is reliable on Windows, Linux, and macOS CI environments

**Playwright config:**
```ts
use: {
  launchOptions: {
    args: ['--use-gl=swiftshader'],
  },
}
```

## Test Organization

```
e2e/
  fixtures/
    map-helpers.ts              # waitForMapLoad(), getMapZoom(), clickMapAt(), etc.
  scaffold.spec.ts              # Phase 0: app renders, Tailwind works
  map-and-countries.spec.ts     # Phase 1: map loads, countries render, click/hover
  panel-and-deeplink.spec.ts    # Phase 2: panel content, deep linking, responsive layout
  search.spec.ts                # Phase 3: autocomplete, fuzzy matching, keyboard nav
  theme-and-responsive.spec.ts  # Phase 4: dark mode, responsive breakpoints
  accessibility.spec.ts         # Phase 5: keyboard nav, ARIA, axe-core audit
```

## Shared Fixtures

`e2e/fixtures/map-helpers.ts` provides reusable helpers:

| Helper | Purpose |
|--------|---------|
| `waitForMapLoad(page)` | Waits for `[data-map-loaded="true"]` |
| `getMapZoom(page)` | Returns current zoom via page.evaluate |
| `getMapCenter(page)` | Returns current center [lng, lat] |
| `clickMapAt(page, lng, lat)` | Converts geo coordinates to pixel, clicks |
| `getSelectedCountry(page)` | Reads `data-selected-country` attribute |

## Visual Regression

Screenshot tests (`expect(page).toHaveScreenshot()`) capture the map at specific states:
- Initial world view
- Zoomed to Europe
- Country selected with panel open
- Dark mode vs. light mode

These catch unintended visual changes but are sensitive to rendering differences. Configure with `maxDiffPixels` or `maxDiffPixelRatio` to allow minor antialiasing variance.

## Accessibility Testing

**@axe-core/playwright** runs automated WCAG audits:

```ts
import AxeBuilder from '@axe-core/playwright';
const results = await new AxeBuilder({ page }).analyze();
expect(results.violations).toEqual([]);
```

This catches: missing alt text, insufficient color contrast, missing ARIA attributes, broken label associations, and other WCAG AA violations.

## Running Tests

```
npm run test:e2e              # Run all tests
npx playwright test search    # Run search tests only
npx playwright test --ui      # Interactive UI mode
npx playwright show-report    # View last test report
```
