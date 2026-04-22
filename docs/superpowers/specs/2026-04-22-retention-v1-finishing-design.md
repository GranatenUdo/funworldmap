# Retention v1 — Finishing (Phases 4 + 5) Design

**Date:** 2026-04-22
**Status:** Draft — pending user review
**Depends on:** [`2026-04-21-retention-program-v1-design.md`](2026-04-21-retention-program-v1-design.md) (Phases 1-3 shipped). Extends the same retention program; this doc is the implementation contract for the remaining two phases plus a CI prereq.
**Supersedes:** the parent spec's brief Phase 4 / Phase 5 paragraphs (§"Phases" L516-518). The parent spec's other sections (data model, scoring, telemetry, etc.) remain authoritative and are not duplicated here.

---

## Goal

Ship retention v1 to production by closing out the share flow, the missing no-mode launcher anchor, and the launch-quality gates (full WCAG 2 AA, system docs, monitoring). Stop normalising admin-merges by deflaking the chromium e2e project as a prereq.

**Primary success criteria.**
- Friend receives a share text → can paste a URL that lands them on a playable daily within one tap.
- Every retention surface passes axe-core WCAG 2 AA in CI.
- `chromium` e2e project goes green without admin override on the v1 wrap PRs.
- 72 h post-launch monitor shows no error-rate or session-rate regression vs Phase 3 baseline.

**Explicit non-goals.** Canvas-rendered share image, push notifications, achievements, retroactive free-play of past dailies, per-timezone rollover. All deferred to v1.1+ per the parent spec.

---

## Scope

### In scope

Three sequential PRs, each independently shippable and revertible:

**A. Deflake `e2e (chromium)` (prereq).** Network-stub tile mocks + Playwright fixtures for static JSON. Removes the startup-data race that has caused intermittent `chromium` failures across PRs #8, #9, #10 (each merged via admin override after `chromium-gpu` passed). Roadmap already lists this exact item (§"Build / CI" — "Network-stubbed tile mocks for e2e").

**B. Phase 4 — Share flow.**
- `src/game/daily/shareText.ts` — pure `buildShareText({ date, results, streak })`.
- `src/components/DailyShareBlock.tsx` — presentational + dispatch.
- Mounted in **both** `GameOverOverlay` (post-game) and `DailyRevealOverlay` (Phase-3 reveal route). Recipients of a shared link can immediately re-share — that is the viral loop.
- `src/lib/hashState.ts` — extend `daily` variant to support `modeId: null` (no-mode case).
- `src/App.tsx` — route `#daily/YYYY-MM-DD` (no mode) → mount Launcher with `anchorDate=date`.
- New analytics event: `daily_shared`.

**C. Phase 5 — Polish + launch.**
- Full WCAG 2 AA pass via `@axe-core/playwright` across all retention surfaces (launcher, streak pill, history panel, calendar cells, milestone overlay, reveal overlay, share block, game-over overlay).
- Manual NVDA / VoiceOver smoke pass on the golden path.
- Manual keyboard-only smoke pass.
- New `docs/systems/daily-puzzle.md` — single-page system doc covering content pipeline → fetch → play → store → streak → reveal → share.
- Edit `docs/purpose.md` to add a daily-puzzle paragraph.
- Prune `docs/roadmap.md` — close out the retention-program section, leave a "Retention v1.1+" subsection.
- Launch checklist: 14-day baseline confirmation, CF Analytics Engine dashboards committed to `cloudflare-worker/queries/`, rollback procedure documented, 72 h monitor opened.

### Out of scope (deferred to roadmap or v1.1+)

- Firefox / Safari Playwright projects (already deferred).
- GPU-runner upgrade (already deferred).
- `size-limit` budget in CI (already deferred).
- Canvas-rendered PNG share image (v1.1).
- Push notifications, achievements, leaderboards (v1.1+).
- Launch announcement / blog post (product, not engineering).

---

## A — Deflake `e2e (chromium)` (prereq)

### Observed failures

