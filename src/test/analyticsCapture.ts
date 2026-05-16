/**
 * Shared analytics-capture helper for Vitest tests that need to assert
 * track() emits. Replaces 3 sites' worth of per-test beforeEach/afterEach
 * boilerplate that set window.__PLAYWRIGHT__ and managed window.__testAnalytics.
 *
 * Usage:
 *   const captured = installAnalyticsCapture()
 *   // … run code under test …
 *   expect(captured.events).toContainEqual({ name: 'free_started', props: {...} })
 *   captured.uninstall()
 *
 * Or in a beforeEach/afterEach pair:
 *   let captured: AnalyticsCapture
 *   beforeEach(() => { captured = installAnalyticsCapture() })
 *   afterEach(() => { captured.uninstall() })
 */

export interface AnalyticsCapture {
  /** The capture array — same reference also assigned to window.__testAnalytics. */
  events: Array<{ name: string; props: Record<string, unknown> }>
  /** Empty the events array in place (preserves the reference). */
  reset(): void
  /** Disable the seam: delete __PLAYWRIGHT__ and __testAnalytics from window. */
  uninstall(): void
}

export function installAnalyticsCapture(): AnalyticsCapture {
  const events: AnalyticsCapture['events'] = []
  window.__PLAYWRIGHT__ = true
  window.__testAnalytics = events
  return {
    events,
    reset() {
      events.length = 0
    },
    uninstall() {
      delete window.__PLAYWRIGHT__
      delete window.__testAnalytics
    },
  }
}
