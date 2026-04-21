# Launcher Landing State

**Date:** 2026-04-20
**Status:** Draft — pending user review
**Depends on:** none
**Supersedes:** the deferred "Phase 1" direction from the earlier Foundation brainstorm. Paper-tone / serif work remains deferred.

## Overview

Replace the current default "map + hint pill" home view with a **launcher** — a centered modal card over a dimmed map, showing two mode cards (Country Pinning, City Guessing) with personal bests, a tagline, and a "Just explore the map" dismiss link. Session-scoped: dismissing hides it for the session; a fresh tab re-shows it. Deep-link URLs bypass it entirely. The header simplifies while the launcher is up (wordmark + search + theme toggle only). The existing `PlayMenu.tsx` popover is deleted — the launcher is the single source of truth for mode picking.

This is the first spec of a multi-phase game-first visual redesign. Later phases (surface palette overhaul, HUD polish, mode-transition choreography) get their own specs.

---

## Confirmed scope

### Launcher appearance and positioning

- **Default cold-load view at `/`** (or `/#`): centered launcher card over a dimmed, blurred map.
- **Backdrop:** full-viewport, `rgba(0, 0, 0, 0.55)` in light theme, `rgba(11, 15, 26, 0.7)` in dark theme, `backdrop-filter: blur(4px)`. Starting values; tuned empirically during implementation. `pointer-events: auto` so map clicks beneath are blocked.
- **Card cluster:** narrow-centered (`max-w-2xl mx-auto`), contains wordmark, tagline, two mode cards, and a dismiss link.
- **Z-index:** launcher root at `z-[210]`, above the basemap loading overlay (`z-[200]`) so users can click mode cards while the basemap is still loading.

### Launcher content (top-down)

1. **Wordmark** — "funworldmap" in existing Outfit bold, teal color.
2. **Tagline** — "194 countries. Explore or guess." Outfit 13–14px, meta color. (194 is the independent-country count in `src/data/countries.json`, which is the game pool size. The existing `index.html` meta tags state 195 — a pre-existing inaccuracy — and are corrected to 194 as part of this PR, see Modified files.)
3. **Mode cards** — two cards. Layout: side-by-side (Tailwind `sm:grid-cols-2`, ≥640px viewport); stacked vertically on narrower viewports (`grid-cols-1` default). Cards stretch to equal height via CSS grid default behavior. Gap between cards: `gap-3` (12px) on mobile, `gap-4` (16px) on desktop.
4. **Dismiss link** — "Just explore the map" beneath the cards; styled as a text-link (`text-teal dark:text-teal-light`, underlined on hover).

### Mode card (`LauncherModeCard`) structure

Each card contains:

- **Inline SVG icon** (32px, teal stroke, `currentColor`). Pin glyph for Country Pinning; skyline silhouette for City Guessing. Icons live in the component file as inline SVG, matching the existing header-icon idiom.
- **Mode name** — Outfit 18px bold (e.g., "Country Pinning").
- **Mode tagline** — Outfit 13px meta color:
  - Country Pinning: "Click where the country is. 10 rounds."
  - City Guessing: "Drop a pin near the city. 10 rounds."
- **Personal best block** (Q11-C format, two lines):
  - Label: `BEST` in 11px uppercase, teal, `tracking-wider`.
  - Value: large numeric `920` (24px `tabular-nums`) + smaller ` / 1000` (13px, meta color).
- **Empty state** (when `best.gamesPlayed === 0`): `BEST — / 1000` (em-dash placeholder, same visual height).

Card is a single `<button>` — the whole surface is tappable. No nested interactive elements.

### Visibility state machine

Encapsulated in new hook `src/hooks/useLauncherVisibility.ts`:

```tsx
export function useLauncherVisibility(): {
  visible: boolean
  dismiss: () => void
  show: () => void
}
```

- **Inputs:** `window.location.hash` (via `hashchange` listener, same pattern as `useSelectedCountry`), `session.status` from `useGameSessionContext`, and an internal `dismissed` state.
- **Computed visibility:** `visible = isBareRoot(hash) && !dismissed && session.status === 'idle'`.
  - `isBareRoot(hash)` is `hash === '' || hash === '#'`.
- **Transitions:**
  - Mount: `dismissed = false`. Visibility derived from current hash + session status.
  - `dismiss()`: sets `dismissed = true`. Visibility becomes false on next render.
  - `show()`: sets `dismissed = false`. Visibility becomes true on next render if `isBareRoot && session.status === 'idle'`.
  - **Game-end reset:** when `session.status` transitions from any non-idle value to `'idle'`, the hook resets `dismissed` to `false`. If hash is bare root, launcher re-appears (per Q9-(ii)).
