// Blueprint's own internal Icon component (used e.g. by Tag, Alert and Toast
// when they're given a raw icon-name string instead of our custom Icon from
// './icon.tsx') doesn't read from blueprintIconsShim.ts's SHM.BlueprintIcons_20
// map. Instead it calls @blueprintjs/icons' Icons.load(), whose default
// 'split-by-size' loader dynamically imports the *entire* generated 16px or
// 20px path barrel (`generated/{16,20}px/paths`, ~680 icons each,
// un-tree-shakeable) - one or the other depending on the requested icon size.
// webpack.config.mjs redirects both of those barrel imports to this file, so
// the loader gets only the same curated subset of 20px path data already
// bundled by blueprintIconsShim.ts, re-exported here under the plain names
// (e.g. "Add" instead of "AddPath") that the loader indexes into.
//
// This app only ships one icon grid (20px), so 16px-icon requests are served
// the same path data as 20px ones. (This can't just re-export from
// blueprintIconsShim.ts: webpack.NormalModuleReplacementPlugin resolves this
// file's own imports against the *replaced* module's original directory, not
// this file's real one, so relative imports here would break - hence the
// same full specifiers as blueprintIconsShim.ts's *Path exports, repeated.)
//
// If a Blueprint upgrade renders a new icon name through this native-Icon
// path rather than through './icon.tsx', add it to both this file and
// blueprintIconsShim.ts.

