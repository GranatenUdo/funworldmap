# Country News Feed — System Overview

Date: 2026-04-22 (Phase CN v1)

This doc is the single reference for the country news feed feature end-to-end:
what it is, how the pieces fit, and how to operate it.

## Pipeline overview

```
Guardian Content API
        │
        ▼
scripts/news/build.ts     (runs via `npm run news:build`)
        │  reads: src/data/countries.json
        │  calls: guardianSearch() per country (country tag, then region fallback)
        │  writes: public/news/<CCA3>.json  (one file per country)
        │
        ▼
.github/workflows/news.yml
        │  schedule: daily at 06:00 UTC
        │  needs: GUARDIAN_KEY repository secret
        │  commits public/news/ back to main if changed
        │
        ▼
GitHub Pages static hosting
        │  /news/DEU.json  (and so on for every country)
        │
        ▼
CountryNewsSection.tsx     (React component)
        │  fetches /news/<CCA3>.json on panel open
        │  renders up to 5 articles, loading / error / empty states
        │
        ▼
SingleCountryPanel.tsx     (mounts CountryNewsSection unless inGameRound)
```

### Article scoping

`build.ts` first queries the country-specific Guardian tag (e.g. `world/germany`
for DEU). If fewer than 5 articles are found, it fills remaining slots from the
region tag (e.g. `world/europe`). Articles carry a `scope` field:

- `"country"` — matched the country-specific tag.
- `"region"` — filled from the regional fallback. The UI renders a "Region"
  badge on these cards so users know the article is not country-specific.

### Throttling

The Guardian open/developer API rate limit is 1 request/second. The build
script sleeps 1.1 s between each API call. For 249 countries with a Guardian
tag (plus region fallbacks), the build takes roughly 10–15 minutes and stays
well within the 5,000 req/day limit.

Countries without a country-specific tag (i.e. not in `GUARDIAN_TAGS` in
`scripts/news/guardian-tags.ts`) still receive a region-fallback fetch if their
region has a tag. Countries in `Americas` and `Antarctic` receive no fetch and
produce a file with an empty `articles` array.

### JSON file shape

```json
{
  "updatedAt": "2026-04-22T06:12:34.000Z",
  "country": { "cca3": "DEU", "name": "Germany" },
  "guardianTag": "world/germany",
  "articles": [
    {
      "id": "world/germany/2026/apr/22/…",
      "title": "…",
      "trailText": "…",
      "url": "https://www.theguardian.com/…",
      "publishedAt": "2026-04-22T05:00:00.000Z",
      "section": "world",
      "thumbnail": "https://media.guim.co.uk/…",
      "scope": "country"
    }
  ]
}
```

`guardianTag` is the tag used for the country query, or `null` if none exists.
The UI uses it to render a "Browse all coverage →" link in the empty state.

## API key rotation steps

The Guardian key is stored as a GitHub Actions repository secret named
`GUARDIAN_KEY`.

1. Go to [https://open-platform.theguardian.com/access/](https://open-platform.theguardian.com/access/)
   and log in with the registered account.
2. Generate a new key (or note the existing key from account dashboard).
3. In the GitHub repository → Settings → Secrets and variables → Actions,
   update `GUARDIAN_KEY` to the new value.
4. Verify by manually triggering the workflow: `gh workflow run news.yml`.
5. Check the workflow run logs — look for `[news] complete: N articles across
   249 files`. Any `401` errors mean the key is wrong or not yet active.
6. The old key can be revoked from the Guardian dashboard once the new one is
   confirmed working.

Note: The Guardian open/developer tier is free. The key does not expire but
can be revoked from the Guardian account page.

## Adding a new country tag

When a country's news coverage improves on The Guardian, add it to the
`GUARDIAN_TAGS` map in `scripts/news/guardian-tags.ts`.

### Discovery

1. Search for the country on [theguardian.com](https://www.theguardian.com) and
   look at the URL of a country tag page (e.g.
   `https://www.theguardian.com/world/morocco` → tag is `world/morocco`).
2. Alternatively, query the tags API directly:
   ```
   curl "https://content.guardianapis.com/tags?q=<country-name>&api-key=<YOUR_KEY>"
   ```
   Find the `id` field of the matching tag in the response.

### Registration

Add a line to `GUARDIAN_TAGS` in `scripts/news/guardian-tags.ts`:

```ts
MAR: 'world/morocco',
```

Commit and merge. The next daily build run (or a manual dispatch) will pick up
the new tag.

### Verification

After the build runs, check `public/news/MAR.json` — it should contain
`"scope": "country"` articles. If it still shows only region articles, the tag
ID may be wrong (try the tags API again).

## Operational notes

### Monitoring the daily run

The GHA workflow `news.yml` runs daily at 06:00 UTC (schedule:
`0 6 * * *`). To check its status:

```bash
gh run list --workflow=news.yml --limit=5
```

A typical successful run ends with a commit message `chore(news): daily refresh`
on `main`. If no articles change day-over-day the workflow exits `0` without
committing.

### Manual trigger

```bash
gh workflow run news.yml
```

Useful after rotating the API key, adding new country tags, or recovering from
a missed scheduled run.

### Diagnosing fetch failures

Build warnings are logged as `[news] <CCA3> country fetch failed: …`. If the
entire run fails, the most common causes are:

- `GUARDIAN_KEY` missing or expired → see "API key rotation steps".
- Guardian API rate limit exceeded (unlikely given 1.1 s throttle, but possible
  if the key is shared) → check the Guardian account dashboard.
- GitHub Actions network egress blocked → rare; check `ci.yml` runs for
  comparison.

### Content window

The build fetches articles published in the last **7 days** (`WINDOW_DAYS = 7`
in `build.ts`). This is a hard constant. To change the window, update that
constant and re-run the build.

### Rollback

The news feature is purely client-side and static. `public/news/` files are
committed to `main` by the bot.

1. **Disable the daily run.** In GitHub → Actions → News feed → ⋯ → Disable
   workflow. This stops new files being committed.
2. **Revert the component code.** `git revert <merge-commit>` for the
   `feat/country-news-feed` merge. `deploy.yml` republishes GH Pages
   automatically. The `CountryNewsSection` disappears from all panels.
3. **Remove stale JSON files (optional).** If keeping the code live but wanting
   to clear articles:
   ```bash
   git rm -r public/news/
   git commit -m "chore(news): remove news files during rollback"
   git push
   ```
   The component's 404 handler will show "News unavailable." for all panels.
4. **Re-enable.** Re-enable the workflow, add `GUARDIAN_KEY`, and run
   `gh workflow run news.yml` to repopulate.

### Privacy / attribution

All articles link to theguardian.com with `target="_blank" rel="noopener noreferrer"`.
Thumbnails are served directly from `media.guim.co.uk` with
`referrerPolicy="no-referrer"`. No article content is reproduced — only title,
trail text (subheadline), and thumbnail URL from the Guardian API response.
Use is within the Guardian's open-platform terms of service.
