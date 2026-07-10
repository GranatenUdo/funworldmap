/**
 * Enter must commit the top result without any arrow-key press — the top
 * result is auto-activated when results appear ("Search First", approved
 * 2026-07-10, batch-1 spec item 3). Arrow keys still move the active option.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SearchBar from '../SearchBar'
import { makeCountryData } from '../../test/countryFixtures'

const FRANCE = makeCountryData()
const GERMANY = makeCountryData({
  cca3: 'DEU',
  ccn3: '276',
  cca2: 'DE',
  name: { common: 'Germany', official: 'Federal Republic of Germany' },
  capital: ['Berlin'],
})
const countries = [FRANCE, GERMANY]

function setup() {
  const onSelect = vi.fn()
  render(<SearchBar countries={countries} onSelect={onSelect} />)
  return { onSelect, input: screen.getByRole('combobox') }
}

describe('SearchBar Enter behavior', () => {
  it('auto-activates the top result when results appear', async () => {
    const { input } = setup()
    fireEvent.change(input, { target: { value: 'fran' } })

    const option = await screen.findByRole('option', { name: /France/ })
    // The activation effect commits one render after the results do.
    await waitFor(() => expect(option.getAttribute('aria-selected')).toBe('true'))
  })

  it('Enter commits the top result without arrow keys', async () => {
    const { onSelect, input } = setup()
    fireEvent.change(input, { target: { value: 'fran' } })
    // Wait for auto-activation, not just presence — the activeIndex effect
    // commits one render after the results do.
    const option = await screen.findByRole('option', { name: /France/ })
    await waitFor(() => expect(option.getAttribute('aria-selected')).toBe('true'))

    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledWith('FRA')
  })

  it('ArrowDown moves the active option so Enter selects the second result', async () => {
    const { onSelect, input } = setup()
    // "an" fuzzy-matches both FrANce and GermANy.
    fireEvent.change(input, { target: { value: 'an' } })
    const options = await screen.findAllByRole('option')
    expect(options.length).toBeGreaterThan(1)
    // Wait for auto-activation so ArrowDown moves 0 → 1, not −1 → 0.
    await waitFor(() => expect(options[0].getAttribute('aria-selected')).toBe('true'))
    const secondName = options[1].textContent ?? ''
    const expected = countries.find((c) => secondName.includes(c.name.common))
    expect(expected).toBeDefined()

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledWith(expected?.cca3)
  })

  it('Enter with no results does nothing', async () => {
    const { onSelect, input } = setup()
    fireEvent.change(input, { target: { value: 'zzzz' } })
    await screen.findByTestId('search-no-results')

    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelect).not.toHaveBeenCalled()
  })
})
