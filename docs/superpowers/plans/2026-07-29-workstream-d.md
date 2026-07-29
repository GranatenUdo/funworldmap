# Workstream D (+G1) — Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the country panel answer "so what?": hero stats with world ranks and density (D1), the consolidated attribution scheme replacing the per-field rings — footer + C4 markers + an expandable full field→source table, with `SourceTooltip`/`@floating-ui/react` retired (D2), an explore-next block that turns the dead space into navigation (D3), and the mobile sheet rebuilt on G1's fundamentals (dvh, safe-area, grabber) with inline header actions, the labeled compare chip C5 reserved, and the compare tip enabled on mobile (D4).

**Architecture:** A pure `countryStats.ts` module (ranks/compact numerals — the ranking comparator extracted from `countryLabelFeatures` as single owner) feeds the hero row; D2 adopts C4's `fieldSourceMarkers`/`SourceMarker` via a shared `fieldMarkerNode` glue and a `SourcesFooter` component both panels use; D3's `exploreNext.ts` is pure and deterministic; G1's grabber is the single expand implementation D4 consumes. Tasks execute strictly 1 → 7; later tasks anchor on content.

**Tech Stack:** React 19, TypeScript, Tailwind 4, Vitest + Testing Library, Playwright. `Intl.NumberFormat` compact notation for hero numerals.

**Spec:** `docs/superpowers/specs/2026-07-26-ux-visual-program-design.md` — items D1–D4 + G1 (folded per Sequencing). Task ↔ spec map: T1–T2=D1, T3=D2, T4=D3, T5=G1, T6=D4 (+C5's mobile chip +the mobile tip decision), T7=verification. Deferred by design: log-scale stat bars (Non-goals); G3/G4 → G-remainder.

## Global Constraints

- Attribution never silently regresses (constitution): D2's swap must keep every field's source reachable — markers for exceptions, the expandable table for complete granularity; the two retired source e2e specs are REPLACED in the same commit by a successor pinning their intent (keyboard reachability; no viewport clipping), CI-capable.
- Ranks are dense 1..195 over the canonical set with the cca3 tiebreak (single owner: `countryStats.byValueDescThenCca3`, adopted by `countryLabelFeatures`); exact values live in `title` attrs via `compareFields`' exact formatters; density imported from `densityOf`, never re-derived.
- D3 suggestions are pure + deterministic (defined orders/tiebreaks), reuse `BorderChip` + existing `onSelect`; the landlocked fact chip is visibly non-interactive (inert-chip precedent).
- G1: dvh + `env(safe-area-inset-bottom)` + grabber (44px convention) wired to the existing expand toggle; chevron keeps labels + `aria-expanded`; layoutConstants pins re-anchored same commit.
- D4 enables the compare tip on mobile with the same second-distinct-selection rule (the gate was deliberately kept unburned) — `useFirstVisitHint` tests updated in the same commit.
- e2e rules (CLAUDE.md): no `waitForTimeout`, no `force: true`; hash/seam-driven flows preferred over click chains (#136 lesson); every invalidated pin re-anchored same commit; `--project=chromium --workers=2`; mobile projects local-only; the #136 quarantine stays.
- Analytics: **no new telemetry**. Docs staleness fixed in the causing task. Commits: conventional prefix + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- After the batch: full `npx vitest run`, affected e2e (CI + local-only enumerated), and the live pass (desktop+390px × both themes) — it has caught suite-invisible regressions in every tranche.

---

### Task 1: `countryStats.ts` — dense world ranks + compact numerals (D1 groundwork)

Pure data module. No React, no telemetry (`track()` untouched — the D-plan ships **no new telemetry**). Canonical-owner decisions, made against the code as it exists on main:

- **Ranking rule**: `src/lib/countryLabelFeatures.ts` already encodes the deterministic dense-ranking rule inline (descending value, `cca3` tiebreak — line 41: `[...canonical].sort((a, b) => b.area - a.area || a.cca3.localeCompare(b.cca3))`). Extract the comparator into the new module as the single owner and make `countryLabelFeatures.ts` import it (no behavior change; its existing tests stay green unmodified). Dependency direction is `countryLabelFeatures → countryStats`; no cycle (`countryStats` imports only `countries.json`, `canonicalCountries`, `compareFields`, `types`; `compareFields` imports only `types`).
- **Exact vs compact formatters**: `src/lib/compareFields.ts` owns the exact-value formatters (`formatPopulation` → `"66,351,959"`, `formatArea` → `"543,908 km²"`, `densityOf`/`formatDensity`). Those stay there — compare rows and D1's `title` attributes need exact strings. The **compact** hero numerals are a different rule with a different purpose, so they live in `countryStats.ts`. Density is **imported** from `compareFields` (`densityOf`), never re-derived.
- **Compact numeral rules (exact, verified against Node's Intl on this repo's data 2026-07-29)**: `new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 3 })` — en-US K/M/B suffixes, 3 significant digits, half-expand rounding, sub-1000 values plain. Real-data outputs: France population 66,351,959 → `"66.4M"`; France area 543,908 → `"544K"`; 1,402,112,000 → `"1.4B"`; 17,098,242 → `"17.1M"`; 999,999 → `"1M"`; 451 → `"451"`; Vatican area 0.44 → `"0.44"`.
- **Real-data facts for tests** (verified 2026-07-29): canonical set is 195; area rank 1 = RUS, 195 = VAT, FRA = 48 (range-assert 40–60, the `countryLabelFeatures.test.ts` precedent); population rank 1 = **IND in the current data vintage** (assert `['IND','CHN']` contains it, not a single literal), VAT = 195, FRA = 22 (range-assert 15–30).

**Files:**
- Create: `src/lib/countryStats.ts`
- Create: `src/lib/__tests__/countryStats.test.ts`
- Edit: `src/lib/countryLabelFeatures.ts` (adopt the extracted comparator — remove-obsolete in the same change)

**Interfaces:** (all exported from `src/lib/countryStats.ts`)
- `byValueDescThenCca3<T extends { cca3: string }>(value: (item: T) => number): (a: T, b: T) => number`
- `denseRanksDesc<T extends { cca3: string }>(items: readonly T[], value: (item: T) => number): Map<string, number>` — dense 1..N, 1 = largest
- `RANK_TOTAL: number` — 195 (derived, not hardcoded)
- `POPULATION_RANKS: ReadonlyMap<string, number>`, `AREA_RANKS: ReadonlyMap<string, number>` — keyed by cca3, built once at module load (the `COUNTRY_LABEL_COLLECTION` pattern)
- `formatRank(rank: number): string` — `"#48 of 195"`
- `formatCompact(n: number): string`
- `formatCompactArea(n: number): string` — `` `${formatCompact(n)} km²` ``
- `formatCompactDensity(c: CountryData): string | null` — `"122/km²"`; `null` when `densityOf` is null

**Steps:**

- [ ] Write the failing test `src/lib/__tests__/countryStats.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  AREA_RANKS,
  POPULATION_RANKS,
  RANK_TOTAL,
  denseRanksDesc,
  formatCompact,
  formatCompactArea,
  formatCompactDensity,
  formatRank,
} from '../countryStats'
import { makeCountryData } from '../../test/countryFixtures'

describe('world ranks — dense 1..195 over the canonical set', () => {
  it('covers exactly the 195 canonical countries (non-canonical entries filtered out)', () => {
    expect(RANK_TOTAL).toBe(195)
    expect(POPULATION_RANKS.size).toBe(195)
    expect(AREA_RANKS.size).toBe(195)
    expect(AREA_RANKS.has('TWN')).toBe(false)
  })

  it('area ranks match the countryLabelFeatures anchors: RUS 1, VAT 195, FRA mid-table', () => {
    expect(AREA_RANKS.get('RUS')).toBe(1)
    expect(AREA_RANKS.get('VAT')).toBe(195)
    // 543,908 km² ranks France 48th in the current data. Range-asserted
    // (the countryLabelFeatures.test.ts precedent) so an upstream area
    // revision doesn't churn this test.
    expect(AREA_RANKS.get('FRA')).toBeGreaterThanOrEqual(40)
    expect(AREA_RANKS.get('FRA')).toBeLessThanOrEqual(60)
    const ranks = [...AREA_RANKS.values()]
    expect(new Set(ranks).size).toBe(195)
    expect(Math.min(...ranks)).toBe(1)
    expect(Math.max(...ranks)).toBe(195)
  })

  it('population ranks: rank 1 is India or China (data-vintage dependent), VAT 195, FRA mid-20s', () => {
    const rank1 = [...POPULATION_RANKS.entries()].find(([, r]) => r === 1)![0]
    expect(['IND', 'CHN']).toContain(rank1)
    expect(POPULATION_RANKS.get('VAT')).toBe(195)
    // France is 22nd in the current data — range-asserted.
    expect(POPULATION_RANKS.get('FRA')).toBeGreaterThanOrEqual(15)
    expect(POPULATION_RANKS.get('FRA')).toBeLessThanOrEqual(30)
  })

  it('rank ties break deterministically by cca3 (the countryLabelFeatures rule, now shared)', () => {
    const ranks = denseRanksDesc(
      [
        { cca3: 'DEU', v: 100 },
        { cca3: 'AUT', v: 100 },
      ],
      (c) => c.v,
    )
    expect(ranks.get('AUT')).toBe(1)
    expect(ranks.get('DEU')).toBe(2)
  })
})

describe('compact numerals — en-US compact notation, 3 significant digits', () => {
  it('applies K/M/B suffixes with 3 significant digits', () => {
    expect(formatCompact(1_402_112_000)).toBe('1.4B')
    expect(formatCompact(66_351_959)).toBe('66.4M') // France population, real data
    expect(formatCompact(543_908)).toBe('544K') // France area, real data
    expect(formatCompact(999_999)).toBe('1M') // rounds up across the suffix boundary
    expect(formatCompact(451)).toBe('451') // sub-1000 stays plain
    expect(formatCompact(0.44)).toBe('0.44') // Vatican area
  })

  it('formatCompactArea appends the km² unit', () => {
    expect(formatCompactArea(543_908)).toBe('544K km²')
    expect(formatCompactArea(17_098_242)).toBe('17.1M km²') // Russia
  })

  it('formatCompactDensity derives via compareFields.densityOf (imported, not duplicated)', () => {
    expect(formatCompactDensity(makeCountryData({ population: 66_351_959, area: 543_908 }))).toBe(
      '122/km²',
    )
    expect(formatCompactDensity(makeCountryData({ population: 39_244, area: 2.02 }))).toBe(
      '19.4K/km²',
    )
    expect(formatCompactDensity(makeCountryData({ population: 0 }))).toBeNull()
  })

  it('formatRank renders "#N of 195" with the derived denominator', () => {
    expect(formatRank(48)).toBe('#48 of 195')
    expect(formatRank(1)).toBe('#1 of 195')
  })
})
```

- [ ] Run `npx vitest run src/lib/__tests__/countryStats.test.ts` — expect failure: `Failed to resolve import "../countryStats"` (module does not exist yet).

- [ ] Create `src/lib/countryStats.ts`:

```ts
import countriesFile from '../data/countries.json'
import { CANONICAL_CCA3 } from './canonicalCountries'
import { densityOf } from './compareFields'
import type { CountriesFile, CountryData } from './types'

/** Comparator: descending by `value`, cca3 tiebreak. Extracted from
 *  countryLabelFeatures' areaRank sort as the single owner of the
 *  deterministic dense-ranking rule (the B1 label module now imports it).
 *  The tiebreak keeps ranks deterministic should a future data refresh
 *  introduce an exact tie (none exist today). */
export function byValueDescThenCca3<T extends { cca3: string }>(
  value: (item: T) => number,
): (a: T, b: T) => number {
  return (a, b) => value(b) - value(a) || a.cca3.localeCompare(b.cca3)
}

/** Dense 1..N descending ranks keyed by cca3 (1 = largest value). */
export function denseRanksDesc<T extends { cca3: string }>(
  items: readonly T[],
  value: (item: T) => number,
): Map<string, number> {
  return new Map([...items].sort(byValueDescThenCca3(value)).map((c, i) => [c.cca3, i + 1]))
}

const canonical = (countriesFile as unknown as CountriesFile).countries.filter((c) =>
  CANONICAL_CCA3.has(c.cca3),
)

/** 195 — the denominator of every "#N of 195" rank line (D1). Derived from
 *  the canonical set, never hardcoded. */
export const RANK_TOTAL = canonical.length

/** World ranks over the canonical 195, built once at module load (the
 *  COUNTRY_LABEL_COLLECTION pattern). Keyed by cca3; lookups for
 *  non-canonical codes return undefined and callers omit the rank line. */
export const POPULATION_RANKS: ReadonlyMap<string, number> = denseRanksDesc(
  canonical,
  (c) => c.population,
)
export const AREA_RANKS: ReadonlyMap<string, number> = denseRanksDesc(canonical, (c) => c.area)

export function formatRank(rank: number): string {
  return `#${rank} of ${RANK_TOTAL}`
}

/** Compact numeral rules (D1 hero stats): en-US compact notation (K/M/B
 *  suffixes), 3 significant digits, half-expand rounding, sub-1000 plain.
 *  66,351,959 → "66.4M"; 543,908 → "544K"; 999,999 → "1M"; 451 → "451".
 *  Exact-value formatters stay in compareFields.ts (compare rows + hero
 *  `title` attributes) — a deliberate exact/compact ownership split. */
const COMPACT = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumSignificantDigits: 3,
})

export function formatCompact(n: number): string {
  return COMPACT.format(n)
}

export function formatCompactArea(n: number): string {
  return `${formatCompact(n)} km²`
}

/** Compact density readout ("122/km²"). The derivation (densityOf) is owned
 *  by compareFields (C3) — imported, never duplicated. null → caller renders
 *  EM_DASH. */
export function formatCompactDensity(c: CountryData): string | null {
  const d = densityOf(c)
  return d === null ? null : `${formatCompact(d)}/km²`
}
```

- [ ] Adopt the shared comparator in `src/lib/countryLabelFeatures.ts` (remove-obsolete: the inline duplicate goes away in the same change). Replace:

```ts
import countriesFile from '../data/countries.json'
import { CANONICAL_CCA3 } from './canonicalCountries'
import type { CountriesFile, CountryData } from './types'
```

with:

```ts
import countriesFile from '../data/countries.json'
import { CANONICAL_CCA3 } from './canonicalCountries'
import { byValueDescThenCca3 } from './countryStats'
import type { CountriesFile, CountryData } from './types'
```

and replace:

```ts
  const canonical = countries.filter((c) => CANONICAL_CCA3.has(c.cca3))
  // Descending area; cca3 tiebreak keeps ranks deterministic should a future
  // data refresh introduce an exact-area tie (none exist today).
  const byAreaDesc = [...canonical].sort((a, b) => b.area - a.area || a.cca3.localeCompare(b.cca3))
```

with:

```ts
  const canonical = countries.filter((c) => CANONICAL_CCA3.has(c.cca3))
  // Descending area, cca3 tiebreak — the shared dense-ranking rule, owned by
  // countryStats.ts (D1 extracted it; this module adopted the single owner).
  const byAreaDesc = [...canonical].sort(byValueDescThenCca3((c) => c.area))
```

- [ ] Run green: `npx vitest run src/lib/__tests__/countryStats.test.ts src/lib/__tests__/countryLabelFeatures.test.ts` — all tests pass, including the untouched label-module suite (its RUS/VAT/FRA and tiebreak pins prove the refactor is behavior-neutral). Then `npm run check` (typecheck + lint clean).

- [ ] Commit:

```
git add src/lib/countryStats.ts src/lib/__tests__/countryStats.test.ts src/lib/countryLabelFeatures.ts
git commit -m "feat(lib): countryStats — dense world ranks + compact numerals (D1 groundwork)" -m "Extracts the countryLabelFeatures dense-ranking comparator into the new single owner; density derivation imported from compareFields, not duplicated. No new telemetry." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Hero stats row in `SingleCountryPanel` (D1)

Population / Area / Density become compact primary numerals in the `.text-readout` face (the E2 type role — already defined in `src/index.css`: system mono + `tabular-nums`; color stays per-usage), each with the exact value in a `title` attribute; Population and Area carry a `"#N of 195"` rank sub-line (`formatRank`). The hero row **replaces the Population and Area DataCells** in the prime grid; Government and Languages remain a two-column DataCell grid below it. Depends on Task 1 (`countryStats.ts` must be committed).

Contracts and seams (state-of-main facts, verified 2026-07-29):

