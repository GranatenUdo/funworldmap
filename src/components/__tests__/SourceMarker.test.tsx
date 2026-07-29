import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SourceMarker } from '../SourceMarker'
import { sources } from './singleCountryPanelTestUtils'

describe('SourceMarker (C4 exception marker)', () => {
  it('renders a Tab-reachable link labelled with its source', () => {
    render(<SourceMarker glyph={'†'} sourceKey="restcountries" sources={sources} />)
    const link = screen.getByRole('link', { name: 'Source: REST Countries' })
    expect(link.textContent).toBe('†')
    expect(link.getAttribute('href')).toBe('https://restcountries.com')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.getAttribute('data-testid')).toBe('source-marker-restcountries')
    // In sequential Tab order — the A-batch retired hover-only attribution;
    // regressing to tabIndex={-1} fails here.
    expect(link.tabIndex).toBe(0)
  })

  it('renders nothing when the source key is absent from _sources (GNB manual-override case)', () => {
    const { container } = render(
      <SourceMarker glyph={'†'} sourceKey="manual-override" sources={sources} />,
    )
    expect(container.innerHTML).toBe('')
  })
})
