import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: [
      'coverage/**',
      'dist/**',
      'docs/.vitepress/.temp/**',
      'docs/.vitepress/cache/**',
      'docs/.vitepress/dist/**',
      'node_modules/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.{js,ts,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.node,
      },
      parserOptions: {
        parser: tseslint.parser,
        sourceType: 'module',
      },
    },
    rules: {
      'vue/html-indent': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
    },
  },
  {
    files: ['tests/**/*.{ts,vue}'],
    languageOptions: {
      globals: globals.vitest,
    },
  },
]
