> **Tombstone (2026-06-12):** the country-news feature this plan concerns was removed in PR #40 (2026-05-12). Kept unmodified for history — do not implement from it.

# Country News Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a "Recent news (last 7 days)" section at the bottom of `SingleCountryPanel`, fed by a daily scheduled GHA that fetches Guardian Open Platform articles per country and writes static JSON to `public/news/<cca3>.json`.

**Architecture:** No runtime backend. A build-time pipeline (GHA + `scripts/news/build.ts`) iterates all 249 entries in `src/data/countries.json`, calls `content.guardianapis.com/search` with a `world/<country>` tag, falls back to the Guardian region tag (`world/africa` / `world/americas` / `world/asia-pacific` / `world/europe` / `world/middleeast`) to top up to 5 stories, sanitises the `trailText` + decodes HTML entities, and writes the result to `public/news/<cca3>.json`. The client's new `CountryNewsSection` fetches that file on panel open and renders up to 5 article cards with country / region scope badges and a relative-time formatter.

**Tech Stack:** TypeScript, `tsx` (existing script runner), React 19, Playwright. No new npm deps.

**Spec:** [`2026-04-23-country-news-feed-design.md`](../specs/2026-04-23-country-news-feed-design.md).

---

## Pre-flight — user action before starting

Before Task 1, the user must:

1. **Register a Guardian Open Platform developer key** at `open-platform.theguardian.com/access/`. Free, non-commercial use; email verification only.
2. **Add the key as a GitHub Actions secret**:
   ```
   gh secret set GUARDIAN_KEY --body "<key>"
   ```
   (Or via the GitHub UI: Settings → Secrets and variables → Actions → New secret, name `GUARDIAN_KEY`.)
3. **(Optional, for Task 7) Export locally**:
   ```powershell
   $env:GUARDIAN_KEY = '<key>'
   ```
   If provided locally, Task 7 commits the initial 249 JSON files with the PR so users see real news on merge. If not provided, Task 7 is skipped and the GHA's first scheduled run (next 06:00 UTC, or a manual `gh workflow run news.yml` right after merge) populates `public/news/` — clients see "News unavailable" for that gap.

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `scripts/news/regions.ts` | Create (~25 LOC) | region → Guardian region tag lookup |
| `scripts/news/sanitise.ts` | Create (~25 LOC) | Strip HTML tags + decode entities |
| `scripts/news/__tests__/sanitise.test.ts` | Create | Unit tests |
| `scripts/news/guardian-tags.ts` | Create (~80 LOC seed + room to grow) | cca3 → Guardian tag lookup — seeded with ~40 major countries; rest null until expanded |
| `scripts/news/guardian-client.ts` | Create (~60 LOC) | Guardian `/search` wrapper + result normalisation |
| `scripts/news/build.ts` | Create (~120 LOC) | Main build — iterate countries, call Guardian, apply region fallback, write per-country JSON |
| `scripts/news/__tests__/regions.test.ts` | Create | Unit test for region map |
| `src/lib/relativeTime.ts` | Create (~30 LOC) | Hand-rolled "N days ago" formatter |
| `src/lib/__tests__/relativeTime.test.ts` | Create | Unit tests for bucket boundaries |
| `src/components/CountryNewsSection.tsx` | Create (~90 LOC) | Presentational: fetch + render |
| `src/components/__tests__/CountryNewsSection.test.tsx` | Create | Unit tests: loading / error / empty / populated |
| `src/components/SingleCountryPanel.tsx` | Modify (+3 LOC) | Mount `<CountryNewsSection>` gated on `!inGameRound` |
| `.github/workflows/news.yml` | Create | Schedule + run + commit |
| `package.json` | Modify (+1 line) | `"news:build": "tsx scripts/news/build.ts"` |
| `e2e/country-news.spec.ts` | Create | E2E: stub, assert rendering |
| `playwright.config.ts` | Modify (+1 line) | Add spec to chromium testMatch |
| `docs/systems/country-news.md` | Create (~100 LOC) | Key rotation + operational notes |
| `public/news/<cca3>.json` | Generated (249 files) | Per-country news data — Task 7 (if key provided) or post-merge GHA |

No new dependencies.

---

### Task 1: Worktree setup + confirm pre-flight

**Files:** new worktree at `../polworldmap-country-news`.

- [ ] **Step 1: Create worktree**

```bash
git worktree add ../polworldmap-country-news -b feat/country-news-feed main
```

- [ ] **Step 2: Install deps**

```bash
cd /e/polworldmap-country-news
npm install 2>&1 | tail -3
```

- [ ] **Step 3: Baseline sanity**

```bash
npm run test:unit 2>&1 | tail -3
npx tsc -b 2>&1 | tail -3
```

Expected: all pass, tsc clean.

- [ ] **Step 4: Verify Guardian key availability**

```bash
if [[ -n "$GUARDIAN_KEY" ]]; then echo "key present — Task 7 will commit initial data"; else echo "no key — Task 7 will be skipped"; fi
```

