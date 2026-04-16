# Data Collection System

## Purpose

funworldmap aggregates country data from multiple authoritative sources. The data collection tool runs on demand (not at build time), fetches from each source, merges the results, and writes a single `countries.json` file that is committed to the repository.

## Design Principles

- **On-demand, not build-time**: The tool runs when a developer explicitly calls `npm run update-data`. It is never called by `npm run build`. If the tool fails or a source is down, the existing committed data is used.
- **Multi-source**: Each data field comes from a specific source. When sources disagree, the tool follows a defined priority order.
- **Transparent**: Every field's origin is tracked in a per-country `_fieldSources` map. The UI displays this via 'i' tooltips.
- **Idempotent**: Running the tool twice with the same source data produces identical output.

## Sources

| Source | Data Provided | Access Method | License |
|--------|--------------|---------------|---------|
| REST Countries v3.1 | Names, codes, capitals, regions, population, area, languages, currencies, coordinates, borders, UN status, timezones | HTTPS GET `/v3.1/all?fields=...` | MPL 2.0 |
| CIA World Factbook (archived) | Government type | `factbook/factbook.json` GitHub repository — CC0-licensed JSON archive. HTTP GET raw files per country: `https://raw.githubusercontent.com/factbook/factbook.json/master/{region}/{code}.json`. Government type at `data.Government["Government type"].text`. | Public domain (CC0) |
| flagcdn.com / REST Countries | SVG flag images | HTTPS download per country | Public domain |

### CIA World Factbook: Archived Source

The CIA World Factbook was shut down in February 2026. The official site (`cia.gov/the-world-factbook/`) no longer hosts data. The `factbook/factbook.json` GitHub repository is a CC0-licensed archive containing the last available data (updated 2026-01-22). Government types change slowly, so the January 2026 data remains accurate for the vast majority of countries.

**Code mapping challenge**: Factbook files use GEC/FIPS two-letter codes (e.g., `gm` = Germany, `au` = Austria), NOT ISO codes. The mapping is provided by `codesxref.csv` from the `factbook/factbook` repository (`factbook-codes/data/codesxref.csv`), which maps GEC → ISO alpha-2, alpha-3, and numeric codes. Approximately 28 GEC entries lack ISO codes (mostly uninhabited territories like Baker Island, Kingman Reef) — these are skipped.

## Pipeline

```
npm run update-data
        │
        ▼
┌──────────────────────┐
│  1. Fetch REST        │  GET https://restcountries.com/v3.1/all?fields=...
│     Countries         │  → raw REST Countries JSON
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  2. Fetch CIA World   │  Load JSON files from factbook/factbook.json archive
│     Factbook (archive)│  Extract governmentType per country
│                       │  Map GEC codes to ISO codes via codesxref.csv
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  3. Download SVG      │  Download ~195 SVG flag files
│     Flags             │  → public/flags/XX.svg (by cca2 code)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  4. Merge & Enrich    │  Join by country code
│                       │  Add source attribution to each field
│                       │  Apply priority rules for conflicts
│                       │  Generate _fieldSources per country
│                       │  Validate join integrity vs world-atlas
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  5. Write Output      │  → src/data/countries.json
│                       │  → public/flags/*.svg
│                       │  Console: summary of changes vs previous
└──────────────────────┘
```

## Merge Strategy

When multiple sources provide the same field, priority order:

1. **CIA World Factbook** — for government type (primary purpose of this source)
2. **REST Countries** — for all other fields (most comprehensive general source)

If a source is unavailable during a run, the tool falls back to existing data for that source's fields and logs a warning.

## Output Format

See [Data System — Enriched Data Model](data.md) for the full per-country JSON structure.

Key characteristics of the output:
- Single `countries.json` file containing `_sources` metadata and `countries` array
- Data fields are flat (e.g., `"population": 67390000`, not wrapped)
- Source attribution lives in a `_fieldSources` map per country (e.g., `"_fieldSources": { "population": "restcountries" }`)
- Identifier fields (`ccn3`, `cca2`, `cca3`) are plain strings — join keys, no source tracking
- Flag path is a relative reference to bundled SVG: `"flag": "flags/FR.svg"`

## Flag Bundling

The tool downloads every country's SVG flag and saves it to `public/flags/{cca2}.svg`. These are committed to the repository and served as static assets by Vite.

Approximate total size: ~2-3MB of SVG files (compress well with gzip). Vite serves them individually as needed — only the selected country's flag loads.

## Running the Tool

```
npm run update-data          # Fetch all sources, merge, write output
npm run update-data -- --dry # Preview changes without writing files
```

The tool entry point is `scripts/fetch-countries.ts`, run via `tsx`. It imports source-specific modules:

```
scripts/
  fetch-countries.ts          # Entry point: orchestrates pipeline
  sources/
    rest-countries.ts         # Fetch + normalize REST Countries data
    cia-factbook.ts           # Fetch + normalize CIA Factbook data
    flags.ts                  # Download SVG flags
  merge.ts                    # Merge sources, add _fieldSources, validate
```

## Adding New Sources

To add a new data source:
1. Add a source module in `scripts/sources/` that exports a fetch function returning normalized country data
2. Register it in the source registry with a unique key
3. Define merge priority for its fields
4. Add the source metadata to the `_sources` section
5. Run `npm run update-data` and review the diff

The architecture supports adding sources like Wikidata, World Bank, or UN data in future.

## Future: Voting & NGO Sentiment

A future phase will add user-submitted government type classifications alongside official data. This requires a backend service (undefined) and changes the data model to support multiple opinions per field rather than a single source of truth. Documented here for architectural awareness — not part of the current data collection pipeline.
