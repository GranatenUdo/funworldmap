# Security Hardening + Reveal Camera + Tutorial Click Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four bundled changes on one PR: a GDELT URL protocol allowlist (defense-in-depth), strip `__funworldmap_*` test seams from production builds, fix the first-session tutorial swallowing player clicks, and replace `fitBounds` reveal over-zoom with a per-frame camera that follows the dashed line.

**Architecture:** One branch, four atomic commits in load-bearing order. Commit 1 is a pure pipeline filter in the daily-news ingestion script (vitest). Commit 2 introduces a new Vite mode (`--mode e2e`) that toggles `VITE_TEST_HOOKS=1` so the `__funworldmap_*` seams are tree-shaken from the production bundle while Playwright keeps its introspection hooks. Commit 3 adds a `firstAttemptMade` prop to the tutorial so it dismisses on the first guess (existing pipeline unchanged). Commit 4 replaces the reveal `fitBounds` with `map.jumpTo({ center: arc[idx] })` inside the existing rAF loop.

**Tech Stack:** React 19, TypeScript, Vite 6, MapLibre GL 5.23, Vitest (unit), Playwright 1.59 (e2e).

**Spec:** `docs/superpowers/specs/2026-04-25-hardening-and-reveal-fixes-design.md`

---

## File Structure

### Created
- `.env.e2e` — Vite mode env file. Sets `VITE_TEST_HOOKS=1` only when `vite build --mode e2e` is invoked.
- `scripts/news/__tests__/gdelt-client.test.ts` — vitest covering URL allowlist (drop article on `javascript:`, null thumbnail on `data:`, pass clean http/https).
- `e2e/tutorial-first-click.spec.ts` — Playwright spec asserting the tutorial dismisses on first guess and the attempt counts.

### Modified
- `scripts/news/gdelt-client.ts` — replace `.map(...)` with URL-allowlist filter that may return `null` and a downstream `.filter(...)` typed predicate.
- `package.json` — add `"build:e2e": "tsc -b && vite build --mode e2e"`.
- `playwright.config.ts` — change `webServer.command` to use `build:e2e`; add `tutorial-first-click.spec.ts` to `mobile-chromium` and `chromium-gpu` `testMatch`.
- `src/hooks/useMapInstance.ts` — wrap the `__funworldmap_map` set/delete in `if (import.meta.env.VITE_TEST_HOOKS)`.
- `src/game/GameController.tsx` — add `if (!import.meta.env.VITE_TEST_HOOKS) return` at the top of the test-seam effect; pass `firstAttemptMade` prop to `<FirstSessionTutorial>`; replace the reveal `fitBounds` with t=0 + per-frame `jumpTo`; delete the `fitPadding` helper.
- `src/game/shared/GameSessionProvider.tsx` — add `if (!import.meta.env.VITE_TEST_HOOKS) return` at the top of the test-seam effect.
- `src/game/shared/hud/FirstSessionTutorial.tsx` — add `firstAttemptMade?: boolean` prop and a `useEffect` that closes the tutorial when the prop turns true.
- `e2e/reveal-animation.spec.ts` — add an end-of-animation assertion that `map.getCenter()` lands on the target centroid (~2° tolerance).

---

## Phase 0 — Branch Setup

### Task 0: Create feature branch

**Files:** _(none — git only)_

- [ ] **Step 1: Verify clean tree on main**

Run: `git status`
Expected: "nothing to commit, working tree clean" (apart from the untracked `docs/design-sketches/` folder).

- [ ] **Step 2: Create branch**

```bash
git checkout main
git pull
git checkout -b hardening-and-reveal-fixes
```

- [ ] **Step 3: Verify branch**

Run: `git rev-parse --abbrev-ref HEAD`
Expected: `hardening-and-reveal-fixes`.

---

## Phase 1 — Commit 1: GDELT URL protocol allowlist

### Task 1: Write the gdelt-client URL allowlist tests

