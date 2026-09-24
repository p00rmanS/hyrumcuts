import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'legacy-php/**', 'supabase/.temp/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  {
    files: ['web/src/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'error', // no debug output left behind in production code
      eqeqeq: ['error', 'always'],
      // Content must never be parsed as HTML. The two trusted, bundled SVG icons are the only exception.
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Use textContent / lib/dom.js. Never parse content as HTML.' },
        { property: 'outerHTML', message: 'Use lib/dom.js.' },
        { property: 'insertAdjacentHTML', message: 'Use lib/dom.js.' },
      ],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    // Trusted, developer-supplied SVG files bundled at build time.
    files: ['web/src/public-site/sections.js'],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    files: ['web/tests/**/*.js', 'scripts/**/*.{js,mjs}', 'supabase/tests/**/*.{js,mjs}', 'vite.config.js', 'tailwind.config.js', 'eslint.config.js', 'playwright.config.js', 'e2e/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] },
  },
];