If no key, Task 7 is skipped. Post-merge the user must add `GUARDIAN_KEY` secret in GitHub Actions and run `gh workflow run news.yml` or wait for the next 06:00 UTC cron.

---

### Task 2: `scripts/news/regions.ts` + `sanitise.ts` (TDD)

**Files:**
- Create: `scripts/news/regions.ts`
- Create: `scripts/news/sanitise.ts`
- Test: `scripts/news/__tests__/regions.test.ts`
- Test: `scripts/news/__tests__/sanitise.test.ts`

- [ ] **Step 1: Write sanitise tests**

Create `scripts/news/__tests__/sanitise.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sanitise } from '../sanitise'

describe('sanitise', () => {
  it('leaves plain text untouched', () => {
    expect(sanitise('Hello world')).toBe('Hello world')
  })
  it('strips HTML tags', () => {
    expect(sanitise('<p>Hello <strong>world</strong></p>')).toBe('Hello world')
  })
  it('handles nested tags', () => {
    expect(sanitise('<div><p>a <em>b</em> c</p></div>')).toBe('a b c')
  })
  it('decodes named HTML entities', () => {
    expect(sanitise('Cats &amp; dogs')).toBe('Cats & dogs')
    expect(sanitise('&quot;hi&quot;')).toBe('"hi"')
    expect(sanitise('&lt;tag&gt;')).toBe('<tag>')
    expect(sanitise('&apos;quote&apos;')).toBe("'quote'")
    expect(sanitise('&nbsp;')).toBe(' ')
  })
  it('decodes numeric HTML entities', () => {
    expect(sanitise('hello&#8217;s world')).toBe('hello’s world')
  })
  it('decodes hex HTML entities', () => {
    expect(sanitise('hello&#x2019;s world')).toBe('hello’s world')
  })
  it('collapses whitespace', () => {
    expect(sanitise('<p>  hello   world  </p>')).toBe('hello world')
  })
  it('returns empty string on nullish input', () => {
    expect(sanitise('')).toBe('')
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
cd /e/polworldmap-country-news
npx vitest run scripts/news/__tests__/sanitise.test.ts 2>&1 | tail -10
```

Expected: module not found.

- [ ] **Step 3: Implement `sanitise.ts`**

```ts
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
}

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[\da-fA-F]+|[a-zA-Z]+);/g, (match, inner) => {
    if (inner.startsWith('#x') || inner.startsWith('#X')) {
      const code = parseInt(inner.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (inner.startsWith('#')) {
      const code = parseInt(inner.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[inner] ?? match
  })
}

export function sanitise(html: string): string {
  if (!html) return ''
  const stripped = html.replace(/<[^>]+>/g, '')
  const decoded = decodeEntities(stripped)
  return decoded.replace(/\s+/g, ' ').trim()
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run scripts/news/__tests__/sanitise.test.ts 2>&1 | tail -5
```

Expected: 8/8 pass.

- [ ] **Step 5: Write regions tests**

Create `scripts/news/__tests__/regions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { regionToGuardianTag } from '../regions'

describe('regionToGuardianTag', () => {
  it('Africa → world/africa', () => {
    expect(regionToGuardianTag('Africa')).toBe('world/africa')
  })
  it('Europe → world/europe', () => {
    expect(regionToGuardianTag('Europe')).toBe('world/europe')
  })
  it('Asia → world/asia-pacific', () => {
    expect(regionToGuardianTag('Asia')).toBe('world/asia-pacific')
  })
  it('Oceania → world/asia-pacific', () => {
    expect(regionToGuardianTag('Oceania')).toBe('world/asia-pacific')
  })
  it('Americas → null (no Guardian region tag)', () => {
    expect(regionToGuardianTag('Americas')).toBeNull()
  })
  it('Antarctic → null', () => {
    expect(regionToGuardianTag('Antarctic')).toBeNull()
  })
  it('unknown region → null', () => {
    expect(regionToGuardianTag('Martian' as never)).toBeNull()
  })
})
```

- [ ] **Step 6: Implement `regions.ts`**

```ts
export type Region = 'Africa' | 'Americas' | 'Asia' | 'Europe' | 'Oceania' | 'Antarctic'

const REGION_TAG: Record<Region, string | null> = {
  Africa: 'world/africa',
  Europe: 'world/europe',
  Asia: 'world/asia-pacific',
  Oceania: 'world/asia-pacific',
  Americas: null,
  Antarctic: null,
}

export function regionToGuardianTag(region: string): string | null {
  return (REGION_TAG as Record<string, string | null>)[region] ?? null
}
```

- [ ] **Step 7: Run tests — expect pass**

```bash
npx vitest run scripts/news/__tests__/regions.test.ts 2>&1 | tail -5
```

Expected: 7/7 pass.

- [ ] **Step 8: Commit**

