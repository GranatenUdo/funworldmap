import { useState } from 'react'
import { probeBasemap } from '../lib/probeBasemap'
import { BASEMAP_STYLE } from '../lib/mapStyles'

const SESSION_KEY = 'funworldmap-basemap-banner-dismissed'
const PROBE_TIMEOUT_MS = 3_000

export function BasemapBanner() {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem(SESSION_KEY) === '1',
  )
  const [retrying, setRetrying] = useState(false)
  const [lastRetryAt, setLastRetryAt] = useState<Date | null>(null)

  const onDismiss = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      /* private mode */
    }
    setDismissed(true)
  }

  const onRetry = async () => {
    setRetrying(true)
    try {
      const result = await probeBasemap(BASEMAP_STYLE, PROBE_TIMEOUT_MS)
      if (result === 'ok') {
        window.location.reload()
        return
      }
    } catch {
      /* fall through */
    }
    setLastRetryAt(new Date())
    setRetrying(false)
  }

  if (dismissed) return null

  return (
    <div
      data-testid="basemap-banner"
      role="status"
      className="pointer-events-auto fixed inset-x-2 top-20 z-[60] rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 shadow-md dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
    >
      <span>
        Basemap tiles are slow or unavailable. Country outlines remain interactive.
        {lastRetryAt && (
          <span className="ml-2 text-[11px] opacity-75">
            (last retry {lastRetryAt.toLocaleTimeString()})
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="ml-3 underline underline-offset-2 hover:no-underline disabled:opacity-50"
        aria-label="Retry loading basemap tiles"
      >
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-2 underline underline-offset-2 hover:no-underline"
        aria-label="Dismiss basemap notice"
      >
        Dismiss
      </button>
    </div>
  )
}
