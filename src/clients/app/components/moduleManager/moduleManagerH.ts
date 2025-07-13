import { Intent } from '@blueprintjs/core';
import {
  clone,
  downloadKey,
  isRepoLocal,
  keyToDownload,
  ofClass,
  repositoryKey,
  tableRowsToSelection,
  selectionToTableRows,
  versionCompare,
  isAudioVerseKey,
  subtractVerseKeyAudioChapters,
  subtractGenBookAudioChapters,
  genBookAudio2TreeNodes,
  diff,
  builtinRepos,
  repositoryModuleKey,
  tableSelectDataRows,
  querablePromise,
  gbPaths,
  localizeString,
  findFirstLeafNode,
  cloneAny,
} from '../../../../common.ts';
import C from '../../../../constant.ts';
import { G } from '../../../G.ts';
import { windowArguments } from '../../../common.tsx';
import log from '../../../log.ts';
import { forEachNode } from '../../../components/libxul/treeview.tsx';

import type {
  Download,
  FTPDownload,
  GType,
  Repository,
  RepositoryListing,
  RowSelection,
  SwordConfType,
  VerseKeyAudio,
  GenBookAudioConf,
  OSISBookType,
  QuerablePromise,
} from '../../../../type.ts';
import type S from '../../../../defaultPrefs.ts';
import type {
  SelectVKType,
  SelectVKProps,
} from '../../../components/libxul/selectVK.tsx';
import type ModuleManager from './moduleManager.tsx';
import type { ManagerState } from './moduleManager.tsx';
import type {
  NodeListOR,
  SelectORMType,
} from '../../../components/libxul/selectOR.tsx';
import type {
  TCellInfo,
  TCellLocation,
  TData,
} from '../../../components/libxul/table.tsx';

export const Tables = ['language', 'module', 'repository'] as const;

export type VersekeyDialog = {
  type: 'versekey';
  conf: SwordConfType;
  selection: SelectVKType;
  initial: SelectVKProps['initialVK'];
  options: SelectVKProps['options'];
  chapters: VerseKeyAudio;
  callback: (result: SelectVKType | SelectORMType | null) => void;
};

export type GenBookDialog = {
  type: 'genbook';
  conf: SwordConfType;
  selection: SelectORMType;
  initial: undefined;
  options: { nodeLists?: NodeListOR[]; gbmods?: string[] };
  chapters: GenBookAudioConf;
  callback: (result: SelectVKType | SelectORMType | null) => void;
};

export type TRepCellInfo = TCellInfo & {
  repo: Repository;
};

export type TModCellInfo = TCellInfo & {
  shared: boolean;
  installedLocally: boolean;
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
  string,
  (
    dataRow: number,
    dataCol: number,
    data: TModuleTableRow[],
  ) => typeof ON | typeof OFF,
  typeof ON | typeof OFF,
  typeof ON | typeof OFF,
  TModCellInfo,
];

export type TRepositoryTableRow = [
  string,
  string,
  string,
  typeof ON | typeof OFF | typeof ALWAYSON,
  TRepCellInfo,
];

export const ON = '☑';
export const OFF = '☐';
export const ALWAYSON = '￭';

export const LanCol = {
  iName: 0,
  iInfo: 1,
} as const;

export const ModCol = {
  iType: 0,
  iAbout: 1,
  iModule: 2,
  iRepoName: 3,
  iVersion: 4,
  iLang: 5,
  iSize: 6,
  iFeatures: 7,
  iVersification: 8,
  iScope: 9,
  iCopyright: 10,
  iLicense: 11,
  iSourceType: 12,
  iShared: 13,
  iInstalled: 14,
  iRemove: 15,
  iInfo: 16,
} as const;

export const RepCol = {
  iName: 0,
  iDomain: 1,
  iPath: 2,
  iState: 3,
  iInfo: 4,
} as const;

export const Downloads: Array<
  QuerablePromise<Array<Record<string, number | string> | null>>
> = [];

export type ModuleUpdates = {
  doInstall: boolean;
  installed?: SwordConfType;
  updateTo: SwordConfType;
};

export const Progressing = {
  ids: [] as Array<[string, number]>, // [id, percent]
};

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
  wholeRowClasses?: string[],
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
  return (ri: number, ci: number, data: TData) => {
    const cs: string[] = [];
    if (
      [ModCol.iShared, ModCol.iInstalled, ModCol.iRemove].includes(ci as never)
    )
      cs.push('checkbox-column');
    const drow = data[ri];
    if (
      drow &&
      ModCol.iInfo in drow &&
      typeof drow[ModCol.iInfo] === 'object' &&
      'conf' in (drow as any)[ModCol.iInfo]
    ) {
      const drowm = drow as TModuleTableRow;
      if (
        (ci === ModCol.iShared && drowm[ModCol.iInstalled] === OFF) ||
        (ci === ModCol.iInstalled && drowm[ModCol.iInfo].installedLocally)
      ) {
        cs.push('disabled');
      } else if (
        ci === ModCol.iShared &&
        drowm[ModCol.iInfo].conf.xsmType === 'XSM_audio'
      ) {
        cs.push('disabled');
      }
    }
    return cs;
  };
}

export function tooltip(atooltip: string, skipColumnIndexArray: number[]) {
  return (_ri: number, ci: number) => {
    return skipColumnIndexArray.includes(ci) ? undefined : atooltip;
  };
}

export function setDownloadProgress(
  xthis: ModuleManager,
  dlkey: string,
  prog: number,
) {
  if (prog !== -1 || Progressing.ids.find((v) => v[0] === dlkey)) {
    let { ids } = Progressing;
    const idi = ids.findIndex((d) => d[0] === dlkey);
    if (idi === -1) ids.push([dlkey, prog]);
    else ids[idi][1] = prog;
    if (ids.every((d) => d[1] === -1)) ids = [];
    const progress = !ids.length
      ? null
      : [ids.reduce((p, c) => p + (c[1] === -1 ? 1 : c[1]), 0), ids.length];
    xthis.sState({ progress });
    Progressing.ids = ids;
  }
}

export function onRowsReordered(
  this: ModuleManager,
  tableName: (typeof Tables)[number],
  propColumnIndex: number,
  direction: 'ascending' | 'descending',
  tableToDataRowMap: number[],
) {
  const state = cloneAny(this.state) as ManagerState;
  const table = state[tableName];
  if (table) {
    // Update our tableToDataRowMap based on the new sorting.
    state.tables[tableName].tableToDataRowMap = tableToDataRowMap;
    // Update initial rowSort for the next Table component reset.
    const { rowSort } = table;
    if (
      rowSort.propColumnIndex !== propColumnIndex ||
      rowSort.direction !== direction
    ) {
      setTableState(
        this,
        tableName,
        { rowSort: { propColumnIndex, direction } },
        null,
        true,
        state,
      );
    }
  }
}

