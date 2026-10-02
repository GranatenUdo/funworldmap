# Graph-derived fixes — design

**Date:** 2026-08-08
**Author:** Tobias Ens (with Claude)
**Status:** Approved (owner: "proceed", 2026-08-08); revised same day after a
critical self-review that verified every numeric claim and settled both open
questions empirically
**Branch:** `calibrated-fittings-and-product-record` (owner ruling 2026-08-08: all
work lands here; the branch merges once the parallel session on it finishes)

## Context

A full-corpus `/graphify` run over the repo on 2026-08-08 (423 files — 264 code
via AST, 150 markdown/config and 9 screenshots via semantic extraction; 2318
nodes, 4210 edges, 216 communities; committed in `2b77f47`) produced a report
whose "surprising connections", "suggested questions" and health caveats were
triaged against HEAD. Most were extraction artifacts. Three were real, and they
share a theme the graph made visible and no human review had: **the app-shell
resilience surfaces — the React crash fallback and the map error overlay — were
skipped by the Observatory migration and have no gate protecting them.**

The graph surfaced this structurally: `MapErrorOverlay` forms community C144
(n=5) with no edge into C0, the design-system community. A component that shares
no vocabulary with the design system is a component outside it.

## Premises falsified by investigation (recorded so the trail is honest)

Four leads from the report were checked against HEAD and disproved. They are
listed so nobody re-opens them:

1. **"`Micro-glyph floor (10px)` → `WCAG AA commitment` is a docs/code drift" —
   false.** Exactly two 10px users exist: `SourceMarker.tsx:37` (`text-[10px]`)
   and `.compare-badge` (`index.css:474`, `font-size: 10px`) — precisely the two
   that DESIGN.md:177 names. The INFERRED edge was correct. Note for future
   audits: a `text-\[10px\]` grep alone misses the CSS-declared one.
2. **"`game-happy-paths.md` duplicates CLAUDE.md's timeout ban" — false.**
   `docs/testing/game-happy-paths.md:131` explicitly cross-references
   `CLAUDE.md`; line 132's restatement is deliberate and scoped to
   scenario-writing. Healthy, not drift.
3. **"WebGL context loss is unhandled" (the C84 vision-audit finding) — closed.**
   `webgl-lost` is a real `MapErrorReason` (`useMapInstance.ts:19`) with copy and
   a retry action in `MapErrorOverlay`; `useMapInstance` listens on both
   `map.on('webglcontextlost')` and the canvas, and pre-captures
   `WEBGL_lose_context` at init because `getExtension()` returns null once the
   context is lost. Covered by a unit test and `e2e/webgl-context-loss.spec.ts`.
   The graph's `F2 — WebGL context lost` ↔ `theme bootstrap script` AMBIGUOUS
   edge is a spurious "app-shell resilience" association — though the
   neighbourhood it pointed at turned out to be the right one (see Phase 3).
4. **The graph-health caveats are not repo defects.** 254 dangling-endpoint
   edges (5.6% of 4507 raw), 595 isolated nodes, and 5 of the 7 suggested
   questions (screenshot spatial-adjacency read as semantic relation) are all
   graphify-side extraction artifacts. Out of scope; see Non-Goals.

## The graph is atemporal — a standing caveat for anyone querying it

Worth recording once, because it shaped this triage and will shape the next one:
**the graph has no notion of time.** Its 34 AMBIGUOUS edges are dominated by
nodes extracted from `docs/testing/screenshots/2026-05-13/` — a dated
animation-verification capture batch. Findings recorded there surface as
present-tense graph nodes:

- `Arc Persisting Into Next Round (endpoint not at Baghdad)`
- `AMBIGUOUS: Visible Vertical and Horizontal Page Scrollbars`
- `No Distinct Player-Guess Marker Visible at Arc's Far End`

The first two were subsequently fixed — `clearRevealSources()`
(`src/game/hooks/useRevealMapEffects.ts:95`, called on round transition and
unmount) and `clampTooltipPosition()` (`src/lib/tooltipPosition.ts:21`, consumed
at `useMapInteractions.ts:153`) both exist at HEAD. The graph cannot know that.
**Date-check every graph finding against HEAD before acting on it.** This spec's
"Premises falsified" section is the output of doing exactly that.

