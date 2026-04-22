# Chromium e2e flake — diagnosis notes

**Date:** 2026-04-22
**Spec:** ../specs/2026-04-22-retention-v1-finishing-design.md §A

## Local reproduction

- Runs executed: 3 (scope tightened from 10 for time)
- Runs that flaked: 2 of 3 (runs 2 and 3 identical; run 1 had 1 failure, runs 2–3 had 3 failures each)
- Traces captured: `test-results/satellite-default-Satellit-68fe6-le-is-pressed-on-first-load-chromium/`, `test-results/launcher-Launcher-—-access-7cf60-e-card-2-dismiss-link-wraps-chromium/`, `test-results/a11y-contrast-A11y-Contras-78cd3-lumn-region-badges-are-11px-chromium/`

## Findings

- **`satellite-default.spec.ts:7` — hard timeout on `[data-map-loaded]`:** The page snapshot in the error context shows the map loaded but triggered an "We couldn't load the map" error alert. `waitForSelector('[data-map-loaded]')` times out when the map load fails under SwiftShader rendering pressure. This is the canonical readiness-signal failure: no `data-app-ready` / `data-map-loaded` attribute is emitted reliably, leaving the test to hit the 60 s timeout.
- **`launcher.spec.ts:210` — Tab-cycle focus assertion fails:** After `freshTab`, the initial focus on `launcher-card-country-pinning-free-link` is confirmed, but the next Tab press lands somewhere other than `launcher-card-city-guessing-free-link`. Page snapshot shows the launcher dialog is open and both mode-card buttons are present, suggesting focus is drifting to an intermediate focusable element (likely a Daily CTA button inside the first card) before reaching the second card's free-link. This is a pre-existing focus-order bug exposed more reliably under parallel workers, not a pure timing flake.
- **`a11y-contrast.spec.ts:28` — compare-column region badge count is 1, not >=2:** After clicking "Compare with another country" then "Germany", the compare column renders but only 1 `region-badge` is found. This indicates the compare panel is not fully rendered when the assertion runs — a missing readiness wait after the compare action. This test ran cleanly in run 1 (likely timing luck) and failed in runs 2–3.

## Conclusion

Primary cause is two distinct issues: (1) the missing map-readiness signal (`data-map-loaded` / `data-app-ready`) causes `satellite-default` and `a11y-contrast` timeouts/races — the readiness fix in Tasks 3–6 is necessary and should address these; (2) `launcher.spec.ts:210` is a pre-existing focus-order bug (Tab skips over Daily CTA buttons) that the readiness fix will not resolve and needs a separate fix to either the focus-trap order or the test assertion.
