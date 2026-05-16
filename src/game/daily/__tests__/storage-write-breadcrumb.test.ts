import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import * as Sentry from '@sentry/react'
import { writeHistory } from '../storage'
import { writeResume, clearResume } from '../resume'

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}))

describe('write paths emit breadcrumb on failure', () => {
  let setItemSpy: MockInstance | undefined
  let removeItemSpy: MockInstance | undefined

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    setItemSpy?.mockRestore()
    removeItemSpy?.mockRestore()
  })

  it('writeHistory: addBreadcrumb on QuotaExceeded, no captureException', () => {
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    writeHistory({
      version: 1,
      days: {},
      streak: { current: 0, longest: 0, lastActiveDate: null, lastMilestoneShown: 0 },
    })
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'storage',
        level: 'warning',
      }),
    )
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('writeResume: addBreadcrumb on QuotaExceeded', () => {
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    writeResume({ version: 1, date: '2026-05-12', modeId: 'country-pinning', attempts: [] })
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'storage',
        level: 'warning',
      }),
    )
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('clearResume: addBreadcrumb if removal throws', () => {
    removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    clearResume()
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'storage',
        level: 'warning',
      }),
    )
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})
