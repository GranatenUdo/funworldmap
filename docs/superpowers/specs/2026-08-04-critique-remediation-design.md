# Critique remediation batch — design

**Date:** 2026-08-04
**Author:** Tobias Ens (with Claude)
**Status:** Approved (owner: "proceed", 2026-08-04); revised same day after code investigation

## Context

A dual-agent design critique ran on 2026-08-04 (snapshot:
`.impeccable/critique/2026-08-04T07-32-14Z__src-app-tsx.md`, baseline 30/40).
The owner scoped the plan to "everything" with two standing rulings recorded in
PRODUCT.md the same day: **guessing is spatial by definition** (typed guessing
is never a guess input) and **the games are deliberately pointer-only for now**
(keyboard playability of the guess action was considered and cut — suppressed
in future critiques via `.impeccable/critique/ignore.md`). Nothing in this
batch adds keyboard guess input.

## Premises falsified by investigation (recorded so the critique trail is honest)

A four-agent code investigation preceded implementation and disproved four
critique observations against HEAD:

1. **"City reveal advances in <300 ms" — false.** The only advance timer is
   `useGameAnnouncements.ts:112-115` with `Math.max(plan.durationMs + 300, 1800)`
   (skip: 2000 ms). Nothing at HEAD produces a sub-300 ms advance. The floors
   stay; the *legibility* complaint is real and is answered by the itemized
   score chip (A-1) rather than more wallclock.
2. **"Country correct guess advances instantly with no ceremony" — false.**
   Correct guesses already get the B5 green fill pulse (unit-pinned), the
   round-end target panel with Continue, and a 3000 ms skippable hold. The
   genuinely missing beat is the itemized "+N" (A-1).
3. **"Game-over scrim steals the final reveal" — not on the timer path.** The
   ends-game timer is `max(animatedMs, 3000)` ≥ the reveal length; only
   user-initiated skips (Enter/Escape/Space/Continue) pre-empt the reveal,
   which is the user's choice. No change.
4. **"Cold-load mobile deep links apply the desktop offset" — false.**
   Measured: cold-load `#DEU` at 390×844 is pixel-identical to in-session
   selection. The real defect: `panelScreenOffset()` is evaluated once per fly
   and **never re-applied when the viewport changes afterwards** — resizing or
   rotating across the 1024 px boundary (or DevTools device emulation, which is
   what the critique agent did) strands the country off-screen (B-1).

Also falsified: the "dead `<body>` tab stop" is the ordinary tab-wrap into
browser chrome, not an element. A real oddity exists instead — the map is two
consecutive tab stops (container div `tabIndex=0` + MapLibre canvas
`tabindex=0`) — recorded as a P3 follow-up, not fixed here (keyboard-map-nav
coverage depends on the current order).

## Package A — game feel

- **A-1. Itemized "+N" score chip.** On every score change, a chip drifts up
  from the ScoreBadge showing `+{lastOutcome.pointsEarned}` (value in signal —
  live game state; `.text-readout` face; no emoji). CSS keyframe + component
  state keyed on score change; exposes `data-animation-state`
  (entering→idle) per CLAUDE.md; reduced-motion shows it statically for the
  same duration. Serves both modes (city legibility, country celebration).
- **A-2. Hearts encode life, not loss + last-life staging.** Inverted
  encoding: filled signal hearts = remaining lives, hollow neutral = spent;
  when one life remains, the remaining heart gets a subtle CSS pulse
  (reduced-motion: static emphasized state). Amends E4's "hearts render
  neutral starlight and turn signal when lost" — justified by critique
  evidence (three grey hearts at start read as *empty*). Signal still means
  live game state — now pointing at what remains. `LivesIndicator.test.tsx`
  pin and DESIGN.md move in the same change.

## Package B — mobile/platform fixes

- **B-1. Re-apply the camera offset on breakpoint change.** While a single
  country is selected (session idle, not comparing), crossing
  `DESKTOP_MEDIA_QUERY` re-centers via the existing `flyToCountry` with
  `preserveZoom: true` and duration 0 (a jump — no autonomous animation), so
  the panel/sheet offset matches the new layout. Plain resizes inside one
  breakpoint (URL-bar collapse) drift by tens of px and are left alone.
  Listener lives beside the existing fly site (`useSelectionHighlight`),
  keyed to the media query's `change` event.
- **B-2. Micro-target tap assist (country game, coarse pointers).** A plain
  `map.on('click')` handler (the delegated layer listener cannot widen its
  hit test), gated to `session.status === 'playing'` + country mode +
  coarse pointer via `matchMedia` (never `originalEvent` — synthetic seam
  clicks carry none): if the exact point hits no country fill, re-query at
  growing bboxes (±2/±4/±8 px) and submit the first hit; a genuinely empty
  ±8 px bbox is an ocean miss (C-7). Idle-mode and fine-pointer behavior
  unchanged; e2e ocean-click preconditions (exact-point, idle-mode) hold.
  Unit tests fake the bbox query on the fake-map pattern.