```bash
git add scripts/news/regions.ts scripts/news/sanitise.ts scripts/news/__tests__/regions.test.ts scripts/news/__tests__/sanitise.test.ts
git commit -m "feat(news): sanitise helper + region → Guardian tag map"
```

---

### Task 3: `src/lib/relativeTime.ts` (TDD)

**Files:**
- Create: `src/lib/relativeTime.ts`
- Test: `src/lib/__tests__/relativeTime.test.ts`

- [ ] **Step 1: Write tests**

Create `src/lib/__tests__/relativeTime.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { relativeTime } from '../relativeTime'

const NOW = Date.UTC(2026, 3, 23, 12, 0, 0) // 2026-04-23T12:00:00Z

describe('relativeTime', () => {
  it('< 60 s → "just now"', () => {
    expect(relativeTime(new Date(NOW - 30_000).toISOString(), NOW)).toBe('just now')
  })
  it('1-59 min → "N minutes ago"', () => {
    expect(relativeTime(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe('5 minutes ago')
    expect(relativeTime(new Date(NOW - 1 * 60_000).toISOString(), NOW)).toBe('1 minute ago')
  })
  it('1-23 h → "N hours ago"', () => {
    expect(relativeTime(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe('3 hours ago')
    expect(relativeTime(new Date(NOW - 1 * 3_600_000).toISOString(), NOW)).toBe('1 hour ago')
  })
  it('1-6 d → "N days ago"', () => {
    expect(relativeTime(new Date(NOW - 2 * 86_400_000).toISOString(), NOW)).toBe('2 days ago')
    expect(relativeTime(new Date(NOW - 1 * 86_400_000).toISOString(), NOW)).toBe('1 day ago')
  })
  it('>= 7 d → absolute YYYY-MM-DD', () => {
    expect(relativeTime(new Date(NOW - 8 * 86_400_000).toISOString(), NOW)).toBe('2026-04-15')
  })
  it('future date (clock skew) → "just now"', () => {
    expect(relativeTime(new Date(NOW + 5000).toISOString(), NOW)).toBe('just now')
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npx vitest run src/lib/__tests__/relativeTime.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: Implement**

```ts
export function relativeTime(iso: string, nowMs: number = Date.now()): string {
  const then = new Date(iso).getTime()
  const diffMs = Math.max(0, nowMs - then)
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`
  const d = new Date(then)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/lib/__tests__/relativeTime.test.ts 2>&1 | tail -5
```

Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/relativeTime.ts src/lib/__tests__/relativeTime.test.ts
git commit -m "feat(lib): relativeTime — 'N days ago' formatter"
```

---

### Task 4: `scripts/news/guardian-client.ts` + seed `guardian-tags.ts`

**Files:**
- Create: `scripts/news/guardian-client.ts`
- Create: `scripts/news/guardian-tags.ts`

- [ ] **Step 1: Create `guardian-tags.ts` with ~40 major-country seeds**

```ts
// cca3 → Guardian tag lookup. Major countries seeded; rest fall through to null
// and use the region fallback. Extend by running a one-off discovery against
// Guardian's /tags endpoint — see docs/systems/country-news.md.

export const GUARDIAN_TAGS: Record<string, string> = {
  // North America
  USA: 'us-news',
  CAN: 'world/canada',
  MEX: 'world/mexico',
  // South America
  BRA: 'world/brazil',
  ARG: 'world/argentina',
  CHL: 'world/chile',
  COL: 'world/colombia',
  VEN: 'world/venezuela',
  PER: 'world/peru',
  // Europe
  GBR: 'world/uk',
  DEU: 'world/germany',
  FRA: 'world/france',
  ITA: 'world/italy',
  ESP: 'world/spain',
  POL: 'world/poland',
  UKR: 'world/ukraine',
  RUS: 'world/russia',
  NLD: 'world/netherlands',
  BEL: 'world/belgium',
  CHE: 'world/switzerland',
  AUT: 'world/austria',
  SWE: 'world/sweden',
  NOR: 'world/norway',
  DNK: 'world/denmark',
  FIN: 'world/finland',
  IRL: 'world/ireland',
  PRT: 'world/portugal',
  GRC: 'world/greece',
  TUR: 'world/turkey',
  // Asia
  CHN: 'world/china',
  JPN: 'world/japan',
  KOR: 'world/southkorea',
  PRK: 'world/north-korea',
  IND: 'world/india',
  PAK: 'world/pakistan',
  BGD: 'world/bangladesh',
  IDN: 'world/indonesia',
  THA: 'world/thailand',
  VNM: 'world/vietnam',
  PHL: 'world/philippines',
  MYS: 'world/malaysia',
  SGP: 'world/singapore',
  // Middle East
  ISR: 'world/israel',
  PSE: 'world/palestine',
  IRN: 'world/iran',
  IRQ: 'world/iraq',
  SYR: 'world/syria',
  SAU: 'world/saudiarabia',
  ARE: 'world/united-arab-emirates',
  EGY: 'world/egypt',
  // Africa
  NGA: 'world/nigeria',
  ZAF: 'world/south-africa',
  KEN: 'world/kenya',
  ETH: 'world/ethiopia',
  GHA: 'world/ghana',
  // Oceania
  AUS: 'world/australia',
  NZL: 'world/new-zealand',
}

export function cca3ToGuardianTag(cca3: string): string | null {
  return GUARDIAN_TAGS[cca3] ?? null
}
```

- [ ] **Step 2: Create `guardian-client.ts`**

```ts
import { sanitise } from './sanitise'

export interface GuardianArticle {
  id: string
  title: string
  trailText: string
  url: string
  publishedAt: string
  section: string
  thumbnail: string | null
}

interface GuardianRawResult {
  id: string
  sectionId: string
  webPublicationDate: string
  webTitle: string
  webUrl: string
  fields?: { trailText?: string; thumbnail?: string }
}

interface GuardianResponse {
  response: {
    status: string
    results: GuardianRawResult[]
  }
}

const BASE = 'https://content.guardianapis.com/search'

export async function guardianSearch(params: {
  tag: string
  fromDate: string // YYYY-MM-DD
  pageSize: number
  apiKey: string
}): Promise<GuardianArticle[]> {
  const qs = new URLSearchParams({
    tag: params.tag,
    'from-date': params.fromDate,
    'order-by': 'newest',
    'page-size': String(params.pageSize),
    'show-fields': 'trailText,thumbnail',
    'api-key': params.apiKey,
  })
  const res = await fetch(`${BASE}?${qs}`)
  if (!res.ok) throw new Error(`guardian ${params.tag} → HTTP ${res.status}`)
  const data = (await res.json()) as GuardianResponse
  if (data.response.status !== 'ok') {
    throw new Error(`guardian ${params.tag} → status=${data.response.status}`)
  }
  return data.response.results.map((r) => ({
    id: r.id,
    title: sanitise(r.webTitle),
    trailText: sanitise(r.fields?.trailText ?? ''),
    url: r.webUrl,
    publishedAt: r.webPublicationDate,
    section: r.sectionId,
    thumbnail: r.fields?.thumbnail ?? null,
  }))
}
```

- [ ] **Step 3: tsc check**

```bash
npx tsc -b 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add scripts/news/guardian-client.ts scripts/news/guardian-tags.ts
git commit -m "feat(news): Guardian search client + cca3 tag seed table"
```

---

### Task 5: `scripts/news/build.ts` + GHA workflow

**Files:**
- Create: `scripts/news/build.ts`
- Modify: `package.json` (add `news:build` script)
- Create: `.github/workflows/news.yml`

- [ ] **Step 1: Add script entry to `package.json`**

In `package.json` `"scripts"` block, add alongside existing `daily:generate`:

```json
"news:build": "tsx scripts/news/build.ts",
```

- [ ] **Step 2: Create `scripts/news/build.ts`**

```ts
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import countriesFile from '../../src/data/countries.json' with { type: 'json' }
import { cca3ToGuardianTag } from './guardian-tags'
import { regionToGuardianTag } from './regions'
import { guardianSearch, type GuardianArticle } from './guardian-client'

interface Country {
  cca3: string
  name: { common: string }
  region: string
}

interface CountryNewsArticle extends GuardianArticle {
  scope: 'country' | 'region'
}

interface CountryNewsFile {
  updatedAt: string
  country: { cca3: string; name: string }
  guardianTag: string | null
  articles: CountryNewsArticle[]
}

const THROTTLE_MS = 1100 // Guardian free tier: 1 call/sec; 1.1s for safety
const WINDOW_DAYS = 7

function daysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 3600 * 1000)
  return d.toISOString().slice(0, 10)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function buildCountry(
  country: Country,
  apiKey: string,
  fromDate: string,
): Promise<CountryNewsFile> {
  const tag = cca3ToGuardianTag(country.cca3)
  const regionTag = regionToGuardianTag(country.region)

  let countryArticles: CountryNewsArticle[] = []
  if (tag) {
    try {
      const raw = await guardianSearch({ tag, fromDate, pageSize: 5, apiKey })
      countryArticles = raw.map((a) => ({ ...a, scope: 'country' as const }))
    } catch (err) {
      console.warn(`[news] ${country.cca3} country fetch failed: ${(err as Error).message}`)
    }
    await sleep(THROTTLE_MS)
  }

  let regionArticles: CountryNewsArticle[] = []
  if (countryArticles.length < 5 && regionTag) {
    const remainder = 5 - countryArticles.length
    try {
      const raw = await guardianSearch({
        tag: regionTag,
        fromDate,
        pageSize: remainder * 2,
        apiKey,
      })
      const existingIds = new Set(countryArticles.map((a) => a.id))
      regionArticles = raw
        .filter((a) => !existingIds.has(a.id))
        .slice(0, remainder)
        .map((a) => ({ ...a, scope: 'region' as const }))
    } catch (err) {
      console.warn(`[news] ${country.cca3} region fetch failed: ${(err as Error).message}`)
    }
    await sleep(THROTTLE_MS)
  }

  return {
    updatedAt: new Date().toISOString(),
    country: { cca3: country.cca3, name: country.name.common },
    guardianTag: tag,
    articles: [...countryArticles, ...regionArticles],
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.GUARDIAN_KEY
  if (!apiKey) {
    console.error('[news] GUARDIAN_KEY env var is required')
    process.exit(1)
  }

  const countries = (countriesFile as { countries: Country[] }).countries
  const fromDate = daysAgo(WINDOW_DAYS)
  const outDir = 'public/news'
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  console.log(`[news] building for ${countries.length} countries; fromDate=${fromDate}`)

  let totalArticles = 0
  for (let i = 0; i < countries.length; i++) {
    const c = countries[i]
    const result = await buildCountry(c, apiKey, fromDate)
    const outPath = join(outDir, `${c.cca3}.json`)
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n')
    totalArticles += result.articles.length
    if ((i + 1) % 25 === 0) {
      console.log(`[news] ${i + 1}/${countries.length} done`)
    }
  }

  console.log(`[news] complete: ${totalArticles} articles across ${countries.length} files`)
}

main().catch((err) => {
  console.error('[news] fatal:', err)
  process.exit(1)
})
```

- [ ] **Step 3: Create `.github/workflows/news.yml`**

```yaml
name: News feed

on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: news-feed
  cancel-in-progress: false

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Build news
        env:
          GUARDIAN_KEY: ${{ secrets.GUARDIAN_KEY }}
        run: npm run news:build

      - name: Commit if changed
        run: |
          if [[ -z "$(git status --porcelain public/news/)" ]]; then
            echo "No changes — news already current."
            exit 0
          fi
          git config user.name 'funworldmap-bot'
          git config user.email 'bot@funworldmap.com'
          git add public/news/
          git commit -m "chore(news): daily refresh"
          git push
```

- [ ] **Step 4: tsc check**

```bash
npx tsc -b 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add scripts/news/build.ts package.json .github/workflows/news.yml
git commit -m "feat(news): build script + daily GHA workflow"
```

---

### Task 6: [OPTIONAL] Initial JSON commit

**Files:** `public/news/<cca3>.json` × 249 (generated).

Skip this task if `GUARDIAN_KEY` is not available locally. The daily GHA (or manual `gh workflow run news.yml` post-merge) will populate these files on the first run.

- [ ] **Step 1: Run the build locally**

```bash
cd /e/polworldmap-country-news
# Set GUARDIAN_KEY in the shell before running:
GUARDIAN_KEY=<your-key> npm run news:build 2>&1 | tail -20
```

Expected: script logs progress every 25 countries; completes in ~9 min; final line `[news] complete: ~N articles across 249 files`.

- [ ] **Step 2: Inspect a few files**

```bash
ls public/news/ | head -5
cat public/news/USA.json | head -30
cat public/news/TUV.json | head -10
```

Expected: USA.json has 5 articles (all country-scope). TUV.json (Tuvalu) likely has 0 or few articles — empty or region fallback.

- [ ] **Step 3: Commit**

```bash
git add public/news/
git commit -m "feat(news): initial content for 249 countries + territories"
```

---

### Task 7: `CountryNewsSection` component (TDD)

**Files:**
- Create: `src/components/CountryNewsSection.tsx`
- Test: `src/components/__tests__/CountryNewsSection.test.tsx`

- [ ] **Step 1: Write tests**

Create `src/components/__tests__/CountryNewsSection.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
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

  it('renders 5 article links on success', async () => {
    mockFetch({
      updatedAt: '2026-04-23T06:00:00.000Z',
      country: { cca3: 'DEU', name: 'Germany' },
      guardianTag: 'world/germany',
      articles: [1, 2, 3, 4, 5].map((i) => ({
        id: `world/2026/apr/2${i}/story-${i}`,
        title: `Story ${i}`,
        trailText: `Summary ${i}`,
        url: `https://www.theguardian.com/world/2026/apr/2${i}/story-${i}`,
        publishedAt: `2026-04-2${i}T12:00:00.000Z`,
        section: 'world',
        thumbnail: null,
        scope: 'country' as const,
      })),
    })
    render(<CountryNewsSection cca3="DEU" />)
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(5))
    expect(screen.getByText('Story 1')).toBeTruthy()
  })

  it('renders region badge when scope is region', async () => {
    mockFetch({
      updatedAt: '2026-04-23T06:00:00.000Z',
      country: { cca3: 'DEU', name: 'Germany' },
      guardianTag: 'world/germany',
      articles: [
        {
          id: 'world/a',
          title: 'Country story',
          trailText: '',
          url: 'https://www.theguardian.com/a',
          publishedAt: '2026-04-22T12:00:00.000Z',
          section: 'world',
          thumbnail: null,
          scope: 'country' as const,
        },
        {
          id: 'world/b',
          title: 'Region story',
          trailText: '',
          url: 'https://www.theguardian.com/b',
          publishedAt: '2026-04-21T12:00:00.000Z',
          section: 'world',
          thumbnail: null,
          scope: 'region' as const,
        },
      ],
    })
    render(<CountryNewsSection cca3="DEU" />)
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(2))
    const regionBadges = screen.getAllByText(/Europe|Region/i)
    expect(regionBadges.length).toBeGreaterThan(0)
  })

  it('renders empty-state line when articles is empty', async () => {
    mockFetch({
      updatedAt: '2026-04-23T06:00:00.000Z',
      country: { cca3: 'TUV', name: 'Tuvalu' },
      guardianTag: null,
      articles: [],
    })
    render(<CountryNewsSection cca3="TUV" />)
    await waitFor(() => expect(screen.getByText(/No recent Guardian stories/i)).toBeTruthy())
  })

  it('renders "News unavailable" on 404', async () => {
    mockFetch({}, 404)
    render(<CountryNewsSection cca3="XXX" />)
    await waitFor(() => expect(screen.getByText(/News unavailable/i)).toBeTruthy())
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
npx vitest run src/components/__tests__/CountryNewsSection.test.tsx 2>&1 | tail -10
```

- [ ] **Step 3: Implement component**

Create `src/components/CountryNewsSection.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { relativeTime } from '../lib/relativeTime'

interface Article {
  id: string
  title: string
  trailText: string
  url: string
  publishedAt: string
  section: string
  thumbnail: string | null
  scope: 'country' | 'region'
}

interface CountryNewsFile {
  updatedAt: string
  country: { cca3: string; name: string }
  guardianTag: string | null  // for the empty-state "Browse all coverage" link
  articles: Article[]
}

type Status = 'loading' | 'ready' | 'error'

interface Props {
  cca3: string
}

const CONTINENT_LABEL_FROM_TAG: Record<string, string> = {
  'world/africa': 'Africa',
  'world/europe': 'Europe',
  'world/asia-pacific': 'Asia-Pacific',
  'world/middleeast': 'Middle East',
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
        <EmptyState tag={data.guardianTag} />
      )}

      {status === 'ready' && data && data.articles.length > 0 && (
        <ul className="space-y-3">
          {data.articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </ul>
      )}
    </div>
  )
}

