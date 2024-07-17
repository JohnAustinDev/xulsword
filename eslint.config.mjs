import globals from 'globals';
import js from '@eslint/js';
import ts from 'typescript-eslint';
import react from 'eslint-plugin-react/configs/recommended.js';
import { fixupConfigRules } from '@eslint/compat';
import prettier from 'eslint-config-prettier';

const config = [
  {
    files: ['**/*.{mjs,js,ts,tsx}'],
  },
  {
    ignores: [
      '*.d.ts',
      '**/assets/',
      '**/build/',
      '**/Cpp/',
      '**/node_modules/',
      '**/util/',
      '**/.dll',
      '**/.vscode/',
    ],
  },
  {
    settings: { react: { version: 'detect' } },
  },
  { languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } },
  { languageOptions: { globals: globals.browser } },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...fixupConfigRules(react),
  prettier,

  // Rules to be applied only to src:
  {
    files: ['src/**/*.{mjs,js,ts,tsx}'],
    rules: {
      'space-before-function-paren': 'off',
      'no-console': 'error',
      'no-undef': 'off', // Some Typescript types would cause errors
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: ['variableLike', 'memberLike'],
          format: ['camelCase', 'PascalCase'],
        },
        {
          selector: ['memberLike'],
          modifiers: ['static'],
          format: ['UPPER_CASE', 'camelCase', 'PascalCase'],
        },
        {
          selector: ['variable', 'parameter'],
          modifiers: ['unused'],
          format: ['camelCase', 'PascalCase'],
          leadingUnderscore: 'require',
        },
        {
          selector: ['variable', 'parameter'],
          modifiers: ['unused', 'destructured'],
          format: ['camelCase', 'PascalCase'],
          leadingUnderscore: 'forbid',
        },
        {
          selector: ['typeLike'],
          format: ['PascalCase'],
        },
      ],
    },
  },

  // Rules to be applied only outside src (ie to config):
  {
    ignores: ['src/**/*'],
    rules: {
      'no-unused-vars': 'error',
      'no-unused-expressions': 'error',
    },
  },

  // Rules to be applied to src and config code:
  {
    rules: {
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],

      // Loosen up some TypeScript rules.
      '@typescript-eslint/space-before-function-paren': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/semi': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/no-unused-vars': 'off', // allow, but underscore is required by naming-convention

      // Tighten up Javascript rules (also to enforce consistent js style)
      'prefer-destructuring': [
        'error',
        { array: true, object: true },
        {
          enforceForRenamedProperties: false,
        },
      ],
      'constructor-super': 'error',
      'getter-return': 'error',
      'no-const-assign': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-dupe-keys': 'error',
      'no-func-assign': 'error',
      'no-import-assign': 'error',
      'no-new-native-nonconstructor': 'error',
      'no-obj-calls': 'error',
      //'no-redeclare': 'error' // TypeScript overloads would cause errors
      'no-setter-return': 'error',
      'no-this-before-super': 'error',
      'no-unreachable': 'error',
      'no-unsafe-negation': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-spread': 'error',
    },
    languageOptions: {
      parserOptions: { project: './tsconfig.json' },
    },
  },
];

// console.log(config);

export default config;
