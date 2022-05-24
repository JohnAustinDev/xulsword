/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable import/no-duplicates */
import i18n from 'i18next';
import { Intent } from '@blueprintjs/core';
import { Utils } from '@blueprintjs/table';
import {
  clone,
  downloadKey,
  isRepoLocal,
  modrepKey,
  moduleInfoHTML,
  rowsToSelection,
  selectionToRows,
} from '../../common';
import C from '../../constant';
import G from '../rg';
import { log } from '../rutil';
import { TCellInfo, TCellLocation } from '../libxul/table';

import type {
  ModTypes,
  Repository,
  RepositoryListing,
  RowSelection,
  SwordConfType,
  XSModTypes,
} from '../../type';
import type ModuleManager from './moduleManager';
import type { ManagerState } from './moduleManager';
import type { BibleselectSelection } from '../libxul/bibleselect';

export const Tables = ['language', 'module', 'repository'] as const;

// Data that is saved between window resets, but isn't saved to prefs:
export const Saved = {
  repositoryListings: [] as RepositoryListing[],

  moduleData: {} as { [modrepKey: string]: TModuleTableRow },

  moduleLangData: {} as { [langcode: string]: TModuleTableRow[] },

  language: {
    data: [] as TLanguageTableRow[],
    tableToDataRowMap: [] as number[],
    scrollTop: 0 as number,
  },

  module: {
    data: [] as TModuleTableRow[],
    tableToDataRowMap: [] as number[],
    scrollTop: 0 as number,
  },

  repository: {
    data: [] as TRepositoryTableRow[],
    tableToDataRowMap: [] as number[],
    scrollTop: 0 as number,
  },
};

// These local repositories cannot be disabled or deleted.
export const builtinRepos: Repository[] = [
  {
    name: 'Shared',
    domain: 'file://',
    path: G.Dirs.path.xsModsCommon,
    file: '',
    builtin: true,
    disabled: false,
    custom: false,
  },
  {
    name: i18n.t('programTitle'),
    domain: 'file://',
    path: G.Dirs.path.xsModsUser,
    file: '',
    builtin: true,
    disabled: false,
    custom: false,
  },
];

export const LanguageTableHeadings = [''];

export const ModuleTableHeadings = [
  'Type',
  'About',
  'Code',
  'Repository',
  'Version',
  'Size',
  'Features',
  'Versification',
  'Scope',
  'Copyright',
  'Distribution License',
  'Source Type',
  'Shared',
  'Installed',
];

export const RepositoryTableHeadings = ['', '', '', ''];

export type TRepCellInfo = TCellInfo & {
  repo: Repository;
};

export type TModCellInfo = TCellInfo & {
  shared: boolean;
  repo: Repository;
  conf: SwordConfType;
};

export type TLanguageTableRow = [string, TCellInfo];

export type TModuleTableRow = [
  ModTypes | XSModTypes,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  () => typeof ON | typeof OFF | '',
  typeof ON | typeof OFF,
  TModCellInfo
];

export type TRepositoryTableRow = [
  string,
  string,
  string,
  typeof ON | typeof OFF | typeof ALWAYS_ON,
  TRepCellInfo
];

export const ON = '☑';
export const OFF = '☐';
export const ALWAYS_ON = '￭';

export const LanCol = {
  iCode: 0,
  iInfo: 1,
} as const;

export const ModCol = {
  iType: 0,
  iAbout: 1,
  iModule: 2,
  iRepoName: 3,
  iVersion: 4,
  iSize: 5,
  iFeatures: 6,
  iVersification: 7,
  iScope: 8,
  iCopyright: 9,
  iLicense: 10,
  iSourceType: 11,
  iShared: 12,
  iInstalled: 13,
  iInfo: 14,
} as const;

export const RepCol = {
  iName: 0,
  iDomain: 1,
  iPath: 2,
  iState: 3,
  iInfo: 4,
} as const;

