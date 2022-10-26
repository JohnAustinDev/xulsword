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
  ofClass,
  rowsToSelection,
  selectionToRows,
  versionCompare,
} from '../../common';
import Subscription from '../../subscription';
import C from '../../constant';
import G from '../rg';
import { log, moduleInfoHTML } from '../rutil';
import { TCellInfo, TCellLocation } from '../libxul/table';

import type {
  Repository,
  RepositoryListing,
  RowSelection,
  SwordConfType,
} from '../../type';
import type ModuleManager from './manager';
import type { ManagerState } from './manager';
import type { VKSelection } from '../libxul/vkselect';

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

// These local repositories cannot be disabled, deleted or changed.
// Implemented as a function to allow i18n to initialize.
export function builtinRepos(): Repository[] {
  return [
    {
      name: 'Shared | Общий',
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
    {
      name: i18n.t('audio.label'),
      domain: 'file://',
      path: G.Dirs.path.xsAudio,
      file: '',
      builtin: true,
      disabled: false,
      custom: false,
    },
  ];
}

export const LanguageTableHeadings = [''];

export function ModuleTableHeadings() {
  return [
    '',
    '',
    i18n.t('name.label'),
    'Repository',
    'Version',
    'Size',
    'Features',
    'Versification',
    'Scope',
    'Copyright',
    'Distribution License',
    'Source Type',
    'icon:folder-shared',
    'icon:cloud-download',
    'icon:delete',
  ];
}

export const RepositoryTableHeadings = ['', '', '', 'icon:folder-open'];

export type TRepCellInfo = TCellInfo & {
  repo: Repository;
};

export type TModCellInfo = TCellInfo & {
  shared: boolean;
  repo: Repository;
  conf: SwordConfType;
};

export type TLangCellInfo = TCellInfo & {
  code: string;
};

export type TLanguageTableRow = [string, TLangCellInfo];

export type TModuleTableRow = [
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
  string,
  (dataRow: number, dataCol: number) => typeof ON | typeof OFF,
  typeof ON | typeof OFF,
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
  iRemove: 14,
  iInfo: 15,
} as const;

export const RepCol = {
  iName: 0,
  iDomain: 1,
  iPath: 2,
  iState: 3,
  iInfo: 4,
} as const;

export const Downloads: {
  [modrepoKey: string]: {
    nfiles: Promise<number | null>;
    failed: boolean;
  };
} = {};

export const ModuleUpdates: {
  install: boolean;
  from: {
    conf: SwordConfType;
    repo: Repository;
  };
  to: {
    conf: SwordConfType;
    repo: Repository;
  };
}[] = [];

export function onColumnHide(
  this: ModuleManager,
  toggleDataColumn: number,
  targetColumn: number
) {
  const state = this.state as ManagerState;
  const table = 'module';
  const tablestate = state[table];
  let { visibleColumns } = tablestate;
  visibleColumns = visibleColumns.slice();
  const wasHidden = visibleColumns.indexOf(toggleDataColumn) === -1;
  if (wasHidden) {
    visibleColumns.splice(targetColumn + 1, 0, toggleDataColumn);
  } else {
    visibleColumns.splice(visibleColumns.indexOf(toggleDataColumn), 1);
  }
  tablestate.visibleColumns = visibleColumns;
  this.sState({ [table]: tablestate });
}

export function columnWidthChanged(
  this: ModuleManager,
  table: typeof Tables[number],
  column: number,
  size: number
): void {
  const state = this.state as ManagerState;
  if (table === 'language') return;
  const tbl = state[table];
  if (tbl) {
    let { columnWidths } = tbl;
    columnWidths = columnWidths.slice();
    const { visibleColumns } = tbl;
    const dcol0 = visibleColumns[column];
    const dcol2 = visibleColumns[column + 1];
    const delta = size - columnWidths[dcol0];
    columnWidths[dcol0] += delta;
    columnWidths[dcol2] -= delta;
    this.setTableState(table, { columnWidths }, null, true);
  }
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
  const state = this.state as ManagerState;
  const tbl = state[table];
  if (tbl) {
    // Update our tableToDataRowMap based on the new sorting.
    Saved[table].tableToDataRowMap = tableToDataRowMap;
    // Update initial rowSort for the next Table component reset.
    const { rowSort } = tbl;
    if (rowSort.column !== column || rowSort.direction !== direction) {
      this.setTableState(table, { rowSort: { column, direction } }, null, true);
    }
  }
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
  const disabled = ofClass(['disabled'], e.target);
  if (!disabled) {
    const state = this.state as ManagerState;
    const { module } = state as ManagerState;
    const { module: modtable } = state.tables;
    const { selection, visibleColumns } = module;
    const { dataRowIndex: row, column, tableRowIndex } = cell;
    let col = visibleColumns[column];
    const drow = modtable.data[row];
    if (
      drow &&
      !drow[ModCol.iInfo].loading &&
      (col === ModCol.iInstalled || col === ModCol.iRemove)
    ) {
      const remove = col === ModCol.iRemove;
      col = ModCol.iInstalled;
      // Installed column clicks
      const was = drow[col];
      const is = was === ON ? OFF : ON;
      const selrows = selectionToRows(selection);
      const toggleTableRows = selrows.includes(tableRowIndex)
        ? selrows
        : [tableRowIndex];
      const toggleDataRows = toggleTableRows.map(
        (r) => Saved.module.tableToDataRowMap[r] ?? r
      );
      if (is === ON) {
        const newDLRows: number[] = [];
        toggleDataRows.forEach((r) => {
          const rrow = modtable.data[r];
          if (rrow) {
            rrow[ModCol.iRemove] = OFF;
            const k = modrepKey(rrow[ModCol.iModule], rrow[ModCol.iInfo].repo);
            if (remove || (k in Downloads && !Downloads[k].failed)) {
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
            rrow[ModCol.iRemove] = ON;
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
        if (rrow && rrow[ModCol.iInstalled] === ON) {
          rrow[ModCol.iInfo].shared = is;
        }
      });
      this.setTableState('module', null, modtable.data, true);
    } else {
      this.rowSelect(e, 'module', tableRowIndex);
    }
  }
}

export function onRepoCellClick(
  this: ModuleManager,
  e: React.MouseEvent,
  cell: TCellLocation
) {
  const state = this.state as ManagerState;
  const { repository } = state;
  if (repository) {
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
}

export function onCellEdited(
  this: ModuleManager,
  cell: TCellLocation,
  value: string
) {
  const table = 'repository';
  const state = this.state as ManagerState;
  const { repositories } = state;
  const tbl = state[table];
  if (repositories && tbl) {
    const newCustomRepos = clone(repositories.custom);
    const tablestate = state.tables[table];
    const { visibleColumns } = tbl;
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
        repositories: { ...repositories, custom: newCustomRepos },
      });
      if (
        (col === RepCol.iDomain || col === RepCol.iPath) &&
        drow[RepCol.iState] === OFF
      ) {
        setTimeout(() => this.switchRepo([row], true), 100);
      }
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
          // Remove any failed downloads
          Object.keys(Downloads).forEach((k) => {
            if (Downloads[k].failed) {
              const amui = ModuleUpdates.findIndex(
                (mud) => k === modrepKey(mud.to.conf.module, mud.to.repo)
              );
              if (amui !== -1) ModuleUpdates.splice(amui, 1);
              delete Downloads[k];
            }
          });
          // Remove updates that have not received permission
          Object.keys(Downloads).forEach((k) => {
            const amui = ModuleUpdates.findIndex(
              (mud) => k === modrepKey(mud.to.conf.module, mud.to.repo)
            );
            if (amui !== -1 && !ModuleUpdates[amui].install) {
              ModuleUpdates.splice(amui, 1);
              delete Downloads[k];
            }
          });
          const downloadKeys = Object.keys(Downloads);
          const promises = Object.values(Downloads).map((v) => v.nfiles);
          let downloadResults: PromiseSettledResult<number | null>[] = [];
          const installed: SwordConfType[] = [];
          const removeMods: { name: string; repo: Repository }[] = [];
          const moveMods: {
            name: any;
            fromRepo: any;
            toRepo: Repository;
          }[] = [];
          return Promise.allSettled(promises)
            .then((dlr) => {
              downloadResults = dlr;
              G.Window.moveToBack();
              // Remove selection from persisted state.
              this.setTableState('module', { selection: [] });
              this.setTableState('repository', { selection: [] });
              const state = this.state as ManagerState;
              const { repository: repotable } = state.tables;
              const { moduleData } = Saved;
              // Get a list of all currently installed modules (those found in any
              // enabled local repository).
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
                const module = row[ModCol.iModule];
                if (
                  row[ModCol.iInstalled] === OFF &&
                  !ModuleUpdates.some((mud) => mud.to.conf.module)
                ) {
                  const { repo } = row[ModCol.iInfo];
                  const modrepok = modrepKey(module, repo);
                  const conf = installed.find(
                    (c) => modrepKey(c.module, c.sourceRepository) === modrepok
                  );
                  if (modrepok in Downloads) {
                    if (!G.Module.clearDownload(module, repo)) {
                      log.warn(`Failed to clear ${module} from downloads`);
                      Downloads[modrepok].failed = true;
                    }
                  } else if (conf) {
                    removeMods.push({
                      name: conf.module,
                      repo: conf.sourceRepository,
                    });
                  }
                }
              });
              ModuleUpdates.forEach((mud) => {
                removeMods.push({
                  name: mud.from.conf.module,
                  repo: mud.from.repo,
                });
              });
              G.Module.modal(true, G.Window.id());
              return G.Module.remove(removeMods);
            })
            .then((removeResult) => {
              removeResult.forEach((r, i) => {
                if (!r) log.warn(`Failed to remove module: ${removeMods[i]}`);
              });
              // Move modules (between the shared and xulsword builtins).
              const { moduleData } = Saved;
              Object.values(moduleData).forEach((row) => {
                if (row[ModCol.iInfo].conf.xsmType !== 'XSM_audio') {
                  const { shared, repo } = row[ModCol.iInfo];
                  const module = row[ModCol.iModule];
                  if (!removeMods.map((m) => m.name).includes(module)) {
                    const modrepok = modrepKey(module, repo);
                    const conf = installed.find(
                      (c) =>
                        modrepKey(c.module, c.sourceRepository) === modrepok
                    );
                    if (conf?.sourceRepository.builtin) {
                      const toRepo = builtinRepos()[shared ? 0 : 1];
                      const fromKey =
                        conf && downloadKey(conf.sourceRepository);
                      const toKey = downloadKey(toRepo);
                      if (conf && fromKey !== toKey) {
                        moveMods.push({
                          name: module,
                          fromRepo: conf.sourceRepository,
                          toRepo,
                        });
                      }
                    }
                  }
                }
              });
              return G.Module.move(moveMods);
            })
            .then((moveResult) => {
              moveResult.forEach((r, i) => {
                if (!r) log.warn(`Failed to move module: ${moveMods[i]}`);
              });
              const install: {
                module: string;
                fromRepo: Repository;
                toRepo: Repository;
              }[] = [];
              const { moduleData } = Saved;
              downloadResults.forEach((dlr, i) => {
                if (dlr.status !== 'fulfilled') log.warn(dlr.reason);
                else if (dlr.value) {
                  const modrepok = downloadKeys[i];
                  const mud = ModuleUpdates.find(
                    (x) => modrepok === modrepKey(x.to.conf.module, x.to.repo)
                  );
                  // Install module updates
                  if (mud) {
                    install.push({
                      module: mud.to.conf.module,
                      fromRepo: mud.to.repo,
                      toRepo: mud.from.repo,
                    });
                  } else {
                    // Install user's selection(s)
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
                      install.push({
                        module: row[ModCol.iModule],
                        fromRepo: row[ModCol.iInfo].repo,
                        toRepo:
                          builtinRepos()[row[ModCol.iInfo].shared ? 0 : 1],
                      });
                    }
                  }
                }
              });
              return G.Module.installDownloads(install);
            })
            .then((newmods) => {
              G.Window.modal('off', 'self');
              if (newmods.errors.length) {
                const message = newmods.errors.join('\n');
                if (/(failed|warning)/i.test(message)) {
                  const fail = /fail/i.test(message);
                  this.addToast({
                    message,
                    timeout: -1,
                    icon: fail ? 'error' : 'warning-sign',
                    intent: fail ? Intent.DANGER : Intent.WARNING,
                    onDismiss: () => {
                      G.Module.modal(false);
                      G.Window.close();
                    },
                  });
                  return false;
                }
              }
              G.Module.modal(false);
              G.Window.close();
              return true;
            })
            .catch((er) => {
              log.warn(er);
              G.Module.modal(false);
            });
        }
        case 'repoAdd': {
          const state = this.state as ManagerState;
          const { repositories } = state;
          if (repositories) {
            const newCustomRepos = clone(repositories.custom);
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
              repositories: { ...repositories, custom: newCustomRepos },
            });
            this.switchRepo([0], false);
          }
          break;
        }
        case 'repoDelete': {
          const state = this.state as ManagerState;
          const { repositories, repository } = state;
          if (repositories && repository) {
            const newCustomRepos = clone(repositories.custom);
            const { repository: repotable } = state.tables;
            const { selection } = repository;
            const repotableData = clone(repotable.data);
            const { repositoryListings } = Saved;
            const rows =
              (repository &&
                this.selectionToDataRows('repository', selection)) ||
              [];
            rows.reverse().forEach((r) => {
              const drow = repotable.data[r];
              if (drow && drow[RepCol.iInfo].repo.custom) {
                repotableData.splice(r, 1);
                repositoryListings.splice(r, 1);
                const crIndex = repositories.custom.findIndex(
                  (ro) =>
                    downloadKey(ro) === downloadKey(drow[RepCol.iInfo].repo)
                );
                if (crIndex !== -1) {
                  newCustomRepos.splice(crIndex, 1);
                }
              }
            });
            this.setTableState('repository', null, repotableData, true, {
              repositories: { ...repositories, custom: newCustomRepos },
            });
            this.loadModuleTable(this.loadLanguageTable());
          }
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
        case 'internet.yes':
        case 'internet.no': {
          const allow = e.currentTarget.id === 'internet.yes';
          const cb = document.getElementById(
            'internet.rememberChoice__input'
          ) as HTMLInputElement | null;
          if (cb && cb.checked) {
            G.Prefs.setBoolPref('global.InternetPermission', allow);
          }
          const s: Partial<ManagerState> = {
            internetPermission: allow,
          };
          this.setState(s);
          if (allow) this.loadManagerTables();
          // If the answer is no, then close the window, as there is
          // nothing else to be done here.
          else G.Window.close();
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
  const tbl = state[table];
  if (tbl) {
    const { selection } = tbl;
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
  return [];
}

// Enable or disable a repository. If onOrOff is undefined it will be toggled.
// If onOrOff is true it will be enabled, otherwise disabled.
export function switchRepo(
  this: ModuleManager,
  rows: number[],
  onOrOff?: boolean
) {
  const state = this.state as ManagerState;
  const { repositories } = state;
  if (repositories) {
    const { disabled: dr } = repositories;
    const { repository: repotable } = state.tables;
    const repoTableData = clone(repotable.data);
    const disabledRepos = dr
      ? dr.slice()
      : repoTableData
          .map((r) =>
            r[RepCol.iInfo].repo.disabled
              ? downloadKey(r[RepCol.iInfo].repo)
              : ''
          )
          .filter(Boolean);
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
          drow[RepCol.iState] = drow[RepCol.iInfo].repo.builtin
            ? ALWAYS_ON
            : ON;
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
      repositories: { ...repositories, disabled: disabledRepos },
    });
    G.Downloader.repositoryListing(
      repoTableData.map((r, i) =>
        rows.includes(i) && !r[RepCol.iInfo].repo.disabled
          ? r[RepCol.iInfo].repo
          : null
      )
    )
      .then((listing) => {
        if (!listing) throw new Error(`Canceled`);
        this.updateRepositoryLists(listing);
        this.checkForModuleUpdates(listing);
        let selection = this.loadLanguageTable();
        const { language } = this.state as ManagerState;
        if (!language.open) selection = [];
        return this.loadModuleTable(selection);
      })
      .catch((er) => log.warn(er));
  }
}

