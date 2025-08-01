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
import Cache from '../../../../cache.ts';
import C from '../../../../constant.ts';
import { G } from '../../../G.ts';
import log from '../../../log.ts';
import { forEachNode } from '../../../components/libxul/treeview.tsx';
import { isRepoBuiltIn } from '../../common.ts';

import type {
  Download,
  GType,
  Repository,
  RepositoryListing,
  RowSelection,
  SwordConfType,
  VerseKeyAudio,
  GenBookAudioConf,
  OSISBookType,
  RepositoryOperation,
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
  TableRowSortState,
  TCellInfo,
  TData,
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
  typeof ON | typeof OFF,
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

export type DownloadRecordType = Record<string, number | string> | null;

export type ModuleUpdates = {
  doInstall: boolean;
  installed?: SwordConfType;
  updateTo: SwordConfType;
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
  modrepkeyMap: {} as { [dlkey: string]: string },
  finished: [] as string[],
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

export function modclasses() {
  return (dri: number, dci: number, datax: TData) => {
    const data = datax as TModuleTableRow[];
    const drow = data[dri];
    const { conf } = drow[ModCol.iInfo];
    const partialAudioInstalled =
      conf.xsmType === 'XSM_audio' && !allAudioInstalled(conf);
    const classes: string[] = [];
    if (
      (
        [ModCol.iShared, ModCol.iInstalled, ModCol.iRemove] as number[]
      ).includes(dci)
    )
      classes.push('checkbox-column');
    if (
      dci === ModCol.iInstalled &&
      drow[ModCol.iInstalled] === ON &&
      !partialAudioInstalled
    ) {
      classes.push('disabled');
    } else if (
      dci === ModCol.iShared &&
      (drow[ModCol.iInfo].conf.xsmType === 'XSM_audio' ||
        drow[ModCol.iInstalled] === OFF)
    ) {
      classes.push('disabled');
    }

    return classes;
  };
}

export function tooltip(atooltip: string, skipColumnIndexArray: number[]) {
  return (_ri: number, ci: number) => {
    return skipColumnIndexArray.includes(ci) ? undefined : atooltip;
  };
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

export function updateDownloadProgress(
  state: ManagerState,
  dlkey: string,
  prog: number,
) {
  let { ids } = Progressing;
  const idi = ids.findIndex((d) => d[0] === dlkey);
  if (idi === -1) ids.push([dlkey, prog]);
  else ids[idi][1] = prog;
  if (ids.every((d) => d[1] === -1)) ids = [];
  Progressing.ids = ids;
  const total = ids.reduce((p, c) => p + (c[1] === -1 ? 1 : c[1]), 0);
  state.progress =
    !ids.length || !total || total === ids.length ? null : [total, ids.length];
}

export function onRowsReordered(
  this: ModuleManager,
  tableName: (typeof Tables)[number],
  direction: 'ascending' | 'descending',
  dataColIndex: number,
) {
  const state = this.state as ManagerState;
  const { columns, selection } = state[tableName];
  const rowSort: TableRowSortState = {
    direction,
    propColumnIndex: columns.findIndex((tc) => tc.datacolumn === dataColIndex),
  };
  state[tableName].rowSort = rowSort;
  // Save current selection
  const oldDataRowSelection = selectionToDataRows(this, tableName, selection);
  let codes: string[] = [];
  if (tableName === 'language') {
    const { data } = state.tables.language;
    codes = oldDataRowSelection.map((dr) => data[dr][LanCol.iInfo].code);
  }
  tableUpdate(state, tableName, 'rowmap');
  // Reselect original selection
  let newselection: string[] | RowSelection;
  if (tableName === 'language')
    newselection = this.languageCodesToTableSelection(state, codes);
  else {
    const { tableToDataRowMap } = state.tables[tableName];
    newselection = tableRowsToSelection(
      oldDataRowSelection.map((dr) => {
        const tr = tableToDataRowMap.indexOf(dr);
        return tr === -1 ? dr : tr;
      }),
    );
  }
  state[tableName].selection = newselection;

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
  newstate.language.selection = rowSelect(
    newstate,
    e,
    'language',
    dataRowIndex,
  );
  this.loadModuleTable(newstate);
  tableUpdate(newstate, ['language', 'module']);
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
    const { selection } = module;
    let datarows = selectionToDataRows(this, 'module', selection);
    if (datarows.indexOf(dataRowIndex) === -1) datarows = [dataRowIndex];
    const drow = modtable.data[dataRowIndex];
    const wason = drow[dataColIndex] === ON || drow[ModCol.iInfo].loading;
    const willon = !wason;
    if (drow && dataColIndex === ModCol.iInstalled) {
      // iInstalled column clicks
      if (willon || !drow[ModCol.iInfo].loading) {
        const updated = updateModuleInstallColumn(
          this,
          newstate,
          willon,
          datarows.map((ri) => modtable.data[ri][ModCol.iInfo].conf),
        );
        if (updated) return this.sState(newstate);
      }
    } else if (drow && dataColIndex === ModCol.iRemove) {
      // iRemove column clicks
      const updated = updateModuleRemoveColumn(
        newstate,
        willon,
        datarows.map((ri) => modtable.data[ri][ModCol.iInfo].conf),
      );
      if (updated) return this.sState(newstate);
    } else if (drow && dataColIndex === ModCol.iShared) {
      // Shared column clicks
      let updated = false;
      datarows.forEach((r) => {
        const dr = modtable.data[r];
        if (dr && dr[ModCol.iInstalled] === ON) {
          dr[ModCol.iShared] = wason ? OFF : ON;
          updated = true;
        }
      });
      if (updated) {
        tableUpdate(newstate, 'module');
        return this.sState(newstate);
      }
    }

    rowSelect(newstate, e, 'module', dataRowIndex);
    this.sState(newstate);
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
    const switchOn = repotable.data[dataRowIndex][RepCol.iState] === OFF;
    let selectedDataRows = selectionToDataRows(this, 'repository', selection);
    if (selectedDataRows.indexOf(dataRowIndex) === -1)
      selectedDataRows = [dataRowIndex];
    if (
      !isRepoBuiltIn(repotable.data[dataRowIndex][RepCol.iInfo].repo) &&
      dataColIndex === RepCol.iState
    ) {
      switchRepo(this, newstate, selectedDataRows, switchOn);
    } else {
      rowSelect(newstate, e, 'repository', dataRowIndex);
      tableUpdate(newstate, 'repository');
      this.sState(newstate);
    }
  }
}

export function onCustomRepositoryEdited(
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
      if (!repo.domain) repo.domain = '?';
      if (!repo.name) repo.name = '?';
      if (!repo.path) repo.path = 'file://';
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
            newstate.module.selection = [];
            newstate.tables.module.data = this.filterModuleTable(
              newstate.tables.module.modules,
              newstate.language.selection,
              open,
            );
            tableUpdate(newstate, ['language', 'module']);
            this.sState(newstate);
            scrollToSelectedLanguage(this, newstate);
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
                this,
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
            G.Window.close();
            break;
          }
          case 'ok': {
            const errors: string[] = [];
            let downloadResults: PromiseSettledResult<DownloadRecordType[]>[] =
              [];
            try {
              downloadResults = await Promise.allSettled(Downloads.promises);
            } catch (er) {
              log.error(er);
              errors.push(`Failed to download all modules.`);
            }
            G.Window.modal([{ modal: 'transparent', window: 'all' }]);
            G.publishSubscription(
              'setControllerState',
              {
                renderers: { type: 'xulswordWin' },
              },
              { progress: 'indefinite' },
            );

            const state = this.state as ManagerState;
            // Un-persist these table selections.
            state.module.selection = [];
            if (state.repository) state.repository.selection = [];
            this.sState(state);

            const operations = getLocalModuleOperations(state);

            // Remove, copy and move installed modules
            (['remove', 'copy', 'move'] as const).forEach((type) => {
              const ops = operations.filter((op) => op.operation === type);
              if (ops.length) {
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

            // Install new modules
            const install: Parameters<GType['Module']['installDownloads']>[0] =
              [];
            downloadResults.forEach((dlr) => {
              if (dlr.status === 'fulfilled' && dlr.value) {
                const { value } = dlr;
                value.forEach((v) => {
                  if (v) {
                    Object.entries(v).forEach((entry) => {
                      const [downloadkey, result] = entry;
                      if (typeof result === 'number' && result > 0) {
                        const modrepkey = Downloads.modrepkeyMap[downloadkey];
                        if (modrepkey) {
                          const row = findModuleRow(modrepkey);

                          if (row && row[ModCol.iInstalled] === ON) {
                            install.push({
                              download: keyToDownload(downloadkey),
                              toRepo:
                                G.BuiltInRepos[
                                  row[ModCol.iShared] === ON ? 0 : 1
                                ],
                            });
                          }
                        }
                      }
                    });
                  }
                });
              }
            });

            // Run Module.installDownloads even if install.length is zero, so
            // that LibSword will be re-initialized with any custom repository
            // changes.
            G.Module.installDownloads(
              install,
              G.Window.descriptions({ type: 'xulswordWin' })[0]?.id,
            ).catch((er) => {
              // Module installation errors are reported separately. This only
              // catches uncaught installDownloads() errors.
              log.error(er);
              errors.push(`An error occured installing modules.`);
            });

            G.Module.cancel().catch((er) => log.error(er));
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
              });
            } else G.Window.close();
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
              // would be more difficult to bail on error (without changes).
              const drows =
                (repository &&
                  selectionToDataRows(this, 'repository', selection)) ||
                [];
              if (
                drows.length &&
                uninstallRepository(this, newstate, drows[0])
              ) {
                this.loadLanguageTable(newstate);
                this.loadModuleTable(newstate);
                tableUpdate(newstate, undefined);
                this.sState(newstate);
              }
            }
            break;
          }
          case 'repoCancel': {
            const newstate = this.state as ManagerState;
            const { repository: repotable } = newstate.tables;
            const canceldls: Download[] = repotable.data
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
                r[RepCol.iInfo].loading = false;
                r[RepCol.iState] = OFF;
                return {
                  ...r[RepCol.iInfo].repo,
                  file: C.SwordRepoManifest,
                  type: 'ftp',
                };
              });
            G.Module.cancel(canceldls).catch((er) => {
              log.error(er);
            });
            canceldls.forEach((dl) =>
              updateDownloadProgress(newstate, downloadKey(dl), -1),
            );
            tableUpdate(newstate, 'repository');
            this.sState(newstate);
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

