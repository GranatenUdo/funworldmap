/**
 * Hover-sweep measurement for docs/superpowers/plans/2026-10-12-hover-performance.md.
 *
 * A Playwright MCP `browser_run_code_unsafe` function (takes `page`), not a module.
 * Run against `npm run build:e2e && npm run preview -- --port 4173 --strictPort`
 * (the e2e build sets VITE_TEST_HOOKS, which exposes window.__funworldmap_map).
 * The MCP only reads files under the project root or `.playwright-mcp/`, so copy
 * this there (gitignored) first. Set MODE below to 'satellite' (the default view)
 * or 'vector'.
 *
 * Pointer moves are paced one per two rAFs along a fixed zig-zag across Europe and
 * Africa. Instrumentation is by wrapping (the e2e bundle is minified, so profiler
 * names are unreadable): queryRenderedFeatures / setFilter / setFeatureState on the
 * map, WebGL readPixels on the prototype, `sourcedata` events for the `countries`
 * source, and CDP Performance.getMetrics TaskDuration for main-thread busy time.
 * It throws if a sweep produces no queryRenderedFeatures calls (an overlay such as
 * the first-visit launcher is swallowing the pointer).
 */
async (page) => {
  const MODE = 'satellite' // 'satellite' | 'vector'
  const SWEEPS = 5
  const MOVES = 60
  const URL = 'http://localhost:4173/'
  const ctx = page.context()
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.addInitScript(() => {
    if (window.__s0Installed) return
    window.__s0Installed = true
    const s = { first: null, firstRender: null, count: 0, armed: false }
    const t = {
      qrf: { n: 0, ms: 0 },
      setFilter: { n: 0, ms: 0 },
      setFeatureState: { n: 0, ms: 0 },
      updateData: { n: 0, ms: 0 },
      readPixels: { n: 0, ms: 0 },
    }
    window.__s0 = s
    window.__t = t
    const wrapProto = (proto) => {
      if (!proto || !proto.readPixels || proto.__wrapped) return
      const orig = proto.readPixels
      proto.readPixels = function (...a) {
        const t0 = performance.now()
        try {
          return orig.apply(this, a)
        } finally {
          t.readPixels.n++
          t.readPixels.ms += performance.now() - t0
        }
      }
      proto.__wrapped = true
    }
    wrapProto(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype)
    wrapProto(window.WebGLRenderingContext && WebGLRenderingContext.prototype)
    const timed = (obj, name, key) => {
      const orig = obj[name]
      obj[name] = function (...a) {
        const t0 = performance.now()
        try {
          return orig.apply(this, a)
        } finally {
          t[key].n++
          t[key].ms += performance.now() - t0
        }
      }
    }
    let m
    Object.defineProperty(window, '__funworldmap_map', {
      configurable: true,
      get() {
        return m
      },
      set(v) {
        m = v
        if (!v || !v.on) return
        timed(v, 'queryRenderedFeatures', 'qrf')
        timed(v, 'setFilter', 'setFilter')
        timed(v, 'setFeatureState', 'setFeatureState')
        v.on('sourcedata', (e) => {
          if (e.sourceId === 'countries' && e.tile) {
            if (s.armed) s.count++
            if (s.first === null) {
              s.first = performance.now()
              v.once('render', () => {
                s.firstRender = performance.now()
              })
            }
          }
        })
      },
    })
  })

  await page.goto(URL)
  await page.waitForSelector('[data-map-loaded="true"]', { timeout: 60000 })
  await page.waitForFunction(() => window.__s0 && window.__s0.firstRender !== null, null, { timeout: 60000 })
  const firstTiles = await page.evaluate(() => ({ first: window.__s0.first, firstRender: window.__s0.firstRender }))

  // First visit opens the launcher over the map; it swallows every pointer move.
  // Mirror e2e/helpers.ts ensureLauncherDismissed: close, wait for detach, wait for header.
  const launcher = page.getByTestId('launcher')
  if (await launcher.isVisible()) {
    await page.getByTestId('launcher-close').click()
    await launcher.waitFor({ state: 'detached', timeout: 10000 })
    await page.locator('#search-input').waitFor({ state: 'attached', timeout: 10000 })
  }

  if (MODE === 'vector') {
    await page.getByTestId('satellite-toggle').click()
    await page.waitForFunction(() => !window.__funworldmap_map.getTerrain(), null, { timeout: 15000 })
  } else {
    await page.waitForFunction(() => !!window.__funworldmap_map.getTerrain(), null, { timeout: 15000 })
  }

  const settle = async () => {
    await page.waitForFunction(
      () => {
        const m = window.__funworldmap_map
        return m.loaded() && m.areTilesLoaded()
      },
      null,
      { timeout: 60000 },
    )
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  }

  await page.evaluate(
    () =>
      new Promise((res) => {
        const map = window.__funworldmap_map
        map.jumpTo({ center: [12, 35], zoom: 3.2, pitch: 20, bearing: 0 })
        map.once('idle', () => res())
      }),
  )
  await settle()

  const info = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl')
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info')
    const map = window.__funworldmap_map
    const c = map.getCanvas().getBoundingClientRect()
    return {
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a',
      terrain: !!map.getTerrain(),
      rect: { left: c.left, top: c.top, width: c.width, height: c.height },
      dpr: window.devicePixelRatio,
    }
  })

  // Zig-zag path across Europe/Africa, in viewport coords.
  const r = info.rect
  const pts = []
  for (let i = 0; i < MOVES; i++) {
    const tt = i / (MOVES - 1)
    pts.push({
      x: Math.round(r.left + r.width * (0.25 + 0.5 * tt)),
      y: Math.round(r.top + r.height * (0.5 + 0.18 * Math.sin(tt * 6 * Math.PI))),
    })
  }
  const crossings = await page.evaluate((pts) => {
    const map = window.__funworldmap_map
    const rc = map.getCanvas().getBoundingClientRect()
    let prev
    let n = 0
    const ids = []
    for (const p of pts) {
      const f = map.queryRenderedFeatures([p.x - rc.left, p.y - rc.top], { layers: ['country-fill'] })
      const id = f.length ? String(f[0].id) : null
      ids.push(id)
      if (id !== prev) n++
      prev = id
    }
    return { transitions: n, distinct: new Set(ids.filter(Boolean)).size, ocean: ids.filter((x) => x === null).length }
  }, pts)

  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Performance.enable')
  const taskMs = async () => {
    const { metrics } = await cdp.send('Performance.getMetrics')
    const get = (n) => (metrics.find((x) => x.name === n) || { value: 0 }).value * 1000
    return { task: get('TaskDuration'), script: get('ScriptDuration') }
  }

  const pct = (arr, p) => {
    const a = [...arr].sort((x, y) => x - y)
    return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0
  }
  const results = []
  for (let s = -1; s < SWEEPS; s++) {
    // s = -1 is the warm-up sweep (discarded)
    await page.evaluate(() => {
      const t = window.__t
      for (const k in t) {
        t[k].n = 0
        t[k].ms = 0
      }
      const m = { frames: [], long: [], last: performance.now(), run: true }
      window.__m = m
      const tick = (ts) => {
        if (!m.run) return
        m.frames.push(ts - m.last)
        m.last = ts
        requestAnimationFrame(tick)
      }
      m.po = new PerformanceObserver((l) => {
        for (const e of l.getEntries()) m.long.push(e.duration)
      })
      m.po.observe({ type: 'longtask' })
      window.__s0.count = 0
      window.__s0.armed = true
      requestAnimationFrame((ts) => {
        m.last = ts
        requestAnimationFrame(tick)
      })
    })
    const b0 = await taskMs()
    const w0 = Date.now()
    for (const p of pts) {
      await page.mouse.move(p.x, p.y)
      await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))))
    }
    const wall = Date.now() - w0
    await page.mouse.move(r.left + 5, r.top + 5) // leave to a corner
    await settle()
    const b1 = await taskMs()
    const out = await page.evaluate(() => {
      const m = window.__m
      m.run = false
      m.po.disconnect()
      window.__s0.armed = false
      return { frames: m.frames, long: m.long, t: JSON.parse(JSON.stringify(window.__t)), reloads: window.__s0.count }
    })
    if (out.t.qrf.n === 0) {
      throw new Error('Sweep ' + s + ': 60 mouse moves produced 0 queryRenderedFeatures calls - pointer is not reaching the map (overlay?)')
    }
    if (s >= 0) {
      results.push({
        reloads: out.reloads,
        longTasks: out.long.length,
        longTaskMs: Math.round(out.long.reduce((a, b) => a + b, 0)),
        frameP50: +pct(out.frames, 0.5).toFixed(1),
        frameP95: +pct(out.frames, 0.95).toFixed(1),
        frameMax: +Math.max(0, ...out.frames).toFixed(1),
        frames: out.frames.length,
        busyMs: Math.round(b1.task - b0.task),
        scriptMs: Math.round(b1.script - b0.script),
        qrf: { n: out.t.qrf.n, ms: +out.t.qrf.ms.toFixed(1) },
        readPixels: { n: out.t.readPixels.n, ms: +out.t.readPixels.ms.toFixed(1) },
        setFilter: { n: out.t.setFilter.n, ms: +out.t.setFilter.ms.toFixed(1) },
        setFeatureState: { n: out.t.setFeatureState.n, ms: +out.t.setFeatureState.ms.toFixed(1) },
        wallMs: wall,
      })
    }
  }
  const med = (k, sub) => {
    const a = results.map((x) => (sub ? x[k][sub] : x[k])).sort((p, q) => p - q)
    return a[Math.floor(a.length / 2)]
  }
  return {
    mode: MODE,
    info: { renderer: info.renderer, terrain: info.terrain, dpr: info.dpr },
    firstTilesMs: Math.round(firstTiles.firstRender),
    path: { moves: MOVES, ...crossings },
    median: {
      reloads: med('reloads'),
      longTasks: med('longTasks'),
      longTaskMs: med('longTaskMs'),
      frameP50: med('frameP50'),
      frameP95: med('frameP95'),
      frameMax: med('frameMax'),
      busyMs: med('busyMs'),
      scriptMs: med('scriptMs'),
      qrfN: med('qrf', 'n'),
      qrfMs: med('qrf', 'ms'),
      readPixelsN: med('readPixels', 'n'),
      readPixelsMs: med('readPixels', 'ms'),
      setFilterN: med('setFilter', 'n'),
      setFilterMs: med('setFilter', 'ms'),
      setFeatureStateN: med('setFeatureState', 'n'),
      setFeatureStateMs: med('setFeatureState', 'ms'),
    },
    sweeps: results,
  }
}
