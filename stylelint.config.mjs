// Checks CSS against the browser targets in .browserslistrc. This exists
// because the webpack CSS pipeline (css-loader + style-loader) neither
// transforms nor validates CSS, so unsupported syntax otherwise ships
// silently - and a media query using range syntax, '(width < 1000px)', did
// exactly that: browsers below the floor drop the whole block as invalid,
// taking every rule inside it with them.
//
// This checks compatibility only. It deliberately does not extend
// stylelint-config-standard, so it reports nothing about formatting or style.
// Each entry was checked against the targets and found to degrade cleanly.
// Add to this list only with a reason.
const ignore = [
          // Every :has() rule in the app's CSS is wrapped in
          // '@supports selector(:has(a))' with a fallback in the matching
          // '@supports not' block, so older browsers get the fallback rather
          // than nothing. doiuse doesn't understand @supports guards, so it
          // has to be excluded here. (webapp/head.css is the exception: it
          // uses :has() unguarded by design, being a host-page stylesheet.)
          'css-has',
          // Flagged only for iOS Safari, which has no pointer cursor to
          // style in the first place.
          'css3-cursors',
          'css3-cursors-grab',
          // Same: 'resize' is meaningless on touch, where the element just
          // stays its default size.
          'css-resize',
          // Used only as ':focus-visible { outline: transparent }' - i.e. to
          // *remove* an outline. Safari 15.0-15.3 drops those rules and shows
          // its default focus ring, which is a cosmetic difference and not an
          // accessibility loss.
          'css-focus-visible',
          // caniuse records Safari as never fully supporting touch-action
          // (it honours 'manipulation' but not every value). The one use is
          // 'touch-action: none' on the drag-sizer handle; without it a drag
          // may also scroll the page, which is a pre-existing degradation on
  // iOS rather than a break.
  'css-touch-action',
];

const rule = (extraIgnores = []) => ({
  'plugin/no-unsupported-browser-features': [
    true,
    {
      severity: 'error',
      // Only report features with no support at all in a target browser.
      // Partial support is usually a vendor-prefix or edge-case caveat, and
      // reporting it buries the real breakage in noise.
      ignorePartialSupport: true,
      ignore: [...ignore, ...extraIgnores],
    },
  ],
});

export default {
  plugins: ['stylelint-no-unsupported-browser-features'],
  rules: rule(),
  overrides: [
    {
      // .scss needs a SCSS-aware parser; the default CSS parser treats '//'
      // comments as syntax errors.
      files: ['**/*.scss'],
      customSyntax: 'postcss-scss',
      // Sass compiles its own nesting away at build time, so nesting in a
      // .scss file never reaches a browser. Native CSS nesting in a plain
      // .css file genuinely would break, so this is scoped to .scss only.
      rules: rule(['css-nesting']),
    },
  ],
};