// Install a new custom repository (if repoDataIndex is -1) or update the
// custom repository at repoDataIndex. Returns true on success or false on
// failure (with no changes). This fails if a custom repo with this key
// already exists, or if the repo at the given index is not a custom repo
// (the only type that is installable).
export function installCustomRepository(
  xthis: ModuleManager,
  state: ManagerState,
  repoDataIndex: number,
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
    const row = repositoryToRow(state, repo, true, false);
    let newindex = repoDataIndex;
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
    tableUpdate(state, undefined);
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
    if (
      index > -1 &&
      index in data &&
      isRepoCustom(custom, data[index][RepCol.iInfo].repo)
    ) {
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
      tableUpdate(state, undefined);
      return true;
    }
  }
  return false;
}

// Select or unselect a row of a table. Returns the new selection.
// NOTE: returned selection is type state.table[table].selection.
export function rowSelect(
  state: ManagerState,
  e: React.MouseEvent,
  tableName: 'language',
  dataRowIndex: number,
): string[];
export function rowSelect(
  state: ManagerState,
  e: React.MouseEvent,
  tableName: 'repository' | 'module',
  dataRowIndex: number,
): RowSelection;
export function rowSelect(
  state: ManagerState,
  e: React.MouseEvent,
  tableName: (typeof Tables)[number],
  dataRowIndex: number,
): RowSelection | string[] {
  const table = state[tableName];
  let newSelection: RowSelection | string[] = [];
  if (table) {
    const { tableToDataRowMap } = state.tables[tableName];
    const { selection } = table;
    if (tableName === 'language') {
      let selectedDataRows: number[] = [];
      const { data } = state.tables.language;
      selectedDataRows = selection
        .map((code) => {
          const rx = data.findIndex((r) => r[LanCol.iInfo].code === code);
          return rx === -1 ? 0 : rx;
        })
        .sort((a, b) => a - b);
      const newDataRowSelection = updateSelectedIndexes(
        dataRowIndex,
        selectedDataRows,
        e,
      );
      newSelection = newDataRowSelection.map((r) => data[r][LanCol.iInfo].code);
    } else {
      let tableRowIndex = tableToDataRowMap.indexOf(dataRowIndex);
      if (tableRowIndex === -1) tableRowIndex = dataRowIndex;
      const selectedtableRows = selectionToTableRows(selection as RowSelection);
      const newTableRowSelection = updateSelectedIndexes(
        tableRowIndex,
        selectedtableRows,
        e,
      );
      newSelection = tableRowsToSelection(newTableRowSelection);
    }
    if (state[tableName]) state[tableName].selection = newSelection;
  }

  return newSelection;
}

