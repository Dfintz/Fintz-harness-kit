// @ts-check
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Global ignores (replaces ignorePatterns)
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      '*.config.*',
      '*.setup.*',
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.stories.tsx',
      '.storybook/**',
    ],
  },

  // TypeScript recommended rules (includes ESLint recommended)
  ...tseslint.configs.recommended,

  // Main config for TypeScript/React source files
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2020,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // New in typescript-eslint v8 recommended — disable to match v7 behavior
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'import/no-default-export': 'error',
      'import/prefer-default-export': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message: 'Use alias imports (@/) instead of relative parent imports (../)',
            },
            {
              group: ['**/backend/**', '../../backend/**', '../../../backend/**'],
              message:
                'Cross-boundary import banned. Frontend must not import from backend. Use @sc-fleet-manager/shared-types.',
            },
          ],
        },
      ],
    },
  },

  // Override: Allow default exports in entry points and config files
  {
    files: [
      'src/App.tsx',
      'src/index.tsx',
      '**/vite.config.ts',
      '**/*.config.ts',
      '**/*.stories.tsx',
    ],
    rules: {
      'import/no-default-export': 'off',
    },
  },

  // Mutation hook convention: every useMutation must declare cache invalidation
  // via `meta: { invalidates: [...] }` and route through the global handler in
  // `queryClient.ts` (see hooks/queries/mutationMeta.ts).
  // Manual `queryClient.invalidateQueries(...)` calls inside hook files are
  // rejected: they bypass the central handler and are the historic source of
  // forgotten/inconsistent invalidations.
  // Allowed escape hatch: hooks needing optimistic updates (onMutate/onError
  // rollback) — those should still call the global handler from onSettled.
  {
    files: ['src/hooks/queries/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='invalidateQueries']",
          message:
            'Use `meta: { invalidates: [...] }` instead of calling queryClient.invalidateQueries directly. See hooks/queries/mutationMeta.ts and /memories/repo/react-query-meta-invalidates.md.',
        },
      ],
    },
  }
);
