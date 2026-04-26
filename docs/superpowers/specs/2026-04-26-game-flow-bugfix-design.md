# Game-flow bugfix — design

**Date:** 2026-04-26
**Author:** Tobias Ens (with Claude)
**Status:** Spec — pending implementation plan

## Summary

A targeted fix for the cluster of bugs surfaced in the 2026-04-25 critical assessment of the game and retention layer. Most of the user-visible problems trace back to one structural seam: the `useGameSession` reducer splits a single logical "the user made a guess" event into two actions (`recordAttempt` + `submitGuess`) with subtly different semantics. Daily best-of-3 falls into the gap.

This spec collapses the seam, wires a "Done" button to the previously-orphaned `revealEarly` action (renamed `completeNow`), persists in-progress daily attempts to localStorage so refresh and accidental Escape no longer forfeit, and cleans up a long tail of telemetry, accessibility, copy, and documentation drift.

One PR. Daily mode is preserved and improved — not removed.

## Findings addressed

Numbering follows the 2026-04-25 final assessment (`docs/notes/` if archived; otherwise the prior conversation log). Findings deleted in this spec:

| # | Finding | Mechanism |
|---|---|---|
| 1+21 | Daily best-of-3 has no per-attempt feedback and no early exit | Per-attempt color flash + `Done` button → `completeNow` |
| 2 | `lastOutcome.reveal` shows the final attempt while score reflects the best | Reducer derives `reveal: best.reveal` at round-end |
| 3 | HUD hides attempts-remaining in daily | New `AttemptsIndicator` component |
| 4 | `buildCountryDailyRound`/`buildCityDailyRound` throw on pool drift | Return `null`; caller toasts and returns to launcher |
| 5 | "Play again" silently flips daily into free-play | `GameOverOverlay` hides `Play again` when `isDaily` |
| 6 | Daily scores leak into `funworldmap-game-{mode}-bests` | Version bump (v1 → v2); v2 only written on free-play game-over |
| 7 | Tutorial copy says free-play rules in daily | Per-mode-and-attemptsPerRound copy variants |
| 8 | "−1 life" wording in daily | `livesDelta` ignored when `attemptsPerRound > 1`; `wrongDaily` copy variant |
| 9 | Card label hardcoded `TODAY` | Header text derived from `anchorDate === today` |
| 11 | `deep_link_opened.outcome` enum mismatch with docs | New enum: `start | resume | reveal | redirect`; `played` removed |
| 12 | `deep_link_opened` double-fires on `/reveal` | Single fire-point in `GameController` hash bootstrap |
| 13 | `outcome:'redirect'` never emitted | Bootstrap emits it on the future-date and already-played-redirect paths |
| 14 | `deep_link_opened` fired for country deep links | Both `useSelectedCountry` calls deleted |
| 15 | `daily_started` / `free_started` never fire on direct deep link | Moved to `GameController` bootstrap; Launcher drops its calls |
| 17 | `pruneOlderThan` exported, tested, never called | Wired into `useDailyHistory` initializer (90-day window) |
| 18 | Dead `playing` flag in `#game/<mode>/play` URLs | Removed from `HashState`; `parseHash` accepts both forms; `writeHash` emits short form |
| 22 | Calendar cell aria-label parses date as UTC | Local-date construction from split parts |
| 23 | `DailyRevealOverlay` is `aria-modal` with no focus management | Shared focus-trap util |
| 24 | Launcher focus trap only fires from first/last | Same shared util |
| 25a | Launcher initial focus silently misses | Cascading fallback: lastMode → first focusable → root |
| 25b | Silent clipboard failure in share | Toast on catch |
| A | Mid-daily Escape silently forfeits | Auto-resume covers refresh; Escape still forfeits but resume key is cleared |
| B | Mid-daily refresh forfeits | New `funworldmap-daily-resume` key + `resume` reducer action |
| C | Skip in daily city-guessing is a visual no-op | Skip button hidden when `attemptsPerRound > 1` |
| E | `attempt` action doesn't reset `lastOutcome` | Subsumed by reducer collapse — `lastOutcome` is only written on round-end |

Findings 26 (docs/index missing game links), 27 (purpose.md "Not a comparison tool" line), and 28 (routing matrix `/play` mention) are bundled into the documentation pass (§3.1).