function repoRowEnableDisable(
  enable: boolean,
  datarow: TRepositoryTableRow,
  repositories: ManagerState['repositories'],
  stateIntent = Intent.NONE as Intent,
) {
  const { disabled } = repositories ?? {};
  const rowkey = repositoryKey(datarow[RepCol.iInfo].repo);
  let di = -1;
  if (disabled) di = disabled.findIndex((k) => k === rowkey);
  if (enable) {
    if (disabled && di !== -1) disabled.splice(di, 1);
    datarow[RepCol.iState] = isRepoBuiltIn(datarow[RepCol.iInfo].repo)
      ? ALWAYSON
      : ON;
    datarow[RepCol.iInfo].loading = loading(RepCol.iState);
    datarow[RepCol.iInfo].intent = intent(RepCol.iState, stateIntent);
  } else {
    if (di === -1) {
      if (disabled) disabled.push(rowkey);
      else if (repositories) repositories.disabled = [rowkey];
    }
    datarow[RepCol.iState] = OFF;
    datarow[RepCol.iInfo].loading = false;
    datarow[RepCol.iInfo].intent = intent(RepCol.iState, stateIntent);
  }
}

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
            repoRowEnableDisable(
              onOrOff,
              data[r],
              repositories,
              onOrOff ? Intent.SUCCESS : Intent.NONE,
            );
          }
        }
      });
      tableUpdate(newstate, 'repository');
    }
    return newstate;
  };

  const updateTables = () => {
    const state = xthis.state as ManagerState;
    const { tables, repositories } = state;
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
    if (checkForUpdates) {
      checkForModuleUpdates(xthis, newstate);
      checkForSuggestions(xthis, newstate);
    }
    tableUpdate(newstate, ['module', 'language']);
    xthis.sState(newstate);
  };

  const { repositoryListings } = state.tables.repository;
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
  if (needServerRequest) {
    const readrepos = repos.map((repo, index) => {
      return async () => {
        if (repo) {
          let list: Array<RepositoryListing | string> = [null];
          if (!disabled || !disabled.find((k) => k === repositoryKey(repo))) {
            try {
              list = await G.Module.repositoryListing([
                { ...repo, file: C.SwordRepoManifest, type: 'ftp' },
              ]);
            } catch (er) {
              log.error(er);
              list = [];
              return false;
            }
          }
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
  } else {
    handleListings(
      xthis,
      state,
      repos.map((_r, i) => repositoryListings[i]),
    );
    updateTables(state);
  }
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
        repoRowEnableDisable(false, drow, repositories, newintent);
        if (!Array.isArray(repositoryListings[i])) {
          repositoryListings[i] = null;
        }
        return null;
      }
      repositoryListings[i] = l;
      if ([ON, ALWAYSON].includes(drow[RepCol.iState])) {
        drow[RepCol.iInfo].intent = intent(RepCol.iState, Intent.SUCCESS);
      }
      return l;
    }
    return null;
  });
  modtable.modules = null;

  tableUpdate(state, 'repository');
}

