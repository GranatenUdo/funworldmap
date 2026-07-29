# Data System

funworldmap uses multiple data sources, all bundled into the application at build time. There are zero runtime API calls for country data — the only network traffic is map tiles (basemap, satellite, terrain) and optional, cookieless telemetry (see [Analytics](analytics.md)). Every data point carries source attribution.

## Data Sources

### 1. World-Atlas (Geographic Boundaries)

**Source**: [Natural Earth](https://www.naturalearthdata.com/) — public domain geographic data
**Package**: `world-atlas` npm package (pre-processed TopoJSON)
**Resolution**: 1:50 million (countries-50m) — balance of detail and size
**Size**: ~245KB gzipped
**License**: Public domain

Provides polygon geometries for every country and territory. Each feature has:

- `id`: ISO 3166-1 numeric code as a string (e.g., `"250"` for France)
- `properties.name`: Country name in English

### 2. REST Countries v3.1 (Country Metadata)

**Source**: [REST Countries API v3.1](https://restcountries.com/)
**License**: Mozilla Public License 2.0

Provides: name, codes, capital, region, population, area, languages, currencies, coordinates, borders, UN status, timezones, continents.

### 3. CIA World Factbook (Archived)

**Source**: [CIA World Factbook archive](https://github.com/factbook/factbook.json) — the Factbook was shut down in February 2026; this is a CC0-licensed JSON archive of the last available data (updated 2026-01-22).
**License**: Public domain / CC0

Provides: government type. Government types change slowly, so the January 2026 data remains accurate for the vast majority of countries. See [Data Collection — CIA World Factbook](data-collection.md) for access method and code mapping details.

### 4. SVG Flags (Bundled)

**Source**: Downloaded at build time from flagcdn.com or REST Countries flag URLs
**Storage**: Committed to repo as SVG files
**License**: Public domain (national flags are not copyrightable in most jurisdictions)

Flags are bundled as static assets — no external CDN fetch at runtime.

## Enriched Data Model

The data collection tool (see [Data Collection](data-collection.md)) merges all sources into a single `countries.json` file. Each field carries source attribution.

### Per-Country Structure

```json
{
  "ccn3": "250",
  "cca2": "FR",
  "cca3": "FRA",
  "name": { "common": "France", "official": "French Republic" },
  "capital": ["Paris"],
  "region": "Europe",
  "subregion": "Western Europe",
  "population": 67390000,
  "area": 551695,
  "governmentType": "semi-presidential republic",
  "languages": { "fra": "French" },
  "currencies": { "EUR": { "name": "Euro", "symbol": "€" } },
  "flag": "flags/FR.svg",
  "flagAlt": "The flag of France is composed of three equal vertical bands of blue, white and red.",
  "latlng": [46.0, 2.0],
  "borders": ["AND", "BEL", "DEU", "ESP", "GBR", "ITA", "LUX", "MCO", "CHE"],
  "independent": true,
  "unMember": true,
  "landlocked": false,
  "timezones": ["UTC-10:00", "UTC+01:00"],
  "continents": ["Europe"],
  "_fieldSources": {
    "name": "restcountries",
    "capital": "restcountries",
    "region": "restcountries",
    "subregion": "restcountries",
    "population": "restcountries",
    "area": "restcountries",
    "governmentType": "cia-factbook",
    "languages": "restcountries",
    "currencies": "restcountries",
    "latlng": "restcountries",
    "borders": "restcountries",
    "independent": "restcountries",
    "unMember": "restcountries",
    "landlocked": "restcountries",
    "timezones": "restcountries",
    "continents": "restcountries"
  }
}
```

### Accessing Data in Code

Data access is flat — `country.population`, not `country.population.value`. Source info lives separately in `country._fieldSources.population`. Identifier fields (`ccn3`, `cca2`, `cca3`) and flag paths are plain strings without source tracking.

The attribution UI (the consolidated sources footer, its field → source table, and the exception markers) looks up the source key from `_fieldSources` and resolves it via the `_sources` registry; keys absent from `_sources` (e.g. `manual-override`) render as the raw key with no link.

### Source Registry

The `countries.json` includes a `_sources` metadata section:

```json
{
  "_sources": {
    "restcountries": {
      "name": "REST Countries",
      "url": "https://restcountries.com/",
      "description": "Open-source API for country data",
      "lastUpdated": "2026-04-14"
    },
    "cia-factbook": {
      "name": "CIA World Factbook (archived)",
      "url": "https://github.com/factbook/factbook.json",
      "description": "CC0 JSON archive of the CIA World Factbook (shut down February 2026)",
      "lastUpdated": "2026-01-22"
    }
  },
  "countries": [ ... ]
}
```

The `lastUpdated` field is set automatically by the data collection tool. For live API sources (REST Countries), it reflects the date of the data collection run. For archived sources (CIA Factbook), it reflects the archive's last update date (2026-01-22), not the run date.

### UI Attribution

Both panels consolidate attribution into one linked sources footer; any field whose source differs from the panel's dominant source carries a superscript exception marker keyed to the footer (`src/lib/fieldSourceMarkers.ts`). The single panel's footer additionally expands ("Source by field") into the complete field → source table. Full transparency about data provenance, complete granularity one interaction away.

## Data Join

The two geographic datasets (world-atlas polygons and country metadata) are joined by ISO 3166-1 numeric code:

```
world-atlas feature.id  ←→  countries.json ccn3
       "250"             =          "250"          → France
```

### Bidirectional Lookup

The application maintains two lookup maps built at startup:

| Lookup      | Key → Value          | Purpose                                                                          |
| ----------- | -------------------- | -------------------------------------------------------------------------------- |
| `byNumeric` | `ccn3 → CountryData` | Map click: feature ID "250" → metadata (includes `cca3` for URL hash)            |
| `byCca3`    | `cca3 → CountryData` | URL hash `#FRA` / border chip "DEU" → metadata (includes `ccn3` for map feature) |

Since CountryData contains both `ccn3` and `cca3`, these two maps provide all needed conversions without separate index maps. Example: map click yields `"250"` → `byNumeric.get("250")` returns France → `country.cca3` is `"FRA"` for the URL hash.

### Canonical 195 filter

The app renders only the **canonical 195** sovereign states — 193 UN members plus the Vatican and Palestine (both UN observer states). The allowlist lives in `lib/canonicalCountries.ts` (`CANONICAL_CCA3` / `CANONICAL_NUMERIC_IDS`) and is applied in three places:

- `useCountryData.ts` filters `countries.json` (which still carries the raw 249 source rows) down to the 195 for search and panels.
- `loadCountryGeojson.ts` filters the world-atlas polygons to the 195 numeric IDs (and `missingCountriesPatch.ts` synthesizes polygons for canonical IDs the 50m dataset omits).
- `useCityData.ts` filters cities to those whose host country is in the 195.

As a result, partially-recognized or contested entities (Kosovo, Taiwan, Western Sahara, Greenland, …) and uninhabited territories are **not rendered or selectable**. Every rendered polygon is one of the 195 and carries full metadata.

### Unmatched Territories (defensive fallback)

Because of the canonical filter above, every rendered polygon has a metadata match, so this path is not reachable through normal map clicks. Were a rendered polygon ever to lack a match, the application would display:

- Country name from world-atlas `properties.name`
- A note: "Limited data available"
- No flag or detailed metadata
- The polygon still clickable and highlightable

## Disputed Territories

funworldmap takes no political positions. For the 195 states it renders, boundaries use Natural Earth's de facto defaults — showing territories as they are controlled in practice, not as any government claims. Entities that are neither UN members nor observer states (e.g. Kosovo, Taiwan, Western Sahara) are out of scope for v1 and are not rendered as selectable countries; their land may still appear in the underlying satellite / vector basemap imagery.

Natural Earth data includes options for de jure boundaries and point-of-view-specific variants, which could be explored in future versions.

## Coordinate System

**Critical implementation detail**: REST Countries and MapLibre use different coordinate order.

| System                  | Order                   | Example (Paris) |
| ----------------------- | ----------------------- | --------------- |
| REST Countries `latlng` | `[latitude, longitude]` | `[48.86, 2.35]` |
| MapLibre GL `center`    | `[longitude, latitude]` | `[2.35, 48.86]` |

The `flyToCountry()` function handles this swap. Getting this wrong puts the camera in the ocean.

## Data Refresh

Country data changes infrequently. To update:

```
npm run update-data
```

This runs the data collection tool (see [Data Collection](data-collection.md)), which fetches from all sources, merges, and writes to `src/data/countries.json`. The developer reviews the diff and commits.

The build never calls this tool. Existing committed data is always used. The data is version-controlled and diffable.
