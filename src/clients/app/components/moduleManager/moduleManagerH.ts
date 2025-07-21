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
  builtInRepos,
  repositoryModuleKey,
  tableSelectDataRows,
  querablePromise,
  gbPaths,
  localizeString,
  findFirstLeafNode,
  cloneAny,
  isRepoCustom,
  isRepoBuiltIn,
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
  RepoDisabled,
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
  TCellInfo,
  TCellLocation,
  TData,
} from '../../../components/libxul/table.tsx';

export const Tables = ['language', 'module', 'repository'] as const;

export const Permission = { internet: false };

export const DefaultCustomRepo: Repository = {
  name: '?',
  domain: C.Downloader.localfile,
  path: '?',
};

export const DefaultCustomRepoKey = repositoryKey(DefaultCustomRepo);

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

export type DownloadType = Record<string, number | string> | null;

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

export const Downloads: Array<QuerablePromise<Array<DownloadType>>> = [];

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
      drow[ModCol.iInfo].installedLocally &&
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
  const builtIns = builtInRepos();

  if (repositories) {
    const { xulsword, custom } = repositories;
    return builtIns.concat(xulsword, custom);
  }

  return builtIns;
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
    const total = ids.reduce((p, c) => p + (c[1] === -1 ? 1 : c[1]), 0);
    const progress =
      !ids.length || total === ids.length ? null : [total, ids.length];
    xthis.sState({ progress });
    Progressing.ids = ids;
  }
}

export function onRowsReordered(
  this: ModuleManager,
  tableName: (typeof Tables)[number],
  propColumnIndex: number,
  direction: 'ascending' | 'descending' | 'tableToDataRowMap',
  tableToDataRowMap: number[],
) {
  const newstate = this.state as ManagerState;
  const table = newstate[tableName];
  if (table) {
    // Update our tableToDataRowMap based on the new sorting.
    newstate.tables[tableName].tableToDataRowMap = tableToDataRowMap;
    if (direction !== 'tableToDataRowMap' && newstate[tableName]) {
      newstate[tableName].rowSort = { propColumnIndex, direction };
      tableUpdate(this, newstate, tableName);
    }
    this.sState(newstate);
  }
}

export function onLangCellClick(
  this: ModuleManager,
  e: React.MouseEvent,
  cell: TCellLocation,
) {
  const newstate = this.state as ManagerState;
  newstate.language.selection = rowSelect(
    newstate,
    e,
    'language',
    cell.tableRowIndex,
  );
  this.loadModuleTable(newstate);
  tableUpdate(this, newstate, ['language', 'module']);
  this.sState(newstate);
}

export function onModCellClick(
  this: ModuleManager,
  e: React.MouseEvent,
  cell: TCellLocation,
) {
  const disabled = ofClass(['disabled'], e.target);
  if (!disabled) {
    const newstate = this.state as ManagerState;
    const { module, tables } = newstate;
    const { module: modtable } = tables;
    const { selection } = module;
    const { tableToDataRowMap } = newstate.tables.module;
    const { dataRowIndex: row, tableRowIndex, dataColIndex: col } = cell;
    const drow = modtable.data[row];
    const selrows = selectionToTableRows(selection);
    const datarows = (
      selrows.includes(tableRowIndex) &&
      selrows.every((ri) => ri in modtable.data)
        ? selrows
        : [tableRowIndex]
    ).map((r) => tableToDataRowMap[r] ?? r);
    const wason = drow[col] === ON || drow[ModCol.iInfo].loading;
    const willon = !wason;
    if (drow && col === ModCol.iInstalled) {
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
    } else if (drow && col === ModCol.iRemove) {
      // iRemove column clicks
      const updated = updateModuleRemoveColumn(
        this,
        newstate,
        willon,
        datarows.map((ri) => modtable.data[ri][ModCol.iInfo].conf),
      );
      if (updated) return this.sState(newstate);
    } else if (drow && col === ModCol.iShared) {
      // Shared column clicks
      let updated = false;
      const newv = modtable.data[row][ModCol.iShared] === ON ? OFF : ON;
      const selrows = selectionToTableRows(selection);
      (selrows.includes(tableRowIndex) ? selrows : [tableRowIndex])
        .map((r) => tableToDataRowMap[r] ?? r)
        .forEach((r) => {
          const rrow = modtable.data[r];
          if (rrow && rrow[ModCol.iInstalled] === ON) {
            rrow[ModCol.iShared] = newv;
            updated = true;
          }
        });
      if (updated) {
        tableUpdate(this, newstate, 'module');
        return this.sState(newstate);
      }
    }

    rowSelect(newstate, e, 'module', tableRowIndex);
    this.sState(newstate);
  }
}