## Goals

- Make the graph corpus reproducible.
- Remove the last raw-`slate` chrome from the app and fix the AA failures it hides.
- Leave behind a gate so the next component cannot regress the same way.

## Non-Goals

- Fixing graphify's extraction quality (dangling edges, isolated nodes,
  screenshot-adjacency edges). Upstream concern.
- Re-labelling the 66 auto-derived small-community names in `graph.json`.
- Touching `BasemapBanner`'s amber (E-foundations:546 ruled it a status
  encoding) or `ThemeToggle.tsx:24`'s amber sun glyph (iconographic; the button
  chrome around it is already fully migrated).
- Any change to the five coloured region tints or the A5 amber exception badges —
  DESIGN.md's Two-Accent Rule classifies both as data encodings.

---

## Phase 1 — Tooling gaps (no app change)

**Size:** XS.

`.prettierignore` gains `graphify-out/`. The file already carries this exact
pattern twice (`package-lock.json`, `docs/superpowers/`) with the same stated
rationale: the lint-staged `*.{json,md}` glob otherwise rewrites the whole
artifact on any commit that stages it. Confirmed CI-neutral either way — `lint`
is `eslint src/ e2e/ scripts/`, `format` is `prettier --write src/`, and no CI
job runs `prettier --check`. This is a pre-commit-hook churn fix only.

New root `.graphifyignore` (gitignore syntax; graphify merges `.gitignore` and
`.graphifyignore` per directory, `.graphifyignore` last, and can only ever
exclude more):

```
public/          # 252 flag SVGs + fonts: 252 isolated "flag of X" nodes, no edges
```

`public/` was excluded by hand-editing the detect JSON on the 2026-08-08 run,
which is not reproducible.

**A `graphify-out/` entry was specified here and has been removed —
the premise was false.** This spec originally called it "the more urgent one," on
the reasoning that a *tracked* `graphify-out/` is no longer excluded by the
`.gitignore` merge and so would be ingested as corpus. Pre-flight verification
disproved it: `graphify.detect()` resolves `root / GRAPHIFY_OUT` into
`configured_out_dir` and excludes it unconditionally, independent of every ignore
file (`graphify/detect.py:1290`). Measured at HEAD with the directory tracked and
no `.graphifyignore` present, `detect` reports `has graphify-out/: False`. The
entry would have been a no-op resting on a wrong claim.

**Verification:** staging a `graphify-out/` change and committing leaves the file
bytes unchanged; a `detect` run reports **425** files, down from 677, with zero
under `public/`. (677 is the count at the time of this task; the graph report's
"675" was the same measure two commits earlier, before this spec and its plan
existed. 425 = 677 − 252.) This also explains — without repairing —
`GRAPH_REPORT.md`'s Corpus Check line, which reads "675 files · ~1,350,194 words"
because that warning string is composed at detect time, before the manual filter
ran; it will read correctly on the next rebuild, which this spec does not
schedule.

## Phase 2 — Region tint consolidation

**Size:** S.

`REGION_COLORS` (`SearchBar.tsx:16`) and `REGION_BADGE`
(`SingleCountryPanel.tsx:56`) are the same six-region tint table, differing only
by a `/80` alpha on the light background. `docs/superpowers/plans/2026-07-28-e-foundations.md:547`
names both and rules them "data encodings, stay as-is" — correct for accent
migration, but nobody consolidated them. In the graph they sit in C60 and C13
with no edge between them, which is what a duplicated constant looks like.

New `src/lib/regionTints.ts`. Both variants are stored as **complete literal
class strings** — Tailwind 4 scans source text, so composing `bg-amber-100` with
`/80` at runtime would produce a class that never appears literally in source and
gets purged:

```ts
export const REGION_TINTS: Record<string, { solid: string; soft: string }> = {
  Africa: {
    solid: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    soft: 'bg-amber-100/80 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  // Americas (emerald), Asia (rose), Europe (blue), Oceania (teal),
  // Antarctic (slate) follow the same shape.
}
```

The duplication is **seven** strings, not six: both call sites also carry an
identical `|| 'bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100'`
fallback for unknown regions (`SearchBar.tsx:230-231`,
`SingleCountryPanel.tsx:321-322`). Export it from the module as
`REGION_TINT_FALLBACK` so the whole encoding lives in one file.

