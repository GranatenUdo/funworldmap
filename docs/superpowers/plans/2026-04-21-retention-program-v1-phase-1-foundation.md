# Retention Program v1 — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the analytics + daily-content + hash-routing foundations that Phases 2–5 depend on. Ship **zero user-visible changes** while preparing pipelines, events, and URL shapes.

**Architecture:** Two-layer analytics (CF Web Analytics for page views; CF Worker + Analytics Engine for custom events via a client beacon wrapper). GitHub Actions cron emits a rolling `public/daily/index.json` from curated pools. `hashState.ts` gains a `daily` variant whose handler currently redirects to `/` while firing a `deep_link_opened` event.

**Tech Stack:** TypeScript, React 19, Vite, Vitest, Playwright, Cloudflare Workers (via `wrangler`), Cloudflare Analytics Engine, GitHub Actions, `tsx` for Node scripts.

---

## Scope

This plan implements **Phase 1** of [`2026-04-21-retention-program-v1-design.md`](../specs/2026-04-21-retention-program-v1-design.md). **Phases 2–5 get their own plan files**, authored just-in-time after each preceding phase merges, so later plans can absorb learnings from earlier work.

### Out of this plan (Phase 2+)
- Daily session variant in the game framework (3 attempts, between-attempt feedback).
- Launcher mode-card rewrites, streak pill, calendar panel.
- Share text, share overlay, `navigator.share`.
- Streak milestone celebrations.
- Reveal-only routes (`#daily/<date>/reveal`).

### In scope here
- Cloudflare Worker + `wrangler.toml` + tests.
- Client analytics wrapper (`src/lib/analytics.ts`) with DNT + test-mode no-ops.
- CF Web Analytics page-view script tag in `index.html`.
- Locale-independent local-date helper (`src/game/daily/dates.ts`).
- Curated country + city pool stub files (user completes curation manually).
- Deterministic picker + pool validator + index generator (all TS scripts under `scripts/daily-content/`).
- First-run `public/daily/index.json` committed to repo.
- GitHub Actions workflow for the 4×/day cron.
- CI job that runs `validate-pools.ts` on PRs touching pools or data.
- `hashState.ts` extended with `daily` variant.
- `App.tsx` handles `daily` hash: redirects to `/` + fires `deep_link_opened`.
- Baseline instrumentation of `launcher_dismissed`, `free_started`, `deep_link_opened` on current surfaces.

### Explicitly NOT in scope
- Removing any existing code beyond one-line instrumentation additions — Phase 1 is purely additive.
- Any UI change visible to end users.
- Mode card redesign (Phase 2).
- Streak, calendar, share (Phases 3–5).
- CI deployment of the Worker — manual `wrangler deploy` only in Phase 1.

---

## Prerequisites (manual, one-time, done by repo owner)

These steps are **not automatable** and block Phase 1 completion. Do them in order.

1. **Cloudflare account.** Sign up at dash.cloudflare.com (free tier).
2. **Add `funworldmap.com` as a site.** CF provides two nameservers.
3. **Switch nameservers** at your domain registrar to the two CF nameservers. Propagation: minutes to 48 h.
4. **Proxy DNS record:** In CF, create a CNAME `funworldmap.com → funworldmap.github.io`, Proxied (orange cloud on).
5. **Enable Web Analytics** on the CF dashboard, paired to `funworldmap.com`. Copy the site token (used in Task 5).
6. **Install Wrangler** locally: `npm install -g wrangler`. Authenticate: `wrangler login`.
7. **Create Analytics Engine dataset** named `funworldmap_events` via `wrangler` (Task 3 spec covers the exact command).
8. **Deploy the Worker** once after Task 3 is committed: `cd cloudflare-worker && wrangler deploy`.
9. **Create Worker route** in CF dashboard: `funworldmap.com/api/event*` → Worker service `funworldmap-analytics`.
10. **Record the production endpoint URL** in `.env.production` (Task 4 covers the build-time wiring).

Track progress of these prerequisites in a GitHub issue or a checklist in the PR description. None of them require code changes beyond what this plan specifies.

---

## File structure

### Created
- `cloudflare-worker/index.ts` — Worker entry point; validates incoming events and writes to Analytics Engine.
- `cloudflare-worker/wrangler.toml` — CF service config with Analytics Engine binding.
- `cloudflare-worker/package.json` — Worker-only dev dependencies (`miniflare`, `vitest`).
- `cloudflare-worker/__tests__/index.test.ts` — unit tests against the Worker via Miniflare.
- `src/lib/analytics.ts` — client `track()` wrapper + event-name type union.
- `src/lib/__tests__/analytics.test.ts` — wrapper tests.
- `src/game/daily/dates.ts` — `toLocalDateString(Date): string` pure helper.
- `src/game/daily/__tests__/dates.test.ts` — date helper tests.
- `scripts/daily-content/country-pool.json` — curated CCA3 list. Ships as a stub; repo owner completes curation per the §Daily content pipeline criteria in the spec.
- `scripts/daily-content/city-pool.json` — curated city-id list. Ships as a stub; repo owner completes curation.
- `scripts/daily-content/picker.ts` — `pickDaily(date, pool, history): string` pure function.
- `scripts/daily-content/__tests__/picker.test.ts` — picker tests.
- `scripts/daily-content/validate-pools.ts` — CI validator; fails if pool references don't resolve in data files.
- `scripts/daily-content/__tests__/validate-pools.test.ts` — validator tests.
- `scripts/daily-content/generate-index.ts` — CLI that writes/updates `public/daily/index.json`.
- `scripts/daily-content/__tests__/generate-index.test.ts` — generator tests.
- `public/daily/index.json` — generated by Task 12; thereafter updated by GHA.
- `.github/workflows/daily-puzzle.yml` — 4×/day cron.
- `docs/systems/analytics.md` — analytics architecture + DNS + Worker setup.

### Modified
- `index.html` — CF Web Analytics beacon script tag.
- `.github/workflows/ci.yml` — add pool-validator step before unit tests.
- `package.json` — new `scripts.daily:generate` and `scripts.daily:validate`; new devDep `wrangler` (for local and CI use).
- `src/lib/hashState.ts` — add `daily` variant to the `HashState` union.
- `src/lib/__tests__/hashState.test.ts` — tests for the new variant.
- `src/App.tsx` — handle `daily` hash: redirect to `/`, fire `deep_link_opened`.
- `src/components/Launcher.tsx` — fire `launcher_dismissed` + `free_started` events.
- `src/hooks/useSelectedCountry.ts` — fire `deep_link_opened` for country deep-links.

### Removed
Nothing. Phase 1 is additive.

---

## Task 1: Document the analytics architecture and manual setup

**Files:**
- Create: `docs/systems/analytics.md`

- [ ] **Step 1: Write the doc**

Create `docs/systems/analytics.md` with the following content verbatim:

```markdown
# Analytics

funworldmap uses two complementary layers of analytics. Both run on Cloudflare's free tiers at $0/month for realistic v1 traffic.

## Layer 1 — Cloudflare Web Analytics (passive)

Captures page views, unique visitors (IP-hashed, 24-h TTL), referrers, country stats, and Core Web Vitals. No cookies. No PII. Requires Cloudflare to be fronting the origin.

**Setup:**
1. Point the `funworldmap.com` domain at Cloudflare nameservers at the registrar.
2. Add a proxied CNAME in CF: `funworldmap.com → funworldmap.github.io`.
3. Enable Web Analytics on the CF dashboard, paired to `funworldmap.com`.
4. Copy the site token and paste it into `VITE_CF_WA_TOKEN` in the CI build env.

No custom events — CF WA free tier does not support them.

## Layer 2 — Cloudflare Worker + Analytics Engine (custom events)

The client POSTs event payloads to the Worker. The Worker validates and writes to Analytics Engine. Queries run via CF's GraphQL API or the Workers dashboard.

**Free-tier ceilings:** Workers 100,000 req/day; Analytics Engine 10,000,000 writes/month.

**Worker source:** `cloudflare-worker/index.ts`.
**Config:** `cloudflare-worker/wrangler.toml`.
**Endpoint:** `https://funworldmap.com/api/event` (proxied through CF Worker Routes).

**Deploy:**
```
cd cloudflare-worker
wrangler login        # one-time
wrangler deploy
```

