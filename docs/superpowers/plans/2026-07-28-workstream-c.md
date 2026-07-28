# Workstream C — Compare Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the compare view actually compare: one shared field list ends row misalignment (C1), paired signal/ice bars + delta chips + derived density answer "which is bigger, by how much" at a glance (C2/C3), exception source markers ship their canonical definition (C4 — C lands before D2), the entry becomes a labeled pill with a one-time tip (C5), and mobile becomes a single scroll with sheet-aware camera framing (C6) — closing the mobile-framing gap B-core documented.

**Architecture:** A typed `COMPARE_FIELDS` definition array (Task 2) drives every render path; the pure row model (bars/deltas, Task 3) and the mobile list (Task 6) consume it unchanged. The exception-marker computation lives in a shared module (Task 4) that D2 later adopts for the single panel. Free riders open the plan (Task 1: `ICE_MID` rename before the bars consume it; hover-literal var()-ification). Tasks execute strictly 1 → 7; later tasks anchor on content when quoting files earlier tasks restructured (each carries an explicit collision rule).

**Tech Stack:** React 19, TypeScript, Tailwind 4 (ice/signal tokens from #133), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-26-ux-visual-program-design.md` — items C1–C6 plus inherited scope: the A8-descoped border-chip-per-column semantics (Task 2), C4's marker ownership, the E-ledger free riders. Task ↔ spec map: T1=free riders, T2=C1(+A8 chips), T3=C2+C3, T4=C4, T5=C5(desktop), T6=C6, T7=verification. Deferred by design: mobile labeled compare chip → D4; single-panel marker adoption → D2.

## Global Constraints

- Rows always align: every `COMPARE_FIELDS` row renders for both countries, em-dash for missing values; capital lives in the column-header caption (all capitals joined); UN/independence render as exception badges (shared module with SingleCountryPanel — canonical-owner rule).
- Bars/deltas: plain divs scaled to max(A,B), signal-A / ice-family-B matching the map fills, `.text-readout` numerals; identical categorical values collapse to "Both: …"; ≥3:1 non-text contrast for bars on panel surfaces in BOTH themes (math shown in the task).
- Chip semantics (A8 inheritance): border chips in column A replace A (select path), in column B replace B (compareSelect); Escape/Exit-compare remain the only exits.
- Markers (C4): superscript only where a field's source differs from the dominant source; keyboard-reachable, aria-labeled; computation exported for D2.
- e2e rules (CLAUDE.md): no `waitForTimeout`, no `force: true`, auto-retrying expects, seam-based map assertions; every invalidated pin (aria-labels the compare specs enter through, color/class pins) re-anchored in the SAME commit; `--project=chromium --workers=2`; kill stray dev servers; CI-covered vs local-only stated per task (mobile projects are local-only).
- Analytics: **no new telemetry**. Docs: `docs/systems/ui-layout.md` compare section updated in the tasks that stale it.
- Commits: conventional prefix, imperative, trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- After the batch: full `npx vitest run`, affected e2e (CI + local-only enumerated), live pass desktop+390px × both themes covering pill entry, bars/deltas, Both-collapse, markers, chip-replaces-A/B, mobile single-scroll + framing.

---

### Task 1: Free riders — rename `mapPalette.ICE_DIM` → `ICE_MID`; var()-ify the dark attribution hover literal

**Context (you have none other):** This repo just landed the E4 ice/signal color migration (`src/lib/mapPalette.ts` exports `ICE`/`ICE_DEEP`/`ICE_DIM`/`SIGNAL`). Two small items were deferred to this plan: (1) `mapPalette.ICE_DIM` (`#0284c7`, sky-600, map paint) collides by name with the *chrome* CSS token `--color-ice-dim` (`#0369a1`, sky-700) in `src/index.css` — a documented, intentional **value** divergence that keeps confusing readers because the **names** match. Rename the map-paint export to `ICE_MID` before the upcoming compare-bars task starts consuming it. (2) `src/index.css` line ~401 hardcodes `#bae6fd` in the `.dark` attribution hover rule; the `@theme` token `--color-ice-light` already equals `#bae6fd` — consume the token. Neither change alters any rendered value. **Analytics: this task ships no new telemetry.**

**Files:**

- `src/lib/mapPalette.ts` — rename export + doc block
- `src/lib/mapLayers.ts` — import, 2 usages, 3 comment mentions
- `src/hooks/useCompareViewHighlight.ts` — import, 4 usages, 2 comment mentions
- `src/hooks/__tests__/useCompareViewHighlight.test.tsx` — import + 1 usage
- `src/lib/__tests__/mapLayers.test.ts` — import, 2 usages, 1 test title
- `src/lib/__tests__/designTokens.test.ts` — 1 comment mention; NEW hover-token pin
- `e2e/compare-view-dimming.spec.ts` — local const, comment, test title, 2 usages
- `docs/systems/ui-layout.md` — one prose mention (same-task staleness rule)
- `src/index.css` — the `.dark` attribution hover rule + its contrast comment

**Interfaces (produced, canonical for later tasks):**

- `export const ICE_MID = '#0284c7'` from `src/lib/mapPalette.ts` (replaces `ICE_DIM`; the compare-bars task C2 imports `ICE_MID` and `SIGNAL` by these exact names). `ICE`, `ICE_DEEP`, `SIGNAL`, `SPOTLIGHT_DIM`, `REVEAL_CORRECT`, `REVEAL_WRONG` are unchanged.
- `src/index.css`: `.dark .maplibregl-map .maplibregl-ctrl-attrib a:hover` consumes `var(--color-ice-light)`.

**Do NOT touch:** `docs/superpowers/plans/2026-07-28-e-foundations.md` (it references `ICE_DIM` many times — it is a dated historical record, not living docs). Do NOT rename the CSS token `--color-ice-dim` or any `text-ice-dim`/`ring-ice-dim` Tailwind class — those are the *chrome* token, a different value, out of scope.

**Steps:**

- [ ] **Failing test first — flip the two unit-test files to the new name.** In `src/hooks/__tests__/useCompareViewHighlight.test.tsx` replace line 4:

  ```ts
  import { ICE, ICE_DEEP, ICE_DIM, SIGNAL } from '../../lib/mapPalette'
  ```

  with

  ```ts
  import { ICE, ICE_DEEP, ICE_MID, SIGNAL } from '../../lib/mapPalette'
  ```

  and the single usage (line 31) `expect(cmpFill?.[2]).toBe(ICE_DIM)` → `expect(cmpFill?.[2]).toBe(ICE_MID)`.

  In `src/lib/__tests__/mapLayers.test.ts` replace line 22:

  ```ts
  import { ICE_DEEP, ICE_DIM, SIGNAL, SPOTLIGHT_DIM } from '../mapPalette'
  ```

  with

  ```ts
  import { ICE_DEEP, ICE_MID, SIGNAL, SPOTLIGHT_DIM } from '../mapPalette'
  ```

  line 387 `['compare', addCompareLayers, ICE_DIM],` → `['compare', addCompareLayers, ICE_MID],`; line 407 `... 'A', SIGNAL, ICE_DIM])` → `... 'A', SIGNAL, ICE_MID])`; and the test title on line 401:

  ```ts
  it('compare markers colour A signal / B ice-dim over a dark halo (A matches the panel badge; see mapPalette ICE_DIM doc for the B mismatch note)', () => {
  ```

  →

  ```ts
  it('compare markers colour A signal / B ice-mid over a dark halo (A matches the panel badge; see mapPalette ICE_MID doc for the B mismatch note)', () => {
  ```

- [ ] Run `npx vitest run src/hooks/__tests__/useCompareViewHighlight.test.tsx src/lib/__tests__/mapLayers.test.ts` — **expect both files to FAIL** with a module error: `mapPalette` does not provide an export named `ICE_MID`.

- [ ] **Implement the rename in `src/lib/mapPalette.ts`.** Replace the export line (currently line 52):

  ```ts
  export const ICE_DIM = '#0284c7' // sky-600 — compare-B stack + B marker (ex TEAL_DIM role; map-paint-only, see doc above)
  ```

  with

  ```ts
  export const ICE_MID = '#0284c7' // sky-600 — compare-B stack + B marker (ex TEAL_DIM role; map-paint-only, see doc above)
  ```

  In the file-header doc comment, replace `(see the ICE_DIM note\n *  below)` mention on line 6 with `(see the ICE_MID note\n *  below)`, and replace the entire `ICE_DIM` paragraph (currently lines 21–36, beginning ` *  ICE_DIM (sky-600) — a mid-ice shade used ONLY for the compare-B highlight` and ending ` *  adjudicate at the plan level.`) with this — it PRESERVES every claim of the divergence documentation and adds the rename rationale:

  ```
   *  ICE_MID (sky-600) — a mid-ice shade used ONLY for the compare-B highlight
   *    stack (fill/border/glow/extrusion) and the on-map B marker text, in
   *    BOTH themes (compare intentionally ignores theme once it's pinned, same
   *    as SIGNAL for A). Renamed from ICE_DIM (2026-07, C-tranche prep): the
   *    old name collided with index.css's --color-ice-dim (#0369a1, sky-700),
   *    which is a DIFFERENT value — that token is a CHROME accent (icon
   *    strokes, borders, CTA-hover backgrounds needing WCAG text/non-text
   *    floors) with no relationship to the compare-B map paint. The panel's
   *    `.compare-badge-b` (index.css) renders plain --color-ice (#7dd3fc), NOT
   *    ICE_MID — a pre-existing mismatch from the E-foundations plan's chrome
   *    task (T2) that its preflight found and deliberately did not "fix" into
   *    index.css: forcing the badge to ICE_MID's hex would revert T2's
   *    accessibility fix (dark badge ink on ICE_MID is only ~3.1:1, sub-AA,
   *    vs ~11:1 on plain ICE) and would require touching the already-passing,
   *    out-of-scope e2e/a11y-contrast.spec.ts. Adjudicated at the plan level:
   *    the value divergence stays; this rename removes only the NAME collision.
  ```

- [ ] **Rename the two runtime consumers.** In `src/lib/mapLayers.ts`: line 9 import `import { ICE_DEEP, ICE_DIM, SIGNAL, SPOTLIGHT_DIM, REVEAL_WRONG } from './mapPalette'` → `ICE_MID`; line 247 `addHighlightStack(map, 'country-compare', ICE_DIM)` → `ICE_MID`; line 544 `'text-color': ['match', ['get', 'label'], 'A', SIGNAL, ICE_DIM],` → `ICE_MID`; and the three comment mentions — line 243–245 doc `/** Add the compare (ice-dim) highlight stack — a map-only mid-ice shade (E4; *  see mapPalette.ts's ICE_DIM doc ...` → `(ice-mid)` / `ICE_MID doc`; lines 519–520 `see mapPalette.ts's ICE_DIM doc for why *  .compare-badge-b consumes plain --color-ice, not ICE_DIM)` → `ICE_MID` (both); line 546 `// but ~7.3:1 against #0f172a; ICE_DIM is ~4.1:1 either way (E4).` → `ICE_MID`.

  In `src/hooks/useCompareViewHighlight.ts`: line 3 import → `import { ICE, ICE_DEEP, ICE_MID, SIGNAL } from '../lib/mapPalette'`; the four `setPaintProperty(...)` args on lines 32–35 `ICE_DIM` → `ICE_MID`; doc-comment line 13–14 `(A = signal,\n *  B = ice-dim; E4)` → `B = ice-mid; E4`; inline comment line 29 `// Pin A = signal badge colour, B = ice-dim, overriding whatever` → `B = ice-mid`.

  In `src/lib/__tests__/designTokens.test.ts` update the comment-only mention (line ~93) `// see mapPalette.ts's ICE_DIM doc for why that divergence is` → `ICE_MID`.

- [ ] Run `npx vitest run` (full unit suite — catches any consumer the greps below would also catch) — **expect all green**.

- [ ] **Re-anchor the e2e pin and the living docs in the same commit.** In `e2e/compare-view-dimming.spec.ts`: comment line 48 `// canonical hexes live in src/lib/mapPalette.ts (E4: A = SIGNAL, B = ICE_DIM).` → `B = ICE_MID`; line 50 `const ICE_DIM = '#0284c7'` → `const ICE_MID = '#0284c7'`; test title line 54 `'in compare mode: A (selected) is signal and B (compareWith) is ice-dim'` → `is ice-mid`; usages on lines 68 (`.toBe(ICE_DIM)`) and 100 (`expect(bColor).toBe(ICE_DIM)`) → `ICE_MID`. In `docs/systems/ui-layout.md` § Compare (line ~109) replace `(A = signal, B = ice-dim)` with `(A = signal, B = ice-mid)`.

- [ ] Verify zero stragglers: `grep -rn "ICE_DIM" src e2e docs/systems` — **expect no matches** (matches under `docs/superpowers/plans/` are expected and stay).

- [ ] Kill any background `npm run dev` (it lacks `VITE_TEST_HOOKS` and Playwright would reuse it — project memory), then run `npx playwright test e2e/compare-view-dimming.spec.ts --project=chromium --workers=2` — **expect green** (values unchanged; only identifiers/prose moved).

- [ ] Commit:

  ```
  git add src/lib/mapPalette.ts src/lib/mapLayers.ts src/hooks/useCompareViewHighlight.ts src/hooks/__tests__/useCompareViewHighlight.test.tsx src/lib/__tests__/mapLayers.test.ts src/lib/__tests__/designTokens.test.ts e2e/compare-view-dimming.spec.ts docs/systems/ui-layout.md && git commit -m "refactor(palette): rename mapPalette ICE_DIM to ICE_MID" -m "De-collides the map-paint export from the chrome --color-ice-dim token (different value, sky-600 vs sky-700) before the compare-bars task consumes it. Divergence documentation preserved under the new name. No rendered value changes." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

- [ ] **Failing test first — pin the dark attribution hover to the token.** In `src/lib/__tests__/designTokens.test.ts`, inside the `describe('E4 accent tokens (index.css @theme)', ...)` block, add after the `it('defines the ice ramp (sky-200/300/700)', ...)` test:

  ```ts
    it('dark attribution hover consumes the ice-light token, not a raw hex', () => {
      expect(css).toContain(`.dark .maplibregl-map .maplibregl-ctrl-attrib a:hover {
    color: var(--color-ice-light);
  }`)
    })
  ```

  (Template-literal content must match the file byte-for-byte: rule selector at column 0, `color:` indented two spaces — the `css` variable is CRLF-normalized source text. Note the two-space indent inside the template literal is part of the CSS, while the surrounding test code sits at its own indent — copy the existing `.text-readout` pin in this file as the formatting model.)

- [ ] Run `npx vitest run src/lib/__tests__/designTokens.test.ts` — **expect the new test to FAIL** (index.css still has the raw hex).

- [ ] **Implement in `src/index.css`.** Replace (currently lines 400–402):

  ```css
  .dark .maplibregl-map .maplibregl-ctrl-attrib a:hover {
    color: #bae6fd;
  }
  ```

  with

  ```css
  .dark .maplibregl-map .maplibregl-ctrl-attrib a:hover {
    color: var(--color-ice-light);
  }
  ```

  and update the contrast comment above (line 390) from `/* Ice on the dark pill (rgba(4,6,13,0.82)) = 12.15:1; hover #bae6fd = 15.26:1. */` to `/* Ice on the dark pill (rgba(4,6,13,0.82)) = 12.15:1; hover ice-light (#bae6fd) = 15.26:1. */`. No new color pairing is introduced — `--color-ice-light` is defined as `#bae6fd` in `@theme` (pinned by this same test file), so the existing 15.26:1 math stands.

- [ ] Run `npx vitest run src/lib/__tests__/designTokens.test.ts` — **expect green**.

- [ ] Commit:

  ```
  git add src/index.css src/lib/__tests__/designTokens.test.ts && git commit -m "refactor(css): dark attribution hover consumes var(--color-ice-light)" -m "Replaces the last raw #bae6fd literal outside the @theme token definition; identical rendered value (15.26:1 on the dark pill). Pinned by the designTokens drift alarm." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 2: C1 — one shared field-definition list drives both compare columns; column-scoped border chips

**Context (you have none other):** The compare panel (`src/components/CompareCountryPanel.tsx` → two `src/components/CountryColumn.tsx`) conditionally renders fields per column, so rows misalign when one country lacks a value; it silently drops Timezones, shows only the first capital in the header caption, and still renders a near-constant "UN Member: Yes" row. Border chips inside a column currently route to the app's generic `select()`, which tears down the whole comparison. This task: (a) a single `COMPARE_FIELDS` definition array renders every row for both countries with an em-dash placeholder; (b) Timezones returns as a row; (c) the column-header caption joins ALL capitals; (d) UN-membership/independence render as the A5-style amber exception badges in the column headers (the badge definition is extracted from `SingleCountryPanel.tsx` into a shared module — canonical owner, no duplication); (e) chips are column-scoped: a chip in column A replaces A (keeping B), a chip in column B replaces B (keeping A), a chip naming the other column's country is a no-op. Escape/Exit-compare/× stay the only exits (A8). **Analytics: this task ships no new telemetry.** No new color pairings are introduced (the exception badges reuse the single panel's already-shipped amber classes; the em-dash renders in the existing value text color), so no new WCAG math is needed.

**Intra-plan collision note:** Task 1 edits the same `docs/systems/ui-layout.md` § Compare paragraph (`B = ice-dim` → `B = ice-mid`). This task's docs edit anchors on the sentence `two \`CountryColumn\`s side by side.`, which Task 1 does not touch, so the edits are order-independent.

**Files:**

- NEW `src/lib/compareFields.ts` — `COMPARE_FIELDS`, `CompareFieldDef`, `EM_DASH`, `formatPopulation`, `formatArea`
- NEW `src/components/exceptionBadge.ts` — `EXCEPTION_BADGE`, `activeExceptionBadges`
- `src/components/CountryColumn.tsx` — rewritten to consume `COMPARE_FIELDS` + header changes + column testids
- `src/components/SingleCountryPanel.tsx` — local `EXCEPTION_BADGE` const, `formatPopulation`/`formatArea` moved to the shared modules (remove-obsolete rule)
- `src/components/CompareCountryPanel.tsx` — `onSelect` prop replaced by `onCompareColumnSelect`
- `src/components/CountryPanel.tsx` — threads the new prop
- `src/App.tsx` — `onCompareColumnSelect` handler; stale A8 comment updated
- `src/hooks/useSelectedCountry.ts` — new `compareReplaceA`
- `src/lib/compareMapClick.ts` — new pure `compareChipClick` + `CompareColumn` type; module doc updated
- Tests: `src/components/__tests__/CountryColumn.test.tsx`, `src/components/__tests__/CompareCountryPanel.test.tsx`, `src/lib/__tests__/compareMapClick.test.ts`, `src/hooks/__tests__/useSelectedCountry.test.ts`
- `e2e/compare-map-clicks.spec.ts` — column-scoped chip cases
- `docs/systems/ui-layout.md` — § Compare updated (same-task staleness rule)

**Interfaces (produced — later tasks import these exact names):**

```ts
// src/lib/compareFields.ts
export const EM_DASH: string // '—'
export interface CompareFieldDef {
  key: string          // CountryData field name the row derives from
  label: string
  numeric: boolean     // candidate for C2's paired horizontal bars
  format: (country: CountryData) => string | null // null → column renders EM_DASH
}
export const COMPARE_FIELDS: readonly CompareFieldDef[] // Population, Area, Region, Government, Languages, Currencies, Timezones
export function formatPopulation(n: number): string
export function formatArea(n: number): string

// src/components/exceptionBadge.ts
export const EXCEPTION_BADGE: string // the A5 amber badge className
export interface ExceptionBadgeSpec { field: 'unMember' | 'independent'; testId: string; label: string }
export function activeExceptionBadges(country: CountryData): ExceptionBadgeSpec[]

// src/lib/compareMapClick.ts (additions)
export type CompareColumn = 'a' | 'b'
export type CompareChipClickAction =
  | { kind: 'replace-a'; cca3: string }
  | { kind: 'replace-b'; cca3: string }
  | { kind: 'noop' }
export function compareChipClick(column: CompareColumn, clickedCca3: string, selectedCca3: string, compareWithCca3: string): CompareChipClickAction

// src/hooks/useSelectedCountry.ts (addition to the returned object)
compareReplaceA: (cca3: string) => void

// src/components/CompareCountryPanel.tsx — Props change
onCompareColumnSelect: (column: CompareColumn, cca3: string) => void // REPLACES onSelect

// DOM anchors
data-testid="compare-column-a" / "compare-column-b" // CountryColumn root div
```

**Steps — commit 1 (shared field list + header badges):**

- [ ] **Failing tests first.** In `src/components/__tests__/CountryColumn.test.tsx`, add to the imports `import { COMPARE_FIELDS } from '../../lib/compareFields'` and append:

  ```tsx
  function renderColumn(country: ReturnType<typeof makeCountry>) {
    render(
      <CountryColumn
        country={country}
        byCca3={new Map()}
        onSelect={vi.fn()}
        badgeLetter="A"
        badgeColor="a"
      />,
    )
  }

  describe('CountryColumn — C1 shared field list', () => {
    it('renders every COMPARE_FIELDS row, with em-dash placeholders for missing values', () => {
      renderColumn(makeCountry({ governmentType: '', languages: {}, currencies: {}, timezones: [] }))
      for (const f of COMPARE_FIELDS) expect(screen.getByText(f.label)).toBeTruthy()
      // Government, Languages, Currencies, Timezones are missing on this fixture.
      expect(screen.getAllByText('—')).toHaveLength(4)
    })

    it('restores Timezones as a real row and drops the UN Member row', () => {
      renderColumn(makeCountry())
      expect(screen.getByText('Timezones')).toBeTruthy()
      expect(screen.getByText('UTC+01:00')).toBeTruthy()
      expect(screen.queryByText('UN Member')).toBeNull()
    })

    it('joins ALL capitals in the header caption', () => {
      renderColumn(makeCountry({ capital: ['Pretoria', 'Bloemfontein', 'Cape Town'] }))
      expect(screen.getByText('Pretoria, Bloemfontein, Cape Town')).toBeTruthy()
    })

    it('renders A5 exception badges in the header only when the flags are false', () => {
      renderColumn(makeCountry({ unMember: false, independent: false }))
      expect(screen.getByTestId('exception-badge-un-member').textContent).toBe('UN observer state')
      expect(screen.getByTestId('exception-badge-independent').textContent).toBe('Not independent')
    })

    it('renders no exception badges for a default (UN member, independent) country', () => {
      renderColumn(makeCountry())
      expect(screen.queryByTestId('exception-badge-un-member')).toBeNull()
      expect(screen.queryByTestId('exception-badge-independent')).toBeNull()
    })
  })
  ```

- [ ] Run `npx vitest run src/components/__tests__/CountryColumn.test.tsx` — **expect FAIL** (cannot resolve `../../lib/compareFields`).

- [ ] **Create `src/lib/compareFields.ts`** (new file, full content):

  ```ts
  import type { CountryData } from './types'

  /** Shared placeholder for missing values (C1) — both compare columns render
   *  it, so every row exists in both columns and rows always align. */
  export const EM_DASH = '—'

  /** Canonical numeric formatters — shared by the single panel's DataCells
   *  and the compare columns (single owner; SingleCountryPanel's private
   *  copies were absorbed here by C1). */
  export function formatPopulation(n: number): string {
    return n.toLocaleString('en-US')
  }

  export function formatArea(n: number): string {
    return `${n.toLocaleString('en-US')} km²`
  }

  export interface CompareFieldDef {
    /** Stable identity — the CountryData field name the row derives from. */
    key: string
    label: string
    /** Marks the row as a candidate for C2's paired horizontal bars. */
    numeric: boolean
    /** Formatted display value; null → the column renders EM_DASH. */
    format: (country: CountryData) => string | null
  }

  /** C1 — the single field-definition list driving BOTH compare columns.
   *  Every row renders for every country (no conditional rows), so column A's
   *  rows always line up with column B's. Deliberately absent, mirroring the
   *  single panel's A4/A5 header treatment: Capital (the column-header
   *  caption joins ALL capitals) and UN member / independence (header
   *  exception badges — see components/exceptionBadge.ts). Timezones is
   *  restored as a real row (the old columns silently dropped it); it renders
   *  as a joined string, NOT the single panel's TimezoneList "+N more"
   *  toggle — a per-column toggle would break row alignment. */
  export const COMPARE_FIELDS: readonly CompareFieldDef[] = [
    {
      key: 'population',
      label: 'Population',
      numeric: true,
      format: (c) => formatPopulation(c.population),
    },
    {
      key: 'area',
      label: 'Area',
      numeric: true,
      format: (c) => formatArea(c.area),
    },
    {
      key: 'region',
      label: 'Region',
      numeric: false,
      format: (c) => (c.subregion ? `${c.region} / ${c.subregion}` : c.region),
    },
    {
      key: 'governmentType',
      label: 'Government',
      numeric: false,
      format: (c) => c.governmentType || null,
    },
    {
      key: 'languages',
      label: 'Languages',
      numeric: false,
      format: (c) =>
        Object.keys(c.languages).length > 0 ? Object.values(c.languages).join(', ') : null,
    },
    {
      key: 'currencies',
      label: 'Currencies',
      numeric: false,
      format: (c) =>
        Object.keys(c.currencies).length > 0
          ? Object.values(c.currencies)
              .map((cur) => `${cur.name} (${cur.symbol})`)
              .join(', ')
          : null,
    },
    {
      key: 'timezones',
      label: 'Timezones',
      numeric: false,
      format: (c) => (c.timezones.length > 0 ? c.timezones.join(', ') : null),
    },
  ]
  ```

- [ ] **Create `src/components/exceptionBadge.ts`** (new file, full content — the doc comment preserves the A5 rationale currently living on SingleCountryPanel's local const):

  ```ts
  import type { CountryData } from '../lib/types'

  /** A5: near-constant booleans render as exceptions only. Muted amber is a
   *  data encoding (like the region badge), not a chrome accent — kept
   *  through E4. inline-flex + items-center (not inline-block): the single
   *  panel's badges carry a SourceTooltip affordance and need to align it
   *  with the label text; the compare column headers render the badge bare
   *  (C4 keeps compare attribution consolidated in the footer — no per-field
   *  "i" rings). Canonical owner: extracted from SingleCountryPanel for C1 so
   *  both panels share one definition. */
  export const EXCEPTION_BADGE =
    'inline-flex items-center whitespace-nowrap text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100/80 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'

  export interface ExceptionBadgeSpec {
    /** CountryData boolean driving the badge — the flags diverge in the
     *  source data (Vatican is independent: true), so each drives its own. */
    field: 'unMember' | 'independent'
    testId: string
    label: string
  }

  /** The exception badges a country actually earns (empty for 193 of 195). */
  export function activeExceptionBadges(country: CountryData): ExceptionBadgeSpec[] {
    const badges: ExceptionBadgeSpec[] = []
    if (country.unMember === false)
      badges.push({
        field: 'unMember',
        testId: 'exception-badge-un-member',
        label: 'UN observer state',
      })
    if (country.independent === false)
      badges.push({
        field: 'independent',
        testId: 'exception-badge-independent',
        label: 'Not independent',
      })
    return badges
  }
  ```

- [ ] **Rewrite `src/components/CountryColumn.tsx`** (full replacement — the current file conditionally renders Government/Languages/Currencies, has a `UN Member` `CompareField`, shows only `country.capital[0]`, and has no root testid; `CompareField` itself, the badge/flag/name header markup, and the Borders block are kept verbatim):

  ```tsx
  import type { CountryData } from '../lib/types'
  import { BorderChip } from './BorderChip'
  import { COMPARE_FIELDS, EM_DASH } from '../lib/compareFields'
  import { EXCEPTION_BADGE, activeExceptionBadges } from './exceptionBadge'

  function CompareField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice">
          {label}
        </div>
        <div className="text-readout text-sm text-sand-800 dark:text-dark-50">{children}</div>
      </div>
    )
  }

  interface Props {
    country: CountryData
    byCca3: Map<string, CountryData>
    onSelect: (cca3: string) => void
    badgeLetter: 'A' | 'B'
    badgeColor: 'a' | 'b'
  }

  export function CountryColumn({ country, byCca3, onSelect, badgeLetter, badgeColor }: Props) {
    return (
      <div
        className="flex flex-col h-full overflow-y-auto"
        data-testid={`compare-column-${badgeColor}`}
      >
        <div className="sticky top-0 bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-md px-5 py-4 z-10">
          <div className="flex items-start justify-between gap-3">
            <div
              className="flex items-start gap-3 min-w-0"
              style={{ animation: 'fade-up 200ms ease-out' }}
            >
              <span className={`compare-badge compare-badge-${badgeColor} mt-1`}>{badgeLetter}</span>
              <img
                data-testid="country-flag"
                src={country.flag}
                alt={country.flagAlt || `Flag of ${country.name.common}`}
                className="w-[56px] h-[38px] object-cover rounded-lg shadow-md shrink-0"
              />
              <div className="min-w-0 pt-0.5">
                <h2 className="text-lg font-bold text-sand-900 dark:text-dark-50 truncate tracking-tight leading-tight">
                  {country.name.common}
                </h2>
                {country.capital.length > 0 && (
                  <p className="text-xs text-ice-accessible dark:text-ice truncate mt-0.5">
                    {country.capital.join(', ')}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span
                    data-testid="region-badge"
                    className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100"
                  >
                    {country.region}
                  </span>
                  {/* C4: compare attribution stays consolidated in the footer,
                      so the badges render bare — no per-badge SourceTooltip. */}
                  {activeExceptionBadges(country).map((b) => (
                    <span key={b.field} data-testid={b.testId} className={EXCEPTION_BADGE}>
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 space-y-2">
          {COMPARE_FIELDS.map((f) => (
            <CompareField key={f.key} label={f.label}>
              {f.format(country) ?? EM_DASH}
            </CompareField>
          ))}
          {country.borders.length > 0 && (
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice mb-1.5">
                Borders
              </div>
              <div className="flex flex-wrap gap-1">
                {country.borders.map((code) => (
                  <BorderChip
                    key={code}
                    code={code}
                    neighbor={byCca3.get(code)}
                    onSelect={onSelect}
                    size="compare"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
  ```

- [ ] **De-duplicate `src/components/SingleCountryPanel.tsx`** (three edits; DOM output is unchanged so its existing tests stay green). (1) After the line `import { dispatchToast } from '../lib/toast'` add:

  ```ts
  import { formatPopulation, formatArea } from '../lib/compareFields'
  import { EXCEPTION_BADGE, activeExceptionBadges } from './exceptionBadge'
  ```

  (2) Delete the now-shadowing local helpers and const — remove exactly:

  ```ts
  function formatPopulation(n: number): string {
    return n.toLocaleString('en-US')
  }

  function formatArea(n: number): string {
    return `${n.toLocaleString('en-US')} km²`
  }
  ```

  and (keeping `REGION_BADGE` above it):

  ```ts
  // A5: near-constant booleans render as exceptions only. Muted amber is a data
  // encoding (like the region badge), not a chrome accent — kept through E4.
  // inline-flex + items-center (not inline-block): each badge carries a
  // SourceTooltip affordance and needs to align it with the label text.
  const EXCEPTION_BADGE =
    'inline-flex items-center whitespace-nowrap text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100/80 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
  ```

  (3) Replace the two hand-written badge blocks (from `{country.unMember === false && (` through the closing `)}` of the `independent` block, currently right after the region-badge `</span>`):

  ```tsx
            {country.unMember === false && (
              <span data-testid="exception-badge-un-member" className={EXCEPTION_BADGE}>
                UN observer state
                {/* Field-level attribution is a constitution item (never silently
                    regress) — mirrors the capital caption's SourceTooltip (A4). */}
                <SourceTooltip
                  field="unMember"
                  fieldSources={country._fieldSources}
                  sources={sources}
                />
              </span>
            )}
            {country.independent === false && (
              <span data-testid="exception-badge-independent" className={EXCEPTION_BADGE}>
                Not independent
                <SourceTooltip
                  field="independent"
                  fieldSources={country._fieldSources}
                  sources={sources}
                />
              </span>
            )}
  ```

  with:

  ```tsx
            {activeExceptionBadges(country).map((b) => (
              <span key={b.field} data-testid={b.testId} className={EXCEPTION_BADGE}>
                {b.label}
                {/* Field-level attribution is a constitution item (never silently
                    regress) — mirrors the capital caption's SourceTooltip (A4). */}
                <SourceTooltip
                  field={b.field}
                  fieldSources={country._fieldSources}
                  sources={sources}
                />
              </span>
            ))}
  ```

- [ ] Run `npx vitest run src/components/__tests__/CountryColumn.test.tsx src/components/__tests__/CompareCountryPanel.test.tsx src/components/__tests__/SingleCountryPanel.test.tsx src/components/__tests__/SingleCountryPanel.focus.test.tsx src/components/__tests__/chromeAccent.test.tsx` — **expect all green** (the chromeAccent spec's `getByText('67,000,000')`/`.text-readout` pins and every SingleCountryPanel badge pin survive because output is byte-identical).

- [ ] **Update `docs/systems/ui-layout.md` § Compare in the same commit.** After the sentence ending `` two `CountryColumn`s side by side. `` insert:

  ```
  Both columns render from the single `COMPARE_FIELDS` definition list (`src/lib/compareFields.ts`) — every row renders for both countries, with an em-dash placeholder when a value is missing, so rows always align. Capital(s) live in each column-header caption (all capitals joined); UN membership / independence render as the shared exception badges (`src/components/exceptionBadge.ts`) in the column headers rather than as near-constant boolean rows.
  ```

- [ ] Verify no stale pins on the removed row: `grep -rn "UN Member" src e2e` — **expect** only `src/components/__tests__/SingleCountryPanel.test.tsx` (its "cells are gone" assertions) and the new `CountryColumn.test.tsx` `queryByText('UN Member')` — no e2e hits.

- [ ] Commit:

  ```
  git add src/lib/compareFields.ts src/components/exceptionBadge.ts src/components/CountryColumn.tsx src/components/SingleCountryPanel.tsx src/components/__tests__/CountryColumn.test.tsx docs/systems/ui-layout.md && git commit -m "feat(compare): shared COMPARE_FIELDS list drives both columns (C1)" -m "Every row renders for both countries with an em-dash placeholder; Timezones restored; header caption joins all capitals; UN-membership/independence render as the A5 exception badges (extracted to a shared module, SingleCountryPanel's copy removed). No new telemetry." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

**Steps — commit 2 (column-scoped border chips):**

- [ ] **Failing unit tests first.** Append to `src/lib/__tests__/compareMapClick.test.ts` (and extend its import line to `import { compareMapClick, compareChipClick } from '../compareMapClick'`):

  ```ts
  describe('compareChipClick (C1 border-chip semantics inside the compare panel)', () => {
    it('a chip in column A replaces A, keeping B', () => {
      expect(compareChipClick('a', 'ESP', 'FRA', 'DEU')).toEqual({ kind: 'replace-a', cca3: 'ESP' })
    })

    it('a chip in column B replaces B, keeping A', () => {
      expect(compareChipClick('b', 'POL', 'FRA', 'DEU')).toEqual({ kind: 'replace-b', cca3: 'POL' })
    })

    it("is a no-op when the chip names the OTHER column's country (no X-vs-X pair)", () => {
      expect(compareChipClick('a', 'DEU', 'FRA', 'DEU')).toEqual({ kind: 'noop' })
      expect(compareChipClick('b', 'FRA', 'FRA', 'DEU')).toEqual({ kind: 'noop' })
    })

    it('uppercases the incoming code', () => {
      expect(compareChipClick('b', 'pol', 'FRA', 'DEU')).toEqual({ kind: 'replace-b', cca3: 'POL' })
    })
  })
  ```

  In `src/hooks/__tests__/useSelectedCountry.test.ts` add a third fixture after `DEU` and register it in `makeByCca3()` (`m.set('ESP', ESP)`):

  ```ts
  const ESP = makeCountryData({
    cca3: 'ESP',
    ccn3: '724',
    cca2: 'ES',
    name: { common: 'Spain', official: 'Kingdom of Spain' },
  })
  ```

  and append inside the `describe('useSelectedCountry', ...)` block:

  ```ts
    it('compareReplaceA() replaces the selected country and keeps the compare partner', async () => {
      window.location.hash = '#FRA,DEU'
      const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
      act(() => {
        result.current.compareReplaceA('esp')
      })
      expect(window.location.hash).toBe('#ESP,DEU')
      await waitFor(() => {
        expect(result.current.selected).toBe(ESP)
        expect(result.current.compareWith).toBe(DEU)
      })
    })

    it('compareReplaceA() is a no-op without an active compare pair', () => {
      window.location.hash = '#FRA'
      const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
      act(() => {
        result.current.compareReplaceA('ESP')
      })
      expect(window.location.hash).toBe('#FRA')
    })
  ```

- [ ] Run `npx vitest run src/lib/__tests__/compareMapClick.test.ts src/hooks/__tests__/useSelectedCountry.test.ts` — **expect FAIL** (no `compareChipClick` export; `compareReplaceA` is not a function).

- [ ] **Implement `src/lib/compareMapClick.ts`.** Replace the module doc's stale scoping sentence — current header (lines 1–5):

  ```ts
  /** A8 (2026-07-26 UX spec): MAP-click semantics while a compare pair is
   *  active. A third country replaces B; clicking A or the current B is a
   *  no-op — Escape and the compare header's Exit compare / × are the only
   *  exits. Scoped to map clicks: search and border chips keep select().
   *  Pure so the decision table is unit-testable without a map. */
  ```

  becomes:

  ```ts
  /** Compare-pair click semantics — pure so the decision tables are
   *  unit-testable without a map.
   *
   *  compareMapClick — A8 (2026-07-26 UX spec): MAP clicks while a compare
   *  pair is active. A third country replaces B; clicking A or the current B
   *  is a no-op — Escape and the compare header's Exit compare / × are the
   *  only exits. Search keeps select().
   *
   *  compareChipClick — C1 (A8's descoped border-chip clause): border chips
   *  INSIDE the compare panel are column-scoped. A chip in column A replaces
   *  A (keeping B, via useSelectedCountry.compareReplaceA); a chip in column
   *  B replaces B (keeping A, via compareSelect); a chip naming the OTHER
   *  column's country is a no-op (an X-vs-X pair is meaningless). */
  ```

  and append after the existing `compareMapClick` function:

  ```ts
  export type CompareColumn = 'a' | 'b'

  export type CompareChipClickAction =
    | { kind: 'replace-a'; cca3: string }
    | { kind: 'replace-b'; cca3: string }
    | { kind: 'noop' }

  export function compareChipClick(
    column: CompareColumn,
    clickedCca3: string,
    selectedCca3: string,
    compareWithCca3: string,
  ): CompareChipClickAction {
    const code = clickedCca3.toUpperCase()
    if (code === selectedCca3 || code === compareWithCca3) return { kind: 'noop' }
    return column === 'a' ? { kind: 'replace-a', cca3: code } : { kind: 'replace-b', cca3: code }
  }
  ```

- [ ] **Implement `compareReplaceA` in `src/hooks/useSelectedCountry.ts`.** In the return-type annotation, after the line `compareSelect: (cca3: string) => void` add `compareReplaceA: (cca3: string) => void`. After the `compareSelect` callback add:

  ```ts
    /** C1 border-chip semantics: replace the SELECTED country (column A)
     *  while keeping the compare partner — the counterpart of compareSelect,
     *  which replaces B while keeping A. No-op unless a pair is active. */
    const compareReplaceA = useCallback((cca3: string) => {
      const current = parseHash(window.location.hash)
      if (current.kind !== 'country' || !current.compareWith) return
      window.location.hash = writeHash({
        kind: 'country',
        cca3: cca3.toUpperCase(),
        compareWith: current.compareWith,
      })
    }, [])
  ```

  and add `compareReplaceA,` to the returned object (after `compareSelect,`).

- [ ] Run `npx vitest run src/lib/__tests__/compareMapClick.test.ts src/hooks/__tests__/useSelectedCountry.test.ts` — **expect green**.

- [ ] **Failing component test.** In `src/components/__tests__/CompareCountryPanel.test.tsx`: extend the RTL import to `import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'`, add `import { COMPARE_FIELDS } from '../../lib/compareFields'`, change `renderPanel`'s `onSelect={vi.fn()}` line to `onCompareColumnSelect={vi.fn()}`, and append:

  ```tsx
  describe('C1 — one shared field list drives both columns', () => {
    it('renders identical, ordered rows in both columns with em-dash placeholders', () => {
      const sparse = makeCountry({
        cca3: 'DEU',
        ccn3: '276',
        name: { common: 'Germany', official: 'Federal Republic of Germany' },
        governmentType: '',
        currencies: {},
      })
      render(
        <CompareCountryPanel
          country={FRA}
          compareWith={sparse}
          isDesktop={true}
          onCompareColumnSelect={vi.fn()}
          onClose={vi.fn()}
          onExitCompare={vi.fn()}
          byCca3={new Map()}
          sources={sources}
        />,
      )
      const expected = COMPARE_FIELDS.map((f) => f.label)
      // Field labels are the .uppercase divs inside the fields wrapper
      // (borders are empty on these fixtures, so no Borders label competes).
      const rowLabels = (col: HTMLElement) =>
        Array.from(col.querySelectorAll('.px-5.py-3 .uppercase')).map((el) => el.textContent)
      expect(rowLabels(screen.getByTestId('compare-column-a'))).toEqual(expected)
      expect(rowLabels(screen.getByTestId('compare-column-b'))).toEqual(expected)
      // Germany's missing Government + Currencies render the placeholder; France has none.
      expect(within(screen.getByTestId('compare-column-b')).getAllByText('—')).toHaveLength(2)
      expect(within(screen.getByTestId('compare-column-a')).queryByText('—')).toBeNull()
    })
  })

  describe('C1 — border chips are column-scoped', () => {
    it('reports column "a" for chips in column A and column "b" for chips in column B', () => {
      const fra = makeCountry({ borders: ['ESP'] })
      const deu = makeCountry({
        cca3: 'DEU',
        ccn3: '276',
        name: { common: 'Germany', official: 'Federal Republic of Germany' },
        borders: ['POL'],
      })
      const byCca3 = new Map([
        [
          'ESP',
          makeCountry({ cca3: 'ESP', ccn3: '724', name: { common: 'Spain', official: 'Kingdom of Spain' } }),
        ],
        [
          'POL',
          makeCountry({ cca3: 'POL', ccn3: '616', name: { common: 'Poland', official: 'Republic of Poland' } }),
        ],
      ])
      const onCompareColumnSelect = vi.fn()
      render(
        <CompareCountryPanel
          country={fra}
          compareWith={deu}
          isDesktop={true}
          onCompareColumnSelect={onCompareColumnSelect}
          onClose={vi.fn()}
          onExitCompare={vi.fn()}
          byCca3={byCca3}
          sources={sources}
        />,
      )
      fireEvent.click(
        within(screen.getByTestId('compare-column-a')).getByRole('button', { name: 'Spain' }),
      )
      expect(onCompareColumnSelect).toHaveBeenLastCalledWith('a', 'ESP')
      fireEvent.click(
        within(screen.getByTestId('compare-column-b')).getByRole('button', { name: 'Poland' }),
      )
      expect(onCompareColumnSelect).toHaveBeenLastCalledWith('b', 'POL')
    })
  })
  ```

- [ ] Run `npx vitest run src/components/__tests__/CompareCountryPanel.test.tsx` — **expect FAIL** (`onCompareColumnSelect` prop does not exist yet).

- [ ] **Implement the threading.** In `src/components/CompareCountryPanel.tsx`: add `import type { CompareColumn } from '../lib/compareMapClick'`; in `Props` replace `onSelect: (cca3: string) => void` with `onCompareColumnSelect: (column: CompareColumn, cca3: string) => void` (and in the destructuring, `onSelect,` → `onCompareColumnSelect,`); the two column usages become:

  ```tsx
              <CountryColumn
                country={country}
                byCca3={byCca3}
                onSelect={(cca3) => onCompareColumnSelect('a', cca3)}
                badgeLetter="A"
                badgeColor="a"
              />
  ```

  and

  ```tsx
              <CountryColumn
                country={compareWith}
                byCca3={byCca3}
                onSelect={(cca3) => onCompareColumnSelect('b', cca3)}
                badgeLetter="B"
                badgeColor="b"
              />
  ```

  In `src/components/CountryPanel.tsx`: add `import type { CompareColumn } from '../lib/compareMapClick'`; add `onCompareColumnSelect: (column: CompareColumn, cca3: string) => void` to `Props` (after `onExitCompare`); destructure it; in the `CompareCountryPanel` branch replace `onSelect={onSelect}` with `onCompareColumnSelect={onCompareColumnSelect}` (the `SingleCountryPanel` branch keeps `onSelect={onSelect}` unchanged).

  In `src/App.tsx`: (1) change the import `import { compareMapClick } from './lib/compareMapClick'` to `import { compareMapClick, compareChipClick, type CompareColumn } from './lib/compareMapClick'`; (2) add `compareReplaceA,` to the `useSelectedCountry` destructuring (after `compareSelect,`); (3) replace the stale A8 comment

  ```ts
    // A8 — map-click semantics while a compare pair is active. Scoped to MAP
    // clicks only: search and border chips still route through onMapSelect and
    // keep select() (per-column chip semantics land with workstream C).
  ```

  with

  ```ts
    // A8 — map-click semantics while a compare pair is active. Scoped to MAP
    // clicks only: search still routes through onMapSelect and keeps select().
    // Border chips inside the compare panel are column-scoped (C1) — see
    // onCompareColumnSelect below.
  ```

  (4) after the `onMapCountryClick` callback add:

  ```ts
    // C1 (A8's descoped border-chip clause) — chips inside the compare panel
    // replace their OWN column's country: column A via compareReplaceA (keeps
    // B), column B via compareSelect (keeps A). compareChipClick guards the
    // X-vs-X case (a chip naming the other column's country is a no-op).
    const onCompareColumnSelect = useCallback(
      (column: CompareColumn, cca3: string) => {
        if (!selected || !compareWith) return
        const action = compareChipClick(column, cca3, selected.cca3, compareWith.cca3)
        if (action.kind === 'replace-a') compareReplaceA(action.cca3)
        else if (action.kind === 'replace-b') compareSelect(action.cca3)
      },
      [selected, compareWith, compareReplaceA, compareSelect],
    )
  ```

  (5) on the main `<CountryPanel` (the `selected && !gameActive` one) add `onCompareColumnSelect={onCompareColumnSelect}` after `onExitCompare={exitCompare}`; on the `roundEndTarget` `<CountryPanel` add, after its `onExitCompare` no-op:

  ```tsx
            onCompareColumnSelect={() => {
              /* no-op — compare never renders during a round */
            }}
  ```

- [ ] Run `npx vitest run src/components/__tests__/CompareCountryPanel.test.tsx` — **expect green** — then `npm run check` — **expect green** (types, lint, full unit suite).

- [ ] **Update `docs/systems/ui-layout.md` § Compare in the same commit** — append to the sentences inserted by commit 1:

  ```
  Border chips are column-scoped: a chip in column A replaces A (keeping B, via `compareReplaceA`), a chip in column B replaces B (keeping A, via `compareSelect`), and a chip naming the other column's country is a no-op (`compareChipClick` in `src/lib/compareMapClick.ts`).
  ```

- [ ] Commit:

  ```
  git add src/lib/compareMapClick.ts src/hooks/useSelectedCountry.ts src/components/CompareCountryPanel.tsx src/components/CountryPanel.tsx src/App.tsx src/lib/__tests__/compareMapClick.test.ts src/hooks/__tests__/useSelectedCountry.test.ts src/components/__tests__/CompareCountryPanel.test.tsx docs/systems/ui-layout.md && git commit -m "feat(compare): column-scoped border-chip semantics (C1, A8 descope)" -m "Chips in column A replace A keeping B (new compareReplaceA); chips in column B replace B keeping A (compareSelect); a chip naming the other column's country is a no-op. Pure decision table in compareChipClick. No new telemetry." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

**Steps — commit 3 (e2e for the changed behavior):**

- [ ] **Extend `e2e/compare-map-clicks.spec.ts`** (already in the chromium `testMatch` of `playwright.config.ts` and NOT CI-ignored — no config change needed). In the spec's header comment, extend the numbered list with a fifth line: `*   5. border-chip clicks inside the panel are column-scoped (C1)`. Append at the end of the file (real country data: France borders include ESP and DEU; Germany's include POL — so `#FRA,DEU` gives us all three chips deterministically; hash writes are synchronous inside the click handler, matching this spec's existing immediate-read pattern; no waitForTimeout, no force clicks — Playwright auto-scrolls the chip into its column's scroll container):

  ```ts
  test.describe('C1 — border-chip clicks are column-scoped', () => {
    // Would have failed before C1: chips routed to select(), tearing the pair
    // down to a single panel. Real bundled data: ESP and DEU are France's
    // border chips; POL is one of Germany's.
    test('a chip in column A replaces A and keeps B', async ({ page }) => {
      await openComparePair(page)

      await page
        .getByTestId('compare-column-a')
        .getByRole('button', { name: 'Spain' })
        .click()

      await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#ESP,DEU')
      await expect(page.getByTestId('exit-compare')).toBeVisible()
      await expect(page.getByTestId('compare-column-a')).toContainText('Spain')
      await expect(page.getByTestId('compare-column-b')).toContainText('Germany')
    })

    test('a chip in column B replaces B and keeps A', async ({ page }) => {
      await openComparePair(page)

      await page
        .getByTestId('compare-column-b')
        .getByRole('button', { name: 'Poland' })
        .click()

      await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#FRA,POL')
      await expect(page.getByTestId('exit-compare')).toBeVisible()
      await expect(page.getByTestId('compare-column-b')).toContainText('Poland')
    })

    test("a chip naming the OTHER column's country is a no-op (no X-vs-X pair)", async ({
      page,
    }) => {
      await openComparePair(page)

      // Germany (the current B) is one of France's border chips.
      await page
        .getByTestId('compare-column-a')
        .getByRole('button', { name: 'Germany' })
        .click()

      // A regression writes the hash synchronously inside the click handler,
      // so this immediate read is a deterministic signal (existing pattern).
      expect(await page.evaluate(() => window.location.hash)).toBe('#FRA,DEU')
      await expect(page.getByTestId('exit-compare')).toBeVisible()
    })
  })
  ```

- [ ] Kill any background `npm run dev` (project memory: Playwright's `reuseExistingServer` would reuse it WITHOUT `VITE_TEST_HOOKS`), then run `npx playwright test e2e/compare-map-clicks.spec.ts e2e/compare-source-attribution.spec.ts e2e/compare-view-dimming.spec.ts --project=chromium --workers=2` — **expect all green** (the two untouched compare specs guard against regressions from the panel restructure; none of them pin the removed "UN Member" row or the old single-capital caption — verified by grep during planning).

- [ ] Commit:

  ```
  git add e2e/compare-map-clicks.spec.ts && git commit -m "test(e2e): compare border-chip column semantics (C1)" -m "Covers replace-A, replace-B, and the X-vs-X no-op via real border chips (ESP/POL/DEU) on the #FRA,DEU pair." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

### Task 3: Shared-row comparison table with bars, deltas, and derived density (C2 + C3)

**Context for the executing engineer (you have no other context):** This repo is funworldmap (React 19 + TypeScript + Tailwind 4 + MapLibre 5.23; Vitest + Testing Library; Playwright). You are implementing spec items C2 and C3 of `docs/superpowers/specs/2026-07-26-ux-visual-program-design.md` (read its "Workstream C" section first). Two earlier tasks of this plan have already landed on your branch:

- **Task 1** renamed `ICE_DIM` → `ICE_MID` in `src/lib/mapPalette.ts`. You consume `ICE_MID = '#0284c7'` (sky-600) — the compare-B map-fill hex, used in BOTH themes ("compare intentionally ignores theme once it's pinned" — mapPalette's own doc block).
- **Task 2 (C1)** restructured `src/components/CompareCountryPanel.tsx` and `src/components/CountryColumn.tsx` around a shared field-definition array `COMPARE_FIELDS` in `src/components/compareFields.ts`. Both columns now render every field with an em-dash (`—`, U+2014) placeholder when a value is missing.

**Intra-plan collision rule (applies to every step below):** the code you must edit in `compareFields.ts`, `CountryColumn.tsx`, and `CompareCountryPanel.tsx` is Task 2's output, which this task description reconstructs from its contract. Where a quoted "current" block differs from what Task 2 actually committed, **anchor on content**: find the equivalent block (same responsibility, same testids) and apply the same transformation. Do not rewrite Task 2's field-formatting logic — this task only *lifts* blocks and *adds* the row model. If Task 2 typed `CompareFieldDef.key` as a string-literal union, add `'density'` to that union. If Task 2 exported an em-dash placeholder constant, import it instead of the `'—'` literals below.

**Analytics: this task ships NO new telemetry** (no new `track()` events, no `KNOWN_EVENTS` change, no `docs/systems/analytics.md` change).

**Files:**

- `src/components/compareRowModel.ts` (new — pure row model: bar math, delta phrasing)
- `src/components/compareFields.ts` (extend — `raw` accessors, density entry; owned by Task 2)
- `src/components/CompareFieldRow.tsx` (new — pure per-row renderer, reused verbatim by the later mobile task C6)
- `src/components/CountryColumn.tsx` (refactor — export `CountryColumnHeader` + `CountryBorders`; mobile rendering unchanged)
- `src/components/CompareCountryPanel.tsx` (desktop branch: shared rows replace the two field columns)
- `src/index.css` (two new `@theme` tokens: `--color-ice-mid`, `--color-signal-mid`)
- `src/lib/__tests__/designTokens.test.ts` (pin the new tokens + the mapPalette hex sync)
- `src/components/__tests__/compareRowModel.test.ts` (new)
- `src/components/__tests__/CompareFieldRow.test.tsx` (new)
- `e2e/compare-source-attribution.spec.ts` (extend — bar presence + delta chip via accessible text)
- `docs/systems/ui-layout.md` (§ Compare — describe the shared-row table in the same task, per repo convention)

**Interfaces:**

*Consumes (produced by earlier tasks of this plan):*

```ts
// src/components/compareFields.ts (Task 2 / C1)
export interface CompareFieldDef {
  key: string // 'population' | 'area' | 'region' | 'government' | 'languages' | 'currencies' | 'timezones' (Task 2's keys)
  label: string // row caption, e.g. 'Population'
  format: (c: CountryData) => string // '—' (U+2014) when the country lacks the value
  numeric: boolean // true for population and area
}
export const COMPARE_FIELDS: readonly CompareFieldDef[]

// src/lib/mapPalette.ts (Task 1 rename)
export const ICE_MID = '#0284c7' // sky-600 — compare-B map fill, both themes

// src/index.css (E-foundations, already on main): .text-readout (mono +
// tabular-nums), .text-label (11px uppercase 0.12em); tokens --color-ice,
// --color-ice-dim, --color-ice-accessible, --color-signal, --color-sand-*,
// --color-dark-*.

// src/test/countryFixtures.ts (on main): makeCountryData(overrides?) — France
// defaults: population 67_000_000, area 551_695, currencies { EUR: { name:
// 'Euro', symbol: '€' } }.
```

*Produces (later tasks — the mobile task C6 and the plan's docs task — import these):*

```ts
// src/components/compareRowModel.ts
export function barWidthPct(value: number, max: number): number // percent of max, 1-decimal
export function formatDelta(
  noun: string, aName: string, bName: string,
  aRaw: number | null, bRaw: number | null,
): string | null
export interface NumericRowModel {
  kind: 'numeric'; aText: string; bText: string
  aPct: number | null; bPct: number | null // null → no bar
  delta: string | null // null → no chip
}
export interface CategoricalRowModel { kind: 'both' | 'split'; aText: string; bText: string }
export type CompareRowModel = NumericRowModel | CategoricalRowModel
export function buildRowModel(field: CompareFieldDef, a: CountryData, b: CountryData): CompareRowModel

// src/components/compareFields.ts (extended by this task)
export interface CompareFieldDef { /* Task 2's fields, plus: */ raw?: (c: CountryData) => number | null }
export function densityOf(c: CountryData): number | null // C3: population/area
export function formatDensity(c: CountryData): string // '121 people/km²', 1 decimal under 10, '—' when null
// COMPARE_FIELDS gains entry { key: 'density', label: 'Density', numeric: true, raw: densityOf, format: formatDensity } after 'area'

// src/components/CompareFieldRow.tsx — PURE (no hooks/context); C6 reuses it verbatim
export function CompareFieldRow(props: { field: CompareFieldDef; a: CountryData; b: CountryData }): JSX.Element

// src/components/CountryColumn.tsx (new named exports; CountryColumn itself unchanged in behavior)
export function CountryColumnHeader(props: { country: CountryData; badgeLetter: 'A' | 'B'; badgeColor: 'a' | 'b' }): JSX.Element
export function CountryBorders(props: { country: CountryData; byCca3: Map<string, CountryData>; onSelect: (cca3: string) => void }): JSX.Element | null

// src/index.css @theme (→ Tailwind 4 auto-generates bg-ice-mid / bg-signal-mid utilities)
--color-ice-mid: #0284c7;    /* === mapPalette.ICE_MID, pinned by designTokens.test.ts */
--color-signal-mid: #ea580c; /* orange-600 */

// Test anchors (DOM testids) — later tasks and e2e re-anchor on these:
// compare-rows (desktop scroll container), compare-row-<key>,
// compare-bar-a-<key>, compare-bar-b-<key>, compare-delta-<key>, compare-both-<key>
```

**The delta-chip format (exact, covers both directions and equality):** given raw values for A and B — (1) if either raw is `null`, no chip; (2) `ratio = larger/smaller`, rendered via `toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`; (3) if the rendered ratio is `'1.00'` (exact equality or sub-rounding difference) the chip reads `Same <noun>`; (4) otherwise `<name of the LARGER country> <ratio>× <noun>` (U+00D7), e.g. `Germany 1.26× population` regardless of which column Germany occupies. `<noun>` is `field.label.toLowerCase()`.

**Bar-color decision + WCAG math (1.4.11 non-text floor is 3:1; bars are meaning-bearing graphics adjacent to the panel surface — light `sand-50 #fefdfb`, relative luminance L=0.983; dark `dark-400 #161a22`, L=0.0102; contrast = (L1+0.05)/(L2+0.05)).** Bars use ONE hex per side in BOTH themes, matching the compare map fills' theme-invariant behavior:

- **Bar B = `--color-ice-mid: #0284c7`** (L=0.2064) — the *exact* compare-B map-fill hex (`mapPalette.ICE_MID`), so bar B literally matches country B's fill. Contrast: **4.03:1 light, 4.26:1 dark ✓✓**. No existing CSS ice token passes both themes: `--color-ice #7dd3fc` is 1.64:1 on light ✗; `--color-ice-dim #0369a1` is 2.94:1 on dark ✗.
- **Bar A = `--color-signal-mid: #ea580c`** (orange-600, L=0.2450) — **3.50:1 light, 4.90:1 dark ✓✓**. One ramp step deeper than the compare-A map fill because no existing signal token passes both themes: `--color-signal #ff8a4c` is 2.30:1 on light ✗, `--color-signal-dim #f97316` 2.76:1 on light ✗, `--color-signal-accessible #9a3412` 2.38:1 on dark ✗. Same family, same single meaning (compare-A / live).
- Delta-chip text (new pairing, AA text floor 4.5:1): `text-sand-800 #2c2924` (L=0.0225) on `bg-sand-200 #f0ebe3` (L=0.835) = **12.2:1 ✓**; `dark:text-dark-50 #f1f5f9` (L=0.908) on `dark:bg-dark-300 #1e2430` (L=0.0176) = **14.2:1 ✓**.

**Reduced motion:** bars render **statically — no width transition at all** (the "no transition" arm of the spec's C2 allowance). No `data-animation-state` contract is needed because nothing animates (CLAUDE.md: DOM animation contracts are only for components that animate); a unit test pins the absence of a `transition` class so one can't sneak in later without revisiting this decision.

**Steps:**

- [ ] **Write the failing row-model unit test.** Create `src/components/__tests__/compareRowModel.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest'
  import { barWidthPct, formatDelta, buildRowModel } from '../compareRowModel'
  import { COMPARE_FIELDS, densityOf, formatDensity } from '../compareFields'
  import { makeCountryData } from '../../test/countryFixtures'

  function field(key: string) {
    const f = COMPARE_FIELDS.find((f) => f.key === key)
    if (!f) throw new Error(`no COMPARE_FIELDS entry '${key}'`)
    return f
  }

  describe('barWidthPct (C2)', () => {
    it('scales to percent of max(A, B) with one-decimal precision', () => {
      expect(barWidthPct(63_000_000, 63_000_000)).toBe(100)
      expect(barWidthPct(50_000_000, 63_000_000)).toBe(79.4)
      expect(barWidthPct(1, 3)).toBe(33.3)
    })
  })

  describe('formatDelta (C2) — exact phrasing contract', () => {
    it('names the LARGER country in both column orders', () => {
      expect(formatDelta('population', 'France', 'Germany', 50e6, 63e6)).toBe(
        'Germany 1.26× population',
      )
      expect(formatDelta('population', 'Germany', 'France', 63e6, 50e6)).toBe(
        'Germany 1.26× population',
      )
    })

    it('equal and sub-rounding-equal values read "Same <noun>"', () => {
      expect(formatDelta('area', 'France', 'Belgium', 1000, 1000)).toBe('Same area')
      expect(formatDelta('area', 'France', 'Belgium', 1002, 1000)).toBe('Same area') // 1.002 → '1.00'
    })

    it('a missing value produces no chip', () => {
      expect(formatDelta('area', 'France', 'Germany', null, 357_000)).toBeNull()
      expect(formatDelta('area', 'France', 'Germany', 551_695, null)).toBeNull()
    })

    it('extreme ratios stay readable via en-US grouping', () => {
      expect(formatDelta('area', 'Russia', 'Vatican City', 17_098_242, 0.44)).toBe(
        'Russia 38,859,640.91× area',
      )
    })
  })

  describe('densityOf / formatDensity (C3)', () => {
    it('derives population/area', () => {
      expect(densityOf(makeCountryData())).toBeCloseTo(121.44, 2) // 67M / 551,695
    })

    it('is null when population or area is non-positive', () => {
      expect(densityOf(makeCountryData({ area: 0 }))).toBeNull()
      expect(densityOf(makeCountryData({ population: 0 }))).toBeNull()
    })

    it('formats people/km² — integers at ≥10, one decimal under 10, em-dash when missing', () => {
      expect(formatDensity(makeCountryData())).toBe('121 people/km²')
      expect(formatDensity(makeCountryData({ population: 3_300_000, area: 1_564_110 }))).toBe(
        '2.1 people/km²',
      )
      expect(formatDensity(makeCountryData({ area: 0 }))).toBe('—')
    })
  })

  describe('buildRowModel (C2)', () => {
    it('numeric: pcts scale to max, missing value → null pct and null delta', () => {
      const m = buildRowModel(
        field('area'),
        makeCountryData({ area: 0 }),
        makeCountryData({ cca3: 'DEU', area: 357_114 }),
      )
      expect(m.kind).toBe('numeric')
      if (m.kind !== 'numeric') throw new Error('unreachable')
      expect(m.aPct).toBeNull()
      expect(m.bPct).toBe(100)
      expect(m.delta).toBeNull()
      expect(m.aText).toBe('—')
    })

    it('categorical: identical formatted values collapse to kind "both"', () => {
      const m = buildRowModel(field('currencies'), makeCountryData(), makeCountryData({ cca3: 'DEU' }))
      expect(m.kind).toBe('both')
    })

    it('categorical: two MISSING values stay split — never "Both: —"', () => {
      const m = buildRowModel(
        field('currencies'),
        makeCountryData({ currencies: {} }),
        makeCountryData({ cca3: 'DEU', currencies: {} }),
      )
      expect(m.kind).toBe('split')
    })
  })
  ```

  Note the numeric edge contract this pins: **missing area = no bar (null pct) + em-dash text + no delta**. If Task 2's `area` format renders a non-positive area as something other than `'—'`, fix Task 2's format fn in this same commit so `format` and `raw` agree that non-positive = missing.

- [ ] **Run it — expect module-not-found failure:** `npx vitest run src/components/__tests__/compareRowModel.test.ts` → fails with `Cannot find module '../compareRowModel'` (and `densityOf` not exported from `../compareFields`).

- [ ] **Implement the row model.** Create `src/components/compareRowModel.ts`:

  ```ts
  import type { CountryData } from '../lib/types'
  import type { CompareFieldDef } from './compareFields'

  /** C2 bar math — width as percent of the pair max, one-decimal precision.
   *  Pure module (no React) so the desktop grid (this plan) and the mobile
   *  single-scroll (C6) share one source of truth. */
  export function barWidthPct(value: number, max: number): number {
    return Math.round((value / max) * 1000) / 10
  }

  /** C2 delta-chip phrasing. Contract (also pinned by unit tests):
   *  - either raw missing → null (no chip)
   *  - ratio = larger/smaller, rendered '1.26' style (en-US, exactly 2
   *    fraction digits, grouped — extreme pairs read '38,859,640.91')
   *  - rendered '1.00' → `Same <noun>` (equality incl. sub-rounding)
   *  - else `<larger-country> <ratio>× <noun>` — the LARGER country is
   *    always the subject, so both column orders yield the same text. */
  export function formatDelta(
    noun: string,
    aName: string,
    bName: string,
    aRaw: number | null,
    bRaw: number | null,
  ): string | null {
    if (aRaw === null || bRaw === null) return null
    const [larger, smaller, name]: [number, number, string] =
      aRaw >= bRaw ? [aRaw, bRaw, aName] : [bRaw, aRaw, bName]
    const ratio = (larger / smaller).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    if (ratio === '1.00') return `Same ${noun}`
    return `${name} ${ratio}× ${noun}`
  }

  export interface NumericRowModel {
    kind: 'numeric'
    aText: string
    bText: string
    /** Percent of max(A, B); null → render no bar (missing value). */
    aPct: number | null
    bPct: number | null
    delta: string | null
  }

  export interface CategoricalRowModel {
    kind: 'both' | 'split'
    aText: string
    bText: string
  }

  export type CompareRowModel = NumericRowModel | CategoricalRowModel

  export function buildRowModel(
    field: CompareFieldDef,
    a: CountryData,
    b: CountryData,
  ): CompareRowModel {
    const aText = field.format(a)
    const bText = field.format(b)
    if (field.numeric) {
      const aRaw = field.raw?.(a) ?? null
      const bRaw = field.raw?.(b) ?? null
      const max = Math.max(aRaw ?? 0, bRaw ?? 0)
      return {
        kind: 'numeric',
        aText,
        bText,
        aPct: aRaw !== null && max > 0 ? barWidthPct(aRaw, max) : null,
        bPct: bRaw !== null && max > 0 ? barWidthPct(bRaw, max) : null,
        delta: formatDelta(field.label.toLowerCase(), a.name.common, b.name.common, aRaw, bRaw),
      }
    }
    // Categorical (C2): identical NON-missing values collapse to one
    // centered "Both:" row; anything else renders side by side.
    const kind = aText === bText && aText !== '—' ? 'both' : 'split'
    return { kind, aText, bText }
  }
  ```

  Then extend `src/components/compareFields.ts` (Task 2's file — anchor on content):

  1. Add to the `CompareFieldDef` interface:

  ```ts
    /** Raw numeric accessor for bar/delta math (numeric fields only, C2).
     *  null → missing/non-positive: no bar, no delta; format renders '—'. */
    raw?: (c: CountryData) => number | null
  ```

  2. Add module-level helpers (exported — unit-tested and reused by D1's hero-density later):

  ```ts
  /** C3 — derived population density (people/km²). */
  export function densityOf(c: CountryData): number | null {
    return c.population > 0 && c.area > 0 ? c.population / c.area : null
  }

  export function formatDensity(c: CountryData): string {
    const d = densityOf(c)
    if (d === null) return '—'
    return `${d.toLocaleString('en-US', { maximumFractionDigits: d < 10 ? 1 : 0 })} people/km²`
  }
  ```

  3. On the existing `population` entry add `raw: (c) => (c.population > 0 ? c.population : null),`; on the `area` entry add `raw: (c) => (c.area > 0 ? c.area : null),`.

  4. Insert the derived density entry **immediately after the `area` entry** (mobile columns pick it up automatically via Task 2's `COMPARE_FIELDS` mapping — intended: mobile keeps field parity until C6):

  ```ts
    {
      key: 'density',
      label: 'Density',
      numeric: true,
      raw: densityOf,
      format: formatDensity,
    },
  ```

- [ ] **Run green:** `npx vitest run src/components/__tests__/compareRowModel.test.ts` → all pass. Also run Task 2's suite to prove the `COMPARE_FIELDS` extension broke nothing: `npx vitest run src/components/__tests__/` → green.

- [ ] **Commit 1:**

  ```sh
  git add src/components/compareRowModel.ts src/components/compareFields.ts src/components/__tests__/compareRowModel.test.ts
  git commit -m "feat(compare): row model — bar widths, delta phrasing, derived density (C2/C3)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

- [ ] **Write the failing token pin.** In `src/lib/__tests__/designTokens.test.ts`, append a new describe block after the `describe('E4 accent tokens (index.css @theme)', …)` block (this file already imports `indexCssSource`/`mapPaletteSource` and normalizes CRLF into `css` — reuse those):

  ```ts
  describe('C2 compare-bar tokens (index.css @theme)', () => {
    it('defines the theme-invariant bar tiers (≥3:1 non-text on both panel surfaces)', () => {
      // ice-mid #0284c7: 4.03:1 on sand-50, 4.26:1 on dark-400.
      // signal-mid #ea580c: 3.50:1 on sand-50, 4.90:1 on dark-400.
      // Full math in the tokens' own comment in index.css.
      expect(css).toContain('--color-ice-mid: #0284c7;')
      expect(css).toContain('--color-signal-mid: #ea580c;')
    })

    it('bar-B hex stays in sync with the compare-B map fill (mapPalette.ICE_MID)', () => {
      expect(mapPaletteSource).toContain("export const ICE_MID = '#0284c7'")
    })
  })
  ```

- [ ] **Run it — expect the two `toContain` assertions on `css` to fail** (tokens not yet defined): `npx vitest run src/lib/__tests__/designTokens.test.ts`.

- [ ] **Add the tokens.** In `src/index.css`, inside the `@theme` block, insert directly after the line `--color-signal-accessible: #9a3412;`:

  ```css

    /* C2 compare bars — one hex per side in BOTH themes (compare ignores
       theme once pinned, matching the map compare fills — see mapPalette.ts).
       WCAG 1.4.11 non-text floor 3:1 vs the panel surfaces (sand-50 #fefdfb
       L=0.983; dark-400 #161a22 L=0.010):
       - ice-mid #0284c7 (sky-600 — the EXACT compare-B map-fill hex,
         mapPalette.ICE_MID): 4.03:1 light, 4.26:1 dark. Neither existing ice
         token passes both (ice 1.64:1 light; ice-dim 2.94:1 dark).
       - signal-mid #ea580c (orange-600): 3.50:1 light, 4.90:1 dark. One ramp
         step deeper than the compare-A map fill because signal #ff8a4c is
         2.30:1 on sand-50 (signal-dim 2.76:1; signal-accessible 2.38:1 on
         dark-400). Same family, same meaning (compare-A / live). */
    --color-ice-mid: #0284c7;
    --color-signal-mid: #ea580c;
  ```

  (Tailwind 4 auto-derives the `bg-ice-mid` / `bg-signal-mid` utilities from `@theme` `--color-*` tokens — no config change.)

- [ ] **Run green:** `npx vitest run src/lib/__tests__/designTokens.test.ts` → all pass (the pre-existing pins in that file use `toContain`, so additive tokens can't break them).

- [ ] **Commit 2:**

  ```sh
  git add src/index.css src/lib/__tests__/designTokens.test.ts
  git commit -m "feat(theme): ice-mid/signal-mid compare-bar tokens, 3:1 non-text in both themes (C2)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

- [ ] **Write the failing component test.** Create `src/components/__tests__/CompareFieldRow.test.tsx`:

  ```tsx
  import { describe, it, expect } from 'vitest'
  import { render, screen } from '@testing-library/react'
  import { CompareFieldRow } from '../CompareFieldRow'
  import { COMPARE_FIELDS } from '../compareFields'
  import { makeCountryData } from '../../test/countryFixtures'

  function field(key: string) {
    const f = COMPARE_FIELDS.find((f) => f.key === key)
    if (!f) throw new Error(`no COMPARE_FIELDS entry '${key}'`)
    return f
  }

  // Deliberately non-fixture numbers so the ratios are clean: 63/50 = 1.26
  // (the spec's own example phrasing), 50/63 → 79.4% bar.
  const FRA = makeCountryData({ population: 50_000_000, area: 500_000 })
  const DEU = makeCountryData({
    cca3: 'DEU',
    ccn3: '276',
    name: { common: 'Germany', official: 'Federal Republic of Germany' },
    population: 63_000_000,
    area: 250_000,
  })

  describe('CompareFieldRow — numeric rows (C2)', () => {
    it('renders paired bars width-scaled to max(A, B), values in .text-readout', () => {
      render(<CompareFieldRow field={field('population')} a={FRA} b={DEU} />)
      expect(screen.getByTestId('compare-bar-a-population').style.width).toBe('79.4%')
      expect(screen.getByTestId('compare-bar-b-population').style.width).toBe('100%')
      expect(screen.getByText('50,000,000').className).toContain('text-readout')
      expect(screen.getByText('63,000,000').className).toContain('text-readout')
    })

    it('bars are static — no transition class, so reduced-motion needs no gating', () => {
      render(<CompareFieldRow field={field('population')} a={FRA} b={DEU} />)
      expect(screen.getByTestId('compare-bar-a-population').className).not.toContain('transition')
      expect(screen.getByTestId('compare-bar-b-population').className).not.toContain('transition')
    })

    it('delta chip names the larger country in either column order', () => {
      const { unmount } = render(<CompareFieldRow field={field('population')} a={FRA} b={DEU} />)
      expect(screen.getByTestId('compare-delta-population').textContent).toBe(
        'Germany 1.26× population',
      )
      unmount()
      render(<CompareFieldRow field={field('population')} a={DEU} b={FRA} />)
      expect(screen.getByTestId('compare-delta-population').textContent).toBe(
        'Germany 1.26× population',
      )
    })

    it('equal values read "Same population"', () => {
      render(
        <CompareFieldRow
          field={field('population')}
          a={FRA}
          b={makeCountryData({ cca3: 'BEL', population: 50_000_000 })}
        />,
      )
      expect(screen.getByTestId('compare-delta-population').textContent).toBe('Same population')
    })

    it('missing area: no bar, no delta chip, em-dash readout', () => {
      render(<CompareFieldRow field={field('area')} a={makeCountryData({ area: 0 })} b={DEU} />)
      expect(screen.queryByTestId('compare-bar-a-area')).toBeNull()
      expect(screen.getByTestId('compare-bar-b-area')).toBeTruthy() // B is the max → full bar
      expect(screen.queryByTestId('compare-delta-area')).toBeNull()
      expect(screen.getByText('—')).toBeTruthy()
    })
  })

  describe('CompareFieldRow — derived density row (C3)', () => {
    it('computes population/area per country and phrases the delta', () => {
      render(<CompareFieldRow field={field('density')} a={FRA} b={DEU} />)
      expect(screen.getByText('100 people/km²')).toBeTruthy() // 50M / 500k
      expect(screen.getByText('252 people/km²')).toBeTruthy() // 63M / 250k
      expect(screen.getByTestId('compare-delta-density').textContent).toBe(
        'Germany 2.52× density',
      )
      expect(screen.getByTestId('compare-bar-a-density').style.width).toBe('39.7%') // 100/252
    })
  })

  describe('CompareFieldRow — categorical rows (C2)', () => {
    it('identical values collapse to one centered "Both:" row', () => {
      render(<CompareFieldRow field={field('currencies')} a={FRA} b={DEU} />)
      const both = screen.getByTestId('compare-both-currencies')
      expect(both.textContent).toBe('Both: Euro (€)')
      expect(both.className).toContain('text-center')
    })

    it('differing values render side by side, never "Both:"', () => {
      const CHE = makeCountryData({
        cca3: 'CHE',
        currencies: { CHF: { name: 'Swiss franc', symbol: 'Fr.' } },
      })
      render(<CompareFieldRow field={field('currencies')} a={FRA} b={CHE} />)
      expect(screen.queryByTestId('compare-both-currencies')).toBeNull()
      expect(screen.getByText('Euro (€)')).toBeTruthy()
      expect(screen.getByText('Swiss franc (Fr.)')).toBeTruthy()
    })
  })
  ```

  (The `'Euro (€)'` literals assume Task 2 lifted the currencies formatting unchanged from the pre-C1 `CountryColumn` — `` `${c.name} (${c.symbol})`.join(', ') ``. If Task 2's format differs, use its actual output — the collapse/split behavior under test is format-agnostic.)

- [ ] **Run it — expect module-not-found:** `npx vitest run src/components/__tests__/CompareFieldRow.test.tsx` → fails with `Cannot find module '../CompareFieldRow'`.

- [ ] **Implement the pure row renderer.** Create `src/components/CompareFieldRow.tsx`:

  ```tsx
  import type { CountryData } from '../lib/types'
  import type { CompareFieldDef } from './compareFields'
  import { buildRowModel } from './compareRowModel'

  /** Plain-div bar (C2). STATIC by design: no width transition, so it renders
   *  identically under prefers-reduced-motion and needs no data-animation-state
   *  contract (CLAUDE.md — only animating components need one). aria-hidden:
   *  the adjacent .text-readout value carries the data for assistive tech.
   *  Colors are the theme-invariant bar tiers from index.css — bg-ice-mid is
   *  the exact compare-B map-fill hex (mapPalette.ICE_MID); bg-signal-mid is
   *  the signal-family tier that clears 3:1 on both panel surfaces (see the
   *  contrast math on the tokens in index.css). */
  function Bar({ pct, side, fieldKey }: { pct: number | null; side: 'a' | 'b'; fieldKey: string }) {
    return (
      <div aria-hidden="true" className="h-2 self-center">
        {pct !== null && (
          <div
            data-testid={`compare-bar-${side}-${fieldKey}`}
            className={`h-full rounded-full ${side === 'a' ? 'bg-signal-mid' : 'bg-ice-mid'}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    )
  }

  interface Props {
    field: CompareFieldDef
    a: CountryData
    b: CountryData
  }

  /** One shared compare row (C2/C3). Pure — no hooks, no context, no layout
   *  assumptions beyond its own width — so the mobile single-scroll task (C6)
   *  reuses it verbatim. */
  export function CompareFieldRow({ field, a, b }: Props) {
    const model = buildRowModel(field, a, b)
    const label = <span className="text-label text-ice-accessible dark:text-ice">{field.label}</span>

    if (model.kind === 'both') {
      return (
        <div data-testid={`compare-row-${field.key}`}>
          {label}
          <div
            data-testid={`compare-both-${field.key}`}
            className="text-readout text-sm text-center text-sand-800 dark:text-dark-50 mt-0.5"
          >
            Both: {model.aText}
          </div>
        </div>
      )
    }

    if (model.kind === 'split') {
      return (
        <div data-testid={`compare-row-${field.key}`}>
          {label}
          <div className="grid grid-cols-2 gap-x-4 mt-0.5">
            <div className="text-readout text-sm text-sand-800 dark:text-dark-50">{model.aText}</div>
            <div className="text-readout text-sm text-sand-800 dark:text-dark-50">{model.bText}</div>
          </div>
        </div>
      )
    }

    return (
      <div data-testid={`compare-row-${field.key}`}>
        <div className="flex items-baseline justify-between gap-2">
          {label}
          {model.delta !== null && (
            <span
              data-testid={`compare-delta-${field.key}`}
              className="text-readout text-[11px] px-1.5 py-0.5 rounded-md bg-sand-200 text-sand-800 dark:bg-dark-300 dark:text-dark-50"
            >
              {model.delta}
            </span>
          )}
        </div>
        {/* One grid so the A and B value cells share the max-content track —
            right-aligned tabular numerals line up digit-for-digit. */}
        <div className="grid grid-cols-[1fr_max-content] items-center gap-x-3 gap-y-1 mt-1">
          <Bar pct={model.aPct} side="a" fieldKey={field.key} />
          <span className="text-readout text-sm text-right text-sand-800 dark:text-dark-50 whitespace-nowrap">
            {model.aText}
          </span>
          <Bar pct={model.bPct} side="b" fieldKey={field.key} />
          <span className="text-readout text-sm text-right text-sand-800 dark:text-dark-50 whitespace-nowrap">
            {model.bText}
          </span>
        </div>
      </div>
    )
  }
  ```

- [ ] **Run green:** `npx vitest run src/components/__tests__/CompareFieldRow.test.tsx` → all pass.

- [ ] **Refactor `CountryColumn.tsx` — lift the header and borders into named exports** (behavior-preserving; the mobile compare layout keeps using `CountryColumn` unchanged until C6). On main the header is the `<div className="sticky top-0 bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-md px-5 py-4 z-10">…` block and the borders block is the `{country.borders.length > 0 && (…)}` conditional at the end of the field list; Task 2 has since (a) extended the caption to join ALL capitals and (b) replaced the hardcoded `CompareField` list with a `COMPARE_FIELDS` map. Lift those two blocks exactly as Task 2 left them into:

  ```tsx
  export function CountryColumnHeader({
    country,
    badgeLetter,
    badgeColor,
  }: {
    country: CountryData
    badgeLetter: 'A' | 'B'
    badgeColor: 'a' | 'b'
  }) {
    return (
      <div className="sticky top-0 bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-md px-5 py-4 z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0" style={{ animation: 'fade-up 200ms ease-out' }}>
            <span className={`compare-badge compare-badge-${badgeColor} mt-1`}>{badgeLetter}</span>
            <img
              data-testid="country-flag"
              src={country.flag}
              alt={country.flagAlt || `Flag of ${country.name.common}`}
              className="w-[56px] h-[38px] object-cover rounded-lg shadow-md shrink-0"
            />
            <div className="min-w-0 pt-0.5">
              <h2 className="text-lg font-bold text-sand-900 dark:text-dark-50 truncate tracking-tight leading-tight">
                {country.name.common}
              </h2>
              {country.capital.length > 0 && (
                <p className="text-xs text-ice-accessible dark:text-ice truncate mt-0.5">
                  {country.capital.join(', ')}
                </p>
              )}
              <span
                data-testid="region-badge"
                className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mt-1.5 bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100"
              >
                {country.region}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  export function CountryBorders({
    country,
    byCca3,
    onSelect,
  }: {
    country: CountryData
    byCca3: Map<string, CountryData>
    onSelect: (cca3: string) => void
  }) {
    if (country.borders.length === 0) return null
    return (
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice mb-1.5">
          Borders
        </div>
        <div className="flex flex-wrap gap-1">
          {country.borders.map((code) => (
            <BorderChip key={code} code={code} neighbor={byCca3.get(code)} onSelect={onSelect} size="compare" />
          ))}
        </div>
      </div>
    )
  }
  ```

  (If Task 2 also moved A5's exception badges or a source affordance into this header block, lift those lines too — the extraction must be verbatim.) Then make `CountryColumn` compose them: its returned JSX becomes the outer `<div className="flex flex-col h-full overflow-y-auto">` containing `<CountryColumnHeader country={country} badgeLetter={badgeLetter} badgeColor={badgeColor} />`, then the `px-5 py-3 space-y-2` div with **Task 2's field-list mapping kept verbatim**, ending with `<CountryBorders country={country} byCca3={byCca3} onSelect={onSelect} />` in place of the old inline borders block. Run `npx vitest run src/components/__tests__/CountryColumn.test.tsx` → still green (pure refactor).

- [ ] **Rewire `CompareCountryPanel.tsx`'s desktop branch to shared rows.** Add imports (the `CountryColumn` import line currently reads `import { CountryColumn } from './CountryColumn'`):

  ```tsx
  import { CountryColumn, CountryColumnHeader, CountryBorders } from './CountryColumn'
  import { CompareFieldRow } from './CompareFieldRow'
  import { COMPARE_FIELDS } from './compareFields'
  ```

  Replace the columns block — on main it is the single `<div className={isDesktop ? 'grid grid-cols-2 grid-rows-1 flex-1 min-h-0' : 'flex flex-col flex-1 min-h-0'}>` div containing the two `<CountryColumn …/>` wrappers (Task 2 kept this shape; anchor on the two `CountryColumn` usages between the header-buttons row and the `compare-sources` footer) — with an explicit desktop/mobile fork:

  ```tsx
  {isDesktop ? (
    /* C2/C3 — desktop: ONE scroll of shared rows under paired sticky
       headers. Columns diverge only for the per-country borders lists. */
    <div className="flex-1 min-h-0 overflow-y-auto" data-testid="compare-rows">
      <div className="grid grid-cols-2 sticky top-0 z-10">
        <div className="border-r border-sand-200/50 dark:border-dark-200/30">
          <CountryColumnHeader country={country} badgeLetter="A" badgeColor="a" />
        </div>
        <CountryColumnHeader country={compareWith} badgeLetter="B" badgeColor="b" />
      </div>
      <div className="px-5 py-3 space-y-3">
        {COMPARE_FIELDS.map((f) => (
          <CompareFieldRow key={f.key} field={f} a={country} b={compareWith} />
        ))}
      </div>
      {/* Borders stay per-country. Both columns keep the plain select path
          here — the per-column replace semantics (the A8-descoped border-chip
          clause) are wired by this plan's compare-entry task, not this one. */}
      <div className="grid grid-cols-2 gap-x-4 px-5 pb-4">
        <CountryBorders country={country} byCca3={byCca3} onSelect={onSelect} />
        <CountryBorders country={compareWith} byCca3={byCca3} onSelect={onSelect} />
      </div>
    </div>
  ) : (
    /* Mobile keeps the stacked per-country columns until C6 replaces them
       with these same shared rows under a compact sticky header. */
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 border-b-2 border-dashed border-sand-300/50 dark:border-dark-200/30 min-h-0">
        <CountryColumn country={country} byCca3={byCca3} onSelect={onSelect} badgeLetter="A" badgeColor="a" />
      </div>
      <div className="flex-1 min-h-0">
        <CountryColumn country={compareWith} byCca3={byCca3} onSelect={onSelect} badgeLetter="B" badgeColor="b" />
      </div>
    </div>
  )}
  ```

  (Preserve any extra props Task 2 added to the `CountryColumn` calls in the mobile branch.)

- [ ] **Run the component suites green:** `npx vitest run src/components/__tests__/` → all pass. `CompareCountryPanel.test.tsx` renders `isDesktop={true}` with identical-fixture FRA/DEU, so the new desktop path executes (population delta reads "Same population") — its header-control assertions are unaffected.

- [ ] **Update `docs/systems/ui-layout.md` in this same task** (staleness rule). In the "### Compare" section, replace the sentence fragment `Choosing a second country opens `CompareCountryPanel` — two `CountryColumn`s side by side.` with:

  ```md
  Choosing a second country opens `CompareCountryPanel`. On desktop it renders a shared-row
  comparison table (`compareFields.ts` × `CompareFieldRow.tsx`): numeric fields (Population, Area,
  and derived Density = population/area) get paired horizontal bars width-scaled to max(A, B) —
  bar A in `--color-signal-mid`, bar B in `--color-ice-mid` (the exact compare-B map-fill hex,
  `mapPalette.ICE_MID`; both tiers clear the 3:1 non-text floor on both panel surfaces, see
  `index.css`) — plus a delta chip ("Germany 1.26× population", larger country always the subject,
  "Same population" when equal). Categorical fields with identical values collapse to one centered
  "Both: …" row; differing values render side by side; missing values render an em-dash with no
  bar. Bars are static (no transition), so reduced-motion needs no gating. On mobile the panel
  still stacks two `CountryColumn`s (C6 will move mobile onto the same shared rows).
  ```

  Keep the rest of the paragraph (picking mode, sources footer, map highlight/dimming, spec references) unchanged.

- [ ] **Extend the compare e2e spec.** Append to `e2e/compare-source-attribution.spec.ts` (already in the chromium `testMatch` — no `playwright.config.ts` change; accessible-text and testid-presence assertions only, no pixel measurements, per the task contract and CLAUDE.md):

  ```ts
  test.describe('C2/C3 — shared-row comparison table (desktop)', () => {
    test('numeric rows render paired bars and a directional delta chip', async ({ page }) => {
      await gotoAndWaitForMap(page, '/#FRA,DEU')
      await expect(page.getByTestId('exit-compare')).toBeVisible({ timeout: 15_000 })

      // Bars: presence via testid, never pixel measurements. Population and
      // area both have values for FRA and DEU, so all four bars render.
      await expect(page.getByTestId('compare-bar-a-population')).toBeVisible()
      await expect(page.getByTestId('compare-bar-b-population')).toBeVisible()
      await expect(page.getByTestId('compare-bar-a-area')).toBeVisible()
      await expect(page.getByTestId('compare-bar-b-area')).toBeVisible()

      // C3: the derived density row exists with its own bars.
      await expect(page.getByTestId('compare-row-density')).toBeVisible()
      await expect(page.getByTestId('compare-bar-a-density')).toBeVisible()

      // Delta chip via accessible text. Germany's population exceeds
      // France's in every data vintage; the exact ratio floats with data
      // updates, so pin the phrasing shape, not the number.
      await expect(page.getByTestId('compare-delta-population')).toHaveText(
        /^Germany \d[\d,]*\.\d{2}× population$/,
      )
    })
  })
  ```

- [ ] **Run the compare e2e specs locally.** First kill any stray dev server (project memory: a reused `npm run dev` lacks `VITE_TEST_HOOKS`), then:

  ```sh
  npx playwright test e2e/compare-source-attribution.spec.ts e2e/compare-map-clicks.spec.ts e2e/compare-view-dimming.spec.ts --project=chromium --workers=2
  ```

  All green — `compare-map-clicks` and `compare-view-dimming` anchor on `exit-compare`/`country-panel`/map seams, none of which this task moved.

- [ ] **Run the full gate:** `npm run check` → green (typecheck, lint incl. eslint-plugin-playwright, unit).

- [ ] **Commit 3:**

  ```sh
  git add src/components/CompareFieldRow.tsx src/components/__tests__/CompareFieldRow.test.tsx src/components/CountryColumn.tsx src/components/CompareCountryPanel.tsx e2e/compare-source-attribution.spec.ts docs/systems/ui-layout.md
  git commit -m "feat(compare): shared-row comparison table with bars and delta chips (C2/C3)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

**Post-task live pass (per the workstream's verification commitments):** open `/#FRA,DEU` in the dev server on desktop at both themes — confirm bar A reads orange / bar B reads blue against both panel surfaces and the density row shows plausible values (France ≈122, Germany ≈233 people/km²); on a 390px viewport confirm the stacked mobile columns still render every field including the new Density row.

### Task 4: C4 — exception source markers: dominant-source computation, `SourceMarker`, compare integration

**Spec:** `docs/superpowers/specs/2026-07-26-ux-visual-program-design.md` item C4, which now **owns the exception-marker definition** (the spec's "whichever of C4/D2 lands first" clause — this workstream lands before D2, so D2 will *adopt* what this task ships, not define its own). The scheme, per D2's text: one consolidated sources footer per panel + a per-field superscript marker **only** where a field's source differs from the panel's dominant source. No return of per-field "i" rings in compare.

**Analytics:** this task (and the whole workstream) ships **no new telemetry** — do not add analytics events.

**Files:**

- Create: `src/lib/fieldSourceMarkers.ts` (~75 lines — pure computation, single owner of the marker scheme)
- Create: `src/lib/__tests__/fieldSourceMarkers.test.ts`
- Create: `src/components/SourceMarker.tsx` (~40 lines)
- Create: `src/components/__tests__/SourceMarker.test.tsx`
- Modify: `src/components/CompareCountryPanel.tsx` (compute markers, footer marker key, thread the row seam)
- Modify: `src/components/CompareRow.tsx` (Task 2's shared row renderer — add the `marker` slot; see seam contract)
- Modify: `src/components/__tests__/CompareCountryPanel.test.tsx`
- Modify: `e2e/compare-source-attribution.spec.ts` (already in the `chromium` `testMatch` and NOT in the CI `testIgnore` — CI-covered; no `playwright.config.ts` change needed)
- Modify: `docs/systems/ui-layout.md`, `docs/systems/accessibility.md` (same-task staleness fix)

**Interfaces:**

*Produces (D2 adopts these later for the single panel — they are the single owner of the scheme; D2 must NOT re-derive dominance):*

```ts
// src/lib/fieldSourceMarkers.ts
export const MARKER_GLYPHS: readonly ['†', '‡', '§', '¶'] // † ‡ § ¶
export interface FieldMarker {
  glyph: string // superscript glyph, e.g. '†'
  source: string // key into CountriesFile['_sources']
}
export interface FieldSourceMarkers {
  dominantSource: string | null // most-attributing source; null for empty input
  markerBySource: ReadonlyMap<string, string> // exception source key -> glyph (the footer key)
  markerByField: ReadonlyMap<string, FieldMarker> // field key -> marker; dominant-source fields absent
}
export function dominantSource(...fieldSourcesList: Array<Record<string, string>>): string | null
export function computeFieldSourceMarkers(
  ...fieldSourcesList: Array<Record<string, string>>
): FieldSourceMarkers
```

```tsx
// src/components/SourceMarker.tsx
export function SourceMarker(props: {
  glyph: string
  sourceKey: string
  sources: CountriesFile['_sources']
}): React.JSX.Element | null
// DOM contract: <sup><a data-testid={`source-marker-${sourceKey}`}
//   aria-label={`Source: ${name}`} href={url} target="_blank">glyph</a></sup>;
// renders null when sourceKey is absent from _sources.
```

*Consumes:* `CountryData` (`_fieldSources: Record<string, string>` — field name → key into `CountriesFile['_sources']`) and `CountriesFile` from `src/lib/types.ts`; `makeCountry`/`sources` fixtures from `src/components/__tests__/singleCountryPanelTestUtils.ts`; `gotoAndWaitForMap` from `e2e/helpers.ts`.

*Seam contract with Task 2 (C2) — defined HERE, implemented against Task 2's row renderer:* `CompareRow` (`src/components/CompareRow.tsx`) accepts an optional prop `marker?: React.ReactNode` and renders `{marker}` **immediately after the label text inside the row's label element** (the `text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice` label styling inherited from main's `CompareField` in `CountryColumn.tsx`). `CompareCountryPanel` passes `marker={rowMarker(<field's _fieldSources key>)}` at the site where Task 1's `COMPARE_FIELDS` defs are mapped to rows. Field keys are `_fieldSources` keys (`'population'`, `'area'`, `'governmentType'`, `'languages'`, `'currencies'`, `'timezones'`, `'region'`); derived rows (Task 3's density) have no `_fieldSources` key, so `rowMarker('density')` returns `null` by construction — pass it anyway or skip it, both are correct. **Intra-plan collision note:** this file quotes `CompareCountryPanel.tsx` as it exists on main; Tasks 1–3 restructure the *columns* region of that file but not its imports-head, `onShareLink`, `panelClasses`, or footer. Anchor edits on the quoted content. If at execution time the row renderer's file or prop naming differs from this contract, do NOT fork the scheme — grep for the label class string `text-[11px] font-medium uppercase tracking-wider` under `src/components/` and wire the same `marker` slot into whichever component renders compare field labels (contingency if C1/C2 somehow have not landed: wire it into `CompareField` in `src/components/CountryColumn.tsx` the same way).

**Data facts this task is designed around** (verified against `src/data/countries.json` on 2026-07-28): `_sources` has exactly two registry entries — `restcountries` ("REST Countries", `https://restcountries.com/`) and `cia-factbook` ("CIA World Factbook (archived)", `https://github.com/factbook/factbook.json`). Per-country `_fieldSources` has 3 distinct shapes: 194 countries attribute `governmentType` → `cia-factbook` and everything else → `restcountries`; 54 (e.g. ALA) are all-`restcountries` with no `governmentType` entry; GNB additionally has `unMember` → `"manual-override"` — a key **not present in `_sources`**, which is why `SourceMarker` null-guards like `SourceTooltip` does. FRA and DEU both carry `governmentType` → `cia-factbook`, making the `#FRA,DEU` deep link a deterministic e2e fixture: dominant = `restcountries`, exactly one exception source, one exception field.

**WCAG (rule: show math):** the marker link reuses the exact shipped footer-link pairing — `text-ice-accessible` (#075985) on the panel's light surface `sand-50` (#fefdfb) = **7.44:1**, and `dark:text-ice` (#7dd3fc) on `dark-400` (#161a22) = **10.45:1** — both ≥ 4.5:1 for text. No new color pair is introduced.

---

- [ ] **Step 1: Write the failing unit test for the marker computation.** Create `src/lib/__tests__/fieldSourceMarkers.test.ts` with exactly:

```ts
import { describe, expect, it } from 'vitest'
import { MARKER_GLYPHS, computeFieldSourceMarkers, dominantSource } from '../fieldSourceMarkers'

describe('dominantSource', () => {
  it('returns null for empty input', () => {
    expect(dominantSource()).toBeNull()
    expect(dominantSource({})).toBeNull()
  })

  it('returns the source attributing the most fields', () => {
    expect(
      dominantSource({
        population: 'restcountries',
        area: 'restcountries',
        governmentType: 'cia-factbook',
      }),
    ).toBe('restcountries')
  })

  it('counts across multiple records (compare passes both countries)', () => {
    // 'b' wins 2:1 only when both records are counted.
    expect(dominantSource({ x: 'a', y: 'b' }, { y: 'b' })).toBe('b')
  })

  it('breaks ties to the lexicographically smallest source key (deterministic rule)', () => {
    expect(dominantSource({ x: 'zebra', y: 'aardvark' })).toBe('aardvark')
  })
})

describe('computeFieldSourceMarkers', () => {
  it('yields an empty exception set when every field shares one source', () => {
    const m = computeFieldSourceMarkers(
      { population: 'restcountries', area: 'restcountries' },
      { population: 'restcountries', area: 'restcountries' },
    )
    expect(m.dominantSource).toBe('restcountries')
    expect(m.markerBySource.size).toBe(0)
    expect(m.markerByField.size).toBe(0)
  })

  it('marks exactly the one differing field with the first glyph', () => {
    const m = computeFieldSourceMarkers({
      population: 'restcountries',
      area: 'restcountries',
      governmentType: 'cia-factbook',
    })
    expect(m.dominantSource).toBe('restcountries')
    expect(m.markerByField.get('governmentType')).toEqual({
      glyph: MARKER_GLYPHS[0],
      source: 'cia-factbook',
    })
    expect(m.markerByField.has('population')).toBe(false)
    expect(m.markerByField.has('area')).toBe(false)
    expect(m.markerBySource.get('cia-factbook')).toBe(MARKER_GLYPHS[0])
  })

  it('marks a field when only ONE of two records differs from the dominant source', () => {
    // GNB-style: unMember is manual-override for country A, restcountries for B.
    const m = computeFieldSourceMarkers(
      { population: 'restcountries', unMember: 'manual-override' },
      { population: 'restcountries', unMember: 'restcountries' },
    )
    expect(m.dominantSource).toBe('restcountries')
    expect(m.markerByField.get('unMember')).toEqual({
      glyph: MARKER_GLYPHS[0],
      source: 'manual-override',
    })
  })

  it('assigns glyphs to exception sources in lexicographic source-key order', () => {
    const m = computeFieldSourceMarkers({
      a: 'dominant',
      b: 'dominant',
      c: 'dominant',
      d: 'zeta-source',
      e: 'alpha-source',
    })
    expect(m.markerBySource.get('alpha-source')).toBe(MARKER_GLYPHS[0])
    expect(m.markerBySource.get('zeta-source')).toBe(MARKER_GLYPHS[1])
  })
})
```

- [ ] **Step 2: Run it and confirm the expected failure.** Run `npx vitest run src/lib/__tests__/fieldSourceMarkers.test.ts` — expect a module-resolution failure (`Failed to resolve import "../fieldSourceMarkers"`). Any other failure means the environment is wrong — stop and diagnose.

- [ ] **Step 3: Implement the module.** Create `src/lib/fieldSourceMarkers.ts` with exactly:

```ts
/**
 * C4/D2 exception-marker scheme — single owner (spec 2026-07-26, item C4;
 * D2 adopts these exports for the single-country panel later — never
 * re-derive dominance elsewhere).
 *
 * A panel shows ONE consolidated sources footer. Field-level attribution
 * granularity is preserved by marking only the exceptions: any field whose
 * source differs from the panel's dominant source carries a superscript
 * glyph keyed to that source's footer entry.
 */

export const MARKER_GLYPHS = ['†', '‡', '§', '¶'] as const // † ‡ § ¶

export interface FieldMarker {
  /** Superscript glyph, e.g. '†'. */
  glyph: string
  /** Key into CountriesFile['_sources'] for the exception source. */
  source: string
}

export interface FieldSourceMarkers {
  /** Source attributing the most fields across all inputs; null for empty input. */
  dominantSource: string | null
  /** Exception source key -> glyph — the footer key. Lexicographic insertion order. */
  markerBySource: ReadonlyMap<string, string>
  /** Field key -> its exception marker. Fields on the dominant source are absent. */
  markerByField: ReadonlyMap<string, FieldMarker>
}

/**
 * The source attributing the most (record, field) pairs. Ties break to the
 * lexicographically smallest source key — deterministic regardless of JSON
 * key order. Variadic so compare passes both countries' _fieldSources and
 * the single panel (D2) passes one.
 */
export function dominantSource(...fieldSourcesList: Array<Record<string, string>>): string | null {
  const counts = new Map<string, number>()
  for (const fieldSources of fieldSourcesList) {
    for (const source of Object.values(fieldSources)) {
      counts.set(source, (counts.get(source) ?? 0) + 1)
    }
  }
  let dominant: string | null = null
  let dominantCount = 0
  for (const [source, count] of counts) {
    if (count > dominantCount || (count === dominantCount && dominant !== null && source < dominant)) {
      dominant = source
      dominantCount = count
    }
  }
  return dominant
}

export function computeFieldSourceMarkers(
  ...fieldSourcesList: Array<Record<string, string>>
): FieldSourceMarkers {
  const dominant = dominantSource(...fieldSourcesList)

  const allSources = new Set<string>()
  const sourcesByField = new Map<string, Set<string>>()
  for (const fieldSources of fieldSourcesList) {
    for (const [field, source] of Object.entries(fieldSources)) {
      allSources.add(source)
      const set = sourcesByField.get(field) ?? new Set<string>()
      set.add(source)
      sourcesByField.set(field, set)
    }
  }

  const markerBySource = new Map<string, string>()
  const exceptionSources = [...allSources].filter((s) => s !== dominant).sort()
  exceptionSources.forEach((source, i) => {
    markerBySource.set(source, MARKER_GLYPHS[i % MARKER_GLYPHS.length])
  })

  const markerByField = new Map<string, FieldMarker>()
  for (const [field, fieldSourceSet] of sourcesByField) {
    // A field is an exception when ANY input record attributes it to a
    // non-dominant source (GNB's unMember differs from FRA's, for example).
    // If a field differed from dominant via two different sources at once,
    // the lexicographically smallest exception source wins the glyph —
    // deterministic; never occurs in the bundled data.
    const exceptions = [...fieldSourceSet].filter((s) => s !== dominant).sort()
    const source = exceptions[0]
    if (source !== undefined) {
      const glyph = markerBySource.get(source)
      if (glyph !== undefined) markerByField.set(field, { glyph, source })
    }
  }

  return { dominantSource: dominant, markerBySource, markerByField }
}
```

- [ ] **Step 4: Run it green.** `npx vitest run src/lib/__tests__/fieldSourceMarkers.test.ts` — all 9 tests pass.

- [ ] **Step 5: Commit the pure module.**

```
git add src/lib/fieldSourceMarkers.ts src/lib/__tests__/fieldSourceMarkers.test.ts
git commit -m "feat(compare): fieldSourceMarkers — dominant source + exception set (C4)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Write the failing component test for `SourceMarker`.** Create `src/components/__tests__/SourceMarker.test.tsx` with exactly (note: this repo has **no jest-dom matchers** — assert via `getAttribute`/`textContent`, matching `SingleCountryPanel.test.tsx` style):

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SourceMarker } from '../SourceMarker'
import { sources } from './singleCountryPanelTestUtils'

describe('SourceMarker (C4 exception marker)', () => {
  it('renders a Tab-reachable link labelled with its source', () => {
    render(<SourceMarker glyph={'†'} sourceKey="restcountries" sources={sources} />)
    const link = screen.getByRole('link', { name: 'Source: REST Countries' })
    expect(link.textContent).toBe('†')
    expect(link.getAttribute('href')).toBe('https://restcountries.com')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.getAttribute('data-testid')).toBe('source-marker-restcountries')
    // In sequential Tab order — the A-batch retired hover-only attribution;
    // regressing to tabIndex={-1} fails here.
    expect(link.tabIndex).toBe(0)
  })

  it('renders nothing when the source key is absent from _sources (GNB manual-override case)', () => {
    const { container } = render(
      <SourceMarker glyph={'†'} sourceKey="manual-override" sources={sources} />,
    )
    expect(container.innerHTML).toBe('')
  })
})
```

- [ ] **Step 7: Run it and confirm the expected failure.** `npx vitest run src/components/__tests__/SourceMarker.test.tsx` — expect `Failed to resolve import "../SourceMarker"`.

- [ ] **Step 8: Implement the component.** Create `src/components/SourceMarker.tsx` with exactly:

```tsx
import type { CountriesFile } from '../lib/types'

interface Props {
  /** Marker glyph from fieldSourceMarkers, e.g. '†'. */
  glyph: string
  /** Key into CountriesFile['_sources'] for the exception source. */
  sourceKey: string
  sources: CountriesFile['_sources']
}

/**
 * Superscript exception marker (C4/D2 scheme): rendered only where a field's
 * source differs from the panel's dominant source, keyed to the glyph shown
 * beside that source in the consolidated footer.
 *
 * A real link in the Tab order with an explicit accessible name — the A-batch
 * retired hover-only attribution affordances; never regress this to
 * tabIndex={-1} or a title-only hint.
 *
 * Renders nothing for source keys absent from _sources (e.g. GNB's
 * 'manual-override'), matching SourceTooltip's guard.
 *
 * Contrast (reuses the shipped footer-link pairing, no new pair):
 * #075985 on #fefdfb = 7.44:1 (light); #7dd3fc on #161a22 = 10.45:1 (dark).
 */
export function SourceMarker({ glyph, sourceKey, sources }: Props) {
  const source = sources[sourceKey] as CountriesFile['_sources'][string] | undefined
  if (!source) return null
  return (
    <sup className="ml-0.5 leading-none">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={`source-marker-${sourceKey}`}
        aria-label={`Source: ${source.name}`}
        className="text-[10px] font-medium text-ice-accessible dark:text-ice hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/60 dark:focus-visible:ring-ice/60 rounded"
      >
        {glyph}
      </a>
    </sup>
  )
}
```

- [ ] **Step 9: Run it green.** `npx vitest run src/components/__tests__/SourceMarker.test.tsx` — both tests pass.

- [ ] **Step 10: Commit the component.**

```
git add src/components/SourceMarker.tsx src/components/__tests__/SourceMarker.test.tsx
git commit -m "feat(compare): SourceMarker superscript attribution link (C4)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 11: Write the failing integration tests.** In `src/components/__tests__/CompareCountryPanel.test.tsx` (currently imports `{ describe, it, expect, vi, beforeEach, afterEach }` from vitest and `{ render, screen, fireEvent, waitFor }` from `@testing-library/react`): add `within` to the Testing Library import, add `import type { CountriesFile } from '../../lib/types'` under the existing imports, then append this describe block at the end of the file:

```tsx
describe('C4 exception source markers', () => {
  // Real-data shape: every field restcountries except governmentType (cia-factbook).
  const FIELD_SOURCES: Record<string, string> = {
    population: 'restcountries',
    area: 'restcountries',
    region: 'restcountries',
    languages: 'restcountries',
    currencies: 'restcountries',
    timezones: 'restcountries',
    governmentType: 'cia-factbook',
  }

  const twoSources: CountriesFile['_sources'] = {
    ...sources,
    'cia-factbook': {
      name: 'CIA World Factbook (archived)',
      url: 'https://github.com/factbook/factbook.json',
      description: 'CC0 JSON archive of the CIA World Factbook',
      lastUpdated: '2026-01-22',
    },
  }

  function renderWithMarkers(
    fieldSourcesA: Record<string, string> = FIELD_SOURCES,
    fieldSourcesB: Record<string, string> = FIELD_SOURCES,
  ) {
    render(
      <CompareCountryPanel
        country={makeCountry({ _fieldSources: fieldSourcesA })}
        compareWith={makeCountry({
          cca3: 'DEU',
          ccn3: '276',
          name: { common: 'Germany', official: 'Federal Republic of Germany' },
          _fieldSources: fieldSourcesB,
        })}
        isDesktop={true}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onExitCompare={vi.fn()}
        byCca3={new Map()}
        sources={twoSources}
      />,
    )
  }

  it('marks only exception rows, Tab-reachable and labelled with the source name', () => {
    renderWithMarkers()
    // governmentType (cia-factbook) is the only non-dominant field.
    const markers = screen.getAllByTestId('source-marker-cia-factbook')
    expect(markers.length).toBeGreaterThanOrEqual(1)
    for (const marker of markers) {
      expect(marker.getAttribute('aria-label')).toBe('Source: CIA World Factbook (archived)')
      expect(marker.tabIndex).toBe(0)
    }
    // Dominant-source rows carry no marker.
    expect(screen.queryAllByTestId('source-marker-restcountries')).toHaveLength(0)
  })

  it('keys the footer: the exception source is listed with its glyph', () => {
    renderWithMarkers()
    const footer = screen.getByTestId('compare-sources')
    expect(within(footer).getByText('†')).toBeTruthy()
    expect(footer.textContent).toContain('CIA World Factbook (archived)')
    expect(footer.textContent).toContain('REST Countries')
  })

  it('renders no markers and no footer glyph when all fields share one source', () => {
    const allRest = { ...FIELD_SOURCES, governmentType: 'restcountries' }
    renderWithMarkers(allRest, allRest)
    expect(screen.queryAllByTestId('source-marker-cia-factbook')).toHaveLength(0)
    expect(within(screen.getByTestId('compare-sources')).queryByText('†')).toBeNull()
  })
})
```

- [ ] **Step 12: Run it and confirm the expected failures.** `npx vitest run src/components/__tests__/CompareCountryPanel.test.tsx` — the three new tests fail (no elements match `source-marker-cia-factbook`; no `†` in the footer). The three pre-existing A15 tests must still pass.

- [ ] **Step 13: Implement the compare integration.** Three edits:

  **(a) `src/components/CompareCountryPanel.tsx` — imports and computation.** After the line `import type { CountryData, CountriesFile } from '../lib/types'` (present on main; Tasks 1–3 change the `CountryColumn` import below it but not this line) add:

```tsx
import { computeFieldSourceMarkers } from '../lib/fieldSourceMarkers'
import { SourceMarker } from './SourceMarker'
```

  Then, immediately before the current line `const panelClasses = isDesktop` (unchanged by Tasks 1–3), insert:

```tsx
  // C4: consolidated attribution with exception markers, computed across BOTH
  // countries' _fieldSources — a row is marked when either country attributes
  // that field to a non-dominant source. Single owner of the scheme:
  // src/lib/fieldSourceMarkers.ts (D2 adopts the same exports for the single
  // panel).
  const fieldMarkers = computeFieldSourceMarkers(country._fieldSources, compareWith._fieldSources)
  const rowMarker = (sourceField: string): React.ReactNode => {
    const marker = fieldMarkers.markerByField.get(sourceField)
    if (!marker) return null
    return <SourceMarker glyph={marker.glyph} sourceKey={marker.source} sources={sources} />
  }
```

  **(b) Footer marker key.** Replace the footer's source list — currently (verbatim on main, inside the `<footer data-testid="compare-sources">` element, and untouched by Tasks 1–3):

```tsx
          {Object.values(sources).map((s, i) => (
            <span key={s.name}>
              {i > 0 && ' · '}
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ice-accessible dark:text-ice hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/60 dark:focus-visible:ring-ice/60 rounded"
              >
                {s.name}
              </a>
            </span>
          ))}
```

  with:

```tsx
          {Object.entries(sources).map(([key, s], i) => (
            <span key={key}>
              {i > 0 && ' · '}
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ice-accessible dark:text-ice hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/60 dark:focus-visible:ring-ice/60 rounded"
              >
                {/* C4 marker key: the glyph precedes the exception source's name
                    so row superscripts resolve here. Dominant source: no glyph. */}
                {fieldMarkers.markerBySource.has(key) && (
                  <sup className="mr-0.5">{fieldMarkers.markerBySource.get(key)}</sup>
                )}
                {s.name}
              </a>
            </span>
          ))}
```

  **(c) Row seam.** In `src/components/CompareRow.tsx` (Task 2's shared row renderer), add to its props interface:

```tsx
  /** C4 seam: exception source marker, rendered inside the label element
      immediately after the label text. */
  marker?: React.ReactNode
```

  and render `{marker}` directly after the label text inside the row's label element (the one styled `text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice`). Then, at the site in `CompareCountryPanel.tsx` where Task 1's `COMPARE_FIELDS` defs are mapped to `CompareRow`s, pass `marker={rowMarker(field.key)}` (where `field.key` is the def's `_fieldSources` key — grep `COMPARE_FIELDS` to find both the defs and the map site). Derived rows (density) get no marker — `rowMarker` returns `null` for keys absent from `_fieldSources`. *Contingency (see seam contract above): if the renderer's names differ, anchor on the label class string; if C1/C2 have not landed, wire the identical slot into `CompareField` in `src/components/CountryColumn.tsx` and pass `marker={rowMarker('population')}` etc. per field.*

- [ ] **Step 14: Run the suite green.** `npx vitest run src/components/__tests__/CompareCountryPanel.test.tsx` — all pass — then the full `npx vitest run` and `npm run lint` to catch type/lint fallout across the restructured compare files. Fix anything the seam edit broke in Task 2's own tests (adding an optional prop must not break them; if a `CompareRow` test asserts exact label `textContent`, the marker is `undefined` there — no change).

- [ ] **Step 15: Same-task docs staleness fix.** In `docs/systems/ui-layout.md` (§ Compare, currently line 109), replace the now-stale clause — verbatim on main:

```
Unlike the single-country panel, fields here are not individually source-tagged; a shared footer (`data-testid="compare-sources"`) lists the comparison's data sources.
```

  with:

```
Attribution is consolidated (C4): a shared footer (`data-testid="compare-sources"`) lists the comparison's data sources, and a superscript marker (†, ‡, …) on a row flags a field whose source differs from the dominant source — the one attributing the most fields across both countries' `_fieldSources`, computed by `src/lib/fieldSourceMarkers.ts` (ties break to the lexicographically smallest source key). Each marker is a Tab-reachable link labelled "Source: <name>" (`data-testid="source-marker-<key>"`) and keys to the glyph shown beside that source in the footer.
```

  (*Collision note:* Tasks 1–3 reword the neighbouring "two `CountryColumn`s side by side" text in the same paragraph — anchor the Edit on this attribution sentence only; if an earlier task already reworded it, update the equivalent sentence to the same effect.) In `docs/systems/accessibility.md`, after the paragraph ending "(see the comment in `SourceTooltip.tsx`)." (line 61), add:

```
The compare panel's exception source markers (C4, `SourceMarker.tsx`) are ordinary links in the Tab order, each labelled `Source: <name>` — unlike the single-panel 'i' buttons above, they are fully keyboard-reachable. D2 extends this scheme to the single panel.
```

- [ ] **Step 16: Commit the integration + docs together.**

```
git add src/components/CompareCountryPanel.tsx src/components/CompareRow.tsx src/components/__tests__/CompareCountryPanel.test.tsx docs/systems/ui-layout.md docs/systems/accessibility.md
git commit -m "feat(compare): exception markers on rows keyed to the sources footer (C4)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

  (If Step 13(c)'s contingency touched `CountryColumn.tsx` instead of `CompareRow.tsx`, `git add` that file instead.)

- [ ] **Step 17: Extend the CI-covered e2e spec.** Append at the end of `e2e/compare-source-attribution.spec.ts` (after the closing `})` of the `compare header controls (A15)` describe):

```ts
test.describe('exception source markers (C4)', () => {
  test('the cia-factbook exception marker appears and keys to the footer', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,DEU')
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 15_000 })

    // Deterministic in the bundled data: FRA and DEU both attribute
    // governmentType to cia-factbook while every other field comes from
    // restcountries (the dominant source) — Government is the exception row.
    const marker = page.getByTestId('source-marker-cia-factbook').first()
    await expect(marker).toBeVisible({ timeout: 10_000 })
    await expect(marker).toHaveText('†')
    await expect(marker).toHaveAttribute('aria-label', 'Source: CIA World Factbook (archived)')
    await expect(marker).toHaveAttribute('target', '_blank')

    // Dominant-source rows carry no marker.
    await expect(page.getByTestId('source-marker-restcountries')).toHaveCount(0)

    // The footer lists the exception source with its marker key.
    const footer = page.getByTestId('compare-sources')
    await expect(footer).toContainText('†')
    await expect(footer).toContainText('CIA World Factbook (archived)')
  })

  test('markers are keyboard-reachable, not hover-only', async ({ page }) => {
    await gotoAndWaitForMap(page, '/#FRA,DEU')
    await expect(page.getByTestId('country-panel')).toBeVisible({ timeout: 15_000 })
    // Autofocus-settle (same rationale as the source-links test above):
    // App.tsx's panel-open effect moves focus to panel-close ~300ms after the
    // deep-linked panel mounts. Wait for it to land BEFORE driving focus, so
    // the timer can't steal focus back mid-test.
    await expect(page.getByTestId('panel-close')).toBeFocused({ timeout: 5_000 })

    const marker = page.getByTestId('source-marker-cia-factbook').first()
    await marker.focus()
    await expect(marker).toBeFocused()
    // tabIndex 0 = in sequential Tab order; regressing to the retired
    // hover-only pattern (tabIndex={-1}) fails here.
    expect(await marker.evaluate((el) => (el as HTMLElement).tabIndex)).toBe(0)
  })
})
```

- [ ] **Step 18: Run the e2e spec green.** Kill any stray dev server first (project memory: a reused `npm run dev` lacks `VITE_TEST_HOOKS`) — check with `netstat -ano | findstr :5173` and stop the PID if present. Then `npx playwright test e2e/compare-source-attribution.spec.ts --project=chromium --workers=2` — all 7 tests (5 existing + 2 new) pass. The existing footer tests must still pass with the glyph now inside the CIA link's text (they assert `href`/`target`/`rel` and non-empty text only — verified compatible).

- [ ] **Step 19: Commit the e2e extension.**

```
git add e2e/compare-source-attribution.spec.ts
git commit -m "test(e2e): compare exception markers — footer key + keyboard reachability (C4)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 5: C5 — labeled Compare entry (desktop pill) + one-time compare tip

**Scope statement:** Two commits. Commit 1 replaces the desktop icon-only compare button in `SingleCountryPanel` with an icon + "Compare" text pill (mobile keeps the icon — D4 owns the mobile labeled chip). Commit 2 extends the `useFirstVisitHint` machine with a third hint kind `'compare'` that fires once, after the user's second DISTINCT country selection in a session, only while a country panel is open, never during games, desktop-only (matching the pill this tip points at).

**Analytics: this task ships NO new telemetry.** The spec lists C5 as a telemetry *candidate*; the workstream decision is to ship none. Do not add `track()` calls.

**Docs:** `docs/systems/` was grepped for `hint`, `Compare with another`, and `compare entry` — zero matches, so no systems-doc update is owed by this task.

**Files:**
- `src/components/SingleCountryPanel.tsx` — compare entry button (lines ~241–253 on main)
- `src/components/__tests__/SingleCountryPanel.test.tsx` — new describe (pill)
- `src/hooks/useFirstVisitHint.ts` — full rewrite (third hint kind)
- `src/hooks/__tests__/useFirstVisitHint.test.tsx` — full rewrite (new arg shape + compare tests)
- `src/App.tsx` — hook call site moves below `comparePickingMode`; hint-pill render condition; `data-testid="onboarding-hint"`
- `e2e/compare-view-dimming.spec.ts` — two new describes appended (pill visibility+label; tip lifecycle)

**Interfaces:**

*Produces (later tasks import/consume these):*
- `OnboardingHint = 'explore' | 'game' | 'compare'` (exported from `src/hooks/useFirstVisitHint.ts`)
- `useFirstVisitHint(inputs: { mapReady: boolean; selectedCca3: string | null; gameActive: boolean; compareActive: boolean; isDesktop: boolean }): { hint: OnboardingHint | null }` — **breaking change from the current `{ mapReady, hasSelection, gameActive }` shape**; App.tsx is the only consumer (verified by grep) and is updated in the same commit. D4 (mobile labeled chip, separate plan) will revisit the `isDesktop` gate.
- localStorage key `funworldmap-hint-compare-shown` (once-per-browser gate, same family as `funworldmap-hint-explore-shown` / `funworldmap-hint-game-shown`)
- `data-testid="onboarding-hint"` on App's hint pill; `data-testid="compare-entry"` on the panel's compare button
- Tip copy: `'Tip: compare two countries side by side'` — **needs no capability gating**: it names no input modality (no "click"/"tap"/"/" ), so it is identical for touch and fine pointers; a unit test pins `hintCopy('compare', true) === hintCopy('compare', false)`.

*Consumes (canonical owners — do NOT redefine):*
- `TOUCH_TARGET_FROM_36` from `src/lib/layoutConstants.ts` (A13 convention constant; `src/lib/__tests__/layoutConstants.test.ts` pins that `SingleCountryPanel.tsx` contains the string `TOUCH_TARGET_FROM_36` — the pill keeps consuming it, so that pin stays green untouched)
- Existing pill styling classes in App.tsx (the tip reuses the exact same hint-pill div; only the render condition and a testid change)

**aria-label decision: PRESERVE `aria-label="Compare with another country"` on the button.** An `aria-label` overrides content for the accessible name, so every existing locator keeps working with zero re-anchoring; WCAG 2.5.3 (Label in Name) is satisfied because the accessible name contains the visible label "Compare". The specs that stay green *because* of this decision (verify each after commit 1): `e2e/a11y-contrast.spec.ts:32,153`, `e2e/compare-map-clicks.spec.ts:140`, `e2e/compare-view-dimming.spec.ts:138,147`, `e2e/game-country-pinning.spec.ts:244`, `e2e/mobile-panel-header.spec.ts:53`. Note `mobile-panel-header.spec.ts` runs at 360/375/414px viewports — below the 1024px desktop cutoff — so those tests exercise the unchanged icon-only branch.

**Contrast math (WCAG floors):** the pill text reuses the button's existing `text-ice-dim dark:text-ice`, but text (4.5:1 floor) is stricter than the icon's 3:1, so show it holds:
- Light: `--color-ice-dim` `#0369a1` (relative luminance 0.1270) on panel header `--color-sand-50` `#fefdfb` (0.9829) → (0.9829+0.05)/(0.1270+0.05) = **5.84:1 ≥ 4.5:1 ✓**
- Dark: `--color-ice` `#7dd3fc` (0.5798) on `--color-dark-400` `#161a22` (0.0103) → **10.4:1 ≥ 4.5:1 ✓**
- The pill's `border-ice-dim/30` outline is decorative (the button is identified by its text and hover surface), so the 3:1 non-text floor is not binding on it.
- The tip pill is the *existing* App hint pill (`text-ice` on `bg-dark-400/80`) — no new pairing.

**Intra-plan collision note:** this task edits the `SingleCountryPanel` header action row and appends to `e2e/compare-view-dimming.spec.ts`. Earlier tasks in this plan (C1/C2/C6) edit `CompareCountryPanel`/`CompareField` and the compare camera, not these blocks — but if execution order shifted, anchor edits on the quoted content below, not line numbers. All quoted "current code" is from main post-#131/#132/#133 (ice/signal migration landed).

---

#### Commit 1 — desktop labeled Compare pill

- [ ] **Step 1 — failing unit test.** Append this describe to the end of `src/components/__tests__/SingleCountryPanel.test.tsx` (after the `compare-picking banner (A7)` describe). Add `TOUCH_TARGET_FROM_36` to the file's imports by inserting after the existing `singleCountryPanelTestUtils` import block:

  ```tsx
  import { TOUCH_TARGET_FROM_36 } from '../../lib/layoutConstants'
  ```

  ```tsx
  describe('SingleCountryPanel — labeled compare entry (C5)', () => {
    function renderAt(isDesktop: boolean) {
      return render(
        <SingleCountryPanel
          country={makeCountry()}
          comparePickingMode={false}
          sources={sources}
          isDesktop={isDesktop}
          onSelect={() => {}}
          onClose={() => {}}
          onEnterCompare={() => {}}
          onCancelCompare={() => {}}
          byCca3={new Map()}
        />,
      )
    }

    it('desktop: icon + "Compare" text pill, aria-label preserved, A13 constant consumed', () => {
      const { getByRole } = renderAt(true)
      // aria-label overrides content — every e2e locator keyed on this name
      // keeps working (WCAG 2.5.3 holds: the name contains the visible text).
      const btn = getByRole('button', { name: 'Compare with another country' })
      expect(btn.textContent).toBe('Compare')
      expect(btn.className).toContain('rounded-full')
      expect(btn.className).toContain(TOUCH_TARGET_FROM_36)
      expect(btn.getAttribute('data-testid')).toBe('compare-entry')
    })

    it('mobile: the entry stays icon-only (D4 owns the mobile labeled chip)', () => {
      const { getByRole } = renderAt(false)
      const btn = getByRole('button', { name: 'Compare with another country' })
      expect(btn.textContent).toBe('')
      expect(btn.className).toContain('p-2 rounded-xl')
      expect(btn.className).toContain(TOUCH_TARGET_FROM_36)
    })
  })
  ```

- [ ] **Step 2 — run, expect failure.** `npx vitest run src/components/__tests__/SingleCountryPanel.test.tsx` — the two new tests fail: desktop `textContent` is `''` (icon-only), no `rounded-full`, no `data-testid`. All pre-existing tests stay green.

- [ ] **Step 3 — implementation.** In `src/components/SingleCountryPanel.tsx`, replace the current compare-entry button (this exact block, currently at lines 241–253):

  ```tsx
            {!comparePickingMode && !inGameRound && (
              <button
                onClick={onEnterCompare}
                className={`p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-ice-dim dark:text-ice transition-colors ${TOUCH_TARGET_FROM_36}`}
                aria-label="Compare with another country"
                title="Compare"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="9" cy="12" r="6" strokeWidth="1.75" />
                  <circle cx="15" cy="12" r="6" strokeWidth="1.75" />
                </svg>
              </button>
            )}
  ```

  with:

  ```tsx
            {!comparePickingMode && !inGameRound && (
              <button
                onClick={onEnterCompare}
                data-testid="compare-entry"
                // C5: desktop gets an icon + text pill (the 20px hover-title-only
                // icon was the least discoverable control in the audit); mobile
                // keeps the icon — D4 owns the sheet's labeled compare chip.
                // Desktop pill box: py-2 (2·8px) + 20px icon/text-sm line = 36px,
                // so TOUCH_TARGET_FROM_36 keeps the A13 44px coarse-pointer math
                // honest on both branches. Text contrast (4.5:1 floor): ice-dim
                // #0369a1 on sand-50 #fefdfb = 5.84:1; ice #7dd3fc on dark-400
                // #161a22 = 10.4:1. aria-label preserved — it overrides content,
                // so existing e2e locators and WCAG 2.5.3 both hold.
                className={`${
                  isDesktop
                    ? 'flex items-center gap-1.5 px-3 py-2 rounded-full border border-ice-dim/30 dark:border-ice/30 text-sm font-medium'
                    : 'p-2 rounded-xl'
                } hover:bg-sand-200 dark:hover:bg-dark-300 text-ice-dim dark:text-ice transition-colors ${TOUCH_TARGET_FROM_36}`}
                aria-label="Compare with another country"
                title="Compare"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="9" cy="12" r="6" strokeWidth="1.75" />
                  <circle cx="15" cy="12" r="6" strokeWidth="1.75" />
                </svg>
                {isDesktop && <span>Compare</span>}
              </button>
            )}
  ```

  (Tailwind's scanner is satisfied: every class token appears literally in the source. `layoutConstants.test.ts`'s pins on `SingleCountryPanel.tsx` — `TOUCH_TARGET_FROM_36`, `TOUCH_TARGET_FROM_22`, `compare-picking-cancel`, `w-3.5 h-3.5` — all survive this edit.)

- [ ] **Step 4 — run green.** `npx vitest run src/components/__tests__/SingleCountryPanel.test.tsx src/lib/__tests__/layoutConstants.test.ts` — all green.

- [ ] **Step 5 — e2e pill test.** Append to the end of `e2e/compare-view-dimming.spec.ts` (after the `B4 spotlight` describe; the file already imports `waitForMapLoaded`):

  ```ts
  test.describe('C5 — labeled compare entry', () => {
    test('desktop entry is an icon + "Compare" text pill with the preserved aria-label', async ({
      page,
    }) => {
      await page.goto('/#FRA')
      await waitForMapLoaded(page)
      await expect(page.getByTestId('country-panel')).toContainText('France', { timeout: 15_000 })

      // Same accessible name as before C5 — aria-label overrides content, so
      // every pre-existing locator on this name still resolves.
      const compareBtn = page.getByRole('button', { name: 'Compare with another country' })
      await expect(compareBtn).toBeVisible()
      // Desktop project viewport (1280px ≥ 1024px cutoff): visible text label.
      await expect(compareBtn).toContainText('Compare')
    })
  })
  ```

- [ ] **Step 6 — run e2e.** Kill any stray dev server first (project memory: a reused `npm run dev` lacks `VITE_TEST_HOOKS`): `netstat -ano | findstr :5173` and stop the owning process if found. Then `npx playwright test e2e/compare-view-dimming.spec.ts --project=chromium --workers=2` — all green (new test plus the five pre-existing describes).

- [ ] **Step 7 — run the aria-label-anchored specs locally** (several are CI-ignored, so local is the only guard): `npx playwright test e2e/compare-map-clicks.spec.ts e2e/mobile-panel-header.spec.ts e2e/a11y-contrast.spec.ts e2e/game-country-pinning.spec.ts --project=chromium --workers=2` — all green with zero edits to those files.

- [ ] **Step 8 — commit.**

  ```
  git add src/components/SingleCountryPanel.tsx src/components/__tests__/SingleCountryPanel.test.tsx e2e/compare-view-dimming.spec.ts
  git commit -m "feat(panel): desktop compare entry becomes a labeled icon+text pill (C5)" -m "aria-label 'Compare with another country' preserved so all six existing e2e anchors keep resolving; mobile keeps the icon (D4 owns the sheet chip); TOUCH_TARGET_FROM_36 kept on both branches (36px pill box). Text contrast: ice-dim/sand-50 5.84:1, ice/dark-400 10.4:1. No new telemetry." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

#### Commit 2 — one-time compare tip via the hint machine

- [ ] **Step 9 — failing unit tests.** Replace the entire contents of `src/hooks/__tests__/useFirstVisitHint.test.tsx` (currently the two-hint version whose `args` helper builds `{ mapReady, hasSelection, gameActive }`) with:

  ```tsx
  import { renderHook, act } from '@testing-library/react'
  import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
  import { hintCopy, useFirstVisitHint } from '../useFirstVisitHint'

  interface HintArgs {
    mapReady: boolean
    selectedCca3: string | null
    gameActive: boolean
    compareActive: boolean
    isDesktop: boolean
  }

  const args = (o: Partial<HintArgs> = {}): HintArgs => ({
    mapReady: true,
    selectedCca3: null,
    gameActive: false,
    compareActive: false,
    isDesktop: true,
    ...o,
  })

  describe('useFirstVisitHint', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      localStorage.clear()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    describe('explore hint', () => {
      it('shows 1.5s after map-ready when idle and persists the gate in localStorage', () => {
        const { result } = renderHook(() => useFirstVisitHint(args()))
        expect(result.current.hint).toBe(null)
        act(() => {
          vi.advanceTimersByTime(1500)
        })
        expect(result.current.hint).toBe('explore')
        expect(localStorage.getItem('funworldmap-hint-explore-shown')).toBe('1')
      })

      it('does not show if the map is not ready', () => {
        const { result } = renderHook(() => useFirstVisitHint(args({ mapReady: false })))
        act(() => {
          vi.advanceTimersByTime(2000)
        })
        expect(result.current.hint).toBe(null)
      })

      it('does not show again on a later pageload — localStorage gate, not per-tab', () => {
        localStorage.setItem('funworldmap-hint-explore-shown', '1')
        const { result } = renderHook(() => useFirstVisitHint(args()))
        act(() => {
          vi.advanceTimersByTime(2000)
        })
        expect(result.current.hint).toBe(null)
      })

      it('dismisses (and suppresses) once a selection or game starts', () => {
        const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
          initialProps: args(),
        })
        act(() => {
          vi.advanceTimersByTime(1500)
        })
        expect(result.current.hint).toBe('explore')
        rerender(args({ gameActive: true }))
        expect(result.current.hint).toBe(null)
        // stays dismissed even back at idle
        rerender(args())
        act(() => {
          vi.advanceTimersByTime(2000)
        })
        expect(result.current.hint).toBe(null)
      })
    })

    describe('game hint', () => {
      it('shows when the first country panel closes and persists the gate in localStorage', () => {
        const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
          initialProps: args({ selectedCca3: 'FRA' }),
        })
        expect(result.current.hint).toBe(null)
        rerender(args())
        expect(result.current.hint).toBe('game')
        expect(localStorage.getItem('funworldmap-hint-game-shown')).toBe('1')
      })

      it('never shows twice — gate honored on a later pageload', () => {
        localStorage.setItem('funworldmap-hint-game-shown', '1')
        const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
          initialProps: args({ selectedCca3: 'FRA' }),
        })
        rerender(args())
        expect(result.current.hint).toBe(null)
      })

      it('shows even after the explore hint was shown and dismissed', () => {
        const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
          initialProps: args(),
        })
        act(() => {
          vi.advanceTimersByTime(1500)
        })
        expect(result.current.hint).toBe('explore')
        rerender(args({ selectedCca3: 'FRA' })) // selecting dismisses the explore hint
        expect(result.current.hint).toBe(null)
        rerender(args()) // first panel close
        expect(result.current.hint).toBe('game')
      })

      it('a game session marks it moot without showing it', () => {
        const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
          initialProps: args(),
        })
        rerender(args({ gameActive: true }))
        expect(localStorage.getItem('funworldmap-hint-game-shown')).toBe('1')
        rerender(args())
        rerender(args({ selectedCca3: 'FRA' }))
        rerender(args()) // panel close after having played
        expect(result.current.hint).toBe(null)
      })

      it('dismisses on the next selection and never re-shows', () => {
        const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
          initialProps: args({ selectedCca3: 'FRA' }),
        })
        rerender(args())
        expect(result.current.hint).toBe('game')
        rerender(args({ selectedCca3: 'FRA' }))
        expect(result.current.hint).toBe(null)
        rerender(args())
        expect(result.current.hint).toBe(null)
      })
    })

    describe('compare tip (C5)', () => {
      it('fires on the second DISTINCT selection while the panel is open and persists the gate', () => {
        const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
          initialProps: args({ selectedCca3: 'FRA' }),
        })
        expect(result.current.hint).toBe(null)
        rerender(args({ selectedCca3: 'DEU' }))
        expect(result.current.hint).toBe('compare')
        expect(localStorage.getItem('funworldmap-hint-compare-shown')).toBe('1')
      })

      it('re-selecting the same country never counts twice', () => {
        localStorage.setItem('funworldmap-hint-game-shown', '1') // isolate from the game hint
        const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
          initialProps: args({ selectedCca3: 'FRA' }),
        })
        rerender(args())
        rerender(args({ selectedCca3: 'FRA' })) // same country again — still 1 distinct
        expect(result.current.hint).toBe(null)
        rerender(args({ selectedCca3: 'DEU' })) // genuinely distinct — 2nd
        expect(result.current.hint).toBe('compare')
      })

      it('gate honored on a later pageload', () => {
        localStorage.setItem('funworldmap-hint-compare-shown', '1')
        const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
          initialProps: args({ selectedCca3: 'FRA' }),
        })
        rerender(args({ selectedCca3: 'DEU' }))
        expect(result.current.hint).toBe(null)
      })

      it('never fires during games, and game-time selections do not count', () => {
        const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
          initialProps: args({ gameActive: true, selectedCca3: 'FRA' }),
        })
        rerender(args({ gameActive: true, selectedCca3: 'DEU' }))
        expect(result.current.hint).toBe(null)
        // After the game, two distinct selections are still required.
        rerender(args({ selectedCca3: 'ITA' }))
        expect(result.current.hint).toBe(null)
        rerender(args({ selectedCca3: 'ESP' }))
        expect(result.current.hint).toBe('compare')
      })

      it('desktop-only (C5 scope) — and the gate is NOT burned on mobile, so D4 can revisit', () => {
        const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
          initialProps: args({ isDesktop: false, selectedCca3: 'FRA' }),
        })
        rerender(args({ isDesktop: false, selectedCca3: 'DEU' }))
        expect(result.current.hint).toBe(null)
        expect(localStorage.getItem('funworldmap-hint-compare-shown')).toBe(null)
      })

      it('entering compare before the tip ever showed marks it moot', () => {
        const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
          initialProps: args({ selectedCca3: 'FRA' }),
        })
        rerender(args({ selectedCca3: 'FRA', compareActive: true }))
        expect(localStorage.getItem('funworldmap-hint-compare-shown')).toBe('1')
        rerender(args({ selectedCca3: 'DEU' })) // 2nd distinct, but gate already burned
        expect(result.current.hint).toBe(null)
      })

      it('dismisses on panel close and never re-shows', () => {
        localStorage.setItem('funworldmap-hint-game-shown', '1') // isolate from the game hint
        const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
          initialProps: args({ selectedCca3: 'FRA' }),
        })
        rerender(args({ selectedCca3: 'DEU' }))
        expect(result.current.hint).toBe('compare')
        rerender(args())
        expect(result.current.hint).toBe(null)
        rerender(args({ selectedCca3: 'ESP' })) // 3rd distinct — gate is burned
        expect(result.current.hint).toBe(null)
      })

      it('precedence: a visible game hint yields to the compare tip on the second distinct selection', () => {
        const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
          initialProps: args({ selectedCca3: 'FRA' }),
        })
        rerender(args()) // first panel close → game hint
        expect(result.current.hint).toBe('game')
        rerender(args({ selectedCca3: 'DEU' })) // 2nd distinct selection
        expect(result.current.hint).toBe('compare')
      })

      it('precedence: on panel close a visible compare tip yields to a not-yet-shown game hint (sequential, never racing)', () => {
        const { result, rerender } = renderHook((p) => useFirstVisitHint(p), {
          initialProps: args({ selectedCca3: 'FRA' }),
        })
        rerender(args({ selectedCca3: 'DEU' }))
        expect(result.current.hint).toBe('compare')
        rerender(args())
        expect(result.current.hint).toBe('game')
      })
    })

    describe('hintCopy', () => {
      it('gives fine pointers the click + slash copy', () => {
        expect(hintCopy('explore', true)).toBe('Click a country to explore — or press / to search')
      })

      it('gives coarse pointers tap copy without the slash clause', () => {
        expect(hintCopy('explore', false)).toBe('Tap a country to explore')
      })

      it('game copy is pointer-independent', () => {
        expect(hintCopy('game', true)).toBe('Try a game — guess countries and cities')
        expect(hintCopy('game', false)).toBe('Try a game — guess countries and cities')
      })

      it('compare copy is pointer-independent — names no input modality, so no capability gating (A14) is needed', () => {
        expect(hintCopy('compare', true)).toBe('Tip: compare two countries side by side')
        expect(hintCopy('compare', false)).toBe('Tip: compare two countries side by side')
      })
    })
  })
  ```

- [ ] **Step 10 — run, expect failure.** `npx vitest run src/hooks/__tests__/useFirstVisitHint.test.tsx` — the compare-tip describe fails (`hint` stays `null`; the current hook has no `'compare'` kind), the game-hint tests fail (the current hook reads a `hasSelection` prop the new `args` no longer provides, so it never sees a selection transition), and the `hintCopy` compare test fails. The explore tests may incidentally pass — that's fine.

- [ ] **Step 11 — implement the hook.** Replace the entire contents of `src/hooks/useFirstVisitHint.ts` (currently the two-hint version with `export type OnboardingHint = 'explore' | 'game'` and a `hasSelection: boolean` input) with:

  ```ts
  import { useEffect, useRef, useState } from 'react'

  const EXPLORE_HINT_KEY = 'funworldmap-hint-explore-shown'
  const GAME_HINT_KEY = 'funworldmap-hint-game-shown'
  const COMPARE_HINT_KEY = 'funworldmap-hint-compare-shown'

  export type OnboardingHint = 'explore' | 'game' | 'compare'

  // localStorage, not sessionStorage: each hint shows once per browser, ever —
  // the old per-tab gate re-nagged returning users in every new tab (A12).
  // A storage failure (blocked cookies) counts as "shown": a hint that cannot
  // persist its gate would otherwise re-nag on every load.
  function wasShown(key: string): boolean {
    try {
      return localStorage.getItem(key) !== null
    } catch {
      return true
    }
  }

  function markShown(key: string): void {
    try {
      localStorage.setItem(key, '1')
    } catch {
      /* private-mode / quota — best effort */
    }
  }

  /** Hint pill copy. Coarse pointers get tap wording without the `/` clause (A14).
   *  The game and compare copy name no input modality, so they are deliberately
   *  pointer-independent — no capability gating needed (C5). */
  export function hintCopy(hint: OnboardingHint, finePointer: boolean): string {
    if (hint === 'game') return 'Try a game — guess countries and cities'
    if (hint === 'compare') return 'Tip: compare two countries side by side'
    return finePointer
      ? 'Click a country to explore — or press / to search'
      : 'Tap a country to explore'
  }

  /**
   * Drives the three one-time onboarding hints (each gated by localStorage —
   * once per browser, ever):
   * - 'explore': 1.5s after the map is ready, while nothing is selected and no
   *   game is active.
   * - 'game': immediately after the user closes their first country panel.
   *   Starting a game marks it moot without showing it.
   * - 'compare' (C5): on the user's second DISTINCT country selection of the
   *   session (in-memory count — a "session" is one page lifetime), only while
   *   a country panel is open, never during games, and only on desktop where
   *   the labeled Compare pill exists (D4 owns the mobile chip and revisits
   *   the gate — the localStorage gate is deliberately NOT burned on mobile).
   *   Entering compare before the tip ever showed marks it moot.
   *
   * Visibility contract per kind: explore/game live only while nothing is
   * selected; compare lives only while a panel is open. Games and entering
   * compare dismiss everything.
   *
   * Precedence (so 'game' and 'compare' never race): their firing conditions
   * are disjoint (game fires on the selected → deselected edge; compare fires
   * while a selection exists), and on the one render where both the game-hint
   * DISMISSAL and the compare SET can queue state (second distinct selection
   * while the game hint is visible), the dismissal effect is defined before
   * the compare effect, so setHint('compare') is queued last and wins the
   * commit. The reverse handoff (compare tip visible, panel closes, game hint
   * not yet shown) resolves the same way: dismissal queues null, then the
   * game effect (defined last) queues 'game' — sequential handoff, never a race.
   */
  export function useFirstVisitHint({
    mapReady,
    selectedCca3,
    gameActive,
    compareActive,
    isDesktop,
  }: {
    mapReady: boolean
    selectedCca3: string | null
    gameActive: boolean
    compareActive: boolean
    isDesktop: boolean
  }): { hint: OnboardingHint | null } {
    const [hint, setHint] = useState<OnboardingHint | null>(null)
    const [dismissed, setDismissed] = useState(false)
    const hasSelection = selectedCca3 !== null
    const prevSelectionRef = useRef(hasSelection)
    // In-memory on purpose: the distinct-selection count resets on reload
    // (the localStorage gate still caps the tip at once per browser, ever).
    const distinctSelectionsRef = useRef<Set<string>>(new Set())

    useEffect(() => {
      if (!mapReady || hasSelection || dismissed || gameActive || hint !== null) return
      if (wasShown(EXPLORE_HINT_KEY)) return
      const timer = setTimeout(() => {
        setHint('explore')
        markShown(EXPLORE_HINT_KEY)
      }, 1500)
      return () => clearTimeout(timer)
    }, [mapReady, hasSelection, dismissed, gameActive, hint])

    // Dismissal — MUST stay defined before the compare effect (see the
    // precedence note in the hook docstring).
    useEffect(() => {
      if (!hint) return
      const outlivedItsState =
        hint === 'compare' ? !hasSelection || compareActive : hasSelection
      if (gameActive || outlivedItsState) {
        setHint(null)
        setDismissed(true)
      }
    }, [hasSelection, gameActive, compareActive, hint])

    // Compare tip (C5). hasSelection is true on the render that adds the
    // second cca3, so the tip only ever fires while a panel is open.
    useEffect(() => {
      if (gameActive || selectedCca3 === null) return
      distinctSelectionsRef.current.add(selectedCca3)
      if (compareActive) {
        // The user already found compare on their own — never nag them.
        markShown(COMPARE_HINT_KEY)
        return
      }
      if (!isDesktop) return
      if (distinctSelectionsRef.current.size < 2) return
      if (wasShown(COMPARE_HINT_KEY)) return
      setHint('compare')
      markShown(COMPARE_HINT_KEY)
    }, [selectedCca3, gameActive, compareActive, isDesktop])

    // Game hint: fires on the selected → deselected transition (a panel close).
    // Any game session marks it moot instead — including App's automatic
    // deselect when round 0 starts, where gameActive is already true on the
    // same render, so a game start can never masquerade as a panel close.
    useEffect(() => {
      const wasSelected = prevSelectionRef.current
      prevSelectionRef.current = hasSelection
      if (gameActive) {
        markShown(GAME_HINT_KEY)
        return
      }
      if (!wasSelected || hasSelection) return
      if (wasShown(GAME_HINT_KEY)) return
      setHint('game')
      markShown(GAME_HINT_KEY)
    }, [hasSelection, gameActive])

    return { hint }
  }
  ```

- [ ] **Step 12 — run green.** `npx vitest run src/hooks/__tests__/useFirstVisitHint.test.tsx` — all green.

- [ ] **Step 13 — wire App.tsx.** Three edits:

  (a) Remove the hook call from its current position — replace:

  ```ts
    const finePointer = useMediaQuery(FINE_POINTER_MEDIA_QUERY)
    const { hint } = useFirstVisitHint({
      mapReady,
      hasSelection: !!selected,
      gameActive: session.status !== 'idle',
    })
  ```

  with:

  ```ts
    const finePointer = useMediaQuery(FINE_POINTER_MEDIA_QUERY)
  ```

  (b) Re-insert it below the state it now consumes — replace:

  ```ts
    const [comparePickingMode, setComparePickingMode] = useState(false)
  ```

  with:

  ```ts
    const [comparePickingMode, setComparePickingMode] = useState(false)

    // Below comparePickingMode's declaration because the hint machine consumes
    // it (compareActive marks the compare tip moot — C5). Hook order is still
    // stable across renders; only the source position moved.
    const { hint } = useFirstVisitHint({
      mapReady,
      selectedCca3: selected?.cca3 ?? null,
      gameActive: session.status !== 'idle',
      compareActive: !!compareWith || comparePickingMode,
      isDesktop,
    })
  ```

  (c) Render condition + testid — the compare tip must render *while* the panel is open (the inverse of the other two hints). Replace:

  ```tsx
        {hint && !selected && !gameActive && (
          <div
            role="status"
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 px-5 py-2.5 rounded-full bg-dark-400/80 dark:bg-dark-300/80 backdrop-blur-sm border border-ice/20 text-ice text-sm shadow-lg pointer-events-none"
            style={{ animation: 'fade-up 300ms ease-out' }}
          >
            {hintCopy(hint, finePointer)}
          </div>
        )}
  ```

  with:

  ```tsx
        {/* explore/game hints render on the empty map; the compare tip (C5)
            renders while a panel is open. Same pill, pointer-events-none,
            non-focusable — it can never intercept clicks or shift Tab order. */}
        {hint && !gameActive && (hint === 'compare' ? !!selected : !selected) && (
          <div
            role="status"
            data-testid="onboarding-hint"
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 px-5 py-2.5 rounded-full bg-dark-400/80 dark:bg-dark-300/80 backdrop-blur-sm border border-ice/20 text-ice text-sm shadow-lg pointer-events-none"
            style={{ animation: 'fade-up 300ms ease-out' }}
          >
            {hintCopy(hint, finePointer)}
          </div>
        )}
  ```

  (On desktop the pill sits bottom-center, clear of the right-docked 360px panel. Mobile is moot: the tip is desktop-gated in the machine, so it never renders under the bottom sheet and never burns the gate there.)

- [ ] **Step 14 — full unit + type gate.** `npm run check` — green (this catches the App.tsx call-site type mismatch if step 13 was incomplete, plus lint).

- [ ] **Step 15 — e2e tip test.** Append to the end of `e2e/compare-view-dimming.spec.ts`, inside the `C5 — labeled compare entry` describe added in commit 1 (rename nothing; add a second test):

  ```ts
    test('tip fires once on the second distinct selection, hands off to the game hint on close, never re-fires', async ({
      page,
    }) => {
      await page.goto('/#FRA')
      await waitForMapLoaded(page)
      await expect(page.getByTestId('country-panel')).toContainText('France', { timeout: 15_000 })

      // First distinct selection (the deep link) — no tip yet.
      const pill = page.getByTestId('onboarding-hint')
      await expect(pill).not.toBeAttached()

      // Second distinct selection via the hash — the same select path the app
      // uses (this file's exit-compare tests already drive selection this way).
      await page.evaluate(() => {
        window.location.hash = '#DEU'
      })
      await expect(page.getByTestId('country-panel')).toContainText('Germany')
      await expect(pill).toBeVisible()
      await expect(pill).toHaveText('Tip: compare two countries side by side')

      // Closing the panel dismisses the tip; with a fresh localStorage the
      // never-shown game hint takes over the pill — the documented sequential
      // handoff (compare → game), pinned here on the copy swap.
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('country-panel')).not.toBeAttached()
      await expect(pill).toHaveText('Try a game — guess countries and cities')

      // A third distinct selection dismisses the game hint and must NOT
      // re-fire the compare tip — its localStorage gate is burned.
      await page.evaluate(() => {
        window.location.hash = '#ESP'
      })
      await expect(page.getByTestId('country-panel')).toContainText('Spain')
      await expect(pill).not.toBeAttached()
    })
  ```

  (No `waitForTimeout`, no `force: true`; every step is an auto-retrying expect keyed on DOM state. The pill animates via a one-shot CSS `fade-up`, but no assertion here depends on animation completion — and the chromium project runs `reducedMotion: 'reduce'` anyway.)

- [ ] **Step 16 — run e2e.** Kill stray dev servers on :5173 as in step 6, then `npx playwright test e2e/compare-view-dimming.spec.ts --project=chromium --workers=2` — all green.

- [ ] **Step 17 — regression sweep of specs that select countries or observe the pill** (localStorage is fresh per test context, so the tip CAN fire in any desktop spec that selects two distinct countries — the pill is `pointer-events-none`, `z-20` (below the `z-40` panels) and non-focusable, so it must not break anything; this sweep proves it): `npx playwright test e2e/panel-and-deeplink.spec.ts e2e/panel-focus.spec.ts e2e/a11y-keyboard-smoke.spec.ts e2e/accessibility.spec.ts e2e/axe-snapshot.spec.ts e2e/compare-map-clicks.spec.ts e2e/game-country-pinning.spec.ts --project=chromium --workers=2` — all green. If an axe spec flags the pill, it is the pre-existing hint-pill styling (text-ice on dark-400/80 — an already-shipped pairing), not this change; investigate before touching anything.

- [ ] **Step 18 — commit.**

  ```
  git add src/hooks/useFirstVisitHint.ts src/hooks/__tests__/useFirstVisitHint.test.tsx src/App.tsx e2e/compare-view-dimming.spec.ts
  git commit -m "feat(hints): one-time compare tip after second distinct selection (C5)" -m "Third hint kind 'compare' (localStorage gate funworldmap-hint-compare-shown): fires while a panel is open, never during games, desktop-only (gate not burned on mobile — D4 revisits). Explicit precedence: dismissal effect ordered before the compare effect so the tip wins the second-selection render; on close it hands off to the game hint sequentially. Copy is pointer-independent — no capability gating. No new telemetry." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

