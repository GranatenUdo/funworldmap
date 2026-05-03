# Dropped-country test reference audit (canonical-195 reduction)

**Date:** 2026-05-03
**Worktree branch:** `plan/fixes-and-palestine` (off `origin/main` @ `7eafc26`)
**Plan:** [`docs/superpowers/plans/2026-05-03-quarantine-bugs-and-palestine.md`](../plans/2026-05-03-quarantine-bugs-and-palestine.md), Phase 3 Task 3.0

## TL;DR

Greps across `e2e/`, `src/**`, and `scripts/**` (excluding `src/data/*.json`, `node_modules/`, and `public/news/*.json` data) for the 55 dropped-country names and cca3 codes turned up **exactly one test file with test-relevant references**: `scripts/news/__tests__/fips-codes.test.ts`. Every other match is in source data, generated news fixtures, design docs, or unaffected source modules.

The plan-named test files (`useCountryData.test.ts`, `loadCountryGeojson.test.ts`) do **not** currently reference any dropped country by name or code — they assert generic behavior (`countries.length > 100`, antimeridian fixup) that survives the canonical-195 filter unchanged. Tasks 3.3 and 3.4 will tighten those tests; they don't need to remove dropped-country fixtures (there are none).

## Dropped-country list

`node` script per the plan reports **55 dropped countries** (the plan's "56 before GNB fix" was a count from when GNB had `unMember: false` AND wasn't yet excluded — re-running today shows 55 because GNB is still in the list pre-Task-3.1 but its name is in the dropped names *and* its cca3 is in the dropped cca3s; subtracting GNB per the audit instructions leaves **54 dropped countries** for grep purposes).

To match the plan's framing exactly: the canonical filter **today** would keep 194 countries (193 unMember + Vatican + Palestine, *minus* GNB which still has `unMember: false`). After Task 3.1 fixes GNB to `unMember: true`, it will keep 195 and the dropped count is 54.

Dropped names (excluded from grep — used for this list only):

```
Åland Islands, American Samoa, Anguilla, Antarctica, Aruba, Bermuda, Bouvet Island, British Indian Ocean Territory, British Virgin Islands, Caribbean Netherlands, Cayman Islands, Christmas Island, Cocos (Keeling) Islands, Cook Islands, Curaçao, Falkland Islands, Faroe Islands, French Guiana, French Polynesia, French Southern and Antarctic Lands, Gibraltar, Greenland, Guadeloupe, Guam, Guernsey, [Guinea-Bissau — keep, Task 3.1], Heard Island and McDonald Islands, Hong Kong, Isle of Man, Jersey, Macau, Martinique, Mayotte, Montserrat, New Caledonia, Niue, Norfolk Island, Northern Mariana Islands, Pitcairn Islands, Puerto Rico, Réunion, Saint Barthélemy, Saint Helena/Ascension/Tristan da Cunha, Saint Martin, Saint Pierre and Miquelon, Sint Maarten, South Georgia, Svalbard and Jan Mayen, Taiwan, Tokelau, Turks and Caicos Islands, US Minor Outlying Islands, US Virgin Islands, Wallis and Futuna, Western Sahara
```

Dropped cca3 (excluded from grep — used for this list only):

```
ABW AIA ALA ASM ATA ATF BES BLM BMU BVT CCK COK CUW CXR CYM ESH FLK FRO GGY GIB GLP GRL GUF GUM HKG HMD IMN IOT JEY MAC MAF MNP MSR MTQ MYT NCL NFK NIU PCN PRI PYF REU SGS SHN SJM SPM SXM TCA TKL TWN UMI VGB VIR WLF
```

(GNB intentionally omitted from this list per the audit instructions — it will become a "kept" country once Task 3.1 lands.)

## Search scope

Grepped via the Grep tool (ripgrep) for both DROPPED_NAMES and DROPPED_CCA3 regexes from the task spec. Searched:

- `e2e/**` — Playwright spec files and helpers
- `src/**/*.{ts,tsx,js,jsx}` — components, hooks, lib, game/* (incl. all `__tests__`)
- `scripts/**` — daily-content, news, fetch-countries

Skipped per spec:

- `src/data/countries.json` (source data — many cca3 occurrences, all expected)
- `src/data/cities.json` (source data — `HKG`, `TWN`, `PRI`, `BMU`, `GRL` countryCca3 occurrences belong to Phase 3 Task 3.8's separate audit, not this one)
- `node_modules/` (default ripgrep ignores)
- `public/news/{CCA3}.json` (generated news fixtures — Task 3.5/3.8 territory, not test logic; 49–60 files will be deleted/orphaned by canonical filter but no current test references them)

## Test-relevant matches

Exactly **one test file** references dropped countries:

### `scripts/news/__tests__/fips-codes.test.ts`

- **Lines 29–32** — `cca3ToFips` returns null for territories with no FIPS code:

  ```ts
  expect(cca3ToFips('BVT', 'BV')).toBeNull() // Bouvet Island
  expect(cca3ToFips('BES', 'BQ')).toBeNull() // Caribbean Netherlands
  expect(cca3ToFips('ATA', 'AQ')).toBeNull() // Antarctica
  expect(cca3ToFips('ALA', 'AX')).toBeNull() // Åland Islands
  ```

  **Recommendation: KEEP.** This test is a **data-layer / pure-function test** of the `cca3ToFips` mapping in `scripts/news/fips-codes.ts`. The function is a static lookup table; whether or not the canonical-195 filter excludes these cca3 codes from the *runtime country list* has zero effect on whether `cca3ToFips('BVT', 'BV')` should return null. The mapping is consulted by news-build tooling (`scripts/news/build.ts`) which iterates over `countries.json` directly — once `useCountryData` filters to canonical-195, the news pipeline will simply never call `cca3ToFips` with these codes. Removing the test would lose coverage of the "explicit-null" code path, which still needs to exist in `fips-codes.ts` because the table is keyed by cca3 from raw `countries.json` (the canonical filter doesn't affect this static mapping).

  An alternative would be to **rewrite the test to use a kept country with a null FIPS** — but no kept country has a null FIPS in the table. The four nulls (`BVT`, `BES`, `ATA`, `ALA`) are exactly the four "no FIPS assigned" entries, and they are **all dropped by the canonical filter**. So either keep these four assertions as-is (recommended), or add a "static-data smoke test" that just asserts `FIPS_OVERRIDES['ATA']` is null without going through the function (less idiomatic).

  **Side note for Task 3.1 reviewers:** if the news pipeline gets refactored to use the canonical-195 list, the entire `FIPS_OVERRIDES` table can be pruned of the 54 dropped cca3 codes and this test would need to be deleted alongside. That's **out of scope for the plan** but worth flagging — this audit doesn't recommend touching the news pipeline.

## Comment-only / non-test matches

| File | Line | Note |
|---|---|---|
| `src/components/Launcher.tsx` | 242 | The stale "194 countries" subtitle string the plan calls out. **Task 3.6 will fix.** Not test-relevant directly, but listed for completeness. |
| `scripts/daily-content/README.md` | 7 | Documentation: lists Taiwan, Western Sahara, Palestine etc. as politically-neutral exclusions for the daily pool. **Task 3.5 may want to update this.** Not a test. |
| `scripts/news/fips-codes.ts` | (whole file) | Source file with cca3→FIPS table. Not a test. The table contains all 55 dropped cca3 codes by design — that's its job. Out of scope for this plan. |
| `docs/superpowers/specs/*.md`, `docs/superpowers/plans/*.md` | various | Design docs and prior-feature plans referencing TWN/HKG/etc. as data examples. Not tests. |

## Source/data matches (informational, not breakage)

- `src/data/countries.json` — 55 dropped entries; canonical filter will remove from runtime use. Not a test break (Task 3.3 explicitly handles this).
- `src/data/cities.json` — five cities under dropped-country cca3 (`HKG-hong-kong`, `TWN-taipei`, `TWN-kaohsiung`, `PRI-san-juan`, `BMU-hamilton`, `GRL-nuuk`). **Phase 3 Task 3.8 audits these.** Not test-relevant for this audit.
- `public/news/{CCA3}.json` — 49 generated news fixture files for dropped territories. Loaded at runtime when a country panel is opened. After canonical filter, no UI path will request them; the build pipeline will simply stop generating them. Not test-relevant.

## Tasks 3.3–3.7: which test files need updates?

**None of the canonical-195 implementer tasks (3.3, 3.4, 3.5, 3.6, 3.7) need to update existing tests for dropped-country references.** Specifically:

- **Task 3.3 (`useCountryData` filter + tighten test):** `src/hooks/__tests__/useCountryData.test.ts` does **not** reference any dropped country. The plan's instruction to "tighten the test" is to replace `> 100` with an exact `=== 195` count and add membership assertions for PSE/VAT/GNB — no dropped-country removal needed.

- **Task 3.4 (`loadCountryGeojson` filter + test):** `src/lib/__tests__/loadCountryGeojson.test.ts` tests only the `fixAntimeridian` pure function with synthetic polygon coordinates — no country names or cca3. The new filter test will be additive.

- **Task 3.5 (daily pool audit):** `scripts/daily-content/__tests__/{validate-pools,picker,generate-index}.test.ts` use only `'FRA'`, `'PER'`, `'XXX'` (a sentinel for "missing"). No dropped-country references. The pool JSON files (`country-pool.json`, `city-pool.json`) already exclude all dropped cca3 (verified — zero matches).

- **Task 3.6 (stale "194" subtitle):** Not a test change; updates `src/components/Launcher.tsx`. The audit confirms there are no e2e or unit tests asserting on the literal "194 countries" string — `Grep` for `\b(195|194|249|193)\b` across `e2e/` and `src/` returned only the Launcher source line.

- **Task 3.7 (new e2e/canonical-195.spec.ts):** New file; nothing to update.

- **Task 3.8 (cities pool audit):** Will need to remove orphaned-by-cca3 city entries from `src/data/cities.json` and `scripts/daily-content/city-pool.json`. The city-pool tests don't assert on specific dropped cities so they should pass unchanged.

**One unrelated test file is impacted, but the recommendation is to leave it alone:**

- `scripts/news/__tests__/fips-codes.test.ts` (lines 29–32) — `KEEP` per the analysis above. Tests data-layer behavior independent of the canonical filter.

## Summary

| Bucket | Count |
|---|---|
| Test files with test-relevant matches | 1 (`scripts/news/__tests__/fips-codes.test.ts`) |
| Test files needing **drop/update** action | 0 |
| Test files needing **keep** decision documented | 1 (above) |
| Comment-only / source/data matches | 4 buckets (see tables above) |

**Tasks 3.3–3.7 (and 3.8) do not need to update any test file beyond what their plan steps already specify.** The audit's only finding is documenting that the FIPS test stays untouched (it's a data-layer test, not a runtime-country-list test).

## Concerns / non-obvious flags

1. **GNB-in-dropped-list quirk.** The audit instructions said "55 dropped countries before the GNB fix"; my node script also reports 55. The 56-vs-55 mismatch in the plan text is a wording artefact — the script `filter(x => x.unMember !== true && x.cca3 !== 'PSE' && x.cca3 !== 'VAT')` already correctly counts GNB once (it has `unMember: false` today, so it's in the dropped list). After Task 3.1 makes GNB `unMember: true`, the count drops to 54. **Not a blocker** — flagging so the controller doesn't get confused if a later subagent re-runs the script and sees 54 post-Task-3.1.

2. **FIPS test recommendation is non-obvious.** I'm marking this **DONE_WITH_CONCERNS** because the recommendation to KEEP `fips-codes.test.ts` lines 29–32 (which test exclusively dropped-country cca3 behavior) deserves explicit controller acknowledgement — an alternative reading of the plan's spirit ("get all references to dropped countries out of tests") would say to delete those four lines. My recommendation is KEEP because the test asserts on a static lookup table that is unaffected by the canonical filter, and the four null entries have no kept-country equivalents to swap in. Controller should disambiguate if they prefer the stricter "no dropped-country references in tests at all" reading.

3. **No e2e tests referenced any dropped country.** Slightly surprising — but consistent with the e2e suite focusing on `France`, `Germany`, `Iceland`, etc. for stable map interactions. No e2e flake risk from this phase.
