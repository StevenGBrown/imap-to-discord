module.exports = {
  root: true,
  env: {
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
    ecmaVersion: 2020,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:node/recommended-module',
    'plugin:prettier/recommended',
    'plugin:security/recommended',
  ],
  rules: {
    'node/no-missing-import': 'off', // covered by import plugin
  },
  settings: {
    // eslint-import-resolver-typescript
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
      },
    },
  },
}