## Goals & non-goals

**Goals**
- Make daily best-of-3 a coherent UX: every attempt has visible feedback; the player chooses when to commit.
- Eliminate the structural reducer seam responsible for findings 1, 2, and the latent `lastOutcome` issue.
- Make refresh and Escape not delete in-progress attempts. Refresh resumes; Escape forfeits intentionally and clears the resume blob.
- Remove all known telemetry inconsistencies (double-fire, undocumented values, country-link pollution, missing direct-deep-link events).
- Bring documentation back into agreement with code in the three places it's drifted.

**Non-goals**
- No new game modes.
- No new daily content cadence or generator changes.
- No Cloudflare Worker schema migration. The `outcome` blob still stores a free-form string; the new enum just changes the strings written.
- No backward compatibility with the existing analytics dataset. Pre-cutover queries that pivot on `outcome:'played'` will not match post-cutover events; this is accepted (no live dashboards).
- No broader retention-layer rework. Streak, milestones, share, history calendar all keep their current behavior.

## Branch & PR

- **Branch:** `game-flow-bugfix`
- **PR title:** `Game flow bugfix — reducer collapse, daily resume, telemetry/a11y cleanup`
- **One PR, sequenced commits** so a regression can be bisected:
  1. `refactor(game): collapse recordAttempt and submitGuess into a single attempt action`
  2. `feat(game): add completeNow action and Done HUD button for best-of-N rounds`
  3. `feat(game): per-attempt color feedback in daily best-of-3`
  4. `feat(daily): persist currentAttempts to localStorage and resume on refresh`
  5. `feat(hud): AttemptsIndicator + per-mode copy variants + lives-zeroing in best-of-N`
  6. `fix(launcher): hide Play-again for daily; per-date card label; cascading focus`
  7. `fix(routing): null-return on pool-mismatch; drop dead playing flag`
  8. `chore(telemetry): redesign deep_link_opened; relocate started events; drop country-link fires`
  9. `chore(storage): bump game-bests v1→v2; wipe v1 on first load; wire pruneOlderThan`
  10. `fix(a11y): shared focus-trap util; calendar local-date label; share clipboard toast`
  11. `docs: update daily-puzzle.md, overview.md, index.md, purpose.md`

## §1 — State machine, HUD, persistence

### 1.1 Reducer collapse (`src/game/shared/useGameSession.ts`)

Action set goes from `start | attempt | guess | revealEarly | advance | overrideRound | endGame` to `start | attempt | completeNow | resume | advance | overrideRound | endGame`.

`attempt` carries both the `input` and the pre-computed `result: ModeGuessResult` from the provider (the provider keeps calling `mode.onGuess`; the reducer stays decoupled from `mode`). The reducer decides whether the round ends:

```ts
roundEnds = state.attemptsPerRound === 1 || remaining === 0
```

When the round ends, the reducer derives `best` from `currentAttempts ∪ {newAttempt}` (max by `pointsEarned`) and writes:

```ts
const livesDelta = state.attemptsPerRound === 1 ? result.livesDelta : 0
const nextLives  = Math.max(0, state.lives + livesDelta)
const nextStreak = best.pointsEarned >= 100 ? state.streak + 1 : 0
const endsGame   = state.maxRounds !== null
                     ? state.roundIndex + 1 >= state.maxRounds
                     : nextLives <= 0

lastOutcome = {
  pointsEarned: best.pointsEarned,
  livesDelta,
  endsGame,
  reveal: best.reveal,
}
```

`reveal: best.reveal` is the load-bearing line. It guarantees the round-end animation matches the score. The streak computation now uses `best.pointsEarned` rather than the final attempt's points — in best-of-N this means a perfect first attempt followed by misses still counts as a streak hit.

`completeNow`: same end-of-round derivation as `attempt` with `remaining===0`, but doesn't append a new attempt. No-op if `currentAttempts.length === 0`. Used by the Done button.

`resume`: takes `{ modeId, round, attemptsPerRound, attempts }` and constructs `{ status:'playing', currentAttempts:attempts, attemptsRemaining: attemptsPerRound - attempts.length, ... }`. Used exclusively by the daily-resume bootstrap. Reducer rejects (no-op) if `attemptsPerRound <= 1` (free-play has no resume) or if `attempts.length >= attemptsPerRound` (the saved blob is already complete and should have been cleared).