const Downloads: {
  [modrepoKey: string]: {
    nfiles: Promise<number | null>;
    failed: boolean;
  };
} = {};

export function onColumnHide(
  this: ModuleManager,
  toggleDataColumn: number,
  targetColumn: number
) {
  this.sState((prevState) => {
    const table = 'module';
    const tablestate = prevState[table];
    let { visibleColumns } = tablestate;
    visibleColumns = visibleColumns.slice();
    const wasHidden = visibleColumns.indexOf(toggleDataColumn) === -1;
    if (wasHidden) {
      visibleColumns.splice(targetColumn + 1, 0, toggleDataColumn);
    } else {
      visibleColumns.splice(visibleColumns.indexOf(toggleDataColumn), 1);
    }
    tablestate.visibleColumns = visibleColumns;
    return { [table]: tablestate };
  });
}

export function columnWidthChanged(
  this: ModuleManager,
  table: typeof Tables[number],
  column: number,
  size: number
): void {
  const state = this.state as ManagerState;
  if (table === 'language') return;
  let { columnWidths } = state[table];
  columnWidths = columnWidths.slice();
  const { visibleColumns } = state[table];
  const dcol0 = visibleColumns[column];
  const dcol2 = visibleColumns[column + 1];
  const delta = size - columnWidths[dcol0];
  columnWidths[dcol0] += delta;
  columnWidths[dcol2] -= delta;
  this.setTableState(table, { columnWidths }, null, true);
}

export function onColumnsReordered(
  this: ModuleManager,
  oldTableColIndex: number,
  newTableColIndex: number,
  length: number
) {
  const state = this.state as ManagerState;
  const table = 'module';
  let { visibleColumns } = state[table];
  if (oldTableColIndex === newTableColIndex) return;
  visibleColumns =
    Utils.reorderArray(
      visibleColumns,
      oldTableColIndex,
      newTableColIndex,
      length
    ) || [];
  this.setTableState('module', { visibleColumns }, null, true);
}

export function onRowsReordered(
  this: ModuleManager,
  table: typeof Tables[number],
  column: number,
  direction: 'ascending' | 'descending',
  tableToDataRowMap: number[]
) {
  // Update our tableToDataRowMap based on the new sorting.
  const drm = Saved[table].tableToDataRowMap;
  Saved[table].tableToDataRowMap = tableToDataRowMap;
  const render =
    drm.length !== tableToDataRowMap.length ||
    drm.some((r, i) => r !== (tableToDataRowMap[i] ?? i));
  // Update initial rowSort for next Table component reset.
  this.setTableState(table, { rowSort: { column, direction } }, null, render);
}

export function onLangCellClick(
  this: ModuleManager,
  e: React.MouseEvent,
  cell: TCellLocation
) {
  this.loadModuleTable(this.rowSelect(e, 'language', cell.tableRowIndex));
}

