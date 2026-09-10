// A Webpack loader that rewrites a stylesheet so every rule it contains
// applies only inside the web-app's #root element.
//
// WHY: xulsword's own CSS is written against #root already, but the two
// third-party stylesheets it depends on - normalize.css and Blueprint - are
// document-level resets. They style html, body and bare elements (p, a,
// button, table cells, form controls...). That is correct when xulsword owns
// the whole document, as it does in the Electron app and in the iframe
// web-app. It is wrong when the web-app is rendered directly into a host
// page, as the IBT website does, because the reset would restyle the entire
// host page.
//
// Rather than fork the stylesheets per target, this loader scopes them so a
// single build is correct for both web targets. It runs on the raw CSS,
// before css-loader, and only on the files webpack.config.mjs points at.
//
// The scope is a real id, which does two jobs at once: it confines the rules to
// #root, and it lifts them above the host page's own CSS. A host page cannot
// reach into #root with an id (IBT's Tarapro theme, for instance, uses ids only
// on page-structure elements such as #main and #header, never as ancestors of
// content), so one id is enough to win every such conflict.
//
// The critical property is that EVERY rule in the bundle gains exactly one id.
// Relative specificity within the web-app is then completely unchanged and only
// its standing against the host page moves. Uniformity is why both modes below
// exist, and why an already-#root selector is doubled rather than skipped.
//
// MODES
//
// 'reset' - for third-party stylesheets (normalize.css, the Blueprint subset),
//   which are document-level: they style html, body and bare elements.
//
//     html            ->  #root              (also body and :root)
//     html.foo        ->  #root.foo
//     p               ->  #root p
//     *, *::before    ->  #root *, #root *::before
//
// 'webapp' - for xulsword's own CSS, which is already written against #root.
//
//     .atext .pin     ->  #root .atext .pin        (gains one id)
//     #historyButtons ->  #root #historyButtons    (gains one id)
//     #root a         ->  #root#root a             (gains one id; the doubled
//     #root.foo .bar  ->  #root#root.foo .bar       id matches the same single
//                                                   element, so only the
//                                                   specificity changes)
//     html.ownsDocument   ->  unchanged  (deliberately document-level; see
//     html.ownsDocument body -> unchanged  global-htm.css)
//
// @keyframes steps (from/to/50%) are not element selectors and are skipped in
// both modes.
//
// If an upgrade of a third-party stylesheet introduces a selector this loader
// cannot scope safely - a descendant `html body` for instance - the build fails
// with the offending selector rather than emitting CSS that silently matches
// nothing.

// CommonJS: webpack's loader-runner require()s loaders, so this file cannot
// be an ES module even though the rest of the repo is.
const postcss = require('postcss');
const selectorParser = require('postcss-selector-parser');

// A real id: confines the rules to #root and lifts them above host page CSS.
const SCOPE = '#root';

// Selectors standing for "the document root", which are replaced by the scope
// rather than being prefixed with it.
const DOCUMENT_TAGS = new Set(['html', 'body']);

function isDocumentRoot(node) {
  return (
    (node.type === 'tag' && DOCUMENT_TAGS.has(node.value.toLowerCase())) ||
    (node.type === 'pseudo' && node.value.toLowerCase() === ':root')
  );
}

// Scope a single selector (never a comma-separated list; postcss splits those
// for us). Returns the rewritten selector. `mode` is 'reset' or 'webapp'.
function scopeSelector(selector, filename, mode) {
  // What to do with this selector:
  //   'descendant' - nest the whole selector under the scope
  //   'replace'    - swap a leading html/body/:root for the scope ('reset')
  //   'double'     - duplicate a leading #root to add one id ('webapp')
  //   'keep'       - leave untouched (deliberately document-level, 'webapp')
  let action = 'descendant';

  const remainder = selectorParser((root) => {
    const [sel] = root.nodes;
    if (!sel) return;
    const nodes = sel.nodes.filter((n) => n.type !== 'comment');
    if (!nodes.length) return;

    const firstCombinator = nodes.findIndex((n) => n.type === 'combinator');
    const head =
      firstCombinator === -1 ? nodes : nodes.slice(0, firstCombinator);
    const tail = firstCombinator === -1 ? [] : nodes.slice(firstCombinator);

    if (mode === 'webapp') {
      // xulsword's own CSS. Its html/body rules are deliberately
      // document-level (the ownsDocument rules in global-htm.css and the
      // @media print reset), so leave them exactly as written.
      if (head.some(isDocumentRoot) || tail.some(isDocumentRoot)) {
        action = 'keep';
        return;
      }
      // A selector already starting at #root has its id doubled, so it gains
      // one id like every other rule and the internal cascade is preserved.
      // #root#root matches the same single element.
      if (head.some((n) => n.type === 'id' && n.value === 'root')) {
        action = 'double';
      }
      return;
    }

    // mode 'reset': only the first compound may carry a document-root
    // selector. Anything later (`html body`) cannot be expressed once
    // html/body become an element inside the document, so refuse rather than
    // emit a dead selector.
    const stranded = tail.find(isDocumentRoot);
    if (stranded) {
      throw new Error(
        `scopeCssToRoot: cannot scope "${String(sel).trim()}" in ${filename}: ` +
          `"${stranded.toString().trim()}" appears after a combinator. Scope ` +
          `this rule by hand, or extend the loader to handle it.`,
      );
    }

    const rootNode = head.find(isDocumentRoot);
    if (rootNode) {
      action = 'replace';
      // Drop it; SCOPE is concatenated onto whatever else the compound holds,
      // so `html` becomes `#root` and `html.foo` `#root.foo`.
      rootNode.remove();
    }
  }).processSync(selector);

  if (action === 'keep') return selector;
  if (action === 'replace') return `${SCOPE}${remainder.trim()}`;
  if (action === 'double') return `${SCOPE}${selector.trim()}`;
  return `${SCOPE} ${selector.trim()}`;
}

const scopePlugin = (filename, mode) => ({
  postcssPlugin: 'scope-css-to-root',
  Rule(rule) {
    for (let p = rule.parent; p; p = p.parent) {
      if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return;
    }
    rule.selectors = rule.selectors.map((s) =>
      scopeSelector(s, filename, mode),
    );
  },
});
scopePlugin.postcss = true;

module.exports = function scopeCssToRootLoader(source) {
  const callback = this.async();
  const filename = this.resourcePath;
  // 'reset' for third-party document-level stylesheets, 'webapp' for xulsword's
  // own CSS. webpack.config.mjs selects the mode per file.
  const { mode = 'reset' } = this.getOptions?.() ?? {};
  postcss([scopePlugin(filename, mode)])
    .process(source, { from: filename, to: filename })
    .then((result) => callback(null, result.css))
    .catch((er) => callback(er));
};
