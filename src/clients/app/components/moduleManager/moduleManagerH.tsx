import React from 'react';
import { Intent } from '@blueprintjs/core';
import { Utils } from '@blueprintjs/table';
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
  repositoryModuleKey,
  updateSelectedIndexes,
  gbPaths,
  localizeString,
  findFirstLeafNode,
  isRepoCustom,
} from '../../../../common.ts';
import C from '../../../../constant.ts';
import { G } from '../../../G.ts';
import log from '../../../log.ts';
import { forEachNode } from '../../../components/libxul/treeview.tsx';
import { isRepoBuiltIn } from '../../common.ts';

import type { ReactNode } from 'react';
import type {
  Download,
  Repository,
  RepositoryListing,
  RowSelection,
  SwordConfType,
  VerseKeyAudio,
  GenBookAudioConf,
  OSISBookType,
  RepositoryOperation,
  FTPDownload,
} from '../../../../type.ts';
import type {
  SelectVKType,
  SelectVKProps,
} from '../../../components/libxul/selectVK.tsx';
import type ModuleManager from './moduleManager.tsx';
import type { ManagerProps, ManagerState } from './moduleManager.tsx';
import type {
  NodeListOR,
  SelectORMType,
} from '../../../components/libxul/selectOR.tsx';
import type {
  TableRowSortState,
  TCellInfo,
  TData,
  TDataRow,
} from '../../../components/libxul/table.tsx';

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
  shadowedRows: (TModuleTableRow | undefined)[];
  repo: Repository;
  conf: SwordConfType;
};

export type TLangCellInfo = TCellInfo & {
  code: string;
};

export type TLanguageTableRow = [string, TLangCellInfo];

type TModuleTableRowCheckboxFunc = (
  dri: number,
  dci: number,
  data: TModuleTableRow[],
) => typeof ON | typeof OFF;

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
  typeof ON | typeof OFF | TModuleTableRowCheckboxFunc,
  typeof ON | typeof OFF | TModuleTableRowCheckboxFunc,
  typeof ON | typeof OFF | TModuleTableRowCheckboxFunc,
  TModCellInfo,
];

export type TRepositoryTableRow = [
  string,
  string,
  string,
  typeof ON | typeof OFF | typeof ALWAYSON,
  TRepCellInfo,
];

export type DownloadRecordType = Record<string, number | string> | null;

export type ModuleUpdatesType = {
  permissionGiven: boolean | null;
  remove?: SwordConfType;
  conf: SwordConfType;
};

export const Tables = ['language', 'module', 'repository'] as const;

export const Permission = { internet: false };

export const DefaultCustomRepo: Repository = {
  name: '?',
  domain: C.Downloader.localfile,
  path: '?',
};

export const DefaultCustomRepoKey = repositoryKey(DefaultCustomRepo);

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

export const Downloads = {
  promises: [] as Array<Promise<Array<DownloadRecordType>>>,
  dl2mrkeyMap: {} as { [dlkey: string]: string },
  finished: [] as string[],
  cancelled: [] as string[],
};

export const Progressing = {
  ids: [] as Array<[string, number]>, // [id, percent]
};

