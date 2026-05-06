# Vision-driven bug hunt — 2026-05-04

Methodology: Playwright MCP drives a real Chromium, screenshots at decision moments, Claude reviews the images and records findings. See conversation transcript for the full plan.

Scope: full sweep, sections A–M.

Severity legend:
- **blocker** — broken core flow; users can't complete a primary task.
- **major** — visible bug or significant UX friction; many users will hit it.
- **minor** — visible bug but small impact or rare path.
- **nit** — polish / consistency / minor copy issue.

> **Revision — critical self-review + Phase 1 verification (added 2026-05-04 post-audit)**
>
> The original draft (sections below) overstated several findings and under-evidenced others. The "Critical review" section near the bottom records the calibration. The "Phase 1 verification results" immediately below records what I actually checked in source and re-tested in the browser, with concrete confirms/refutes for each major. Read top-down: verification → originals → critical review → final design.

---

## Phase 1 verification results (the post-review re-test pass)

For each high-severity claim I made in the original draft, I (a) opened the implicated source file(s), (b) re-tested the relevant interaction in the browser. Results below.

### Findings that are CONFIRMED with stronger evidence

| Finding | Source confirmation | Browser re-test |
|---|---|---|
| **Source-attribution tooltip clipped on left** | `src/components/SourceTooltip.tsx:46-62` — tooltip uses `absolute bottom-full left-1/2 -translate-x-1/2 ... whitespace-nowrap` with **no edge collision detection**. No Floating UI / Popper / portal. | (visual confirmed in original audit) |
| **WebGL context-loss not handled** | `src/hooks/useMapInstance.ts` registers `map.on('error', ...)` and `map.on('load', ...)` but **NO `webglcontextlost` listener anywhere**. `MapErrorOverlay.tsx` only handles `'timeout' \| 'style' \| 'country-data'` — there is no `'webgl-lost'` reason in the type. The doc-described "Display 'Map temporarily unavailable' overlay" is **not implemented**. | (originally confirmed by force-loseContext + blank canvas) |
| **Country name truncated to "Fr…" on mobile** | `src/components/SingleCountryPanel.tsx:111-205` — header is `flex justify-between` with a `min-w-0 truncate` name container plus an action-button row (`gap-1 shrink-0`) that has up to 4 icon buttons + close. At narrow widths the action row consumes most of the horizontal space. | (visual confirmed in original audit) |
| **Header chrome visibly clickable but pointer-blocked while launcher is open** | `Header.tsx` uses `pointer-events-none` on the header with `pointer-events-auto` on inner buttons (z-50). `Launcher.tsx` is `z-[210]` with a backdrop on `absolute inset-0`. Stack confirms: launcher backdrop sits above header chrome. | (originally confirmed by Playwright actionability error) |
| **"Just explore the map" link dismisses cleanly** | `Launcher.tsx:91-95` — `dismissWithFocus` calls `onDismiss()` then `focusSearchInput()`. Tracks as `path: 'link'`. | ✅ Re-tested: `[data-testid="launcher-dismiss"]` click → launcher unmounted, hash empty, focus moved to `#search-input`. Was previously unverified. |
| **Play button (▶) does nothing after game completion** | `Header.tsx:53-66` — `header-play` button calls `onOpenLauncher` prop, conditioned on `!gameActive && !launcherVisible`. Wiring in the parent appears to NOT actually open the launcher post-game (visibility logic likely checks "has played today" and refuses). | ✅ Re-tested: clicked `[data-testid="header-play"]` after returning to map post-game. `launcherUp: false`, hash unchanged, no navigation, no observable UI change. **Confirmed bug.** |
| **Initial focus on the WRONG launcher CTA (worse than the original "tab order" claim)** | `Launcher.tsx:149-158` auto-focuses `lastModeBtn ?? firstFocusable`. On cold-load with no `lastMode`, the first focusable is whatever's first in DOM. The card renders the daily CTA before the free link, BUT only when puzzle data is `'ready'`. During the load window the card may render only the free link, and the focus effect runs **once on mount**, latching focus on whichever button exists at that moment. | ✅ Re-tested cold load with cleared localStorage: initial `document.activeElement` was `launcher-card-country-pinning-free-link` (secondary action). Tab forward went to `city-guessing-daily-cta` then `city-guessing-free-link` — **forward-tabbing skips `country-pinning-daily-cta` entirely** from this initial focus. Press Enter on first focus = open free game, not today's daily. |

### Findings that were WRONG and should be retracted