## Package C — a11y, run safety, polish

- **C-1. Light-mode contrast sweep (measured).** Minimal edit set (light
  classes only; dark variants untouched): `text-sand-500 → text-sand-600` at
  SearchBar 180/223/242/251, HudShell 44, CityGuessingHud 54/64, RoundCounter
  17 (3.4–3.6:1 → 4.9–5.75:1). Bonus sand-400 fixes: search clear icon → 
  sand-500 (clears the 3:1 non-text floor), SourceTooltip "i" glyph →
  sand-600 (text glyph, needs 4.5:1), search placeholder → 
  placeholder-sand-600, RoundCounter "/" separator → sand-400→sand-500.
  Icon-only sand-500 uses that already pass 3:1 (theme/basemap toggles,
  alive hearts pre-inversion) are untouched.
- **C-2. Basemap toggle a11y name.** Drop `aria-pressed` (a changing action
  label plus a pressed state reads ambiguously); keep the dynamic
  label/title and `data-satellite-active`. e2e updates: `country-labels.spec`
  :53/:56 and `satellite-default.spec` :27/:63 assert
  `data-satellite-active` instead of `aria-pressed`.
- **C-3. Focus strands.** (a) Game start: the HUD region (`role="region"`,
  "Game HUD") gains `tabIndex={-1}` and rAF-focuses on mount (the
  SingleCountryPanel house pattern) — covers launcher-start and deep-link
  starts. (b) Compare-pick: `enterComparePicking` rAF-focuses `#search-input`
  after the flip (the search box is the picking tool; its placeholder already
  swaps). Unit tests in the `SingleCountryPanel.focus.test` style.
- **C-4. Run-safety confirm.** `finishFree`-bound actions (Escape while
  playing / city round-ended, and the HUD End-game button) route through a
  small focus-trapped confirm — "End game? Your score will be saved." Safe
  action ("Keep playing") is primary and initially focused; Escape inside the
  dialog keeps playing. Trivial runs (round 1, score 0) end immediately,
  no dialog. Wiring stays in `GameController` (the `useEscapeExit` contract
  and its unit pins are unchanged — the controller's callback now opens the
  dialog). Country round-ended Escape-as-advance and game-over Escape are
  untouched. e2e updates: the four specs that Escape/End mid-run click
  through the dialog.
- **C-5. Ocean-click feedback (country game).** B-2's miss branch announces
  "Ocean — pick a country" as a transient `role="status"` line in the HUD
  (screen-reader announced, auto-clearing, no toast spam). Applies on fine
  pointers too (exact-point miss).
- **C-6. Re-openable help.** A "?" fitted button in the HUD shell (aria-label
  "How to play") re-opens the how-to-play card; `FirstSessionTutorial`
  becomes controllable (first-session auto-show unchanged).
- **C-7. Personal-best moment.** "New personal best!" on game-over becomes a
  signal-family badge (`bg-signal/15 border-signal/30 text-signal-accessible
  dark:text-signal`) with a fade-up — game state gets signal per the
  two-accent rule the current ice styling violates.
- **C-8. Launcher scrim.** Deepen the mobile backdrop (opacity + blur) so
  sheet content stops ghosting through beneath the cards.
- **C-9. Search noise.** Tune Fuse options so "franc" no longer ranks Iran
  second; regression case added to the search unit tests; typo forgiveness
  preserved.
- **C-10. "Banghazi" → "Benghazi"** in the cities dataset (plus a scan for
  sibling typos).
- **C-11. DESIGN.md documentation gaps** from the deterministic scan: 13px
  documented as the small-body step, 10px as the micro-glyph floor, and the
  space-dark gradient hexes added to the frontmatter palette; hearts doctrine
  updated per A-2.
- **C-12. Play-first hint copy.** The cold-load hint leads with play ("Hit
  Play — two quick geography games · or click any country to explore"); A12's
  post-panel hint and localStorage gates stay.

## Non-goals

- Keyboard operability of the guess action (owner scope decision 2026-08-04);
  type-to-guess in any form (owner ruling — never).
- Compare distant-pair locator design (deferred — needs design, C/E work).
- Mobile header layout / Play relocation (G4); the double map tab stop (P3
  follow-up); streak flares, per-round recap, region filter (workstream F);
  difficulty ramp and scoring-curve tuning (open product questions).

## Analytics

No new telemetry in this batch.

## Verification

`npm run check` green; affected e2e specs green locally with `--workers=2`
(background dev server killed first); no `waitForTimeout`, no `force: true`;
map paint/camera changes stay inside existing owners (`useSelectionHighlight`
owns the re-center; the tap-assist handler follows the `clickMap` plain-handler
precedent); DOM animations expose `data-animation-state`; live pass of game
flows on desktop + 390px mobile, both themes. e2e timing updates are listed
per-spec in C-4/C-2; the reveal-animation specs' no-timer dependence on the
wrong+intra-game branch is preserved (no new timers added there).
