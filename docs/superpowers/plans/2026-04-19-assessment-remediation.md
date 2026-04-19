# Assessment Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land every finding from the 2026-04-19 repository review across two sequential PRs; archive completed plans to align with the stated forward-plan convention.

**Architecture:** PR 1 is low-risk (docs, UX strings, test coverage). PR 2 is medium-risk (provider restructure to remove `window.__funworldmap_guess`; border-opacity regression fix; game-over focus management). Each phase is one or two commits; PR 2 opens only after PR 1 is green on `main`.

**Tech Stack:** TypeScript 5.7, React 19, Vite 6, MapLibre GL 5.23, Fuse.js 7, Playwright 1.59, Vitest 4, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-04-19-assessment-remediation-design.md` (committed `d1b0950`).

---

## Pre-flight

### Task 1: Verify clean state and create PR 1 branch

**Files:** none (git state only).

- [ ] **Step 1: Verify working tree is clean**

Run: `git status`
Expected: *"nothing to commit, working tree clean"* on `main`.

- [ ] **Step 2: Pull latest main**

Run: `git pull origin main`
Expected: *"Already up to date."* or fast-forward.

- [ ] **Step 3: Run baseline checks**

Run: `npm run lint && tsc -b && npm run test:unit`
Expected: zero warnings, zero errors, all unit tests pass.

- [ ] **Step 4: Create branch**

Run: `git checkout -b chore/assessment-remediation-pr1`
Expected: *"Switched to a new branch 'chore/assessment-remediation-pr1'"*.

---

## Phase 0 — Archive completed plans

### Task 2: Move 13 completed plan files into `archive/`

**Files:**
- Move: `docs/superpowers/plans/*.md` → `docs/superpowers/plans/archive/` (except this new forward plan)

- [ ] **Step 1: Create the archive directory and move files**

Run:
```bash
mkdir -p docs/superpowers/plans/archive
git mv docs/superpowers/plans/2026-04-15-bugfix-and-proper-tests.md docs/superpowers/plans/archive/
git mv docs/superpowers/plans/2026-04-15-phase-0-repository-foundation.md docs/superpowers/plans/archive/
git mv docs/superpowers/plans/2026-04-16-fix-ci-bugs-and-perf.md docs/superpowers/plans/archive/
git mv docs/superpowers/plans/2026-04-16-globe-terrain-navigation.md docs/superpowers/plans/archive/
git mv docs/superpowers/plans/2026-04-16-polish-keyboard-compare.md docs/superpowers/plans/archive/
git mv docs/superpowers/plans/2026-04-16-production-readiness-100k.md docs/superpowers/plans/archive/
git mv docs/superpowers/plans/2026-04-16-rename-and-publish-funworldmap.md docs/superpowers/plans/archive/
git mv docs/superpowers/plans/2026-04-17-chromium-gpu-on-linux.md docs/superpowers/plans/archive/
git mv docs/superpowers/plans/2026-04-17-findings-implementation-and-voting-removal.md docs/superpowers/plans/archive/
git mv docs/superpowers/plans/2026-04-18-country-pinning-game.md docs/superpowers/plans/archive/
git mv docs/superpowers/plans/2026-04-18-deferred-cleanups.md docs/superpowers/plans/archive/
git mv docs/superpowers/plans/2026-04-18-satellite-default.md docs/superpowers/plans/archive/
git mv docs/superpowers/plans/2026-04-19-city-guessing-mode.md docs/superpowers/plans/archive/
```

- [ ] **Step 2: Verify the move**

Run: `ls docs/superpowers/plans/`
Expected: `2026-04-19-assessment-remediation.md` and `archive/` only.

Run: `ls docs/superpowers/plans/archive/ | wc -l`
Expected: `13`.

### Task 3: Document the archive convention in `docs/superpowers/README.md`

**Files:**
- Modify: `docs/superpowers/README.md`

- [ ] **Step 1: Add archive subsection**

Append to `docs/superpowers/README.md`, after the existing "Plans Are Forward-Looking" section:

```markdown
## Archive

Completed plans live under `plans/archive/`. Moving a plan to `archive/` is the signal that its work has shipped. Keep the filename (`YYYY-MM-DD-<slug>.md`) — any back-links from other docs update to the new path.

Forward plans (active or not-yet-started) live directly under `plans/`. At most one forward plan per concurrent work stream; archive it when it lands.
```

### Task 4: Update the one back-link in `docs/roadmap.md`

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Find the plan link**

Run: `grep -n "superpowers/plans/2026-04-16-fix-ci-bugs-and-perf.md" docs/roadmap.md`
Expected: one match.

- [ ] **Step 2: Update the link**

Edit `docs/roadmap.md`, replacing the path `superpowers/plans/2026-04-16-fix-ci-bugs-and-perf.md` with `superpowers/plans/archive/2026-04-16-fix-ci-bugs-and-perf.md`.

- [ ] **Step 3: Verify no other plan links remain at the top level**

Run: `grep -rn "superpowers/plans/" docs/ | grep -v archive | grep -v 2026-04-19-assessment-remediation`
Expected: zero results.

### Task 5: Commit Phase 0

- [ ] **Step 1: Commit**

Run:
```bash
git add docs/superpowers/plans/ docs/superpowers/README.md docs/roadmap.md
git commit -m "$(cat <<'EOF'
docs(plans): archive completed plans

Move 13 shipped plans to docs/superpowers/plans/archive/ per the
forward-plan convention. Document the archive layout in
docs/superpowers/README.md. Update the roadmap back-link.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1 — User-visible string + UX fixes

Seven sub-changes; lands as one commit after all tests green. Test-driven where behavior is verifiable.

### Task 6: Extend types — add `clickedName` to `CountryReveal` and `name` to country `GuessInput`

**Files:**
- Modify: `src/game/shared/types.ts`

- [ ] **Step 1: Add `clickedName` to `CountryReveal`**

Edit `src/game/shared/types.ts`, replace the `CountryReveal` type block with:

```ts
export type CountryReveal = {
  kind: 'country'
  correct: boolean
  targetCca3: string
  clickedCca3: string | null
  clickedName: string | null
  distanceKm: number | null
}
```

- [ ] **Step 2: Add `name` to country `GuessInput`**

In the same file, replace the `GuessInput` type union with:

```ts
export type GuessInput =
  | { kind: 'country'; cca3: string; name: string; centroid: [number, number] }
  | { kind: 'point'; lngLat: [number, number] }
  | { kind: 'skip' }
```

- [ ] **Step 3: Type-check**

Run: `tsc -b`
Expected: errors in scoring.ts, CountryPinningHud.tsx, GameController.tsx, App.tsx, GuessByNameButton.tsx — those call sites haven't been updated yet. These get fixed in tasks 7–10.

### Task 7: Update scoring to populate `clickedName`

**Files:**
- Modify: `src/game/modes/country-pinning/scoring.ts`
- Modify: `src/game/modes/country-pinning/__tests__/scoring.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/game/modes/country-pinning/__tests__/scoring.test.ts`, after the existing `describe('scoreGuess', () => {` opens, add a new test:

```ts
  it('populates reveal.clickedName from GuessInput', () => {
    const brussels: [number, number] = [4.3517, 50.8503]
    const out = scoreGuess(
      round,
      { kind: 'country', cca3: 'BEL', name: 'Belgium', centroid: brussels },
      brussels,
    )
    expect(out.reveal.kind).toBe('country')
    if (out.reveal.kind === 'country') {
      expect(out.reveal.clickedName).toBe('Belgium')
      expect(out.reveal.clickedCca3).toBe('BEL')
    }
  })

  it('clickedName is null when input is skip or point', () => {
    const p: [number, number] = [0, 0]
    const skip = scoreGuess(round, { kind: 'skip' }, null)
    const point = scoreGuess(round, { kind: 'point', lngLat: p }, null)
    if (skip.reveal.kind === 'country') expect(skip.reveal.clickedName).toBeNull()
    if (point.reveal.kind === 'country') expect(point.reveal.clickedName).toBeNull()
  })

  it('clickedName is populated even for the correct (exact) case', () => {
    const out = scoreGuess(
      round,
      { kind: 'country', cca3: 'FRA', name: 'France', centroid: paris },
      paris,
    )
    if (out.reveal.kind === 'country') {
      expect(out.reveal.correct).toBe(true)
      expect(out.reveal.clickedName).toBe('France')
    }
  })
```

Also update the existing `scoreGuess(round, { kind: 'country', cca3: ..., centroid: ... }, ...)` calls in this file: add `name: '<cca3>'` to each country-kind input (the value is irrelevant to the existing assertions; any string works).

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test:unit -- scoring.test.ts`
Expected: FAIL — `clickedName` is undefined on the reveal, or `Property 'name' is missing in type …` if strict types block the call.

- [ ] **Step 3: Update `scoring.ts`**

Edit `src/game/modes/country-pinning/scoring.ts`, replace the whole body of `scoreGuess` with:

```ts
export function scoreGuess(
  round: CountryRoundSpec,
  input: GuessInput,
  clickedCentroid: [number, number] | null,
): ModeGuessResult {
  if (input.kind === 'skip' || input.kind === 'point') {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: round.targetCca3,
      clickedCca3: null,
      clickedName: null,
      distanceKm: null,
    }
    return { pointsEarned: 0, livesDelta: 0, reveal }
  }
  const { cca3: clickedCca3, name: clickedName } = input
  if (clickedCca3 === round.targetCca3) {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: true,
      targetCca3: round.targetCca3,
      clickedCca3,
      clickedName,
      distanceKm: 0,
    }
    return { pointsEarned: EXACT_POINTS, livesDelta: 0, reveal }
  }
  if (!clickedCentroid) {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: round.targetCca3,
      clickedCca3,
      clickedName,
      distanceKm: null,
    }
    return { pointsEarned: 0, livesDelta: -1, reveal }
  }
  const distanceKm = haversineKm(round.targetCentroid, clickedCentroid)
  const pointsEarned = Math.round(EXACT_POINTS * Math.exp(-distanceKm / DECAY_KM))
  const reveal: CountryReveal = {
    kind: 'country',
    correct: false,
    targetCca3: round.targetCca3,
    clickedCca3,
    clickedName,
    distanceKm,
  }
  return { pointsEarned, livesDelta: -1, reveal }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npm run test:unit -- scoring.test.ts`
Expected: PASS — all scoring tests including the three new ones.

### Task 8: Update `CountryPinningHud` to render names, not codes

**Files:**
- Modify: `src/game/modes/country-pinning/CountryPinningHud.tsx`

- [ ] **Step 1: Replace the reveal-line computation**

In `src/game/modes/country-pinning/CountryPinningHud.tsx`, replace the `revealLine` block (the `useMemo` currently at lines ~14–20):

```tsx
  const revealLine = useMemo(() => {
    if (session.status !== 'round-ended' || !reveal) return null
    if (reveal.reveal.kind !== 'country') return null
    const r = reveal.reveal
    const targetName = round && round.kind === 'country-pinning' ? round.targetName : r.targetCca3
    if (r.correct) return MESSAGES.correct(reveal.pointsEarned, targetName)
    return MESSAGES.wrong(reveal.pointsEarned, targetName, r.clickedName)
  }, [session.status, reveal, round])
```

Note the deps list now includes `round`. Keep the `if (!round || round.kind !== 'country-pinning') return null` guard farther down in the component unchanged.

- [ ] **Step 2: Type-check**

Run: `tsc -b`
Expected: this file type-checks. Still errors in App.tsx, GameController.tsx, GuessByNameButton.tsx.

### Task 9: Update call sites to pass `name` in `GuessInput`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/game/GameController.tsx`
- Modify: `src/game/shared/hud/GuessByNameButton.tsx`

- [ ] **Step 1: `App.tsx` — update `onMapSelect` legacy-path call**

In `src/App.tsx`, find the `onMapSelect` callback (~line 56–73). Do NOT remove the `window.__funworldmap_guess` call yet — Phase 6.2 does that. For now, keep the single-arg call; the legacy `__funworldmap_guess` inside `GameController.tsx` will pass the name itself (next step).

No change to `App.tsx` in this task.

- [ ] **Step 2: `GameController.tsx` — update the legacy `__funworldmap_guess` to pass name**

In `src/game/GameController.tsx`, find the block that defines `window.__funworldmap_guess` (around lines 343–357). Replace the callback body with:

```ts
    ;(window as unknown as { __funworldmap_guess?: (cca3: string) => void }).__funworldmap_guess = (cca3) => {
      if (session.modeId !== 'country-pinning') return
      const country = byCca3.get(cca3.toUpperCase())
      if (!country) return
      submitGuessWithInput({
        kind: 'country',
        cca3: cca3.toUpperCase(),
        name: country.name.common,
        centroid: centroidFromLatLng(country.latlng),
      })
    }
```

- [ ] **Step 3: `GameController.tsx` — update the test hook `setRound` + `__funworldmap_game.submitGuess`**

`setRound` constructs `RoundSpec`, not `GuessInput` — no change.

`__funworldmap_game.submitGuess` passes input straight through. The test may send `{ kind: 'country', cca3 }` without `name`; for defensive behaviour, allow the hook to default to cca3 if name is missing. Replace the `submitGuess` hook line:

```ts
    w.__funworldmap_game.submitGuess = (input: GuessInput) => submitGuessWithInput(input)
```

Leave as-is. Tests that exercise this pass full `GuessInput`; the type guards the shape.

- [ ] **Step 4: `GuessByNameButton.tsx` — update the submit wrapper in `GameController.tsx`**

Still inside `src/game/GameController.tsx`, find the `GuessByNameButton` render block (around lines 395–408). Update the `onGuess` handler to:

```tsx
          <GuessByNameButton
            pool={countries}
            onGuess={(cca3) => {
              const c = byCca3.get(cca3.toUpperCase())
              if (!c) return
              submitGuessWithInput({
                kind: 'country',
                cca3: cca3.toUpperCase(),
                name: c.name.common,
                centroid: centroidFromLatLng(c.latlng),
              })
            }}
          />
```

- [ ] **Step 5: Type-check**

Run: `tsc -b`
Expected: zero errors. All call sites now provide `name`.

### Task 10: Run all unit tests and commit 1.1

- [ ] **Step 1: Full unit test run**

Run: `npm run test:unit`
Expected: all tests green.

- [ ] **Step 2: Commit Phase 1.1**

Run:
```bash
git add src/game/shared/types.ts src/game/modes/country-pinning/scoring.ts src/game/modes/country-pinning/__tests__/scoring.test.ts src/game/modes/country-pinning/CountryPinningHud.tsx src/game/GameController.tsx
git commit -m "$(cat <<'EOF'
fix(game): show country names in pinning reveal text

Reveal text was rendering cca3 codes (FRA, USA) where country names
were expected. Thread the clicked country's name through GuessInput
into CountryReveal. Read target name from round.targetName in the
HUD, mirroring city mode's PointReveal pattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 11: `FirstSessionTutorial` mode-aware

**Files:**
- Modify: `src/game/shared/hud/FirstSessionTutorial.tsx`
- Modify: `src/game/GameController.tsx`

- [ ] **Step 1: Rewrite `FirstSessionTutorial`**

Replace the entire contents of `src/game/shared/hud/FirstSessionTutorial.tsx` with:

```tsx
import { useState, useEffect } from 'react'
import type { ModeId } from '../types'

const KEY_PREFIX = 'funworldmap-game-tutorial-shown-'

const COPY: Record<ModeId, { title: string; body: string }> = {
  'country-pinning': {
    title: 'How to play',
    body: 'Click the country that matches the flag and name above. Three wrong countries end the game. Ocean clicks don\u2019t count.',
  },
  'city-guessing': {
    title: 'How to play',
    body: 'Click anywhere on the map \u2014 including ocean \u2014 to guess the city\u2019s location. Ten rounds per game.',
  },
}

interface Props {
  modeId: ModeId
}

export function FirstSessionTutorial({ modeId }: Props) {
  const [open, setOpen] = useState(false)
  const key = KEY_PREFIX + modeId

  useEffect(() => {
    if (sessionStorage.getItem(key)) return
    setOpen(true)
    sessionStorage.setItem(key, '1')
  }, [key])

  if (!open) return null
  const copy = COPY[modeId]

  return (
    <div
      role="status"
      className="fixed top-40 sm:top-44 left-1/2 -translate-x-1/2 z-[45] max-w-xs px-4 py-3 rounded-2xl bg-dark-400/95 dark:bg-dark-300/95 backdrop-blur-md border border-teal/30 dark:border-teal-light/30 text-teal-light text-sm shadow-2xl pointer-events-none"
      style={{ animation: 'fade-up 300ms ease-out' }}
      data-testid="game-tutorial"
    >
      <p className="font-medium mb-1">{copy.title}</p>
      <p className="text-xs opacity-90">{copy.body}</p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 text-xs underline-offset-2 underline hover:no-underline pointer-events-auto"
      >
        Got it
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Pass `modeId` from `GameController`**

In `src/game/GameController.tsx`, find the render line:

```tsx
<FirstSessionTutorial />
```

Replace with:

```tsx
<FirstSessionTutorial modeId={session.modeId} />
```

- [ ] **Step 3: Type-check + unit tests**

Run: `tsc -b && npm run test:unit`
Expected: green.

### Task 12: `GameOverOverlay` mode-aware subtitle + conditional streak

**Files:**
- Modify: `src/game/shared/hud/GameOverOverlay.tsx`

- [ ] **Step 1: Replace subtitle and streak cell**

In `src/game/shared/hud/GameOverOverlay.tsx`, replace the subtitle `<p>` (currently `<p className="text-sm…">Three wrong guesses.</p>`) with:

```tsx
        <p className="text-sm text-sand-500 dark:text-dark-100 mb-4">
          {session.maxRounds === null
            ? 'Three wrong guesses.'
            : `${session.maxRounds} rounds complete.`}
        </p>
```

Then find the `<dl>` with the "Score" and "Longest streak" cells. Wrap the Longest-streak `<div>` in a conditional so it only renders when `session.maxRounds === null`. Also flip the grid to a single column when the streak cell is hidden, so the Score cell doesn't sit next to an empty column:

```tsx
        <dl
          className={`grid ${
            session.maxRounds === null ? 'grid-cols-2' : 'grid-cols-1'
          } gap-3 mb-6`}
        >
          <div>
            <dt className="text-xs uppercase text-sand-500 dark:text-dark-100">Score</dt>
            <dd
              className="text-2xl font-bold text-sand-900 dark:text-dark-50 tabular-nums"
              data-testid="game-over-score"
            >
              {session.score}
            </dd>
          </div>
          {session.maxRounds === null && (
            <div>
              <dt className="text-xs uppercase text-sand-500 dark:text-dark-100">Longest streak</dt>
              <dd
                className="text-2xl font-bold text-sand-900 dark:text-dark-50 tabular-nums"
                data-testid="game-over-best-streak"
              >
                {session.bestStreak}
              </dd>
            </div>
          )}
        </dl>
```

- [ ] **Step 2: Type-check**

Run: `tsc -b`
Expected: green.

### Task 13: Link-copied toast fires only on success

**Files:**
- Modify: `src/components/SingleCountryPanel.tsx`

- [ ] **Step 1: Update `onShareLink`**

In `src/components/SingleCountryPanel.tsx`, replace the `onShareLink` arrow function with:

```tsx
  const onShareLink = () => {
    const base = `${window.location.origin}${window.location.pathname}`
    const hash = `#${country.cca3}`
    const url = base + hash
    const dispatchToast = () =>
      window.dispatchEvent(new CustomEvent('funworldmap:toast', { detail: 'Link copied' }))
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(url)
        .then(dispatchToast)
        .catch(() => window.prompt('Copy this link:', url))
    } else {
      window.prompt('Copy this link:', url)
    }
  }
```

Note: the toast now fires only when `writeText` resolves successfully. The prompt fallback (both when clipboard is unavailable and when it rejects) does not toast — the user has explicit control over the prompt.

### Task 14: `data-game-mode` + dependent-territory toast in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Fix `data-game-mode`**

In `src/App.tsx`, find the root `<div data-selected-country … data-game-mode={gameActive ? 'country-pinning' : undefined} …>` (around line 200–202). Replace with:

```tsx
    <div
      data-selected-country={selected?.ccn3 || undefined}
      data-game-mode={gameActive ? session.modeId : undefined}
      className="grain"
    >
```

- [ ] **Step 2: Add dependent-territory check in `onMapSelect`**

Find the `onMapSelect` useCallback (around line 56–73). Replace with:

```tsx
  const onMapSelect = useCallback(
    (cca3: string) => {
      if (gameActive) {
        if (session.modeId === 'country-pinning' && !poolByCca3.has(cca3.toUpperCase())) {
          window.dispatchEvent(new CustomEvent('funworldmap:toast', {
            detail: "That territory isn't in the country pool.",
          }))
          return
        }
        const guess = (window as unknown as { __funworldmap_guess?: (c: string) => void }).__funworldmap_guess
        guess?.(cca3)
        return
      }
      if (comparePickingMode) {
        if (selected && cca3.toUpperCase() !== selected.cca3) {
          compareSelect(cca3)
          setComparePickingMode(false)
        }
      } else {
        select(cca3)
      }
    },
    [gameActive, session.modeId, poolByCca3, comparePickingMode, selected, select, compareSelect],
  )
```

- [ ] **Step 3: Type-check**

Run: `tsc -b`
Expected: green.

### Task 15: Delete stale pre-launch checklist

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Remove the "Pre-launch checklist" section**

Open `README.md`. Locate the section starting `## Pre-launch checklist` (around line 65) through its end (before the next `##` heading). Delete the entire section including its header.

- [ ] **Step 2: Verify grep**

Run: `grep -n "funworldmap.example" README.md`
Expected: zero results.

### Task 16: Commit Phase 1

- [ ] **Step 1: Verify all checks**

Run: `npm run lint && tsc -b && npm run test:unit`
Expected: green.

- [ ] **Step 2: Commit**

Run:
```bash
git add src/game/shared/hud/FirstSessionTutorial.tsx src/game/GameController.tsx src/game/shared/hud/GameOverOverlay.tsx src/components/SingleCountryPanel.tsx src/App.tsx README.md
git commit -m "$(cat <<'EOF'
fix: mode-aware HUD copy, toast accuracy, pool-miss feedback

- FirstSessionTutorial branches by modeId with per-mode sessionStorage
  keys so each game mode's tutorial shows once.
- GameOverOverlay subtitle reads from session.maxRounds; the Longest
  streak cell hides for round-capped modes.
- "Link copied" toast fires only on successful clipboard write.
- data-game-mode root attribute reads from session.modeId (was hard-
  coded to 'country-pinning').
- Clicking a dependent territory during country-pinning surfaces a
  toast instead of being a silent no-op.
- Delete the stale pre-launch checklist from README (domain swap is
  done).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Docs-drift reconciliation

Docs-only commit. No TypeScript changes.

### Task 17: `docs/purpose.md` country count

**Files:**
- Modify: `docs/purpose.md`

- [ ] **Step 1: Update the Scope bullet**

In `docs/purpose.md`, find the line (around line 59) that reads:

```
- ~195 sovereign states and territories
```

Replace with:

```
- 249 countries and territories (194 independent)
```

### Task 18: `docs/systems/testing.md` rewrite

**Files:**
- Modify: `docs/systems/testing.md`

- [ ] **Step 1: Rewrite the "Exposing the Map Instance" section**

In `docs/systems/testing.md`, replace the section titled "### Exposing the Map Instance" (around lines 54–71) with:

```markdown
### Exposing the Map Instance

For Tier 2 tests to work, the map instance must be accessible from `page.evaluate`. `useMapInstance` exposes it unconditionally on `window.__funworldmap_map`:

```ts
// In useMapInstance.ts, inside the init effect:
;(window as unknown as Record<string, unknown>).__funworldmap_map = map
```

Tests access it via:

```ts
const zoom = await page.evaluate(() => (window as unknown as {
  __funworldmap_map: { getZoom: () => number }
}).__funworldmap_map.getZoom())
```

The instance is exposed in production builds as well as development. This is a deliberate test seam: Playwright runs against the built bundle (`npm run build && npm run preview`), and the funworldmap site has no backend, no auth, and no sensitive runtime state — exposing a map reference is acceptable for this project. A future change to a sensitive context would need to gate this behind `import.meta.env.DEV`.
```

### Task 19: `docs/systems/overview.md` bundle budget

**Files:**
- Modify: `docs/systems/overview.md`

- [ ] **Step 1: Measure current bundle size**

Run:
```bash
npm run build 2>&1 | grep -E "dist/assets/.*\.(js|css)"
```

Record the line for the main JS bundle and its gzip size. Record `src/data/cities.json` and `src/data/countries.json` inclusion sizes.

- [ ] **Step 2: Update the Bundle Size Budget table**

In `docs/systems/overview.md`, replace the "Bundle Size Budget" table (around lines 118–135) with the measured breakdown. Add rows for `@sentry/react` (measure its contribution by building with and without Sentry — or cite the Sentry 10.x documented size, typically ~60 KB gzipped) and `cities.json` (~25 KB gzipped, measured).

Template:

```markdown
## Bundle Size Budget

MapLibre GL JS is NOT tree-shakeable — it ships as a single pre-bundled file. Sentry is statically imported and bundled regardless of whether a DSN is configured at runtime.

| Component | Gzipped Size |
|-----------|-------------|
| maplibre-gl (entire library) | ~275 KB |
| React 19 + ReactDOM | ~45 KB |
| @sentry/react | <MEASURED> |
| @vis.gl/react-maplibre | ~15 KB |
| Tailwind CSS (used utilities) | ~8 KB |
| fuse.js | ~8 KB |
| topojson-client | ~5 KB |
| Application code | ~<MEASURED> |
| countries.json (metadata + _fieldSources) | ~65 KB |
| cities.json (Natural Earth top-500) | ~25 KB |
| **Total initial JS+CSS** | **~<SUM>** |
| world-atlas countries-50m (async chunk) | ~245 KB |
| **Total with async data** | **~<SUM+245>** |

The map library dominates the budget. Geo data loads asynchronously after the map initializes, so the user sees the basemap first. The current budget exceeds the <700 KB target stated in earlier docs; re-baselining this target against real bundle output is tracked on the roadmap (bundle-size budgets in CI).
```

Fill `<MEASURED>` and `<SUM>` values from Step 1 output. Keep the narrative paragraph below updated to match.

### Task 20: `docs/ops/runbook.md` OWNER replacement

**Files:**
- Modify: `docs/ops/runbook.md`

- [ ] **Step 1: Replace the OWNER_TBD line**

In `docs/ops/runbook.md`, find the line:

```
> **Action:** `OWNER_TBD` for quarterly review. First review due 2026-07-17. Replace this line once an owner is assigned.
```

Replace with:

```
> **Action:** Quarterly review is currently unowned. When a review is due, file an issue against the repo with label `data-freshness` and assign to a maintainer.
```

### Task 21: `public/sitemap.xml` drop `<lastmod>`

**Files:**
- Modify: `public/sitemap.xml`

- [ ] **Step 1: Remove the lastmod element**

Replace `public/sitemap.xml` with:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://funworldmap.com/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

- [ ] **Step 2: Verify e2e still passes**

The `meta-and-static.spec.ts` test asserts `<urlset` and `<loc>` but does not require `<lastmod>`. No test change needed.

### Task 22: Add four roadmap out-of-scope entries

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Append a "Build / CI" block**

Find the existing `## Build / CI` section in `docs/roadmap.md`. Append these bullets within it (preserving existing content):

```markdown
- **Firefox and Safari e2e projects.** `playwright.config.ts` gains `firefox` and `webkit` projects alongside `chromium` / `chromium-gpu`. Cross-browser coverage was in the original Phase 7 exit criteria but never wired.
- **Bundle-size budget enforcement.** `size-limit` or equivalent, run in CI so silent bundle regressions fail fast.
- **Lazy Sentry.** The current static `import * as Sentry from '@sentry/react'` in `main.tsx` bundles Sentry regardless of whether a DSN is set. Move to dynamic `import()` inside `initSentry` so a DSN-less build drops the library entirely.
```

- [ ] **Step 2: Append a new "Rendering" section (if one doesn't exist)**

If `docs/roadmap.md` has no Rendering section, add one at an appropriate position with:

```markdown
## Rendering

- **Revisit atmospheric fog.** `useMapTheme`'s sky call covers atmosphere; a previously-documented `setFog` call was a Mapbox-only API and never ran under MapLibre. A real fog effect would need a deliberate spec.
```

### Task 23: Commit Phase 2

- [ ] **Step 1: Build + verify docs-only change**

Run: `npm run build`
Expected: success.

- [ ] **Step 2: Grep for stale placeholders**

Run: `grep -rnE "TBD|funworldmap.example" docs/ README.md public/`
Expected: only historical hits in `docs/superpowers/plans/archive/` and the replacement line `OWNER_TBD line with...` already handled.

- [ ] **Step 3: Commit**

Run:
```bash
git add docs/purpose.md docs/systems/testing.md docs/systems/overview.md docs/ops/runbook.md docs/roadmap.md public/sitemap.xml
git commit -m "$(cat <<'EOF'
docs: reconcile drift from 2026-04-19 assessment

- purpose.md: country count reflects actual 249 entries (194 independent).
- systems/testing.md: describe current unconditional __funworldmap_map
  exposure and rationale (preview-bundle e2e; static no-backend site).
- systems/overview.md: re-baseline bundle budget with @sentry/react and
  cities.json; note that the <700 KB target needs revisiting.
- ops/runbook.md: replace OWNER_TBD with explicit "unowned; file an
  issue when due" convention.
- roadmap.md: add four deferred items (Firefox/Safari e2e, bundle-size
  budgets, lazy Sentry, revisit fog).
- public/sitemap.xml: drop <lastmod> (GH Pages Last-Modified header
  covers it; stale date is worse than none).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Dark-mode FOUC

### Task 24: Inline FOUC-prevention script in `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Insert script in `<head>`**

In `index.html`, insert this `<script>` block immediately before the `<link rel="preload" as="font" …>` line (around line 27):

```html
    <script>
      (function () {
        try {
          var t = localStorage.getItem('funworldmap-theme')
          var resolved =
            t === 'dark' || t === 'light'
              ? t
              : window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'
          if (resolved === 'dark') document.documentElement.classList.add('dark')
        } catch (_) {}
      })()
    </script>
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`
Open the browser with dark system preference (or set `localStorage.setItem('funworldmap-theme', 'dark')` via DevTools and reload). Confirm the loading splash paints with `dark-500` background on the first frame — no light-to-dark flash.

- [ ] **Step 3: Commit Phase 3**

Run:
```bash
git add index.html
git commit -m "$(cat <<'EOF'
fix: prevent dark-mode FOUC with inline theme init

Block the light-to-dark flash for users with a dark theme preference by
applying the dark class to <html> before React mounts. The script reads
localStorage and matchMedia, mirrors the useTheme resolution logic, and
fails closed (try/catch) if storage is unavailable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — `SourceTooltip` touch + `MAX_ZOOM` clamp

### Task 25: Gate `SourceTooltip` hover handlers

**Files:**
- Modify: `src/components/SourceTooltip.tsx`

- [ ] **Step 1: Compute `supportsHover` and conditionally attach hover handlers**

In `src/components/SourceTooltip.tsx`, inside the component body, after `const source = sourceKey ? sources[sourceKey] : null`, add:

```tsx
  const supportsHover =
    typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches
```

Then update the `<button>` in the return block — change:

```tsx
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
```

to:

```tsx
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={supportsHover ? () => setOpen(true) : undefined}
        onMouseLeave={supportsHover ? () => setOpen(false) : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
```

The `prev => !prev` change closes a stale-closure bug incidentally; now the click toggles off any hover-driven open correctly.

### Task 26: `flyToCountry` clamp to `MAX_ZOOM`

**Files:**
- Modify: `src/lib/flyToCountry.ts`

- [ ] **Step 1: Import `MAX_ZOOM` and update clamp**

In `src/lib/flyToCountry.ts`, update the imports:

```ts
import { DEFAULT_PITCH, MAX_ZOOM } from './mapStyles'
```

Then in `zoomFromArea`, replace `Math.min(16, zoom)` with `Math.min(MAX_ZOOM, zoom)`:

```ts
function zoomFromArea(areaKm2: number): number {
  if (areaKm2 <= 0) return 6
  const zoom = 11 - Math.log10(areaKm2) * 1.7
  return Math.max(2, Math.min(MAX_ZOOM, zoom))
}
```

- [ ] **Step 2: Type-check and unit**

Run: `tsc -b && npm run test:unit`
Expected: green.

### Task 27: Commit Phase 4

- [ ] **Step 1: Commit**

Run:
```bash
git add src/components/SourceTooltip.tsx src/lib/flyToCountry.ts
git commit -m "$(cat <<'EOF'
fix(ui): tooltip tap-toggle on touch; flyToCountry clamp

- SourceTooltip: gate hover handlers on @media (hover: hover) so iOS
  Safari's synthetic mouseenter-then-click doesn't flash the tooltip
  open and immediately closed.
- flyToCountry: clamp zoomFromArea to MAX_ZOOM (12) rather than 16.
  MapLibre silently clamped the higher value; aligning the constants
  is cleaner.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Test-coverage subset

### Task 28: City-skip button click e2e

**Files:**
- Modify: `e2e/game-city-guessing.spec.ts`

- [ ] **Step 1: Add the button-click test**

In `e2e/game-city-guessing.spec.ts`, after the `test('skip round scores 0 and advances', …)` block (around line 90–110), add a new test:

```ts
  test('skip button click submits a skip guess', async ({ page }) => {
    await openCityGuessing(page)
    await setRoundAndWait(page, 'FRA-paris', 'Paris')
    // Wait for HUD stability before clicking — the button renders during
    // status='playing', and its bounding box is stable once the round
    // prompt is visible. Don't fall back to skipViaHook: this test's
    // purpose is to exercise the button's onClick handler.
    await expect(page.getByTestId('city-skip')).toBeVisible()
    await page.getByTestId('city-skip').click()
    await expect(page.getByTestId('game-reveal')).toContainText('Skipped', {
      timeout: 10_000,
    })
    await expect(page.getByTestId('hud-score')).toHaveText('0')
  })
```

### Task 29: `GuessByNameButton` passes real `CountryData[]` to Fuse

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/game/GameController.tsx`
- Modify: `src/game/shared/hud/GuessByNameButton.tsx`
- Modify: `e2e/game-country-pinning.spec.ts`

- [ ] **Step 1: Extend `GameController` props**

In `src/game/GameController.tsx`, update the `Props` interface:

```ts
interface Props {
  countries: CountryLike[]
  countriesFull: CountryData[]
  cities: CityLike[]
  byCca3: Map<string, CountryLike>
}
```

Add the type import at the top if not already present:

```ts
import type { CountryData } from '../lib/types'
```

Destructure `countriesFull` in the component signature:

```tsx
export function GameController({ countries, countriesFull, cities, byCca3 }: Props) {
```

- [ ] **Step 2: Thread `countriesFull` into `GuessByNameButton`**

Still in `src/game/GameController.tsx`, update the `<GuessByNameButton …>` render block:

```tsx
          <GuessByNameButton
            pool={countriesFull}
            onGuess={(cca3) => {
              const c = byCca3.get(cca3.toUpperCase())
              if (!c) return
              submitGuessWithInput({
                kind: 'country',
                cca3: cca3.toUpperCase(),
                name: c.name.common,
                centroid: centroidFromLatLng(c.latlng),
              })
            }}
          />
```

- [ ] **Step 3: Compute `poolFull` in `App.tsx`**

In `src/App.tsx`, after the existing `pool` memo:

```tsx
  const poolFull = useMemo<CountryData[]>(
    () => countries.filter((c: CountryData) => c.independent === true),
    [countries],
  )
```

Update the `<GameController …>` render to pass it:

```tsx
      <GameController
        countries={pool}
        countriesFull={poolFull}
        cities={cities}
        byCca3={poolByCca3}
      />
```

- [ ] **Step 4: Drop the cast in `GuessByNameButton`**

In `src/game/shared/hud/GuessByNameButton.tsx`, update the `Props` and Fuse call:

```tsx
import type { CountryData } from '../../../lib/types'

interface Props {
  pool: CountryData[]
  onGuess: (cca3: string) => void
}

export function GuessByNameButton({ pool, onGuess }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useCountrySearch(pool, query)
```

Delete the `CountryLike` import if it becomes unused.

- [ ] **Step 5: Extend the guess-by-name e2e**

In `e2e/game-country-pinning.spec.ts`, add a new test after the existing `guess-by-name input submits like a map click` test:

```ts
  test('guess-by-name search matches capital cities', async ({ page }) => {
    await page.goto('/#game/country-pinning/play')
    await waitForMap(page)
    await setRoundAndWait(page, 'FRA', 'France')

    await page.getByTestId('game-guess-by-name').click()
    await page.getByTestId('game-guess-input').fill('Paris')
    // Fuse.js 150 ms debounce + render; allow up to 10 s on slow CI.
    await expect(page.getByTestId('game-guess-results')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('game-guess-results')).toContainText('France')
  })
```

- [ ] **Step 6: Type-check + unit + e2e**

Run: `tsc -b && npm run test:unit`
Expected: green.

Run: `npm run test:e2e -- --project chromium-gpu`
Expected: green, including the new tests.

### Task 30: Commit Phase 5

- [ ] **Step 1: Commit**

Run:
```bash
git add e2e/game-city-guessing.spec.ts e2e/game-country-pinning.spec.ts src/App.tsx src/game/GameController.tsx src/game/shared/hud/GuessByNameButton.tsx
git commit -m "$(cat <<'EOF'
test(game): cover skip button click + extend guess-by-name shape

- e2e: click the city-skip button rather than bypass via the test
  hook — exercises the onClick path the hook skipped.
- GuessByNameButton accepts the full CountryData[] so Fuse indexes
  name.official, capital, region, subregion, cca2, cca3 as configured
  (the CountryLike cast dropped those keys silently).
- e2e: assert that typing a capital name matches via the guess-by-
  name search.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 31: Open PR 1

- [ ] **Step 1: Push the branch**

Run: `git push -u origin chore/assessment-remediation-pr1`

- [ ] **Step 2: Open the PR**

Run:
```bash
gh pr create --title "chore: assessment remediation (PR 1, low-risk)" --body "$(cat <<'EOF'
## Summary

Low-risk remediation from the 2026-04-19 repository assessment.

- Archive 13 completed plans under `docs/superpowers/plans/archive/` per the forward-plan convention.
- Mode-aware HUD copy (tutorial, game-over overlay), country-name reveal text, mode-reactive `data-game-mode`, dependent-territory click feedback, delete stale pre-launch checklist.
- Docs-drift reconciliation: `purpose.md` country count, `testing.md` map-exposure description, `overview.md` bundle budget, runbook OWNER convention, sitemap lastmod removal, four roadmap deferrals.
- Dark-mode FOUC fix via inline theme-init script.
- `SourceTooltip` hover-gate on touch; `flyToCountry` clamp to `MAX_ZOOM`.
- Test coverage: real click of city-skip button; `GuessByNameButton` passes full `CountryData[]` for capital-search support.

Spec: `docs/superpowers/specs/2026-04-19-assessment-remediation-design.md`.

## Test plan

- [ ] `npm run lint && tsc -b && npm run test:unit` green.
- [ ] `npm run test:e2e` green on both chromium and chromium-gpu projects.
- [ ] Manual: start each game mode, verify reveal text shows country names.
- [ ] Manual: first-time tutorial shows mode-specific copy per mode.
- [ ] Manual: reload with dark preference, no light flash.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Record it.

---

## PR 2 — Medium-risk refactor

After PR 1 merges to `main`, continue with PR 2 from this point.

### Task 32: Create PR 2 branch off the updated main

- [ ] **Step 1: Switch to main and pull**

Run:
```bash
git checkout main
git pull origin main
```
Expected: the PR 1 merge commit is present.

- [ ] **Step 2: Create PR 2 branch**

Run: `git checkout -b chore/assessment-remediation-pr2`
Expected: *"Switched to a new branch 'chore/assessment-remediation-pr2'"*.

- [ ] **Step 3: Baseline checks**

Run: `npm run lint && tsc -b && npm run test:unit`
Expected: green.

---

## Phase 6.1 — HUD-registration unification

### Task 33: Rename index.ts → index.tsx, import HUD directly

**Files:**
- Rename + modify: `src/game/modes/country-pinning/index.ts` → `index.tsx`
- Modify: `src/game/modes/country-pinning/CountryPinningHud.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Rename the file via git**

Run: `git mv src/game/modes/country-pinning/index.ts src/game/modes/country-pinning/index.tsx`

- [ ] **Step 2: Replace the contents of `index.tsx`**

Replace the entirety of `src/game/modes/country-pinning/index.tsx` with:

```tsx
import type { CountryLike, GameMode } from '../../shared/types'
import { scoreGuess } from './scoring'
import { nextRound as pickNextRound } from './roundGenerator'
import { centroidFromLatLng } from '../../shared/distance'
import { MESSAGES } from './messages'
import CountryPinningHud from './CountryPinningHud'

export function getCountryPinningMode(pool: CountryLike[]): GameMode {
  return {
    id: 'country-pinning',
    title: MESSAGES.title,
    description: MESSAGES.description,
    hashSegment: 'country-pinning',
    maxRounds: null,
    initialCameraView: 'preserve',
    HudComponent: CountryPinningHud,
    nextRound: (used) => pickNextRound(used, pool),
    onGuess: (input, round) => {
      if (round.kind !== 'country-pinning') {
        return {
          pointsEarned: 0,
          livesDelta: 0,
          reveal: {
            kind: 'country',
            correct: false,
            targetCca3: '',
            clickedCca3: null,
            clickedName: null,
            distanceKm: null,
          },
        }
      }
      const clickedCentroid = input.kind === 'country' ? input.centroid : null
      return scoreGuess(round, input, clickedCentroid)
    },
  }
}

export { centroidFromLatLng }
```

Note: `registerCountryPinningHud` and the `attachedHud` module variable are deleted.

- [ ] **Step 3: Remove registration from `CountryPinningHud.tsx`**

In `src/game/modes/country-pinning/CountryPinningHud.tsx`:
- Remove the `import { registerCountryPinningHud } from './index'` line.
- Remove the `registerCountryPinningHud(CountryPinningHud)` call (last line before the default export).

- [ ] **Step 4: Remove the side-effect import from `App.tsx`**

In `src/App.tsx`, delete the line:

```ts
import './game/modes/country-pinning/CountryPinningHud'
```

(around line 14).

- [ ] **Step 5: Verify no references remain**

Run: `grep -rn "attachedHud\|registerCountryPinningHud" src/`
Expected: zero results.

- [ ] **Step 6: Type-check + tests**

Run: `tsc -b && npm run test:unit`
Expected: green.

Run: `npm run build`
Expected: success; no circular-import warning.

- [ ] **Step 7: Commit Phase 6.1**

Run:
```bash
git add src/game/modes/country-pinning/index.tsx src/game/modes/country-pinning/CountryPinningHud.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
refactor(game): direct HUD import, drop singleton registration

Country-pinning's index.ts used a module-level attachedHud variable
set via a side-effect import in App.tsx. A tree-shake or import
reorder would have thrown at runtime. Move to the same pattern as
city-guessing: the factory imports its HUD component directly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6.2 — Provider restructure, remove `__funworldmap_guess`

### Task 34: Extend `GameSessionApi` and `GameSessionProvider`

**Files:**
- Modify: `src/game/shared/GameSessionProvider.tsx`

- [ ] **Step 1: Rewrite the provider**

Replace `src/game/shared/GameSessionProvider.tsx` entirely with:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useGameSession } from './useGameSession'
import type { CityLike, CountryLike, GameMode, GameSession, GuessInput, GuessOutcome, ModeId, RoundSpec } from './types'
import { getMode } from '../modes'

export type GameSessionApi = {
  session: GameSession
  mode: GameMode | null
  start: (modeId: ModeId, firstRound: RoundSpec, maxRounds: number | null) => void
  submitGuess: (outcome: GuessOutcome) => void
  submitGuessInput: (input: GuessInput) => void
  advance: (nextRound: RoundSpec) => void
  overrideRound: (round: RoundSpec) => void
  endGame: () => void
}

const GameSessionContext = createContext<GameSessionApi | null>(null)

interface Props {
  pools: { countries: CountryLike[]; cities: CityLike[] }
  byCca3: Map<string, CountryLike>
  children: ReactNode
}

export function GameSessionProvider({ pools, byCca3: _byCca3, children }: Props) {
  const { session, start, submitGuess, advance, overrideRound, endGame } = useGameSession()

  const mode = useMemo<GameMode | null>(() => {
    if (session.modeId === 'country-pinning' && pools.countries.length === 0) return null
    if (session.modeId === 'city-guessing' && pools.cities.length === 0) return null
    try {
      return getMode(session.modeId, pools)
    } catch {
      return null
    }
  }, [session.modeId, pools])

  const submitGuessInput = useCallback(
    (input: GuessInput) => {
      if (!mode || session.status !== 'playing' || !session.currentRound) return
      const result = mode.onGuess(input, session.currentRound)
      const endsGame =
        session.maxRounds !== null
          ? session.roundIndex + 1 >= session.maxRounds
          : session.lives + result.livesDelta <= 0
      const outcome: GuessOutcome = { ...result, endsGame }
      submitGuess(outcome)
    },
    [mode, session.status, session.currentRound, session.maxRounds, session.roundIndex, session.lives, submitGuess],
  )

  const api = useMemo<GameSessionApi>(
    () => ({ session, mode, start, submitGuess, submitGuessInput, advance, overrideRound, endGame }),
    [session, mode, start, submitGuess, submitGuessInput, advance, overrideRound, endGame],
  )

  const apiRef = useRef(api)
  apiRef.current = api

  useEffect(() => {
    const w = window as unknown as { __funworldmap_game?: Record<string, unknown> }
    if (!w.__funworldmap_game) w.__funworldmap_game = {}
    w.__funworldmap_game.getSession = () => apiRef.current.session
    w.__funworldmap_game.endGame = () => apiRef.current.endGame()
    return () => {
      if (w.__funworldmap_game) {
        delete w.__funworldmap_game.getSession
        delete w.__funworldmap_game.endGame
      }
    }
  }, [])

  return <GameSessionContext.Provider value={api}>{children}</GameSessionContext.Provider>
}

export function useGameSessionContext(): GameSessionApi {
  const ctx = useContext(GameSessionContext)
  if (!ctx) throw new Error('useGameSessionContext must be used within <GameSessionProvider>')
  return ctx
}
```

Note: `byCca3` is accepted as a prop but currently unused inside the provider — consumers (App, GameController) read it from other sources (via `useCountryData` in App). The prop is reserved for future use if the provider ever needs to look up country data; keeping it in the signature now avoids a second breaking change later.

- [ ] **Step 2: Type-check**

Run: `tsc -b`
Expected: errors in `App.tsx` (provider call site), `GameController.tsx` (both still maintaining their own `submitGuessWithInput`). These fix in the next tasks.

### Task 35: Restructure `App.tsx` providers

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Restructure the exported App function**

In `src/App.tsx`, replace the exported `App` function (top-level, around lines 19–27) with:

```tsx
export default function App() {
  const { countries, byNumeric, byCca3, sources } = useCountryData()
  const { cities } = useCityData()

  const pool = useMemo<CountryLike[]>(
    () =>
      countries
        .filter((c: CountryData) => c.independent === true)
        .map((c: CountryData) => ({
          cca3: c.cca3,
          name: { common: c.name.common },
          flag: c.flag,
          latlng: c.latlng,
          independent: true,
        })),
    [countries],
  )
  const poolFull = useMemo<CountryData[]>(
    () => countries.filter((c: CountryData) => c.independent === true),
    [countries],
  )
  const poolByCca3 = useMemo(() => new Map(pool.map((c) => [c.cca3, c])), [pool])
  const pools = useMemo(() => ({ countries: pool, cities }), [pool, cities])

  return (
    <MapProvider>
      <GameSessionProvider pools={pools} byCca3={poolByCca3}>
        <AppInner
          countries={countries}
          countriesFull={poolFull}
          pool={pool}
          byNumeric={byNumeric}
          byCca3={byCca3}
          poolByCca3={poolByCca3}
          sources={sources}
          cities={cities}
        />
      </GameSessionProvider>
    </MapProvider>
  )
}
```

- [ ] **Step 2: Add `AppInner` props interface**

At the top of `AppInner` (was previously unsafe — read data via hooks; now reads via props), update the signature. Replace the `function AppInner() {` line with:

```tsx
interface AppInnerProps {
  countries: CountryData[]
  countriesFull: CountryData[]
  pool: CountryLike[]
  byNumeric: Map<string, CountryData>
  byCca3: Map<string, CountryData>
  poolByCca3: Map<string, CountryLike>
  sources: ReturnType<typeof useCountryData>['sources']
  cities: CityLike[]
}

function AppInner({
  countries,
  countriesFull,
  pool,
  byNumeric,
  byCca3,
  poolByCca3,
  sources,
  cities,
}: AppInnerProps) {
```

- [ ] **Step 3: Remove duplicated hook calls and recomputations from `AppInner`**

Inside `AppInner`, delete these lines (they're now props):
- `const { countries, byNumeric, byCca3, sources } = useCountryData()`
- `const { cities } = useCityData()`
- the `pool` / `poolFull` / `poolByCca3` / `pools` useMemos (now computed at the top level)

- [ ] **Step 4: Update `useGameSessionContext()` destructure**

Inside `AppInner`, where `const { session } = useGameSessionContext()` is called, add `submitGuessInput`:

```tsx
const { session, submitGuessInput } = useGameSessionContext()
```

- [ ] **Step 5: Rewrite `onMapSelect` to call `submitGuessInput` directly**

Replace the `onMapSelect` useCallback in `AppInner` with:

```tsx
  const onMapSelect = useCallback(
    (cca3: string) => {
      if (gameActive) {
        if (session.modeId === 'country-pinning') {
          const country = poolByCca3.get(cca3.toUpperCase())
          if (!country) {
            window.dispatchEvent(
              new CustomEvent('funworldmap:toast', {
                detail: "That territory isn't in the country pool.",
              }),
            )
            return
          }
          submitGuessInput({
            kind: 'country',
            cca3: cca3.toUpperCase(),
            name: country.name.common,
            centroid: [country.latlng[1], country.latlng[0]],
          })
        }
        // city mode: GameController handles via its own map.on('click') — no-op here.
        return
      }
      if (comparePickingMode) {
        if (selected && cca3.toUpperCase() !== selected.cca3) {
          compareSelect(cca3)
          setComparePickingMode(false)
        }
      } else {
        select(cca3)
      }
    },
    [gameActive, session.modeId, poolByCca3, submitGuessInput, comparePickingMode, selected, select, compareSelect],
  )
```

- [ ] **Step 6: Update `GameController` props**

Still in `AppInner`, find the `<GameController …>` render. `pool` and `countriesFull` are both props on `AppInner` now (Step 1 threads them from the top-level App). `submitGuessInput` is context-driven (GameController reads from `useGameSessionContext` in Task 36), so we don't pass it. Render:

```tsx
<GameController
  countries={pool}
  countriesFull={countriesFull}
  cities={cities}
  byCca3={poolByCca3}
/>
```

Update `AppInnerProps` to include `pool: CountryLike[]`, update the destructure, and pass `pool={pool}` from App.

### Task 36: Update `GameController` to read `submitGuessInput` from context

**Files:**
- Modify: `src/game/GameController.tsx`

- [ ] **Step 1: Read from context**

At the top of `GameController`, replace:

```tsx
const { session, start, submitGuess, advance, overrideRound, endGame } = useGameSessionContext()
```

with:

```tsx
const { session, mode, start, submitGuess, submitGuessInput, advance, overrideRound, endGame } = useGameSessionContext()
```

Delete the local `mode` useMemo and the `pools` useMemo (now in the provider).

- [ ] **Step 2: Delete the local `submitGuessWithInput` callback**

In `GameController`, delete the `submitGuessWithInput` useCallback (around lines 267–275). All call sites inside this file now call `submitGuessInput` from context.

- [ ] **Step 3: Update call sites inside `GameController`**

Find every call to `submitGuessWithInput(…)` and replace with `submitGuessInput(…)`:
- The city-mode `map.on('click', …)` handler.
- The `__funworldmap_game.submitGuess` test hook.
- The `__funworldmap_guess` legacy alias (will be deleted in Step 4).
- The `GuessByNameButton` inline `onGuess` handler.
- The `onSkip` callback.

- [ ] **Step 4: Delete the `__funworldmap_guess` legacy alias**

In `GameController`, delete the entire `useEffect` block that sets and cleans up `__funworldmap_guess` (around lines 343–357).

- [ ] **Step 5: Update the `__funworldmap_game.setRound` block**

`setRound` currently depends on the local `mode`. Now `mode` comes from context — the useEffect block that wires `setRound` needs `mode` in its dependency list (from the context destructure). This should already be consistent; verify the effect's dep array includes `mode`.

- [ ] **Step 6: Verify `grep`**

Run: `grep -rn "__funworldmap_guess" src/ e2e/`
Expected: zero hits.

Run: `grep -rn "submitGuessWithInput" src/`
Expected: zero hits.

- [ ] **Step 7: Type-check, tests, build**

Run: `tsc -b && npm run test:unit`
Expected: green.

Run: `npm run build`
Expected: success.

Run: `npm run test:e2e -- --project chromium-gpu -- --grep game-country-pinning`
Expected: all country-pinning e2e tests pass.

- [ ] **Step 8: Manual smoke of focus-return flow**

Run: `npm run dev`
- Open the country panel via search (type "France", Enter).
- Press Escape — verify focus returns to the search input.
- Open the panel via direct map click (requires satellite off or a clear polygon) — close with the X button, verify focus goes somewhere sensible.

This catches the highest-risk regression the provider reorder might introduce silently.

- [ ] **Step 9: Commit Phase 6.2**

Run:
```bash
git add src/game/shared/GameSessionProvider.tsx src/game/GameController.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
refactor(game): move submit into provider, drop window.__funworldmap_guess

The GameController was exposing window.__funworldmap_guess as a
production route for country-pinning guesses from App.tsx. That's a
window global as load-bearing app code. Move submitGuessInput onto
the GameSessionProvider context so App and GameController share one
path. Restructure App into a small data-reading wrapper around
MapProvider and GameSessionProvider; AppInner receives data as props.

The legacy __funworldmap_guess is deleted. Test hooks on
window.__funworldmap_game (submitGuess, setRound, getSession,
endGame) remain — they call into the provider context.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7 — Satellite + compare border-opacity regression

### Task 37: Write the failing e2e test

**Files:**
- Create: `e2e/compare-view-dimming.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Create the new spec**

Create `e2e/compare-view-dimming.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'

test.setTimeout(60_000)

async function waitForMap(page: Page) {
  await page.waitForSelector('[data-map-loaded]', { timeout: 60_000 })
}

async function getBorderOpacity(page: Page): Promise<number> {
  return page.evaluate(() => {
    const map = (window as unknown as {
      __funworldmap_map?: { getPaintProperty: (id: string, prop: string) => number }
    }).__funworldmap_map
    if (!map) throw new Error('map not exposed')
    return map.getPaintProperty('country-borders', 'line-opacity')
  })
}

test.describe('compare view dimming interacts with satellite mode', () => {
  test('exiting compare with satellite ON restores satellite border opacity', async ({ page }) => {
    // Satellite is ON by default.
    await page.goto('/#FRA,DEU')
    await waitForMap(page)
    // Allow one animation frame for filter + paint to settle.
    await page.waitForTimeout(500)

    // In compare view, dimming pins borders at 0.15.
    const dimmedOpacity = await getBorderOpacity(page)
    expect(dimmedOpacity).toBeCloseTo(0.15, 2)

    // Exit compare.
    await page.evaluate(() => {
      window.location.hash = '#FRA'
    })
    await page.waitForTimeout(500)

    // Satellite-default opacity is 0.6, not the dimmed value.
    const restoredOpacity = await getBorderOpacity(page)
    expect(restoredOpacity).toBeCloseTo(0.6, 2)
  })
})
```

- [ ] **Step 2: Add the spec to `playwright.config.ts`**

In `playwright.config.ts`, find the `chromium-gpu` project's `testMatch` array. Add `'compare-view-dimming.spec.ts'`:

```ts
testMatch: [
  'map-and-countries.spec.ts',
  'map-reliability.spec.ts',
  'keyboard-map-nav.spec.ts',
  'game-country-pinning.spec.ts',
  'game-city-guessing.spec.ts',
  'compare-view-dimming.spec.ts',
],
```

- [ ] **Step 3: Run the test — it should fail**

Run: `npm run test:e2e -- --project chromium-gpu -- compare-view-dimming.spec.ts`
Expected: FAIL — the restored-opacity assertion gets 0.15 instead of 0.6 because `useCompareViewDimming`'s else branch currently skips the satellite case.

### Task 38: Add `applyBorderPaintForMode` helper

**Files:**
- Modify: `src/lib/mapLayers.ts`

- [ ] **Step 1: Add the helper**

In `src/lib/mapLayers.ts`, after the existing `applyDefaultBorderPaint` function, add:

```ts
/** Apply border paint for the current visual mode. Satellite mode uses a
 *  white-ish translucent border over imagery; vector mode uses the theme's
 *  default border color and opacity. One edit-point so the three hooks
 *  that care (theme, satellite, compare-dimming) agree on the baseline. */
