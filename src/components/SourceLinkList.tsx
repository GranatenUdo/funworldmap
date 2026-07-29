import type { CountriesFile } from '../lib/types'

interface Props {
  sources: CountriesFile['_sources']
  /** Exception source key -> glyph (fieldSourceMarkers.markerBySource). */
  markerBySource: ReadonlyMap<string, string>
}

/**
 * The consolidated footer's "Sources:" line — linked source names, each
 * exception source prefixed with its C4/D2 marker glyph. Canonical owner
 * of this markup for BOTH panels (compare footer, single-panel footer):
 * import, never duplicate.
 *
 * Contrast (shipped pairings): #075985 on #fefdfb = 7.44:1 (light);
 * #7dd3fc on #161a22 = 10.45:1 (dark).
 */
export function SourceLinkList({ sources, markerBySource }: Props) {
  return (
    <>
      <span className="uppercase tracking-wider text-ice-accessible dark:text-ice font-medium">
        Sources:
      </span>{' '}
      {Object.entries(sources).map(([key, s], i) => (
        <span key={key}>
          {i > 0 && ' · '}
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ice-accessible dark:text-ice hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/60 dark:focus-visible:ring-ice/60 rounded"
          >
            {/* Marker key: the glyph precedes the exception source's name
                so field superscripts resolve here. Dominant source: no
                glyph. */}
            {markerBySource.has(key) && <sup className="mr-0.5">{markerBySource.get(key)}</sup>}
            {s.name}
          </a>
        </span>
      ))}
    </>
  )
}
