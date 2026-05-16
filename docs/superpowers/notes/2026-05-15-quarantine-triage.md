# E2E Quarantine Triage — 2026-05-15

Documents the 4 active `test.fixme(!!process.env.CI, '<issue>')` quarantines in the e2e suite, with diagnosis and resolution paths. Produced as Phase 6 of the 2026-05-15 cleanup plan (`docs/superpowers/plans/2026-05-15-repository-cleanup-presentability.md`).

User constraint guiding this triage: **exclude GPU runner from CI pipelines — verify GPU paths locally only**. The CI baseline stays on ubuntu-latest's headless ANGLE renderer with `reducedMotion: 'reduce'` and 4-shard parallelism. Suggested fixes below respect this constraint.

---

## Issue #60 — daily-streak milestone-dismiss exceeds 5s budget on CI

**Status (2026-05-16):** **RESOLVED** in this PR (latest-value-ref fix in `LauncherMilestoneOverlay`).

**Tests:**

- `e2e/daily-streak.spec.ts:52` — `milestone overlay auto-dismisses and persists lastMilestoneShown`

**Symptom on CI:**
The 5000ms `not.toBeAttached` budget after `waitForAnimationIdle` was insufficient on ubuntu-latest's headless ANGLE renderer under 4-shard load. Reproduced 3/3 on CI; passed consistently locally. The milestone overlay simply stayed in the DOM well past the 2500ms auto-dismiss timer.

**Root cause** (diagnosed 2026-05-16):
`LauncherMilestoneOverlay`'s `useEffect` for the auto-dismiss timer included `onDismiss` in its deps array. The parent (`Launcher`) wraps `onMilestoneDismiss` in `useCallback([markMilestoneShown])` where `markMilestoneShown` comes from `useDailyHistory()`. Every parent re-render during the 2500ms dismiss window — common on CI under 4-shard load due to other state changes (analytics events firing, history rehydration, parallel mode-card state computation) — invalidates `markMilestoneShown` identity, which invalidates `onMilestoneDismiss` identity, which fires the milestone's effect cleanup (clearing the 2500ms timer) and reschedules a fresh 2500ms timer. The clock resets multiple times within the window, blowing past the test's 5s `not.toBeAttached` budget.

**Fix applied:**
Latest-value-ref pattern in `LauncherMilestoneOverlay.tsx`: store `onDismiss` in a `useRef` updated each render, drop `onDismiss` from the effect's deps array. The timer is committed once at mount and fires after 2500ms regardless of parent re-renders. The fix is also more correct as a component contract: the consumer should not be able to delay or extend the auto-dismiss window by changing the callback identity.

The unit tests in `src/components/__tests__/LauncherMilestoneOverlay.test.tsx` continue to pass unchanged — they only exercise the on-mount behavior (analytics fire, 2500ms `vi.advanceTimersByTime` dismissal, click dismissal), none of which depend on the dropped dep.

---

## Issue #47 — animation-interrupt 3 tests collapse under reducedMotion

**Status:** **TRIAGED** — needs per-test reducedMotion override (~30 min).

**Tests:**

- `e2e/animation-interrupt.spec.ts:25` — `rapid Continue click during panel slide-in (wrong guess)`
- `e2e/animation-interrupt.spec.ts:50` — `Escape mid-reveal (correct guess) skips the hold and advances to next round`
- `e2e/animation-interrupt.spec.ts:76` — `Escape mid-panel-slide-in (wrong guess) skips the hold and advances`

**Symptom on CI:**
Each test asserts an intermediate animation state — `data-animation-state="entering"` on the country panel, or polls for `status === 'round-ended'` while the reveal hold is in flight. Under CI's `reducedMotion: 'reduce'` baseline (set globally on the chromium project in `playwright.config.ts` for flake reduction), the panel mounts with animations effectively zero-duration; the state goes mount → `idle` without an observable `entering` phase. Tests time out at the 5s `toHaveAttribute('data-animation-state', 'entering')` assertion.

**Root cause:**
The tests target real "animation interruption races" — pressing Escape or Continue mid-animation to verify the abort path produces a clean, non-half-rendered state. The CI environment can't observe the intermediate state because the animations don't run at observable speed. The helper `startCountryPinningWithFRA` already attempts `page.emulateMedia({ reducedMotion: 'no-preference' })`, but MapLibre caches the `prefers-reduced-motion` value at first read; the override doesn't propagate to React's CSS animation system in time on slow CI.

**Suggested fix shapes** (pick one; not in scope for this PR):

1. **Set reducedMotion in test-level `use` context** instead of mid-test `emulateMedia`. Add a `test.use({ reducedMotion: 'no-preference' })` at the top of `test.describe('Animation interrupt …')` so the browser context is created with the override, not patched mid-test. The animations run at real speed throughout the test, the `entering` state is observable. Tradeoff: these specific tests are now NOT testing the reduced-motion path, but the reduced-motion behavior is already covered by `reveal-animation-reduced-motion.spec.ts` which is in the chromium project's testMatch. **Recommended.**
2. **Rewrite to assert end-state only** — don't observe `entering` at all. Assert that pressing Escape during the entrance produces the same final state as pressing Escape after entrance. Probably doesn't catch the bug class these tests target (interruption races): the whole point is observing that no half-rendered state is committed when the abort fires during the animation. End-state assertions can't distinguish "no half-render committed" from "half-render committed but corrected by the next render".
3. **Accept permanent quarantine** — convert `test.fixme` → `test.skip` and document in CLAUDE.md as a known local-only test. Keeps the test runnable locally for diagnosis, makes the CI suppression visibly permanent. Use this only if option 1 doesn't work.