`SearchBar` consumes `.solid`, `SingleCountryPanel` consumes `.soft`; both local
tables are deleted. The `Antarctic` entry is the sole sanctioned raw-neutral
usage in `.ts`/`.tsx`, which is what makes Phase 4's exemption a single file.

Tailwind 4 scanning a `src/lib/*.ts` module is already proven in this codebase —
`src/components/exceptionBadge.ts` holds `text-[11px]` plus amber classes in a
plain `.ts` file and renders correctly, and `index.css` declares no `@source`
narrowing (`@import 'tailwindcss'` only, line 1).

**Verification:** zero visual change. Existing `SearchBar` and
`SingleCountryPanel` tests must pass **unmodified** — that is the phase's
correctness proof. `designTokens.test.ts:52` currently reads "The Oceania region
badge's …" (singular); update it to name the module.

## Phase 3 — Resilience-surface migration

**Size:** M. This is the phase with a real user-facing bug in it.

### The bug

`body` is space-dark in **both** themes (`index.css:105-107`, radial
`#16213b → #0a0f1f → #04060d`; The Space-Dark Rule). There is no global
`body { color }` and no `color-scheme` declaration anywhere, so unstyled text
falls back to the UA default black. The `main.tsx` Sentry `ErrorBoundary`
fallback renders directly on that backdrop with no surface of its own:

| Element | Current | On `#0a0f1f` | AA (4.5:1) |
| --- | --- | --- | --- |
| `<h1>` (**no colour class at all**) | `#000` | **1.10:1** | ✗ both themes |
| `<p>` light | `slate-600` `#475569` | **2.52:1** | ✗ |
| `<p>` dark | `slate-400` `#94a3b8` | 7.44:1 | ✓ |

The crash screen's headline is effectively invisible in every theme (1.31:1 even
at the gradient's brightest point, `#16213b`). axe cannot reach it — it renders
only after React has already thrown — which is why five a11y passes never caught
it.

Verified rather than assumed: Tailwind 4's `preflight.css` sets `color: inherit`
on descendants but declares no root `color` and no `color-scheme`, so the
inherited value bottoms out at the UA default. And the fallback really does
render without Sentry configured — `@sentry/react`'s `componentDidCatch` calls
`this.setState({ error, componentStack, eventId })` unconditionally, and
`render()` branches on `state.componentStack === null`, so a DSN-less dev or CI
build (`VITE_SENTRY_DSN: ''`) still shows this surface.

**Root cause, and why it is not fixed at the root.** The mechanism is
`color-scheme` never being declared while `body` is space-dark in both themes.
Declaring `color-scheme: dark` on `:root` would fix the headline and every future
unstyled string in one line — and is rejected: in light theme the app's
instrument surfaces (panels, search, dropdown) are sand-light, and a global dark
scheme would darken their scrollbars and form-control chrome. Per-surface
explicit colour is the correct scope. Recorded so the cheaper-looking fix is not
re-proposed.

`MapErrorOverlay` does **not** share this bug: it paints its own
`bg-white/90 dark:bg-slate-950/90` scrim, so its text is legible. Its problem is
that the scrim, card, and CTA are all raw `slate`, off the design system.

### Why it was missed

`docs/superpowers/plans/2026-07-28-e-foundations.md:546` lists
`MapErrorOverlay.tsx (slate)` under "Verified zero teal/coral occurrences, no
edit needed". That verdict is correct **on the teal/coral criterion** — the task
was scoped to accent retirement. No task has ever been scoped to "components
still on raw neutrals instead of the sand/dark ramps", and `designTokens.test.ts`
pins only `index.css` and `mapPalette.ts`, never components. The gap is
structural, not an oversight.

### Mapping

Per the owner-approved rule (E-foundations:553), plus DESIGN.md's Frosted Card
Rule, Shadow Vocabulary and Primary CTA recipe, which are normative for this
surface:

**`MapErrorOverlay.tsx`** (13 usages)