export function onModCellClick(
  this: ModuleManager,
  e: React.MouseEvent,
  cell: TCellLocation
) {
  const state = this.state as ManagerState;
  const { module } = state as ManagerState;
  const { module: modtable } = state.tables;
  const { selection, visibleColumns } = module;
  const { dataRowIndex: row, column, tableRowIndex } = cell;
  const col = visibleColumns[column];
  const drow = modtable.data[row];
  if (drow && col === ModCol.iInstalled && !drow[ModCol.iInfo].loading) {
    const was = drow[col];
    const is = was === ON ? OFF : ON;
    const selrows = selectionToRows(selection);
    const toggleTableRows = selrows.includes(tableRowIndex)
      ? selrows
      : [tableRowIndex];
    const toggleDataRows = toggleTableRows.map(
      (r) => Saved.module.tableToDataRowMap[r] ?? r
    );
    // Installed column clicks
    if (is === ON) {
      const newDLRows: number[] = [];
      toggleDataRows.forEach((r) => {
        const rrow = modtable.data[r];
        if (rrow) {
          const k = modrepKey(rrow[ModCol.iModule], rrow[ModCol.iInfo].repo);
          if (k in Downloads && !Downloads[k].failed) {
            rrow[ModCol.iInstalled] = ON;
            this.setTableState('module', null, modtable.data, true);
          } else newDLRows.push(r);
        }
      });
      if (newDLRows.length) this.download(newDLRows);
    } else {
      toggleDataRows.forEach((r) => {
        const rrow = modtable.data[r];
        if (rrow) {
          rrow[col] = OFF;
          rrow[ModCol.iInfo].intent = intent(ModCol.iInstalled, 'none');
        }
      });
      this.setTableState('module', null, modtable.data, true);
    }
  } else if (drow && col === ModCol.iShared) {
    // Shared column clicks
    const is = !drow[ModCol.iInfo].shared;
    const selrows = selectionToRows(selection);
    const toggleTableRows = selrows.includes(tableRowIndex)
      ? selrows
      : [tableRowIndex];
    const toggleDataRows = toggleTableRows.map(
      (r) => Saved.module.tableToDataRowMap[r] ?? r
    );
    toggleDataRows.forEach((r) => {
      const rrow = modtable.data[r];
      if (rrow) rrow[ModCol.iInfo].shared = is;
    });
    this.setTableState('module', null, modtable.data, true);
  } else {
    this.rowSelect(e, 'module', tableRowIndex);
  }
}

export function onRepoCellClick(
  this: ModuleManager,
  e: React.MouseEvent,
  cell: TCellLocation
) {
  const state = this.state as ManagerState;
  const { repository } = state;
  const { repository: repotable } = state.tables;
  const { selection, visibleColumns } = repository;
  const { dataRowIndex: row, column, tableRowIndex } = cell;
  const col = visibleColumns[column];
  const builtin =
    repotable.data[row] && repotable.data[row][RepCol.iInfo].repo.builtin;
  if (!builtin && col === RepCol.iState) {
    const onOrOff = repotable.data[row][RepCol.iState] === OFF;
    const selrows = selectionToRows(selection);
    const toggleTableRows = selrows.includes(tableRowIndex)
      ? selrows
      : [tableRowIndex];
    const toggleDataRows = toggleTableRows.map(
      (r) => Saved.repository.tableToDataRowMap[r] ?? r
    );
    this.switchRepo(toggleDataRows, onOrOff);
  } else if (row > -1 && col < RepCol.iState) {
    this.rowSelect(e, 'repository', tableRowIndex);
  }
}

export function onCellEdited(
  this: ModuleManager,
  cell: TCellLocation,
  value: string
) {
  const table = 'repository';
  const state = this.state as ManagerState;
  const { customRepos } = state;
  const newCustomRepos = clone(customRepos);
  const tablestate = state.tables[table];
  const { visibleColumns } = state[table];
  const row = cell.dataRowIndex;
  const col = visibleColumns[cell.column];
  const drow = tablestate.data[row];
  if (table === 'repository' && drow) {
    const crindex = newCustomRepos.findIndex(
      (r) => downloadKey(r) === downloadKey(drow[RepCol.iInfo].repo)
    );
    if (crindex !== -1) {
      newCustomRepos.splice(crindex, 1);
    }
    if (col === RepCol.iDomain) drow[RepCol.iInfo].repo.domain = value;
    else if (col === RepCol.iName) drow[RepCol.iInfo].repo.name = value;
    else if (col === RepCol.iPath) drow[RepCol.iInfo].repo.path = value;
    drow[col] = value;
    newCustomRepos.push(drow[RepCol.iInfo].repo);
    this.setTableState('repository', null, tablestate.data, false, {
      customRepos: newCustomRepos,
    });
    if (
      (col === RepCol.iDomain || col === RepCol.iPath) &&
      drow[RepCol.iState] === OFF
    ) {
      setTimeout(() => this.switchRepo([row], true), 100);
    }
  }
}

