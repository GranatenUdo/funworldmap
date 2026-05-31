# 2. URL hash as the single source of truth for selection and routing

**Status:** Accepted
**Date:** 2026-05-30 (records a decision made at project inception)

## Context

The app must support deep-linkable country selection (e.g. `#FRA`), shareable game
routes (`#game/<mode>`), and working browser back/forward — all on a static host with
no server-side routing.

## Decision

The **URL hash is the single source of truth** for the current selection and route.
Every entry point — map click, search result, border chip, initial page load —
writes the hash; all consuming components react to `hashchange`. There is no parallel
in-memory selection state that can diverge from the hash. Parsing and serialization
live in `src/lib/hashState.ts` (`parseHash` / `writeHash`).

## Consequences

- Deep links, sharing, and back/forward all work with no extra machinery.
- Discipline cost: every new way to select/route must converge on the hash rather
  than holding its own state (see `docs/systems/overview.md` § Selection Flow).
- Routing is hand-rolled string parsing rather than a router library — minimal
  surface, but the parsing rules live in one module that must stay authoritative.

## Alternatives

- **React state/context only** — simplest in-app, but no deep-linking, sharing, or
  back/forward. Rejected: deep links are a product requirement.
- **A router library (e.g. React Router)** — designed for path-based routing and
  heavier than needed for a single-page static map keyed on a hash. Rejected: YAGNI.
