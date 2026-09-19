import globals from 'globals';
import js from '@eslint/js';
import ts from 'typescript-eslint';
import react from 'eslint-plugin-react/configs/recommended.js';
import { fixupConfigRules } from '@eslint/compat';
import prettier from 'eslint-config-prettier';
import compat from 'eslint-plugin-compat';

const config = [
  {
    files: ['**/*.{mjs,js,ts,tsx}'],
  },
  {
    ignores: [
      // Must be '**/*.d.ts': a bare '*.d.ts' only matches the repo root, and
      // every .d.ts file here is in a subdirectory, so nothing was excluded
      // and each one raised a 'not found in any of the provided project(s)'
      // parsing error.
      '**/*.d.ts',
      '**/assets/',
      '**/archive/',
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

  // Check browser API usage against the targets in .browserslistrc. This
  // matters because @babel/preset-env is configured without useBuiltIns (to
  // keep the webapp bundle small), so it compiles down *syntax* only: a newer
  // built-in method like Object.hasOwn() is left as-is and simply throws on a
  // browser too old to have it. Nothing else catches that.
  //   - lintAllEsApis extends the check from DOM APIs to ES built-ins. It's
  //     marked experimental upstream, but it's precisely the class of
  //     breakage this is here to prevent.
  //   - ignoreConditionalChecks reports calls inside an if() too. Without it
  //     the plugin assumes 'if (!Object.hasOwn(a, b))' is feature detection
  //     and stays quiet, which is how the one real instance went unnoticed.
  ...[
    // Code that ships to the webapp/widgets, plus the shared modules they
    // bundle, checked against the default (webapp) browserslist section. The
    // Electron windows only ever run in the bundled Chromium, so they get the
    // far newer 'electron' section.
    { files: ['src/*.{js,ts,tsx}', 'src/clients/**/*.{js,ts,tsx}'],
      ignores: ['src/clients/app/**'], env: 'defaults' },
    { files: ['src/clients/app/**/*.{js,ts,tsx}'], env: 'electron' },
  ].map(({ files, ignores, env }) => ({
    files,
    ...(ignores ? { ignores } : {}),
    ...compat.configs['flat/recommended'],
    settings: {
      lintAllEsApis: true,
      ignoreConditionalChecks: true,
      browserslistOpts: { env },
    },
    rules: {
      ...compat.configs['flat/recommended'].rules,
      // eslint-plugin-compat resolves statics and globals (Object.hasOwn,
      // structuredClone) but not instance methods, because it can't tell what
      // a receiver's type is. Array.prototype.at() is the one that has bitten
      // us, so ban it outright rather than leave it unchecked. Electron code
      // is exempt: Chromium 138 has had it for years.
      ...(env === 'defaults'
        ? {
            'no-restricted-syntax': [
              'error',
              {
                selector: "CallExpression[callee.property.name='at']",
                message:
                  '.at() needs Chrome 92 / Safari 15.4 / Firefox 90, which is above the floor in .browserslistrc, and Babel does not polyfill built-in methods. Use last() from common.ts, or index arithmetic.',
              },
            ],
          }
        : {}),
    },
  })),

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