export function onLangCellClick(
  this: ModuleManager,
  e: React.MouseEvent,
  cell: TCellLocation,
) {
  const newSelection = rowSelect(this, e, 'language', cell.tableRowIndex);
  this.loadModuleTable(this.state as ManagerState, newSelection as string[]);
}

export function onModCellClick(
  this: ModuleManager,
  e: React.MouseEvent,
  cell: TCellLocation,
) {
  const disabled = ofClass(['disabled'], e.target);
  if (!disabled) {
    const state = cloneAny(this.state) as ManagerState;
    const { module, tables } = state;
    const { module: modtable } = tables;
    const { selection } = module;
    const { tableToDataRowMap } = state.tables.module;
    const { dataRowIndex: row, tableRowIndex, dataColIndex: col } = cell;
    const drow = modtable.data[row];
    if (drow && (col === ModCol.iInstalled || col === ModCol.iRemove)) {
      // iInstalled and iRemove column clicks
      const was = drow[col] === ON || drow[ModCol.iInfo].loading;
      const is = !was;
      const selrows = selectionToTableRows(selection);
      const datarows = (
        selrows.includes(tableRowIndex) &&
        selrows.every((ri) => ri in modtable.data)
          ? selrows
          : [tableRowIndex]
      ).map((r) => tableToDataRowMap[r] ?? r);
      modtableUpdate(
        this,
        col === ModCol.iRemove ? !is : is,
        datarows.map((ri) => modtable.data[ri][ModCol.iInfo].conf),
        col === ModCol.iRemove,
      );
    } else if (drow && col === ModCol.iShared) {
      // Shared column clicks
      const is = !drow[ModCol.iInfo].shared;
      const selrows = selectionToTableRows(selection);
      (selrows.includes(tableRowIndex) ? selrows : [tableRowIndex])
        .map((r) => tableToDataRowMap[r] ?? r)
        .forEach((r) => {
          const rrow = modtable.data[r];
          if (rrow && rrow[ModCol.iInstalled] === ON) {
            rrow[ModCol.iInfo].shared = is;
          }
        });
      setTableState(this, 'module', null, modtable.data, true);
    } else {
      rowSelect(this, e, 'module', tableRowIndex);
    }
  }
}

export function onRepoCellClick(
  this: ModuleManager,
  e: React.MouseEvent,
  cell: TCellLocation,
) {
  const state = cloneAny(this.state) as ManagerState;
  const { repository } = state;
  if (repository) {
    const { repository: repotable } = state.tables;
    const { selection } = repository;
    const { dataRowIndex: row, tableRowIndex, dataColIndex: col } = cell;
    const builtin =
      repotable.data[row] && repotable.data[row][RepCol.iInfo].repo.builtin;
    if (!builtin && col === RepCol.iState) {
      const selrows = selectionToTableRows(selection);
      switchRepo(
        this,
        (selrows.includes(tableRowIndex) ? selrows : [tableRowIndex]).map(
          (r) => state.tables.repository.tableToDataRowMap[r] ?? r,
        ),
        repotable.data[row][RepCol.iState] === OFF,
      ).catch((er) => {
        log.error(er);
      });
    } else if (row > -1 && col < RepCol.iState) {
      rowSelect(this, e, 'repository', tableRowIndex);
    }
  }
}

export function onCellEdited(
  this: ModuleManager,
  cell: TCellLocation,
  value: string,
) {
  const table = 'repository';
  const state = cloneAny(this.state) as ManagerState;
  const { repositories } = state;
  const tbl = state[table];
  if (repositories && tbl) {
    const newCustomRepos = repositories.custom;
    const tablestate = state.tables[table];
    const { dataRowIndex: row, dataColIndex: col } = cell;
    const drow = tablestate.data[row];
    if (table === 'repository' && drow) {
      const crindex = newCustomRepos.findIndex(
        (r) => repositoryKey(r) === repositoryKey(drow[RepCol.iInfo].repo),
      );
      if (crindex !== -1) {
        newCustomRepos.splice(crindex, 1);
      }
      if (col === RepCol.iDomain) drow[RepCol.iInfo].repo.domain = value;
      else if (col === RepCol.iName) drow[RepCol.iInfo].repo.name = value;
      else if (col === RepCol.iPath) drow[RepCol.iInfo].repo.path = value;
      drow[col] = value;
      newCustomRepos.push(drow[RepCol.iInfo].repo);
      setTableState(this, 'repository', null, tablestate.data, false, {
        repositories: { ...repositories, custom: newCustomRepos },
      });
      if (
        (col === RepCol.iDomain || col === RepCol.iPath) &&
        drow[RepCol.iState] === OFF
      ) {
        setTimeout(() => {
          switchRepo(this, [row], true).catch((er) => {
            log.error(er);
          });
        }, 100);
      }
    }
  }
}

