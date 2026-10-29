# Public repository quality

Status: Accepted (2026-10-29)

## Intent
Make funworldmap a polished public project with accurate documentation, reproducible contributor setup, patched dependencies, and reliable maintenance safeguards. Preserve gameplay, visual design, MIT licensing, historical evidence, and existing user work.

## Deliverables
1. Health PR: replace all repository occurrences of the old contact email with tobias.ens@proton.me; establish Node 22.22.1 baseline; audit and patch both npm roots; migrate MapLibre to patched 6.x with map regression validation; validate Worker installation, tests and dry-run packaging in CI.
2. Documentation PR: current README screenshots, precise accessibility limitations, contributor and maintainer navigation, reconciled system docs, issue forms and support guide; tested docs checker; scheduled external links; pinned Actions and minimal permissions; aggregate checks and same-SHA CI plus CodeQL deployment gating.
3. GitHub settings: public website/description/topics, merged branch deletion, supported security features/private reports, and solo-maintainer main protection after real required contexts exist.

## Constraints and acceptance
Use Node >=22.22.1 <23 across both packages and CI. No blanket dependency force-fix, broad refactoring, new test quarantines, retry increases, unsupported compliance claims, paid service purchases, history rewrite, or application redesign. Preserve the seven-day acknowledgment aspiration and ninety-day disclosure policy. Verify clean installs, lint/types/unit/build/budget/precommit, Worker tests/dry-run/audits, four local interaction projects at two workers, and map rendering/projection/picking/attribution/hover/reveal/context recovery. CI stays Chromium-only. Report environmental or remaining validation gaps honestly.

## Review
Exactly one independent GPT-6 Astra reviewer at medium reasoning reviewed this design and plan against main d79d5a0. Incorporated corrections: Node >=22.22.1; explicit Worker validation; both CI and CodeQL required for exact deployed SHA; globe/context-loss coverage; preserve Linux browser limits; report aggregation separate from correctness; check actual Markdown links rather than illustrative paths; snapshot settings and observe check App/name before enforcement.
