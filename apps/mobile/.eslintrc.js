module.exports = {
  extends: ['expo', 'prettier'],
  plugins: ['prettier', '@typescript-eslint'],
  rules: {
    'prettier/prettier': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/ban-types': 'off', // Deprecated rule causing errors
    'react/react-in-jsx-scope': 'off',
  },
};