export function onRepoCellClick(
  this: ModuleManager,
  e: React.MouseEvent,
  cell: TCellLocation,
) {
  const newstate = this.state as ManagerState;
  const { repository } = newstate;
  const { repository: repotable } = newstate.tables;
  const { tableToDataRowMap } = repotable;
  const { dataRowIndex: row, tableRowIndex, dataColIndex: col } = cell;
  if (repository) {
    const { selection } = repository;
    const selrows = selectionToTableRows(selection);
    const rows = (
      selrows.includes(tableRowIndex) ? selrows : [tableRowIndex]
    ).map((r) => tableToDataRowMap[r] ?? r);
    const switchOn = repotable.data[row][RepCol.iState] === OFF;
    const { editable } = repotable.data[row][RepCol.iInfo];
    if (
      !isRepoBuiltIn(repotable.data[row][RepCol.iInfo].repo) &&
      col === RepCol.iState
    ) {
      switchRepo(this, newstate, rows, switchOn);
    } else if (
      // Don't select the row on editable cell click or double click can't
      // trigger table cell edit!
      (!selrows.includes(tableRowIndex) ||
        !(typeof editable === 'function'
          ? editable(row, col, repotable.data)
          : editable)) &&
      row > -1 &&
      col < RepCol.iState
    ) {
      rowSelect(newstate, e, 'repository', tableRowIndex);
      tableUpdate(this, newstate, 'repository');
      this.sState(newstate);
    }
  }
}

