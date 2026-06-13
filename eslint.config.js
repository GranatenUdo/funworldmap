import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import playwright from 'eslint-plugin-playwright'

export default tseslint.config(
  { name: 'app/ignores', ignores: ['dist', 'cloudflare-worker/**', '**/*.config.{js,ts}', '*.config.{js,ts}'] },
  {
    name: 'app/typescript-strict',
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    // Scoped to src/ — type-aware lint for e2e/ and scripts/ via tsconfig.e2e.json
    // is possible but slows lint-staged/pre-commit; deliberately deferred even now
    // that eslint-plugin-playwright (2026-06, tooling/e2e-playwright block below)
    // covers the high-value syntactic rules. e2e/ and scripts/ get the
    // non-type-checked preset below.
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // react-hooks v7.1 introduced three new rules that flag legitimate
      // established patterns we use throughout the codebase:
      //   - `react-hooks/refs`: flags the latest-value-ref pattern
      //     (`ref.current = value` during render) used to avoid stale-closure
      //     bugs in useEffect-attached event handlers (e.g. statusRef in
      //     useHashGameRouter, latest-callback refs in useMapInteractions).
      //   - `react-hooks/set-state-in-effect`: flags useEffect+setState for
      //     external-system synchronisation (theme media-query, MutationObserver
      //     bridging, hashchange listeners). The React 19-idiomatic replacement
      //     is useSyncExternalStore, but migrating ~13 sites is a separate
      //     refactor phase, not a dep-bump concern.
      //   - `react-hooks/immutability`: flags vi.fn() spy installs that mutate
      //     the fake-map's setFilter/setPaintProperty array — a test-fixture
      //     pattern with no production analogue.
      // Disabled here to keep this PR scoped to the dep bump itself. A future
      // cleanup-plan phase can migrate the flagged sites to React 19 idioms
      // and re-enable these rules per-site.
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
    },
  },
  {
    name: 'tooling/e2e-and-scripts',
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['e2e/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      // node for the runners (Playwright, tsx scripts); browser for
      // page.evaluate callbacks, which execute in the page.
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    name: 'tooling/e2e-playwright',
    extends: [playwright.configs['flat/recommended']],
    files: ['e2e/**/*.ts'],
    rules: {
      // flat/recommended ships these at 'warn', but `npm run lint` has no
      // --max-warnings 0 — a warning would not fail CI. The CLAUDE.md flake
      // bans these rules mechanize must actually block, so: error.
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-force-option': 'error',
      // Bare test.skip means "removing the test outright" per CLAUDE.md and
      // should block. The quarantine pattern (test.fixme(!!process.env.CI,
      // ...)) is exempt by the rule's default (disallowFixme: false), so
      // erroring here costs the policy nothing.
      'playwright/no-skipped-test': 'error',
      // The corpus has legitimate data-driven conditionals (label-contrast's
      // per-layer probes, keyboard-map-nav, compare-source-attribution's
      // count guard) this rule cannot tell apart from flake-prone branching.
      // (The test.fixme quarantine pattern does NOT trigger this rule and is
      // not the reason for the 'off'.)
      'playwright/no-conditional-in-test': 'off',
      // compare-source-attribution.spec.ts asserts inside an if(count > 1)
      // guard — legitimate when the dataset may have a single element.
      'playwright/no-conditional-expect': 'off',
      // waitForSelector is used deliberately in helpers.ts and 17 spec files
      // (18 call sites) that pre-date the repo's locator-first convention.
      // Not a flake contributor — the CLAUDE.md ban targets waitForTimeout
      // and force:true. Migrating the call sites is a separate cleanup task.
      'playwright/no-wait-for-selector': 'off',
    },
  },
)
