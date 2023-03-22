/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import { ItemRendererProps } from '@blueprintjs/select';
import React from 'react';
import {
  findBookmarkItem,
  findParentOfBookmarkItem,
  forEachBookmarkItem,
  ofClass,
  randomID,
  stringHash,
  tableRowsToSelection,
  tableSelectDataRows,
} from '../../common';
import S from '../../defaultPrefs';
import C from '../../constant';
import G from '../rg';
import { bookmarkItemIcon } from '../rutil';
import Label from '../libxul/label';
import './bmManager.css';
import '@blueprintjs/select/lib/css/blueprint-select.css';

import type {
  BookmarkFolderType,
  BookmarkItemType,
  ContextData,
  GType,
  LocationGBType,
  LocationVKType,
} from '../../type';
import type { TCellInfo, TRowLocation } from '../libxul/table';
import type BMManagerWin from './bmManager';
import type { BMManagerState } from './bmManager';

type CellInfo = TCellInfo & {
  id: string;
  location?: LocationVKType | LocationGBType | null | undefined;
};

export type TableRow = [
  JSX.Element,
  JSX.Element,
  JSX.Element,
  string,
  CellInfo
];

export const Col = {
  iName: 0,
  iNote: 1,
  iSampleText: 2,
  iCreationDate: 3,
  iInfo: 4,
} as const;

export function onFolderSelection(
  this: BMManagerWin,
  ids: (string | number)[]
): void {
  if (ids[0]) {
    const clicked = ids[0].toString();
    this.setState((prevState: BMManagerState) => {
      let { selectedFolder } = prevState;
      selectedFolder = selectedFolder === clicked ? '' : clicked;
      const s: Partial<BMManagerState> = {
        selectedFolder,
        selectedItems: [selectedFolder],
      };
      return s;
    });
    setTimeout(() => {
      const { selectedFolder } = this.state as BMManagerState;
      if (selectedFolder) this.scrollToItem(selectedFolder);
    }, C.UI.TreeScrollDelay);
  }
}

export function onCellClick(
  this: BMManagerWin,
  e: React.MouseEvent,
  cell: TRowLocation
): void {
  this.setState((prevState: BMManagerState) => {
    const { dataRowIndex } = cell;
    const data = this.tableData;
    if (data[dataRowIndex]) {
      const { selectedItems: prevSelectedItems } = prevState;
      const selectedDataRows = tableSelectDataRows(
        dataRowIndex,
        prevSelectedItems
          .map((id) => data.findIndex((r) => r[Col.iInfo].id === id))
          .filter((r) => r !== -1),
        e
      );
      const s: Partial<BMManagerState> = {
        selectedItems: selectedDataRows.map((i) => data[i][Col.iInfo].id),
      };
      return s;
    }
    return null;
  });
}

export function onDoubleClick(this: BMManagerWin, ex: React.SyntheticEvent) {
  const { rootfolder } = this.state as BMManagerState;
  const e = ex as React.MouseEvent;
  const { bookmark } = this.bmContextData(e.target as HTMLElement);
  if (bookmark) {
    const bookmarkItem = findBookmarkItem(rootfolder, bookmark);
    if (bookmarkItem?.type === 'bookmark' && bookmarkItem.location) {
      const { location } = bookmarkItem;
      if ('v11n' in location) {
        G.Commands.goToLocationVK(location, location);
      } else {
        G.Commands.goToLocationGB(location);
      }
    }
  }
}

export function scrollToItem(this: BMManagerWin, id: string) {
  const { tableCompRef } = this;
  const tc = tableCompRef.current;
  if (tc) {
    const data = this.tableData;
    const selectedItem = data.findIndex((r) => r[Col.iInfo].id === id);
    if (selectedItem !== -1) {
      const selectedRegion = tableRowsToSelection([selectedItem])[0];
      if (selectedRegion) {
        const r0 = selectedRegion.rows[0];
        const r1 = selectedRegion.rows[1];
        selectedRegion.rows = [r0 > 5 ? r0 - 5 : r0, r1 > 5 ? r1 - 5 : r1];
        tc.scrollToRegion(selectedRegion);
      }
    }
  }
}

export function onItemSelect(this: BMManagerWin, item: BookmarkItemType) {
  const { rootfolder } = this.state as BMManagerState;
  const s: Partial<BMManagerState> = {
    selectedFolder: rootfolder.id,
    selectedItems: [item.id],
  };
  this.setState(s);
  this.scrollToItem(item.id);
}

export function onQueryChange(
  this: BMManagerWin,
  e: React.SyntheticEvent<HTMLSelectElement>
) {
  this.setState({ query: (e.target as HTMLSelectElement).value });
}