| Role | From | To |
| --- | --- | --- |
| Scrim | `bg-white/90 dark:bg-slate-950/90` | `bg-sand-50/90 dark:bg-dark-500/90` |
| Card surface | `bg-white dark:bg-slate-900` | `bg-sand-50 dark:bg-dark-400` (opaque, **no** blur) |
| Card border | `border-slate-200 dark:border-slate-800` | `border-sand-200/50 dark:border-dark-200/30` |
| Card shadow | `shadow-xl` | `shadow-2xl` (Overlay card) |
| Title | `text-slate-900 dark:text-slate-100` | `text-sand-900 dark:text-dark-50` |
| Body | `text-slate-600 dark:text-slate-400` | `text-sand-600 dark:text-dark-100` |
| CTA fill | `bg-slate-900 dark:bg-slate-100` | `bg-ice-accessible hover:bg-ice-dim` |
| CTA text | `text-white dark:text-slate-900` | `text-white` (no `dark:` split) |
| CTA radius | `rounded-lg` | `rounded-xl` |
| Focus | `focus:ring-2 ring-slate-500` | `focus-visible:ring-2 focus-visible:ring-ice-dim/50 dark:focus-visible:ring-ice/50` |

White on `ice-accessible` `#075985` is 7.56:1, on `ice-dim` `#0369a1` 5.93:1 —
both recomputed from the hexes for this spec and matching E-foundations:553's
table. The card keeps `rounded-2xl`, already correct for a floating card.

The title takes `sand-900`, not `sand-800`: house convention reserves `sand-900`
for headings (`CountryColumn.tsx:38`, `CompareCountryPanel.tsx:189`,
`LauncherModeCard.tsx:74`) and `sand-800` for readouts and data values
(`CompareFieldRow.tsx:73`, `SingleCountryPanel.tsx:48`).
DESIGN.md's Primary CTA recipe is "identical in both themes", which is why the
`dark:` split on the button is dropped rather than translated.

**The card deliberately does not take `backdrop-blur-xl`,** i.e. it does not
adopt the full Frosted Card Rule. Two reasons: the scrim one level up already
carries `backdrop-blur-sm`, so the frost is present without nesting two
backdrop-filters; and this surface's most important reason to exist is the
`webgl-lost` state — piling extra compositor work onto the one screen shown when
the graphics context has just died is the wrong trade. DESIGN.md already
sanctions this exact carve-out: "(Mobile sheets and the game-over card go opaque
— same hues, no blur.)"

**`main.tsx` ErrorBoundary fallback** (5 usages)

This surface has no card material and gets none — it is a full-page state, not a
floating card. Because the backdrop it sits on is space-dark in both themes, its
text uses the **dark-surface colours with no `dark:` split**, following DESIGN.md's
Accessible-Pair Rule ("dark surfaces carry the bare accents") and the existing
ambient-pill precedent ("dark in both themes"):

| Element | From | To | Ratio |
| --- | --- | --- | --- |
| `<h1>` | *(none)* | `text-dark-50` | 17.4:1 |
| `<p>` | `text-slate-600 dark:text-slate-400` | `text-dark-100` | 7.44:1 |
| Button | `bg-slate-900 … dark:bg-slate-100 dark:text-slate-900` | `bg-ice-accessible hover:bg-ice-dim text-white rounded-xl` | 7.56:1 / 5.93:1 |

**Honest accounting of what this changes.** The `dark` ramp's top two steps are
Tailwind's slate values under project names: `--color-dark-50: #f1f5f9` **is**
`slate-100`, and `--color-dark-100: #94a3b8` **is** `slate-400`. So
`dark:text-slate-400 → text-dark-100` is a token rename with zero pixel change in
dark theme. Exactly two real pixel changes ship here in the `main.tsx` fallback:
the `<h1>` gains a colour where it had none (1.10:1 → 17.4:1, both themes), and
the `<p>` in **light** theme moves off `slate-600` (2.52:1 → 7.44:1). Everything
else in this phase is token hygiene, and this spec does not claim otherwise.

One qualification, on the other surface: `MapErrorOverlay`'s own light-theme
body copy (the Body row in the mapping table above) is not pure hygiene either —
`text-slate-600` on `bg-white` (~7.4:1) moves to `text-sand-600` on `bg-sand-50`,
measured at **5.75:1** in a real browser. Still comfortably AA (4.5:1), but a
genuine contrast reduction rather than a rename, recorded here so a future
contrast audit is not surprised by it.

