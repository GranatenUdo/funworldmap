# Assessment Remediation — Design

**Date:** 2026-04-19
**Status:** Draft — pending user review
**Predecessor:** critical review + meta-review of the repo conducted 2026-04-19 (conversation transcript; findings summarised in this document).

## Context

A critical review of the repository surfaced a small set of user-visible bugs (reveal text shows ISO codes instead of country names; mode-specific tutorial and game-over copy fired in the wrong mode; a "Link copied" toast fires on the failure path), a confirmed regression where exiting compare view while satellite is on leaves country borders stuck near-invisible, two architectural smells (a module-level HUD-registration singleton; a `window.__funworldmap_guess` path that doubles as production code and test seam), a handful of doc drifts (testing docs claim DEV-only map exposure, bundle budget predates Sentry and `cities.json`), and several smaller loose ends (touch-unfriendly tooltip, unused zoom clamp, no focus management on the game-over dialog, no blocking theme init so dark-mode users see a light-to-dark flash, no coverage of the city-skip button's click handler, and a stale pre-launch checklist in the README).

The `docs/superpowers/plans/archive/` directory also accumulated 13 completed plan files over the project's lifetime; the `docs/superpowers/README.md` convention says plans are forward-looking and completed work belongs elsewhere.

## Goals

1. Align `docs/superpowers/plans/` with its own convention by archiving completed plans.
2. Land every confirmed finding from the meta-review.
3. Update the living docs under `docs/systems/` and `docs/ops/` where code has drifted; delete stale copy in `README.md`.
4. Add the test coverage the 2026-04-18 spec promised but never produced (`compare-view-dimming.spec.ts`), plus a real click-path test for the city-skip button.

## Non-goals

- Cross-browser (Firefox/Safari) Playwright projects. Added to the roadmap as an explicit follow-up.
- Real fog / new visual features / sound / multiplayer / share-card.
- Renaming the `polworldmap` repo directory or rewriting historical specs.
- Changes to bundled data sources, the merge pipeline, or the update-data tool.
- Automated bundle-size budgets.

## Shape

Two PRs on one branch. PR 1 is docs, small fixes, and test coverage — low risk. PR 2 is the code restructure — medium risk, concentrated. PR 2 merges only after PR 1 is green on `main`.

| PR | Phase | Scope | Risk |
|---|---|---|---|
| 1 | 0 | Spec authoring, plans archive, new forward plan | Low |
| 1 | 1 | User-visible string + UX fixes | Low |
| 1 | 2 | Docs-drift reconciliation | Low |
| 1 | 3 | Dark-mode FOUC (inline script) | Low |
| 1 | 4 | `SourceTooltip` touch behaviour + small fixes | Low |
| 1 | 5 | Test-coverage subset (city-skip click, Fuse shape) | Low |
| 2 | 6 | `__funworldmap_guess` removal + HUD-registration unification | Medium |
| 2 | 7 | Satellite + compare border-opacity regression | Medium |
| 2 | 8 | `GameOverOverlay` inline focus management | Medium |

Each phase is one commit. `lint + tsc + test:unit + test:e2e + build` green between phases.

---

## PR 1 — low-risk remediation

### Phase 0 — Spec, archive, forward plan

**Intent:** Docs-first foundation for the rest of the work.

**Files:**
- New: `docs/superpowers/specs/2026-04-19-assessment-remediation-design.md` (this document).
- New: `docs/superpowers/plans/2026-04-19-assessment-remediation.md` (produced by the writing-plans skill after the spec is approved).
- Moved: 13 existing files in `docs/superpowers/plans/` → `docs/superpowers/plans/archive/` via `git mv`.
- Edited: `docs/superpowers/README.md` — add an "Archive" subsection documenting that `archive/` holds completed plans.
- Edited: `docs/roadmap.md` — the one `superpowers/plans/2026-04-16-fix-ci-bugs-and-perf.md` citation repointed into `archive/`.

**Verification:** `grep -rn "superpowers/plans/" docs/` returns only `archive/` paths or the new forward plan. `docs/superpowers/plans/` at top level contains `archive/` and the new plan only.

---

### Phase 1 — User-visible string + UX fixes

Seven small changes, one commit.

**1.1 Reveal text uses country names, not cca3 codes.**
Type changes (minimal — mirrors the city-mode `PointReveal` pattern of reading the target name from the round):
- `src/game/shared/types.ts` — extend the `country` kind of `GuessInput` with `name: string`. Extend `CountryReveal` with `clickedName: string | null`. The target name is read from `round.targetName`, not duplicated on the reveal.

Scoring + HUD:
- `src/game/modes/country-pinning/scoring.ts` — propagate `input.name` → `reveal.clickedName`.
- `src/game/modes/country-pinning/CountryPinningHud.tsx:18-19` — pass `round.targetName` (from `session.currentRound`) and `r.clickedName` into `MESSAGES.correct` / `MESSAGES.wrong`.

Call sites:
- `src/App.tsx` `onMapSelect` and the country-pinning `GuessByNameButton` handler both construct `GuessInput` — add `name: poolByCca3.get(cca3.toUpperCase())?.name.common ?? cca3`. The `__funworldmap_guess` alias, still present at this point, does the same. Phase 6 deletes it.

**1.2 `FirstSessionTutorial` mode-aware.**
- `src/game/shared/hud/FirstSessionTutorial.tsx` — accept `modeId: ModeId` prop. Branch the body copy:
  - Country pinning: *"Click the country that matches the flag and name above. Three wrong countries end the game. Ocean clicks don't count."*
  - City guessing: *"Click anywhere on the map — including ocean — to guess the city's location. Ten rounds per game."*
- Use per-mode sessionStorage keys: `funworldmap-game-tutorial-shown-${modeId}` so seeing one mode's tutorial doesn't suppress the other.
- `src/game/GameController.tsx:391` — pass `session.modeId` as the prop.

**1.3 `GameOverOverlay` mode-aware subtitle + conditional streak cell.**
- `src/game/shared/hud/GameOverOverlay.tsx:30` — subtitle derived from `session.maxRounds`:
  - `null` → *"Three wrong guesses."*
  - numeric `n` → *"${n} rounds complete."*
- Hide the *"Longest streak"* cell when `session.maxRounds !== null`. Matches the existing streak-hiding logic in `HudShell.tsx:35`.

**1.4 "Link copied" toast fires only on success.**
- `src/components/SingleCountryPanel.tsx:68-78` — move `window.dispatchEvent(new CustomEvent('funworldmap:toast', ...))` inside the `.then()` of `navigator.clipboard.writeText`. No toast on prompt-fallback, no toast on rejection.

**1.5 `data-game-mode` root attribute reflects the live mode.**
- `src/App.tsx:201` — `data-game-mode={gameActive ? session.modeId : undefined}`. `session` is already pulled from `useGameSessionContext()` at `:36`.

**1.6 Dependent-territory click toast.**
- `src/App.tsx` `onMapSelect`, game-active country-pinning branch — check `poolByCca3.has(cca3.toUpperCase())` (the 194-entry pool, not the full 249-entry `byCca3`). If the pool doesn't contain it, dispatch `funworldmap:toast` with *"That territory isn't in the country pool."* and do not submit a guess.

**1.7 Delete stale pre-launch checklist.**
- `README.md:65-77` — remove the "Pre-launch checklist" section entirely.

**Verification:** a new unit test under `src/game/modes/country-pinning/__tests__/scoring.test.ts` asserts `reveal.targetName` and `reveal.clickedName` are populated. Manual QA of each mode's tutorial, reveal text, and game-over overlay. Manual QA of the share-link toast on both success and prompt-fallback paths. All existing e2e green.

---

### Phase 2 — Docs-drift reconciliation

Docs-only commit, no TypeScript changes.

- **`docs/purpose.md:59`** — replace *"~195 sovereign states and territories"* with *"249 countries and territories (194 independent)"*. README's *"~249 countries"* line stays; archived specs retain their historical wording.
- **`docs/systems/testing.md:55-71`** — rewrite the "Exposing the Map Instance" section to describe the current unconditional `window.__funworldmap_map` exposure, and state the rationale (Playwright runs against the built bundle; a static no-backend site has no sensitive runtime state to leak).
- **`docs/systems/overview.md:118-135`** — add rows for `@sentry/react` (gzipped size measured against the built bundle during this phase) and `cities.json` (~25 KB gzipped, ~75 KB raw). Update the total; drop or re-baseline the "<700 KB" target against the measured build.
- **`docs/ops/runbook.md:27`** — replace the `OWNER_TBD` line with: *"Action: quarterly review is currently unowned. File an issue against the repo when a review is due and assign to a maintainer."* Keep the rest of the data-freshness section.
- **`public/sitemap.xml`** — delete the `<lastmod>` element. GitHub Pages sends `Last-Modified` headers automatically; a stale sitemap date is worse SEO than none.
- **`docs/roadmap.md`** — append the six out-of-scope items listed at the end of this spec so future contributors can find them as deferred work.

**Verification:** `grep -rnE "TBD|TODO|FIXME|XXX" docs/` matches only historical hits that are out of scope. `grep -rn funworldmap.example` repo-wide returns zero. `e2e/meta-and-static.spec.ts` passes.

---

### Phase 3 — Dark-mode FOUC

One file, one inline script.

- **`index.html`** — inline a `<script>` inside `<head>`, before the font preload:
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
- **`src/hooks/useTheme.ts`** — no functional change; the first effect still runs and is a no-op when the class is already set correctly.

**Verification:** manual reload in a dark-preference browser. The loading splash (`App.tsx:215-228`) paints with its `dark:bg-dark-500` background on the first frame. No automated assertion — SwiftShader rendering variance makes screenshot tests for this flaky.

---

### Phase 4 — `SourceTooltip` touch + small fixes

- **`src/components/SourceTooltip.tsx:34-38`** — compute `const supportsHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches` once per render. Attach `onMouseEnter` and `onMouseLeave` only when `supportsHover`. Keep `onClick`, `onFocus`, `onBlur` unconditional so keyboard users still get focus-driven open/close.
- **`src/lib/flyToCountry.ts:9`** — replace `Math.min(16, zoom)` with `Math.min(MAX_ZOOM, zoom)`; import `MAX_ZOOM` from `./mapStyles`.

**Verification:** manual tap on the 'i' icon under Chromium touch emulation (or a real phone) — tooltip opens on first tap and stays until tap-outside. Unit test for `zoomFromArea` clamp (Vatican City → `MAX_ZOOM`, not 16).

---

### Phase 5 — Test-coverage subset

Two targeted coverage additions. The compare-view-dimming e2e stays with Phase 7 (paired with the fix).

**5.1 City-skip button click test.**
- `e2e/game-city-guessing.spec.ts` — a new test that calls `page.getByTestId('city-skip').click()` (not `skipViaHook`), asserts the reveal shows *"Skipped"*, and asserts score stays 0. If the button's bounding box is unstable on CI, wait on `game-hud` stability first; do not fall back to the hook.

**5.2 `GuessByNameButton` passes the real country shape to Fuse.**
- `src/game/GameController.tsx` — accept a new prop `countries: CountryData[]` in addition to the minimal `pool: CountryLike[]`. Pass `countries` through only to `GuessByNameButton`.
- `src/App.tsx` — compute a filtered `CountryData[]` (`independent === true`) alongside the existing `pool`. Pass both to `GameController`.
- `src/game/shared/hud/GuessByNameButton.tsx:20` — accept `pool: CountryData[]`. Drop the `as unknown as CountryData[]` cast. Fuse now indexes `name.official`, `capital`, `region`, `subregion`, `cca2`, `cca3` — the game's guess-by-name works for capitals and codes, not just common names.

**Verification:** extend the existing guess-by-name e2e test so typing *"Paris"* into the country-pinning guess input returns France among the results.

**Dependency note:** Phase 6 restructures `GameController`'s props and the provider tree. The `countries: CountryData[]` prop added here must be preserved through that restructure — either by keeping it on `GameController` or by moving it to the `GameSessionProvider` alongside `pools` and `byCca3`. Decision at Phase 6 execution time.

---

## PR 2 — medium-risk refactor

### Phase 6 — `__funworldmap_guess` removal + HUD-registration unification

Two related cleanups, landed as **two separate commits** on PR 2's branch (6.1 first, then 6.2). They are independent — keeping them separate makes 6.2's provider reorder reviewable without the HUD rename noise, and leaves each individually revertable if a regression surfaces post-merge.

**6.1 Unify HUD registration with the city-guessing pattern.**
- Rename `src/game/modes/country-pinning/index.ts` → `index.tsx` (JSX incoming).
- Import `CountryPinningHud` directly in the factory. Set `HudComponent: CountryPinningHud` in the returned `GameMode`.
- Delete `registerCountryPinningHud` and the module-level `attachedHud` variable.
- Delete `registerCountryPinningHud(CountryPinningHud)` from `CountryPinningHud.tsx:53`.
- Delete the side-effect `import './game/modes/country-pinning/CountryPinningHud'` from `App.tsx:14`.
- Confirm no circular import at build time.

**6.2 Remove `window.__funworldmap_guess`; move submit into the provider.**

Provider structure — no new components; App itself reads data at the top and threads `pools` + `byCca3` into the provider as props:

```tsx
// src/App.tsx (top-level)
export default function App() {
  const { countries, byCca3, sources } = useCountryData()
  const { cities } = useCityData()
  const pool = useMemo(/* filter independent, map to CountryLike */, [countries])
  const poolByCca3 = useMemo(() => new Map(pool.map(c => [c.cca3, c])), [pool])
  const pools = useMemo(() => ({ countries: pool, cities }), [pool, cities])

  return (
    <MapProvider>
      <GameSessionProvider pools={pools} byCca3={poolByCca3}>
        <AppInner
          countries={countries}
          byCca3={byCca3}
          sources={sources}
          /* …other props… */
        />
      </GameSessionProvider>
    </MapProvider>
  )
}
```

- `src/game/shared/GameSessionProvider.tsx` — accept `pools: { countries: CountryLike[]; cities: CityLike[] }` and `byCca3: Map<string, CountryLike>` as props. Compute `mode = useMemo(() => { try { return getMode(session.modeId, pools) } catch { return null } }, [session.modeId, pools])` inside the provider. Add to `GameSessionApi`:
  ```ts
  submitGuessInput: (input: GuessInput) => void
  ```
  which computes `endsGame` (`session.maxRounds !== null ? roundIndex + 1 >= maxRounds : lives + livesDelta <= 0`) and dispatches `submitGuess`. This logic currently lives in `GameController.tsx:267-275` as `submitGuessWithInput`; it moves to the provider. Both App (country clicks) and GameController (skip button, city map-click, test hooks) read `submitGuessInput` from the same context — single source of truth.
- `src/game/GameController.tsx` — read `submitGuessInput` from `useGameSessionContext()`; delete the local `submitGuessWithInput` callback and the `__funworldmap_guess` block at `:343-357`. The `window.__funworldmap_game.submitGuess` test hook remains, delegating to the context's `submitGuessInput`.
- `src/App.tsx` `onMapSelect` — when `gameActive && session.modeId === 'country-pinning'`, check `poolByCca3` for the cca3, dispatch the dependent-territory toast on miss (from Phase 1.6), otherwise call `submitGuessInput({ kind: 'country', cca3, name, centroid })` directly. No `window` indirection.

**Verification:**
- `grep -rn "__funworldmap_guess" src/ e2e/` — zero hits.
- `grep -rn "attachedHud\|registerCountryPinningHud" src/` — zero hits.
- Every test in `e2e/game-country-pinning.spec.ts` passes unchanged — those tests use `__funworldmap_game.setRound` + the test-hook submit path, which is untouched.
- Manual smoke of the existing focus-return flow in `App.tsx:105-125`: open the country panel via search, close via Escape, confirm focus returns to the search input. The provider reorder shouldn't affect this effect, but it's the most likely thing to break silently.

**Risk:** highest-risk phase in the plan. The provider reorder touches the mount tree and the `mode` memoization.

---

### Phase 7 — Satellite + compare border-opacity regression

Test-first. The new spec fails red on current `main`; the fix makes it pass.

**7.1 New e2e: `e2e/compare-view-dimming.spec.ts`** (chromium-gpu project)
- Load `/` with satellite ON (default).
- Navigate to `#FRA,DEU` via `page.goto('/#FRA,DEU')`.
- Wait for the compare filter to apply (`data-selected-country` present; one frame settle).
- Read `getPaintProperty('country-borders', 'line-opacity')` via `__funworldmap_map` — expect `0.15`.
- Set `window.location.hash = '#FRA'` to clear compare.
- Read the paint again — expect `0.6` (satellite default).

Add the spec to `playwright.config.ts` `chromium-gpu` `testMatch`.

**7.2 Fix via a single shared helper.**
- **New export in `src/lib/mapLayers.ts`:**
  ```ts
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
- **`src/hooks/useSatelliteMode.ts:55-67`** — replace the inline paint block with a call to `applyBorderPaintForMode(map, { isDark: resolvedTheme === 'dark', satellite })`.
- **`src/hooks/useCompareViewDimming.ts`** — replace `else if (!satellite)` with `else { applyBorderPaintForMode(map, { isDark: resolvedTheme === 'dark', satellite }) }`. Exiting compare now restores the correct baseline regardless of satellite state.
- **`src/hooks/useMapTheme.ts`** — replace `applyDefaultBorderPaint(map, isDark)` with `applyBorderPaintForMode(map, { isDark, satellite })`. Requires `satellite: boolean` added to the hook's `Options` interface (currently `{ loaded, resolvedTheme }`); `WorldMap.tsx:65` passes it in alongside the existing props.

**Verification:** the new e2e goes red → green across this phase. No other e2e regresses. Document the new spec in `docs/systems/testing.md` Test Organization list.

---

### Phase 8 — `GameOverOverlay` inline focus management

- **`src/game/shared/hud/GameOverOverlay.tsx`** — add an effect on mount that captures `document.activeElement`, focuses `[data-testid="game-over-play-again"]`, and restores focus on unmount. Fallback: if the captured target is `document.body` or no longer in the DOM, focus the map container (`[role="application"]`) instead — keyboard users need to land somewhere interactive, not on `body`. No Tab trap; if a keyboard user Tabs past the last button, focus escapes to the HUD behind, which is acceptable.
- **`e2e/game-country-pinning.spec.ts`** — new test: trigger game-over via three wrong guesses through the test hook, assert `document.activeElement` matches `[data-testid="game-over-play-again"]`.
- **`e2e/accessibility.spec.ts`** — new test that runs axe-core against the game-over state of country-pinning; expect zero violations.

**Verification:** new focus e2e goes green; axe-core audit on the game-over state passes.

---

## Cross-cutting decisions (made inline, not negotiated)

1. **`CountryReveal` shape.** Add `targetName: string` and `clickedName: string | null`; propagate via `GuessInput` rather than lookup in the HUD. Keeps scoring pure; the App-level `byCca3.get(...)?.name.common` cost is acceptable.
2. **`FirstSessionTutorial` sessionStorage keys.** `funworldmap-game-tutorial-shown-${modeId}` — per-mode.
3. **Country-count wording.** `docs/purpose.md:59` becomes *"249 countries and territories (194 independent)"*. README stays. Archived specs untouched.
4. **Bundle-budget numbers.** Measured against the built bundle during Phase 2, not guessed upfront.

## Cross-phase quality gates

Before merging each phase's commit:
1. `npm run lint` — zero warnings.
2. `tsc -b` — zero errors.
3. `npm run test:unit` — all green.
4. `npm run test:e2e` — all green.
5. `npm run build` — succeeds with no new chunk-size warning beyond the existing MapLibre one.
6. Manual smoke: start each game mode; toggle satellite; toggle theme; enter and exit compare view; open one country panel.

## Branch strategy

Two branches, merged sequentially.

- **`chore/assessment-remediation-pr1`** — phases 0–5 as individual commits. PR 1 opens and lands on `main`.
- **`chore/assessment-remediation-pr2`** — branched off `main` after PR 1 merges. Phases 6–8 as individual commits. PR 2 opens and lands on `main`.

Keeping the two branches separate avoids mixing low-risk and medium-risk work in one review surface, and means a PR 2 regression can be reverted without affecting PR 1's already-merged state.

## Rollback

Each phase is one commit, individually revertable. Phase 6 carries the most blast radius; if it regresses something detected post-merge, revert that commit alone — the other phases touch independent files except for Phase 1.6 (dependent-territory toast) which depends on the `App.tsx` `onMapSelect` shape that Phase 6 restructures. If Phase 6 reverts, Phase 1.6 needs re-porting against the pre-restructure code.

## Out of scope (tracked on the roadmap, not built here)

Add four items to `docs/roadmap.md` (the existing satellite-toggle persistence entry is already listed; the focus-trap hook is speculative and not worth pre-listing until a second caller appears):
- Cross-browser Firefox/Safari e2e projects (`playwright.config.ts` gains `firefox` and `webkit` projects alongside `chromium` / `chromium-gpu`).
- Automated bundle-size budgets (`size-limit` or equivalent) in CI.
- Lazy Sentry via dynamic `import()` inside `initSentry` — current static import bundles Sentry regardless of DSN presence.
- Revisiting `fog` / atmospheric effects if real fog is ever wanted (MapLibre's `setSky` already covers atmosphere; `setFog` is a Mapbox-only API).

## Appendix: Findings → phases traceability

| Finding (from meta-review) | Phase |
|---|---|
| Reveal text shows cca3 instead of names | 1.1 |
| Tutorial text country-mode-specific but fires everywhere | 1.2 |
| Game-over subtitle country-mode-specific | 1.3 |
| `data-game-mode` root attribute hard-coded | 1.5 |
| Dependent-territory click is silent no-op | 1.6 |
| Stale README pre-launch checklist | 1.7 |
| Link-copied toast fires on failure | 1.4 |
| Docs drift: testing.md, overview.md bundle budget | 2 |
| Country count cited three ways | 2 |
| `OWNER_TBD` in runbook | 2 |
| Stale sitemap lastmod | 2 |
| Dark-mode FOUC | 3 |
| `SourceTooltip` hover-on-touch | 4 |
| `flyToCountry` zoom clamp vs `MAX_ZOOM` | 4 |
| No e2e for city-skip button click | 5.1 |
| `GuessByNameButton` Fuse shape cast | 5.2 |
| Module-level `attachedHud` singleton | 6.1 |
| `window.__funworldmap_guess` as production path | 6.2 |
| Exiting compare while satellite on leaves borders dim | 7 |
| `GameOverOverlay` claims `aria-modal` without focus management | 8 |
