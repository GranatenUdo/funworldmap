# Verify Animations + Share Button — Implementation Plan (revised 2026-05-13)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two coverage gaps surfaced in the 2026-05-11 assessment that lifted ratings off 9+: (a) the share button's `navigator.share` / clipboard / error branches have only happy-path coverage at the e2e level (unit tests exist but don't verify toast rendering end-to-end), (b) animation interruption paths (rapid Continue, Escape mid-reveal, Escape mid-panel-slide-in, hash mutation mid-animation) have no test coverage; the visual polish is unverified.

**Architecture:** Three independent phases. Phase 1 adds e2e coverage for share branches using the existing `window.__PLAYWRIGHT__` analytics seam (no fetch stubbing). Phase 2 adds e2e coverage for 4 animation interrupt cases, keyed on `data-animation-state="entering"` rather than wall-clock timing. Phase 3 is an inline observation pass via Playwright MCP in this session, capturing screenshots at state-signaled frames, reconciling against `game-unhappy-paths.md` Section A, and fixing trivial deviations in-line per user decision (with a scope guardrail).

**Tech Stack:** Playwright (e2e), `window.__PLAYWRIGHT__` analytics seam already in `src/lib/analytics.ts`, existing `__funworldmap_game` / `__funworldmap_map` test seams, `data-animation-state` attribute on animated components, Playwright MCP for Phase 3 capture.

---

## What changed from the first draft

| First draft | Revised | Reason |
|---|---|---|
| Phase 1 stubbed `fetch`/`sendBeacon` to capture analytics | Phase 1 sets `window.__PLAYWRIGHT__ = true` and reads `window.__testAnalytics` | The analytics seam already exists at `src/lib/analytics.ts:32-36`. Used by `e2e/daily-best-of-3.spec.ts:27`. Stubbing was reinventing the wheel. |
| Phase 1: 7 e2e tests | Phase 1: still 7 e2e tests (user picked e2e despite my unit-level recommendation) | E2E verifies the wiring (toast renders, button → user-visible outcome) end-to-end. Some duplication with `DailyShareBlock.test.tsx`'s 6 unit tests is accepted for that wiring confidence. |
| Phase 2: 3 tests | Phase 2: **4 tests** (added Escape mid-panel-slide-in for wrong guess) | Symmetry — wrong-guess `round-ended` is a distinct state (panel + Continue visible) from correct-guess `round-ended` (reveal hold). |
| Phase 2 "rapid Continue" waited for `toBeAttached` then clicked | Phase 2 waits for `data-animation-state="entering"` then clicks | Proves we clicked DURING animation, not after. `toBeAttached` resolves the moment the panel is in DOM — animation could be done. |
| Phase 3 captures keyed on wall-clock timestamps (+50ms, +500ms…) | Phase 3 captures keyed on state signals (`data-animation-state="entering"`, `round-ended → playing`, etc.) | Wall-clock is flaky in headless; state signals are deterministic. |
| Phase 3 deviations → spawn separate fix plan | Phase 3 deviations → **fix in-line** (per user decision) with scope guardrail | User chose this. Guardrail added: any fix touching > 3 files or > 2 hours of work escalates to a separate plan rather than expanding this one. |

---

## File map

- Create: `e2e/share-branches.spec.ts` — Phase 1 (7 tests)
- Create: `e2e/animation-interrupt.spec.ts` — Phase 2 (4 tests)
- Modify: `playwright.config.ts` — register both new specs
- Create: `docs/testing/animation-verification-2026-05-13.md` — Phase 3 deliverable
- Create: `docs/testing/screenshots/2026-05-13/*.png` — captured frames
- POSSIBLY modify: code that Phase 3 reveals as buggy (subject to the guardrail)

---

## Phase 1 — Share-button branch coverage (e2e)

### Task 1.1: Branch from main

- [ ] **Step 1**: `git checkout main && git pull --ff-only origin main && git checkout -b test/share-button-branches`. Working tree should have only untracked unrelated files.

### Task 1.2: Write the share-branches spec

**Files:** Create `e2e/share-branches.spec.ts`.

The spec uses the existing `__PLAYWRIGHT__` analytics seam:

```ts
import { test, expect, type Page } from '@playwright/test'
import { waitForAppReady } from './helpers'
import { toLocalDateString } from '../src/game/daily/dates'

test.setTimeout(60_000)

/** Seed a played country-pinning daily for `date` and stub /daily/index.json. */
async function seedPlayedDaily(page: Page, date: string): Promise<void> {
  await page.addInitScript(
    ({ d }) => {
      ;(window as unknown as { __PLAYWRIGHT__: boolean }).__PLAYWRIGHT__ = true
      const index = {
        generatedAt: new Date().toISOString(),
        window: { start: d, end: d },
        days: { [d]: { country: { cca3: 'FRA' }, city: { id: 'FRA-paris' } } },
      }
      const history = {
        version: 1,
        streak: { current: 3, longest: 3, lastActiveDate: d, lastMilestoneShown: 0 },
        days: {
          [d]: {
            'country-pinning': {
              score: 87,
              attempts: [
                { pointsEarned: 42, distanceKm: 1200 },
                { pointsEarned: 63, distanceKm: 400 },
                { pointsEarned: 91, distanceKm: 0 },
              ],
              completedAt: 1,
            },
          },
        },
      }
      localStorage.setItem('funworldmap-daily-history', JSON.stringify(history))
      ;(window as unknown as { __seededIndex?: unknown }).__seededIndex = index
    },
    { d: date },
  )
  await page.route('**/daily/index.json', async (route) => {
    const seeded = await page.evaluate(
      () => (window as unknown as { __seededIndex?: unknown }).__seededIndex,
    )
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(seeded) })
  })
}

/** navigator.share stub: resolves successfully, records the call. */
async function installShareSuccessStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { __lastShare?: unknown }).__lastShare = undefined
    // @ts-expect-error — test-time installation
    navigator.share = async (data: { title: string; text: string; url: string }) => {
      ;(window as unknown as { __lastShare?: unknown }).__lastShare = data
    }
  })
}

/** navigator.share stub: rejects with AbortError (user cancelled). */
async function installShareAbortStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // @ts-expect-error — test-time installation
    navigator.share = async () => {
      const err = new Error('user cancelled') as Error & { name: string }
      err.name = 'AbortError'
      throw err
    }
  })
}

/** navigator.share stub: rejects with a non-Abort error. */
async function installShareGenericFailureStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // @ts-expect-error — test-time installation
    navigator.share = async () => {
      throw new Error('share not allowed')
    }
  })
}

/** Delete navigator.share entirely. */
async function removeNavigatorShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // @ts-expect-error — test-time deletion
    delete navigator.share
  })
}

/** Override clipboard.writeText to throw. */
async function installClipboardFailStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async () => {
        throw new Error('clipboard blocked')
      },
    })
  })
}

/** Read the captured analytics events. */
async function getAnalyticsEvents(page: Page): Promise<Array<{ name: string; props: Record<string, unknown> }>> {
  return page.evaluate(
    () => (window as unknown as { __testAnalytics: Array<{ name: string; props: Record<string, unknown> }> }).__testAnalytics ?? [],
  )
}

test.describe('Daily share-button branches', () => {
  test('share-api success: toast "Shared!" + analytics method=share-api', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today)
    await installShareSuccessStub(page)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-primary').click()
    await expect(page.getByText('Shared!')).toBeVisible({ timeout: 5_000 })
    const events = await getAnalyticsEvents(page)
    const shared = events.find((e) => e.name === 'daily_shared')
    expect(shared?.props.method).toBe('share-api')
  })

  test('share-api AbortError: no toast, no clipboard fallback, no analytics', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today)
    await installShareAbortStub(page)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-primary').click()
    // 500ms is enough for the handler to run; nothing visible should appear.
    await page.waitForTimeout(500)
    await expect(page.getByText('Shared!')).not.toBeVisible()
    await expect(page.getByText('Copied!')).not.toBeVisible()
    const events = await getAnalyticsEvents(page)
    expect(events.find((e) => e.name === 'daily_shared')).toBeUndefined()
  })

  test('share-api generic error: falls through to clipboard, toast "Copied!" + analytics method=clipboard-text', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today)
    await installShareGenericFailureStub(page)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-primary').click()
    await expect(page.getByText('Copied!')).toBeVisible({ timeout: 5_000 })
    const events = await getAnalyticsEvents(page)
    expect(events.find((e) => e.name === 'daily_shared')?.props.method).toBe('clipboard-text')
  })

  test('navigator.share missing: clipboard path with toast "Copied!" + analytics method=clipboard-text', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today)
    await removeNavigatorShare(page)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-primary').click()
    await expect(page.getByText('Copied!')).toBeVisible({ timeout: 5_000 })
    const events = await getAnalyticsEvents(page)
    expect(events.find((e) => e.name === 'daily_shared')?.props.method).toBe('clipboard-text')
  })

  test('clipboard also fails: toast "Couldn\'t copy — select and copy manually." + no analytics', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today)
    await removeNavigatorShare(page)
    await installClipboardFailStub(page)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-primary').click()
    await expect(page.getByText(/Couldn't copy/)).toBeVisible({ timeout: 5_000 })
    const events = await getAnalyticsEvents(page)
    expect(events.find((e) => e.name === 'daily_shared')).toBeUndefined()
  })

  test('copy-link: toast "Link copied" + analytics method=clipboard-link', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-copy-link').click()
    await expect(page.getByText('Link copied')).toBeVisible({ timeout: 5_000 })
    const events = await getAnalyticsEvents(page)
    expect(events.find((e) => e.name === 'daily_shared')?.props.method).toBe('clipboard-link')
  })

  test('copy-link clipboard failure: "Couldn\'t copy" toast', async ({ page }) => {
    const today = toLocalDateString(new Date())
    await seedPlayedDaily(page, today)
    await installClipboardFailStub(page)
    await page.goto(`/#daily/${today}/reveal`)
    await waitForAppReady(page)
    await page.getByTestId('daily-share-copy-link').click()
    await expect(page.getByText(/Couldn't copy/)).toBeVisible({ timeout: 5_000 })
  })
})
```

- [ ] **Step 1**: Create `e2e/share-branches.spec.ts` with the above content.

- [ ] **Step 2**: Register in `playwright.config.ts` chromium `testMatch` (position alphabetically near other `daily-share*` entries).

- [ ] **Step 3**: Run `npm run test:e2e -- --project=chromium share-branches.spec.ts`. Expect 7 pass.

- [ ] **Step 4**: Commit:

```bash
git add e2e/share-branches.spec.ts playwright.config.ts
git commit -m "$(cat <<'EOF'
test(e2e): cover share-button branches (abort, fallback, fail, copy-link)