- PRs #8 / #9 / #10 each saw `chromium` red while `chromium-gpu` green.
- `chromium-gpu` passing **does not validate the same tests** — `playwright.config.ts` projects are **disjoint by `testMatch`**: `chromium` runs DOM tests only (search, satellite, launcher, daily, etc.); `chromium-gpu` runs map/GPU tests only. They cover different files.
- Concrete failures observed in PR #10:
  - `e2e/search.spec.ts:25/110/117` — fill search box, assert results contain country name, get `"No countries found for Paris"` instead.
  - `e2e/satellite-default.spec.ts:7` — `getByTestId('satellite-toggle')` returns `element(s) not found` within 5 s.
  - `e2e/launcher.spec.ts:96` — `panel-close` click times out at 60 s, browser closes mid-test (one occurrence, possibly a different class of flake).

### Root cause is NOT yet known

Earlier draft assumed a static-data fetch race. **That hypothesis is wrong**: `countries.json` and `cities.json` are statically imported (`src/hooks/useCountryData.ts:2`, `src/hooks/useCityData.ts:2`) and bundled — there is no runtime fetch to mock. Only `/daily/index.json` (small) and the dynamic `world-atlas/countries-50m.json` chunk (large) are runtime requests. A's first task must be **diagnosis**, not a presumed fix.

### Plan

A1. **Reproduce locally.** Run `npm run test:e2e -- --project=chromium --workers=2 --retries=0` 10× consecutively. Capture every failure's `trace.zip`. If zero local repros, run on the same Ubuntu runner image as GitHub Actions via `act` (or accept that CI is the only repro environment and instrument the next CI run with `--trace=on`).

A2. **Diagnose from traces.** For each captured failure, inspect: network panel (was the dynamic country-50m chunk slow?), console (any errors?), DOM snapshot at failure point (was `countries` empty in SearchBar's props at the moment `fill` ran?).

A3. **Fix at source.** Likely candidates and their fixes:
- *Page hadn't hydrated* → add explicit readiness signal (e.g. `data-app-ready="true"` on `<main>` after first useEffect runs) and have e2e helpers wait on it instead of bare `waitForTimeout`.
- *MapLibre tile network variance bleeds into DOM tests* → add `routeMapTiles(page)` fixture (`page.route` for EOX raster + tile URLs → 1×1 PNG fulfil). This is the only route mock that has any effect; the static-data mocks would not.
- *Dynamic-import chunk race* → `page.route` for `world-atlas/countries-50m.json` and `topojson-client` chunks if they're hot-path on the failing tests (they shouldn't be for search.spec, but verify).
- *React 19 concurrent rendering window* → if SearchBar is mounting before `useCountryData`'s memo resolves on first render, the fix is in the source, not the test.

A4. **Validate.** Run `chromium` project 10× consecutively, both locally and in CI. Zero flakes accepted. If a fix turns out wrong, escalate before papering over with retries.

### Honest uncertainty

A may take 2 days or 5 days depending on what the traces reveal. **If diagnosis after 2 days shows no clear root cause and only the satellite + search tests flake, the fallback is to add a ready-state assertion to those tests' helpers and accept that as the fix** — explicitly documented as "tactical, not root cause" with a roadmap follow-up. We do not iterate beyond ~3 days on diagnosis.

### Out of scope for prereq

- Firefox / Safari projects.
- New tests beyond the helpers required for the fix.
- Refactoring existing flaky tests beyond the readiness signal.

---

## B — Phase 4: Share flow

### B0 — Pre-flight (first task of B)

Before any code: verify whether `funworldmap.com` (or any custom domain) is configured against GitHub Pages and CF. If yes, the share text URL line uses the custom domain naturally via `window.location.origin`. If no, share text falls back to `granatenudo.github.io/funworldmap` — still functional, less brand-clean. Note the result in the PR description; do not block B on a domain purchase.

### Components

| File | Responsibility |
|---|---|
| `src/game/daily/shareText.ts` | Pure `buildShareText({ date, results, streak, originUrl })` → string. No DOM, no browser API. |
| `src/components/DailyShareBlock.tsx` | Presentational + dispatch. Props: `text: string`, `url: string`. Renders preview + Share + Copy-link-only. |
| `src/lib/hashState.ts` | Extend `daily` variant: `modeId: ModeId \| null`. Parse + serialise `#daily/YYYY-MM-DD` (no mode). |
| `src/components/GameOverOverlay.tsx` | Mount `<DailyShareBlock>` when `session.kind === 'daily'`. |
| `src/components/DailyRevealOverlay.tsx` | Mount `<DailyShareBlock>` at the bottom of the reveal. Same component, same content. |
| `src/App.tsx` | Route `#daily/YYYY-MM-DD` (no mode) → render Launcher with `anchorDate={date}`, no game start. |
| `src/lib/analytics.ts` (extend events) | New event type `daily_shared`. |

