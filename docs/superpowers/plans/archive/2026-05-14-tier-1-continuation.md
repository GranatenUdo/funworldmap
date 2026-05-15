# Tier-1 Continuation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land three high-value, low-cost items that have been deferred from earlier plans (panel-open focus management, countries chunk swap, bundle-budget CI gate), plus a small cosmetics cleanup and a brainstorming trigger for the larger GameController refactor.

**Architecture:** Four independent phases producing four PRs of code + one docs-only PR with a new brainstorm-derived plan. Each phase is self-contained; the order is recommended but not load-bearing.

**Tech Stack:** React 19 + Vite + Vitest (unit tests), Playwright (e2e), GitHub Actions (CI), Tailwind v4, MapLibre GL.

---

## Scope check

This plan covers four independent subsystems (a11y, asset/perf, CI infra, architecture-brainstorming) but each is small enough that splitting into four separate plans would be more overhead than value. Keeping as one plan with clearly-bounded phases. The GameController extraction is **not** planned here — it is a brainstorming trigger that produces its own plan.

## What is NOT in this plan (explicit deferrals)

- **GameController extraction implementation.** Phase 4 produces a brainstorm-derived plan; implementation happens later.
- **44×44 touch target floor audit.** A real mobile-a11y gap but ~1 day of CSS work. Deferred.
- **ESLint upgrade to `recommended-type-checked`.** Spread over a week. Deferred.
- **Self-hosted GPU runner.** User confirmed blocked indefinitely; the 13 testIgnore'd specs, 3 quarantined animation-interrupt tests (#47), 2 quarantined launcher / game-over-mode-switch specs (#31, #32), and 3-of-4 cross-browser Playwright projects all stay in their current state.
- **Forced-colors / Windows HC mode.** Low priority. Surface when someone asks.
- **Unhappy-paths.md Section C / E / F.** Still mostly hypothesized. Verify when the underlying contracts change.

---

## File map

Files this plan touches:

- Modify: `.github/workflows/deploy.yml` — drop `"News feed"` from workflow_run array
- Modify: `docs/testing/playwright-matrix.md` — add 4 new specs
- Modify: `src/components/SingleCountryPanel.tsx` — focus management on mount
- Create: `src/components/__tests__/SingleCountryPanel.focus.test.tsx` — unit test for focus contract
- Modify: `src/lib/loadCountryGeojson.ts` — switch import, add hand-patch for missing entities
- Create: `src/lib/missingCountriesPatch.ts` — synthetic geometry for IDs missing from 50m
- Create: `src/lib/__tests__/loadCountryGeojson-coverage.test.ts` — verify all 195 canonical IDs are returned
- Create: `scripts/bundle-budget/check.ts` — bundle-size budget enforcement script
- Create: `scripts/bundle-budget/budgets.json` — declared budgets
- Modify: `.github/workflows/ci.yml` — add bundle-budget step to the fast job
- Modify: `package.json` — add `bundle:budget` script
- Create: `docs/superpowers/plans/<date>-game-controller-extraction.md` — derived from Phase 4's brainstorm

---

## Phase 0 — Cosmetic cleanups + matrix refresh (1 PR)

### Task 0.1: Drop dead deploy.yml ref + fully refresh playwright-matrix.md

**Files:**
- Modify: `.github/workflows/deploy.yml` — drop `"News feed"` from workflow_run array
- Modify: `docs/testing/playwright-matrix.md` — collapse the obsolete chromium/chromium-gpu split, list current spec assignments, reflect the testIgnore CI list

**Context:** Two doc drifts in one cleanup PR.

1. **deploy.yml dead ref**: PR #40 (2026-05-12) deleted `news.yml`. PR #39 added a `workflow_run` trigger referencing `"News feed"`. GitHub silently ignores unknown workflow names, so this is cosmetic; flagged as follow-up in the 2026-05-12 cross-PR review.

2. **playwright-matrix.md is two doc-revisions out of date**:
   - Per CLAUDE.md, the `chromium` and `chromium-gpu` projects were CONSOLIDATED into a single `chromium` project on 2026-05-02 when Software ANGLE was dropped. The matrix at lines 23-30 still shows separate rows for both, plus a "Projects" table at lines 7-13 that mentions `chromium-gpu`.
   - Four specs added since (`animation-interrupt`, `cold-load-deep-link`, `reduced-motion-game-start`, `share-branches`) aren't listed.
   - The 13-spec `testIgnore` list on CI isn't reflected anywhere in the matrix.

The full refresh is the right scope per the user's 2026-05-14 decision.

- [ ] **Step 1: Branch**

```bash
git checkout main
git pull --ff-only origin main
git checkout -b chore/cosmetic-cleanup-2026-05-14
```

- [ ] **Step 2: Edit `deploy.yml`**

Read the current `on:` block in `.github/workflows/deploy.yml`. Find the `workflow_run.workflows` array which currently is:

```yaml
  workflow_run:
    workflows: ["Daily puzzle index", "News feed"]
    types: [completed]
    branches: [main]
```

Change to:

```yaml
  workflow_run:
    workflows: ["Daily puzzle index"]
    types: [completed]
    branches: [main]
```

- [ ] **Step 3: Inventory current state for the matrix refresh**

Before editing the matrix, gather the data:

```bash
# Current chromium testMatch entries (sorted)
grep -E "'[a-z][a-z0-9-]+\.spec\.ts'" playwright.config.ts | grep -v testIgnore | sort -u

# Current testIgnore entries
sed -n '/testIgnore: isCi/,/\]$/p' playwright.config.ts | grep -E "'[a-z]" | sort -u

# Mobile project testMatch entries
grep -B 1 -A 5 "name: 'mobile-" playwright.config.ts | head -30
grep -B 1 -A 5 "name: 'desktop-firefox-touch'" playwright.config.ts | head -10
```

Capture the outputs; you'll use them in Step 4.

- [ ] **Step 4: Refresh `docs/testing/playwright-matrix.md`**

Read the current file, then replace the "Projects" table (lines 5-13) and the "Spec assignment" section (lines 21-30) with the consolidated reality. The new content should:

1. **Projects table**: drop the `chromium-gpu` row. The remaining four are: `chromium` (Chromium engine, desktop, no touch, ANGLE GPU, runs map + DOM specs), `mobile-chromium`, `mobile-webkit`, `desktop-firefox-touch`. Add a footnote noting the 2026-05-02 consolidation.

2. **Spec assignment table**: one row per logical group of specs. The columns become: chromium, mobile-chromium, mobile-webkit, desktop-firefox-touch (NO chromium-gpu column). Use checkmark ✓ for specs that run on a project; leave blank otherwise.

3. **Add a "CI testIgnore" section** below the matrix listing the 13 specs that are configured for chromium but excluded on CI (`label-contrast`, `header-play-reopens-launcher`, `daily-puzzle`, `daily-best-of-3`, `panel-focus`, `accessibility`, `axe-snapshot`, `reveal-animation`, `search`, `done-confirm-low-score`, `game-country-pinning`, `theme-and-responsive`, `source-tooltip-edge`). Note these run locally but are excluded from the CI matrix pending a self-hosted GPU runner (link `docs/roadmap.md` § "Flaky-on-free-CI specs (need GPU runner)").

