> **Tombstone (2026-06-12):** the country-news feature this plan concerns was removed in PR #40 (2026-05-12). Kept unmodified for history — do not implement from it.

# Guardian → GDELT News Source Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Shelf-ready plan.** Execution is deferred until the project decides to enable commercial monetisation (ads). Open this plan when that trigger lands; the tasks below produce one PR.

**Goal:** Replace the Guardian Open Platform news source with GDELT 2.0's Doc API so the country-news feature becomes commercial-use compatible. Simplify the pipeline: no API key, no hand-curated per-country tag list, no region fallback.

**Architecture:** Daily GHA → `scripts/news/build.ts` → GDELT Doc 2.0 `/api/v2/doc/doc` with `locationcc:<FIPS> sourcelang:english` query → per-country JSON at `public/news/<cca3>.json` → `CountryNewsSection` renders title + domain + relative time + thumbnail. New `scripts/news/fips-codes.ts` maps cca3 → FIPS-10-4 via overrides (~40 divergent) + fallback to cca2 (the other ~210 match). Delete three Guardian-specific modules.

**Tech Stack:** TypeScript, `tsx`, React 19, Playwright. No new npm deps.

**Spec:** [`2026-04-24-gdelt-migration-design.md`](../specs/2026-04-24-gdelt-migration-design.md).

**Previous feature:** [`2026-04-23-country-news-feed.md`](./2026-04-23-country-news-feed.md) — shipped as PR #16 with Guardian.

---

## Pre-flight (when execution begins)

Before Task 1, the implementer must do a schema-drift check. GDELT is stable but this plan sits on the shelf; APIs move.

```bash
curl -s 'https://api.gdeltproject.org/api/v2/doc/doc?query=locationcc:GM%20sourcelang:english&mode=ArtList&maxrecords=1&timespan=7d&format=json' | jq .
```

Expected fields in each article in `articles[]`: `url`, `url_mobile`, `title`, `seendate`, `socialimage`, `domain`, `language`, `sourcecountry`.

If the response has a different shape (missing fields, renamed fields, or a non-200 status), STOP execution and revise the spec before proceeding. In particular, `seendate` format `YYYYMMDDTHHMMSSZ` must still hold; the build script parses it.

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `scripts/news/fips-codes.ts` | **Create** (~60 LOC) | cca3 → FIPS-10-4 via overrides (~40) + cca2 fallback. |
| `scripts/news/__tests__/fips-codes.test.ts` | **Create** | Spot-check 10+ known divergent codes + 2 identity cases. |
| `scripts/news/_validate-fips.ts` | **Create** (~40 LOC) | One-off offline runner that queries GDELT for each cca3 and logs "no results" countries. Not part of the daily pipeline; commented out of package.json scripts to avoid accidental runs. |
| `scripts/news/gdelt-client.ts` | **Create** (~60 LOC) | Doc 2.0 `/api/v2/doc/doc` wrapper; normalises `seendate` to ISO; filters out non-English articles as a defence. |
| `scripts/news/build.ts` | **Rewrite** (~70 LOC, was ~120) | Single GDELT query per country; no region fallback. |
| `scripts/news/guardian-client.ts` | **Delete** | |
| `scripts/news/guardian-tags.ts` | **Delete** | |
| `scripts/news/regions.ts` | **Delete** | |
| `scripts/news/__tests__/regions.test.ts` | **Delete** | |
| `scripts/news/sanitise.ts` + tests | **Keep** | GDELT titles occasionally have HTML entities. |
| `src/components/CountryNewsSection.tsx` | **Rewrite** | Drop trailText row; replace section badge with domain; drop region-scope badge; update empty-state copy; add GDELT attribution footer. |
| `src/components/__tests__/CountryNewsSection.test.tsx` | **Rewrite** | Update fixtures to new shape; 5 tests retained. |
| `src/lib/relativeTime.ts` + tests | **Keep unchanged** | |
| `src/components/SingleCountryPanel.tsx` | **No change** | Mount point and `!inGameRound` gate unchanged. |
| `e2e/country-news.spec.ts` | **Rewrite fixtures** | 3 tests retained with updated article shape + assertions. |
| `.github/workflows/news.yml` | **Update** | Remove `env: GUARDIAN_KEY` block; no key needed. |
| `docs/systems/country-news.md` | **Rewrite** | Describe GDELT pipeline + FIPS lookup + attribution. |
| `public/news/<cca3>.json` × 249 | **Regenerated** | New shape (drop `guardianTag`, `section`, `scope`, `trailText`; add `domain`). |
| `package.json` | **No change** | `news:build` entry unchanged. |

---

### Task 1: Worktree setup + GDELT schema sanity check

**Files:** new worktree at `../polworldmap-gdelt-migration`.

- [ ] **Step 1: Create worktree**

```bash
git worktree add ../polworldmap-gdelt-migration -b chore/gdelt-migration main
```

- [ ] **Step 2: Install deps**

```bash
cd /e/polworldmap-gdelt-migration
npm install 2>&1 | tail -3
```

- [ ] **Step 3: Baseline**

```bash
npm run test:unit 2>&1 | tail -3
npx tsc -b 2>&1 | tail -3
```

Expected: all pass, tsc clean.

- [ ] **Step 4: Live GDELT schema check**