### Share text format

Locked by parent spec §"Share text" L341-353:

```
funworldmap · 04-21
🌍 Country  🟥🟧🟩  87/100
🏙️ City     🟥🟨🟩  81/100
🔥 7-day streak
funworldmap.com/#daily/2026-04-21
```

- **Per-mode 3-square strip** — one square per attempt, colour encodes that attempt's score quintile: 🟩 (90-100) · 🟨 (70-89) · 🟧 (50-69) · 🟥 (30-49) · ⬛ (0-29). Strip pads with ⬛ if fewer than 3 attempts taken (e.g. early reveal — but daily play uses all three by spec).
- **Score after strip** — best-of-3, always `/100`.
- **Un-played mode line** — `🏙️ City  ⬜⬜⬜  not played`.
- **Streak line omitted** when `streak.current === 0`.
- **Country / city names deliberately omitted** — preserves puzzle for share recipients who haven't played.
- **URL line** — uses `window.location.origin` so dev / staging / prod each share their own host. The literal `funworldmap.com` in the format example is illustrative; runtime substitutes real origin.

### Dispatch

`<DailyShareBlock>` Share button:
- If `navigator.share` available → `navigator.share({ title: 'funworldmap daily', text, url })`.
- Otherwise → `navigator.clipboard.writeText(text + '\n' + url)` + transient toast.
- Secondary "Copy link only" → `navigator.clipboard.writeText(url)` + toast.

**Toast reuse.** The existing `src/components/Toast.tsx` listens for `window` `CustomEvent('funworldmap:toast', { detail: string })` (already mounted in `App.tsx`). `<DailyShareBlock>` dispatches `window.dispatchEvent(new CustomEvent('funworldmap:toast', { detail: 'Copied!' }))`. No new toast primitive.

All three paths fire `daily_shared` with `method: 'share' | 'clipboard' | 'copy-link'`. If the user cancels the native `navigator.share` sheet (promise rejects with `AbortError`), `daily_shared` is **not** fired — it represents intent-to-share, not a mere button press.

The share block **only mounts when at least one mode of the current day has been played** (`modesPlayed >= 1`). A reveal route loaded with zero stored attempts shows the reveal copy without a share block — there is nothing to share.

### Test mocking strategy (concrete)

- **Clipboard** — Playwright config grants `permissions: ['clipboard-read', 'clipboard-write']` per context. Tests assert content via `page.evaluate(() => navigator.clipboard.readText())`.
- **`navigator.share`** — `page.addInitScript` overrides `window.navigator.share` to record calls on `window.__lastShare`. Tests inspect `await page.evaluate(() => window.__lastShare)`.
- **Origin URL** — formatted as `${window.location.origin}/#daily/${date}` (no trailing slash; `origin` returns scheme + host + optional port without trailing). `buildShareText` accepts `originUrl` as a parameter so unit tests pass a fixed string for snapshots.

### URL routing addition

Existing routes (post-Phase-3):
- `#daily/<date>/<mode>` — start daily or redirect to `/reveal` if past / played.
- `#daily/<date>/<mode>/reveal` — single-mode reveal.
- `#daily/<date>/reveal` — both-modes reveal.

New route:
- `#daily/<date>` (no mode) — Launcher with `anchorDate={date}`. If `<date>` is in the future or rolled-off, redirect to `/` with a toast (existing behaviour from Phase 3 reveal-overlay redirects, generalised).

### Analytics

Event: `daily_shared`
Props: `{ date: string, modesPlayed: 1 | 2, method: 'share' | 'clipboard' | 'copy-link' }`

### Tests

