# Post-audit verification — 2026-05-05

Phase 2 of the vision-audit remediation plan. Each section captures the result of a verification step.

## 2.1 — axe-core sweep

Spec: `e2e/axe-snapshot.spec.ts` — collect-not-fail (baseline, not a build gate).
Run: 2026-05-05, chromium project (real-GPU ANGLE), `reducedMotion: reduce`.
All 5 tests passed in 11 s.

### Cold launcher

Tested at: `/` with cleared localStorage, daily content stubbed to `FRA/FRA-paris` for today.

No violations.

### In-game HUD

Tested at: `/#daily/<today>/country-pinning`, after one country guess (mid-game, attempt 2 of 3 visible in the HUD).

| Rule | Impact | Count | Brief |
|---|---|---|---|
| `aria-prohibited-attr` | serious | 1 | `aria-label` attribute cannot be used on a `<div>` with no valid role attribute |

**Offending element:** `<div class="flex gap-1.5" aria-label="Attempt 2 of 3">`

The HUD attempt-indicator row uses `aria-label` on a plain `<div>` to describe the current attempt number to screen-reader users. ARIA 1.2 prohibits `aria-label` on elements that do not have an implicit or explicit ARIA role (generic `<div>` has role `generic`, which is in the prohibited list). Fix: add `role="group"` (or use `<fieldset>`/`<p>`) so the labelling attribute is permitted.

**Suggested fix:** `<div role="group" class="flex gap-1.5" aria-label="Attempt 2 of 3">` or convert to a `<p aria-live="polite">` that announces the attempt count.

### Country panel open

Tested at: `/#FRA`.

No violations.

### Game-over modal

Tested at: `/#daily/<today>/country-pinning`, driven to game-over via three guesses + `finalizeGame()` seam.

No violations.

### Reveal modal

Tested at: `/#daily/<past>/reveal` (3 days prior, history seeded for `country-pinning` mode).

No violations.

---

### Summary

| State | Violations | Highest impact |
|---|---|---|
| Cold launcher | 0 | — |
| In-game HUD | 1 | serious |
| Country panel open | 0 | — |
| Game-over modal | 0 | — |
| Reveal modal | 0 | — |
| **Total** | **1** | **serious** |

The single finding (`aria-prohibited-attr` on the HUD attempt-indicator row) is isolated to the in-game surface and has a straightforward fix. No `critical` violations were found across any of the five states.

## 2.2 — Cross-browser parity

(Pending.)

## 2.3 — Production daily-index check

Live `/daily/index.json` window ends 2026-05-04 (today is 2026-05-05). Generated at 2026-05-04T08:42:44Z. One day behind today's date, within tolerance for the ~6h GHA cadence. No action needed.

## 2.4 — Real-browser share toast (deferred)

Needs human-in-the-loop verification. Phase 1.6 raised Toast z-index above modals; theory: `dispatchToast('Copied!')` from clipboard fallback now renders above the game-over modal. Confirm by playing a daily in real Chrome and clicking Share.

## 2.5 — Label-contrast measurement

(Pending.)