export function onCustomRepositoryEdited(
  this: ModuleManager,
  cell: TCellLocation,
  value: string,
) {
  const newstate = this.state as ManagerState;
  const { repositories, repository } = newstate;
  if (repositories && repository) {
    const { disabled } = repositories;
    const { repository: repotable } = newstate.tables;
    const { dataRowIndex: row, dataColIndex: col } = cell;
    const drow = repotable.data[row];
    if (drow) {
      const repo = clone(drow[RepCol.iInfo].repo);
      const origRepoKey = repositoryKey(repo);
      const enabled = !disabled || !disabled.find((k) => k === origRepoKey);
      let prop: keyof Repository = 'domain';
      if (col === RepCol.iName) prop = 'name';
      if (col === RepCol.iPath) prop = 'path';
      repo[prop] = value;
      if (!repo.domain) repo.domain = '?';
      if (!repo.name) repo.name = '?';
      if (!repo.path) repo.path = 'file://';
      if (installCustomRepository(this, newstate, row, repo, enabled)) {
        switchRepo(this, newstate, [row], enabled);
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
            tableUpdate(this, newstate, ['language', 'module']);
            scrollToSelectedLanguage(this, newstate);
            this.sState(newstate);
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
                  IBTrepo in repositoryListings &&
                  repositoryListings[IBTrepo];
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
            tableUpdate(this, newstate, ['module']);
            this.setState({ infoConfigs: [] });
            break;
          }
          case 'cancel': {
            G.Window.close();
            break;
          }
          case 'ok': {
            const errors: string[] = [];
            let downloadResults: PromiseSettledResult<DownloadType[]>[] = [];
            try {
              downloadResults = await Promise.allSettled(Downloads);
            } catch (er) {
              log.error(er);
              errors.push(`Failed to download all modules.`);
            }
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
            const { module: modtable } = state.tables;
            const install: Parameters<GType['Module']['installDownloads']>[0] =
              [];
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
                              builtInRepos()[row[ModCol.iShared] === ON ? 0 : 1],
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
            )
              .catch((er) => {
                // Module installation errors are reported separately. This only
                // catches uncaught installDownloads() errors.
                log.error(er);
                errors.push(`An error occured installing modules.`);
              })
              .finally(() => {
                G.Module.cancel().catch((er) => log.error(er));
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
              });

            if (errors.length) {
              this.addToast({
                timeout: -1,
                intent: Intent.DANGER,
                message: errors
                  .splice(10)
                  .concat(
                    errors.length > 10
                      ? `Further errors are not reprted...`
                      : '',
                  )
                  .join('\n'),
                icon: 'error',
              });
            } else G.Window.close();
            break;
          }
          case 'repoAdd': {
            const newstate = this.state as ManagerState;
            const { repositories } = newstate;
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
                newstate.language.selection = [];
                this.loadLanguageTable(newstate);
                this.loadModuleTable(newstate);
                tableUpdate(this, newstate);
                this.sState(newstate);
              }
            }
            break;
          }
          case 'repoCancel': {
            const newstate = this.state as ManagerState;
            const { repository: repotable } = newstate.tables;
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
                  r[RepCol.iInfo].loading = false;
                  r[RepCol.iState] = OFF;
                  return {
                    ...r[RepCol.iInfo].repo,
                    file: C.SwordRepoManifest,
                    type: 'ftp',
                  };
                }),
            ).catch((er) => {
              log.error(er);
            });
            tableUpdate(this, newstate, 'repository');
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
  const { disabled } = repositories ?? {};
  const { repository: repotable } = tables;
  const { data } = repotable;
  const repokey = repositoryKey(repo);
  if (
    repositories &&
    !data.find((r) => repositoryKey(r[RepCol.iInfo].repo) === repokey)
  ) {
    const row = repositoryToRow(disabled ?? null, repo);
    row[RepCol.iInfo].classes = repclasses(
      [RepCol.iState],
      ['checkbox-column'],
      ['custom-repo'],
    );
    row[RepCol.iInfo].editable = editable();
    let newindex = repoDataIndex;
    if (newindex === -1) newindex++;
    else if (isRepoCustom(data[newindex][RepCol.iInfo].repo)) {
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
    tableUpdate(xthis, state);
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
      isRepoCustom(data[index][RepCol.iInfo].repo)
    ) {
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
      tableUpdate(xthis, state);
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
  table: 'language',
  row: number,
): string[];
export function rowSelect(
  state: ManagerState,
  e: React.MouseEvent,
  table: 'repository' | 'module',
  row: number,
): RowSelection;
export function rowSelect(
  state: ManagerState,
  e: React.MouseEvent,
  table: (typeof Tables)[number],
  row: number,
): RowSelection | string[] {
  const tbl = state[table];
  let newSelection: RowSelection | string[] = [];
  if (tbl) {
    const { selection } = tbl;
    let rows: number[] = [];
    if (table === 'language') {
      const { data } = state.tables.language;
      rows = selection
        .map((code) => {
          const rx = data.findIndex((r) => r[LanCol.iInfo].code === code);
          return rx === -1 ? 0 : rx;
        })
        .sort((a, b) => a - b);
    } else {
      rows = selectionToTableRows(selection as RowSelection);
    }
    newSelection = tableRowsToSelection(tableSelectDataRows(row, rows, e));
    if (table === 'language') {
      const { data } = state.tables.language;
      newSelection = selectionToTableRows(newSelection).map(
        (r) => data[r][LanCol.iInfo].code,
      );
    }
    if (state[table]) state[table].selection = newSelection;
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
      tableUpdate(xthis, newstate, 'repository');
    }
    return newstate;
  };

  const updateTables = () => {
    const state = xthis.state as ManagerState;
    getListings(state)
      .then((listings) => {
        const newstate = xthis.state as ManagerState;
        handleListings(xthis, newstate, listings);
        newstate.language.selection = [];
        xthis.loadLanguageTable(newstate);
        xthis.loadModuleTable(newstate);
        checkForModuleUpdates(xthis, newstate);
        checkForSuggestions(xthis, newstate);
        tableUpdate(xthis, newstate, ['module', 'language']);
        xthis.sState(newstate);
      })
      .catch((er) => log.error(er));
  };

  const getListings = async (state: ManagerState) => {
    const { tables, repositories } = state;
    const { repository } = tables;
    const { repositoryListings } = repository;
    const { disabled } = repositories ?? {};
    // Only request listings from server when necessary. If the listing has
    // already been retrieved it will not be retrieved again, rather the
    // original listing is used.
    const newrepos: Array<FTPDownload | null> = repository.data.map((r, i) => {
      const { repo } = r[RepCol.iInfo];
      return onOrOff &&
        datarows.includes(i) &&
        (!disabled || !disabled.find((k) => k === repositoryKey(repo))) &&
        !repositoryListings[i]
        ? {
            ...repo,
            file: C.SwordRepoManifest,
            type: 'ftp',
          }
        : null;
    });
    const newlistings = await G.Module.repositoryListing(newrepos);
    return repositoryListings.map((rl, i) => newlistings[i] ?? rl);
  };

  xthis.sState(rowEnableDisable(statex), updateTables);
}