export function eventHandler(this: ModuleManager, ev: React.SyntheticEvent) {
  (async () => {
    switch (ev.type) {
      case 'click': {
        const e = ev as React.MouseEvent;
        const [id, idext] = e.currentTarget.id.split('.');
        const state = cloneAny(this.state) as ManagerState;
        switch (id) {
          case 'languageListClose':
          case 'languageListOpen': {
            const open = id === 'languageListOpen';
            setTableState(
              this,
              'module',
              { selection: [] }, // reset selection which may not fit new rows,
              this.filterModuleTable(
                state.tables.module.modules,
                state.language.selection,
                open,
              ),
              true,
              {
                language: { ...state.language, open },
              },
            );
            scrollToSelectedLanguage(this);
            break;
          }
          case 'moduleInfo': {
            const div = document.getElementById('moduleInfo');
            if (div) {
              const { module } = state;
              const { module: modtable } = state.tables;
              const { selection } = module;
              const infoConfigs = selectionToDataRows(this, 'module', selection)
                .map((r) => {
                  return modtable.data[r][ModCol.iInfo].conf || null;
                })
                .filter(Boolean);
              const s: Partial<ManagerState> = { infoConfigs };
              this.setState(s);
            }
            break;
          }
          case 'moduleInfoBack': {
            const s: Partial<ManagerState> = {
              infoConfigs: [],
            };
            this.setState(s);
            break;
          }
          case 'cancel': {
            G.Window.close();
            break;
          }
          case 'ok': {
            try {
              const installed: SwordConfType[] = [];
              const removeMods: Array<{ name: string; repo: Repository }> = [];
              const moveMods: Array<{
                name: any;
                fromRepo: any;
                toRepo: Repository;
              }> = [];
              const downloadResults = await Promise.allSettled(Downloads);
              G.Window.modal([{ modal: 'transparent', window: 'all' }]);
              G.publishSubscription(
                'setControllerState',
                {
                  renderers: [
                    { type: 'xulswordWin' },
                    { id: windowArguments().id },
                  ],
                },
                { progress: 'indefinite' },
              );
              // Un-persist these table selections.
              setTableState(this, 'module', { selection: [] });
              setTableState(this, 'repository', { selection: [] });
              const { repositories } = state;
              const { repository: repotable, module: modtable } = state.tables;
              // Get a list of all currently installed modules (those found in any
              // enabled local repository).
              repotable.data.forEach((rtd, i) => {
                if (isRepoLocal(rtd[RepCol.iInfo].repo)) {
                  const listing = repotable.repositoryListings[i];
                  if (Array.isArray(listing)) {
                    listing.forEach((c) => installed.push(c));
                  }
                }
              });

              // Remove modules (only when there are no repositories)
              if (!repositories) {
                modtable.data.forEach((row) => {
                  if (row[ModCol.iInstalled] === OFF) {
                    const modkey = repositoryModuleKey(row[ModCol.iInfo].conf);
                    const lconf = installed.find(
                      (c) => repositoryModuleKey(c) === modkey,
                    );
                    if (lconf) {
                      removeMods.push({
                        name: lconf.module,
                        repo: lconf.sourceRepository,
                      });
                    }
                  }
                });
                const removeResult = G.Module.remove(removeMods);
                removeResult.forEach((r, i) => {
                  if (!r)
                    this.addToast({
                      message: `Failed to remove module: '${removeMods[i].name}'`,
                      timeout: -1,
                      intent: Intent.DANGER,
                    });
                });
              }

              // Move modules (between the shared and xulsword builtins).
              modtable.data.forEach((row) => {
                if (row[ModCol.iInfo].conf.xsmType !== 'XSM_audio') {
                  const { shared } = row[ModCol.iInfo];
                  const module = row[ModCol.iModule];
                  if (!removeMods.map((m) => m.name).includes(module)) {
                    // start with conf from modtable
                    const { conf } = row[ModCol.iInfo];
                    // find conf of actual installed module to move from
                    const confFrom = installed.find(
                      (c) =>
                        c.module === conf.module && c.Version === conf.Version,
                    );
                    const builtIns = builtinRepos(G);
                    // May only move into shared, or from shared to UserMods.
                    const toRepo = shared ? builtIns[0] : builtIns[1];
                    if (
                      confFrom &&
                      repositoryKey(confFrom.sourceRepository) !==
                        repositoryKey(toRepo)
                    ) {
                      moveMods.push({
                        name: module,
                        fromRepo: confFrom.sourceRepository,
                        toRepo,
                      });
                    }
                  }
                }
              });
              const moveResult = G.Module.move(moveMods);
              moveResult.forEach((r, i) => {
                if (!r)
                  this.addToast({
                    message: `Failed to move module: '${removeMods[i].name}'`,
                    timeout: -1,
                    intent: Intent.DANGER,
                  });
              });

              // Install modules
              const install: Parameters<
                GType['Module']['installDownloads']
              >[0] = [];
              downloadResults.forEach((dlr) => {
                if (dlr.status === 'fulfilled' && dlr.value) {
                  const { value } = dlr;
                  value.forEach((v) => {
                    if (v) {
                      Object.entries(v).forEach((entry) => {
                        let [downloadkey] = entry;
                        const [, result] = entry;
                        if (typeof result === 'number' && result > 0) {
                          const dl = keyToDownload(downloadkey);
                          // Find the moduleData row associated with this
                          // download.
                          downloadkey = downloadKey(dl);
                          const row = modtable.data.find(
                            (r) =>
                              downloadKey(
                                getModuleDownload(
                                  this,
                                  repositoryModuleKey(r[ModCol.iInfo].conf),
                                ),
                              ) === downloadkey,
                          );
                          if (row && row[ModCol.iInstalled] === ON) {
                            install.push({
                              download: dl,
                              toRepo:
                                builtinRepos(G)[
                                  row[ModCol.iInfo].shared ? 0 : 1
                                ],
                            });
                          }
                        }
                      });
                    }
                  });
                }
              });
              G.Module.installDownloads(
                install,
                G.Window.descriptions({ type: 'xulswordWin' })[0]?.id,
              ).catch((er) => {
                log.error(er);
              });
              G.Window.close();
            } catch (er) {
              log.error(er);
            } finally {
              G.Window.modal([{ modal: 'off', window: 'all' }]);
              G.publishSubscription(
                'setControllerState',
                {
                  renderers: [
                    { type: 'xulswordWin' },
                    { id: windowArguments().id },
                  ],
                },
                { progress: -1 },
              );
            }
            break;
          }
          case 'repoAdd': {
            const { repositories } = state;
            if (repositories) {
              const { repository: repotable } = state.tables;
              const repo: Repository = {
                name: '?',
                domain: C.Downloader.localfile,
                path: '?',
                disabled: true,
                custom: true,
                builtin: false,
              };
              const row = repositoryToRow(repo);
              row[RepCol.iInfo].classes = classes(
                [RepCol.iState],
                ['checkbox-column'],
                ['custom-repo'],
              );
              row[RepCol.iInfo].editable = editable();
              repotable.data.unshift(row);
              repotable.repositoryListings.unshift(null);
              repositories.custom.push(repo);
              setTableState(
                this,
                'repository',
                null,
                repotable.data,
                true,
                state,
              );
              switchRepo(this, [0], false).catch((er) => {
                log.error(er);
              });
            }
            break;
          }
          case 'repoDelete': {
            const { repositories, repository } = state;
            if (repositories && repository) {
              const newCustomRepos = repositories.custom;
              const { repository: repotable } = state.tables;
              const { selection } = repository;
              const repotableData = repotable.data.slice();
              const { repositoryListings } = repotable;
              const rows =
                (repository &&
                  selectionToDataRows(this, 'repository', selection)) ||
                [];
              rows.reverse().forEach((r) => {
                const drow = repotable.data[r];
                if (drow && drow[RepCol.iInfo].repo.custom) {
                  repotableData.splice(r, 1);
                  repositoryListings.splice(r, 1);
                  const crIndex = repositories.custom.findIndex(
                    (ro) =>
                      repositoryKey(ro) ===
                      repositoryKey(drow[RepCol.iInfo].repo),
                  );
                  if (crIndex !== -1) {
                    newCustomRepos.splice(crIndex, 1);
                  }
                }
              });
              setTableState(
                this,
                'repository',
                null,
                repotableData,
                true,
                state,
              );
              this.loadLanguageTable(state, repositoryListings);
              this.loadModuleTable(state);
            }
            break;
          }
          case 'repoCancel': {
            const { repository: repotable } = state.tables;
            G.Module.cancel(
              repotable.data
                .map((r, ri) =>
                  r[RepCol.iInfo].loading !== false && r[RepCol.iState] !== OFF
                    ? ri
                    : null,
                )
                .filter((ri) => ri !== null)
                .map((rix) => {
                  const ri = rix as number;
                  const r = repotable.data[ri];
                  r[RepCol.iInfo].intent = intent(RepCol.iState, 'warning');
                  return {
                    ...r[RepCol.iInfo].repo,
                    file: C.SwordRepoManifest,
                    type: 'ftp',
                  };
                }),
            ).catch((er) => {
              log.error(er);
            });
            setTableState(this, 'repository', null, repotable.data, true);
            break;
          }
          case 'moduleCancel': {
            await G.Module.cancelOngoingDownloads();
            this.addToast({
              message: C.UI.Manager.cancelMsg,
              timeout: 5000,
              intent: Intent.SUCCESS,
            });
            Progressing.ids = [];
            this.sState({ progress: null });
            break;
          }
          case 'internet': {
            const allow = idext === 'yes';
            const cb = document.getElementById(
              'internet.rememberChoice__input',
            ) as HTMLInputElement | null;
            if (cb && cb.checked) {
              G.Prefs.setBoolPref('global.InternetPermission', allow);
            }
            const s: Partial<ManagerState> = {
              internetPermission: allow,
            };
            this.setState(s);
            if (allow)
              this.loadTables().catch((er) => {
                log.error(er);
              });
            // If the answer is no, then close the window, as there is
            // nothing else to be done here.
            else G.Window.close();
            break;
          }
          default:
            throw Error(
              `Unhandled ModuleManager click event ${e.currentTarget.id}`,
            );
        }
        break;
      }
      default:
        throw Error(`Unhandled ModuleManager event type ${ev.type}`);
    }
  })().catch((er) => {
    log.error(er);
  });
}