**Verification:** no e2e or unit test pins any colour on either surface —
confirmed by inspection: `a11y-contrast.spec.ts` covers only region-badge sizing,
meta colour, tabular figures and map-control touch targets;
`webgl-context-loss.spec.ts` asserts behaviour, not styling;
`useMapReady.test.tsx` reads the `data-map-error` attribute. So the phase adds
coverage rather than updating it.

That coverage needs one small refactor to be possible at all. The fallback is
today an inline JSX literal in `main.tsx`'s `fallback={…}` prop, and `main.tsx`
calls `createRoot(...).render(...)` at module scope — importing it from a test
would boot the app. Extract the fallback to
`src/components/AppCrashFallback.tsx` and have `main.tsx` import it. The
component is then renderable in isolation, and the new unit test asserts the
headline carries an **explicit** colour class — "no class at all" is the precise
shape of this bug, so that is the assertion worth pinning.

## Phase 4 — Neutrals drift alarm

**Size:** S.

New `src/lib/__tests__/chromeNeutrals.test.ts` — deliberately **not** an
extension of `src/components/__tests__/chromeAccent.test.tsx`. That file is a
render-based alarm (it mounts components and asserts computed classes); this is a
source-text pin, so it belongs beside `designTokens.test.ts` and
`layoutConstants.test.ts`, which is where this codebase keeps source-text pins.

```ts
const RAW_NEUTRALS = /-(slate|gray|zinc|neutral|stone)-\d{2,3}/
const EXEMPT = ['lib/regionTints.ts'] // Antarctic region tint (Phase 2)

const sources = import.meta.glob('../../**/*.{ts,tsx}', { query: '?raw', eager: true })
// keys are glob-relative ('../../components/MapErrorOverlay.tsx'); normalise to
// src-relative before matching EXEMPT, and report failures src-relative so the
// message names a path a reader can open.
```

Both open questions from this spec's first draft are now settled empirically, by
running a throwaway probe test at HEAD (2026-08-08) and deleting it:

- **Root-level coverage is fine.** `import.meta.glob('../../**/*.{ts,tsx}')`
  evaluated from `src/lib/__tests__/` returns modules for every `.ts`/`.tsx`
  file under `src/`, including `'../../App.tsx'` and `'../../main.tsx'` at
  depth zero. No second pattern needed. Keys are glob-relative strings; values
  are `{ default: string }`. Re-measured at HEAD post-batch (`git ls-files src`
  filtered to `.ts`/`.tsx`, since the count grows over time): **198** total, of
  which **83** are under `__tests__` and filtered out, leaving **115** actually
  scanned. (An earlier probe reported 194/60; the 60 was simply a
  mismeasurement.)
- **The regex does not false-positive on the one known comment.** Requiring a
  leading hyphen means `mapPalette.ts:61`'s `(tailwind slate-950)` does **not**
  match, while `bg-slate-900` and `dark:bg-slate-950/90` both do. Verified
  against five cases.

  Residual risk, accepted and documented in the test: a comment that spells a
  full class name — `// bg-slate-950 is retired` — would match. The failure is
  loud, self-explanatory, and fixed by rewording the comment. Stripping comments
  before scanning was considered and rejected as more machinery than the risk
  earns.

The failure message must list every offending `file:line` in src-relative form,
not merely assert falsy — a gate whose output does not name the file it is
unhappy about is a gate nobody can act on.

**No bundle-size impact.** `import.meta.glob` inlines all 194 sources into the
*test* module, not the app: the production entry graph is
`index.html → src/main.tsx`, from which no test file is reachable. The
`bundle:budget` CI gate is unaffected.

One deliberate deviation from house convention: `designTokens.test.ts` and
`layoutConstants.test.ts` use explicit per-file `?raw` imports. This gate uses
`import.meta.glob` because an explicit import list is precisely what failed here —
nobody would have thought to add `MapErrorOverlay.tsx` to it. Coverage of files
that do not exist yet is the entire point.