```bash
curl -s 'https://api.gdeltproject.org/api/v2/doc/doc?query=locationcc:GM%20sourcelang:english&mode=ArtList&maxrecords=3&timespan=7d&format=json' | jq '.articles[0] | keys'
# NOTE: operator is `locationcc:` not `location:`; `sourcelang:english` not `:eng`.
# These were verified against live GDELT on 2026-04-24; if the operator name
# or sourcelang code changes, update gdelt-client.ts's query string accordingly.
```

Expected output (order may vary):

```json
[
  "domain",
  "language",
  "seendate",
  "socialimage",
  "sourcecountry",
  "title",
  "url",
  "url_mobile"
]
```

If fields differ, STOP: revise spec + this plan before continuing.

---

### Task 2: `fips-codes.ts` + tests (TDD)

**Files:**
- Create: `scripts/news/fips-codes.ts`
- Create: `scripts/news/__tests__/fips-codes.test.ts`

FIPS-10-4 (the one GDELT uses) disagrees with ISO 3166-1 alpha-2 on ~40 of the 249 `countries.json` entries. The simplest structure is a `Record<cca3, string | null>` of overrides, plus a fallback to the country's own `cca2` field. An override of `null` marks a country GDELT has no FIPS code for (rare; write empty JSON).

- [ ] **Step 1: Write failing tests**

Create `scripts/news/__tests__/fips-codes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cca3ToFips } from '../fips-codes'

// Spot-check common divergent codes. cca2 passed as second arg is the
// fallback used when the cca3 is not in the override table.
describe('cca3ToFips', () => {
  it('known divergent codes resolve via the override table', () => {
    expect(cca3ToFips('DEU', 'DE')).toBe('GM') // Germany
    expect(cca3ToFips('SWE', 'SE')).toBe('SW') // Sweden
    expect(cca3ToFips('CHN', 'CN')).toBe('CH') // China
    expect(cca3ToFips('CHE', 'CH')).toBe('SZ') // Switzerland
    expect(cca3ToFips('ESP', 'ES')).toBe('SP') // Spain
    expect(cca3ToFips('GBR', 'GB')).toBe('UK') // UK
    expect(cca3ToFips('KOR', 'KR')).toBe('KS') // South Korea
    expect(cca3ToFips('PRK', 'KP')).toBe('KN') // North Korea
    expect(cca3ToFips('AUS', 'AU')).toBe('AS') // Australia
    expect(cca3ToFips('PRT', 'PT')).toBe('PO') // Portugal
  })

  it('cca3 not in overrides falls back to cca2', () => {
    expect(cca3ToFips('USA', 'US')).toBe('US') // identity
    expect(cca3ToFips('FRA', 'FR')).toBe('FR') // identity
    expect(cca3ToFips('ITA', 'IT')).toBe('IT') // identity
    expect(cca3ToFips('CAN', 'CA')).toBe('CA') // identity
  })

  it('returns null when override is explicitly null (no FIPS code)', () => {
    // Fill in an actual null-FIPS cca3 during implementation — one of the
    // disputed-territory or recent-sovereignty cases. For now, the
    // implementation should start with zero nulls; add them during the
    // validation run (Task 4).
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /e/polworldmap-gdelt-migration
npx vitest run scripts/news/__tests__/fips-codes.test.ts 2>&1 | tail -10
```

Expected: failures (module not found).

- [ ] **Step 3: Source the authoritative FIPS 10-4 list**