export function applyBorderPaintForMode(
  map: maplibregl.Map,
  opts: { isDark: boolean; satellite: boolean },
): void {
  if (opts.satellite) {
    map.setPaintProperty(LAYER.borders, 'line-color', 'rgba(255,255,255,0.35)')
    map.setPaintProperty(LAYER.borders, 'line-opacity', 0.6)
  } else {
    applyDefaultBorderPaint(map, opts.isDark)
  }
}
```

### Task 39: Refactor the three hooks to use the helper

**Files:**
- Modify: `src/hooks/useSatelliteMode.ts`
- Modify: `src/hooks/useCompareViewDimming.ts`
- Modify: `src/hooks/useMapTheme.ts`
- Modify: `src/components/WorldMap.tsx`

- [ ] **Step 1: `useSatelliteMode` — use the helper**

In `src/hooks/useSatelliteMode.ts`, update the imports:

```ts
import { DEFAULT_FILL_OPACITY, applyBorderPaintForMode, LAYER } from '../lib/mapLayers'
```

Replace the `if (satellite) { map.setPaintProperty(LAYER.borders, …) … } else { applyDefaultBorderPaint(map, resolvedTheme === 'dark') … }` block (around lines 55–67) with:

```ts
      applyBorderPaintForMode(map, { isDark: resolvedTheme === 'dark', satellite })
      if (satellite) {
        map.setPaintProperty(LAYER.fill, 'fill-opacity', [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.32,
          0.03,
        ])
      } else {
        map.setPaintProperty(LAYER.fill, 'fill-opacity', DEFAULT_FILL_OPACITY)
      }
