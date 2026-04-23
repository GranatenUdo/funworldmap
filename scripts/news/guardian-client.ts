import { sanitise } from './sanitise'

export interface GuardianArticle {
  id: string
  title: string
  trailText: string
  url: string
  publishedAt: string
  section: string
  thumbnail: string | null
}

interface GuardianRawResult {
  id: string
  sectionId: string
  webPublicationDate: string
  webTitle: string
  webUrl: string
  fields?: { trailText?: string; thumbnail?: string }
}

interface GuardianResponse {
  response: {
    status: string
    results: GuardianRawResult[]
  }
}

const BASE = 'https://content.guardianapis.com/search'

export async function guardianSearch(params: {
  tag: string
  fromDate: string // YYYY-MM-DD
  pageSize: number
  apiKey: string
}): Promise<GuardianArticle[]> {
  const qs = new URLSearchParams({
    tag: params.tag,
    'from-date': params.fromDate,
    'order-by': 'newest',
    'page-size': String(params.pageSize),
    'show-fields': 'trailText,thumbnail',
    'api-key': params.apiKey,
  })
  const res = await fetch(`${BASE}?${qs}`)
  if (!res.ok) throw new Error(`guardian ${params.tag} → HTTP ${res.status}`)
  const data = (await res.json()) as GuardianResponse
  if (data.response.status !== 'ok') {
    throw new Error(`guardian ${params.tag} → status=${data.response.status}`)
  }
  return data.response.results.map((r) => ({
    id: r.id,
    title: sanitise(r.webTitle),
    trailText: sanitise(r.fields?.trailText ?? ''),
    url: r.webUrl,
    publishedAt: r.webPublicationDate,
    section: r.sectionId,
    thumbnail: r.fields?.thumbnail ?? null,
  }))
}