| File | Coverage |
|---|---|
| `src/game/daily/__tests__/shareText.test.ts` | Snapshots: one-mode-played, both-played, perfect/zero score, streak 0/1/99, all five quintiles per attempt slot, un-played mode line, custom origin |
| `src/components/__tests__/DailyShareBlock.test.tsx` | Render, share-API path with mock, clipboard fallback path with mock, copy-link-only path, toast appears, `daily_shared` fires with correct method |
| `src/lib/__tests__/hashState.test.ts` (extend) | `#daily/2026-04-21` round-trips with `modeId: null`; invalid `#daily/garbage` → `kind: 'empty'` |
| `e2e/daily-share.spec.ts` | Post-game share block visible in `GameOverOverlay`; share block also visible in `DailyRevealOverlay`; clipboard text exact-match against snapshot; copy-link-only path; `navigator.share` path with `page.exposeFunction` mock |
| `e2e/daily-deep-link.spec.ts` | `#daily/<date>` (no mode) lands on launcher with anchorDate; future date redirects + toast; rolled-off date redirects + toast |

### Ship gate

- Share block renders in both `GameOverOverlay` and `DailyRevealOverlay` for `session.kind === 'daily'`.
- `daily_shared` event flows in CF Analytics Engine.
- Copy-paste from clipboard produces exactly the spec's text (verified by e2e snapshot).
- New e2e specs land green on `chromium` (not just `chromium-gpu`) — this is why A is the prereq.

---

## C — Phase 5: Polish + launch

### Surface inventory for axe

| Surface | Specs |
|---|---|
| Launcher (idle, anchored) | `e2e/a11y/launcher.spec.ts` |
| Streak pill (active / broken / first) | `e2e/a11y/streak-pill.spec.ts` |
| History panel + calendar cells | `e2e/a11y/history.spec.ts` |
| Milestone overlay | `e2e/a11y/milestone.spec.ts` |
| Reveal overlay (1-mode, 2-mode) | `e2e/a11y/reveal.spec.ts` |
| Share block (in game-over, in reveal) | `e2e/a11y/share.spec.ts` |
| Game-over overlay (existing roadmap item) | `e2e/a11y/game-over.spec.ts` |

### Mechanics

`@axe-core/playwright` is **already installed** and `e2e/accessibility.spec.ts` runs axe successfully on home + country-panel today. The previously-dropped GameOverOverlay axe test was not flaky — it surfaced **real pre-existing color-contrast violations** (see `e2e/accessibility.spec.ts:127-132`). Phase 5's job is to fix those violations, not to re-stabilise the test infrastructure.

1. Extend `e2e/accessibility.spec.ts` (do not fork an `e2e/a11y/` folder) with one `test('axe-core audit passes on <surface>')` per row in the surface inventory above.
2. Each test follows the existing pattern: navigate, drive to surface state, `new AxeBuilder({ page }).exclude('.maplibregl-canvas').analyze()`, `expect(results.violations).toEqual([])`.
3. Iterate per surface: run, see violations, fix in CSS / aria attribute, re-run. Each surface is a sub-task in the eventual plan.
4. Manual NVDA (Windows) or VoiceOver (mac) pass on golden path:
   - Launcher → focus order, mode-card labels, streak-pill announcement
   - Daily play → attempt feedback, live-region updates
   - Game-over with share → share block buttons announce correctly
   - Reveal-from-history → cell click navigates and announces
   - Milestone fire → live-region announces
5. Manual keyboard-only pass: tab through every surface, Enter / Escape / arrows behave per Phase 3 spec.

### Anticipated fixes (working list — actuals discovered during axe runs)

- `GameOverOverlay`: subtitle / score / button copy contrast on warm-accent — known roadmap item, expected to be the heaviest fix.
- Calendar cells: low-contrast greys on cream, per-mode dot contrast.
- Focus-ring contrast across the launcher's warm-accent surfaces.
- Toast colour-only state communication (add icon or text marker).

If a single surface needs > 1 day of restyle, descope that surface to "fix critical, defer others to v1.1" inside Phase 5 — do not let a11y polish block launch indefinitely. Each descope is recorded in (a) the Phase 5 PR description with the violation severity and rationale, AND (b) a roadmap entry under "Retention v1.1+" with the specific axe rule ID and surface.

### Docs

