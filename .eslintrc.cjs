module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['react-refresh', '@typescript-eslint'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-unused-vars': 'off',
    'no-undef': 'off',
  },
  overrides: [
    {
      // react-refresh guards Fast Refresh boundaries in the dev server's module
      // graph. Test files and test helpers are never part of that graph, so the
      // rule reports mixed component/non-component exports (render helpers next
      // to fixtures) that cannot affect HMR.
      files: [
        'src/test/**/*.{ts,tsx}',
        'src/**/__tests__/**/*.{ts,tsx}',
        'src/**/*.{test,spec}.{ts,tsx}',
      ],
      rules: {
        'react-refresh/only-export-components': 'off',
      },
    },
  ],
};