// Check enabled repository listings (except beta and attic) for installed
// modules that have newer versions available, or have been obsoleted. Begin
// downloading the updates, but ask whether to replace each installed module
// with the update before doing so. This function should be called after
// updateRepositoryLists().
export function checkForModuleUpdates(
  xthis: ModuleManager,
  state: ManagerState,
) {
  const { module, repository } = state.tables;
  const { repositoryListings } = repository;
  const updateable: SwordConfType[] = [];
  // Get the list of modules in the local xulsword repository. These modules may
  // be overwritten by newer versions, or replaced if obsoleted.
  repository.data.forEach((rtd, i) => {
    if (rtd[RepCol.iInfo].repo.path === G.Dirs.path.xsModsUser) {
      const listing = repositoryListings[i];
      if (Array.isArray(listing)) listing.forEach((c) => updateable.push(c));
    }
  });
  // Add to the list modules in other local SWORD repositories, including
  // shared, IF they are not also in the local xulsword repository (same name
  // and version?). Modules in these repositories are never overwritten,
  // newer or obsolete-replacements are installed in the xulsword repo.
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
    if (candidates.length) {
      // insure top candidate is not already installed (can happen with obsoletes).
      const [{ updateTo }] = candidates;
      if (
        !(
          updateTo.module in G.Tab &&
          updateTo.Version === G.ModuleConfs[updateTo.module].Version
        )
      )
        moduleUpdates.push(candidates[0]);
    }
  });

  return promptAndInstall(xthis, state, moduleUpdates);
}

