# CLAUDE.md — funworldmap repository conventions

This file is read automatically at the start of any Claude Code session in this repo. It captures load-bearing conventions whose violation has historically caused regressions.

If you find yourself wanting to do something this file forbids, **stop and ask** — the rule probably exists because someone burned a day debugging the failure mode it prevents.

## Project documentation

| Doc                                                    | What it covers                                       |
| ------------------------------------------------------ | ---------------------------------------------------- |
| [`docs/purpose.md`](docs/purpose.md)                   | What funworldmap is, audience, scope                 |
| [`docs/systems/overview.md`](docs/systems/overview.md) | Architecture, data flow, error handling              |
| [`docs/systems/testing.md`](docs/systems/testing.md)   | Two-tier test strategy (DOM + map-via-page.evaluate) |
| [`docs/superpowers/specs/`](docs/superpowers/specs/)   | Design docs (per-feature, dated)                     |
| [`docs/superpowers/plans/`](docs/superpowers/plans/)   | Implementation plans (per-feature, dated)            |

When you start a non-trivial change, write the spec/plan first; commit before code. See `docs/superpowers/README.md` for the workflow.

## Writing e2e tests that don't flake on CI

`e2e/` runs against four Playwright projects: `chromium` (ANGLE — real GPU locally; GitHub-hosted CI has no GPU and falls back to software rendering), `mobile-chromium`, `mobile-webkit`, `desktop-firefox-touch`. The `chromium` project was consolidated from a previous `chromium` + `chromium-gpu` split when Software ANGLE was dropped on 2026-05-02 — it had been the documented largest contributor to the chromium e2e flake regression (see `docs/superpowers/notes/2026-04-28-flake-regression-analysis.md`). The rules below exist because every test that violates them has caused a CI flake.

### Forbidden patterns

**❌ `page.waitForTimeout(N)`** — sleeping for a magic number of milliseconds. Symptoms: tests pass locally, fail intermittently in CI, comments like `// debounce + render` or `// give the dropdown a render cycle`. Replace with explicit state waits:

```ts
// ❌ Don't
await searchInput.fill('France')
await page.waitForTimeout(300) // wait for dropdown
await page.keyboard.press('Enter')

// ✅ Do
await searchInput.fill('France')
await expect(page.getByTestId('search-results').getByRole('option').first()).toBeVisible()
await page.keyboard.press('Enter')
```

**❌ `click({ force: true })`** as a band-aid for actionability errors. Symptoms: a comment near the click saying "force-click because dropdown was intercepting", or the test passing only when re-run. `force: true` skips Playwright's "element is visible, enabled, stable" checks — it papers over the real problem (an overlay, an animation, a portal still in transition). When `force: true` is needed, the timing of the underlying overlay/animation is the bug.

```ts
// ❌ Don't
await page.getByTestId('panel-close').click({ force: true })

// ✅ Do
await expect(page.getByTestId('search-results')).not.toBeAttached() // the overlay
await page.getByTestId('panel-close').click() // now safe
```

**❌ Sleeping through CSS transitions.** A `transition: opacity 300ms` or `animation: fade-in 260ms` is wallclock-non-deterministic on slow CI. Don't `waitForTimeout(400)` to ride out an animation:

```ts
// ❌ Don't
await page.getByTestId('launcher-dismiss').click()
await page.waitForTimeout(500) // wait for fade-out

// ✅ Do — wait for the element to actually leave the DOM
await page.getByTestId('launcher-dismiss').click()
await expect(page.getByTestId('launcher')).not.toBeAttached()
```

If the component conditionally renders during animation (e.g. `<AnimatePresence>`), `not.toBeAttached` works. **If the component stays mounted during animation, use the `data-animation-state` attribute** that the launcher (`Launcher.tsx`) and country-panel (`SingleCountryPanel.tsx`) components expose. Wait on it via the helper:

```ts
import { waitForAnimationIdle } from './helpers'
await waitForAnimationIdle(page.getByTestId('country-panel'))
```

