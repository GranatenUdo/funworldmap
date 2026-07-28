import type { CountryData } from './types'

/** Shared placeholder for missing values (C1) — both compare columns render
 *  it, so every row exists in both columns and rows always align. */
export const EM_DASH = '—'

/** Canonical numeric formatters — shared by the single panel's DataCells
 *  and the compare columns (single owner; SingleCountryPanel's private
 *  copies were absorbed here by C1). */
export function formatPopulation(n: number): string {
  return n.toLocaleString('en-US')
}

export function formatArea(n: number): string {
  return `${n.toLocaleString('en-US')} km²`
}

export interface CompareFieldDef {
  /** Stable identity — the CountryData field name the row derives from. */
  key: string
  label: string
  /** Marks the row as a candidate for C2's paired horizontal bars. */
  numeric: boolean
  /** Formatted display value; null → the column renders EM_DASH. */
  format: (country: CountryData) => string | null
}

/** C1 — the single field-definition list driving BOTH compare columns.
 *  Every row renders for every country (no conditional rows), so column A's
 *  rows always line up with column B's. Deliberately absent, mirroring the
 *  single panel's A4/A5 header treatment: Capital (the column-header
 *  caption joins ALL capitals) and UN member / independence (header
 *  exception badges — see components/exceptionBadge.ts). Timezones is
 *  restored as a real row (the old columns silently dropped it); it renders
 *  as a joined string, NOT the single panel's TimezoneList "+N more"
 *  toggle — a per-column toggle would break row alignment. */
export const COMPARE_FIELDS: readonly CompareFieldDef[] = [
  {
    key: 'population',
    label: 'Population',
    numeric: true,
    format: (c) => formatPopulation(c.population),
  },
  {
    key: 'area',
    label: 'Area',
    numeric: true,
    format: (c) => formatArea(c.area),
  },
  {
    key: 'region',
    label: 'Region',
    numeric: false,
    format: (c) => (c.subregion ? `${c.region} / ${c.subregion}` : c.region),
  },
  {
    key: 'governmentType',
    label: 'Government',
    numeric: false,
    format: (c) => c.governmentType || null,
  },
  {
    key: 'languages',
    label: 'Languages',
    numeric: false,
    format: (c) =>
      Object.keys(c.languages).length > 0 ? Object.values(c.languages).join(', ') : null,
  },
  {
    key: 'currencies',
    label: 'Currencies',
    numeric: false,
    format: (c) =>
      Object.keys(c.currencies).length > 0
        ? Object.values(c.currencies)
            .map((cur) => `${cur.name} (${cur.symbol})`)
            .join(', ')
        : null,
  },
  {
    key: 'timezones',
    label: 'Timezones',
    numeric: false,
    format: (c) => (c.timezones.length > 0 ? c.timezones.join(', ') : null),
  },
]