const ModuleUpdatePrompted: string[] = [];

function promptAndInstall(
  xthis: ModuleManager,
  state: ManagerState,
  updatesx: ModuleUpdates[],
): number {
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
            // Must use prevState here.
            xthis.sState((prevState) => {
              return installModuleUpdates(false, xthis, prevState, [mud])
                ? prevState
                : null;
            });
          }
        }, 100),
      icon: 'confirm',
    });
  });
  // Download each update (to be canceled if prompt isn't accepted).
  return installModuleUpdates(true, xthis, state, updates);
}

function installModuleUpdates(
  doInstallUpdate: boolean,
  xthis: ModuleManager,
  state: ManagerState,
  moduleUpdates: ModuleUpdates[],
): number {
  const xulswordRepo = repositoryKey(G.BuiltInRepos[1]);
  const removes: [on: boolean, conf: SwordConfType][] = [];
  const installs: [on: boolean, conf: SwordConfType][] = [];
  moduleUpdates.forEach((mud) => {
    const { installed, updateTo } = mud;
    // Remove locally installed modules in the xulsword repo.
    if (
      installed &&
      repositoryKey(installed.sourceRepository) === xulswordRepo
    ) {
      removes.push([doInstallUpdate, installed]);
    }
    // Install external updateTo modules.
    installs.push([doInstallUpdate, updateTo]);
  });
  return (
    updateModuleInstallColumn(
      xthis,
      state,
      installs.map((i) => i[0]),
      installs.map((i) => i[1]),
    ) +
    updateModuleRemoveColumn(
      state,
      removes.map((i) => i[0]),
      removes.map((i) => i[1]),
    )
  );
}

function updateModuleInstallColumn(
  xthis: ModuleManager,
  state: ManagerState,
  setToON: boolean | boolean[],
  configs: SwordConfType[],
): number {
  const { module: modtable } = state.tables;
  const doDownload: SwordConfType[] = [];
  const doCancel: SwordConfType[] = [];
  configs.forEach((conf, i) => {
    const row = modtable.data.find(
      (r) =>
        repositoryModuleKey(r[ModCol.iInfo].conf) === repositoryModuleKey(conf),
    );
    if (row) {
      if (Array.isArray(setToON) ? setToON[i] : setToON) {
        // iInstalled is being set to ON...
        tableUpdate(state, 'module');
        if (row[ModCol.iInfo].loading) {
          // Do nothing
        } else if (
          row[ModCol.iInstalled] === ON ||
          isRepoLocal(row[ModCol.iInfo].repo)
        ) {
          // Module is already ON or local, so iInstalled stays ON.
          row[ModCol.iInstalled] = ON;
        } else {
          // otherwise download from remote repo.
          row[ModCol.iInfo].intent = intent(ModCol.iInstalled, 'none');
          doDownload.push(conf);
        }
      } else {
        // iInstalled is being set to OFF...
        tableUpdate(state, 'module');
        row[ModCol.iInstalled] = OFF;
        if (row[ModCol.iInfo].loading) doCancel.push(conf);
        row[ModCol.iInfo].intent = intent(ModCol.iInstalled, 'none');
      }
    }
  });

  if (doCancel.length) {
    G.Module.cancel(
      doCancel
        .map((c) => getModuleDownload(repositoryModuleKey(c)))
        .filter(Boolean) as Download[],
    ).catch((er) => log.error(er));
  }

  if (doDownload.length)
    download(xthis, state, doDownload).catch((er) => log.error(er));

  return configs.length;
}