// The following functions return custom callbacks meant to be sent
// to tables for applying values, settings, classes etc. to particular
// table cells.
export function loading(columnToShowLoading: number) {
  return (_ri: number, ci: number) => {
    return ci === columnToShowLoading;
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

export function repclasses(
  columnIndexArray: number[],
  theClasses: string[],
  wholeRowClasses?: string[],
) {
  return (_dri: number, dci: number) => {
    const cs = wholeRowClasses?.slice() || [];
    if (columnIndexArray.includes(dci))
      theClasses.forEach((c) => {
        if (!cs.includes(c)) cs.push(c);
      });
    return cs;
  };
}

export function tooltip(atooltip: string, skipColumnIndexArray: number[]) {
  return (_ri: number, ci: number) => {
    return skipColumnIndexArray.includes(ci) ? undefined : atooltip;
  };
}

export function modclasses() {
  return (dri: number, dci: number, datax: TData) => {
    const data = datax as TModuleTableRow[];
    const drow = data[dri];
    const classes: string[] = [];
    if (
      (
        [ModCol.iShared, ModCol.iInstalled, ModCol.iRemove] as number[]
      ).includes(dci)
    ) {
      classes.push('checkbox-column');
    }
    const iInstalled = readModCheckbox(dri, ModCol.iInstalled, data);
    if (dci === ModCol.iInstalled && iInstalled === ON) {
      classes.push('disabled');
    } else if (
      dci === ModCol.iShared &&
      (drow[ModCol.iInfo].conf.xsmType === 'XSM_audio' || iInstalled === OFF)
    ) {
      classes.push('disabled');
    }
    return classes;
  };
}

// This modtable cell function that should be used as the initial checkbox value
// function for remote repositories. If the row is shadowing another row, the
// shadowed row's value is returned. If the row is shadowing multiple rows
// (which happens with XSM modules) then ON will be returned only if all
// shadowed rows are ON, otherwise OFF is returned. Once a checkbox is clicked,
// this function should be replaced by a string value. In this way, user
// interactions are recorded and kept throughout the life of the window.
export function modCheckbox(
  dri: number,
  dci: number,
  data: TModuleTableRow[],
): typeof ON | typeof OFF {
  const { shadowedRows } = data[dri][ModCol.iInfo];
  if (!shadowedRows.length) return OFF;
  return shadowedRows
    .filter(Boolean)
    .every((r) => (r as TModuleTableRow)[dci] === ON)
    ? ON
    : OFF;
}

// Read the value of any modtable checkbox. This works for all modtable checkbox
// cells (locale or remote, changed or not) because it handles function and
// string cell values. Returns null if the cell is not a checkbox.
export function readModCheckbox(
  dri: number,
  dci: number,
  data: TModuleTableRow[],
): typeof ON | typeof OFF | null {
  if (![ModCol.iShared, ModCol.iInstalled, ModCol.iRemove].includes(dci as any))
    return null;
  if (dri !== -1) {
    const v = data[dri][dci];
    if (typeof v === 'function') return v(dri, dci, data);
    if (typeof v === 'string') return v as typeof ON | typeof OFF;
  }
  return OFF;
}

// Read the string value of a TModuleTableRow checkbox, preferring any
// differing shadowing row's string value over the row's own string value.
// If no string value can be found, OFF is returned.
export function readModCheckboxShadowing(
  drow: TModuleTableRow,
  dci: number,
): typeof ON | typeof OFF {
  const shadowing = Object.values(tableRows.module).filter((r) =>
    r[ModCol.iInfo].shadowedRows.includes(drow),
  );
  const v1 = drow[dci];
  const v2 = shadowing.reduce((p, c) => {
    const shadowv = c[dci];
    return typeof shadowv === 'string' && shadowv !== v1 ? shadowv : p;
  }, v1);
  return typeof v2 === 'string' ? (v2 as typeof ON | typeof OFF) : OFF;
}

// Get built in repos, xulsword repos and custom repos, which are usually local
// but customs can also be remote. Only CrossWire list repos are not returned.
export function getXulswordRepos(state: ManagerState): Repository[] {
  const { repositories } = state;
  const builtIns = clone(G.BuiltInRepos);

  if (repositories) {
    const { xulsword, custom } = repositories;
    return builtIns.concat(xulsword, custom);
  }

  return builtIns;
}

// Progress for any dlkey is ignored after -1 is received, until another 0
// is received to reset dlkey progress. This is to allow the possibility of
// extraneous progress being reported by dangling operations after abort.
const RequireZero: { [dlkey: string]: boolean } = {};
export function updateDownloadProgress(
  state: ManagerState,
  dlkey: string,
  prog: number,
) {
  if (!RequireZero[dlkey] || prog === 0) {
    RequireZero[dlkey] = prog === -1;
    let { ids } = Progressing;
    const idi = ids.findIndex((d) => d[0] === dlkey);
    if (idi === -1) ids.push([dlkey, prog]);
    else ids[idi][1] = prog;
    if (ids.every((d) => d[1] === -1)) ids = [];
    Progressing.ids = ids;
    const total = ids.reduce((p, c) => p + (c[1] === -1 ? 1 : c[1]), 0);
    if (!ids.length || total === ids.length) state.progress = null;
    else state.progress = [total, ids.length];
  }
}

export function onRowsReordered(
  this: ModuleManager,
  tableName: (typeof Tables)[number],
  direction: 'ascending' | 'descending',
  dataColIndex: number,
) {
  const state = this.state as ManagerState;
  const { columns } = state[tableName];
  const rowSort: TableRowSortState = {
    direction,
    propColumnIndex: columns.findIndex((tc) => tc.datacolumn === dataColIndex),
  };
  state[tableName].rowSort = rowSort;
  tableUpdate(state, tableName, 'rowmap');
  this.sState(state);
}

export function onLangCellClick(
  this: ModuleManager,
  dataRowIndex: number,
  _dataColIndex: number,
  e: React.MouseEvent,
) {
  const state = this.state as ManagerState;
  const newstate = state as ManagerState;
  rowSelect(newstate, e, 'language', dataRowIndex);
  this.loadModuleTable(newstate);
  tableUpdate(newstate, ['language', 'module'], 'rowmap');
  this.sState(newstate);
}

export function onModCellClick(
  this: ModuleManager,
  dataRowIndex: number,
  dataColIndex: number,
  e: React.MouseEvent,
) {
  const disabled = ofClass(['disabled'], e.target);
  if (!disabled) {
    const newstate = this.state as ManagerState;
    const { module, tables } = newstate;
    const { module: modtable } = tables;
    const { data } = modtable;
    const { selection } = module;
    let datarows = selectionToDataRows(newstate, 'module', selection);
    if (datarows.indexOf(dataRowIndex) === -1) datarows = [dataRowIndex];
    const drow = modtable.data[dataRowIndex];
    if (drow) {
      const checkbox = readModCheckbox(dataRowIndex, dataColIndex, data);
      if (checkbox !== null && !drow[ModCol.iInfo].loading) {
        if (dataColIndex === ModCol.iShared) {
          let updated = false;
          datarows.forEach((dri) => {
            const r = modtable.data[dri];
            if (r && readModCheckbox(dri, ModCol.iInstalled, data) === ON) {
              r[ModCol.iShared] = checkbox === OFF ? ON : OFF;
              updated = true;
            }
          });
          if (updated) {
            tableUpdate(newstate, 'module');
            return this.sState(newstate);
          }
        } else {
          const updateColumn =
            dataColIndex === ModCol.iInstalled
              ? updateModuleInstallColumn
              : updateModuleRemoveColumn;
          const updated = updateColumn(
            this,
            newstate,
            checkbox === OFF,
            datarows.map((dri) => modtable.data[dri][ModCol.iInfo].conf),
          );
          if (updated) return this.sState(newstate);
        }
      }

      rowSelect(newstate, e, 'module', dataRowIndex);
      this.sState(newstate);
    }
  }
}

export function onRepoCellClick(
  this: ModuleManager,
  dataRowIndex: number,
  dataColIndex: number,
  e: React.MouseEvent,
) {
  const state = this.state as ManagerState;
  const newstate = state;
  const { repository } = newstate;
  const { repository: repotable } = newstate.tables;
  if (repository) {
    const { selection } = repository;
    const checkbox = repotable.data[dataRowIndex][RepCol.iState] === ON;
    let selectedDataRows = selectionToDataRows(
      newstate,
      'repository',
      selection,
    );
    if (selectedDataRows.indexOf(dataRowIndex) === -1)
      selectedDataRows = [dataRowIndex];
    if (
      dataColIndex === RepCol.iState &&
      !isRepoBuiltIn(repotable.data[dataRowIndex][RepCol.iInfo].repo)
    ) {
      switchRepo(this, newstate, selectedDataRows, !checkbox);
    } else {
      rowSelect(newstate, e, 'repository', dataRowIndex);
      tableUpdate(newstate, 'repository');
      this.sState(newstate);
    }
  }
}

export function onCustomRepositoryCellEdited(
  this: ModuleManager,
  dataRowIndex: number,
  dataColIndex: number,
  value: string,
) {
  const newstate = this.state as ManagerState;
  const { repositories, repository } = newstate;
  if (repositories && repository) {
    const { disabled } = repositories;
    const { repository: repotable } = newstate.tables;
    const drow = repotable.data[dataRowIndex];
    if (drow) {
      const repo = clone(drow[RepCol.iInfo].repo);
      const origRepoKey = repositoryKey(repo);
      const enabled = !disabled || !disabled.find((k) => k === origRepoKey);
      let prop: keyof Repository = 'domain';
      if (dataColIndex === RepCol.iName) prop = 'name';
      if (dataColIndex === RepCol.iPath) prop = 'path';
      repo[prop] = value;
      if (!repo.domain) repo.domain = DefaultCustomRepo.domain;
      if (!repo.name) repo.name = DefaultCustomRepo.name;
      if (!repo.path) repo.path = DefaultCustomRepo.path;
      if (
        installCustomRepository(this, newstate, dataRowIndex, repo, enabled)
      ) {
        switchRepo(this, newstate, [dataRowIndex], enabled);
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
        switch (id) {
          case 'languageListClose':
          case 'languageListOpen': {
            const newstate = this.state as ManagerState;
            const open = id === 'languageListOpen';
            newstate.language.open = open;
            const selections = retainSelectedValues(newstate, null, [
              'language',
              'module',
            ]);
            filterModuleTable(newstate);
            retainSelectedValues(newstate, selections);
            tableUpdate(newstate, ['language', 'module'], 'rowmap');
            this.sState(newstate);
            scrollToSelection(this, newstate, 'language');
            break;
          }
          case 'moduleInfo': {
            const div = document.getElementById('moduleInfo');
            if (div) {
              const state = this.state as ManagerState;
              const { module } = state;
              const { module: modtable, repository: repotable } = state.tables;
              const { repositoryListings } = repotable;
              const { selection } = module;
              const dataIndexes = selectionToDataRows(
                state,
                'module',
                selection,
              );
              const infoConfigs: SwordConfType[] = [];
              dataIndexes.forEach((di) => {
                const { conf } = modtable.data[di][ModCol.iInfo];
                infoConfigs.push(conf);
                // If this is an XSM module and the IBT repo is loaded, show
                // conf files for each XSM member.
                const IBTrepo = repotable.data.findIndex(
                  (r) => r[RepCol.iInfo].repo.name === 'IBT',
                );
                const IBTlisting =
                  IBTrepo in repositoryListings && repositoryListings[IBTrepo];
                const { SwordModules, SwordVersions } = conf;
                if (
                  conf.xsmType === 'XSM' &&
                  SwordModules &&
                  SwordVersions &&
                  IBTlisting
                ) {
                  const confs = SwordModules.map((m, i) => {
                    const c = IBTlisting.find((rc) => {
                      return (
                        rc.xsmType === 'none' &&
                        rc.module === m &&
                        rc.Version === SwordVersions[i]
                      );
                    });
                    return c ?? null;
                  });
                  const cs = (
                    !confs.some((c) => !c) ? confs : [conf]
                  ) as SwordConfType[];
                  infoConfigs.splice(-1, 1, ...cs);
                }
              });
              this.sState({ infoConfigs });
            }
            break;
          }
          case 'moduleInfoBack': {
            const newstate = this.state as ManagerState;
            tableUpdate(newstate, ['module']);
            this.setState({ infoConfigs: [] });
            break;
          }
          case 'cancel': {
            closeWindow(this.state as ManagerState);
            break;
          }
          case 'ok': {
            const errors: string[] = [];
            let operations: RepositoryOperation[] = [];
            const state = this.state as ManagerState;
            try {
              operations = getLocalModuleOperations(
                state,
                (await Promise.allSettled(Downloads.promises))
                  .map((dlr) => {
                    if (dlr.status === 'fulfilled' && dlr.value) {
                      return dlr.value
                        .map((v) => {
                          return v
                            ? Object.entries(v).map((entry) => {
                                const [downloadkey, result] = entry;
                                return typeof result === 'number' &&
                                  result > 0 &&
                                  !Downloads.cancelled.includes(downloadkey)
                                  ? downloadkey
                                  : '';
                              })
                            : [];
                        })
                        .flat();
                    }
                    return [];
                  })
                  .flat()
                  .filter(Boolean),
              );
            } catch (er) {
              log.error(er);
              errors.push(`Operation(s) failed: ${er}`);
            }

            G.Window.modal([{ modal: 'transparent', window: 'all' }]);
            G.publishSubscription(
              'setControllerState',
              {
                renderers: { type: 'xulswordWin' },
              },
              { progress: 'indefinite' },
            );

            (['remove', 'copy', 'move', 'install'] as const).forEach((type) => {
              const ops = operations.filter((op) => op.operation === type);
              if (type === 'install') {
                // Run Module.installDownloads even if install.length is zero, so
                // that LibSword will be re-initialized with any custom repository
                // changes.
                G.Module.installDownloads(
                  ops.map((op) => {
                    const { module, destRepository: toRepo } = op;
                    return { download: module as Download, toRepo };
                  }),
                  G.Window.descriptions({ type: 'xulswordWin' })[0]?.id,
                ).catch((er) => {
                  // Module installation errors are reported separately. This only
                  // catches uncaught installDownloads() errors.
                  log.error(er);
                  errors.push(`An error occured installing modules.`);
                });
              } else if (ops.length) {
                G.Module[type](ops).forEach((res, i) => {
                  if (!res)
                    errors.push(
                      `Failed to ${type} ${ops[i].module} ${
                        type === 'remove' ? 'from' : 'to'
                      } ${ops[i].destRepository.path}`,
                    );
                });
              }
            });

            cancelDownloads(state, 'all').catch((er) => log.error(er));
            G.Window.modal([{ modal: 'off', window: 'all' }]);
            G.publishSubscription(
              'setControllerState',
              {
                renderers: { type: 'xulswordWin' },
              },
              { progress: -1 },
            );

            if (errors.length) {
              this.addToast({
                timeout: -1,
                intent: Intent.DANGER,
                message: errors.slice(0, 10).join('\n'),
                icon: 'error',
              }).catch((er) => log.error(er));
            } else closeWindow(state);
            break;
          }
          case 'repoAdd': {
            const newstate = this.state as ManagerState;
            if (
              installCustomRepository(
                this,
                newstate,
                -1,
                clone(DefaultCustomRepo),
                false,
              )
            ) {
              switchRepo(this, newstate, [0], false);
            }
            break;
          }
          case 'repoDelete': {
            const newstate = this.state as ManagerState;
            const { repositories, repository } = newstate;
            if (repositories && repository) {
              const { selection } = repository;
              // Only delete one repo and not an entire selection of them. It
              // would also be more difficult to bail on error (without changes).
              const drows =
                (repository &&
                  selectionToDataRows(newstate, 'repository', selection)) ||
                [];
              if (
                drows.length &&
                uninstallRepository(this, newstate, drows[0])
              ) {
                this.loadLanguageTable(newstate);
                this.loadModuleTable(newstate);
                tableUpdate(newstate, undefined, 'rowmap');
                this.sState(newstate);
              }
            }
            break;
          }
          case 'repoCancel': {
            const newstate = this.state as ManagerState;
            const { repository: repotable } = newstate.tables;
            const cancelListings: Download[] = repotable.data
              .filter(
                (r) =>
                  r[RepCol.iInfo].loading !== false && r[RepCol.iState] !== OFF,
              )
              .map((r) => {
                return listDownload(r[RepCol.iInfo].repo);
              });
            cancelDownloads(newstate, cancelListings).catch((er) =>
              log.error(er),
            );
            this.addToast({
              message: C.UI.Manager.cancelMsg,
              timeout: 5000,
              intent: Intent.SUCCESS,
            }).catch((er) => log.error(er));
            tableUpdate(newstate, 'repository');
            this.sState(newstate);
            break;
          }
          case 'moduleCancel': {
            const state = this.state as ManagerState;
            cancelDownloads(state, 'ongoing').catch((er) => log.error(er));
            this.addToast({
              message: C.UI.Manager.cancelMsg,
              timeout: 5000,
              intent: Intent.SUCCESS,
            }).catch((er) => log.error(er));
            this.sState({ progress: null });
            break;
          }
          case 'internet': {
            const internetPermission = idext === 'yes';
            const cb = document.getElementById(
              'internet.rememberChoice__input',
            ) as HTMLInputElement | null;
            if (cb && cb.checked) {
              G.Prefs.setBoolPref(
                'global.InternetPermission',
                internetPermission,
              );
            }
            Permission.internet = internetPermission;
            if (internetPermission)
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

function closeWindow(state: ManagerState) {
  const { selection } = state.language;
  const { data } = state.tables.language;
  G.Prefs.setComplexValue(
    'moduleManager.initialLanguages',
    selectionToDataRows(state, 'language', selection).map(
      (dri) => data[dri][LanCol.iInfo].code,
    ),
  );
  // Indexer was stopped when this window opened, so restart it.
  G.LibSword.startBackgroundSearchIndexer(
    C.UI.Search.backgroundIndexerStartupWait,
  )
    .then(() => G.Window.close())
    .catch((er) => log.error(er));
}

// Install a new custom repository (if repoDataIndex is -1) or update the
// custom repository at repoDataIndex. Returns true on success or false on
// failure (with no changes). This fails if a custom repo with this key
// already exists, or if the repo at the given index is not a custom repo
// (the only type that is installable).
export function installCustomRepository(
  xthis: ModuleManager,
  state: ManagerState,
  dataRowIndex: number,
  repo: Repository,
  enabled: boolean,
): boolean {
  const { tables, repositories } = state;
  const { repository: repotable } = tables;
  const { data } = repotable;
  const repokey = repositoryKey(repo);
  if (
    repositories &&
    !data.find((r) => repositoryKey(r[RepCol.iInfo].repo) === repokey)
  ) {
    const { custom } = repositories;
    const row = repositoryToRow(state, repo, true);
    let newindex = dataRowIndex;
    if (newindex === -1) newindex++;
    else if (isRepoCustom(custom, data[newindex][RepCol.iInfo].repo)) {
      if (!uninstallRepository(xthis, state, newindex)) return false;
    } else return false;
    // Install the new repotable row.
    repotable.data.splice(newindex, 0, row);
    repotable.repositoryListings.splice(newindex, 0, null);
    repositories.custom.push(repo);
    if (!enabled) {
      if (!repositories.disabled) repositories.disabled = [];
      repositories.disabled.push(repositoryKey(repo));
    }
    tableUpdate(state, undefined, 'rowmap');
    return true;
  }
  return false;
}

// Cleanse a repository from repotable.data, repositoryListings, custom and
// disabled. Returns true on success or false if the repository does not
// exist, or could not be uninstalled.
export function uninstallRepository(
  xthis: ModuleManager,
  state: ManagerState,
  repoOrRepkeyOrDataindex: Repository | string | number,
): boolean {
  const { tables, repositories } = state;
  if (repositories) {
    const { repository: repotable } = tables;
    const { data, repositoryListings } = repotable;
    const { custom } = repositories;
    let repkey = '';
    if (typeof repoOrRepkeyOrDataindex === 'number')
      repkey = repositoryKey(data[repoOrRepkeyOrDataindex][RepCol.iInfo].repo);
    else if (typeof repoOrRepkeyOrDataindex === 'object')
      repkey = repositoryKey(repoOrRepkeyOrDataindex);
    else repkey = repoOrRepkeyOrDataindex;
    const index = data.findIndex(
      (r) => repositoryKey(r[RepCol.iInfo].repo) === repkey,
    );
    if (index > -1 && isRepoCustom(custom, data[index][RepCol.iInfo].repo)) {
      switchRepo(xthis, state, [index], false);
      data.splice(index, 1);
      repositoryListings.splice(index, 1);
      (['custom', 'disabled'] as Array<keyof typeof repositories>).forEach(
        (type) => {
          if (repositories[type]) {
            const i = repositories[type].findIndex(
              (r) => (typeof r === 'object' ? repositoryKey(r) : r) === repkey,
            );
            if (i !== -1) repositories[type].splice(i, 1);
          }
        },
      );
      tableUpdate(state, undefined, 'rowmap');
      return true;
    }
  }
  return false;
}

// Incorporate a row into, or remove a row from, a table's current selection.
export function rowSelect(
  state: ManagerState,
  e: React.MouseEvent,
  tableName: 'repository' | 'module' | 'language',
  dataRowIndex: number,
) {
  const table = state[tableName];
  if (table) {
    const { tableToDataRowMap } = state.tables[tableName];
    const { selection } = table;
    let tableRowIndex = tableToDataRowMap.indexOf(dataRowIndex);
    if (tableRowIndex === -1) tableRowIndex = dataRowIndex;
    table.selection = tableRowsToSelection(
      updateSelectedIndexes(tableRowIndex, selectionToTableRows(selection), e),
    );
  }
}

// Filter modules according to language selection.
export function filterModuleTable(state: ManagerState) {
  const { language } = state;
  const { selection, open } = language;
  const { module: modtable, language: langtable } = state.tables;
  const { data: langdata } = langtable;
  const { modules } = modtable;
  const codes = selectionToDataRows(state, 'language', selection).map(
    (dri) => langdata[dri][LanCol.iInfo].code,
  );
  modtable.data = modules ? modules.allmodules : [];
  if (modules && open && codes.length) {
    modtable.data = Object.entries(modules)
      .filter((ent) => codes.includes(ent[0]))
      .map((ent) => ent[1])
      .flat();
  }
  tableUpdate(state, 'module', 'rowmap');
}

function repoRowEnableDisable(
  state: ManagerState,
  dataRowIndex: number,
  enable: boolean,
) {
  const { repositories } = state;
  const { data } = state.tables.repository;
  const { disabled } = repositories ?? {};
  const drow = data[dataRowIndex];
  const rowkey = repositoryKey(drow[RepCol.iInfo].repo);
  let di = -1;
  if (disabled) di = disabled.findIndex((k) => k === rowkey);
  if (enable) {
    if (disabled && di !== -1) disabled.splice(di, 1);
    drow[RepCol.iState] = isRepoBuiltIn(drow[RepCol.iInfo].repo)
      ? ALWAYSON
      : ON;
  } else {
    if (di === -1) {
      if (disabled) disabled.push(rowkey);
      else if (repositories) repositories.disabled = [rowkey];
    }
    drow[RepCol.iState] = OFF;
  }
}

// This function updates state and sets it.
// Enable or disable one or more repositories. Then reload all tables.
export function switchRepo(
  xthis: ModuleManager,
  statex: ManagerState,
  datarows: number[],
  onOrOff: boolean,
  checkForUpdates = false,
) {
  const rowEnableDisable = (newstate: ManagerState) => {
    const { repositories } = newstate;
    if (repositories) {
      const { repository: repotable } = newstate.tables;
      const { data } = repotable;
      datarows.forEach((r) => {
        if (!isRepoBuiltIn(data[r][RepCol.iInfo].repo)) {
          if (data[r][RepCol.iInfo].loading) {
            // do nothing
          } else {
            repoRowEnableDisable(newstate, r, onOrOff);
          }
        }
      });
      tableUpdate(newstate, 'repository', 'rowmap');
    }
    return newstate;
  };

  const updateTables = () => {
    const state = xthis.state as ManagerState;
    const { tables } = state;
    const { repository } = tables;
    const switchRepos: Array<Repository | null> = repository.data.map(
      (r, i) => {
        const { repo } = r[RepCol.iInfo];
        return datarows.includes(i) ? repo : null;
      },
    );

    readReposAndUpdateTables(xthis, state, switchRepos, checkForUpdates).catch(
      (er) => log.error(er),
    );
  };

  xthis.sState(rowEnableDisable(statex), updateTables);
}

// This function updates state and sets state.
// Calling repositoryListing on all repos at once means it will not return
// until all repositories have been read, and some repos take a very long time
// to respond. So instead, read each repository separately, in parallel, when
// server requests are required.
export async function readReposAndUpdateTables(
  xthis: ModuleManager,
  state: ManagerState,
  repos: (Repository | null)[],
  checkForUpdates = false,
): Promise<void> {
  const updateTables = (newstate: ManagerState) => {
    xthis.loadLanguageTable(newstate);
    xthis.loadModuleTable(newstate);
    // If there is a moduleManager initialLanguages selection, apply it now.
    const { id } = xthis.props as ManagerProps;
    const { selection } = state.language;
    const { data, tableToDataRowMap } = state.tables.language;
    if (id === 'moduleManager') {
      const initialLanguages = G.Prefs.getPrefOrCreate(
        'moduleManager.initialLanguages',
        'complex',
        [],
      ) as string[];
      const selectDRIs = initialLanguages
        .map((code) => data.findIndex((dr) => dr[LanCol.iInfo].code === code))
        .filter((dri) => dri !== -1);
      const selectTRIs = selectDRIs.map((dri) => {
        const tri = tableToDataRowMap.indexOf(dri);
        return tri === -1 ? dri : tri;
      });
      const selectLangs = selectDRIs.map((dri) => data[dri][LanCol.iInfo].code);
      // Subtract new selections from the saved initialLanguages Pref value (it
      // will be written again when the manager component unmounts).
      G.Prefs.setComplexValue(
        'moduleManager.initialLanguages',
        initialLanguages.filter((code) => !selectLangs.includes(code)),
      );
      state.language.selection = tableRowsToSelection(
        selectionToTableRows(selection).concat(...selectTRIs),
      );
    }
    tableUpdate(newstate, ['module', 'language'], 'rowmap');
    xthis.sState(newstate);
  };

  const { data, repositoryListings } = state.tables.repository;
  const { disabled } = state.repositories ?? {};
  // Only request listings from the server when necessary. If the
  // listing has already been retrieved it will not be retrieved
  // again, rather the original listing will be used.
  const needServerRequest = repos.some(
    (r, i) =>
      r &&
      (!disabled || !disabled.find((k) => k === repositoryKey(r))) &&
      !repositoryListings[i],
  );
  let newstate: ManagerState;
  if (needServerRequest) {
    const readrepos = repos.map((repo, index) => {
      return async () => {
        if (repo) {
          let list: Array<RepositoryListing | string> = [null];
          if (!disabled || !disabled.find((k) => k === repositoryKey(repo))) {
            try {
              data[index][RepCol.iInfo].loading = loading(RepCol.iState);
              list = await G.Module.repositoryListing([listDownload(repo)]);
              if (list[0]) data[index][RepCol.iName] += ` (${list[0].length})`;
            } catch (er) {
              list = [`${er}`];
            }
          }
          data[index][RepCol.iInfo].loading = false;
          handleListings(
            xthis,
            state,
            repos.map((_l, i) => (i === index ? list[0] : null)),
          );
          updateTables(state);
        }

        return true;
      };
    });
    await Promise.allSettled(readrepos.map((f) => f())).catch((er) =>
      log.error(er),
    );
    newstate = xthis.state as ManagerState;
  } else {
    handleListings(
      xthis,
      state,
      repos.map((_r, i) => repositoryListings[i]),
    );
    updateTables(state);
    newstate = state;
  }
  // Wait until all repos are loaded before checking for updates or suggestions
  // otherwise wrong or missed choices may occur depending on which the order the
  // repos finish loading.
  if (checkForUpdates) {
    checkForModuleUpdates(xthis, newstate);
    checkForSuggestions(xthis, newstate);
    tableUpdate(newstate, ['module', 'language'], 'rowmap');
    xthis.sState(newstate);
  }
}

export function listDownload(repo: Repository): FTPDownload {
  return { ...repo, file: C.SwordRepoManifest, type: 'ftp' };
}

// Handle one or more raw repository listings, also handling any errors
// or cancelations.
export function handleListings(
  xthis: ModuleManager,
  state: ManagerState,
  listingsAndErrors: Array<RepositoryListing | string>,
): void {
  let { repositories } = state;
  const { repository, module: modtable } = state.tables;
  const { data, repositoryListings } = repository;

  // repositoryListings must be same length as data.
  if (!repositoryListings.length)
    data.forEach(() => repositoryListings.push(null));

  if (!repositories)
    repositories = { disabled: null, xulsword: [], custom: [] };
  const { disabled } = repositories;
  listingsAndErrors.forEach((l, i) => {
    const drow = repository.data[i];
    if (drow) {
      const { repo } = drow[RepCol.iInfo];
      drow[RepCol.iInfo].intent = intent(
        RepCol.iState,
        disabled?.includes(repositoryKey(repo)) ? Intent.NONE : Intent.SUCCESS,
      );
      if (typeof l === 'string') {
        repositoryListings[i] = null;
        if (!l.startsWith(C.UI.Manager.cancelMsg)) {
          xthis
            .addToast({
              message: l,
              timeout: -1,
              intent: Intent.DANGER,
            })
            .catch((er) => log.error(er));
        }
        repoRowEnableDisable(state, i, false);
        drow[RepCol.iInfo].intent = intent(
          RepCol.iState,
          l.startsWith(C.UI.Manager.cancelMsg) ? Intent.NONE : Intent.DANGER,
        );
      } else if (l !== null) {
        repositoryListings[i] = l;
      }
    }
  });

  modtable.modules = null;
  tableUpdate(state, 'repository');
}

// This function updates state, but does NOT set it.
// Check enabled repository listings (except beta and attic) for newer versions
// of builtin repository modules, or replacements for obsoleted ones. Begin
// downloading the updates, but ask whether to replace each installed module
// with the update before doing so. This function should be called after
// updateRepositoryLists().
export function checkForModuleUpdates(
  xthis: ModuleManager,
  state: ManagerState,
) {
  const { module } = state.tables;
  const updateable: SwordConfType[] = Object.values(G.ModuleConfs).filter(
    (c) => isRepoBuiltIn(c.sourceRepository) && c.xsmType !== 'XSM_audio',
  );

  // Search all module table data for candidate updates.
  const moduleUpdates: ModuleUpdatesType[] = [];
  updateable.forEach((inst) => {
    const candidates: ModuleUpdatesType[] = [];
    module.data.forEach((row) => {
      const { conf } = row[ModCol.iInfo];
      if (
        !isRepoLocal(conf.sourceRepository) &&
        !['CrossWire Attic', 'CrossWire Beta'].includes(
          conf.sourceRepository.name,
        ) &&
        conf.xsmType !== 'XSM_audio' &&
        // inst is to be obsoleted
        (conf.Obsoletes?.includes(inst.module) ||
          // inst is to be replaced by a newer version
          (conf.xsmType !== 'XSM' &&
            conf.module === inst.module &&
            versionCompare(conf.Version ?? 0, inst.Version ?? 0) === 1) ||
          // module is to be replaced by an XSM module containing a newer
          // version, as long as we don't downgrade any installed modules
          (conf.xsmType === 'XSM' &&
            conf.SwordModules?.some(
              (swm, i) =>
                inst.module === swm &&
                versionCompare(
                  conf.SwordVersions?.[i] ?? 0,
                  inst.Version ?? 0,
                ) === 1,
            ) &&
            !conf.SwordModules?.some(
              (swm, i) =>
                versionCompare(
                  updateable.find((im) => im.module === swm)?.Version ?? 0,
                  conf.SwordVersions?.[i] ?? 0,
                ) === 1,
            )))
      ) {
        candidates.push({
          remove: inst,
          conf: conf,
          permissionGiven: null,
        });
      }
    });
    // Choose the first candidate with the highest version number, XSM modules first.
    const version = (x: ModuleUpdatesType): string => {
      let v = '0';
      if (x.conf.xsmType === 'XSM') {
        const i =
          x.conf.SwordModules?.findIndex((m) => m === inst.module) ?? -1;
        if (i !== -1 && x.conf.SwordVersions)
          v = `2.${x.conf.SwordVersions[i] ?? '0'}`;
      } else {
        v = `1.${x.conf.Version ?? 0}`;
      }
      return v;
    };
    candidates.sort((a, b) => versionCompare(version(b), version(a)));
    if (candidates.length) moduleUpdates.push(candidates[0]);
  });

  promptAndInstall(xthis, state, moduleUpdates);
}

// This function updates state but does NOT set it.
export function checkForSuggestions(xthis: ModuleManager, state: ManagerState) {
  if ('suggested' in state) {
    const { repositoryListings } = state.tables.repository;
    const { suggested } = state;
    const locale = G.i18n.language;
    const nextSuggested = new Set(suggested?.[locale]);
    if (nextSuggested.size) {
      // Get a list of suggested modules (choosing the latest version found
      // in any currently loaded qualifying repository).
      let suggestions: ModuleUpdatesType[] = [];
      nextSuggested.forEach((m) => {
        let conf: SwordConfType | null = null;
        repositoryListings.forEach((l: RepositoryListing) => {
          const rc = l?.find((r) => r.module === m);
          if (
            rc &&
            !isRepoBuiltIn(rc.sourceRepository) &&
            (!conf || versionCompare(rc.Version || 0, conf.Version || 0) === 1)
          )
            conf = rc;
        });
        if (conf) {
          suggestions.push({
            permissionGiven: null,
            conf: conf,
          });
        }
      });

      // Each module should only be requested once.
      if (suggested && suggestions.length) {
        const nextLocalePref = suggested[locale].filter(
          (m) => !suggestions.find((mud) => mud.conf.module === m),
        );
        if (diff(suggested[locale], nextLocalePref) && state.suggested) {
          if (!nextLocalePref.length) delete state.suggested[locale];
          else state.suggested[locale] = nextLocalePref;

          // Filter out if it's already installed into a builtin repo.
          suggestions = suggestions.filter(
            (mud) =>
              !repositoryListings.find(
                (l) =>
                  l &&
                  l[0] &&
                  isRepoBuiltIn(l[0].sourceRepository) &&
                  !!l.find(
                    (c) =>
                      c.module === mud.conf.module &&
                      versionCompare(c.Version || 0, mud.conf.Version || 0) >=
                        0,
                  ),
              ),
          );
          if (suggestions.length) promptAndInstall(xthis, state, suggestions);
        }
      }
    }
  }
}

// This function updates state but does NOT set the state. It may initiate or
// cancel downloads, however.
const ModuleUpdates = [] as ModuleUpdatesType[];
function promptAndInstall(
  xthis: ModuleManager,
  state: ManagerState,
  updatesx: ModuleUpdatesType[],
) {
  // Only initiate prompt/download once per module per window lifetime.
  const updates = updatesx.filter(
    (mud) =>
      !ModuleUpdates.find((mud2) => mud.conf.module === mud2.conf.module),
  );
  ModuleUpdates.push(...updates);
  // Show a toast to ask permission to install each update.
  updates.forEach((mud) => {
    const { module, Version, Abbreviation } = mud.conf;
    const { remove } = mud;
    const toRepoName = localizeString(G, mud.conf.sourceRepository.name);
    const msgs = remove
      ? [mud.conf.History?.at(-1)].map((h) => h && h[1].locale)
      : [mud.conf.Description?.locale];
    const mod = `${module} ${Version}:${(Abbreviation && ' ' + Abbreviation.locale) || ''} (${toRepoName})`;
    /*
      const history = mud.conf.History?.filter(
        (h) => versionCompare(h[0], remove.Version ?? 0) === 1,
      ).map((h) => h[1].locale);
      */
    const message: ReactNode = (
      <div
        className={['module-toast', remove ? 'update' : 'suggestion'].join(' ')}
      >
        <div className="messages">
          {msgs.map((msg, i) => msg && <div key={i}>{msg}</div>)}
        </div>
        <div className="module-info">{mod}</div>
      </div>
    );

    xthis
      .addToast({
        timeout: -1,
        intent: Intent.SUCCESS,
        message,
        // After 'yes' is clicked and runs, then onDismiss will also run.
        action: {
          text: G.i18n.t('yes.label'),
          onClick: () => {
            mud.permissionGiven = true;
          },
        },
        onDismiss: () => {
          if (mud.permissionGiven !== true) {
            mud.permissionGiven = false;
            // Must use prevState here.
            xthis.sState((prevState) => {
              installModuleUpdates(xthis, prevState, false, [
                ModuleUpdates.indexOf(mud),
              ]);
              return prevState;
            });
          }
        },
        icon: 'confirm',
      })
      .catch((er) => log.error(er));
  });
  // Download each update (to be canceled if prompt isn't accepted).
  installModuleUpdates(
    xthis,
    state,
    true,
    updates.map((mud) => ModuleUpdates.indexOf(mud)),
  );
}

// This function updates state but does NOT set state. It may however initiate
// or cancel downloads.
function installModuleUpdates(
  xthis: ModuleManager,
  state: ManagerState,
  installUpdate: boolean,
  moduleUpdates: number[],
) {
  const removes: [on: boolean, conf: SwordConfType][] = [];
  const installs: [on: boolean, conf: SwordConfType][] = [];
  moduleUpdates.forEach((mudIndex) => {
    const mud = ModuleUpdates[mudIndex];
    const { remove, conf, permissionGiven } = mud;
    const doInstallUpdate = permissionGiven === false ? false : installUpdate;
    // Remove locally installed modules in the built-in repos.
    if (remove && isRepoBuiltIn(remove.sourceRepository)) {
      removes.push([doInstallUpdate, remove]);
    }
    // Install external modules.
    installs.push([doInstallUpdate, conf]);
  });
  const sharedkey = repositoryKey(G.BuiltInRepos[0]);
  updateModuleInstallColumn(
    xthis,
    state,
    installs.map((i) => i[0]),
    installs.map((i) => i[1]),
    // If removing from shared, also install to shared
    removes.map((rm) => repositoryKey(rm[1].sourceRepository) === sharedkey),
  );
  updateModuleRemoveColumn(
    xthis,
    state,
    removes.map((i) => i[0]),
    removes.map((i) => i[1]),
  );
}

function updateModuleInstallColumn(
  xthis: ModuleManager,
  state: ManagerState,
  setToON: boolean | boolean[],
  configs: SwordConfType[],
  shared?: boolean[],
): number {
  const doDownload: SwordConfType[] = [];
  const doCancel: SwordConfType[] = [];
  const { data } = state.tables.module;
  configs.forEach((conf, i) => {
    const row = findTableRow(
      repositoryModuleKey(conf),
      'module',
    ) as TModuleTableRow;
    if (row) {
      if (Array.isArray(setToON) ? setToON[i] : setToON) {
        // iInstalled is being set to ON...
        tableUpdate(state, 'module');
        if (row[ModCol.iInfo].loading) {
          // Do nothing
        } else if (
          (typeof row[ModCol.iInstalled] !== 'function' &&
            readModCheckbox(data.indexOf(row), ModCol.iInstalled, data) ===
              ON) ||
          isRepoLocal(row[ModCol.iInfo].repo)
        ) {
          // Module is already ON or local, so iInstalled is unchanged.
        } else {
          // otherwise download from remote repo.
          doDownload.push(conf);
          if (shared && shared[i]) row[ModCol.iShared] = ON;
        }
      } else {
        // iInstalled is being set to OFF...
        tableUpdate(state, 'module');
        row[ModCol.iInstalled] = OFF;
        if (row[ModCol.iInfo].loading) doCancel.push(conf);
      }
    }
  });

  if (doCancel.length)
    cancelDownloads(state, doCancel).catch((er) => log.error(er));

  if (doDownload.length)
    download(xthis, state, doDownload).catch((er) => log.error(er));

  return configs.length;
}

function updateModuleRemoveColumn(
  _xthis: ModuleManager,
  state: ManagerState,
  setToON: boolean | boolean[],
  configs: SwordConfType[],
): number {
  const doCancel: SwordConfType[] = [];
  const { data } = state.tables.module;
  configs.forEach((conf, i) => {
    const row = findTableRow(
      repositoryModuleKey(conf),
      'module',
    ) as TModuleTableRow;
    if (row) {
      tableUpdate(state, 'module');
      const currentVal = readModCheckbox(
        data.indexOf(row),
        ModCol.iRemove,
        data,
      );
      if (Array.isArray(setToON) ? setToON[i] : setToON) {
        // removeON is being set to ON...
        if (row[ModCol.iInfo].loading) {
          doCancel.push(conf);
        } else if (currentVal === OFF) {
          row[ModCol.iRemove] = ON;
        } else {
          // already ON so leave as is.
        }
      } else if (currentVal === ON) {
        row[ModCol.iRemove] = OFF;
      } else {
        // already OFF so leave as is.
      }
    }
  });

  if (doCancel.length)
    cancelDownloads(state, doCancel).catch((er) => log.error(er));

  return configs.length;
}

// Find (or set) a table row. All rows are created once and reused for the
// lifetime of the window. This allows recording of all user actions.
const tableRows: {
  language: { [code: string]: TLanguageTableRow };
  module: { [modrepkey: string]: TModuleTableRow };
  repository: { [repkey: string]: TRepositoryTableRow };
} = {
  language: {},
  module: {},
  repository: {},
};
export function findTableRow(
  key: string,
  tableName: 'language',
  setTo?: TLanguageTableRow,
): TLanguageTableRow | null;
export function findTableRow(
  key: string,
  tableName: 'module',
  setTo?: TModuleTableRow,
): TModuleTableRow | null;
export function findTableRow(
  key: string,
  tableName: 'repository',
  setTo?: TRepositoryTableRow,
): TRepositoryTableRow | null;
export function findTableRow(
  key: string,
  tableName: (typeof Tables)[number],
  setTo?: TLanguageTableRow | TModuleTableRow | TRepositoryTableRow,
): TLanguageTableRow | TModuleTableRow | TRepositoryTableRow | null {
  if (setTo) {
    tableRows[tableName][key] = setTo;
    return setTo;
  }
  return key in tableRows[tableName] ? tableRows[tableName][key] : null;
}

// Return any requested local repository operations (remove, copy, move or
// install) for all modules in all repositories.
export function getLocalModuleOperations(
  state: ManagerState,
  downloadKeys: string[],
): RepositoryOperation[] {
  const operations: RepositoryOperation[] = [];
  const { repositories } = state;
  const { repositoryListings } = state.tables.repository;
  const [sharedRepo, xulswordLocalRepo, audioRepo] = G.BuiltInRepos;

  Object.entries(tableRows.module).forEach((entry) => {
    const [modrepkey, drow] = entry;
    const { conf } = drow[ModCol.iInfo];
    const { module, sourceRepository } = conf;
    const { domain } = sourceRepository;
    const sourceRepositoryKey = repositoryKey(sourceRepository);
    const [iShared, iInstalled, iRemove] = (
      ['iShared', 'iInstalled', 'iRemove'] as const
    ).map((col) => readModCheckboxShadowing(drow, ModCol[col]) == ON);
    const destRepository = iShared ? sharedRepo : xulswordLocalRepo;
    const dlkey = Object.entries(Downloads.dl2mrkeyMap).find(
      (e) => e[1] === modrepkey,
    )?.[0];

    if (dlkey && downloadKeys.includes(dlkey) && iInstalled && !iRemove) {
      operations.push({
        module: keyToDownload(dlkey),
        destRepository: iShared ? sharedRepo : xulswordLocalRepo,
        operation: 'install',
      });
    }

    if (iInstalled && domain.startsWith('file://')) {
      if (iRemove) {
        if (canRemoveModule(conf))
          operations.push({
            module,
            destRepository: sourceRepository,
            operation: 'remove',
          });
      } else if (
        // Only move/copy if source is different than destination and not an
        // audio module.
        sourceRepositoryKey !== repositoryKey(audioRepo) &&
        sourceRepositoryKey !== repositoryKey(destRepository)
      ) {
        const { custom } = repositories ?? {};
        const removeDestMod = repositoryListings
          .find(
            (l) =>
              l &&
              l.length &&
              repositoryKey(l[0].sourceRepository) ===
                repositoryKey(destRepository),
          )
          ?.find((c) => c.module === conf.module);
        // No moving or copying from custom to xulsword local.
        // No moving or copying if it requires destination to be removed but it
        // cannot be.
        if (
          !(isRepoCustom(custom ?? null, sourceRepository) && !iShared) &&
          !(removeDestMod && !canRemoveModule(removeDestMod))
        ) {
          if (removeDestMod) {
            operations.push({
              module,
              destRepository,
              operation: 'remove',
            });
          }
          operations.push({
            module,
            sourceRepository,
            destRepository,
            operation: isRepoCustom(custom ?? null, sourceRepository)
              ? 'copy'
              : 'move',
          });
        }
      }
    }
  });

  log.debug('Module operations: ', operations);
  return operations;
}

function canRemoveModule(conf: SwordConfType): boolean {
  const { sourceRepository } = conf;
  return isRepoBuiltIn(sourceRepository);
}

export function getModuleRowXsmSiblings(
  xthis: ModuleManager,
  modrepkey: string,
): string[] {
  const state = xthis.state as ManagerState;
  const { module: modTable } = state.tables;
  const { data } = modTable;
  const row = findTableRow(modrepkey, 'module') as TModuleTableRow;
  if (row) {
    if (row[ModCol.iInfo].conf.xsmType === 'XSM') {
      return data
        .map((r) => {
          return r[ModCol.iInfo].conf.DataPath ===
            row[ModCol.iInfo].conf.DataPath
            ? repositoryModuleKey(r[ModCol.iInfo].conf)
            : null;
        })
        .filter(Boolean) as string[];
    }
    return [modrepkey];
  }
  return [];
}

export function getModuleDownload(modrepkey: string): Download | null {
  const row = findTableRow(modrepkey, 'module') as TModuleTableRow;
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
  state: ManagerState,
  conf: SwordConfType,
): Promise<SelectVKType | SelectORMType | null> {
  if (conf.xsmType === 'XSM_audio') {
    const { AudioChapters } = conf;
    if (AudioChapters) {
      return await new Promise((resolve) => {
        // Subtract audio files that are already installed.
        const installed = G.AudioConfs[conf.module]?.AudioChapters;
        const dialog = {
          conf,
          callback: (result) => {
            resolve(result);
          },
        } as VersekeyDialog | GenBookDialog;
        if (isAudioVerseKey(AudioChapters)) {
          dialog.type = 'versekey';
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
          dialog.chapters = ac;
          dialog.initial = {
            book: books[0],
            chapter: 1,
            lastchapter: 1,
            vkMod: conf.module,
            v11n: conf.Versification ?? 'KJV',
          };
          dialog.selection = clone(dialog.initial);
          let ch: number[] | undefined;
          const acbk0 = ac[books[0]];
          if (acbk0) {
            ch = acbk0
              .map((n, i) => (n ? i : undefined))
              .filter(Boolean) as number[];
          }
          dialog.options = {
            books,
            chapters: ch,
            lastchapters: ch,
            verses: [],
            lastverses: [],
            vkMods: [],
          };
        } else {
          dialog.type = 'genbook';
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
          const nodes = genBookAudio2TreeNodes(ac, conf.module);
          const firstNode = findFirstLeafNode(nodes, [])?.id.toString();
          dialog.selection = {
            otherMod: conf.module,
            keys:
              // If only one option is available, select it, so that ok button
              // will be enabled even though no options will be shown.
              firstNode && Object.keys(ac).length === 1 ? [firstNode] : [],
          };
          dialog.options = {
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
        const { showAudioDialog } = state;
        showAudioDialog.push(dialog);
      });
    } else {
      throw new Error(
        `Audio config is missing AudioChapters: '${conf.module}'`,
      );
    }
  }
  return null;
}

// Perform async repository module downloads corresponding to a given
// set of module configs.
export async function download(
  xthis: ModuleManager,
  state: ManagerState,
  configs: SwordConfType[],
): Promise<void> {
  if (!configs.length) return;

  // Prepare download objects.
  const dlobjs = configs.map((conf) => {
    const modkey = repositoryModuleKey(conf);
    return getModuleDownload(modkey);
  });
  const dlkeys = dlobjs.map((dlobj) => downloadKey(dlobj));

  // Prompt for audio any chapters.
  const audioPrompts = dlobjs.map((dlobj, i) => {
    if (dlobj) {
      const conf = configs[i];
      if (conf.xsmType === 'XSM_audio' && 'http' in dlobj) {
        return promptAudioChapters(state, conf);
      }
    }
    return null;
  });

  if (!audioPrompts.every((p) => p === null)) {
    try {
      const promptResults = await Promise.all(audioPrompts);
      promptResults.forEach((promptResult, i) => {
        if (!promptResult) dlobjs[i] = null;
        else if (dlobjs[i] && 'http' in dlobjs[i])
          dlobjs[i].data = promptResult;
      });
    } catch (er) {
      log.error(er);
    }
  }

  // Show downloads as loading.
  if (dlobjs.filter(Boolean).length) {
    const newstate = xthis.state as ManagerState;
    downloadsLoading(
      xthis,
      newstate,
      configs.filter((_c, i) => dlobjs[i]),
      true,
    );
    xthis.sState(newstate);
  }

  // If this download was previously cancelled, unset that.
  Downloads.cancelled = Downloads.cancelled.filter(
    (cancel) => !dlkeys.includes(cancel),
  );

  const downloads = G.Module.downloads(dlobjs);
  Downloads.promises.push(downloads);
  dlobjs.forEach((_dlobj, i) => {
    Downloads.dl2mrkeyMap[dlkeys[i]] = repositoryModuleKey(configs[i]);
  });
  let dls: Array<Record<string, string | number> | null> = [];
  try {
    dls = await downloads;
  } catch (er) {
    log.error(er);
    dls = dlobjs.map((dl) => {
      return { [downloadKey(dl)]: 0 };
    });
  }

  // Show downloads as finished.
  const newstate = xthis.state as ManagerState;
  downloadsLoading(
    xthis,
    newstate,
    configs.filter((_c, i) => dlobjs[i]),
    false,
  );

  // Update the module table.
  dlobjs.forEach((_dlobj, i) => {
    const dl = dls[i];
    if (dl) {
      const [[dlkey, result]] = Object.entries(dl);
      const modrepkey = repositoryModuleKey(configs[i]);
      const modkeys = getModuleRowXsmSiblings(xthis, modrepkey);
      const modrows = modkeys
        .map((mk) => findTableRow(mk, 'module') as TModuleTableRow)
        .filter(Boolean) as TModuleTableRow[];
      let failed: Intent | null = null;
      if (
        Downloads.cancelled.includes(dlkey) ||
        ModuleUpdates.find(
          (mud) =>
            mud.permissionGiven === false &&
            dlkey ===
              downloadKey(getModuleDownload(repositoryModuleKey(mud.conf))),
        )
      )
        failed = Intent.NONE;
      else if (typeof result === 'string')
        failed = result.startsWith(C.UI.Manager.cancelMsg)
          ? Intent.NONE
          : Intent.DANGER;
      else if (!result) failed = Intent.DANGER;
      // Set intent for the download
      modrows.forEach(
        (r) =>
          (r[ModCol.iInfo].intent = intent(
            ModCol.iInstalled,
            failed ?? Intent.SUCCESS,
          )),
      );
      if (failed) {
        // Handle failed download
        modrows.forEach((r) => (r[ModCol.iInstalled] = OFF));
        if (failed === Intent.DANGER) {
          xthis
            .addToast({
              message:
                typeof result === 'number' ? `result: ${result}` : result,
              timeout: -1,
              intent: Intent.DANGER,
            })
            .catch((er) => log.error(er));
        }
      } else {
        // Handle successful download
        modrows.forEach((r) => (r[ModCol.iInstalled] = ON));
        Downloads.finished.push(modrepkey);
      }
    }
  });
  // Don't update the rowmap after downloads are complete. When sorting by
  // iInstalled row, the results may seem to mysteriously disappear.
  tableUpdate(newstate, 'module');
  xthis.sState(newstate);
}

function downloadsLoading(
  xthis: ModuleManager,
  state: ManagerState,
  configs: SwordConfType[],
  isLoading: boolean,
) {
  configs.forEach((conf) => {
    getModuleRowXsmSiblings(xthis, repositoryModuleKey(conf)).forEach((mk) => {
      const row = findTableRow(mk, 'module') as TModuleTableRow;
      if (row) {
        if (isLoading) {
          row[ModCol.iInfo].loading = loading(ModCol.iInstalled);
          row[ModCol.iInfo].intent = intent(ModCol.iInstalled, Intent.SUCCESS);
        } else {
          row[ModCol.iInfo].loading = false;
          // Intent is set later when results are read...
          updateDownloadProgress(
            state,
            downloadKey(getModuleDownload(repositoryModuleKey(conf))),
            -1,
          );
        }
        tableUpdate(state, 'module');
      }
    });
  });
}

export async function cancelDownloads(
  state: ManagerState,
  downloads: Download[] | string[] | SwordConfType[] | 'all' | 'ongoing',
) {
  let dlkeys: string[] = [];
  if (downloads === 'ongoing') {
    // Cancel ongoing module downloads.
    dlkeys = await G.Module.cancelModuleDownloads();
  } else if (downloads === 'all') {
    // Cancel and forget all downloads.
    dlkeys = Downloads.finished;
    G.Module.cancel().catch((er) => log.error(er));
  } else {
    // Cancel and forget certain downloads.
    let dlobjs: Download[] = [];
    if (typeof downloads[0] === 'string') {
      dlkeys = downloads as string[];
      dlobjs = dlkeys.map((dlkey) => keyToDownload(dlkey));
    } else if (typeof downloads[0] === 'object' && 'DataPath' in downloads[0]) {
      dlobjs = (downloads as SwordConfType[])
        .map((c) => getModuleDownload(repositoryModuleKey(c)))
        .filter(Boolean) as Download[];
      dlkeys = dlobjs.map((dlobj) => downloadKey(dlobj));
    } else {
      dlobjs = downloads as Download[];
      dlkeys = dlobjs.map((dlobj) => downloadKey(dlobj));
    }
    G.Module.cancel(dlobjs).catch((er) => log.error(er));
  }
  dlkeys.forEach((dlkey) => {
    if (!Downloads.cancelled.includes(dlkey)) Downloads.cancelled.push(dlkey);
    updateDownloadProgress(state, dlkey, -1);
  });
}

// If selectedRows is undefined return the currently selected rows of a table,
// otherwise apply selectedRows to the table.
export function retainSelectedValues(
  state: ManagerState,
  selectedRows?: { [k in (typeof Tables)[number]]?: TDataRow[] } | null,
  tableNames?: (typeof Tables)[number][] | null,
): { [k in (typeof Tables)[number]]?: TDataRow[] } {
  const r: { [k in (typeof Tables)[number]]?: TDataRow[] } = {};
  (tableNames ?? (['repository', 'module', 'language'] as const)).forEach(
    (tableName) => {
      const { data } = state.tables[tableName];
      const { selection } = state[tableName];
      const { tableToDataRowMap } = state.tables[tableName];
      let cols;
      if (tableName === 'repository') cols = RepCol;
      else if (tableName === 'module') cols = ModCol;
      else cols = LanCol;
      const { iInfo } = cols;
      if (!selectedRows) {
        // Return the current selection's data rows, and any rows they are
        // currently shadowing.
        r[tableName] = selectionToDataRows(state, tableName, selection)
          .map((dri) =>
            [data[dri]].concat((data[dri] as any)[iInfo].shadowedRows),
          )
          .flat()
          .filter(Boolean);
      } else {
        // Select the given rows values (if they exist) in the current table.
        if (tableName in selectedRows && selectedRows[tableName]) {
          state[tableName].selection = tableRowsToSelection(
            selectedRows[tableName]
              .map((dr) => {
                let dri = (data as TDataRow[]).indexOf(dr);
                if (dri === -1) {
                  // If the selected row is not in the table, check if it is
                  // being shadowed by another row in the table and select that
                  // one instead.
                  dri = (data as TDataRow[]).findIndex((r) =>
                    (r as any)[iInfo].shadowedRows?.includes(dr),
                  );
                }
                if (dri === -1) return null;
                const tri = tableToDataRowMap.indexOf(dri);
                return tri === -1 ? dri : tri;
              })
              .filter((tri) => tri !== null),
          );
          r[tableName] = selectedRows[tableName];
        }
      }
    },
  );
  return r;
}

// This functions requires state[tableName].rowSort to be updated already, then
// this function will regenerate tableToDataRowMap for that rowSort.
export function updateTableToDataRowMap(
  state: ManagerState,
  tableName: (typeof Tables)[number],
) {
  const { columns, rowSort, selection } = state[tableName];
  const { data } = state.tables[tableName];
  const { direction, propColumnIndex: tableColIndex } = rowSort;

  // Save the current data selection.
  const oldDataRowSelection = selectionToDataRows(state, tableName, selection);

  // Re-sort the data rows.
  const dataColIndex = columns[tableColIndex].datacolumn;
  state.tables[tableName].tableToDataRowMap = Utils.times(
    data.length,
    (i: number) => i,
  );
  state.tables[tableName].tableToDataRowMap.sort((ax: number, bx: number) => {
    const a = direction === 'ascending' ? ax : bx;
    const b = direction === 'ascending' ? bx : ax;
    let aa = data[a][dataColIndex];
    let bb = data[b][dataColIndex];
    if (typeof aa === 'function') aa = aa(a, dataColIndex, data as any);
    if (typeof bb === 'function') bb = bb(b, dataColIndex, data as any);
    if (aa === undefined && bb !== undefined) return -1;
    if (bb === undefined && aa !== undefined) return 1;
    if (aa === undefined && bb === undefined) return 0;
    return aa.toString().localeCompare(bb.toString());
  });

  // Re-select the original data selection.
  const { tableToDataRowMap } = state.tables[tableName];
  const newselection = tableRowsToSelection(
    oldDataRowSelection.map((dr) => {
      const tr = tableToDataRowMap.indexOf(dr);
      return tr === -1 ? dr : tr;
    }),
  );
  state[tableName].selection = newselection;
}

// Cause one or more tables to be updated in one or more ways.
// Default is 'render':
// - render: invalidate the BluePrint Table's grid
// - rowmap: render + regenerate the data row map
// - remount: render + rowmap + remount the React Table component
export function tableUpdate(
  state: ManagerState,
  tableName?: (typeof Tables)[number] | (typeof Tables)[number][],
  type?: 'render' | 'rowmap' | 'remount',
) {
  // tableName undefined updates all tables
  const tables: (typeof Tables)[number][] = Array.isArray(tableName)
    ? tableName
    : tableName
      ? [tableName]
      : ['repository', 'module', 'language'];
  tables.forEach((table) => {
    const { render, remount } = state.tables[table];
    state.tables[table].render = render + 1;
    if (type && ['rowmap', 'remount'].includes(type)) {
      updateTableToDataRowMap(state, table);
      if (type === 'remount') state.tables[table].remount = remount + 1;
    }
  });
}

// Get, or create, the repository table row for a Repository object.
export function repositoryToRow(
  state: ManagerState,
  repo: Repository,
  isCustom: boolean,
): TRepositoryTableRow {
  const repokey = repositoryKey(repo);
  let r = findTableRow(repokey, 'repository');
  if (!r) {
    const repoIsDisabled =
      state.repositories?.disabled?.includes(repokey) || false;
    r = findTableRow(repokey, 'repository', [
      localizeString(G, repo.name),
      repo.domain,
      repo.path,
      repoIsDisabled ? OFF : isRepoBuiltIn(repo) ? ALWAYSON : ON,
      {
        loading: false,
        editable: isCustom ? editable() : false,
        classes: repclasses(
          [RepCol.iState],
          ['checkbox-column'],
          isCustom ? ['custom-repo'] : [],
        ),
        repo,
        tooltip: tooltip('VALUE', [RepCol.iState]),
      },
    ]) as TRepositoryTableRow;
  }
  return r;
}

export function allAudioInstalled(
  localAudioChapters: SwordConfType['AudioChapters'],
  remoteAudioChapters: SwordConfType['AudioChapters'],
): boolean {
  let allInstalled = false;
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

// Given a table selection, return the selected data rows in ascending order.
// This is like selectionToTableRows, but returns data rows rather than table
// rows.
export function selectionToDataRows(
  state: ManagerState,
  table: (typeof Tables)[number],
  selection: RowSelection | string[],
): number[] {
  const { data, tableToDataRowMap } = state.tables[table];
  const tablerows = selectionToTableRows(selection as RowSelection);
  return tablerows
    .map((tri) => tableToDataRowMap[tri] ?? tri)
    .filter((dri) => dri > -1 && dri < data.length)
    .sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
}

export function scrollToSelection(
  xthis: ModuleManager,
  state: ManagerState,
  tableName: 'language' | 'module' | 'repository',
) {
  const { selection } = state[tableName];
  if (selection.length) {
    setTimeout(() => {
      const { current } = xthis.tableComponentRefs[tableName];
      try {
        current?.scrollToRegion(selection[0]);
      } catch (er) {
        // ok
      }
      setTimeout(() => {
        try {
          current?.scrollByOffset({ top: -100, left: 0 });
        } catch (er) {
          // ok
        }
      }, 1);
    }, 1);
  }
}
