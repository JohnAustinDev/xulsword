import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";

import path from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import pluginJs from "@eslint/js";

// mimic CommonJS variables -- not needed if using CommonJS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({baseDirectory: __dirname, recommendedConfig: pluginJs.configs.recommended});

const config = [
  {languageOptions: { globals: globals.browser }},
  ...compat.extends("standard-with-typescript"),
  ...tseslint.configs.recommended,
  pluginReactConfig,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      'space-before-function-paren': 'off',
      '@typescript-eslint/space-before-function-paren': 'off',
      'semi': ['error', 'always'],
      '@typescript-eslint/semi': 'off',
      '@typescript-eslint/member-delimiter-style': ['error', {
        "multiline": {
          "delimiter": "semi",
          "requireLast": true
        },
        "singleline": {
          "delimiter": "semi",
          "requireLast": false
        },
        "multilineDetection": "brackets"
      }],
    },
  },
  {
    ignores: ['eslint.config.mjs']
  },
];

// Remove this duplicate plugin definition that causes an exception.
const base = config.find((c) => c.name === 'typescript-eslint/base');
if (base) delete base.plugins;

// console.log(config);

export default config;
