# 4. Daily content served from an orphan `data` branch

**Status:** Accepted
**Date:** 2026-05-30

## Context

The daily puzzle index (`/daily/index.json`) is regenerated four times a day and must
be served from the static site. The original approach committed it to `main`, which
accumulated ~137 `chore(daily)` bot commits — about a third of `main`'s history —
burying the real development history. For a showcase repository, that history noise is
a cleanliness problem.

## Decision

The generated index lives on an **orphan `data` branch**, never tracked on `main`:

- `daily-puzzle.yml` generates the index and commits it to `data` (two-checkout
  pattern), not `main`.
- `deploy.yml` obtains the index by **checking out** the `data` branch
  (`actions/checkout`), not `git fetch origin data` — under actions/checkout's
  single-branch refspec a bare fetch only updates `FETCH_HEAD` and never resolves
  `origin/data`, which would silently fall back to regenerating. A generate fallback
  covers a missing branch.
- Locally and in e2e the index is generated on demand (`predev` / the Playwright
  `webServer`); it is gitignored.

This supersedes the previous commit-to-`main` approach.

## Consequences

- `main`'s history stays free of bot commits going forward.
- Per-date content provenance is preserved (the `data` branch's git history) and the
  GitHub scheduled-workflow keepalive is preserved (commits to `data` count as
  repository activity that resets the 60-day auto-disable clock).
- Past-but-in-window daily picks may change when the index regenerates
  (reproducibility waived — no meaningful userbase to protect).
- Two workflows now reference the `data` branch; a lost branch needs the runbook
  bootstrap; deploy's generate fallback ensures the site never ships without a daily.

## Alternatives

- **Keep committing to `main`** — simplest, but the history noise is the problem being
  solved. Rejected.
- **Generate at deploy, commit nowhere** — clean `main`, but loses both the provenance
  trail and the scheduled-workflow keepalive. Rejected: both were valued.
- **Commit to `main` less frequently** — reduces but does not eliminate the noise.
  Rejected: half-measure.

## References

- Spec: `docs/superpowers/specs/2026-05-29-daily-content-data-branch-design.md`
- Plan: `docs/superpowers/plans/2026-05-29-daily-content-data-branch.md`
- PR #93
