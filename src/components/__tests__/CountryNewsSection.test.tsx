import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CountryNewsSection } from '../CountryNewsSection'

function mockFetch(response: unknown, status = 200): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
  } as Response) as unknown as typeof fetch
}

describe('CountryNewsSection', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('renders loading state while fetch in flight', () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch
    render(<CountryNewsSection cca3="DEU" />)
    expect(screen.getByText(/Loading news/i)).toBeTruthy()
  })

  it('renders 5 article links on success', async () => {
    mockFetch({
      updatedAt: '2026-04-23T06:00:00.000Z',
      country: { cca3: 'DEU', name: 'Germany' },
      guardianTag: 'world/germany',
      articles: [1, 2, 3, 4, 5].map((i) => ({
        id: `world/2026/apr/2${i}/story-${i}`,
        title: `Story ${i}`,
        trailText: `Summary ${i}`,
        url: `https://www.theguardian.com/world/2026/apr/2${i}/story-${i}`,
        publishedAt: `2026-04-2${i}T12:00:00.000Z`,
        section: 'world',
        thumbnail: null,
        scope: 'country' as const,
      })),
    })
    render(<CountryNewsSection cca3="DEU" />)
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(5))
    expect(screen.getByText('Story 1')).toBeTruthy()
  })

  it('renders region badge when scope is region', async () => {
    mockFetch({
      updatedAt: '2026-04-23T06:00:00.000Z',
      country: { cca3: 'DEU', name: 'Germany' },
      guardianTag: 'world/germany',
      articles: [
        {
          id: 'world/a',
          title: 'Country story',
          trailText: '',
          url: 'https://www.theguardian.com/a',
          publishedAt: '2026-04-22T12:00:00.000Z',
          section: 'world',
          thumbnail: null,
          scope: 'country' as const,
        },
        {
          id: 'world/b',
          title: 'Region story',
          trailText: '',
          url: 'https://www.theguardian.com/b',
          publishedAt: '2026-04-21T12:00:00.000Z',
          section: 'world',
          thumbnail: null,
          scope: 'region' as const,
        },
      ],
    })
    render(<CountryNewsSection cca3="DEU" />)
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(2))
    const regionBadges = screen.getAllByText(/Europe|Region/i)
    expect(regionBadges.length).toBeGreaterThan(0)
  })

  it('renders empty-state line when articles is empty', async () => {
    mockFetch({
      updatedAt: '2026-04-23T06:00:00.000Z',
      country: { cca3: 'TUV', name: 'Tuvalu' },
      guardianTag: null,
      articles: [],
    })
    render(<CountryNewsSection cca3="TUV" />)
    await waitFor(() => expect(screen.getByText(/No recent Guardian stories/i)).toBeTruthy())
  })

  it('renders "News unavailable" on 404', async () => {
    mockFetch({}, 404)
    render(<CountryNewsSection cca3="XXX" />)
    await waitFor(() => expect(screen.getByText(/News unavailable/i)).toBeTruthy())
  })
})
