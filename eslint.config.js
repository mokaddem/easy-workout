import { existsSync, readFileSync } from 'node:fs';
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/** Local-only excludes (`.git/info/exclude`), so untracked files never need listing here. */
const localExcludes = existsSync('.git/info/exclude')
  ? readFileSync('.git/info/exclude', 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((pattern) => (pattern.endsWith('/') ? `${pattern}**` : pattern))
  : [];

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'coverage',
      'playwright-report',
      'test-results',
      ...localExcludes,
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
);
