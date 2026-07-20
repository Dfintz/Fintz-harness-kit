import expoConfig from 'eslint-config-expo/flat.js';

export default [
  ...expoConfig,
  {
    ignores: ['.expo/**', 'dist/**', 'coverage/**', 'android/**', 'ios/**'],
  },
  {
    files: ['**/__tests__/**/*.{js,jsx,ts,tsx}', 'jest.setup.js', 'jest.presetup.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
  },
];