**Task-level verification before hand-off:** `npm run check` green; the two edited e2e files plus the step-7/step-17 sweep green locally at `--workers=2`; live pass on desktop (1280px) and 390px mobile in both themes confirming (1) the desktop pill reads "Compare" and passes an eyeball contrast check in light and dark, (2) mobile keeps the icon-only button, (3) the tip appears exactly once after the second distinct selection on desktop and never on mobile. Note for the plan's CI-honesty ledger: `a11y-contrast`, `game-country-pinning`, `panel-focus`, `accessibility`, `axe-snapshot`, and `theme-and-responsive` are CI-ignored — the local runs above are their only guard for this change.

### Task 6: C6 — mobile compare becomes one scroll (single scroll container + sheet-aware camera)

**Files:**
- `src/lib/layoutConstants.ts` (modify — `comparePanelPadding()` mobile branch, `COMPARE_SHEET_FRACTION` docstring)
- `src/lib/__tests__/layoutConstants.test.ts` (modify — padding test + dvh class pin)
- `src/lib/flyToComparePair.ts` (modify — scope the `GLOBE_SCALE_ZOOM` fallback to desktop)
- `src/lib/__tests__/flyToComparePair.test.ts` (modify — mobile padding tests)
- `src/components/CompareCountryPanel.tsx` (modify — mobile branch rewrite, `h-[80vh]` → `h-[80dvh]`)
- `src/components/__tests__/CompareCountryPanel.test.tsx` (modify — new mobile describe block)
- `src/components/CountryColumn.tsx` + `src/components/__tests__/CountryColumn.test.tsx` (**delete only if** unreferenced after this change — see step 14)