Excludes `**/__tests__/**` (test assertions legitimately contain the string
`slate` — this spec's own Phase 3 test will) and the gate file itself.

**Scope limit, deliberate:** the gate scans `.ts`/`.tsx` for Tailwind *classes*.
It does not cover `src/index.css`, which carries three raw slate-equivalent
literals on the tooltip and attribution chrome — `rgba(51, 65, 85, 0.35)`
(slate-700, line 313), `rgba(148, 163, 184, 0.7)` (slate-400, line 351), and
`#cbd5e1` (slate-300, line 441). These are sanctioned: DESIGN.md's Navigation
section states "Attribution pill and hover tooltip wear the same light/dark
chrome literals." Extending the gate to CSS would need an allowlist for all
three and would not have caught this spec's actual bug.

**Verification:** the test fails at HEAD naming exactly the four known
offenders — `MapErrorOverlay.tsx` ×5 lines, `main.tsx` ×2 lines,
`SearchBar.tsx` ×1 line (`:22`), `SingleCountryPanel.tsx` ×1 line (`:62`) —
nine lines in total, and passes once Phases 2 and 3 have landed.
Ordering below depends on this.

## Phase 5 — Single-letter identifiers

**Size:** XS.

`src/hooks/__tests__/useCountrySearch.test.ts:7`'s `const c = (...)` factory and
`src/components/CompareCountryPanel.tsx:177-180`'s `{ c: country, … }` object key
produced two phantom `indirect_call` edges — `validateJoinIntegrity()` and
`fetchRestCountries()` in `scripts/` "calling" a test-file helper — because the
AST extractor resolved bare `c(...)` call sites in `scripts/` against the only
`c` definition it knew.

Rename to `makeSearchCountry` and `country` respectively. Payoff is readability
first, two fewer false edges second.

---

## Ordering

1 → 2 → 3 → 4 → 5, one commit per phase, `npm run check` after each, one full
`npm run test:e2e` at the end.

Two ordering constraints are load-bearing:

- **2 before 4** — consolidating the region tints collapses Phase 4's exemption
  list from two files to one, and that one cannot rot.
- **3 before 4** — the gate fails at HEAD by design; landing it first would put
  the branch red.

Phase 1 is independent and goes first because it is free and prevents the next
graph run from being wrong.

## Risks / watch-outs

- **Concurrent session on this working tree — the one real blocker.**
  `git worktree list` reports exactly one checkout of
  `calibrated-fittings-and-product-record`: `E:/polworldmap` itself. The other
  Claude Code session on this branch therefore shares **this working directory**,
  not a separate worktree (the only other worktree,
  `.claude/worktrees/workstream-d`, is on `feat/2026-07-29-workstream-d`). Two
  agents editing `src/` in one tree will clobber each other, and `lint-staged`
  stashes on every commit — which can swallow the other session's uncommitted
  work. Phase 1 touches only new root dotfiles and is safe regardless; Phases 2–5
  touch `src/` and must not start until the sharing question is resolved.
- **DESIGN.md contradicts itself on hairline border opacity.** The Frosted Card
  Rule specifies `border sand-200/50 (dark: dark-200/20–30)`; the Shapes section
  specifies `sand-300/50 light, dark-200/30 dark`. Phase 3 uses the Frosted Card
  Rule's value, being the rule specific to this surface. Reconciling the two
  statements is **not** in this spec's scope; flagged for owner adjudication.
- **`import.meta.glob` in a unit test is new to this repo.** It resolves through
  Vite, which vitest runs on, so it works — but it is a pattern future
  contributors will copy. The rationale is documented in the test file itself,
  not only here.
- **Phase 3 changes a surface nobody can screenshot on demand.** The
  `ErrorBoundary` fallback renders only on a React throw. Verify it by
  temporarily throwing in a child during development, not by hunting for it.
- **The gate is a string scan, not a semantic one.** A component importing a
  slate class from elsewhere, or building it dynamically, slips through. That is
  acceptable — it catches the failure mode that actually occurred.
- **Phase 5 is the weakest phase in the batch** and is included because the owner
  scoped all five. Its payoff is readability; the two phantom edges it removes are
  2 of 254 dangling edges in a graph this spec otherwise treats as out of scope.
  It is the first thing to cut if the batch needs trimming.

## Out of scope

Everything in Non-Goals, plus: the `graphify-out/` artifacts themselves are not
regenerated by this work. The corpus-line correction described in Phase 1 lands
whenever the graph is next rebuilt; this spec does not schedule that rebuild.