**Query:** CF dashboard → Workers & Pages → funworldmap-analytics → Analytics Engine tab. Or via GraphQL at `https://api.cloudflare.com/client/v4/graphql`.

## Event schema

See the §Analytics section of `docs/superpowers/specs/2026-04-21-retention-program-v1-design.md` for the canonical event list, props, and emission points.

## Client wrapper

`src/lib/analytics.ts` exports `track(name, props)`. Honors `navigator.doNotTrack`. No-ops when `window.__PLAYWRIGHT__` is set (e2e). Captures to `window.__testAnalytics` array under test for assertion.
```

- [ ] **Step 2: Commit**

```
git add docs/systems/analytics.md
git commit -m "docs(systems): add analytics architecture + CF setup notes"
```

---

## Task 2: Scaffold the Cloudflare Worker directory

**Files:**
- Create: `cloudflare-worker/package.json`
- Create: `cloudflare-worker/wrangler.toml`
- Create: `cloudflare-worker/tsconfig.json`
- Create: `cloudflare-worker/.gitignore`

- [ ] **Step 1: Create `cloudflare-worker/package.json`**

```json
{
  "name": "funworldmap-analytics-worker",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250401.0",
    "miniflare": "^4.0.0",
    "typescript": "~5.7.0",
    "vitest": "^4.1.4",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create `cloudflare-worker/wrangler.toml`**

```toml
name = "funworldmap-analytics"
main = "index.ts"
compatibility_date = "2026-04-21"
workers_dev = false

[[analytics_engine_datasets]]
binding = "EVENTS"
dataset = "funworldmap_events"

[env.production]
routes = [
  { pattern = "funworldmap.com/api/event", zone_name = "funworldmap.com" }
]
```

- [ ] **Step 3: Create `cloudflare-worker/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["**/*.ts"]
}
```

- [ ] **Step 4: Create `cloudflare-worker/.gitignore`**

```
node_modules
.wrangler
dist
```

- [ ] **Step 5: Install Worker deps**

Run:
```
cd cloudflare-worker && npm install
```
Expected: `node_modules/` populated, no errors.

- [ ] **Step 6: Commit**

```
git add cloudflare-worker/package.json cloudflare-worker/wrangler.toml cloudflare-worker/tsconfig.json cloudflare-worker/.gitignore cloudflare-worker/package-lock.json
git commit -m "feat(analytics): scaffold cloudflare-worker directory"
```

---

## Task 3: Implement the Worker with validation (TDD)

**Files:**
- Create: `cloudflare-worker/__tests__/index.test.ts`
- Create: `cloudflare-worker/index.ts`

- [ ] **Step 1: Write the failing test**

Create `cloudflare-worker/__tests__/index.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import worker from '../index'

type Env = {
  EVENTS: {
    writeDataPoint: (data: {
      blobs?: string[]
      doubles?: number[]
      indexes?: string[]
    }) => void
  }
}

function makeEnv() {
  const writes: unknown[] = []
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
      post({ name: 'daily_opened', props: { mode: 'country-pinning', dateAge: 0 } }),
      env,
      {} as ExecutionContext,
    )
    expect(res.status).toBe(204)
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({
      indexes: ['daily_opened'],
      blobs: expect.arrayContaining(['daily_opened']),
    })
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
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
cd cloudflare-worker && npm run test
```
Expected: FAIL — `worker` is undefined because `index.ts` doesn't exist.

- [ ] **Step 3: Implement the Worker**

Create `cloudflare-worker/index.ts`:

```ts
type EventName =
  | 'daily_opened'
  | 'daily_started'
  | 'daily_attempted'
  | 'daily_completed'
  | 'daily_shared'
  | 'free_started'
  | 'history_opened'
  | 'history_cell_clicked'
  | 'streak_reached_milestone'
  | 'launcher_dismissed'
  | 'deep_link_opened'

const KNOWN_EVENTS = new Set<EventName>([
  'daily_opened',
  'daily_started',
  'daily_attempted',
  'daily_completed',
  'daily_shared',
  'free_started',
  'history_opened',
  'history_cell_clicked',
  'streak_reached_milestone',
  'launcher_dismissed',
  'deep_link_opened',
])

const ALLOWED_ORIGINS = new Set([
  'https://funworldmap.com',
  'https://www.funworldmap.com',
])

interface Env {
  EVENTS: {
    writeDataPoint(data: {
      blobs?: string[]
      doubles?: number[]
      indexes?: string[]
    }): void
  }
}

interface EventPayload {
  name: EventName
  props?: Record<string, string | number>
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://funworldmap.com'
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin')

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    if (request.method !== 'POST') {
      return new Response('method not allowed', {
        status: 405,
        headers: corsHeaders(origin),
      })
    }

    let body: EventPayload
    try {
      body = (await request.json()) as EventPayload
    } catch {
      return new Response('invalid json', { status: 400, headers: corsHeaders(origin) })
    }

    if (!body || typeof body.name !== 'string' || !KNOWN_EVENTS.has(body.name)) {
      return new Response('unknown event', { status: 400, headers: corsHeaders(origin) })
    }

    const props = body.props ?? {}
    const str = (k: string) => (typeof props[k] === 'string' ? (props[k] as string) : '')
    const num = (k: string) => (typeof props[k] === 'number' ? (props[k] as number) : 0)

    env.EVENTS.writeDataPoint({
      indexes: [body.name],
      blobs: [
        body.name,
        str('mode'),
        str('path'),
        str('method'),
        str('dateKind'),
        str('outcome'),
        str('cellKind'),
      ],
      doubles: [
        num('dateAge'),
        num('scoreBucket'),
        num('bestScoreBucket'),
        num('attemptIndex'),
        num('attemptsUsed'),
        num('days'),
      ],
    })

    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  },
} satisfies ExportedHandler<Env>
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```
cd cloudflare-worker && npm run test
```
Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```
git add cloudflare-worker/index.ts cloudflare-worker/__tests__/index.test.ts
git commit -m "feat(analytics): worker validates and writes events to Analytics Engine"
```

- [ ] **Step 6: Manual deployment (prerequisite step 8 in §Prerequisites)**

Run (repo owner only; not CI):
```
cd cloudflare-worker && wrangler deploy
```
Expected: `Uploaded funworldmap-analytics ... Published ... https://funworldmap-analytics.<account>.workers.dev`. In CF dashboard, verify Route `funworldmap.com/api/event` exists under Worker Routes.

- [ ] **Step 7: Smoke-test the deployed Worker**

Run:
```
curl -X POST https://funworldmap.com/api/event \
  -H 'content-type: application/json' \
  -H 'origin: https://funworldmap.com' \
  -d '{"name":"daily_opened","props":{"mode":"country-pinning","dateAge":0}}' \
  -w '\nHTTP %{http_code}\n'
```
Expected: `HTTP 204`. In CF dashboard → Analytics Engine, verify the `funworldmap_events` dataset received one data point.

---

## Task 4: Client analytics wrapper (TDD)

**Files:**
- Create: `src/lib/__tests__/analytics.test.ts`
- Create: `src/lib/analytics.ts`
- Modify: `.env.example` (add `VITE_ANALYTICS_ENDPOINT` placeholder)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/analytics.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { track } from '../analytics'

declare global {
  interface Window {
    __PLAYWRIGHT__?: boolean
    __testAnalytics?: Array<{ name: string; props?: Record<string, string | number> }>
  }
}

describe('track', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
  const sendBeaconSpy = vi.fn<(url: string, data?: BodyInit) => boolean>(() => true)
  const originalNavigator = globalThis.navigator
  const originalEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT

  beforeEach(() => {
    fetchSpy.mockReset()
    fetchSpy.mockResolvedValue(new Response(null, { status: 204 }))
    sendBeaconSpy.mockClear()
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        ...originalNavigator,
        doNotTrack: '0',
        sendBeacon: sendBeaconSpy,
      },
    })
    ;(import.meta.env as { VITE_ANALYTICS_ENDPOINT?: string }).VITE_ANALYTICS_ENDPOINT =
      'https://funworldmap.com/api/event'
    delete (window as Window).__PLAYWRIGHT__
    delete (window as Window).__testAnalytics
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    })
    ;(import.meta.env as { VITE_ANALYTICS_ENDPOINT?: string }).VITE_ANALYTICS_ENDPOINT =
      originalEndpoint
  })

  it('dispatches via sendBeacon when available', () => {
    track('daily_opened', { mode: 'country-pinning', dateAge: 0 })
    expect(sendBeaconSpy).toHaveBeenCalledTimes(1)
    const [url, body] = sendBeaconSpy.mock.calls[0]
    expect(url).toBe('https://funworldmap.com/api/event')
    expect(typeof body).toBe('string')
    expect(JSON.parse(body as string)).toEqual({
      name: 'daily_opened',
      props: { mode: 'country-pinning', dateAge: 0 },
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('falls back to fetch with keepalive when sendBeacon is absent', () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { ...originalNavigator, doNotTrack: '0' },
    })
    track('free_started', { mode: 'city-guessing' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://funworldmap.com/api/event')
    expect(init).toMatchObject({ method: 'POST', keepalive: true })
  })

  it('is a no-op when navigator.doNotTrack is "1"', () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { ...originalNavigator, doNotTrack: '1', sendBeacon: sendBeaconSpy },
    })
    track('daily_opened', { mode: 'country-pinning', dateAge: 0 })
    expect(sendBeaconSpy).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('captures to window.__testAnalytics when window.__PLAYWRIGHT__ is set', () => {
    ;(window as Window).__PLAYWRIGHT__ = true
    track('launcher_dismissed', { path: 'link' })
    expect(sendBeaconSpy).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect((window as Window).__testAnalytics).toEqual([
      { name: 'launcher_dismissed', props: { path: 'link' } },
    ])
  })

  it('is a no-op when VITE_ANALYTICS_ENDPOINT is not set', () => {
    ;(import.meta.env as { VITE_ANALYTICS_ENDPOINT?: string }).VITE_ANALYTICS_ENDPOINT = ''
    track('daily_opened', { mode: 'country-pinning', dateAge: 0 })
    expect(sendBeaconSpy).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
npm run test:unit -- src/lib/__tests__/analytics.test.ts
```
Expected: FAIL — `track` is undefined because `src/lib/analytics.ts` does not exist.

- [ ] **Step 3: Implement the wrapper**

Create `src/lib/analytics.ts`:

```ts
export type EventName =
  | 'daily_opened'
  | 'daily_started'
  | 'daily_attempted'
  | 'daily_completed'
  | 'daily_shared'
  | 'free_started'
  | 'history_opened'
  | 'history_cell_clicked'
  | 'streak_reached_milestone'
  | 'launcher_dismissed'
  | 'deep_link_opened'

export type EventProps = Record<string, string | number>

interface TestAnalyticsWindow extends Window {
  __PLAYWRIGHT__?: boolean
  __testAnalytics?: Array<{ name: EventName; props?: EventProps }>
}

export function track(name: EventName, props?: EventProps): void {
  if (typeof window === 'undefined') return

  const w = window as TestAnalyticsWindow
  if (w.__PLAYWRIGHT__) {
    if (!w.__testAnalytics) w.__testAnalytics = []
    w.__testAnalytics.push({ name, props })
    return
  }

  if (navigator.doNotTrack === '1') return

  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT
  if (!endpoint) return

  const body = JSON.stringify({ name, props })

  if (typeof navigator.sendBeacon === 'function') {
    try {
      navigator.sendBeacon(endpoint, body)
      return
    } catch {
      /* fall through to fetch */
    }
  }

  void fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    /* swallow — analytics is best-effort */
  })
}
```

- [ ] **Step 4: Add env var placeholder**

Check if `.env.example` exists:
```
ls -la E:/polworldmap/.env.example 2>/dev/null || echo "missing"
```

If missing, create `.env.example`:
```
# Cloudflare Web Analytics site token — see docs/systems/analytics.md
VITE_CF_WA_TOKEN=

# Cloudflare Worker analytics endpoint — see docs/systems/analytics.md
VITE_ANALYTICS_ENDPOINT=https://funworldmap.com/api/event
```

If it exists, append these two variables.

- [ ] **Step 5: Run the test to verify it passes**

Run:
```
npm run test:unit -- src/lib/__tests__/analytics.test.ts
```
Expected: All 5 tests pass.

- [ ] **Step 6: Commit**

```
git add src/lib/analytics.ts src/lib/__tests__/analytics.test.ts .env.example
git commit -m "feat(analytics): client track() wrapper with DNT + e2e shim"
```

---

## Task 5: Add CF Web Analytics beacon to index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the beacon script tag**

Edit `index.html`. Find the line immediately before `<link rel="preload" as="font"`. Insert before it:

```html
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon='{"token":"%VITE_CF_WA_TOKEN%"}'
    ></script>
```

Vite replaces `%VITE_CF_WA_TOKEN%` at build time. When the var is empty (local dev without a token), CF's beacon silently no-ops — verified behavior, no console errors.

- [ ] **Step 2: Verify the build still succeeds with an empty token**

Run:
```
VITE_CF_WA_TOKEN="" npm run build
```
Expected: build succeeds; `dist/index.html` contains `data-cf-beacon='{"token":""}'`.

- [ ] **Step 3: Smoke-test locally**

Run:
```
npm run preview
```
Open http://localhost:4173. Expected: no console errors. Network tab shows a request to `beacon.min.js` with no subsequent data transmission (empty token).

- [ ] **Step 4: Commit**

```
git add index.html
git commit -m "feat(analytics): add CF Web Analytics beacon script tag"
```

---

## Task 6: Locale-independent local-date helper (TDD)

**Files:**
- Create: `src/game/daily/__tests__/dates.test.ts`
- Create: `src/game/daily/dates.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/daily/__tests__/dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toLocalDateString } from '../dates'

describe('toLocalDateString', () => {
  it('formats a date as YYYY-MM-DD regardless of browser locale', () => {
    const d = new Date(2026, 3, 21, 12, 0, 0) // April 21 2026 local time
    expect(toLocalDateString(d)).toBe('2026-04-21')
  })

  it('zero-pads single-digit months and days', () => {
    const d = new Date(2026, 0, 5, 12, 0, 0) // January 5 2026
    expect(toLocalDateString(d)).toBe('2026-01-05')
  })

  it('uses local date components, not UTC', () => {
    // Construct a date that straddles midnight UTC depending on tz.
    // Use the local-time constructor: result must reflect local calendar day.
    const d = new Date(2026, 3, 21, 23, 59, 0)
    expect(toLocalDateString(d)).toBe('2026-04-21')
  })

  it('handles year boundaries', () => {
    const d = new Date(2025, 11, 31, 23, 59, 0) // December 31 2025
    expect(toLocalDateString(d)).toBe('2025-12-31')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
npm run test:unit -- src/game/daily/__tests__/dates.test.ts
```
Expected: FAIL — `toLocalDateString` is not exported because `dates.ts` doesn't exist.

- [ ] **Step 3: Implement the helper**

Create `src/game/daily/dates.ts`:

```ts
/**
 * Returns a local-date YYYY-MM-DD string for the given Date.
 * Deliberately avoids toLocaleDateString, which varies by browser locale
 * (Finnish → "21.4.2026", Japanese → "2026/4/21").
 */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```
npm run test:unit -- src/game/daily/__tests__/dates.test.ts
```
Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```
git add src/game/daily/dates.ts src/game/daily/__tests__/dates.test.ts
git commit -m "feat(daily): locale-independent toLocalDateString helper"
```

---

## Task 7: Stub the curated country pool

**Files:**
- Create: `scripts/daily-content/country-pool.json`
- Create: `scripts/daily-content/README.md`

- [ ] **Step 1: Create the pool stub**

Create `scripts/daily-content/country-pool.json`. Ship a minimal-but-representative 20-entry stub covering all continents. The repo owner expands this to ~100 during curation per the spec's political-neutrality and global-balance criteria.

```json
{
  "version": 1,
  "cca3": [
    "ARG",
    "AUS",
    "BRA",
    "CAN",
    "CHE",
    "DEU",
    "EGY",
    "ESP",
    "FRA",
    "GBR",
    "IDN",
    "IND",
    "ITA",
    "JPN",
    "KEN",
    "MEX",
    "NOR",
    "PER",
    "USA",
    "ZAF"
  ]
}
```

- [ ] **Step 2: Create the curation README**

Create `scripts/daily-content/README.md`:

```markdown
# Daily content pools

Curated lists of countries and cities eligible for the daily puzzle.

## Curation criteria (in priority order)

1. **Political neutrality.** Exclude entries where inclusion in the daily would implicitly take a side: Taiwan, Kosovo, Palestine, Western Sahara, Jerusalem, Crimea, Taipei (as capital). Free mode uses the full pool; daily uses only the filtered one.
2. **Unambiguous recognition.** Exclude microstates and non-sovereign territories that typical users cannot place.
3. **Global balance.** Roughly Europe 25 %, Asia 25 %, Africa 20 %, Americas 20 %, Oceania 10 %.
4. **Stable names / IDs.** Exclude entries undergoing recent renaming disputes (e.g., Türkiye vs Turkey) where `countries.json` may churn.

Targets: ~100 countries, ~200 cities.

## Adding an entry

1. Confirm the `cca3` is present in `src/data/countries.json` (for countries) or the `id` is present in `src/data/cities.json` (for cities).
2. Append to the appropriate pool file.
3. Run `npm run daily:validate` to confirm pool integrity.
4. Commit.

## Regenerating the daily index

```
npm run daily:generate
```

Writes `public/daily/index.json` for the past 30 days plus today. Safe to re-run (idempotent).
```

- [ ] **Step 3: Commit**

```
git add scripts/daily-content/country-pool.json scripts/daily-content/README.md
git commit -m "feat(daily): stub country pool + curation README"
```

---

## Task 8: Stub the curated city pool

**Files:**
- Create: `scripts/daily-content/city-pool.json`

- [ ] **Step 1: Read a handful of city ids from `src/data/cities.json`**

Run:
```
node -e "const c=require('./src/data/cities.json'); console.log(JSON.stringify(c.slice(0,20).map(x=>x.id),null,2))"
```
Record the 20 ids printed — they'll seed the stub pool.

- [ ] **Step 2: Create the pool stub**

Create `scripts/daily-content/city-pool.json`. Paste the ids gathered in Step 1 into the `ids` array:

```json
{
  "version": 1,
  "ids": [
    "<paste the 20 ids from Step 1 here, one per line, comma-separated>"
  ]
}
```

The repo owner expands this to ~200 during curation.

- [ ] **Step 3: Commit**

```
git add scripts/daily-content/city-pool.json
git commit -m "feat(daily): stub city pool"
```

---

## Task 9: Deterministic picker (TDD)

**Files:**
- Create: `scripts/daily-content/__tests__/picker.test.ts`
- Create: `scripts/daily-content/picker.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/daily-content/__tests__/picker.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pickDaily } from '../picker'

const pool = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

describe('pickDaily', () => {
  it('is deterministic for the same (date, pool, salt) triple', () => {
    const a = pickDaily('2026-04-21', pool, [])
    const b = pickDaily('2026-04-21', pool, [])
    expect(a).toBe(b)
  })

  it('produces different picks for different dates', () => {
    const picks = new Set<string>()
    for (let d = 1; d <= 10; d++) {
      const date = `2026-04-${String(d).padStart(2, '0')}`
      picks.add(pickDaily(date, pool, []))
    }
    // 10 dates against a 10-item pool — not guaranteed unique but should hit most of the pool
    expect(picks.size).toBeGreaterThanOrEqual(6)
  })

  it('avoids entries listed in the "recent" argument', () => {
    const recent = ['A', 'B', 'C']
    for (let d = 1; d <= 20; d++) {
      const date = `2026-04-${String(d).padStart(2, '0')}`
      const pick = pickDaily(date, pool, recent)
      expect(recent).not.toContain(pick)
    }
  })

  it('falls back to the raw pool when every entry is in recent (defensive)', () => {
    const pick = pickDaily('2026-04-21', pool, pool)
    expect(pool).toContain(pick)
  })

  it('throws on empty pool', () => {
    expect(() => pickDaily('2026-04-21', [], [])).toThrow(/empty pool/i)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
npm run test:unit -- scripts/daily-content/__tests__/picker.test.ts
```
Expected: FAIL — `pickDaily` is undefined.

- [ ] **Step 3: Implement the picker**

Create `scripts/daily-content/picker.ts`:

```ts
import { createHash } from 'node:crypto'

/**
 * Pick one entry from `pool` deterministically based on the date.
 * Rejection-samples past `recent` entries to avoid repeats within
 * the retention window. Falls back to the unfiltered pick if every
 * candidate is in `recent`.
 */
export function pickDaily(date: string, pool: string[], recent: string[]): string {
  if (pool.length === 0) {
    throw new Error('empty pool')
  }
  const recentSet = new Set(recent)
  let salt = 0
  while (salt < 64) {
    const hash = createHash('sha256').update(`${date}:${salt}`).digest()
    const n = hash.readUInt32BE(0)
    const pick = pool[n % pool.length]
    if (!recentSet.has(pick)) return pick
    salt++
  }
  // Defensive fallback: every pool entry was in recent. Pick by raw date hash.
  const h = createHash('sha256').update(date).digest().readUInt32BE(0)
  return pool[h % pool.length]
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```
npm run test:unit -- scripts/daily-content/__tests__/picker.test.ts
```
Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```
git add scripts/daily-content/picker.ts scripts/daily-content/__tests__/picker.test.ts
git commit -m "feat(daily): deterministic date-seeded picker with recency rejection"
```

---

## Task 10: Pool validator (TDD)

**Files:**
- Create: `scripts/daily-content/__tests__/validate-pools.test.ts`
- Create: `scripts/daily-content/validate-pools.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/daily-content/__tests__/validate-pools.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validatePools } from '../validate-pools'

describe('validatePools', () => {
  it('returns ok when every pool entry resolves in data files', () => {
    const result = validatePools({
      countries: [{ cca3: 'FRA' }, { cca3: 'PER' }],
      cities: [{ id: 'per-lima' }, { id: 'fra-paris' }],
      countryPool: { version: 1, cca3: ['FRA', 'PER'] },
      cityPool: { version: 1, ids: ['per-lima'] },
    })
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('reports country-pool entries missing from countries.json', () => {
    const result = validatePools({
      countries: [{ cca3: 'FRA' }],
      cities: [{ id: 'fra-paris' }],
      countryPool: { version: 1, cca3: ['FRA', 'XXX'] },
      cityPool: { version: 1, ids: ['fra-paris'] },
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ kind: 'missing-country', id: 'XXX' }),
    )
  })

  it('reports city-pool entries missing from cities.json', () => {
    const result = validatePools({
      countries: [{ cca3: 'FRA' }],
      cities: [{ id: 'fra-paris' }],
      countryPool: { version: 1, cca3: ['FRA'] },
      cityPool: { version: 1, ids: ['fra-paris', 'nope-nope'] },
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ kind: 'missing-city', id: 'nope-nope' }),
    )
  })

  it('reports duplicate entries in a pool', () => {
    const result = validatePools({
      countries: [{ cca3: 'FRA' }],
      cities: [{ id: 'fra-paris' }],
      countryPool: { version: 1, cca3: ['FRA', 'FRA'] },
      cityPool: { version: 1, ids: ['fra-paris'] },
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ kind: 'duplicate-country', id: 'FRA' }),
    )
  })

  it('reports unknown pool version', () => {
    const result = validatePools({
      countries: [{ cca3: 'FRA' }],
      cities: [{ id: 'fra-paris' }],
      countryPool: { version: 999, cca3: ['FRA'] },
      cityPool: { version: 1, ids: ['fra-paris'] },
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ kind: 'bad-version', file: 'country-pool' }),
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
npm run test:unit -- scripts/daily-content/__tests__/validate-pools.test.ts
```
Expected: FAIL — `validatePools` is undefined.

- [ ] **Step 3: Implement the validator**

Create `scripts/daily-content/validate-pools.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface CountryLike { cca3: string }
export interface CityLike { id: string }
export interface CountryPool { version: number; cca3: string[] }
export interface CityPool { version: number; ids: string[] }

export type ValidationError =
  | { kind: 'missing-country'; id: string }
  | { kind: 'missing-city'; id: string }
  | { kind: 'duplicate-country'; id: string }
  | { kind: 'duplicate-city'; id: string }
  | { kind: 'bad-version'; file: 'country-pool' | 'city-pool' }

export interface ValidationInput {
  countries: CountryLike[]
  cities: CityLike[]
  countryPool: CountryPool
  cityPool: CityPool
}

export interface ValidationResult {
  ok: boolean
  errors: ValidationError[]
}

export function validatePools(input: ValidationInput): ValidationResult {
  const errors: ValidationError[] = []
  const { countries, cities, countryPool, cityPool } = input

  if (countryPool.version !== 1) errors.push({ kind: 'bad-version', file: 'country-pool' })
  if (cityPool.version !== 1) errors.push({ kind: 'bad-version', file: 'city-pool' })

  const knownCca3 = new Set(countries.map((c) => c.cca3))
  const knownCityIds = new Set(cities.map((c) => c.id))

  const cca3Seen = new Set<string>()
  for (const id of countryPool.cca3) {
    if (!knownCca3.has(id)) errors.push({ kind: 'missing-country', id })
    if (cca3Seen.has(id)) errors.push({ kind: 'duplicate-country', id })
    cca3Seen.add(id)
  }

  const cityIdSeen = new Set<string>()
  for (const id of cityPool.ids) {
    if (!knownCityIds.has(id)) errors.push({ kind: 'missing-city', id })
    if (cityIdSeen.has(id)) errors.push({ kind: 'duplicate-city', id })
    cityIdSeen.add(id)
  }

  return { ok: errors.length === 0, errors }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd()
  const countries = JSON.parse(readFileSync(join(root, 'src/data/countries.json'), 'utf-8'))
  const cities = JSON.parse(readFileSync(join(root, 'src/data/cities.json'), 'utf-8'))
  const countryPool = JSON.parse(readFileSync(join(root, 'scripts/daily-content/country-pool.json'), 'utf-8'))
  const cityPool = JSON.parse(readFileSync(join(root, 'scripts/daily-content/city-pool.json'), 'utf-8'))
  const result = validatePools({
    countries: Array.isArray(countries) ? countries : (countries.countries ?? []),
    cities: Array.isArray(cities) ? cities : (cities.cities ?? []),
    countryPool,
    cityPool,
  })
  if (!result.ok) {
    console.error('Pool validation failed:')
    for (const e of result.errors) console.error('  -', e)
    process.exit(1)
  }
  console.log('Pool validation ok.')
}
```

Note: the CLI path's `countries`/`cities` shape handling accommodates both wrapped and unwrapped JSON shapes. Confirm `src/data/countries.json`'s top-level shape before first CLI run — the tests exercise the pure function, not the CLI glue.

- [ ] **Step 4: Run the test to verify it passes**

Run:
```
npm run test:unit -- scripts/daily-content/__tests__/validate-pools.test.ts
```
Expected: All 5 tests pass.

- [ ] **Step 5: Verify CLI entry against real data**

Run:
```
npx tsx scripts/daily-content/validate-pools.ts
```
Expected: `Pool validation ok.`

If it fails with `missing-country` / `missing-city`, the stub pool entries don't all resolve in the data files — pick up the repo owner's curated IDs or adjust the stub.

- [ ] **Step 6: Commit**

```
git add scripts/daily-content/validate-pools.ts scripts/daily-content/__tests__/validate-pools.test.ts
git commit -m "feat(daily): pool validator + CLI with missing/duplicate/version checks"
```

---

## Task 11: Index generator (TDD)

**Files:**
- Create: `scripts/daily-content/__tests__/generate-index.test.ts`
- Create: `scripts/daily-content/generate-index.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/daily-content/__tests__/generate-index.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildIndex } from '../generate-index'

const pool = {
  country: { version: 1, cca3: ['FRA', 'PER', 'DEU', 'JPN', 'ARG'] },
  city: { version: 1, ids: ['fra-paris', 'per-lima', 'deu-berlin', 'jpn-tokyo', 'arg-ba'] },
}

describe('buildIndex', () => {
  it('assembles a past+today window with one entry per date', () => {
    const today = new Date(2026, 3, 21, 12, 0, 0)
    const result = buildIndex({ today, pool, retentionDays: 5, existing: null })
    expect(result.window.start).toBe('2026-04-17')
    expect(result.window.end).toBe('2026-04-21')
    expect(Object.keys(result.days).sort()).toEqual([
      '2026-04-17',
      '2026-04-18',
      '2026-04-19',
      '2026-04-20',
      '2026-04-21',
    ])
    for (const day of Object.values(result.days)) {
      expect(pool.country.cca3).toContain(day.country.cca3)
      expect(pool.city.ids).toContain(day.city.id)
    }
  })

  it('preserves existing past entries verbatim (never rewrites history)', () => {
    const today = new Date(2026, 3, 21, 12, 0, 0)
    const existing = {
      generatedAt: '2026-04-20T00:15:00Z',
      window: { start: '2026-04-17', end: '2026-04-20' },
      days: {
        '2026-04-17': { country: { cca3: 'FRA' }, city: { id: 'fra-paris' } },
        '2026-04-18': { country: { cca3: 'PER' }, city: { id: 'per-lima' } },
        '2026-04-19': { country: { cca3: 'DEU' }, city: { id: 'deu-berlin' } },
        '2026-04-20': { country: { cca3: 'JPN' }, city: { id: 'jpn-tokyo' } },
      },
    }
    const result = buildIndex({ today, pool, retentionDays: 5, existing })
    expect(result.days['2026-04-17']).toEqual({ country: { cca3: 'FRA' }, city: { id: 'fra-paris' } })
    expect(result.days['2026-04-18']).toEqual({ country: { cca3: 'PER' }, city: { id: 'per-lima' } })
    expect(result.days['2026-04-19']).toEqual({ country: { cca3: 'DEU' }, city: { id: 'deu-berlin' } })
    expect(result.days['2026-04-20']).toEqual({ country: { cca3: 'JPN' }, city: { id: 'jpn-tokyo' } })
    expect(result.days['2026-04-21']).toBeDefined()
  })

  it('drops entries older than the retention window', () => {
    const today = new Date(2026, 3, 21, 12, 0, 0)
    const existing = {
      generatedAt: '2026-04-20T00:15:00Z',
      window: { start: '2026-04-01', end: '2026-04-20' },
      days: {
        '2026-04-01': { country: { cca3: 'ARG' }, city: { id: 'arg-ba' } },
        '2026-04-15': { country: { cca3: 'FRA' }, city: { id: 'fra-paris' } },
        '2026-04-20': { country: { cca3: 'JPN' }, city: { id: 'jpn-tokyo' } },
      },
    }
    const result = buildIndex({ today, pool, retentionDays: 5, existing })
    expect(result.days['2026-04-01']).toBeUndefined()
    expect(result.days['2026-04-15']).toBeUndefined()
    expect(result.days['2026-04-20']).toBeDefined()
  })

  it('does NOT emit future entries', () => {
    const today = new Date(2026, 3, 21, 12, 0, 0)
    const result = buildIndex({ today, pool, retentionDays: 5, existing: null })
    const future = Object.keys(result.days).filter((d) => d > '2026-04-21')
    expect(future).toEqual([])
  })

  it('avoids repeating a country within the retention window', () => {
    const today = new Date(2026, 3, 21, 12, 0, 0)
    const result = buildIndex({
      today,
      pool,
      retentionDays: 5,
      existing: null,
    })
    const cca3s = Object.values(result.days).map((d) => d.country.cca3)
    expect(new Set(cca3s).size).toBe(cca3s.length)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
npm run test:unit -- scripts/daily-content/__tests__/generate-index.test.ts
```
Expected: FAIL — `buildIndex` is undefined.

- [ ] **Step 3: Implement the generator**

Create `scripts/daily-content/generate-index.ts`:

```ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { pickDaily } from './picker.js'
import { toLocalDateString } from '../../src/game/daily/dates.js'

interface CountryPool { version: number; cca3: string[] }
interface CityPool { version: number; ids: string[] }
interface Pools { country: CountryPool; city: CityPool }

interface DayEntry {
  country: { cca3: string }
  city: { id: string }
}

export interface DailyIndex {
  generatedAt: string
  window: { start: string; end: string }
  days: Record<string, DayEntry>
}

export interface BuildInput {
  today: Date
  pool: Pools
  retentionDays: number
  existing: DailyIndex | null
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

export function buildIndex(input: BuildInput): DailyIndex {
  const { today, pool, retentionDays, existing } = input
  const start = addDays(today, -(retentionDays - 1))
  const startStr = toLocalDateString(start)
  const endStr = toLocalDateString(today)

  const days: Record<string, DayEntry> = {}
  // Carry forward existing entries that still fall in the window.
  if (existing) {
    for (const [date, entry] of Object.entries(existing.days)) {
      if (date >= startStr && date <= endStr) {
        days[date] = entry
      }
    }
  }

  // Fill any missing dates in the window.
  for (let i = 0; i < retentionDays; i++) {
    const d = addDays(start, i)
    const dateStr = toLocalDateString(d)
    if (days[dateStr]) continue
    const recentCountries = Object.values(days).map((e) => e.country.cca3)
    const recentCities = Object.values(days).map((e) => e.city.id)
    const cca3 = pickDaily(dateStr, pool.country.cca3, recentCountries)
    const cityId = pickDaily(dateStr + ':city', pool.city.ids, recentCities)
    days[dateStr] = { country: { cca3 }, city: { id: cityId } }
  }

  return {
    generatedAt: new Date().toISOString(),
    window: { start: startStr, end: endStr },
    days,
  }
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd()
  const countryPool = JSON.parse(
    readFileSync(join(root, 'scripts/daily-content/country-pool.json'), 'utf-8'),
  ) as CountryPool
  const cityPool = JSON.parse(
    readFileSync(join(root, 'scripts/daily-content/city-pool.json'), 'utf-8'),
  ) as CityPool

  const outPath = join(root, 'public/daily/index.json')
  let existing: DailyIndex | null = null
  try {
    existing = JSON.parse(readFileSync(outPath, 'utf-8')) as DailyIndex
  } catch {
    existing = null
  }

  const result = buildIndex({
    today: new Date(),
    pool: { country: countryPool, city: cityPool },
    retentionDays: 30,
    existing,
  })

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n')
  console.log(`Wrote ${outPath}: window ${result.window.start}..${result.window.end} (${Object.keys(result.days).length} days)`)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```
npm run test:unit -- scripts/daily-content/__tests__/generate-index.test.ts
```
Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```
git add scripts/daily-content/generate-index.ts scripts/daily-content/__tests__/generate-index.test.ts
git commit -m "feat(daily): index generator assembles past+today window idempotently"
```

---

## Task 12: First run — generate and commit `public/daily/index.json`

**Files:**
- Create: `public/daily/index.json` (output of the script)

- [ ] **Step 1: Run the generator**

Run:
```
npx tsx scripts/daily-content/generate-index.ts
```
Expected: `Wrote .../public/daily/index.json: window YYYY-MM-DD..YYYY-MM-DD (30 days)`.

- [ ] **Step 2: Inspect the output**

Open `public/daily/index.json`. Confirm:
- `window.end` matches today's local date.
- `days` has 30 entries with no gaps.
- No date beyond `window.end`.
- Each entry's `country.cca3` appears in `scripts/daily-content/country-pool.json`.
- Each entry's `city.id` appears in `scripts/daily-content/city-pool.json`.

- [ ] **Step 3: Verify idempotence**

Run the generator a second time:
```
npx tsx scripts/daily-content/generate-index.ts
```
Then:
```
git diff public/daily/index.json
```
Expected: only the `generatedAt` timestamp differs; `days` entries are byte-identical. (If past entries shift, the generator is buggy — fix before proceeding.)

- [ ] **Step 4: Commit**

```
git add public/daily/index.json
git commit -m "feat(daily): first-run generated public/daily/index.json"
```

---

## Task 13: Add npm scripts for generate + validate

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the scripts**

Edit `package.json`. In the `scripts` object, add:

```json
    "daily:generate": "tsx scripts/daily-content/generate-index.ts",
    "daily:validate": "tsx scripts/daily-content/validate-pools.ts",
```

Place them in alphabetical order relative to existing scripts to minimize diff churn.

- [ ] **Step 2: Verify both run end-to-end**

Run:
```
npm run daily:validate
npm run daily:generate
```
Expected: both succeed with the messages from Tasks 10 and 11.

- [ ] **Step 3: Commit**

```
git add package.json
git commit -m "feat(daily): add daily:generate + daily:validate npm scripts"
```

---

## Task 14: GitHub Actions workflow for the 4×/day cron

**Files:**
- Create: `.github/workflows/daily-puzzle.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/daily-puzzle.yml`:

```yaml
name: Daily puzzle index

on:
  schedule:
    # 00:15, 06:15, 12:15, 18:15 UTC — caps the worst-case timezone-ahead gap at ~6h.
    - cron: "15 0,6,12,18 * * *"
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: daily-puzzle
  cancel-in-progress: false

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Validate pools
        run: npm run daily:validate

      - name: Generate index
        run: npm run daily:generate

      - name: Commit if changed
        run: |
          if [[ -z "$(git status --porcelain public/daily/index.json)" ]]; then
            echo "No changes — index already current."
            exit 0
          fi
          git config user.name 'funworldmap-bot'
          git config user.email 'bot@funworldmap.com'
          git add public/daily/index.json
          git commit -m "chore(daily): update daily-puzzle window"
          git push
```

- [ ] **Step 2: Verify the workflow file parses**

Run locally (requires `yamllint` or just a YAML parser):
```
node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/daily-puzzle.yml','utf-8'))" \
  || echo "Install js-yaml or inspect manually"
```
Expected: no syntax errors. If `js-yaml` isn't installed, visually inspect the file.

- [ ] **Step 3: Commit**

```
git add .github/workflows/daily-puzzle.yml
git commit -m "feat(ci): 4x-daily workflow updates public/daily/index.json"
```

- [ ] **Step 4: After merge, manually trigger once to verify**

Via GitHub UI: Actions tab → Daily puzzle index → Run workflow. Or:
```
gh workflow run "Daily puzzle index"
```
Expected: workflow succeeds; if pools and data are consistent, either a new commit lands (`chore(daily): update daily-puzzle window`) or the "No changes" branch is hit.

---

## Task 15: Extend CI with pool validation

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add the validation step**

Edit `.github/workflows/ci.yml`. Insert a new step immediately after `npm ci` and before `npm run lint`:

```yaml
      - name: Validate daily-content pools
        run: npm run daily:validate
```

Resulting steps order: `checkout → setup-node → npm ci → daily:validate → lint → tsc -b → test:unit → build → playwright install → test:e2e → upload`.

- [ ] **Step 2: Verify locally**

Run:
```
npm run daily:validate
```
Expected: `Pool validation ok.` If it fails, fix the pool or the stub entries before committing.

- [ ] **Step 3: Commit**

```
git add .github/workflows/ci.yml
git commit -m "ci: validate daily-content pools on every PR"
```

---

## Task 16: Extend `hashState.ts` with `daily` variant (TDD)

**Files:**
- Modify: `src/lib/__tests__/hashState.test.ts`
- Modify: `src/lib/hashState.ts`

- [ ] **Step 1: Add failing tests**

Edit `src/lib/__tests__/hashState.test.ts`. Append the following inside the `describe('parseHash', …)` block:

```ts
  it('daily with date only', () => {
    expect(parseHash('#daily/2026-04-21')).toEqual({
      kind: 'daily', date: '2026-04-21', modeId: null, reveal: false,
    })
  })

  it('daily with date + modeId', () => {
    expect(parseHash('#daily/2026-04-21/country-pinning')).toEqual({
      kind: 'daily', date: '2026-04-21', modeId: 'country-pinning', reveal: false,
    })
  })

  it('daily with date + reveal', () => {
    expect(parseHash('#daily/2026-04-21/reveal')).toEqual({
      kind: 'daily', date: '2026-04-21', modeId: null, reveal: true,
    })
  })

  it('daily with date + modeId + reveal', () => {
    expect(parseHash('#daily/2026-04-21/city-guessing/reveal')).toEqual({
      kind: 'daily', date: '2026-04-21', modeId: 'city-guessing', reveal: true,
    })
  })

  it('daily with invalid date format falls back to empty', () => {
    expect(parseHash('#daily/21-04-2026')).toEqual({ kind: 'empty' })
    expect(parseHash('#daily/2026-4-21')).toEqual({ kind: 'empty' })
    expect(parseHash('#daily/not-a-date')).toEqual({ kind: 'empty' })
  })

  it('daily with no date falls back to empty', () => {
    expect(parseHash('#daily/')).toEqual({ kind: 'empty' })
    expect(parseHash('#daily')).toEqual({ kind: 'empty' })
  })
```

And in the `describe('writeHash', …)` block:

```ts
  it('daily date only', () => {
    expect(writeHash({ kind: 'daily', date: '2026-04-21', modeId: null, reveal: false }))
      .toBe('daily/2026-04-21')
  })

  it('daily with modeId', () => {
    expect(writeHash({ kind: 'daily', date: '2026-04-21', modeId: 'country-pinning', reveal: false }))
      .toBe('daily/2026-04-21/country-pinning')
  })

  it('daily with reveal', () => {
    expect(writeHash({ kind: 'daily', date: '2026-04-21', modeId: null, reveal: true }))
      .toBe('daily/2026-04-21/reveal')
  })

  it('daily with modeId + reveal', () => {
    expect(writeHash({ kind: 'daily', date: '2026-04-21', modeId: 'city-guessing', reveal: true }))
      .toBe('daily/2026-04-21/city-guessing/reveal')
  })
```

- [ ] **Step 2: Run tests to verify failure**

Run:
```
npm run test:unit -- src/lib/__tests__/hashState.test.ts
```
Expected: FAIL on the new tests.

- [ ] **Step 3: Implement the `daily` variant**

Edit `src/lib/hashState.ts`. Replace the entire file with:

```ts
export type HashState =
  | { kind: 'empty' }
  | { kind: 'country'; cca3: string; compareWith: string | null }
  | { kind: 'game'; modeId: string; playing: boolean }
  | { kind: 'daily'; date: string; modeId: string | null; reveal: boolean }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const KNOWN_MODE_IDS = new Set(['country-pinning', 'city-guessing'])

export function parseHash(hash: string): HashState {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash
  if (!clean) return { kind: 'empty' }

  if (clean === 'daily' || clean === 'daily/') return { kind: 'empty' }
  if (clean.startsWith('daily/')) {
    const parts = clean.slice('daily/'.length).split('/').filter(Boolean)
    const [date, second, third] = parts
    if (!date || !DATE_RE.test(date)) return { kind: 'empty' }
    // Shapes: [date], [date, mode], [date, 'reveal'], [date, mode, 'reveal']
    if (parts.length === 1) return { kind: 'daily', date, modeId: null, reveal: false }
    if (parts.length === 2) {
      if (second === 'reveal') return { kind: 'daily', date, modeId: null, reveal: true }
      if (KNOWN_MODE_IDS.has(second)) return { kind: 'daily', date, modeId: second, reveal: false }
      return { kind: 'empty' }
    }
    if (parts.length === 3) {
      if (KNOWN_MODE_IDS.has(second) && third === 'reveal') {
        return { kind: 'daily', date, modeId: second, reveal: true }
      }
      return { kind: 'empty' }
    }
    return { kind: 'empty' }
  }

  if (clean.startsWith('game/')) {
    const rest = clean.slice('game/'.length)
    if (!rest) return { kind: 'empty' }
    if (rest.endsWith('/play')) {
      const modeId = rest.slice(0, -'/play'.length)
      return { kind: 'game', modeId, playing: true }
    }
    return { kind: 'game', modeId: rest, playing: false }
  }

  const parts = clean.split(',').map((s) => s.trim().toUpperCase())
  const cca3 = parts[0] || ''
  if (!cca3) return { kind: 'empty' }
  const compareWith = parts[1] || null
  return { kind: 'country', cca3, compareWith }
}

export function writeHash(state: HashState): string {
  switch (state.kind) {
    case 'empty':
      return ''
    case 'country':
      return state.compareWith ? `${state.cca3},${state.compareWith}` : state.cca3
    case 'game':
      return state.playing ? `game/${state.modeId}/play` : `game/${state.modeId}`
    case 'daily': {
      let out = `daily/${state.date}`
      if (state.modeId) out += `/${state.modeId}`
      if (state.reveal) out += '/reveal'
      return out
    }
  }
}
```

- [ ] **Step 4: Run tests to verify passes**

Run:
```
npm run test:unit -- src/lib/__tests__/hashState.test.ts
```
Expected: all tests (existing + new) pass.

- [ ] **Step 5: Commit**

```
git add src/lib/hashState.ts src/lib/__tests__/hashState.test.ts
git commit -m "feat(hash): add daily variant with date/modeId/reveal"
```

---

## Task 17: Handle `daily` hash in App.tsx — redirect + fire `deep_link_opened`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the redirect handler**

Edit `src/App.tsx`. Add imports near the top:

```ts
import { parseHash } from './lib/hashState'
import { track } from './lib/analytics'
import { toLocalDateString } from './game/daily/dates'
```

Then add a new `useEffect` inside `AppInner`, after the existing hint-related effects, before the Escape-handler effect:

```ts
  useEffect(() => {
    const resolveDaily = () => {
      const state = parseHash(window.location.hash)
      if (state.kind !== 'daily') return
      const todayStr = toLocalDateString(new Date())
      let dateKind: 'today' | 'past' | 'future' | 'invalid' = 'invalid'
      if (state.date === todayStr) dateKind = 'today'
      else if (state.date < todayStr) dateKind = 'past'
      else if (state.date > todayStr) dateKind = 'future'
      track('deep_link_opened', { dateKind, outcome: 'redirect' })
      // Phase 1 stub: redirect to bare root. Phase 2 will handle daily routes.
      history.replaceState(null, '', window.location.pathname)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    }
    resolveDaily()
    window.addEventListener('hashchange', resolveDaily)
    return () => window.removeEventListener('hashchange', resolveDaily)
  }, [])
```

- [ ] **Step 2: Manual verification**

Run:
```
npm run dev
```
In a browser, visit `http://localhost:5173/#daily/2026-04-21`. Expected:
- URL immediately changes to `http://localhost:5173/`.
- Launcher appears (since hash is now bare-root).
- In the browser DevTools Network tab, a POST to `https://funworldmap.com/api/event` fires (or if `VITE_ANALYTICS_ENDPOINT` is empty in local, no network call — verify via console.log temporarily if needed).

- [ ] **Step 3: Revert any temporary console.log and commit**

```
git add src/App.tsx
git commit -m "feat(daily): redirect daily-hash to root + track deep_link_opened"
```

---

## Task 18: Baseline `launcher_dismissed` instrumentation

**Files:**
- Modify: `src/components/Launcher.tsx`
- Modify: `src/App.tsx`

`SearchBar.tsx` is deliberately NOT modified: `onNonEmptyChange` fires on every non-empty keystroke (not just the empty→non-empty transition), so placing `track()` inside SearchBar would emit multiple `launcher_dismissed` events per dismissal. Instead, App.tsx wraps the callback handed to Header — because `Header.onLauncherDismiss` is only forwarded into `SearchBar.onNonEmptyChange` when `launcherVisible === true`, the wrapped callback fires exactly once per dismiss (the state change removes the callback on the next render).

- [ ] **Step 1: Fire on explicit-link dismiss**

Edit `src/components/Launcher.tsx`. Add import:

```ts
import { track } from '../lib/analytics'
```

Change `dismissWithFocus`:

```ts
  const dismissWithFocus = useCallback(() => {
    track('launcher_dismissed', { path: 'link' })
    onDismiss()
    focusSearchInput()
  }, [onDismiss])
```

And `startMode`:

```ts
  const startMode = useCallback(
    (id: ModeId) => {
      track('launcher_dismissed', { path: 'card' })
      track('free_started', { mode: id })
      writeLastMode(id)
      onDismiss()
      window.location.hash = writeHash({ kind: 'game', modeId: id, playing: true })
    },
    [onDismiss],
  )
```

- [ ] **Step 2: Fire on Escape + wrap the search-dismiss callback**

Edit `src/App.tsx`. First, the Escape-key handler: find the branch where `launcherVisible` triggers dismissal:

```ts
        if (launcherVisible) {
          dismissLauncher()
          const searchInput = document.getElementById('search-input') as HTMLInputElement | null
          searchInput?.focus()
          return
        }
```

Change to:

```ts
        if (launcherVisible) {
          track('launcher_dismissed', { path: 'escape' })
          dismissLauncher()
          const searchInput = document.getElementById('search-input') as HTMLInputElement | null
          searchInput?.focus()
          return
        }
```

(The `track` import was added in Task 17; reuse it.)

Second, wrap the search-dismiss path. Find where `<Header>` is rendered in `AppInner`. Above it, add a new memoized callback:

```ts
  const onLauncherDismissFromSearch = useCallback(() => {
    track('launcher_dismissed', { path: 'search' })
    dismissLauncher()
  }, [dismissLauncher])
```

Then change the Header's `onLauncherDismiss` prop from `dismissLauncher` to `onLauncherDismissFromSearch`:

```tsx
        onLauncherDismiss={onLauncherDismissFromSearch}
```

`Header.tsx` passes `onLauncherDismiss` into `SearchBar.onNonEmptyChange` only when `launcherVisible` is true; after the first keystroke, `dismissLauncher` flips `dismissed` to `true`, the next render passes `undefined`, and no further keystrokes fire the callback. Exactly-once emission.

- [ ] **Step 3: Verify all paths emit**

Run:
```
npm run test:e2e -- launcher.spec.ts
```
Expected: existing launcher e2e tests pass.

Then manually in dev:
- Click "Just explore the map" → `launcher_dismissed { path: 'link' }`
- Click a mode card → `launcher_dismissed { path: 'card' }` AND `free_started { mode: ... }`
- Focus search and type one keystroke → `launcher_dismissed { path: 'search' }` (exactly once)
- Focus search, type two keystrokes in one launcher session — only the first fires the event
- Press Escape while launcher is visible → `launcher_dismissed { path: 'escape' }`

(Observe via the browser console by temporarily adding a `console.log` inside `track()`; remove the log before commit.)

- [ ] **Step 4: Commit**

```
git add src/components/Launcher.tsx src/App.tsx
git commit -m "feat(analytics): baseline launcher_dismissed + free_started events"
```

---

## Task 19: Baseline `deep_link_opened` for country deep-links

**Files:**
- Modify: `src/hooks/useSelectedCountry.ts`

- [ ] **Step 1: Add the tracking**

Edit `src/hooks/useSelectedCountry.ts`. Add import:

```ts
import { track } from '../lib/analytics'
```

Modify `resolveHash` to emit on successful resolution of a non-empty country hash:

```ts
  const resolveHash = useCallback(() => {
    const state = parseHash(window.location.hash)
    if (state.kind !== 'country') {
      setSelected(null)
      setCompareWith(null)
      return
    }
    const selCountry = byCca3.get(state.cca3) ?? null
    const cmpCountry = state.compareWith ? byCca3.get(state.compareWith) ?? null : null
    if (!selCountry) {
      track('deep_link_opened', { dateKind: 'invalid', outcome: 'redirect' })
      history.replaceState(null, '', window.location.pathname)
      setSelected(null)
      setCompareWith(null)
      return
    }
    // Fire only on initial resolve from an unloaded state (i.e., cold-load deep-link),
    // not on every hashchange from user clicks. Use a ref to track first resolve.
    if (!hasLoggedRef.current) {
      track('deep_link_opened', {
        dateKind: 'today', // country hashes carry no date; pin dateKind to today for baseline
        outcome: 'played',
      })
      hasLoggedRef.current = true
    }
    setSelected(selCountry)
    setCompareWith(cmpCountry)
  }, [byCca3])
```

Add the ref declaration near the other state at the top of the hook body:

```ts
  const hasLoggedRef = useRef(false)
```

And add `useRef` to the existing React import:

```ts
import { useState, useEffect, useCallback, useRef } from 'react'
```

- [ ] **Step 2: Smoke-test**

Run:
```
npm run dev
```
Visit `http://localhost:5173/#FRA` (cold tab). Expected: one `deep_link_opened` event; switching to another country via search does NOT re-fire.

- [ ] **Step 3: Commit**

```
git add src/hooks/useSelectedCountry.ts
git commit -m "feat(analytics): baseline deep_link_opened for country deep-links"
```

---

## Task 20: Update the spec's out-of-scope list + roadmap

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Log v1.1 items under a new "Retention program (v1.1)" section**

Edit `docs/roadmap.md`. Append under the existing sections but before `## Rejected (won't build)`:

```markdown
## Retention program (v1.1+)

Source: [`2026-04-21-retention-program-v1-design.md`](superpowers/specs/2026-04-21-retention-program-v1-design.md).

- **Push notifications** — would require a push service; deferred past v1.
- **Yesterday's-global-average score overlay** — requires scheduled aggregation from the Analytics Engine into a static JSON; add after v1 data proves the retention lift.
- **Canvas-rendered PNG share image** — richer Twitter/iMessage unfurl than plain text + URL.
- **Retroactive free-play of past dailies** — v1 calendar cells are reveal-only.
- **Regional / difficulty packs.**
- **Per-timezone daily rollover** — v1 accepts up to 6 h lag east of UTC.
- **Streak-freeze / streak-save** mechanics.
- **i18n of daily + share copy.**
- **Achievements, badges, meta-progress "world explored" map coloring.**
- **Multiplayer, online leaderboards.**
- **In-app analytics dashboard** — v1 uses CF GraphQL / Workers dashboard only.
- **CI-driven Worker deploys** — v1 deploys the Worker manually; move to a GitHub Action on `cloudflare-worker/**` changes.
```

- [ ] **Step 2: Commit**

```
git add docs/roadmap.md
git commit -m "docs(roadmap): catalogue retention v1.1+ deferrals"
```

---

## Phase 1 completion checklist

Verify before opening the PR:

- [ ] CF nameserver switch complete and propagated (`dig funworldmap.com NS` returns CF nameservers).
- [ ] CF Web Analytics enabled; token stored in `VITE_CF_WA_TOKEN` secret.
- [ ] Worker deployed; `curl -X POST https://funworldmap.com/api/event -H 'origin: https://funworldmap.com' -H 'content-type: application/json' -d '{"name":"daily_opened","props":{"mode":"country-pinning","dateAge":0}}'` returns `204`.
- [ ] `public/daily/index.json` present with 30 days of entries ending on today.
- [ ] `npm run daily:validate` → `Pool validation ok.`
- [ ] `npm run daily:generate` is idempotent (only `generatedAt` differs between runs).
- [ ] GitHub Action `Daily puzzle index` successfully triggered once manually; no commit when index is already current.
- [ ] CI runs `validate-pools` before unit tests and passes.
- [ ] `npm run test:unit` passes: new tests + existing tests all green.
- [ ] `npm run test:e2e` passes: existing specs unaffected.
- [ ] `npm run build` succeeds with `VITE_CF_WA_TOKEN` and `VITE_ANALYTICS_ENDPOINT` set.
- [ ] `npm run build` also succeeds with those vars empty (local-dev sanity).
- [ ] Manual: visiting `/#daily/2026-04-21` redirects to `/` and fires `deep_link_opened`.
- [ ] Manual: the four `launcher_dismissed` paths each emit once per action.
- [ ] Manual: mode-card click emits `launcher_dismissed { card }` + `free_started { mode }`.
- [ ] Manual: `#FRA` cold-load emits exactly one `deep_link_opened`.
- [ ] `docs/systems/analytics.md` present; `docs/roadmap.md` updated.

---

## What Phase 2 picks up

After this plan is merged and at least 14 days have elapsed collecting baseline analytics, the next plan file (`2026-04-21-retention-program-v1-phase-2-daily-play.md`, to be authored at that time) will implement:

- `useDailyPuzzles` and `useDailyHistory` hooks that consume `public/daily/index.json` and `localStorage`.
- Game-framework extension (`attemptsPerRound`, `currentAttempts[]`, partial reveal between attempts).
- Daily session entry point per mode.
- Launcher mode-card rewrite (three-state: unplayed / played / unavailable), including the "Removed / replaced" items listed in the spec.
- `#daily/<date>/<modeId>` route wiring (no longer redirects).
- E2E specs `daily-puzzle.spec.ts` + migration of `game-country-pinning.spec.ts` and `game-city-guessing.spec.ts`.

Phases 3–5 get their own plan files at their respective merge points.