Unit tests in DailyShareBlock.test.tsx cover most happy paths. This spec
verifies the wiring end-to-end (toast renders on page, analytics fire
through the real track() path) and the 2 unit-test gaps:

  - share-api generic (non-Abort) error → clipboard fallback
  - clipboard writeText failure → 'Couldn't copy' toast

Uses the existing __PLAYWRIGHT__ analytics seam (src/lib/analytics.ts:32-36)
rather than stubbing fetch/sendBeacon.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin test/share-button-branches
gh pr create --title "test(e2e): cover share-button branches" --body "$(cat <<'EOF'
## Summary
- 7 e2e tests covering share-button branches: share-api success/abort/generic-failure, navigator.share missing, clipboard fail, copy-link success, copy-link clipboard fail
- Each test asserts the user-visible toast text + the analytics method value
- Uses existing __PLAYWRIGHT__ analytics seam

## Test plan
- [x] All 7 tests pass locally

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Phase 2 — Animation interrupt coverage (4 tests)

### Task 2.1: Branch from main

- [ ] `git checkout main && git pull --ff-only origin main && git checkout -b test/animation-interrupts`

### Task 2.2: Write the animation-interrupt spec

**Files:** Create `e2e/animation-interrupt.spec.ts`.

The four interrupt cases:

1. **Rapid Continue during panel slide-in (wrong country guess).** Click Continue while `data-animation-state="entering"` is still on the panel. The panel must unmount cleanly and the next round must start.

2. **Escape mid-reveal (correct guess).** During the ~3 s reveal hold after a correct guess, press Escape. The reveal aborts; session goes to idle; launcher reopens; URL hash clears.

3. **Escape mid-panel-slide-in (wrong guess).** During the wrong-guess panel slide-in, press Escape. End-game flow takes over instead of Continue.