// Select or unselect a row of a table. Returns the new selection.
// NOTE: returned selection is type state.table[table].selection.
export function rowSelect(
  xthis: ModuleManager,
  e: React.MouseEvent,
  table: (typeof Tables)[number],
  row: number,
): RowSelection | string[] {
  const state = cloneAny(xthis.state) as ManagerState;
  const tbl = state[table];
  let newSelection: RowSelection | string[] = [];
  if (tbl) {
    const { selection } = tbl;
    let rows: number[] = [];
    if (table === 'language') {
      const { data: langTableData } = state.tables.language;
      rows = selection
        .map((code) => {
          const rx = langTableData.findIndex(
            (r) => r[LanCol.iInfo].code === code,
          );
          return rx === -1 ? 0 : rx;
        })
        .sort((a, b) => a - b);
    } else {
      rows = selectionToTableRows(selection as RowSelection);
    }
    newSelection = tableRowsToSelection(tableSelectDataRows(row, rows, e));
    if (table === 'language') {
      const { data: langTableData } = state.tables.language;
      newSelection = selectionToTableRows(newSelection).map(
        (r) => langTableData[r][LanCol.iInfo].code,
      );
    }
    const sel = newSelection as any;
    setTableState(xthis, table, { selection: sel }, null, false);
  }
  return newSelection;
}

// Get a list of disabled repositories: usually state.repositories.disabled,
// but if that is null, return the 'disabled' property of each repository.
function getDisabledRepos(state: ManagerState) {
  const { repositories } = state;
  if (repositories) {
    const { disabled } = repositories;
    const { repository: repotable } = state.tables;
    return disabled
      ? disabled.slice()
      : repotable.data
          .map((r) =>
            r[RepCol.iInfo].repo.disabled
              ? repositoryKey(r[RepCol.iInfo].repo)
              : '',
          )
          .filter(Boolean);
  }
  return [];
}

function repoRowEnableDisable(
  enable: boolean,
  row: TRepositoryTableRow,
  disabledReposx: string[] | null,
  stateIntent = Intent.NONE as Intent,
): string[] {
  const disabledRepos = disabledReposx ?? [];
  const rowkey = repositoryKey(row[RepCol.iInfo].repo);
  const disabledIndex = disabledRepos.findIndex((drs) => {
    return drs === rowkey;
  });
  if (enable) {
    if (disabledIndex !== -1) disabledRepos.splice(disabledIndex, 1);
    row[RepCol.iState] = row[RepCol.iInfo].repo.builtin ? ALWAYSON : ON;
    row[RepCol.iInfo].repo.disabled = false;
    row[RepCol.iInfo].loading = loading(RepCol.iState);
    row[RepCol.iInfo].intent = intent(RepCol.iState, stateIntent);
  } else {
    if (disabledIndex === -1) disabledRepos.push(rowkey);
    row[RepCol.iState] = OFF;
    row[RepCol.iInfo].repo.disabled = true;
    row[RepCol.iInfo].loading = false;
    row[RepCol.iInfo].intent = intent(RepCol.iState, stateIntent);
  }
  return disabledRepos;
}

// Enable or disable one or more repositories. Then update the repository
// table, download new repository data, and pass it on down the chain.
export async function switchRepo(
  xthis: ModuleManager,
  rows: number[],
  onOrOff?: boolean,
) {
  const state = cloneAny(xthis.state) as ManagerState;
  const { repositories } = state;
  if (repositories) {
    const { repository: repotable } = state.tables;
    const { repositoryListings } = repotable;
    const repoTableData = repotable.data.slice();
    repositories.disabled = getDisabledRepos(state);
    const cancel: Parameters<GType['Module']['cancel']>[0] = [];
    rows.forEach((r) => {
      const drowWas = repotable.data[r];
      const drow = repoTableData[r] as TRepositoryTableRow;
      const unswitchable = !drowWas || drowWas[RepCol.iInfo].repo.builtin;
      if (drow && !unswitchable && repositories.disabled) {
        if (
          onOrOff !== false &&
          (onOrOff === true || drowWas[RepCol.iState] === OFF)
        ) {
          repoRowEnableDisable(true, drow, repositories.disabled);
        } else if (drow[RepCol.iInfo].loading) {
          drow[RepCol.iInfo].intent = intent(RepCol.iState, 'warning');
          cancel[r] = {
            ...drow[RepCol.iInfo].repo,
            file: C.SwordRepoManifest,
            type: 'ftp',
          };
        } else {
          repoRowEnableDisable(false, drow, repositories.disabled);
        }
      }
    });
    if (cancel.length)
      G.Module.cancel(cancel.filter((o) => o)).catch((er) => {
        log.error(er);
      });
    setTableState(xthis, 'repository', null, repoTableData, true, state);
    const newrepos: Array<FTPDownload | null> = repoTableData.map((r, i) => {
      return !rows.includes(i) || cancel[i] || r[RepCol.iInfo].repo.disabled
        ? null
        : {
            ...r[RepCol.iInfo].repo,
            file: C.SwordRepoManifest,
            type: 'ftp',
          };
    });
    const listing = await G.Module.repositoryListing(newrepos);
    handleListings(xthis, state, listing);
  }
}