- **Attribution non-regression (constitution item)**: today's Population/Area DataCells carry `FieldLabel` → `SourceTooltip` with `data-field` anchors. The hero stats keep `FieldLabel` unchanged (same `data-field="population"` / `"area"` anchors), so field-level attribution survives until D2 retires the ring scheme wholesale. Density gets `field="density"` — `_fieldSources` has no `density` key, so `SourceTooltip` renders nothing (the exception-badge precedent: no source, no affordance).
- **D4 seam (explicit)**: this task lands the hero row at the **top of the existing scroll-content region** (`px-5 py-3` block), which is already visible in the collapsed 40vh mobile sheet — so the collapsed sheet answers population/area/density with zero layout restructure. D4 later restructures the sheet header and repositions the hero row / adds the G1 grabber. **Do not** touch header actions, sheet heights, or add any grabber here.
- **Wrap tolerance**: no `whitespace-nowrap` on hero values — at 360px a 3-column mono `"17.1M km²"` may wrap `km²` to a second line, which is fine. No test may assert wrap points (Linux font metrics rule); assertions use `textContent`, which is wrap-independent.
- **Contrast math (WCAG floors, both themes)**: value `text-sand-900` (#1e1b18) on `sand-50` (#fefdfb) ≈ 16.8:1, `dark-50` (#f1f5f9) on `dark-400` (#161a22) ≈ 15.8:1; rank sub-line `text-sand-600` (#6b6459) on sand-50 ≈ 5.7:1, `dark-100` (#94a3b8) on dark-400 ≈ 6.7:1 — all ≥ 4.5:1. No new color pairs are introduced (both pairs already ship on panel captions).
- **Pinned-literal audit (re-anchor in the SAME commit)**: `e2e/panel-and-deeplink.spec.ts` — the mobile **peek sentinel is `Currencies`** (line 80), untouched by this change (verified); its "population and area" test asserts `Population` / `Area` / `km²` via `toContainText`, all still present (hero labels + `"…K km²"`); only its stale "prime grid" comment needs updating. `e2e/source-tooltip-edge.spec.ts` anchors `[data-field="population"]` (kept by design) — its "first DataCell" prose must be re-anchored to the hero row. `e2e/source-tooltip-keyboard.spec.ts` uses the **first** Source button = the header caption's capital tooltip — DOM order unchanged. `e2e/a11y-contrast.spec.ts` "Tabular figures on DataCell" uses `[data-testid="data-cell-value"]` `.first()` + `count > 0` — Government/Languages/Currencies/Timezones DataCells remain, still green. `e2e/mobile-panel-header.spec.ts` and `e2e/panel-focus.spec.ts` pin header/focus behavior only — untouched. `src/components/__tests__/chromeAccent.test.tsx`'s `getByText('Population')` renders `CompareFieldRow` in isolation — unaffected. `docs/systems/` was grepped for `DataCell`/`prime grid`/panel-field-layout prose — no matches, no doc staleness to fix.
- **No new telemetry** (spec commitment): D1 adds zero `track()` events.

**Files:**
- Edit: `src/components/SingleCountryPanel.tsx`
- Edit: `src/components/__tests__/SingleCountryPanel.test.tsx`
- Edit: `src/lib/compareFields.ts` (ownership comment only)
- Edit: `e2e/source-tooltip-edge.spec.ts`, `e2e/panel-and-deeplink.spec.ts` (comment re-anchors, same commit)

**Interfaces:**
- New private component in `SingleCountryPanel.tsx`: `HeroStat({ label, field, country, sources, value, exact, rank }: { label: string; field: string; country: CountryData; sources: CountriesFile['_sources']; value: string; exact?: string; rank?: number })`
- New testids: `hero-stats` (row container), `hero-stat-population` / `hero-stat-area` / `hero-stat-density` (value nodes, `title` = exact value), `hero-rank-population` / `hero-rank-area` (rank sub-lines; absent for density and for non-canonical cca3)

**Steps:**

- [ ] Add the failing tests — append this describe block to `src/components/__tests__/SingleCountryPanel.test.tsx` (after the C5 describe; it reuses the file's existing `renderPanel`-style pattern and `makeCountry`):

```tsx
describe('SingleCountryPanel — hero stats row (D1)', () => {
  function renderWith(country = makeCountry()) {
    return render(
      <SingleCountryPanel
        country={country}
        comparePickingMode={false}
        sources={sources}
        isDesktop={true}
        onSelect={() => {}}
        onClose={() => {}}
        onEnterCompare={() => {}}
        onCancelCompare={() => {}}
        byCca3={new Map()}
      />,
    )
  }

  it('renders compact Population/Area/Density numerals in .text-readout with exact values in title', () => {
    // Real France figures so the compact strings match the shipped data.
    const { getByTestId } = renderWith(makeCountry({ population: 66_351_959, area: 543_908 }))
    const pop = getByTestId('hero-stat-population')
    expect(pop.textContent).toBe('66.4M')
    expect(pop.getAttribute('title')).toBe('66,351,959')
    expect(pop.className).toContain('text-readout')
    const area = getByTestId('hero-stat-area')
    expect(area.textContent).toBe('544K km²')
    expect(area.getAttribute('title')).toBe('543,908 km²')
    const density = getByTestId('hero-stat-density')
    expect(density.textContent).toBe('122/km²')
    expect(density.getAttribute('title')).toBe('122 people/km²')
  })

  it('rank sub-lines show "#N of 195" for population and area; density has none', () => {
    // Ranks key off cca3 against the bundled dataset (world facts), NOT the
    // fixture's population/area values — the default FRA fixture resolves to
    // France's real ranks (#22 / #48 today, format-asserted not pinned).
    const { getByTestId, queryByTestId } = renderWith()
    expect(getByTestId('hero-rank-population').textContent).toMatch(/^#\d+ of 195$/)
    expect(getByTestId('hero-rank-area').textContent).toMatch(/^#\d+ of 195$/)
    expect(queryByTestId('hero-rank-density')).toBeNull()
  })

  it('non-canonical cca3 renders no rank sub-lines (rank maps cover only the 195)', () => {
    const { queryByTestId, getByTestId } = renderWith(makeCountry({ cca3: 'XXX' }))
    expect(queryByTestId('hero-rank-population')).toBeNull()
    expect(queryByTestId('hero-rank-area')).toBeNull()
    expect(getByTestId('hero-stat-population')).toBeTruthy() // values still render
  })

  it('zero density renders the em-dash with no title', () => {
    const { getByTestId } = renderWith(makeCountry({ population: 0 }))
    const density = getByTestId('hero-stat-density')
    expect(density.textContent).toBe('—')
    expect(density.getAttribute('title')).toBeNull()
  })

  it('Population/Area keep field-level source attribution; Population/Area DataCells are gone', () => {
    const { container, getByTestId, getAllByTestId } = renderWith(
      makeCountry({ _fieldSources: { population: 'restcountries', area: 'restcountries' } }),
    )
    // data-field anchors preserved — e2e/source-tooltip-edge.spec.ts targets
    // [data-field="population"]'s Source button (constitution: attribution
    // never silently regresses; D2 owns the eventual ring retirement).
    const hero = getByTestId('hero-stats')
    within(hero.querySelector('[data-field="population"]') as HTMLElement).getByRole('button', {
      name: 'Source: REST Countries',
    })
    within(hero.querySelector('[data-field="area"]') as HTMLElement).getByRole('button', {
      name: 'Source: REST Countries',
    })
    expect(container.querySelector('[data-field="density"]')).toBeTruthy()
    // Prime grid DataCells are now Government + Languages (+ Currencies,
    // Timezones in the desktop secondary section) — Population/Area moved out.
    const cellLabels = getAllByTestId('data-cell-value').map(
      (el) => el.previousElementSibling?.textContent,
    )
    expect(cellLabels).not.toContain('Population')
    expect(cellLabels).not.toContain('Area')
  })
})
```

- [ ] Run `npx vitest run src/components/__tests__/SingleCountryPanel.test.tsx` — expect exactly the new describe to fail with `Unable to find an element by: [data-testid="hero-stat-population"]` (all pre-existing tests stay green).

- [ ] Implement in `src/components/SingleCountryPanel.tsx`. (a) Replace the import line:

```ts
import { formatPopulation, formatArea } from '../lib/compareFields'
```

with:

```ts
import { EM_DASH, densityOf, formatArea, formatDensity, formatPopulation } from '../lib/compareFields'
import {
  AREA_RANKS,
  POPULATION_RANKS,
  formatCompact,
  formatCompactArea,
  formatCompactDensity,
  formatRank,
} from '../lib/countryStats'
```

(b) Add `HeroStat` directly below the existing `DataCell` function:

```tsx
/** D1 hero stat: compact primary numeral (.text-readout, E2 type role) with
 *  the exact value in `title` and an optional "#N of 195" rank sub-line.
 *  FieldLabel keeps the per-field source affordance + data-field anchor
 *  (attribution constitution; D2 owns the consolidated-footer migration).
 *  No whitespace-nowrap: at 360px "17.1M km²" may wrap its unit — fine. */
function HeroStat({
  label,
  field,
  country,
  sources,
  value,
  exact,
  rank,
}: {
  label: string
  field: string
  country: CountryData
  sources: CountriesFile['_sources']
  value: string
  exact?: string
  rank?: number
}) {
  return (
    <div className="py-1.5">
      <FieldLabel label={label} field={field} country={country} sources={sources} />
      <div
        data-testid={`hero-stat-${field}`}
        title={exact}
        className="text-readout text-xl font-semibold text-sand-900 dark:text-dark-50"
      >
        {value}
      </div>
      {rank !== undefined && (
        <div
          data-testid={`hero-rank-${field}`}
          className="text-readout text-[11px] text-sand-600 dark:text-dark-100 mt-0.5"
        >
          {formatRank(rank)}
        </div>
      )}
    </div>
  )
}
```

(c) Replace the prime grid block:

```tsx
        <div className="grid grid-cols-2 gap-x-4 panel-field-in-1">
          <DataCell label="Population" field="population" country={country} sources={sources}>
            {formatPopulation(country.population)}
          </DataCell>
          <DataCell label="Area" field="area" country={country} sources={sources}>
            {formatArea(country.area)}
          </DataCell>
          <DataCell label="Government" field="governmentType" country={country} sources={sources}>
            {country.governmentType || '—'}
          </DataCell>
          <DataCell label="Languages" field="languages" country={country} sources={sources}>
            {Object.keys(country.languages).length > 0
              ? Object.values(country.languages).join(', ')
              : '—'}
          </DataCell>
        </div>
```

with:

```tsx
        {/* D1 hero row — sits at the top of the scroll content, so the
            collapsed 40vh mobile sheet answers population/area/density
            without expanding. D4 repositions this row when it restructures
            the sheet header; this task deliberately keeps the layout seam. */}
        <div data-testid="hero-stats" className="grid grid-cols-3 gap-x-3 panel-field-in-1">
          <HeroStat
            label="Population"
            field="population"
            country={country}
            sources={sources}
            value={formatCompact(country.population)}
            exact={formatPopulation(country.population)}
            rank={POPULATION_RANKS.get(country.cca3)}
          />
          <HeroStat
            label="Area"
            field="area"
            country={country}
            sources={sources}
            value={formatCompactArea(country.area)}
            exact={formatArea(country.area)}
            rank={AREA_RANKS.get(country.cca3)}
          />
          <HeroStat
            label="Density"
            field="density"
            country={country}
            sources={sources}
            value={formatCompactDensity(country) ?? EM_DASH}
            exact={densityOf(country) !== null ? formatDensity(country) : undefined}
          />
        </div>

        <div className="grid grid-cols-2 gap-x-4 panel-field-in-1">
          <DataCell label="Government" field="governmentType" country={country} sources={sources}>
            {country.governmentType || '—'}
          </DataCell>
          <DataCell label="Languages" field="languages" country={country} sources={sources}>
            {Object.keys(country.languages).length > 0
              ? Object.values(country.languages).join(', ')
              : '—'}
          </DataCell>
        </div>
```

- [ ] Update the stale ownership comment in `src/lib/compareFields.ts`. Replace:

```ts
/** Canonical numeric formatters — shared by the single panel's DataCells
 *  and the compare columns (single owner; SingleCountryPanel's private
 *  copies were absorbed here by C1). */
```

with:

```ts
/** Canonical exact-value formatters — shared by the compare columns and the
 *  single panel's hero-stat `title` attributes (single owner; C1 absorbed
 *  SingleCountryPanel's private copies, D1 moved its display values to the
 *  compact rules in countryStats.ts — exact strings here, compact there). */
```

- [ ] Update the existing A4/A5 unit test title for honesty (assertions unchanged — `Population`/`Area` still render as hero FieldLabels). In `src/components/__tests__/SingleCountryPanel.test.tsx` replace:

```ts
  it('prime grid shows Population, Area, Government, Languages; Capital/Region/UN Member/Independent cells are gone', () => {
```

with:

```ts
  it('field labels survive D1: Population/Area (hero row) + Government/Languages (prime grid); Capital/Region/UN Member/Independent cells stay gone', () => {
```

- [ ] Run green: `npx vitest run src/components/__tests__/SingleCountryPanel.test.tsx src/components/__tests__/SingleCountryPanel.focus.test.tsx src/components/__tests__/chromeAccent.test.tsx` — all pass. Then `npm run check`.

- [ ] Re-anchor the invalidated e2e prose in the SAME commit. In `e2e/source-tooltip-edge.spec.ts` replace:

```ts
 * This test targets the "Population" field source button on France (/#FRA) —
 * the first DataCell (left column) after the A4/A5 panel restructure — which
 * triggers the same left-edge geometry as the original "Capital" cell.
```

with:

```ts
 * This test targets the "Population" field source button on France (/#FRA) —
 * the first D1 hero stat (leftmost column of the hero row) — which triggers
 * the same left-edge geometry as the original "Capital" cell.
```

and replace:

```ts
    // Population is the first DataCell (left column) after A4/A5. Anchor via
    // FieldLabel's data-field so the header caption's capital tooltip (now the
    // first Source button in DOM order) can't shift this test's target.
```

with:

```ts
    // Population is the leftmost D1 hero stat (it left the DataCell grid but
    // kept its FieldLabel). Anchor via data-field so the header caption's
    // capital tooltip (the first Source button in DOM order) can't shift
    // this test's target.
```

In `e2e/panel-and-deeplink.spec.ts` replace:

```ts
    // Peek state: secondary fields (Currencies, Timezones) only render once
    // showSecondary is true. Currencies is the sentinel — the prime grid
    // (Population, Area, Government, Languages) is always visible after A4+A5.
```

with:

```ts
    // Peek state: secondary fields (Currencies, Timezones) only render once
    // showSecondary is true. Currencies is the sentinel — the D1 hero row
    // (Population, Area, Density) and prime grid (Government, Languages)
    // are always visible.
```

- [ ] Run the affected e2e specs. First kill any stray dev server (project memory: a reused `npm run dev` lacks `VITE_TEST_HOOKS`): check with `Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue` and stop the owning node process if present. Then:

```
npx playwright test e2e/panel-and-deeplink.spec.ts e2e/source-tooltip-edge.spec.ts e2e/source-tooltip-keyboard.spec.ts e2e/mobile-panel-header.spec.ts e2e/a11y-contrast.spec.ts e2e/panel-focus.spec.ts --project=chromium --workers=2
```

All green (note: `source-tooltip-edge`, `panel-focus`, and parts of `a11y-contrast`'s siblings are CI-excluded — this local run IS their merge gate).

- [ ] Live pass (real regression net — has caught suite-invisible issues every tranche): `npm run dev`, open `/#FRA` and `/#RUS` (widest area string `17.1M km²`) on desktop and at 390×844, both themes. Verify: hero numerals legible in the mono face, ranks read `#22 of 195` / `#48 of 195` for France, hovering the Population label's ring shows the source tooltip, the collapsed mobile sheet shows all three hero stats without expanding, no horizontal overflow at 360px (wrapping the `km²` unit is acceptable). Kill the dev server afterwards.

- [ ] Commit:

```
git add src/components/SingleCountryPanel.tsx src/components/__tests__/SingleCountryPanel.test.tsx src/lib/compareFields.ts e2e/source-tooltip-edge.spec.ts e2e/panel-and-deeplink.spec.ts
git commit -m "feat(panel): hero stats row — compact population/area/density with world ranks (D1)" -m "Population/Area leave the DataCell grid for .text-readout hero numerals (exact values in title, #N-of-195 sub-lines); Government/Languages stay. e2e anchors re-based in the same change. D4 repositions the row when it restructures the mobile sheet header. No new telemetry." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 3: D2 — the single panel adopts the consolidated attribution scheme

The single country panel currently attributes data three ways: per-field hover-only "i" rings (`SourceTooltip` inside `FieldLabel`, `tabIndex={-1}` — the documented keyboard-unreachable trade-off), the A4 interim caption `SourceTooltip` for capital/region, and A5 exception-badge `SourceTooltip`s. This task deletes all three and adopts the compare panel's consolidated scheme: one Tab-reachable linked sources footer + superscript exception markers (C4's shipped `fieldSourceMarkers`/`SourceMarker` modules — ADOPT, do not reinvent), extended with a **"Source by field" disclosure** that expands the footer into the complete field → source table ("complete granularity one interaction away", spec D2).

Decisions this task locks in (verified against main before writing):

- **`SourceTooltip.tsx` is deleted.** Its only consumers on main are `FieldLabel.tsx` (itself only consumed by `SingleCountryPanel.tsx`) and `SingleCountryPanel.tsx` directly (caption + badges) — verified by grep; the hero-stats/D1 work does not use it. `FieldLabel.tsx` is deleted with it, and `@floating-ui/react` loses its only consumer and leaves `package.json`.
- **The two ring-scheme e2e specs are consolidated into one new spec** (`e2e/single-source-attribution.spec.ts`) in the same commit, preserving their intent: viewport containment of attribution UI (was: the floating tooltip; now: the expanded table) and keyboard reachability (was: focus-opened tooltip; now: real links + an `aria-expanded` disclosure button). `playwright.config.ts` and the spec-count prose in `docs/systems/testing.md` are updated in the same commit (40 → 39 specs; `testIgnore` ten → nine because `source-tooltip-edge.spec.ts` leaves the CI ignore list; local-only 13 → 12).
- **Disclosure widget (exact spec):** a native `<button type="button" data-testid="panel-sources-toggle" aria-expanded={…}>` labelled "Source by field" with a rotating chevron. Enter/Space toggle (native button semantics); `aria-controls="panel-sources-detail"` is set **only while expanded** (axe's `aria-valid-attr-value` flags references to absent ids); the expanded content is a real `<table>` with an `sr-only` caption and `<th scope="row">` field names, immediately after the button in DOM/reading order; focus does not move on expand (standard disclosure pattern). No Escape handling — panel-level Escape keeps closing the panel.
- **Marker placement:** `SourceMarker` (a real link, `tabIndex` 0) renders on every *rendered field host* whose source differs from `dominantSource(country._fieldSources)`: the 7 DataCell labels, the capital caption, the region badge, the Borders label, and the exception badges. Fields with no rendered host (name, subregion, latlng, landlocked, continents) resolve via the disclosure table only. `_fieldSources` keys absent from `_sources` (GNB's `manual-override`) render no marker (existing `SourceMarker` guard) and show the raw key, link-free, in the table.
- **Canonical owners:** dominance/marker math stays in `src/lib/fieldSourceMarkers.ts` (variadic — the single panel passes one record where compare passes two); the footer's "Sources:" link markup is extracted to a new shared `SourceLinkList` component consumed by BOTH panels so the JSX is never duplicated.
- **NO new telemetry.** The footer, disclosure, and markers emit zero analytics events; nothing imports from the analytics module.
- **WCAG floors (all reused shipped pairings, math shown):** footer body text `sand-600` #6b6459 on `sand-50` #fefdfb = 5.77:1, `dark-100` #94a3b8 on `dark-400` #161a22 = 6.79:1 (≥ 4.5 ✓); links/label/toggle/chevron `ice-accessible` #075985 on #fefdfb = 7.44:1, `ice` #7dd3fc on #161a22 = 10.45:1 (≥ 4.5 text, ≥ 3 non-text ✓); table row headers `sand-800`/`dark-50` ≈ 14–15:1 ✓; markers on the amber exception badges: #075985 on `amber-100` #fef3c7 = 6.78:1 (light), `ice` on the near-dark `amber-900/30`-over-`dark-400` ≈ 10:1 (dark) ✓. The toggle is a 16px `text-xs` line box → `TOUCH_TARGET_TEXT_XS` (16 + 2·14 = 44px) keeps the A13 coarse-pointer math honest.

**Files:**

- Modify: `src/components/SingleCountryPanel.tsx`
- Create: `src/components/SourceLinkList.tsx`
- Modify: `src/components/CompareCountryPanel.tsx` (footer consumes `SourceLinkList`)
- Delete: `src/components/FieldLabel.tsx`, `src/components/SourceTooltip.tsx`
- Modify (comment hygiene — references to the deleted scheme): `src/components/exceptionBadge.ts`, `src/components/SourceMarker.tsx`, `src/lib/fieldSourceMarkers.ts`
- Modify: `src/components/__tests__/SingleCountryPanel.test.tsx`, `src/components/__tests__/SingleCountryPanel.focus.test.tsx`, `src/components/__tests__/singleCountryPanelTestUtils.ts`
- Create: `e2e/single-source-attribution.spec.ts`; Delete: `e2e/source-tooltip-edge.spec.ts`, `e2e/source-tooltip-keyboard.spec.ts`
- Modify: `playwright.config.ts`, `package.json` + `package-lock.json` (drop `@floating-ui/react`)
- Docs: `docs/systems/ui-layout.md`, `docs/systems/accessibility.md`, `docs/systems/data.md`, `docs/systems/testing.md`, `CONTRIBUTING.md`

**Interfaces:**

- Consumed as-is (C4's shipped modules — verified shapes): `computeFieldSourceMarkers(...fieldSourcesList: Array<Record<string, string>>): FieldSourceMarkers` with `FieldSourceMarkers = { dominantSource: string | null; markerBySource: ReadonlyMap<string, string>; markerByField: ReadonlyMap<string, FieldMarker> }` from `src/lib/fieldSourceMarkers.ts`; `SourceMarker({ glyph: string; sourceKey: string; sources: CountriesFile['_sources'] })` from `src/components/SourceMarker.tsx` (renders `data-testid={'source-marker-' + sourceKey}`, `aria-label={'Source: ' + name}`).
- New: `SourceLinkList({ sources: CountriesFile['_sources']; markerBySource: ReadonlyMap<string, string> }): JSX` — the "Sources:" label + linked source names with glyph superscripts, canonical owner for both panels' footers.
- `SingleCountryPanel` props are **unchanged** (`country, comparePickingMode, sources, isDesktop, onSelect, onClose, onEnterCompare, onCancelCompare, byCca3, inGameRound?`). New DOM contract: `data-testid="panel-sources"` (footer), `panel-sources-toggle` (disclosure button, `aria-expanded`), `panel-sources-detail` (table, only attached while expanded); `data-field="<key>"` stays on every DataCell label and the Borders label.
- Deleted exports: `FieldLabel` (named), `SourceTooltip` (default), `stubMatchMedia` from `singleCountryPanelTestUtils.ts` (its raison d'être — SourceTooltip's module-eval `matchMedia` call — is gone; the underlying `src/test/matchMediaStub.ts` stays for its other consumers).

**Steps:**

- [ ] **3.1 Write the failing unit tests.** Two edits.

  (a) In `src/components/__tests__/singleCountryPanelTestUtils.ts`, extend the sources fixture with the exception source. Replace:

  ```ts
  export const sources: CountriesFile['_sources'] = {
    restcountries: {
      name: 'REST Countries',
      url: 'https://restcountries.com',
      description: 'Country reference data',
      lastUpdated: '2026-01-01',
    },
  }
  ```

  with:

  ```ts
  export const sources: CountriesFile['_sources'] = {
    restcountries: {
      name: 'REST Countries',
      url: 'https://restcountries.com',
      description: 'Country reference data',
      lastUpdated: '2026-01-01',
    },
    'cia-factbook': {
      name: 'CIA World Factbook (archived)',
      url: 'https://github.com/factbook/factbook.json',
      description: 'CC0 JSON archive of the CIA World Factbook',
      lastUpdated: '2026-01-22',
    },
  }
  ```

  (b) In `src/components/__tests__/SingleCountryPanel.test.tsx`, rewrite the four attribution tests inside the `'SingleCountryPanel — prime grid dedupe + exception badges (A4+A5)'` describe and append a new describe. Leave the dynamic-import/`stubMatchMedia` scaffolding in place for now — it is removed in step 3.4 when `SourceTooltip` dies. Replace the test `'header caption joins all capitals and carries the interim capital SourceTooltip'` (which currently asserts `getByRole('button', { name: 'Source: REST Countries' })`) with:

  ```tsx
  it('header caption joins all capitals; the A4 interim tooltip is retired (D2)', () => {
    const { getByTestId, queryByRole } = renderWith(
      makeCountry({
        cca3: 'ZAF',
        cca2: 'ZA',
        ccn3: '710',
        name: { common: 'South Africa', official: 'Republic of South Africa' },
        capital: ['Pretoria', 'Bloemfontein', 'Cape Town'],
        region: 'Africa',
        subregion: 'Southern Africa',
        _fieldSources: { capital: 'restcountries' },
      }),
    )
    expect(getByTestId('capital-caption').textContent).toContain(
      'Pretoria, Bloemfontein, Cape Town',
    )
    // capital sits on the dominant source, so no inline marker renders —
    // its attribution lives in the footer's field → source table.
    expect(queryByRole('button', { name: /^Source:/ })).toBeNull()
  })
  ```

  Replace the test `'Vatican (unMember false, independent true) renders only the UN observer badge, with source attribution'` with:

  ```tsx
  it('Vatican renders only the UN observer badge; a non-dominant badge field carries a marker link', () => {
    const { getByText, queryByText, getByTestId } = renderWith(
      makeCountry({
        cca3: 'VAT',
        cca2: 'VA',
        ccn3: '336',
        name: { common: 'Vatican City', official: 'Vatican City State' },
        capital: ['Vatican City'],
        region: 'Europe',
        subregion: 'Southern Europe',
        population: 764,
        area: 0.44,
        governmentType: 'ecclesiastical elective monarchy',
        unMember: false,
        independent: true,
        _fieldSources: {
          population: 'restcountries',
          area: 'restcountries',
          capital: 'restcountries',
          unMember: 'cia-factbook',
        },
      }),
    )
    expect(getByText('UN observer state')).toBeTruthy()
    expect(queryByText('Not independent')).toBeNull()
    // Field-level attribution is a constitution item (never silently
    // regress) — a badge whose source differs from the panel's dominant
    // source carries the C4/D2 marker, a real LINK in the Tab order
    // (the hover-only rings are retired).
    const marker = within(getByTestId('exception-badge-un-member')).getByRole('link', {
      name: 'Source: CIA World Factbook (archived)',
    })
    expect(marker.getAttribute('data-testid')).toBe('source-marker-cia-factbook')
  })
  ```

  Replace the test `'Palestine (unMember false, independent false) renders both exception badges, each with source attribution'` with:

  ```tsx
  it('Palestine renders both exception badges bare when their fields sit on the dominant source', () => {
    const { getByText, getByTestId } = renderWith(
      makeCountry({
        cca3: 'PSE',
        cca2: 'PS',
        ccn3: '275',
        name: { common: 'Palestine', official: 'State of Palestine' },
        capital: ['Ramallah'],
        region: 'Asia',
        subregion: 'Western Asia',
        population: 4_803_269,
        area: 6_220,
        unMember: false,
        independent: false,
        _fieldSources: { unMember: 'restcountries', independent: 'restcountries' },
      }),
    )
    expect(getByText('UN observer state')).toBeTruthy()
    expect(getByText('Not independent')).toBeTruthy()
    // Dominant-source badge fields carry no inline marker — the footer's
    // field table answers them one interaction away.
    expect(within(getByTestId('exception-badge-un-member')).queryByRole('link')).toBeNull()
    expect(within(getByTestId('exception-badge-independent')).queryByRole('link')).toBeNull()
  })
  ```

  Replace the test `'exception badges render no source affordance when _fieldSources omits the field'` with:

  ```tsx
  it('a badge marker for a source key absent from _sources renders nothing (GNB manual-override)', () => {
    const { getByTestId } = renderWith(
      makeCountry({
        cca3: 'GNB',
        cca2: 'GW',
        ccn3: '624',
        name: { common: 'Guinea-Bissau', official: 'Republic of Guinea-Bissau' },
        unMember: false,
        _fieldSources: {
          population: 'restcountries',
          area: 'restcountries',
          capital: 'restcountries',
          unMember: 'manual-override',
        },
      }),
    )
    expect(within(getByTestId('exception-badge-un-member')).queryByRole('link')).toBeNull()
  })
  ```

  Append this describe at the end of the file:

  ```tsx
  describe('SingleCountryPanel — consolidated sources footer (D2)', () => {
    function renderWith(country: CountryData) {
      return render(
        <SingleCountryPanel
          country={country}
          comparePickingMode={false}
          sources={sources}
          isDesktop={true}
          onSelect={() => {}}
          onClose={() => {}}
          onEnterCompare={() => {}}
          onCancelCompare={() => {}}
          byCca3={new Map()}
        />,
      )
    }

    // Mirrors the bundled data's shape: every field restcountries except
    // governmentType (cia-factbook) — the one exception, glyph †.
    const franceLike = () =>
      makeCountry({
        _fieldSources: {
          capital: 'restcountries',
          population: 'restcountries',
          area: 'restcountries',
          languages: 'restcountries',
          currencies: 'restcountries',
          timezones: 'restcountries',
          governmentType: 'cia-factbook',
        },
      })

    it('renders one linked footer; the exception source carries the † glyph key', () => {
      const { getByTestId } = renderWith(franceLike())
      const footer = getByTestId('panel-sources')
      expect(footer.textContent).toContain('Sources:')
      const rest = within(footer).getByRole('link', { name: /REST Countries/ })
      expect(rest.getAttribute('href')).toBe('https://restcountries.com')
      expect(rest.getAttribute('target')).toBe('_blank')
      expect(rest.getAttribute('rel')).toBe('noopener noreferrer')
      expect(rest.textContent).not.toContain('†')
      const cia = within(footer).getByRole('link', { name: /CIA World Factbook/ })
      expect(cia.textContent).toContain('†')
    })

    it('the Government field carries the † marker; dominant-source fields carry none', () => {
      const { getByTestId, queryByTestId } = renderWith(franceLike())
      const marker = getByTestId('source-marker-cia-factbook')
      expect(marker.textContent).toBe('†')
      expect(marker.closest('[data-field="governmentType"]')).not.toBeNull()
      expect(queryByTestId('source-marker-restcountries')).toBeNull()
    })

    it('the per-field "i" rings are gone', () => {
      const { queryAllByRole } = renderWith(franceLike())
      expect(queryAllByRole('button', { name: /^Source:/ })).toHaveLength(0)
    })

    it('disclosure expands into the full field → source table and collapses back', () => {
      const { getByTestId, queryByTestId } = renderWith(franceLike())
      const toggle = getByTestId('panel-sources-toggle')
      expect(toggle.getAttribute('aria-expanded')).toBe('false')
      expect(queryByTestId('panel-sources-detail')).toBeNull()

      fireEvent.click(toggle)
      expect(toggle.getAttribute('aria-expanded')).toBe('true')
      expect(toggle.getAttribute('aria-controls')).toBe('panel-sources-detail')
      const table = getByTestId('panel-sources-detail')
      expect(within(table).getAllByRole('row')).toHaveLength(7)
      within(table).getByRole('rowheader', { name: 'Government' })
      within(table).getByRole('cell', { name: 'CIA World Factbook (archived)' })
      within(table).getByRole('rowheader', { name: 'Capital' })

      fireEvent.click(toggle)
      expect(toggle.getAttribute('aria-expanded')).toBe('false')
      expect(queryByTestId('panel-sources-detail')).toBeNull()
    })

    it('the table falls back to the raw source key when _sources lacks it (manual-override)', () => {
      const { getByTestId } = renderWith(
        makeCountry({
          _fieldSources: { population: 'restcountries', unMember: 'manual-override' },
        }),
      )
      fireEvent.click(getByTestId('panel-sources-toggle'))
      const table = getByTestId('panel-sources-detail')
      within(table).getByRole('rowheader', { name: 'UN member' })
      within(table).getByRole('cell', { name: 'manual-override' })
    })
  })
  ```

- [ ] **3.2 Run the unit tests and confirm the expected failures.**

  ```
  npx vitest run src/components/__tests__/SingleCountryPanel.test.tsx
  ```

  Expected: **7 failures** — the caption test (the interim tooltip button still exists), the Vatican marker test (no link rendered), and all five tests in the new D2 describe except none (`panel-sources` testid missing × 3, rings still present × 1, disclosure/fallback missing × 2, i.e. 'renders one linked footer', 'Government field carries the † marker', 'per-field "i" rings are gone', 'disclosure expands…', 'table falls back…'). The rewritten Palestine and GNB tests pass already (they pin absence of links, which current code also satisfies) — that is fine; they are regression pins.

- [ ] **3.3 Create `src/components/SourceLinkList.tsx`** (canonical owner of the footer link markup for both panels — extracted verbatim from the compare footer, classes unchanged):

  ```tsx
  import type { CountriesFile } from '../lib/types'

  interface Props {
    sources: CountriesFile['_sources']
    /** Exception source key -> glyph (fieldSourceMarkers.markerBySource). */
    markerBySource: ReadonlyMap<string, string>
  }

  /**
   * The consolidated footer's "Sources:" line — linked source names, each
   * exception source prefixed with its C4/D2 marker glyph. Canonical owner
   * of this markup for BOTH panels (compare footer, single-panel footer):
   * import, never duplicate.
   *
   * Contrast (shipped pairings): #075985 on #fefdfb = 7.44:1 (light);
   * #7dd3fc on #161a22 = 10.45:1 (dark).
   */
  export function SourceLinkList({ sources, markerBySource }: Props) {
    return (
      <>
        <span className="uppercase tracking-wider text-ice-accessible dark:text-ice font-medium">
          Sources:
        </span>{' '}
        {Object.entries(sources).map(([key, s], i) => (
          <span key={key}>
            {i > 0 && ' · '}
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ice-accessible dark:text-ice hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/60 dark:focus-visible:ring-ice/60 rounded"
            >
              {/* Marker key: the glyph precedes the exception source's name
                  so field superscripts resolve here. Dominant source: no
                  glyph. */}
              {markerBySource.has(key) && <sup className="mr-0.5">{markerBySource.get(key)}</sup>}
              {s.name}
            </a>
          </span>
        ))}
      </>
    )
  }
  ```

- [ ] **3.4 Implement the scheme swap in `src/components/SingleCountryPanel.tsx`.** Eight edits, quoting current main:

  (a) Replace the import block:

  ```tsx
  import { useEffect, useRef, useState } from 'react'
  import type { CountryData, CountriesFile } from '../lib/types'
  import { BorderChip } from './BorderChip'
  import { CloseButton } from './CloseButton'
  import { FieldLabel } from './FieldLabel'
  import { TimezoneList } from './TimezoneList'
  import SourceTooltip from './SourceTooltip'
  import { dispatchToast } from '../lib/toast'
  import { TOUCH_TARGET_FROM_36, TOUCH_TARGET_FROM_22 } from '../lib/layoutConstants'
  import { formatPopulation, formatArea } from '../lib/compareFields'
  import { EXCEPTION_BADGE, activeExceptionBadges } from './exceptionBadge'
  ```

  with:

  ```tsx
  import { useEffect, useRef, useState } from 'react'
  import type { CountryData, CountriesFile } from '../lib/types'
  import { BorderChip } from './BorderChip'
  import { CloseButton } from './CloseButton'
  import { TimezoneList } from './TimezoneList'
  import { dispatchToast } from '../lib/toast'
  import {
    TOUCH_TARGET_FROM_36,
    TOUCH_TARGET_FROM_22,
    TOUCH_TARGET_TEXT_XS,
  } from '../lib/layoutConstants'
  import { formatPopulation, formatArea } from '../lib/compareFields'
  import { EXCEPTION_BADGE, activeExceptionBadges } from './exceptionBadge'
  import { computeFieldSourceMarkers } from '../lib/fieldSourceMarkers'
  import { SourceMarker } from './SourceMarker'
  import { SourceLinkList } from './SourceLinkList'
  ```

  (b) Replace the `DataCell` component (currently takes `country`/`sources` and renders `<FieldLabel label={label} field={field} country={country} sources={sources} />`):

  ```tsx
  function DataCell({
    label,
    children,
    field,
    country,
    sources,
  }: {
    label: string
    children: React.ReactNode
    field: string
    country: CountryData
    sources: CountriesFile['_sources']
  }) {
    return (
      <div className="py-1.5">
        <FieldLabel label={label} field={field} country={country} sources={sources} />
        <div
          data-testid="data-cell-value"
          className="text-[15px] text-sand-800 dark:text-dark-50 tabular-nums"
        >
          {children}
        </div>
      </div>
    )
  }
  ```

  with:

  ```tsx
  function DataCell({
    label,
    field,
    marker,
    children,
  }: {
    label: string
    field: string
    /** rowMarker(field) — the C4/D2 exception marker, or null. */
    marker: React.ReactNode
    children: React.ReactNode
  }) {
    return (
      <div className="py-1.5">
        <div
          data-field={field}
          className="text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice mb-0.5 flex items-center gap-1"
        >
          {label}
          {marker}
        </div>
        <div
          data-testid="data-cell-value"
          className="text-[15px] text-sand-800 dark:text-dark-50 tabular-nums"
        >
          {children}
        </div>
      </div>
    )
  }
  ```

  (The label div inlines `FieldLabel`'s `DEFAULT_CLASSNAME` and keeps the `data-field` e2e anchor.)

  (c) After the `REGION_BADGE` constant, add:

  ```tsx
  /** Display names for `_fieldSources` keys in the footer's field → source
   *  table (D2). Unknown keys render as-is — an honest fallback for fields
   *  the data pipeline adds before this map learns them. */
  const FIELD_TABLE_LABELS: Record<string, string> = {
    name: 'Name',
    capital: 'Capital',
    region: 'Region',
    subregion: 'Subregion',
    population: 'Population',
    area: 'Area',
    languages: 'Languages',
    currencies: 'Currencies',
    latlng: 'Coordinates',
    borders: 'Borders',
    independent: 'Independent',
    unMember: 'UN member',
    landlocked: 'Landlocked',
    timezones: 'Timezones',
    continents: 'Continents',
    governmentType: 'Government',
  }
  ```

  (d) In the component body, directly after `const [animationState, setAnimationState] = useState<'entering' | 'idle'>('entering')`, add:

  ```tsx
  const [sourcesExpanded, setSourcesExpanded] = useState(false)

  // D2: consolidated attribution — one footer, exceptions inline. Single
  // owner of the dominance/marker math: src/lib/fieldSourceMarkers.ts
  // (shipped with C4; compare computes the same markers across BOTH
  // countries' _fieldSources, this panel across one).
  const fieldMarkers = computeFieldSourceMarkers(country._fieldSources)
  const rowMarker = (field: string): React.ReactNode => {
    const marker = fieldMarkers.markerByField.get(field)
    if (!marker) return null
    return <SourceMarker glyph={marker.glyph} sourceKey={marker.source} sources={sources} />
  }
  ```

  (e) In the capital caption, replace:

  ```tsx
                  <span className="truncate">{country.capital.join(', ')}</span>
                  {/* Interim attribution (A4): the caption absorbed the deleted
                      Capital DataCell; the region badge shares this source.
                      Superseded by D2's consolidated footer. */}
                  <SourceTooltip
                    field="capital"
                    fieldSources={country._fieldSources}
                    sources={sources}
                  />
  ```

  with:

  ```tsx
                  <span className="truncate">{country.capital.join(', ')}</span>
                  {/* D2: the A4 interim SourceTooltip is retired — capital
                      carries an exception marker only when its source differs
                      from the panel's dominant source; the footer's field
                      table has the full answer either way. */}
                  {rowMarker('capital')}
  ```

  (f) In the region badge, replace:

  ```tsx
            {country.region}
            {country.subregion && ` / ${country.subregion}`}
          </span>
  ```

  with:

  ```tsx
            {country.region}
            {country.subregion && ` / ${country.subregion}`}
            {rowMarker('region')}
          </span>
  ```

  and in the exception badges directly below, replace:

  ```tsx
              {b.label}
              {/* Field-level attribution is a constitution item (never silently
                  regress) — mirrors the capital caption's SourceTooltip (A4). */}
              <SourceTooltip
                field={b.field}
                fieldSources={country._fieldSources}
                sources={sources}
              />
  ```

  with:

  ```tsx
              {b.label}
              {/* Field-level attribution is a constitution item (never silently
                  regress) — non-dominant badge fields carry the C4/D2 marker
                  link; dominant ones resolve in the footer's field table. */}
              {rowMarker(b.field)}
  ```

  (g) Update all six DataCell call sites. Replace the prime grid:

  ```tsx
          <DataCell label="Population" field="population" country={country} sources={sources}>
            {formatPopulation(country.population)}
          </DataCell>
          <DataCell label="Area" field="area" country={country} sources={sources}>
            {formatArea(country.area)}
          </DataCell>
          <DataCell label="Government" field="governmentType" country={country} sources={sources}>
            {country.governmentType || '\u2014'}
          </DataCell>
          <DataCell label="Languages" field="languages" country={country} sources={sources}>
  ```

  with:

  ```tsx
          <DataCell label="Population" field="population" marker={rowMarker('population')}>
            {formatPopulation(country.population)}
          </DataCell>
          <DataCell label="Area" field="area" marker={rowMarker('area')}>
            {formatArea(country.area)}
          </DataCell>
          <DataCell label="Government" field="governmentType" marker={rowMarker('governmentType')}>
            {country.governmentType || '\u2014'}
          </DataCell>
          <DataCell label="Languages" field="languages" marker={rowMarker('languages')}>
  ```

  and in the secondary block replace `<DataCell label="Currencies" field="currencies" country={country} sources={sources}>` with `<DataCell label="Currencies" field="currencies" marker={rowMarker('currencies')}>` and `<DataCell label="Timezones" field="timezones" country={country} sources={sources}>` with `<DataCell label="Timezones" field="timezones" marker={rowMarker('timezones')}>`. Replace the Borders `FieldLabel`:

  ```tsx
                  <FieldLabel
                    label="Borders"
                    field="borders"
                    country={country}
                    sources={sources}
                    className="text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice mb-2 flex items-center gap-1"
                  />
  ```

  with:

  ```tsx
                  <div
                    data-field="borders"
                    className="text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice mb-2 flex items-center gap-1"
                  >
                    Borders
                    {rowMarker('borders')}
                  </div>
  ```

  (h) Insert the footer. Replace the end of the content div:

  ```tsx
          </>
        )}
      </div>
    </div>
  )
  }
  ```

  (the closing of `{showSecondary && (…)}` followed by the two closing divs — anchor on the exact whitespace in the file) with:

  ```tsx
          </>
        )}

        {/* D2: consolidated linked sources footer (compare's pattern via the
            shared SourceLinkList), always rendered — attribution must not
            hide behind the mobile expand toggle. The disclosure exposes the
            complete field → source table so full granularity stays one
            interaction away for every country. aria-controls is set only
            while the table exists — axe's aria-valid-attr-value flags
            references to absent ids. NO analytics events here. */}
        <footer
          data-testid="panel-sources"
          className="mt-4 pt-3 border-t border-sand-200/50 dark:border-dark-200/30 text-xs text-sand-600 dark:text-dark-100"
        >
          <SourceLinkList sources={sources} markerBySource={fieldMarkers.markerBySource} />
          <button
            type="button"
            data-testid="panel-sources-toggle"
            aria-expanded={sourcesExpanded}
            {...(sourcesExpanded ? { 'aria-controls': 'panel-sources-detail' } : {})}
            onClick={() => setSourcesExpanded((v) => !v)}
            className={`mt-1.5 flex items-center gap-1 font-medium text-ice-accessible dark:text-ice hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/60 dark:focus-visible:ring-ice/60 rounded ${TOUCH_TARGET_TEXT_XS}`}
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${sourcesExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Source by field
          </button>
          {sourcesExpanded && (
            <table
              id="panel-sources-detail"
              data-testid="panel-sources-detail"
              className="mt-2 w-full border-collapse"
            >
              <caption className="sr-only">Data source for each field</caption>
              <tbody>
                {Object.entries(country._fieldSources).map(([field, key]) => (
                  <tr
                    key={field}
                    className="border-t border-sand-200/50 dark:border-dark-200/30 first:border-t-0"
                  >
                    <th
                      scope="row"
                      className="py-1 pr-3 text-left font-normal text-sand-800 dark:text-dark-50"
                    >
                      {FIELD_TABLE_LABELS[field] ?? field}
                    </th>
                    {/* _sources can lack a key ('manual-override' on GNB's
                        unMember) — show the raw key rather than inventing a
                        registry entry; SourceMarker skips such keys too. */}
                    <td className="py-1">{sources[key]?.name ?? key}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </footer>
      </div>
    </div>
  )
  }
  ```

- [ ] **3.5 Point the compare footer at the shared component.** In `src/components/CompareCountryPanel.tsx`, add `import { SourceLinkList } from './SourceLinkList'` after `import { SourceMarker } from './SourceMarker'`, then replace the footer body:

  ```tsx
        <footer
          className="px-4 py-3 border-t border-sand-200/50 dark:border-dark-200/30 text-xs text-sand-600 dark:text-dark-100"
          data-testid="compare-sources"
        >
          <span className="uppercase tracking-wider text-ice-accessible dark:text-ice font-medium">
            Sources:
          </span>{' '}
          {Object.entries(sources).map(([key, s], i) => (
            <span key={key}>
              {i > 0 && ' · '}
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ice-accessible dark:text-ice hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/60 dark:focus-visible:ring-ice/60 rounded"
              >
                {/* C4 marker key: the glyph precedes the exception source's name
                    so row superscripts resolve here. Dominant source: no glyph. */}
                {fieldMarkers.markerBySource.has(key) && (
                  <sup className="mr-0.5">{fieldMarkers.markerBySource.get(key)}</sup>
                )}
                {s.name}
              </a>
            </span>
          ))}
        </footer>
  ```

  with:

  ```tsx
        <footer
          className="px-4 py-3 border-t border-sand-200/50 dark:border-dark-200/30 text-xs text-sand-600 dark:text-dark-100"
          data-testid="compare-sources"
        >
          <SourceLinkList sources={sources} markerBySource={fieldMarkers.markerBySource} />
        </footer>
  ```

- [ ] **3.6 Remove the obsolete scheme and its scaffolding.** Six actions in one step (they only compile together):

  (a) Delete the superseded components and the now-consumer-less dependency:

  ```
  git rm src/components/FieldLabel.tsx src/components/SourceTooltip.tsx
  npm uninstall @floating-ui/react
  ```

  Before the uninstall, verify the dependency really has no other consumer: `grep -rn "floating-ui" src/ e2e/` must return nothing after the deletions.

  (b) `src/components/__tests__/singleCountryPanelTestUtils.ts` — remove the matchMedia scaffolding that existed only for SourceTooltip's module-eval `window.matchMedia` call: delete the import `import { stubMatchMedia as _stubMatchMedia } from '../../test/matchMediaStub'`, the whole "matchMedia stub" section (the banner comment, the `/** jsdom does not implement matchMedia; SourceTooltip touches it at module evaluation time. … */` doc block, and the `export function stubMatchMedia(): void { … }` body), and update the file-header comment's "the country factory, sources constant, matchMedia stub, and getAnimations patch" to "the country factory, sources constant, and getAnimations patch". (`src/test/matchMediaStub.ts` itself stays — SearchBar/useTheme/chromeAccent tests still use it.)

  (c) `src/components/__tests__/SingleCountryPanel.test.tsx` — convert to a static import (nothing in the panel's import graph touches matchMedia at module eval anymore). Replace:

  ```tsx
  import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
  import { act, fireEvent, render, within } from '@testing-library/react'
  import type { CountryData, CountriesFile } from '../../lib/types'
  import type { ComponentType } from 'react'
  import {
    makeCountry,
    sources,
    stubMatchMedia,
    stubGetAnimations,
  } from './singleCountryPanelTestUtils'
  import { TOUCH_TARGET_FROM_36 } from '../../lib/layoutConstants'

  // Dynamically loaded after matchMedia is stubbed.
  let SingleCountryPanel: ComponentType<{
    country: CountryData
    comparePickingMode: boolean
    sources: CountriesFile['_sources']
    isDesktop: boolean
    onSelect: (cca3: string) => void
    onClose: () => void
    onEnterCompare: () => void
    onCancelCompare: () => void
    byCca3: Map<string, CountryData>
    inGameRound?: boolean
  }>
  ```

  with:

  ```tsx
  import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
  import { act, fireEvent, render, within } from '@testing-library/react'
  import type { CountryData } from '../../lib/types'
  import { makeCountry, sources, stubGetAnimations } from './singleCountryPanelTestUtils'
  import { TOUCH_TARGET_FROM_36 } from '../../lib/layoutConstants'
  import { SingleCountryPanel } from '../SingleCountryPanel'
  ```

  and delete the first describe's beforeAll:

  ```tsx
    beforeAll(async () => {
      stubMatchMedia()
      const mod = await import('../SingleCountryPanel')
      SingleCountryPanel = mod.SingleCountryPanel as typeof SingleCountryPanel
    })
  ```

  (d) `src/components/__tests__/SingleCountryPanel.focus.test.tsx` — same conversion. Replace lines 1–31 (imports, the `// Dynamically loaded after matchMedia is stubbed.` block, the `let SingleCountryPanel: ComponentType<…>` declaration, and the describe-opening + beforeAll) with:

  ```tsx
  import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
  import { render, screen } from '@testing-library/react'
  import { makeCountry, sources, stubGetAnimations } from './singleCountryPanelTestUtils'
  import { SingleCountryPanel } from '../SingleCountryPanel'

  describe('SingleCountryPanel — focus management on mount', () => {
  ```

  (the `let restore: () => void` line and everything below it are unchanged).

  (e) Comment hygiene so no source file references the deleted scheme: in `src/components/exceptionBadge.ts` change "the single panel's badges carry a SourceTooltip affordance and need to align it" to "the single panel's badges can carry a SourceMarker exception affordance and need to align it"; in `src/components/SourceMarker.tsx` change "(e.g. GNB's\n * 'manual-override'), matching SourceTooltip's guard." to "(e.g. GNB's\n * 'manual-override'); the single panel's field → source table shows such\n * keys raw instead."; in `src/lib/fieldSourceMarkers.ts` change "single owner (spec 2026-07-26, item C4;\n * D2 adopts these exports for the single-country panel later — never\n * re-derive dominance elsewhere)." to "single owner (spec 2026-07-26, items\n * C4/D2; both panels consume these exports — never re-derive dominance\n * elsewhere).".

  (f) Verify no dangling references: `grep -rn "SourceTooltip\|FieldLabel" src/ e2e/` must return no hits outside comments in docs/plans (i.e. zero hits under `src/` and `e2e/`).

- [ ] **3.7 Run the unit suites green.**

  ```
  npx vitest run src/components/__tests__/SingleCountryPanel.test.tsx src/components/__tests__/SingleCountryPanel.focus.test.tsx src/components/__tests__/CompareCountryPanel.test.tsx src/components/__tests__/SourceMarker.test.tsx src/lib/__tests__/fieldSourceMarkers.test.ts src/lib/__tests__/layoutConstants.test.ts
  ```

  Expected: all pass. (layoutConstants' drift alarm still finds `TOUCH_TARGET_FROM_36`/`TOUCH_TARGET_FROM_22`, `compare-picking-cancel`, `w-3.5 h-3.5`, `h-[40vh]`, `w-[360px]` in the panel source and the compare pins untouched — verified against the pin list before writing this plan.)

- [ ] **3.8 Rewrite the two ring-scheme e2e specs as one spec pinning the new scheme's intent, and re-anchor the config — same commit.**

  (a) `git rm e2e/source-tooltip-edge.spec.ts e2e/source-tooltip-keyboard.spec.ts`

  (b) Create `e2e/single-source-attribution.spec.ts`:

  ```ts
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
      expect(rect.right, 'table must not overflow on the right').toBeLessThanOrEqual(
        viewport.width,
      )

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
  ```

  (c) In `playwright.config.ts`, in the `chromium` project's `testMatch`, replace:

  ```ts
          'compare-source-attribution.spec.ts',
          'source-tooltip-edge.spec.ts',
          'source-tooltip-keyboard.spec.ts',
  ```

  with:

  ```ts
          'compare-source-attribution.spec.ts',
          'single-source-attribution.spec.ts',
  ```

  and in the CI `testIgnore` array delete the line `'source-tooltip-edge.spec.ts',` (the new spec is DOM-driven after map load, like `source-tooltip-keyboard` and `compare-source-attribution` which already run on CI — it does NOT inherit the edge spec's CI quarantine).

- [ ] **3.9 Run the affected e2e specs.** First kill any stray dev server — a background `npm run dev` gets reused by `reuseExistingServer` without `VITE_TEST_HOOKS` (project memory). On Windows: `netstat -ano | findstr :5173` then `Stop-Process -Id <pid> -Force` for any listener. Then:

  ```
  npx playwright test e2e/single-source-attribution.spec.ts e2e/compare-source-attribution.spec.ts --project=chromium --workers=2
  ```

  Expected: all pass (`--workers=2` matches CI parallelism). If the disclosure test flakes on the `panel-close` autofocus wait, that is the App.tsx 300ms focus timer contract — read the trace, don't re-run blindly.

- [ ] **3.10 Update the documentation in the same task (staleness rule).** Seven edits:

  (a) `docs/systems/ui-layout.md` — replace the caption bullet:

  > `- Header caption: capital(s), comma-separated if a country has multiple (e.g., South Africa: Pretoria, Cape Town, Bloemfontein), carrying its own source tooltip (the region badge shares the same source)`

  with:

  > `- Header caption: capital(s), comma-separated if a country has multiple (e.g., South Africa: Pretoria, Cape Town, Bloemfontein); a superscript exception marker follows when capital's source differs from the panel's dominant source (D2)`

  (b) same file — in the exception-badges bullet replace "Each carries its own source tooltip." with "A badge whose field's source differs from the panel's dominant source carries a superscript exception marker (`SourceMarker`)."

  (c) same file — replace the **Source Attribution** paragraph ("Every data field has a small 'i' icon. On desktop, hover or focus shows a tooltip … The tooltip is dismissed by tapping elsewhere. See [Data System — UI Attribution](data.md).") with:

  > **Source Attribution** (D2): One consolidated footer (`data-testid="panel-sources"`) lists the panel's linked data sources — the same scheme as compare's footer (shared `SourceLinkList` markup). Field-level granularity is preserved two ways: a superscript exception marker (`SourceMarker`, a real link in the Tab order) on any rendered field whose source differs from the panel's dominant source (single owner of the math: `src/lib/fieldSourceMarkers.ts`), and a "Source by field" disclosure button (`aria-expanded`) that expands the footer into the complete field → source table — full granularity one interaction away for every country. The per-field 'i' tooltip rings are retired. Covered by `e2e/single-source-attribution.spec.ts` (desktop-`chromium`, runs on CI). See [Data System — UI Attribution](data.md).

  (d) same file — in the compare attribution paragraph replace "(definition shipped with C4; the single panel adopts it in D2)" with "(single owner `src/lib/fieldSourceMarkers.ts`; the single panel uses the same scheme plus a field → source disclosure table — D2)".

  (e) `docs/systems/accessibility.md` — replace the two attribution paragraphs (the "Source 'i' buttons are intentionally outside the Tab order (`tabIndex=-1`) … (see the comment in `SourceTooltip.tsx`)." paragraph AND the following "The compare panel's exception source markers (C4, `SourceMarker.tsx`) … D2 extends this scheme to the single panel." paragraph) with one:

  > All attribution affordances are in the Tab order (D2 retired the hover-only `tabIndex=-1` 'i' buttons and the documented trade-off they carried): the sources footers' links, the single panel's "Source by field" disclosure button (`aria-expanded`, `aria-controls` while expanded), and the superscript exception markers (`SourceMarker.tsx`) — ordinary links labelled `Source: <name>`.

  Then in the ARIA roles table replace the row fragment `| Source tooltip | \`role="tooltip"\`` with `| Sources footer | \`<button aria-expanded>\`` and its cell text `Source name and URL` with `"Source by field" — expands to the field → source table`.

  (f) `docs/systems/data.md` — replace "The 'i' tooltip component looks up the source key from `_fieldSources` and resolves it via the `_sources` registry to get the display name and URL." with "The attribution UI (the consolidated sources footer, its field → source table, and the exception markers) looks up the source key from `_fieldSources` and resolves it via the `_sources` registry; keys absent from `_sources` (e.g. `manual-override`) render as the raw key with no link." And under **### UI Attribution** replace "Every data field in the country panel has a small 'i' icon. On hover/focus, a tooltip shows the source name and URL. This provides full transparency about data provenance." with "Both panels consolidate attribution into one linked sources footer; any field whose source differs from the panel's dominant source carries a superscript exception marker keyed to the footer (`src/lib/fieldSourceMarkers.ts`). The single panel's footer additionally expands (\"Source by field\") into the complete field → source table. Full transparency about data provenance, complete granularity one interaction away."

  (g) `docs/systems/testing.md` — the spec-census prose: "# 40 specs total — see playwright.config.ts testMatch" → "# 39 specs total — see playwright.config.ts testMatch"; "`testIgnore` excludes ten specs on CI" → "`testIgnore` excludes nine specs on CI"; "**13 of 40 spec files run locally only** — the ten `testIgnore`d" → "**12 of 39 spec files run locally only** — the nine `testIgnore`d". Also `CONTRIBUTING.md` item 5: replace "Every new field must have a `_fieldSources` entry and a `SourceTooltip`-visible source." with "Every new field must have a `_fieldSources` entry that resolves in the panel's sources footer (the field → source table, plus an exception marker where the source is non-dominant)."

- [ ] **3.11 Full verification.**

  ```
  npm run lint
  npx vitest run
  npx playwright test e2e/panel-and-deeplink.spec.ts e2e/mobile-panel-header.spec.ts e2e/a11y-contrast.spec.ts --project=chromium --workers=2
  npx playwright test e2e/accessibility.spec.ts e2e/axe-snapshot.spec.ts --project=chromium --workers=2
  ```

  All green. The second Playwright line covers the CI-`testIgnore`d axe specs — they are local-only (13-of-N rule), so CI will NOT catch an axe violation from the new footer/table; this local run is the only automated gate.

- [ ] **3.12 Live pass (required — suite-invisible regressions have appeared in every tranche).** Start `npm run dev`, then in a real browser check: `/#FRA` — no 'i' rings anywhere; footer reads "Sources: REST Countries · †CIA World Factbook (archived)" with working links; the † superscript on the Government label; "Source by field" expands/collapses the full 16-row table with the chevron flip, also via keyboard (Tab to it, Enter); `/#GNB` — expanded table shows "UN member — manual-override" raw, no dead link, and the UN observer badge shows no broken marker; toggle dark/light — footer, marker, and table legible in both; devtools mobile width (390px) — the collapsed sheet scrolls to the footer and the disclosure works by tap. **Then stop the dev server** — a lingering `npm run dev` poisons later Playwright runs (project memory).

- [ ] **3.13 Commit** (run in the Bash tool):

  ```bash
  cd E:/polworldmap && git add -A && git commit -m "feat(panel): consolidate single-panel attribution into a linked sources footer (D2)

  Deletes the per-field 'i' ring scheme (hover-only, tabIndex=-1 — the
  documented keyboard-unreachable trade-off) and the A4 interim caption
  tooltip; adopts C4's fieldSourceMarkers/SourceMarker for exception
  fields and the compare footer pattern (shared via new SourceLinkList),
  extended with a 'Source by field' disclosure that expands into the
  complete field -> source table. SourceTooltip/FieldLabel and
  @floating-ui/react lose all consumers and are removed. The
  source-tooltip-{edge,keyboard} e2e specs are rewritten as
  single-source-attribution.spec.ts preserving their intent (viewport
  containment, keyboard reachability); playwright.config testMatch and
  CI testIgnore re-anchored; docs/systems + CONTRIBUTING updated. No new
  telemetry.

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

### Task 4: D3 — "Explore next" block below Borders

The single panel currently dead-ends after the Borders chips. This task adds a pure suggestions module (`src/lib/exploreNext.ts`) and an "Explore next" section at the bottom of `SingleCountryPanel`: an inert landlocked/coastal fact chip (the bundled `landlocked` field renders nowhere today), up to 4 same-subregion countries not already in Borders, and one closest-population country. All country chips reuse `BorderChip` and the panel's existing `onSelect` — clicking one flies to that country exactly like a border chip (hash update, history entry, `flyToCountry`). No new handlers.

**Analytics: no new telemetry.** (Stated per the workstream-plan rule.)

**Layout budget (desktop must not scroll for typical countries):** the section adds at most ~130px — a 9px dotted divider, a ~19px label row, and at most three 29px chip rows with 6px gaps at the panel's 360px width (chip count is capped at 6: 1 fact + 4 peers + 1 similar). France renders two chip rows (~100px). At the smallest common desktop viewport (1280×720) the panel envelope is ~640px (`top-16`/`bottom-4`) and France's post-A4/A5 content is ~520px, so the section fits without engaging the panel's `overflow-y-auto`. High-border countries (e.g. Brazil) may scroll — acceptable; the guarantee is "typical countries". Verified in the live pass step below, deliberately NOT pinned in e2e (chip wrap points differ across Linux/Windows font metrics).

**Drift note for the executing engineer:** Tasks earlier in this plan (D1 hero stats, D2 consolidated footer, D4/G1 sheet restructure) also edit `SingleCountryPanel.tsx`. The anchors quoted below are the Borders block and the `showSecondary` fragment tail, which those tasks do not restructure. If D2's consolidated sources footer already renders after Borders when you get there, insert the Explore-next block **between Borders and that footer** (Explore next is content; the footer stays last).

**Files:**

- `src/lib/exploreNext.ts` — new pure module
- `src/lib/__tests__/exploreNext.test.ts` — new unit tests (real-data + synthetic)
- `src/components/BorderChip.tsx` — export inert chip classes; optional `detail` suffix prop
- `src/components/__tests__/BorderChip.test.tsx` — pin the two additions
- `src/components/SingleCountryPanel.tsx` — render the section
- `src/components/__tests__/SingleCountryPanel.test.tsx` — component tests for the section
- `e2e/panel-and-deeplink.spec.ts` — hash-driven e2e addition (already in the chromium `testMatch` — no `playwright.config.ts` change)
- `docs/systems/ui-layout.md` — document the new secondary-content block in the same task

**Interfaces:**

```ts
// src/lib/exploreNext.ts
export const MAX_SUBREGION_PEERS = 4
export interface ExploreNextSuggestions {
  fact: 'Landlocked' | 'Coastal'
  subregionPeers: CountryData[]      // ≤ 4, population desc, ties by cca3 asc
  similarPopulation: CountryData | null
}
export function exploreNext(country: CountryData, all: readonly CountryData[]): ExploreNextSuggestions
export function compactPopulation(n: number): string // "66.4M" register

// src/components/BorderChip.tsx
export const INERT_CHIP_CLASSES: { panel: string; compare: string } // renamed export of the private SPAN_CLASSES
interface Props { /* existing */; detail?: string } // rendered as " · {detail}" after the name
```

Deterministic-order contract (unit-tested): **subregion peers** = same non-empty `subregion`, excluding self and `country.borders`, sorted population **descending** with ties broken by `cca3` **ascending**, capped at 4. **Similar population** = the country minimizing `|Δ population|` over the canonical set excluding self, borders, and the already-suggested peers, ties broken by `cca3` ascending; `null` when no candidate exists.

**Contrast (WCAG, both themes — no new color pairs):** the fact chip reuses the shipped inert border-chip pair — light `sand-600` `#6b6459` on `sand-200` `#f0ebe3` = **4.93:1**, dark `dark-100` `#94a3b8` on `dark-300` `#1e2430` = **6.07:1** (both ≥ 4.5:1 text floor). The section label reuses the Borders label pair (`text-ice-accessible dark:text-ice`, shipped). The `detail` suffix inherits the chip's existing text color (light `ice-accessible` on the near-`sand-50` chip fill = 5.84:1 per the documented C5 math; dark ice on dark ≈ 10.4:1) — no muting, no opacity.

**Steps:**

- [ ] Canonical-owner check before writing any code: run `grep -rn "notation: 'compact'" src/` (or `rg`). On main today there is **no** compact-number formatter (`compareFields.ts`'s `formatPopulation` is the full locale figure — a different register, deliberately not reused). If Task 1 (D1 hero stats) has already landed a shared compact formatter by the time you run this, import that owner instead of defining `compactPopulation` below and adapt the call sites and tests — never two `Intl` compact owners.

- [ ] Write the failing unit test `src/lib/__tests__/exploreNext.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import countriesFile from '../../data/countries.json'
import { CANONICAL_CCA3 } from '../canonicalCountries'
import type { CountriesFile, CountryData } from '../types'
import { makeCountryData } from '../../test/countryFixtures'
import { compactPopulation, exploreNext, MAX_SUBREGION_PEERS } from '../exploreNext'

const canonical = (countriesFile as unknown as CountriesFile).countries.filter((c) =>
  CANONICAL_CCA3.has(c.cca3),
)

function canonicalCountry(cca3: string): CountryData {
  const c = canonical.find((x) => x.cca3 === cca3)
  if (!c) throw new Error(`canonical set is missing ${cca3}`)
  return c
}

describe('exploreNext — real canonical data', () => {
  it('France: Coastal fact; Western Europe peers are exactly [NLD, LIE], population-descending', () => {
    const s = exploreNext(canonicalCountry('FRA'), canonical)
    expect(s.fact).toBe('Coastal')
    // The canonical Western Europe peers minus France's 8 borders leave exactly
    // Netherlands (~18.1M) and Liechtenstein (~41K) — three orders of magnitude
    // apart, so this population-descending pin is stable across data refreshes.
    expect(s.subregionPeers.map((c) => c.cca3)).toEqual(['NLD', 'LIE'])
  })

  it('France: similar-population pick is a non-border, non-suggested country within 3M of France', () => {
    const fra = canonicalCountry('FRA')
    const s = exploreNext(fra, canonical)
    const pick = s.similarPopulation
    if (!pick) throw new Error('expected a similar-population pick')
    expect(pick.cca3).not.toBe('FRA')
    expect(fra.borders).not.toContain(pick.cca3)
    expect(s.subregionPeers.map((c) => c.cca3)).not.toContain(pick.cca3)
    // Range-asserted, not pinned to a country: the 60–70M population cluster
    // (Thailand, UK, Tanzania, South Africa) guarantees a sub-3M delta even as
    // the dataset refreshes. (Today's pick is Thailand, Δ ≈ 0.5M.)
    expect(Math.abs(pick.population - fra.population)).toBeLessThan(3_000_000)
  })

  it('Nigeria: caps at 4 peers, all Western Africa non-borders, population-descending', () => {
    const nga = canonicalCountry('NGA')
    const s = exploreNext(nga, canonical)
    expect(s.subregionPeers).toHaveLength(MAX_SUBREGION_PEERS)
    for (const c of s.subregionPeers) {
      expect(c.subregion).toBe('Western Africa')
      expect(nga.borders).not.toContain(c.cca3)
      expect(c.cca3).not.toBe('NGA')
    }
    const pops = s.subregionPeers.map((c) => c.population)
    expect([...pops].sort((a, b) => b - a)).toEqual(pops)
  })

  it('Switzerland is Landlocked; Japan (zero borders) gets all four Eastern Asia peers', () => {
    expect(exploreNext(canonicalCountry('CHE'), canonical).fact).toBe('Landlocked')
    const jpn = exploreNext(canonicalCountry('JPN'), canonical)
    expect(jpn.fact).toBe('Coastal')
    expect(jpn.subregionPeers.map((c) => c.cca3).sort()).toEqual(['CHN', 'KOR', 'MNG', 'PRK'])
  })
})

describe('exploreNext — determinism and exclusions (synthetic)', () => {
  const self = makeCountryData({
    cca3: 'AAA',
    subregion: 'Testland',
    population: 1_000,
    borders: ['BBB'],
  })
  const mk = (cca3: string, population: number, subregion = 'Testland') =>
    makeCountryData({ cca3, population, subregion, borders: [] })

  it('orders equal-population peers by cca3 ascending and is input-order invariant', () => {
    const pool = [
      self,
      mk('DDD', 500),
      mk('BBB', 500), // border of self — must never be suggested
      mk('CCC', 500),
      mk('EEE', 900),
      mk('FFF', 500),
      mk('GGG', 500, 'Elsewhere'),
    ]
    const forward = exploreNext(self, pool)
    const reversed = exploreNext(self, [...pool].reverse())
    // EEE (900) first, then the 500-tie in cca3 order; BBB excluded (border).
    expect(forward.subregionPeers.map((c) => c.cca3)).toEqual(['EEE', 'CCC', 'DDD', 'FFF'])
    expect(reversed.subregionPeers.map((c) => c.cca3)).toEqual(['EEE', 'CCC', 'DDD', 'FFF'])
    // All four Testland slots are suggested → similar-pop falls to GGG.
    expect(forward.similarPopulation?.cca3).toBe('GGG')
    expect(reversed.similarPopulation?.cca3).toBe('GGG')
  })

  it('similar-population skips already-suggested peers and breaks equal deltas by cca3', () => {
    // CCC (Δ10) is the closest by population but is the suggested Testland
    // peer → skipped. XXX (Δ200) and YYY (Δ200) tie → cca3 ascending → XXX.
    const pool = [self, mk('CCC', 990), mk('YYY', 800, 'Elsewhere'), mk('XXX', 1_200, 'Elsewhere')]
    const s = exploreNext(self, pool)
    expect(s.subregionPeers.map((c) => c.cca3)).toEqual(['CCC'])
    expect(s.similarPopulation?.cca3).toBe('XXX')
  })

  it('empty-subregion guard: never matches other empty subregions; empty pool → null similar', () => {
    // The canonical 195 all carry a subregion today — this pins the guard.
    const bare = makeCountryData({ cca3: 'AAA', subregion: '', population: 1_000, borders: [] })
    const other = makeCountryData({ cca3: 'BBB', subregion: '', population: 900, borders: [] })
    const s = exploreNext(bare, [bare, other])
    expect(s.subregionPeers).toEqual([])
    expect(s.similarPopulation?.cca3).toBe('BBB')
    expect(exploreNext(bare, [bare])).toEqual({
      fact: 'Coastal',
      subregionPeers: [],
      similarPopulation: null,
    })
  })

  it('compactPopulation renders the "66.4M" register', () => {
    expect(compactPopulation(66_351_959)).toBe('66.4M')
    expect(compactPopulation(40_900)).toBe('40.9K')
    expect(compactPopulation(764)).toBe('764')
    expect(compactPopulation(1_416_096_094)).toBe('1.4B')
  })
})
```

- [ ] Run `npx vitest run src/lib/__tests__/exploreNext.test.ts` — expect failure: `Cannot find module '../exploreNext'`.

- [ ] Create `src/lib/exploreNext.ts`:

```ts
import type { CountryData } from './types'

/** D3 — "Explore next" suggestions for the single country panel.
 *
 * Pure derivation over the canonical 195-country set (the panel passes
 * `byCca3.values()`), zero data cost. Deterministic regardless of input
 * order:
 *   - subregion peers: population descending, ties by cca3 ascending
 *   - similar population: smallest |Δ population| excluding self, borders,
 *     and the already-suggested peers; ties by cca3 ascending
 * No telemetry.
 */

export const MAX_SUBREGION_PEERS = 4

export interface ExploreNextSuggestions {
  /** Landlocked/coastal fact — rendered as an inert (non-clickable) chip. */
  fact: 'Landlocked' | 'Coastal'
  /** Up to MAX_SUBREGION_PEERS same-subregion countries (never self/borders). */
  subregionPeers: CountryData[]
  /** Closest-population pick, or null when no candidate exists. */
  similarPopulation: CountryData | null
}

/** "66.4M"-register compact numeral for the similar-population chip detail.
 *  compareFields' formatPopulation is deliberately NOT reused — that is the
 *  full locale figure ("66,351,959"), the wrong register for a chip. */
const COMPACT = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function compactPopulation(n: number): string {
  return COMPACT.format(n)
}

// Plain code-point comparison, NOT localeCompare — locale-independent
// determinism for A–Z cca3 codes.
const byCca3Asc = (a: CountryData, b: CountryData) =>
  a.cca3 < b.cca3 ? -1 : a.cca3 > b.cca3 ? 1 : 0

export function exploreNext(
  country: CountryData,
  all: readonly CountryData[],
): ExploreNextSuggestions {
  const borders = new Set(country.borders)
  const excluded = (c: CountryData) => c.cca3 === country.cca3 || borders.has(c.cca3)

  // Guard: an empty subregion must not match other empty-subregion entries.
  // (Every canonical country carries a subregion today — belt-and-braces.)
  const subregionPeers = !country.subregion
    ? []
    : all
        .filter((c) => !excluded(c) && c.subregion === country.subregion)
        .sort((a, b) => b.population - a.population || byCca3Asc(a, b))
        .slice(0, MAX_SUBREGION_PEERS)

  const suggested = new Set(subregionPeers.map((c) => c.cca3))
  let similarPopulation: CountryData | null = null
  let bestDelta = Infinity
  for (const c of all) {
    if (excluded(c) || suggested.has(c.cca3) || !(c.population > 0)) continue
    const delta = Math.abs(c.population - country.population)
    if (
      delta < bestDelta ||
      (delta === bestDelta && similarPopulation !== null && byCca3Asc(c, similarPopulation) < 0)
    ) {
      bestDelta = delta
      similarPopulation = c
    }
  }

  return {
    fact: country.landlocked ? 'Landlocked' : 'Coastal',
    subregionPeers,
    similarPopulation,
  }
}
```

- [ ] Run `npx vitest run src/lib/__tests__/exploreNext.test.ts` — all green.

- [ ] Commit:

```
git add src/lib/exploreNext.ts src/lib/__tests__/exploreNext.test.ts
git commit -m "feat(panel): pure explore-next suggestions module (D3)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] Write the failing component tests. First, append to `src/components/__tests__/BorderChip.test.tsx` (inside the existing `describe('BorderChip', ...)` block; the file already imports `render, screen`, `vi`, and `makeCountry` — add `INERT_CHIP_CLASSES` to the existing `import { BorderChip } from '../BorderChip'` line):

```tsx
  it('renders an optional detail suffix inside the accessible name (D3)', () => {
    render(
      <BorderChip
        code="THA"
        neighbor={makeCountry({ cca3: 'THA', name: { common: 'Thailand', official: 'Thailand' } })}
        onSelect={() => {}}
        size="panel"
        detail="similar population · 66M"
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Thailand · similar population · 66M' }),
    ).toBeTruthy()
  })

  it('exports the inert chip classes and uses them for unmatched codes (D3 fact-chip reuse)', () => {
    render(<BorderChip code="ESH" neighbor={undefined} onSelect={() => {}} size="panel" />)
    expect(screen.getByText('Western Sahara').className).toBe(INERT_CHIP_CLASSES.panel)
  })
```

- [ ] Then append a new describe block at the end of `src/components/__tests__/SingleCountryPanel.test.tsx` (the file already imports `act, fireEvent, render, within`, `vi`, `makeCountry`, `sources`, and the `CountryData` type; add one import line: `import { INERT_CHIP_CLASSES } from '../BorderChip'`). The dynamically-imported `SingleCountryPanel` from the first describe's `beforeAll` is file-scoped — the existing pattern:

```tsx
describe('SingleCountryPanel — Explore next (D3)', () => {
  // France-shaped fixture: DEU is a border (must appear ONLY in Borders),
  // NLD/LIE are same-subregion non-borders (peers, population-descending),
  // THA (66M vs France's fixture 67M) is the closest-population pick.
  const france = makeCountry({ borders: ['DEU'] })
  const neighbors = [
    makeCountry({
      cca3: 'DEU', ccn3: '276', cca2: 'DE',
      name: { common: 'Germany', official: 'Federal Republic of Germany' },
      population: 83_000_000,
    }),
    makeCountry({
      cca3: 'NLD', ccn3: '528', cca2: 'NL',
      name: { common: 'Netherlands', official: 'Kingdom of the Netherlands' },
      population: 18_000_000,
    }),
    makeCountry({
      cca3: 'LIE', ccn3: '438', cca2: 'LI',
      name: { common: 'Liechtenstein', official: 'Principality of Liechtenstein' },
      population: 40_000, landlocked: true,
    }),
    makeCountry({
      cca3: 'THA', ccn3: '764', cca2: 'TH',
      name: { common: 'Thailand', official: 'Kingdom of Thailand' },
      subregion: 'South-Eastern Asia', population: 66_000_000,
    }),
  ]
  const byCca3 = new Map([france, ...neighbors].map((c) => [c.cca3, c] as const))

  function renderExplore({
    country = france,
    isDesktop = true,
    onSelect = () => {},
  }: {
    country?: CountryData
    isDesktop?: boolean
    onSelect?: (cca3: string) => void
  } = {}) {
    return render(
      <SingleCountryPanel
        country={country}
        comparePickingMode={false}
        sources={sources}
        isDesktop={isDesktop}
        onSelect={onSelect}
        onClose={() => {}}
        onEnterCompare={() => {}}
        onCancelCompare={() => {}}
        byCca3={byCca3}
      />,
    )
  }

  it('renders inert fact chip + subregion peers (no self/borders) + similar-population chip, in order', () => {
    const { getByTestId } = renderExplore()
    const fact = getByTestId('explore-fact-chip')
    expect(fact.textContent).toBe('Coastal')
    // Inert — the unmatched-border-chip precedent: a span, not a button,
    // in the exported inert styling (visually distinct from clickable chips).
    expect(fact.tagName).toBe('SPAN')
    expect(fact.className).toBe(INERT_CHIP_CLASSES.panel)
    const buttons = within(getByTestId('explore-next')).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Netherlands', // 18M — population-descending
      'Liechtenstein', // 40K
      'Thailand · similar population · 66M',
    ])
  })

  it('clicking a suggestion routes through the existing onSelect (same semantics as border chips)', () => {
    const onSelect = vi.fn()
    const { getByTestId } = renderExplore({ onSelect })
    fireEvent.click(within(getByTestId('explore-next')).getByRole('button', { name: 'Netherlands' }))
    expect(onSelect).toHaveBeenCalledWith('NLD')
  })

  it('landlocked countries get the Landlocked fact chip', () => {
    const lie = byCca3.get('LIE')
    if (!lie) throw new Error('fixture missing LIE')
    const { getByTestId } = renderExplore({ country: lie })
    expect(getByTestId('explore-fact-chip').textContent).toBe('Landlocked')
  })

  it('is secondary content: hidden in the collapsed mobile sheet, shown after Expand', () => {
    const { queryByTestId, getByTestId, getByLabelText } = renderExplore({ isDesktop: false })
    expect(queryByTestId('explore-next')).toBeNull()
    fireEvent.click(getByLabelText('Expand panel'))
    expect(getByTestId('explore-next')).toBeTruthy()
  })
})
```

- [ ] Run `npx vitest run src/components/__tests__/BorderChip.test.tsx src/components/__tests__/SingleCountryPanel.test.tsx` — expect failure: `INERT_CHIP_CLASSES` is not exported from `../BorderChip` (module-load error), and `explore-next` testids are absent.

- [ ] Implement `src/components/BorderChip.tsx`. Replace the current `Props` interface and `SPAN_CLASSES` const (quoted from main):

```tsx
interface Props {
  code: string
  neighbor: CountryData | undefined
  onSelect: (cca3: string) => void
  /** 'panel' = SingleCountryPanel sizing (with flag); 'compare' = CountryColumn sizing (no flag). */
  size: 'panel' | 'compare'
}
```

```tsx
const SPAN_CLASSES = {
  panel:
    'px-2.5 py-1.5 text-xs rounded-full bg-sand-200 dark:bg-dark-300 text-sand-600 dark:text-dark-100',
  compare:
    'px-2 py-0.5 text-[11px] rounded-full bg-sand-200 dark:bg-dark-300 text-sand-600 dark:text-dark-100',
} as const
```

with:

```tsx
interface Props {
  code: string
  neighbor: CountryData | undefined
  onSelect: (cca3: string) => void
  /** 'panel' = SingleCountryPanel sizing (with flag); 'compare' = CountryColumn sizing (no flag). */
  size: 'panel' | 'compare'
  /** Optional suffix rendered after the name as " · {detail}" — used by the
   *  panel's similar-population suggestion (D3). Inherits the chip's text
   *  color unchanged (no muting/opacity), so no new contrast pair. */
  detail?: string
}
```

```tsx
/** Inert (non-interactive) chip styling — unmatched border codes here, and
 *  reused by SingleCountryPanel's landlocked/coastal fact chip (D3).
 *  Contrast (both AA): light sand-600 #6b6459 on sand-200 #f0ebe3 = 4.93:1;
 *  dark dark-100 #94a3b8 on dark-300 #1e2430 = 6.07:1. */
export const INERT_CHIP_CLASSES = {
  panel:
    'px-2.5 py-1.5 text-xs rounded-full bg-sand-200 dark:bg-dark-300 text-sand-600 dark:text-dark-100',
  compare:
    'px-2 py-0.5 text-[11px] rounded-full bg-sand-200 dark:bg-dark-300 text-sand-600 dark:text-dark-100',
} as const
```

Then update the component body — replace (quoted from main):

```tsx
export function BorderChip({ code, neighbor, onSelect, size }: Props) {
  if (!neighbor) {
    return <span className={SPAN_CLASSES[size]}>{nonSelectableNeighborName(code) ?? code}</span>
  }
  return (
    <button onClick={() => onSelect(code)} className={BUTTON_CLASSES[size]}>
      {size === 'panel' && (
        <img src={neighbor.flag} alt="" className="w-4 h-3 object-cover rounded-sm shrink-0" />
      )}
      {neighbor.name.common}
    </button>
  )
}
```

with:

```tsx
export function BorderChip({ code, neighbor, onSelect, size, detail }: Props) {
  if (!neighbor) {
    return (
      <span className={INERT_CHIP_CLASSES[size]}>{nonSelectableNeighborName(code) ?? code}</span>
    )
  }
  return (
    <button onClick={() => onSelect(code)} className={BUTTON_CLASSES[size]}>
      {size === 'panel' && (
        <img src={neighbor.flag} alt="" className="w-4 h-3 object-cover rounded-sm shrink-0" />
      )}
      {neighbor.name.common}
      {detail !== undefined && <span>{` · ${detail}`}</span>}
    </button>
  )
}
```

- [ ] Implement the panel section in `src/components/SingleCountryPanel.tsx`. Three edits.

  (1) Imports — the file currently opens with (quoted from main; if an earlier task reshuffled the import block, apply the same three changes wherever these lines now sit):

```tsx
import { useEffect, useRef, useState } from 'react'
import type { CountryData, CountriesFile } from '../lib/types'
import { BorderChip } from './BorderChip'
```

  becomes:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CountryData, CountriesFile } from '../lib/types'
import { BorderChip, INERT_CHIP_CLASSES } from './BorderChip'
import { compactPopulation, exploreNext } from '../lib/exploreNext'
```

  (2) Derive suggestions — after (quoted from main):

```tsx
  const [expanded, setExpanded] = useState(false)
  const showSecondary = isDesktop || expanded
```

  add:

```tsx
  // D3: derived purely from the bundled canonical set (byCca3 is the
  // canonical-195 lookup the panel already receives) — zero data cost.
  const suggestions = useMemo(
    () => exploreNext(country, Array.from(byCca3.values())),
    [country, byCca3],
  )
```

  (3) The section — the `showSecondary` fragment currently ends with the Borders block (quoted from main):

```tsx
                  </div>
                </div>
              </>
            )}
          </>
        )}
```

  Insert the Explore-next block after the Borders conditional's closing `)}`, still inside the `showSecondary` fragment (if D2's consolidated sources footer is already rendered there, place this block between Borders and the footer):

```tsx
                  </div>
                </div>
              </>
            )}

            <div className="my-2 border-t border-dotted border-sand-300/50 dark:border-dark-200/30" />
            {/* D3 — Explore next: landlocked/coastal fact + same-subregion
                peers + closest-population pick. Suggestions are derived data
                (no single source field), so no per-chip attribution; the
                `landlocked` field's source stays reachable via the
                consolidated footer's field → source table (D2). Unlike
                Borders, this renders for every country (Japan has no borders
                but still gets peers + similar-population). */}
            <div className="panel-field-in-3" data-testid="explore-next">
              {/* Mirrors the Borders FieldLabel styling minus the source
                  affordance (derived data); migrates to .text-label whenever
                  FieldLabel does. */}
              <div className="text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice mb-2">
                Explore next
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span data-testid="explore-fact-chip" className={INERT_CHIP_CLASSES.panel}>
                  {suggestions.fact}
                </span>
                {suggestions.subregionPeers.map((c) => (
                  <BorderChip
                    key={c.cca3}
                    code={c.cca3}
                    neighbor={c}
                    onSelect={onSelect}
                    size="panel"
                  />
                ))}
                {suggestions.similarPopulation && (
                  <BorderChip
                    code={suggestions.similarPopulation.cca3}
                    neighbor={suggestions.similarPopulation}
                    onSelect={onSelect}
                    size="panel"
                    detail={`similar population · ${compactPopulation(
                      suggestions.similarPopulation.population,
                    )}`}
                  />
                )}
              </div>
            </div>
          </>
        )}
```

- [ ] Run `npx vitest run src/components/__tests__/BorderChip.test.tsx src/components/__tests__/SingleCountryPanel.test.tsx` — all green (including every pre-existing test in both files: the A4+A5, C5, A7, focus, and animation-lifecycle blocks must stay green — they pass `byCca3: new Map()`, which now renders a fact-chip-only section; none of their queries collide with it).

- [ ] Add the e2e test to `e2e/panel-and-deeplink.spec.ts`, inside `test.describe('Country Panel', ...)`, directly after this existing test (quoted from main):

```ts
  test('panel shows government type from CIA Factbook', async ({ page }) => {
    const panel = await openPanel(page, 'FRA', 'France')
    await expect(panel).toContainText('Government')
    await expect(panel).toContainText('semi-presidential republic')
  })
```

  Append (hash-driven via the file's existing `openPanel` helper — no UI click chain to reach the state, one click to assert navigation; no text-wrap assumptions, so it is robust to Linux font metrics):

```ts
  test('explore-next suggests non-border countries and one chip click navigates', async ({
    page,
  }) => {
    const panel = await openPanel(page, 'FRA', 'France')
    const explore = panel.getByTestId('explore-next')
    // France is coastal; the fact chip is inert (a span, not a button).
    await expect(explore.getByTestId('explore-fact-chip')).toHaveText('Coastal')
    // Netherlands is a Western-Europe peer that is NOT a France border —
    // exactly what distinguishes Explore next from the Borders block above it.
    // Deterministic from real data: NLD/LIE are the only such canonical peers.
    await explore.getByRole('button', { name: 'Netherlands' }).click()
    await expect
      .poll(() => page.evaluate(() => window.location.hash), { timeout: 10_000 })
      .toBe('#NLD')
    await expect(panel).toContainText('Netherlands')
  })
```

- [ ] Kill any stray dev servers first (project memory: a background `npm run dev` gets reused by Playwright without `VITE_TEST_HOOKS`), then run `npx playwright test e2e/panel-and-deeplink.spec.ts e2e/panel-focus.spec.ts --project=chromium --workers=2` — all green. (`panel-and-deeplink.spec.ts` is already in the chromium `testMatch`; `panel-focus.spec.ts` is included as the invalidation check — the section adds focusables at the panel's end, and this run proves the focus-on-open contract is unaffected. No other spec pins the panel's tail: `mobile-panel-header` measures only the header, `a11y-contrast` has no chip pins, and the peek-state sentinel is `Currencies`, which stays hidden-when-collapsed.)

- [ ] Update `docs/systems/ui-layout.md` in this same commit (staleness rule). In "Information Displayed → **Secondary**", after the existing bullet (quoted from main):

```
- Neighboring countries (clickable chips). Clicking a border chip selects that country — same as clicking it on the map. The map flies to the new country via `flyToCountry()`, the panel transitions to show its data, and the URL hash updates. Each chip click creates a new history entry, so browser Back returns to the previous country. If a border code has no match in `countries.json`, the chip is displayed but not clickable.
```

  append:

```
- "Explore next" suggestions (`src/lib/exploreNext.ts`, D3): an inert landlocked/coastal fact chip (same styling as non-clickable border chips), up to four same-subregion countries not already in Borders (population-descending, ties by cca3 ascending), and one closest-population country (excluding self, borders, and the subregion picks; ties by cca3 ascending) with a "· similar population · 66.4M"-style suffix. The country chips are `BorderChip`s wired to the same `onSelect` as border chips — identical fly-to/hash/history semantics. Renders for every country (unlike Borders, which needs `borders.length > 0`); computed client-side from the canonical 195 set; no telemetry.
```

- [ ] Run `npm run check` — green (typecheck, lint incl. eslint-plugin-playwright, full unit suite).

- [ ] Live pass (real regressions have been suite-invisible in every tranche): `npm run dev`, then verify in a browser — (a) `/#FRA` at 1280×720 desktop, both themes: "Explore next" sits below Borders with Coastal + Netherlands + Liechtenstein + the Thailand similar-population chip, and the panel shows **no vertical scrollbar** (the stated layout budget); (b) `/#CHE`: fact chip reads "Landlocked"; (c) `/#JPN`: section renders despite zero borders; (d) 390px mobile: collapsed sheet does NOT show the section, expanding reveals it, chips are comfortably tappable; (e) click the Netherlands chip — camera flies, hash becomes `#NLD`, browser Back returns to France. **Kill the dev server when done** (it breaks subsequent e2e runs).

- [ ] Commit:

```
git add src/components/BorderChip.tsx src/components/SingleCountryPanel.tsx src/components/__tests__/BorderChip.test.tsx src/components/__tests__/SingleCountryPanel.test.tsx e2e/panel-and-deeplink.spec.ts docs/systems/ui-layout.md
git commit -m "feat(panel): Explore next section below Borders (D3)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 5: G1 — Sheet fundamentals for the single panel (dvh, safe-area, grabber)

The compare sheet already moved to `dvh` in C6; the single panel's mobile bottom sheet still uses `h-[40vh]`/`h-[80vh]`, its scroll container ignores the iOS home indicator, and its only expand affordance is the small chevron. This task ships the single grabber implementation that Task 6 (D4) consumes.

**No new telemetry** — this task adds no `track()` events.

**Files:**

- `src/lib/layoutConstants.ts` — add `TOUCH_TARGET_FROM_20`; fix two stale docstrings
- `src/lib/__tests__/layoutConstants.test.ts` — re-anchor the `vh` pin to `dvh` in the same commit; new G1 pins
- `src/components/SingleCountryPanel.tsx` — dvh heights, `pb-[env(safe-area-inset-bottom)]`, grabber, chevron `aria-expanded`
- `src/components/__tests__/SingleCountryPanel.test.tsx` — grabber/chevron component tests
- `index.html` — `viewport-fit=cover` (without it, `env(safe-area-inset-bottom)` is always 0 on iOS)
- `e2e/mobile-panel-header.spec.ts` — grabber e2e case
- `docs/systems/ui-layout.md`, `docs/systems/accessibility.md` — staleness fixed in the same task

**Interfaces:**

- `export const TOUCH_TARGET_FROM_20: string` in `src/lib/layoutConstants.ts` — value `` `relative ${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-3` `` (20px visual box + 2·12 = 44px, A13 math)
- Grabber: `<button type="button" data-testid="sheet-grabber" aria-hidden="true" tabIndex={-1}>` — pointer-only affordance, mobile branch only, wired to the SAME `setExpanded(!expanded)` the chevron drives
- Chevron: keeps `aria-label={expanded ? 'Collapse panel' : 'Expand panel'}` (it does NOT have `aria-expanded` today — verified against main) and gains `aria-expanded={expanded}`
- `data-animation-state` continuity: untouched. The sheet's `transition-[height] duration-200` has never fed the attribute (the effect in `SingleCountryPanel.tsx` runs on mount only); the grabber adds no new DOM animation, so `waitForAnimationIdle` keeps meaning "entrance settled".

**Steps:**

- [ ] **Write the failing drift-alarm pins.** In `src/lib/__tests__/layoutConstants.test.ts`, extend the import block (add `TOUCH_TARGET_FROM_20` to the existing `from '../layoutConstants'` list, and add a raw import below `indexCssSource`):

  ```ts
  import indexHtmlSource from '../../../index.html?raw'
  ```

  Replace the current first pin test:

  ```ts
  it('SingleCountryPanel width/inset/sheet classes match the constants', () => {
    expect(singleCountryPanelSource).toContain(`w-[${SINGLE_PANEL_FOOTPRINT_PX - 16}px]`) // 376 - right-4 inset
    expect(singleCountryPanelSource).toContain('right-4')
    expect(singleCountryPanelSource).toContain(`h-[${SHEET_COLLAPSED_FRACTION * 100}vh]`) // collapsed sheet
  })
  ```

  with:

  ```ts
  it('SingleCountryPanel width/inset/sheet classes match the constants', () => {
    expect(singleCountryPanelSource).toContain(`w-[${SINGLE_PANEL_FOOTPRINT_PX - 16}px]`) // 376 - right-4 inset
    expect(singleCountryPanelSource).toContain('right-4')
    // G1: dvh, not vh — the sheet and panelScreenOffset's innerHeight-based
    // camera math must agree as mobile browser toolbars collapse (the same
    // rule the compare sheet adopted in C6).
    expect(singleCountryPanelSource).toContain(`h-[${SHEET_COLLAPSED_FRACTION * 100}dvh]`) // collapsed sheet
    expect(singleCountryPanelSource).toContain('h-[80dvh]') // expanded sheet
  })
  ```

  and append a new top-level describe at the end of the file:

  ```ts
  describe('G1 sheet fundamentals drift alarm', () => {
    it('the sheet scroll container reserves the home-indicator inset and index.html opts into it', () => {
      // env(safe-area-inset-bottom) resolves to 0 unless the viewport meta
      // declares viewport-fit=cover — pin both halves so neither silently
      // breaks the other.
      expect(singleCountryPanelSource).toContain('pb-[env(safe-area-inset-bottom)]')
      expect(indexHtmlSource).toContain('viewport-fit=cover')
    })

    it('sheet grabber: TOUCH_TARGET_FROM_20 pins the A13 inset math and its consumer', () => {
      // 20px grabber visual box (py-2 = 2·8px + h-1 bar = 4px): 20 + 2·12 = 44.
      expect(TOUCH_TARGET_FROM_20).toBe(
        `relative ${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-3`,
      )
      expect(singleCountryPanelSource).toContain('TOUCH_TARGET_FROM_20')
      expect(singleCountryPanelSource).toContain('sheet-grabber')
      // Base sizes the inset math assumes.
      expect(singleCountryPanelSource).toContain('h-1 w-9')
    })
  })
  ```

- [ ] **Run and confirm the failure:** `npx vitest run src/lib/__tests__/layoutConstants.test.ts` — expect a module error on `TOUCH_TARGET_FROM_20` (not exported yet) or, once past imports, the `dvh` / `pb-[env(...)]` / `sheet-grabber` `toContain` assertions failing.

- [ ] **Write the failing component tests.** In `src/components/__tests__/SingleCountryPanel.test.tsx`, extend the layoutConstants import:

  ```ts
  import { TOUCH_TARGET_FROM_36, TOUCH_TARGET_FROM_20 } from '../../lib/layoutConstants'
  ```

  and append a new describe (same plain render/fireEvent pattern as the C5 describe — no fake timers needed):

  ```tsx
  describe('SingleCountryPanel — mobile sheet grabber (G1)', () => {
    function renderAt(isDesktop: boolean) {
      return render(
        <SingleCountryPanel
          country={makeCountry()}
          comparePickingMode={false}
          sources={sources}
          isDesktop={isDesktop}
          onSelect={() => {}}
          onClose={() => {}}
          onEnterCompare={() => {}}
          onCancelCompare={() => {}}
          byCca3={new Map()}
        />,
      )
    }

    it('mobile: grabber is a pointer-only affordance wired to the same expand toggle as the chevron', () => {
      const { getByTestId, getByLabelText, getByText, queryByText } = renderAt(false)
      const grabber = getByTestId('sheet-grabber')
      // Pointer-only: the chevron is the labeled control. aria-hidden on a
      // focusable element is an axe violation (aria-hidden-focus), hence
      // tabIndex=-1 removing it from the tab order.
      expect(grabber.getAttribute('aria-hidden')).toBe('true')
      expect(grabber.getAttribute('tabindex')).toBe('-1')
      expect(grabber.className).toContain(TOUCH_TARGET_FROM_20)
      // Collapsed peek state: secondary fields hidden (Timezones renders
      // unconditionally once showSecondary is true — stable sentinel).
      expect(queryByText('Timezones')).toBeNull()
      fireEvent.click(grabber)
      expect(getByText('Timezones')).toBeTruthy()
      // The chevron reflects the state the grabber set — one shared toggle.
      expect(getByLabelText('Collapse panel').getAttribute('aria-expanded')).toBe('true')
    })

    it('mobile: chevron exposes aria-expanded and still toggles', () => {
      const { getByLabelText } = renderAt(false)
      const chevron = getByLabelText('Expand panel')
      expect(chevron.getAttribute('aria-expanded')).toBe('false')
      fireEvent.click(chevron)
      expect(getByLabelText('Collapse panel').getAttribute('aria-expanded')).toBe('true')
    })

    it('desktop: no grabber renders', () => {
      const { queryByTestId } = renderAt(true)
      expect(queryByTestId('sheet-grabber')).toBeNull()
    })
  })
  ```

- [ ] **Run and confirm the failure:** `npx vitest run src/components/__tests__/SingleCountryPanel.test.tsx` — expect the three new tests failing (`Unable to find an element by: [data-testid="sheet-grabber"]`, `aria-expanded` null).

- [ ] **Implement `src/lib/layoutConstants.ts`.** Replace the stale docstring

  ```ts
  /** Mobile bottom sheet, collapsed single-country state: h-[40vh]. */
  export const SHEET_COLLAPSED_FRACTION = 0.4
  ```

  with

  ```ts
  /** Mobile bottom sheet, collapsed single-country state: h-[40dvh] (G1). */
  export const SHEET_COLLAPSED_FRACTION = 0.4
  ```

  Replace

  ```ts
  /** Mobile compare sheet: h-[80dvh] (C6). The single panel's expanded sheet
   *  stays h-[80vh] until G1's dvh switch (workstream D's plan). */
  export const COMPARE_SHEET_FRACTION = 0.8
  ```

  with

  ```ts
  /** Mobile compare sheet: h-[80dvh] (C6). The single panel's expanded sheet
   *  is h-[80dvh] too since G1's dvh switch. */
  export const COMPARE_SHEET_FRACTION = 0.8
  ```

  Add after `TOUCH_TARGET_FROM_32`:

  ```ts
  /** 20px mobile sheet grabber (SingleCountryPanel: py-2 (2·8px) + h-1 bar
   *  (4px) = 20px): 20 + 2·12 = 44. G1's pointer-first expand affordance —
   *  the chevron stays the labeled control, but the grabber is what fingers
   *  actually aim for, so it gets the full A13 coarse-pointer floor. */
  export const TOUCH_TARGET_FROM_20 = `relative ${TOUCH_TARGET_BASE} pointer-coarse:after:-inset-3`
  ```

- [ ] **Implement `src/components/SingleCountryPanel.tsx`.** Four edits.

  (1) Import — replace

  ```ts
  import { TOUCH_TARGET_FROM_36, TOUCH_TARGET_FROM_22 } from '../lib/layoutConstants'
  ```

  with

  ```ts
  import {
    TOUCH_TARGET_FROM_36,
    TOUCH_TARGET_FROM_22,
    TOUCH_TARGET_FROM_20,
  } from '../lib/layoutConstants'
  ```

  (2) Sheet classes — replace the mobile branch of `panelClasses`:

  ```ts
    : `fixed bottom-0 left-0 right-0 bg-sand-50 dark:bg-dark-400 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 overflow-y-auto rounded-t-2xl transition-[height] duration-200 ${
        expanded ? 'h-[80vh]' : 'h-[40vh]'
      }`
  ```

  with

  ```ts
    : // G1: dvh (not vh) so the sheet tracks the visual viewport as mobile
      // browser toolbars collapse — same rule as the compare sheet (C6) and
      // the innerHeight-based camera math in layoutConstants. The panel root
      // IS the scroll container, so the safe-area padding lands here:
      // content scrolls clear of the iOS home indicator (requires
      // viewport-fit=cover in index.html).
      `fixed bottom-0 left-0 right-0 bg-sand-50 dark:bg-dark-400 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)] transition-[height] duration-200 ${
        expanded ? 'h-[80dvh]' : 'h-[40dvh]'
      }`
  ```

  (3) Grabber — insert as the FIRST child of the sticky header, i.e. directly after the line

  ```tsx
      <div className="sticky top-0 bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-md px-5 py-4 z-10">
  ```

  add:

  ```tsx
        {!isDesktop && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            data-testid="sheet-grabber"
            // G1: pointer-only expand affordance — the chevron stays the
            // labeled control (aria-label + aria-expanded). aria-hidden on a
            // focusable element violates axe's aria-hidden-focus rule, hence
            // tabIndex={-1}. Visual box: py-2 (2·8px) + h-1 bar (4px) = 20px;
            // TOUCH_TARGET_FROM_20 grows the coarse-pointer hit area to 44px.
            // Bar contrast (3:1 non-text floor, both themes): sand-500
            // #8c8578 on sand-50 #fefdfb = 3.6:1; dark-100 #94a3b8 on
            // dark-400 #161a22 = 6.8:1.
            aria-hidden="true"
            tabIndex={-1}
            className={`w-full flex justify-center py-2 -mt-2 mb-1 ${TOUCH_TARGET_FROM_20}`}
          >
            <span className="h-1 w-9 rounded-full bg-sand-500 dark:bg-dark-100" />
          </button>
        )}
  ```

  (4) Chevron — replace

  ```tsx
              <button
                onClick={() => setExpanded(!expanded)}
                className={`p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-600 dark:text-dark-100 transition-colors ${TOUCH_TARGET_FROM_36}`}
                aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
              >
  ```

  with

  ```tsx
              <button
                onClick={() => setExpanded(!expanded)}
                className={`p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-600 dark:text-dark-100 transition-colors ${TOUCH_TARGET_FROM_36}`}
                aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
                aria-expanded={expanded}
              >
  ```

- [ ] **Implement `index.html`.** Replace

  ```html
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ```

  with

  ```html
      <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  ```

  (`user-scalable` is untouched — A2 established that `user-scalable=no` violates WCAG 1.4.4.)

- [ ] **Run green:** `npx vitest run src/lib/__tests__/layoutConstants.test.ts src/components/__tests__/SingleCountryPanel.test.tsx src/components/__tests__/SingleCountryPanel.focus.test.tsx` — all pass (the focus spec is included because it renders the same component; it pins nothing this task moves, verified against main).

- [ ] **Add the e2e case.** Append to `e2e/mobile-panel-header.spec.ts` (outside the `WIDTHS` loop; `gotoAndWaitForMap` and `waitForAnimationIdle` are already imported):

  ```ts
  test.describe('Sheet grabber (G1) at 390×844', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('grabber expands the sheet and the chevron reflects the state', async ({ page }) => {
      await gotoAndWaitForMap(page, '/#FRA')
      const panel = page.getByTestId('country-panel')
      await expect(panel).toBeVisible({ timeout: 15_000 })
      await waitForAnimationIdle(panel)

      // Collapsed: 40dvh of 844 ≈ 338px (dvh === vh in an emulated viewport).
      await expect
        .poll(async () => (await panel.boundingBox())?.height ?? 0)
        .toBeLessThan(844 * 0.5)
      await expect(page.getByLabel('Expand panel')).toHaveAttribute('aria-expanded', 'false')

      await page.getByTestId('sheet-grabber').click()

      // Expanded: 80dvh ≈ 675px. expect.poll rides out the height transition
      // (collapsed to ~0ms by this project's reducedMotion baseline — but
      // never assume wallclock).
      await expect
        .poll(async () => (await panel.boundingBox())?.height ?? 0)
        .toBeGreaterThan(844 * 0.7)
      await expect(page.getByLabel('Collapse panel')).toHaveAttribute('aria-expanded', 'true')
    })
  })
  ```

  Assertions are geometry- and attribute-based — no font-metric or wrap-point assumptions, per the tranche lesson on Linux CI font metrics. CI-coverage note: `mobile-panel-header.spec.ts` runs in the CI `chromium` project (viewport-emulated, not in its `testIgnore` list), so this case IS CI-covered; the device-emulating mobile projects (`mobile-chromium`, `mobile-webkit`, `desktop-firefox-touch`) do not run this spec and are local-only regardless.

- [ ] **Run the e2e spec.** First kill any stray dev server (project memory: Playwright's `reuseExistingServer` would reuse it without `VITE_TEST_HOOKS`), then: `npx playwright test e2e/mobile-panel-header.spec.ts --project=chromium --workers=2` — all pass, including the pre-existing width-loop tests (the grabber adds ~20px to the sticky header; the loop's assertions are truncation- and reachability-based and unaffected).

- [ ] **Fix the stale docs in the same task.** In `docs/systems/ui-layout.md`: change the diagram line `│  (peek: 40vh / full: 80vh)` to `│  (peek: 40dvh / full: 80dvh)`; replace the bullet

  ```
  - Two interactive states: **peek** (40% viewport height) and **full** (80% viewport height). These are starting values — adjust during implementation based on content fit and device testing.
  - Expand/collapse button (chevron) at the top toggles between states — accessible via keyboard and pointer
  ```

  with

  ```
  - Two interactive states: **peek** (`40dvh`) and **full** (`80dvh`) — `dvh` so the sheet tracks the visual viewport as mobile browser toolbars collapse (G1)
  - Expand/collapse: a visible grabber bar at the sheet top (pointer-only, `aria-hidden` + `tabIndex={-1}`, 44px coarse-pointer hit area via `TOUCH_TARGET_FROM_20`) and the labeled chevron button (`aria-expanded`) drive the same toggle (G1)
  - The sheet's scroll container reserves `env(safe-area-inset-bottom)` so content clears the iOS home indicator (`viewport-fit=cover` in `index.html`)
  ```

  In `docs/systems/accessibility.md`, replace the row

  ```
  | Enter / Space (on expand button) | Toggle between peek (40vh) and full (80vh) states |
  ```

  with

  ```
  | Enter / Space (on expand button) | Toggle between peek (40dvh) and full (80dvh) states — the chevron exposes `aria-expanded`; the visible grabber bar is a pointer-only duplicate (`aria-hidden`, out of the tab order) |
  ```

- [ ] **Full gate:** `npm run check` — green (lint mechanizes the waitForTimeout/force-click bans; the typecheck catches any constant-name typo).

- [ ] **Live pass (budgeted — has caught suite-invisible regressions in every tranche).** `npm run dev`, open at 390px device emulation, both themes: select a country → grabber bar visible and legible on light AND dark; tap grabber → sheet expands; tap again → collapses; chevron still works; with iPhone-with-home-indicator emulation, scroll the expanded sheet to the bottom — content clears the indicator band. Kill the dev server afterwards (project memory: e2e conflicts).

- [ ] **Commit:**

  ```
  git add src/lib/layoutConstants.ts src/lib/__tests__/layoutConstants.test.ts src/components/SingleCountryPanel.tsx src/components/__tests__/SingleCountryPanel.test.tsx index.html e2e/mobile-panel-header.spec.ts docs/systems/ui-layout.md docs/systems/accessibility.md
  git commit -m "feat(panel): dvh sheet heights, safe-area inset, and expand grabber (G1)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6: D4 — Mobile sheet header restructure + compare chip + compare tip on mobile

The collapsed 40dvh sheet currently spends a full stacked row (`flex flex-col items-stretch gap-2`) on four icon buttons. This task inlines the actions (flag + name left; share + chevron + close right), moves compare to a labeled chip below the prime grid (C5's scope split), and keeps D1's hero stats above the fold in the collapsed sheet. It then enables the compare tip on mobile.

**Decision (specified, per the D4 design note):** the compare tip's hint gate was deliberately left unburned on mobile by C5. Now that the labeled chip exists on mobile, the tip IS enabled there: same second-distinct-selection rule, and the `isDesktop` gate is removed from `useFirstVisitHint` entirely (the parameter goes away — remove-obsolete rule; the localStorage gate still caps it at once per browser, ever).

**Task 2 seam (D1 hero row):** Task 2 ships the hero stats row as `<div data-testid="hero-stats" …>` rendered as the FIRST child of the panel body (`<div className="px-5 py-3">`), outside the `showSecondary` gate — so it is present in the collapsed mobile sheet. This task consumes only that testid and placement. If Task 2 landed with a different testid, re-anchor the e2e locator below to Task 2's actual testid before writing it — do not duplicate the row.

**No new telemetry** — this task adds no `track()` events (C5's "compare entry" analytics candidate remains explicitly unclaimed).

**Files:**

- `src/components/SingleCountryPanel.tsx` — inline mobile header, desktop-gate the header pill, mobile chip below the grid
- `src/components/__tests__/SingleCountryPanel.test.tsx` — replace the obsolete C5 icon-only mobile test; new D4 tests
- `e2e/mobile-panel-header.spec.ts` — re-anchor the docblock/comments; new D4 describe (chip + hero visibility)
- `src/hooks/useFirstVisitHint.ts`, `src/hooks/__tests__/useFirstVisitHint.test.tsx`, `src/App.tsx` — drop the `isDesktop` gate
- `docs/systems/ui-layout.md` — staleness fixed in the same task

**Interfaces:**

- Mobile compare chip: same `data-testid="compare-entry"`, same `aria-label="Compare with another country"` as the desktop pill (only one of the two renders — branched on `isDesktop`), rendered between the prime grid and the `showSecondary` block, hidden while `comparePickingMode || inGameRound` (unchanged gating)
- `useFirstVisitHint` signature change: the `isDesktop: boolean` param is REMOVED — new params object is `{ mapReady, selectedCca3, gameActive, compareActive }`. `App.tsx` keeps its `isDesktop` variable (still used by the panel props at lines 436/453)
- Grabber from Task 5 is consumed as-is (primary coarse-pointer expand affordance); no changes to it here

**Steps:**

- [ ] **Write the failing component tests.** In `src/components/__tests__/SingleCountryPanel.test.tsx`, inside the C5 describe, replace the obsolete mobile test (delete superseded tests in the same change):

  ```tsx
  it('mobile: the entry stays icon-only (D4 owns the mobile labeled chip)', () => {
    const { getByRole } = renderAt(false)
    const btn = getByRole('button', { name: 'Compare with another country' })
    expect(btn.textContent).toBe('')
    expect(btn.className).toContain('p-2 rounded-xl')
    expect(btn.className).toContain(TOUCH_TARGET_FROM_36)
  })
  ```

  with:

  ```tsx
  it('mobile: labeled chip below the grid, not in the sticky header (D4)', () => {
    const { getByRole } = renderAt(false)
    const btn = getByRole('button', { name: 'Compare with another country' })
    expect(btn.textContent).toBe('Compare')
    expect(btn.getAttribute('data-testid')).toBe('compare-entry')
    expect(btn.className).toContain(TOUCH_TARGET_FROM_36)
    // Below the grid: the chip lives in the scroll body — the sticky header
    // carries only flag/name (left) and share/expand/close (right).
    expect(btn.closest('.sticky')).toBeNull()
  })

  it('desktop: the pill still lives in the sticky header', () => {
    const { getByRole } = renderAt(true)
    expect(
      getByRole('button', { name: 'Compare with another country' }).closest('.sticky'),
    ).not.toBeNull()
  })
  ```

  Then append a new describe:

  ```tsx
  describe('SingleCountryPanel — mobile inline header (D4)', () => {
    function renderMobile(props: { comparePickingMode?: boolean; inGameRound?: boolean } = {}) {
      return render(
        <SingleCountryPanel
          country={makeCountry()}
          comparePickingMode={props.comparePickingMode ?? false}
          sources={sources}
          isDesktop={false}
          onSelect={() => {}}
          onClose={() => {}}
          onEnterCompare={() => {}}
          onCancelCompare={() => {}}
          byCca3={new Map()}
          inGameRound={props.inGameRound ?? false}
        />,
      )
    }

    it('flag/name and the action cluster share one row — no stacked flex-col header', () => {
      const { getByTestId } = renderMobile()
      // country-flag's parent is the flag+name block; ITS parent is the header row.
      const row = getByTestId('country-flag').parentElement!.parentElement!
      expect(row.className).toContain('justify-between')
      expect(row.className).not.toContain('flex-col')
    })

    it('the header action cluster is share + expand + close — compare moved out', () => {
      const { getByTestId } = renderMobile()
      const cluster = getByTestId('panel-close').parentElement!
      const labels = Array.from(cluster.children)
        .filter((el) => el.tagName === 'BUTTON')
        .map((el) => el.getAttribute('aria-label'))
      expect(labels).toEqual(['Copy link to this country', 'Expand panel', 'Close panel'])
    })

    it('no compare chip while picking or during a game round', () => {
      const picking = renderMobile({ comparePickingMode: true })
      expect(picking.queryByTestId('compare-entry')).toBeNull()
      picking.unmount()
      const inRound = renderMobile({ inGameRound: true })
      expect(inRound.queryByTestId('compare-entry')).toBeNull()
    })
  })
  ```

- [ ] **Run and confirm the failure:** `npx vitest run src/components/__tests__/SingleCountryPanel.test.tsx` — the replaced C5 test now expects `'Compare'` text on mobile (currently `''`), and the D4 describe fails on `flex-col` / cluster ordering.

- [ ] **Implement `src/components/SingleCountryPanel.tsx`.** Four edits.

  (1) Header row — replace

  ```tsx
          <div
            className={
              isDesktop
                ? 'flex flex-wrap items-start justify-between gap-x-3 gap-y-2'
                : 'flex flex-col items-stretch gap-2'
            }
          >
  ```

  with

  ```tsx
          {/* D4: one inline header row on every viewport — flag + name left,
              actions right. The old mobile branch stacked a full actions row
              (flex-col), spending a row of the 40dvh peek sheet that D1's
              hero stats now use. */}
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
  ```

  (2) Action cluster — replace

  ```tsx
            <div className={`flex items-center gap-1 ${isDesktop ? 'shrink-0' : 'flex-wrap'}`}>
  ```

  with

  ```tsx
            <div className="flex items-center gap-1 shrink-0">
  ```

  (3) Compare entry — replace the whole header compare button block

  ```tsx
              {!comparePickingMode && !inGameRound && (
                <button
                  onClick={onEnterCompare}
                  data-testid="compare-entry"
                  // C5: desktop gets an icon + text pill (the 20px hover-title-only
                  // icon was the least discoverable control in the audit); mobile
                  // keeps the icon — D4 owns the sheet's labeled compare chip.
                  // Desktop pill box: py-2 (2·8px) + 20px icon/text-sm line = 36px,
                  // so TOUCH_TARGET_FROM_36 keeps the A13 44px coarse-pointer math
                  // honest on both branches. Text contrast (4.5:1 floor): ice-dim
                  // #0369a1 on sand-50 #fefdfb = 5.84:1; ice #7dd3fc on dark-400
                  // #161a22 = 10.4:1. aria-label preserved — it overrides content,
                  // so existing e2e locators and WCAG 2.5.3 both hold.
                  className={`${
                    isDesktop
                      ? 'flex items-center gap-1.5 px-3 py-2 rounded-full border border-ice-dim/30 dark:border-ice/30 text-sm font-medium'
                      : 'p-2 rounded-xl'
                  } hover:bg-sand-200 dark:hover:bg-dark-300 text-ice-dim dark:text-ice transition-colors ${TOUCH_TARGET_FROM_36}`}
                  aria-label="Compare with another country"
                  title="Compare"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="9" cy="12" r="6" strokeWidth="1.75" />
                    <circle cx="15" cy="12" r="6" strokeWidth="1.75" />
                  </svg>
                  {isDesktop && <span>Compare</span>}
                </button>
              )}
  ```

  with the desktop-only pill:

  ```tsx
              {isDesktop && !comparePickingMode && !inGameRound && (
                <button
                  onClick={onEnterCompare}
                  data-testid="compare-entry"
                  // C5 desktop pill (the 20px hover-title-only icon was the
                  // least discoverable control in the audit); D4 moved the
                  // mobile entry to a labeled chip below the prime grid.
                  // Pill box: py-2 (2·8px) + 20px icon/text-sm line = 36px →
                  // TOUCH_TARGET_FROM_36 keeps the A13 44px math honest.
                  // Text contrast (4.5:1 floor): ice-dim #0369a1 on sand-50
                  // #fefdfb = 5.84:1; ice #7dd3fc on dark-400 #161a22 = 10.4:1.
                  // aria-label preserved — it overrides content, so existing
                  // e2e locators and WCAG 2.5.3 both hold.
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full border border-ice-dim/30 dark:border-ice/30 text-sm font-medium hover:bg-sand-200 dark:hover:bg-dark-300 text-ice-dim dark:text-ice transition-colors ${TOUCH_TARGET_FROM_36}`}
                  aria-label="Compare with another country"
                  title="Compare"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="9" cy="12" r="6" strokeWidth="1.75" />
                    <circle cx="15" cy="12" r="6" strokeWidth="1.75" />
                  </svg>
                  <span>Compare</span>
                </button>
              )}
  ```

  (4) Mobile chip — after the prime grid's closing tag, i.e. after

  ```tsx
            <DataCell label="Languages" field="languages" country={country} sources={sources}>
              {Object.keys(country.languages).length > 0
                ? Object.values(country.languages).join(', ')
                : '—'}
            </DataCell>
          </div>
  ```

  insert:

  ```tsx
          {!isDesktop && !comparePickingMode && !inGameRound && (
            <button
              onClick={onEnterCompare}
              data-testid="compare-entry"
              aria-label="Compare with another country"
              // D4: the mobile labeled compare chip (C5's scope split). Same
              // accessible name, testid, contrast math, and A13 constant as
              // the desktop pill — exactly one of the two renders (isDesktop).
              className={`mt-1 inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-ice-dim/30 dark:border-ice/30 text-sm font-medium hover:bg-sand-200 dark:hover:bg-dark-300 text-ice-dim dark:text-ice transition-colors ${TOUCH_TARGET_FROM_36}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="9" cy="12" r="6" strokeWidth="1.75" />
                <circle cx="15" cy="12" r="6" strokeWidth="1.75" />
              </svg>
              <span>Compare</span>
            </button>
          )}
  ```

- [ ] **Run green — component tests plus every invalidated pin in the same commit:** `npx vitest run src/components/__tests__/SingleCountryPanel.test.tsx src/components/__tests__/SingleCountryPanel.focus.test.tsx src/lib/__tests__/layoutConstants.test.ts` — all pass. `layoutConstants.test.ts` pins `TOUCH_TARGET_FROM_36`, `TOUCH_TARGET_FROM_22`, `compare-picking-cancel`, `w-3.5 h-3.5`, and Task 5's `sheet-grabber`/dvh/safe-area strings against `SingleCountryPanel.tsx?raw` — all still present after this restructure (verified against the edits above; if any fails, the pin names the constant to reconcile).

- [ ] **Re-anchor and extend `e2e/mobile-panel-header.spec.ts` in the same commit.** Replace the stale file docblock (lines 1–15, "the action-button row consumed too much horizontal space…") with:

  ```ts
  /**
   * Mobile country-panel header — D4 restructure.
   *
   * The sheet header is one inline row: flag + name left; share, expand
   * chevron, close right. Compare is a labeled chip below the prime grid
   * (same accessible name as the desktop pill). D1's hero stats must be
   * answerable in the collapsed sheet without expanding.
   *
   * The width loop verifies the country name is not truncated (scrollWidth
   * vs clientWidth on the <h2> — geometry, not wrap points) and that every
   * action is reachable at 360/375/414px.
   */
  ```

  In the width-loop's "action buttons" test, replace the comment

  ```ts
        // Compare button (only when not in comparePickingMode / inGameRound).
  ```

  with

  ```ts
        // Compare entry (D4: labeled chip below the grid — same accessible
        // name as the desktop pill; hidden while picking / in-round).
  ```

  (the locator itself — `getByRole('button', { name: 'Compare with another country' })` — resolves to the chip unchanged; Playwright visibility does not require in-viewport, so the assertion holds even when the chip is below the fold). Then append:

  ```ts
  test.describe('D4 sheet header restructure at 390×844', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('compare is a labeled chip that enters picking mode', async ({ page }) => {
      await gotoAndWaitForMap(page, '/#FRA')
      const panel = page.getByTestId('country-panel')
      await expect(panel).toBeVisible({ timeout: 15_000 })
      await waitForAnimationIdle(panel)

      const chip = page.getByTestId('compare-entry')
      await expect(chip).toHaveText('Compare')
      await chip.click()
      // The A7 picking banner appears and the chip unmounts (its gating).
      await expect(panel.getByRole('status')).toContainText('Pick a country to compare with')
      await expect(page.getByTestId('compare-entry')).not.toBeAttached()
    })

    test('hero stats sit inside the collapsed sheet viewport', async ({ page }) => {
      await gotoAndWaitForMap(page, '/#FRA')
      const panel = page.getByTestId('country-panel')
      await expect(panel).toBeVisible({ timeout: 15_000 })
      await waitForAnimationIdle(panel)

      // D1's hero row (Task 2 seam: data-testid="hero-stats", first block of
      // the panel body, ungated by showSecondary) answers population/area
      // WITHOUT expanding: its bottom edge stays inside the 844px viewport
      // while the sheet is collapsed (40dvh → sheet top ≈ 506px, ~140px of
      // slack). Geometry-based on purpose — robust to Linux font metrics.
      const hero = page.getByTestId('hero-stats')
      await expect(hero).toBeVisible()
      const box = await hero.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.y + box!.height).toBeLessThanOrEqual(844)
    })
  })
  ```

  Also checked, no re-anchor needed (state for the record): `panel-and-deeplink.spec.ts`'s mobile describe clicks `getByLabel('Expand panel')` (chevron unchanged) and uses the "Currencies" peek sentinel (still behind `showSecondary`); `a11y-contrast.spec.ts`, `compare-view-dimming.spec.ts`, `compare-map-clicks.spec.ts`, and `game-country-pinning.spec.ts` anchor the compare entry on desktop viewports where the pill's DOM is unchanged; `source-tooltip-edge.spec.ts` anchors the panel's Source buttons, which this task does not move.

- [ ] **Run the e2e spec** (kill stray dev servers first): `npx playwright test e2e/mobile-panel-header.spec.ts --project=chromium --workers=2` — all pass. This spec runs on CI's chromium project; the device-emulating mobile projects remain local-only and do not run it.

- [ ] **Commit A:**

  ```
  git add src/components/SingleCountryPanel.tsx src/components/__tests__/SingleCountryPanel.test.tsx e2e/mobile-panel-header.spec.ts
  git commit -m "feat(panel): D4 mobile sheet header — inline actions, labeled compare chip, hero stats above the fold" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

- [ ] **Write the failing hint tests (gate drop).** In `src/hooks/__tests__/useFirstVisitHint.test.tsx`: remove `isDesktop: boolean` from `interface HintArgs` and `isDesktop: true,` from the `args` factory; DELETE these two now-obsolete tests (remove-obsolete rule — the gate they pin is being removed):

  - `it('desktop-only (C5 scope) — and the gate is NOT burned on mobile, so D4 can revisit', …)`
  - `it('entering compare on mobile does NOT burn the gate — D4 can revisit later', …)`

  and add in their place, inside the `compare tip (C5)` describe:

  ```tsx
      it('viewport-independent since D4 — the hook takes no isDesktop and the chip exists on mobile', () => {
        // The C5-era desktop gate is gone: the same second-distinct-selection
        // rule fires everywhere. (C5 deliberately left the localStorage gate
        // unburned on mobile so this flip costs returning users nothing.)
        const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
          initialProps: args({ selectedCca3: 'FRA' }),
        })
        rerender(args({ selectedCca3: 'DEU' }))
        expect(result.current.hint).toBe('compare')
        expect(localStorage.getItem('funworldmap-hint-compare-shown')).toBe('1')
      })
  ```

- [ ] **Run and confirm the failure:** `npx vitest run src/hooks/__tests__/useFirstVisitHint.test.tsx` — vitest transpiles without type-checking, so `args()` now omits `isDesktop` and the hook's `if (!isDesktop) return` swallows every compare-tip case: the compare-tip tests fail with `expected null to be 'compare'`.

- [ ] **Implement the gate drop.** In `src/hooks/useFirstVisitHint.ts`:

  (1) Docstring — replace

  ```ts
   * - 'compare' (C5): on the user's second DISTINCT country selection of the
   *   session (in-memory count — a "session" is one page lifetime), only while
   *   a country panel is open, never during games, and only on desktop where
   *   the labeled Compare pill exists (D4 owns the mobile chip and revisits
   *   the gate — the localStorage gate is deliberately NOT burned on mobile).
   *   Entering compare before the tip ever showed marks it moot.
  ```

  with

  ```ts
   * - 'compare' (C5, mobile-enabled by D4): on the user's second DISTINCT
   *   country selection of the session (in-memory count — a "session" is one
   *   page lifetime), only while a country panel is open, never during games.
   *   Fires on every viewport: D4 shipped the mobile labeled compare chip,
   *   so the C5-era desktop-only gate is gone — its localStorage gate was
   *   deliberately left unburned on mobile for exactly this. Entering
   *   compare before the tip ever showed marks it moot.
  ```

  (2) Signature — replace

  ```ts
  export function useFirstVisitHint({
    mapReady,
    selectedCca3,
    gameActive,
    compareActive,
    isDesktop,
  }: {
    mapReady: boolean
    selectedCca3: string | null
    gameActive: boolean
    compareActive: boolean
    isDesktop: boolean
  }): { hint: OnboardingHint | null } {
  ```

  with

  ```ts
  export function useFirstVisitHint({
    mapReady,
    selectedCca3,
    gameActive,
    compareActive,
  }: {
    mapReady: boolean
    selectedCca3: string | null
    gameActive: boolean
    compareActive: boolean
  }): { hint: OnboardingHint | null } {
  ```

  (3) Compare effect — replace

  ```ts
    // Compare tip (C5). hasSelection is true on the render that adds the
    // second cca3, so the tip only ever fires while a panel is open.
    useEffect(() => {
      if (gameActive || selectedCca3 === null) return
      distinctSelectionsRef.current.add(selectedCca3)
      if (!isDesktop) return
  ```

  with

  ```ts
    // Compare tip (C5, mobile-enabled by D4). hasSelection is true on the
    // render that adds the second cca3, so the tip only ever fires while a
    // panel is open.
    useEffect(() => {
      if (gameActive || selectedCca3 === null) return
      distinctSelectionsRef.current.add(selectedCca3)
  ```

  and the effect's dependency array

  ```ts
    }, [selectedCca3, gameActive, compareActive, isDesktop])
  ```

  with

  ```ts
    }, [selectedCca3, gameActive, compareActive])
  ```

  (4) In `src/App.tsx`, replace the call site

  ```ts
    const { hint } = useFirstVisitHint({
      mapReady,
      selectedCca3: selected?.cca3 ?? null,
      gameActive: session.status !== 'idle',
      compareActive: !!compareWith || comparePickingMode,
      isDesktop,
    })
  ```

  with

  ```ts
    const { hint } = useFirstVisitHint({
      mapReady,
      selectedCca3: selected?.cca3 ?? null,
      gameActive: session.status !== 'idle',
      compareActive: !!compareWith || comparePickingMode,
    })
  ```

  Keep App's `const isDesktop = useMediaQuery()` — it still feeds the panel props (lines 436/453).

- [ ] **Run green:** `npx vitest run src/hooks/__tests__/useFirstVisitHint.test.tsx` — all pass, including the untouched precedence tests (their `args()` calls never set `isDesktop` except the two deleted tests).

- [ ] **Fix the stale doc in the same task.** In `docs/systems/ui-layout.md`, replace the Compare-section line

  ```
  From an open country panel, the labeled **Compare** pill (desktop panel header; the mobile sheet's labeled chip ships with D4) puts search into "pick a country to compare" mode (placeholder "Choose country to compare…"; entered via `enterComparePicking` in `App.tsx`, available only while a country is selected). A one-time "Tip: compare two countries side by side" hint shows after the session's second distinct country selection. Choosing a second country opens `CompareCountryPanel`.
  ```

  with

  ```
  From an open country panel, the labeled **Compare** entry (desktop: header pill; mobile: chip below the stats grid — D4) puts search into "pick a country to compare" mode (placeholder "Choose country to compare…"; entered via `enterComparePicking` in `App.tsx`, available only while a country is selected). A one-time "Tip: compare two countries side by side" hint shows after the session's second distinct country selection, on every viewport (D4 dropped C5's desktop-only gate). Choosing a second country opens `CompareCountryPanel`.
  ```

  Also add to the "Bottom sheet behavior" bullet list (below Task 5's grabber bullet):

  ```
  - Header actions are inline (flag + name left; share, expand chevron, close right); compare is a labeled chip below the stats grid (D4)
  ```

- [ ] **Full gate:** `npm run check` — green (the typecheck proves no other `useFirstVisitHint` caller passes `isDesktop`; excess-property checking would reject it).

- [ ] **Live pass (budgeted).** `npm run dev`, 390px emulation, both themes, with localStorage cleared: (1) select a country — header is one row, hero stats and the labeled Compare chip visible without expanding; (2) tap the chip — picking banner with Cancel appears; pick a second country — compare opens; (3) fresh localStorage again: select two distinct countries — the "Tip: compare two countries side by side" pill now appears on mobile and never again after; (4) confirm the desktop pill is unchanged at ≥1024px. Kill the dev server afterwards.

- [ ] **Commit B:**

  ```
  git add src/hooks/useFirstVisitHint.ts src/hooks/__tests__/useFirstVisitHint.test.tsx src/App.tsx docs/systems/ui-layout.md
  git commit -m "feat(hints): enable the compare tip on mobile now the labeled chip exists (D4)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

### Task 7: Workstream D verification sweep (final)

**Context for the executor (you see only this task):** Tasks 1–6 on this branch shipped the spec's workstream D + G1 (`docs/superpowers/specs/2026-07-26-ux-visual-program-design.md`): **D1** hero stats row (population/area as compact `.text-readout` numerals with "#N of 195" rank sub-lines, plus derived density), **D2** consolidated Tab-reachable sources footer that expands into the full field → source table, with superscript exception markers (`SourceMarker` / `src/lib/fieldSourceMarkers.ts`, adopted from workstream C) — retiring the per-field 'i' rings and the A4 interim caption `SourceTooltip`, **D3** "Explore next" block (landlocked/coastal fact chip, same-subregion chips, similar-population chip — all `BorderChip`-based), **D4** mobile sheet header restructure (inline actions, labeled Compare chip — C5's deferred half, hero stats in the collapsed sheet), **G1** dvh sheet heights + `env(safe-area-inset-bottom)` padding + visible grabber wired to the existing expand toggle with the `aria-expanded` chevron as the labeled control. This task verifies all of it, runs the real live pass, brings `docs/systems/` to the shipped state, and appends the completion ledger.

**Files:**

- `docs/systems/ui-layout.md` (modify — mobile bottom-sheet + Country Panel sections rewritten to shipped state; two stale forward-references in § Compare resolved)
- `docs/systems/accessibility.md` (modify — attribution keyboard-reachability, bottom-sheet keys, retired tooltip row)
- `docs/systems/data.md` (modify — § UI Attribution describes the retired 'i' icons)
- `docs/systems/testing.md` (modify ONLY if Tasks 1–6 changed the spec-file set — recompute the "13 of 40" counts)
- `docs/superpowers/plans/2026-07-29-workstream-d.md` (this plan document — append the completion ledger)
- `.superpowers/sdd/live-pass/live-pass.ts` (create — scripted live pass; the directory is gitignored via `.superpowers/sdd/.gitignore`, so the script and screenshots never pollute the repo)

**Interfaces:**

*Consumes:* everything Tasks 1–6 produced — the D1 hero-stats row, the D2 footer/marker scheme (`computeFieldSourceMarkers`/`dominantSource` from `src/lib/fieldSourceMarkers.ts`, `SourceMarker.tsx` with `data-testid="source-marker-<sourceKey>"`), the D3 explore-next chips, the D4 sheet header + labeled Compare chip, the G1 grabber/`dvh`/safe-area work, and Task 6's recorded decision on the mobile compare tip (whether the `if (!isDesktop) return` gate in `src/hooks/useFirstVisitHint.ts`'s compare-tip effect was removed).

*Produces:* nothing importable — a verified, documented, honestly-summarized tranche.

**No new telemetry:** workstream D ships **no** new `track()` events, no `KNOWN_EVENTS` change, no `docs/systems/analytics.md` change, and no wrangler deploy — Step 7 proves it by grep instead of asserting it.

---

- [ ] **Step 1 — kill stray dev servers (project memory: a background `npm run dev` gets reused by Playwright WITHOUT `VITE_TEST_HOOKS`).** PowerShell:
  `Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`
  then confirm `Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue` returns nothing.

- [ ] **Step 2 — config/retirement hygiene pre-flight.** Two greps before any suite runs:
  1. **No orphaned `testMatch`/`testIgnore` entries** (D2 may have deleted `source-tooltip-edge.spec.ts` / `source-tooltip-keyboard.spec.ts`; a config entry whose file is gone is silently ignored by Playwright — a false sense of coverage). Bash:
     ```bash
     cd /e/polworldmap && for f in $(grep -oE "[a-z0-9-]+\.spec\.ts" playwright.config.ts | sort -u); do [ -f "e2e/$f" ] || echo "ORPHAN in config: $f"; done
     ```
     Expected: **no output**. Any orphan means a Task 1–6 commit deleted a spec without pruning `playwright.config.ts` — fix that on this branch (separate `chore` commit) before proceeding.
  2. **The retired identifier is actually retired** (project memory: superseded code AND tests deleted in the same change): `grep -rn "SourceTooltip" src/ e2e/`. Expected: **zero hits** if Task 2 fully retired the component. If hits remain, read each one — a hit that Task 2's commit message documents as a deliberate survivor is fine; anything else is dead code and must be deleted (separate commit) before this sweep proceeds.

- [ ] **Step 3 — full static + unit sweep.** `npm run check` (= `eslint src/ e2e/ scripts/` + `tsc -b` + `vitest run`) → green. The `test:unit` leg IS the full unscoped `npx vitest run` this sweep requires — do not scope it to changed files.

- [ ] **Step 4 — affected e2e, CI-covered set.** Verified against `playwright.config.ts` as of 2026-07-29 (main @ 6e59c00): these seven specs are in the `chromium` `testMatch` and NOT in its CI `testIgnore`:
  ```
  npx playwright test e2e/panel-and-deeplink.spec.ts e2e/mobile-panel-header.spec.ts e2e/a11y-contrast.spec.ts e2e/a11y-keyboard-smoke.spec.ts e2e/compare-source-attribution.spec.ts e2e/compare-view-dimming.spec.ts e2e/compare-map-clicks.spec.ts --project=chromium --workers=2
  ```
  → green (`--workers=2` matches CI parallelism per CLAUDE.md; single-worker runs hide flakes). Notes:
  - `source-tooltip-keyboard.spec.ts` is CI-covered on main but D2 retires its subject. If Task 2 rewrote it (e.g. to cover the footer disclosure + markers), add the successor file to this run; if Task 2 deleted it, Step 2.1 already confirmed the config was pruned.
  - `compare-view-dimming.spec.ts` contains the **#136 quarantine** (`test.fixme(!!process.env.CI, 'tracking issue: https://github.com/GranatenUdo/funworldmap/issues/136')` at line ~131 — a CI-only click stall). It is CI-conditional, so this local run executes the quarantined test for real. **The quarantine stays** — this tranche does not address #136; do not remove the `test.fixme`.

- [ ] **Step 5 — affected e2e, local-only set.** These five are in the chromium `testIgnore` on CI (no-GPU flake, tracking issue #106) — **this local run is their only guard; CI will not re-check them** (`docs/systems/testing.md` § "What Runs in CI"):
  ```
  npx playwright test e2e/panel-focus.spec.ts e2e/accessibility.spec.ts e2e/axe-snapshot.spec.ts e2e/theme-and-responsive.spec.ts e2e/search.spec.ts --project=chromium --workers=2
  ```
  → green. (Affected because: `panel-focus` pins the panel's Tab/focus contract, which D2's Tab-reachable footer changes; the two axe specs must pass over the new hero/footer/explore-next DOM; `theme-and-responsive` exercises the sheet at mobile widths through G1's dvh/grabber restructure; `search` selects countries repeatedly with a fresh localStorage, so the C5/D4 compare-tip pill fires mid-spec if mis-gated.) `source-tooltip-edge.spec.ts` is in this local-only tier on main — same disposition rule as Step 4: run its successor if Task 2 rewrote it; nothing to run if deleted.

- [ ] **Step 6 — mobile-project runs (local-only; CI runs only the `chromium` project).** D4/G1 restructure exactly the surface these specs drive (tap → sheet opens → header controls), and if Task 6 enabled the mobile compare tip, the pill can newly appear mid-flow:
  ```
  npx playwright test e2e/mobile-smoke.spec.ts e2e/mobile-tap.spec.ts --project=mobile-chromium --project=mobile-webkit --project=desktop-firefox-touch --workers=2
  ```
  → green. (`mobile-free-play.spec.ts` is skipped deliberately: workstream D touches no game flow.)

- [ ] **Step 7 — no-new-telemetry proof.** Run `git diff main...HEAD -- src cloudflare-worker | grep -E 'track\(|KNOWN_EVENTS'` → expect **no output** (grep exits 1). If anything surfaces, a task smuggled in telemetry this workstream explicitly does not ship — remove it before proceeding.

- [ ] **Step 8 — write the live-pass script.** `mkdir -p .superpowers/sdd/live-pass`, then create `.superpowers/sdd/live-pass/live-pass.ts` with exactly this content (the directory is gitignored — script and screenshots are working artifacts, not repo content):

  ```ts
  // Scripted live pass for workstream D (Task 7). Run against `npm run dev`:
  //   npx tsx .superpowers/sdd/live-pass/live-pass.ts
  // Screenshots land next to this file. A FAIL line is a fix-first blocker —
  // unless the behavior is verifiably present and only the selector drifted
  // from what Tasks 1-6 landed, in which case fix the selector (Step 9), never
  // the assertion.
  import { chromium, type Browser, type Page } from '@playwright/test'
  import { mkdirSync } from 'node:fs'
  import { dirname, join } from 'node:path'
  import { fileURLToPath } from 'node:url'

  const DIR = dirname(fileURLToPath(import.meta.url))
  const BASE = 'http://localhost:5173'

  // RECONCILE before running (Step 9): grep -n "isDesktop" src/hooks/useFirstVisitHint.ts
  //   gate `if (!isDesktop) return` still in the compare-tip effect -> false
  //   gate removed by Task 6 (mobile tip enabled)                  -> true
  const MOBILE_COMPARE_TIP_ENABLED = false

  const HINT_KEYS = [
    'funworldmap-hint-explore-shown',
    'funworldmap-hint-game-shown',
    'funworldmap-hint-compare-shown',
  ]

  const failures: string[] = []
  async function check(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn()
      console.log(`PASS  ${name}`)
    } catch (e) {
      failures.push(name)
      console.log(`FAIL  ${name} :: ${String(e).split('\n')[0]}`)
    }
  }
  const shot = (page: Page, name: string) => page.screenshot({ path: join(DIR, `${name}.png`) })

  async function openPage(
    browser: Browser,
    opts: { theme: 'light' | 'dark'; mobile: boolean; hash: string; seedCompareHint?: boolean },
  ): Promise<Page> {
    const context = await browser.newContext({
      viewport: opts.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: opts.mobile,
      hasTouch: opts.mobile,
      colorScheme: opts.theme,
    })
    // Seed the theme + onboarding-hint gates so pills don't photobomb the
    // screenshots (keys from src/hooks/useFirstVisitHint.ts and useTheme.ts).
    const keys =
      opts.seedCompareHint === false ? HINT_KEYS.filter((k) => !k.includes('compare')) : HINT_KEYS
    await context.addInitScript(
      (cfg: { theme: string; keys: string[] }) => {
        localStorage.setItem('funworldmap-theme', cfg.theme)
        for (const k of cfg.keys) localStorage.setItem(k, '1')
      },
      { theme: opts.theme, keys },
    )
    const page = await context.newPage()
    await page.goto(`${BASE}/${opts.hash}`)
    await page.waitForSelector('[data-map-loaded]', { timeout: 30_000 })
    return page
  }

  async function main() {
    mkdirSync(DIR, { recursive: true })
    const browser = await chromium.launch()

    for (const theme of ['light', 'dark'] as const) {
      // ---------- Desktop 1440x900 ----------
      {
        const page = await openPage(browser, { theme, mobile: false, hash: '#FRA' })
        const panel = page.getByTestId('country-panel')
        await panel.waitFor()

        await check(`desktop/${theme}: hero rank sub-lines (>=2 of "#N of 195") [D1]`, async () => {
          await panel.getByText(/#\d+ of 195/).first().waitFor()
          const n = await panel.getByText(/#\d+ of 195/).count()
          if (n < 2) throw new Error(`expected >=2 rank lines (population + area), got ${n}`)
        })
        // Every bundled country attributes governmentType to cia-factbook while
        // the dominant source is restcountries (verified against
        // src/data/countries.json 2026-07-29) — so France MUST show a marker.
        await check(`desktop/${theme}: exception marker on Government [D2]`, async () => {
          await panel.locator('[data-testid="source-marker-cia-factbook"]').first().waitFor()
        })
        await shot(page, `panel-desktop-${theme}`)

        await check(`desktop/${theme}: sources footer expands into field->source table [D2]`, async () => {
          const footer = panel.getByRole('button', { name: /sources?/i }).last()
          await footer.waitFor()
          await footer.click()
          await panel.locator('button[aria-expanded="true"]').first().waitFor()
        })
        await shot(page, `panel-sources-expanded-desktop-${theme}`)

        await check(`desktop/${theme}: explore-next similar-population chip navigates [D3]`, async () => {
          const chip = panel.getByText(/similar population/i).first()
          await chip.scrollIntoViewIfNeeded()
          await chip.click()
          await page.waitForFunction(
            () => /^#[A-Z]{3}$/.test(location.hash) && location.hash !== '#FRA',
          )
        })
        await shot(page, `panel-explore-next-desktop-${theme}`)
        await page.context().close()
      }

      // ---------- Mobile 390x844 ----------
      {
        const page = await openPage(browser, { theme, mobile: true, hash: '#FRA' })
        const panel = page.getByTestId('country-panel')
        await panel.waitFor()

        await check(`mobile/${theme}: hero stats visible in the COLLAPSED sheet [D1+D4]`, async () => {
          await panel.getByText(/#\d+ of 195/).first().waitFor()
        })
        await check(`mobile/${theme}: labeled Compare chip (visible text, not icon-only) [D4]`, async () => {
          const chip = panel.getByRole('button', { name: /compare/i }).first()
          await chip.waitFor()
          const text = (await chip.innerText()).trim()
          if (!/compare/i.test(text)) throw new Error(`compare control has no visible label: "${text}"`)
        })
        await check(`mobile/${theme}: safe-area padding inside the sheet [G1]`, async () => {
          const has = await panel.evaluate((el) => el.outerHTML.includes('safe-area-inset-bottom'))
          if (!has) throw new Error('no env(safe-area-inset-bottom) padding inside the sheet')
        })
        await shot(page, `panel-mobile-collapsed-${theme}`)

        await check(`mobile/${theme}: aria-expanded toggle grows the sheet (grabber/chevron) [G1]`, async () => {
          const toggle = panel.locator('button[aria-expanded]').first()
          await toggle.waitFor()
          const before = (await panel.boundingBox())!.height
          await toggle.click()
          await panel.locator('button[aria-expanded="true"]').first().waitFor()
          await page.waitForFunction((h) => {
            const el = document.querySelector('[data-testid="country-panel"]')
            return el !== null && el.getBoundingClientRect().height > h + 50
          }, before)
        })
        await shot(page, `panel-mobile-expanded-${theme}`)
        await page.context().close()
      }

      // ---------- Mobile compare, hash-driven (lesson: seam/hash over click chains) ----------
      {
        const page = await openPage(browser, { theme, mobile: true, hash: '#FRA,DEU' })
        await page.getByTestId('compare-mobile-scroll').waitFor()
        await shot(page, `compare-mobile-${theme}`)
        await page.context().close()
      }
    }

    // ---------- Compare tip on mobile — per Task 6's recorded decision ----------
    {
      const page = await openPage(browser, {
        theme: 'light',
        mobile: true,
        hash: '#FRA',
        seedCompareHint: false,
      })
      const panel = page.getByTestId('country-panel')
      await panel.waitFor()
      await page.evaluate(() => {
        location.hash = '#DEU' // second distinct selection of the session
      })
      await panel.getByRole('heading', { name: 'Germany' }).waitFor()
      const tip = page.getByText('Tip: compare two countries side by side')
      if (MOBILE_COMPARE_TIP_ENABLED) {
        await check('mobile: compare tip SHOWS on 2nd distinct selection (Task 6 enabled it)', async () => {
          await tip.waitFor({ timeout: 5_000 })
        })
        await shot(page, 'compare-tip-mobile-light')
      } else {
        await check('mobile: compare tip stays OFF (Task 6 kept the desktop-only gate)', async () => {
          if ((await tip.count()) > 0)
            throw new Error('tip rendered on mobile but the gate should be desktop-only')
        })
      }
      await page.context().close()
    }

    await browser.close()
    console.log(
      failures.length === 0
        ? '\nLIVE PASS: all scripted checks green'
        : `\nLIVE PASS: ${failures.length} FAILURE(S):\n- ${failures.join('\n- ')}`,
    )
    process.exitCode = failures.length === 0 ? 0 : 1
  }

  void main()
  ```

- [ ] **Step 9 — reconcile the script's two open points against what Tasks 1–6 actually landed.** (a) Run `grep -n "isDesktop" src/hooks/useFirstVisitHint.ts` — if the compare-tip effect still contains `if (!isDesktop) return`, leave `MOBILE_COMPARE_TIP_ENABLED = false`; if Task 6 removed it, set `true`. (b) Run `grep -n "data-testid\|aria-expanded\|aria-label" src/components/SingleCountryPanel.tsx` and confirm the script's three behavior-level selectors resolve: the sources-footer toggle's accessible name (script assumes it matches `/sources?/i`), the rank sub-line copy (script assumes it matches `/#\d+ of 195/`), and the similar-population chip copy (script assumes `/similar population/i`, the spec's D3 wording). If a landed name differs, update the script's selector — never weaken an assertion.

- [ ] **Step 10 — run the live pass (spec commitment: touched flows on desktop AND 390px, both themes).** Start `npm run dev`, then `npx tsx .superpowers/sdd/live-pass/live-pass.ts` → exit 0, `LIVE PASS: all scripted checks green`, and 14–15 PNGs in `.superpowers/sdd/live-pass/`. Then **review every screenshot with your own eyes** (Read tool) against this checklist — scripts can't judge visual quality:
  - `panel-desktop-{light,dark}`: hero row reads as three mono readouts with rank sub-lines; superscript marker on Government; footer visible at panel end; AA-plausible contrast in both themes.
  - `panel-sources-expanded-desktop-{light,dark}`: the full field → source table is open, every source linked.
  - `panel-explore-next-desktop-{light,dark}`: a different country's panel (the chip navigated).
  - `panel-mobile-collapsed-{light,dark}`: inline header (flag + name left, share + close right), grabber bar visible, hero stats above the fold, labeled Compare chip present, nothing clipped at the sheet bottom.
  - `panel-mobile-expanded-{light,dark}`: full sheet with secondary fields + explore-next reachable in one scroll.
  - `compare-mobile-{light,dark}`: single scroll compare sheet renders (regression guard on the D4 header restructure's neighbor).
  - `compare-tip-mobile-light` (only if Task 6 enabled it): the tip pill renders un-clipped at 390px.
  Any scripted FAIL or visual defect is a **fix-first blocker**: fix on this branch, re-run Steps 3–6 for whatever the fix touched, re-run this step, and record the bug in the Step 15 ledger (the workstream C sweep caught two suite-invisible regressions exactly this way). When green, kill the dev server (Step 1's command).

- [ ] **Step 11 — `docs/systems/ui-layout.md` to shipped state (lesson: docs staleness is fixed in the same tranche).** Five edits; before committing, reconcile any component/copy detail against what Tasks 1–6 actually landed (e.g. whether the grabber is `aria-hidden` or a second labeled control, and whether exception badges kept per-badge tooltips — adjust wording to match the code, not the plan):
  1. In the mobile diagram, replace
     ```
     │  [▲ expand] Country name │  ← bottom sheet (when country selected)
     │  Country Panel           │
     │  (peek: 40vh / full: 80vh)
     ```
     with
     ```
     │  ── grabber ──           │  ← bottom sheet (when country selected)
     │  Flag Name    share  ×   │
     │  Hero stats + panel body │
     │  (peek: 40dvh / full: 80dvh)
     ```
  2. Replace the five "**Bottom sheet** behavior" bullets (currently "- Appears when a country is selected" through "- Close button to dismiss entirely", including "Two interactive states: **peek** (40% viewport height) and **full** (80% viewport height). These are starting values…" and "Expand/collapse button (chevron) at the top toggles between states…") with:
     ```markdown
     - Appears when a country is selected
     - Two interactive states: **peek** (`40dvh`) and **full** (`80dvh`). `dvh`, not `vh` (G1): the sheet must agree with the *visible* viewport under dynamic mobile browser toolbars.
     - A visible **grabber bar** at the sheet top toggles between states; it is a pointer affordance wired to the same expand toggle as the labeled chevron button, which stays the accessible control and carries `aria-expanded` (G1). Pointer-drag with snap points is deliberately not implemented (G2, deferred to its own spec).
     - The sheet's scroll container carries `pb-[env(safe-area-inset-bottom)]` so content clears the iPhone home indicator (G1)
     - Header is one inline row — flag + name left, share + close right (D4); Compare is a labeled chip below the grid, not a header icon
     - The header row reclaimed by D4 goes to D1's hero stats, so the collapsed sheet answers population / area / density without expanding
     - Overlays the map — map remains visible above the sheet. Tapping the visible map above the bottom sheet selects or deselects a country normally. The sheet transitions to show the new country's data, or collapses if the tap hit empty space.
     - Close button to dismiss entirely
     ```
  3. Replace the whole "Information Displayed" body — from `**Primary** (always visible in peek state):` through the `**Source Attribution**: Every data field has a small 'i' icon. …` paragraph (which ends `…dismissed by tapping elsewhere. See [Data System — UI Attribution](data.md).`) — with:
     ```markdown
     **Primary** (always visible in peek state):

     - Flag (bundled SVG)
     - Country name (common + official if different)
     - Header caption: capital(s), comma-separated if a country has multiple (e.g., South Africa: Pretoria, Cape Town, Bloemfontein)
     - Region / Subregion badge
     - Exception badges — shown only for the two countries where they're non-default: "UN observer state" (Vatican, Palestine) and "Not independent" (Palestine). Absent for the 193 UN member states, so most panels show no badge at all.
     - Hero stats row (D1): Population and Area as compact `.text-readout` numerals ("66.4M", "544K km²"; exact locale-formatted figures in `title`), each with a "#N of 195" world-rank sub-line, plus derived density (population / area) as a third stat. Ranks and density are computed from the in-memory 195-country dataset — zero data cost.
     - Prime grid (2 columns, always visible regardless of peek/expanded state): Government type, Languages (Population and Area moved up into the hero row with D1)

     **Secondary** (visible in full/expanded state):

     - Currencies
     - Timezones
     - Neighboring countries (clickable chips). Clicking a border chip selects that country — same as clicking it on the map. The map flies to the new country via `flyToCountry()`, the panel transitions to show its data, and the URL hash updates. Each chip click creates a new history entry, so browser Back returns to the previous country. If a border code has no match in `countries.json`, the chip is displayed but not clickable.
     - "Explore next" block (D3), below Borders: a landlocked/coastal fact chip (the bundled `landlocked` field), 3–4 same-subregion countries not already in Borders, and one "similar population: Italy (58.9M)" chip. All reuse `BorderChip` and the same select path, so activating one navigates exactly like a border chip.

     **Source Attribution** (D2): fields are no longer individually 'i'-ringed — the per-field hover tooltips are retired. The panel ends in a consolidated, Tab-reachable **sources footer** listing the panel's linked data sources; it expands on activation into the full field → source table, so complete per-field granularity stays one interaction away. Any field whose source differs from the panel's dominant source carries a superscript exception marker (`SourceMarker`, driven by `src/lib/fieldSourceMarkers.ts` — the same scheme the compare panel ships). See [Data System — UI Attribution](data.md).
     ```
  4. In § Compare, replace `the labeled **Compare** pill (desktop panel header; the mobile sheet's labeled chip ships with D4) puts search into` with `the labeled **Compare** pill (desktop panel header) or the mobile sheet's labeled **Compare** chip (D4) puts search into`; and replace `carries a superscript exception marker (definition shipped with C4; the single panel adopts it in D2).` with `carries a superscript exception marker (`fieldSourceMarkers.ts`, shipped with C4 and adopted by the single panel in D2).`
  5. Still in § Compare, amend the tip sentence `A one-time "Tip: compare two countries side by side" hint shows after the session's second distinct country selection.` per Task 6's decision: append ` (desktop and, since D4, mobile).` if the mobile tip shipped, or ` (desktop only — the mobile hint gate stays deliberately unburned; see the workstream D completion ledger).` if not.

- [ ] **Step 12 — `docs/systems/accessibility.md` to shipped state.** Four edits:
  1. Panel Keyboard Controls Tab row — replace `| Tab    | Cycle through interactive elements (close button, expand/collapse, border chips) |` with `| Tab    | Cycle through interactive elements (close button, expand/collapse, sources footer, border and explore-next chips) |`
  2. Replace the two attribution paragraphs — `Source 'i' buttons are intentionally outside the Tab order (`tabIndex=-1`) so blur-out closes them cleanly; they open on hover, click/tap, or programmatic focus — a deliberate trade-off (see the comment in `SourceTooltip.tsx`).` and `The compare panel's exception source markers (C4, `SourceMarker.tsx`) are ordinary links in the Tab order, each labelled `Source: <name>` — unlike the single-panel 'i' buttons above, they are fully keyboard-reachable. D2 extends this scheme to the single panel.` — with the single paragraph:
     ```markdown
     Source attribution is fully keyboard-reachable in both panels (D2 retired the single panel's hover-only, `tabIndex=-1` 'i' buttons): exception source markers (`SourceMarker.tsx`) are ordinary links in the Tab order, each labelled `Source: <name>`, and the consolidated sources footer is a Tab-reachable disclosure (`aria-expanded`) that expands into the single panel's full field → source table.
     ```
  3. Bottom Sheet table — replace `| Enter / Space (on expand button) | Toggle between peek (40vh) and full (80vh) states |` with `| Enter / Space (on expand button) | Toggle between peek (40dvh) and full (80dvh) states — the chevron carries `aria-expanded` (G1); the visible grabber is a pointer affordance for the same toggle |`
  4. If Step 2.2 confirmed zero `SourceTooltip` usages, delete the ARIA-table row `| Source tooltip | `role="tooltip"`      | Source name and URL |` (nothing renders `role="tooltip"` for sources anymore). If a survivor exists, leave the row and scope its wording to that survivor.

- [ ] **Step 13 — `docs/systems/data.md` § UI Attribution.** Replace `Every data field in the country panel has a small 'i' icon. On hover/focus, a tooltip shows the source name and URL. This provides full transparency about data provenance.` with:
  ```markdown
  Both panels attribute data through a consolidated, Tab-reachable sources footer — in the single panel it expands into the full field → source table — plus a superscript exception marker on any field whose source differs from the panel's dominant source (`src/lib/fieldSourceMarkers.ts`). The per-field 'i' tooltips were retired with D2. This provides full transparency about data provenance.
  ```

- [ ] **Step 14 — testing.md counts + map-rendering.md untouched proof.** (a) If Tasks 1–6 deleted or added spec files (Step 2.1 told you), recompute `docs/systems/testing.md` § "What Runs in CI": total = `ls e2e/*.spec.ts | wc -l`; local-only = number of `testIgnore` entries + 3 (the mobile-only `mobile-smoke`/`mobile-tap`/`mobile-free-play`); update "**13 of 40 spec files run locally only**", the "ten specs" `testIgnore` phrasing, and the `# 40 specs total` comment in the layout listing. If the spec set is unchanged, touch nothing. Note: CLAUDE.md's "13 of 38" is stale independently of this tranche — flag it in the Step 15 ledger; do NOT edit CLAUDE.md here. (b) Run `git diff main...HEAD --name-only | grep -iE 'map|camera|paint'` → expected **no hits** (workstream D is panel/sheet DOM only), so `docs/systems/map-rendering.md` stays untouched. If a fix-first commit from Step 10 touched map code, re-read `map-rendering.md` against that change and update it in this commit.

- [ ] **Step 15 — append the completion ledger to this plan document** (`docs/superpowers/plans/2026-07-29-workstream-d.md`), after the last task — the workstream C precedent. Append the block below, then (i) prepend one results paragraph with the ACTUAL numbers from Steps 3–7 and 10 (unit-test counts, e2e spec lists, "no new telemetry grep empty"), (ii) record every bug Step 10 found — fixed or honestly flagged with a suggested fix shape, never papered over — and (iii) keep exactly ONE of the two mobile-tip bullets:

  ```markdown
  ## Completion ledger (Task 7, post-verification)

  Spec items delivered in this tranche: **D1** (hero stats row — population/area readouts with
  "#N of 195" ranks, derived density), **D2** (consolidated Tab-reachable sources footer with
  expandable field → source table; `SourceMarker`/`fieldSourceMarkers` adopted from C4; the
  per-field 'i' rings and the A4 interim caption SourceTooltip retired, code and tests deleted),
  **D3** (explore-next: landlocked/coastal fact chip, same-subregion chips, similar-population
  chip), **D4** (inline sheet header, labeled mobile Compare chip — C5's deferred half — hero
  stats in the collapsed sheet), **G1** (dvh sheet heights, `env(safe-area-inset-bottom)`
  padding, visible grabber wired to the existing expand toggle, `aria-expanded` chevron as the
  labeled control).

  - **Mobile compare tip — ENABLED with D4:** the `!isDesktop` gate was removed; the tip shows
    once on the second distinct selection on mobile too (localStorage-gated, verified live).
  - **Mobile compare tip — NOT enabled:** Task 6 kept the desktop-only gate; the mobile
    localStorage gate remains deliberately unburned. Any future mobile tip needs its own call.

  Intentionally NOT shipped — each has a named owner:

  - **Log-scale position bars under panel stats** — stays deferred per the spec's Non-goals
    ("rank text answers the scale question; revisit only if hero stats prove insufficient").
  - **G2 sheet pointer-drag / snap gestures** — deferred to a follow-up spec per Non-goals
    (grabber + safe-area first; gestures are the riskiest e2e surface in this program).
  - **G3 (camera compensates for sheet state) and G4 (mobile header consolidation)** →
    G-remainder tranche (spec sequencing item 9; G4 sequenced with E7).
  - **Brazil+Nigeria mobile compare framing gap** — pre-existing, recorded in workstream C's
    ledger; unchanged by this tranche and still needs a dedicated owner.
  - **#136 quarantine** (`compare-view-dimming.spec.ts` CI-only `test.fixme`) — stays; this
    tranche ran the test green locally and did not address the CI-only click stall.
  - **Telemetry** — this workstream ships no new `track()` events (verified:
    `git diff main...HEAD -- src cloudflare-worker | grep -E 'track\(|KNOWN_EVENTS'` is empty).
    No `KNOWN_EVENTS`, `docs/systems/analytics.md`, or wrangler-deploy changes.
  - **CLAUDE.md spec-count staleness** — CLAUDE.md says "13 of 38 specs are local-only";
    `docs/systems/testing.md` carries the correct current numbers. Pre-existing; flagged for a
    separate CLAUDE.md maintenance pass, not edited in this tranche.
  ```

- [ ] **Step 16 — commit.**
  `git add docs/systems/ui-layout.md docs/systems/accessibility.md docs/systems/data.md docs/systems/testing.md docs/superpowers/plans/2026-07-29-workstream-d.md && git commit -m "docs(panel): ui-layout/accessibility/data to shipped D state + workstream D completion ledger" -m "Verification sweep: npm run check green (full vitest run); CI-covered e2e (panel-and-deeplink, mobile-panel-header, a11y-contrast, a11y-keyboard-smoke, compare-source-attribution, compare-view-dimming, compare-map-clicks) and local-only e2e (panel-focus, accessibility, axe-snapshot, theme-and-responsive, search) green at --workers=2; mobile-project runs green; scripted both-theme desktop+390px live pass with screenshots reviewed; no new telemetry (grep-verified); #136 quarantine unchanged." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"`