**Configuration guard.** The combination `attemptsPerRound > 1 && maxRounds === null` is structurally unsupported by this design — the round-end branch zeroes `livesDelta`, so `nextLives` never decreases, and `endsGame` falls through to `nextLives <= 0` which is permanently false. The `start` action rejects this combination with a console error in dev (TypeScript type narrowing covers production callers since both `getCountryPinningMode` and `getCityGuessingMode` set explicit `maxRounds`). Future modes with best-of-N over multiple rounds must declare a finite `maxRounds`.

**Helper cleanup.** The existing `bestPoints(attempts)` helper is removed; the inline `attempts.reduce(...)` in the `attempt` and `completeNow` branches subsumes it.

The provider's `submitGuessInput` becomes:

```ts
const submitGuessInput = useCallback((input: GuessInput) => {
  if (!mode || session.status !== 'playing' || !session.currentRound) return
  const result = mode.onGuess(input, session.currentRound)
  dispatch({ type: 'attempt', input, result })
}, [mode, session.status, session.currentRound])
```

Streak semantics in best-of-N: streak still increments only when `best.pointsEarned >= 100`. Daily-mode HUD doesn't render streak, so this only affects free-play. Unchanged.

### 1.2 HUD changes

New `src/game/shared/hud/AttemptsIndicator.tsx`. Three pip dots (filled = used, hollow = remaining) + inline `Best so far: X` when `currentAttempts.length > 0`.

`HudShell.tsx` selector:

```
attemptsPerRound > 1                    → AttemptsIndicator + (RoundCounter if maxRounds > 1)
attemptsPerRound === 1, maxRounds null  → LivesIndicator + StreakBadge
attemptsPerRound === 1, maxRounds > 1   → RoundCounter
```

New "Done" button in the HUD shell, rendered as a primary teal button distinct from the existing "End game" underline link. Renders only when `attemptsPerRound > 1 && currentAttempts.length > 0`. Dispatches `completeNow`. The visual hierarchy is intentional: Done is a commit action, End-game is a quit action — the former is the expected path, the latter is the escape hatch.

**Per-attempt feedback** in `GameController.tsx`'s intermediate-reveal effect:

```ts
const last = session.currentAttempts.at(-1)
if (last.reveal.kind === 'country') {
  const colour = last.reveal.correct ? '#22c55e' : '#f59e0b'
  // existing setFilter / setPaintProperty path with the new colour
}
if (last.reveal.kind === 'point') {
  const d = last.reveal.distanceKm
  const colour = d != null && d < 50 ? '#22c55e' : d != null && d < 500 ? '#f59e0b' : '#ef4444'
  // existing marker render with the new colour
}
```

Plus a 1s "+X pts" floating toast above the AttemptsIndicator (`role="status" aria-live="polite"`). The toast is the secondary signal channel for color-blind users: even if the green/orange/red flash is indistinguishable, the numeric score on the toast disambiguates correct from wrong.

**Reduced motion.** When `prefersReducedMotion()` is true, the color flash duration drops to 0ms (color is set, then cleared in the same effect tick) and the toast appears without slide-up animation. The colors themselves still apply — they're informational, not decorative.

**Mobile layout.** The HUD shell on mobile centers a single column. With Done + End-game both rendered during best-of-N, the row wraps to two lines on narrow screens (≤ 360 CSS px). Acceptable — no visual regression expected against today's single "End game" link.

### 1.3 Copy

- `country-pinning/messages.ts`: add `wrongDaily(points, target, clicked)` without "−1 life". `CountryPinningHud` selects between `wrong` and `wrongDaily` on `session.attemptsPerRound`.
- `FirstSessionTutorial.tsx`: copy split by mode AND by `attemptsPerRound`. Keys: `country-pinning-free`, `country-pinning-daily`, `city-guessing-free`, `city-guessing-daily`.
- `LauncherModeCard.tsx`: header label is `TODAY · COUNTRY` only when `anchorDate === today`. Otherwise `Apr 20 · Country` from a small formatter.

### 1.4 Persistence