// Handle one or more raw repository listings, also handling any errors
// or cancelations. Also update the language and module tables, checking for
// possible module updates of installed modules.
export function handleListings(
  xthis: ModuleManager,
  state: ManagerState,
  listingsAndErrors: Array<RepositoryListing | string>,
): void {
  const { repositories } = state;
  const { repository } = state.tables;
  const { repositoryListings } = repository;
  if (repositories && repositories.disabled) {
    repositories.disabled = getDisabledRepos(state);
    listingsAndErrors.forEach((l, i) => {
      const drow = repository.data[i];
      if (l !== null && drow) {
        drow[RepCol.iInfo].loading = false;
        drow[RepCol.iInfo].intent = intent(RepCol.iState, 'none');
        if (typeof l === 'string') {
          const newintent = l.startsWith(C.UI.Manager.cancelMsg)
            ? Intent.WARNING
            : Intent.DANGER;
          xthis.addToast({
            message: l,
            timeout: newintent === Intent.WARNING ? 5000 : -1,
            intent: newintent,
          });
          repoRowEnableDisable(false, drow, repositories.disabled, newintent);
          if (!Array.isArray(repositoryListings[i])) {
            repositoryListings[i] = null;
          }
          return null;
        }
        repositoryListings[i] = l;
        if ([ON, ALWAYSON].includes(drow[RepCol.iState])) {
          drow[RepCol.iInfo].intent = intent(RepCol.iState, 'success');
        }
        return l;
      }
      return null;
    });
  } else {
    // Then only local repositories are being considered, with no table to update.
    listingsAndErrors.forEach((l, i) => {
      if (typeof l === 'string') {
        xthis.addToast({
          message: l,
          timeout: 5000,
          intent: Intent.WARNING,
        });
        if (!Array.isArray(repositoryListings[i])) {
          repositoryListings[i] = null;
        }
        return null;
      }
      repositoryListings[i] = l;
      return l;
    });
  }

  setTableState(xthis, 'repository', null, repository.data, true, state);
  xthis.loadLanguageTable(state, repositoryListings);
  xthis.loadModuleTable(state);

  if (repositories) {
    checkForModuleUpdates(xthis, state);
    checkForSuggestions(xthis, state);
  }
}

// Check enabled repository listings (except beta and attic) for installed
// modules that have newer versions available, or have been obsoleted. Begin
// downloading the updates, but ask whether to replace each installed module
// with the update before doing so. This function should be called after
// updateRepositoryLists().
export function checkForModuleUpdates(xthis: ModuleManager, state: ManagerState) {
  const { module, repository } = state.tables;
  const { repositoryListings } = repository;
  const updateable: SwordConfType[] = [];
  // Get modules in the local xulsword repository.
  repository.data.forEach((rtd, i) => {
    if (rtd[RepCol.iInfo].repo.path === G.Dirs.path.xsModsUser) {
      const listing = repositoryListings[i];
      if (Array.isArray(listing)) listing.forEach((c) => updateable.push(c));
    }
  });
  // Add modules in other local SWORD repositories IF they are not in the
  // local xulsword repository. Modules in the shared repository are never
  // auto-updated, but newer versions will be installed into the xulsword repo.
  repository.data.forEach((rtd, i) => {
    if (
      isRepoLocal(rtd[RepCol.iInfo].repo) &&
      rtd[RepCol.iInfo].repo.path !== G.Dirs.path.xsAudio
    ) {
      const listing = repositoryListings[i];
      if (Array.isArray(listing)) {
        listing.forEach((c) => {
          if (!updateable.some((uc) => uc.module === c.module))
            updateable.push(c);
        });
      }
    }
  });

  // Search all module table data for candidate updates.
  const moduleUpdates: ModuleUpdates[] = [];
  updateable.forEach((inst) => {
    const candidates: ModuleUpdates[] = [];
    module.data.forEach((row) => {
      const { conf } = row[ModCol.iInfo];
      if (
        inst.sourceRepository &&
        !['CrossWire Attic', 'CrossWire Beta'].includes(
          conf.sourceRepository.name,
        ) &&
        conf.xsmType !== 'XSM_audio' &&
        // module is to be obsoleted
        (conf.Obsoletes?.includes(inst.module) ||
          // module is to be replaced by a newer version
          (conf.xsmType !== 'XSM' &&
            conf.module === inst.module &&
            versionCompare(conf.Version ?? 0, inst.Version ?? 0) === 1) ||
          // module is to be replaced by an XSM module containing a newer
          // version, as long as we don't downgrade any installed modules
          (conf.xsmType === 'XSM' &&
            conf.SwordModules?.some(
              (swm, x) =>
                inst.module === swm &&
                versionCompare(
                  conf.SwordVersions?.[x] ?? 0,
                  inst.Version ?? 0,
                ) === 1,
            ) &&
            !conf.SwordModules?.some(
              (swm, x) =>
                versionCompare(
                  updateable.find((im) => im.module === swm)?.Version ?? 0,
                  conf.SwordVersions?.[x] ?? 0,
                ) === 1,
            )))
      ) {
        candidates.push({
          installed: inst,
          updateTo: conf,
          doInstall: false,
        });
      }
    });
    // Choose the first candidate with the highest version number, XSM modules first.
    const version = (x: ModuleUpdates): string => {
      let v = '0';
      if (x.updateTo.xsmType === 'XSM') {
        const i =
          x.updateTo.SwordModules?.findIndex((m) => m === inst.module) ?? -1;
        if (i !== -1 && x.updateTo.SwordVersions)
          v = `2.${x.updateTo.SwordVersions[i] ?? '0'}`;
      } else {
        v = `1.${x.updateTo.Version ?? 0}`;
      }
      return v;
    };
    candidates.sort((a, b) => versionCompare(version(b), version(a)));
    if (candidates.length) moduleUpdates.push(candidates[0]);
  });
  promptAndInstall(xthis, moduleUpdates);
}

const ModuleUpdatePrompted: string[] = [];