export function buttonHandler(this: BMManagerWin, e: React.SyntheticEvent) {
  const state = this.state as BMManagerState;
  const { rootfolder, selectedFolder, selectedItems, cut, copy } = state;
  const button = ofClass(['button'], e.target);
  if (button) {
    let titleKey = 'menu.edit.properties';
    let bmPropertiesState:
      | Parameters<GType['Commands']['openBookmarkProperties']>[1]
      | undefined;
    let newitem:
      | Parameters<GType['Commands']['openBookmarkProperties']>[2]
      | undefined;
    switch (button.element.id.split('.').pop()) {
      case 'newFolder': {
        titleKey = 'menu.folder.add';
        bmPropertiesState = {
          treeSelection: selectedFolder,
          anyChildSelectable: false,
        };
        newitem = { location: undefined };
        break;
      }
      case 'add': {
        const xulsword = G.Prefs.getComplexValue(
          'xulsword'
        ) as typeof S.prefs.xulsword;
        const { panels, location } = xulsword;
        let module = panels.find((m) => m && m in G.Tab && G.Tab[m].isVerseKey);
        if (!module) module = G.Tabs.find((t) => t.isVerseKey)?.module;
        if (module) {
          titleKey = 'menu.bookmark.add';
          bmPropertiesState = {
            treeSelection: selectedFolder,
            anyChildSelectable: false,
          };
          newitem = { module, location };
        }
        break;
      }
      case 'properties': {
        if (selectedItems) {
          const item = findBookmarkItem(rootfolder, selectedItems[0]);
          if (item) {
            const parent = findParentOfBookmarkItem(
              rootfolder,
              selectedItems[0]
            );
            bmPropertiesState = {
              bookmark: item.id,
              treeSelection: parent?.id ?? undefined,
              anyChildSelectable: true,
            };
          }
        }
        break;
      }
      case 'delete': {
        if (selectedItems) {
          G.Commands.deleteBookmarkItems(selectedItems);
          return;
        }
        break;
      }
      case 'cut': {
        if (selectedItems) {
          this.currentRootFolderObject = null;
          const s: Partial<BMManagerState> = {
            cut: selectedItems,
            copy: null,
            reset: randomID(),
          };
          this.setState(s);
        }
        break;
      }
      case 'copy': {
        if (selectedItems) {
          this.currentRootFolderObject = null;
          const s: Partial<BMManagerState> = {
            copy: selectedItems,
            cut: null,
            reset: randomID(),
          };
          this.setState(s);
        }
        break;
      }
      case 'paste': {
        if (selectedItems[0] && (cut || copy)) {
          G.Commands.pasteBookmarkItems(cut, copy, selectedItems[0]);
          const s: Partial<BMManagerState> = {
            cut: null,
            copy: null,
            reset: randomID(),
          };
          this.setState(s);
        }
        break;
      }
      case 'move': {
        if (selectedItems[0]) {
          titleKey = 'menu.edit.move';
          bmPropertiesState = {
            bookmark: selectedItems[0],
            treeSelection: selectedItems[0],
            anyChildSelectable: true,
            hide: ['location', 'note', 'text'],
          };
        }
        break;
      }
      case 'undo': {
        if (G.canUndo()) G.Commands.undo();
        break;
      }
      case 'redo': {
        if (G.canRedo()) G.Commands.redo();
        break;
      }
      default: {
        throw new Error(`Unhandled bmManager button type: ${button.type}`);
      }
    }
    if (bmPropertiesState || newitem) {
      G.Commands.openBookmarkProperties(
        G.i18n.t(titleKey),
        bmPropertiesState || {},
        newitem
      );
    }
  }
}

export function itemRenderer(
  this: BMManagerWin,
  item: BookmarkItemType,
  itemProps: ItemRendererProps
): JSX.Element | null {
  const { handleClick, ref } = itemProps;
  const { label, labelLocale, note, noteLocale } = item;
  let sampleText = '';
  let sampleModule = '';
  if (item.type === 'bookmark') {
    ({ sampleText, sampleModule } = item);
  }
  const shortRE1 = new RegExp(
    `^(.{${C.UI.BMManager.searchResultBreakAfter}}.*?)\\b.*$`
  );
  let notesh = note.replace(shortRE1, '$1');
  if (note.length > C.UI.BMManager.searchResultBreakAfter) notesh += '…';
  const shl = C.UI.BMManager.searchResultBreakAfter - notesh.length;
  let samplesh = '';
  if (shl > 0) {
    const shortRE2 = new RegExp(`^(.{${shl}}.*?)\\b.*$`);
    samplesh = sampleText.replace(shortRE2, '$1');
    if (sampleText.length > shl) samplesh += '…';
  }
  return (
    <li
      className="search-result-item"
      title={`${notesh ? `[${notesh}] ` : ''}${samplesh}`}
      ref={ref}
      onClick={handleClick}
    >
      {bookmarkItemIcon(item)}
      <Label className={`cs-${labelLocale}`} value={label} />
      {(notesh || samplesh) && `: `}
      {notesh && (
        <span className={`cs-${noteLocale} description`}>[{notesh}]</span>
      )}
      {samplesh && (
        <span className={`cs-${sampleModule} description`}>{samplesh}</span>
      )}
    </li>
  );
}

