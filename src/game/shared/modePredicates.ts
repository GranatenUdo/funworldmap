import type { ModeId } from './types'

/**
 * Type-guard predicates for ModeId. Keep these aligned with the ModeId union
 * in ./types. Centralised so 25+ scattered `session.modeId === 'country-pinning'`
 * comparisons read as `isCountryPinning(session.modeId)` and a single test of
 * the ModeId universe lives in this file.
 *
 * RULES OF USE:
 *   - DO use these for narrowing `ModeId`-typed values.
 *   - DON'T use these on `round.kind` discriminated-union discriminators —
 *     the literal-string `round.kind === 'country-pinning'` form is what
 *     enables TS to narrow `round` to the country-pinning member.
 */
export function isCountryPinning(id: ModeId): id is 'country-pinning' {
  return id === 'country-pinning'
}

export function isCityGuessing(id: ModeId): id is 'city-guessing' {
  return id === 'city-guessing'
}

/**
 * Validates an unknown input as a ModeId. Use when parsing localStorage,
 * hash fragments, or any other unsafe-source-of-strings boundary.
 */
export function isModeId(v: unknown): v is ModeId {
  return v === 'country-pinning' || v === 'city-guessing'
}