function promptAndInstall(xthis: ModuleManager, updatesx: ModuleUpdates[]) {
  // Only initiate prompt/download once per module per window lifetime.
  const updates = updatesx.filter(
    (mud) => !ModuleUpdatePrompted.includes(mud.updateTo.module),
  );
  ModuleUpdatePrompted.push(...updatesx.map((mud) => mud.updateTo.module));
  // Show a toast to ask permission to install each update.
  updates.forEach((mud) => {
    const abbr =
      (mud.updateTo.Abbreviation?.locale || mud.updateTo.module) ?? '?';
    let message: string;
    const { installed: from } = mud;
    const toName = localizeString(G, mud.updateTo.sourceRepository.name);
    if (from) {
      const history =
        mud.updateTo.History?.filter(
          (h) => versionCompare(h[0], from.Version ?? 0) === 1,
        )
          .map((h) => h[1].locale)
          .join('\n') ?? '';
      message = `${abbr} ${mud.updateTo.Version}: ${history} (${toName}, ${mud.updateTo.module})`;
    } else {
      message = `${abbr} ${mud.updateTo.Description?.locale} (${toName}, ${mud.updateTo.module})`;
    }
    xthis.addToast({
      timeout: -1,
      intent: Intent.SUCCESS,
      message,
      action: {
        onClick: () => {
          mud.doInstall = true;
        },
        text: G.i18n.t('yes.label'),
      },
      onDismiss: () =>
        setTimeout(() => {
          if (!mud.doInstall) {
            installModuleUpdates(xthis, [mud], false);
          }
        }, 100),
      icon: 'confirm',
    });
  });
  // Download each update (to be canceled if prompt isn't accepted).
  installModuleUpdates(xthis, updates, true);
}

function installModuleUpdates(
  xthis: ModuleManager,
  moduleUpdates: ModuleUpdates[],
  on: boolean,
) {
  const ons: boolean[] = [];
  const rows: SwordConfType[] = [];
  moduleUpdates.forEach((mud) => {
    const { installed, updateTo } = mud;
    // Turn off local repository module
    if (installed) {
      ons.push(!on);
      rows.push(installed);
    }
    // Turn on external update module
    if (updateTo) {
      ons.push(on);
      rows.push(updateTo);
    }
  });
  modtableUpdate(xthis, ons, rows);
}

function checkForSuggestions(xthis: ModuleManager, state: ManagerState) {
  const { module } = state.tables;
  const suggested = G.Prefs.getComplexValue(
    'moduleManager.suggested',
  ) as typeof S.prefs.moduleManager.suggested;
  const locale = G.i18n.language;
  if (suggested?.[locale]) {
    // Filter from Prefs any suggested mods that are already installed.
    suggested[locale] = suggested[locale].filter(
      (m) =>
        !Object.values(module.data).some(
          (r) => r[ModCol.iModule] === m && r[ModCol.iInstalled] !== OFF,
        ),
    );
    if (locale in suggested && suggested[locale].length) {
      // Build the list of modules to suggest.
      const suggestions: ModuleUpdates[] = [];
      suggested[locale].forEach((m) => {
        const row: TModuleTableRow | null = Object.values(module.data).reduce(
          (p: TModuleTableRow | null, c: TModuleTableRow) => {
            if (c[ModCol.iModule] !== m) return p;
            if (!p) return c;
            return versionCompare(
              c[ModCol.iInfo].conf.Version || 0,
              p[ModCol.iInfo].conf.Version || 0,
            ) === 1
              ? c
              : p;
          },
          null,
        );
        if (row) {
          const { conf } = row[ModCol.iInfo];
          suggestions.push({
            doInstall: false,
            updateTo: conf,
          });
        }
      });
      // Remove modules being suggested from Prefs, so that user only sees
      // a particular suggestion once, ever.
      suggested[locale] = suggested[locale].filter(
        (m) => !suggestions.find((mud) => mud.updateTo.module === m),
      );
      G.Prefs.setComplexValue('moduleManager.suggested', suggested);
      promptAndInstall(xthis, suggestions);
    }
  }
}

export function getModuleRowXsmSiblings(
  xthis: ModuleManager,
  modrepkey: string,
): string[] {
  const state = xthis.state as ManagerState;
  const { module: modTable } = state.tables;
  const { data } = modTable;
  const row = data.find(
    (r) => repositoryModuleKey(r[ModCol.iInfo].conf) === modrepkey,
  );
  if (!row) return [];
  if (row[ModCol.iInfo].conf.xsmType === 'XSM') {
    return data
      .map((r) => {
        return r[ModCol.iInfo].conf.DataPath === row[ModCol.iInfo].conf.DataPath
          ? repositoryModuleKey(r[ModCol.iInfo].conf)
          : null;
      })
      .filter(Boolean) as string[];
  }
  return [modrepkey];
}

export function getModuleDownload(
  xthis: ModuleManager,
  modrepkey: string,
): Download | null {
  const state = xthis.state as ManagerState;
  const { data } = state.tables.module;
  const row = data.find(
    (r) => repositoryModuleKey(r[ModCol.iInfo].conf) === modrepkey,
  );
  if (!row) return null;
  const { xsmType } = row[ModCol.iInfo].conf;
  if (xsmType === 'XSM') {
    return {
      ...row[ModCol.iInfo].repo,
      file: row[ModCol.iInfo].conf.DataPath,
      type: 'ftp',
    };
  }
  if (xsmType === 'XSM_audio') {
    // Remote audio repositories have URL as DataPath.
    if (row[ModCol.iInfo].conf.DataPath.startsWith('http'))
      return {
        http: row[ModCol.iInfo].conf.DataPath,
        confname: row[ModCol.iInfo].conf.filename,
        ...row[ModCol.iInfo].repo,
        type: 'http',
      };
    // Local audio repositories have local path as DataPath.
    return {
      ...row[ModCol.iInfo].repo,
      file: row[ModCol.iInfo].conf.DataPath,
      type: 'ftp',
    };
  }
  return {
    module: row[ModCol.iModule],
    confname: row[ModCol.iInfo].conf.filename,
    ...row[ModCol.iInfo].repo,
    type: 'module',
  };
}