The FIPS 10-4 list is public-domain. Authoritative source: [NGA GEC](https://geonames.nga.mil/geonames/GNSHome/genc/) or the Wikipedia mirror [List of FIPS country codes](https://en.wikipedia.org/wiki/List_of_FIPS_country_codes). Extract the two-letter FIPS code for each country in `src/data/countries.json`.

Seed the override table with the known divergences below. For every cca3 in countries.json, you need to either:
- Add it to `FIPS_OVERRIDES` if FIPS differs from cca2, OR
- Skip it (falls through to cca2 — correct for the ~210 identity cases).

- [ ] **Step 4: Implement `fips-codes.ts`**

```ts
// cca3 → FIPS-10-4 overrides. Most countries' FIPS code equals their ISO
// 3166-1 alpha-2 code; the entries below are the ~40 cases where they
// diverge, plus `null` for a handful of disputed territories with no FIPS
// code.
//
// Source: FIPS 10-4 list (public domain, via NGA GEC) cross-referenced
// against src/data/countries.json. Validated via scripts/news/_validate-fips.ts
// on <date of validation run>.
const FIPS_OVERRIDES: Record<string, string | null> = {
  // Europe
  DEU: 'GM', // Germany
  SWE: 'SW', // Sweden
  ESP: 'SP', // Spain
  CHE: 'SZ', // Switzerland
  DNK: 'DA', // Denmark
  AUT: 'AU', // Austria — note collision with Australia (Australia is AS)
  SVK: 'LO', // Slovakia
  PRT: 'PO', // Portugal
  IRL: 'EI', // Ireland
  GBR: 'UK', // United Kingdom
  SRB: 'RI', // Serbia
  BGR: 'BU', // Bulgaria
  ROU: 'RO', // Romania
  HRV: 'HR', // Croatia
  TUR: 'TU', // Turkey
  UKR: 'UP', // Ukraine
  RUS: 'RS', // Russia — note collision with Serbia (Serbia is RI)
  ISL: 'IC', // Iceland
  MNE: 'MJ', // Montenegro

  // Asia
  CHN: 'CH', // China
  KOR: 'KS', // South Korea
  PRK: 'KN', // North Korea
  JPN: 'JA', // Japan
  VNM: 'VM', // Vietnam
  BGD: 'BG', // Bangladesh — note collision with Bulgaria (Bulgaria is BU)
  LKA: 'CE', // Sri Lanka
  KAZ: 'KZ', // Kazakhstan
  SGP: 'SN', // Singapore
  PHL: 'RP', // Philippines
  MYS: 'MY', // Malaysia (identity but commonly questioned — explicit to be safe)
  LAO: 'LA', // Laos (identity — explicit to be safe)
  MMR: 'BM', // Myanmar (Burma)
  KHM: 'CB', // Cambodia

  // Middle East
  ISR: 'IS', // Israel — note collision with Iceland (Iceland is IC)
  IRQ: 'IZ', // Iraq
  ARE: 'AE', // UAE (identity but often questioned)
  SYR: 'SY', // Syria (identity)
  YEM: 'YM', // Yemen

  // Africa
  NGA: 'NI', // Nigeria — note collision with Nicaragua (Nicaragua is NU)
  ZAF: 'SF', // South Africa
  NER: 'NG', // Niger — note collision with Nigeria's cca2 code (Nigeria cca2 is NG)
  CIV: 'IV', // Côte d'Ivoire
  TCD: 'CD', // Chad — note collision with DRC
  COD: 'CG', // Democratic Republic of the Congo
  COG: 'CF', // Republic of the Congo
  LBY: 'LY', // Libya (identity — explicit to be safe)

  // Americas
  CHL: 'CI', // Chile — note collision with Côte d'Ivoire (CIV is IV)
  NIC: 'NU', // Nicaragua
  GTM: 'GT', // Guatemala (identity)
  HND: 'HO', // Honduras
  CRI: 'CS', // Costa Rica — note collision with former Czechoslovakia
  PAN: 'PM', // Panama — note collision with Saint-Pierre-et-Miquelon
  URY: 'UY', // Uruguay (identity)
  PRY: 'PA', // Paraguay — note collision with Panama's cca2 (Panama cca2 is PA)

  // Oceania
  NZL: 'NZ', // New Zealand (identity)
  AUS_: 'AS', // Placeholder — REAL Australia is AS; see AUT above for the AU collision.

  // Disputed / no-FIPS
  // Fill in during _validate-fips run (Task 4). Examples (verify each):
  // TWN: 'TW',  // Taiwan — FIPS uses TW
  // PSE: null,  // Palestine — may have no FIPS code depending on edition
}

/**
 * Maps a cca3 country code to its FIPS-10-4 2-letter code.
 *
 * - If cca3 is in FIPS_OVERRIDES: returns the override value (may be null).
 * - Otherwise: returns the passed cca2 code (FIPS ≡ ISO alpha-2 for ~210 entries).
 *
 * Callers should pass the country's cca2 from countries.json as the second arg.
 */
export function cca3ToFips(cca3: string, cca2: string): string | null {
  if (cca3 in FIPS_OVERRIDES) return FIPS_OVERRIDES[cca3]
  return cca2
}
```

NOTE: the example above has a deliberate bug — `AUS_` (with trailing underscore) is a placeholder. When implementing, replace with the real entry **after verifying** via `_validate-fips.ts` what `AUS` should map to. Also note the several collision callouts — they are comments for future-reader sanity, not bugs in the mapping.

- [ ] **Step 5: Remove any `AUS_` placeholder and add `AUS: 'AS'`**

```ts
// Correct entry (replace the AUS_ placeholder):
AUS: 'AS', // Australia
```

- [ ] **Step 6: Run tests — expect pass**

```bash
npx vitest run scripts/news/__tests__/fips-codes.test.ts 2>&1 | tail -10
```

Expected: all spot-check tests pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/news/fips-codes.ts scripts/news/__tests__/fips-codes.test.ts
git commit -m "feat(news): FIPS-10-4 overrides for GDELT location: queries"
```

---

### Task 3: `scripts/news/gdelt-client.ts`

**Files:**
- Create: `scripts/news/gdelt-client.ts`

No tests for this at the unit level — the implementation is a thin HTTP wrapper and is covered end-to-end by the integration run in Task 5. Testing the real API in unit tests would be flaky; mocking `fetch` is low-value.

- [ ] **Step 1: Implement**

```ts
import { sanitise } from './sanitise'

export interface GdeltArticle {
  id: string          // article URL — GDELT has no stable ID
  title: string
  url: string
  publishedAt: string // ISO; normalised from GDELT's "seendate"
  domain: string
  thumbnail: string | null
}

interface GdeltRawArticle {
  url: string
  url_mobile?: string
  title: string
  seendate: string        // YYYYMMDDTHHMMSSZ (e.g. 20260424T021500Z)
  socialimage?: string
  domain: string
  language: string
  sourcecountry?: string
}

interface GdeltResponse {
  articles?: GdeltRawArticle[]
  status?: string
}

const BASE = 'https://api.gdeltproject.org/api/v2/doc/doc'

/**
 * Parses GDELT's "seendate" format (YYYYMMDDTHHMMSSZ) into an ISO timestamp.
 *
 * Example: "20260424T021500Z" → "2026-04-24T02:15:00Z"
 */
function seendateToIso(seendate: string): string {
  if (!/^\d{8}T\d{6}Z$/.test(seendate)) {
    // Unexpected format — return as-is; downstream relativeTime() handles
    // "invalid" gracefully (returns 'just now').
    return seendate
  }
  const y = seendate.slice(0, 4)
  const m = seendate.slice(4, 6)
  const d = seendate.slice(6, 8)
  const hh = seendate.slice(9, 11)
  const mm = seendate.slice(11, 13)
  const ss = seendate.slice(13, 15)
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`
}

export interface GdeltSearchParams {
  fips: string        // 2-letter FIPS-10-4 country code (GDELT locationcc:)
  sourceLang: string  // e.g. 'english' — GDELT uses full English names, not ISO codes
  timespan: string    // e.g. '7d'
  maxRecords: number  // 1..250
}

export async function gdeltSearch(params: GdeltSearchParams): Promise<GdeltArticle[]> {
  // NOTE: verified 2026-04-24 — GDELT's country filter is `locationcc:` (NOT
  // `location:`); language filter uses full English names (`sourcelang:english`,
  // NOT `sourcelang:eng`). Earlier attempts with shorter forms returned either
  // "keyword too short" or "invalid location search" errors.
  const qs = new URLSearchParams({
    query: `locationcc:${params.fips} sourcelang:${params.sourceLang}`,
    mode: 'ArtList',
    maxrecords: String(params.maxRecords),
    timespan: params.timespan,
    sort: 'hybridrel',
    format: 'json',
  })
  const res = await fetch(`${BASE}?${qs}`)
  if (!res.ok) throw new Error(`gdelt location:${params.fips} → HTTP ${res.status}`)
  const data = (await res.json()) as GdeltResponse
  const raw = data.articles ?? []
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
}
```

- [ ] **Step 2: tsc check**

```bash
npx tsc -b 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add scripts/news/gdelt-client.ts
git commit -m "feat(news): GDELT Doc 2.0 search client"
```

---

### Task 4: FIPS validation dry run (one-off)

**Files:**
- Create: `scripts/news/_validate-fips.ts`

This script is NOT part of the daily pipeline. It runs once during implementation to verify each country's FIPS code actually returns GDELT results. Output is a report — any "no results" countries may need their FIPS override re-checked.

- [ ] **Step 1: Implement**

```ts
import countriesFile from '../../src/data/countries.json' with { type: 'json' }
import { cca3ToFips } from './fips-codes'
import { gdeltSearch } from './gdelt-client'

interface Country {
  cca2: string
  cca3: string
  name: { common: string }
}

async function main(): Promise<void> {
  const countries = (countriesFile as { countries: Country[] }).countries
  const noResults: string[] = []
  const nullFips: string[] = []
  const errors: string[] = []

  for (const c of countries) {
    const fips = cca3ToFips(c.cca3, c.cca2)
    if (fips === null) {
      nullFips.push(`${c.cca3} (${c.name.common})`)
      continue
    }
    try {
      const articles = await gdeltSearch({ fips, sourceLang: 'english', timespan: '30d', maxRecords: 1 })
      if (articles.length === 0) {
        noResults.push(`${c.cca3} (${c.name.common}) FIPS=${fips}`)
      }
      await new Promise((r) => setTimeout(r, 500))
    } catch (e) {
      errors.push(`${c.cca3} (${c.name.common}) FIPS=${fips} → ${(e as Error).message}`)
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  console.log('--- null FIPS (skipped) ---')
  console.log(nullFips.join('\n'))
  console.log('\n--- no GDELT results in 30d ---')
  console.log(noResults.join('\n'))
  console.log('\n--- errors ---')
  console.log(errors.join('\n'))
  console.log(`\nSummary: ${countries.length} total; ${nullFips.length} null; ${noResults.length} no-results; ${errors.length} errors`)
}

main().catch((err) => {
  console.error('fatal:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Run the validator**

```bash
npx tsx scripts/news/_validate-fips.ts 2>&1 | tee /tmp/fips-validation.log
```

Expected: ~5-10 min run (249 × 500 ms + parse overhead). Output:
- `null FIPS` — countries with explicit `null` in the override table.
- `no results` — FIPS codes that returned zero articles in 30 days. **These need investigation**: the FIPS code may be wrong, or GDELT genuinely has no English coverage for that country in the last month. For micro-states (Tuvalu, Nauru, Vatican), zero results is expected.

- [ ] **Step 3: Correct any wrong FIPS codes in `fips-codes.ts`**

For each "no results" country from the validator:
1. Look up the authoritative FIPS-10-4 code via Wikipedia's FIPS country-code list.
2. If the override in `fips-codes.ts` matches and the country is a microstate, leave as-is (legitimately no news).
3. If the override differs from the authoritative list, update `fips-codes.ts`.
4. If the country has no FIPS code at all in authoritative sources, set override to `null`.

Re-run the validator after any changes; repeat until all "no results" countries are either confirmed microstates or have `null` overrides.

- [ ] **Step 4: Commit corrections**

```bash
git add scripts/news/_validate-fips.ts scripts/news/fips-codes.ts
git commit -m "chore(news): validate FIPS codes against live GDELT; correct <N> entries"
```

---

### Task 5: Rewrite `scripts/news/build.ts`

**Files:**
- Rewrite: `scripts/news/build.ts`

- [ ] **Step 1: Replace file contents**

```ts
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import countriesFile from '../../src/data/countries.json' with { type: 'json' }
import { cca3ToFips } from './fips-codes'
import { gdeltSearch, type GdeltArticle } from './gdelt-client'

interface Country {
  cca2: string
  cca3: string
  name: { common: string }
}

interface CountryNewsFile {
  updatedAt: string
  country: { cca3: string; name: string }
  articles: GdeltArticle[]
}

const THROTTLE_MS = 500 // GDELT community-polite pacing
const WINDOW = '7d'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function buildCountry(country: Country): Promise<CountryNewsFile> {
  const fips = cca3ToFips(country.cca3, country.cca2)
  let articles: GdeltArticle[] = []
  if (fips !== null) {
    try {
      articles = await gdeltSearch({
        fips,
        sourceLang: 'english',
        timespan: WINDOW,
        maxRecords: 5,
      })
    } catch (err) {
      console.warn(`[news] ${country.cca3} fetch failed: ${(err as Error).message}`)
    }
  }
  return {
    updatedAt: new Date().toISOString(),
    country: { cca3: country.cca3, name: country.name.common },
    articles,
  }
}

async function main(): Promise<void> {
  const countries = (countriesFile as { countries: Country[] }).countries
  const outDir = 'public/news'
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  console.log(`[news] building for ${countries.length} countries`)

  let totalArticles = 0
  for (let i = 0; i < countries.length; i++) {
    const c = countries[i]
    const result = await buildCountry(c)
    const outPath = join(outDir, `${c.cca3}.json`)
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n')
    totalArticles += result.articles.length
    if ((i + 1) % 25 === 0) {
      console.log(`[news] ${i + 1}/${countries.length} done`)
    }
    await sleep(THROTTLE_MS)
  }

  console.log(`[news] complete: ${totalArticles} articles across ${countries.length} files`)
}

main().catch((err) => {
  console.error('[news] fatal:', err)
  process.exit(1)
})
```

- [ ] **Step 2: tsc check**

```bash
npx tsc -b 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add scripts/news/build.ts
git commit -m "feat(news): rewrite build.ts for GDELT (no fallback, no key)"
```

---

### Task 6: Delete Guardian modules

**Files:**
- Delete: `scripts/news/guardian-client.ts`
- Delete: `scripts/news/guardian-tags.ts`
- Delete: `scripts/news/regions.ts`
- Delete: `scripts/news/__tests__/regions.test.ts`

- [ ] **Step 1: Check for remaining callers**

```bash
grep -rn "guardian-client\|guardian-tags\|regions" scripts/news/ src/ 2>/dev/null | grep -v "\.md$\|test\.ts$"
```

Expected output: only the files about to be deleted reference each other. If anything else imports them (shouldn't, but verify), fix first.

- [ ] **Step 2: Delete**

```bash
rm scripts/news/guardian-client.ts scripts/news/guardian-tags.ts scripts/news/regions.ts scripts/news/__tests__/regions.test.ts
```

- [ ] **Step 3: tsc + unit**

```bash
npx tsc -b 2>&1 | tail -3
npm run test:unit 2>&1 | tail -3
```

Expected: clean; unit suite shows −7 tests (regions deleted), +10 fips tests from Task 2 = +3 net.

- [ ] **Step 4: Commit**

```bash
git add -u scripts/news/
git commit -m "chore(news): remove Guardian-specific modules"
```

---

### Task 7: Rewrite `CountryNewsSection.tsx` + tests

**Files:**
- Rewrite: `src/components/CountryNewsSection.tsx`
- Rewrite: `src/components/__tests__/CountryNewsSection.test.tsx`

- [ ] **Step 1: Rewrite the component**

```tsx
import { useEffect, useState } from 'react'
import { relativeTime } from '../lib/relativeTime'

interface Article {
  id: string
  title: string
  url: string
  publishedAt: string
  domain: string
  thumbnail: string | null
}

interface CountryNewsFile {
  updatedAt: string
  country: { cca3: string; name: string }
  articles: Article[]
}

type Status = 'loading' | 'ready' | 'error'

interface Props {
  cca3: string
}

export function CountryNewsSection({ cca3 }: Props) {
  const [status, setStatus] = useState<Status>('loading')
  const [data, setData] = useState<CountryNewsFile | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setData(null)
    fetch(`/news/${cca3}.json`, { cache: 'default' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        if (cancelled) return
        setData(json as CountryNewsFile)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })
    return () => { cancelled = true }
  }, [cca3])

  return (
    <div data-testid="country-news-section" className="mt-6 pt-4 border-t border-sand-200/50 dark:border-dark-200/20">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-teal-accessible dark:text-teal-light mb-3">
        Recent news (last 7 days)
      </h3>

      {status === 'loading' && (
        <p className="text-xs text-sand-600 dark:text-dark-100">Loading news…</p>
      )}

      {status === 'error' && (
        <p className="text-xs text-sand-600 dark:text-dark-100">News unavailable.</p>
      )}

      {status === 'ready' && data && data.articles.length === 0 && (
        <p className="text-xs text-sand-600 dark:text-dark-100">
          No recent English-language news about this country in the last 7 days.
        </p>
      )}

      {status === 'ready' && data && data.articles.length > 0 && (
        <>
          <ul className="space-y-3">
            {data.articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </ul>
          <p className="mt-4 text-[10px] text-sand-500 dark:text-dark-100">
            News data via{' '}
            <a
              href="https://www.gdeltproject.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-teal-accessible dark:hover:text-teal-light"
            >
              the GDELT Project
            </a>.
          </p>
        </>
      )}
    </div>
  )
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <li>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-3 p-2 -mx-2 rounded-lg hover:bg-sand-100/50 dark:hover:bg-dark-300/50 transition-colors"
      >
        {article.thumbnail && (
          <img
            src={article.thumbnail}
            alt=""
            width={64}
            height={48}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-16 h-12 rounded object-cover shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-sand-900 dark:text-dark-50 line-clamp-2">
            {article.title}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-sand-500 dark:text-dark-100">
            <span className="font-medium">{article.domain}</span>
            <span aria-hidden>·</span>
            <span>{relativeTime(article.publishedAt)}</span>
          </div>
        </div>
      </a>
    </li>
  )
}
```

- [ ] **Step 2: Rewrite tests**

Replace contents of `src/components/__tests__/CountryNewsSection.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CountryNewsSection } from '../CountryNewsSection'

function mockFetch(response: unknown, status = 200): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
  } as Response) as unknown as typeof fetch
}

