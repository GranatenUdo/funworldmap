type EventName =
  | 'daily_opened'
  | 'daily_started'
  | 'daily_attempted'
  | 'daily_completed'
  | 'daily_shared'
  | 'free_started'
  | 'history_opened'
  | 'history_cell_clicked'
  | 'streak_reached_milestone'
  | 'launcher_dismissed'
  | 'deep_link_opened'

const KNOWN_EVENTS = new Set<EventName>([
  'daily_opened',
  'daily_started',
  'daily_attempted',
  'daily_completed',
  'daily_shared',
  'free_started',
  'history_opened',
  'history_cell_clicked',
  'streak_reached_milestone',
  'launcher_dismissed',
  'deep_link_opened',
])

const ALLOWED_ORIGINS = new Set([
  'https://funworldmap.com',
  'https://www.funworldmap.com',
])

interface Env {
  EVENTS: {
    writeDataPoint(data: {
      blobs?: string[]
      doubles?: number[]
      indexes?: string[]
    }): void
  }
}

interface EventPayload {
  name: EventName
  props?: Record<string, string | number>
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://funworldmap.com'
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin')

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    if (request.method !== 'POST') {
      return new Response('method not allowed', {
        status: 405,
        headers: corsHeaders(origin),
      })
    }

    let body: EventPayload
    try {
      body = (await request.json()) as EventPayload
    } catch {
      return new Response('invalid json', { status: 400, headers: corsHeaders(origin) })
    }

    if (!body || typeof body.name !== 'string' || !KNOWN_EVENTS.has(body.name)) {
      return new Response('unknown event', { status: 400, headers: corsHeaders(origin) })
    }

    const props = body.props ?? {}
    const str = (k: string) => (typeof props[k] === 'string' ? (props[k] as string) : '')
    const num = (k: string) => (typeof props[k] === 'number' ? (props[k] as number) : 0)

    env.EVENTS.writeDataPoint({
      indexes: [body.name],
      blobs: [
        body.name,
        str('mode'),
        str('path'),
        str('method'),
        str('dateKind'),
        str('outcome'),
        str('cellKind'),
      ],
      doubles: [
        num('dateAge'),
        num('scoreBucket'),
        num('bestScoreBucket'),
        num('attemptIndex'),
        num('attemptsUsed'),
        num('days'),
      ],
    })

    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  },
}
