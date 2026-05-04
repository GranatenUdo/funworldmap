# Plan: vision-audit remediation — 2026-05-04

Source: `docs/superpowers/notes/2026-05-04-vision-bug-hunt.md` (Phase 1 verification results).

> **Revision 2 — added 2026-05-04 after a second source-review pass**
>
> Reading `App.tsx`, `LauncherModeCard.tsx`, `useSelectionHighlight.ts`, and `main.tsx` produced four corrections to the original plan and one NEW finding. Changes summarised at the bottom under "Revision 2 — what changed and why."

## Goals

1. Close the 7 confirmed majors (each verified to file:line).
2. Close the verified minors that are quick wins.
3. Execute the Phase 2 verification work (a11y, cross-browser, prod, contrast) — these are gates on knowing what else needs to ship.
4. Layer in UX enhancements that came out of the audit but aren't bug fixes.
5. Roll the audit's lessons into ongoing process so we don't drift back.

## Sequencing principle

Quick wins → verification → major fixes (with regression tests) → polish → process. Each phase has an explicit definition of done; there is a stakeholder checkpoint between Phase 2 and Phase 3 because verification may surface new findings that re-scope the major fixes.

## Phase 1 — Quick wins

Low risk, high signal-to-effort. Punch list shrinks visibly.

### 1.1 Favicon

`public/favicon.ico` 404 in browser console. Add the existing logo asset (or a derived 32×32). Pure asset add.

### 1.2 Cloudflare RUM gated to prod

Two CORS errors per dev page load on `cloudflareinsights.com/cdn-cgi/rum`. Source: `index.html` script tag. Wrap in `import.meta.env.PROD` (Vite injects a build-time conditional; dev bundle drops the script entirely).

### 1.3 Daily-card copy: three states, not one

