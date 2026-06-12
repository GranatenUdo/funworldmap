# Game Happy-Path Divergence Report

Date: 2026-05-11
Build: dev server, `VITE_TEST_HOOKS=1`, viewport 1280×800
Compared against: [`docs/testing/game-happy-paths.md`](./game-happy-paths.md)
Method: programmatic walkthrough using `window.__funworldmap_game` test seam + DOM observation.

> **Note (2026-06-12):** the companion `game-happy-paths.md` was rewritten after
> the daily-puzzle removal (PR #97); Scenarios 3–5 referenced below existed only
> in its pre-removal version (see git history).

---

> ## Correction memo — 2026-05-11 (later same day)
>
> After re-examining the methodology used to produce this report, I retract Bug 1 below. The "fresh page load with `#game/<mode>` doesn't bootstrap" symptom was reproduced **only** after a prior `endGame()` call within the same Playwright tab, followed by a `browser_navigate(...)` to a URL with the **same hash already in the address bar**. Browsers do not reload on same-URL same-hash navigation; no `hashchange` fires; the bootstrap effect doesn't re-run; status stays `idle`. That is the documented browser behavior, not a code bug.
>
> Verification: on a new dev server (port 5176) and a cold tab (`about:blank` → deep link), `#game/country-pinning` bootstraps the game at `dt=0` with `status='playing'` and HUD visible. Three repeated cold loads all bootstrap correctly.
>
> The other findings in this report still hold (test-plan inaccuracies on wrong-guess flow and city scoring range; daily resume working; the 8-method test seam catalog). Only the **🔴 Bug 1** section below is retracted.

---

Scenarios run: 1 (Free Country Pinning), 2 (Free City Guessing), 3 (Daily Country Pinning), 4 (Daily City Guessing). Scenario 5 (Launcher / History calendar) not exercised end-to-end; partial observation only.

---

## Summary

| #   | Scenario              | Result                                                                               |
| --- | --------------------- | ------------------------------------------------------------------------------------ |
| 1   | Free Country Pinning  | ⚠️ Mostly works; **1 real bug** in deep-link bootstrap; **2 test-plan inaccuracies** |
| 2   | Free City Guessing    | ✅ Works as designed; **1 test-plan inaccuracy** (per-round score range)             |
| 3   | Daily Country Pinning | ✅ Works end-to-end including resume                                                 |
| 4   | Daily City Guessing   | ✅ Works end-to-end                                                                  |

Three classes of finding:

- 🔴 **Code bug** — design intent unmet
- 🟡 **Doc gap** — feature works, but `daily-puzzle.md` / `purpose.md` doesn't describe it
- 📝 **Test-plan inaccuracy** — `game-happy-paths.md` claimed behavior that the design never intended

---

## ~~🔴 Bug 1 — Deep-link to `#game/<mode>` doesn't bootstrap a free-play game on fresh page load~~ _[RETRACTED, see Correction memo above]_

**Scenario:** Scenario 1, Step 2 (and equivalent for City Guessing).

**Repro:**

1. From a clean page, navigate **directly** to `http://localhost:5175/#game/country-pinning` (e.g. paste URL into a new tab).
2. Observe: map renders. **No launcher, no HUD, no game.** Session stays at `status: 'idle'`. Page is essentially unusable from this URL.

**Working comparison:** Clicking the Launcher's "Play free" button on `/` works correctly — same hash gets written, game bootstraps, HUD renders.

**Programmatic confirmation:** Setting `window.location.hash = 'game/country-pinning'` from `/` (i.e. firing a `hashchange` event) **does** bootstrap the game. The bug is fresh-load-with-hash-already-set.

**Hypothesis:** `GameController` bootstraps from a `hashchange` event handler but doesn't read `window.location.hash` on initial mount, or the read-on-mount happens before the puzzle pools are loaded and isn't retried.

**Why it matters:** Any user who bookmarks/shares the free-play URL, refreshes the tab during a free-play game, or follows a deep-link from another site lands on a broken page. The daily route (`#daily/<date>/<mode>`) is **not affected** — daily bootstrap on fresh load works (verified in Scenario 3 resume test).

**Severity:** HIGH — silently breaks a published deep-link contract; the docs (`daily-puzzle.md:98`, `purpose.md`) list `/#game/<mode>` as a supported route.

**Likely code locations:**

- `src/game/GameController.tsx:176-301` (hash-routing block)
- `src/game/shared/GameSessionProvider.tsx` (pool-readiness gate, lines 34-35)

---

## 🟡 Doc gap 1 — Daily index file is stale by 4 days locally

**Repro:** With a clean checkout, `public/daily/index.json` ends at `2026-05-07`. Today is `2026-05-11`. The launcher correctly degrades (shows "Today's puzzle isn't ready yet" + a "Try May 7's daily →" link), but this is the cold-start UX for _every developer_ today.

**Why it matters:** Onboarding new contributors. They land on the page, see "puzzle isn't ready yet," and don't know whether that's their bug, the daily workflow's bug, or by design.

**Severity:** LOW (dev-only friction, prod gets fresh content from GHA).

**Fix shape:** Either (a) the dev script writes a 14-day rolling window starting from "today" so local always has content, or (b) the launcher's degraded state explains "this is local content from a build N days ago; production refreshes every 6 h."

**Note:** I added 4 synthetic days to test daily flows then reverted. Documented in this report because no other contributor will know.

---

## 🟡 Doc gap 2 — Reveal pause timing differs significantly between modes

**Observed:**

- **Free Country Pinning, correct guess:** ~3.5 s from `submitGuess` → next round (auto-advance).
- **Free Country Pinning, wrong guess (non-fatal):** indefinite hold; user **must click Continue** in the opened country panel. No auto-advance, no timeout fallback. (See Test-plan inaccuracy 1.)
- **Free City Guessing, any guess:** ~200-300 ms auto-advance.
- **Daily Country Pinning, final correct attempt:** ~3.0 s `round-ended` → `game-over`.
- **Daily City Guessing, final correct attempt:** ~1.5 s `round-ended` → `game-over`.

`daily-puzzle.md:35` claims the country hold is ≥ 3 s and city hold is ≥ 2 s. The city hold for daily is closer to 1.5 s, and the city hold for free-play is closer to 0.2 s. The doc is consistent only for the country mode.

**Severity:** LOW — accurate-enough for users; off for anyone writing timing-sensitive tests.

---

## 🟡 Doc gap 3 — `data-app-ready` and `data-map-loaded` live where the CLAUDE.md helpers expect them, but not on `<body>`

The CLAUDE.md e2e rules implicitly imply these attributes are on `<body>`. They actually live:

- `data-app-ready="true"` on `<main>` (not `<body>`)
- `data-map-loaded="true"` on `<div role="application">` (not `<body>`)

The existing `waitForAppReady(page)` helper presumably uses a selector that matches either; new test authors writing helpers from scratch might place them on body and miss.

**Severity:** LOW.

---

## 📝 Test-plan inaccuracy 1 — Wrong-guess flow in country mode (Scenario 1, Steps 3, 5)

My test plan says:

> 3. ... Country panel is **not** opened (mid-game; panel is a post-reveal artifact only).
>
> 5\. ... HUD shows a "wrong" reveal line ... [implied auto-advance like step 4]

Actual behavior: after a **wrong** guess (with lives remaining), the country panel **does open** mid-game, populated with the correct country's full info, and a **"Continue" button** sits inside it. The user must click Continue to advance. There is no auto-advance for wrong guesses (verified by waiting 15 s with no transition).

The design is intentional and clearer than my doc suggests — wrong guesses surface real geopolitical context as a teaching moment. The doc should:

- Acknowledge that the panel does open after wrong guesses.
- Describe the Continue button as the explicit advance action.
- Remove the "panel is post-reveal artifact only" claim.

For correct guesses, no panel opens and auto-advance fires at ~3.5 s — that part of the plan was right.

---

## 📝 Test-plan inaccuracy 2 — City scoring is 0-100 per round, not 0-1000

My test plan said "max 1000" per round. Actual: 100 points max per round, 1000 total across 10 rounds (`CITY_GUESSING_MAX_ROUNDS=10`). The launcher card's "Best (free) 0 / 1000" copy is the _game-total_ range, not per-round.

---

## ✅ Findings that contradicted my prior critical review

A few worth calling out — the prior review (or the agents I dispatched) over-stated some risks.

1. **"Test seams might be only the four advertised: submitGuess, completeNow, finalize, endGame."** Actual seam exposes **8 methods**: `submitGuess`, `submitCountryGuess`, `setRound`, `getSession`, `endGame`, `completeNow`, `finalize`, `restart`. `getSession` and `submitCountryGuess` in particular make programmatic state inspection cheap; the e2e suite could lean on these more.

2. **Resume after refresh works perfectly.** I treated this as a fragile path (silent-failure swallowed catches). In the happy path it's robust: attempts restore, target unchanged, attemptsRemaining correct, hash bootstrap fires the resume action. The risks I flagged are about _failure_ paths (corrupt blob), not the happy path.

3. **History persistence, streak update, and resume-blob clearing on completion are all atomic and verifiable** via the `funworldmap-daily-history` blob. No drift, no race observed.

4. **Daily route fresh-load works**, while free-play deep-link does not (Bug 1). The architectural risk in the prior review ("hash is not really the single source of truth") is more nuanced: daily routing is more robust than free-play routing.

---

## What I did not exercise

- **Done-early flow** (best-of-3 with `completeNow` after attempt 1 or 2). The `completeNow` test seam exists; reducer logic is well-unit-tested. UI button exists (text "Done") but no `data-testid="done"` — tests would need the text-based selector or a new test-id.
- **Share button activation** (`navigator.share` / clipboard fallback + toast). Daily share block was confirmed present; the click path wasn't exercised.
- **`Esc` mid-game** (end-game confirm dialog?). My test plan claimed it dispatches `endGame` directly; not verified.
- **Mode switch from game-over** (the bug-#32 territory). Scenario 1 only tested Play Again into the same mode.
- **Launcher/history calendar** (Scenario 5).
- **Real map clicks** via canvas coordinates. All scenarios used the test seam — the click-handler → reducer plumbing is not verified by this walkthrough.
- **Reduced-motion gating.** My prior assessment flagged `App.tsx:200` as an unconditional `flyTo`. Not retested here.
- **Ocean-click ignored in country mode.** Plan claims it's ignored at the click handler level; the test seam wouldn't reproduce a real ocean click anyway.

---

## Suggested next actions

1. **Fix Bug 1** (`#game/<mode>` fresh-load bootstrap). Should be a small change in `GameController.tsx` to read the hash on mount with a pool-readiness guard. Add an e2e test that opens the URL directly (not via launcher click).
2. **Add `data-testid="done"`** to the Done button. Currently only text-matchable.
3. **Update `docs/testing/game-happy-paths.md`** with the Continue-button flow for wrong country guesses and the corrected city per-round score range.
4. **Bring `public/daily/index.json` forward** to today's date or document the staleness.
5. **Re-run this walkthrough on a built `--mode e2e` bundle** instead of dev to confirm no dev-only paths are being exercised.