```

Delete the `applyDefaultBorderPaint` import if it's now unused.

- [ ] **Step 2: `useCompareViewDimming` — use the helper in the else branch**

In `src/hooks/useCompareViewDimming.ts`, update the imports:

```ts
import {
  EMPTY_FILTER as EMPTY,
  DEFAULT_FILL_OPACITY,
  applyBorderPaintForMode,
  LAYER,
} from '../lib/mapLayers'
```

Delete the `applyDefaultBorderPaint` import.

Replace the effect body's `else` branch:

```ts
      } else {
        map.setPaintProperty(LAYER.fill, 'fill-opacity', DEFAULT_FILL_OPACITY)
        applyBorderPaintForMode(map, {
          isDark: resolvedTheme === 'dark',
          satellite,
        })
      }
```

(The prior `else if (!satellite) { applyDefaultBorderPaint(...) }` logic becomes an unconditional else — the helper handles the satellite case internally.)

- [ ] **Step 3: `useMapTheme` — add `satellite` to options, use helper**

In `src/hooks/useMapTheme.ts`, update the `Options` interface:

```ts
interface Options {
  loaded: boolean
  resolvedTheme: 'light' | 'dark'
  satellite: boolean
}
```

Update the imports:

```ts
import { applyBorderPaintForMode, LAYER } from '../lib/mapLayers'
```

Delete `applyDefaultBorderPaint` from the import.

Replace the `applyDefaultBorderPaint(map, isDark)` line with:

```ts
applyBorderPaintForMode(map, { isDark, satellite })
```

Update the hook's `useEffect` dependency array to include `satellite`.

Update the function signature to destructure `satellite`:

```ts
export function useMapTheme({ loaded, resolvedTheme, satellite }: Options): void {
```

- [ ] **Step 4: `WorldMap.tsx` — pass `satellite` into `useMapTheme`**

In `src/components/WorldMap.tsx`, find the `useMapTheme` call (around line 65) and update:

```tsx
useMapTheme({ loaded, resolvedTheme, satellite })
```

- [ ] **Step 5: Run the e2e test — it should now pass**

Run: `npm run test:e2e -- --project chromium-gpu -- compare-view-dimming.spec.ts`
Expected: PASS.

- [ ] **Step 6: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: all green.

### Task 40: Document the test

**Files:**
- Modify: `docs/systems/testing.md`

- [ ] **Step 1: Add spec to the Test Organization list**

In `docs/systems/testing.md`, find the Test Organization block showing the `e2e/` file list. Add `compare-view-dimming.spec.ts` to it with a brief description:

```
  compare-view-dimming.spec.ts  # Compare + satellite: dimmed borders must restore on exit
```

### Task 41: Commit Phase 7

- [ ] **Step 1: Commit**

Run:
```bash
git add src/lib/mapLayers.ts src/hooks/useSatelliteMode.ts src/hooks/useCompareViewDimming.ts src/hooks/useMapTheme.ts src/components/WorldMap.tsx e2e/compare-view-dimming.spec.ts playwright.config.ts docs/systems/testing.md
git commit -m "$(cat <<'EOF'
fix(map): restore satellite border paint on compare exit

Three hooks (useMapTheme, useSatelliteMode, useCompareViewDimming)
were each writing country-borders line-opacity on their own triggers.
Exiting compare view while satellite was ON left borders stuck at
line-opacity 0.15 — the dim value — because useCompareViewDimming's
else branch only restored the vector-mode default and bailed when
satellite was on.

Add applyBorderPaintForMode(map, { isDark, satellite }) as the single
edit-point. Thread satellite into useMapTheme's options so all three
hooks agree on the baseline.

e2e/compare-view-dimming.spec.ts proves the regression and locks in
the fix.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 8 — `GameOverOverlay` focus management

### Task 42: Add focus effect to `GameOverOverlay`

**Files:**
- Modify: `src/game/shared/hud/GameOverOverlay.tsx`

- [ ] **Step 1: Import `useEffect`, `useRef`**

In `src/game/shared/hud/GameOverOverlay.tsx`, update the React imports:

```tsx
import { useEffect, useRef } from 'react'
```

- [ ] **Step 2: Add the focus effect**

Inside the `GameOverOverlay` component body, before the `return (…)`, add:

```tsx
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null
    const playAgain = document.querySelector<HTMLButtonElement>(
      '[data-testid="game-over-play-again"]',
    )
    playAgain?.focus({ preventScroll: true })
    return () => {
      const target = previousFocusRef.current
      const canRestore =
        target &&
        target !== document.body &&
        document.body.contains(target) &&
        typeof target.focus === 'function'
      if (canRestore) {
        target.focus({ preventScroll: true })
      } else {
        document
          .querySelector<HTMLElement>('[role="application"]')
          ?.focus({ preventScroll: true })
      }
    }
  }, [])
```

### Task 43: Add focus-assertion e2e

**Files:**
- Modify: `e2e/game-country-pinning.spec.ts`

- [ ] **Step 1: Add the focus test**

Append to `e2e/game-country-pinning.spec.ts`:

```ts
  test('game-over overlay moves focus to Play again', async ({ page }) => {
    await page.goto('/#game/country-pinning/play')
    await waitForMap(page)

    // Three wrong guesses via the test hook to trigger game-over.
    await setRoundAndWait(page, 'FRA', 'France')
    await clickCountryPolygon(page, 'AUS')
    await setRoundAndWait(page, 'FRA', 'France')
    await clickCountryPolygon(page, 'AUS')
    await setRoundAndWait(page, 'FRA', 'France')
    await clickCountryPolygon(page, 'AUS')

    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })
    // Effect focuses the Play again button on mount.
    await expect
      .poll(
        () => page.evaluate(() => document.activeElement?.getAttribute('data-testid')),
        { timeout: 5_000 },
      )
      .toBe('game-over-play-again')
  })
```

### Task 44: Add axe-core game-over audit

**Files:**
- Modify: `e2e/accessibility.spec.ts`

- [ ] **Step 1: Add the audit test**

Append inside the `test.describe('Accessibility', …)` block in `e2e/accessibility.spec.ts`:

```ts
  test('axe-core audit passes on game-over overlay', async ({ page }) => {
    await page.goto('/#game/country-pinning/play')
    await page.waitForSelector('[data-map-loaded]', { timeout: 30_000 })

    // Force game-over via the test hook: set a round, submit three wrong guesses.
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        type H = { setRound?: (cca3: string) => boolean; submitGuess?: (input: { kind: 'country'; cca3: string; name: string; centroid: [number, number] }) => void }
        const g = (window as unknown as { __funworldmap_game?: H }).__funworldmap_game
        g?.setRound?.('FRA')
        g?.submitGuess?.({
          kind: 'country',
          cca3: 'AUS',
          name: 'Australia',
          centroid: [133.775, -25.2744],
        })
      })
      await page.waitForTimeout(100)
    }

    await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })

    const results = await new AxeBuilder({ page })
      .exclude('.maplibregl-canvas')
      .exclude('.z-\\[200\\]')
      .analyze()

    expect(results.violations).toEqual([])
  })
```

Note: this test needs to run on a project that exposes `__funworldmap_game`. The spec currently runs on `chromium` project (DOM-only per `playwright.config.ts`), but `__funworldmap_game` is set regardless of project. The build must load and the provider must mount; `[data-map-loaded]` is sufficient signal.

- [ ] **Step 2: Run all Playwright tests**

Run: `npm run test:e2e`
Expected: all green, including the new focus + axe tests.

### Task 45: Commit Phase 8

- [ ] **Step 1: Commit**

Run:
```bash
git add src/game/shared/hud/GameOverOverlay.tsx e2e/game-country-pinning.spec.ts e2e/accessibility.spec.ts
git commit -m "$(cat <<'EOF'
fix(a11y): GameOverOverlay manages focus on mount and unmount

GameOverOverlay declared role=dialog aria-modal=true without moving
focus into the overlay. A keyboard or screen-reader user was stuck
on the map canvas. Focus the Play again button on mount; restore
focus on unmount to the pre-overlay element (or fall back to the
map container if the captured target is body or detached).

e2e: assert focus lands on Play again after game-over; axe-core
audit on the game-over state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 46: Open PR 2

- [ ] **Step 1: Push the branch**

Run: `git push -u origin chore/assessment-remediation-pr2`

- [ ] **Step 2: Open the PR**

Run:
```bash
gh pr create --title "chore: assessment remediation (PR 2, medium-risk)" --body "$(cat <<'EOF'
## Summary

Medium-risk remediation from the 2026-04-19 repository assessment. Lands after PR 1 merges.

- **HUD registration unified.** Country-pinning stops using a module-level singleton set via side-effect import; matches city-guessing's direct-HUD-import pattern.
- **`window.__funworldmap_guess` removed.** `submitGuessInput` moves to `GameSessionProvider` context; App and GameController share one submit path. App restructured so it reads data at the top and threads props into `AppInner` through MapProvider + GameSessionProvider.
- **Satellite+compare border regression fixed.** `applyBorderPaintForMode` is now the single edit-point for all three hooks that write `country-borders` paint. `useMapTheme` gains a `satellite` option. New `e2e/compare-view-dimming.spec.ts` proves the fix.
- **GameOverOverlay focus management.** On mount, focus moves to Play again; on unmount, restores to the previous focused element with a fallback to the map container. New e2e assertion + axe-core audit.

Spec: `docs/superpowers/specs/2026-04-19-assessment-remediation-design.md`.

## Test plan

- [ ] `npm run lint && tsc -b && npm run test:unit` green.
- [ ] `npm run test:e2e` green on both chromium and chromium-gpu projects.
- [ ] `grep -rn "__funworldmap_guess\|attachedHud" src/ e2e/` returns zero.
- [ ] Manual: start country-pinning, click a country, verify guess lands and score updates — confirms the provider reroute works.
- [ ] Manual: open country panel via search, press Escape, confirm focus returns to search input (regression check for the provider reorder).
- [ ] Manual: enter compare view while satellite is on, exit compare via the column-B close button, confirm borders restore to visible satellite-mode paint (not the dim 0.15).
- [ ] Manual: trigger game-over (three wrong guesses), confirm focus lands on Play again and keyboard works through the overlay.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.

---

## Self-review checklist

Before declaring the plan complete, verify:

- [ ] Every finding in the spec's Appendix has a task that implements it.
- [ ] No "TBD", "TODO", or "implement later" in this plan (the `<MEASURED>`/`<SUM>` tokens in Task 19 are filled during execution; the one `OWNER_TBD` reference is explicit replacement copy).
- [ ] Type signatures are consistent: `CountryReveal` gains `clickedName` (one place); `GuessInput` gains `name` on the country kind (one place); every call site threads the new field.
- [ ] Commit messages follow the repo's `type(scope): subject` convention.
- [ ] Each phase's verification steps run the right command (`npm run lint`, `tsc -b`, `npm run test:unit`, `npm run test:e2e`) appropriate to what changed.
- [ ] PR 2 starts from `main` after PR 1 merges — the plan enforces this via Task 32's git pull.
