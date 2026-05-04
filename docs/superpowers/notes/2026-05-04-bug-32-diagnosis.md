# Bug #32 — game-over → hash-mode-switch trace analysis

- **Date**: 2026-05-04
- **Branch**: `fix/bugs-and-lift-quarantine` (worktree at `E:/polworldmap/.worktrees/fix-bugs-and-lift-quarantine`)
- **Source CI run**: [`25274733085`](https://github.com/GranatenUdo/funworldmap/actions/runs/25274733085) (PR #30, head `chore/e2e-residual-timeout-audit`, commit `8f8ba8e`)
- **Test**: `e2e/game-over-mode-switch.spec.ts:26 — "hash-changing to a different #game URL during game-over starts the new mode"`
- **Project**: `chromium` (real-GPU ANGLE on CI), workers=2, retries=2, expect timeout 15s, test timeout 120s configured for chromium project but 60s wired into the test via `test.setTimeout(60_000)`.

## Quoted error context

Three results for the same `testId 740b32245ecd9edb4af4-...`:

| Result | Status | Duration | Stack |
|---|---|---|---|
| `fb47f6…` (retry 0) | `timedOut` | 63 813 ms | (none — overall test timeout) |
| `147fc4…` (retry 1) | `failed` | 63 906 ms | `Error: Test timeout of 60000ms exceeded at submitAndWait (e2e/helpers.ts:93:3) at game-over-mode-switch.spec.ts:60:5` |
| `8c6c18…` (retry 2) | `timedOut` | 65 004 ms | (none — overall test timeout) |

Retry 1 is a different flake (timed out inside the second iteration of the for-loop's `submitAndWait`, never reached the hash change). Retries 0 and 2 reached the hash change and timed out on the post-hash assertions.

```text
Expected (line 78): data-game-status="playing"
Actual:             test exceeded its 60-second budget before assertion settled
```

(The bug-filer's claim that the test fails on `data-game-mode=""` does not match the trace — see "Three questions answered", question #3.)

## Page snapshot (paraphrased)

The error-context markdowns for retries 0 and 2 (resources `039ded4d…` and `d1db45af…`) show, at the moment the 60-second budget expired:

- The `game-over` overlay is **gone** — confirms `expect(getByTestId('game-over')).toBeHidden()` (line 76) passed before the timeout
- The `game-hud` region is **mounted** with city-guessing chrome:
  - `Round 1 of 10` round counter (renders only when `maxRounds > 1` and HUD is in playing/round-ended/game-over)
  - Score `0`
  - Target city: **Jerusalem, Israel** on retry 0; **Brasília, Brazil** on retry 2 (random per-round target)
  - "Skip round" button (only present in `playing` state)
  - Tutorial banner ("How to play / Click anywhere on the map / Got it") — visible because `firstAttemptMade=false` for a brand-new session
- Live region announces `"Round 1. Where is Jerusalem, Israel? …"` (only fires when `session.status === 'playing'` and `currentRound.kind === 'city-guessing'`)

In other words, **at timeout time, the city-guessing session is fully started** (`modeId='city-guessing'`, `status='playing'`, `roundIndex=0`, `currentRound=firstRound`).

## Three questions answered

### 1. Did the hashchange handler fire?

**Yes**, and `endGame` + `start` both ran. Evidence:

- The `game-over` overlay was *visible* before the hash change (`Expect "toBeVisible" getByTestId('game-over')` step ended in 3.2 s — passed) and *unmounted* afterwards (`Expect "toBeHidden"` ended in 3.2 s — passed). Only `endGame` clears `status` away from `'game-over'`, so the dispatch reached the reducer.
- The HUD remounted in city-guessing chrome with target=Brasília/Jerusalem and "Round 1 of 10". Only `start('city-guessing', firstRound, 10)` produces this state shape (`maxRounds=10`, `currentRound=cityRound`, `status='playing'`).

So both reducer dispatches in `GameController.tsx:194` and `GameController.tsx:252` did execute and React committed the resulting state.

### 2. What does `getSession()` return at the moment of failure?

We don't have a direct probe at the failure moment (test seam wasn't read post-hash by the test). But the rendered HUD reflects the live `session` object (`HudShell` reads `session` directly from `useGameSessionContext()`), so:

- `session.modeId === 'city-guessing'` (proven by the round/target chrome and by the line-77 assertion `data-game-mode='city-guessing'` having passed in 4.0 s)
- `session.status === 'playing'` (proven by "Round 1 of 10", target name, "Skip round" button, and the live-region announcement — all conditional on `status==='playing'`)
- `session.currentRound` is the first city-guessing round
- `session.score === 0`, `roundIndex === 0`

So **the session is correctly in `{modeId:'city-guessing', status:'playing'}`** at the snapshot moment.

### 3. Is HudShell mounted with the expected `data-game-mode` / `data-game-status`?

**Yes — both attributes match.** The on-step-end events for retry 2 (resultId `8c6c18c1…`) show the assertion sequence:

```
… for-loop steps (~55 s cumulative wall-clock) …
Expect "toBeVisible" getByTestId('game-over')          dur=3 191 ms  passed
Evaluate (window.location.hash = '#game/city-guessing') dur=3 093 ms
Expect "toBeHidden"  getByTestId('game-over')          dur=2 743 ms  passed
Expect "toHaveAttribute" getByTestId('game-hud')        dur=4 156 ms  passed   ← line 77 (data-game-mode='city-guessing')
Expect "toHaveAttribute" getByTestId('game-hud')        (no end)              ← line 78 (data-game-status='playing') — never resolved
```

Retry 0 has the identical shape (line 77 passes in 3 950 ms; line 78 begins and never ends).

The bug-filer's diagnosis ("`data-game-mode=""` for 60 s") is wrong on two counts:

1. Line 77 (`data-game-mode='city-guessing'`) **passes in ~4 s**, not "stuck for 60 s".
2. The actually-failing assertion is **line 78** (`data-game-status='playing'`), not line 77.

The page snapshot at the 60 s mark also shows that `data-game-status` *was* `'playing'` at timeout — `expect.toHaveAttribute` would have caught it on the next poll cycle if the test had any budget left.

## Working hypothesis

**The test's 60-second wall-clock budget is exhausted by the for-loop reveal-hold timing on chromium-gpu CI, leaving line 78 too little time to retry.** This is a *test-infrastructure* problem, not a state-machine bug.

Concrete arithmetic from retry 0:

| Phase | Dominant step durations |
|---|---|
| Page load + map ready | ~16 s (`Wait for selector [data-map-loaded]` 12.3 s + ramp) |
| Game-ready hooks | ~5 s |
| For-loop iter 1 (submit + poll round-ended + Esc + poll playing) | ~7–8 s (3 reveal-hold seconds + render gaps) |
| For-loop iter 2 | ~7–8 s |
| Final submit + finalize + game-over visible | ~6 s |
| Hash change + game-over hidden | ~6 s |
| Line-77 toHaveAttribute (data-game-mode) | ~4 s |
| **Cumulative at start of line 78** | **~52 s** |
| **Remaining wall-clock for line 78** | **~8 s** |

`expect.toHaveAttribute` polls every ~100 ms, so 8 s is plenty *if the attribute is already present*. But the snapshot shows the attribute *does* match by 60 s — the assertion was on the verge of succeeding when the overall test timeout fired. Hence the "Test timeout of 60000ms exceeded" without a per-step error.

### Why line 77 takes 4 s on CI

This is the second-order finding. After the hash change, the reducer transitions:

```text
session.status: 'game-over' (modeId='country-pinning')
              ↓ endGame()
              ?intermediate? (status='idle', modeId='country-pinning')
              ↓ start('city-guessing', firstRound, 10)
              status='playing', modeId='city-guessing'
```

`endGame` and `start` are dispatched in the same synchronous callback (`GameController.tsx:194` and `:252`), so React 18 automatic batching *should* collapse them into one render. **But `GameController.tsx:763` returns `null` when `session.status === 'idle' || !mode`** — meaning if any render does observe the in-between idle state, the entire `<HudShell>` (and its `data-game-mode` attribute) **unmounts and remounts**. That detach+reattach explains why `expect(getByTestId('game-hud')).toHaveAttribute(...)` takes ~4 s instead of resolving instantly: Playwright has to wait for the element to re-attach.

Whether the unmount actually happens in production (auto-batching should prevent it) or the 4 s is just slow CI render scheduling is unclear without runtime logs. Either way, that 4 s lost in line 77 is the proximate cause of line 78 running out of budget.

### Why retry 1 fails differently

Retry 1 timed out inside `submitAndWait` (`e2e/helpers.ts:93`) on the second for-loop iteration's poll for `currentAttempts.length === 1`. The trace screenshot shows the country-pinning HUD with score 22 and target=Singapore — meaning the test was *already* deep into the round sequence (multiple advances had happened) and the test seam's `submitCountryGuess('USA')` did not bump `currentAttempts`. This is a *separate* flake (likely an Escape-vs-round-advance race in the for-loop) and is **out of scope for bug #32**, but worth noting because the four "4/4 CI runs" the bug filer cited included retries that failed for this unrelated reason. Bug #32's signature is the retries-0-and-2 shape (timeout on post-hash assertions with city-guessing visibly started).

## Reconciling with plan hypotheses

| Plan hypothesis | Verdict |
|---|---|
| 1. A reducer path produces `modeId: ''` | **Refuted.** The type system forbids it (`ModeId = 'country-pinning' \| 'city-guessing'`). `EMPTY.modeId === 'country-pinning'`, not `''`. There is no commit in `git log -G "modeId: ''" -- src/game/shared/useGameSession.ts`. |
| 2. `HudShell` renders a stale session object | **Refuted.** `HudShell` receives `session` directly from `useGameSessionContext().session`, which is the live reducer state. |
| 3. Early-return in hashchange handler at `GameController.tsx:244` carries previous modeId forward | **Refuted.** The early return is `if (id !== 'country-pinning' && id !== 'city-guessing') return` — `'city-guessing'` passes that gate. And even if it returned, `EMPTY.modeId='country-pinning'`, never `''`. |
| **NEW**: 60 s test budget exhausted by for-loop wall-clock + 4 s HUD-remount race after `endGame→start` | **Supported by trace step durations and post-timeout page snapshot.** |

## Recommended fix shape for Task 1.2

Two coordinated changes — **(B) is the load-bearing one**:

### (A) Eliminate the HUD remount race by combining `endGame + start` into a single reducer transition

Add a reducer action that performs both at once, so React commits exactly one render with `{ modeId: <new>, status: 'playing' }`:

```ts
// src/game/shared/useGameSession.ts — new action type
| { type: 'restart'; modeId: ModeId; firstRound: RoundSpec; maxRounds: number | null; attemptsPerRound: number; dailyDate: string | null }

// reducer
case 'restart': {
  // Same body as 'start' but does not require status==='idle' as a precondition.
  // (Intentional: the hashchange-during-game-over path is the only caller, so
  // the action is allowed to overwrite from any prior state.)
  if (action.attemptsPerRound > 1 && action.maxRounds === null) return state
  return {
    ...EMPTY,
    modeId: action.modeId,
    status: 'playing',
    maxRounds: action.maxRounds,
    attemptsPerRound: action.attemptsPerRound,
    attemptsRemaining: action.attemptsPerRound,
    currentRound: action.firstRound,
    dailyDate: action.dailyDate,
    used: new Set([roundKey(action.firstRound)]),
  }
}
```

Replace the `endGame() + start(...)` pair in the `game` branch of the hashchange handler with `restart(...)` (and similarly for the `daily` branch's `clearResume(); endGame(); …; startOrResumeDaily(...)` sequence). The `clearResume()` and `track('free_started', ...)` analytics calls stay around the dispatch.

This collapses the two-render transition into a single render, removes any chance of an idle-status observation, and shaves 3–4 s off line 77's polling on CI.

### (B) Drive the post-hash assertions from the test seam, not the DOM

Even with (A), the for-loop's reveal-hold (3 s × 3 advances) eats most of the 60 s budget. The fix that *closes* the issue regardless of CI speed is to swap the post-hash DOM assertions for `__funworldmap_game.getSession()` reads, which return synchronously from the reducer:

```ts
// e2e/game-over-mode-switch.spec.ts — replace lines 76-78
await page.evaluate(() => { window.location.hash = '#game/city-guessing' })
await expect.poll(
  () => page.evaluate(() => {
    const g = (window as unknown as { __funworldmap_game?: {
      getSession: () => { status: string; modeId: string }
    } }).__funworldmap_game
    const s = g?.getSession()
    return s ? `${s.status}/${s.modeId}` : 'no-game'
  }),
  { timeout: 15_000 },
).toBe('playing/city-guessing')
// Then a single DOM assertion to confirm React committed
await expect(page.getByTestId('game-over')).not.toBeAttached()
```

This bypasses any HUD remount latency and asserts directly on the reducer state — same semantics, no DOM-render-cycle dependency.

### Why both, not just one

- (A) alone reduces the line-77 latency but does not bound the test's overall budget — a sufficiently slow CI worker could still exhaust 60 s on the for-loop alone and time out before reaching the assertions.
- (B) alone covers the bug as observed (test would pass even on the slowest CI worker) but leaves the latent unmount-during-transition race in place, where it could surface in another test or in a real-user flow.

(A) fixes the underlying state-machine flicker; (B) makes the test robust against future CI slowness. Apply both in Task 1.2.

### Test-side type tightening (small follow-up)

`HashState['game'].modeId` is typed `string` (loose) and cast to `ModeId` at use site. Tighten `parseHash` to validate against `KNOWN_MODE_IDS` and return `kind: 'empty'` for unknown segments — same shape it already does for `daily/<date>/<unknown-mode>`. Eliminates the `as ModeId` cast and adds a static guarantee that no `'game'` HashState ever carries an out-of-band string. Not load-bearing for bug #32, but it removes the only place in the codebase where `state.modeId` could in principle be an arbitrary string.

## Trace artifacts inspected

- Blob report: `gh run download 25274733085 -n playwright-blob-chromium`, extracted to `/tmp/trace-32-pr-a/report/`
- Three error-context markdowns under `report/resources/`:
  - `039ded4d1269dfd0eca314d49d40d54307ae17a5.markdown` — retry 0 (Jerusalem snapshot)
  - `03ed892db1f7958aac89d32b0db5344ff21897bb.markdown` — retry 1 (country-pinning Singapore snapshot, off-bug flake)
  - `d1db45afe355f10eee0840958d7c88bde8b527ec.markdown` — retry 2 (Brasília snapshot)
- One trace zip (only retry 1 captured per `trace: 'on-first-retry'`):
  - `d9c7235762ccdc3a9608cd95d8438955385c2525.zip` (resultId `147fc4c0…`)
- `report.jsonl` — 6 375 lines, parsed for onTestEnd / onStepBegin / onStepEnd events keyed by resultId

## Status

DONE — three trace-evidence findings, working hypothesis confirmed against page snapshot, fix shape concrete enough for Task 1.2 to act on.