`Launcher.tsx:55-62` collapses `puzzlesStatus === 'loading'`, `puzzlesStatus === 'unavailable'` (fetch failed), and `puzzlesStatus === 'ready' && !byDate(date)` (today isn't in the index) all into the single `'unavailable'` UI state. The string "Today's daily is syncing." renders unconditionally at `LauncherModeCard.tsx:104-106`. Differentiate:

- `'loading'` → "Loading…" (transient)
- fetch failed → "Couldn't load today's puzzle. Refresh to retry."
- ready + today missing → "Today's puzzle isn't ready yet — try yesterday's [→link]"

The third case needs a CTA to the most-recent past day. `useDailyPuzzles` already has `index.window.end`, so picking the latest available date is a one-liner.

**Files:**
- `src/components/LauncherModeCard.tsx:4` — extend `LauncherCardState` from `'unplayed' | 'played' | 'unavailable'` to include `'loading' | 'unavailable-error' | 'no-puzzle-today'` (or similar discriminated union).
- `src/components/LauncherModeCard.tsx:103-107` — render different copy based on the new state values.
- `src/components/Launcher.tsx:55-62` — `cardState()` returns the new differentiated state values; thread the latest available `byDate` lookup through.

**Test:** `e2e/launcher-card-loading-states.spec.ts` using the existing `stubDailyIndex` helper — stub to (a) hang, (b) 404, (c) return a window that excludes today; assert the right copy in each.

### 1.4 Compare A/B map-highlight colours

`src/index.css:320-326` defines `.compare-badge-a` (coral `#f43f5e`) and `.compare-badge-b` (teal-dim `#0d9488`) for the panel labels — but the map highlight in compare view uses the same red for both countries. Apply matching paint colours.

**Source-pointer correction:** `useSelectionHighlight.ts` only sets MapLibre filters (`['==', ['get', 'id'], ccn3]`) on `SELECTION_LAYERS` and `COMPARE_LAYERS` — it does NOT set paint colours. The actual paint definitions live where `LAYER.compareFill`, `LAYER.compareBorder`, etc. are configured.

**Files:** `src/lib/mapLayers.ts` (paint properties for `LAYER.compareFill` and `LAYER.compareGlow`), possibly `src/lib/mapColors.ts` for the colour constants. Verify by grepping `compareFill` in those files.
**Risk:** verify both colours have sufficient contrast against (a) ocean blue, (b) other land in light + dark themes. Coral on dark blue is good; teal-dim on dark blue is borderline. Visual sanity check before merging.
**Test:** existing `e2e/compare-view-dimming.spec.ts` extended to assert distinct fill-color paint props for A vs B (read via `__funworldmap_map.getPaintProperty(LAYER.compareFill, 'fill-color')` on a build with `VITE_TEST_HOOKS`).

### 1.5 Documentation: testing.md test-seam exposure

`docs/systems/testing.md` says the map seam "is exposed in production builds as well as development." Code now gates on `VITE_TEST_HOOKS` (introduced 2026-04-25). Update the doc.

### 1.6 NEW: Raise Toast z-index above modal overlays

**Discovered during plan review:** `Toast.tsx:24-30` renders at `z-50`. The launcher dialog is at `z-[210]` (`Launcher.tsx:189`). The game-over modal and reveal overlay are at similar high z-indices. **Any toast dispatched while a modal is on screen is rendered behind the modal's backdrop and is invisible.** This explains the audit's "share button — no visible feedback" observation: `dispatchToast('Copied!')` IS called (verified in source) but the toast renders at z-50 underneath the game-over modal at z-[210].

**Approach:** raise the Toast's z-index to be above all modal overlays. `z-[230]` or similar — pick a number consistently above the highest modal z-index. Better: introduce a single Z-stack constant module so future modals don't out-z-index the Toast accidentally.

**Files:** `src/components/Toast.tsx:24-30`. Optionally a new `src/lib/zStack.ts` defining `Z_TOAST = 230`, `Z_LAUNCHER = 210`, etc.
**Test:** `e2e/toast-above-modal.spec.ts` — open game-over modal, dispatch a toast, assert toast is visible (its computed `z-index` is greater than the modal's, OR Playwright's `isVisible()` returns true while modal is on screen).
**Verification value:** this finding ALSO resolves the audit's "needs further investigation — share button feedback" item. After 1.6 ships, real-browser verification (Phase 2.4) becomes a re-check rather than open investigation.

### 1.7 Definition of done — Phase 1

- All six items merged (1.1–1.6).
- Dev console at cold load shows 0 errors (CF RUM gone, favicon present).
- Three-state copy spec passes.
- Compare-view paint test passes.
- Toast-above-modal spec passes; share-button feedback issue resolved or downgraded to "verify on real browser."

---

## Phase 2 — Verification

Light effort, high information value. Each item produces a markdown report; collected into `docs/superpowers/notes/2026-05-XX-post-audit-verification.md`.

### 2.1 axe-core sweep

Add `e2e/axe-snapshot.spec.ts` running `@axe-core/playwright` against:

- Cold launcher
- In-game HUD (`#daily/<today>/country-pinning`)
- Country panel open (`#FRA`)
- Game-over modal (after a daily completes)
- Reveal modal (`#daily/<past>/reveal`)

Output: violations table, ranked by impact. Compare against the manual audit's a11y items.

### 2.2 Cross-browser parity

`npx playwright test --project=mobile-webkit --project=desktop-firefox-touch` against the same canonical states. Capture screenshots; diff against chromium-gpu baseline. Surface browser-specific bugs we can't see in single-browser audits.

### 2.3 Production daily-index check

Curl live `/daily/index.json` (the production URL — not the local checkout). Confirm `window.end >= today`. Check the `daily-puzzle.yml` GHA workflow status in the Actions tab. If broken, file an issue + fix the schedule.

### 2.4 Real-browser share-toast verification

Open Chrome (not Playwright), play a daily, click Share. Observe whether the toast appears. The Phase 1 audit was inconclusive because of Playwright clipboard sandbox semantics. Two outcomes possible:

- Toast appears for clipboard path → 4.1 is then "add toast for `navigator.share` success path" only.
- Toast doesn't appear at all → there's a real toast-rendering bug to fix in Phase 3.

### 2.5 Label-contrast measurement

Sample MapLibre layer `text-color` and `text-halo-color` paint properties at runtime. Compute WCAG contrast against the basemap base colour for both light and dark themes. Decide pass / fail. If fail, decide intent: deliberate de-emphasis (a quiz product downplays labels) or oversight.

### 2.6 Definition of done — Phase 2

- Single combined verification report committed.
- New findings added to the backlog with severity.
- Stakeholder checkpoint before committing Phase 3 effort.

---

## **Checkpoint** between Phase 2 and Phase 3

Review the verification report. If new majors surface, fold them into Phase 3. If none, proceed to Phase 3 as-scoped.

---

## Phase 3 — Major fixes

Each fix ships with a regression test. Ranked by user impact within the phase.

### 3.1 Launcher initial focus

**Problem:** Cold-load focus latches on `country-pinning-free-link` (secondary action). Forward-tabbing from that initial focus skips the country-pinning daily CTA entirely.

**Cause:** `Launcher.tsx:149-158` runs the auto-focus effect once on mount. At that moment the daily index may still be loading (`cardState === 'unavailable'`), and `LauncherModeCard` renders only the free-link button (verified in `LauncherModeCard.tsx:74-83` — daily CTA is conditional on `state === 'unplayed'`). Focus latches on the free-link and never moves when the daily-cta later mounts.

**Approach:**

- Gate the auto-focus effect on `puzzlesStatus === 'ready'`.
- Selector priority: `[data-testid$="-daily-cta"]` → `[data-testid$="-see-reveal"]` → `[data-testid$="-free-link"]` → launcher-dismiss. The `lastMode` consideration still applies, but only when the corresponding CTA exists.
- **Accessibility guard:** when `puzzlesStatus` transitions from non-ready to ready, only re-focus if the current `document.activeElement` is the now-replaced loading-state placeholder (i.e., the free-link of the loading mode card). If the user has already tabbed elsewhere, do NOT steal focus. This prevents the fix from creating an a11y regression.

**Files:** `src/components/Launcher.tsx:149-158`.
**Test:** `e2e/launcher-focus-order.spec.ts`:
- Cold-load (with daily content already loaded) → wait for `data-app-ready="true"` → assert `document.activeElement` matches `[data-testid$="-daily-cta"]`.
- Tab forward — confirm visual order (CP daily → CP free → CG daily → CG free → dismiss).
- Shift+Tab from end cycles back (focus trap; `installFocusTrap` is already in place at `Launcher.tsx:163`).
- Slow-load case: stub `/daily/index.json` to delay 2s; tab to dismiss button manually during loading; resolve the stub; assert focus did NOT jump back to the daily CTA (a11y guard test).

**Risk:** Focus management can break unrelated tests. Introduce the test first; fix until green; verify other launcher tests still pass.

### 3.2 Launcher backdrop interactions

**Problem:** Backdrop blocks clicks on visible header chrome (theme toggle, search). Backdrop click does NOT dismiss.

**Verification:** `App.tsx:358-370` already passes `launcherVisible={launcherVisible}` to `<Header>`. `Header.tsx` already conditionally renders `header-play` and `satellite-toggle` based on `!launcherVisible`. So the prop plumbing exists — the simplest fix is: in `Header.tsx`, return `null` (or wrap the JSX) when `launcherVisible` is true. No App.tsx change needed.

**Approach:**

- `Header.tsx`: early `if (launcherVisible) return null` (or wrap the existing JSX). Removes the visible-but-unclickable trap.
- `Launcher.tsx:191-195`: add `onClick={(e) => { if (e.target === e.currentTarget) { track('launcher_dismissed', { path: 'card' }); onDismiss(); } }}` on the backdrop div.

**Files:** `src/components/Launcher.tsx:191-195`, `src/components/Header.tsx:33-92`.
**Test:** `e2e/launcher-backdrop-dismiss.spec.ts`:
- Backdrop click outside cards dismisses launcher and tracks `launcher_dismissed { path: 'card' }`.
- Header is not in DOM while launcher is open.
- After dismiss, header is back in DOM with focus on `#search-input` (per `dismissWithFocus` already in `Launcher.tsx:91-95`).

**Risk:** Hiding the header changes the visual layout. Verify no jarring layout shift when the launcher unmounts on dismiss; a brief CSS opacity transition on the header may be needed.

### 3.3 WebGL context-loss handler

**Problem:** Context loss leaves blank canvas; no overlay; no recovery.

**Approach:**

- Extend `MapErrorReason` in `useMapInstance.ts` with `'webgl-lost'`.
- Extend `REASON_MESSAGES` in `MapErrorOverlay.tsx`: title "Map paused", body "We lost the map briefly. Tap to restore."
- Register `map.on('webglcontextlost', e => { e.preventDefault(); setMapErrorState('webgl-lost') })` and `map.on('webglcontextrestored', () => setMapErrorState(null))`.
- The overlay's `onRetry` handler tries `restoreContext()`; if that doesn't fire `webglcontextrestored` within 1s, fall back to a full re-init (re-create the `maplibregl.Map` instance via remount key).

**Files:** `src/hooks/useMapInstance.ts`, `src/components/MapErrorOverlay.tsx`.
**Test:** `e2e/webgl-context-loss.spec.ts`:
- Force loss via `canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()`.
- Assert `[data-testid="map-error-overlay"]` appears.
- Click Retry → assert overlay clears within 2s and map renders again.

**Risk:** `restoreContext()` is browser-dependent. Test the fallback (full re-init) path explicitly.

### 3.4 Source tooltip edge collision

**Problem:** Tooltip clipped at panel left edge for left-column fields. Defeats the product's "transparency about sources" principle.

**Approach options:**

- **A.** Install `@floating-ui/react` (verified: not in `package.json`). Replace centred-absolute positioning with `useFloating({ middleware: [flip(), shift({ padding: 8 })], placement: 'top' })`. Combined with a portal so the tooltip escapes the panel's stacking context.
- **B.** Manual edge detection in `useLayoutEffect`: measure the rendered tooltip's bounding rect, apply `translateX` to keep it inside the viewport.

**Recommendation:** A. Floating UI is ~6 KB gzipped. The codebase has no positioning library yet, and source tooltips will not be the only popover the project ever ships. Install once; reuse for future tooltips, dropdowns, and the search results dropdown's potential future overflow handling.

**Trade-off note:** if bundle size is a hard constraint (the project's current bundle budget conversation is open per `docs/systems/overview.md`), pick (B) instead.

**Files:** `src/components/SourceTooltip.tsx`, `package.json`.
**Test:** `e2e/source-tooltip-edge.spec.ts` — hover a left-column tooltip, assert tooltip's `getBoundingClientRect()` is fully within viewport.

### 3.5 Mobile country-panel header

**Problem:** Country name truncates to "Fr…" on iPhone widths. Action button row consumes the available horizontal space.

**Approach:** at narrow widths (< sm breakpoint), wrap the action button row below the title via `flex-wrap` on the container. Title gets full width on the first row; buttons reflow below. No new pattern; existing Tailwind utilities suffice.

**Alternative considered:** kebab menu collapsing buttons into a "⋮" — rejected because it adds an interaction layer and we already have the vertical real estate.

**Files:** `src/components/SingleCountryPanel.tsx:111-205`.
**Test:** visual regression at 360 / 375 / 414 / 768 px in `e2e/country-panel-responsive.spec.ts`.
**Risk:** SingleCountryPanel is heavily used; changes here can affect compare view + game-active variants. Visual regression at all widths is the safety net.

### 3.6 Header play button post-game

**Problem:** ▶ does nothing after game completion. User can't reopen the launcher without page reload.

**Risk tolerance (confirmed by user):** if runtime debugging reveals a `useGameSession` reducer bug, the fix may touch reducer logic. That's acceptable; ship it with a regression test for both the reducer transition and the visibility-hook reaction.



**Plot twist from source review:** The wiring is CORRECT.
- `App.tsx:114-116`: `openLauncher` is `() => showLauncher()`.
- `App.tsx:368`: `onOpenLauncher={openLauncher}` passed to Header.
- `Header.tsx:55`: `header-play` button calls `onOpenLauncher`.
- `useLauncherVisibility:42-43`: `show = () => setDismissed(false)`.
- `useLauncherVisibility:33-40`: an effect resets `dismissed = false` whenever `session.status` transitions from non-idle to idle.
- `useLauncherVisibility:45-48`: `visible = (bareRoot || dailyRoot) && !dismissed && session.status === 'idle'`.

By that logic, after Back-to-map: hash is `""` (bareRoot ✓), session goes idle (so `dismissed` resets to false ✓), `show()` re-affirms `dismissed=false`, and `visible` should be true. **But it isn't** in my test (Phase 1 verification confirmed `launcherUp: false`).

**This means the bug is more subtle than the plan can name without runtime debugging.** Candidate causes:
1. Session does not actually transition to `'idle'` after "Back to map" — stays at `'game-over'` or similar. The Header's `gameActive` check (`session.status !== 'idle'`) wouldn't have hidden the button if status were non-idle, but `header-play` is also conditional on `!gameActive`. Yet I observed the button visible AND clickable. So `gameActive` is false, which means status IS idle. Contradiction unless the button's render and the visibility hook are reading different snapshot moments (StrictMode double-render?).
2. The hashchange listener in `useLauncherVisibility:27-31` fires after some intermediate state, leaving `currentHash` stale.
3. A re-render race where `setDismissed(false)` is overridden by a later effect.

**Investigation step (REQUIRED before writing the fix):**
- Add temporary `console.log({ visible, hash, dismissed, sessionStatus })` at the top of the `useLauncherVisibility` body.
- Repro: cold load → start daily → submit guess → Done → Back-to-map → click ▶.
- Observe the log sequence. Identify which condition is false at click time.

**Approach:** depends on root-cause finding. May be a one-line fix (e.g., `setDismissed(false)` in the click handler bypassing the effect) or may require a small state-machine review of the GameSessionProvider.

**Files:** likely `src/hooks/useLauncherVisibility.ts` and possibly `src/game/shared/useGameSession.ts` or `GameSessionProvider.tsx`.
**Test:** `e2e/header-play-reopens-launcher.spec.ts` — complete daily, click Back-to-map, click `[data-testid="header-play"]`, assert launcher opens with played-state cards (per the audit's verified played-state UX).
**Effort:** wider than the others — could be 2 hours or 1 day depending on what the logs show.

### 3.7 Definition of done — Phase 3

- All seven majors closed with their listed regression test.
- An end-to-end "keyboard-only daily play" smoke test passes: cold-load → Tab to daily-cta → Enter → tutorial dismiss → guess via keyboard map controls → Done → Share — without touching the mouse.
- No regressions in the existing e2e suite.

---

### 3.7 Toast for share-API success (promoted from Phase 4 per user)

`DailyShareBlock.tsx:23-25` returns silently after `navigator.share` resolves. Add `dispatchToast('Shared!')` for parity with the clipboard path.

**Depends on Phase 1.6** (Toast z-index above modals) — otherwise this toast is also invisible behind the game-over modal. Sequence: 1.6 first, then 3.7.

**Files:** `src/components/DailyShareBlock.tsx:19-29`.
**Test:** extend `e2e/toast-above-modal.spec.ts` with a navigator.share success path (mock `navigator.share` to resolve successfully; assert toast).

### 3.8 Source attribution in compare view (promoted from Phase 4 per user)

Compare view drops the `i` tooltips entirely. The audit's verified observation: this contradicts the product's stated transparency principle (`docs/purpose.md`). Restore source attribution.

**Approach:** add a single footer at the bottom of the compare grid: "Sources: REST Countries · CIA World Factbook (archived)" with the same anchor links the per-field tooltips use. Doesn't clutter the comparison columns; preserves the design intent of "compare = terse" while keeping attribution reachable.

**Files:** `src/components/CompareCountryPanel.tsx`.
**Test:** `e2e/compare-source-attribution.spec.ts` — pin two countries; assert footer is present; assert each source-name link is keyboard-reachable and has an `href`.

## Phase 4 — UX enhancements

Marked as nice-to-have after promoting the high-impact items into Phase 3. Each remaining item is small but compounds polish. Not gating audit closure.

### 4.1 Confirm-on-low-score before Done

When current best is < 30/100 and attempts remain, "Done" shows a small "Use 2 more attempts?" prompt. Reduces accidental low-score endings without nagging the player.

**Files:** in-game HUD components.
**Risk:** can feel paternalistic; needs design sign-off on threshold + copy.

### 4.2 Search dropdown keyboard hint

Add subtle "↓ Select · ↵ Confirm" affordance below the dropdown.

**Files:** `src/components/SearchBar.tsx`.

### 4.3 Source tooltip keyboard verification

`SourceTooltip.tsx:40-41` already wires `onFocus={() => setOpen(true)}` and `onBlur={() => setOpen(false)}`. Add a Playwright test that proves keyboard reach: Tab to icon, verify tooltip appears, Tab away, verify it closes.

**Files:** `e2e/source-tooltip-keyboard.spec.ts` (test only — no app code change unless the test fails).

---

## Phase 5 — Process improvements (post-remediation)

These are how we keep the audit's lessons paying off.

### 5.1 axe-core in CI

After Phase 2.1, the spec is in place. Make it required on PR. Initial budget: 0 violations on canonical states. Tighten over time.

### 5.2 Cross-browser CI matrix

Currently the suite has multiple Playwright projects but only chromium-gpu is the documented "must pass" path (per CLAUDE.md). Promote at least mobile-webkit + desktop-firefox-touch to required-on-PR for a small set of canonical specs.

### 5.3 Production health smoke

Cron-style GHA workflow (every 6 hours) that:
1. Curls live `/daily/index.json`.
2. Asserts `window.end >= UTC today`.
3. Posts to a Slack/Discord/issue on failure.

Catches stale-index regressions in hours instead of weeks.

### 5.4 Coverage gaps from the audit (sections C, D, F, M)

Add to the e2e backlog:
- City-guessing daily flow end-to-end.
- Daily unhappy paths: ocean click, refresh mid-game, double-submit, antipode.
- Streak break + rebuild milestone re-fire (the 5430df5 fix).
- Per-event telemetry assertion via network capture.

---

## Test rigor — non-flaky e2e patterns

Every new test in this plan MUST follow the rules in `CLAUDE.md` ("Writing e2e tests that don't flake on CI"). The 2026-04-28 flake regression analysis shows what happens when these rules are skipped — this remediation will not contribute to a repeat.

### Hard rules (recap from CLAUDE.md)

- ❌ **No `page.waitForTimeout(N)`** — magic-number sleeps are the documented #1 flake source.
- ❌ **No `click({ force: true })`** as a band-aid for actionability.
- ❌ **No sleeping through CSS transitions** — wait on observable state (`not.toBeAttached`, `data-animation-state="idle"`).
- ❌ **No `.first()` on Fuse.js results** — use named-option locators.
- ❌ **No counting Tab presses without intermediate assertions** at each step.
- ✅ **Use the readiness helpers** in `e2e/helpers.ts`: `waitForAppReady`, `waitForGameTestHook`, `gotoAndWaitForMap`, `stubDailyIndex`, `seedDailyHistory`, `routeMapTiles`, `dismissLauncher`.
- ✅ **Use auto-retrying assertions** (`expect(locator).toBeVisible()`, `expect.poll(...)`) over manual polls.
- ✅ **Pair overlay-occluded clicks** with `expect(occluder).not.toBeAttached()` waits.
- ✅ **Use test seams over UI driving** for game flows: `__funworldmap_game.submitCountryGuess(cca3)`, `completeNow()`, etc.
- ✅ **Use synthetic map clicks** via `__funworldmap_map.fire('click', ...)` for ocean / off-globe paths.

### Per-test compliance audit

Each new test is mapped to the rule set it must satisfy. If you write the test and find yourself reaching for a forbidden pattern, stop and re-read the rule.

| Test | Helpers | Test seams | Specific risks to avoid |
|---|---|---|---|
| `e2e/launcher-card-loading-states.spec.ts` (1.3) | `stubDailyIndex` | — | Loading state must be triggered deterministically — `page.route('/daily/index.json', () => new Promise(()=>{}))` (never resolve) for the loading case; standard 404 stub for fetch-failed; window-excludes-today stub for no-puzzle. Use `expect(locator).toBeVisible()` on each copy variant; never `waitForTimeout`. |
| `e2e/toast-above-modal.spec.ts` (1.6) | `waitForAppReady`, `waitForGameTestHook`, `seedDailyHistory` | `__funworldmap_game.completeNow()` | Drive the game to game-over via the seam, NOT via real map clicks. Wait for `[data-testid="game-over-overlay"]` via `expect(...).toBeVisible()`. Click Share button after share block is visible. Assert toast via `expect(toastLocator).toBeVisible()` — Playwright's `toBeVisible` checks computed visibility (display, opacity, z-index occlusion is not directly checked, so additionally assert `getComputedStyle(toast).zIndex > getComputedStyle(modal).zIndex`). |
| `e2e/launcher-focus-order.spec.ts` (3.1) | `waitForAppReady`, `stubDailyIndex` | — | **Intermediate assertion at every Tab step** — never count Tabs without checking. After waiting for `[data-testid$="-daily-cta"]` to be `toBeVisible`, assert initial focus. Tab 1 → assert. Tab 2 → assert. Etc. For the a11y-guard slow-load case: use `page.route` with a 2s delay, Tab to dismiss during loading, resolve the route, then assert focus DID NOT jump back to the daily CTA. |
| `e2e/launcher-backdrop-dismiss.spec.ts` (3.2) | `waitForAppReady` | — | Click the backdrop element directly (`[data-testid="launcher"] > div[aria-hidden]`). Wait for `expect(launcher).not.toBeAttached()` — confirms the dismiss actually happened, not animation in flight. Then `expect(headerSelector).toBeVisible()` to confirm header re-appears. |
| `e2e/webgl-context-loss.spec.ts` (3.3) | `gotoAndWaitForMap` | `__funworldmap_map` (read canvas only) | Force loss via `canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()` (sync). `expect([data-testid="map-error-overlay"]).toBeVisible()` — no `waitForTimeout`. Click Retry, then `expect(overlay).not.toBeAttached()` to confirm restoration. Test the fallback path explicitly (force a non-restorable loss; assert full re-init or graceful failure message). |
| `e2e/source-tooltip-edge.spec.ts` (3.4) | `waitForAppReady`, `gotoAndWaitForMap` (#FRA preselected) | — | `locator.hover()` auto-waits for visibility + stability. Use `expect.poll(async () => { const r = await tooltipLocator.boundingBox(); return r && r.x >= 0 && r.x + r.width <= viewportWidth; }).toBe(true)` to retry past Floating UI's flip animation. Assert tooltip rect is fully within viewport AND within the panel container's rect. |
| `e2e/country-panel-responsive.spec.ts` (3.5) | `gotoAndWaitForMap`, `waitForCountryTilesRendered` | — | Visual regression is inherently rasterizer-sensitive. Use `expect(page).toHaveScreenshot({ maxDiffPixelRatio: 0.02 })`. Screenshot the panel locator only, not the full page. Run only on `chromium-gpu` project, not Software-ANGLE `chromium`. Pre-render: navigate to `#FRA`, wait for tiles, wait for panel `data-animation-state="idle"` (add this attribute as part of the fix if not present). |
| `e2e/header-play-reopens-launcher.spec.ts` (3.6) | `waitForAppReady`, `waitForGameTestHook` | `__funworldmap_game.completeNow()` | Drive completion via the seam. After Back-to-map, wait for hash to be `""` via `expect.poll(() => page.url()).toMatch(/\/$/)`. Click `[data-testid="header-play"]`, then `expect([data-testid="launcher"]).toBeVisible()` (auto-retries). Do NOT add a sleep before the click. |
| `e2e/compare-source-attribution.spec.ts` (3.8) | `gotoAndWaitForMap` (#FRA,DEU) | — | Pin two countries via direct hash navigation (deterministic). `expect(footerLocator).toBeVisible()`. Assert each `<a>` has `href` attribute via `expect(link).toHaveAttribute('href', /.+/)`. Tab to footer links to verify keyboard reach with intermediate assertions. |
| `e2e/source-tooltip-keyboard.spec.ts` (4.3) | `gotoAndWaitForMap` (#FRA) | — | Tab to the first source-tooltip icon with intermediate assertions on every Tab. After focus is on the icon, `expect([role="tooltip"]).toBeVisible()`. Tab away, then `expect(tooltip).not.toBeVisible()`. |
| Extension to `e2e/compare-view-dimming.spec.ts` (1.4) | (existing) | `__funworldmap_map.getPaintProperty()` | Assert distinct fill-color paint props for A vs B via the test seam. No waitForTimeout — paint properties are sync. |

### Helper additions (if needed)

If a fix's test requires a readiness wait that doesn't yet exist in `e2e/helpers.ts`, **add the helper to `helpers.ts`** rather than inlining the wait — per CLAUDE.md's "If none exists for your case, *add* one to `helpers.ts` rather than inlining the wait."

Anticipated additions:
- `waitForGameOverOverlay(page)` — if 1.6 / 3.6 / 3.7 need it.
- `waitForLauncherDismissed(page)` — `expect(page.locator('[data-testid="launcher"]')).not.toBeAttached()`.
- `forceWebGLContextLoss(page)` — encapsulates the canvas + extension + loseContext() call.

### Pre-merge checklist (per test, before opening PR)

1. **Reproduce locally with `--workers=2`** (matches CI parallelism).
2. **Run the test 10× locally** (`npx playwright test path/to/spec --repeat-each=10`). Must be 10/10 green.
3. **Read the spec aloud and confirm zero `waitForTimeout`, zero `force: true`, zero unguarded `.first()` on dynamic lists.**
4. **Confirm any `data-animation-state` waits use the right state value** for the component being tested.
5. If CI flakes anyway (post-merge), apply the escalation rule from `docs/superpowers/plans/2026-04-22-deflake-chromium-e2e.md`: don't paper over with retries; find the assumption your local env satisfies that CI doesn't.

## Effort estimates (speculative)

These are my guesses; real effort emerges during execution.

| Phase | Effort | Risk |
|---|---|---|
| 1 — Quick wins | ~1 day | Low |
| 2 — Verification | ~0.5 day | Low |
| 3 — Major fixes | ~3-5 days | Medium |
| 4 — UX enhancements | ~2-3 days | Low–medium |
| 5 — Process | ~0.5 day setup + ongoing | Low |
| **Total** | **~7–10 dev-days** | |

---

## Definition of done (overall)

- All 7 confirmed majors closed with regression tests.
- All confirmed minors closed.
- Phase 2 verification report committed and triaged.
- CI matrix includes axe + cross-browser for canonical states.
- Production-health smoke alert wired up.
- The audit doc (`docs/superpowers/notes/2026-05-04-vision-bug-hunt.md`) is updated with "fixed" markers per finding.

---

## Out of scope

- Architectural refactors not motivated by audit findings.
- Performance work (would need a dedicated audit).
- Speculative UX (calendar week-start, etc.) until user research justifies.
- Anything from the "Withdrawn / retracted" section of the audit (light-mode design, label contrast pending intent confirmation).

---

## Critical review of this plan (per the project memory rule)

### Revision 1 (original): three things I'd want a reviewer to push back on

1. **Phase 3.6 effort estimate.** I'm estimating without having read `App.tsx` / `main.tsx`. The fix could be 5 lines or 50 depending on how the visibility wiring is structured. The investigation step is intentionally separated to surface this.

2. **Phase 3.4 dependency add.** Floating UI is ~6 KB. If the team has a hard "no new dependencies" stance, the manual edge-detect alternative (B) is genuinely viable but less robust. Decision belongs with the team, not the plan.

3. **Phase 4 priority.** I marked these as "nice to have" but 4.1 (toast for share-API success) and 4.2 (source attribution in compare) close real UX gaps that could legitimately be Phase 3 majors. Open to negotiation.

### Revision 2 — what changed and why

I did the source-review pass I had recommended (and skipped) before publishing Rev 1. Findings:

**A. NEW Phase 1.6 — raise Toast z-index above modals.** Discovered while reading `Toast.tsx` and `Launcher.tsx`. Toast renders at `z-50`; modals at `z-[210]`. Any toast dispatched while a modal is open is invisible behind the modal's backdrop. This explains the audit's unresolved "share button has no feedback" finding: `dispatchToast('Copied!')` IS called but the toast is rendered behind the game-over modal. Adding this resolves that audit item without further investigation. Should be Phase 1 because it's a one-line fix.

**B. Phase 1.4 source-pointer wrong.** I said "apply matching colours via `useSelectionHighlight.ts`." Actually that hook only sets MapLibre filters, not paint. The compare colour change goes in `src/lib/mapLayers.ts` where `LAYER.compareFill` etc. are defined. Corrected.

**C. Phase 1.3 file pointers more precise.** "Today's daily is syncing." string lives at `LauncherModeCard.tsx:104-106`. The state-machine extension also requires updating `LauncherCardState` at `LauncherModeCard.tsx:4`. Corrected.

**D. Phase 3.1 needs an a11y guard.** Naively re-running the focus effect when `puzzlesStatus` transitions to `ready` could steal focus from a user who has already tabbed elsewhere during loading. Added a guard: only re-focus if `document.activeElement` is the loading-state placeholder. Without this guard, fixing the original bug introduces a different a11y bug.

**E. Phase 3.2 fix is simpler than I described.** App.tsx already passes `launcherVisible` to Header. The fix is a one-line `if (launcherVisible) return null` in Header.tsx. No App.tsx changes needed. Corrected.

**F. Phase 3.6 root-cause is genuinely unknown.** App.tsx review showed the wiring IS correct: `openLauncher` calls `showLauncher` which calls `setDismissed(false)`, and the visibility-on-idle reset effect is in place. By the code, the launcher should re-open after Back-to-map. **But empirically it doesn't.** This means there's a runtime issue (state-transition race, hashchange ordering, StrictMode double-render, or a bug in the GameSession state machine) that source-reading alone can't resolve. The plan now requires a logging/debugging step before the fix can be specified. Effort widened from "1–3 hours" to "2 hours – 1 day."

**G. The "needs further investigation" share-toast finding from the audit is now MOSTLY RESOLVED.** It's the Toast z-index bug (B above). The remaining open question is whether `navigator.share` on a real device dispatches a toast at all (Phase 4.1 fixes that path).

### Revision 2 — meta-lesson

The original plan recommended source-review as best practice but didn't fully apply it to itself. Doing so produced:
- 1 new finding (Toast z-index)
- 2 corrected file pointers (1.3, 1.4)
- 1 new accessibility guard (3.1)
- 1 simplified approach (3.2)
- 1 elevated risk (3.6)

That's a 6-edit revision from ~30 minutes of file reads. The lesson from the original audit holds: **vision shows symptoms, source review shows causes — and source review applies to plans, not just findings.**

### What I deliberately did NOT include

- New features.
- Tooling churn (e.g., switching Tailwind versions, replacing Vite, etc.).
- Anything that would invalidate the existing e2e suite without a clear win.
- Architectural refactors not motivated by audit findings.

### Decisions captured (Revision 3, 2026-05-04)

User-confirmed answers to the open questions:

1. ✅ **Floating UI dependency approved** for Phase 3.4 (~6 KB / +1.3% bundle).
2. ✅ **4.1 and 4.2 promoted to Phase 3** (now 3.7 toast-for-share-API, 3.8 source-attribution-in-compare). Phase 4 renumbered.
3. ✅ **Phase 3.6 risk tolerance accepted** — fix may touch `useGameSession.ts` reducer logic if needed.
4. ✅ **No flaky tests** — added "Test rigor — non-flaky e2e patterns" section above. Every new test in this plan is mapped to its CLAUDE.md compliance requirements with a per-test risk audit. Pre-merge checklist requires 10× local runs at `--workers=2`.
