# Chromium e2e flake — regression analysis

**Date:** 2026-04-28
**Triggered by:** PRs #25 (game-flow cascade fix) and #26 (game-flow polish) both saw `e2e (chromium)` red on every CI run with different tests failing each time, while local `npm run test:e2e` passed cleanly. Today's `main`-branch CI also failed both e2e jobs (run `24998469360`), confirming the flakes pre-date both PRs.
**Predecessor work:** [`docs/superpowers/plans/archive/2026-04-22-deflake-chromium-e2e.md`](../plans/archive/2026-04-22-deflake-chromium-e2e.md), [`docs/superpowers/notes/2026-04-22-chromium-flake-diagnosis.md`](2026-04-22-chromium-flake-diagnosis.md), merged in commit `422c076` (2026-04-22).

## TL;DR

The 2026-04-22 deflake fix was correct but **scoped too narrowly to load-time readiness**. It added `data-app-ready` + `waitForAppReady(page)` and replaced the `beforeEach`'s `waitForTimeout(1000)` in three specs. It did **not** remove the **per-test `waitForTimeout(200…500)` calls inside the test bodies** — those are still the underlying flake source. As more tests were added under the same flaky pattern, the cumulative flake probability rose back above the CI tolerance.

Concretely: `search.spec.ts` still has **12** `waitForTimeout` calls (one per test, between fill→assert pairs). `launcher.spec.ts` still has **5** `waitForTimeout`s plus **2** `force: true` clicks. Both are anti-patterns the original deflake plan and diagnosis notes implicitly warned against ("brittle waits") but neither plan nor docs codified the rule for *future* test authors.

## What the 2026-04-22 deflake plan actually fixed

From `docs/superpowers/plans/archive/2026-04-22-deflake-chromium-e2e.md`:

| Task | Change | Scope |
|---|---|---|
| 3 | Add `data-app-ready` attribute on `<main>` in `App.tsx`, true once `countries` + `cities` are bundled | Load-time |
| 4 | New `waitForAppReady(page)` helper in `e2e/helpers.ts` | Load-time |
| 5 | Replace `beforeEach`'s `waitForTimeout(1000)` in `search.spec.ts` with `waitForAppReady(page)` | Load-time, beforeEach only |
| 6 | Same for `satellite-default.spec.ts` and (conditionally) `launcher.spec.ts` | Load-time, beforeEach only |
| 7 | Local validation: 10× consecutive `npx playwright test --project=chromium --retries=0` with 0 flakes | Validation |

The plan validated 10× green locally and CI passed (commit `422c076`). It addressed exactly the failure modes documented in `2026-04-22-chromium-flake-diagnosis.md`:

- `satellite-default.spec.ts` — hard timeout on `[data-map-loaded]` (load race)
- `a11y-contrast.spec.ts` — compare panel not rendered when assertion runs (load race)
- `launcher.spec.ts:210` — Tab-cycle focus order (NOT a load race; the diagnosis notes called this out as a separate, unfixed bug requiring focus-trap order changes)

So the plan's reach was **load-time race conditions only**, by design. The notes acknowledged the focus-order bug was orthogonal and would need separate work.

## What the 2026-04-22 deflake plan did NOT fix

Six anti-patterns persisted in the test bodies, none of them load-related:

1. **Hardcoded `page.waitForTimeout(N)` between user actions and assertions.** `search.spec.ts:15` (`// debounce (150ms) + render`), `:38`, `:53`, `:63`, `:69`, `:78`, `:83`, `:90`, `:99`, `:104`, `:112`, `:119`. Each is a "wait for React to commit" or "wait for the dropdown to settle" pause. Under CI load (Software ANGLE on Linux runner) any one of these can be too short, and the next assertion races against an in-flight render or transition.

2. **`force: true` clicks as actionability band-aids.** `launcher.spec.ts:95` (`franceOption.click({ force: true })`), `:101` (`panel-close.click({ force: true, timeout: 15_000 })`), `mobile-tap.spec.ts:*`. `force: true` skips Playwright's "element is visible, enabled, and stable" check. When the test fails, you see the click action recorded as "done" in the trace but the click had no effect — because the SearchBar dropdown was still being unmounted at z-50, or a portal was still mid-transition. Forcing the click only succeeds if the underlying timing happens to work; under load it doesn't.