describe('CountryNewsSection', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('renders loading state while fetch in flight', () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch
    render(<CountryNewsSection cca3="DEU" />)
    expect(screen.getByText(/Loading news/i)).toBeTruthy()
  })

  it('renders 5 article links with domain and relative time', async () => {
    mockFetch({
      updatedAt: '2026-04-24T06:00:00.000Z',
      country: { cca3: 'DEU', name: 'Germany' },
      articles: [1, 2, 3, 4, 5].map((i) => ({
        id: `https://www.bbc.com/story-${i}`,
        title: `Story ${i}`,
        url: `https://www.bbc.com/story-${i}`,
        publishedAt: `2026-04-2${i}T12:00:00.000Z`,
        domain: 'bbc.com',
        thumbnail: null,
      })),
    })
    render(<CountryNewsSection cca3="DEU" />)
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(6)) // 5 articles + GDELT attribution link
    expect(screen.getByText('Story 1')).toBeTruthy()
    expect(screen.getAllByText('bbc.com').length).toBeGreaterThan(0)
  })

  it('renders GDELT attribution link when articles present', async () => {
    mockFetch({
      updatedAt: '2026-04-24T06:00:00.000Z',
      country: { cca3: 'DEU', name: 'Germany' },
      articles: [
        {
          id: 'https://www.bbc.com/a',
          title: 'Story',
          url: 'https://www.bbc.com/a',
          publishedAt: '2026-04-23T12:00:00.000Z',
          domain: 'bbc.com',
          thumbnail: null,
        },
      ],
    })
    render(<CountryNewsSection cca3="DEU" />)
    await waitFor(() => {
      expect(screen.getByText(/GDELT Project/i)).toBeTruthy()
    })
  })

  it('renders updated empty-state line when articles is empty', async () => {
    mockFetch({
      updatedAt: '2026-04-24T06:00:00.000Z',
      country: { cca3: 'TUV', name: 'Tuvalu' },
      articles: [],
    })
    render(<CountryNewsSection cca3="TUV" />)
    await waitFor(() => {
      expect(screen.getByText(/No recent English-language news/i)).toBeTruthy()
    })
  })

  it('renders "News unavailable" on 404', async () => {
    mockFetch({}, 404)
    render(<CountryNewsSection cca3="XXX" />)
    await waitFor(() => expect(screen.getByText(/News unavailable/i)).toBeTruthy())
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/components/__tests__/CountryNewsSection.test.tsx 2>&1 | tail -10
```

Expected: 5/5 pass.

- [ ] **Step 4: Full unit + tsc**

```bash
npx tsc -b 2>&1 | tail -3
npm run test:unit 2>&1 | tail -3
```

Expected: clean; existing tests unchanged count except for the component test diff.

- [ ] **Step 5: Commit**

```bash
git add src/components/CountryNewsSection.tsx src/components/__tests__/CountryNewsSection.test.tsx
git commit -m "feat(news): adapt CountryNewsSection to GDELT shape; add GDELT attribution"
```

---

### Task 8: Update E2E spec

**Files:**
- Rewrite: `e2e/country-news.spec.ts`

- [ ] **Step 1: Rewrite the fixtures + assertions**

```ts
import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

async function stubNewsDEU(page: Page) {
  await page.route('**/news/DEU.json', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        updatedAt: new Date().toISOString(),
        country: { cca3: 'DEU', name: 'Germany' },
        articles: [
          {
            id: 'https://www.bbc.com/germany-coalition',
            title: 'Germany coalition reached',
            url: 'https://www.bbc.com/germany-coalition',
            publishedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
            domain: 'bbc.com',
            thumbnail: null,
          },
          {
            id: 'https://www.reuters.com/eu-summit',
            title: 'EU summit concludes',
            url: 'https://www.reuters.com/eu-summit',
            publishedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
            domain: 'reuters.com',
            thumbnail: null,
          },
        ],
      }),
    })
  })
}

