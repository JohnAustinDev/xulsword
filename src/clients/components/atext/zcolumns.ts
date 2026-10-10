// Multi-column text panels for Bibles and general books lay out text in CSS
// columns within the scripture box (sb), and page through it by scrolling the
// sb horizontally. These functions do the column math for both LTR and RTL
// text (RTL scrollLeft is 0 at the start and negative after that).

// Indexes of panels which are to show the last page of the next text they
// load. This can't be stored on the panel itself, since the panel may be
// re-mounted before the text loads.
export const showLastPage = new Set<number>();

export type ColumnMetrics = {
  columns: number; // columns per page
  pitch: number; // px from the start of one column to the next
  sign: 1 | -1; // -1 for RTL
};

// IMPORTANT: Text-column indexes are zero based. So given 5 text-columns shown
// in 3 page-columns:
// text-column 0 is page 1, page-column 1
// text-column 4 is page 2, page-column 2.

// Returns null if sb is not a multi-column box.
export function columnMetrics(sb: HTMLElement): ColumnMetrics | null {
  const cs = window.getComputedStyle(sb);
  const columns = parseInt(cs.columnCount, 10);
  if (!columns || columns < 2) return null;
  const gap =
    cs.columnGap === 'normal'
      ? parseFloat(cs.fontSize)
      : parseFloat(cs.columnGap) || 0;
  const width =
    sb.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  return {
    columns,
    pitch: (width + gap) / columns,
    sign: cs.direction === 'rtl' ? -1 : 1,
  };
}

// The index of the first column currently showing.
export function firstColumn(sb: HTMLElement, m: ColumnMetrics): number {
  return Math.round(Math.abs(sb.scrollLeft) / m.pitch);
}

// The column is also recorded, so that it can be restored if the column
// pitch changes.
export function scrollToColumn(
  sb: HTMLElement,
  m: ColumnMetrics,
  column: number,
) {
  const c = Math.max(0, column);
  sb.scrollLeft = m.sign * c * m.pitch;
  sb.dataset.column = c.toString();
  // Layout may change again before it is painted (such as when a scrollbar
  // comes or goes), which a ResizeObserver might never report. So realign
  // once it has been.
  window.requestAnimationFrame(() => {
    const m2 = columnMetrics(sb);
    if (m2 && sb.dataset.column === c.toString())
      sb.scrollLeft = m2.sign * c * m2.pitch;
  });
}

// Scroll again to the last column scrolled to, as after a resize.
export function restoreColumn(sb: HTMLElement) {
  const m = columnMetrics(sb);
  const { column } = sb.dataset;
  if (m) scrollToColumn(sb, m, column ? Number(column) : firstColumn(sb, m));
}

// The index of the column containing a client rect's start edge.
function columnOfRect(sb: HTMLElement, m: ColumnMetrics, r: DOMRect): number {
  const sbr = sb.getBoundingClientRect();
  const cs = window.getComputedStyle(sb);
  const visual =
    m.sign === 1
      ? r.left - (sbr.left + sb.clientLeft + parseFloat(cs.paddingLeft))
      : sbr.left +
        sb.clientLeft +
        sb.clientWidth -
        parseFloat(cs.paddingRight) -
        r.right;
  return Math.max(
    0,
    Math.floor((visual + m.sign * sb.scrollLeft + 1) / m.pitch),
  );
}

// The index of the column where element e begins, or null if e has no box.
export function columnOf(
  sb: HTMLElement,
  m: ColumnMetrics,
  e: Element,
): number | null {
  const [r] = Array.from(e.getClientRects());
  return r ? columnOfRect(sb, m, r) : null;
}

// The index of the last column having content.
export function lastContentColumn(sb: HTMLElement, m: ColumnMetrics): number {
  for (let e = sb.lastElementChild; e; e = e.previousElementSibling) {
    if (!e.classList.contains('col-spacer')) {
      const rects = Array.from(e.getClientRects()).filter(
        (r) => r.width || r.height,
      );
      if (rects.length) return columnOfRect(sb, m, rects[rects.length - 1]);
    }
  }
  return 0;
}

// The text-column index of the first column of the page containing the given
// text-column index.
export function pageStart(m: ColumnMetrics, column: number): number {
  return column - (column % m.columns);
}

export function columnIsShowing(
  sb: HTMLElement,
  m: ColumnMetrics,
  column: number,
): boolean {
  const first = firstColumn(sb, m);
  return column >= first && column < first + m.columns;
}

// Scrolling requires empty columns after the content, so that any content
// column can be scrolled to the start of the page. A trailing spacer, a page
// tall, provides them (break-before: column is not supported in older
// Firefox multi-column layouts).
export function updateColumnSpacer(sb: HTMLElement) {
  const m = columnMetrics(sb);
  let spacer = sb.lastElementChild as HTMLElement | null;
  if (!spacer?.classList.contains('col-spacer')) spacer = null;
  if (!m) {
    spacer?.remove();
    return;
  }
  if (!spacer) {
    spacer = document.createElement('div');
    spacer.className = 'col-spacer';
    sb.appendChild(spacer);
  }
  spacer.style.height = `${m.columns * sb.clientHeight}px`;
}

// Scroll a multi-column sb one page forward or back if it can be, returning
// true if so. If test is true, only report whether it could be.
export function scrollPage(
  sb: HTMLElement,
  next: boolean,
  test = false,
): boolean {
  const m = columnMetrics(sb);
  if (!m) return false;
  const first = firstColumn(sb, m);
  if (next) {
    if (first + m.columns > lastContentColumn(sb, m)) return false;
    if (!test) scrollToColumn(sb, m, first + m.columns);
  } else {
    if (first <= 0) return false;
    if (!test) scrollToColumn(sb, m, first - m.columns);
  }
  return true;
}

export function scrollToFirstPage(sb: HTMLElement) {
  const m = columnMetrics(sb);
  if (m) scrollToColumn(sb, m, 0);
}

// Scroll to the last page-aligned page of a multi-column sb.
export function scrollToLastPage(sb: HTMLElement) {
  const m = columnMetrics(sb);
  if (m) scrollToColumn(sb, m, pageStart(m, lastContentColumn(sb, m)));
}
