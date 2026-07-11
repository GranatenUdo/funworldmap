import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimezoneList } from '../TimezoneList'

describe('TimezoneList', () => {
  it('renders ≤3 timezones inline without a toggle', () => {
    render(<TimezoneList timezones={['UTC+01:00']} />)
    expect(screen.getByText('UTC+01:00')).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('collapses >3 to the first 3 plus a +N more toggle', () => {
    const zones = ['UTC-10:00', 'UTC-09:30', 'UTC-09:00', 'UTC+01:00', 'UTC+02:00']
    render(<TimezoneList timezones={zones} />)
    expect(screen.getByText(/UTC-10:00, UTC-09:30, UTC-09:00/)).toBeDefined()
    expect(screen.queryByText(/UTC\+01:00/)).toBeNull()
    const toggle = screen.getByRole('button', { name: '+2 more' })
    fireEvent.click(toggle)
    expect(screen.getByText(/UTC\+02:00/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
    expect(screen.queryByText(/UTC\+02:00/)).toBeNull()
  })
})