test.describe('Country news feed', () => {
  test('renders articles with domain label + GDELT attribution', async ({ page }) => {
    await stubNewsDEU(page)
    await page.goto('/#DEU')
    await waitForMap(page)
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('country-news-section')).toBeVisible({ timeout: 5_000 })

    const section = page.getByTestId('country-news-section')
    // 2 article links + 1 GDELT attribution link = 3 links total
    await expect(section.getByRole('link')).toHaveCount(3, { timeout: 5_000 })

    // Domain labels visible
    await expect(section.getByText('bbc.com')).toBeVisible()
    await expect(section.getByText('reuters.com')).toBeVisible()

    // GDELT attribution
    await expect(section.getByText(/GDELT Project/i)).toBeVisible()

    // External link behavior
    const firstArticleLink = section.getByRole('link').first()
    await expect(firstArticleLink).toHaveAttribute('target', '_blank')
    const rel = await firstArticleLink.getAttribute('rel')
    expect(rel ?? '').toContain('noopener')
  })

  test('renders empty state when articles array is empty', async ({ page }) => {
    await page.route('**/news/TUV.json', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          updatedAt: new Date().toISOString(),
          country: { cca3: 'TUV', name: 'Tuvalu' },
          articles: [],
        }),
      })
    })
    await page.goto('/#TUV')
    await waitForMap(page)
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByTestId('country-news-section').getByText(/No recent English-language news/i),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('renders "News unavailable" on 404', async ({ page }) => {
    await page.route('**/news/FRA.json', (route) => route.fulfill({ status: 404 }))
    await page.goto('/#FRA')
    await waitForMap(page)
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByTestId('country-news-section').getByText(/News unavailable/i),
    ).toBeVisible({ timeout: 5_000 })
  })
})
```

- [ ] **Step 2: Run locally 3×**

```bash
cd /e/polworldmap-gdelt-migration
for i in 1 2 3; do
  echo "=== Run $i ==="
  npx playwright test --project=chromium --retries=0 e2e/country-news.spec.ts 2>&1 | tail -8
