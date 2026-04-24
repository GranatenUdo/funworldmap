# Country News — Guardian → GDELT Migration Design

**Date:** 2026-04-24
**Status:** Draft — pending user review
**Execution timing:** Spec + plan ready now; execute when commercial monetisation (ads) becomes a concrete plan. Guardian Open Platform's free-tier TOS forbids commercial use, so this migration is the gate on turning ads on.

**Parent feature:** [`2026-04-23-country-news-feed-design.md`](./2026-04-23-country-news-feed-design.md) (shipped as PR #16). This migration replaces the news source; the pipeline shape, UI placement, and no-backend principle are inherited unchanged.

---

## Goal

Swap the Guardian Open Platform source for GDELT 2.0's Doc API so the country-news feature is commercial-use-compatible under an open data license. Retain the daily GHA → static JSON → client render pipeline. Simplify the code: no region fallback, no hand-curated per-country tag list, no API key to manage.

**Primary success criteria.**
- Every country in `src/data/countries.json` that has a FIPS-10-4 code produces `public/news/<cca3>.json` with up to 5 recent English-language articles about that country.
- Countries with no FIPS code or zero returned articles render an empty-state line — no regression in graceful failure.
- UI surfaces article title + source domain + relative publishedAt + optional thumbnail.
- No API key required in the GHA pipeline — `GUARDIAN_KEY` secret becomes unused and can be removed by the user.
- CI and e2e suites remain green; unit test count goes down (regions tests deleted) or flat depending on what fips-codes tests replace.

**Explicit non-goals.**
- Bias-rating overlay (AllSides / MBFC / Ground News / GDELT tone) — deferred to a separate feature.
- Dual-source or source-selection UI — one source at a time.
- Filtering / search within the news section.
- Per-article analytics events — requires Worker blob-slot extension (separate plan).
- Executing the migration as a PR *before* ads become a concrete plan. This doc captures the decision; the plan doc describes the PR shape; execution is deferred to when the product needs it.

---

## Why GDELT

Verified during brainstorm research (see research log in commit history of this spec's PR):

- **License:** GDELT Project's own documentation states data is "available for unlimited and unrestricted use for any academic, commercial, or governmental use of any kind without fee." Source: `gdeltproject.org/about.html`.
- **No API key.** Registration-free; no secret to rotate, no per-visitor rate-limit risk.
- **Coverage:** ~8,000+ outlets globally (vs Guardian's one editorial feed) — wider country footprint, fewer sparse feeds.
- **Rate limits:** undocumented but "generous"; polite pacing (500 ms between calls) is the community norm. At 249 countries × 1 call each = 125 s at 500 ms throttle, well inside any GHA job limit.

Verified trade-offs vs Guardian:

- **No trailText / summary field.** GDELT returns title + URL + timestamp + domain + optional social image. The previous UI's 2-line description row is unbuildable; the card layout simplifies to title + metadata (domain + relative time) + optional thumbnail.
- **Ranking is algorithmic.** GDELT sorts by `hybridrel` (relevance × recency), not editorial order. Occasionally a small-outlet article outranks BBC for a major country. Acceptable quality trade-off.
- **FIPS-10-4 country codes.** GDELT's `sourcecountry`/`location` filters use FIPS (Germany = `GM`, Sweden = `SW`, China = `CH`), not ISO 3166-1 alpha-2. Requires a hand-curated `cca3 → FIPS` lookup.

---

## Scope

### In scope (one PR when executed)

- `scripts/news/gdelt-client.ts` — GDELT Doc 2.0 `/api/v2/doc/doc` wrapper.
- `scripts/news/fips-codes.ts` — `cca3 → FIPS-10-4` lookup for 249 `countries.json` entries (null for countries with no FIPS code, e.g. some disputed territories).
- `scripts/news/__tests__/fips-codes.test.ts` — spot-check unit tests.
- `scripts/news/build.ts` — rewrite. Single query per country (`location:<country> sourcelang:eng`), no fallback logic.
- **Delete:** `scripts/news/guardian-client.ts`, `scripts/news/guardian-tags.ts`, `scripts/news/regions.ts`, and `scripts/news/__tests__/regions.test.ts`.
- `scripts/news/sanitise.ts` + tests — kept (GDELT titles occasionally contain HTML entities).
- `src/components/CountryNewsSection.tsx` — updated render: drop trailText row, replace section badge with domain, drop region-scope badge logic.
- `src/components/__tests__/CountryNewsSection.test.tsx` — test fixtures updated to new shape; still 5 tests.
- `e2e/country-news.spec.ts` — fixtures updated; still 3 tests.
- `.github/workflows/news.yml` — remove `GUARDIAN_KEY` from env; GDELT needs no key.
- `docs/systems/country-news.md` — rewrite to describe the GDELT pipeline.
- `public/news/<cca3>.json` × 249 — regenerated with the new shape.

### Out of scope

- Bias-rating overlay (Ground News's headline feature). Deferred to a separate feature if wanted; candidates are MBFC ($99 + $10/mo via RapidAPI) or GDELT's `tone` score (free).
- Removing the GitHub secret `GUARDIAN_KEY`. User does this manually after the PR merges. GHA silently ignores unreferenced secrets; no code impact.
- Multi-source support or source fallback between GDELT and another provider.
- Any news-analytics event wiring (`news_article_opened`) — Worker's blob slots are fixed at 7, no room without a Worker schema change.

---

## Architecture

### Data pipeline (build-time, unchanged shape)

```
┌──────────────────────────────────────────────────────────────┐
│ .github/workflows/news.yml  (cron: 0 6 * * *)                │
│                                                              │
│   ┌──────────────────────────────────────────┐               │
│   │  scripts/news/build.ts (rewritten)       │               │
│   │                                          │               │
│   │  for each country in countries.json:     │               │
│   │    fips = cca3ToFips(cca3)               │               │
│   │    if !fips: write empty JSON, continue  │               │
│   │    articles = gdeltSearch({              │               │
│   │      location: fips,                     │               │
│   │      sourcelang: 'eng',                  │               │
│   │      maxRecords: 5,                      │               │
│   │      timespan: '7d',                     │               │
│   │    })                                    │               │
│   │    sleep 500 ms                          │               │
│   │    write public/news/<cca3>.json         │               │
│   └──────────────────────────────────────────┘               │
│                                                              │
│   commit public/news/ → triggers deploy.yml                  │
└──────────────────────────────────────────────────────────────┘
```

**GDELT query shape:**
- Endpoint: `https://api.gdeltproject.org/api/v2/doc/doc`
- Query: `query=location:<FIPS>%20sourcelang:eng` where `<FIPS>` is the 2-letter FIPS-10-4 country code (e.g. `GM` for Germany, `CH` for China).
- Parameters: `mode=ArtList`, `maxrecords=5`, `timespan=7d`, `sort=hybridrel`, `format=json`
- No API key required.
- Throttle: 500 ms between requests (community-polite; GDELT hasn't published a hard limit).

**Why `location:` not `sourcecountry:`:** Confirmed during brainstorm Q2. `location:` surfaces articles *about* the country (via GDELT's GKG geographic annotations) from any English-language outlet worldwide — matches the user's original framing of the feature ("top news stories on the Country Information screen"). `sourcecountry:` would restrict to articles published by that country's domestic outlets, which fails for non-English-primary countries. `location:` with the FIPS code is unambiguous (avoids the "Georgia country vs US state", "Chad", "Niger" name-collision problems) and keeps queries short.

### Output JSON shape (`public/news/<cca3>.json`)

```ts
interface CountryNewsFile {
  updatedAt: string              // ISO timestamp of GHA build
  country: { cca3: string; name: string }
  articles: CountryNewsArticle[]  // 0..5
}

interface CountryNewsArticle {
  id: string                     // article URL; GDELT has no stable ID — URL is the de-facto identifier
  title: string                  // sanitise-decoded; GDELT sometimes returns HTML entities
  url: string                    // same as id; kept as separate field for UI clarity
  publishedAt: string            // ISO; normalised from GDELT's "seendate" (YYYYMMDDTHHMMSSZ)
  domain: string                 // e.g. "bbc.com"
  thumbnail: string | null       // GDELT's socialimage; often null
}
```

Removed vs Guardian shape (see `2026-04-23-country-news-feed-design.md`):
- `guardianTag` — no equivalent; empty-state loses its "Browse all coverage" link.
- `section` — replaced by `domain` in the UI.
- `scope: 'country' | 'region'` — no region fallback, so no scope.
- `trailText` — not available from GDELT.

### Client rendering (updated)

`src/components/CountryNewsSection.tsx` changes:

- **Drop the trailText row.** The card becomes two rows high (title + metadata) instead of three (title + trailText + metadata).
- **Replace the section badge with a domain label.** Metadata row text changes from `"<relative time> · world"` (or similar) to `"<domain> · <relative time>"`, e.g. `"bbc.com · 2 days ago"`.
- **Drop the region scope badge.** Any existing `{article.scope === 'region' && <Badge>}` JSX goes away.
- **Empty state copy updated.** Previous: "No recent Guardian stories about this country or region." + conditional Guardian-tag link. New: "No recent English-language news about this country in the last 7 days." No secondary link.
- **GDELT attribution.** Add a small footer line at the bottom of the news section: `"News data via the GDELT Project."` with a link to `https://www.gdeltproject.org`. Not strictly required by GDELT's license but good citizenship.

Fetch + state-machine logic is otherwise unchanged: loading → ready (empty or populated) → error.

### Data flow (unchanged except for the source)

```
GHA cron ──▶ build.ts ──▶ GDELT (no API key) ──▶ public/news/<cca3>.json × 249
                                                    │
                                                    ▼
User clicks country ──▶ SingleCountryPanel mounts ──▶ CountryNewsSection
                                                    │
                                                    ▼
                                    fetch /news/<cca3>.json
                                        │
                      ┌─────────────────┼─────────────────┐
                      ▼                 ▼                 ▼
                  200 + articles   200 + empty         404 / network
                      │                 │                 │
                      ▼                 ▼                 ▼
             render title + domain  render empty-    render "News
             + relative time + img  state line       unavailable"
```

---

## FIPS-10-4 lookup

GDELT's country-filter uses FIPS-10-4 2-letter codes, which differ from ISO 3166-1 alpha-2 in ~40 of 249 cases. Examples of divergence:

| Country | ISO alpha-2 (cca2) | FIPS-10-4 |
|---|---|---|
| Germany | DE | **GM** |
| Sweden | SE | **SW** |
| China | CN | **CH** |
| Switzerland | CH | **SZ** |
| Spain | ES | **SP** |
| Denmark | DK | **DA** |
| South Korea | KR | **KS** |
| North Korea | KP | **KN** |
| UK | GB | **UK** |
| Russia | RU | **RS** |

The `fips-codes.ts` table is a hand-curated `Record<cca3, string | null>` — ~249 entries. Entries for countries where FIPS has no code (e.g., Svalbard, some disputed regions) are `null`; the build script writes empty-articles JSON for those.

The `location:<FIPS>` query is the core of the build script — the FIPS code IS the query input, not defensive metadata. Countries whose cca3 has no FIPS equivalent (a handful of territories) get `articles: []` without hitting GDELT.

---

## Tests

### Unit (modified)

- `scripts/news/__tests__/fips-codes.test.ts` — new. ~10 spot-checks covering the common divergence cases (USA→US, DEU→GM, SWE→SW, CHE→SZ, CHN→CH, GBR→UK, RUS→RS, KOR→KS, PRK→KN, DNK→DA) plus `null` return for a known no-FIPS entry.
- `scripts/news/__tests__/regions.test.ts` — **deleted** (7 tests removed).
- `scripts/news/__tests__/sanitise.test.ts` — unchanged (8 tests retained; GDELT titles still need entity decoding for safety).
- `src/components/__tests__/CountryNewsSection.test.tsx` — 5 tests retained, fixtures updated:
  - Loading state unchanged.
  - Populated: fixtures drop `section`/`scope`/`trailText`; add `domain`. Assertion updated to check for domain text instead of region badge.
  - Region-badge test: **removed** (no region scope in v2). Replaced with a domain-rendering test.
  - Empty-state: updated copy assertion and removal of Guardian-tag-link assertion.
  - 404 error state: unchanged.
- `src/lib/__tests__/relativeTime.test.ts` — unchanged.

### E2E (modified)

- `e2e/country-news.spec.ts` — 3 tests retained:
  - Populated DEU fixture updated to new shape; asserts domain visible, `target="_blank"`, `rel=noopener`.
  - Empty-state test: copy assertion updated, Guardian-tag-link assertion removed.
  - 404 unchanged.

### Net change

- Unit: +10 (fips-codes) −7 (regions) = +3 tests net.
- E2E: 0 net change.

---

## Error handling + edge cases

| Case | Resolution |
|---|---|
| Country has no FIPS code (rare — ~0-5 entries) | Skip in build.ts; write `articles: []`; client renders empty state. |
| GDELT rate-limits during a run | Log + skip country; previous JSON stays on disk. Next day retries. No retry-in-same-run — keeps build time bounded. |
| GDELT returns 0 articles for a country (e.g. Tuvalu) | Empty-state line. No region fallback. |
| GDELT returns non-English article despite `sourcelang:eng` | Defensive client-side filter: render only articles with `language === 'English'`. Fallback defense; rare. |
| Thumbnail URL blocked by outlet (hotlinking, SSL) | `<img>` shows alt; card keeps text-only layout. `loading="lazy"` + `referrerpolicy="no-referrer"` stay. |
| Guardian-tag-link in old cached clients | Old JSON with `guardianTag` field will be replaced by new JSON when GHA next runs. Component ignores the old field if cached client loads a new JSON (JSON parse with extra unknown fields is fine in TypeScript). |
| GDELT wholly unavailable | GHA run fails; deploy doesn't fire; `public/news/*.json` stays at yesterday's snapshot. User-invisible. |
| GDELT's JSON response uses different field names than expected | `gdelt-client.ts` runs one smoke query locally at build time to detect schema drift; caught immediately on next GHA run. Spec-level defense: pin the response-parsing to the verified 2026-04-24 schema; if GDELT ships a v3, revisit. |
| First deploy after this migration | Run `npm run news:build` locally (no API key needed) and commit the regenerated 249 JSON files in the same PR. Merge = fresh data live. |

---

## Migration sequencing

Per the brainstorm decision (user choice B at Q1): **spec + plan ready now, execution deferred**. Concrete trigger: when the project starts serving ads, open the spec + plan and execute.

Between "now" and "execution trigger":
- Spec + plan live at the documented paths.
- Guardian news feed continues operating, non-commercial TOS compliant.
- No Guardian TOS changes likely to flip against us in the interim; if they do, execution trigger is also hit.
- Sanity-check the spec against GDELT's API shape quarterly — APIs drift. If drift is severe, revise.

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Spec ages (GDELT schema changes, Guardian TOS changes) | Plan doc includes a "pre-flight sanity check" task: one live GDELT query at the start of execution verifying the response shape matches what `gdelt-client.ts` expects. If drift, revise plan before implementation. |
| `location:` query returns too-tangential articles (e.g., a story about France that mentions Germany once) | Accept as data-quality noise for v1. GDELT's `hybridrel` sorting should push tangential mentions down. If user-testing reveals regressions, a follow-up PR can add a `numarts >= N` filter or domain whitelist. |
| Some country names are ambiguous (e.g. `Georgia` = country + US state; `Congo` = two countries) | Non-issue: queries use FIPS codes (`GG` for Georgia the country, `CF` for Republic of the Congo, `CG` for DRC), not names. FIPS uniquely identifies each country. |
| Thumbnail `socialimage` URLs from blocked or slow outlets | `<img>` layout falls through to text-only; no visual break. |
| Build script takes too long | 249 countries × 500 ms throttle = ~125 s; well under GHA job limits. |
| Attribution ("News data via the GDELT Project.") adds visual noise to the panel | Kept small (11 px, muted colour); only renders when the news section is mounted. |
| User forgets to remove the GUARDIAN_KEY GHA secret | Harmless — GHA silently ignores unreferenced secrets. Document the cleanup as a one-line post-merge step, not a blocker. |

---

## Definition of done

- GDELT build script runs locally without an API key; produces `public/news/<cca3>.json` with the new shape.
- `CountryNewsSection` renders the new fixtures correctly on desktop + mobile.
- All existing tests updated; new `fips-codes.test.ts` added; `regions.test.ts` deleted.
- E2E spec fixtures and assertions updated.
- `docs/systems/country-news.md` rewritten to describe GDELT.
- GHA workflow no longer references `GUARDIAN_KEY`.
- Initial 249 JSON files regenerated and committed in the migration PR (no separate GHA first-run coordination required).
- CI green on both chromium + chromium-gpu projects.