async function promptAudioChapters(
  xthis: ModuleManager,
  conf: SwordConfType,
): Promise<SelectVKType | SelectORMType | null> {
  if (conf.xsmType === 'XSM_audio') {
    const { AudioChapters } = conf;
    if (AudioChapters) {
      let audio: SelectVKType | SelectORMType | null = null;
      audio = await new Promise((resolve) => {
        // Subtract audio files that are already installed.
        const installed = G.AudioConfs[conf.module]?.AudioChapters;
        const dialog: Partial<VersekeyDialog> | Partial<GenBookDialog> = {
          conf,
          callback: (result) => {
            resolve(result);
          },
        };
        if (isAudioVerseKey(AudioChapters)) {
          const d = dialog as VersekeyDialog;
          let ac = clone(AudioChapters) as VerseKeyAudio;
          ac = installed
            ? subtractVerseKeyAudioChapters(ac, installed as VerseKeyAudio)
            : ac;
          const books = Object.entries(ac)
            .filter((e) => e[1].some((v) => v))
            .map((e) => e[0]) as OSISBookType[];
          if (!books.length) {
            resolve(null);
            return;
          }
          d.type = 'versekey';
          d.chapters = ac;
          d.initial = {
            book: books[0],
            chapter: 1,
            lastchapter: 1,
            vkMod: conf.module,
            v11n: 'KJV',
          };
          d.selection = d.initial;
          let ch: number[] | undefined;
          const acbk0 = ac[books[0]];
          if (acbk0) {
            ch = acbk0
              .map((n, i) => (n ? i : undefined))
              .filter(Boolean) as number[];
          }
          d.options = {
            books,
            chapters: ch,
            lastchapters: ch,
            verses: [],
            lastverses: [],
            vkMods: [],
          };
        } else {
          const d = dialog as GenBookDialog;
          let ac = clone(AudioChapters) as GenBookAudioConf;
          ac = installed
            ? subtractGenBookAudioChapters(ac, installed as GenBookAudioConf)
            : ac;
          if (!Object.keys(ac).length) {
            resolve(null);
            return;
          }
          const paths =
            conf.module in G.Tab
              ? gbPaths(G.genBookTreeNodes(conf.module))
              : {};
          d.type = 'genbook';
          const nodes = genBookAudio2TreeNodes(ac, conf.module);
          const firstNode = findFirstLeafNode(nodes, [])?.id.toString();
          d.selection = {
            otherMod: conf.module,
            keys:
              // If only one option is available, select it, so that ok button
              // will be enabled even though no options will be shown.
              firstNode && Object.keys(ac).length === 1 ? [firstNode] : [],
          };
          d.options = {
            nodeLists: [
              {
                otherMod: conf.module,
                label: conf.Description?.locale || conf.module,
                labelClass: 'cs-locale',
                nodes: forEachNode(nodes, (n) => {
                  const path = n.id
                    .toString()
                    .split(C.GBKSEP)
                    .filter(Boolean)
                    .map((s) => Number(s.replace(/^(\d+).*?$/, '$1')));
                  const entry = Object.entries(paths).find(
                    (e) => !diff(e[1], path),
                  );
                  const keys = (entry ? entry[0] : '').split(C.GBKSEP);
                  let label = '';
                  while (keys.length && !label) label = keys.pop() || '';
                  n.label =
                    label || n.label.toString().replace(/^\d+\s(.*?)$/, '$1');
                }),
              },
            ],
          };
        }
        const d = dialog as VersekeyDialog | GenBookDialog;
        const state = cloneAny(xthis.state) as ManagerState;
        const { showAudioDialog } = state;
        showAudioDialog.push(d);
        xthis.setState({ showAudioDialog });
      });
      return audio;
    } else {
      throw new Error(
        `Audio config is missing AudioChapters: '${conf.module}'`,
      );
    }
  }
  return null;
}

function handleError(xthis: ModuleManager, er: any, modrepkeys: string[]) {
  const state = xthis.state as ManagerState;
  const { module: modtable } = state.tables;
  const { data } = modtable;
  log.error(er);
  let message;
  if (typeof er === 'string') message = er;
  if (er && typeof er === 'object' && 'message' in er) {
    ({ message } = er);
  }
  const newintent = message?.startsWith(C.UI.Manager.cancelMsg)
    ? Intent.WARNING
    : Intent.DANGER;
  if (message) {
    xthis.addToast({
      message: er.message,
      timeout: newintent === Intent.WARNING ? 5000 : -1,
      intent: newintent,
    });
  }
  modrepkeys.forEach((k) => {
    const row = data.find(
      (r) => repositoryModuleKey(r[ModCol.iInfo].conf) === k,
    );
    if (row) {
      row[ModCol.iInfo].loading = false;
      row[ModCol.iInfo].intent = intent(ModCol.iInstalled, newintent);
    }
  });
  setTableState(xthis, 'module', null, modtable.data, true);
  return null;
}

// Perform async repository module downloads corresponding to a given
// set of module configs.
export async function download(
  xthis: ModuleManager,
  configs: SwordConfType[],
): Promise<void> {
  const state = xthis.state as ManagerState;
  const { tables } = state;
  const { module: modtable } = tables;

  // Get download objects, prompting user as necessary.
  const dlpromises = configs.map(async (conf) => {
    const modkey = repositoryModuleKey(conf);
    const modkeys = getModuleRowXsmSiblings(xthis, modkey);
    const dlobj = getModuleDownload(xthis, modkey);
    if (dlobj) {
      modkeys.forEach((mk) => {
        const row = modtable.data.find(
          (r) => repositoryModuleKey(r[ModCol.iInfo].conf) === mk,
        );
        if (row) row[ModCol.iInfo].loading = loading(ModCol.iInstalled);
      });
      if ('http' in dlobj && conf.xsmType === 'XSM_audio') {
        return promptAudioChapters(xthis, conf)
          .then((audio) => {
            if (!audio) throw new Error(C.UI.Manager.cancelMsg);
            dlobj.data = audio;
            return dlobj;
          })
          .catch((er) => {
            handleError(xthis, er, [modkey]);
            return null;
          });
      }
      return dlobj;
    }
    return null;
  });
  let dlobjs: Array<Download | null>;
  try {
    dlobjs = await Promise.all(dlpromises);
  } catch (er) {
    log.error(er);
    dlobjs = [];
  }

  // Download using the array of download objects
  const downloads = querablePromise(G.Module.downloads(dlobjs));
  Downloads.push(downloads);
  let dls: Array<Record<string, string | number> | null>;
  try {
    dls = await downloads;
  } catch (er) {
    dls = [];
    dlobjs.forEach((dl) => {
      const k = downloadKey(dl);
      setDownloadProgress(xthis, k, -1);
      dls.push({ [k]: 0 });
    });
  }

  // Now that all downloads are complete, update the module table.
  dls.forEach((dl, i) => {
    if (dl) {
      Object.values(dl).forEach((result) => {
        const modrepkey = repositoryModuleKey(configs[i]);
        const modkeys = getModuleRowXsmSiblings(xthis, modrepkey);
        const modrows = modkeys.map((mk) =>
          modtable.data.find(
            (r) => repositoryModuleKey(r[ModCol.iInfo].conf) === mk,
          ),
        );

        let newintent: Intent = Intent.NONE;
        if (typeof result === 'string') {
          if (result.startsWith(C.UI.Manager.cancelMsg)) {
            newintent = Intent.WARNING;
          } else {
            newintent = Intent.DANGER;
            xthis.addToast({
              message: result,
              timeout: -1,
              intent: newintent,
            });
          }
        } else if (result > 0) {
          newintent = Intent.SUCCESS;
          modrows.forEach((r) => {
            if (r) r[ModCol.iInstalled] = ON;
          });
        } else {
          newintent = Intent.WARNING;
          modrows.forEach((r) => {
            if (r) r[ModCol.iInstalled] = OFF;
          });
        }
        modrows.forEach((r) => {
          if (r) r[ModCol.iInfo].intent = intent(ModCol.iInstalled, newintent);
        });
      });
    }
  });
  setTableState(xthis, 'module', null, modtable.data, true);
}

