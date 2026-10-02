/**
 * The crash fallback renders on the space-dark body backdrop (index.css:105-107,
 * space-dark in BOTH themes per DESIGN.md's Space-Dark Rule). Nothing declares a
 * root `color` or `color-scheme`, so an element with no color class inherits the
 * UA default black — 1.10:1 on #0a0f1f. That was this surface's bug: the
 * headline had no color class at all. These tests pin that every text node
 * carries an explicit color and that the CTA uses the ice recipe.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppCrashFallback } from '../AppCrashFallback'

describe('AppCrashFallback', () => {
  it('gives the headline an explicit color class (no UA-default inheritance)', () => {
    render(<AppCrashFallback />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.className).toMatch(/\btext-dark-50\b/)
  })

  it('gives the body copy an explicit color class', () => {
    render(<AppCrashFallback />)
    const body = screen.getByText(/unexpected error occurred/i)
    expect(body.className).toMatch(/\btext-dark-100\b/)
  })

  it('uses the ice primary-CTA recipe, identical in both themes', () => {
    render(<AppCrashFallback />)
    const button = screen.getByRole('button', { name: /refresh/i })
    expect(button.className).toContain('bg-ice-accessible')
    expect(button.className).toContain('hover:bg-ice-dim')
    // DESIGN.md: the primary CTA is identical in both themes — no dark: split.
    expect(button.className).not.toMatch(/\bdark:/)
  })

  it('carries no raw neutral palette class', () => {
    render(<AppCrashFallback />)
    const html = document.body.innerHTML
    expect(html).not.toMatch(/-(slate|gray|zinc|neutral|stone)-\d{2,3}/)
  })

  it('announces itself to assistive tech', () => {
    render(<AppCrashFallback />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})