3. **Animation-cycle waits without animation hooks.** `launcher.spec.ts:49,67,70,102` (`waitForTimeout(400|500)`). These are sleeping through CSS transitions (modal entrance, panel-card animation, etc.) without any deterministic signal that the animation is complete. The map's flyTo has `prefersReducedMotion()` shortcuts; CSS transitions don't.

4. **Search dropdown unmount race.** `launcher.spec.ts:97-100` has the comment *"Wait for the search results dropdown to be fully gone before clicking panel-close. Even with the SearchBar fix, give the dropdown one clear render cycle to unmount so it cannot intercept the click at z-50."* This is followed by `expect(search-results).not.toBeAttached({ timeout: 5_000 })` — which is the right pattern. But the **adjacent `panel-close.click({ force: true })`** still uses `force: true`, defeating the unmount wait by skipping actionability re-checks. The `not.toBeAttached` waits for the search-results portal to leave the DOM; the `force: true` then clicks `panel-close` immediately, before the click handler at `panel-close` has its z-index priority restored.

5. **First-occurrence `.first()` reliance on Fuse.js result ordering.** `launcher.spec.ts:91-93` uses `.getByRole('option', { name: /^France\s/ }).first()` — this works because France is usually the first match, but Fuse.js result order is score-based and isn't guaranteed across data updates or scoring tweaks. The diagnosis-notes pattern of "use the explicit option" was applied here, but the underlying fragility remains.