function modtableUpdate(
  xthis: ModuleManager,
  on: boolean | boolean[],
  configs: SwordConfType[],
  iRemove = false,
) {
  const state = xthis.state as ManagerState;
  const { module: modtable } = state.tables;
  const doDownload: SwordConfType[] = [];
  const cancel: Download[] = [];
  configs.forEach((conf, i) => {
    const row = modtable.data.find(
      (r) =>
        repositoryModuleKey(r[ModCol.iInfo].conf) === repositoryModuleKey(conf),
    );
    if (row) {
      if (Array.isArray(on) ? on[i] : on) {
        row[ModCol.iRemove] = OFF;
        if (row[ModCol.iInfo].loading) {
          // if installing a module that's loading, ignore and do nothing
        } else if (iRemove || isRepoLocal(row[ModCol.iInfo].repo)) {
          // if installing a module is already installed or downloaded, just check the installed box
          row[ModCol.iInstalled] = ON;
          // otherwise download the module
        } else doDownload.push(conf);
      } else if (row[ModCol.iInfo].loading) {
        // if uninstalling a module that is loading, cancel the download
        row[ModCol.iInfo].intent = intent(ModCol.iInstalled, 'warning');
        const dl = getModuleDownload(
          xthis,
          repositoryModuleKey(row[ModCol.iInfo].conf),
        );
        if (dl) cancel.push(dl);
      } else {
        // otherwise uncheck the installed box and check the remove box
        row[ModCol.iRemove] = ON;
        row[ModCol.iInstalled] = OFF;
        row[ModCol.iInfo].intent = intent(ModCol.iInstalled, 'none');
      }
    }
  });
  if (cancel.length)
    G.Module.cancelOngoingDownloads(cancel).catch((er) => {
      log.error(er);
    });
  if (doDownload.length)
    download(xthis, doDownload).catch((er) => {
      log.error(er);
    });
  if (configs.length) setTableState(xthis, 'module', null, modtable.data, true);
}

// Do any or all of the following with minimum setState() calls:
// Update Saved table data for immediate use and for window re-renders.
// Change table state and data state.
// Force re-render of a table.
// Change other ModuleManager state
export function setTableState(
  xthis: ModuleManager,
  table: (typeof Tables)[number],
  tableState?: Partial<
    ManagerState['language' | 'module' | 'repository']
  > | null,
  tableData?:
    | TLanguageTableRow[]
    | TModuleTableRow[]
    | TRepositoryTableRow[]
    | null,
  tableReset?: boolean,
  s?: Partial<ManagerState>,
) {
  const state = xthis.state as ManagerState;
  const news: Partial<ManagerState> = s || {};
  // Ignore new tableState if it is null (meaning table doesn't exist).
  if (tableState && (xthis.state as ManagerState)[table] !== null) {
    news[table] = { ...state[table], ...tableState } as any;
  }
  const mergeWith = 'tables' in news ? news.tables : state.tables;
  if (tableData && mergeWith) {
    news.tables = { ...mergeWith };
    news.tables[table].data = tableData;
  }
  if (Object.keys(news).length) xthis.sState(news);
  // Two setState() calls must be used: first call allows statePrefs to be
  // written to Prefs so afterward the reset will properly load updated values.
  if (tableReset) {
    xthis.sState((prevState) => {
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
  xthis: ModuleManager,
  table: (typeof Tables)[number],
  selection: RowSelection | string[],
): number[] {
  const state = xthis.state as ManagerState;
  const { tables } = state;
  if (table === 'language') {
    return selection
      .map((code) => {
        const { data } = tables[table];
        return data.findIndex((r) => r[LanCol.iInfo].code === code);
      })
      .filter((i) => i !== -1);
  }
  const tablerows = selectionToTableRows(selection as RowSelection);
  return tablerows
    .map((r) => state.tables[table].tableToDataRowMap[r] ?? r)
    .sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
}

// Create a new repository table row from a Repository object.
export function repositoryToRow(repo: Repository): TRepositoryTableRow {
  const on = builtinRepos(G)
    .map((r) => repositoryKey(r))
    .includes(repositoryKey(repo))
    ? ALWAYSON
    : ON;
  return [
    repo.name || '?',
    repo.domain,
    repo.path,
    repo.disabled ? on : OFF,
    { repo },
  ];
}

export function allAudioInstalled(conf: SwordConfType): boolean {
  let allInstalled = false;
  const remoteAudioChapters = conf.AudioChapters;
  const localAudioChapters = G.AudioConfs[conf.module]?.AudioChapters;
  if (
    !remoteAudioChapters ||
    !localAudioChapters ||
    (isAudioVerseKey(remoteAudioChapters) &&
      !Object.keys(
        subtractVerseKeyAudioChapters(
          remoteAudioChapters as VerseKeyAudio,
          localAudioChapters as VerseKeyAudio,
        ),
      ).length) ||
    (!isAudioVerseKey(remoteAudioChapters) &&
      !Object.keys(
        subtractGenBookAudioChapters(
          remoteAudioChapters as GenBookAudioConf,
          localAudioChapters as GenBookAudioConf,
        ),
      ).length)
  ) {
    allInstalled = true;
  }
  return allInstalled;
}

export function scrollToSelectedLanguage(xthis: ModuleManager) {
  const { selection } = (xthis.state as ManagerState).language;
  if (selection.length) {
    const selectedRegions = xthis.languageCodesToTableSelection(selection);
    const [firstSelectedRegion] = selectedRegions;
    if (firstSelectedRegion) {
      const { languageTableCompRef } = xthis;
      const tc = languageTableCompRef.current;
      if (
        tc &&
        typeof tc === 'object' &&
        'scrollToRegion' in tc &&
        typeof tc.scrollToRegion === 'function'
      ) {
        let [firstRow] = firstSelectedRegion.rows;
        if (firstRow > 5) firstRow -= 5;
        tc.scrollToRegion({ rows: [firstRow, firstRow] });
      }
    }
  }
}
