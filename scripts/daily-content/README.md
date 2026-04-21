# Daily content pools

Curated lists of countries and cities eligible for the daily puzzle.

## Curation criteria (in priority order)

1. **Political neutrality.** Exclude entries where inclusion in the daily would implicitly take a side: Taiwan, Kosovo, Palestine, Western Sahara, Jerusalem, Crimea, Taipei (as capital). Free mode uses the full pool; daily uses only the filtered one.
2. **Unambiguous recognition.** Exclude microstates and non-sovereign territories that typical users cannot place.
3. **Global balance.** Roughly Europe 25 %, Asia 25 %, Africa 20 %, Americas 20 %, Oceania 10 %.
4. **Stable names / IDs.** Exclude entries undergoing recent renaming disputes (e.g., Türkiye vs Turkey) where `src/data/countries.json` may churn.

Targets: ~100 countries, ~200 cities.

## Adding an entry

1. Confirm the `cca3` is present in `src/data/countries.json` (for countries) or the `id` is present in `src/data/cities.json` (for cities).
2. Append to the appropriate pool file.
3. Run `npm run daily:validate` to confirm pool integrity.
4. Commit.

## Regenerating the daily index

```
npm run daily:generate
```

Writes `public/daily/index.json` covering the past 30 days plus today. Safe to re-run — idempotent; past entries are preserved verbatim, only missing entries and the `generatedAt` timestamp change.
