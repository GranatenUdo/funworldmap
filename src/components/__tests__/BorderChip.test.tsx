import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BorderChip } from '../BorderChip'
import { makeCountry } from './singleCountryPanelTestUtils'

describe('BorderChip', () => {
  it('renders a clickable button with flag for a matched neighbor (panel size)', () => {
    const onSelect = vi.fn()
    render(
      <BorderChip
        code="DZA"
        neighbor={makeCountry({ cca3: 'DZA', name: { common: 'Algeria', official: 'Algeria' } })}
        onSelect={onSelect}
        size="panel"
      />,
    )
    expect(screen.getByRole('button', { name: 'Algeria' }).querySelector('img')).not.toBeNull()
    screen.getByRole('button', { name: 'Algeria' }).click()
    expect(onSelect).toHaveBeenCalledWith('DZA')
  })

  it('omits the flag in compare size', () => {
    render(
      <BorderChip
        code="DZA"
        neighbor={makeCountry({ cca3: 'DZA', name: { common: 'Algeria', official: 'Algeria' } })}
        onSelect={() => {}}
        size="compare"
      />,
    )
    expect(screen.getByRole('button', { name: 'Algeria' }).querySelector('img')).toBeNull()
  })

  it('renders unmatched codes inert in both sizes, with the resolved name not the raw code', () => {
    const onSelect = vi.fn()
    const { rerender } = render(
      <BorderChip code="ESH" neighbor={undefined} onSelect={onSelect} size="panel" />,
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Western Sahara')).toBeTruthy()
    expect(screen.queryByText('ESH')).toBeNull()
    rerender(<BorderChip code="ESH" neighbor={undefined} onSelect={onSelect} size="compare" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders the static fallback name for UNK (not in the dataset)', () => {
    render(<BorderChip code="UNK" neighbor={undefined} onSelect={vi.fn()} size="panel" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Kosovo')).toBeTruthy()
  })

  it('falls back to the raw code for a truly unknown code', () => {
    render(<BorderChip code="ZZZ" neighbor={undefined} onSelect={vi.fn()} size="panel" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('ZZZ')).toBeTruthy()
  })
})