**Recommendation:** Option 1 (test-level `use({ reducedMotion: 'no-preference' })` override). ~30 min total to apply + verify locally + push.

---

## Issue #32 — game-over-mode-switch wall-clock budget exhaustion

**Status:** **TRIAGED** — needs pre-hash sequence to be driven by a test seam (2-4 hrs).

**Tests:**

- `e2e/game-over-mode-switch.spec.ts:26` — `hash-changing to a different #game URL during game-over starts the new mode`

**Symptom on CI:**
The atomic-restart reducer fix (commit 3ad9055) addressed the post-hash race that originally motivated the quarantine. The test still exhausts its 60s budget on chromium CI — but **upstream** of the hash-change assertion. The pre-hash setup runs a 3-iteration for-loop of `submitAndWait('USA', 1)` + status poll for `round-ended` + `Escape` + status poll for `playing`, plus `finalizeGame`, plus the `game-over` visibility assertion. On workers=2 under CI load, this accumulates more wall-clock latency than the 60s budget allows.

**Root cause:**
Not a reducer race — a test-budget shape issue. The setup is UI-driven (3 × full round trip with two intermediate state polls each), wall-clock-bounded by the round-ended hold and React render commits. Under CI the per-iteration cost is large enough that the 60s `test.setTimeout` runs out before the test even reaches its actual assertion (line 86, the post-hash modeId/status poll).

**Suggested fix shapes** (pick one; not in scope for this PR):

1. **Drive the pre-hash sequence via a single test-seam call.** Expose `__funworldmap_game.forceGameOver()` (or similar) in `GameController.tsx` under `VITE_TEST_HOOKS`. The test calls it once, the reducer transitions straight to `status: 'game-over'` without 3 wall-clock-bounded UI roundtrips. Most reliable; eliminates the budget problem at root. **Recommended.**
2. **Raise `test.setTimeout` to 120s.** Trivial change; assumes the 60s budget is just too tight. Risk: doesn't fix the underlying problem; future CI degradation re-flakes the test at 120s. Use only if option 1 is infeasible.
3. **Reproduce with `--workers=2` locally + trace** to confirm the actual time breakdown before committing to a fix shape. Either of (1) or (2) becomes defensible after this.

**Recommendation:** Reproduce first (option 3, ~30 min), then option 1 (~1.5-3 hrs). Total 2-4 hrs.

---

## Issue #31 — launcher panel-close click intercepted on CI

**Status:** **TRIAGED** — likely needs reduced per-test browser load OR test rewrite (1-2 hrs).

**Tests:**

- `e2e/launcher.spec.ts:78` — `dismissing + closing a country panel does NOT re-show launcher`

**Symptom on CI:**
Even after the className-based animation migration + Playwright `reducedMotion: 'reduce'` (commit 5394abc), CI compositor pressure (10MB geojson load, parallel workers) defeats Playwright's bounding-box stability check on the `panel-close` click. The panel mounts, data renders, animations are 0.01ms — but the click action never sees a "stable" frame within `actionTimeout`. The test fails at `await page.getByTestId('panel-close').click()` with an actionability timeout.

**Root cause hypothesis:**
The CI environment's headless ANGLE renderer (Software, no GPU) produces compositor frames at unreliable intervals under parallel-worker load. Playwright's actionability check requires two consecutive same-position frames; on CI the panel's bounding box never sits still for the required number of frames before Playwright gives up. The animations themselves are gone — the issue is downstream of the animation, in the frame-production pipeline. GPU-runner unblock is **NOT** on the table per user direction.

**Suggested fix shapes** (pick one; not in scope for this PR):

1. **Rewrite to state-assertion, not click-driven dismissal.** What the test really checks: closing the country panel after dismissing the launcher must NOT re-show the launcher. Express that as a state assertion using existing test seams — call a dismiss test-seam if one exists, or wire one in `SingleCountryPanel.tsx`, then assert `launcher` is not attached. Eliminates the click actionability dependency. **Recommended.**
2. **Reduce per-test browser load.** Stub `routeMapTiles(page)` so the basemap doesn't hit the network, and verify the geojson is being served from the test fixture not a fresh fetch. If the test was already doing both, this is a no-op. Otherwise ~15 min.
3. **Accept permanent quarantine.** Convert `test.fixme` → `test.skip` and document the test as local-verification-only in CLAUDE.md. Acceptable if option 1 turns out to require substantial component changes for limited assertion value (this test is one of several covering the launcher dismiss path).

**Recommendation:** Option 1 first (~1-1.5 hrs). Option 3 as fallback (~10 min) if option 1 reveals the test is duplicative of `Launcher — session scope` coverage elsewhere.

---

## Recommendation summary

| Issue | Estimated effort | Suggested path                                                         |
| ----- | ---------------- | ---------------------------------------------------------------------- |
| #60   | DONE (this PR)   | Latest-value-ref fix shipped; quarantine removed                       |
| #47   | ~30 min          | Per-test-describe `test.use({ reducedMotion: 'no-preference' })`       |
| #32   | 2-4 hrs          | Reproduce + trace, then `forceGameOver` test seam                      |
| #31   | 1-2 hrs          | Rewrite to state-assertion via test seam (recommended), or `test.skip` |

No GPU-runner work is required for any of the above; all paths stay on the current ANGLE software-renderer CI baseline.
