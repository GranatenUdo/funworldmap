# MapLibre security migration budget addendum

Status: Accepted by the user on 2026-10-29; independently reviewed by GPT-6 Astra at medium reasoning (the original plan reviewer).

## Goal and constraints
Allow the patched MapLibre 6.4.1 migration while retaining explicit bandwidth accounting. This is the separate measurement-only PR required by the existing budget policy. It precedes the health PR and documentation PR; none is merged or deployed automatically.

## Measurement evidence
Measurements came from `npm run bundle:budget` on the isolated Node 22.22.1 health checkout. The initial log predates the classifier update: combined totals below are calculated from the emitted assets, not claimed as a passing checker run. The health PR includes the worker classifier and verifies the integrated totals again.

| Gzip asset/category | Bytes |
| --- | ---: |
| Main application JS | 444852 |
| Separately emitted MapLibre worker | 130099 |
| Initial JS including worker | 574951 |
| CSS | 22435 |
| Initial total | 597386 |
| Asynchronous countries | 233015 |
| Other lazy JS | 2425 |
| Full session total | 832826 |

MapLibre 6.16.0 measured larger (488661 main JS + 148199 worker bytes). Use an exact 6.4.1 pin in the health PR, which is the first patched release for GHSA-jrc7-96c5-q579. Both dependency audits must remain clean.

## Implementation plan
1. Commit this addendum before changing thresholds.
2. Raise only main-JS 540000 → 640000, initial-total 560000 → 660000, and total-with-async 820000 → 920000. This provides approximately 10–11% headroom over measured totals.
3. Keep lazy-JS, CSS, and country-data limits unchanged. Clarify that separately emitted workers count toward initial JS; they were embedded in the v5 main bundle.
4. Validate this independent PR on its main baseline, and validate the integrated health build with tests asserting worker inclusion in all three affected rows.
5. Deliver budget → health → documentation as separate reviewable PRs. CI runner fixes remain in the health PR; any pre-existing main runner failure is reported rather than hidden in this budget-only change.

## Review disposition
Reviewer corrections accepted: exact 6.4.1 pin, calculated totals labelled honestly, and assertions on main-JS plus both aggregate rows. No redesign or further plan reviewer needed.