export function eventHandler(this: ModuleManager, ev: React.SyntheticEvent) {
  switch (ev.type) {
    case 'click': {
      const e = ev as React.MouseEvent;
      switch (e.currentTarget.id) {
        case 'languageListClose': {
          const state = this.state as ManagerState;
          this.setTableState('module', null, this.moduleTableData([]), true, {
            language: { ...state.language, open: false },
          });
          break;
        }
        case 'languageListOpen': {
          const state = this.state as ManagerState;
          // Cannot retain selection without making moduleTableData() an async
          // function, because selectionToDataRows() needs a rendered table.
          this.setTableState('module', null, this.moduleTableData([]), true, {
            language: { ...state.language, selection: [], open: true },
          });
          break;
        }
        case 'moduleInfo': {
          const div = document.getElementById('moduleInfo');
          if (div) {
            const state = this.state as ManagerState;
            const { module } = state;
            const { module: modtable } = state.tables;
            const { selection } = module;
            const confs = this.selectionToDataRows('module', selection)
              .map((r) => {
                return (
                  (modtable.data[r] && modtable.data[r][ModCol.iInfo].conf) ||
                  null
                );
              })
              .filter(Boolean);
            const s: Partial<ManagerState> = {
              showModuleInfo: moduleInfoHTML(confs),
            };
            this.setState(s);
          }
          break;
        }
        case 'moduleInfoBack': {
          this.setState({ showModuleInfo: '' });
          break;
        }
        case 'cancel': {
          G.Window.close();
          break;
        }
        case 'ok': {
          G.Window.moveToBack();
          // Remove selection from persisted state.
          this.setTableState('module', { selection: [] });
          this.setTableState('repository', { selection: [] });
          const state = this.state as ManagerState;
          const { repository: repotable } = state.tables;
          const { moduleData } = Saved;
          // Get a list of all currently installed modules (those found in any
          // enabled local repository).
          const installed: SwordConfType[] = [];
          repotable.data.forEach((rtd, i) => {
            if (isRepoLocal(rtd[RepCol.iInfo].repo)) {
              const listing = Saved.repositoryListings[i];
              if (Array.isArray(listing)) {
                listing.forEach((c) => installed.push(c));
              }
            }
          });
          // Remove modules
          Object.values(moduleData).forEach((row) => {
            if (row[ModCol.iInstalled] === OFF) {
              const module = row[ModCol.iModule];
              const { repo } = row[ModCol.iInfo];
              const modrepok = modrepKey(module, repo);
              const conf = installed.find((c) => c.module === module);
              if (modrepok in Downloads) {
                if (!G.Module.clearDownload(module, repo)) {
                  log.warn(`Failed to clear ${module} from downloads`);
                  Downloads[modrepok].failed = true;
                }
              } else if (conf) {
                if (!G.Module.remove(conf.module, conf.sourceRepository)) {
                  log.warn(
                    `Failed to remove ${module} from ${conf.sourceRepository.path}`
                  );
                }
              }
            }
          });
          // Move modules (between the shared and xulsword builtins).
          Object.values(moduleData).forEach((row) => {
            const { shared } = row[ModCol.iInfo];
            const module = row[ModCol.iModule];
            const conf = installed.find((c) => c.module === module);
            const toDir = builtinRepos[shared ? 0 : 1];
            const fromKey = conf && downloadKey(conf.sourceRepository);
            const toKey = downloadKey(toDir);
            if (conf && fromKey !== toKey) {
              if (!G.Module.move(module, conf.sourceRepository, toDir)) {
                log.warn(
                  `Failed to move ${module} from ${fromKey} to ${toKey}`
                );
              }
            }
          });
          // Install succesfully downloaded modules
          Object.keys(Downloads).forEach((k) => {
            if (Downloads[k].failed) {
              delete Downloads[k];
            }
          });
          const downloadKeys = Object.keys(Downloads);
          const promises = Object.values(Downloads).map((v) => v.nfiles);
          return Promise.allSettled(promises)
            .then((results) => {
              const saves: {
                module: string;
                fromRepo: Repository;
                toRepo: Repository;
              }[] = [];
              results.forEach((result, i) => {
                if (result.status !== 'fulfilled') log.warn(result.reason);
                else if (result.value) {
                  const modrepok = downloadKeys[i];
                  const dot = modrepok ? modrepok.lastIndexOf('.') : -1;
                  if (dot === -1) return;
                  const module = modrepok.substring(dot + 1);
                  const repokey = modrepok.substring(0, dot);
                  const row = Object.values(moduleData).find((r) => {
                    return (
                      downloadKey(r[ModCol.iInfo].repo) === repokey &&
                      r[ModCol.iModule] === module
                    );
                  });
                  if (row && row[ModCol.iInstalled]) {
                    saves.push({
                      module: row[ModCol.iModule],
                      fromRepo: row[ModCol.iInfo].repo,
                      toRepo: builtinRepos[row[ModCol.iInfo].shared ? 0 : 1],
                    });
                  }
                }
              });
              G.Module.saveDownloads(saves);
              return G.Window.close();
            })
            .catch((er) => log.warn(er));
        }
        case 'repoAdd': {
          const state = this.state as ManagerState;
          const { customRepos } = state;
          const newCustomRepos = clone(customRepos);
          const { repository: repotables } = state.tables;
          const rawdata = Saved.repositoryListings;
          const repo: Repository = {
            name: '?',
            domain: C.Downloader.localfile,
            path: '?',
            file: 'mods.d.tar.gz',
            disabled: true,
            custom: true,
            builtin: false,
          };
          const row = repositoryToRow(repo);
          row[RepCol.iInfo].classes = classes(
            [RepCol.iState],
            ['checkbox-column'],
            ['custom-repo']
          );
          row[RepCol.iInfo].editable = editable();
          repotables.data.unshift(row);
          rawdata.unshift(null);
          newCustomRepos.push(repo);
          this.setTableState('repository', null, repotables.data, true, {
            customRepos: newCustomRepos,
          });
          this.switchRepo([0], false);
          break;
        }
        case 'repoDelete': {
          const state = this.state as ManagerState;
          const { customRepos, repository } = state;
          const newCustomRepos = clone(customRepos);
          const { repository: repotable } = state.tables;
          const { selection } = repository;
          const repotableData = clone(repotable.data);
          const { repositoryListings } = Saved;
          const rows =
            (repository && this.selectionToDataRows('repository', selection)) ||
            [];
          rows.reverse().forEach((r) => {
            const drow = repotable.data[r];
            if (drow && drow[RepCol.iInfo].repo.custom) {
              repotableData.splice(r, 1);
              repositoryListings.splice(r, 1);
              const crIndex = customRepos.findIndex(
                (ro) => downloadKey(ro) === downloadKey(drow[RepCol.iInfo].repo)
              );
              if (crIndex !== -1) {
                newCustomRepos.splice(crIndex, 1);
              }
            }
          });
          this.setTableState('repository', null, repotableData, true, {
            customRepos: newCustomRepos,
          });
          this.loadModuleTable(this.loadLanguageTable());
          break;
        }
        case 'repoCancel': {
          G.Downloader.ftpCancel();
          const state = this.state as ManagerState;
          const { repository: repotable } = state.tables;
          repotable.data.forEach((r, i) => {
            if (r[RepCol.iInfo].loading) {
              if (r[RepCol.iState] !== OFF) this.switchRepo([i], false);
              r[RepCol.iInfo].loading = false;
              r[RepCol.iInfo].intent = intent(RepCol.iState, 'danger');
              this.sState({ progress: null });
            }
          });
          break;
        }
        case 'moduleCancel': {
          G.Downloader.ftpCancel();
          Saved.moduleLangData.allmodules?.forEach((r) => {
            if (r[ModCol.iInfo].loading) {
              r[ModCol.iInfo].loading = false;
              r[ModCol.iInfo].intent = intent(ModCol.iInstalled, 'danger');
              r[ModCol.iInstalled] = OFF;
              const modrepk = modrepKey(
                r[ModCol.iModule],
                r[ModCol.iInfo].repo
              );
              if (modrepk in Downloads) Downloads[modrepk].failed = true;
              this.setTableState('module', null, null, true);
            }
          });
          break;
        }
        default:
          throw Error(
            `Unhandled ModuleManager click event ${e.currentTarget.id}`
          );
      }
      break;
    }
    default:
      throw Error(`Unhandled ModuleManager event type ${ev.type}`);
  }
  return true;
}

