import { getRootElement } from './rootNode.ts';

// Drop-down selects are customized (appearance: base-select) where the browser
// supports it and the device has a mouse (see global-htm.css). A customized
// select is only as wide as its selected option, but a native select is as
// wide as its widest option, so the layout would change with the selection.
// To keep the native layout, each select is measured as a native select (CSS
// does not customize a select while it has data-measuring) and given that
// width as its min-width. This is repeated whenever a select's options, the
// size of a select, the fonts, or the window size change.

const CustomSelectMedia = '(hover: hover) and (pointer: fine)';

const SelectQuery = 'select:not([multiple]):not([size])';

function customSelectsActive(): boolean {
  return (
    CSS.supports('appearance', 'base-select') &&
    window.matchMedia(CustomSelectMedia).matches
  );
}

function fitSelects(root: HTMLElement, resizeObserver: ResizeObserver) {
  const selects = Array.from(
    root.querySelectorAll(SelectQuery),
  ) as HTMLSelectElement[];
  selects.forEach((s) => {
    resizeObserver.observe(s);
    s.style.removeProperty('min-width');
  });
  if (!customSelectsActive()) return;
  // Measure all selects in one layout, as native selects.
  selects.forEach((s) => s.setAttribute('data-measuring', ''));
  const widths = selects.map((s) => parseFloat(getComputedStyle(s).width));
  selects.forEach((s, i) => {
    s.removeAttribute('data-measuring');
    // A hidden select has no width; it is measured when it is shown.
    if (widths[i] > 0) s.style.minWidth = `${widths[i]}px`;
  });
}

// True if a mutation may have changed a select or its options.
function changesSelect(record: MutationRecord): boolean {
  const { target } = record;
  const element =
    target.nodeType === Node.ELEMENT_NODE
      ? (target as Element)
      : target.parentElement;
  if (element?.closest('select')) return true;
  return Array.from(record.addedNodes).some(
    (n) =>
      n.nodeType === Node.ELEMENT_NODE &&
      ((n as Element).matches('select') ||
        !!(n as Element).querySelector('select')),
  );
}

// Start keeping the native widths of customized selects. Returns a function
// that stops it.
export default function keepNativeSelectWidths(): () => void {
  const root = getRootElement();
  if (!root || !CSS.supports('appearance', 'base-select')) return () => {};

  let frame: number | null = null;
  const resizeObserver = new ResizeObserver(() => schedule());
  function schedule() {
    if (frame === null) {
      frame = requestAnimationFrame(() => {
        frame = null;
        fitSelects(root as HTMLElement, resizeObserver);
      });
    }
  }

  const mutationObserver = new MutationObserver((records) => {
    if (records.some(changesSelect)) schedule();
  });
  mutationObserver.observe(root, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  const media = window.matchMedia(CustomSelectMedia);
  media.addEventListener('change', schedule);
  window.addEventListener('resize', schedule);
  document.fonts.addEventListener('loadingdone', schedule);
  schedule();

  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    mutationObserver.disconnect();
    resizeObserver.disconnect();
    media.removeEventListener('change', schedule);
    window.removeEventListener('resize', schedule);
    document.fonts.removeEventListener('loadingdone', schedule);
  };
}