done
```

Expected: 3/3 pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/country-news.spec.ts
git commit -m "test(e2e): update country-news fixtures to GDELT shape"
```

---

### Task 9: GHA workflow + docs update

**Files:**
- Modify: `.github/workflows/news.yml`
- Rewrite: `docs/systems/country-news.md`

- [ ] **Step 1: Remove GUARDIAN_KEY env ref from news.yml**

Current step:

```yaml
      - name: Build news
        env:
          GUARDIAN_KEY: ${{ secrets.GUARDIAN_KEY }}
        run: npm run news:build
```

Replace with:

```yaml
      - name: Build news
        run: npm run news:build
```

(GDELT needs no API key.)

- [ ] **Step 2: Rewrite `docs/systems/country-news.md`**

Replace contents:

```markdown
# Country News Feed — System Overview

A build-time pipeline that fetches per-country news from [GDELT 2.0's Doc API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/)
and writes static JSON to `public/news/<cca3>.json`. The
`CountryNewsSection` component in `src/components/` renders the result at
the bottom of `SingleCountryPanel` whenever a user clicks a country.

## Pipeline

```
.github/workflows/news.yml  (cron: 0 6 * * *)
  └─ scripts/news/build.ts
       ├─ iterates src/data/countries.json (249 entries)
       ├─ for each country: gdeltSearch(fips=<FIPS>, sourceLang=english, timespan=7d, maxRecords=5)
       └─ writes public/news/<cca3>.json
  └─ git commit + push → deploy.yml → gh-pages