export function itemPredicate(
  this: BMManagerWin,
  query: string,
  item: BookmarkItemType
): boolean {
  const { label, note } = item;
  let sampleText = '';
  if (item.type === 'bookmark') {
    ({ sampleText } = item);
  }
  const parts: string[] = [label, note, sampleText];
  if (item.type === 'bookmark') {
    const { location } = item;
    if (location && !('v11n' in location)) {
      const { key } = location;
      parts.push(key);
    }
  }
  const querylc = query.toLowerCase();
  const is = parts.join(' ').toLowerCase();
  if (is.includes(querylc)) return true;
  return querylc.split(' ').every((w) => is.includes(w));
}

export function inputValueRenderer(item: BookmarkItemType): string {
  const { label } = item;
  return label;
}

export function getSearchableItems(
  folder: BookmarkFolderType
): BookmarkItemType[] {
  const searchableItems: BookmarkItemType[] = [];
  forEachBookmarkItem(folder.childNodes, (n) => {
    if (n.type === 'bookmark') searchableItems.push(n);
  });
  return searchableItems;
}

function tooltip(rowArray: string[]) {
  return (_row: number, col: number): string => {
    return rowArray[col];
  };
}

export function getTableData(
  s: Pick<BMManagerState, 'rootfolder' | 'cut' | 'copy'>
): TableRow[] {
  const { rootfolder, cut, copy } = s;
  const getTableRow = (item: BookmarkItemType, level: number): TableRow => {
    const { id, creationDate, label, labelLocale, note, noteLocale } = item;
    let sampleText = '';
    let sampleModule = '';
    if (item.type === 'bookmark') {
      ({ sampleText, sampleModule } = item);
    }
    const classes: string[] = [];
    if (cut && cut.includes(id)) {
      classes.push('is-cut');
    }
    if (copy && copy.includes(id)) {
      classes.push('is-copy');
    }
    const r: TableRow = [
      <span
        className="label-cell"
        key={stringHash(labelLocale, label, item, level)}
      >
        {[...Array(level).keys()].map((a) => (
          <div key={`ind${a}`} className="indent" />
        ))}
        {bookmarkItemIcon(item)}
        <Label className={labelLocale} value={label} />
      </span>,

      <span key={stringHash(note, noteLocale)} className={noteLocale}>
        {note}
      </span>,

      <span
        key={stringHash(sampleText, sampleModule)}
        className={`cs-${sampleModule}`}
      >
        {sampleText}
      </span>,

      new Date(creationDate).toLocaleDateString(G.i18n.language),

      {
        id,
        location: 'location' in item ? item.location : undefined,
        classes,
      },
    ];
    r[Col.iInfo].tooltip = tooltip([label, note, sampleText, 'VALUE']);
    return r;
  };
  const data: TableRow[] = [];
  const getTableRows = (folder: BookmarkFolderType, level = 0) => {
    data.push(getTableRow(folder, level));
    folder.childNodes.forEach((cn) => {
      if (cn.type === 'folder') getTableRows(cn, level + 1);
      else data.push(getTableRow(cn, level + 1));
    });
  };
  getTableRows(rootfolder);
  return data;
}

export function bmContextData(
  this: BMManagerWin,
  elem: HTMLElement
): ContextData {
  const { selectedItems } = this.state as BMManagerState;
  const data = this.tableData;
  const r: ContextData = { type: 'bookmarkManager' };
  const point = ofClass(['bp4-table-cell'], elem);
  if (point) {
    const ri = point.element.className.match(/\bbp4-table-cell-row-(\d+)\b/);
    if (ri) {
      const tableDataRowIndex = Number(ri[1]);
      const selectedDataRows = selectedItems.map((id) =>
        data.findIndex((row) => row[Col.iInfo].id === id)
      );
      const rows = selectedDataRows.includes(tableDataRowIndex)
        ? selectedDataRows
        : [tableDataRowIndex];
      r.bookmarks = rows.map((row) => data[row][Col.iInfo].id);
      if (r.bookmarks.length === 1) {
        [r.bookmark] = r.bookmarks;
      }
    }
  }

  return r;
}
