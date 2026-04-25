import { describe, it, expect, vi, afterEach } from 'vitest'
import { gdeltSearch } from '../gdelt-client'

interface RawRow {
  url: string
  title: string
  seendate: string
  socialimage?: string
  domain: string
  language: string
}

function mockGdelt(articles: RawRow[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ articles }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  )
}

describe('gdeltSearch URL allowlist', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('drops articles whose url is not http(s)', async () => {
    mockGdelt([
      {
        url: 'javascript:alert(1)',
        title: 'evil',
        seendate: '20260424T120000Z',
        domain: 'evil.example',
        language: 'English',
      },
      {
        url: 'https://good.example/a',
        title: 'good',
        seendate: '20260424T120000Z',
        domain: 'good.example',
        language: 'English',
      },
    ])
    const out = await gdeltSearch({
      fips: 'GM',
      sourceLang: 'english',
      timespan: '7d',
      maxRecords: 5,
    })
    expect(out).toHaveLength(1)
    expect(out[0].url).toBe('https://good.example/a')
  })

  it('keeps article but nulls thumbnail when socialimage is non-http(s)', async () => {
    mockGdelt([
      {
        url: 'https://good.example/a',
        title: 'good',
        seendate: '20260424T120000Z',
        socialimage: 'data:image/png;base64,abc',
        domain: 'good.example',
        language: 'English',
      },
    ])
    const out = await gdeltSearch({
      fips: 'GM',
      sourceLang: 'english',
      timespan: '7d',
      maxRecords: 5,
    })
    expect(out).toHaveLength(1)
    expect(out[0].thumbnail).toBeNull()
  })

  it('passes clean http(s) url + thumbnail through unchanged', async () => {
    mockGdelt([
      {
        url: 'https://good.example/a',
        title: 'good',
        seendate: '20260424T120000Z',
        socialimage: 'https://cdn.example/img.jpg',
        domain: 'good.example',
        language: 'English',
      },
    ])
    const out = await gdeltSearch({
      fips: 'GM',
      sourceLang: 'english',
      timespan: '7d',
      maxRecords: 5,
    })
    expect(out).toHaveLength(1)
    expect(out[0].url).toBe('https://good.example/a')
    expect(out[0].thumbnail).toBe('https://cdn.example/img.jpg')
  })

  it('drops articles whose url throws on URL constructor (malformed)', async () => {
    mockGdelt([
      {
        url: 'not a url',
        title: 'bad',
        seendate: '20260424T120000Z',
        domain: 'bad.example',
        language: 'English',
      },
    ])
    const out = await gdeltSearch({
      fips: 'GM',
      sourceLang: 'english',
      timespan: '7d',
      maxRecords: 5,
    })
    expect(out).toHaveLength(0)
  })
})
