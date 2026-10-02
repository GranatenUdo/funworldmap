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
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-sand-50/90 backdrop-blur-sm dark:bg-dark-500/90"
    >
      <div className="max-w-md rounded-2xl border border-sand-200/50 bg-sand-50 p-6 text-center shadow-2xl dark:border-dark-200/30 dark:bg-dark-400">
        <h2 className="text-lg font-semibold text-sand-900 dark:text-dark-50">{title}</h2>
        <p className="mt-2 text-sm text-sand-600 dark:text-dark-100">{body}</p>
        <button
          data-testid="map-error-retry"
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center rounded-xl bg-ice-accessible px-4 py-2 text-sm font-medium text-white hover:bg-ice-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/50 dark:focus-visible:ring-ice/50"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
