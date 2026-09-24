/**
 * ESLint — deliberately ONE rule: no-undef.
 *
 * Why this file exists. The project had no linting at all, and Metro does not
 * catch undefined identifiers: an undeclared name compiles fine and throws a
 * ReferenceError only when that line actually runs. Because the offending lines
 * sat on screens or branches nobody had exercised recently, they shipped.
 *
 * A single sweep found ELEVEN of them in live code, including:
 *   - AuthModal: `anyBirth` in the signup payload — every signup threw before
 *     the profile row was written, so accounts were created with no profile and
 *     no date of birth, and the user was never signed in.
 *   - storageService: `stripExifFromBlob` was never imported, so the native
 *     photo path threw and the catch fell back to uploading the ORIGINAL image
 *     with its GPS EXIF intact.
 *   - DirectMessageModal: `toast?.show(...)` — optional chaining does not
 *     protect an undeclared binding, only a null property.
 *
 * Scope is intentionally narrow. A full style ruleset over ~95K lines would
 * produce a backlog nobody triages, and a lint step people ignore protects
 * nothing. This one rule maps directly to "the app crashes", so it stays
 * actionable and can be enforced in CI without a cleanup project first.
 */
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      'node_modules/**', 'dist/**', 'dist-*/**', '.expo/**', 'web-build/**',
      'android/**', 'ios/**', 'coverage/**', 'supabase/functions/**',
      // Agent worktrees are whole extra copies of this repo. Linting them
      // double-reports every finding against files that are not the source.
      '.claude/**',
    ],
  },
  {
    // k6 load scripts run in the k6 runtime, not node or a browser.
    files: ['load/**/*.js'],
    languageOptions: { globals: { __ENV: 'readonly', __VU: 'readonly', __ITER: 'readonly' } },
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        // React Native / Expo globals that exist at runtime but are in neither
        // the browser nor the node preset.
        __DEV__: 'readonly',
        ErrorUtils: 'readonly',
        HermesInternal: 'readonly',
        nativeFabricUIManager: 'readonly',
      },
    },
    // The codebase carries many `// eslint-disable-line react-hooks/exhaustive-deps`
    // comments from before any linter was wired up. ESLint treats a disable
    // directive naming an UNKNOWN rule as an error, so the plugin has to be
    // registered for those comments to be legal — but its rules stay OFF.
    // Turning exhaustive-deps on would add ~1,200 findings in one go, which is
    // the backlog this config is explicitly trying not to create. Enabling it is
    // a worthwhile separate project, not a side effect of catching crashes.
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'no-undef': 'error',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/rules-of-hooks': 'off',
    },
    linterOptions: {
      // Those legacy disable comments are mostly inert now that the rules are
      // off; flagging each one would drown the signal this config exists for.
      reportUnusedDisableDirectives: 'off',
    },
  },
];
