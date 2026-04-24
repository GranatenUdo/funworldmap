import { sanitise } from './sanitise'

export interface GdeltArticle {
  id: string          // article URL — GDELT has no stable ID
  title: string
  url: string
  publishedAt: string // ISO; normalised from GDELT's "seendate"
  domain: string
  thumbnail: string | null
}

interface GdeltRawArticle {
  url: string
  url_mobile?: string
  title: string
  seendate: string        // YYYYMMDDTHHMMSSZ (e.g. 20260424T021500Z)
  socialimage?: string
  domain: string
  language: string
  sourcecountry?: string
}

interface GdeltResponse {
  articles?: GdeltRawArticle[]
  status?: string
}

const BASE = 'https://api.gdeltproject.org/api/v2/doc/doc'

/**
 * Parses GDELT's "seendate" format (YYYYMMDDTHHMMSSZ) into an ISO timestamp.
 *
 * Example: "20260424T021500Z" → "2026-04-24T02:15:00Z"
 */
function seendateToIso(seendate: string): string {
  if (!/^\d{8}T\d{6}Z$/.test(seendate)) {
    // Unexpected format — return as-is; downstream relativeTime() handles
    // "invalid" gracefully (returns 'just now').
    return seendate
  }
  const y = seendate.slice(0, 4)
  const m = seendate.slice(4, 6)
  const d = seendate.slice(6, 8)
  const hh = seendate.slice(9, 11)
  const mm = seendate.slice(11, 13)
  const ss = seendate.slice(13, 15)
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`
}

export interface GdeltSearchParams {
  fips: string        // 2-letter FIPS-10-4 country code (GDELT locationcc:)
  sourceLang: string  // e.g. 'english' — GDELT uses full English names, not ISO codes
  timespan: string    // e.g. '7d'
  maxRecords: number  // 1..250
}

export async function gdeltSearch(params: GdeltSearchParams): Promise<GdeltArticle[]> {
  // NOTE: verified 2026-04-24 — GDELT's country filter is `locationcc:` (NOT
  // `location:`); language filter uses full English names (`sourcelang:english`,
  // NOT `sourcelang:eng`). Earlier attempts with shorter forms returned either
  // "keyword too short" or "invalid location search" errors.
  const qs = new URLSearchParams({
    query: `locationcc:${params.fips} sourcelang:${params.sourceLang}`,
    mode: 'ArtList',
    maxrecords: String(params.maxRecords),
    timespan: params.timespan,
    sort: 'hybridrel',
    format: 'json',
  })
  const res = await fetch(`${BASE}?${qs}`)
  if (!res.ok) throw new Error(`gdelt location:${params.fips} → HTTP ${res.status}`)
  const data = (await res.json()) as GdeltResponse
  const raw = data.articles ?? []
  return raw
    .filter((a) => a.language === 'English')
    .map((a) => ({
      id: a.url,
      title: sanitise(a.title),
      url: a.url,
      publishedAt: seendateToIso(a.seendate),
      domain: a.domain,
      thumbnail: a.socialimage && a.socialimage.length > 0 ? a.socialimage : null,
    }))
}
