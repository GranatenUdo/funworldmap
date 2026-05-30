# Testing System

## Tool

**Playwright** — browser automation framework for end-to-end testing. Tests run against the Vite preview server (`npm run build:e2e && npm run preview`) in a real browser (Chromium). The test seams (`window.__funworldmap_map` and `window.__funworldmap_game`) are only exposed when `import.meta.env.VITE_TEST_HOOKS` is true at build time (see Exposing the Map Instance below).

Build the e2e bundle: `npm run build:e2e` (no daily-content generation step; the app is fully client-side).

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

For Tier 2 tests to work, the map instance must be accessible from `page.evaluate`. Three modules contribute to the test seams: `useMapInstance.ts` (lines 104–106) exposes the map instance under `__funworldmap_map`, `GameController.tsx` (lines 704–706) adds game submission methods, and `GameSessionProvider.tsx` (lines 60–84) adds session lifecycle methods like `completeNow` and `endGame`:

```ts
// useMapInstance.ts — single producer; assigns the MapLibre Map instance directly:
if (import.meta.env.VITE_TEST_HOOKS) {
  window.__funworldmap_map = map
}

// GameController.tsx + GameSessionProvider.tsx — both contribute methods to a shared bag:
if (import.meta.env.VITE_TEST_HOOKS) {
  if (!window.__funworldmap_game) window.__funworldmap_game = {}
  window.__funworldmap_game.submitCountryGuess = ... // GameController
  window.__funworldmap_game.completeNow = ...       // GameSessionProvider
  // (see source for complete list)
}
```

Tests access them via:

```ts
const zoom = await page.evaluate(() => (window as any).__funworldmap_map.getZoom())
const success = await page.evaluate(
  ([cca3]) => (window as any).__funworldmap_game.submitCountryGuess(cca3),
  ['FRA'],
)
```

The seams are gated behind `import.meta.env.VITE_TEST_HOOKS`, which is only set at build time:

- **Standard production builds** (`npm run build`): `VITE_TEST_HOOKS` is undefined, seams are not exposed.
- **E2e builds** (`npm run build:e2e`): Vite uses `--mode e2e`, loads `.env.e2e` (which sets `VITE_TEST_HOOKS=1`), and exposes the seams.
- **Standard dev server** (`npm run dev`): Does not set `VITE_TEST_HOOKS` — seams are not available. E2e tests therefore require the built e2e bundle: `npm run build:e2e && npm run preview`.

This is deliberate: the funworldmap site has no backend, no auth, and no sensitive runtime state, so exposing a map reference for testing is acceptable. The gating ensures production users never see these seams.

Note: unlike earlier versions, `npm run build:e2e` does not regenerate a daily content index — there is no daily feature. The preview server is fully self-contained.

## WebGL2 in Headless Browsers

MapLibre needs WebGL2, which requires GPU access. Headless Chromium doesn't have a GPU by default.

**Solution**: Launch Chromium with `--use-gl=angle --use-angle=default` to use ANGLE backed by the real GPU when available, with software fallback as a last resort.

The previous backend was Software ANGLE (`--use-gl=swiftshader` / SwiftShader), dropped 2026-05-02 — it ran 5–10× slower than real-GPU ANGLE and was the documented largest contributor to the chromium e2e flake regression (see `docs/superpowers/notes/2026-04-28-flake-regression-analysis.md`).

**Playwright config:**

```ts
use: {
  launchOptions: {
    args: ['--use-gl=angle', '--use-angle=default'],
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
  compare-view-dimming.spec.ts  # Compare + satellite: dimmed borders must restore on exit
```

## Shared Fixtures

`e2e/fixtures/map-helpers.ts` provides reusable helpers:

| Helper                       | Purpose                                   |
| ---------------------------- | ----------------------------------------- |
| `waitForMapLoad(page)`       | Waits for `[data-map-loaded="true"]`      |
| `getMapZoom(page)`           | Returns current zoom via page.evaluate    |
| `getMapCenter(page)`         | Returns current center [lng, lat]         |
| `clickMapAt(page, lng, lat)` | Converts geo coordinates to pixel, clicks |
| `getSelectedCountry(page)`   | Reads `data-selected-country` attribute   |

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
import AxeBuilder from '@axe-core/playwright'
const results = await new AxeBuilder({ page }).analyze()
expect(results.violations).toEqual([])
```

This catches: missing alt text, insufficient color contrast, missing ARIA attributes, broken label associations, and other WCAG AA violations.

## Running Tests

```
npm run test:e2e              # Run all tests
npx playwright test search    # Run search tests only
npx playwright test --ui      # Interactive UI mode
npx playwright show-report    # View last test report
```
