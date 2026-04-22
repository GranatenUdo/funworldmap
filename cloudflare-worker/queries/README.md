# Saved Analytics Engine Queries

These queries target the `funworldmap_events` dataset written by
`cloudflare-worker/index.ts`. They power the retention-v1 CF dashboard.

## Blob / double slot mapping

From `cloudflare-worker/index.ts`:

| Slot | Field |
|---|---|
| `index1` | event name |
| `blob1` | event name (duplicate for blob-only reads) |
| `blob2` | `mode` (ModeId) |
| `blob3` | `path` |
| `blob4` | `method` (share/launcher-dismiss) |
| `blob5` | `dateKind` |
| `blob6` | `outcome` |
| `blob7` | `cellKind` |
| `double1` | `dateAge` |
| `double2` | `scoreBucket` |
| `double3` | `bestScoreBucket` |
| `double4` | `attemptIndex` |
| `double5` | `attemptsUsed` |
| `double6` | `days` (milestone threshold) |

Automatic columns: `_timestamp`, `_sample_interval`.

## How to import

1. Open CF → Analytics → Analytics Engine → Query.
2. Paste a `.sql` file's content into the query editor.
3. Save as a dashboard panel on the "funworldmap retention v1"
   dashboard. Recommended chart types are noted in each file.

If a query fails with a schema error, the Worker's slot mapping has
drifted — update both the query and this README.
