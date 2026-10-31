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
//
// Each icon is exported under both names: Blueprint 6.1 imported the plain
// name (SmallCross), and newer versions import the *Icon name
// (SmallCrossIcon). The plain names are deprecated aliases.

import React from 'react';
import { SVGIconContainer as BPSVGIconContainer } from '@blueprintjs/icons/lib/esm/svgIconContainer.js';

export { IconSize } from '@blueprintjs/icons/lib/esm/iconTypes.js';

// Only 20px icon paths are bundled, and blueprintIconPathsShim.ts serves them
// for 16px icon requests too. But BluePrint's SVGIconContainer gives an icon
// smaller than 20px a 16px viewBox, which would crop a 20px path (such as the
// chevron of a table column header menu). So it is always given a 20px
// viewBox, which scales the 20px path to the icon's size.
export const SVGIconContainer = React.forwardRef(function SVGIconContainer20(
  props: any,
  ref,
) {
  return React.createElement(BPSVGIconContainer, {
    ...props,
    ref,
    svgProps: { viewBox: '0 0 20 20', ...props.svgProps },
  });
}) as unknown as typeof BPSVGIconContainer;

export { Icons } from '@blueprintjs/icons/lib/esm/iconLoader.js';
export { IconNames } from '@blueprintjs/icons/lib/esm/iconNames.js';
export { BlueprintIcons_20 } from '@blueprintjs/icons/lib/esm/generated/20px/blueprint-icons-20.js';

export {
  Add,
  AddIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/add.js';
export {
  AddColumnRight,
  AddColumnRightIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/add-column-right.js';
export {
  Annotation,
  AnnotationIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/annotation.js';
export {
  ArrowDown,
  ArrowDownIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/arrow-down.js';
export {
  ArrowLeft,
  ArrowLeftIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/arrow-left.js';
export {
  ArrowRight,
  ArrowRightIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/arrow-right.js';
export {
  ArrowUp,
  ArrowUpIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/arrow-up.js';
export {
  Asterisk,
  AsteriskIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/asterisk.js';
export {
  BringData,
  BringDataIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/bring-data.js';
export {
  Calendar,
  CalendarIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/calendar.js';
export {
  CaretDown,
  CaretDownIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/caret-down.js';
export {
  CaretRight,
  CaretRightIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/caret-right.js';
export {
  ChevronDown,
  ChevronDownIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/chevron-down.js';
export {
  ChevronLeft,
  ChevronLeftIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/chevron-left.js';
export {
  ChevronRight,
  ChevronRightIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/chevron-right.js';
export {
  ChevronUp,
  ChevronUpIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/chevron-up.js';
export {
  Clipboard,
  ClipboardIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/clipboard.js';
export {
  CloudDownload,
  CloudDownloadIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/cloud-download.js';
export {
  Cog,
  CogIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/cog.js';
export {
  Confirm,
  ConfirmIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/confirm.js';
export {
  Cross,
  CrossIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/cross.js';
export {
  Cut,
  CutIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/cut.js';
export {
  Delete,
  DeleteIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/delete.js';
export {
  Document,
  DocumentIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/document.js';
export {
  DoubleCaretVertical,
  DoubleCaretVerticalIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/double-caret-vertical.js';
export {
  DoubleChevronDown,
  DoubleChevronDownIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/double-chevron-down.js';
export {
  DoubleChevronLeft,
  DoubleChevronLeftIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/double-chevron-left.js';
export {
  DoubleChevronRight,
  DoubleChevronRightIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/double-chevron-right.js';
export {
  DoubleChevronUp,
  DoubleChevronUpIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/double-chevron-up.js';
export {
  DragHandleHorizontal,
  DragHandleHorizontalIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/drag-handle-horizontal.js';
export {
  DragHandleVertical,
  DragHandleVerticalIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/drag-handle-vertical.js';
export {
  DrawerLeft,
  DrawerLeftIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/drawer-left.js';
export {
  Duplicate,
  DuplicateIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/duplicate.js';
export {
  Error,
  ErrorIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/error.js';
export {
  Export,
  ExportIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/export.js';
export {
  FolderNew,
  FolderNewIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/folder-new.js';
export {
  FolderOpen,
  FolderOpenIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/folder-open.js';
export {
  FolderShared,
  FolderSharedIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/folder-shared.js';
export {
  Font,
  FontIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/font.js';
export {
  Highlight,
  HighlightIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/highlight.js';
export {
  Help,
  HelpIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/help.js';
export {
  Import,
  ImportIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/import.js';
export {
  InfoSign,
  InfoSignIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/info-sign.js';
export {
  KeyCommand,
  KeyCommandIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/key-command.js';
export {
  KeyControl,
  KeyControlIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/key-control.js';
export {
  KeyDelete,
  KeyDeleteIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/key-delete.js';
export {
  KeyEnter,
  KeyEnterIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/key-enter.js';
export {
  KeyOption,
  KeyOptionIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/key-option.js';
export {
  KeyShift,
  KeyShiftIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/key-shift.js';
export {
  Link,
  LinkIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/link.js';
export {
  Manual,
  ManualIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/manual.js';
export {
  MenuClosed,
  MenuClosedIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/menu-closed.js';
export {
  MenuOpen,
  MenuOpenIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/menu-open.js';
export {
  More,
  MoreIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/more.js';
export {
  OneColumn,
  OneColumnIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/one-column.js';
export {
  OpenApplication,
  OpenApplicationIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/open-application.js';
export {
  Pin,
  PinIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/pin.js';
export {
  Plus,
  PlusIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/plus.js';
export {
  Print,
  PrintIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/print.js';
export {
  Properties,
  PropertiesIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/properties.js';
export {
  Redo,
  RedoIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/redo.js';
export {
  RemoveColumnRight,
  RemoveColumnRightIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/remove-column-right.js';
export {
  Search,
  SearchIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/search.js';
export {
  SmallCross,
  SmallCrossIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/small-cross.js';
export {
  SmallTick,
  SmallTickIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/small-tick.js';
export {
  SortAsc,
  SortAscIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/sort-asc.js';
export {
  SortDesc,
  SortDescIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/sort-desc.js';
export {
  SymbolCross,
  SymbolCrossIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/symbol-cross.js';
export {
  Tick,
  TickIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/tick.js';
export {
  TwoColumns,
  TwoColumnsIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/two-columns.js';
export {
  Undo,
  UndoIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/undo.js';
export {
  Unpin,
  UnpinIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/unpin.js';
export {
  VolumeUp,
  VolumeUpIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/volume-up.js';
export {
  WarningSign,
  WarningSignIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/warning-sign.js';
export {
  WidgetHeader,
  WidgetHeaderIcon,
} from '@blueprintjs/icons/lib/esm/generated/components/widget-header.js';