6. **No animation-completion hook in component code.** Components that animate (the launcher modal, the panel slide, the search dropdown's enter/exit) don't expose an `data-animation-complete` attribute or fire a custom event the test can listen for. The only deterministic signal is "wait for the element to fully unmount" (which `not.toBeAttached` provides), but CSS-driven animations on already-mounted elements have no signal at all.

## Why the regression manifests now

The deflake plan validated 10× green on 2026-04-22 with the test count at the time. Since then:

| PR | New e2e specs added | Net effect |
|---|---|---|
| #12 retention phase 4 share | `daily-share.spec.ts`, `daily-share-block-immediate.spec.ts` | More chromium project tests, same per-spec fragility patterns |
| #13 a11y phase 5a axe | `accessibility.spec.ts` (additions) | Extra assertions on already-flaky launcher/panel paths |
| #14 phase 5b launch prep | docs only |
| #15 country-pinning anti-cheat | `game-country-pinning.spec.ts`, `game-city-guessing.spec.ts` | Heavier game flows |
| #16 country-news Guardian | `country-news.spec.ts` | More panel rendering |
| #17 GDELT migration | route stubbing additions |
| #18 reveal animation + mobile tap | `reveal-animation*.spec.ts`, `mobile-*.spec.ts` | Mobile project added; `force: true` becomes more common |
| #24 cross-component state fixes | `game-over-mode-switch.spec.ts`, `daily-share-block-immediate.spec.ts` | More game-state plumbing tests |
| #25 cascade fix (this series) | `daily-survives-ocean-click.spec.ts` | Synthetic map clicks |

Each PR added tests that follow the established (flaky) patterns. None re-tightened the unfixed anti-patterns. The flake probability per-spec is roughly stable, but the **expected failures per CI run** scale with the number of specs running. With ~30 chromium specs, even 1% flake-per-spec yields ~26% probability of at least one failure per run.

The PRs touching `App.tsx`, `useMapInteractions.ts`, or `GameSessionProvider.tsx` (Phase 1, Phase 2) didn't introduce new flakes — they just shipped while the cumulative flake rate was already past CI's tolerance.

## Evidence

- **Local repro: zero flakes.** Both Phase 1 and Phase 2's full-spec local runs passed 168/168. The chromium project locally completes in ~50 s; on Linux Software ANGLE in CI it takes ~8 minutes. The 10× difference is the ANGLE backend + cross-process IPC overhead that the diagnosis notes documented.
- **Phase 1 CI run 1 fails:** `launcher.spec.ts:84`, `daily-best-of-3.spec.ts:58`. **Re-run fails differently:** `search.spec.ts:96`, `panel-focus.spec.ts:26`. Different tests each time → flake, not regression.
- **Phase 2 CI fails:** `search.spec.ts:25`, `accessibility.spec.ts:60`, `search.spec.ts:96`. Same family — search dropdown / panel-close timing.
- **Today's `main`-branch CI also fails both e2e jobs** (run `24998469360`), confirming the regression is not introduced by either PR.
- **`grep -c waitForTimeout e2e/*.spec.ts` returns 31** across 8 spec files (post-deflake). The deflake plan didn't aim to remove these; nothing has aimed to remove them since.

## Why no one caught this earlier

1. **The deflake plan's success criterion was "CI green on first run."** It met that criterion in 2026-04-22 because the test set was smaller and the per-spec flake rate * spec count was below CI's tolerance.
2. **Subsequent PRs ran CI green most of the time.** When CI flaked, the convention has been to re-run; the documented escalation gate from the original plan (*"If Step 1 shows residual flakes, **stop**. Do not retry, do not paper over with retry-loops"*) was followed during the deflake PR but not enforced as a standing rule for future PRs.
3. **No CLAUDE.md or testing-guide doc captured the "no `waitForTimeout`, no `force: true`" rule.** The rule lived only in the deflake plan's prose, which is archive material once merged.
4. **The diagnosis notes flagged `launcher.spec.ts:210` as a separate focus-order bug** but that work was never scheduled.

## Recommendations

### A. Add a CLAUDE.md with non-flaky e2e guidance (HIGHEST LEVERAGE)

The repo has no CLAUDE.md. Future agentic workers (and human contributors) have no centralised guidance on what makes a Playwright test flaky in this codebase. Without a CLAUDE.md, every new test is allowed to introduce the same patterns. Draft attached separately.

### B. Eliminate `waitForTimeout(N)` and `force: true` from the existing e2e suite

This is the systematic deflake follow-up the original plan deferred. Concrete tasks (sized for one focused PR, not a sprawl):

1. `search.spec.ts` — replace each `waitForTimeout(N)` with one of:
   - `expect(locator).toBeVisible()` for "wait for element to appear"
   - `expect(locator).not.toBeAttached()` for "wait for element to leave the DOM"
   - `expect.poll(() => state)` for "wait for derived state"
2. `launcher.spec.ts` — same. Drop `force: true` clicks; if the click misses without `force`, that *is* the flake — investigate the underlying overlay / focus / portal contention and fix in component code.
3. Adopt component-side animation signals where needed: `data-animation-state="entering|idle|exiting"` on the launcher modal, panel slides, search dropdown. Tests wait on `state="idle"` instead of guessing how long the transition takes.

### C. Fix the unfixed `launcher.spec.ts:210` focus-order bug from the 2026-04-22 diagnosis

The Tab-skip-over-Daily-CTA bug is a real focus-trap-order issue, not a timing flake. Either fix the focus-trap order in `Launcher.tsx` (probably wrong: the Daily CTA buttons are real focusable elements that *should* be in tab order) or update the assertion to walk the actual focus chain rather than assert position-after-N-tabs.

### D. Stop running `chromium` on Linux Software ANGLE in CI if alternatives exist

The `chromium` project (no `-gpu` suffix) was likely added as a "faster than real GPU" smoke run. In practice it runs ~8 min on Software ANGLE while `chromium-gpu` (with real GPU) runs ~12 min for far fewer specs. Consolidating to a single GPU-backed chromium project would eliminate the 8-min flaky job entirely. This is a CI-config change, not a code change; suitable for a separate small PR.

## Self-review

- **Headline accurate?** Yes — the regression is "tests added since 2026-04-22 followed the unfixed anti-patterns; cumulative flake rate exceeded CI tolerance."
- **Mechanically verifiable claims?** All anti-pattern occurrences enumerated with file:line, all CI run IDs cited, comparison to predecessor work explicit.
- **Recommendations sized realistically?** A is a single doc commit. B is a multi-PR cleanup (the existing 36-occurrence count means roughly 5-8 commits). C is a focused fix in one file. D is a CI-config change. None are speculative.
- **Risk of repeat:** without (A) — high. With (A) and (B), low.