**New key:** `funworldmap-daily-resume`

```ts
interface DailyResumeV1 {
  version: 1
  date: string                  // YYYY-MM-DD
  modeId: ModeId
  attempts: AttemptRecord[]     // shared/types AttemptRecord with input + reveal
}
```

Stored in `src/game/daily/resume.ts` alongside `storage.ts`. Functions: `readResume()`, `writeResume(value)`, `clearResume()`. Same `try/catch` discipline as existing storage.

**Lifecycle, all in `GameController.tsx`:**

- *Write:* effect on `[session.status, session.currentAttempts, session.modeId, session.attemptsPerRound]` — when `status === 'playing' && attemptsPerRound > 1`, derive the current daily date from the hash and write the snapshot.
- *Read:* hash-bootstrap, when route is `daily/<date>/<mode>` and `dailyHistoryGet(date, mode) === null`. If a resume blob matches `date + modeId`, dispatch `resume` instead of `start`. Emit `track('deep_link_opened', { dateKind:'today', outcome:'resume' })`.
- *Clear:* immediately *after* `writeHistory` returns successfully inside `recordDailyResult` (so a quota-exceeded write doesn't orphan a completed day with no record); on `endGame` dispatch (forfeit); on stale-date mismatch at read time.

**Daily-best leak fix.** In `GameController.tsx`'s game-over branch, the unconditional `record(session.score, session.bestStreak)` call (today on line 283) is gated on `parseHash(window.location.hash).kind !== 'daily'`. Daily plays no longer write to the per-mode personal-bests store. Combined with the v1 → v2 wipe below, this resolves finding #6 at both ends.

**Bests version bump:**

```ts
function keyFor(modeId: string): string {
  return `funworldmap-game-${modeId}-bests-v2`
}

function readSafely(modeId: string): PersonalBest {
  // First-load cleanup of v1 (one-time)
  try { localStorage.removeItem(`funworldmap-game-${modeId}-bests`) } catch { /* no-op */ }
  // Read v2
  ...
}
```

The v1 cleanup is idempotent (no-op once gone). No migration of v1 data — it's polluted by daily plays. The reducer collapse stops new daily plays from writing to bests at all (the daily branch in `GameController.tsx`'s game-over handler skips the `record(...)` call).

**`pruneOlderThan` wiring.** `useDailyHistory.ts` becomes:

```ts
const [history, setHistory] = useState<DailyHistoryV1>(() => {
  const raw = readHistory()
  const pruned = pruneOlderThan(raw, 90)
  if (pruned !== raw) writeHistory(pruned)
  return pruned
})
```

One-shot per mount on initial state derivation. Idempotent — pruning a clean history returns the same reference. Brings the existing doc claim ("Client prunes entries older than 90 days") into line with reality.

## §2 — Routing, telemetry, a11y

### 2.1 Routing

- `GameOverOverlay`: `Play again` button hidden when `parseHash(location.hash).kind === 'daily'`. Layout collapses to single full-width "Back to map" + share block.
- `dailyRound.ts`: both `buildCountryDailyRound` and `buildCityDailyRound` return `RoundSpec | null`. Callers (`GameController` bootstrap and deferred-start path) check for null, dispatch a toast `'Daily content unavailable — try again shortly'`, and fall through to the launcher.
- `hashState.ts`: `HashState.game` loses the `playing` flag. `parseHash` accepts both `game/<mode>` and `game/<mode>/play` (slices the suffix). `writeHash` emits the short form only.

### 2.2 Telemetry

`src/lib/analytics.ts`:

```ts
deep_link_opened: {
  dateKind: 'today' | 'past' | 'future'
  outcome: 'start' | 'resume' | 'reveal' | 'redirect'
}
```

`'invalid'` is removed from `dateKind` — `parseHash`'s `DATE_RE` filter makes it unreachable; carrying it in the type was historical residue.

Single fire-point: `GameController.tsx` hash bootstrap. The two existing fires in `App.tsx:272` and `DailyRevealOverlay.tsx:40` are deleted.

`useSelectedCountry.ts:33, 41`: both `track('deep_link_opened', ...)` calls deleted. No replacement.

