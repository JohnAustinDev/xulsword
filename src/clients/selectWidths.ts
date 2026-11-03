import { getRootElement } from './rootNode.ts';

// Drop-down selects are customized (appearance: base-select) where the browser
// supports it and the device has a mouse (see global-htm.css). A customized
// select is only as wide as its selected option, but a native select is as
// wide as its widest option, so the layout would change with the selection.
// To keep the native layout, each select is measured as a native select (CSS
// does not customize a select while it has data-measuring) and given that
// width as its min-width. This is repeated whenever a select's options, the
// size of a select, the fonts, or the window size change. An open select is
// not measured, since making it native closes its menu (opening a menu can
// itself load an option's font), so it is measured after it closes.

const CustomSelectMedia = '(hover: hover) and (pointer: fine)';

const SelectQuery = 'select:not([multiple]):not([size])';

function customSelectsActive(): boolean {
  return (
    CSS.supports('appearance', 'base-select') &&
    window.matchMedia(CustomSelectMedia).matches
  );
}

function isOpen(select: HTMLSelectElement): boolean {
  try {
    return select.matches(':open');
  } catch {
    return false;
  }
}

// Returns the open selects, which were left as they were.
function fitSelects(
  root: HTMLElement,
  resizeObserver: ResizeObserver,
): HTMLSelectElement[] {
  const all = Array.from(
    root.querySelectorAll(SelectQuery),
  ) as HTMLSelectElement[];
  all.forEach((s) => resizeObserver.observe(s));
  const open = all.filter(isOpen);
  const selects = all.filter((s) => !open.includes(s));
  selects.forEach((s) => s.style.removeProperty('min-width'));
  if (!customSelectsActive()) return open;
  // Measure all selects in one layout, as native selects.
  selects.forEach((s) => s.setAttribute('data-measuring', ''));
  const widths = selects.map((s) => parseFloat(getComputedStyle(s).width));
  selects.forEach((s, i) => {
    s.removeAttribute('data-measuring');
    // A hidden select has no width; it is measured when it is shown.
    if (widths[i] > 0) s.style.minWidth = `${widths[i]}px`;
  });
  return open;
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
  let openSelects: HTMLSelectElement[] = [];
  const resizeObserver = new ResizeObserver(() => schedule());
  function update() {
    frame = null;
    // While a select skipped by the last fit is open, check again each frame.
    if (!openSelects.some(isOpen)) {
      openSelects = fitSelects(root as HTMLElement, resizeObserver);
    }
    if (openSelects.length) schedule();
  }
  function schedule() {
    if (frame === null) frame = requestAnimationFrame(update);
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
