import countriesData from '../data/countries.json'

/** Display names for border codes OUTSIDE the selectable 195 (data sweep
 *  2026-07-10: ESH, GIB, GUF, HKG, MAC, UNK). Five live in the shipped
 *  249-entry dataset; UNK is REST Countries' Kosovo code and is not in the
 *  dataset at all. Chips for these render inert but must never show a raw
 *  code (batch-2 spec §2.3). */
const STATIC_NAMES: Record<string, string> = { UNK: 'Kosovo' }

const datasetNames = new Map<string, string>(
  countriesData.countries.map((c) => [c.cca3, c.name.common]),
)

export function nonSelectableNeighborName(code: string): string | undefined {
  return datasetNames.get(code) ?? STATIC_NAMES[code]
}
