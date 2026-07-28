import { describe, expect, it } from 'vitest'
import { MESSAGES } from '../messages'

const km = (n: number) => Math.round(n).toLocaleString()

describe('MESSAGES.wrong — distance-led copy (A6)', () => {
  it('leads with the clicked country and its distance from the target', () => {
    expect(MESSAGES.wrong(9, 'Bangladesh', 'Germany', 7050)).toBe(
      `That was Germany — ${km(7050)} km from Bangladesh. +9 proximity pts · −1 life.`,
    )
  })

  it('rounds fractional distances before formatting', () => {
    expect(MESSAGES.wrong(85, 'France', 'Belgium', 493.6)).toContain(`${km(493.6)} km from France`)
  })

  it('drops the distance clause when distanceKm is unknown', () => {
    expect(MESSAGES.wrong(9, 'Bangladesh', 'Germany', null)).toBe(
      'That was Germany. +9 proximity pts · −1 life.',
    )
  })

  it('keeps a generic line when no country was clicked', () => {
    expect(MESSAGES.wrong(0, 'Bangladesh', null, null)).toBe('Wrong. +0 proximity pts · −1 life.')
  })

  it('never repeats the answer sentence — the HUD prompt already names the target', () => {
    expect(MESSAGES.wrong(9, 'Bangladesh', 'Germany', 7050)).not.toContain('The answer was')
  })
})
