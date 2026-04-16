import { describe, it, expect, vi, beforeEach } from 'vitest'

const initMock = vi.fn()
vi.mock('@sentry/react', () => ({
  init: (...args: unknown[]) => initMock(...args),
  ErrorBoundary: ({ children }: { children: unknown }) => children,
}))

import { initSentry } from '../initSentry'

describe('initSentry', () => {
  beforeEach(() => {
    initMock.mockClear()
  })

  it('does not call Sentry.init when DSN is missing', () => {
    initSentry(undefined)
    expect(initMock).not.toHaveBeenCalled()
  })

  it('does not call Sentry.init when DSN is empty', () => {
    initSentry('')
    expect(initMock).not.toHaveBeenCalled()
  })

  it('calls Sentry.init with the DSN when provided', () => {
    initSentry('https://examplePublicKey@o0.ingest.sentry.io/0')
    expect(initMock).toHaveBeenCalledTimes(1)
    const arg = initMock.mock.calls[0][0] as Record<string, unknown>
    expect(arg.dsn).toBe('https://examplePublicKey@o0.ingest.sentry.io/0')
    expect(arg.tracesSampleRate).toBe(0)
  })
})