```

- **No API key required.** GDELT's Doc API is unauthenticated.
- **License:** GDELT Project data is "available for unlimited and
  unrestricted use for any academic, commercial, or governmental use of
  any kind without fee" per gdeltproject.org/about.html. Commercial use
  (including ad-supported) is explicitly allowed.
- **Throttle:** 500 ms between calls (community-polite; GDELT hasn't
  published a hard rate limit). Full run ≈ 2 min.

## FIPS country codes

GDELT's `location:` query uses FIPS-10-4 2-letter codes, not ISO 3166-1
alpha-2. They agree for ~210 of 249 `countries.json` entries; the rest
are handled by `scripts/news/fips-codes.ts`'s override table.

To add or correct a FIPS mapping:

1. Look up the authoritative code on
   [Wikipedia's FIPS 10-4 list](https://en.wikipedia.org/wiki/List_of_FIPS_country_codes)
   or via NGA's GEC database.
2. Add/update the entry in `FIPS_OVERRIDES`.
3. Re-run `npx tsx scripts/news/_validate-fips.ts` to confirm the code
   returns GDELT results.

## Output JSON shape

```ts
interface CountryNewsFile {
  updatedAt: string
  country: { cca3: string; name: string }
  articles: {
    id: string         // article URL
    title: string      // sanitised
    url: string        // article URL
    publishedAt: string // ISO
    domain: string     // e.g. "bbc.com"
    thumbnail: string | null
  }[]
}
```

## Operational notes

- GDELT API down during a run → GHA fails, no deploy, existing
  `public/news/*.json` stays live. Users see yesterday's data.
- Per-country fetch error → logged, previous JSON kept, next country
  continues.
- Country with no FIPS code → `articles: []`; client renders empty state.
- Thumbnail from blocked outlet → `<img>` shows alt; text-only fallback.

## Rollback

1. Revert the migration merge commit on `main`.
2. `deploy.yml` republishes gh-pages with the previous Guardian pipeline
   state IF the Guardian modules were still available; otherwise the
   news section shows "News unavailable" until the previous GDELT build
   files regenerate.
3. To disable the feature entirely: `gh workflow disable news.yml`.
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/news.yml docs/systems/country-news.md
git commit -m "docs(news): rewrite systems doc for GDELT; drop GUARDIAN_KEY from GHA"
```

---

### Task 10: Regenerate 249 JSON files locally + commit

**Files:**
- `public/news/<cca3>.json` × 249 (regenerated).

- [ ] **Step 1: Run build locally**

```bash
cd /e/polworldmap-gdelt-migration
npm run news:build 2>&1 | tail -20
```

No API key needed. Expected: ~2 min, output logs progress every 25 countries, final line `[news] complete: N articles across 249 files`.

- [ ] **Step 2: Inspect a few files**

```bash
cat public/news/DEU.json | head -20
cat public/news/USA.json | head -20
cat public/news/TUV.json | head -20
```

Expected:
- DEU / USA: 5 articles, `domain` field present, no `guardianTag`/`section`/`scope`/`trailText`.
- TUV: likely empty `articles: []`.

- [ ] **Step 3: Check diff size**

```bash
git status -s public/news/ | wc -l
git diff --stat public/news/ | tail -5
```

Expected: ~249 files modified (249 entries each rewritten). Each file is small (~1-3 KB). Total diff in the tens of KB.

- [ ] **Step 4: Commit**

```bash
git add public/news/
git commit -m "feat(news): regenerate 249 per-country JSON from GDELT"
```

---

### Task 11: Validation + push + PR

**Files:** none.

- [ ] **Step 1: Full unit + tsc**

```bash
cd /e/polworldmap-gdelt-migration
npm run test:unit 2>&1 | tail -3
npx tsc -b 2>&1 | tail -3
```

Expected: clean. Net unit-test count change: +10 (fips) −7 (regions) = +3.

- [ ] **Step 2: Full chromium project**

```bash
npx playwright test --project=chromium --retries=0 --workers=2 2>&1 | tail -5
```

Expected: fully green. Pre-existing search / launcher.spec:83 flakes may recur — flag but do not block unless `country-news` spec itself flakes.

- [ ] **Step 3: chromium-gpu sanity**

```bash
npx playwright test --project=chromium-gpu --retries=0 2>&1 | tail -5
```

Expected: green.

- [ ] **Step 4: Push**

```bash
git push -u origin chore/gdelt-migration 2>&1 | tail -5
```

- [ ] **Step 5: Open PR**

```bash
gh pr create --base main --title "chore(news): migrate Guardian → GDELT for commercial-use compatibility" --body "$(cat <<'EOF'
## Summary

Replaces Guardian Open Platform with GDELT 2.0's Doc API as the country-news source. Unblocks commercial monetisation (Guardian's free tier forbids commercial use; GDELT is open-data CC/commercial-OK).

- `scripts/news/fips-codes.ts` — cca3 → FIPS-10-4 overrides (~40 entries) + cca2 fallback.
- `scripts/news/gdelt-client.ts` — GDELT Doc 2.0 wrapper with `locationcc:<FIPS> sourcelang:english` query.
- `scripts/news/build.ts` — rewritten: single query per country, no region fallback, 500 ms throttle.
- **Deleted:** `guardian-client.ts`, `guardian-tags.ts`, `regions.ts` (+ their tests).
- `CountryNewsSection` adapted: drop trailText row; replace section badge with source domain; add GDELT attribution footer; updated empty-state copy.
- `news.yml` no longer references `GUARDIAN_KEY` secret.
- 249 `public/news/*.json` files regenerated in this PR — users see fresh GDELT data on merge.

## Why

Spec: `docs/superpowers/specs/2026-04-24-gdelt-migration-design.md`.
Plan: `docs/superpowers/plans/2026-04-24-gdelt-migration.md`.

Guardian's Open Platform free tier TOS restricts use to non-commercial; enabling ads on funworldmap violates those terms. GDELT is explicitly commercial-OK and has broader coverage.

## Post-merge cleanup

Remove the now-unused secret:

```
gh secret delete GUARDIAN_KEY
```

(GHA silently ignores unreferenced secrets; this is cosmetic.)

## Test Plan

- [ ] CI `lint + type + unit`, `e2e (chromium)`, `e2e (chromium-gpu)` all green
- [ ] Manual: click Germany → news section renders real GDELT articles with domain labels
- [ ] Manual: click Tuvalu → empty-state line renders
- [ ] Manual: GDELT attribution visible at bottom of news section when articles present

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -5
```

- [ ] **Step 6: Watch CI**

```bash
gh pr checks $(gh pr view --json number --jq .number) --watch
```

Expected green; if pre-existing search flake, re-run chromium once.

- [ ] **Step 7: Hand off to `finishing-a-development-branch`**

Present the 4-option menu.

---

## Self-review notes

- **Spec coverage:** GDELT source → Task 3. FIPS overrides → Task 2. Query shape `locationcc:<FIPS> sourcelang:english` → Task 3 Step 1 + Task 5. No region fallback → Task 5. UI drop trailText + domain badge + attribution → Task 7. Delete Guardian modules → Task 6. GHA key removal → Task 9. Initial JSON regen → Task 10. FIPS validation runner → Task 4.
- **Placeholder scan:** the `AUS_` placeholder in Task 2 Step 4 is deliberate — Step 5 immediately replaces it. The "fill in during _validate-fips run" comment for nulls at the bottom of FIPS_OVERRIDES is the explicit handoff to Task 4's iterative validation. Every other step has concrete code or command.
- **Type consistency:** `GdeltArticle` shape flows from `gdelt-client.ts` (Task 3) → `build.ts` (Task 5) → output JSON shape → `CountryNewsSection`'s local `Article` interface (Task 7) → e2e fixtures (Task 8). Field names `id`, `title`, `url`, `publishedAt`, `domain`, `thumbnail` are consistent throughout.
- **Shelf-readiness:** pre-flight Task 1 Step 4 re-verifies GDELT schema before execution — protects against drift. All other tasks depend on that verification passing. If GDELT changes its response shape between now and execution, pre-flight fails and the spec gets revised before any code lands.
