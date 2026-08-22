// Webpack aliases the bare '@blueprintjs/icons' specifier to this file (see
// webpack.config.mjs). @blueprintjs/icons' own default entry point re-exports
// its entire generated icon set (~680 icons, both the 16px and 20px path
// data) via `export *` barrels that webpack cannot tree-shake, so importing
// it at all - even for a single icon - pulls every icon of both sizes into
// the bundle. This shim instead re-exports, from their own individual
// modules, only the identifiers that @blueprintjs/core, @blueprintjs/table
// and @blueprintjs/select actually import from '@blueprintjs/icons'.
//
// NOTE: If a Blueprint upgrade adds a new such import elsewhere, webpack
// warns "export 'X' was not found in '@blueprintjs/icons'" and it needs to be
// added below.

export { IconSize } from '@blueprintjs/icons/lib/esm/iconTypes.js';
export { SVGIconContainer } from '@blueprintjs/icons/lib/esm/svgIconContainer.js';
export { Icons } from '@blueprintjs/icons/lib/esm/iconLoader.js';
export { IconNames } from '@blueprintjs/icons/lib/esm/iconNames.js';
export { BlueprintIcons_20 } from '@blueprintjs/icons/lib/esm/generated/20px/blueprint-icons-20.js';

export { Add } from '@blueprintjs/icons/lib/esm/generated/components/add.js';
export { AddColumnRight } from '@blueprintjs/icons/lib/esm/generated/components/add-column-right.js';
export { Annotation } from '@blueprintjs/icons/lib/esm/generated/components/annotation.js';
export { ArrowDown } from '@blueprintjs/icons/lib/esm/generated/components/arrow-down.js';
export { ArrowLeft } from '@blueprintjs/icons/lib/esm/generated/components/arrow-left.js';
export { ArrowRight } from '@blueprintjs/icons/lib/esm/generated/components/arrow-right.js';
export { ArrowUp } from '@blueprintjs/icons/lib/esm/generated/components/arrow-up.js';
export { Asterisk } from '@blueprintjs/icons/lib/esm/generated/components/asterisk.js';
export { BringData } from '@blueprintjs/icons/lib/esm/generated/components/bring-data.js';
export { Calendar } from '@blueprintjs/icons/lib/esm/generated/components/calendar.js';
export { CaretDown } from '@blueprintjs/icons/lib/esm/generated/components/caret-down.js';
export { CaretRight } from '@blueprintjs/icons/lib/esm/generated/components/caret-right.js';
export { ChevronDown } from '@blueprintjs/icons/lib/esm/generated/components/chevron-down.js';
export { ChevronLeft } from '@blueprintjs/icons/lib/esm/generated/components/chevron-left.js';
export { ChevronRight } from '@blueprintjs/icons/lib/esm/generated/components/chevron-right.js';
export { ChevronUp } from '@blueprintjs/icons/lib/esm/generated/components/chevron-up.js';
export { Clipboard } from '@blueprintjs/icons/lib/esm/generated/components/clipboard.js';
export { CloudDownload } from '@blueprintjs/icons/lib/esm/generated/components/cloud-download.js';
export { Confirm } from '@blueprintjs/icons/lib/esm/generated/components/confirm.js';
export { Cross } from '@blueprintjs/icons/lib/esm/generated/components/cross.js';
export { Cut } from '@blueprintjs/icons/lib/esm/generated/components/cut.js';
export { Delete } from '@blueprintjs/icons/lib/esm/generated/components/delete.js';
export { Document } from '@blueprintjs/icons/lib/esm/generated/components/document.js';
export { DoubleCaretVertical } from '@blueprintjs/icons/lib/esm/generated/components/double-caret-vertical.js';
export { DoubleChevronDown } from '@blueprintjs/icons/lib/esm/generated/components/double-chevron-down.js';
export { DoubleChevronLeft } from '@blueprintjs/icons/lib/esm/generated/components/double-chevron-left.js';
export { DoubleChevronRight } from '@blueprintjs/icons/lib/esm/generated/components/double-chevron-right.js';
export { DoubleChevronUp } from '@blueprintjs/icons/lib/esm/generated/components/double-chevron-up.js';
export { DragHandleHorizontal } from '@blueprintjs/icons/lib/esm/generated/components/drag-handle-horizontal.js';
export { DragHandleVertical } from '@blueprintjs/icons/lib/esm/generated/components/drag-handle-vertical.js';
export { DrawerLeft } from '@blueprintjs/icons/lib/esm/generated/components/drawer-left.js';
export { Duplicate } from '@blueprintjs/icons/lib/esm/generated/components/duplicate.js';
export { Error } from '@blueprintjs/icons/lib/esm/generated/components/error.js';
export { Export } from '@blueprintjs/icons/lib/esm/generated/components/export.js';
export { FolderNew } from '@blueprintjs/icons/lib/esm/generated/components/folder-new.js';
export { FolderOpen } from '@blueprintjs/icons/lib/esm/generated/components/folder-open.js';
export { FolderShared } from '@blueprintjs/icons/lib/esm/generated/components/folder-shared.js';
export { Font } from '@blueprintjs/icons/lib/esm/generated/components/font.js';
export { Help } from '@blueprintjs/icons/lib/esm/generated/components/help.js';
export { Import } from '@blueprintjs/icons/lib/esm/generated/components/import.js';
export { InfoSign } from '@blueprintjs/icons/lib/esm/generated/components/info-sign.js';
export { KeyCommand } from '@blueprintjs/icons/lib/esm/generated/components/key-command.js';
export { KeyControl } from '@blueprintjs/icons/lib/esm/generated/components/key-control.js';
export { KeyDelete } from '@blueprintjs/icons/lib/esm/generated/components/key-delete.js';
export { KeyEnter } from '@blueprintjs/icons/lib/esm/generated/components/key-enter.js';
export { KeyOption } from '@blueprintjs/icons/lib/esm/generated/components/key-option.js';
export { KeyShift } from '@blueprintjs/icons/lib/esm/generated/components/key-shift.js';
export { Link } from '@blueprintjs/icons/lib/esm/generated/components/link.js';
export { Manual } from '@blueprintjs/icons/lib/esm/generated/components/manual.js';
export { MenuClosed } from '@blueprintjs/icons/lib/esm/generated/components/menu-closed.js';
export { MenuOpen } from '@blueprintjs/icons/lib/esm/generated/components/menu-open.js';
export { More } from '@blueprintjs/icons/lib/esm/generated/components/more.js';
export { OneColumn } from '@blueprintjs/icons/lib/esm/generated/components/one-column.js';
export { OpenApplication } from '@blueprintjs/icons/lib/esm/generated/components/open-application.js';
export { Plus } from '@blueprintjs/icons/lib/esm/generated/components/plus.js';
export { Print } from '@blueprintjs/icons/lib/esm/generated/components/print.js';
export { Properties } from '@blueprintjs/icons/lib/esm/generated/components/properties.js';
export { Redo } from '@blueprintjs/icons/lib/esm/generated/components/redo.js';
export { RemoveColumnRight } from '@blueprintjs/icons/lib/esm/generated/components/remove-column-right.js';
export { Search } from '@blueprintjs/icons/lib/esm/generated/components/search.js';
export { SmallCross } from '@blueprintjs/icons/lib/esm/generated/components/small-cross.js';
export { SmallTick } from '@blueprintjs/icons/lib/esm/generated/components/small-tick.js';
export { SortAsc } from '@blueprintjs/icons/lib/esm/generated/components/sort-asc.js';
export { SortDesc } from '@blueprintjs/icons/lib/esm/generated/components/sort-desc.js';
export { SymbolCross } from '@blueprintjs/icons/lib/esm/generated/components/symbol-cross.js';
export { Tick } from '@blueprintjs/icons/lib/esm/generated/components/tick.js';
export { TwoColumns } from '@blueprintjs/icons/lib/esm/generated/components/two-columns.js';
export { Undo } from '@blueprintjs/icons/lib/esm/generated/components/undo.js';
export { VolumeUp } from '@blueprintjs/icons/lib/esm/generated/components/volume-up.js';
export { WarningSign } from '@blueprintjs/icons/lib/esm/generated/components/warning-sign.js';
export { WidgetHeader } from '@blueprintjs/icons/lib/esm/generated/components/widget-header.js';