Driven by `Element.getAnimations({ subtree: true })` so it tracks every CSS animation on the element and its descendants — no hand-typed durations on either the component or test side. New components that animate should expose the same attribute the same way.

**❌ Asserting Fuse.js result order with `.first()`** (or any other ordering that depends on scoring/data). Use the explicit option:

```ts
// ❌ Don't (assumes France is the first match)
await page.getByTestId('search-results').getByRole('option').first().click()

// ✅ Do
await page
  .getByTestId('search-results')
  .getByRole('option', { name: /^France\s/ })
  .click()
```

**❌ Asserting focus position after N Tab presses** without an intermediate check. Tab order can change when you add a focusable element (e.g. a Daily CTA), and the failure mode is silent:

```ts
// ❌ Don't (depends on counting focusable elements correctly)
await page.keyboard.press('Tab')
await page.keyboard.press('Tab')
await expect(page.getByTestId('expected-second')).toBeFocused()

// ✅ Do — assert each step
await page.keyboard.press('Tab')
await expect(page.getByTestId('expected-first')).toBeFocused()
await page.keyboard.press('Tab')
await expect(page.getByTestId('expected-second')).toBeFocused()
```

### Required patterns

**✅ Use the readiness helpers in `e2e/helpers.ts`:**

| Helper                              | Use when                                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `waitForAppReady(page)`             | After every `page.goto('/')` — ensures bundled `countries` + `cities` are present and the first React commit happened                                                                                        |
| `waitForGameTestHook(page)`         | After landing on a game route, before calling `__funworldmap_game.*` test seams — ensures the seam is registered                                                                                             |
| `waitForCountryTilesRendered(page)` | After map-loaded, before `queryRenderedFeatures` — ensures the GPU has actually rasterised the tiles                                                                                                         |
| `waitForAnimationIdle(locator)`     | After an animated component enters or before clicking through it — replaces `waitForTimeout(N)` for CSS-transition timing. Component must expose `data-animation-state="idle"` when its animations complete. |
| `openLauncher(page)`                | When the test needs the launcher open — clicks the header Play button and waits for it to be visible (cold load is map-first; the launcher does not auto-open)                                               |
| `ensureLauncherDismissed(page)`     | When the launcher may be open and you need a clean map state — closes it if visible, else no-op                                                                                                              |
| `gotoAndWaitForMap(page, path)`     | Combined: navigates, waits for `data-map-loaded`. Prefer over manual `goto + waitForSelector('[data-map-loaded]')`                                                                                           |
| `routeMapTiles(page)`               | When the test doesn't need real basemap tiles — stubs them to avoid network flake                                                                                                                            |

**✅ Auto-retrying assertions over manual polls.** `expect(locator).toBeVisible()`, `expect(locator).toHaveCount(N)`, `expect.poll(...)` all retry up to a timeout. Reach for these instead of writing your own polling loops.

**✅ Pair every "click overlay-occluded element" with a "wait for occluder to be gone" step.** The dropdown / modal / portal that was over your target needs to actually unmount before the click. `expect(occluder).not.toBeAttached()` is the deterministic signal.

**✅ Test seams over UI driving for game flows.** Use `__funworldmap_game.submitCountryGuess(cca3)`, `setRound(id)`, `finalize()`, `getSession()`, etc. (exposed in `src/game/hooks/useGameTestSeams.ts` and `src/game/shared/GameSessionProvider.tsx` under `VITE_TEST_HOOKS`). They dispatch the same reducer actions a real click would, but skip the click-actionability dance.

**✅ Synthetic map clicks via `__funworldmap_map.fire('click', ...)` for ocean/off-globe paths.** Real `page.mouse.click(x, y)` depends on viewport-specific water coordinates that change with camera state. The synthetic form is camera-agnostic. Always pair with a `queryRenderedFeatures` precondition assertion to fail loudly if the canvas point ever lands on a country.

### Before adding a new e2e test