- **No persistence:** no `localStorage`, no `sessionStorage`. `dismissed` is in-memory React state. A fresh tab resets to `dismissed = false` — cold-load always shows the launcher on bare root.
- **Deep-link bypass:** any cold-load at `/#<cca3>` or `/#game/*` has `isBareRoot = false` → `visible = false`. No additional code needed.

### Dismiss paths

All paths call `useLauncherVisibility().dismiss()`:

1. **Explicit link** — "Just explore the map" button click.
2. **Search-typed** — first non-empty `change` event on the search input while `launcherVisible` is true.
3. **Mode card click** — the card's `onStart` handler calls `dismiss()` then writes the game hash via the existing mode-start flow. Calling `dismiss()` first lets the launcher exit-animation play before the HUD renders.
4. **Escape key** — existing handler in `App.tsx` extends: when `launcherVisible && !selected && !gameActive`, Escape calls `dismiss()`.
5. **Play button click** (header, post-dismiss state) — opposite direction: calls `show()` only. Re-opens launcher from explore state. Does NOT deselect a currently selected country; the backdrop hides it visually, and cancelling via "Just explore the map" returns the user to their preserved selection.

### What does NOT dismiss

- Map clicks behind the launcher (backdrop absorbs via `pointer-events: auto`).
- Focusing the search input without typing (only first non-empty `change` dismisses).
- Keyboard-tab navigation that passes through the launcher (focus trap constrains to launcher-internal elements).

### Header simplification while launcher is visible

New prop on `Header`: `launcherVisible: boolean`.

- **Visible:** wordmark (desktop only, `lg:flex`), search bar, theme toggle.
- **Hidden when launcher is up:** play button, satellite toggle.
- **Restored on dismiss:** play button and satellite toggle re-appear.

The header's play button (post-dismiss) re-opens the launcher via the `show()` path described above — it does NOT open a popover.

### PlayMenu deletion

`src/components/PlayMenu.tsx` is deleted. Its responsibilities migrate:

- **Mode listing via `listModes()`** — moved into Launcher.
- **Last-played mode ordering** — same behavior in Launcher via the extracted module (below).
- **Keyboard nav / focus trap / Escape** — Launcher's own focus trap covers this.
- **Outside-click close** — N/A for a modal (dismissal is explicit).

`LAST_MODE_KEY = 'funworldmap-game-last-mode'` was a local constant in PlayMenu. Extract to a new module `src/game/shared/lastMode.ts` that exports:

```tsx
export const LAST_MODE_KEY = 'funworldmap-game-last-mode'
export function readLastMode(): ModeId { /* same logic as PlayMenu */ }
export function writeLastMode(modeId: ModeId): void { /* same logic */ }
```

The Launcher imports `readLastMode` for initial focus. The game-start flow (which already writes this key) is adjusted to use `writeLastMode` too — one less string literal floating around.

### Animation

Entrance (on mount):

| t (ms) | Element | Animation |
|---|---|---|
| 0 | Backdrop | opacity 0 → 1, 220ms ease-out |
| 60 | Wordmark + tagline | opacity 0 → 1 + translateY 8px → 0, 240ms ease-out |
| 120 | Left mode card | opacity 0 → 1 + scale 0.96 → 1, 220ms ease-out |
| 180 | Right mode card | same, staggered +60ms |
| 260 | Dismiss link | opacity 0 → 1, 180ms ease-out |

Exit (on dismiss): 140ms opacity-out on the whole dialog, no stagger.

New `@keyframes` in `src/index.css`: `launcher-backdrop-in`, `launcher-card-in`, `launcher-text-in`, `launcher-exit`. Staggered delays applied inline via `style`, matching the existing `panel-field-in` pattern at `src/components/SingleCountryPanel.tsx`.

`prefers-reduced-motion: reduce` — existing global rule in `src/index.css:243-251` clips all `@keyframes` animations to ~10ms. No launcher-specific reduced-motion handling needed.

### Accessibility