// Select or unselect a row of a table. If the ctrl or shift key is pressed,
// the current selection will be modified accordingly.
export function rowSelect(
  this: ModuleManager,
  e: React.MouseEvent,
  table: typeof Tables[number],
  row: number
) {
  const state = this.state as ManagerState;
  const { selection } = state[table];
  const rows = selectionToRows(selection);
  const isSelected = rows.includes(row);
  let newSelection;
  if (selection.length && (e.ctrlKey || e.shiftKey)) {
    const prev = rows.filter((r) => r < row).pop();
    const start = prev === undefined || e.ctrlKey ? row : prev;
    for (let x = start; x <= row; x += 1) {
      if (!isSelected) rows.push(x);
      else if (rows.includes(x)) {
        rows.splice(rows.indexOf(x), 1);
      }
    }
    newSelection = rowsToSelection(rows);
  } else {
    newSelection = rowsToSelection(isSelected ? [] : [row]);
  }
  this.setTableState(table, { selection: newSelection }, null, false);
  return newSelection;
}

// Enable or disable a repository. If onOrOff is undefined it will be toggled.
// If onOrOff is true it will be enabled, otherwise disabled.
export function switchRepo(
  this: ModuleManager,
  rows: number[],
  onOrOff?: boolean
) {
  const state = this.state as ManagerState;
  const { disabledRepos: dr } = state;
  const { repository: repotable } = state.tables;
  const repoTableData = clone(repotable.data);
  const disabledRepos = dr.slice();
  rows.forEach((r) => {
    const drowWas = repotable.data[r];
    const drow = repoTableData[r];
    const unswitchable = !drowWas || drowWas[RepCol.iInfo].repo.builtin;
    if (drow && !unswitchable) {
      const rowkey = downloadKey(drowWas[RepCol.iInfo].repo);
      const disabledIndex = disabledRepos.findIndex((drs) => {
        return drs === rowkey;
      });
      if (
        onOrOff !== false &&
        (onOrOff === true || drowWas[RepCol.iState] === OFF)
      ) {
        drow[RepCol.iState] = drow[RepCol.iInfo].repo.builtin ? ALWAYS_ON : ON;
        drow[RepCol.iInfo].repo.disabled = false;
        if (disabledIndex !== -1) disabledRepos.splice(disabledIndex, 1);
        drow[RepCol.iInfo].loading = loading(RepCol.iState);
      } else {
        drow[RepCol.iState] = OFF;
        drow[RepCol.iInfo].repo.disabled = true;
        if (disabledIndex === -1) disabledRepos.push(rowkey);
        if (drow[RepCol.iInfo].loading) {
          G.Downloader.ftpCancel();
          drow[RepCol.iInfo].loading = false;
        }
        drow[RepCol.iInfo].intent = intent(RepCol.iState, 'none');
      }
    }
  });
  this.setTableState('repository', null, repoTableData, true, {
    disabledRepos,
  });
  const repos = repoTableData.map((r, i) =>
    rows.includes(i) ? r[RepCol.iInfo].repo : null
  );
  G.Downloader.repositoryListing(repos)
    .then((listing) => {
      if (!listing) throw new Error(`Canceled`);
      this.updateRepositoryLists(listing);
      let selection = this.loadLanguageTable();
      const { language } = this.state as ManagerState;
      if (!language.open) selection = [];
      return this.loadModuleTable(selection);
    })
    .catch((er) => log.warn(er));
}

