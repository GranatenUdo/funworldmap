import type { ModeId } from '../game/shared/types'

export type EventSchema = {
  daily_opened: { mode: ModeId; dateAge: number }
  daily_started: { mode: ModeId }
  daily_attempted: { mode: ModeId; attemptIndex: number; scoreBucket: number }
  daily_completed: { mode: ModeId; bestScoreBucket: number; attemptsUsed: number }
  daily_shared: { date: string; modesPlayed: 1 | 2; method: 'share-api' | 'clipboard-text' | 'clipboard-link' }
  free_started: { mode: ModeId }
  history_opened: Record<string, never>
  history_cell_clicked: { cellKind: 'played' | 'unplayed-in-window' | 'rolled-off' }
  streak_reached_milestone: { days: 3 | 7 | 14 | 30 | 100 }
  launcher_dismissed: { path: 'link' | 'search' | 'escape' | 'card' }
  deep_link_opened: {
    dateKind: 'today' | 'past' | 'future'
    outcome: 'start' | 'resume' | 'reveal' | 'redirect'
  }
}

export type EventName = keyof EventSchema

interface TestAnalyticsWindow extends Window {
  __PLAYWRIGHT__?: boolean
  __testAnalytics?: Array<{ name: EventName; props: EventSchema[EventName] }>
}

export function track<N extends EventName>(name: N, props: EventSchema[N]): void {
  if (typeof window === 'undefined') return

  const w = window as TestAnalyticsWindow
  if (w.__PLAYWRIGHT__) {
    if (!w.__testAnalytics) w.__testAnalytics = []
    w.__testAnalytics.push({ name, props })
    return
  }

  if (navigator.doNotTrack === '1') return

  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT
  if (!endpoint) return

  const body = JSON.stringify({ name, props })

  if (typeof navigator.sendBeacon === 'function') {
    try {
      navigator.sendBeacon(endpoint, body)
      return
    } catch {
      // fall through to fetch
    }
  }

  void fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // best-effort — swallow
  })
}