export { default as Add } from '@blueprintjs/icons/lib/esm/generated/20px/paths/add.js';
export { default as AddColumnRight } from '@blueprintjs/icons/lib/esm/generated/20px/paths/add-column-right.js';
export { default as Annotation } from '@blueprintjs/icons/lib/esm/generated/20px/paths/annotation.js';
export { default as ArrowDown } from '@blueprintjs/icons/lib/esm/generated/20px/paths/arrow-down.js';
export { default as ArrowLeft } from '@blueprintjs/icons/lib/esm/generated/20px/paths/arrow-left.js';
export { default as ArrowRight } from '@blueprintjs/icons/lib/esm/generated/20px/paths/arrow-right.js';
export { default as ArrowUp } from '@blueprintjs/icons/lib/esm/generated/20px/paths/arrow-up.js';
export { default as Asterisk } from '@blueprintjs/icons/lib/esm/generated/20px/paths/asterisk.js';
export { default as BringData } from '@blueprintjs/icons/lib/esm/generated/20px/paths/bring-data.js';
export { default as Calendar } from '@blueprintjs/icons/lib/esm/generated/20px/paths/calendar.js';
export { default as CaretDown } from '@blueprintjs/icons/lib/esm/generated/20px/paths/caret-down.js';
export { default as CaretRight } from '@blueprintjs/icons/lib/esm/generated/20px/paths/caret-right.js';
export { default as ChevronDown } from '@blueprintjs/icons/lib/esm/generated/20px/paths/chevron-down.js';
export { default as ChevronLeft } from '@blueprintjs/icons/lib/esm/generated/20px/paths/chevron-left.js';
export { default as ChevronRight } from '@blueprintjs/icons/lib/esm/generated/20px/paths/chevron-right.js';
export { default as ChevronUp } from '@blueprintjs/icons/lib/esm/generated/20px/paths/chevron-up.js';
export { default as Clipboard } from '@blueprintjs/icons/lib/esm/generated/20px/paths/clipboard.js';
export { default as CloudDownload } from '@blueprintjs/icons/lib/esm/generated/20px/paths/cloud-download.js';
export { default as Cog } from '@blueprintjs/icons/lib/esm/generated/20px/paths/cog.js';
export { default as Confirm } from '@blueprintjs/icons/lib/esm/generated/20px/paths/confirm.js';
export { default as Cross } from '@blueprintjs/icons/lib/esm/generated/20px/paths/cross.js';
export { default as Cut } from '@blueprintjs/icons/lib/esm/generated/20px/paths/cut.js';
export { default as Delete } from '@blueprintjs/icons/lib/esm/generated/20px/paths/delete.js';
export { default as Document } from '@blueprintjs/icons/lib/esm/generated/20px/paths/document.js';
export { default as DoubleCaretVertical } from '@blueprintjs/icons/lib/esm/generated/20px/paths/double-caret-vertical.js';
export { default as DoubleChevronDown } from '@blueprintjs/icons/lib/esm/generated/20px/paths/double-chevron-down.js';
export { default as DoubleChevronLeft } from '@blueprintjs/icons/lib/esm/generated/20px/paths/double-chevron-left.js';
export { default as DoubleChevronRight } from '@blueprintjs/icons/lib/esm/generated/20px/paths/double-chevron-right.js';
export { default as DoubleChevronUp } from '@blueprintjs/icons/lib/esm/generated/20px/paths/double-chevron-up.js';
export { default as DragHandleHorizontal } from '@blueprintjs/icons/lib/esm/generated/20px/paths/drag-handle-horizontal.js';
export { default as DragHandleVertical } from '@blueprintjs/icons/lib/esm/generated/20px/paths/drag-handle-vertical.js';
export { default as DrawerLeft } from '@blueprintjs/icons/lib/esm/generated/20px/paths/drawer-left.js';
export { default as Duplicate } from '@blueprintjs/icons/lib/esm/generated/20px/paths/duplicate.js';
export { default as Error } from '@blueprintjs/icons/lib/esm/generated/20px/paths/error.js';
export { default as Export } from '@blueprintjs/icons/lib/esm/generated/20px/paths/export.js';
export { default as FolderNew } from '@blueprintjs/icons/lib/esm/generated/20px/paths/folder-new.js';
export { default as FolderOpen } from '@blueprintjs/icons/lib/esm/generated/20px/paths/folder-open.js';
export { default as FolderShared } from '@blueprintjs/icons/lib/esm/generated/20px/paths/folder-shared.js';
export { default as Font } from '@blueprintjs/icons/lib/esm/generated/20px/paths/font.js';
export { default as Help } from '@blueprintjs/icons/lib/esm/generated/20px/paths/help.js';
export { default as Import } from '@blueprintjs/icons/lib/esm/generated/20px/paths/import.js';
export { default as InfoSign } from '@blueprintjs/icons/lib/esm/generated/20px/paths/info-sign.js';
export { default as KeyCommand } from '@blueprintjs/icons/lib/esm/generated/20px/paths/key-command.js';
export { default as KeyControl } from '@blueprintjs/icons/lib/esm/generated/20px/paths/key-control.js';
export { default as KeyDelete } from '@blueprintjs/icons/lib/esm/generated/20px/paths/key-delete.js';
export { default as KeyEnter } from '@blueprintjs/icons/lib/esm/generated/20px/paths/key-enter.js';
export { default as KeyOption } from '@blueprintjs/icons/lib/esm/generated/20px/paths/key-option.js';
export { default as KeyShift } from '@blueprintjs/icons/lib/esm/generated/20px/paths/key-shift.js';
export { default as Link } from '@blueprintjs/icons/lib/esm/generated/20px/paths/link.js';
export { default as Manual } from '@blueprintjs/icons/lib/esm/generated/20px/paths/manual.js';
export { default as MenuClosed } from '@blueprintjs/icons/lib/esm/generated/20px/paths/menu-closed.js';
export { default as MenuOpen } from '@blueprintjs/icons/lib/esm/generated/20px/paths/menu-open.js';
export { default as More } from '@blueprintjs/icons/lib/esm/generated/20px/paths/more.js';
export { default as OneColumn } from '@blueprintjs/icons/lib/esm/generated/20px/paths/one-column.js';
export { default as OpenApplication } from '@blueprintjs/icons/lib/esm/generated/20px/paths/open-application.js';
export { default as Plus } from '@blueprintjs/icons/lib/esm/generated/20px/paths/plus.js';
export { default as Print } from '@blueprintjs/icons/lib/esm/generated/20px/paths/print.js';
export { default as Properties } from '@blueprintjs/icons/lib/esm/generated/20px/paths/properties.js';
export { default as Redo } from '@blueprintjs/icons/lib/esm/generated/20px/paths/redo.js';
export { default as RemoveColumnRight } from '@blueprintjs/icons/lib/esm/generated/20px/paths/remove-column-right.js';
export { default as Search } from '@blueprintjs/icons/lib/esm/generated/20px/paths/search.js';
export { default as SmallCross } from '@blueprintjs/icons/lib/esm/generated/20px/paths/small-cross.js';
export { default as SmallTick } from '@blueprintjs/icons/lib/esm/generated/20px/paths/small-tick.js';
export { default as SortAsc } from '@blueprintjs/icons/lib/esm/generated/20px/paths/sort-asc.js';
export { default as SortDesc } from '@blueprintjs/icons/lib/esm/generated/20px/paths/sort-desc.js';
export { default as SymbolCross } from '@blueprintjs/icons/lib/esm/generated/20px/paths/symbol-cross.js';
export { default as Tick } from '@blueprintjs/icons/lib/esm/generated/20px/paths/tick.js';
export { default as TwoColumns } from '@blueprintjs/icons/lib/esm/generated/20px/paths/two-columns.js';
export { default as Undo } from '@blueprintjs/icons/lib/esm/generated/20px/paths/undo.js';
export { default as VolumeUp } from '@blueprintjs/icons/lib/esm/generated/20px/paths/volume-up.js';
export { default as WarningSign } from '@blueprintjs/icons/lib/esm/generated/20px/paths/warning-sign.js';
export { default as WidgetHeader } from '@blueprintjs/icons/lib/esm/generated/20px/paths/widget-header.js';