// Start async repository module downloads corresponding to a given
// set of module table rows.
export function download(this: ModuleManager, rows: number[]): void {
  const state = this.state as ManagerState;
  const { module: modtable } = state.tables;
  rows.forEach((row) => {
    const drow = modtable.data[row];
    if (drow) {
      const module = drow[ModCol.iModule] as string;
      const { repo } = drow[ModCol.iInfo];
      const modrepk = modrepKey(module, repo);
      const { moduleType } = drow[ModCol.iInfo].conf;
      const loadingrows: TModuleTableRow[] = [];
      let xsmZipFileOrURL: string = drow[ModCol.iInfo].conf.DataPath;
      if (moduleType === 'XSM') {
        const { moduleData } = Saved;
        Object.values(moduleData)
          .filter((r) => {
            return (
              r[ModCol.iInfo].conf.DataPath === drow[ModCol.iInfo].conf.DataPath
            );
          })
          .forEach((r: TModuleTableRow) => {
            r[ModCol.iInfo].loading = loading(ModCol.iInstalled);
            loadingrows.push(r);
          });
      } else if (moduleType === 'XSM_audio') {
        drow[ModCol.iInfo].loading = loading(ModCol.iInstalled);
        loadingrows.push(drow);
      } else {
        drow[ModCol.iInfo].loading = loading(ModCol.iInstalled);
        loadingrows.push(drow);
      }
      const nfiles = (async () => {
        try {
          if (drow[ModCol.iInfo].conf.moduleType === 'XSM_audio') {
            const { AudioChapters } = drow[ModCol.iInfo].conf;
            if (AudioChapters) {
              const audio: BibleselectSelection | null = await new Promise(
                (resolve) => {
                  const {
                    bk: book,
                    ch1: chapter,
                    ch2: lastchapter,
                  } = AudioChapters[0];
                  const books = Array.from(
                    new Set(AudioChapters.map((v) => v.bk))
                  );
                  const chapters: number[] = [];
                  for (let x = 1; x <= lastchapter; x += 1) {
                    if (x >= chapter) chapters.push(x);
                  }
                  this.sState({
                    showChapterDialog: {
                      conf: drow[ModCol.iInfo].conf,
                      selection: { book, chapter, lastchapter: chapter },
                      initialSelection: { book, chapter, lastchapter: chapter },
                      options: {
                        trans: [],
                        books,
                        chapters,
                        lastchapters: chapters,
                        verses: [],
                        lastverses: [],
                      },
                      chapters: AudioChapters,
                      callback: (result) => resolve(result),
                    },
                  });
                }
              );
              if (audio) {
                const { book, chapter, lastchapter } = audio;
                xsmZipFileOrURL += `&bk=${book}&ch=${chapter}&cl=${lastchapter}`;
              } else {
                throw new Error(`Audio module download canceled.`);
              }
            } else {
              throw new Error(
                `Audio config is missing AudioChapters: '${
                  drow[ModCol.iModule]
                }'`
              );
            }
          }
          const dl = await (drow[ModCol.iInfo].conf.moduleType.startsWith('XSM')
            ? G.Module.downloadXSM(module, xsmZipFileOrURL, repo)
            : G.Module.download(module, repo));
          loadingrows.forEach((r) => {
            r[ModCol.iInfo].loading = false;
          });
          let newintent: Intent = 'success';
          if (typeof dl === 'string') {
            this.addToast({ message: dl });
            newintent = 'danger';
          } else {
            loadingrows.forEach((r) => {
              r[ModCol.iInstalled] = ON;
            });
            Downloads[modrepk].failed = false;
          }
          loadingrows.forEach((r) => {
            r[ModCol.iInfo].intent = intent(ModCol.iInstalled, newintent);
          });
          this.setTableState('module', null, modtable.data, true);
          return typeof dl === 'string' ? null : dl;
        } catch (er: any) {
          this.addToast({ message: er.message });
          loadingrows.forEach((r) => {
            r[ModCol.iInfo].loading = false;
            r[ModCol.iInfo].intent = intent(ModCol.iInstalled, 'danger');
          });
          this.setTableState('module', null, modtable.data, true);
          return null;
        }
      })();
      Downloads[modrepk] = { nfiles, failed: true };
    }
  });
  this.setTableState('module', null, modtable.data, true);
}

