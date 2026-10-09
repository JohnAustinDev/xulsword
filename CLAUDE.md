# Rules

## CSS browser support

All xulsword CSS must work on:

- Chrome (desktop and Android), Edge, Opera and Firefox back to about mid 2020
  (Chrome/Edge 85, Opera 71, Firefox 78).
- Safari and iOS Safari back to about mid 2021 (Safari 15).

Before using a CSS feature, check its support (caniuse.com or MDN) against
these versions. If it is newer, use an older equivalent, or add a fallback that
keeps the layout correct in browsers that drop the newer declaration. Newer
features that are easy to reach for but not supported include: `safe`/`unsafe`
alignment keywords, `inset`, `aspect-ratio`, `:is()`/`:where()`, `:has()`,
container queries, CSS nesting, `dvh`/`svh`/`lvh` units and `color-mix()`.
