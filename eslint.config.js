import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { name: 'app/ignores', ignores: ['dist', 'cloudflare-worker/**', '**/*.config.{js,ts}', '*.config.{js,ts}'] },
  {
    name: 'app/typescript-strict',
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    // Scoped to src/ — the type-checked rules require parserOptions.project,
    // and only src/ is in tsconfig.app.json. e2e/ and scripts/ get the
    // cheaper non-type-checked config below.
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
)
