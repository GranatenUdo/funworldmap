import type { ModeId } from '../game/shared/types'

export type EventSchema = {
  free_started: { mode: ModeId }
  launcher_dismissed: { path: 'search' | 'escape' | 'card' | 'backdrop' | 'close' }
  header_cta_clicked: Record<string, never>
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

  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined
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
