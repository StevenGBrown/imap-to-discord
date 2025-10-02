import { includeIgnoreFile } from '@eslint/compat'
import { defineConfig } from 'eslint/config'
import eslintJs from '@eslint/js'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import eslintPluginSecurity from 'eslint-plugin-security'
import typescriptEslint from 'typescript-eslint'
import * as path from 'node:path'

/**
 * @see https://eslint.org/docs/latest/use/configure/
 */
export default defineConfig(
  // https://eslint.org/
  eslintJs.configs.recommended,

  // https://typescript-eslint.io/
  typescriptEslint.configs.strictTypeChecked,
  typescriptEslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // https://typescript-eslint.io/blog/project-service/
        projectService: true,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': 'off',

      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
    },
  },

  // https://github.com/prettier/eslint-plugin-prettier/
  eslintPluginPrettierRecommended,

  // https://github.com/eslint-community/eslint-plugin-security
  eslintPluginSecurity.configs.recommended,

  // Ignores
  {
    // Configuration files
    ignores: ['**/*.js', '**/*.mjs'],
  },
  // Generated code
  includeIgnoreFile(path.resolve(import.meta.dirname, '.gitignore'))
)