// Set table state, save the data for window re-renders, and re-render the table.
export function setTableState(
  this: ModuleManager,
  table: typeof Tables[number],
  tableState?: Partial<
    ManagerState['language' | 'module' | 'repository']
  > | null,
  tableData?:
    | TLanguageTableRow[]
    | TModuleTableRow[]
    | TRepositoryTableRow[]
    | null,
  tableReset?: boolean,
  s?: Partial<ManagerState>
) {
  const state = this.state as ManagerState;
  const news: Partial<ManagerState> = s || {};
  if (tableState) {
    news[table] = { ...state[table], ...tableState } as any;
  }
  if (tableData) {
    state.tables[table].data = tableData;
    Saved[table].data = tableData;
  }
  if (Object.keys(news).length) this.sState(news);
  // Two steps must be used for statePrefs to be written to Prefs
  // before the reset will will properly read their updated values.
  if (tableReset) {
    this.sState((prevState) => {
      const { render } = prevState.tables[table];
      const trnews = { tables: { ...prevState.tables } };
      trnews.tables[table].render = render + 1;
      return trnews;
    });
  }
}

// Given a table selection, return the selected data rows in ascending order.
// This is like selectionToRows, but returns data rows rather than table rows.
export function selectionToDataRows(
  this: ModuleManager,
  table: typeof Tables[number],
  regions: RowSelection
): number[] {
  const tablerows = selectionToRows(regions);
  return tablerows
    .map((r) => Saved[table].tableToDataRowMap[r] ?? r)
    .sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
}

