# Production Readiness for 100k Monthly Uniques — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the operational and discoverability gaps that block a responsible launch of polworldmap to ~100k monthly uniques on GitHub Pages — licensing, social/SEO metadata, map-reliability fallbacks, error reporting, and CI hygiene.

**Architecture:** No new abstractions. Small, isolated edits across `index.html`, `public/`, a handful of components under `src/components/`, `src/lib/`, `src/main.tsx`, and `.github/workflows/ci.yml`. One new runtime dependency (`@sentry/react`), guarded by env-var so the repo stays safe to run with no DSN set. Each task ships on its own.

**Tech Stack:** React 19 + Vite 6 + TypeScript, MapLibre GL, Tailwind 4, Vitest (node env), Playwright (two projects: SwiftShader DOM, real-GPU WebGL), `@sentry/react` (new).

**Scope out of this plan:** Cloudflare Pages migration, custom domain setup, analytics, service worker, bundle-size optimization, data-refresh runbook (noted for follow-up), real second-provider basemap failover (requires Stadia/MapTiler signup — this plan wires the graceful-degradation path instead).

---

## File Structure

**Files to create:**
- `LICENSE` — MIT license
- `public/og-image.png` — social preview asset (copied from `screenshot-initial-load.png`)
- `public/robots.txt` — crawler guidance + sitemap pointer
- `public/sitemap.xml` — single root URL (hash routes are not crawlable)
- `.env.example` — documents `VITE_SENTRY_DSN` and the placeholder `VITE_PUBLIC_URL`
- `src/lib/probeBasemap.ts` — `fetch`-based probe with timeout, returns ok/fail
- `src/lib/__tests__/probeBasemap.test.ts` — unit test for the probe
- `src/lib/initSentry.ts` — env-guarded Sentry init (no-op without DSN)
- `src/lib/__tests__/initSentry.test.ts` — unit test for DSN gating
- `src/components/MapErrorOverlay.tsx` — full-screen overlay with retry button
- `src/components/BasemapBanner.tsx` — dismissable degraded-basemap banner
- `e2e/meta-and-static.spec.ts` — verifies meta tags, robots.txt, sitemap.xml
- `e2e/map-reliability.spec.ts` — basemap block / timeout scenarios (GPU project)

**Files to modify:**
- `index.html` — OG/Twitter Card/preload/theme-color/canonical
- `src/components/WorldMap.tsx` — load watchdog, error overlay hookup, basemap probe
- `src/lib/mapStyles.ts` — export a timeout constant
- `src/main.tsx` — Sentry init + ErrorBoundary
- `.github/workflows/ci.yml` — add `test:unit` step
- `playwright.config.ts` — add the two new specs to the right `testMatch`
- `package.json` — add `@sentry/react`
- `README.md` — document Sentry setup + basemap-failover follow-up

---

## Pre-flight

- [ ] **Step 0.1: Confirm the GitHub Pages URL**

The plan uses `https://tobi-ens.github.io/polworldmap/` as the canonical URL placeholder everywhere it's needed. If your GitHub username differs, do a repo-wide search/replace before starting Task 2.

Run:
```bash
grep -rn "tobi-ens.github.io/polworldmap" docs/superpowers/plans/2026-04-16-production-readiness-100k.md
```

Expected: lists every occurrence so you can confirm. If wrong, replace with your actual `https://<user>.github.io/polworldmap/` URL throughout the plan before executing.

- [ ] **Step 0.2: Confirm there are no uncommitted changes that would conflict**

Run:
```bash
git status --short
```

Expected: clean working tree on the branch you want to land this work on (likely a new feature branch off `main`). If there are untracked screenshots or stale plans from earlier sessions, either stash or commit them before proceeding.

---

## Task 1: Add MIT LICENSE

**Files:**
- Create: `LICENSE`

**Rationale:** The README calls the project "free"; without a LICENSE, "free" is unenforceable and contributors can't legally reuse the code. MIT is the conventional choice for small OSS React/TS projects and matches the repo's existing dependency ecosystem. No test needed — this is a static legal document.

- [ ] **Step 1.1: Create the LICENSE file**

Create `LICENSE` with:

```
MIT License

Copyright (c) 2026 Tobias Ens

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Note: data files under `public/flags/`, fonts, and country data under `src/data/` have their own source licenses (already documented in `docs/systems/data.md`); MIT covers *this repo's code*, not the upstream data. The README already credits those; no change required here.

- [ ] **Step 1.2: Update README to reference LICENSE**

Modify `README.md` — append (or slot in logically near the bottom) a new section:

```markdown
## License

Source code is MIT licensed — see [LICENSE](./LICENSE).

Data, fonts, and flag assets retain their upstream licenses; see [docs/systems/data.md](./docs/systems/data.md) for source-by-source attribution.
```

- [ ] **Step 1.3: Commit**

```bash
git add LICENSE README.md
git commit -m "chore: add MIT LICENSE and reference it from README"
```

---

## Task 2: Social/SEO metadata in index.html + OG image

**Files:**
- Create: `public/og-image.png` (from `screenshot-initial-load.png`)
- Modify: `index.html`
- Create: `e2e/meta-and-static.spec.ts`
- Modify: `playwright.config.ts` (add spec to SwiftShader `testMatch`)

**Rationale:** Every link shared on Slack/Discord/Twitter/LinkedIn needs OG + Twitter Card tags, or the preview is a blank gray box. Font preload kills FOUT on first paint. `theme-color` paints the mobile URL bar. `canonical` tells Google which URL is authoritative for hash-route variants.

- [ ] **Step 2.1: Write the failing e2e test**

Create `e2e/meta-and-static.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test.describe('head metadata', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('has Open Graph tags', async ({ page }) => {
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /polworldmap/i)
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /.{40,}/)
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website')
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-image\.png$/)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /^https?:\/\//)
  })

  test('has Twitter Card tags', async ({ page }) => {
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', /polworldmap/i)
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', /og-image\.png$/)
  })

  test('has theme-color and canonical', async ({ page }) => {
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /^#[0-9a-f]{3,6}$/i)
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
```

- [ ] **Step 2.2: Register the spec with Playwright (SwiftShader project)**

Modify `playwright.config.ts` — extend the `testMatch` array for the `chromium` project to include the new spec:

```typescript
testMatch: [
  'scaffold.spec.ts',
  'search.spec.ts',
  'theme-and-responsive.spec.ts',
  'accessibility.spec.ts',
  'panel-and-deeplink.spec.ts',
  'meta-and-static.spec.ts',
],
```

- [ ] **Step 2.3: Run the test — should fail**

Run:
```bash
npx playwright test meta-and-static --project=chromium
```

Expected: all test cases fail (meta tags / robots.txt / sitemap.xml don't exist yet).

- [ ] **Step 2.4: Copy the initial-load screenshot as the OG image**

Run (from repo root):
```bash
cp screenshot-initial-load.png public/og-image.png
```

Expected: file exists at `public/og-image.png`, ~725 KB. Note: for post-launch polish, design a proper 1200×630 OG image — the existing screenshot is rectangular and works but isn't optimal.

- [ ] **Step 2.5: Rewrite index.html with full head metadata**

Replace the contents of `index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0b0f1a" media="(prefers-color-scheme: dark)" />
    <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />

    <title>polworldmap — Interactive political world map</title>
    <meta name="description" content="Explore 195 countries on a fast, free, interactive world map. Borders, capitals, populations, and more — with per-field source attribution." />

    <link rel="canonical" href="https://tobi-ens.github.io/polworldmap/" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="polworldmap" />
    <meta property="og:title" content="polworldmap — Interactive political world map" />
    <meta property="og:description" content="Explore 195 countries on a fast, free, interactive world map. Borders, capitals, populations, and more — with per-field source attribution." />
    <meta property="og:url" content="https://tobi-ens.github.io/polworldmap/" />
    <meta property="og:image" content="https://tobi-ens.github.io/polworldmap/og-image.png" />
    <meta property="og:image:alt" content="Screenshot of polworldmap showing the globe with country borders." />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="polworldmap — Interactive political world map" />
    <meta name="twitter:description" content="Explore 195 countries on a fast, free, interactive world map." />
    <meta name="twitter:image" content="https://tobi-ens.github.io/polworldmap/og-image.png" />

    <link rel="preload" as="font" type="font/woff2" href="/fonts/outfit-latin.woff2" crossorigin />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Notes for the implementer:
- Vite rewrites root-absolute paths like `/fonts/...` to include the `base` prefix (`/polworldmap/fonts/...` on GH Actions builds). Do **not** manually prefix the base.
- OG/Twitter image/URL tags must be fully absolute; scrapers won't resolve relative paths. If you're using a custom domain, swap the `tobi-ens.github.io/polworldmap` host accordingly.
- `crossorigin` with no value is valid HTML5 and required for font preload to match the font fetch.

- [ ] **Step 2.6: Run the test — should pass**

Run:
```bash
npx playwright test meta-and-static --project=chromium
```

Expected: all cases pass except possibly the `static files` group (that's fixed in Task 3). The `head metadata` group must pass now.

If any `head metadata` case still fails, re-read the regex — e.g. the og:image regex `/og-image\.png$/` matches `.../og-image.png` but not `.../og-image.png?v=1`. Adjust content, not the test.

- [ ] **Step 2.7: Commit**

```bash
git add index.html public/og-image.png e2e/meta-and-static.spec.ts playwright.config.ts
git commit -m "feat: social/SEO metadata, font preload, and OG image"
```

---

## Task 3: robots.txt + sitemap.xml

**Files:**
- Create: `public/robots.txt`
- Create: `public/sitemap.xml`

**Rationale:** Without these, crawlers waste budget on artifacts (dist, test-results, flags) and miss the canonical URL. Hash-fragment deep-links (`#FRA`) are not crawlable by any search engine — so the sitemap has exactly one URL. The static-files portion of `e2e/meta-and-static.spec.ts` (written in Task 2) already covers these.

- [ ] **Step 3.1: Run the static-files tests — should still fail**

Run:
```bash
npx playwright test meta-and-static --project=chromium --grep "static files"
```

Expected: both `robots.txt` and `sitemap.xml` cases fail with 404.

- [ ] **Step 3.2: Create robots.txt**

Create `public/robots.txt`:

```
User-agent: *
Allow: /

Sitemap: https://tobi-ens.github.io/polworldmap/sitemap.xml
```

Note: everything under `public/` ships to the site root. The `/polworldmap/` base path prefix is applied by GH Pages hosting, not by Vite's HTML transform for `public/` assets, so this literal URL is the correct final URL.

- [ ] **Step 3.3: Create sitemap.xml**

Create `public/sitemap.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://tobi-ens.github.io/polworldmap/</loc>
    <lastmod>2026-04-16</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

Note: do **not** add per-country URLs. The app uses `#FRA`-style hash routes which Google does not crawl as separate pages. Adding them inflates the sitemap with URLs that all redirect to the root.

- [ ] **Step 3.4: Run the static-files tests — should pass**

Run:
```bash
npx playwright test meta-and-static --project=chromium --grep "static files"
```

Expected: both cases pass.

- [ ] **Step 3.5: Commit**

```bash
git add public/robots.txt public/sitemap.xml
git commit -m "feat: add robots.txt and sitemap.xml"
```

---

## Task 4: Map load watchdog + error overlay

**Files:**
- Create: `src/components/MapErrorOverlay.tsx`
- Modify: `src/components/WorldMap.tsx`
- Modify: `src/lib/mapStyles.ts` (add timeout constant)
- Create: `e2e/map-reliability.spec.ts`
- Modify: `playwright.config.ts` (add spec to `chromium-gpu` `testMatch`)

**Rationale:** Today, if `map.on('load')` never fires (basemap style 404s, network hang, CORS issue), the spinner spins forever with no explanation. That's the single worst UX failure mode in the app. A 10-second watchdog plus a visible error overlay converts silent failure into an actionable "try again" affordance.

- [ ] **Step 4.1: Add `BASEMAP_LOAD_TIMEOUT_MS` constant**

Modify `src/lib/mapStyles.ts` — append:

```typescript
/** Time to wait for MapLibre 'load' event before showing an error overlay. */
export const BASEMAP_LOAD_TIMEOUT_MS = 10_000
```

- [ ] **Step 4.2: Write the failing e2e test**

Create `e2e/map-reliability.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test.describe('map reliability', () => {
  test('shows error overlay when basemap style is unreachable', async ({ page }) => {
    // Block both OpenFreeMap and any CDN retries.
    await page.route('**/tiles.openfreemap.org/**', (route) => route.abort('failed'))

    await page.goto('/')

    // Error overlay must appear within the watchdog window (10s) + buffer.
    const overlay = page.getByTestId('map-error-overlay')
    await expect(overlay).toBeVisible({ timeout: 15_000 })
    await expect(overlay).toContainText(/map failed to load|couldn.t load/i)

    const retry = page.getByTestId('map-error-retry')
    await expect(retry).toBeVisible()
    await expect(retry).toBeEnabled()
  })

  test('retry button reloads the page', async ({ page }) => {
    let reloaded = false
    page.on('framenavigated', () => { reloaded = true })

    await page.route('**/tiles.openfreemap.org/**', (route) => route.abort('failed'))
    await page.goto('/')

    const retry = page.getByTestId('map-error-retry')
    await expect(retry).toBeVisible({ timeout: 15_000 })

    reloaded = false // reset after initial navigation
    await retry.click()

    // Give the navigation event time to fire.
    await page.waitForTimeout(500)
    expect(reloaded).toBe(true)
  })
})
```

- [ ] **Step 4.3: Register the spec with Playwright (GPU project)**

Modify `playwright.config.ts` — extend the `testMatch` for the `chromium-gpu` project:

```typescript
testMatch: ['map-and-countries.spec.ts', 'map-reliability.spec.ts'],
```

- [ ] **Step 4.4: Run the test — should fail**

Run:
```bash
npx playwright test map-reliability --project=chromium-gpu
```

Expected: both cases fail — the overlay and retry button don't exist yet.

- [ ] **Step 4.5: Implement MapErrorOverlay**

Create `src/components/MapErrorOverlay.tsx`:

```tsx
type Reason = 'timeout' | 'style' | 'country-data'

interface Props {
  reason: Reason
  onRetry: () => void
}

const REASON_MESSAGES: Record<Reason, { title: string; body: string }> = {
  timeout: {
    title: "We couldn't load the map",
    body: 'The map took too long to load. This is usually a network hiccup.',
  },
  style: {
    title: "We couldn't load the map",
    body: 'The basemap service is unreachable right now.',
  },
  'country-data': {
    title: "We couldn't load country data",
    body: 'The country outlines failed to load. Try again in a moment.',
  },
}

export function MapErrorOverlay({ reason, onRetry }: Props) {
  const { title, body } = REASON_MESSAGES[reason]
  return (
    <div
      data-testid="map-error-overlay"
      role="alert"
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-white/90 backdrop-blur-sm dark:bg-slate-950/90"
    >
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{body}</p>
        <button
          data-testid="map-error-retry"
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
```

Notes:
- `role="alert"` surfaces this to screen readers immediately. No explicit `aria-live` needed.
- `pointer-events-auto` on an `absolute inset-0` overlay because MapLibre sits below and the map container often has its own pointer handling.
- `z-40` places it above the map (which is typically `z-0`/`z-10`) but below modal dialogs if any get added later.

- [ ] **Step 4.6: Wire the watchdog into WorldMap**

Modify `src/components/WorldMap.tsx`:

1. Add the import near the other imports:

```tsx
import { MapErrorOverlay } from './MapErrorOverlay'
import { BASEMAP_LOAD_TIMEOUT_MS } from '../lib/mapStyles'
```

2. Inside the component body, add state:

```tsx
const [mapError, setMapError] = useState<'timeout' | 'style' | 'country-data' | null>(null)
```

(Add `useState` to the existing `react` import if not already there.)

3. In the `useEffect` that creates the MapLibre instance, add a watchdog timer immediately after `map` is created and before the `on('load', ...)` handler. The existing `on('load', ...)` handler should clear the watchdog before it does anything else. If `addCountryLayers` throws, set the `country-data` error. Rough shape (adapt variable names to the existing code):

```tsx
const watchdog = window.setTimeout(() => {
  setMapError('timeout')
}, BASEMAP_LOAD_TIMEOUT_MS)

map.on('error', (ev) => {
  // MapLibre fires 'error' for style failures; only surface pre-load errors.
  if (mapError === null) setMapError('style')
})

map.on('load', () => {
  window.clearTimeout(watchdog)
  // ... existing onLoad logic ...
  addCountryLayers(map).catch((err) => {
    console.error(err)
    setMapError('country-data')
  })
})

return () => {
  window.clearTimeout(watchdog)
  map.remove()
}
```

4. At the bottom of the component's JSX (inside the existing map-container `<div>` or sibling, whichever puts it on top of the canvas — check the DOM structure in the existing file and place it as a sibling to the map canvas wrapper with `position: relative` on the parent), render:

```tsx
{mapError !== null && (
  <MapErrorOverlay
    reason={mapError}
    onRetry={() => window.location.reload()}
  />
)}
```

**Important:** The existing WorldMap.tsx is large and has its own JSX structure. Read it end-to-end first; don't blindly paste this at the bottom if the existing container isn't `position: relative`. If in doubt, wrap the existing map container in a `<div className="relative h-full w-full">` and place the overlay as a sibling to the existing map element.

- [ ] **Step 4.7: Run the test — should pass**

Run:
```bash
npx playwright test map-reliability --project=chromium-gpu
```

Expected: both cases pass within 20 seconds each.

If the first case times out: the watchdog isn't firing. Check that `setTimeout` is actually scheduled — a common mistake is placing it inside `map.on('load')` which would never execute. It must run *before* the load handler.

If the retry case fails: `window.location.reload()` may not count as `framenavigated` in newer Playwright. Change the assertion to check `page.url()` before/after or use `page.waitForEvent('load')` instead.

- [ ] **Step 4.8: Regression check**

Run the full suite to make sure nothing else broke:

```bash
npx playwright test
```

Expected: all tests pass (or any pre-existing failures remain the same — don't introduce new ones).

- [ ] **Step 4.9: Commit**

```bash
git add src/components/MapErrorOverlay.tsx src/components/WorldMap.tsx src/lib/mapStyles.ts e2e/map-reliability.spec.ts playwright.config.ts
git commit -m "feat: map load watchdog with error overlay and retry"
```

---

## Task 5: Basemap probe + degraded-mode banner

**Files:**
- Create: `src/lib/probeBasemap.ts`
- Create: `src/lib/__tests__/probeBasemap.test.ts`
- Create: `src/components/BasemapBanner.tsx`
- Modify: `src/components/WorldMap.tsx`
- Modify: `e2e/map-reliability.spec.ts` (add one case)

**Rationale:** Proper "failover to a second provider" requires a Stadia/MapTiler API key (user signup, ops decision). The realistic insurance we *can* ship today: proactively detect when the basemap style URL is unreachable, and render a non-blocking banner so users understand why the map looks blank — while the bundled country polygons remain interactive. This turns a scary blank-ocean failure into a legible degraded state.

When you eventually configure a real fallback URL, only `probeBasemap` and the WorldMap init logic need to change; the banner and plumbing stay the same.

- [ ] **Step 5.1: Write the failing unit test for probeBasemap**

Create `src/lib/__tests__/probeBasemap.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { probeBasemap } from '../probeBasemap'

describe('probeBasemap', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns ok when fetch resolves with 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    expect(await probeBasemap('https://example.test/style.json', 1000)).toBe('ok')
  })

  it('returns fail when fetch resolves non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))
    expect(await probeBasemap('https://example.test/style.json', 1000)).toBe('fail')
  })

  it('returns fail when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network error')))
    expect(await probeBasemap('https://example.test/style.json', 1000)).toBe('fail')
  })

  it('returns fail when fetch exceeds timeout', async () => {
    vi.useFakeTimers()
    let abortSignal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        abortSignal = init?.signal ?? undefined
        return new Promise((_resolve, reject) => {
          abortSignal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        })
      }),
    )
    const result = probeBasemap('https://example.test/style.json', 500)
    await vi.advanceTimersByTimeAsync(600)
    expect(await result).toBe('fail')
    vi.useRealTimers()
  })
})
```

- [ ] **Step 5.2: Run the test — should fail**

Run:
```bash
npm run test:unit -- probeBasemap
```

Expected: all four cases fail with "Cannot find module '../probeBasemap'".

- [ ] **Step 5.3: Implement probeBasemap**

Create `src/lib/probeBasemap.ts`:

```typescript
export type ProbeResult = 'ok' | 'fail'

/**
 * Probe a basemap style URL before map init so we can degrade gracefully
 * when the provider is unreachable. Uses GET (not HEAD) because many tile
 * providers don't implement HEAD on style endpoints.
 */
export async function probeBasemap(url: string, timeoutMs: number): Promise<ProbeResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    return res.ok ? 'ok' : 'fail'
  } catch {
    return 'fail'
  } finally {
    clearTimeout(timer)
  }
}
```

- [ ] **Step 5.4: Run the test — should pass**

Run:
```bash
npm run test:unit -- probeBasemap
```

Expected: all four cases pass.

- [ ] **Step 5.5: Implement BasemapBanner**

Create `src/components/BasemapBanner.tsx`:

```tsx
import { useState } from 'react'

export function BasemapBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div
      data-testid="basemap-banner"
      role="status"
      className="pointer-events-auto absolute inset-x-2 top-2 z-30 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 shadow-md dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
    >
      <span>Basemap is temporarily unavailable — country outlines are still interactive.</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-3 underline underline-offset-2 hover:no-underline"
        aria-label="Dismiss basemap notice"
      >
        Dismiss
      </button>
    </div>
  )
}
```

- [ ] **Step 5.6: Wire the probe and banner into WorldMap**

Modify `src/components/WorldMap.tsx`:

1. Add imports:

```tsx
import { probeBasemap } from '../lib/probeBasemap'
import { BasemapBanner } from './BasemapBanner'
import { BASEMAP_STYLE } from '../lib/mapStyles'
```

(The `BASEMAP_STYLE` import may already exist — de-duplicate.)

2. Add state:

```tsx
const [basemapDegraded, setBasemapDegraded] = useState(false)
```

3. In the existing mount `useEffect`, run the probe *before* creating the MapLibre instance. If it fails, set `basemapDegraded` to `true` and continue with map init anyway (MapLibre will render the bundled country polygons on a blank background):

```tsx
useEffect(() => {
  let cancelled = false
  probeBasemap(BASEMAP_STYLE, 3000).then((result) => {
    if (cancelled) return
    if (result === 'fail') setBasemapDegraded(true)
  })
  // ... existing init code follows, unchanged ...
  return () => {
    cancelled = true
    // ... existing cleanup ...
  }
}, [])
```

4. In the JSX, render the banner when degraded (as a sibling of the map, alongside the error overlay placement from Task 4):

```tsx
{basemapDegraded && mapError === null && <BasemapBanner />}
```

The `mapError === null` guard prevents double-messaging — if the map failed to load entirely, the full overlay from Task 4 wins.

- [ ] **Step 5.7: Add the degraded-mode e2e case**

Modify `e2e/map-reliability.spec.ts` — append another test inside the existing `describe` block:

```typescript
test('shows degraded-mode banner when probe fails but map still renders countries', async ({ page }) => {
  // Fail the probe (style JSON) but allow other requests.
  await page.route('**/tiles.openfreemap.org/styles/positron', (route) => route.abort('failed'))

  await page.goto('/')

  // Banner appears.
  const banner = page.getByTestId('basemap-banner')
  await expect(banner).toBeVisible({ timeout: 5_000 })

  // Dismiss works.
  await banner.getByRole('button', { name: /dismiss/i }).click()
  await expect(banner).toBeHidden()
})
```

**Caveat for the implementer:** Playwright `page.route` with `abort` cancels the request, which our probe treats as `fail`. If the real map instance *also* hits that exact URL, we'll see both the banner and the error overlay — the `mapError === null` guard handles that by hiding the banner. If both appear in the test, adjust the route pattern to only intercept `no-store` GETs (the probe sets `cache: 'no-store'`) and let MapLibre's style fetch through: use `route.fulfill({ status: 500 })` on the probe path only, or fingerprint by `Cache-Control` header on the request.

- [ ] **Step 5.8: Run the reliability tests — all three should pass**

```bash
npx playwright test map-reliability --project=chromium-gpu
```

Expected: all three cases pass.

- [ ] **Step 5.9: Commit**

```bash
git add src/lib/probeBasemap.ts src/lib/__tests__/probeBasemap.test.ts src/components/BasemapBanner.tsx src/components/WorldMap.tsx e2e/map-reliability.spec.ts
git commit -m "feat: probe basemap and show degraded-mode banner on failure"
```

---

## Task 6: Wire unit tests into CI

**Files:**
- Modify: `.github/workflows/ci.yml`

**Rationale:** `package.json` already has `test:unit` wired to `vitest run`, but CI never invokes it — `hashState.test.ts` and (now) `probeBasemap.test.ts` and `initSentry.test.ts` (Task 7) run on nobody's machine by default. This is a one-line fix that costs seconds per CI run.

- [ ] **Step 6.1: Add the unit-test step to CI**

Modify `.github/workflows/ci.yml` — insert a new step **after** the `Type check` step and **before** the `Build` step:

```yaml
      - name: Unit tests
        run: npm run test:unit
```

Full `check` job for reference:

```yaml
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Lint
        run: npm run lint
      - name: Type check
        run: tsc -b
      - name: Unit tests
        run: npm run test:unit
      - name: Build
        run: npm run build
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - name: E2E tests
        run: npm run test:e2e
      - name: Upload test report
        uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 6.2: Verify locally**

Run:
```bash
npm run test:unit
```

Expected: every existing and new unit test passes in under ~5 seconds.

- [ ] **Step 6.3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore: run unit tests in CI"
```

---

## Task 7: Sentry error reporting

**Files:**
- Modify: `package.json`
- Create: `.env.example`
- Create: `src/lib/initSentry.ts`
- Create: `src/lib/__tests__/initSentry.test.ts`
- Modify: `src/main.tsx`
- Modify: `README.md`
- Modify: `.github/workflows/deploy.yml` (document and inject secret)

**Rationale:** Without error reporting, we won't see what breaks in production. Sentry's free tier covers 5k events/month which is ample for our launch scale. The init is env-gated so the repo stays safe to run with no account set up — a no-op until `VITE_SENTRY_DSN` is provided at build time.

Sentry free-tier volume caveat: at 100k monthly uniques, an error rate of ~5% will exhaust the free tier. For launch that's fine; tune `beforeSend` or upgrade if alerts get noisy.

- [ ] **Step 7.1: Install @sentry/react**

Run:
```bash
npm install --save @sentry/react
```

Expected: `package.json` updates with `@sentry/react` under `dependencies`; `package-lock.json` updates.

- [ ] **Step 7.2: Write the failing unit test for initSentry**

Create `src/lib/__tests__/initSentry.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const initMock = vi.fn()
vi.mock('@sentry/react', () => ({
  init: (...args: unknown[]) => initMock(...args),
  ErrorBoundary: ({ children }: { children: unknown }) => children,
}))

import { initSentry } from '../initSentry'

describe('initSentry', () => {
  beforeEach(() => {
    initMock.mockClear()
  })

  it('does not call Sentry.init when DSN is missing', () => {
    initSentry(undefined)
    expect(initMock).not.toHaveBeenCalled()
  })

  it('does not call Sentry.init when DSN is empty', () => {
    initSentry('')
    expect(initMock).not.toHaveBeenCalled()
  })

  it('calls Sentry.init with the DSN when provided', () => {
    initSentry('https://examplePublicKey@o0.ingest.sentry.io/0')
    expect(initMock).toHaveBeenCalledTimes(1)
    const arg = initMock.mock.calls[0][0] as Record<string, unknown>
    expect(arg.dsn).toBe('https://examplePublicKey@o0.ingest.sentry.io/0')
    expect(arg.tracesSampleRate).toBe(0)
  })
})
```

- [ ] **Step 7.3: Run the test — should fail**

Run:
```bash
npm run test:unit -- initSentry
```

Expected: cannot find module `../initSentry`.

- [ ] **Step 7.4: Implement initSentry**

Create `src/lib/initSentry.ts`:

```typescript
import * as Sentry from '@sentry/react'

/**
 * Initialize Sentry if a DSN is provided at build time via VITE_SENTRY_DSN.
 * No-op otherwise so the app works in dev and forks without a Sentry account.
 */
export function initSentry(dsn: string | undefined): void {
  if (!dsn) return
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  })
}
```

- [ ] **Step 7.5: Run the test — should pass**

Run:
```bash
npm run test:unit -- initSentry
```

Expected: three cases pass.

- [ ] **Step 7.6: Wire Sentry and ErrorBoundary into main.tsx**

Replace `src/main.tsx` with:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App'
import { initSentry } from './lib/initSentry'

initSentry(import.meta.env.VITE_SENTRY_DSN)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<SentryFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)

function SentryFallback() {
  return (
    <div role="alert" className="flex h-screen items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          An unexpected error occurred. Refresh the page to try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
```

Note: the fallback defined below its use is fine because function declarations are hoisted. TypeScript will accept this; if your project has an eslint rule against use-before-declare, either disable it for this file or move the function above the `createRoot` call.

- [ ] **Step 7.7: Create .env.example**

Create `.env.example`:

```
# Optional. Obtain a DSN by creating a project at https://sentry.io/.
# Leave empty in dev; set as a GitHub Actions secret named VITE_SENTRY_DSN for production builds.
VITE_SENTRY_DSN=
```

Also add `.env` and `.env.local` to `.gitignore` if not already present (check existing `.gitignore` — likely covered by default Vite template).

- [ ] **Step 7.8: Inject the DSN during the Pages build**

Modify `.github/workflows/deploy.yml` — change the `npm run build` step to:

```yaml
      - name: Build
        run: npm run build
        env:
          VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
```

Note: this requires adding a `VITE_SENTRY_DSN` repository secret via **Settings → Secrets and variables → Actions → New repository secret**. Until the secret is set, the env var is empty and Sentry stays a no-op — builds still succeed.

- [ ] **Step 7.9: Document Sentry setup in README**

Modify `README.md` — append (or slot into a "Deployment" or "Operations" section):

```markdown
## Error reporting

Production builds can report runtime errors to Sentry. To enable:

1. Create a project at https://sentry.io/ and copy its DSN.
2. In this repo, go to Settings → Secrets and variables → Actions and add a new repository secret:
   - Name: `VITE_SENTRY_DSN`
   - Value: the DSN from step 1.
3. Trigger a new deploy (`git commit --allow-empty -m "chore: rebuild for Sentry" && git push`).

Without a DSN, the app still works normally — Sentry is a no-op.

## Follow-up work not in this plan

- **Basemap failover to a second provider.** Today we detect failure and show a degraded banner; the bundled country polygons remain interactive. To add a real second provider (Stadia Maps / MapTiler), sign up for an API key and wire a `FALLBACK_BASEMAP_STYLE` in `src/lib/mapStyles.ts` and a fall-through path in `WorldMap.tsx`.
- **Data refresh runbook.** `npm run update-data` is not scheduled; decide an owner and cadence before launch.
- **Bandwidth watch.** GH Pages soft-caps at ~100 GB/month. Keep an eye on repo Insights → Traffic.
```

- [ ] **Step 7.10: Regression sweep**

Run everything:

```bash
npm run lint && npm run test:unit && npx playwright test
```

Expected: all green. If the Sentry import breaks lint (e.g., unused import rules), fix the import, not the rule.

- [ ] **Step 7.11: Commit**

```bash
git add package.json package-lock.json .env.example src/lib/initSentry.ts src/lib/__tests__/initSentry.test.ts src/main.tsx .github/workflows/deploy.yml README.md
git commit -m "feat: Sentry error reporting behind VITE_SENTRY_DSN env var"
```

---

## Wrap-up

- [ ] **Step W.1: Push the branch and open a PR**

```bash
git push -u origin <your-feature-branch>
gh pr create --fill
```

- [ ] **Step W.2: Verify the deploy**

After CI passes and GH Pages redeploys:

1. Visit `https://tobi-ens.github.io/polworldmap/` and confirm:
   - The map loads normally (no error overlay, no banner).
   - Viewing source shows the OG + Twitter + preload tags.
   - `https://tobi-ens.github.io/polworldmap/robots.txt` returns 200 with expected body.
   - `https://tobi-ens.github.io/polworldmap/sitemap.xml` returns 200 with expected body.
2. Paste the canonical URL into Slack or iMessage — confirm the preview card shows the screenshot.
3. If `VITE_SENTRY_DSN` is configured: trigger a deliberate error (e.g., rename `src/App.tsx` temporarily to force a module-load failure, redeploy, verify event appears in Sentry, revert) — or wait for a real error to appear.

- [ ] **Step W.3: Update memory**

Save two memory entries for future sessions:

1. A `reference` memory pointing to Sentry DSN location (if set): "Sentry DSN for polworldmap lives in repo secret `VITE_SENTRY_DSN`; events flow to the `polworldmap` project in Sentry."
2. A `project` memory: "polworldmap launched to 100k-user scale on GH Pages on 2026-04-NN with LICENSE, OG/SEO, map watchdog, degraded-mode banner, and Sentry. Basemap failover and Cloudflare Pages migration deferred as follow-ups."

(Adjust dates and status if reality differs.)