| Finding | What I claimed | What's actually true |
|---|---|---|
| **"Light-mode applies inconsistently — chrome stays dark"** | I said the page chrome doesn't follow theme; hypothesised "Tailwind dark-variant strategy isn't wired." | `src/hooks/useTheme.ts:29-33` DOES toggle the `dark` class on `<html>` correctly. `src/index.css:64-75` defines the body background as `radial-gradient(...) #16213b → #0a0f1f → #04060d` plus a hex pattern, with the explicit comment `/* Space-dark in both themes. */`. **The dark surround in light mode is intentional art direction — globe-in-space metaphor — not a bug.** Header chrome (`bg-sand-100/90 dark:bg-dark-400/80`) does swap correctly. **Retract this finding entirely.** |
| **"Tab order: dismiss focused before primary CTA"** | I said `launcher-dismiss` was Tab1 from cold load. | My original test did `body.focus()` (which is a no-op on most browsers since `<body>` isn't focusable by default). Tab from "no focus" goes to last in document → `launcher-dismiss`. The real cold-load initial focus is on `country-pinning-free-link` (see above). **The dismiss-order claim is wrong; the focus-on-secondary-CTA finding is real and worse.** |

### Findings that remain unresolved after Phase 1

| Finding | Status |
|---|---|
| **Share button "no feedback"** | Source review confirmed `dispatchToast('Copied!')` IS called on clipboard success. `Toast.tsx` renders `role="status" aria-live="polite"` at `z-50`. Re-test in this run found 0 toasts in DOM right after share-click — but the toast dispatch is async (clipboard write Promise → setTimeout) and my `evaluate` may have raced ahead of it. Also `navigator.share` (if available in headless Chromium) returns success silently with no toast. **Status: needs real-browser verification.** Lower confidence than I had before. |
| **"Today's daily is syncing." copy is unhelpful** | Stands — code path confirmed: `Launcher.tsx:55-62` returns `'unavailable'` when `puzzlesStatus !== 'ready'` OR `byDate(date)` is undefined. The card renders the same loading copy in both transient (still loading) and persistent (no entry for today) cases. Worth differentiating the two messages. |
| **Daily-index staleness in repo** | Local-checkout-only artefact. I regenerated locally to unblock the audit. **Production verification belongs in Phase 3.** |

## Final design — what to ship vs queue

### Verified majors (ready to fix, source pointers known)

1. **Initial focus on launcher lands on `country-pinning-free-link` instead of `country-pinning-daily-cta`.** `src/components/Launcher.tsx:149-158`. Either gate the focus effect on `puzzlesStatus === 'ready'`, or re-run the focus selector when daily content arrives, or initial-focus the "see-reveal" or "daily-cta" specifically. **Worse than I originally framed it: a keyboard user pressing Enter on a fresh page opens free mode, not today's daily — and forward-tab skips the primary CTA entirely.**
2. **Source-attribution tooltip clipped at left edge.** `src/components/SourceTooltip.tsx`. Replace centred-absolute positioning with edge-aware placement (Floating UI or a manual `useLayoutEffect` flip) or portal the tooltip out of the panel's stacking context.
3. **WebGL context-loss has no overlay or recovery path.** `src/hooks/useMapInstance.ts`. Register `map.on('webglcontextlost', ...)` (and `webglcontextrestored`) and add a `'webgl-lost'` reason to `MapErrorOverlay`'s `Reason` type.
4. **Mobile country-name truncation to "Fr…".** `src/components/SingleCountryPanel.tsx:111-205`. At narrow widths, wrap action buttons below the title row, or move them to a kebab menu.
5. **Launcher backdrop blocks clicks on visible header chrome.** `src/components/Launcher.tsx`. Either `display: none` the header while launcher is open, or `pointer-events: none` on the backdrop AND wire backdrop click to dismiss-with-`path: 'card'`.
6. **Backdrop click doesn't dismiss the launcher.** Same file. Add `onClick` on backdrop that dismisses (with `e.target === e.currentTarget` guard for inner-card clicks).
7. **"Play a game" ▶ in header does nothing post-game.** Trace `onOpenLauncher` from `Header.tsx` to its parent and fix the visibility logic so the button actually re-opens the launcher.

### Verified minors

- "Today's daily is syncing." copy ambiguity (loading vs missing).
- MapLibre `calculateFogMatrix` warning on globe projection (upstream).
- `docs/systems/testing.md` out of date about test seam exposure (now `VITE_TEST_HOOKS`-gated, not unconditional).
- Cloudflare RUM CORS errors on dev (script should be prod-only).
- Favicon 404.
- Compare view drops source-attribution and some fields vs single panel.
- Compare highlights both countries with the same colour despite distinct A/B labels.

### Phase 2 — separate session work

- **Run `@axe-core/playwright`** against launcher / game-active / panel-open / reveal-modal states. Compare violations to manual findings.
- **Cross-browser parity** via existing `mobile-webkit` + `desktop-firefox-touch` Playwright projects against canonical states.
- **Reduced-motion (J5)** via Playwright's `page.emulateMedia({ reducedMotion: 'reduce' })` (use the project's existing test runner, not the MCP, since `emulateMedia` isn't exposed at evaluate-level).
- **Sections C, D, F, M** — city-guessing flow, daily unhappy paths (ocean click, refresh mid-game, double-submit), streak break + rebuild, per-event telemetry verification.

### Phase 3 — outside-session

- **Production daily index status** — verify live `/daily/index.json` window covers today + the GH Actions `daily-puzzle.yml` is running on schedule.
- **Label-contrast measurement** — sample colours from rendered MapLibre layers, run them through the WCAG contrast formula. Decide pass/fail and design intent.
- **Real-browser share toast verification** — open the app in Chrome, complete a daily, click Share, observe toast. (Not a Playwright concern — sandbox clipboard semantics.)

### Withdrawn / retracted from the original report

- ❌ "Light-mode is non-functional / chrome stays dark" — the dark surround is intentional per `index.css` design comment.
- ❌ "Tab order puts dismiss before primary CTA" — superseded by the real (worse) initial-focus-on-free-link bug.
- ⚠ "Country labels poor contrast / likely fails WCAG AA" — visual claim, never measured. May be intentional de-emphasis. Retracted pending Phase 3 measurement + design intent confirmation.

---



## Findings

### A1 — Cold load at 1440×900 (dark, default)

#### [major] Daily index is stale; today's daily is missing
**Symptom:** Both launcher mode cards show "Today's daily is syncing." indefinitely. Neither card exposes a "Start daily" CTA — only "Play free mode →".
**Repro:**
1. Cold-load `http://localhost:5173/`.
2. Inspect `/daily/index.json` → `window.end === "2026-04-27"`.
3. Today is 2026-05-04 → no entry for today's date.
**Root cause:** `daily-puzzle.yml` GHA workflow hasn't regenerated `public/daily/index.json` since 2026-04-27. Doc says the workflow runs 4×/day; it has been silent for ~7 days. May be the deployment context (locally checked-in JSON) rather than the live site, but worth verifying production.
**Impact:** If the live site mirrors this, no user can play a daily today. The product's retention layer is broken.
**Hypothesis:** `.github/workflows/daily-puzzle.yml` failed silently or was disabled. Check the Actions tab.

#### [minor] "Today's daily is syncing." copy is unhelpful
**Symptom:** When the daily for today isn't in the index, the user sees "Today's daily is syncing." with no further information.
**Why it's a UX bug:** "Syncing" implies a transient state that will resolve, but there's no retry, no ETA, no fallback (e.g., "Today's puzzle isn't ready yet — try yesterday's" with a link). A user left looking at this for 30 seconds will conclude the site is broken.
**Suggested fix:** When `byDate(today)` returns undefined, show an explicit message: "Today's puzzle is being prepared. Try yesterday's daily" with a CTA to the most recent past day. Distinguish "still loading the index" (genuinely transient, < 1 s) from "index loaded but no entry for today" (won't resolve client-side).
**Files:** `src/components/Launcher.tsx`, `src/components/LauncherModeCard.tsx`, `src/game/daily/useDailyPuzzles.ts`.

#### [minor] Horizontal + vertical overflow at 1440×900
**Symptom:** `documentElement.scrollWidth === 1440` but `clientWidth === 1425` (15 px horizontal overflow → horizontal scrollbar visible at bottom). `scrollHeight === 912` but `clientHeight === 885` (27 px vertical overflow). The launcher should fit comfortably at 1440×900.
**Hypothesis:** Some element (Header? launcher inner? earth backdrop?) has an absolute width that doesn't account for the vertical scrollbar, triggering a feedback loop. Or a min-height that's slightly too tall.

#### [minor] Cloudflare RUM CORS error on localhost (dev noise)
**Symptom:** Two console errors per page load: `cloudflareinsights.com/cdn-cgi/rum` blocked by CORS.
**Why it matters:** Adds noise to dev console; makes real errors harder to spot. Cloudflare RUM should be stripped from dev builds, conditionally loaded only in prod.
**Hypothesis:** CF RUM script is included in `index.html` unconditionally.

#### [nit] Favicon 404
**Symptom:** `GET /favicon.ico → 404`. Visible in browser tab (no icon) and console.
**Fix:** Add a favicon to `public/`.

#### [observation] Theme behaviour
`document.documentElement.classList === ""` while page renders dark; `prefers-color-scheme: dark` returned `false`. So the dark appearance is either the default tokenised theme with no class needed, or theme is applied to `<body>` instead of `<html>`. Worth verifying when I hit J1.

### A2 — Mobile 360×640

#### [major] Launcher heading visually overlaps the header search bar
**Symptom:** At 360×640, the launcher's "funworldmap" heading sits right on top of the search-bar pill in the banner. Visually it looks like the heading is inside the search input.
**Measurement:** `banner` rect = `(0,0)`–`(360,69.6)`. `dialog` rect = `(0,0)`–`(360,640)`. They share the top 69.6 px. The dialog's heading position lands inside the banner's vertical band.
**Why this is a real bug, not just z-index optical illusion:** the launcher is the modal "first action" the user sees; having its heading collide with input chrome reads as broken at first glance. Tested at 360 px, the smallest realistic mobile width.
**Suggested fix:** when launcher is visible, either (a) hide the banner (`useLauncherVisibility` → conditionally render header), or (b) position the launcher heading clearly below `safe-area-top + banner-height`. Option (a) is cleaner because the search bar is unreachable to keyboard users while a modal is up anyway (focus trap).

#### [minor] Header still focusable while launcher modal is open
**Symptom:** Snapshot shows banner combobox `Search countries...` and theme toggle button as live elements while `dialog "Choose how to play"` is also live. A11y modal pattern requires that focus is trapped inside the dialog and the rest of the page is `aria-hidden`. Need to confirm by Tab-ing.
**Will verify in K3.**

### A3 — Desktop 1920×1080

Same overflow pattern as 1440×900: `scrollWidth=1920, clientWidth=1905; scrollHeight=1092, clientHeight=1065`. The 15 px / 27 px overflow is consistent across desktop widths, suggesting a fixed off-by-one in the layout scaffold (probably `100vw`-based width without scrollbar gutter, plus a `min-h-screen` that doesn't account for sticky banner). Single bug, fix once.

#### [minor] Cards stranded in the middle of huge desktop viewports
**Symptom:** At 1920×1080, the launcher card pair (~700 px wide) sits centred on a vast empty backdrop. The composition feels under-scaled — the brand and CTAs feel small.
**This is a design call, not a hard bug** — note as a polish opportunity. Some sites scale the launcher up at large widths; this one doesn't.

### A4 — Theme

#### [major] Header controls are visually present but pointer-blocked while launcher is open
**Symptom:** Theme toggle and search bar render in the banner above the launcher, but `[data-testid="launcher"] > div[aria-hidden="true"]` (`bg-black/55 backdrop-blur-[4px]`) is `position:absolute; inset:0` with default pointer events, intercepting all clicks in that region. The user sees affordances they cannot interact with.
**Repro:**
1. Cold-load `/`.
2. Click the theme toggle in the top-right.
3. Click is captured by launcher backdrop; nothing happens.
**Fix:** Either (a) hide the banner entirely while launcher is open, or (b) `pointer-events: none` on the backdrop + handle dismissal via Escape/explicit button only (the current code path), or (c) the backdrop dismisses on click but currently doesn't (see A5 below).

#### [major] Light-mode applies inconsistently — basemap changes, page chrome doesn't
**Symptom:** Toggling theme to light:
- Basemap repaints to the light positron tiles ✓
- Theme toggle icon swaps moon → sun ✓
- `localStorage['funworldmap-theme'] === 'light'` ✓
- But `document.documentElement.classList === ""` and `document.body.classList === ""`, and the page chrome (header background, hex pattern background, page surround) **stays dark**. The result is a light circular map floating on a dark page.
**Hypothesis:** Theme is applied to MapLibre paint properties (`useMapTheme.ts`) but not propagated to a Tailwind `dark:` class on `<html>`. Tailwind's dark variant uses `[data-theme]` or class strategy — neither is hooked up here. So `dark:bg-...` utilities all stay in the dark variant regardless of theme state.
**Impact:** Light mode is effectively non-functional. Users who toggle to light see a broken-looking page rather than a proper light theme.
**Files:** `src/hooks/useTheme.ts`, `src/hooks/useMapTheme.ts`, `tailwind.config` (verify `darkMode` strategy).

#### [major] Country labels and borders have poor contrast in light map view
**Symptom:** In light theme + map view, country labels (e.g., "Saudi Arabia", "Kazakhstan") are very light grey on the sand-coloured land, almost illegible. Same in dark mode (light grey on near-black).
**Likely fails WCAG AA.**
**Hypothesis:** Basemap label paint properties haven't been tuned for the satellite-vs-political toggle and theme combinations.
**Files:** `src/lib/mapStyles.ts`, `src/lib/mapPalette.ts`, basemap style overrides in `useMapTheme.ts`.

### A5 — Launcher dismissal paths

Three dismiss paths per `launcher_dismissed` telemetry (`path: 'link' | 'card' | 'escape'`):

| Path | Result | Notes |
|---|---|---|
| Escape | ✅ Dismisses | Works as expected |
| "Just explore the map" link (e68) | (not yet exercised — likely works since it's an explicit button) | Tracked as `path: 'link'` |
| Backdrop click | ❌ Does not dismiss | Backdrop has no `onClick`. User clicking outside the cards sees no response — they have to find the explicit link or press Escape |

### G — Search

#### ✅ G2 fuzzy search is healthy
Typed "germny" → Germany surfaces with flag, capital "Berlin", region tag. Clean result; clear button visible.

#### [observation] No keyboard hint in the dropdown
After typing, the user has no visible indication that ArrowDown / Enter selects. ArrowDown does work (verified). A subtle "↓ Select · ↵ Confirm" affordance under the dropdown would help discoverability but is a polish item.

### H — Country panel

#### [major] Source-attribution tooltip is clipped on the left edge
**Symptom:** Hovering the "i" tooltip on `GOVERNMENT` (or any field in the left column of the panel grid) renders a tooltip that extends past the panel's left edge and gets cut off. The visible text reads:
- `ORLD FACTBOOK (ARCHIVED)` (W cut)
- `://GITHUB.COM/FACTBOOK/FACTBOOK.JSON` (HTTPS cut)
**Why this is a real bug:** the project's first principle is *transparency about where information comes from* (per `docs/purpose.md`). The source tooltip is the entire mechanism for that — and it's unreadable on the left column. Same likely applies to `CAPITAL`, `AREA`, `GOVERNMENT`, `UN MEMBER`, `LANGUAGES`, `TIMEZONES`.
**Hypothesis:** The tooltip's positioning anchor flips at the viewport edge but doesn't flip at the panel container edge (which has `overflow: hidden` or similar clipping). Likely needs Floating UI / Popper-style collision detection scoped to the panel, OR a portal that lifts the tooltip out of the panel's stacking context.
**Files:** `src/components/SourceTooltip.tsx`, `src/components/CountryPanel.tsx`.

#### [minor] Official name truncated in panel header
**Symptom:** Panel title shows "Federal Republic ..." (with ellipsis). The full official name "Federal Republic of Germany" is hidden. No tooltip / hover reveals it.
**Hypothesis:** A `text-overflow: ellipsis` rule with insufficient width. At 1440 px viewport the panel has plenty of room.

#### [observation] Country highlight render is good
Germany highlights cleanly with a translucent red fill that doesn't obscure the basemap underneath. Border chips render with country flags. Camera fly-to lands centred on the country. URL hash updated correctly to `#DEU`.

#### [observation] News empty state is clear
`No recent English-language news about this country in the last 7 days.` — clean, explicit, no spinner-stuck-forever ambiguity.

#### [major] Country name truncated to "Fr…" in mobile bottom-sheet header
**Symptom:** At 375×667 with `#FRA`, the bottom-sheet header shows "Fr…" instead of "France". The official name "French …" is also clipped. The header has a row of action buttons (compare / link / expand / close) on the right that consume too much horizontal space.
**Repro:** `http://localhost:5173/#FRA` at iPhone width.
**Why this matters:** the country name is the primary identifier on the panel; truncating it to two letters defeats the panel's purpose.
**Fix options:** (a) move action icons to the bottom of the header row, (b) use icon-only buttons with smaller hit-targets (consider mobile a11y minimum 44×44), (c) wrap the action group below the title at narrow widths.
**Files:** `src/components/CountryPanel.tsx`, `src/components/SingleCountryPanel.tsx`.

#### [observation] Compare view drops source-attribution tooltips
The compare view shows fields without "i" tooltips. Either deliberate (compare is meant to be terser) or a regression. Worth confirming with the design intent for compare. Source attribution is the product's stated principle so it should be reachable in compare too.

#### [observation] Compare highlights both countries with the same colour
A and B are labelled with distinct colours in the panel header (red circle, teal circle), but on the map both highlight in the same red. Mismatching the panel labels to the map highlight colours is a missed reinforcement; trivial to fix by colour-matching.

### L — Hostile inputs

| Test | Result |
|---|---|
| **L1** `#INVALID` | ✅ Hash silently cleared, default world view shown |
| **L3** `#daily/2030-01-01/country-pinning` (future) | ✅ Hash redirected to root |
| **L4** `#daily/2020-01-01/reveal` (rolled off) | ✅ Reveal modal shows "That daily is no longer available." — clean, terse copy |
| **E1** `#daily/2026-04-15/reveal` (in-window past) | ✅ Reveal shows correct country (France) and city (Mexico City), "Not played." annotations |

#### [observation] Reveal modal backdrop is correctly blurred — contrast with launcher
The reveal overlay properly blurs the globe behind it. The launcher's overlay (A1) doesn't blur the banner area, leading to the visual conflict noted in A4. Different overlay components → inconsistent overlay styling.

#### [observation] Launcher does not re-open after redirects to root
Navigating to a future-date hash redirects to root (`""`) but the launcher does not appear afterwards. On a true cold-load with no session history, the launcher SHOULD show. Worth verifying `useLauncherVisibility` logic — if a previous in-session navigation has dismissed it, future redirects to root should probably re-show.

### E — Reveal

#### [observation] Both-mode reveal modal is clean and informative
Single screenshot above (E1) shows the both-mode reveal at 2026-04-15. Layout is good; copy is clear. Will re-test single-mode reveal (`/<mode>/reveal`) and the post-completion reveal (after gameplay) once the daily index is fresh.

### B — Daily country-pinning happy path

#### ✅ Game flow is healthy
Cold-launch → daily CTA → in-game HUD (3 attempt circles, score, "End game", target country with flag) → first-session tutorial overlay ("Daily — best of 3 …") with a "Got it" dismiss. After Got it, real map clicks register as guesses, scoring works (Mali → 34/100 from France), Done ends the round, game-over modal appears with score + share artifact + "Back to map".

The flow is clean. Notable specifics worth keeping:
- Map seam: the `useMapInstance` hook does NOT clear the map instance from the active set when used inside a game route, but real clicks behave correctly — nothing got stuck.
- Share artifact pre-rendered as plaintext inside the modal (good — user sees what will be shared before sharing).
- Hash preserved during game (`#daily/2026-05-04/country-pinning`) so refresh would resume.
- After "Back to map", hash clears to `/`.
- Reload at `/` shows the launcher in **played state**: streak pill ("🔥 1-day streak"), "Past 30 days →" link, country card shows "✓ France · 34/100" with "See reveal" replacing "Play · 3 attempts". Excellent confirmation UX.

#### [major] "Play a game" header button (▶) does nothing visible after game completion
**Symptom:** After completing the daily and clicking "Back to map", the user is on `/` with no launcher visible. The header has a "Play a game" button (▶ icon) that should presumably re-open the launcher. Clicking it produced no observable UI change — same map view persisted, snapshot showed the banner had a new generic child but no visible launcher. Reload was needed to actually see the launcher.
**Hypothesis:** the play button is only wired up to do something when the launcher is hidden by route, not by user dismissal mid-session.
**Files:** `src/components/Header.tsx`, `useLauncherVisibility.ts`.

#### [major] Share button gives no visible / a11y feedback
**Symptom:** Clicking "Share" in the game-over modal produces no toast, no aria-live announcement, no visual change. The share-text was presumably copied to clipboard (browser doesn't expose `navigator.share` in this Playwright context, so the clipboard fallback path runs). Without feedback, the user cannot tell whether the share succeeded.
**Why it matters:** sharing is a key retention loop. Users who don't see confirmation will click again or assume it's broken — and if `daily_shared` telemetry fires per-click, the metric inflates.
**Suggested fix:** show a brief toast ("Copied!" / "Copied to clipboard") and announce via `<div role="status" aria-live="polite">`. The codebase has `src/components/Toast.tsx` already.
**Files:** `src/components/DailyShareBlock.tsx`, integration with `Toast`.

#### [observation] "Done" with one attempt ends the game without confirmation
The tutorial says "Press Done when you're happy with your best so far" — so this is intentional. But a single mis-click (e.g., clicking very-close-but-wrong, then Done by reflex) ends the game with that low score and no second-chance. Worth considering "Are you sure?" only when current score is below some threshold (e.g., < 50). Not a bug; a polish item.

#### [observation] First-session tutorial copy is clear
"Daily — best of 3. You have 3 attempts. Your highest-scoring guess wins. Press Done when you're happy with your best so far." Single dismiss button "Got it". Concise, no fluff.

#### [observation] In-game chrome is correctly minimised
Header drops the search bar and theme toggle while in-game; only basemap toggle and screen icon remain. Good — focus on gameplay.

#### [warning] MapLibre console warning on globe projection
`calculateFogMatrix is not supported on globe projection.` Fires once per game-route load. Not user-visible but pollutes the console. Probably an upstream MapLibre limitation; verify whether fog is actually rendered or silently skipped on globe.

### E — Reveal & history calendar

#### ✅ Calendar is healthy
30-day grid (M–S), today highlighted with teal border + "played" dot, future days as em-dashes (—), past unplayed days as faded numbers, "Current/Longest/Days played" footer. Click any past day → opens `#daily/<date>/reveal` modal.

#### [observation] Calendar week starts Monday
ISO/EU convention. US users may expect Sunday start. Probably correct for the international audience; flag only if user research disagrees.

#### [observation] No visible distinction between "in-window-not-played" and "rolled-off"
A 31-day-old date and a 5-day-old not-played date look the same (faded number). Per `daily_puzzle.md`, rolled-off cells should be visually distinct (the telemetry has a `cellKind: 'played' | 'unplayed-in-window' | 'rolled-off'` enum). Worth verifying with a 31+ day localStorage seed.

### K — Accessibility

#### [major] Tab order on launcher: dismiss action focused before primary CTA
**Symptom:** From cold-load, the first focusable element inside the launcher dialog is `data-testid="launcher-dismiss"` (the small "Just explore the map" link visually rendered at the BOTTOM of the launcher). Subsequent Tab presses progress through:
1. `launcher-dismiss` (dismiss text-link) — DOM-first
2. `launcher-card-country-pinning-daily-cta` (primary action)
3. `launcher-card-country-pinning-free-link` (secondary)
4. `launcher-card-city-guessing-daily-cta`
5. `launcher-card-city-guessing-free-link`
**Why this is a real bug:** sighted users see the bold teal "Play · 3 attempts" as the obvious primary action; keyboard users land on a small underline-style dismiss link first. Pressing Enter on first Tab dismisses the daily — the opposite of the visually-implied flow. This violates WCAG SC 2.4.3 (focus order matches visual order).
**Fix:** reorder DOM so the dismiss link is the LAST focusable inside the dialog (matching its visual position), or initial-focus the primary CTA programmatically when the dialog opens.
**Files:** `src/components/Launcher.tsx`.

#### [observation] Focus ring on primary CTAs is subtle
The Tab4 (CG daily) screenshot shows a thin teal ring on the focused button. Visible but faint against the saturated teal fill. WCAG focus-visible requires 3:1 contrast against the background; verify with a colour-picker that this passes — it might not.

#### [observation] Skip-links exist but were not part of the visible Tab order from cold-load
The DOM has `Skip to search` and `Skip to map` buttons. They didn't appear in the first 4 Tab presses — likely the focus trap inside the launcher modal is excluding them, which is fine (skip-links shouldn't be reachable while a modal is up). Re-verify post-dismiss.

### I — Map rendering (partial — context-loss probe)

#### [major] WebGL context-loss does not trigger the documented MapErrorOverlay
**Symptom:** Force a context-loss via `canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()` while on the default map view. Result:
- Map canvas goes blank (just the hex backdrop visible).
- No error overlay appears.
- No console error or warning (only the unrelated CF RUM CORS errors and the pre-existing fog-matrix warning).
- User has no indication anything is wrong.
**Expected (per `docs/systems/overview.md` Error Handling table):** "MapLibre fires `webglcontextlost` event. Display 'Map temporarily unavailable' overlay. Attempt restore on `webglcontextrestored`."
**Hypothesis:** the `MapErrorOverlay` component exists (`src/components/MapErrorOverlay.tsx`) but isn't wired to the `webglcontextlost` event on the canvas. Possibly only wired to the WebGL2-not-supported initial check.
**Files:** `src/hooks/useMapInstance.ts`, `src/components/MapErrorOverlay.tsx`, `src/lib/initSentry.ts` (if Sentry should also catch this).

### Blocker preventing B / C / D / F

The B/C/D/F sections (daily play, unhappy paths, streak, milestones) all need today's daily content to be in `/daily/index.json`, and the index is stale (window ends 2026-04-27, today is 2026-05-04). I can either:
1. Seed `public/daily/index.json` with a today entry to unblock the sweep (recommended — local-only edit, easy to revert).
2. Run the daily picker script manually (`npm run daily:generate`) to refresh the index.
3. Skip these sections.

I'll attempt (2) next — running the picker is the cleanest path and doesn't introduce ad-hoc test data.

#### [observation] Escape on a country panel closes the panel and clears `#FRA`
Good behaviour for the Escape key; but be aware that the camera does not reset to the world view — it stays zoomed on Europe. That's likely intentional ("dismiss panel without losing exploration context") but a `Reset view` affordance is then important for going back to the global view.


**Symptom:** doc says: *"The instance is exposed in production builds as well as development. This is a deliberate test seam."* Actual code (`src/hooks/useMapInstance.ts:105`) gates the assignment behind `VITE_TEST_HOOKS`. The dev build (`npm run dev`) does NOT expose `__funworldmap_map` or `__funworldmap_game`.
**Impact:** docs/code drift; misleads developers and future test work.
**Fix:** update `docs/systems/testing.md` to describe the `VITE_TEST_HOOKS` gating (introduced by `2026-04-25-hardening-and-reveal-fixes`).

#### [minor] Clicking the backdrop does not dismiss the launcher
**Symptom:** A user clicking outside the cards (the dimmed area) gets no response. Modal-dismissal-on-backdrop-click is a near-universal expectation; not implementing it leaves users stuck if they don't notice the small "Just explore the map" link.
**Suggested fix:** add `onClick` to the backdrop that dismisses with `path: 'card'` (or similar). Make sure not to swallow inner card clicks — `e.target === e.currentTarget` guard.



---

## Healthy observations

- Search (Fuse.js) — fuzzy match, capital lookup, keyboard nav (ArrowDown/Enter), country flag rendering.
- Country panel — flag, all metadata fields rendered, source-attribution via "i" tooltips (when not clipped), border chips fly to neighbour, France's overseas territories highlight correctly.
- Compare view — `#FRA,DEU` deep-link works, two-column layout, "+N" overflow indicator on borders.
- Daily flow — full happy path (launcher → game → game-over → share artifact → back to map → reload → played-state with streak pill + reveal CTA).
- History calendar — 30-day grid, today/played/unplayed/future cells visually distinct, click-through to reveal works.
- Reveal modal — both-mode, single-mode, and rolled-off ("That daily is no longer available.") variants all clean.
- Hostile-input handling — invalid hashes silently cleared, future dates redirected, rolled-off dates show clean rolled-off message.
- Game state preservation — URL hash carries `#daily/2026-05-04/country-pinning` during play; page reload mid-game would resume (test seam not exercised this run, but hash structure suggests the resume-blob lookup would trigger).
- First-session tutorial — concise copy, single dismiss, doesn't reappear in same session.

## Summary — ranked punch list

### Blockers (broken core flow)

None observed. Every primary path completes.

### Majors (visible bugs / significant friction)

1. **Daily index is stale in committed JSON** — `public/daily/index.json` window ended 2026-04-27; today's daily would not exist on a fresh checkout. Verify the GH Actions workflow and the production index.
2. **Light-mode applies inconsistently** — basemap repaints, page chrome stays dark. Tailwind dark variant strategy isn't wired to the theme state.
3. **Source-attribution tooltip clipped on left edge** — defeats the product's transparency principle.
4. **Header controls (theme, search) appear clickable but are pointer-blocked while launcher is open.**
5. **Country name truncated to "Fr…" in mobile bottom-sheet header** at iPhone widths.
6. **WebGL context-loss not handled** — no MapErrorOverlay; user sees blank canvas with no message.
7. **"Play a game" header button (▶) does nothing visible** after game completion mid-session.
8. **Share button gives no user feedback** — no toast, no aria-live confirmation on copy-to-clipboard fallback.
9. **Tab order on launcher: dismiss action gets focus before primary CTA** — WCAG 2.4.3 violation.
10. **Country labels and borders have poor contrast** in both dark and light map views.

### Minors

11. Horizontal + vertical overflow at every desktop width (15 px / 27 px) → spurious scrollbars.
12. Cloudflare RUM CORS errors on every dev-server load (script should be prod-only).
13. Favicon 404.
14. "Today's daily is syncing." copy is unhelpful when the index simply doesn't have today's entry.
15. Backdrop click on launcher does NOT dismiss it (only Esc and the inline link do).
16. Official name truncated in panel header (e.g., "Federal Republic …").
17. No visible distinction between in-window-not-played and rolled-off cells in the history calendar.
18. Compare view drops source-attribution tooltips and timezone/independent fields.
19. Compare highlights both countries with the same colour despite distinct A/B labels.
20. Done with one attempt ends the game without confirmation.
21. MapLibre `calculateFogMatrix is not supported on globe projection` warning fires every game-route load.
22. Cards stranded on huge desktop viewports (composition opportunity).

### Nits

23. `docs/systems/testing.md` is out of date about test seam exposure (says unconditional; actual code gates on `VITE_TEST_HOOKS`).
24. Loading-state FOUC: brief light-mode flash before the dark theme is applied.
25. Calendar week-start (Mon vs Sun) — international convention; flag only if user research disagrees.

## Critical review of this audit (revision)

This section reviews the findings above for accuracy, evidence quality, and severity calibration. Reviewing my own work, three categories emerged:

### A. Findings I overstated

| Original | Honest framing | Adjusted severity |
|---|---|---|
| **Daily index stale → "no user can play a daily today"** | The committed JSON is stale on this checkout. I did not verify production. The GHA workflow may run fine and prod may be current — local checkout staleness is normal between automated commits. | **investigate, not major** until prod is confirmed |
| **Light-mode is non-functional** | Basemap repaints correctly; chrome doesn't follow. That's an inconsistency, not non-functionality. The "Tailwind dark-variant strategy isn't wired" hypothesis is speculative — I never checked `tailwind.config.*`. | major **with hypothesis softened to "needs source review"** |
| **Tab order = WCAG 2.4.3 violation** | The order is suboptimal (dismiss before primary), but 2.4.3 ("focus order preserves meaning and operability") is debatable here. Operability isn't broken; emphasis is wrong. Drop the WCAG citation; keep the UX critique. | major (UX), **not a confirmed WCAG violation** |
| **Country labels poor contrast → likely fails WCAG AA** | I did not measure contrast ratios; I observed visually. May be intentional design (a quiz product de-emphasises labels — country names are shown in the HUD instead). | downgrade to **needs measurement and design intent confirmation** |
| **"Play a game" ▶ does nothing** | I observed no UI change but did not probe deeper. The post-click snapshot showed a new generic child added to the banner — could be a dropdown/menu I didn't notice. | downgrade to **behaviour unclear, needs follow-up** |
| **Share button gives no feedback** | Playwright's clipboard sandbox can block writes silently. The "no feedback" observation may be a sandbox artefact, not an app bug. | downgrade to **needs verification on a real browser** |

### B. Findings I did not adequately verify

These should not be in the punch list at the original confidence level until a follow-up confirms them:

- "Just explore the map" link as a dismiss path — I asserted it works without testing.
- Focus trap behaviour in the launcher modal — I tabbed 4 elements; never confirmed Tab cycles back to the first element.
- Reduced-motion (J5) — `emulateMedia` errored and I skipped the section instead of trying an alternative (CSS injection).
- Source verification — I formed hypotheses about file locations and root causes (`useTheme.ts`, Tailwind config, `useMapInstance.ts`) without opening any of those files to confirm.
- Cross-browser parity — only Chromium was tested. Section J3 (mobile-webkit, desktop-firefox-touch) was untouched.
- The "Federal Republic …" truncation claim "no tooltip on hover reveals full text" — I never hovered to confirm.

### C. Findings that hold up cleanly

These have direct visual or DOM evidence I'm confident about:

1. **Source-attribution tooltip clipped on left edge** — screenshot shows `ORLD FACTBOOK` and `://GITHUB.COM/...` clipped. Unambiguous.
2. **Country name truncated to "Fr…" in mobile bottom-sheet header** at 375 px — direct visual evidence.
3. **Tab order: dismiss focused before primary CTA** — multi-step Tab probe documented `launcher-dismiss` → `country-pinning-daily-cta`.
4. **Backdrop click does NOT dismiss the launcher** — `evaluate` confirmed the launcher was still mounted after click attempt; backdrop element has no `onClick`.
5. **Header chrome is visually present but pointer-blocked while launcher is open** — Playwright's actionability error message documented the backdrop intercepting pointer events.
6. **WebGL canvas blanks without an overlay on `loseContext()`** — direct evidence (canvas blank, no MapErrorOverlay rendered).
7. **Daily-flow happy path works end-to-end** — exercised launcher → game → reveal → share artifact → back to map → reload → played-state. Healthy observation.
8. **History calendar variants work** — past unplayed → reveal modal shows correct content.
9. **Hostile-input handling is robust** — `#INVALID`, future date, rolled-off date all handled cleanly.
10. **Source attribution exists and works for unclipped tooltips** — hovered the CIA Factbook tooltip; content rendered correctly (just positioned wrong).

### D. What this audit method can NOT produce

Vision + Playwright MCP is well-suited for visible bugs (clipping, truncation, missing overlays, layout breaks) and behavioural bugs (button does nothing, hash routing). It is poorly suited for:

- **Pixel-precise contrast measurements** — needs `axe-core` or a contrast-measurement library.
- **Animation timing analysis** — needs frame-by-frame video, not stills.
- **Cross-browser parity** — single-browser run.
- **Performance** — no FPS, memory, or LCP measurements.
- **Source-level root-cause confirmation** — needs reading the implicated source files.
- **Accessibility audit at WCAG level** — needs structured a11y tooling, not visual inspection.

I should have run `axe-core` (the project has `@axe-core/playwright` in dev deps) alongside the vision pass to get structured a11y output. That gap is on me, not on the method.

### Calibrated final ranking

After the review, the punch list is:

#### Confirmed majors (high confidence, ship-blockers if you ship visual fixes this sprint)

1. Source-attribution tooltip clipped on left edge of country panel.
2. Country name truncated to "Fr…" in mobile bottom-sheet header.
3. Launcher tab order: dismiss focused before primary CTA.
4. Backdrop click on launcher does not dismiss.
5. WebGL context-loss does not show MapErrorOverlay.

#### Probable bugs (real, but with caveats above)

6. Light-mode chrome doesn't follow theme (basemap does) — root cause needs source review.
7. Header search/theme controls render visibly clickable while launcher modal blocks them — fix is to hide the banner during modal.

#### Investigate before triaging

8. Daily index in the local repo is stale — verify `daily-puzzle.yml` GHA status and the live site before assigning severity.
9. "Play a game" ▶ button after game completion — probe what `e122` element actually is.
10. Share button feedback — verify on a real browser (clipboard fallback path).
11. Country label contrast in light/dark map views — measure ratios; confirm design intent.

#### Confirmed minors

12. Horizontal/vertical viewport overflow at desktop widths.
13. Cloudflare RUM CORS errors in dev console.
14. Favicon 404.
15. "Today's daily is syncing." copy is unhelpful.
16. Official name truncated in panel header (no hover-reveal verified).
17. Compare view drops source-attribution and some fields vs single panel.
18. Compare highlights both countries with the same colour.
19. Done with one attempt ends without confirmation.
20. MapLibre `calculateFogMatrix` warning on globe projection.
21. `docs/systems/testing.md` out of date about test seam exposure.

#### Nits

22. Favicon, FOUC, calendar week-start, "stranded on huge desktop" composition.

### Reflection on the audit's design

What worked:
- Combining vision (screenshots) + DOM snapshots + computed styles + Playwright actionability errors gave better evidence than any single signal alone.
- Recording findings to a file in real time prevented context loss as the conversation grew.
- Grounding the plan in `docs/purpose.md` / `systems/*.md` before driving made the scenarios specific to this product, not generic.

What didn't:
- I did not pre-define severity criteria, so my "major" vs "minor" distinctions drifted across sections.
- I jumped between sections opportunistically rather than closing each cleanly. That's why D, F, J, M ended up as gaps.
- I formed hypotheses about source files without opening them, then wrote those hypotheses into findings as if confirmed. That's the largest methodology weakness — vision shows symptoms; source review confirms causes.
- I did not run `axe-core` despite the tooling being available. For an a11y-relevant audit that's a major omission.

If I were re-designing this audit:
1. **Define severity rubric upfront** (e.g., "major" requires both visible impact AND >10% user encounter rate).
2. **Per-finding evidence triplet** — symptom screenshot + DOM-state confirmation + source-file pointer (read, not guessed).
3. **Run automated tools alongside vision** — axe-core for a11y, Lighthouse for perf, Playwright's `expect(page).toHaveScreenshot()` for layout regressions.
4. **Complete sections sequentially** rather than skipping when blocked; or explicitly mark as "skipped, blocked by X" not just dropped.
5. **Cross-browser run** — at least Chromium + WebKit + Firefox via the existing Playwright projects.
6. **Spot-check claims by reading 2–3 source files for the highest-severity findings** before publishing.

## Coverage gaps in this run

The following sections were not exercised in this audit and would benefit from a follow-up:

- **C — Daily city-guessing happy path** — only country mode was driven end-to-end; city-guessing's marker/label rendering at zoom levels and distance-km readout legibility need a separate pass.
- **D — Daily unhappy paths beyond "Done early"** — ocean click, antipode, refresh mid-game, stale resume blob, double-submit. These are exactly the regression class the recent cascade-fix commit addressed; high-priority follow-up.
- **F — Streak & milestones** — would require seeding `funworldmap-daily-history` for multi-day streaks then driving play. Most-recent fix (5430df5) is here — high-priority follow-up.
- **J — Theme + responsive deep dive** — only A1/A2/A3 viewports + light/dark on default views. Reduced-motion (`prefers-reduced-motion`) was not exercised; tablet 768 px boundary not exercised.
- **M — Telemetry sanity** — no per-event verification beyond observing the request URLs in the network panel.

The blockers/majors above are independent of those gaps and stand on their own.



---

## Limits of this audit

- Single browser instance, single GPU (this developer machine).
- Screenshots only — no FPS, memory, or CPU profiling.
- No real-network latency or tile-server failures (only stubbed).
- No multi-day calendar progression (date is wallclock at run time).
- No real-device QA (Mali, Adreno, Apple Silicon, Firefox-on-Linux native).
