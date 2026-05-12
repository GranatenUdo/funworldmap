import * as Sentry from '@sentry/react'

const AREA = 'daily-storage'

export type DailyStorageKind = 'parse-failure' | 'unknown-version'

/**
 * Report daily-storage corruption to Sentry as an exception. Use for
 * read-side failures that indicate a real problem (parse failure, unknown
 * schema version) — NOT for benign branches like a missing localStorage
 * entry or yesterday's stale-date blob.
 */
export function captureDailyStorage(err: unknown, kind: DailyStorageKind): void {
  const error =
    err instanceof Error
      ? err
      : new Error(typeof err === 'string' ? err : 'daily-storage corruption')
  Sentry.captureException(error, {
    tags: { area: AREA, kind },
  })
}

/**
 * Emit a warning-level breadcrumb for an expected daily-storage write failure
 * (quota exceeded, private-mode Safari, storage disabled, etc.). These happen
 * frequently and are best-effort, so we record context but do NOT raise an
 * exception event.
 */
export function breadcrumbDailyStorage(message: string, err: unknown): void {
  Sentry.addBreadcrumb({
    category: 'storage',
    level: 'warning',
    message,
    data: {
      name: (err as Error)?.name,
      message: (err as Error)?.message,
    },
  })
}
