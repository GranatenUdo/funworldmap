import { describe, expect, it } from 'vitest'
import worker from '../index'

type WriteDataPoint = {
  blobs?: string[]
  doubles?: number[]
  indexes?: string[]
}

type Env = {
  EVENTS: {
    writeDataPoint: (data: WriteDataPoint) => void
  }
}

function makeEnv() {
  const writes: WriteDataPoint[] = []
  const env: Env = {
    EVENTS: {
      writeDataPoint: (d) => {
        writes.push(d)
      },
    },
  }
  return { env, writes }
}

function post(body: unknown, origin = 'https://funworldmap.com') {
  return new Request('https://funworldmap.com/api/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  })
}

describe('analytics worker', () => {
  it('accepts a well-formed known event and writes to Analytics Engine', async () => {
    const { env, writes } = makeEnv()
    const res = await worker.fetch(
      post({ name: 'free_started', props: { mode: 'country-pinning' } }),
      env,
      {} as ExecutionContext,
    )
    expect(res.status).toBe(204)
    expect(writes).toHaveLength(1)
    expect(writes[0].indexes).toEqual(['free_started'])
    expect(writes[0].blobs?.[0]).toBe('free_started')
    expect(writes[0].blobs?.[1]).toBe('country-pinning')
  })

  it('rejects unknown event names with 400', async () => {
    const { env, writes } = makeEnv()
    const res = await worker.fetch(
      post({ name: 'not_a_real_event', props: {} }),
      env,
      {} as ExecutionContext,
    )
    expect(res.status).toBe(400)
    expect(writes).toHaveLength(0)
  })

  it('rejects non-POST requests with 405', async () => {
    const { env } = makeEnv()
    const req = new Request('https://funworldmap.com/api/event', { method: 'GET' })
    const res = await worker.fetch(req, env, {} as ExecutionContext)
    expect(res.status).toBe(405)
  })

  it('rejects malformed JSON with 400', async () => {
    const { env } = makeEnv()
    const req = new Request('https://funworldmap.com/api/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    })
    const res = await worker.fetch(req, env, {} as ExecutionContext)
    expect(res.status).toBe(400)
  })

  it('responds to OPTIONS preflight with permissive CORS', async () => {
    const { env } = makeEnv()
    const req = new Request('https://funworldmap.com/api/event', {
      method: 'OPTIONS',
      headers: { origin: 'https://funworldmap.com' },
    })
    const res = await worker.fetch(req, env, {} as ExecutionContext)
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://funworldmap.com')
  })

  it('pins blob/double column positions per analytics.md', async () => {
    const { env, writes } = makeEnv()
    await worker.fetch(
      post({
        name: 'launcher_dismissed',
        props: {
          path: 'card',
        },
      }),
      env,
      {} as ExecutionContext,
    )
    const w = writes[0]
    expect(w.blobs?.[0]).toBe('launcher_dismissed')
    expect(w.blobs?.[2]).toBe('card') // path
  })
})
