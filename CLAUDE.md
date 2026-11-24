# Rules

## IBT servers ban clients after repeated 404s

More than some number of "404 Not Found" responses from an IBT URL (ibt.org.ru
or ibtrussia.org including subdomains such as ftp.ibt.org.ru) gets the client banned.
So after a single 404 from an IBT server, stop: do not retry or keep testing. Ask the
user why it returned 404, then record what you learn in the list below to keep 404s to
a minimum.

What is known to cause IBT 404s:

- Web-app dev server: every `webapp.html`, `test.html` or `test-fixed.html` load with a
  query string (such as `?storeid=none`) makes `scripts/drupalSettingsProxy.mjs` GET
  `$WEBAPP_API_URL<query>`. When the dev server is running and `$WEBAPP_API_URL` points
  to an IBT URL, each page load makes that request to ibtrussia.org. Those requests return
  404 if you include a `verse` query parameter to a verse that is not found in the first
  module of the `texts` parameter's list. If you are not sure, don't include `verse` in the
  query but instead change verse location after the page has loaded. Also, test.html and
  test-fixed.html (but NOT webapp.html) always require the `texts` param to be set to at
  least one text, and all listed texts must be available.

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
