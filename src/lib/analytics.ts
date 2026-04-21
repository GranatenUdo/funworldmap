export type EventName =
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

export type EventProps = Record<string, string | number>

interface TestAnalyticsWindow extends Window {
  __PLAYWRIGHT__?: boolean
  __testAnalytics?: Array<{ name: EventName; props?: EventProps }>
}

export function track(name: EventName, props?: EventProps): void {
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