1. **All tests run in the consolidated `chromium` project** (ANGLE — real GPU locally; GitHub-hosted CI has no GPU and falls back to software rendering). Add your spec's filename to the `chromium` `testMatch` in `playwright.config.ts`. If it is also appropriate for mobile or Firefox touch, add it to those projects too.
2. **Does an existing helper cover the readiness wait?** Check `e2e/helpers.ts` first. If you're tempted to write `await page.waitForTimeout(...)`, look for the helper. If none exists for your case, _add_ one to `helpers.ts` rather than inlining the wait.
3. **Are you about to use `force: true`?** Stop. Find what's blocking the click and wait for it to be gone instead.
4. **Does the test depend on animations?** If yes, the component needs a `data-animation-state` (or similar) signal — don't guess durations.

### When CI flakes

1. **Don't re-run blindly.** Read the trace (`test-results/<test>/trace.zip` → `npx playwright show-trace <file>`).
2. **Check whether the test follows the rules above.** If `waitForTimeout` is in the failure path, that's the bug.
3. **Reproduce locally with `--workers=2`** (matches CI parallelism). Single-worker local runs hide most flakes.
4. **The escalation rule from `docs/superpowers/plans/2026-04-22-deflake-chromium-e2e.md`:** if local 10× green but CI red, the test is making an assumption your local env happens to satisfy. Don't paper over with retries — fix the assumption.

### Quarantining a CI-only flake (last-resort)

When a test fails consistently on CI and the underlying bug is bigger-than-this-PR (a real-bug, an animation race that needs component changes, etc.), quarantine it via conditional `test.fixme` so CI is honestly green while the test stays runnable locally for diagnosis:

```ts
test('the flaky test', async ({ page }) => {
  // Quarantined on CI pending tracking issue #N — <one-line-symptom>.
  // <Why CI-only — what differs between local and CI.>
  test.fixme(!!process.env.CI, 'tracking issue: https://github.com/.../issues/N')
  // …test body unchanged…
})
```

Rules:

1. **Every quarantined test MUST have a tracking issue link** in the `test.fixme` reason. The issue documents the symptom, the diagnosis so far, suggested fix shapes, and the failing run URL.
2. **`test.fixme` is for "we will fix this", not "we accept this is broken forever".** A quarantine without a tracking issue is `test.skip`, which is a stronger signal of permanent disable — use that only when removing the test outright.
3. **Conditional on `process.env.CI` only**, not on browser/project. The test should run in dev so a developer hitting the bug path locally still sees the failure.
4. **Don't add `continue-on-error`** to the workflow — that silently allows CI to be perpetually red. `test.fixme` makes the suppression explicit and visible in `npm run test:e2e` output ("3 fixme") rather than hidden in a workflow attribute.

**Beyond `test.fixme`:** ten whole specs are excluded on CI via the `chromium`
project's `testIgnore` (no GPU on free runners — tracking issue #106), and CI runs
only the chromium project, so the three mobile-only specs don't run there either.
**13 of 38 specs are local-only.** See `docs/systems/testing.md` § "What runs in
CI" before assuming CI covered your change.

### Reference: the 2026-04-28 flake regression

`docs/superpowers/notes/2026-04-28-flake-regression-analysis.md` documents how this codebase's chromium e2e suite regressed to a flaky state after the 2026-04-22 deflake fix. TL;DR: the original deflake fix was load-time-only (added `data-app-ready`); per-test `waitForTimeout` calls and `force: true` clicks were never removed; subsequent PRs added more tests following the same patterns; cumulative flake rate eventually exceeded CI tolerance. The rules above are the rules whose violation caused that regression.

## Project memory

This project carries cross-session conventions in `~/.claude/projects/E--polworldmap/memory/MEMORY.md` (the user's auto-memory). Don't conflict with those — current entries:

- Documentation before code
- Critical plan review before presenting (don't draft once)
- Remove obsolete code and tests in the same change

## When in doubt

Ask. The cost of pausing to confirm is low; the cost of an unwanted change can be high (an admin-merged CI failure, a polluted personal-bests store). Match the scope of your action to what was asked.
