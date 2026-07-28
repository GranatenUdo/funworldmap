/**
 * Enter must commit the top result without any arrow-key press — the top
 * result is auto-activated when results appear ("Search First", approved
 * 2026-07-10, batch-1 spec item 3). Arrow keys still move the active option.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SearchBar from '../SearchBar'
import { makeCountryData } from '../../test/countryFixtures'
import { stubMatchMedia } from '../../test/matchMediaStub'
import { FINE_POINTER_MEDIA_QUERY } from '../../lib/layoutConstants'

const FRANCE = makeCountryData()
const GERMANY = makeCountryData({
  cca3: 'DEU',
  ccn3: '276',
  cca2: 'DE',
  name: { common: 'Germany', official: 'Federal Republic of Germany' },
  capital: ['Berlin'],
})
const countries = [FRANCE, GERMANY]

// SearchBar calls useMediaQuery (A11 chip) and jsdom has no matchMedia —
// every render needs the stub. `finePointer` steers only the fine-pointer
// query; it is read lazily at matchMedia call time, so tests set it before
// calling setup().
let finePointer = false
let restoreMatchMedia: () => void

beforeEach(() => {
  restoreMatchMedia = stubMatchMedia((query) => query === FINE_POINTER_MEDIA_QUERY && finePointer)
})

afterEach(() => {
  restoreMatchMedia()
  finePointer = false
})

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

  it('Enter during the debounce window does NOT commit the previous query’s results', async () => {
    const { onSelect, input } = setup()
    // Settle France as the fresh, auto-activated top result.
    fireEvent.change(input, { target: { value: 'fran' } })
    const option = await screen.findByRole('option', { name: /France/ })
    await waitFor(() => expect(option.getAttribute('aria-selected')).toBe('true'))

    // Retype and press Enter immediately: results are still France's (stale),
    // so Enter must be a no-op instead of committing FRA against 'germ'
    // (2026-07-10 review finding).
    fireEvent.change(input, { target: { value: 'germ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).not.toHaveBeenCalled()

    // Once the fresh results land, Enter commits the new top result.
    const germany = await screen.findByRole('option', { name: /Germany/ })
    await waitFor(() => expect(germany.getAttribute('aria-selected')).toBe('true'))
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('DEU')
  })
})

describe('search input font-size floor (A2)', () => {
  it('pins max-sm:text-base + text-sm on the input (iOS auto-zoom guard)', () => {
    const { input } = setup()
    // jsdom cannot evaluate media queries, so pin the class literals - the
    // layoutConstants.test.ts drift-alarm style. max-sm:text-base keeps the
    // focused input at >=16px below sm so mobile Safari does not force-zoom;
    // text-sm keeps the compact 14px at sm+. (Note: "max-sm:text-base" does
    // not substring-match "text-sm", so both assertions are independent.)
    expect(input.className).toContain('max-sm:text-base')
    expect(input.className).toContain('text-sm')
  })
})

describe('"/" shortcut chip (A11)', () => {
  it('renders on fine-pointer devices when the input is idle and empty', () => {
    finePointer = true
    setup()
    expect(screen.getByTestId('search-shortcut-hint').textContent).toBe('/')
  })

  it('does not render on coarse pointers', () => {
    // finePointer stays false (touch devices: no hardware "/" to advertise)
    setup()
    expect(screen.queryByTestId('search-shortcut-hint')).toBeNull()
  })

  it('hides while the input is focused and returns on blur', () => {
    finePointer = true
    const { input } = setup()
    fireEvent.focus(input)
    expect(screen.queryByTestId('search-shortcut-hint')).toBeNull()
    fireEvent.blur(input)
    expect(screen.getByTestId('search-shortcut-hint')).toBeTruthy()
  })

  it('never coexists with the clear button (render conditions disjoint on query)', () => {
    finePointer = true
    const { input } = setup()
    // Non-empty query: clear button in, chip out — both target right-2.5,
    // so this disjointness is what prevents overlap.
    fireEvent.change(input, { target: { value: 'fran' } })
    expect(screen.queryByTestId('search-shortcut-hint')).toBeNull()
    expect(screen.getByTestId('search-clear')).toBeTruthy()
    // Clearing refocuses the input, so the chip stays hidden until blur.
    fireEvent.click(screen.getByTestId('search-clear'))
    expect(screen.queryByTestId('search-clear')).toBeNull()
    expect(screen.queryByTestId('search-shortcut-hint')).toBeNull()
    fireEvent.blur(input)
    expect(screen.getByTestId('search-shortcut-hint')).toBeTruthy()
  })
})

describe('SearchBar keyboard-hint footer (A14)', () => {
  it('renders the kbd footer on fine-pointer devices', async () => {
    finePointer = true
    const { input } = setup()
    fireEvent.change(input, { target: { value: 'fran' } })
    await screen.findByRole('option', { name: /France/ })
    expect(screen.getByTestId('search-keyboard-hint')).toBeTruthy()
  })

  it('drops the kbd footer on coarse pointers', async () => {
    restoreMatchMedia()
    restoreMatchMedia = stubMatchMedia(() => false)
    const { input } = setup()
    fireEvent.change(input, { target: { value: 'fran' } })
    await screen.findByRole('option', { name: /France/ })
    expect(screen.queryByTestId('search-keyboard-hint')).toBeNull()
  })
})
