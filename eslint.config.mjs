import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginReactConfig from 'eslint-plugin-react/configs/recommended.js';
import eslintConfigPrettier from 'eslint-config-prettier';

import path from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import pluginJs from '@eslint/js';

// mimic CommonJS variables -- not needed if using CommonJS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: pluginJs.configs.recommended,
});
const config = [
  {
    ignores: [
      'eslint.config.mjs',
      'afterPack.js',
      'babel.config.js',
      'type.d.ts',
      '**/assets/',
      '**/node_modules_xulsword/',
      '**/build/',
      '**/.erb/',
    ],
  },
  { languageOptions: { globals: globals.browser } },
  ...compat.extends('standard-with-typescript'),
  ...tseslint.configs.recommended,
  {
    ...pluginReactConfig,
    settings: { react: { version: 'detect' } },
  },
  eslintConfigPrettier,
  {
    rules: {
      'space-before-function-paren': 'off',
      '@typescript-eslint/space-before-function-paren': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/semi': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      '@typescript-eslint/consistent-type-assertions': 'off',
    },
  },
];

// Remove this duplicate plugin definition that causes an exception.
const base = config.find((c) => c.name === 'typescript-eslint/base');
if (base) delete base.plugins;

// console.log(config);

export default config;
