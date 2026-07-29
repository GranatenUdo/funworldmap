/**
 * C4/D2 exception-marker scheme — single owner (spec 2026-07-26, items
 * C4/D2; both panels consume these exports — never re-derive dominance
 * elsewhere).
 *
 * A panel shows ONE consolidated sources footer. Field-level attribution
 * granularity is preserved by marking only the exceptions: any field whose
 * source differs from the panel's dominant source carries a superscript
 * glyph keyed to that source's footer entry.
 */

export const MARKER_GLYPHS = ['†', '‡', '§', '¶'] as const // † ‡ § ¶

export interface FieldMarker {
  /** Superscript glyph, e.g. '†'. */
  glyph: string
  /** Key into CountriesFile['_sources'] for the exception source. */
  source: string
}

export interface FieldSourceMarkers {
  /** Source attributing the most fields across all inputs; null for empty input. */
  dominantSource: string | null
  /** Exception source key -> glyph — the footer key. Lexicographic insertion order. */
  markerBySource: ReadonlyMap<string, string>
  /** Field key -> its exception marker. Fields on the dominant source are absent. */
  markerByField: ReadonlyMap<string, FieldMarker>
}

/**
 * The source attributing the most (record, field) pairs. Ties break to the
 * lexicographically smallest source key — deterministic regardless of JSON
 * key order. Variadic so compare passes both countries' _fieldSources and
 * the single panel (D2) passes one.
 */
export function dominantSource(...fieldSourcesList: Array<Record<string, string>>): string | null {
  const counts = new Map<string, number>()
  for (const fieldSources of fieldSourcesList) {
    for (const source of Object.values(fieldSources)) {
      counts.set(source, (counts.get(source) ?? 0) + 1)
    }
  }
  let dominant: string | null = null
  let dominantCount = 0
  for (const [source, count] of counts) {
    if (
      count > dominantCount ||
      (count === dominantCount && dominant !== null && source < dominant)
    ) {
      dominant = source
      dominantCount = count
    }
  }
  return dominant
}

export function computeFieldSourceMarkers(
  ...fieldSourcesList: Array<Record<string, string>>
): FieldSourceMarkers {
  const dominant = dominantSource(...fieldSourcesList)

  const allSources = new Set<string>()
  const sourcesByField = new Map<string, Set<string>>()
  for (const fieldSources of fieldSourcesList) {
    for (const [field, source] of Object.entries(fieldSources)) {
      allSources.add(source)
      const set = sourcesByField.get(field) ?? new Set<string>()
      set.add(source)
      sourcesByField.set(field, set)
    }
  }

  const markerBySource = new Map<string, string>()
  const exceptionSources = [...allSources].filter((s) => s !== dominant).sort()
  exceptionSources.forEach((source, i) => {
    markerBySource.set(source, MARKER_GLYPHS[i % MARKER_GLYPHS.length])
  })

  const markerByField = new Map<string, FieldMarker>()
  for (const [field, fieldSourceSet] of sourcesByField) {
    // A field is an exception when ANY input record attributes it to a
    // non-dominant source (GNB's unMember differs from FRA's, for example).
    // If a field differed from dominant via two different sources at once,
    // the lexicographically smallest exception source wins the glyph —
    // deterministic; never occurs in the bundled data.
    const exceptions = [...fieldSourceSet].filter((s) => s !== dominant).sort()
    const source = exceptions[0]
    if (source !== undefined) {
      const glyph = markerBySource.get(source)
      if (glyph !== undefined) markerByField.set(field, { glyph, source })
    }
  }

  return { dominantSource: dominant, markerBySource, markerByField }
}
