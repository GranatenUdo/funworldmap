import { describe, it, expect, afterEach, vi } from 'vitest'
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

  it('renders 5 article links with domain and relative time', async () => {
    mockFetch({
      updatedAt: '2026-04-24T06:00:00.000Z',
      country: { cca3: 'DEU', name: 'Germany' },
      articles: [1, 2, 3, 4, 5].map((i) => ({
        id: `https://www.bbc.com/story-${i}`,
        title: `Story ${i}`,
        url: `https://www.bbc.com/story-${i}`,
        publishedAt: `2026-04-2${i}T12:00:00.000Z`,
        domain: 'bbc.com',
        thumbnail: null,
      })),
    })
    render(<CountryNewsSection cca3="DEU" />)
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(6)) // 5 articles + GDELT attribution link
    expect(screen.getByText('Story 1')).toBeTruthy()
    expect(screen.getAllByText('bbc.com').length).toBeGreaterThan(0)
  })

  it('renders GDELT attribution link when articles present', async () => {
    mockFetch({
      updatedAt: '2026-04-24T06:00:00.000Z',
      country: { cca3: 'DEU', name: 'Germany' },
      articles: [
        {
          id: 'https://www.bbc.com/a',
          title: 'Story',
          url: 'https://www.bbc.com/a',
          publishedAt: '2026-04-23T12:00:00.000Z',
          domain: 'bbc.com',
          thumbnail: null,
        },
      ],
    })
    render(<CountryNewsSection cca3="DEU" />)
    await waitFor(() => {
      expect(screen.getByText(/GDELT Project/i)).toBeTruthy()
    })
  })

  it('renders updated empty-state line when articles is empty', async () => {
    mockFetch({
      updatedAt: '2026-04-24T06:00:00.000Z',
      country: { cca3: 'TUV', name: 'Tuvalu' },
      articles: [],
    })
    render(<CountryNewsSection cca3="TUV" />)
    await waitFor(() => {
      expect(screen.getByText(/No recent English-language news/i)).toBeTruthy()
    })
  })

  it('renders "News unavailable" on 404', async () => {
    mockFetch({}, 404)
    render(<CountryNewsSection cca3="XXX" />)
    await waitFor(() => expect(screen.getByText(/News unavailable/i)).toBeTruthy())
  })
})