- **Dialog semantics:** `role="dialog"`, `aria-modal="true"`, `aria-label="Choose how to play"` on the launcher root. Modern assistive tech treats elements outside the dialog as inert via `aria-modal` — no `aria-hidden` on the rest of the DOM required.
- **Focus trap:** Tab and Shift+Tab cycle among three focusable elements (mode card 1, mode card 2, dismiss link). ~20-line inline trap implementation; no library dependency.
- **Initial focus:** lands on the last-played mode's card (via `readLastMode()`), or Country Pinning if none.
- **Focus return on dismiss:**
  - Explicit link → `#search-input`.
  - Search-typed → focus already in search; no change.
  - Mode card click → focus moves to game HUD (existing framework behavior).
  - Escape → `#search-input`.
  - Play button click (re-opening launcher from explore state) → first mode card button.
- **Screen reader announcements:** on dismiss, the existing `funworldmap:announce` live region (`App.tsx:260`) announces `"Launcher dismissed"`, matching the `"Country panel closed"` pattern.
- **Keyboard shortcuts preserved:** `/` still focuses search (`App.tsx:236-239`); typing `/` while launcher is up focuses search and the next keystroke dismisses. Natural.

---

## Architecture & files touched

### Added

- `src/components/Launcher.tsx` — new component. Renders root dialog, backdrop, wordmark, tagline, two `LauncherModeCard`s, dismiss link. Hosts the focus trap. Consumes `useLauncherVisibility` (via props from `App.tsx`), `usePersonalBests('country-pinning')`, `usePersonalBests('city-guessing')`.
- `src/components/LauncherModeCard.tsx` — new component. Presentational; receives mode metadata, `best: PersonalBest`, `onStart: () => void`.
- `src/hooks/useLauncherVisibility.ts` — new hook. State machine described above.
- `src/hooks/__tests__/useLauncherVisibility.test.ts` — new. Unit tests for state transitions.
- `src/game/shared/lastMode.ts` — new small module exporting `LAST_MODE_KEY`, `readLastMode()`, `writeLastMode(modeId)`.
- `e2e/helpers.ts` — new. Exports `dismissLauncher(page)` used by existing specs' `beforeEach` during the migration.
- `e2e/launcher.spec.ts` — new Playwright spec.

### Modified

- `src/App.tsx`:
  - Renders `<Launcher />` when `useLauncherVisibility().visible` is true.
  - Passes `launcherVisible` into `<Header>`.
  - Binds the play-button-click handler: calls `show()` only. Does NOT deselect the currently selected country. Rationale: the launcher's backdrop visually hides the country panel anyway; if the user cancels via "Just explore the map" they return to their previous context (country selection preserved). Picking a mode transitions hash to `#game/*` which clears selection naturally.
  - Extends the Escape handler to call `dismiss()` when `launcherVisible`.
- `src/components/Header.tsx`:
  - Accepts `launcherVisible: boolean` prop and `onPlayClick: () => void`.
  - Replaces PlayMenu trigger + popover with a plain button that calls `onPlayClick`.
  - Removes `PlayMenu` import, `menuOpen` state, `triggerRef`.
  - Guards on the action-cluster widen: play button + satellite toggle hidden when `launcherVisible || gameActive`. Theme toggle always visible.
- `src/components/SearchBar.tsx`:
  - Adds optional prop `onNonEmptyChange?: () => void` called whenever the controlled input `value` transitions to a non-empty string during an onChange event. No ref-guard / once-per-mount tracking — the handler is a plain dispatch. Safe to call repeatedly because its only effect is `setDismissed(true)`, which is idempotent. Having no guard also means the hook handles the game-ended re-show case correctly (next launcher appearance still dispatches on first keystroke without needing re-arming logic).
  - Hook up: `Header` forwards `onNonEmptyChange={launcherVisible ? onLauncherDismiss : undefined}`.
- `src/index.css`: adds four new `@keyframes` (`launcher-backdrop-in`, `launcher-card-in`, `launcher-text-in`, `launcher-exit`).
- `index.html`: corrects three occurrences of "195 countries" → "194 countries":
  - Line 10 (`<meta name="description">`)
  - Line 17 (`<meta property="og:description">`)
  - Line 24 (`<meta name="twitter:description">`)
  Pre-existing inaccuracy surfaced during the tagline audit; corrected here to keep product copy consistent with the new launcher tagline and the actual game-pool size.
