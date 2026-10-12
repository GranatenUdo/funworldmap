/**
 * First-tiles measurement for docs/superpowers/plans/2026-10-12-hover-performance.md:
 * time from the `countries` source starting to load to the first render after its
 * first tile, over repeated reloads (excludes the network-dependent basemap style
 * load that gates map `load`). Playwright MCP `browser_run_code_unsafe` function;
 * same setup as hover-sweep.js (e2e build, preview on :4173, copy under
 * `.playwright-mcp/`).
 */
async (page) => {
  const URL = 'http://localhost:4173/'
  const LOADS = 7
  await page.setViewportSize({ width: 1440, height: 900 })

  // Own globals (__l0) + own accessor: this init script is registered after the
  // sweep scripts' one, so its __funworldmap_map accessor replaces theirs.
  await page.addInitScript(() => {
    const s = { srcStart: null, first: null, firstRender: null }
    window.__l0 = s
    let m
    Object.defineProperty(window, '__funworldmap_map', {
      configurable: true,
      get() {
        return m
      },
      set(v) {
        m = v
        if (!v || !v.on) return
        v.on('dataloading', (e) => {
          if (e.sourceId === 'countries' && s.srcStart === null) s.srcStart = performance.now()
        })
        v.on('sourcedata', (e) => {
          if (e.sourceId === 'countries' && e.tile && s.first === null) {
            s.first = performance.now()
            v.once('render', () => {
              s.firstRender = performance.now()
            })
          }
        })
      },
    })
  })

  const rows = []
  for (let i = -1; i < LOADS; i++) {
    await page.goto(URL)
    await page.waitForFunction(() => window.__l0 && window.__l0.firstRender !== null, null, { timeout: 60000 })
    const v = await page.evaluate(() => ({ ...window.__l0 }))
    if (i >= 0) {
      rows.push({
        srcToFirstTileMs: Math.round(v.first - v.srcStart),
        srcToFirstRenderMs: Math.round(v.firstRender - v.srcStart),
        navToFirstRenderMs: Math.round(v.firstRender),
      })
    }
  }
  const med = (k) => {
    const a = rows.map((x) => x[k]).sort((p, q) => p - q)
    return a[Math.floor(a.length / 2)]
  }
  return {
    median: {
      srcToFirstTileMs: med('srcToFirstTileMs'),
      srcToFirstRenderMs: med('srcToFirstRenderMs'),
      navToFirstRenderMs: med('navToFirstRenderMs'),
    },
    rows,
  }
}
