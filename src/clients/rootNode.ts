// xulsword's elements live either in the document (Electron windows) or in a
// shadow root (the web-app, see renderToRoot() in controller.tsx). `document`
// cannot see into a shadow root, so code that looks up xulsword's elements, or
// adds styles for them, must go through these functions instead.

let rootNode: Document | ShadowRoot | null = null;
let styleParent: Node | null = null;
const pendingStyles: HTMLElement[] = [];

// Set the node containing the #root element. This must be called once, before
// rendering, by every web-app entry point: until it is, the web-app's bundled
// stylesheets are held back (see insertStyle below).
export function setRootNode(node: Document | ShadowRoot) {
  rootNode = node;
  styleParent = node === document ? document.head : node;
  pendingStyles.splice(0).forEach((style) => styleParent?.appendChild(style));
}

// The Document or ShadowRoot containing the #root element.
export function getRootNode(): Document | ShadowRoot {
  return rootNode ?? document;
}

// The #root element, to which all of xulsword's CSS is scoped.
export function getRootElement(): HTMLElement | null {
  return getRootNode().getElementById('root');
}

// Where BlueprintJS portals (dialogs, popovers, toasts) are put: #root, so
// that they get the CSS variables, skin rules and window classes that are all
// set on #root. BlueprintJS's default, document.body, is outside the
// web-app's shadow root, where none of xulsword's CSS applies.
export function getPortalContainer(): HTMLElement | undefined {
  return getRootElement() ?? undefined;
}

// The host page element the web-app's shadow root is attached to, or null for
// Electron windows, which own their document and so have no host page.
export function getShadowHost(): Element | null {
  const node = getRootNode();
  return node instanceof ShadowRoot ? node.host : null;
}

// Where to put a <style> element so that it applies to xulsword's elements.
export function getStyleParent(): Node {
  return styleParent ?? document.head;
}

// Chromium's window.getSelection() retargets a selection inside a shadow root
// to the shadow host, but its non-standard ShadowRoot.getSelection() does not.
// Other browsers return the real selection from window.getSelection().
export function getSelection(): Selection | null {
  const root = getRootNode() as Node & {
    getSelection?: () => Selection | null;
  };
  return (
    (typeof root.getSelection === 'function' && root.getSelection()) ||
    window.getSelection()
  );
}

// style-loader calls this to insert each of the web-app's bundled stylesheets,
// instead of appending them to document.head (see webpack.config.mjs). They
// are evaluated before the shadow root exists, so hold them until it does.
export default function insertStyle(style: HTMLElement) {
  if (styleParent) styleParent.appendChild(style);
  else pendingStyles.push(style);
}

// Stop pointerdown events that open the context menu from reaching any of
// xulsword's handlers. Handlers act on pointerdown, but right-click (and
// middle-click, and macOS ctrl+click) are not clicks. Call this on a React
// root container before createRoot(), so this capture listener runs before
// React's own listeners on the same element.
export function ignoreMouseRightClick(container: HTMLElement) {
  const isMac = /Mac/.test(navigator.platform);
  container.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      if (e.button !== 0 || (isMac && e.ctrlKey)) {
        e.stopImmediatePropagation();
      }
    },
    true,
  );
}