- `playwright.config.ts`: adds `'launcher.spec.ts'` to the chromium project's `testMatch`.
- Existing e2e specs that rely on map-first entry via `page.goto('/')` — migrated to call `dismissLauncher(page)` in `beforeEach`. Expected list (implementation audits and updates each):
  - `e2e/scaffold.spec.ts`
  - `e2e/search.spec.ts`
  - `e2e/theme-and-responsive.spec.ts`
  - `e2e/accessibility.spec.ts`
  - `e2e/satellite-default.spec.ts`
  - `e2e/panel-focus.spec.ts`
  - `e2e/panel-and-deeplink.spec.ts` (mostly hash-based, may not need migration — audit)
  - `e2e/keyboard-map-nav.spec.ts`
  - `e2e/map-and-countries.spec.ts`
  - `e2e/map-reliability.spec.ts`
  - `e2e/compare-view-dimming.spec.ts`
  - `e2e/game-country-pinning.spec.ts`
  - `e2e/game-city-guessing.spec.ts`

### Deleted

- `src/components/PlayMenu.tsx` — redundant with the launcher.
- Any PlayMenu-specific test coverage (grep during implementation; remove or fold into launcher spec).

### Explicitly not touched

- `src/components/WorldMap.tsx` — map renders as today; the launcher's backdrop sits above it via z-index.
- `src/components/CountryPanel.tsx`, `SingleCountryPanel.tsx`, `CompareCountryPanel.tsx`, `CountryColumn.tsx`, `SearchBar.tsx` (beyond the one prop addition), `Toast.tsx`, `ThemeToggle.tsx`, `CloseButton.tsx`, `FieldLabel.tsx`, `SourceTooltip.tsx`, `BasemapBanner.tsx`, `MapErrorOverlay.tsx`.
- `src/lib/hashState.ts` — launcher is not routed (per architecture choice A during brainstorming).
- `src/game/*` beyond the new `lastMode.ts` module — game framework behavior unchanged.
- `src/hooks/useSelectedCountry.ts`, `useMap.tsx`, `useCountryData.ts`, `useCityData.ts`, `useMediaQuery.ts`, `useTheme.ts`, `useCountrySearch.ts` — unchanged.
- `public/fonts/`, `public/flags/`, `public/og-image.png` — unchanged. (`index.html` gets three one-word edits for the country-count correction, see Modified files above.)

---

## Testing

### Unit tests

`src/hooks/__tests__/useLauncherVisibility.test.ts`:

- Cold load at `/` → visible === true.
- Cold load at `/#` → visible === true.
- Cold load at `/#FRA` → visible === false.
- Cold load at `/#game/country-pinning/play` → visible === false.
- After `dismiss()` → visible becomes false; hash changes to `/` stay hidden.
- After `show()` → visible becomes true (if isBareRoot && idle).
- Session transition non-idle → idle resets dismissed to false; visible re-evaluates.
- Session transition non-idle → idle with hash `#FRA` → visible stays false.
- Multiple session cycles behave correctly.

Mocks `window.location.hash` via `window.history.replaceState`; mocks session status via a controllable `GameSessionProvider` test wrapper.

### E2E tests

`e2e/launcher.spec.ts`:

- **Visibility**
  - Appears on cold load at `/`.
  - Does not appear on cold load at `/#FRA` (deep-link bypass).
  - Does not appear on cold load at `/#game/country-pinning`.
  - Does not appear when `gameActive`.
- **Dismiss paths**
  - Clicking "Just explore the map" hides launcher; focus moves to search input.
  - Typing a character in search hides launcher on first non-empty change; focus stays in search.
  - Focusing search without typing does NOT hide launcher.
  - Clicking a mode card hides launcher and starts the corresponding game.
  - Pressing Escape hides launcher; focus moves to search.
  - Clicking the backdrop behind the launcher does NOT dismiss.
- **Session scope**
  - After dismiss via link, reloading the page at `/` re-shows the launcher (cold-load behavior).
  - After dismiss + closing a country panel, returning to `/` does NOT re-show the launcher.
  - After finishing a game and clicking "Back to map," the launcher re-appears.
- **Header simplification**
  - When launcher visible: play button hidden, satellite toggle hidden, search visible, theme toggle visible.
  - When launcher dismissed: all four visible.
  - When `gameActive`: play, satellite, search hidden; theme toggle visible.
- **Play button reopens launcher**
  - After dismissing via link, clicking the header play button re-shows the launcher.
  - After dismissing via link and selecting a country, clicking the play button deselects and re-shows the launcher.
- **Personal bests**
  - No bests stored → both cards show `BEST — / 1000`.
  - Best stored for country-pinning only → country-pinning card shows numeric; city-guessing shows dash placeholder.
  - Bests for both modes → both cards show numeric.
- **Accessibility**
  - `role="dialog"` and `aria-modal="true"` on the launcher root.
  - `aria-label="Choose how to play"` on the launcher root.
  - Focus lands on the last-played mode card on mount (or Country Pinning if none).
  - Tab cycles through three focusable elements and wraps.
  - Escape dismisses and sends focus to search.

