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

GDELT's `locationcc:` query uses FIPS-10-4 2-letter codes, not ISO 3166-1
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
