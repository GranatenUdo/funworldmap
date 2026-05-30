import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App'
import { initSentry } from './lib/initSentry'
import { cleanupLegacyDailyStorage } from './lib/legacyStorageCleanup'

initSentry(import.meta.env.VITE_SENTRY_DSN as string | undefined)
cleanupLegacyDailyStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div role="alert" className="flex h-screen items-center justify-center p-6 text-center">
          <div className="max-w-md">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              An unexpected error occurred. Refresh the page to try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
            >
              Refresh
            </button>
          </div>
        </div>
      }
    >
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
