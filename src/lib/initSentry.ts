import * as Sentry from '@sentry/react'

/**
 * Initialize Sentry if a DSN is provided at build time via VITE_SENTRY_DSN.
 * No-op otherwise so the app works in dev and forks without a Sentry account.
 */
export function initSentry(dsn: string | undefined): void {
  if (!dsn) return
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  })
}