// Handle one or more raw repository listings, also handling any errors
// or cancelations. Also update the language and module tables, checking for
// possible module updates of installed modules.
export function handleListings(
  xthis: ModuleManager,
  state: ManagerState,
  listingsAndErrors: Array<RepositoryListing | string>,
): ManagerState {
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

  tableUpdate(xthis, state, 'repository');

  return state;
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
    if (candidates.length) moduleUpdates.push(candidates[0]);
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
            const newstate = xthis.state as ManagerState;
            if (
              installModuleUpdates(false, xthis, newstate, [mud])
                ? newstate
                : null
            )
              xthis.sState(newstate);
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
  return;
  const xulswordRepo = repositoryKey(builtInRepos()[1]);
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
      xthis,
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
        tableUpdate(xthis, state, 'module');
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
        tableUpdate(xthis, state, 'module');
        row[ModCol.iInstalled] = OFF;
        if (row[ModCol.iInfo].loading) doCancel.push(conf);
        row[ModCol.iInfo].intent = intent(ModCol.iInstalled, 'none');
      }
    }
  });

  if (doCancel) {
    G.Module.cancel(
      doCancel
        .map((c) => getModuleDownload(xthis, repositoryModuleKey(c)))
        .filter(Boolean) as Download[],
    ).catch((er) => log.error(er));
  }

  if (doDownload.length)
    download(xthis, state, doDownload).catch((er) => log.error(er));

  return configs.length;
}

function updateModuleRemoveColumn(
  xthis: ModuleManager,
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
      tableUpdate(xthis, state, 'module');
      if (Array.isArray(setToON) ? setToON[i] : setToON) {
        // removeON is being set to ON...
        if (row[ModCol.iInfo].loading) doCancel.push(conf);
        else row[ModCol.iRemove] = ON;
      } else row[ModCol.iRemove] = OFF;
    }
  });

  if (doCancel) {
    G.Module.cancel(
      doCancel
        .map((c) => getModuleDownload(xthis, repositoryModuleKey(c)))
        .filter(Boolean) as Download[],
    ).catch((er) => log.error(er));
  }

  return configs.length;
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
  const { repositoryListings } = state.tables.repository;
  const [sharedRepo, xulswordLocalRepo] = builtInRepos();
  state.tables.module.data.forEach((drow) => {
    const iShared = drow[ModCol.iShared] == ON;
    const iInstalled = drow[ModCol.iInstalled] === ON;
    const iRemove = drow[ModCol.iRemove] === ON;
    const destRepository = iShared ? sharedRepo : xulswordLocalRepo;
    findRowInstalledModules(state, drow).forEach((conf) => {
      const { sourceRepository } = conf;
      const { module } = conf;
      if (iInstalled) {
        if (iRemove) {
          // Any local module may be removed.
          operations.push({
            module,
            sourceRepository,
            destRepository,
            operation: 'remove',
          });
        } else if (
          // Only move/copy if source is different than destination.
          repositoryKey(sourceRepository) !== repositoryKey(destRepository)
        ) {
          const removeDest = !!repositoryListings
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
            (!isRepoCustom(sourceRepository) || iShared) &&
            !(
              repositoryKey(sourceRepository) ===
                repositoryKey(xulswordLocalRepo) &&
              iShared &&
              removeDest
            )
          ) {
            if (removeDest) {
              operations.push({
                module,
                sourceRepository,
                destRepository,
                operation: 'remove',
              });
            }
            operations.push({
              module,
              sourceRepository,
              destRepository,
              operation: isRepoCustom(sourceRepository) ? 'copy' : 'move',
            });
          }
        }
      }
    });
  });

  return operations;
}