**Interfaces:**

*Consumes (produced by earlier tasks in this plan — verify names before writing code; if an earlier task named these differently, use its names: the semantics below are the contract, not the spelling):*
- `COMPARE_FIELDS: readonly CompareFieldDef[]` and `type CompareFieldDef` from `src/lib/compareFields.ts` (Task 2 / C1) — the single shared field-definition array (population, area, derived density, region, government, languages, currencies, timezones). Never redefine field lists locally.
- `CompareFieldRow` from `src/components/CompareFieldRow.tsx` (Task 3 / C2+C3): `function CompareFieldRow(props: { field: CompareFieldDef; a: CountryData; b: CountryData }): JSX.Element`. Pure and container-fluid (bars are percent-of-max widths of the containing block — no fixed px widths, no `matchMedia`), numeric rows = paired bars (signal-A / ice-B) + delta chip, categorical rows = "Both: …" collapse / em-dash for missing. Each row carries `data-testid={`compare-row-${field.key}`}`.
- `onCompareSelect: (cca3: string) => void` prop on `CompareCountryPanel` (Task 5 — the inherited A8 border-chip-per-column clause): replaces country **B** via the compare-select path; `onSelect` (already on main) replaces **A** via the existing select path.
- Canonical constants from `src/lib/layoutConstants.ts` (existing owner — import, never duplicate): `COMPARE_SHEET_FRACTION`, `COMPARE_FRAME_PADDING_PX`, `DESKTOP_MEDIA_QUERY`.
- `BorderChip` from `src/components/BorderChip.tsx` (on main): `{ code, neighbor, onSelect, size: 'panel' | 'compare' }` — button labelled `neighbor.name.common`, calls `onSelect(code)`.

