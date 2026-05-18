# UX Smoothening — Phase 2: Composition Polish + Discoverability Design

**Date:** 2026-05-17
**Status:** Draft — pending user review
**Depends on:** [`2026-05-17-ux-smoothening-design.md`](2026-05-17-ux-smoothening-design.md) (Phase 1, shipped as PRs #85, #87, #88).

---

## Background

Phase 1 addressed Theme A (copy) and most of Theme B (composition) and Theme C (first-load posture) from the original critical review. This spec covers the **remaining items** from Themes B and C that were either deferred from Phase 1 or surfaced as gaps during implementation.

This is not "Theme D / engagement loop" — that gets its own spec when we're ready. This is the second pass at _composition_ and _discoverability_ now that the foundation has stabilized.

---

## Analysis: Phase 1 status vs. original review

### Theme B (Launcher Composition)

| Original review item                                                                         | Phase 1 status                                                                                                                                | Phase 2? |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Default-open modal on every visit                                                            | ✅ Fixed (Phase 1 §C — map-first posture)                                                                                                     | No       |
| Card density (5 elements per card)                                                           | ✅ Reduced to 4 (title, subtitle, CTA, caption); `Best (free)` footer + `Play free mode →` link removed                                       | No       |
| Two side-by-side cards + streak pill + history + dismiss link = 5 jobs                       | ⚠️ Visual hierarchy cleaned but still 5 surfaces; not collapsed to "two zones" as the review proposed                                         | **B1**   |
| Dismiss link "Just explore the map" buried at bottom                                         | ✅ Fixed (× close button top-right)                                                                                                           | No       |
| Per-card "Play free mode →" link                                                             | ✅ Consolidated into shared `Play unlimited rounds →`                                                                                         | No       |
| Per-card `Best (free)` stats footer removed → unlimited-mode personal-bests have no home now | ⚠️ Spec promised "personal bests remain accessible from the post-game HUD and from a future stats view" — the future stats view doesn't exist | **B2**   |
| History panel utilitarian (single-letter day headers, dense cells, no per-cell memory)       | ❌ Not touched                                                                                                                                | **B3**   |
| Mobile launcher composition not visually audited                                             | ⚠️ E2E selectors pass on mobile-chromium / mobile-webkit / desktop-firefox-touch but no screenshot-level audit                                | **B4**   |
| Header crowding (Phase 2-introduced byproduct)                                               | ⚠️ Desktop now has search + streak chip + play pill + satellite + theme = 5 controls. Mobile collapses streak into pill (one tap target)      | **B5**   |

### Theme C (First-visit & Discoverability)

| Original review item                                            | Phase 1 status                                                                                          | Phase 2?                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| No moment of orientation; launcher modal takes over             | ✅ Fixed (map-first; header CTA)                                                                        | No                                 |
| Play icon is just a triangle with no visible label              | ✅ Fixed (`▶ Play today` pill with state-dependent variants)                                            | No                                 |
| Hint toast "Explore the world" is generic                       | ✅ Rewritten as `Click a country to explore — or press / to search`                                     | No                                 |
| Keyboard hint (`/`) only surfaces inside search dropdown footer | ⚠️ The new hint toast mentions it briefly but a visitor who never lingers on the map never sees it      | **C1**                             |
| Satellite toggle icon (striped globe) hard to read              | ❌ Not touched                                                                                          | **C2**                             |
| First-visit one-time intro (deferred deliberately)              | ❌ Not built — explicit Phase 1 non-goal, to revisit after observing whether map-first reads on its own | **C3** _(conditional — see below)_ |

---

## Goal

Close out Themes B and C with the items above. The frame is: Phase 1 made the surfaces _correct_; Phase 2 makes them _complete_ — every job has a clear home, every discoverable shortcut has a path, and the launcher stops feeling like five competing things at once.

### Primary success criteria

- The launcher's primary view collapses visually to ≤ 3 zones (today, retention indicator, secondary actions) without losing the Phase 1 retention nudges.
- Unlimited-mode personal bests have a discoverable home outside the post-game HUD.
- The history panel feels like a memory log, not a checkin grid.
- A keyboard-curious visitor learns about `/` to focus search without needing to open the search dropdown first.
- The satellite toggle communicates its state _legibly_ at a glance — current icon technically communicates state (color + aria-pressed) but not clearly.

### Explicit non-goals

- Engagement-loop polish (custom streak mark, completion celebrations, bonus rounds, history hover animations) — Theme D, separate spec.
- New game modes.
- Reveal overlay rewrite (the strongest surface; don't fix what isn't broken).
- Game HUD copy beyond Phase 1's `FirstSessionTutorial` change.
- Region-badge color semantics — Theme E polish, defer.

---

## Principles

1. **Two zones if real; three zones if honest.** The Phase 1 review proposed "two zones" but kept five. Phase 2 owes a more honest collapse — even if the result is three.
2. **Every promise has a home.** If Phase 1 said "stats view eventually" then Phase 2 builds it, or removes the promise.
3. **Discoverability without overlays.** Keyboard hints and toggle labels should live in always-visible affordances (tooltips, placeholders, captions) — not modal popovers.
4. **Conditional first-visit intro.** Don't build a one-time onboarding modal speculatively. Decide based on funnel signal from Phase 1's `header_cta_clicked → daily_started` data.

---

## Scope

Phase 2 fans into **three PRs** of increasing risk:

### PR1 — Launcher polish (low risk, high impact)

- **B1.** Composition reduction to 3 zones.
- **B3.** History panel polish (memory cells + readable day headers).
- **C1.** `/` keyboard hint persistent surface.
- **C2.** Satellite toggle icon + label.

### PR2 — Stats view (new surface)

- **B2.** New `/stats` view (modal or route) showing unlimited PBs + lifetime daily totals + calendar link.
- Integration: a "Stats" link in the launcher's secondary-actions zone (introduced in B1).

### PR3 — Optional follow-ups

- **B4.** Mobile launcher visual audit + screenshot regression test.
- **B5.** Header consolidation (combine satellite + theme into a single "view options" popover) — only if user feedback says the desktop header feels crowded. Otherwise defer.
- **C3.** First-visit intro — **only if** the Phase 1 funnel data shows new visitors aren't finding the daily. Build the intro as a one-time toast (not a modal) explaining "this is a map AND a daily puzzle game."

---

## B1 — Launcher composition reduction

### Current state (post-Phase 1)

```
┌─────────────────────────────────────────┐
│                                  [×]    │
│            funworldmap                  │
│         Today's puzzle · May 17         │  ← zone 1: brand + date
│                                         │
│   🔥 5-day streak  ·  Past 30 days →    │  ← zone 2: streak + history
│                                         │
│   ┌────────┐    ┌────────┐              │  ← zone 3: cards
│   │Country │    │  City  │              │
│   │ ▶ Play │    │ ▶ Play │              │
│   └────────┘    └────────┘              │
│                                         │
│   Play unlimited rounds →               │  ← zone 4: unlimited
└─────────────────────────────────────────┘
```

That's four zones excluding the × button.

### Target state

```
┌─────────────────────────────────────────┐
│  Today's puzzle · May 17       🔥 5  [×]│  ← zone 1: header (brand+date+streak+close)
│                                         │
│   ┌────────┐    ┌────────┐              │
│   │Country │    │  City  │              │  ← zone 2: today
│   │ ▶ Play │    │ ▶ Play │              │
│   └────────┘    └────────┘              │
│                                         │
│   Past 30 days  ·  Unlimited  ·  Stats →│  ← zone 3: secondary
└─────────────────────────────────────────┘
```

Changes:

- Streak chip moves into the launcher header row, next to the date. The `Past 30 days →` link lives in the secondary-actions zone, not paired with the streak.
- `Play unlimited rounds →` becomes a peer link with `Past 30 days` and a new `Stats` link — three small text links in one row.
- "funworldmap" wordmark moves out of the modal (the user is already on funworldmap; the brand wordmark is redundant inside the dialog). The launcher's `aria-label="Choose how to play"` carries the dialog purpose.

Open question for review: do we keep the wordmark for tone (it gives the modal "personality") or drop it for density?

### Implementation notes

- `LauncherStreakPill` is repurposed — for `streakMode === 'active'`, the streak chip becomes a sibling of the title/date in the launcher header row.
- **The Phase 1 retention nudges (`Your streak’s reset — back in with today’s puzzle?` for broken; `You haven’t played today yet — start a streak?` for first) must be preserved** — they were a deliberate Phase 1 design choice with retention value, not throwaway copy. Render them as a small caption line between the cards and the secondary-actions row, shown only when `streakMode !== 'active'`. This keeps the nudge visible without occupying its own visual zone.

---

## B2 — Stats view

### Goal

Give unlimited-mode personal bests a permanent home. Also surface lifetime daily totals that don't fit on the launcher.

### Priority caveat

B2's priority is **medium-low**. The argument for building it: returning visitors who want to check their best score currently have no path except "play another game and look at the post-game overlay" — an awkward dance. The argument against: most casual visitors may not care about their personal bests. We're building an honest home for a stat we promised in Phase 1 spec text, not necessarily one users are demanding.

**Recommendation:** ship B2 only if (a) at least one user has asked for it, OR (b) we want to close the integrity loop on the Phase 1 spec's "future stats view" promise. If neither, defer indefinitely and remove the `Stats →` link plan from B1.

### Design

A new modal accessed from the launcher's secondary-actions row (`Stats →`). Not a new route — modal-only to avoid hash-routing surface growth.

Content:

```
┌─────────────────────────────────────────┐
│ Your stats                          [×] │
│                                         │
│   DAILY (cross-session)                 │
│   Days played       142                 │
│   Current streak    🔥 5                │
│   Longest streak    🔥 17               │
│                                         │
│   UNLIMITED                             │
│                Country     City         │
│   Best score   91/100      890/1000     │
│   Games        38          22           │
│                                         │
│   Past 30 days →                        │
└─────────────────────────────────────────┘
```

### Implementation notes

- New component: `src/components/StatsPanel.tsx`. Reuses `useDailyHistory()` for daily stats and `usePersonalBests()` for unlimited (the hook still exists; Phase 1 dropped only the Launcher caller).
- Trigger: `Stats →` link in launcher's secondary row (B1) opens the panel. On mobile, the panel takes over the launcher view (single-panel stack).
- "Past 30 days →" link inside the stats panel routes to the existing `LauncherHistoryPanel` (already shown when `historyOpen` is true).
- `aria-label="Your stats"`. Focus-traps inside the panel. Esc returns to launcher; another Esc closes launcher.

---

## B3 — History panel polish

### Current state

A 30-cell grid, single-letter day headers (`M T W T F S S`), each cell is a colored square based on play status. Click navigates to that day's reveal.

### Target state

- Day-of-week headers spelled out (`Mon Tue Wed …`) on desktop; single-letter on mobile (`<sm`).
- Today's cell has a subtle ring/border to anchor "where am I in this 30-day window."
- Hover/focus on a played cell shows a small tooltip: `France · 87/100 · See reveal`. Click navigates (existing).
- Played cells keep their current single-accent fill — **rejected: multi-color region tinting** would put 5+ saturated colors on tiny cells and likely read as noisy. The hover tooltip is the memory affordance.
- Rolled-off cells stay dimmed and inert (no change).

### Implementation notes

- Tooltip via `title` attribute (cheap, accessible, native). No new component.
- Mobile day-header switch via Tailwind responsive utilities.
- Region color promotion (out of `SearchBar.tsx` into `src/lib/regionColors.ts`) was previously suggested but **dropped from this slice** — calendar doesn't need it. Theme E item, defer to its own spec.

---

## C1 — Persistent `/` keyboard hint

### Current state

The new map-load hint toast says `Click a country to explore — or press / to search`. It dismisses after a few seconds; a visitor who returns later (or refreshes) sees nothing about `/`.

### Target state

The search input's placeholder cycles between two states:

- Default: `Search countries…`
- Hover/focus or `aria-describedby` reveal: `Press / to focus from anywhere`

Or simpler: add a `kbd`-styled hint inside the search bar's right edge (left of the clear-X) showing `/` when the input is unfocused. Disappears on focus.

```
┌────────────────────────────────────────┐
│  🔍  Search countries…           [ / ] │
└────────────────────────────────────────┘
       (focused)
┌────────────────────────────────────────┐
│  🔍  France|                       [×] │
└────────────────────────────────────────┘
```

### Implementation notes

- The kbd badge lives in `src/components/SearchBar.tsx`. Visible only when `query === ''` and input is not focused (use `:focus-within`).
- `aria-hidden="true"` on the kbd badge — screen readers don't need this hint.

---

## C2 — Satellite toggle clarity

### Current state

`Header.tsx` line ~70 area: the satellite toggle is a 40×40px button with a striped-globe SVG. Toggling between map and satellite changes the SVG fill but the icon's _meaning_ isn't clear without hovering for the aria-label.

### Target state

- Replace the striped-globe SVG with a simpler **two-state icon**: a satellite-dish glyph when satellite mode is active; a road-map / contour glyph when off.
- Add a hover/focus tooltip via `title` attribute showing the current state's _opposite_ (i.e., what clicking will do): `Switch to map view` / `Switch to satellite view`.

### Implementation notes

- Two new SVG glyphs in `Header.tsx` (or extract to `src/components/icons/`).
- The `aria-label` already conveys state to screen readers — no a11y regression.

---

## C3 — First-visit intro (conditional)

### Decision rule

Build this **only if** the post-launch funnel data from Phase 1 shows a material regression. Specific thresholds depend on the project's baseline volume; the user should set them by inspection of `cloudflare-worker/queries/daily_funnel.sql` after 14+ days of traffic. Rough heuristics:

- `header_cta_clicked` rate per session is materially lower than the old `launcher_auto_opened → daily_started` rate
- OR daily-engagement metrics drop meaningfully vs. the pre-Phase-1 baseline.

If neither, skip. The map-first posture is sufficient orientation.

### Target state (if built)

A single one-time toast on first visit, dismissed permanently via localStorage flag `funworldmap-onboarded`:

```
┌──────────────────────────────────────────────────────┐
│  Welcome.                                        [×] │
│  funworldmap is an interactive world map AND a       │
│  daily puzzle. Click any country to explore, or      │
│  press ▶ Play today to try the puzzle.               │
└──────────────────────────────────────────────────────┘
```

Position: top center of viewport, below the header. Auto-dismisses after 8 seconds OR on first interaction. Sets `funworldmap-onboarded=1` on close. Never reappears.

NOT a modal. NOT a tour. One sentence of context, dismissible, gone.

---

## Risks

1. **B1 stats-link addition.** Adding `Stats →` to the launcher's secondary row before B2 ships creates a dead link. **Mitigation:** ship B1 and B2 in the same PR, OR conditionally hide the Stats link until B2 lands.
2. **B3 region colors.** Reusing search badge colors in the calendar might create visual conflict if the launcher palette doesn't accommodate them. **Mitigation:** prototype the calendar cells first; if conflicts, fall back to a single accent color with intensity variation.
3. **C1 placeholder visibility.** A `/` kbd badge inside the search bar competes with the existing clear-X button visually. **Mitigation:** verify on mobile — if cramped, drop C1's badge and rely on the hint toast only.
4. **C2 icon legibility regression.** A new satellite-dish glyph might be no clearer than the current one. **Mitigation:** review icon options side-by-side before committing.
5. **C3 funnel decision.** Building C3 speculatively wastes effort if map-first was sufficient. The decision rule above is the safeguard.

---

## Implementation order

PR1's scope below assumes B2 ships (most ambitious shape). If B2 is deferred per its priority caveat, drop steps 2–3 from PR1 and the resulting smaller PR is even more clearly low-risk.

**PR1a: Composition + history polish + small discoverability wins**

1. Restructure `Launcher.tsx` per B1 (collapse to 3 zones, preserve retention nudges).
2. `LauncherHistoryPanel.tsx` polish per B3 (tooltip + readable day headers).
3. `SearchBar.tsx` `/` kbd badge per C1.
4. `Header.tsx` satellite icon + title per C2.
5. e2e selector updates (focus-order test, satellite-toggle title test).

**PR1b (conditional on B2 priority decision): Stats panel**

6. Build `StatsPanel.tsx` per B2.
7. Wire `Stats →` link in launcher's secondary row.
8. New `e2e/stats-panel.spec.ts`.

PR1a and PR1b are split because PR1a is risk-free polish, while PR1b adds a new surface. Shipping PR1a first lets the stats view be debated separately without holding up the rest.

**PR2 (optional, conditional): B4 + B5 + C3**

Defer to after Phase 1 funnel data is in (14+ days post-PR #87 merge). Decide based on signal.

---

## Testing notes

- B1: rewrite `e2e/launcher.spec.ts` focus-order test for the new tab sequence (close → streak chip → cards → secondary links).
- B2: new `e2e/stats-panel.spec.ts` covering the 3 sections (daily / unlimited / past-30-link) and esc-flow.
- B3: extend `e2e/launcher-history.spec.ts` with hover assertion (or skip — hover testing is fragile; rely on unit tests for the tooltip text).
- C1: e2e on the kbd badge visibility (hidden on focus, visible on blur).
- C2: e2e on the satellite toggle title attribute changes.
- Unit: snapshot/regression for `StatsPanel` rendering and `regionColors` exports.

---

## What this is not

This spec does not redesign the daily puzzle, the reveal overlay, the in-game HUD, or the map itself. It does not introduce a new visual identity. It closes out the launcher-and-discoverability slice that Phase 1 started.