`daily_started` and `free_started`: relocated to `GameController.tsx` bootstrap, fired the moment a fresh session starts via the hash path. The two calls in `Launcher.tsx:99, 110` are deleted — the launcher writes the hash and the bootstrap handles the rest.

### 2.3 Accessibility

- New util `src/lib/focusTrap.ts`: `installFocusTrap(rootEl)` returns a cleanup function. Catches Tab/Shift+Tab on the modal root and redirects to first/last focusable. Used by both `Launcher` and `DailyRevealOverlay`.
- `DailyRevealOverlay`: on mount, capture `document.activeElement`, focus the close button, install the trap. On unmount, restore the captured element. None of this exists today — implement fresh.
- `Launcher`: replace the first/last-only handler with `installFocusTrap`. Keep the existing close-on-Escape branch.
- `LauncherCalendarCell.ts:16`: parse via local-date construction:
  ```ts
  const [y, m, d] = date.split('-').map(Number)
  const local = new Date(y, m - 1, d)
  parts.push(local.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }))
  ```
- `Launcher.tsx:150-154`: cascade `lastMode CTA → first focusable → root`.

### 2.4 Share + skip

- `DailyShareBlock.tsx`: every silent `catch` becomes `dispatchToast('Couldn\'t copy — select and copy manually.')`. The `pre` element is already `select-all`.
- `CityGuessingHud.tsx:51`: skip button renders only when `session.attemptsPerRound === 1`.

## §3 — Documentation, testing, rollout

### 3.1 Doc updates

- `docs/systems/daily-puzzle.md`:
  - Storage section: document `funworldmap-daily-resume` (shape, lifecycle, clear conditions).
  - Routing matrix: replace `outcome` enum values; remove `/play` suffix mention.
  - Strike "DailyDayResult.attempts[] is always length 3 in steady-state play" — `completeNow` allows 1 or 2.
  - "Client prunes entries older than 90 days" — now true.
- `docs/systems/overview.md`: new "Game system" subsection (4-6 lines) pointing at the canonical files.
- `docs/index.md`: add a "Game" subsection under "Systems" linking to `daily-puzzle.md` and the new `overview.md` subsection.
- `docs/purpose.md`: line 51 — remove "(yet)" from "Not a comparison tool" and rephrase to acknowledge that compare is shipping.

### 3.2 No ADR

I considered a `0001-collapse-recordattempt-and-submitguess.md` ADR but `docs/adr/README.md` says: *"If the decision can live as a paragraph in a system doc under `docs/systems/`, prefer that. ADRs are for decisions that need to be discoverable as decisions."* The reducer collapse is internal to one file and won't recur as a contested choice — future contributors see the new shape and there's nothing to revisit.

Instead: a 4-line comment at the top of `useGameSession.ts` explaining the action set, plus the new "Game system" subsection in `docs/systems/overview.md` (already in §3.1) noting that best-of-N rounds are supported via `attemptsPerRound` + `completeNow`.

### 3.3 Testing

**Unit (Vitest)**