// Create a new repository table row from a Repository object.
export function repositoryToRow(repo: Repository): TRepositoryTableRow {
  const on = builtinRepos.map((r) => downloadKey(r)).includes(downloadKey(repo))
    ? ALWAYS_ON
    : ON;
  return [
    repo.name || '?',
    repo.domain,
    repo.path,
    repo.disabled ? on : OFF,
    { repo },
  ];
}

// The following functions return custom callbacks meant to be sent
// to tables for applying values, settings, classes etc. to particular
// table cells.
export function loading(columnIndex: number) {
  return (_ri: number, ci: number) => {
    return ci === columnIndex;
  };
}

export function editable() {
  return (_ri: number, ci: number) => {
    return ci < RepCol.iState;
  };
}

export function intent(columnIndex: number, theIntent: Intent) {
  return (_ri: number, ci: number) => {
    return ci === columnIndex ? theIntent : 'none';
  };
}

export function classes(
  columnIndexArray: number[],
  theClasses: string[],
  wholeRowClasses?: string[]
) {
  return (_ri: number, ci: number) => {
    const cs = wholeRowClasses?.slice() || [];
    if (columnIndexArray.includes(ci))
      theClasses.forEach((c) => {
        if (!cs.includes(c)) cs.push(c);
      });
    return cs;
  };
}

export function tooltip(atooltip: string, slipColumnIndexArray: number[]) {
  return (_ri: number, ci: number) => {
    return slipColumnIndexArray.includes(ci) ? undefined : atooltip;
  };
}
