# 3. Single useGameSession reducer with a discriminated-union action set

**Status:** Accepted
**Date:** 2026-05-30 (records a decision made during the retention-v1 build)

## Context

The game spans modes (country-pinning, city-guessing) and a daily best-of-N layer,
with non-trivial state: lives, score, streak, round index, per-round attempts, the
daily date, and round outcomes. Transitions must stay consistent — e.g. the score
and the reveal animation must always agree on the best attempt.

## Decision

Model the session as a single `useReducer` in `src/game/shared/useGameSession.ts`
with a **discriminated-union action set**: `start | attempt | completeNow | resume |
advance | overrideRound | endGame | finishFree | finalize | restart`. The reducer is
a pure function; modes plug in through the `GameMode` contract; orchestration (timers,
reveal effects, persistence) lives outside the reducer in `GameController` and hooks.

## Consequences

- Transitions are pure and unit-testable in isolation; cross-cutting invariants (e.g.
  best-of-N derivation) live in one place.
- Atomic multi-effect transitions are expressible — e.g. `restart` collapses
  endGame+start into one dispatch to avoid an intermediate `idle` render (the fix for
  bug #32, the game-over → hash-mode-switch race).
- Side-effect choreography stays outside the reducer, which keeps it pure but spreads
  timing logic across the controller/hook layer.

## Alternatives

- **Multiple `useState` values** — state scatters and invariants become hard to keep
  consistent across transitions. Rejected.
- **A state-machine library (e.g. XState)** — formal and expressive, but adds a
  dependency and conceptual overhead disproportionate to a state set this size.
  Rejected: a plain reducer suffices (YAGNI).
