import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // The server sits on an untyped JSON boundary: pg hands back untyped rows, and tool blobs
    // arrive as arbitrary client JSON that the descriptors validate as they write. Forcing
    // `unknown` here buys casts, not safety. Node globals, not browser ones.
    files: ['server/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    // Tests shim browser globals; that shim is `any` by nature.
    files: ['**/*.test.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
])
