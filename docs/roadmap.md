# Roadmap — Deferred Work

Running list of items deliberately deferred from shipped specs, grouped by area. Each item cites the spec that deferred it so the rationale is recoverable.

This is **not** a product backlog — it's a parking lot for ideas that were scoped out during brainstorming. Promote an item to a spec (and link back here from that spec) when the time is right to build it.

## How to use this doc

- When a spec calls out out-of-scope items, add them here with a back-link to the source spec.
- When picking up an item, open a spec under `docs/superpowers/specs/`, cross-reference this roadmap, and strike the item out here with the spec link.
- Don't add items that are already implemented, already scheduled, or that nobody has proposed. This file is for intentional deferrals only.

---

## Games

### Country Pinning mode

Source: [`2026-04-18-satellite-default-and-game-modes-design.md`](superpowers/specs/2026-04-18-satellite-default-and-game-modes-design.md)

- **Share-score image / OG card / tweet card** — generating a social-media preview after a good game.
- **Sound effects** — audio for correct/wrong guess, game over.
- **Multiplayer or online leaderboard** — would require a backend; conflicts with the no-backend principle.
- **Region / difficulty filters for the country pool** — "Europe only", "UN member states only", etc.
- **Neighbour-graph scoring bonus** — adjacency-based partial credit (clicking Portugal when target is Spain scores higher than distance alone implies).
- **i18n of game strings** — English only for v1; strings are routed through each mode's `messages.ts` to enable a mechanical swap later.
- **Mode-picker expansion beyond a single item** — superseded by the City Guessing spec below.

### City Guessing mode

Source: [`2026-04-19-city-guessing-mode-design.md`](superpowers/specs/2026-04-19-city-guessing-mode-design.md)

- **Region / difficulty filters** — "Europe only", "Capitals only", "Africa only".
- **Multiplayer or online leaderboard** — same no-backend constraint as Country Pinning.
- **Share-score image / OG card** — post-game social preview.
- **Sound effects** — audio feedback for guesses and game-over.
- **i18n of game strings** — English-only; wired through `messages.ts` for future swap.
- **Adjustable round count** — fixed at 10 in v1.
- **Population / tooltips / metadata on the reveal marker** — clicking the correct-city marker could open a tooltip with population, country-panel link, etc.
- **Per-round timer** — e.g. "You have 15 seconds to guess."
- **Difficulty tiers** — beginner pool of ~50 capitals, hard pool of lesser-known cities.
- **Camera animation knob** — user-facing slider beyond the `prefers-reduced-motion` branch.
- **Reveal marker animation** (pulse / breathing effect) — v1 uses a static warm-accent circle. Can land later without framework changes.
- **Runtime country-data join for `cities.json`** — v1 inlines country name + flag path per city (~25 KB overhead) for simplicity. If `cities.json` grows, switch to joining against `countries.json`'s `byCca3` at load time.

## Satellite basemap

Source: [`2026-04-18-satellite-default-and-game-modes-design.md`](superpowers/specs/2026-04-18-satellite-default-and-game-modes-design.md)

- **Persist the user's toggle choice in `localStorage`** — v1 resets to satellite-default on each fresh visit.
- **Loading skeleton / shimmer for first satellite-tile load** — not built because MapLibre handles partial-load gracefully in practice.
- **Swap to a commercially-licensed tile source if the site ever monetises** — EOX Sentinel-2 is CC BY-NC-SA 4.0; acceptable today, blocks future monetisation without a swap.

## Build / CI

Source: [`2026-04-16-fix-ci-bugs-and-perf.md`](superpowers/plans/2026-04-16-fix-ci-bugs-and-perf.md) (plan) and the 2026-04-18 PR.

- **Network-stubbed tile mocks for e2e** — removes external-network variance. Worth doing after CI stabilises if residual flake appears.
- **Bundle-size budgets in CI** — `size-limit` or similar to catch silent regressions.
- **Chromium-gpu project on self-hosted runner** — the current GPU project runs under `--use-gl=angle` on shared Ubuntu runners without a real GPU; several tests are effectively SwiftShader-only. A self-hosted runner with a GPU would unlock the full suite.

---

## Rejected (won't build)

Nothing here yet. Items that were considered and explicitly rejected (not just deferred) would go here with a one-line reason.
