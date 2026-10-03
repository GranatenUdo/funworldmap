import { stubMatchMedia } from '../../test/matchMediaStub'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useGameAnnouncements } from '../hooks/useGameAnnouncements'
import { makeSession, makeCountryRound, makeOutcome, makeCountryReveal } from './__tests__/factories'
import { getMode } from '../modes'
import { countriesFixture, citiesFixture, byCca3Fixture } from '../hooks/__tests__/fixtures'

afterEach(() => { cleanup(); vi.useRealTimers() })
describe('manual reveals', () => {
 it('never advances or finalizes through time or global keyboard shortcuts', () => {
  stubMatchMedia()
  vi.useFakeTimers()
  const advance = vi.fn(), finalize = vi.fn()
  renderHook(() => useGameAnnouncements({ session: makeSession({status:'round-ended',currentRound:makeCountryRound(),lastOutcome:makeOutcome(makeCountryReveal(),true)}),mode:getMode('country-pinning',{countries:countriesFixture,cities:citiesFixture}),byCca3:byCca3Fixture,advance,finalize,record:vi.fn() }))
  act(() => { vi.advanceTimersByTime(60000); for (const key of ['Enter','Escape',' ']) window.dispatchEvent(new KeyboardEvent('keydown',{key})) })
  expect(advance).not.toHaveBeenCalled(); expect(finalize).not.toHaveBeenCalled()
 })
})