function EmptyState({ tag }: { tag: string | null }) {
  return (
    <p className="text-xs text-sand-600 dark:text-dark-100">
      No recent Guardian stories about this country or region.
      {tag && (
        <>
          {' '}
          <a
            href={`https://www.theguardian.com/${tag}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-accessible dark:text-teal-light hover:underline"
          >
            Browse all coverage →
          </a>
        </>
      )}
    </p>
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
          {article.trailText && (
            <div className="text-xs text-sand-600 dark:text-dark-100 line-clamp-2 mt-0.5">
              {article.trailText}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 text-[11px] text-sand-500 dark:text-dark-100">
            <span>{relativeTime(article.publishedAt)}</span>
            {article.scope === 'region' && (
              <span className="px-1.5 py-0.5 rounded bg-teal/10 dark:bg-teal-light/10 text-teal-accessible dark:text-teal-light">
                Region
              </span>
            )}
          </div>
        </div>
      </a>
    </li>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/components/__tests__/CountryNewsSection.test.tsx 2>&1 | tail -10
```

Expected: 5/5 pass.

- [ ] **Step 5: tsc + full unit**

```bash
npx tsc -b 2>&1 | tail -3
npm run test:unit 2>&1 | tail -3
```

Expected: clean, all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/CountryNewsSection.tsx src/components/__tests__/CountryNewsSection.test.tsx
git commit -m "feat(news): CountryNewsSection — loading / ready / empty / error states"
```

---

### Task 8: Mount `<CountryNewsSection>` in `SingleCountryPanel`

**Files:**
- Modify: `src/components/SingleCountryPanel.tsx`

- [ ] **Step 1: Add import**

At the top of `src/components/SingleCountryPanel.tsx`, add:

```tsx
import { CountryNewsSection } from './CountryNewsSection'
```

- [ ] **Step 2: Mount at the bottom of the scrollable content area**

Find the closing `</div>` of the panel's inner content area (after all existing fields like region, capital, population). Before that closing tag, insert:

```tsx
{!inGameRound && <CountryNewsSection cca3={country.cca3} />}
```

The `!inGameRound` gate matches the Compare + Copy-link hiding pattern from the prior country-pinning guess-fixes PR.

- [ ] **Step 3: tsc + unit**

```bash
npx tsc -b 2>&1 | tail -3
npm run test:unit 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/SingleCountryPanel.tsx
git commit -m "feat(panel): mount CountryNewsSection (hidden in round-end)"
```

---

### Task 9: E2E spec + docs

**Files:**
- Create: `e2e/country-news.spec.ts`
- Modify: `playwright.config.ts`
- Create: `docs/systems/country-news.md`

- [ ] **Step 1: Create e2e spec**

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
        guardianTag: 'world/germany',
        articles: [
          {
            id: 'world/2026/apr/22/story-1',
            title: 'Germany coalition reached',
            trailText: 'Late-night talks concluded.',
            url: 'https://www.theguardian.com/world/2026/apr/22/story-1',
            publishedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
            section: 'world',
            thumbnail: null,
            scope: 'country',
          },
          {
            id: 'world/2026/apr/21/story-2',
            title: 'EU summit concludes',
            trailText: 'Brussels meetings wrap up.',
            url: 'https://www.theguardian.com/world/2026/apr/21/story-2',
            publishedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
            section: 'world',
            thumbnail: null,
            scope: 'region',
          },
        ],
      }),
    })
  })
}

test.describe('Country news feed', () => {
  test('renders articles with scope badge in CountryPanel', async ({ page }) => {
    await stubNewsDEU(page)
    await page.goto('/#DEU')
    await waitForMap(page)
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('country-news-section')).toBeVisible({ timeout: 5_000 })

    const links = page
      .getByTestId('country-news-section')
      .getByRole('link')
    await expect(links).toHaveCount(2, { timeout: 5_000 })

    // Scope badge on region article
    await expect(
      page.getByTestId('country-news-section').getByText(/Region/i),
    ).toBeVisible()

    // External links
    const firstLink = links.first()
    await expect(firstLink).toHaveAttribute('href', /^https:\/\/www\.theguardian\.com\//)
    await expect(firstLink).toHaveAttribute('target', '_blank')
    const rel = await firstLink.getAttribute('rel')
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
          guardianTag: null,
          articles: [],
        }),
      })
    })
    await page.goto('/#TUV')
    await waitForMap(page)
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByTestId('country-news-section').getByText(/No recent Guardian stories/i),
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

- [ ] **Step 2: Register in `playwright.config.ts`**

Add `'country-news.spec.ts'` to the `chromium` project's `testMatch` array (alphabetically near `country-panel-*`).

- [ ] **Step 3: Run locally**

```bash
for i in 1 2 3; do
  echo "=== Run $i ==="
  npx playwright test --project=chromium --retries=0 e2e/country-news.spec.ts 2>&1 | tail -8
done
```

Expected: 3/3 green.

- [ ] **Step 4: Create `docs/systems/country-news.md`**

```markdown
# Country News Feed — System Overview

A build-time pipeline that fetches Guardian Open Platform articles per
country and writes static JSON to `public/news/<cca3>.json`. The
`CountryNewsSection` component in `src/components/` renders the result at
the bottom of `SingleCountryPanel` whenever a user clicks a country.

## Pipeline

```
.github/workflows/news.yml  (cron: 0 6 * * *)
  └─ scripts/news/build.ts
       ├─ iterates src/data/countries.json (249 entries)
       ├─ for each country: guardianSearch with world/<country> tag, 7-day window, 5 articles
       ├─ if <5: top up from region tag (world/africa, world/europe, world/asia-pacific, world/middleeast)
       └─ writes public/news/<cca3>.json
  └─ git commit + push → deploy.yml → gh-pages
```

Throttle: 1100 ms between Guardian calls (free-tier limit is 1 call/sec, 5000/day). Full run ≈ 9 min.

## API key rotation

1. Register a new key at [open-platform.theguardian.com](https://open-platform.theguardian.com/access/).
2. Update the GitHub Actions secret:
   ```bash
   gh secret set GUARDIAN_KEY --body "<new-key>"
   ```
3. Trigger a run to verify:
   ```bash
   gh workflow run news.yml
   gh run watch
   ```
4. Revoke the old key via the Guardian developer portal.

## Adding a new country tag

The `GUARDIAN_TAGS` map in `scripts/news/guardian-tags.ts` is hand-curated.
If a country is showing region fallbacks when it shouldn't, look up its
Guardian tag at [theguardian.com/world/<slug>](https://www.theguardian.com/world) and
add an entry:

```ts
export const GUARDIAN_TAGS: Record<string, string> = {
  // existing entries...
  ABC: 'world/<slug>',
}
```

Commit + let the next scheduled GHA run pick it up.

## Operational notes

- Guardian API down during a run → workflow fails, no deploy, existing
  `public/news/*.json` stays live. Users see yesterday's data.
- Per-country fetch error → logged, previous JSON kept, next country
  continues.
- Country with no tag AND no region fallback (e.g. Tuvalu, Antarctica) →
  `articles: []`; client renders empty-state line.
- Repo growth: ~580 KB per daily commit, ~200 MB/year added to git
  history. Acceptable for years; prune with `git filter-repo` if needed.

## Rollback

1. Revert the `feat(news)` merge commit on `main`.
2. `deploy.yml` rebuilds gh-pages without the news section.
3. `public/news/*.json` files remain in git history (harmless).
4. Optionally disable the GHA: `gh workflow disable news.yml`.
```

- [ ] **Step 5: Commit**

```bash
git add e2e/country-news.spec.ts playwright.config.ts docs/systems/country-news.md
git commit -m "test(e2e): country news + docs"
```

---

### Task 10: Validation + push + PR

**Files:** none.

- [ ] **Step 1: Full unit + tsc**

```bash
cd /e/polworldmap-country-news
npm run test:unit 2>&1 | tail -3
npx tsc -b 2>&1 | tail -3
```

Expected: all pass, tsc clean.

- [ ] **Step 2: Full chromium project**

```bash
npx playwright test --project=chromium --retries=0 --workers=2 2>&1 | tail -5
```

Expected: fully green. Pre-existing search / launcher.spec:83 flakes may recur — flag but do not treat as blocker unless country-news spec itself flakes.

- [ ] **Step 3: chromium-gpu sanity**

```bash
npx playwright test --project=chromium-gpu --retries=0 2>&1 | tail -5
```

Expected: green.

- [ ] **Step 4: Push**

```bash
git push -u origin feat/country-news-feed 2>&1 | tail -5
```

- [ ] **Step 5: Open PR**

```bash
gh pr create --base main --title "feat(news): country news feed on CountryPanel" --body "$(cat <<'EOF'
## Summary

Daily Guardian news feed rendered inline at the bottom of `SingleCountryPanel` for every country. No runtime backend — data is generated by a scheduled GitHub Action and served as static JSON.

- `.github/workflows/news.yml` — cron 06:00 UTC, runs `scripts/news/build.ts`.
- `scripts/news/build.ts` — iterates 249 countries + territories, calls Guardian's `/search` with `world/<country>` tag, falls back to region tag when < 5 stories, writes `public/news/<cca3>.json`.
- `scripts/news/guardian-tags.ts` — hand-curated cca3 → tag map, seeded with ~55 major countries; rest fall through to region fallback.
- `src/components/CountryNewsSection.tsx` — fetch + render with loading / ready / empty / error states. Hand-rolled `relativeTime` in `src/lib/`.
- `SingleCountryPanel` mounts the section only when `!inGameRound` — matches the existing Compare/Copy-link hiding pattern.
- E2E spec covers populated, empty, and 404 paths.
- `docs/systems/country-news.md` documents the pipeline + key rotation.

## Post-merge user action

Guardian API key is registered as GitHub Actions secret `GUARDIAN_KEY` (pre-flight). After merge, trigger the first run:

```
gh workflow run news.yml
```

or wait for the next 06:00 UTC cron. Until then, the client shows "News unavailable" for each country.

## Why

Spec: `docs/superpowers/specs/2026-04-23-country-news-feed-design.md`.
Plan: `docs/superpowers/plans/2026-04-23-country-news-feed.md`.

## Test Plan

- [ ] CI `lint + type + unit`, `e2e (chromium)`, `e2e (chromium-gpu)` all green
- [ ] Manual: `gh workflow run news.yml` → check `public/news/USA.json` has 5 articles
- [ ] Manual: load site → click Germany → news section renders
- [ ] Manual: click a small country (e.g. Tuvalu) → empty-state line with Guardian link if tag exists, or plain empty-state

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -5
```

Report the PR URL.

- [ ] **Step 6: Watch CI, hand off to `finishing-a-development-branch`**

```bash
gh pr checks $(gh pr view --json number --jq .number) --watch
```

Expected green; if pre-existing search flake, re-run chromium once.

After green + merge, trigger the first news build:

```bash
gh workflow run news.yml
```

---

## Self-review notes

- **Spec coverage:** Guardian source → Tasks 4+5. Region fallback → Tasks 2+5. `world/asia-pacific` Asia + Oceania → Task 2 Step 6. Americas null → Task 2 Step 6. 1100 ms throttle → Task 5 Step 2. Sanitiser with entity decoding → Task 2 Steps 1-4. Relative time → Task 3. Component + SingleCountryPanel mount → Tasks 7+8. Empty state + tag link → Task 7 `EmptyState` component. `!inGameRound` gate → Task 8. Initial JSON commit → Task 6 (optional). GHA → Task 5 Step 3. Docs → Task 9 Step 4.
- **Placeholder scan:** Every step has concrete code. Task 8 Step 2 hedges "Find the closing `</div>`" — the shape of the panel is stable so the subagent can grep.
- **Type consistency:** `GuardianArticle` shape used in client (Task 4) + build (Task 5) + component (Task 7, mirrored). `scope: 'country' | 'region'` consistent across build + component + tests. `Region` type shared between regions.ts + spec.
- **Honest uncertainty:** Guardian's tag taxonomy is mostly stable but the exact tag string for a country can change (e.g. `world/northkorea` vs `world/north-korea`). `guardian-tags.ts` seeds the common 55; any miss falls through to region fallback, which is graceful. Task 9's docs cover adding new tags.
