# Saved Analytics Engine Queries

These queries target the `funworldmap_events` dataset written by
`cloudflare-worker/index.ts`. They power the CF analytics dashboard.

No saved `.sql` queries currently live here — the retention/daily funnels were
removed with the daily feature. Add new queries for the surviving events as
needed.

## Blob / double slot mapping

From `cloudflare-worker/index.ts`. Canonical reference: `docs/systems/analytics.md`.

| Slot                                 | Field                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| `index1`                             | event name                                                                           |
| `blob1`                              | event name (duplicate for blob-only reads)                                           |
| `blob2`                              | `mode` (ModeId) — `free_started`                                                     |
| `blob3`                              | `path` — `launcher_dismissed`                                                        |
| `blob4`–`blob7`, `double1`–`double6` | _reserved_ — legacy daily slots, kept empty/zero (never reused per migration policy) |

Automatic columns: `_timestamp`, `_sample_interval`.

## How to import

1. Open CF → Analytics → Analytics Engine → Query.
2. Paste a `.sql` file's content into the query editor.
3. Save as a dashboard panel on the "funworldmap analytics" dashboard.
   Recommended chart types are noted in each file.

If a query fails with a schema error, the Worker's slot mapping has
drifted — update both the query and this README.