4. **Add a "Quarantined tests" section** listing the `test.fixme(!!process.env.CI, …)` quarantines: 1 in `e2e/launcher.spec.ts:87` (issue #31), 1 in `e2e/game-over-mode-switch.spec.ts:36` (issue #32), 3 in `e2e/animation-interrupt.spec.ts` (issue #47).

The new specs (animation-interrupt, cold-load-deep-link, reduced-motion-game-start, share-branches) get appended to the chromium-project row in the spec-assignment table. Use the natural grouping (e.g. `share-branches` joins the `daily-share*` group).

Keep the existing "Known config caveats", "Why some specs do not run under every mobile project", "Manual QA — out of CI scope", and "Latent issue to fix later" sections at the end — they're still accurate.

The exact final wording is the implementer's call; the data above is the source of truth. Verify against `playwright.config.ts` after editing:

```bash
# Sanity: every spec in chromium's testMatch is named somewhere in the new matrix
grep -E "'[a-z][a-z0-9-]+\.spec\.ts'" playwright.config.ts | head -50
```

- [ ] **Step 5: Commit and open PR**

```bash
git add .github/workflows/deploy.yml docs/testing/playwright-matrix.md
git commit -m "$(cat <<'EOF'
chore: drop dead News feed ref + refresh playwright-matrix doc

Two cumulative doc drifts in one cleanup commit:

1. After PR #40 deleted news.yml, the workflow_run.workflows array in
   deploy.yml still listed "News feed" — GitHub silently ignores
   unknown workflow names, so cosmetic only. Drop it.

2. playwright-matrix.md still showed a chromium / chromium-gpu split.
   That split was consolidated on 2026-05-02 when Software ANGLE was
   dropped (see CLAUDE.md, docs/superpowers/notes/2026-04-28-flake-
   regression-analysis.md). Four specs added since (animation-interrupt,
   cold-load-deep-link, reduced-motion-game-start, share-branches) were
   missing. The 13-spec testIgnore CI list and the 5 test.fixme
   quarantines (issues #31, #32, #47) weren't documented.

Refresh: collapse chromium/chromium-gpu rows, list current spec
assignments, add CI testIgnore section, add quarantines section.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin chore/cosmetic-cleanup-2026-05-14
gh pr create --title "chore: cosmetic cleanups + playwright-matrix refresh" --body "$(cat <<'EOF'
## Summary
- Drop dead "News feed" ref from deploy.yml (cosmetic; GitHub ignored it)
- Full refresh of docs/testing/playwright-matrix.md: drop chromium-gpu split (consolidated 2026-05-02), add 4 new specs, document the testIgnore CI list and 5 quarantines

## Test plan
- [x] git diff shows every spec in playwright.config.ts's chromium testMatch is named in the new matrix
- [x] No CI-level concerns; docs + config-string only
EOF
)"
```

---

## Phase 1 — Panel-open focus management (a11y, 1 PR)

### Task 1.1: Move focus to country panel heading on mount

**Files:**
- Modify: `src/components/SingleCountryPanel.tsx` — add focus management in the same useEffect that already runs on mount
- Create: `src/components/__tests__/SingleCountryPanel.focus.test.tsx`

**Context (verified 2026-05-11):** `docs/systems/accessibility.md:91` promises: *"When the country panel opens, focus moves to the panel heading (country name). This prevents focus from being lost behind the panel."* The current `SingleCountryPanel.tsx` has `panelRootRef` at line 75 but only uses it for the `getAnimations` idle detector (lines 78-101). No `.focus()` call anywhere.

This is a real WCAG bug. Screen-reader users get no announcement of what just opened.

**Design:** Add a focus-on-mount effect. The target should be the `<h2>` country-name heading at line 161 (which is the natural focal point per the docs). The heading needs `tabIndex={-1}` to be programmatically focusable but not in the natural tab order (it's not a control, just landing focus).

- [ ] **Step 1: Branch**

```bash
git checkout main
git pull --ff-only origin main
git checkout -b fix/a11y-panel-focus-management
```

- [ ] **Step 2: Write the failing unit test**

Create `src/components/__tests__/SingleCountryPanel.focus.test.tsx`. Use the **same fake-timers pattern** as the existing `SingleCountryPanel.test.tsx:117-118` for consistency with the codebase — real rAF is flake-prone in vitest+jsdom:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SingleCountryPanel } from '../SingleCountryPanel'
import type { CountryData, CountriesFile } from '../../lib/types'

const country: CountryData = {
  ccn3: '250',
  cca3: 'FRA',
  name: { common: 'France', official: 'French Republic' },
  flag: 'flags/FR.svg',
  flagAlt: 'Flag of France',
  capital: ['Paris'],
  region: 'Europe',
  subregion: 'Western Europe',
  latlng: [46, 2],
  area: 551695,
  population: 67391582,
  borders: ['ESP', 'ITA'],
  independent: true,
  unMember: true,
  languages: { fra: 'French' },
  currencies: { EUR: { name: 'Euro', symbol: '€' } },
  timezones: ['UTC+01:00'],
  governmentType: 'semi-presidential republic',
} as CountryData

const sources: CountriesFile['_sources'] = {} as CountriesFile['_sources']

const baseProps = {
  country,
  compareWith: null,
  comparePickingMode: false,
  sources,
  isDesktop: true,
  onSelect: () => {},
  onClose: () => {},
  onEnterCompare: () => {},
  onExitCompare: () => {},
  byCca3: new Map(),
} as const

describe('SingleCountryPanel — focus management on mount', () => {
  beforeEach(() => {
    // Same pattern as SingleCountryPanel.test.tsx:117-118 — fake timers
    // around requestAnimationFrame so we can deterministically flush the
    // focus-on-mount rAF without relying on real-time wall-clock.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('moves focus to the country-name heading on mount', () => {
    render(<SingleCountryPanel {...baseProps} />)
    // Flush the rAF that defers the focus call.
    vi.advanceTimersByTime(50)
    const heading = screen.getByRole('heading', { name: 'France', level: 2 })
    expect(document.activeElement).toBe(heading)
  })

  it('heading has tabIndex=-1 so it can be programmatically focused without joining the tab order', () => {
    render(<SingleCountryPanel {...baseProps} />)
    const heading = screen.getByRole('heading', { name: 'France', level: 2 })
    expect(heading.getAttribute('tabIndex')).toBe('-1')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm run test:unit -- SingleCountryPanel.focus 2>&1 | tail -10
```

Expected: both tests FAIL — the heading currently has no `tabIndex` attribute and focus isn't moved.

- [ ] **Step 4: Read current `SingleCountryPanel.tsx` and patch**

Read the file. Find the `<h2>` at line 161 (search for `text-2xl font-bold`). Add `tabIndex={-1}` and a `ref` so we can focus it:

```tsx
// Near the top of the component body, alongside panelRootRef:
const headingRef = useRef<HTMLHeadingElement>(null)

// In the existing useEffect that runs on mount (around line 78), add a
// focus side-effect. Read the current effect first; the structure should be:
useEffect(() => {
  // existing animation-state logic UNCHANGED
  // ...
  // New: move focus to the heading on mount.
  // requestAnimationFrame deferral lets the panel render before focus
  // moves, which avoids the screen-reader announcing an empty container.
  requestAnimationFrame(() => {
    headingRef.current?.focus()
  })
  // existing cleanup UNCHANGED
}, [])
```

In the JSX, replace:

```tsx
<h2 className="text-2xl font-bold text-sand-900 dark:text-dark-50 truncate tracking-tight leading-tight">
  {country.name.common}
</h2>
```

with:

```tsx
<h2
  ref={headingRef}
  tabIndex={-1}
  className="text-2xl font-bold text-sand-900 dark:text-dark-50 truncate tracking-tight leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-accessible/50 rounded"
>
  {country.name.common}
</h2>
```

The `focus:outline-none` removes the default focus ring (since this is a landing target, not an interactive element), while `focus-visible:ring-2` keeps a visible indicator for keyboard users. The `rounded` softens the ring corners.

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm run test:unit -- SingleCountryPanel.focus 2>&1 | tail -10
```

Expected: both tests PASS.

- [ ] **Step 6: Run the full unit suite for regression**

```bash
npm run test:unit 2>&1 | tail -5
```

Expected: all green. The existing `SingleCountryPanel.test.tsx` tests should still pass (they don't assert focus state).

- [ ] **Step 7: Run lint**

```bash
npm run lint 2>&1 | tail -5
```

Pre-existing warnings OK.

- [ ] **Step 8: Commit and open PR**

```bash
git add src/components/SingleCountryPanel.tsx src/components/__tests__/SingleCountryPanel.focus.test.tsx
git commit -m "$(cat <<'EOF'
fix(a11y): move focus to country panel heading on mount

docs/systems/accessibility.md:91 promises 'when the country panel
opens, focus moves to the panel heading (country name).' The promise
wasn't implemented: SingleCountryPanel had a panelRootRef but no
focus() call.

Add tabIndex=-1 + a headingRef to the h2; focus it in the mount
useEffect via requestAnimationFrame (defers focus until after the
DOM commits so the screen-reader announcement is meaningful).

WCAG 2.4.3 'Focus Order' and screen-reader UX. Verified by two new
unit tests.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin fix/a11y-panel-focus-management
gh pr create --title "fix(a11y): move focus to country panel heading on mount" --body "..."
```

---

## Phase 2 — countries-10m → countries-50m chunk swap (perf, 1 PR)

### Task 2.1: Inventory missing entities

**Files:**
- Create (temporarily): a one-off `scripts/inventory-50m.ts` script (will be deleted at end of Task 2.1)

**Context:** The `world-atlas` package ships 110m, 50m, and 10m topologies (sizes 107 KB / 756 KB / 3661 KB raw respectively, verified by `ls node_modules/world-atlas/` on 2026-05-14). The current loader (`src/lib/loadCountryGeojson.ts:17`) imports `countries-10m.json`. The 2026-05-11 audit measured the async chunk at 954 KB gzip. Swapping to 50m would drop it dramatically. The existing comment at `loadCountryGeojson.ts:11` says 50m "omits Tuvalu (id 798) entirely." Need to verify how many canonical-195 IDs are missing.

- [ ] **Step 1: Branch**

```bash
git checkout main
git pull --ff-only origin main
git checkout -b perf/countries-50m-swap
```

- [ ] **Step 2: Create the inventory script**

Create `scripts/inventory-50m.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CANONICAL_NUMERIC_IDS } from '../src/lib/canonicalCountries.js'

const root = process.cwd()
const fifty = JSON.parse(
  readFileSync(join(root, 'node_modules/world-atlas/countries-50m.json'), 'utf-8'),
)
const ten = JSON.parse(
  readFileSync(join(root, 'node_modules/world-atlas/countries-10m.json'), 'utf-8'),
)

const idsIn = (topo: { objects: { countries: { geometries: { id?: number | string }[] } } }): Set<number> => {
  const set = new Set<number>()
  for (const g of topo.objects.countries.geometries) {
    if (g.id != null) set.add(Number(g.id))
  }
  return set
}

const fiftyIds = idsIn(fifty)
const tenIds = idsIn(ten)

const missingIn50m: number[] = []
for (const id of CANONICAL_NUMERIC_IDS) {
  if (!fiftyIds.has(id)) missingIn50m.push(id)
}

console.log('canonical 195 missing in 50m:', missingIn50m.sort((a, b) => a - b))
console.log('canonical 195 ids:', CANONICAL_NUMERIC_IDS.size)
console.log('50m country count:', fiftyIds.size)
console.log('10m country count:', tenIds.size)
```

- [ ] **Step 3: Run the inventory**

```bash
npx tsx scripts/inventory-50m.ts
```

Expected output: list of numeric IDs missing from 50m. The existing comment says Tuvalu (798) is missing. Probably 1-3 small island states are missing.

- [ ] **Step 4: Map missing IDs to cca3 codes via `src/data/countries.json`**

For each missing numeric ID from Step 3, find the corresponding cca3 + name + latlng in `src/data/countries.json`. Record these for the hand-patch step. Example for Tuvalu (798):

```bash
node -e "const c=require('./src/data/countries.json'); const found=c.countries.find(x=>x.ccn3==='798'); console.log(JSON.stringify({cca3:found.cca3,name:found.name.common,latlng:found.latlng,ccn3:found.ccn3}))"
```

Run the same command substituting each missing ID. The aggregated output of this step is a JSON array like:

```json
[
  { "cca3": "TUV", "ccn3": "798", "name": "Tuvalu", "latlng": [-8, 178] }
]
```

Save this list as `src/data/missing-from-50m.json` (lives alongside the other runtime data files `countries.json` and `cities.json` — Vite-bundled, follows the codebase convention; `src/` should not import from `scripts/`).

- [ ] **Step 5: Decision point**

If the missing list is ≤ 5 entries: proceed to Task 2.2 (hand-patch).
If it is > 5 entries: STOP. The chunk swap isn't worth the patching effort. Document in the PR description that the swap is deferred and 10m stays.

### Task 2.2: Implement the loader change + hand-patch

**Files:**
- Modify: `src/lib/loadCountryGeojson.ts`
- Create: `src/lib/missingCountriesPatch.ts` — synthetic geometry for IDs missing from 50m
- Create: `src/lib/__tests__/loadCountryGeojson-coverage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/loadCountryGeojson-coverage.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { loadCountryGeojson } from '../loadCountryGeojson'
import { CANONICAL_NUMERIC_IDS } from '../canonicalCountries'

describe('loadCountryGeojson — coverage of canonical 195', () => {
  it('returns a feature for every canonical numeric ID', async () => {
    const geojson = await loadCountryGeojson()
    const featureIds = new Set<number>()
    for (const f of geojson.features) {
      if (f.id != null) featureIds.add(Number(f.id))
    }
    const missing: number[] = []
    for (const id of CANONICAL_NUMERIC_IDS) {
      if (!featureIds.has(id)) missing.push(id)
    }
    expect(missing).toEqual([])
  })

  it('returns exactly the canonical 195 (no extras, no duplicates)', async () => {
    const geojson = await loadCountryGeojson()
    expect(geojson.features.length).toBe(CANONICAL_NUMERIC_IDS.size)
  })
})
```

- [ ] **Step 2: Run the test (should pass on 10m baseline, then we change the import)**

```bash
npm run test:unit -- loadCountryGeojson-coverage 2>&1 | tail -10
```

Expected on the unchanged main: PASS (10m has all canonical IDs). This baseline confirms the test logic is correct.

- [ ] **Step 3: Create the hand-patch module**

Create `src/lib/missingCountriesPatch.ts` using the JSON from Task 2.1 Step 4. For each missing entry, synthesize a tiny square polygon around the centroid. The polygon doesn't need to be geographically accurate — it just needs to be clickable for the map's `queryRenderedFeatures` to return the feature ID. Per the 2026-05-14 user decision, the visual-fidelity tradeoff (Tuvalu etc. rendering as 1°×1° squares at high zoom) is accepted in exchange for the ~700 KB bundle savings.

```ts
import missingFromFiftym from '../data/missing-from-50m.json'

interface MissingEntry {
  cca3: string
  ccn3: string
  name: string
  latlng: [number, number]
}

const MARKER_HALF_DEG = 0.5

/**
 * Synthesize a small square polygon around a centroid for each canonical
 * country missing from countries-50m. The 50m source omits a handful of
 * small island states (Tuvalu, and possibly others — see
 * scripts/inventory-50m.ts). We need every canonical-195 to be clickable;
 * the synthetic polygon makes the feature present without ballooning bundle
 * size back to 10m.
 */
export function buildMissingFeatures(): GeoJSON.Feature[] {
  const list = missingFromFiftym as ReadonlyArray<MissingEntry>
  return list.map((entry) => {
    const [lat, lng] = entry.latlng
    const ring: [number, number][] = [
      [lng - MARKER_HALF_DEG, lat - MARKER_HALF_DEG],
      [lng + MARKER_HALF_DEG, lat - MARKER_HALF_DEG],
      [lng + MARKER_HALF_DEG, lat + MARKER_HALF_DEG],
      [lng - MARKER_HALF_DEG, lat + MARKER_HALF_DEG],
      [lng - MARKER_HALF_DEG, lat - MARKER_HALF_DEG],
    ]
    return {
      type: 'Feature' as const,
      id: Number(entry.ccn3),
      properties: { id: entry.ccn3, synthetic: true },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [ring],
      },
    }
  })
}
```

- [ ] **Step 4: Patch the loader**

Modify `src/lib/loadCountryGeojson.ts`. Change the import from `countries-10m.json` to `countries-50m.json` and append the synthetic features. Replace the current `loadCountryGeojson` function with:

```ts
import { CANONICAL_NUMERIC_IDS } from './canonicalCountries'
import { buildMissingFeatures } from './missingCountriesPatch'

/** Load the world-atlas 50m countries topology + a synthetic patch for the
 *  small island states 50m omits, and return a normalized GeoJSON FeatureCollection
 *  with antimeridian wrapping fixed for non-polar polygons.
 *
 *  The features are filtered through `CANONICAL_NUMERIC_IDS` so only the 195
 *  canonical sovereign states (193 UN members + VAT + PSE) are returned.
 *
 *  We use 50m + patch (rather than 10m) because 10m's bundle is ~3.5 MB raw /
 *  954 KB gzip; 50m is ~756 KB raw / much smaller gzip, and the patch adds
 *  a handful of tiny synthetic polygons for the small island states 50m omits
 *  (see scripts/missing-from-50m.json). */
export async function loadCountryGeojson(): Promise<GeoJSON.FeatureCollection> {
  const [topojsonClient, worldAtlas] = await Promise.all([
    import('topojson-client'),
    import('world-atlas/countries-50m.json'),
  ])

  const topology = worldAtlas.default as unknown as TopoJSON.Topology
  const geojson = topojsonClient.feature(
    topology,
    topology.objects.countries,
  ) as GeoJSON.FeatureCollection

  geojson.features = geojson.features.filter((f) =>
    CANONICAL_NUMERIC_IDS.has(Number(f.id)),
  )

  for (const feature of geojson.features) {
    if (feature.id != null && feature.properties) {
      feature.properties.id = String(feature.id)
    }
  }

  // Append synthetic features for the canonical IDs missing in 50m.
  geojson.features.push(...buildMissingFeatures())

  fixAntimeridian(geojson)
  return geojson
}

// fixAntimeridian function UNCHANGED — keep the existing implementation
```

- [ ] **Step 5: Run the coverage test**

```bash
npm run test:unit -- loadCountryGeojson-coverage 2>&1 | tail -10
```

Expected: both tests PASS. If they fail, the hand-patch JSON is incomplete — go back to Task 2.1 Step 4 and verify all missing IDs are listed.

- [ ] **Step 6: Run the full unit suite + lint**

```bash
npm run test:unit 2>&1 | tail -5
npm run lint 2>&1 | tail -5
```

Expected: all green. The existing `loadCountryGeojson.test.ts` should still pass.

- [ ] **Step 7: Run e2e for map-rendering specs**

```bash
npm run test:e2e -- --project=chromium map-and-countries map-reliability 2>&1 | tail -10
```

Expected: PASS. These specs exercise polygon rendering and click hit-testing.

- [ ] **Step 8: Measure bundle savings**

```bash
npm run build 2>&1 | grep -E "(countries|index).*\.js"
```

Record the new gzip size of the `countries-50m-*.js` chunk (or whatever it's renamed to). Expect it to drop from 954 KB to roughly 200-300 KB gzip.

- [ ] **Step 9: Clean up scripts**

```bash
rm scripts/inventory-50m.ts
# src/data/missing-from-50m.json is load-bearing data for the patch — kept.
```

- [ ] **Step 10: Commit and open PR**

```bash
git add src/lib/loadCountryGeojson.ts src/lib/missingCountriesPatch.ts src/lib/__tests__/loadCountryGeojson-coverage.test.ts src/data/missing-from-50m.json
git commit -m "$(cat <<'EOF'
perf(bundle): switch country topology from 10m to 50m + hand-patch

The async countries chunk measured 954 KB gzip on the 2026-05-11
audit. world-atlas/countries-50m.json is ~4.8× smaller than the 10m
source we were using; switching saves several hundred KB on every
first-time visitor's bandwidth bill.

50m omits a handful of small island states (Tuvalu et al). Patched
in via synthetic 1°×1° square polygons around each missing entity's
centroid. Per 2026-05-14 user decision, the visual-fidelity tradeoff
(squares at high zoom on remote islands) is accepted in exchange for
the bundle savings — the polygons are clickable, which is what the
gameplay needs.

Two new tests verify every canonical-195 numeric ID is present after
the patch (so the next country-pool change can't silently lose a
country).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin perf/countries-50m-swap
gh pr create --title "perf(bundle): switch country topology from 10m to 50m + hand-patch" --body "..."
```

---

## Phase 3 — Bundle-budget CI gate (regression prevention, 1 PR)

### Task 3.1: Define budgets + check script + CI wiring

**Files:**
- Create: `scripts/bundle-budget/check.ts`
- Create: `scripts/bundle-budget/budgets.json`
- Modify: `package.json` — add `bundle:budget` script
- Modify: `.github/workflows/ci.yml` — add `npm run bundle:budget` to the `fast` job

**Context:** The 2026-05-11 audit found the documented bundle (overview.md: 477 KB initial + 233 KB async = 710 KB) had drifted to 507 + 954 = 1,461 KB. Phase 2 lands the major reduction; this phase prevents future drift.

**Budget design:** Three numbers per chunk type. Set them to (current_measured_after_Phase_2 + 10%) so Phase-2 ships green and there's a small headroom buffer. Fail the build if exceeded. The headroom prevents trivial-cause flake (e.g. a single new icon adding 200 bytes wouldn't fail the gate).

- [ ] **Step 1: Branch (after Phase 2 merges)**

This phase depends on Phase 2 because the budgets are based on the post-Phase-2 sizes. Do not branch off main until Phase 2 merges.

```bash
git checkout main
git pull --ff-only origin main
git checkout -b ci/bundle-budget-gate
```

- [ ] **Step 2: Run a build to measure current sizes**

```bash
npm run build 2>&1 | grep -E "(\.js|\.css).*gzip" | tee /tmp/build-output.txt
```

Record the gzip sizes for:
- Main JS chunk (`dist/assets/index-*.js`)
- CSS chunk (`dist/assets/index-*.css`)
- Async countries chunk (`dist/assets/countries-*.js`)
- Initial total (main JS + CSS + Sentry stub if any)
- Total (initial + async)

- [ ] **Step 3: Create the budgets file**

Create `scripts/bundle-budget/budgets.json` using the measured sizes + 10%. The placeholder numbers below MUST be replaced by the implementer with real measurements from Step 2:

```json
{
  "version": 1,
  "comment": "Budgets are gzip sizes in bytes. Set to (measured + 10%) at creation. Update via separate PRs with measurement evidence in the description.",
  "budgets": {
    "main-js-gzip": 580000,
    "css-gzip": 25000,
    "async-countries-gzip": 300000,
    "initial-total-gzip": 620000,
    "total-with-async-gzip": 920000
  }
}
```

The placeholders are illustrative. Adjust to (real measured from Step 2 + 10%) and round to the nearest 10 KB.

- [ ] **Step 4: Create the check script**

Create `scripts/bundle-budget/check.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

interface Budgets {
  version: 1
  budgets: {
    'main-js-gzip': number
    'css-gzip': number
    'async-countries-gzip': number
    'initial-total-gzip': number
    'total-with-async-gzip': number
  }
}

const root = process.cwd()
const distAssets = join(root, 'dist', 'assets')
const budgetsPath = join(root, 'scripts', 'bundle-budget', 'budgets.json')

const budgets = JSON.parse(readFileSync(budgetsPath, 'utf-8')) as Budgets

function gzipSize(path: string): number {
  return gzipSync(readFileSync(path)).length
}

function classifyAsset(name: string): 'css' | 'async-countries' | 'other' {
  if (name.startsWith('countries-') && name.endsWith('.js')) return 'async-countries'
  if (/^index-.*\.css$/.test(name)) return 'css'
  return 'other'
}

const files = readdirSync(distAssets)
let mainJsBytes = 0
let sentryStubBytes = 0
let cssBytes = 0
let asyncCountriesBytes = 0

// Two passes: first identify the main JS chunk (largest index-*.js), then size others.
const candidates = files
  .filter((f) => f.startsWith('index-') && f.endsWith('.js'))
  .map((f) => ({ f, size: statSync(join(distAssets, f)).size }))
  .sort((a, b) => b.size - a.size)
if (candidates.length === 0) {
  console.error('No main JS chunk found in dist/assets/')
  process.exit(1)
}
mainJsBytes = gzipSize(join(distAssets, candidates[0].f))
if (candidates.length > 1) {
  sentryStubBytes = gzipSize(join(distAssets, candidates[1].f))
}

for (const f of files) {
  const kind = classifyAsset(f)
  if (kind === 'css') cssBytes += gzipSize(join(distAssets, f))
  if (kind === 'async-countries') asyncCountriesBytes += gzipSize(join(distAssets, f))
}

const initialTotal = mainJsBytes + cssBytes + sentryStubBytes
const totalWithAsync = initialTotal + asyncCountriesBytes

interface Check {
  name: string
  measured: number
  budget: number
}

const checks: Check[] = [
  { name: 'main-js-gzip', measured: mainJsBytes, budget: budgets.budgets['main-js-gzip'] },
  { name: 'css-gzip', measured: cssBytes, budget: budgets.budgets['css-gzip'] },
  { name: 'async-countries-gzip', measured: asyncCountriesBytes, budget: budgets.budgets['async-countries-gzip'] },
  { name: 'initial-total-gzip', measured: initialTotal, budget: budgets.budgets['initial-total-gzip'] },
  { name: 'total-with-async-gzip', measured: totalWithAsync, budget: budgets.budgets['total-with-async-gzip'] },
]

let failed = false
for (const c of checks) {
  const pct = ((c.measured / c.budget) * 100).toFixed(1)
  const status = c.measured > c.budget ? 'FAIL' : 'ok'
  if (c.measured > c.budget) failed = true
  console.log(`${status.padEnd(4)}  ${c.name.padEnd(28)}  ${c.measured.toString().padStart(7)}  /  ${c.budget.toString().padStart(7)} bytes  (${pct}%)`)
}

if (failed) {
  console.error('\nBundle exceeded budget. To update intentionally, raise budgets in scripts/bundle-budget/budgets.json with measurement evidence in the commit message.')
  process.exit(1)
}
console.log('\nAll budgets ok.')
```

- [ ] **Step 5: Add the npm script**

Modify `package.json` `scripts` section. Add:

```json
    "bundle:budget": "npm run build && tsx scripts/bundle-budget/check.ts",
```

Place it alphabetically (between `build:e2e` and `daily:generate` is fine).

- [ ] **Step 6: Verify the script locally**

```bash
npm run bundle:budget 2>&1 | tail -15
```

Expected: all 5 checks pass (you set the budgets to measured+10%).

- [ ] **Step 7: Force-fail to verify the gate actually works**

Temporarily edit `scripts/bundle-budget/budgets.json` and lower `main-js-gzip` to `1000`. Run again:

```bash
npm run bundle:budget 2>&1 | tail -10
```

Expected: FAIL with non-zero exit code. **Revert the budgets file immediately** after verifying.

- [ ] **Step 8: Wire into CI**

Modify `.github/workflows/ci.yml`. Add a step to the `fast` job, AFTER the `Type check` step and BEFORE `Unit tests`:

```yaml
      - name: Bundle-size budget check
        run: npm run bundle:budget
        env:
          VITE_SENTRY_DSN: ''
          VITE_CF_WA_TOKEN: ''
          VITE_ANALYTICS_ENDPOINT: ''
```

Placement reasoning: the `fast` job is the right home (it already has node + npm ci). Running after typecheck means we don't burn time building if typecheck fails. The env vars are needed because `vite build` reads them; empty values match what the deploy.yml uses for non-secret builds.

- [ ] **Step 9: Commit and open PR**

```bash
git add scripts/bundle-budget/check.ts scripts/bundle-budget/budgets.json package.json .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci: add bundle-size budget gate to the fast CI job

The 2026-05-11 audit found the actual bundle was 2× the documented
budget (overview.md said 710 KB; reality was 1,461 KB). After Phase 2
landed the countries-50m swap, this phase adds a gate so future
regressions get caught before merge.

Budgets are set to (current measured + 10%) — small headroom for
trivial growth, big enough to catch real regressions. Updating a
budget requires raising the number in scripts/bundle-budget/budgets.json
and explaining why in the commit message.

Five checks: main-js-gzip, css-gzip, async-countries-gzip,
initial-total-gzip, total-with-async-gzip.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin ci/bundle-budget-gate
gh pr create --title "ci: add bundle-size budget gate" --body "..."
```

---

## Phase 4 — GameController extraction brainstorm (deliverable: new plan)

### Task 4.1: Run a brainstorming session, produce a separate plan

**Files (output):**
- Create: `docs/superpowers/plans/<date>-game-controller-extraction.md`

**Context:** `src/game/GameController.tsx` is 833 lines with 9 ref-mirrors of reducer state (`statusRef`, `pendingStartRef`, `lastRevealEmitHashRef`, `lastAnnouncedRoundKeyRef`, `lastAttemptCountRef`, `prevStatusForTelemetryRef`, `lastIntermediateAttemptCountRef`, `prevStatusForIntermediateRef`, `recordedRef`). The 2026-05-11 architecture review identified five extraction targets: `useHashGameRouter`, `useDailyResumePersistence`, `useGameAnnouncements`, `useRevealMapEffects`, `useGameTestSeams`. Comments in the file reference bug #32 (closure-staleness, two-render race) — this is the most likely site of the next regression.

**This phase does NOT implement.** It produces the implementation plan via the brainstorming skill, which will be executed in a later session.

- [ ] **Step 1: Invoke brainstorming**

Start a brainstorming session focused on the extraction. The brainstorming skill (`superpowers:brainstorming`) explores user intent, requirements, and design before implementation. Inputs to the brainstorm:

- Current `src/game/GameController.tsx` (833 lines)
- The 2026-05-11 critical review section "Architecture audit" findings
- The `restart` action in `src/game/shared/useGameSession.ts:192-215` (intentional fix for bug #32 — informs the design)
- The five proposed extractions from the prior review

Brainstorm key questions:
1. **What does each extracted hook own?** Clear boundaries needed; ref-mirrors are the symptom, the cure is correct state ownership.
2. **What's the safety net?** The reducer unit tests in `src/game/shared/__tests__/useGameSession.test.ts` cover the reducer; the controller's effects (subscriptions, side-effects, telemetry) have no equivalent unit safety net. Do we add tests during the refactor, or extract-then-test?
3. **What's the ordering?** Extract the safest hook first (probably `useGameTestSeams` — pure effects, no state) and work up to the load-bearing ones (`useHashGameRouter`, which is currently the most tangled).
4. **What's the rollback strategy?** Each extraction is its own PR; reverting one shouldn't break the others.
5. **What's the merge order with concurrent work?** This refactor will conflict with active game-flow PRs. Should it be a "freeze the area" effort or coexist?

- [ ] **Step 2: Produce the plan**

The brainstorm output should produce a plan at `docs/superpowers/plans/<YYYY-MM-DD>-game-controller-extraction.md` with bite-sized tasks per the writing-plans skill. The plan should be implementable but does NOT need to be executed in this phase.

- [ ] **Step 3: Commit the plan via a small PR**

Branch protection on `main` blocks direct pushes (every commit since 2026-04 has been a squash-merged PR). Open a small docs PR:

```bash
git checkout main
git pull --ff-only origin main
git checkout -b plan/game-controller-extraction
git add docs/superpowers/plans/<date>-game-controller-extraction.md
git commit -m "$(cat <<'EOF'
plan: GameController extraction — derived from 2026-05-11 audit

GameController.tsx is 833 lines with 9 ref-mirrors of reducer state.
The 2026-05-11 critical review identified 5 extraction targets;
this plan turns that into bite-sized tasks for a future session.

Implementation not yet started.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin plan/game-controller-extraction
gh pr create --title "plan: GameController extraction (deferred implementation)" --body "$(cat <<'EOF'
## Summary
- Brainstorm-derived plan for extracting 5 hooks from the 833-line GameController.tsx
- Implementation NOT in this PR — only the plan document. Execution happens in a future session.

## Test plan
- N/A — docs-only
EOF
)"
```

---

## Sequencing & critical path

The phases are mostly independent. Recommended order:

1. **Phase 0** (cosmetics) — 20 minutes, always safe
2. **Phase 1** (a11y focus) — 1-2 hours, isolated change
3. **Phase 2** (chunk swap) — 1 day, biggest user-impact (perf)
4. **Phase 3** (bundle budget) — depends on Phase 2 merging (budgets are based on post-Phase-2 sizes)
5. **Phase 4** (brainstorm) — independent of the others; produces a follow-up plan

If parallel work is desired, Phases 0 / 1 / 2 / 4 can all happen concurrently (different files). Phase 3 must wait for Phase 2.

Total expected output: **5 PRs** — 4 of code (Phases 0-3) + 1 docs PR for Phase 4's brainstorm-derived plan.

---

## Self-review

**Spec coverage:**
- Phase 0 covers the two cosmetic items from the 2026-05-12 cross-PR review.
- Phase 1 covers the verified panel-focus a11y bug from the 2026-05-11 audit.
- Phase 2 covers the countries chunk size finding from the 2026-05-11 audit.
- Phase 3 covers the bundle-budget regression-prevention finding.
- Phase 4 triggers the GameController extraction work that the audit flagged as the largest single architectural risk.

Items NOT in this plan (explicitly deferred and labelled):
- 44×44 touch targets (a11y, ~1 day) — deferred to its own plan if/when prioritized
- ESLint upgrade — deferred (multi-week incremental)
- Cross-browser CI + 13 testIgnore'd specs + Issue #47 — blocked on GPU runner (user confirmed not on the table)
- Forced-colors mode — low priority, surface when asked
- Unhappy-paths section C/E/F verification — surface when underlying contracts change

**Placeholder scan:**
- Task 2.1 Step 4 references aggregating per-ID lookups — the structure of each entry is explicit; the actual ID list comes from the inventory script's output and can't be enumerated ahead of time.
- Task 3.1 Step 3 explicitly says "the placeholders are illustrative. Adjust to (real measured from Step 2 + 10%) and round to the nearest 10 KB."
- Task 4.1 ends with bullet-question prompts for the brainstorm — these are intentional inputs to a brainstorming session, not unspecified work.

No other placeholders.

**Type consistency:**
- `buildMissingFeatures()` returns `GeoJSON.Feature[]` consistently across the loader (`loadCountryGeojson.ts`) and the patch module (`missingCountriesPatch.ts`).
- The `Budgets` interface in `check.ts` matches the JSON shape in `budgets.json`.
- The unit test imports the actual `loadCountryGeojson` and `CANONICAL_NUMERIC_IDS` exports — no fake symbols.
