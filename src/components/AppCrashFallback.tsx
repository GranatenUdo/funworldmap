/**
 * Last-resort crash screen, rendered by Sentry's ErrorBoundary in main.tsx when
 * React throws. Extracted from main.tsx's inline `fallback={…}` prop so it can
 * be rendered — and therefore tested — without booting the app (main.tsx calls
 * createRoot().render() at module scope).
 *
 * Colours are the dark-ramp values with no `dark:` split, because the surface it
 * sits on is the space-dark body backdrop in BOTH themes (index.css:105-107;
 * DESIGN.md's Space-Dark Rule). This mirrors the ambient-pill precedent — "dark
 * in both themes". The headline previously had no colour class at all and
 * inherited UA-default black at 1.10:1; text-dark-50 is 17.4:1.
 */
export function AppCrashFallback() {
  return (
    <div role="alert" className="flex h-screen items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <h1 className="text-xl font-semibold text-dark-50">Something went wrong</h1>
        <p className="mt-2 text-sm text-dark-100">
          An unexpected error occurred. Refresh the page to try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-xl bg-ice-accessible px-4 py-2 text-sm font-medium text-white hover:bg-ice-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-ice/50"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
