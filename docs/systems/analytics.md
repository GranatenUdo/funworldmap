# Analytics

funworldmap uses two complementary layers of analytics. Both run on Cloudflare's free tiers at $0/month for realistic v1 traffic.

## Layer 1 — Cloudflare Web Analytics (passive)

Captures page views, unique visitors (IP-hashed, 24-h TTL), referrers, country stats, and Core Web Vitals. No cookies. No PII. Requires Cloudflare to be fronting the origin.

**Setup:**

1. Point the `funworldmap.com` domain at Cloudflare nameservers at the registrar.
2. Add a proxied CNAME in CF: `funworldmap.com → funworldmap.github.io`.
3. Enable Web Analytics on the CF dashboard, paired to `funworldmap.com`.
4. Copy the site token and paste it into the `VITE_CF_WA_TOKEN` GitHub secret used by `deploy.yml`.

No custom events — CF WA free tier does not support them.

## Layer 2 — Cloudflare Worker + Analytics Engine (custom events)

The client POSTs event payloads to the Worker. The Worker validates and writes typed columns to Analytics Engine. Queries run via CF's GraphQL API or the Workers dashboard.

**Free-tier ceilings:** Workers 100,000 req/day; Analytics Engine 10,000,000 writes/month.

- **Worker source:** `cloudflare-worker/index.ts`
- **Config:** `cloudflare-worker/wrangler.toml`
- **Endpoint:** `https://funworldmap.com/api/event` (Worker Route on the proxied domain)
- **Client wrapper:** `src/lib/analytics.ts` exports `track(name, props)`

**Deploy:**

```
cd cloudflare-worker
wrangler login        # one-time
wrangler deploy
```

In the CF dashboard, confirm that a Worker Route `funworldmap.com/api/event` exists for the deployed service.

**Query:** CF dashboard → Workers & Pages → funworldmap-analytics → Analytics Engine tab. Or via GraphQL at `https://api.cloudflare.com/client/v4/graphql` (account-scoped token required).

## Client wrapper behavior

- Preferred transport: `navigator.sendBeacon` (fire-and-forget, reliable on page unload).
- Fallback: `fetch(..., { keepalive: true })`.
- No-op when `navigator.doNotTrack === '1'`.
- No-op when `window.__PLAYWRIGHT__` is set — the e2e harness captures events to `window.__testAnalytics` for assertion instead.
- No-op when `VITE_ANALYTICS_ENDPOINT` build-time env is empty (dev builds, CI e2e builds).

## Column schema (Analytics Engine)

Analytics Engine stores positional arrays: `indexes[]`, `blobs[]` (strings), `doubles[]` (numbers). Position matters for queries (`blob1`, `blob2`, ... in SQL). The Worker pins the following canonical ordering. **Do not reorder without planning a migration** — existing data becomes orphaned.

**Indexes:**

| Position | Meaning | Example |
|---|---|---|
| `index1` | event name | `"daily_completed"` |

**Blobs (strings):**

| Position | SQL name | Meaning | Example |
|---|---|---|---|
| 0 | `blob1` | event name (duplicated for convenience) | `"daily_completed"` |
| 1 | `blob2` | `props.mode` | `"country-pinning"` / `"city-guessing"` / `""` |
| 2 | `blob3` | `props.path` (launcher_dismissed path) | `"link"` / `"search"` / `"escape"` / `"card"` / `""` |
| 3 | `blob4` | `props.method` (share method) | `"share-api"` / `"clipboard-text"` / `"clipboard-link"` / `""` |
| 4 | `blob5` | `props.dateKind` | `"today"` / `"past"` / `"future"` / `"invalid"` / `""` |
| 5 | `blob6` | `props.outcome` | `"played"` / `"reveal"` / `"redirect"` / `""` |
| 6 | `blob7` | `props.cellKind` | `"played"` / `"unplayed-in-window"` / `"rolled-off"` / `""` |

**Doubles (numbers):**

| Position | SQL name | Meaning |
|---|---|---|
| 0 | `double1` | `props.dateAge` (days from today, 0 = today) |
| 1 | `double2` | `props.scoreBucket` (0–4 quintile) |
| 2 | `double3` | `props.bestScoreBucket` |
| 3 | `double4` | `props.attemptIndex` (0-indexed) |
| 4 | `double5` | `props.attemptsUsed` |
| 5 | `double6` | `props.days` (streak milestone value: 3, 7, 14, 30, 100) |

Unused slots for a given event carry empty strings / zero. Queries filter by `index1 = '<event_name>'` then project the columns that matter.

## Event catalog

See the §Analytics section of `docs/superpowers/specs/2026-04-21-retention-program-v1-design.md` for the canonical event list, props, and emission sites.

## Migration notes

- Adding a new event: add its name to `KNOWN_EVENTS` in `cloudflare-worker/index.ts` and `EventName` in `src/lib/analytics.ts`. No schema change if props map to existing column positions.
- Adding a new prop: append to the next unused blob or double slot. Update this doc's tables. Never insert in the middle.
- Removing a prop: leave the column slot empty forever; do not reuse the slot for different semantics.
