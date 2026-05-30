import { afterEach, describe, expect, it } from 'vitest'
import { cleanupLegacyDailyStorage } from '../legacyStorageCleanup'

describe('cleanupLegacyDailyStorage', () => {
  afterEach(() => localStorage.clear())

  it('removes the two legacy daily keys', () => {
    localStorage.setItem('funworldmap-daily-history', '{"version":1}')
    localStorage.setItem('funworldmap-daily-resume', '{"version":1}')
    localStorage.setItem('funworldmap-game-country-pinning-bests-v2', '{"bestScore":5}')

    cleanupLegacyDailyStorage()

    expect(localStorage.getItem('funworldmap-daily-history')).toBeNull()
    expect(localStorage.getItem('funworldmap-daily-resume')).toBeNull()
    expect(localStorage.getItem('funworldmap-game-country-pinning-bests-v2')).not.toBeNull()
  })

  it('is idempotent and safe when keys are absent', () => {
    expect(() => {
      cleanupLegacyDailyStorage()
      cleanupLegacyDailyStorage()
    }).not.toThrow()
    expect(localStorage.getItem('funworldmap-daily-history')).toBeNull()
    expect(localStorage.getItem('funworldmap-daily-resume')).toBeNull()
  })
})