4. **Hash mutation mid-reveal.** Mid-reveal animation, set `window.location.hash = 'game/city-guessing'`. The current reveal aborts; the new mode session starts cleanly via `restart` (atomic, no `idle` flicker — bug-#32 territory).

```ts
import { test, expect, type Page } from '@playwright/test'
import { waitForAppReady, waitForGameTestHook, getSession } from './helpers'

test.setTimeout(60_000)

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

async function startCountryPinningWithFRA(page: Page): Promise<void> {
  await page.goto('/')
  await waitForMap(page)
  await page.getByTestId('launcher-card-country-pinning-free-link').click()
  await expect(page.getByTestId('game-prompt-name')).toBeVisible({ timeout: 10_000 })
  await page.evaluate(() => window.__funworldmap_game?.setRound?.('FRA'))
  await expect(page.getByTestId('game-prompt-name')).toHaveText('France', { timeout: 10_000 })
}

test.describe('Animation interrupt: clean abort, no half-rendered state', () => {
  test('rapid Continue click during panel slide-in (wrong guess)', async ({ page }) => {
    await startCountryPinningWithFRA(page)
    await page.evaluate(() => window.__funworldmap_game?.submitCountryGuess?.('DEU'))

    // Wait until the panel is mid-animation (data-animation-state="entering").
    // SingleCountryPanel exposes this attribute on its root element.
    const panel = page.getByRole('complementary')
    await expect(panel).toHaveAttribute('data-animation-state', 'entering', { timeout: 5_000 })

    // Click Continue WHILE entering. The button must be hit-testable even
    // during the slide-in animation (otherwise this is a bug).
    await panel.getByRole('button', { name: 'Continue' }).click()

    // Clean abort: panel unmounts, next round starts.
    await expect(panel).not.toBeAttached({ timeout: 5_000 })
    await expect.poll(async () => (await getSession(page)).status, { timeout: 5_000 }).toBe('playing')
    await expect.poll(async () => (await getSession(page)).roundIndex, { timeout: 5_000 }).toBe(1)
  })

  test('Escape mid-reveal (correct guess) aborts to launcher', async ({ page }) => {
    await startCountryPinningWithFRA(page)
    await page.evaluate(() => window.__funworldmap_game?.submitCountryGuess?.('FRA'))

    await expect.poll(async () => (await getSession(page)).status, { timeout: 5_000 }).toBe('round-ended')

    await page.keyboard.press('Escape')

    await expect.poll(async () => (await getSession(page)).status, { timeout: 5_000 }).toBe('idle')
    await expect(page.getByTestId('launcher')).toBeAttached({ timeout: 5_000 })
    expect(page.url()).not.toContain('#game/')
  })

  test('Escape mid-panel-slide-in (wrong guess) aborts to launcher', async ({ page }) => {
    await startCountryPinningWithFRA(page)
    await page.evaluate(() => window.__funworldmap_game?.submitCountryGuess?.('DEU'))

    const panel = page.getByRole('complementary')
    await expect(panel).toHaveAttribute('data-animation-state', 'entering', { timeout: 5_000 })

    await page.keyboard.press('Escape')

    await expect.poll(async () => (await getSession(page)).status, { timeout: 5_000 }).toBe('idle')
    await expect(panel).not.toBeAttached({ timeout: 5_000 })
    await expect(page.getByTestId('launcher')).toBeAttached({ timeout: 5_000 })
  })

  test('hash mutation mid-reveal switches modes via atomic restart', async ({ page }) => {
    await startCountryPinningWithFRA(page)
    await page.evaluate(() => window.__funworldmap_game?.submitCountryGuess?.('FRA'))

    await expect.poll(async () => (await getSession(page)).status, { timeout: 5_000 }).toBe('round-ended')

    // Mutate hash mid-reveal.
    await page.evaluate(() => { window.location.hash = 'game/city-guessing' })

    // New mode session must be playing — atomic restart, no idle flicker.
    await expect.poll(async () => (await getSession(page)).modeId, { timeout: 5_000 }).toBe('city-guessing')
    await expect.poll(async () => (await getSession(page)).status, { timeout: 5_000 }).toBe('playing')
    await expect.poll(async () => (await getSession(page)).roundIndex, { timeout: 5_000 }).toBe(0)
  })
})
```

- [ ] **Step 1**: Create the spec with the above content.

- [ ] **Step 2**: Register in `playwright.config.ts` chromium `testMatch` (alphabetical position before `axe-snapshot`).

- [ ] **Step 3**: Run `npm run test:e2e -- --project=chromium animation-interrupt.spec.ts`. Expect 4 pass.

- [ ] **Step 4**: If any fail, the underlying flow has a real bug. STOP and capture: which test, the session state at failure, console errors. Likely candidates:
   - Rapid Continue click is swallowed by an overlay during slide-in
   - Escape during reveal opens a confirm dialog instead of dispatching `endGame` (adjust assertion if so)
   - Bug #32 residual quirks in hash-mutation
   
   Each failure is potentially a finding for Phase 3-style fix-in-line treatment.

- [ ] **Step 5**: Commit and open PR:

```bash
git add e2e/animation-interrupt.spec.ts playwright.config.ts
git commit -m "$(cat <<'EOF'
test(e2e): cover animation interrupt paths

Four interrupt cases not covered by reveal-animation.spec.ts:

  - Rapid Continue during wrong-guess panel slide-in
  - Escape mid-reveal (correct guess) — should abort to launcher
  - Escape mid-panel-slide-in (wrong guess) — same outcome, different state
  - Hash mutation mid-reveal — should restart atomically (bug-#32 territory)

Each test waits on data-animation-state='entering' for genuine mid-animation
timing (not wall-clock timeouts). Assertions go through __funworldmap_game
.getSession() seam for deterministic state observation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin test/animation-interrupts
gh pr create --title "test(e2e): cover animation interrupt paths" --body "..."
```

---

## Phase 3 — Visual verification (inline in current session)

This phase is **executed in the current session**, not as a follow-up. The driver (Claude) operates Playwright MCP, captures screenshots at state-signaled frames, fills in the report, and reconciles findings against the `game-unhappy-paths.md` Section A contracts.

**Fix-in-line scope guardrail** (per user decision):
- Findings that look like a trivial CSS adjustment or single-line code change: fix in-line, commit on the docs branch.
- Findings touching > 3 files OR estimated > 2 hours OR requiring architectural changes: open an issue, defer to a separate plan, document the deviation in the report with a `❌ → issue #N` link.
- Findings where the unhappy-paths.md contract is wrong and reality is fine: update the contract doc to match reality.

### Task 3.1: Branch setup

- [ ] `git checkout main && git pull --ff-only origin main && git checkout -b docs/animation-verification-2026-05-13`
- [ ] `mkdir -p docs/testing/screenshots/2026-05-13`

### Task 3.2: Capture script (state-signaled frames)

For each scenario, the driver uses Playwright MCP to:

1. Start the dev server (or attach to a running one) with `VITE_TEST_HOOKS=1`.
2. Set `prefers-reduced-motion: no-preference` via `mcp__playwright__browser_evaluate` (don't trust the project default).
3. Navigate to the scenario's starting state.
4. Drive the game to the moment we want to capture (via `__funworldmap_game.setRound`, `submitCountryGuess`, etc.).
5. **Wait on a state signal**, not a timestamp:
   - For panel slide-in: `await page.locator('[role="complementary"]').waitFor()` then check `data-animation-state="entering"` via `browser_evaluate`.
   - For reveal end: poll `getSession().roundIndex` for the transition.
   - For game-over: `await page.getByTestId('game-over').waitFor()`.
6. Call `mcp__playwright__browser_take_screenshot` with `filename: docs/testing/screenshots/2026-05-13/<scenario-frame>.png`.
7. Visually inspect the captured PNG; record verdict.

**Scenarios to capture** (each is a small ~3-5 frame walkthrough):

| ID | Contract | Captures |
|---|---|---|
| **A1** wrong country reveal | wrong country flashes red/highlight; target highlights green/correct; country panel slides in; Continue button visible; HUD reveal line | Pre-submit, reveal mid, panel-entering, panel-idle |
| **A2** correct country reveal | no panel; HUD "Correct!"; camera at target; auto-advance ~3s | Reveal mid, pre-advance, post-advance |
| **A3** city wrong-guess arc | dashed geodesic arc from click → target; target marker; HUD reveal line; auto-advance ~200ms | Arc mid, arc end + marker, post-advance |
| **A5** globe rotates toward target | pre-position camera far from target; submit; camera pans toward target during reveal | Pre-pan, pan mid, pan end |
| **A6** reduced motion (instant) | with `reducedMotion: 'reduce'`: highlights snap, no slide, no arc animation | A1-reduce final, A3-reduce final |
| **A7** rapid Continue (visual sanity) | clicks Continue during slide-in; verify graceful unmount, no jank | Click moment, mid-unmount, next round HUD |

### Task 3.3: The report

Create `docs/testing/animation-verification-2026-05-13.md` with the scaffold below; fill it in as captures progress.

```markdown
# Animation Visual Verification Report

Date: 2026-05-13
Build: dev server with VITE_TEST_HOOKS=1, viewport 1280×800
Method: Playwright MCP walkthrough in interactive session; captures keyed on
state signals (data-animation-state, getSession poll, role attached) rather
than wall-clock timestamps.
Reviewer: Claude (inline)

## Scope

Verifies Section A of game-unhappy-paths.md against live observation. Each
scenario lists the contract, the captured screenshots, and a per-frame note
on whether the visual matches the contract.

Verdict legend: ✅ matches contract, ⚠️ matches with caveat, ❌ deviates.

## Scenario A1 — Wrong country guess

Contract:
- Clicked (wrong) country: red/wrong-color flash on its polygon
- Target country: green/correct-color highlight
- Country panel slides in from the side
- "Continue" button visible inside panel
- HUD reveal line displays the result

Captures:
| Frame | File | Note |
|---|---|---|
| Pre-submit | a1-00-pre.png | <fill in> |
| Reveal mid | a1-01-reveal-mid.png | <fill in> |
| Panel entering | a1-02-panel-entering.png | <fill in> |
| Panel idle | a1-03-panel-idle.png | <fill in> |

Verdict: <fill in>

## Scenario A2 — Correct country guess

Contract:
- Target country highlights as correct (no wrong-flash)
- HUD: "Correct! +100 points"
- NO country panel opens
- Auto-advance at ~3s

Captures:
| Frame | File | Note |
|---|---|---|
| Reveal mid | a2-01-reveal-mid.png | <fill in> |
| Pre-advance | a2-02-pre-advance.png | <fill in> |
| Post-advance | a2-03-post-advance.png | <fill in> |

Verdict: <fill in>

## Scenario A3 — City wrong-guess arc

Contract:
- Dashed geodesic arc from click point to target city
- Target marker at city centroid
- HUD: "Far X km" / "Near X km" / "Spot on!"
- Auto-advance ~200ms

Captures:
| Frame | File | Note |
|---|---|---|
| Arc mid | a3-01-arc-mid.png | <fill in> |
| Arc end + marker | a3-02-arc-end.png | <fill in> |
| Post-advance | a3-03-post-advance.png | <fill in> |

Verdict: <fill in>

## Scenario A5 — Globe rotates toward target

Contract:
- Camera pans from current center toward target during reveal
- Pan completes within REVEAL_MS_COUNTRY (~1.2s visual)

Captures:
| Frame | File | Note |
|---|---|---|
| Pre-pan | a5-01-pre.png | <fill in> |
| Pan mid | a5-02-pan-mid.png | <fill in> |
| Pan end | a5-03-pan-end.png | <fill in> |

Verdict: <fill in>

## Scenario A6 — Reduced motion

Contract:
- With prefers-reduced-motion: reduce, no slide-in animation, no arc animation
- Highlights and reveal line appear instantly

Captures:
| Frame | File | Note |
|---|---|---|
| A1 reduce final | a6-a1-final.png | <fill in> |
| A3 reduce final | a6-a3-final.png | <fill in> |

Verdict: <fill in>

## Scenario A7 — Rapid Continue (visual sanity)

Contract:
- Continue click during slide-in produces a graceful unmount, no visual jank

Captures:
| Frame | File | Note |
|---|---|---|
| Click moment | a7-01-click.png | <fill in> |
| Mid-unmount | a7-02-mid-unmount.png | <fill in> |
| Next round HUD | a7-03-next-round.png | <fill in> |

Verdict: <fill in>

## Findings

- ✅ scenarios: <list>
- ⚠️ scenarios: <list with notes>
- ❌ scenarios: <list with deviation details>

## Disposition

For each ❌:
- If trivial CSS/single-line fix: applied in this branch (commit SHA <fill>)
- If > 3 files or > 2 hours: opened issue #<fill>, deferred to separate plan

For each ⚠️: noted in unhappy-paths.md follow-up commits if the contract needs amendment.
```

### Task 3.4: Walkthrough + report (interactive)

This is the labor-intensive step. The driver:

- [ ] Starts the dev server (if not already running).
- [ ] Navigates to about:blank → cold cold-load each scenario per Task 3.2.
- [ ] Captures the 3-5 screenshots per scenario.
- [ ] After each scenario, fills in the report's Note column and Verdict line.
- [ ] When all scenarios captured, aggregates the Findings section.
- [ ] Applies any in-scope fixes (commit on `docs/animation-verification-2026-05-13` branch).
- [ ] Opens issues for any out-of-scope deviations.
- [ ] Commits the report + screenshots:

```bash
git add docs/testing/animation-verification-2026-05-13.md docs/testing/screenshots/2026-05-13/
git commit -m "$(cat <<'EOF'
docs: animation visual verification report — 2026-05-13

Captured screenshots at state-signaled frames for each Section A scenario
from game-unhappy-paths.md; per-scenario verdicts and any in-scope fixes
applied on this branch.

Findings:
- ✅: <count>
- ⚠️: <count> (notes in report)
- ❌: <count> (fixed inline / issues opened — see report Disposition)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin docs/animation-verification-2026-05-13
gh pr create --title "docs: animation visual verification report" --body "..."
```

### Task 3.5: Update unhappy-paths.md if needed

If Phase 3 found any contracts that needed amendment (⚠️ findings), update `docs/testing/game-unhappy-paths.md`'s Section A in the same PR. Each amendment cites the captured evidence (link to specific screenshot in the report).

---

## Section 4 — Out of scope

- Frame-by-frame video recording (marginal over state-signaled screenshots)
- Animation timing constants unit tests (REVEAL_MS_* — already covered indirectly by reveal-animation.spec.ts)
- Forced-colors / Windows HC mode for reveal (deferred from 2026-05-12 plan)
- Mobile-viewport reveal screenshots (mobile-chromium/webkit not in CI matrix)
- Live-region timing during animations (axe coverage when re-enabled on CI)
- Architectural fixes touching > 3 files or > 2 hours (escalation per guardrail)

---

## Sequencing & critical path

The three phases are independent. Recommended order:

1. **Phase 1** first (smallest, most certain) — 1 PR
2. **Phase 2** second — 1 PR; if any test fails, treat as a Phase-3-style finding
3. **Phase 3** in current session, with possible inline fixes — 1 PR

If executed via subagent-driven-development, Phase 3's interactive capture work goes inline in the calling session, not a subagent — Playwright MCP is session-scoped.

---

## Self-review

**Spec coverage:**
- Phase 1: all 5 share branches (success, abort, generic fail, missing share, clipboard fail) + 2 copy-link cases. Maps 1:1 to the `DailyShareBlock.tsx:19-49` control flow.
- Phase 2: 4 interrupt cases covering correct/wrong reveal states and 2 abort actions (Continue, Escape) + hash-mutation case.
- Phase 3: Section A scenarios A1, A2, A3, A5, A6, A7. A4 (city skip — no arc) is implicitly covered as the contrast in A3 ("with arc"). A8/A9/A10 are non-visual or covered by Phase 2.

**Placeholder scan:** `<fill in>` markers in Task 3.3 are intentional — fillable in Task 3.4. Each `<fill in>` is preceded by an explicit method for how to fill it.

**Type consistency:** `getSession` from `e2e/helpers.ts` returns `SessionSnapshot = Omit<GameSession, 'used'>` — used consistently. `__PLAYWRIGHT__` flag set in `addInitScript` per the existing pattern.

**Risk acknowledgement:** Phase 2 test 1 (rapid Continue during slide-in) may fail on first run if the Continue button isn't hit-testable during the animation — that would be a real bug. The plan calls for STOP-and-report on first-run failure rather than auto-fixing.
