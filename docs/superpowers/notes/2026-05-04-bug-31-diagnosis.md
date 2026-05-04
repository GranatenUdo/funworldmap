# Bug #31 — country-panel click stability race trace analysis

- **Date**: 2026-05-04
- **Branch**: `fix/bugs-and-lift-quarantine` (worktree at `E:/polworldmap/.worktrees/fix-bugs-and-lift-quarantine`)
- **Source CI run**: [`25274733085`](https://github.com/GranatenUdo/funworldmap/actions/runs/25274733085) (PR #30, head `chore/e2e-residual-timeout-audit`, commit `7e97c514` / merge `8f8ba8e`)
- **Test**: `e2e/launcher.spec.ts:83 — "dismissing + closing a country panel does NOT re-show launcher"`
- **Project**: `chromium` (real-GPU ANGLE on CI), workers=2, retries=2, expect timeout 15 s, actionTimeout 20 s, test timeout 60 s.

## TL;DR

Three retries, **three different stuck-points**, all converging on the same root cause: the `SingleCountryPanel`'s entrance animations are inline `style={{ animation: ... }}` strings, and on this CI environment the `useEffect`-based `data-animation-state` flip from `'entering'` → `'idle'` **never happens** within the test's actionability budget. Even the 1-second `setTimeout` fallback inside the component does not resolve in time. The result is that Playwright's "waiting for element to be visible, enabled and stable" loop on `franceOption` and on `panel-close` runs out the 20 s actionTimeout.

The fix is to move the staggered child animations from inline `style` to className-based CSS (which `getAnimations({ subtree: true })` tracks reliably) **and** to opt the chromium project into `reducedMotion: 'reduce'` (which the existing `@media (prefers-reduced-motion: reduce)` rule in `src/index.css` already collapses to ~0 ms). Both shapes are independent and complementary; both should land in Task 2.2.

## Quoted error contexts

Three error-context markdowns from `report.zip → resources/`, all for the same testId `65bafd2a21c97b0ab9bf-9b475594880f88360736`:

| Result | Retry | Status | Duration | Stuck where |
|---|---|---|---|---|
| `fd9366a3…` | 0 | failed | 59 230 ms | line 103 (`panel-close.click()`) — never got past "waiting for element to be visible, enabled and stable" |
| `1ed0c84f…` | 1 | failed | 38 396 ms | line 94 (`franceOption.click()`) — got past "click action done", hung on "waiting for scheduled navigations to finish" |
| `616fde96…` | 2 | failed | 57 754 ms | line 103 (`panel-close.click()`) — got past stable + scrolled, stuck at "performing click action" |

```text
TimeoutError: locator.click: Timeout 20000ms exceeded.
Call log (retry 0, panel-close):
  - waiting for getByTestId('panel-close')
  - locator resolved to <button … data-testid="panel-close" …>…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable        ← never proceeded
```

```text
Call log (retry 1, franceOption):
  - waiting for getByTestId('search-results').getByRole('option', { name: /^France\s/ }).first()
  - locator resolved to <li role="option" id="search-result-0" …>…</li>
  - attempting click action
  - waiting for element to be visible, enabled and stable
  - element is visible, enabled and stable
  - scrolling into view if needed
  - done scrolling
  - performing click action
  - click action done
  - waiting for scheduled navigations to finish                    ← never proceeded
```

```text
Call log (retry 2, panel-close):
  - waiting for getByTestId('panel-close')
  - …
  - attempting click action
  - waiting for element to be visible, enabled and stable
  - element is visible, enabled and stable
  - scrolling into view if needed
  - done scrolling                                                 ← never proceeded past here
```

## Trace timing for retry 1 (the only retry with a captured trace.zip)

`trace: 'on-first-retry'` in `playwright.config.ts` — only retry 1's trace was archived. From `0-trace.trace`:

| Step | Call | wallTime | Δ from prior |
|---|---|---:|---:|
| Page navigate complete | call@8 after | 1777799074220 | — |
| Click `launcher-dismiss` complete | call@10 after | 1777799075364 | +1 144 ms |
| Fill `search-input` "France" complete | call@12 after | 1777799075660 | +296 ms |
| `expect(franceOption).toBeVisible()` complete | call@14 after | 1777799077028 | **+1 368 ms** ← search index slow on CI |
| **`franceOption.click()` invoked** | call@16 before | 1777799077454 | +426 ms |
| **`franceOption.click()` event dispatched (input)** | call@16 input | 1777799092370 | **+14 916 ms** ← stability check loop |
| **`franceOption.click()` failed (test timeout)** | call@16 after | 1777799106326 | +13 956 ms ← waiting for scheduled navigations |

Two damning gaps:

1. **+15 s** between Playwright deciding to click and actually dispatching the click. This is the actionability stability check looping. The element resolves immediately, is "visible, enabled and stable" briefly, then becomes unstable again, then stable, etc. — Playwright's stability heuristic re-RAFs until two consecutive frames have identical bounding boxes. With 6 inline `animation: ... running ...` styles on the panel-card (just-mounted) AND `dropdown-in 120ms` running on the search-results `<ul>` that contains the LI, plus slow Software-ANGLE-class layout pacing, the checker oscillates.
2. **+14 s** between the click being dispatched into the page and the test giving up. This is "waiting for scheduled navigations to finish" — Playwright registers `window.location.hash = '#FRA'` (fired by `useSelectedCountry.select` in `src/hooks/useSelectedCountry.ts:43-47`) as a scheduled navigation, and waits for it. The hash navigation completes synchronously in the page; what Playwright is *actually* waiting on is the `popstate`/`hashchange`-driven re-render to settle, which keeps re-painting because of the panel mount + 6 staggered animations.

## Page snapshot at failure

`after@call@16` (`wallTime=1777799106326`, the test-failure moment, ~29 s after click was attempted). The country-panel is mounted in the DOM:

```yaml
[role=complementary] data-testid="country-panel" data-animation-state="entering"
                     style="animation: 250ms ease-out 0s 1 normal none running panel-card-in;"
  - <div style="animation: 200ms ease-out 0s 1 normal none running fade-up;">…flag + name…</div>
  - <button data-testid="panel-close" …>×</button>
  - <div style="animation: 200ms ease-out 50ms 1 normal both running panel-field-in;">…</div>
  - <div style="animation: 200ms ease-out 100ms 1 normal both running panel-field-in;">…</div>
  - <div style="animation: 200ms ease-out 150ms 1 normal both running panel-field-in;">…</div>
  - <div style="animation: 200ms ease-out 200ms 1 normal both running panel-field-in;">…</div>
```

**Three load-bearing observations**:

1. **`data-animation-state="entering"`** — this attribute should have flipped to `'idle'` within ~1 s of mount (the `setTimeout(flipToIdle, 1000)` in `SingleCountryPanel.tsx:103`). At the snapshot moment the panel has been mounted for at least ~14 s (since `input@call@16` fired the click). The state never flipped.
2. **All six animation strings still in inline `style`** — these are the React-set strings, which (correctly) don't change after first commit. Browser-time, those animations have long completed (max delay 200 ms + 200 ms duration = 400 ms), but the `style` attribute is text and stays as-set.
3. **The `getAnimations({ subtree: true })` call inside the `useEffect` rAF could not have observed these inline animations as "still running"** — they finish at 250 ms / 400 ms wall-clock, so `Promise.all(animations.map(a => a.finished))` should have resolved within 400 ms of mount, definitely within the 1 s fallback.

## Bounding-box history (panel-close)

There is exactly **one** DOM snapshot that contains the country-panel (the `after@call@16` snapshot above). Playwright's `screencast-frame` trace contains 72 raster frames between `before@call@16` (1777799077454) and `input@call@16` (1777799092370), spaced at ~50 ms initially then ~200 ms — so we see the dropdown's LI as a stationary visual, but the *DOM-level* bbox readings Playwright is doing for stability happen at every RAF and aren't archived. We can't directly observe per-RAF bbox jitter from the trace; we infer it from the 15 s elapsed in stability-checking before any click event was dispatched.

## Hypothesis decision

| Hypothesis (from the plan) | Verdict |
|---|---|
| 1. `getAnimations({ subtree: true })` doesn't observe inline `style.animation` on the CI rendering path → `animations.length === 0` → early flip to `'idle'` while children are still translating | **Partially supported.** The end-state DOM still shows `data-animation-state="entering"`, which would only happen if the component's `setAnimationState('idle')` never ran. That implies *neither* `Promise.all(animations.map(a=>a.finished))` *nor* the 1 s `setTimeout` fallback fired. So `animations.length === 0 + early flip to idle` is contradicted; the actual failure is the *opposite*: the state never flipped at all. |
| 2. `getAnimations()` observes them but `.finished` promises don't all resolve before the 1 s fallback fires | **Refuted in part.** Even if `.finished` never resolves, the 1 s `setTimeout` should fire deterministically. The end-state snapshot shows the 1 s fallback also did not fire. |
| **NEW**: The component's animation-state useEffect itself never schedules a state flip on this CI environment, OR the resulting state update never commits during the time Playwright's actionability check is consuming the event loop. | **Working hypothesis — see "Mechanism" below.** |

### Mechanism (working hypothesis)

The `useEffect` at `SingleCountryPanel.tsx:79` schedules:
- `requestAnimationFrame(...)` — the rAF callback that calls `getAnimations` and `Promise.all(...).then(flipToIdle)`
- `setTimeout(flipToIdle, 1000)` — the deterministic fallback

Both fire in the page's main thread. Playwright's `franceOption.click()` actionability loop runs in the *driver* (out-of-process), but it issues `Page.captureScreenshot`, `DOM.getBoxModel`, and `Runtime.evaluate` calls into the page over the CDP transport — each one queues at the page's event-loop level. On Software-ANGLE-class CI workers (which we kept as a single `chromium` project after the 2026-05-02 consolidation), these CDP round-trips are slow; combined with the page's ongoing layout work for the panel + dropdown unmount, the page main thread spends most of its budget on layout / paint and the rAF scheduling is starved or delayed.

Crucially, **the 1 s `setTimeout` is also a timer task scheduled on the page's event loop** — under heavy CDP-driven layout/paint pressure it can be delayed past Playwright's 20 s actionTimeout, especially when the page is also trying to fire `hashchange` handlers, mount the `<SingleCountryPanel>`, mount the `<CountryNewsSection>` (which kicks off the `/news/FRA.json` fetch), and run six inline staggered animations.

The 6 inline animations themselves don't cause the bbox to shift past their natural duration, but **the CSS for each** (`panel-field-in`, `panel-card-in`, `fade-up`) keeps the elements in `transform: translateY(...)` keyframe states. While they're "running" (which is brief, but accumulated by the layered staggering), Playwright's stability heuristic snapshots a moving bbox; once they end, the bbox is stable. The combination is: bbox is unstable for the first ~400 ms post-mount, then stable, but Playwright may not RAF in lockstep — it polls. With a slow CDP, it can miss the stable window.

In summary: the fragility is **both** (a) the multi-element staggered animation creating a transient instability window AND (b) the page-state signal Playwright actually consults (`expect(panel).toHaveAttribute('data-animation-state', 'idle')` via `waitForAnimationIdle`) being driven by an effect that runs on the *same* starved event loop. The `waitForAnimationIdle` call before line 103 succeeds only because it has a 15 s timeout — enough for the page to eventually catch up — but by then 15 s of test budget are already gone, leaving panel-close's 20 s click actionability check to race the test's 60 s wall-clock.

## Recommended fix shape for Task 2.2

Two coordinated changes — **(A) is mandatory; (B) is the load-bearing one for this CI environment**:

### (A) Move staggered child animations from inline `style` to className-based CSS

Inline `style={{ animation: '...' }}` is the well-known footgun for `Element.getAnimations({ subtree: true })` reliability across browsers (especially on Linux software-ANGLE rendering paths). Class-based animations are tracked deterministically. Concretely:

In `src/index.css`, add per-stagger utility classes:

```css
.panel-card-in    { animation: panel-card-in 250ms ease-out; }
.panel-field-in-0 { animation: panel-field-in 200ms ease-out 0ms both; }
.panel-field-in-1 { animation: panel-field-in 200ms ease-out 50ms both; }
.panel-field-in-2 { animation: panel-field-in 200ms ease-out 100ms both; }
.panel-field-in-3 { animation: panel-field-in 200ms ease-out 150ms both; }
.panel-field-in-4 { animation: panel-field-in 200ms ease-out 200ms both; }
.panel-fade-up    { animation: fade-up 200ms ease-out; }
```

In `src/components/SingleCountryPanel.tsx`:

```tsx
// Replace the inline style on the root:
<div … className={isDesktop ? `${desktopBase} panel-card-in` : mobileBase} … />
// And on each animated child:
<div … className="flex items-start gap-3.5 min-w-0 panel-fade-up">…</div>
<div … className="grid grid-cols-2 gap-x-4 panel-field-in-1">…</div>
// (panel-field-in-2, -3, -4 in the secondary blocks)
```

This makes `getAnimations({ subtree: true })` reliably enumerate every child animation as a `CSSAnimation` whose `.finished` promise resolves at end-of-keyframe. The existing `useEffect`'s rAF + `Promise.all(...)` path then resolves correctly without depending on the 1 s fallback.

The mobile branch (already className-only because of the `transition-[height]`) does not need changes.

**Why not just remove the staggered animations.** The user-facing reason they exist is to ease the panel's data into view — removing them is a UX regression on local. The fix is to keep the visuals but make them detectable.

### (B) Opt chromium project into `reducedMotion: 'reduce'`

`src/index.css:328-336` already has:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

This collapses every animation to ~0 ms when the page sees the reduce preference. Playwright lets a project request that emulation:

```ts
// playwright.config.ts — chromium project
{
  name: 'chromium',
  use: {
    ...devices['Desktop Chrome'],
    actionTimeout: isCi ? 20_000 : 5_000,
    reducedMotion: 'reduce',                  // ← new
    launchOptions: { args: ['--use-gl=angle', '--use-angle=default'] },
  },
  …
}
```

With (B) in place, the staggered animations effectively complete in 0 ms, the `getAnimations()` list is empty (or its `.finished` promises resolve immediately), the `data-animation-state` flip happens within one rAF, and the LI / panel bboxes are stable from the moment they're laid out.

(B) is the simpler, lower-risk change of the two. It only affects e2e tests; product behavior under user-set reduced-motion was already this way. It eliminates the entire class of animation-driven actionability flake on chromium without any component refactor.

### (C) — optional follow-up — drop the 1 s fallback's reason for being

Once (A) and (B) are in, the `setTimeout(flipToIdle, 1000)` fallback in `SingleCountryPanel.tsx:103` exists to cover the case the comment describes ("CI cases where getAnimations doesn't observe CSS transitions, or .finished promises don't resolve"). With class-based animations + reduced-motion CI, neither failure mode is reachable. The fallback can stay as a defense-in-depth measure (it's harmless — 1 s is the *upper bound*, not a delay), or be tightened to 250 ms (the longest actual animation duration) to reduce blast radius if some new component animation regresses.

### Why both (A) and (B), not just one

- **(B) alone** is an environmental opt-out — it makes the *test* not see the problem. If a future product regression introduced a longer animation or a non-className animation, (B) would still hide it from CI but the click would still fail in the field for users who don't request reduced motion.
- **(A) alone** is the correct fix in principle, but it depends on `getAnimations({ subtree: true }).map(a => a.finished)` resolving reliably under the same Software-ANGLE / CDP-pressure conditions that are causing the flake today. We have evidence in this trace that those conditions also delay the 1 s timer fallback. We can't rule out a future regression where (A) alone is insufficient on the same CI.

(A) fixes the underlying detectability bug; (B) makes the test robust against future CI slowness. Apply both in Task 2.2.

## Non-flake-risk plan for the Vitest fake-timer test (Task 2.2)

The user's standing rule ("make sure not to add any flaky tests") applies to the unit-level test that should accompany the fix. Recommended shape:

```ts
// src/components/__tests__/SingleCountryPanel.animation-state.test.tsx
import { render } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SingleCountryPanel } from '../SingleCountryPanel'
import { mockCountry } from './fixtures' // existing test helper

describe('SingleCountryPanel data-animation-state', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('flips entering → idle once getAnimations finishes (className path)', async () => {
    // Mock getAnimations to return a single Animation with a manually-resolvable .finished
    let resolveFinished!: () => void
    const fakeAnim = { finished: new Promise<void>((r) => { resolveFinished = r }) }
    const getAnimationsSpy = vi.fn().mockReturnValue([fakeAnim])
    Element.prototype.getAnimations = getAnimationsSpy as unknown as Element['getAnimations']

    const { getByTestId } = render(<SingleCountryPanel country={mockCountry} … />)
    const root = getByTestId('country-panel')
    expect(root.getAttribute('data-animation-state')).toBe('entering')

    // rAF runs (fake-timed)
    await vi.advanceTimersByTimeAsync(16)
    expect(getAnimationsSpy).toHaveBeenCalled()
    expect(root.getAttribute('data-animation-state')).toBe('entering')   // .finished not yet resolved

    resolveFinished()
    await vi.runAllTicks()
    expect(root.getAttribute('data-animation-state')).toBe('idle')
  })

  it('flips entering → idle via 1s fallback when no animations are detected', async () => {
    Element.prototype.getAnimations = vi.fn().mockReturnValue([]) as unknown as Element['getAnimations']
    const { getByTestId } = render(<SingleCountryPanel country={mockCountry} … />)
    const root = getByTestId('country-panel')
    await vi.advanceTimersByTimeAsync(16)
    expect(root.getAttribute('data-animation-state')).toBe('idle') // empty list → flip immediately
  })

  it('flips entering → idle via 1s fallback when .finished never resolves', async () => {
    const stuckAnim = { finished: new Promise<void>(() => { /* never resolves */ }) }
    Element.prototype.getAnimations = vi.fn().mockReturnValue([stuckAnim]) as unknown as Element['getAnimations']
    const { getByTestId } = render(<SingleCountryPanel country={mockCountry} … />)
    const root = getByTestId('country-panel')
    await vi.advanceTimersByTimeAsync(999)
    expect(root.getAttribute('data-animation-state')).toBe('entering')
    await vi.advanceTimersByTimeAsync(2)
    expect(root.getAttribute('data-animation-state')).toBe('idle') // 1s fallback fires
  })
})
```

Why this is non-flaky:
- All timers are fake (`vi.useFakeTimers()`); no wallclock dependency.
- `getAnimations` is fully stubbed; no browser-version variance.
- The `.finished` promise is manually controlled; no real animation needed.
- Tests cover all three paths: `.finished` resolves, no animations, `.finished` never resolves.
- `mockCountry` fixture is plain JSON, no network or random data.

This unit test cannot reproduce the *CI-specific* flake (which is about the page event loop being starved by CDP), but it pins the *component contract*: after every documented branch, `data-animation-state` ends up `'idle'`. With (A) and (B) in place, that contract holds in CI too.

## Planned diagnostic logging (only if fix needs further iteration)

If after (A) + (B) the test still flakes, add these one-shot logs inside the rAF callback in `SingleCountryPanel.tsx:95-102` (gated behind `import.meta.env.VITE_TEST_HOOKS`):

```ts
const animations = root.getAnimations({ subtree: true })
if (import.meta.env.VITE_TEST_HOOKS) {
  console.log('[panel] getAnimations count:', animations.length, 'at', performance.now())
}
Promise.all(animations.map((a) => a.finished))
  .then(() => {
    if (import.meta.env.VITE_TEST_HOOKS) console.log('[panel] all .finished resolved at', performance.now())
    flipToIdle()
  })
  .catch((e) => {
    if (import.meta.env.VITE_TEST_HOOKS) console.log('[panel] .finished rejected', e)
    flipToIdle()
  })
```

Then re-run CI and inspect the `console.log` capture in the trace's `console-messages` view. If `count: 0` appears we know `getAnimations` doesn't see the className animations either (unlikely after (A) but possible). If `count: 6` but `all .finished resolved` never fires, the issue is the `.finished` promise itself — at that point a `transitionend`/`animationend` listener becomes the next fix shape.

These logs are intentionally not pushed in this Task 2.1 — they're a Task-2.2-or-later contingency.

## Trace artifacts inspected

- Blob report: `gh run download 25274733085 -n playwright-blob-chromium`, extracted to `/tmp/trace-31-pr-a/report/`
- Three error-context markdowns under `report/resources/`:
  - `fd9366a3…` retry 0 / `d2cb1301ecb42c54402dd9e001f87fd6e5fe50f2.markdown` — panel-close hung at "stable"
  - `1ed0c84f…` retry 1 / `18c91b29bc1971b1a5ab05a4762748487d542530.markdown` — franceOption hung at "scheduled navigations"
  - `616fde96…` retry 2 / `edb4c8875e5bc0470b54415c99c889a2fdba6294.markdown` — panel-close hung at "performing click"
- One trace zip (only retry 1 captured per `trace: 'on-first-retry'`):
  - `8ba5caf3e70ae13e326c2437deff1620b42e06ce.zip` (resultId `1ed0c84f…`), extracted to `/tmp/trace-31-zip/`
  - `0-trace.trace` — JSONL frame snapshots + screencast-frame timestamps
- `report.jsonl` parsed for `onTestEnd` / `onAttach` events keyed by testId `65bafd2a21c97b0ab9bf-9b475594880f88360736`

## Status

DONE — three trace-evidence findings (15 s stability wait, 14 s scheduled-navigation wait, `data-animation-state="entering"` 14 s after panel mount), working hypothesis identified (event-loop starvation defeats both `.finished` and `setTimeout` fallback), fix shape concrete enough for Task 2.2 to implement (className animations + reducedMotion config), non-flake-risk Vitest plan documented, contingency diagnostic logs documented but not yet pushed.