### Manual smoke

- Launcher entrance on desktop and mobile; card cluster centered.
- Launcher appearance in both light and dark themes.
- Backdrop dim reads as intended; `backdrop-filter` does not cause GPU jank during basemap updates.
- Reduced-motion: all transforms collapse to near-instant fade.
- Deep-link share: paste `/#FRA` URL in a fresh tab — lands on France panel directly, no launcher flash.

---

## Success criteria

1. At `/` on cold tab load, launcher is visible over a dimmed, blurred map.
2. Launcher shows: wordmark, "194 countries. Explore or guess." tagline, two side-by-side mode cards, "Just explore the map" dismiss link.
3. Each mode card has inline SVG icon, mode name, tagline, and personal-best block (with em-dash empty state).
4. Clicking a mode card starts that game via the existing hash-based mode-start flow.
5. Dismissal paths (explicit link, first-character search-typed, mode card click, Escape, play-button re-open) work per Section "Dismiss paths."
6. Clicking the dimmed backdrop does nothing.
7. Deep-link URLs skip the launcher on cold load.
8. Within a session, after any dismiss, returning to `/` shows the map directly — except after a game ends, which re-shows the launcher.
9. Header hides play button and satellite toggle while the launcher is visible; restores on dismiss.
10. `role="dialog"`, `aria-modal="true"`, `aria-label="Choose how to play"` on launcher root.
11. Focus trap cycles through three elements; initial focus respects last-played mode.
12. `prefers-reduced-motion` collapses animations to ≤10ms fade.
13. `src/components/PlayMenu.tsx` is deleted. No PlayMenu references remain in the codebase.
14. `LAST_MODE_KEY` lives in `src/game/shared/lastMode.ts`; Launcher + game-start flow both use it from there.
15. All new unit + e2e tests pass. All existing e2e tests pass after migration via `dismissLauncher` helper.
16. `index.html` meta description, og:description, and twitter:description all read "194 countries" (previously "195"). Grep-verifiable: zero occurrences of "195 countries" in the repo after this PR.

---

## Rollout

Single PR titled `feat(ux): launcher landing state with mode picker`. No feature flag. Rollback path is a revert of one PR.

Commit plan within the branch (three logical commits; squash-merge on landing per project convention):

1. `feat(launcher): add useLauncherVisibility hook, lastMode module, unit tests`
2. `feat(launcher): Launcher + LauncherModeCard components, Header/App integration, delete PlayMenu`
3. `test(e2e): launcher spec + migrate existing specs via dismissLauncher helper`

---

## Deferred to later specs

- **Surface palette overhaul** (the second piece of user feedback from the a11y-pass review). Darker light-theme canvas, re-toned panel surfaces. This spec tunes the backdrop dim and launcher card surface against the *current* palette; a follow-up palette spec can re-tune once the launcher is in place.
- **In-game HUD polish.**
- **Post-round reveal / post-game summary polish.**
- **Explore ↔ game mode transition animations.**
- **Landing-state copy variants, A/B test machinery.** Tagline copy is locked for v1.

---

## Non-goals

- Introducing a focus-trap library or any other new dependency.
- Introducing visual-regression tests.
- Changing `hashState.ts` — launcher is not a routed state.
- Changing the game framework (session, scoring, mode handlers).
- Changing the map, basemap, or country rendering.
- Changing `CountryPanel` / `CompareCountryPanel` / `SearchBar` beyond the one `onFirstInteraction` prop on `SearchBar`.
- Introducing new theme colors or palette tokens.
- Persisting the launcher-dismissed flag across sessions (intentionally session-scoped).
- Preserving PlayMenu.

---

## Known limitations

- **Browser back/forward does not undo launcher dismissal.** Because `dismissed` is in-memory React state (no `history.pushState`, no storage), pressing back past the dismiss call keeps the launcher hidden. This is acceptable for session-scoped in-memory state and matches the Q9-B design intent. Documented here so future maintenance doesn't treat it as a bug.
- **Backdrop `blur(4px)` on low-end devices may show minor paint cost** when the basemap is continuously updating. Tuning (or dropping the blur) is an implementation-time decision, not a spec change.
- **The country-count claim (194) may drift if data-source updates add/remove an independent territory.** Mitigation: grep `194 countries` pre-merge for any future data-update PR. No automated check added — the frequency of such updates does not justify one.

---

## Open questions

None. All clarifications closed during brainstorming and the self-review loop.
