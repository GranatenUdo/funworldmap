# Architecture Decision Records

This directory holds ADRs — short documents recording genuinely load-bearing architectural decisions, especially ones that are being revisited or contested.

## Filing Convention

Filename: `NNNN-short-kebab-slug.md`, where `NNNN` is a four-digit zero-padded sequence number (`0001`, `0002`, …). The next available number wins.

Required sections:

- **Context** — the situation and forces that motivate the decision
- **Decision** — the chosen approach, stated as a present-tense fact
- **Consequences** — what becomes easy, what becomes hard, what's locked in
- **Alternatives** — other paths considered and why they were rejected
- **Status** — one of `Proposed`, `Accepted`, `Superseded by NNNN`, `Deprecated`
- **Date** — ISO 8601 date of the decision

## When to Write an ADR

Good reasons:

- A genuinely load-bearing decision is being made (framework, data layer, deployment target)
- A previously-accepted decision is being revisited
- A tradeoff needs to survive a project handoff

Poor reasons:

- Historical backfill for decisions nobody is contesting
- Documenting every minor library choice
- Replacing inline comments in code

If the decision can live as a paragraph in a system doc under `docs/systems/`, prefer that. ADRs are for decisions that need to be discoverable as decisions.

> **On the existing records.** ADRs `0001`–`0003` deliberately record foundational
> decisions after the fact, for discoverability in this showcase repository — a
> one-time exception to the "no historical backfill" guidance above. `0004` onward
> follow the guidance: written when a load-bearing decision is actually made.

## Superseding

A superseded ADR is kept in place for historical continuity. The newer ADR's Status line names the superseded record's number; the superseded record's Status is updated to `Superseded by NNNN`.