- `useGameSession.test.ts`:
  - `attempt` round-ends correctly across the three matrix cells (free-play country, free-play city, daily best-of-3).
  - `attempt` final attempt: `lastOutcome.reveal === best.reveal`, never the final attempt's reveal when the final wasn't best (regression for #2).
  - `completeNow`: derives best from `currentAttempts`; no-op when empty; transitions to `game-over` for daily (since `maxRounds=1`).
  - `resume`: reconstructs `attemptsRemaining` correctly across 1 and 2 prior attempts.
  - Lives only decrement when `attemptsPerRound === 1` (regression for the "−1 life" copy).
- `storage.test.ts`: existing tests retained. New file `resume.test.ts`: round-trip, stale-date discard, version mismatch, malformed JSON.
- `bestsKeyMigration.test.ts`: v1 key removed on first read; v2 absent → `ZERO`; round-trip on v2.

**Telemetry (Vitest)** — `analytics.test.ts` adds:
- `deep_link_opened` accepts and round-trips the four new outcome values via `__testAnalytics`.
- The country-deep-link removal: navigating to `#FRA` does NOT push a `deep_link_opened` entry.
- The single-fire invariant: visiting `#daily/<today>/reveal` results in exactly one `deep_link_opened` event with `outcome:'reveal'` (not the legacy two events with conflicting outcomes).

**E2E (Playwright)** — new spec `e2e/daily-best-of-3.spec.ts`:

- Three wrong → game-over with best score; reveal animation matches the *closest* (best-points) attempt, not the final one.
- One correct + two wrong → game-over with 100; animation paints green on the correct country.
- Click Done after one attempt → game ends with that attempt; no further input accepted.
- Refresh after one attempt → game resumes mid-attempt; AttemptsIndicator shows 1 used, 2 remaining.
- Press Escape after one attempt → resume key cleared; daily-history empty; reload returns to launcher.

Existing free-play e2e specs run unchanged. The reducer collapse is invisible at the user-facing seam.

**Test seams**

`__funworldmap_game.submitGuess` / `submitCountryGuess` / `setRound` keep working — they call `submitGuessInput` which now dispatches `attempt`. New seam: `__funworldmap_game.completeNow()`. All gated behind `VITE_TEST_HOOKS` per the 2026-04-25 hardening change (`b19cf56`).

### 3.4 Rollout

- One PR, eleven commits in load-bearing order.
- `funworldmap-game-{mode}-bests` v1 cleanup is automatic on first read post-deploy (one-time, idempotent).
- `funworldmap-daily-resume` is a new key — nothing to migrate.
- `funworldmap-daily-history` is unchanged.

**Soak window: 14 days post-merge.**

Watch (with explicit rollback gates, in priority order):

1. **Sentry error rate.** Spike above 2× baseline → investigate; if traced to `useGameSession` reducer paths or the resume effect, rollback.
2. **`outcome:'resume'` count.** Should be non-zero within 24 h of the first daily play after merge. **If zero across 48 h with daily plays continuing, the resume path is dead** — primary signal that the persistence layer never executes. Rollback gate.
3. **`daily_completed` event volume.** Should match or exceed the 14-day pre-merge baseline within ±20%. A drop > 50% suggests the new flow blocks completion; rollback gate.
4. **Forfeit rate** = `daily_started - daily_completed - resume`. A baseline forfeit rate exists today (Escape / End-game / refresh); the new design should *reduce* it. A *post-merge increase* > 10 percentage points is the diagnostic signal that the new copy / Done button / per-attempt feedback confused users — investigate, possibly soft-rollback the copy commit only.
5. **`deep_link_opened.outcome` distribution.** `'start'` and `'reveal'` should dominate; non-zero `'redirect'` proves the future-date and already-played paths still emit; non-zero `'resume'` per (2).

Rollback target for gates 1–3: the merge commit.

**Rollback procedure:** `git revert <merge-commit>` on `main`. The `funworldmap-game-{mode}-bests-v2` key persists (forward-incompatible with the v1 reader), so a rollback that re-introduces the v1 reader will re-show `ZERO` for any user who already wrote v2 — minor, accepted. The `funworldmap-daily-resume` key becomes orphaned; the v1 reader ignores it.

## Known limitations & open follow-ups

**In-spec but accepted (not bugs to fix here):**

- **Multi-tab daily play.** If a user opens the same daily in two tabs and completes in one, the other has no signal. Their next attempt overwrites the recorded result via `mergeDay`'s last-write-wins. First-write-wins detection (a `storage` event listener on the resume key) is feasible but adds code surface for a vanishingly rare path. Accepted; document under §3.4 on launch.
- **Mid-daily mode switch via URL hash.** Pre-existing: `GameController`'s hash listener only starts a fresh session when `status === 'idle'`, so manually editing the hash from `daily/<date>/country-pinning` to `daily/<date>/city-guessing` mid-game does nothing. Out of scope for this spec.
- **Color-blind-safe per-attempt feedback.** The "+X pts" toast is the secondary channel today. A shape/pattern variant on the country fill / city marker would be more accessible but is purely additive. Roadmap item.

**Punted to future specs:**

- A second-pass sweep on the polluted `funworldmap-game-{mode}-bests` for users who *want* their pre-cutover free-play scores migrated. Not built; no signal that anyone has asked.
- A confirm dialog on Escape during a daily best-of-3 with at least one attempt recorded. Today: silent forfeit + cleared resume blob. Acceptable v1 — if users complain, add the dialog as a follow-up spec.