function updateModuleRemoveColumn(
  state: ManagerState,
  setToON: boolean | boolean[],
  configs: SwordConfType[],
): number {
  const { module: modtable } = state.tables;
  const doCancel: SwordConfType[] = [];
  configs.forEach((conf, i) => {
    const row = modtable.data.find(
      (r) =>
        repositoryModuleKey(r[ModCol.iInfo].conf) === repositoryModuleKey(conf),
    );
    if (row) {
      tableUpdate(state, 'module');
      if (Array.isArray(setToON) ? setToON[i] : setToON) {
        // removeON is being set to ON...
        if (row[ModCol.iInfo].loading) doCancel.push(conf);
        else row[ModCol.iRemove] = ON;
      } else row[ModCol.iRemove] = OFF;
    }
  });

  if (doCancel.length) {
    G.Module.cancel(
      doCancel
        .map((c) => getModuleDownload(repositoryModuleKey(c)))
        .filter(Boolean) as Download[],
    ).catch((er) => log.error(er));
  }

  return configs.length;
}

// Find (or set) a module table row.
export function findModuleRow(
  modrepkey: string,
  setTo?: TModuleTableRow,
): TModuleTableRow | null {
  const ckey = `modrow-${modrepkey}`;
  if (setTo) {
    Cache.write(setTo, ckey);
    Cache.noclear(ckey);
    return setTo;
  }
  if (Cache.has(ckey)) return Cache.read(ckey);
  return null;
}

export function checkForSuggestions(
  xthis: ModuleManager,
  state: ManagerState,
): number {
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
      return promptAndInstall(xthis, state, suggestions);
    }
  }

  return 0;
}

