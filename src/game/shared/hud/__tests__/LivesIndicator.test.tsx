import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LivesIndicator } from '../LivesIndicator'

function hearts(): SVGElement[] {
  return Array.from(screen.getByTestId('hud-lives').querySelectorAll('svg'))
}

describe('LivesIndicator', () => {
  it('labels the remaining lives', () => {
    render(<LivesIndicator lives={2} />)
    expect(screen.getByTestId('hud-lives').getAttribute('aria-label')).toBe('2 lives remaining')
  })

  // A-2 drift alarm (owner-approved inversion of E4's heart doctrine,
  // 2026-08-04): hearts encode LIFE — a REMAINING life is a filled signal
  // heart, a SPENT life is a hollow neutral outline. Signal still means live
  // game state, now pointing at what remains.
  it('renders remaining hearts filled signal and spent hearts hollow neutral', () => {
    render(<LivesIndicator lives={1} />)
    const all = hearts()
    expect(all).toHaveLength(3)
    // Heart 0 is remaining (i < lives); hearts 1 and 2 are spent.
    expect(all[0].getAttribute('class')).toContain('text-signal-accessible dark:text-signal')
    expect(all[0].getAttribute('fill')).toBe('currentColor')
    expect(all[0].hasAttribute('stroke')).toBe(false)
    for (const spent of all.slice(1)) {
      expect(spent.getAttribute('class')).toContain('text-sand-400 dark:text-dark-200')
      expect(spent.getAttribute('fill')).toBe('none')
      expect(spent.getAttribute('stroke')).toBe('currentColor')
    }
  })

  it('stages the last life: pulse class and marker on the surviving heart only', () => {
    render(<LivesIndicator lives={1} />)
    const all = hearts()
    expect(all[0].getAttribute('data-last-life')).toBe('true')
    expect(all[0].getAttribute('class')).toContain('heart-last-life')
    for (const other of all.slice(1)) {
      expect(other.hasAttribute('data-last-life')).toBe(false)
      expect(other.getAttribute('class')).not.toContain('heart-last-life')
    }
  })

  it.each([0, 2, 3] as const)('applies no last-life staging at %i lives', (lives) => {
    render(<LivesIndicator lives={lives} />)
    for (const heart of hearts()) {
      expect(heart.hasAttribute('data-last-life')).toBe(false)
      expect(heart.getAttribute('class')).not.toContain('heart-last-life')
    }
  })
})
