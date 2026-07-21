// @ts-check
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Global ignores (replaces .eslintrc.json ignorePatterns + .eslintignore)
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      'coverage/**',
      '.jest-cache/**',
      '.eslintcache',
      'logs/**',
      '*.log',
      '.env',
      '.env.*',
      '**/*.d.ts',
      '*.config.js',
      '*.config.mjs',
      '*.setup.ts',
      'jest.*.ts',
      'src/examples/**',
      '.backup/**',
      'performance-results/**',
      // Test files excluded from tsconfig.json — cannot be type-checked
      '**/__tests__/**',
      '**/*.test.ts',
      '**/*.spec.ts',
    ],
  },

  // TypeScript recommended + type-checked rules (includes ESLint recommended)
  ...tseslint.configs.recommendedTypeChecked,

  // Parser options for type-checked rules
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.scripts.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Main config for TypeScript source files
  {
    files: ['src/**/*.ts'],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2020,
        ...globals.jest,
      },
    },
    rules: {
      // TypeScript Specific Rules
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      // ENFORCE: Avoid 'any' type — use proper types or 'unknown' with type guards
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            arguments: false,
          },
        },
      ],

      // Type-aware rules — downgraded to warnings to match tsconfig.json legacy
      // TODO: Upgrade to errors after full strict mode compliance
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/unbound-method': 'warn',

      // Enable rules that require strictNullChecks
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Code Quality Rules
      // ENFORCE: Use Winston logger instead of console methods
      'no-console': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'warn',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-throw-literal': 'error',

      // Cross-boundary protection: backend must not import from frontend.
      // Use @sc-fleet-manager/shared-types for shared contracts.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/frontend/**', '../../frontend/**', '../../../frontend/**'],
              message:
                'Cross-boundary import banned. Backend must not import from frontend. Use @sc-fleet-manager/shared-types.',
            },
          ],
        },
      ],

      // Import Rules
      'import/no-duplicates': 'error',
      'import/no-default-export': 'error',
      'import/prefer-default-export': 'off',
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],

      // Security Rules
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "SpreadElement[argument.type='MemberExpression'][argument.object.name='req'][argument.property.name='body']",
          message:
            'Use sanitizeObject() (with an allowlist) instead of spreading req.body to prevent prototype pollution. NOTE: This rule only catches direct spreads like `{ ...req.body }`. Aliasing patterns like `const body = req.body; const data = { ...body };` are NOT detected. Do not alias req.body before spreading.',
        },
        {
          selector:
            "SpreadElement[argument.type='MemberExpression'][argument.object.name='req'][argument.property.name='query']",
          message:
            'Use sanitizeQueryParams() (with an allowlist) instead of spreading req.query to prevent prototype pollution. NOTE: This rule only catches direct spreads like `{ ...req.query }`. Aliasing patterns like `const query = req.query; const data = { ...query };` are NOT detected. Do not alias req.query before spreading.',
        },
        {
          selector: "Property[key.name='__proto__'], Property[key.value='__proto__']",
          message: 'Do not assign to __proto__ — this can cause prototype pollution.',
        },
      ],

      // Best Practices
      'no-return-await': 'off',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      'require-await': 'off',
      '@typescript-eslint/require-await': 'warn',
      'no-async-promise-executor': 'error',
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': [
        'error',
        {
          allowShortCircuit: true,
          allowTernary: true,
          allowTaggedTemplates: true,
        },
      ],

      // Style Consistency
      'prefer-template': 'warn',
      'object-shorthand': 'warn',
      'arrow-body-style': ['warn', 'as-needed'],

      // Maintainability signals (F2) — WARNINGS ONLY (non-blocking), to surface
      // oversized files/functions and high-complexity hotspots for the
      // decomposition program (E5). Thresholds are deliberately lenient so they
      // flag genuine monoliths, not ordinary code. Ratchet downward later.
      complexity: ['warn', 25],
      'max-lines-per-function': [
        'warn',
        { max: 200, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      'max-lines': ['warn', { max: 1000, skipBlankLines: true, skipComments: true }],
    },
  },

  // Override: Scripts, migrations, test utilities — allow console
  {
    files: ['src/scripts/**', 'src/migrations/**', 'src/tests/**'],
    rules: {
      'no-console': 'off',
    },
  },

  // Override: Logger utilities — allow console
  {
    files: ['src/utils/logger.ts', 'src/utils/*Transport.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // Override: App config and migration files — allow default exports
  {
    files: ['src/app.ts', '**/*.config.ts', '**/*.config.js', 'src/migrations/**/*.ts'],
    rules: {
      'import/no-default-export': 'off',
    },
  }
);