*Produces:*
- `comparePanelPadding(): PaddingOptions` — **behavior change**: mobile returns `bottom: Math.round(window.innerHeight * COMPARE_SHEET_FRACTION)` (desktop shape unchanged).
- Mobile compare DOM contract: `data-testid="compare-mobile-scroll"` (the ONE scroll container) and `data-testid="compare-mobile-header"` (sticky compact header). Task 7's live pass and docs update reference these.
- Compare sheet height class `h-[80dvh]` (was `h-[80vh]`).

**Intra-plan collision statement (read before editing):** the "current code" quoted below for `CompareCountryPanel.tsx` is from **main as of plan-writing (post #129/#130 and post A/B-core/E-foundations tranches)**. Tasks 3–5 of THIS plan rewrite the **desktop** arm of the same component (shared-row table, column headers, chip semantics) before this task runs. Anchor every edit on the **`!isDesktop` arm** — the two stacked `flex-1 … min-h-0` wrappers around `CountryColumn` — and leave the desktop arm's children exactly as Tasks 3–5 left them. If the mobile arm no longer matches the quote, stop and re-read the file; C6 owns mobile, so no earlier task should have touched it. `layoutConstants.ts` / `flyToComparePair.ts` are untouched by Tasks 1–5 and match main.

**e2e coverage statement:** all three compare specs (`compare-map-clicks`, `compare-view-dimming`, `compare-source-attribution`) run only in the desktop `chromium` Playwright project. The mobile projects (`mobile-chromium`, `mobile-webkit`, `desktop-firefox-touch` — all local-only; CI runs only `chromium` per `playwright.config.ts`) contain **no compare path**: their specs are `mobile-smoke`, `mobile-tap`, `mobile-free-play`, `tutorial-first-click`, `theme-and-responsive`, `launcher-card-loading-states`, none of which enter compare (verified by grep). So there is **no mobile-compare e2e to update, and this task adds none** — adding compare flows to the mobile testMatch is out of scope. Coverage for C6 is: the component tests below, the camera unit tests below, and Task 7's 390px live pass.

**The 390px layout decision (implemented below):** single-column full-width rows — splitting 390px into two ~230px half-columns would truncate every locale-formatted value, so `CompareFieldRow`'s stacked form (bar A over bar B, full container width) is used as-is:

```
┌──────────────────────────────────────┐
│ share / Exit compare / ×             │  controls row (unchanged)
├──────────────────────────────────────┤
│ [A] ▒flag France · Paris             │  sticky compact header
│ [B] ▒flag Germany · Berlin           │  (stays while rows scroll)
├──────────────────────────────────────┤
│ POPULATION          Germany 1.24×    │ ┐
│ ███████████████░░░░░░░  67,000,000   │ │ one CompareFieldRow,
│ ██████████████████████  83,294,633   │ ┘ full width
│ AREA                 France 1.54×    │
│ …                                    │
│ Both: Euro (€)                       │  categorical collapse
│ BORDERS — France                     │
│ [Belgium] [Germany] …                │  chips replace A
│ BORDERS — Germany                    │
│ [Austria] [Belgium] …                │  chips replace B
├──────────────────────────────────────┤
│ Sources: REST Countries · …          │  footer (unchanged)
└──────────────────────────────────────┘
```

The compact sticky header omits the A5 exception badges ("UN observer state" / "Not independent" — only Vatican/Palestine ever show them); the desktop column headers carry them (C1). Recorded in Task 7's ledger.

**No new telemetry:** this task ships no `track()` calls (workstream-wide commitment, confirmed in Task 7).

---

- [ ] **Step 1 — failing unit test: sheet-aware mobile padding in `comparePanelPadding`.** In `src/lib/__tests__/layoutConstants.test.ts`, replace the whole `it('comparePanelPadding reserves the panel footprint on desktop, stays flat on mobile (B6)', …)` block (it currently expects `{ top: 80, bottom: 80, left: 80, right: 80 }` on mobile with a comment naming C6 as the future owner — that future is now) with:

  ```ts
    it('comparePanelPadding reserves the panel footprint on desktop, the compare sheet on mobile (B6/C6)', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: true })),
      )
      expect(comparePanelPadding()).toEqual({
        top: COMPARE_FRAME_PADDING_PX,
        bottom: COMPARE_FRAME_PADDING_PX,
        left: COMPARE_FRAME_PADDING_PX,
        right: COMPARE_FRAME_PADDING_PX + COMPARE_PANEL_FOOTPRINT_PX,
      })
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: false })),
      )
      vi.stubGlobal('innerHeight', 800)
      // C6: the compare sheet covers the bottom COMPARE_SHEET_FRACTION of the
      // viewport — reserve it as bottom padding so cameraForBounds frames the
      // pair in the visible strip (replaces B6's deliberate flat 80px).
      expect(comparePanelPadding()).toEqual({
        top: COMPARE_FRAME_PADDING_PX,
        bottom: Math.round(800 * COMPARE_SHEET_FRACTION), // 640
        left: COMPARE_FRAME_PADDING_PX,
        right: COMPARE_FRAME_PADDING_PX,
      })
    })
  ```

  (`COMPARE_SHEET_FRACTION` is already imported at the top of this test file; the file's `afterEach(() => vi.unstubAllGlobals())` cleans up the `innerHeight` stub.)

- [ ] **Step 2 — run, expect failure.** `npx vitest run src/lib/__tests__/layoutConstants.test.ts` → the rewritten test FAILS with `AssertionError: expected { top: 80, bottom: 80, … } to deeply equal { top: 80, bottom: 640, … }`. All other tests in the file stay green.

- [ ] **Step 3 — implement `comparePanelPadding` mobile branch.** In `src/lib/layoutConstants.ts`, replace the current function and its docstring:

  ```ts
  /** cameraForBounds padding that frames the compare pair in the area the
   *  compare panel does not cover (B6, 2026-07-28). Desktop reserves the panel
   *  footprint as extra `right` padding — cameraForBounds folds padding into
   *  BOTH zoom and center, which the replaced screen offset could not do.
   *  Mobile deliberately stays flat: the sheet-aware bottom padding
   *  (innerHeight × COMPARE_SHEET_FRACTION) ships with C6's compare-sheet
   *  redesign, which owns mobile compare framing (spec C6/G3). */
  export function comparePanelPadding(): PaddingOptions {
    const panel = window.matchMedia(DESKTOP_MEDIA_QUERY).matches ? COMPARE_PANEL_FOOTPRINT_PX : 0
    return {
      top: COMPARE_FRAME_PADDING_PX,
      bottom: COMPARE_FRAME_PADDING_PX,
      left: COMPARE_FRAME_PADDING_PX,
      right: COMPARE_FRAME_PADDING_PX + panel,
    }
  }
  ```

  with:

  ```ts
  /** cameraForBounds padding that frames the compare pair in the area the
   *  compare panel does not cover. Desktop (B6, 2026-07-28) reserves the panel
   *  footprint as extra `right` padding; mobile (C6, 2026-07-28) reserves the
   *  compare sheet as `bottom` padding (innerHeight × COMPARE_SHEET_FRACTION —
   *  the sheet is h-[80dvh], and dvh tracks innerHeight, so the reserved band
   *  and the rendered sheet agree even as mobile browser toolbars collapse).
   *  cameraForBounds folds padding into BOTH zoom and center, which the
   *  screen offset it replaced could not do. If total padding exceeds the
   *  canvas (short landscape viewports: 80 + 0.8·H > H when H < 400), MapLibre
   *  warns and cameraForBounds returns undefined — flyToComparePair already
   *  no-ops on undefined (verified against maplibre-gl 5.23
   *  src/geo/projection/camera_helper.ts: negative available size →
   *  cameraBoundsWarning() + `return undefined`, never a throw). */
  export function comparePanelPadding(): PaddingOptions {
    if (window.matchMedia(DESKTOP_MEDIA_QUERY).matches) {
      return {
        top: COMPARE_FRAME_PADDING_PX,
        bottom: COMPARE_FRAME_PADDING_PX,
        left: COMPARE_FRAME_PADDING_PX,
        right: COMPARE_FRAME_PADDING_PX + COMPARE_PANEL_FOOTPRINT_PX,
      }
    }
    return {
      top: COMPARE_FRAME_PADDING_PX,
      bottom: Math.round(window.innerHeight * COMPARE_SHEET_FRACTION),
      left: COMPARE_FRAME_PADDING_PX,
      right: COMPARE_FRAME_PADDING_PX,
    }
  }
  ```

- [ ] **Step 4 — run green.** `npx vitest run src/lib/__tests__/layoutConstants.test.ts` → all pass.

- [ ] **Step 5 — failing unit tests: `flyToComparePair` mobile behavior.** In `src/lib/__tests__/flyToComparePair.test.ts`: add `COMPARE_SHEET_FRACTION` to the existing `layoutConstants` import, then replace the whole `it('mobile: flat symmetric padding (the sheet-aware bottom padding is C6, not B6)', …)` block with these TWO tests:

  ```ts
    it('mobile: sheet-aware bottom padding frames the pair in the strip above the sheet (C6)', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: false })),
      )
      vi.stubGlobal('innerHeight', 800)
      const fake = createFakeMapRef()
      flyToComparePair(fake.map, FRANCE, GERMANY)
      const opts = fake.calls.cameraForBounds.mock.calls[0][1]
      expect(opts).toEqual({
        padding: {
          top: COMPARE_FRAME_PADDING_PX,
          bottom: Math.round(800 * COMPARE_SHEET_FRACTION), // 640
          left: COMPARE_FRAME_PADDING_PX,
          right: COMPARE_FRAME_PADDING_PX,
        },
      })
    })

    it('mobile: the globe-scale symmetric fallback never fires — it would re-center the pair under the sheet (C6)', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: false })),
      )
      vi.stubGlobal('innerHeight', 800)
      const fake = createFakeMapRef()
      ;(fake.map.cameraForBounds as ReturnType<typeof vi.fn>).mockReturnValue({
        center: [-25, 0],
        zoom: 1.6,
      })
      flyToComparePair(fake.map, BRAZIL, NIGERIA)
      // The GLOBE_SCALE_ZOOM guard exists for DESKTOP's horizontal footprint
      // swing. On mobile the padded zoom sits below 2.2 routinely (the fitting
      // strip is ~20% of the viewport), so a firing guard would systematically
      // undo C6's framing. Exactly one cameraForBounds call = no fallback.
      expect(fake.calls.cameraForBounds).toHaveBeenCalledTimes(1)
      expect(fake.calls.flyTo.mock.calls[0][0]).toMatchObject({ zoom: 1.6 })
    })
  ```

- [ ] **Step 6 — run, expect two failures.** `npx vitest run src/lib/__tests__/flyToComparePair.test.ts` → the first new test FAILS on padding (`bottom: 80` received, `640` expected — step 3 already fixed `comparePanelPadding`, so if this one PASSES that is fine and expected; the load-bearing failure is the second), and the second new test FAILS with `expected "cameraForBounds" to be called 1 times, but got 2 times` (the guard currently fires regardless of viewport). The pre-existing desktop tests (`beforeEach` stubs `matchMedia` → `matches: true`) all still pass.

- [ ] **Step 7 — implement: desktop-only globe-scale guard.** In `src/lib/flyToComparePair.ts`, change the import (current: `import { COMPARE_FRAME_PADDING_PX, comparePanelPadding } from './layoutConstants'`) to:

  ```ts
  import { COMPARE_FRAME_PADDING_PX, comparePanelPadding, DESKTOP_MEDIA_QUERY } from './layoutConstants'
  ```

  and replace the guard block (current code):

  ```ts
    const GLOBE_SCALE_ZOOM = 2.2
    const camera =
      (paddedCamera.zoom ?? 0) < GLOBE_SCALE_ZOOM
        ? (map.cameraForBounds(bounds, { padding: COMPARE_FRAME_PADDING_PX }) ?? paddedCamera)
        : paddedCamera
  ```

  with:

  ```ts
    // DESKTOP-ONLY (C6, 2026-07-28): the guard exists for the horizontal
    // footprint swing above. On mobile the asymmetry is vertical (the sheet's
    // bottom padding) and the fitting strip is only ~20% of the viewport, so
    // padded zooms sit below 2.2 routinely — a firing guard would fall back
    // to symmetric padding and re-center the pair under the sheet, undoing
    // C6's framing. If the vertical swing ever shows a past-the-horizon case
    // on device, fix it with a mobile-specific clamp, not this fallback.
    const GLOBE_SCALE_ZOOM = 2.2
    const camera =
      window.matchMedia(DESKTOP_MEDIA_QUERY).matches && (paddedCamera.zoom ?? 0) < GLOBE_SCALE_ZOOM
        ? (map.cameraForBounds(bounds, { padding: COMPARE_FRAME_PADDING_PX }) ?? paddedCamera)
        : paddedCamera
  ```

  (Keep the existing comment block about the guard being the conservative default directly above — it stays true for desktop.)

- [ ] **Step 8 — run green.** `npx vitest run src/lib/__tests__/flyToComparePair.test.ts src/lib/__tests__/layoutConstants.test.ts` → all pass.

- [ ] **Step 9 — commit the camera half.**
  `git add src/lib/layoutConstants.ts src/lib/flyToComparePair.ts src/lib/__tests__/layoutConstants.test.ts src/lib/__tests__/flyToComparePair.test.ts && git commit -m "feat(compare): sheet-aware mobile camera padding (C6)" -m "Mobile comparePanelPadding reserves innerHeight x COMPARE_SHEET_FRACTION as bottom padding (replaces B6's deliberate flat 80px); the GLOBE_SCALE_ZOOM symmetric fallback is scoped to desktop, where its horizontal-footprint failure mode lives." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"`

- [ ] **Step 10 — failing component tests: mobile single scroll.** In `src/components/__tests__/CompareCountryPanel.test.tsx`: extend the testing-library import with `within` (current: `import { render, screen, fireEvent, waitFor } from '@testing-library/react'`), then append this describe block at the end of the file. **Prop-list drift note:** the `renderMobile` helper below passes the Props as they exist on main plus `onCompareSelect` (Task 5's addition); if Tasks 3–5 added further required props, supply them with `vi.fn()` stubs to match the component's `Props` interface as it now exists.

  ```tsx
  describe('C6 — mobile compare is one scroll', () => {
    function renderMobile(over: { country?: typeof FRA; compareWith?: typeof DEU } = {}) {
      const onSelect = vi.fn()
      const onCompareSelect = vi.fn()
      render(
        <CompareCountryPanel
          country={over.country ?? FRA}
          compareWith={over.compareWith ?? DEU}
          isDesktop={false}
          onSelect={onSelect}
          onCompareSelect={onCompareSelect}
          onClose={vi.fn()}
          onExitCompare={vi.fn()}
          byCca3={new Map()}
          sources={sources}
        />,
      )
      return { onSelect, onCompareSelect }
    }

    it('renders ONE scroll container — the stacked per-country halves are gone', () => {
      renderMobile()
      expect(screen.getByTestId('compare-mobile-scroll')).toBeInTheDocument()
      // The pre-C6 layout scrolled each 35vh half independently; CompareFieldRow
      // is container-fluid by contract (no internal scroll), so exactly one
      // overflow-y-auto element may exist in the mobile render.
      expect(document.querySelectorAll('.overflow-y-auto')).toHaveLength(1)
    })

    it('sticky compact header carries both flags, names, and A/B badges', () => {
      renderMobile()
      const header = screen.getByTestId('compare-mobile-header')
      expect(header.className).toContain('sticky')
      expect(within(header).getByText('France')).toBeInTheDocument()
      expect(within(header).getByText('Germany')).toBeInTheDocument()
      expect(within(header).getByText('A')).toBeInTheDocument()
      expect(within(header).getByText('B')).toBeInTheDocument()
      expect(within(header).getAllByTestId('country-flag')).toHaveLength(2)
    })

    it('shared rows render once with both countries adjacent, not per-column', () => {
      renderMobile()
      // Two per-country columns rendered this field twice; the shared row
      // renders it exactly once (testid contract from CompareFieldRow, Task 3).
      expect(screen.getAllByTestId('compare-row-population')).toHaveLength(1)
    })

    it('border chips replace the country whose group they belong to (A via onSelect, B via onCompareSelect)', () => {
      const fra = makeCountry({ borders: ['BEL'] })
      const deu = makeCountry({
        cca3: 'DEU',
        ccn3: '276',
        name: { common: 'Germany', official: 'Federal Republic of Germany' },
        borders: ['AUT'],
      })
      const byCca3 = new Map([
        ['BEL', makeCountry({ cca3: 'BEL', name: { common: 'Belgium', official: 'Kingdom of Belgium' } })],
        ['AUT', makeCountry({ cca3: 'AUT', name: { common: 'Austria', official: 'Republic of Austria' } })],
      ])
      const onSelect = vi.fn()
      const onCompareSelect = vi.fn()
      render(
        <CompareCountryPanel
          country={fra}
          compareWith={deu}
          isDesktop={false}
          onSelect={onSelect}
          onCompareSelect={onCompareSelect}
          onClose={vi.fn()}
          onExitCompare={vi.fn()}
          byCca3={byCca3}
          sources={sources}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Belgium' }))
      expect(onSelect).toHaveBeenCalledWith('BEL')
      expect(onCompareSelect).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Austria' }))
      expect(onCompareSelect).toHaveBeenCalledWith('AUT')
    })
  })
  ```

- [ ] **Step 11 — run, expect failures.** `npx vitest run src/components/__tests__/CompareCountryPanel.test.tsx` → all four new tests FAIL, the first with `TestingLibraryElementError: Unable to find an element by: [data-testid="compare-mobile-scroll"]`. The pre-existing A15 header tests (`isDesktop={true}`) stay green.

- [ ] **Step 12 — implement the mobile branch.** In `src/components/CompareCountryPanel.tsx`:

  (a) Sheet height — in `panelClasses`, replace `h-[80vh]` with `h-[80dvh]` in the mobile string (current on main: `'fixed bottom-0 left-0 right-0 bg-sand-50 dark:bg-dark-400 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 rounded-t-2xl h-[80vh] overflow-hidden'`). dvh is load-bearing here, not cosmetic: the camera math from step 3 uses `window.innerHeight`, and `dvh` tracks the dynamic viewport (= `innerHeight`) while `vh` on iOS is the large viewport — with `vh` the sheet is taller than `0.8 × innerHeight` whenever the browser toolbar is visible and the framed countries would sit partially under it. The single panel's `h-[40vh]`/`h-[80vh]` stay untouched (G1, in workstream D's plan, owns the general vh→dvh switch).

  (b) Layout — replace the columns block. Current code on main (per the collision statement, the desktop arm's CHILDREN will differ after Tasks 3–5 — move them verbatim into the new desktop arm; the load-bearing anchor is the `isDesktop ? … : …` ternary and the mobile arm's two stacked `flex-1 … min-h-0` wrappers):

  ```tsx
          <div
            className={
              isDesktop
                ? 'grid grid-cols-2 grid-rows-1 flex-1 min-h-0'
                : 'flex flex-col flex-1 min-h-0'
            }
          >
            <div
              className={
                isDesktop
                  ? 'border-r border-sand-200/50 dark:border-dark-200/30 min-h-0'
                  : 'flex-1 border-b-2 border-dashed border-sand-300/50 dark:border-dark-200/30 min-h-0'
              }
            >
              <CountryColumn
                country={country}
                byCca3={byCca3}
                onSelect={onSelect}
                badgeLetter="A"
                badgeColor="a"
              />
            </div>
            <div className={isDesktop ? 'min-h-0' : 'flex-1 min-h-0'}>
              <CountryColumn
                country={compareWith}
                byCca3={byCca3}
                onSelect={onSelect}
                badgeLetter="B"
                badgeColor="b"
              />
            </div>
          </div>
  ```

  New code — desktop arm keeps its current children unchanged; mobile arm becomes the single scroll:

  ```tsx
          {isDesktop ? (
            <div className="grid grid-cols-2 grid-rows-1 flex-1 min-h-0">
              {/* …the two desktop column wrappers, EXACTLY as Tasks 3–5 left them… */}
            </div>
          ) : (
            /* C6: ONE scroll container — the pre-C6 stacked 35vh halves never
               showed A's population on screen with B's. The compact header is
               sticky INSIDE the scroll so both countries stay identified while
               the shared rows scroll. */
            <div className="flex-1 min-h-0 overflow-y-auto" data-testid="compare-mobile-scroll">
              <div
                data-testid="compare-mobile-header"
                className="sticky top-0 z-10 bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-md px-4 py-2.5 border-b border-sand-200/50 dark:border-dark-200/30 space-y-1.5"
              >
                {(
                  [
                    { c: country, letter: 'A', color: 'a' },
                    { c: compareWith, letter: 'B', color: 'b' },
                  ] as const
                ).map(({ c, letter, color }) => (
                  <div key={letter} className="flex items-center gap-2 min-w-0">
                    <span className={`compare-badge compare-badge-${color}`}>{letter}</span>
                    <img
                      data-testid="country-flag"
                      src={c.flag}
                      alt={c.flagAlt || `Flag of ${c.name.common}`}
                      className="w-7 h-5 object-cover rounded-sm shadow-sm shrink-0"
                    />
                    <h2 className="text-sm font-bold text-sand-900 dark:text-dark-50 truncate leading-tight">
                      {c.name.common}
                    </h2>
                    {c.capital.length > 0 && (
                      <span className="text-xs text-ice-accessible dark:text-ice truncate">
                        {c.capital.join(', ')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 space-y-3">
                {COMPARE_FIELDS.map((field) => (
                  <CompareFieldRow key={field.key} field={field} a={country} b={compareWith} />
                ))}
                {(
                  [
                    { c: country, handler: onSelect },
                    { c: compareWith, handler: onCompareSelect },
                  ] as const
                ).map(
                  ({ c, handler }) =>
                    c.borders.length > 0 && (
                      <div key={c.cca3}>
                        <div className="text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice mb-1.5">
                          Borders — {c.name.common}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {c.borders.map((code) => (
                            <BorderChip
                              key={code}
                              code={code}
                              neighbor={byCca3.get(code)}
                              onSelect={handler}
                              size="compare"
                            />
                          ))}
                        </div>
                      </div>
                    ),
                )}
              </div>
            </div>
          )}
  ```

  Add the imports this needs (alongside whatever Tasks 3–5 already import here): `COMPARE_FIELDS` from `'../lib/compareFields'`, `CompareFieldRow` from `'./CompareFieldRow'`, `BorderChip` from `'./BorderChip'`. `onCompareSelect` comes from Props (added by Task 5 — if it named the prop differently, use its name here and in the step-10 tests). If, after this edit, the mobile arm was `CountryColumn`'s last usage on the mobile side but desktop still imports it, leave `CountryColumn` alone.

  **Note on the compare-badge classes:** `compare-badge compare-badge-a/b` are the existing `index.css` classes (`var(--color-signal)` / `var(--color-ice)` on `--color-dark-500` ink — post-E-foundations values, pinned by `e2e/a11y-contrast.spec.ts`). Reusing them means no new color pairing and no new WCAG math: A-badge signal `#FF8A4C` on dark-500 `#121518` and B-badge ice `#7DD3FC` on dark-500 were AA-verified (≥ 4.5:1) when E-foundations landed, and the header surface behind them (`bg-sand-50/95` / `dark:bg-dark-400/95`) matches the desktop column header they were designed on.

- [ ] **Step 13 — re-anchor the dvh class pin (same commit — invalidated literal).** In `src/lib/__tests__/layoutConstants.test.ts`, the pin `expect(compareCountryPanelSource).toContain(`h-[${COMPARE_SHEET_FRACTION * 100}vh]`)` now fails. Replace that line with:

  ```ts
      // C6: the compare sheet is dvh so the sheet and the camera's
      // innerHeight-based bottom padding agree under dynamic mobile toolbars.
      expect(compareCountryPanelSource).toContain(`h-[${COMPARE_SHEET_FRACTION * 100}dvh]`)
  ```

  Also update the constant's docstring in `src/lib/layoutConstants.ts` from `/** Mobile compare / expanded sheet: h-[80vh]. */` to:

  ```ts
  /** Mobile compare sheet: h-[80dvh] (C6). The single panel's expanded sheet
   *  stays h-[80vh] until G1's dvh switch (workstream D's plan). */
  ```

  These are the only two `80vh` pins for the compare sheet — `docs/systems/accessibility.md` and `docs/systems/ui-layout.md` mention 40vh/80vh for the **single** panel only (untouched; grep `80vh` to confirm nothing else broke).

- [ ] **Step 14 — dead-code check (project memory: remove obsolete code in the same change).** Run `grep -rn "CountryColumn" src/`. If the only remaining hits are `src/components/CountryColumn.tsx` itself and `src/components/__tests__/CountryColumn.test.tsx` (i.e. Tasks 3–5 already removed the desktop usage), delete both files in this commit. If `CompareCountryPanel.tsx`'s desktop arm still renders it, keep both.

- [ ] **Step 15 — run green.** `npx vitest run src/components/__tests__/CompareCountryPanel.test.tsx src/lib/__tests__/layoutConstants.test.ts` → all pass. Then `npm run check` (lint + typecheck + full unit suite) → green.

- [ ] **Step 16 — commit the layout half.**
  `git add -A && git commit -m "feat(compare): mobile compare is one scroll (C6)" -m "Replaces the two stacked independently-scrolling halves with a single scroll container: sticky compact header (both flags/names/A-B badges) over the shared COMPARE_FIELDS rows and per-country border-chip groups. Sheet moves to h-[80dvh] so the camera's innerHeight-based padding and the rendered sheet agree." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"`

---

### Task 7: Workstream C verification sweep (final)

**Files:**
- `docs/systems/ui-layout.md` (modify — § Compare rewrite; lesson: docs staleness is fixed in the same tranche)
- `docs/superpowers/plans/2026-07-28-workstream-c-compare.md` (this plan document — append the completion ledger)

**Interfaces:**

*Consumes:* everything Tasks 1–6 produced — `COMPARE_FIELDS`/`CompareFieldRow` (Tasks 2–3), the exception-marker definition (Task with C4), the desktop Compare pill + tip (C5 task), `onCompareSelect` chip semantics (Task 5), `compare-mobile-scroll`/`compare-mobile-header`/`h-[80dvh]`/sheet-aware `comparePanelPadding` (Task 6).

*Produces:* nothing importable — a verified, documented, honestly-summarized tranche.

**No new telemetry:** workstream C ships **no** new `track()` events, no `KNOWN_EVENTS` change, no `docs/systems/analytics.md` change, and no wrangler deploy — step 6 proves it by grep instead of asserting it.

---

- [ ] **Step 1 — kill stray dev servers (project memory: a background `npm run dev` gets reused by Playwright WITHOUT `VITE_TEST_HOOKS`).** PowerShell:
  `Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`
  then confirm `Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue` returns nothing.

- [ ] **Step 2 — full static + unit sweep.** `npm run check` (= `eslint src/ e2e/ scripts/` + `tsc -b` + `vitest run`) → green. This is the full-vitest requirement; do not scope it.

- [ ] **Step 3 — affected e2e, CI-covered set.** These five specs run on CI (in the `chromium` testMatch and NOT in its `testIgnore`):
  `npx playwright test e2e/compare-map-clicks.spec.ts e2e/compare-view-dimming.spec.ts e2e/compare-source-attribution.spec.ts e2e/a11y-contrast.spec.ts e2e/panel-and-deeplink.spec.ts --project=chromium --workers=2` → green. (`--workers=2` matches CI parallelism per CLAUDE.md; single-worker runs hide flakes.)

- [ ] **Step 4 — affected e2e, local-only set.** These five are in the chromium `testIgnore` on CI (no-GPU flake, tracking issue #106) — **this local run is their only guard; CI will not re-check them** (`docs/systems/testing.md` § "What Runs in CI"):
  `npx playwright test e2e/search.spec.ts e2e/accessibility.spec.ts e2e/axe-snapshot.spec.ts e2e/theme-and-responsive.spec.ts e2e/game-country-pinning.spec.ts --project=chromium --workers=2` → green. (Affected because: `search.spec.ts` covers the compare-picking placeholder flow; the two axe specs must pass over the new compare DOM; `theme-and-responsive` exercises the panel at mobile widths; `game-country-pinning.spec.ts` pins the Compare entry control's accessible name, which C5 relabelled.)

- [ ] **Step 5 — mobile-project smoke (local-only; CI runs only the `chromium` project).** No compare flow exists in any mobile-project spec (verified by grep — `mobile-smoke`/`mobile-tap`/`mobile-free-play` never enter compare), so there is **no mobile-compare e2e**; this run is regression smoke for the shared panel/sheet DOM the C6 change sits next to:
  `npx playwright test e2e/mobile-smoke.spec.ts e2e/mobile-tap.spec.ts --project=mobile-chromium --project=mobile-webkit --project=desktop-firefox-touch --workers=2` → green.

- [ ] **Step 6 — no-new-telemetry proof.** Run `git diff main...HEAD -- src cloudflare-worker | grep -E 'track\(|KNOWN_EVENTS'` → expect **no output** (grep exits 1). If anything surfaces, a task smuggled in telemetry this workstream explicitly does not ship — remove it before proceeding.

- [ ] **Step 7 — live pass (spec commitment: touched flows on desktop AND 390px, both themes).** `npm run dev`, then walk this checklist twice (light + dark), desktop viewport and 390×844 (devtools device emulation):
  - Enter compare via the labeled **Compare** pill from an open France panel; pick Germany.
  - Numeric rows: paired bars render, A bar reads signal / B bar reads ice (matching the map's A/B highlight), values in the mono readout face, delta chip shows the right ratio and country name.
  - Categorical rows: France vs Germany currencies collapse to a single centered "Both: Euro (€)" row; a differing field (e.g. languages) renders both values; compare France vs Vatican to see em-dash placeholders and the header exception badge (desktop).
  - Exception markers: pick a pair where a field's source differs from the dominant source; the superscript marker renders and the `compare-sources` footer lists all sources.
  - Chip semantics (desktop): a border chip in A's column replaces A; in B's column replaces B; hash updates both times.
  - Mobile 390px: ONE scroll surface; sticky header (both flags/names/A/B badges) still visible after scrolling to the borders groups; "Borders — France" chips replace A, "Borders — Germany" chips replace B; content not clipped under the home indicator.
  - Mobile framing (C6 camera): after compare opens at 390px, BOTH countries are visible in the strip above the sheet for France+Germany and Brazil+Nigeria; Japan+USA takes the wide-pair midpoint fallback (unchanged behavior).
  - Exits unchanged: Escape stages compare → single → closed; "Exit compare" returns to single; × closes the whole panel; copy-link shows the "Link copied" toast.
  Record any failure as a fix-first blocker; do not proceed to the docs commit with a red live pass.

- [ ] **Step 8 — update `docs/systems/ui-layout.md` § Compare (same tranche as the code it describes).** Replace the current single-paragraph section (it still describes "two `CountryColumn`s side by side" with per-column conditional fields):

  ```markdown
  ### Compare

  From an open country panel, a **Compare** action puts search into "pick a country to compare" mode (placeholder "Choose country to compare…"; entered via `enterComparePicking` in `App.tsx`, available only while a country is selected). Choosing a second country opens `CompareCountryPanel` — two `CountryColumn`s side by side. Unlike the single-country panel, fields here are not individually source-tagged; a shared footer (`data-testid="compare-sources"`) lists the comparison's data sources. On the map, both countries are highlighted (A = signal, B = ice-dim) while every non-compared country is dimmed by the `country-dim` spotlight layer; exiting compare (Escape or the exit control) clears the second country and restores the borders (`useCompareViewHighlight.ts` + `useCountryBaselinePaint.ts`). Covered by `e2e/compare-view-dimming.spec.ts` and `e2e/compare-source-attribution.spec.ts`.
  ```

  with (reconcile component/prop names against what Tasks 1–6 actually landed before committing):

  ```markdown
  ### Compare

  From an open country panel, the labeled **Compare** pill (desktop panel header; the mobile sheet's labeled chip ships with D4) puts search into "pick a country to compare" mode (placeholder "Choose country to compare…"; entered via `enterComparePicking` in `App.tsx`, available only while a country is selected). A one-time "Tip: compare two countries side by side" hint shows after the session's second distinct country selection. Choosing a second country opens `CompareCountryPanel`.

  One shared field-definition array (`COMPARE_FIELDS`, `src/lib/compareFields.ts`) drives the whole view, so rows always align and no field is silently dropped. Each field renders once via `CompareFieldRow`: numeric fields (population, area, derived density) as paired horizontal bars scaled to max(A, B) — signal for A, ice for B, matching the map highlights — with a delta chip ("Germany 1.24× population"); categorical fields collapse identical values into one centered "Both: …" row and show an em dash where a country lacks a value. Capitals live in the header captions (all capitals, joined); UN-membership/independence render as exception badges in the column headers, never as rows.

  - **Desktop (≥ 1024px):** two column headers (A/B badge, flag, name, capitals, exception badges) above the shared rows; border chips are per column — a chip in A's column replaces A (existing select path), a chip in B's column replaces B (`onCompareSelect`).
  - **Mobile (< 1024px):** an `h-[80dvh]` sheet with ONE scroll container (`data-testid="compare-mobile-scroll"`): a compact sticky header (`compare-mobile-header`) keeps both flags/names/A-B badges visible while the shared rows scroll, followed by per-country "Borders — X" chip groups with the same replace-that-country semantics. (The compact header omits the exception badges; the desktop column headers carry them.)

  Camera: `flyToComparePair` frames both countries in the un-occluded area via `cameraForBounds` + `comparePanelPadding()` — desktop reserves the panel footprint as extra `right` padding (B6); mobile reserves the sheet as `bottom` padding (`innerHeight × COMPARE_SHEET_FRACTION`, C6 — which is why the sheet is `dvh`, not `vh`). The globe-scale symmetric-padding fallback is desktop-only.

  Fields are not individually source-tagged; a shared footer (`data-testid="compare-sources"`) lists the comparison's data sources, and any field whose source differs from the panel's dominant source carries a superscript exception marker (definition shipped with C4; the single panel adopts it in D2). On the map, both countries are highlighted (A = signal, B = ice-dim) while every non-compared country is dimmed by the `country-dim` spotlight layer; exiting compare (Escape or the exit control) clears the second country and restores the borders (`useCompareViewHighlight.ts` + `useCountryBaselinePaint.ts`). Covered by `e2e/compare-view-dimming.spec.ts`, `e2e/compare-map-clicks.spec.ts`, and `e2e/compare-source-attribution.spec.ts` — all desktop-`chromium` only; the mobile Playwright projects contain no compare flow.
  ```

- [ ] **Step 9 — append the completion ledger to this plan document** (`docs/superpowers/plans/2026-07-28-workstream-c-compare.md`), after the last task:

  ```markdown
  ## Completion ledger (Task 7, post-verification)

  Intentionally NOT shipped in this workstream — each has a named owner:

  - **Mobile labeled Compare chip** → D4 (owns the sheet-header restructure). C5 shipped the desktop pill + one-time tip only.
  - **Single-panel adoption of the exception marker** → D2. C4 shipped the marker *definition* (spec's "whichever lands first" clause); D2 adopts it when the per-field "i" rings are retired.
  - **Exception badges in the mobile compare header** — omitted from the compact sticky header (affects Vatican/Palestine pairs only; desktop column headers carry them). Revisit inside D4's sheet-header restructure.
  - **Mobile-compare e2e** — none exists and none was added: the mobile Playwright projects (all local-only; CI runs only `chromium`) have no compare flow. Coverage is component tests, camera unit tests, and this task's 390px live pass.
  - **GLOBE_SCALE_ZOOM guard on mobile** — deliberately disabled (it would re-center the pair under the sheet). If a device live case ever shows a vertical past-the-horizon swing, fix with a mobile-specific clamp, not the symmetric fallback (`flyToComparePair.ts` comment).
  - **Telemetry** — this workstream ships no new `track()` events (verified: `git diff main...HEAD -- src cloudflare-worker | grep -E 'track\(|KNOWN_EVENTS'` is empty). No `KNOWN_EVENTS`, `docs/systems/analytics.md`, or wrangler-deploy changes.
  ```

- [ ] **Step 10 — commit.**
  `git add docs/systems/ui-layout.md docs/superpowers/plans/2026-07-28-workstream-c-compare.md && git commit -m "docs(compare): ui-layout compare section + workstream C completion ledger" -m "Verification sweep: npm run check green; CI-covered e2e (compare-map-clicks, compare-view-dimming, compare-source-attribution, a11y-contrast, panel-and-deeplink) and local-only e2e (search, accessibility, axe-snapshot, theme-and-responsive, game-country-pinning) green at --workers=2; mobile-project smoke green; both-theme desktop+390px live pass done; no new telemetry (grep-verified)." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"`