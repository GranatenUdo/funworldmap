import type { CountriesFile } from '../lib/types'

interface Props {
  /** Marker glyph from fieldSourceMarkers, e.g. '†'. */
  glyph: string
  /** Key into CountriesFile['_sources'] for the exception source. */
  sourceKey: string
  sources: CountriesFile['_sources']
}

/**
 * Superscript exception marker (C4/D2 scheme): rendered only where a field's
 * source differs from the panel's dominant source, keyed to the glyph shown
 * beside that source in the consolidated footer.
 *
 * A real link in the Tab order with an explicit accessible name — the A-batch
 * retired hover-only attribution affordances; never regress this to
 * tabIndex={-1} or a title-only hint.
 *
 * Renders nothing for source keys absent from _sources (e.g. GNB's
 * 'manual-override'), matching SourceTooltip's guard.
 *
 * Contrast (reuses the shipped footer-link pairing, no new pair):
 * #075985 on #fefdfb = 7.44:1 (light); #7dd3fc on #161a22 = 10.45:1 (dark).
 */
export function SourceMarker({ glyph, sourceKey, sources }: Props) {
  const source = sources[sourceKey] as CountriesFile['_sources'][string] | undefined
  if (!source) return null
  return (
    <sup className="ml-0.5 leading-none">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={`source-marker-${sourceKey}`}
        aria-label={`Source: ${source.name}`}
        className="text-[10px] font-medium text-ice-accessible dark:text-ice hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/60 dark:focus-visible:ring-ice/60 rounded"
      >
        {glyph}
      </a>
    </sup>
  )
}
