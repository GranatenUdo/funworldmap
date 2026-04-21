import type { ModeId } from './types'

export const LAST_MODE_KEY = 'funworldmap-game-last-mode'

export function readLastMode(): ModeId {
  try {
    const v = localStorage.getItem(LAST_MODE_KEY)
    if (v === 'country-pinning' || v === 'city-guessing') return v
  } catch {
    /* ignore: private mode / disabled storage */
  }
  return 'country-pinning'
}

export function writeLastMode(modeId: ModeId): void {
  try {
    localStorage.setItem(LAST_MODE_KEY, modeId)
  } catch {
    /* ignore */
  }
}
