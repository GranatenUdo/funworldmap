import type { ModeId } from './types'
import { isCountryPinning } from './modePredicates'

export function formatModeScore(score: number, modeId: ModeId): string {
  return `${score}${isCountryPinning(modeId) ? '/100' : '/1000'}`
}
