export type ProbeResult = 'ok' | 'fail'

/**
 * Probe a basemap style URL before map init so we can degrade gracefully
 * when the provider is unreachable. Uses GET (not HEAD) because many tile
 * providers don't implement HEAD on style endpoints.
 */
export async function probeBasemap(url: string, timeoutMs: number): Promise<ProbeResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  // Append a query param so the probe is routable separately from any
  // parallel fetch of the same URL (e.g. MapLibre's style loader). Tile
  // servers typically ignore unknown query params on static style endpoints.
  const probeUrl = url + (url.includes('?') ? '&' : '?') + 'probe=1'
  try {
    const res = await fetch(probeUrl, { signal: controller.signal, cache: 'no-store' })
    return res.ok ? 'ok' : 'fail'
  } catch {
    return 'fail'
  } finally {
    clearTimeout(timer)
  }
}
