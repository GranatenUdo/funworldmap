type Reason = 'timeout' | 'style' | 'country-data' | 'webgl-lost'

interface Props {
  reason: Reason
  onRetry: () => void
}

const REASON_MESSAGES: Record<Reason, { title: string; body: string }> = {
  timeout: {
    title: "We couldn't load the map",
    body: 'The map took too long to load. This is usually a network hiccup.',
  },
  style: {
    title: "We couldn't load the map",
    body: 'The basemap service is unreachable right now.',
  },
  'country-data': {
    title: "We couldn't load country data",
    body: 'The country outlines failed to load. Try again in a moment.',
  },
  'webgl-lost': {
    title: 'Map paused',
    body: 'The map briefly lost its graphics context. Tap to restore.',
  },
}

export function MapErrorOverlay({ reason, onRetry }: Props) {
  const { title, body } = REASON_MESSAGES[reason]
  return (
    <div
      data-testid="map-error-overlay"
      role="alert"
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-white/90 backdrop-blur-sm dark:bg-slate-950/90"
    >
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{body}</p>
        <button
          data-testid="map-error-retry"
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