// Return any requested local repository operations (remove, copy or move) for
// all modules in the module table according to current table values.
export function getLocalModuleOperations(
  state: ManagerState,
): RepositoryOperation[] {
  const operations: RepositoryOperation[] = [];
  const { repositories } = state;
  const { repositoryListings } = state.tables.repository;
  const [sharedRepo, xulswordLocalRepo, audioRepo] = G.BuiltInRepos;
  state.tables.module.data.forEach((drow) => {
    const iShared = drow[ModCol.iShared] == ON;
    const iInstalled = drow[ModCol.iInstalled] === ON;
    const iRemove = drow[ModCol.iRemove] === ON;
    const destRepository = iShared ? sharedRepo : xulswordLocalRepo;

    findRowInstalledModules(state, drow).forEach((conf) => {
      const { sourceRepository } = conf;
      const { module } = conf;
      const sourceRepositoryKey = repositoryKey(sourceRepository);
      if (iInstalled) {
        if (iRemove) {
          if (canRemoveModule(conf))
            operations.push({
              module,
              destRepository: sourceRepository,
              operation: 'remove',
            });
        } else if (
          // Only move/copy if source is different than destination an not an
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
          // No moving or copying from xulsword local to shared if the module already
          // exists in shared.
          if (
            (!isRepoCustom(custom ?? null, sourceRepository) || iShared) &&
            !(
              sourceRepositoryKey === repositoryKey(xulswordLocalRepo) &&
              iShared &&
              removeDestMod
            ) &&
            (!removeDestMod || canRemoveModule(removeDestMod))
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
  });

  return operations;
}

function canRemoveModule(conf: SwordConfType): boolean {
  const { sourceRepository } = conf;
  return isRepoBuiltIn(sourceRepository);
}

// When a table row shows an installed XSM or remote repo module, return the
// referred local module (or modules in the case of XSM).
function findRowInstalledModules(
  state: ManagerState,
  drow: TModuleTableRow,
): SwordConfType[] {
  const result: SwordConfType[] = [];
  const { repositoryListings } = state.tables.repository;
  const { custom } = state.repositories ?? {};
  if (drow[ModCol.iInstalled] === ON) {
    const { conf } = drow[ModCol.iInfo];
    const { sourceRepository } = conf;
    let lookup: { module: string; version: string }[] = [];
    if (isRepoLocal(sourceRepository)) result.push(conf);
    else if (conf.xsmType === 'XSM') {
      const { SwordModules, SwordVersions } = conf;
      if (SwordModules && SwordVersions) {
        lookup = SwordModules.map((module, i) => {
          return { module, version: SwordVersions[i] };
        });
      }
    } else lookup = [{ module: conf.module, version: conf.Version ?? '' }];
    // Look for the modules in the same order as libxulsword will: xulsword
    // local first, then shared, then custom. Module version does not matter,
    // the first module having the correct name of any version is chosen.
    const [sharedRepo, xulswordLocalRepo] = G.BuiltInRepos;
    lookup.forEach((lu) => {
      const { module, version } = lu;
      // xulsword local repo
      let conf: SwordConfType | undefined = findRepositoryListings(
        state,
        xulswordLocalRepo,
      )?.find((c) => c.module === module && c.Version === version);
      if (!conf)
        // then shared repo
        conf = findRepositoryListings(state, sharedRepo)?.find(
          (c) => c.module === module && c.Version === version,
        );
      if (!conf) {
        // then custom repos
        repositoryListings
          .filter(
            (rl) =>
              rl &&
              rl.length &&
              rl[0] &&
              isRepoCustom(custom ?? null, rl[0].sourceRepository),
          )
          .forEach((listing) => {
            if (!conf)
              conf = listing?.find(
                (c) => c.module === module && c.Version === version,
              );
          });
      }
      if (conf) result.push(conf);
    });
  }
  return result;
}

function findRepositoryListings(
  state: ManagerState,
  repo: Repository,
): SwordConfType[] | null {
  const { repositoryListings } = state.tables.repository;
  const repokey = repositoryKey(repo);
  return (
    repositoryListings.find(
      (l) =>
        l &&
        l.length &&
        l[0] &&
        repositoryKey(l[0].sourceRepository) === repokey,
    ) ?? null
  );
}

export function getModuleRowXsmSiblings(
  xthis: ModuleManager,
  modrepkey: string,
): string[] {
  const state = xthis.state as ManagerState;
  const { module: modTable } = state.tables;
  const { data } = modTable;
  const row = findModuleRow(modrepkey);
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

export function getModuleDownload(modrepkey: string): Download | null {
  const row = findModuleRow(modrepkey);
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
            v11n: 'KJV',
          };
          dialog.selection = dialog.initial;
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

function handleError(
  xthis: ModuleManager,
  state: ManagerState,
  er: any,
  modrepkeys: string[],
) {
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
    const row = findModuleRow(k);
    if (row) {
      row[ModCol.iInfo].loading = false;
      row[ModCol.iInfo].intent = intent(ModCol.iInstalled, newintent);
    }
  });
  tableUpdate(state, 'module');
}

// Perform async repository module downloads corresponding to a given
// set of module configs.
export async function download(
  xthis: ModuleManager,
  state: ManagerState,
  configs: SwordConfType[],
): Promise<void> {
  // Prepare download objects.
  const dlobjs = configs.map((conf) => {
    const modkey = repositoryModuleKey(conf);
    return getModuleDownload(modkey);
  });

  // Prompt for audio any chapters.
  const audioPromptPromises = dlobjs.map(async (dlobj, i) => {
    if (dlobj) {
      const conf = configs[i];
      const modkey = repositoryModuleKey(conf);
      if (conf.xsmType === 'XSM_audio' && 'http' in dlobj) {
        return promptAudioChapters(state, conf)
          .then((audio) => {
            if (!audio) dlobjs[i] = null;
            else dlobj.data = audio;
          })
          .catch((er) => {
            const newstate = state;
            handleError(xthis, newstate, er, [modkey]);
            xthis.sState(newstate);
          });
      }
    }
  });
  try {
    await Promise.all(audioPromptPromises);
  } catch (er) {
    log.error(er);
  }

  // Show progress loading
  dlobjs.forEach((dlobj, i) => {
    if (dlobj) {
      const modkey = repositoryModuleKey(configs[i]);
      const modkeys = getModuleRowXsmSiblings(xthis, modkey);
      modkeys.forEach((mk) => {
        const row = findModuleRow(mk);
        if (row) {
          row[ModCol.iInfo].loading = loading(ModCol.iInstalled);
        }
      });
      return dlobj;
    }
    return null;
  });
  if (dlobjs.filter(Boolean).length) {
    const newstate = xthis.state as ManagerState;
    tableUpdate(newstate, 'module');
    xthis.sState(newstate);
  }

  // Download using the array of download objects
  let dls: Array<Record<string, string | number> | null> = [];
  if (dlobjs.length) {
    const downloads = G.Module.downloads(dlobjs);
    Downloads.promises.push(downloads);
    dlobjs.forEach((dlobj, i) => {
      Downloads.modrepkeyMap[downloadKey(dlobj)] = repositoryModuleKey(
        configs[i],
      );
    });
    try {
      dls = await downloads;
    } catch (er) {
      log.error(er);
      dls = dlobjs.map((dl) => {
        return { [downloadKey(dl)]: 0 };
      });
    }
    const newstate = xthis.state as ManagerState;
    dlobjs.forEach((dl) => {
      updateDownloadProgress(newstate, downloadKey(dl), -1);
    });
    xthis.sState(newstate);
  }

  // Now that all downloads are complete, update the module table.
  if (dls.length) {
    dls.forEach((dl, i) => {
      if (dl) {
        const newstate = xthis.state as ManagerState;
        const [[dlkey, result]] = Object.entries(dl);
        const modrepkey = repositoryModuleKey(configs[i]);
        const modkeys = getModuleRowXsmSiblings(xthis, modrepkey);
        const modrows = modkeys
          .map((mk) => findModuleRow(mk))
          .filter(Boolean) as TModuleTableRow[];
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
        } else if (modrows.length) {
          if (result > 0) {
            newintent = Intent.SUCCESS;
            modrows.forEach((r) => (r[ModCol.iInstalled] = ON));
            Downloads.finished.push(modrepkey);
          } else {
            newintent = Intent.WARNING;
            modrows.forEach((r) => (r[ModCol.iInstalled] = OFF));
          }
        } else log.error(`Download not in module table: ${dlkey}`);
        modrows.forEach((r) => {
          r[ModCol.iInfo].intent = intent(ModCol.iInstalled, newintent);
        });
        tableUpdate(newstate, 'module');
        xthis.sState(newstate);
      }
    });
  }
}

// This functions requires state[tableName].rowSort to be updated already, then
// this function will regenerate tableToDataRowMap for that rowSort.
export function updateTableToDataRowMap(
  state: ManagerState,
  tableName: (typeof Tables)[number],
) {
  const { columns, rowSort } = state[tableName];
  const { data } = state.tables[tableName];
  const { direction, propColumnIndex: tableColIndex } = rowSort;
  const dataColIndex = columns[tableColIndex].datacolumn;
  state.tables[tableName].tableToDataRowMap = Utils.times(
    data.length,
    (i: number) => i,
  );
  state.tables[tableName].tableToDataRowMap.sort((ax: number, bx: number) => {
    const a = direction === 'ascending' ? ax : bx;
    const b = direction === 'ascending' ? bx : ax;
    const aa = data[a][dataColIndex];
    const bb = data[b][dataColIndex];
    if (aa === undefined && bb !== undefined) return -1;
    if (bb === undefined && aa !== undefined) return 1;
    if (aa === undefined && bb === undefined) return 0;
    return aa.toString().localeCompare(bb.toString());
  });
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
  // tableName default is all tables
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

// Given a table selection, return the selected data rows in ascending order.
// This is like selectionToTableRows, but returns data rows rather than table
// rows.
export function selectionToDataRows(
  xthis: ModuleManager,
  table: (typeof Tables)[number],
  selection: RowSelection | string[],
): number[] {
  const state = xthis.state as ManagerState;
  const { tables } = state;
  const { tableToDataRowMap } = tables[table];
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
    .map((tr) => tableToDataRowMap[tr] ?? tr)
    .sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
}

// Create a new repository table row from a Repository object.
export function repositoryToRow(
  state: ManagerState,
  repo: Repository,
  isCustom: boolean,
  isLoading: boolean,
): TRepositoryTableRow {
  const repoIsDisabled =
    state.repositories?.disabled?.includes(repositoryKey(repo)) || false;
  return [
    localizeString(G, repo.name),
    repo.domain,
    repo.path,
    repoIsDisabled ? OFF : isRepoBuiltIn(repo) ? ALWAYSON : ON,
    {
      loading: isLoading && !repoIsDisabled ? loading(RepCol.iState) : false,
      editable: isCustom ? editable() : false,
      classes: repclasses(
        [RepCol.iState],
        ['checkbox-column'],
        isCustom ? ['custom-repo'] : [],
      ),
      repo,
      tooltip: tooltip('VALUE', [RepCol.iState]),
    },
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

export function scrollToSelectedLanguage(
  xthis: ModuleManager,
  state: ManagerState,
) {
  const { selection } = state.language;
  if (selection.length) {
    const selectedRegions = xthis.languageCodesToTableSelection(
      state,
      selection,
    );
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