// When a table row shows an installed XSM or remote repo module, return the
// referred local module (or modules in the case of XSM).
function findRowInstalledModules(
  state: ManagerState,
  drow: TModuleTableRow,
): SwordConfType[] {
  const result: SwordConfType[] = [];
  const { repositoryListings } = state.tables.repository;
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
    const [sharedRepo, xulswordLocalRepo] = builtInRepos();
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
        const listing = repositoryListings
          .filter(
            (rl) =>
              rl && rl.length && rl[0] && isRepoCustom(rl[0].sourceRepository),
          )
          .find((l) =>
            l?.find((c) => c.module === module && c.Version === version),
          );
        if (listing && listing.length && listing[0]) [conf] = listing;
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
    const row = data.find(
      (r) => repositoryModuleKey(r[ModCol.iInfo].conf) === k,
    );
    if (row) {
      row[ModCol.iInfo].loading = false;
      row[ModCol.iInfo].intent = intent(ModCol.iInstalled, newintent);
    }
  });
  tableUpdate(xthis, state, 'module');
}

// Perform async repository module downloads corresponding to a given
// set of module configs.
export async function download(
  xthis: ModuleManager,
  state: ManagerState,
  configs: SwordConfType[],
): Promise<void> {
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
        return promptAudioChapters(state, conf)
          .then((audio) => {
            if (!audio) throw new Error(C.UI.Manager.cancelMsg);
            dlobj.data = audio;
            return dlobj;
          })
          .catch((er) => {
            const newstate = state;
            handleError(xthis, newstate, er, [modkey]);
            xthis.sState(newstate);
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
      const newstate = xthis.state as ManagerState;
      const { tables } = newstate;
      const { module: modtable } = tables;
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
      tableUpdate(xthis, newstate, 'module');
      xthis.sState(newstate);
    }
  });
}

// Cause a table to be updated. If state is null, the table update will be
// scheduled immediately, otherwise the passed state will be updated so that
// when the state is set the table will also be updated.
export function tableUpdate(
  xthis: ModuleManager,
  state: ManagerState | null,
  table?: (typeof Tables)[number] | (typeof Tables)[number][],
) {
  const tables: (typeof Tables)[number][] = Array.isArray(table)
    ? table
    : table
      ? [table]
      : ['repository', 'module', 'language'];
  const updated = (state: ManagerState) => {
    tables.forEach((tbl) => {
      const { render } = state.tables[tbl];
      state.tables[tbl].render = render + 1;
      state.tables[tbl].tableToDataRowMap = [];
    });
    return tables.length ? state : null;
  };
  if (!state) xthis.sState(updated);
  else updated(state);
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
export function repositoryToRow(
  disabled: RepoDisabled,
  repo: Repository,
): TRepositoryTableRow {
  const on = builtInRepos()
    .map((r) => repositoryKey(r))
    .includes(repositoryKey(repo))
    ? ALWAYSON
    : ON;
  return [
    repo.name || '?',
    repo.domain,
    repo.path,
    !disabled || !disabled.find((k) => k === repositoryKey(repo)) ? on : OFF,
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

export function scrollToSelectedLanguage(
  xthis: ModuleManager,
  state: ManagerState,
) {
  const { selection } = state.language;
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
