import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLiveAnnouncements } from '../useLiveAnnouncements'

function Harness({ name }: { name: string | null }) {
  const ref = useLiveAnnouncements(name)
  return <div ref={ref} data-testid="live" />
}

describe('useLiveAnnouncements', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('announces selection and panel-close transitions', () => {
    const { getByTestId, rerender } = render(<Harness name={null} />)
    const live = getByTestId('live')
    rerender(<Harness name="France" />)
    expect(live.textContent).toBe('France selected')
    rerender(<Harness name={null} />)
    expect(live.textContent).toBe('Country panel closed')
  })

  it('mirrors a funworldmap:announce event and clears it after 8s', () => {
    const { getByTestId } = render(<Harness name={null} />)
    const live = getByTestId('live')
    window.dispatchEvent(new CustomEvent('funworldmap:announce', { detail: 'Round 2 of 3' }))
    expect(live.textContent).toBe('Round 2 of 3')
    vi.advanceTimersByTime(8000)
    expect(live.textContent).toBe('')
  })
})
