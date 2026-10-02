import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App'
import { AppCrashFallback } from './components/AppCrashFallback'
import { initSentry } from './lib/initSentry'
import { cleanupLegacyDailyStorage } from './lib/legacyStorageCleanup'

initSentry(import.meta.env.VITE_SENTRY_DSN as string | undefined)
cleanupLegacyDailyStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<AppCrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