export const active = {
  downloads: [] as [string, number][],
};

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
      const { xsmType } = drow[ModCol.iInfo].conf;
      const loadingrows: TModuleTableRow[] = [];
      let xsmZipFileOrURL: string = drow[ModCol.iInfo].conf.DataPath;
      if (xsmType === 'XSM') {
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
      } else if (xsmType === 'XSM_audio') {
        drow[ModCol.iInfo].loading = loading(ModCol.iInstalled);
        loadingrows.push(drow);
      } else {
        drow[ModCol.iInfo].loading = loading(ModCol.iInstalled);
        loadingrows.push(drow);
      }
      const nfiles = (async () => {
        try {
          if (drow[ModCol.iInfo].conf.xsmType === 'XSM_audio') {
            const { AudioChapters } = drow[ModCol.iInfo].conf;
            if (AudioChapters) {
              const audio: VKSelection | null = await new Promise((resolve) => {
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
                      vkmods: [],
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
              });
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
          const dl = await (drow[ModCol.iInfo].conf.xsmType !== 'none'
            ? G.Module.downloadXSM(module, xsmZipFileOrURL, repo)
            : G.Module.download(module, repo));
          loadingrows.forEach((r) => {
            r[ModCol.iInfo].loading = false;
          });
          let newintent: Intent = Intent.SUCCESS;
          if (typeof dl === 'string') {
            this.addToast({
              message: dl,
              timeout: 5000,
              intent: Intent.WARNING,
            });
            newintent = Intent.DANGER;
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
          this.addToast({
            message: er.message,
            timeout: 5000,
            intent: Intent.WARNING,
          });
          loadingrows.forEach((r) => {
            r[ModCol.iInfo].loading = false;
            r[ModCol.iInfo].intent = intent(ModCol.iInstalled, Intent.DANGER);
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

// Check enabled repository listings for installed modules that have
// newer versions available, or have been obsoleted. Begin downloading
// the updates, but ask whether to replace each installed module with
// the update before doing so. This function should be called after
// updateRepositoryLists().
export function checkForModuleUpdates(
  this: ModuleManager,
  rawModuleData: RepositoryListing[]
) {
  const state = this.state as ManagerState;
  const { repository } = state.tables;
  const { repositoryListings } = Saved;
  const installed: SwordConfType[] = [];
  // Get installed modules
  repository.data.forEach((rtd, i) => {
    if (isRepoLocal(rtd[RepCol.iInfo].repo)) {
      const listing = repositoryListings[i];
      if (Array.isArray(listing)) {
        listing.forEach((c) => installed.push(c));
      }
    }
  });
  // Search new rawModuleData for possible updates
  const moduleUpdates: typeof ModuleUpdates = [];
  installed.forEach((inst) => {
    const candidates: typeof ModuleUpdates = [];
    if (ModuleUpdates.some((mud) => mud.from.conf.module === inst.module)) {
      return;
    }
    rawModuleData.forEach((listing, i) => {
      const { repo } = repository.data[i][RepCol.iInfo];
      if (listing && Array.isArray(listing)) {
        listing.forEach((avail) => {
          if (
            avail.xsmType !== 'XSM_audio' &&
            // module is to be obsoleted
            (avail.Obsoletes?.includes(inst.module) ||
              // module is to be replaced by a newer version
              (avail.xsmType !== 'XSM' &&
                avail.module === inst.module &&
                versionCompare(avail.Version ?? 0, inst.Version ?? 0) === 1) ||
              // module is to be replaced by an XSM module containing a newer
              // version, as long as we don't downgrade any installed modules
              (avail.xsmType === 'XSM' &&
                avail.SwordModules?.some(
                  (swm, x) =>
                    inst.module === swm &&
                    versionCompare(
                      (avail.SwordVersions && avail.SwordVersions[x]) ?? 0,
                      inst.Version ?? 0
                    ) === 1
                ) &&
                !avail.SwordModules?.some(
                  (swm, x) =>
                    versionCompare(
                      installed.find((im) => im.module === swm)?.Version ?? 0,
                      (avail.SwordVersions && avail.SwordVersions[x]) ?? 0
                    ) === 1
                )))
          ) {
            candidates.push({
              from: {
                conf: inst,
                repo: inst.sourceRepository,
              },
              to: {
                conf: avail,
                repo,
              },
              install: false,
            });
          }
        });
      }
    });
    // Choose the first candidate with the highest version number, XSM modules first.
    const version = (x: typeof ModuleUpdates[number]): string => {
      let v = '0';
      if (x.to.conf.xsmType === 'XSM') {
        const i =
          x.to.conf.SwordModules?.findIndex((m) => m === inst.module) ?? -1;
        if (i !== -1 && x.to.conf.SwordVersions)
          v = `2.${x.to.conf.SwordVersions[i] ?? '0'}`;
      } else {
        v = `1.${x.to.conf.Version ?? 0}`;
      }
      return v;
    };
    candidates.sort((a, b) => versionCompare(version(b), version(a)));
    if (candidates.length) moduleUpdates.push(candidates[0]);
  });
  // Show a toast to ask permission to install each update.
  moduleUpdates.forEach((mud) => {
    const abbr =
      (mud.to.conf.Abbreviation?.locale || mud.to.conf.module) ?? '?';
    const rn = mud.to.repo.name;
    const reponame =
      rn && rn.includes(' | ')
        ? rn.split(' | ')[i18n.language === 'ru' ? 1 : 0]
        : rn || '';
    const history =
      mud.to.conf.History?.filter(
        (h) => versionCompare(h[0], mud.from.conf.Version ?? 0) === 1
      )
        .map((h) => h[1].locale)
        .join('\n') ?? '';
    this.addToast({
      timeout: -1,
      intent: Intent.SUCCESS,
      message: `${abbr} ${mud.to.conf.Version}: ${history} (${reponame} ${mud.to.conf.module})`,
      action: {
        onClick: () => {
          mud.install = true;
        },
        text: i18n.t('yes.label'),
      },
      icon: 'confirm',
    });
  });
  // Download each update.
  moduleUpdates.forEach((mud) => {
    const modrepk = modrepKey(mud.to.conf.module, mud.to.repo);
    const n = (
      mud.to.conf.xsmType === 'XSM'
        ? G.Module.downloadXSM(
            mud.to.conf.module,
            mud.to.conf.DataPath,
            mud.to.repo
          )
        : G.Module.download(mud.to.conf.module, mud.to.repo)
    )
      .then((nx) => {
        if (typeof nx === 'string') return null;
        if (nx && modrepk in Downloads) Downloads[modrepk].failed = false;
        return nx;
      })
      .catch((er) => {
        log.info(er);
        return null;
      });
    Downloads[modrepk] = { nfiles: n, failed: true };
  });
  ModuleUpdates.push(...moduleUpdates);
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
  // Ignore new tableState if it is null (meaning table doesn't exist).
  if (tableState && state[table] !== null) {
    news[table] = { ...state[table], ...tableState } as any;
  }
  if (tableData) {
    news.tables = { ...state.tables };
    news.tables[table].data = tableData;
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
  const on = builtinRepos()
    .map((r) => downloadKey(r))
    .includes(downloadKey(repo))
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

export function modclasses() {
  return (ri: number, ci: number) => {
    const cs: string[] = [];
    if ([ModCol.iShared, ModCol.iInstalled, ModCol.iRemove].includes(ci as any))
      cs.push('checkbox-column');
    const drow = Saved.module.data[ri];
    if (drow && drow[ModCol.iInstalled] === OFF && ci === ModCol.iShared) {
      cs.push('disabled');
    } else if (
      ci === ModCol.iShared &&
      drow[ModCol.iInfo].conf.xsmType === 'XSM_audio'
    ) {
      cs.push('disabled');
    }
    return cs;
  };
}

export function tooltip(atooltip: string, skipColumnIndexArray: number[]) {
  return (_ri: number, ci: number) => {
    return skipColumnIndexArray.includes(ci) ? undefined : atooltip;
  };
}