**Files:**
- Create: `scripts/news/__tests__/gdelt-client.test.ts`

- [ ] **Step 1: Write the failing test file**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { gdeltSearch } from '../gdelt-client'

interface RawRow {
  url: string
  title: string
  seendate: string
  socialimage?: string
  domain: string
  language: string
}

function mockGdelt(articles: RawRow[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ articles }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  )
}

describe('gdeltSearch URL allowlist', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('drops articles whose url is not http(s)', async () => {
    mockGdelt([
      {
        url: 'javascript:alert(1)',
        title: 'evil',
        seendate: '20260424T120000Z',
        domain: 'evil.example',
        language: 'English',
      },
      {
        url: 'https://good.example/a',
        title: 'good',
        seendate: '20260424T120000Z',
        domain: 'good.example',
        language: 'English',
      },
    ])
    const out = await gdeltSearch({
      fips: 'GM',
      sourceLang: 'english',
      timespan: '7d',
      maxRecords: 5,
    })
    expect(out).toHaveLength(1)
    expect(out[0].url).toBe('https://good.example/a')
  })

  it('keeps article but nulls thumbnail when socialimage is non-http(s)', async () => {
    mockGdelt([
      {
        url: 'https://good.example/a',
        title: 'good',
        seendate: '20260424T120000Z',
        socialimage: 'data:image/png;base64,abc',
        domain: 'good.example',
        language: 'English',
      },
    ])
    const out = await gdeltSearch({
      fips: 'GM',
      sourceLang: 'english',
      timespan: '7d',
      maxRecords: 5,
    })
    expect(out).toHaveLength(1)
    expect(out[0].thumbnail).toBeNull()
  })

  it('passes clean http(s) url + thumbnail through unchanged', async () => {
    mockGdelt([
      {
        url: 'https://good.example/a',
        title: 'good',
        seendate: '20260424T120000Z',
        socialimage: 'https://cdn.example/img.jpg',
        domain: 'good.example',
        language: 'English',
      },
    ])
    const out = await gdeltSearch({
      fips: 'GM',
      sourceLang: 'english',
      timespan: '7d',
      maxRecords: 5,
    })
    expect(out).toHaveLength(1)
    expect(out[0].url).toBe('https://good.example/a')
    expect(out[0].thumbnail).toBe('https://cdn.example/img.jpg')
  })

  it('drops articles whose url throws on URL constructor (malformed)', async () => {
    mockGdelt([
      {
        url: 'not a url',
        title: 'bad',
        seendate: '20260424T120000Z',
        domain: 'bad.example',
        language: 'English',
      },
    ])
    const out = await gdeltSearch({
      fips: 'GM',
      sourceLang: 'english',
      timespan: '7d',
      maxRecords: 5,
    })
    expect(out).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run vitest, confirm all four tests fail**

Run: `npx vitest run scripts/news/__tests__/gdelt-client.test.ts`
Expected: tests run; **first three fail** (current code returns `javascript:` and `data:` thumbnails verbatim); **fourth fails** because the current code does not validate `url`.

> Note: the first test will actually pass against the current implementation **only if** `language === 'English'` filter happens to drop the malformed row. The `language` is `'English'` in the fixture, so the row is kept and the test will FAIL because `out` will contain two articles, not one. Confirm this is what you see.

### Task 2: Implement the URL allowlist

**Files:**
- Modify: `scripts/news/gdelt-client.ts:78-86`

- [ ] **Step 1: Replace the `.map(...)` with an allowlist mapper**

Current code (lines 78–86):
```ts
return raw
  .filter((a) => a.language === 'English')
  .map((a) => ({
    id: a.url,
    title: sanitise(a.title),
    url: a.url,
    publishedAt: seendateToIso(a.seendate),
    domain: a.domain,
    thumbnail: a.socialimage && a.socialimage.length > 0 ? a.socialimage : null,
  }))
```

Replace with:
```ts
return raw
  .filter((a) => a.language === 'English')
  .map((a): GdeltArticle | null => {
    let articleUrl: string
    try {
      const u = new URL(a.url)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        console.warn(`[news] dropping article: non-http(s) URL ${a.url}`)
        return null
      }
      articleUrl = a.url
    } catch {
      console.warn(`[news] dropping article: malformed URL ${a.url}`)
      return null
    }

    let thumbnail: string | null = null
    if (a.socialimage && a.socialimage.length > 0) {
      try {
        const u = new URL(a.socialimage)
        if (u.protocol === 'http:' || u.protocol === 'https:') {
          thumbnail = a.socialimage
        } else {
          console.warn(`[news] nulling thumbnail: non-http(s) ${a.socialimage}`)
        }
      } catch {
        console.warn(`[news] nulling thumbnail: malformed ${a.socialimage}`)
      }
    }

    return {
      id: articleUrl,
      title: sanitise(a.title),
      url: articleUrl,
      publishedAt: seendateToIso(a.seendate),
      domain: a.domain,
      thumbnail,
    }
  })
  .filter((x): x is GdeltArticle => x !== null)
```

- [ ] **Step 2: Run vitest, confirm all four tests pass**

Run: `npx vitest run scripts/news/__tests__/gdelt-client.test.ts`
Expected: 4/4 PASS.

- [ ] **Step 3: Run the full vitest suite to confirm no regression**

Run: `npm run test:unit`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/news/gdelt-client.ts scripts/news/__tests__/gdelt-client.test.ts
git commit -m "$(cat <<'EOF'
chore(news): drop GDELT articles with non-http(s) URLs

Defense-in-depth at the build-time ingestion boundary. Articles whose
url is not http(s) (including malformed) are dropped; articles whose
socialimage thumbnail is not http(s) keep the article but null the
thumbnail. Logged via console.warn so the daily-refresh workflow
surfaces unexpected URL shapes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Commit 2: Strip `__funworldmap_*` seams from production

### Task 3: Add `.env.e2e` and `build:e2e` script

**Files:**
- Create: `.env.e2e`
- Modify: `package.json`

- [ ] **Step 1: Create `.env.e2e`**

```
VITE_TEST_HOOKS=1
```

- [ ] **Step 2: Add `build:e2e` script to `package.json`**

In `scripts`, after the existing `"build"` line, add:
```json
"build:e2e": "tsc -b && vite build --mode e2e",
```

Final `scripts` block should read:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "build:e2e": "tsc -b && vite build --mode e2e",
  "preview": "vite preview",
  "lint": "eslint src/",
  "format": "prettier --write src/",
  "test:e2e": "playwright test",
  "test:unit": "vitest run",
  "news:build": "tsx scripts/news/build.ts",
  "daily:generate": "tsx scripts/daily-content/generate-index.ts",
  "daily:validate": "tsx scripts/daily-content/validate-pools.ts",
  "update-data": "tsx scripts/fetch-countries.ts",
  "fetch-cities": "tsx scripts/fetch-cities.ts"
}
```

- [ ] **Step 3: Verify `.env.e2e` is NOT in `.gitignore`**

Run: `git check-ignore -v .env.e2e`
Expected: nothing printed (file is NOT ignored). The repo's `.gitignore` excludes `.env`, `.env.local`, and `.env.*.local` — none of which match `.env.e2e`.

- [ ] **Step 4: Verify `build:e2e` produces a working bundle**

Run: `npm run build:e2e`
Expected: no errors; `dist/` written.

### Task 4: Update Playwright webServer to use `build:e2e`

**Files:**
- Modify: `playwright.config.ts:96`

- [ ] **Step 1: Change `webServer.command`**

Find:
```ts
command: 'npm run build && npm run preview -- --port 5173 --strictPort',
```

Replace with:
```ts
command: 'npm run build:e2e && npm run preview -- --port 5173 --strictPort',
```

- [ ] **Step 2: Run a single quick e2e to confirm seams still work under e2e build**

Run: `npx playwright test e2e/reveal-animation.spec.ts --project chromium-gpu`
Expected: PASS. (This spec relies on `__funworldmap_game.setRound` and `submitCountryGuess`.)

### Task 5: Gate seams in `useMapInstance.ts` (wrap-line)

**Files:**
- Modify: `src/hooks/useMapInstance.ts:97`
- Modify: `src/hooks/useMapInstance.ts:159`

- [ ] **Step 1: Wrap the seam set at line 97**

Find:
```ts
// Test seam — exposed in production too so e2e can introspect MapLibre state.
;(window as unknown as Record<string, unknown>).__funworldmap_map = map
```

Replace with:
```ts
// Test seam — only exposed under VITE_TEST_HOOKS so production bundles ship clean.
if (import.meta.env.VITE_TEST_HOOKS) {
  ;(window as unknown as Record<string, unknown>).__funworldmap_map = map
}
```

- [ ] **Step 2: Wrap the seam delete at line 159 (now ~161 after the edit above)**

Find:
```ts
delete (window as unknown as Record<string, unknown>).__funworldmap_map
```

Replace with:
```ts
if (import.meta.env.VITE_TEST_HOOKS) {
  delete (window as unknown as Record<string, unknown>).__funworldmap_map
}
```

### Task 6: Gate seams in `GameController.tsx` (early-return)

**Files:**
- Modify: `src/game/GameController.tsx:537-593`

- [ ] **Step 1: Add early-return at the top of the test-seam effect**

Find the start of the effect at line 537:
```ts
// Expose submitGuess + setRound on window for tests.
useEffect(() => {
  const w = window as unknown as { __funworldmap_game?: Record<string, unknown> }
```

Insert the gate right after the opening `() => {`:
```ts
// Expose submitGuess + setRound on window for tests.
useEffect(() => {
  if (!import.meta.env.VITE_TEST_HOOKS) return
  const w = window as unknown as { __funworldmap_game?: Record<string, unknown> }
```

The cleanup function below does not need separate gating — if the body returned early, the cleanup function never registered.

### Task 7: Gate seams in `GameSessionProvider.tsx` (early-return)

**Files:**
- Modify: `src/game/shared/GameSessionProvider.tsx:69-80`

- [ ] **Step 1: Add early-return at the top of the test-seam effect**

Find:
```ts
useEffect(() => {
  const w = window as unknown as { __funworldmap_game?: Record<string, unknown> }
```

Insert the gate right after the opening `() => {`:
```ts
useEffect(() => {
  if (!import.meta.env.VITE_TEST_HOOKS) return
  const w = window as unknown as { __funworldmap_game?: Record<string, unknown> }
```

### Task 8: Verify production bundle has no seams

**Files:** _(none — verification only)_

- [ ] **Step 1: Run a clean production build**

```bash
rm -rf dist
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 2: Grep for seam strings**

Run: `grep -r "__funworldmap_" dist/`
Expected: **zero hits**. The strings are tree-shaken with `import.meta.env.VITE_TEST_HOOKS = undefined`.

- [ ] **Step 3: Run a clean e2e build and verify seams ARE present**

```bash
rm -rf dist
npm run build:e2e
grep -r "__funworldmap_" dist/ | head -5
```

Expected: at least one hit for `__funworldmap_map` or `__funworldmap_game`.

### Task 9: Run full Playwright matrix under e2e build

**Files:** _(none — test run only)_

- [ ] **Step 1: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: all projects (`chromium`, `chromium-gpu`, `mobile-chromium`, `mobile-webkit`, `desktop-firefox-touch`) pass.

- [ ] **Step 2: Commit**

```bash
git add .env.e2e package.json playwright.config.ts \
        src/hooks/useMapInstance.ts \
        src/game/GameController.tsx \
        src/game/shared/GameSessionProvider.tsx
git commit -m "$(cat <<'EOF'
chore(build): gate __funworldmap_* test seams behind VITE_TEST_HOOKS

Production bundles no longer expose game-state mutation seams. New
Vite mode `--mode e2e` (via .env.e2e + build:e2e script) sets
VITE_TEST_HOOKS=1 so Playwright keeps its introspection hooks while
shipped bundles tree-shake the gated branches.

Two gating strategies, chosen per effect structure:
- useMapInstance: wrap-line (effect also creates the map; minimise diff)
- GameController + GameSessionProvider: early-return (effect manages
  only seams)

Manual verification: rm -rf dist && npm run build && grep -r
"__funworldmap_" dist/ → zero hits. rm -rf dist && npm run build:e2e
→ seams present. Full Playwright matrix green.

Note for contributors: do NOT put VITE_TEST_HOOKS in .env.local (it
is loaded for all modes and would leak seams into your local prod
build). CI is unaffected since .env.local is gitignored.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Commit 3: Tutorial dismisses on first guess

### Task 10: Write the failing tutorial-first-click e2e spec

**Files:**
- Create: `e2e/tutorial-first-click.spec.ts`
- Modify: `playwright.config.ts` (add to `mobile-chromium` and `chromium-gpu` `testMatch`)

- [ ] **Step 1: Create the spec**

```ts
import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

test.describe('first-session tutorial', () => {
  test('dismisses on first guess and the attempt counts', async ({ page }) => {
    // Sessionstorage scoped to origin — clearing localStorage isn't enough; the
    // tutorial uses sessionStorage. Visit a benign page first so we can clear it
    // before the tutorial mounts.
    await page.goto('/')
    await page.evaluate(() => sessionStorage.clear())

    await page.goto('/#game/country-pinning/play')
    await waitForMap(page)
    await expect(page.getByTestId('game-tutorial')).toBeVisible({ timeout: 10_000 })

    // First guess via the test seam — counts as a wrong guess (USA is unlikely
    // to be the random round target; even if it is, the tutorial still dismisses
    // because currentAttempts.length goes 0→1 either way).
    await page.evaluate(() => window.__funworldmap_game?.submitCountryGuess?.('USA'))

    await expect(page.getByTestId('game-tutorial')).toBeHidden()
    const attempts = await page.evaluate(
      () => window.__funworldmap_game?.getSession?.().currentAttempts.length,
    )
    expect(attempts).toBe(1)
  })
})
```

- [ ] **Step 2: Add the spec to the playwright project `testMatch`**

In `playwright.config.ts`, find the `chromium-gpu` project's `testMatch` array and append `'tutorial-first-click.spec.ts'`. Find the `mobile-chromium` project's `testMatch` array and append `'tutorial-first-click.spec.ts'`.

Final `chromium-gpu` testMatch should read (note: the existing list is preserved; only the new entry is added at the end):
```ts
testMatch: ['map-and-countries.spec.ts', 'map-reliability.spec.ts', 'keyboard-map-nav.spec.ts', 'game-country-pinning.spec.ts', 'game-city-guessing.spec.ts', 'compare-view-dimming.spec.ts', 'reveal-animation.spec.ts', 'reveal-animation-reduced-motion.spec.ts', 'tutorial-first-click.spec.ts'],
```

Final `mobile-chromium` testMatch:
```ts
testMatch: ['mobile-smoke.spec.ts', 'mobile-tap.spec.ts', 'mobile-daily-flow.spec.ts', 'mobile-free-play.spec.ts', 'tutorial-first-click.spec.ts'],
```

- [ ] **Step 3: Run the new spec, confirm it fails**

Run: `npx playwright test e2e/tutorial-first-click.spec.ts --project mobile-chromium`
Expected: **FAIL.** The tutorial does not dismiss after the first guess; `expect(page.getByTestId('game-tutorial')).toBeHidden()` times out. The `attempts` assertion may pass (the seam guess still goes through). Confirm the failure is on the visibility assertion.

### Task 11: Implement the dismiss-on-first-attempt prop in `FirstSessionTutorial`

**Files:**
- Modify: `src/game/shared/hud/FirstSessionTutorial.tsx`

- [ ] **Step 1: Add the prop and the dismiss effect**

Replace the `Props` interface and the function signature (lines 17–29) with:
```ts
interface Props {
  modeId: ModeId
  firstAttemptMade?: boolean
}

export function FirstSessionTutorial({ modeId, firstAttemptMade }: Props) {
  const [open, setOpen] = useState(false)
  const key = KEY_PREFIX + modeId

  useEffect(() => {
    if (sessionStorage.getItem(key)) return
    setOpen(true)
    sessionStorage.setItem(key, '1')
  }, [key])

  useEffect(() => {
    if (firstAttemptMade) setOpen(false)
  }, [firstAttemptMade])
```

The remainder of the function (the early `if (!open) return null` and the JSX) is unchanged.

### Task 12: Pass `firstAttemptMade` from `GameController`

**Files:**
- Modify: `src/game/GameController.tsx:629`

- [ ] **Step 1: Pass the prop**

Find:
```tsx
<FirstSessionTutorial modeId={session.modeId} />
```

Replace with:
```tsx
<FirstSessionTutorial
  modeId={session.modeId}
  firstAttemptMade={session.currentAttempts.length > 0}
/>
```

- [ ] **Step 2: Run the new spec, confirm it passes**

Run: `npx playwright test e2e/tutorial-first-click.spec.ts --project mobile-chromium`
Expected: PASS.

- [ ] **Step 3: Run the full e2e matrix**

Run: `npm run test:e2e`
Expected: all projects pass (no regressions in existing specs).

- [ ] **Step 4: Run unit tests too**

Run: `npm run test:unit`
Expected: all pass. (No `FirstSessionTutorial` unit test exists; the prop addition is covered by the e2e spec.)

- [ ] **Step 5: Commit**

```bash
git add src/game/shared/hud/FirstSessionTutorial.tsx \
        src/game/GameController.tsx \
        e2e/tutorial-first-click.spec.ts \
        playwright.config.ts
git commit -m "$(cat <<'EOF'
fix(game): tutorial dismisses on first guess so attempts aren't silently lost

The FirstSessionTutorial used pointer-events-none, so a click on the
overlay fell through to the map and consumed a country-pinning attempt
on whichever country sat under the box (Russia/Greenland/Mongolia,
depending on viewport). The wrong-guess border pulse fired but was
visually hidden by the box at z-[45], so the user perceived "click did
nothing" while three attempts silently drained into game-over.

Fix: the tutorial closes the moment session.currentAttempts.length > 0.
First click both counts as a guess (existing pipeline, unchanged) AND
clears the box, restoring visibility of the wrong-guess feedback. The
"Got it" button stays as a manual escape.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Commit 4: Reveal camera follows the line head

### Task 13: Add the failing camera-end-position assertion

**Files:**
- Modify: `e2e/reveal-animation.spec.ts`

- [ ] **Step 1: Append a camera-position assertion to the existing wrong-country test**

Find the end of the first test (after `expect(coords[64][1]).toBeCloseTo(46, 0)`):
```ts
    expect(coords[64][0]).toBeCloseTo(2, 0)
    expect(coords[64][1]).toBeCloseTo(46, 0)
  })
```

Insert before the closing `})`:
```ts
    expect(coords[64][0]).toBeCloseTo(2, 0)
    expect(coords[64][1]).toBeCloseTo(46, 0)

    // Camera ends near the target centroid (FRA = [2, 46]). 2° tolerance
    // accommodates the final-frame quantisation of arc[idx].
    const center = await page.evaluate(() => {
      const c = window.__funworldmap_map?.getCenter()
      return c ? { lng: c.lng, lat: c.lat } : null
    })
    expect(center).not.toBeNull()
    expect(center!.lng).toBeCloseTo(2, 0)
    expect(center!.lat).toBeCloseTo(46, 0)
  })
```

- [ ] **Step 2: Run the spec, confirm it fails**

Run: `npx playwright test e2e/reveal-animation.spec.ts --project chromium-gpu`
Expected: **FAIL.** The current `fitBounds([DEU, FRA])` lands the camera near the bbox center `(5.5, 48.5)`, not on FRA `(2, 46)`. The new assertion fails with `lng` ≈ 5.5, not within 2 of 2.

### Task 14: Replace `fitBounds` with t=0 `jumpTo` to wrong-guess centroid

**Files:**
- Modify: `src/game/GameController.tsx:406-411`

- [ ] **Step 1: Replace the `fitBounds` block**

Find lines 406–411:
```ts
const lngs = [plan.from[0], plan.to[0]]
const lats = [plan.from[1], plan.to[1]]
map.fitBounds(
  [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
  { duration: plan.durationMs, padding: fitPadding(), maxZoom: 6 },
)
```

Replace with:
```ts
// Snap camera to the wrong-guess centroid; rAF loop will track the line head.
map.jumpTo({ center: plan.from })
```

### Task 15: Add per-frame camera follow inside the rAF step

**Files:**
- Modify: `src/game/GameController.tsx:425-447`

- [ ] **Step 1: Add a `jumpTo` after the `setData` call inside the `if (idx !== lastIdx)` branch**

Find the existing `setData` block inside the rAF step:
```ts
if (idx !== lastIdx) {
  lastIdx = idx
  try {
    lineSrc.setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: arc.slice(0, idx + 1) },
        properties: {},
      }],
    })
  } catch { /* source may have been torn down */ }
}
```

Replace with:
```ts
if (idx !== lastIdx) {
  lastIdx = idx
  try {
    lineSrc.setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: arc.slice(0, idx + 1) },
        properties: {},
      }],
    })
    map.jumpTo({ center: arc[idx] })
  } catch { /* source may have been torn down */ }
}
```

### Task 16: Add `jumpTo` for reduced-motion path

**Files:**
- Modify: `src/game/GameController.tsx:413-421`

- [ ] **Step 1: Add `jumpTo({ center: plan.to })` after the full-arc setData**

Find the reduced-motion branch:
```ts
if (plan.durationMs === 0) {
  lineSrc.setData({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: arc },
      properties: {},
    }],
  })
} else {
```

Replace with:
```ts
if (plan.durationMs === 0) {
  lineSrc.setData({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: arc },
      properties: {},
    }],
  })
  map.jumpTo({ center: plan.to })
} else {
```

### Task 17: Delete the now-unused `fitPadding` helper

**Files:**
- Modify: `src/game/GameController.tsx:44-48`

- [ ] **Step 1: Verify `fitPadding` has no remaining call sites**

Run: `grep -n "fitPadding" src/game/GameController.tsx`
Expected: only the function definition remains (lines 44–48). The previous call site at line 410 was removed in Task 14.

- [ ] **Step 2: Delete the function**

Find lines 44–48:
```ts
function fitPadding(): number {
  const vw = window.innerWidth
  const vh = window.innerHeight
  return Math.max(40, Math.min(120, Math.min(vw, vh) * 0.1))
}
```

Delete the entire block (including the trailing blank line if present).

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

### Task 18: Verify reveal-animation spec passes

**Files:** _(none — test run only)_

- [ ] **Step 1: Run the modified reveal spec**

Run: `npx playwright test e2e/reveal-animation.spec.ts --project chromium-gpu`
Expected: PASS — both the existing arc assertions and the new camera-position assertion succeed.

- [ ] **Step 2: Run the reduced-motion spec**

Run: `npx playwright test e2e/reveal-animation-reduced-motion.spec.ts --project chromium-gpu`
Expected: PASS — the `jumpTo({ center: plan.to })` doesn't affect line geometry.

- [ ] **Step 3: Run the full e2e matrix**

Run: `npm run test:e2e`
Expected: all projects pass.

### Task 19: Manual smoke in dev server

**Files:** _(none — manual verification)_

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open: http://localhost:5173

- [ ] **Step 2: Smoke short-arc reveal**

Navigate: `#game/country-pinning/play`
Pin France via test seam: open browser console, `window.__funworldmap_game?.setRound?.('FRA')`.
Submit Germany: `window.__funworldmap_game?.submitCountryGuess?.('DEU')`.
Expected: dashed line draws from DEU → FRA over ~600 ms; camera tracks the line head; ends on France.

- [ ] **Step 3: Smoke transcontinental-arc reveal**

Set round to ARG: `window.__funworldmap_game?.setRound?.('ARG')`.
Submit MNG: `window.__funworldmap_game?.submitCountryGuess?.('MNG')`.
Expected: globe rotates along the dashed line from Mongolia toward Argentina over ~1200 ms; camera ends on Argentina; no over-zoom.

- [ ] **Step 4: Smoke city-guessing wrong click**

Navigate: `#game/city-guessing/play`.
Submit a click guess at [0, 0]: `window.__funworldmap_game?.submitGuess?.({ kind: 'point', lngLat: [0, 0] })`.
Expected: dashed line draws from [0, 0] toward target city; camera follows; ends on target city.

- [ ] **Step 5: Smoke reduced-motion**

Open DevTools → Rendering → emulate `prefers-reduced-motion: reduce`.
Submit any wrong guess.
Expected: full dashed line appears instantly; camera lands on the target instantly.

- [ ] **Step 6: Commit**

```bash
git add src/game/GameController.tsx e2e/reveal-animation.spec.ts
git commit -m "$(cat <<'EOF'
fix(reveal): camera follows the line head from wrong guess to target

fitBounds([guess, target]) over-zoomed on transcontinental wrong
guesses (e.g., Mongolia → Argentina dropped the camera to z≈1, losing
all detail). Replace with:

  - t=0: map.jumpTo({ center: plan.from }) snaps camera to wrong guess
  - per rAF frame: map.jumpTo({ center: arc[idx] }) tracks the line head
  - reduced-motion: map.jumpTo({ center: plan.to }) instant settle

Camera holds the user's pre-guess zoom; only center changes. Globe
projection rotates naturally for long arcs. The fitPadding() helper
loses its only call site and is deleted.

Test seam in e2e/reveal-animation.spec.ts asserts map.getCenter() lands
within 2° of the FRA centroid at end of animation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Final verification

### Task 20: Whole-PR sanity check

**Files:** _(none — verification only)_

- [ ] **Step 1: Verify clean working tree**

Run: `git status`
Expected: clean. (Untracked `docs/design-sketches/` is acceptable.)

- [ ] **Step 2: Verify four commits in the right order**

Run: `git log --oneline main..HEAD`
Expected (newest first):
```
fix(reveal): camera follows the line head from wrong guess to target
fix(game): tutorial dismisses on first guess so attempts aren't silently lost
chore(build): gate __funworldmap_* test seams behind VITE_TEST_HOOKS
chore(news): drop GDELT articles with non-http(s) URLs
```

- [ ] **Step 3: Run full unit + e2e suites once more on the branch tip**

```bash
npm run test:unit
npm run test:e2e
```

Expected: both fully green.

- [ ] **Step 4: Re-run the dist seam-leak verification**

```bash
rm -rf dist
npm run build
grep -r "__funworldmap_" dist/
```

Expected: zero hits.

- [ ] **Step 5: Open PR**

```bash
git push -u origin hardening-and-reveal-fixes
```

Then via `gh pr create` (the user creates the PR; do not auto-create unless asked).

PR body should include:
- Summary of the four commits.
- Manual verification log (`grep dist/`, full Playwright matrix run).
- Note: contributors must NOT put `VITE_TEST_HOOKS` in their `.env.local`.
- Note: first daily-refresh after merge may show a small article delta.
