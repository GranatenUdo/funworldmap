import { useState } from 'react'

export function BasemapBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div
      data-testid="basemap-banner"
      role="status"
      className="pointer-events-auto fixed inset-x-2 top-20 z-[60] rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 shadow-md dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
    >
      <span>Basemap is temporarily unavailable — country outlines are still interactive.</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-3 underline underline-offset-2 hover:no-underline"
        aria-label="Dismiss basemap notice"
      >
        Dismiss
      </button>
    </div>
  )
}