**`docs/systems/daily-puzzle.md`** — new. Sections:
1. Lifecycle (content pipeline → fetch → play → store → streak → reveal → share)
2. Storage shape (link to types)
3. Routing matrix (all `#daily/...` shapes)
4. Telemetry events
5. Known limitations (timezone lag, no backend)
6. Operational notes (how to inspect a user's local state, rollback)

**`docs/purpose.md`** — add a paragraph under existing modes section:
> "A daily puzzle layer turns the same modes into a returnable habit. Each calendar day, every visitor sees the same country and the same city; results persist locally and feed a streak counter and a shareable text artifact. No backend required."

**`docs/roadmap.md`** — close out the retention-program section. Move surviving items into a "Retention v1.1+" subsection (already partially done after Phase 3; finalise here).

### Launch checklist

To be tracked in the Phase 5 PR description, ticked before merge-to-launch:

- [ ] ≥ 14 days analytics baseline from Phase 1 (Phase 1 shipped 2026-04-21 → satisfied 2026-05-05)
- [ ] CF Analytics Engine dashboards built and saved queries committed to `cloudflare-worker/queries/`:
  - `daily_opened` rate per day
  - `daily_started` → `daily_completed` funnel
  - `streak_reached_milestone` distribution by threshold
  - `history_opened` rate
  - `daily_shared` rate by method
- [ ] Rollback procedure documented in `docs/systems/daily-puzzle.md` ("Operational notes")
- [ ] 72 h post-launch monitor opened: spike check on `daily_started`, `daily_shared`; Sentry error-rate spike check
- [ ] Launch announcement (out of scope for this plan) — link from PR description when published

### Tests

- All `e2e/a11y/*.spec.ts` files green on both chromium projects.
- No new unit tests beyond Phase 4's share work.

### Ship gate

- Zero WCAG 2 AA axe violations across all surfaces, OR explicit per-surface descope documented in the PR.
- Manual NVDA / VoiceOver smoke clean.
- Manual keyboard-only smoke clean.
- Docs merged.
- Launch checklist items ticked.

---

## Sequencing + dependencies

```
A (deflake)  →  B (Phase 4)  →  C (Phase 5)  →  Launch
  2-5 days       ~1 week         ~2 weeks        72 h monitor
```

A is the largest scheduling uncertainty: 2 days if traces immediately reveal a clean root cause, 5 days if diagnosis is hard. The hard cap is "tactical fix at 3 days of diagnosis" — see A's "Honest uncertainty" subsection.

Each PR can be reverted by reverting its merge commit; no schema changes, no irreversible CF Worker changes.

A must land before B because:
- B adds new e2e specs to `chromium`. Without A, those join the flake parade.
- B's `daily-share.spec.ts` exercises clipboard mocking which is timing-sensitive.

B must land before C because:
- C's axe pass on the share block requires the share block to exist.
- C's `docs/systems/daily-puzzle.md` documents the share flow.

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Tile route mocks break a test that needs real tiles | Audit during prereq; add `useRealTiles` opt-out fixture; expect zero matches in current suite |
| Full WCAG 2 AA across 7 surfaces uncovers deep design rework | Per-surface descope rule (above); descopes documented in PR, deferred to v1.1 in roadmap |
| Custom domain `funworldmap.com` not yet configured | Share text uses `window.location.origin` — works on GH Pages or custom domain; verify before Phase 4 launch but not a blocker |
| Axe-core flags violations in 3rd-party MapLibre attribution / popups | Document allow-list in `e2e/fixtures/axe.ts`; do not paper over violations in our own components |
| Clipboard API permissions in CI | Playwright Chromium grants `clipboard-read` and `clipboard-write` per context; verify in `playwright.config.ts` `permissions` |
| 14-day baseline assumes Phase 1 analytics flowed without interruption | Cross-check CF dashboard during Phase 5 prep; if a gap exists, slip launch by the gap length |

---

## Telemetry summary (additions only)

| Event | Props | Where fired |
|---|---|---|
| `daily_shared` | `{ date, modesPlayed: 1 \| 2, method: 'share' \| 'clipboard' \| 'copy-link' }` | `DailyShareBlock` on share button click (any method) |

All other events already in place from Phases 1-3.

---

## Definition of done (v1)

- Three PRs merged: A, B, C.
- All checklist items in Phase 5 ticked.
- 72 h monitor passed: no error spike, no engagement regression vs Phase 3 baseline.
- Roadmap pruned: retention-program section closed out, v1.1+ items consolidated.

After this, the next planning cycle is Retention v1.1, planned just-in-time once 2-4 weeks of v1 analytics have accumulated. That is out of scope for this plan.
