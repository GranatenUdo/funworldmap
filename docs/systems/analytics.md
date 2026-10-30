# Analytics

funworldmap uses two complementary layers of analytics. They are optional, controlled by build-time configuration, and subject to the current Cloudflare account plan and limits.

## Layer 1 — Cloudflare Web Analytics (passive)

Cloudflare Web Analytics supplies aggregate traffic/performance reporting through its browser beacon. Consult current provider documentation for collection and retention details; this repository does not establish a blanket no-personal-data guarantee. The custom-event Worker is a separate integration.

**Setup:**

1. Point the `funworldmap.com` domain at Cloudflare nameservers at the registrar.
2. Add a proxied CNAME in CF: `funworldmap.com → granatenudo.github.io`.
3. Enable Web Analytics on the CF dashboard, paired to `funworldmap.com`.
4. Copy the site token and paste it into the `VITE_CF_WA_TOKEN` GitHub secret used by `deploy.yml`.

No custom events — CF WA free tier does not support them.

## Layer 2 — Cloudflare Worker + Analytics Engine (custom events)

The client POSTs event payloads to the Worker. The Worker validates and writes typed columns to Analytics Engine. Queries run via CF's GraphQL API or the Workers dashboard.

Check current Worker and Analytics Engine limits in the account dashboard before enabling or scaling this optional service.

- **Worker source:** `cloudflare-worker/index.ts`
- **Config:** `cloudflare-worker/wrangler.toml`
- **Endpoint:** `https://funworldmap.com/api/event` (Worker Route on the proxied domain)
- **Client wrapper:** `src/lib/analytics.ts` exports `track(name, props)`

**Validate locally (no publication):**

```
npm ci --prefix cloudflare-worker
npm run typecheck --prefix cloudflare-worker
npm run build:check --prefix cloudflare-worker
```

For an intentional deployment, explicitly choose and verify the environment and Analytics Engine binding first; production bindings are not inherited from the top-level configuration. See the operations runbook. In the CF dashboard, confirm that a Worker Route `funworldmap.com/api/event` exists for the deployed service.

**Query:** CF dashboard → Workers & Pages → funworldmap-analytics → Analytics Engine tab. Or via GraphQL at `https://api.cloudflare.com/client/v4/graphql` (account-scoped token required).

## Client wrapper behavior

- Preferred transport: `navigator.sendBeacon` (fire-and-forget, reliable on page unload).
- Fallback: `fetch(..., { keepalive: true })`.
- No-op when `navigator.doNotTrack === '1'`.
- No-op when `window.__PLAYWRIGHT__` is set — a unit-test seam (`src/test/analyticsCapture.ts`) that captures events to `window.__testAnalytics`.
- No-op when `VITE_ANALYTICS_ENDPOINT` build-time env is empty (dev builds, CI e2e builds).

## Column schema (Analytics Engine)

Analytics Engine stores positional arrays: `indexes[]`, `blobs[]` (strings), `doubles[]` (numbers). Position matters for queries (`blob1`, `blob2`, ... in SQL). The Worker pins the following canonical ordering. **Do not reorder without planning a migration** — existing data becomes orphaned.

**Indexes:**

| Position | Meaning    | Example          |
| -------- | ---------- | ---------------- |
| `index1` | event name | `"free_started"` |

**Blobs (strings):**

| Position | SQL name | Meaning                                                                   | Example                                                              |
| -------- | -------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 0        | `blob1`  | event name (duplicated for convenience)                                   | `"free_started"`                                                     |
| 1        | `blob2`  | `props.mode`                                                              | `"country-pinning"` / `"city-guessing"` / `""`                       |
| 2        | `blob3`  | `props.path` (launcher_dismissed path)                                    | `"search"` / `"escape"` / `"card"` / `"backdrop"` / `"close"` / `""` |
| 3        | `blob4`  | _reserved_ — legacy daily `props.method`; no current event populates it   | `""`                                                                 |
| 4        | `blob5`  | _reserved_ — legacy daily `props.dateKind`; no current event populates it | `""`                                                                 |
| 5        | `blob6`  | _reserved_ — legacy daily `props.outcome`; no current event populates it  | `""`                                                                 |
| 6        | `blob7`  | _reserved_ — legacy daily `props.cellKind`; no current event populates it | `""`                                                                 |

**Doubles (numbers):**

| Position | SQL name  | Meaning                                                                             |
| -------- | --------- | ----------------------------------------------------------------------------------- |
| 0        | `double1` | _reserved_ — legacy daily `props.dateAge`; no current event populates it (always 0) |
| 1        | `double2` | _reserved_ — legacy daily `props.scoreBucket`; always 0                             |
| 2        | `double3` | _reserved_ — legacy daily `props.bestScoreBucket`; always 0                         |
| 3        | `double4` | _reserved_ — legacy daily `props.attemptIndex`; always 0                            |
| 4        | `double5` | _reserved_ — legacy daily `props.attemptsUsed`; always 0                            |
| 5        | `double6` | _reserved_ — legacy daily streak `props.days`; always 0                             |

The daily-puzzle feature was removed; its blob/double slots are kept **reserved** (never reused for new semantics) per the migration policy below. Current events populate only `index1`/`blob1` (name), `blob2` (mode, for `free_started`), and `blob3` (path, for `launcher_dismissed`). Queries filter by `index1 = '<event_name>'` then project the columns that matter.

## Event catalog

The surviving custom events (see `src/lib/analytics.ts` `EventSchema` and `cloudflare-worker/index.ts` `KNOWN_EVENTS`):

| Event                | Props                                                               | Emission site                                                     |
| -------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `free_started`       | `{ mode: ModeId }`                                                  | hash router boots a `#game/<mode>` round (`useHashGameRouter.ts`) |
| `launcher_dismissed` | `{ path: 'search' \| 'escape' \| 'card' \| 'backdrop' \| 'close' }` | launcher closed (`Launcher.tsx` / `App.tsx`)                      |
| `header_cta_clicked` | `{}`                                                                | header **Play** button opens the launcher (`Header.tsx`)          |

## Migration notes

- Adding a new event: add its name to `KNOWN_EVENTS` in `cloudflare-worker/index.ts` and `EventName` in `src/lib/analytics.ts`. No schema change if props map to existing column positions.
- Adding a new prop: append to the next unused blob or double slot. Update this doc's tables. Never insert in the middle.
- Removing a prop: leave the column slot empty forever; do not reuse the slot for different semantics.
