/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable no-nested-ternary */
/* eslint-disable class-methods-use-this */
/* eslint-disable react/sort-comp */
/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React, { SyntheticEvent } from 'react';
import i18n from 'i18next';
import {
  Button,
  Intent,
  IToastProps,
  Position,
  Toaster,
} from '@blueprintjs/core';
import {
  clone,
  diff,
  downloadKey,
  drop,
  isRepoLocal,
  ofClass,
  regionsToRows,
} from '../../common';
import C from '../../constant';
import G from '../rg';
import log from '../log';
import renderToRoot from '../rinit';
import { getStatePref, onSetWindowState } from '../rutil';
import {
  addClass,
  xulDefaultProps,
  XulProps,
  xulPropTypes,
} from '../libxul/xul';
import { Hbox, Vbox, Box } from '../libxul/boxes';
import Groupbox from '../libxul/groupbox';
import Table from '../libxul/table';
import Spacer from '../libxul/spacer';
import DragSizer, { DragSizerVal } from '../libxul/dragsizer';
import './moduleManager.css';

// TODO!: showModuleInfo

import type {
  ModTypes,
  PrefObject,
  Repository,
  RepositoryListing,
  SwordConfType,
} from '../../type';
import type { TCellInfo } from '../libxul/table';

const Tables = {
  repository: ['renderRepoTable', 'repoTableData', 'repoColumnWidths'],
  language: ['renderLangTable', 'langTableData'],
  module: ['renderModTable', 'modTableData', 'modColumnWidths'],
} as const;

type TModuleTableRow = [
  TModCellInfo,
  ModTypes | 'XSM' | 'audio',
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
  typeof ON | typeof OFF
];

type TRepositoryTableRow = [
  TRepCellInfo,
  string,
  string,
  string,
  typeof ON | typeof OFF
];

type TRepCellInfo = TCellInfo & {
  repo: Repository;
};

type TModCellInfo = TCellInfo & {
  repo: Repository;
};

const ON = '☑';
const OFF = '☐';
const ModCol = {
  iType: 1,
  iName: 3,
  iShared: 13,
  iInstalled: 14,
  iAlwaysVisible: [1, 2, 13, 14] as number[],
} as const;
const RepCol = {
  iName: 1,
  iDomain: 2,
  iPath: 3,
  iState: 4,
} as const;

function repositoryToRow(repo: Repository): TRepositoryTableRow {
  return [
    { repo },
    repo.name || '?',
    repo.domain,
    repo.path,
    repo.disabled ? ON : OFF,
  ];
}

function loading(columnIndex: number) {
  return (_ri: number, ci: number) => {
    return ci === columnIndex;
  };
}

function editable() {
  return (_ri: number, ci: number) => {
    return ci < 3;
  };
}

function intent(columnIndex: number, theIntent: Intent) {
  return (_ri: number, ci: number) => {
    return ci === columnIndex ? theIntent : 'none';
  };
}

G.Module.clearDownload();
const Action = {
  download: {} as { [module: string]: Promise<boolean> },
  remove: new Set() as Set<string>,
  share: {} as { [module: string]: boolean },
};

export type RowSelection = { rows: [number, number] }[] | undefined;

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
};

export type ManagerProps = XulProps;

// The following initial state values do not come from Prefs. Neither are
// these state keys written to Prefs.
const notStatePref = {
  language: undefined as RowSelection,
  langTableData: [] as string[][],
  renderLangTable: 0,

  module: undefined as RowSelection,
  modTableData: [] as TModuleTableRow[],
  renderModTable: 0,
  showModuleInfo: false,

  repository: undefined as RowSelection,
  repoTableData: [] as TRepositoryTableRow[],
  renderRepoTable: 0,
};

export interface ManagerStatePref {
  languageTableOpen: boolean;
  languageTableWidth: number;

  modColumnWidths: number[];

  repoColumnWidths: number[];
  customRepos: Repository[];
  disabledRepos: string[];
  repoTableOpen: boolean;
  repoTableHeight: number;
}

export type ManagerState = ManagerStatePref & typeof notStatePref;

export default class ModuleManager extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  // Save table data between resets, but don't save it to prefs.
  static saved: {
    repoTableData: TRepositoryTableRow[];
    rawModuleData: RepositoryListing[];
    modTableData: TModuleTableRow[];
    langTableData: string[][];
  };

  destroy: (() => void)[];

  toaster: Toaster | undefined;

  tableRef: {
    repository: React.RefObject<HTMLDivElement>;
    module: React.RefObject<HTMLDivElement>;
  };

  onRepoColumnWidthChanged;

  onModColumnWidthChanged;

  constructor(props: ManagerProps) {
    super(props);

    if (props.id !== 'downloader') throw Error(`ID must be 'downloader'`);
    const s: ManagerState = {
      ...notStatePref,
      ...(getStatePref(props.id) as ManagerStatePref),
      ...ModuleManager.saved,
    };
    this.state = s;

    this.tableRef = {
      repository: React.createRef(),
      module: React.createRef(),
    };

    this.destroy = [];
    this.switchRepo = this.switchRepo.bind(this);
    this.eventHandler = this.eventHandler.bind(this);
    this.onCellEdited = this.onCellEdited.bind(this);
    this.onRepoColumnWidthChanged = this.onColumnWidthChanged.bind(
      this,
      'repository'
    );
    this.onModColumnWidthChanged = this.onColumnWidthChanged.bind(
      this,
      'module'
    );
    this.loadRepositoryTable = this.loadRepositoryTable.bind(this);
    this.updateRepositoryLists = this.updateRepositoryLists.bind(this);
    this.loadModuleTable = this.loadModuleTable.bind(this);
    this.sizeTableToWindow = this.sizeTableToWindow.bind(this);
    this.setTableState = this.setTableState.bind(this);
  }

  componentDidMount() {
    // Download data for the repository and module tables
    if (!ModuleManager.saved.repoTableData.length) {
      ModuleManager.saved.repoTableData = [];
      ModuleManager.saved.rawModuleData = [];
      G.Downloader.crossWireMasterRepoList()
        .then((repos) => {
          const allrepos = this.loadRepositoryTable(repos);
          return G.Downloader.repositoryListing(allrepos);
        })
        .then((listing) => {
          const data = this.updateRepositoryLists(listing);
          const code = this.loadLanguageTable(data);
          return this.loadModuleTable(code, data);
        })
        .catch(() => {
          this.addToast({
            message: 'Unable to download Master Repository List.',
          });
          // Failed to load master list, so just load local repos.
          ModuleManager.saved.repoTableData = [];
          ModuleManager.saved.rawModuleData = [];
          // eslint-disable-next-line promise/no-nesting
          G.Downloader.repositoryListing(this.loadRepositoryTable())
            .then((listing) => {
              const data = this.updateRepositoryLists(listing);
              const code = this.loadLanguageTable(data);
              return this.loadModuleTable(code, data);
            })
            .catch((err) => log.warn(err));
        });
    }
    this.sizeTableToWindow('repository');
    this.sizeTableToWindow('module');
    this.destroy.push(onSetWindowState(this));
    // Setup progress handlers
    this.destroy.push(
      window.ipc.renderer.on('progress', (prog: number, id?: string) => {
        const state = this.state as ManagerState;
        const { repoTableData, modTableData } = state;
        const repoIndex = repoTableData.findIndex(
          (r) => downloadKey(r[0].repo) === id
        );
        if (id && repoIndex !== -1 && prog === -1) {
          repoTableData[repoIndex][0].loading = false;
          this.setTableState('repository');
        }
        const modIndex = modTableData.findIndex((r) => {
          const { repo } = r[0];
          const module = r[ModCol.iName];
          return [downloadKey(repo), module].join('.') === id;
        });
        if (id && modIndex !== -1 && prog === -1) {
          modTableData[modIndex][0].loading = false;
          this.setTableState('module');
        }
      })
    );
  }

  componentDidUpdate(_prevProps: any, prevState: ManagerState) {
    const state = this.state as ManagerState;
    const { id } = this.props as ManagerProps;
    if (id) {
      const newStatePref = drop(state, notStatePref) as PrefObject;
      const prvStatePref = drop(prevState, notStatePref) as PrefObject;
      const d = diff(prvStatePref, newStatePref);
      if (d) {
        G.Prefs.mergeValue(id, d);
      }
    }
  }

  componentWillUnmount() {
    this.destroy.forEach((func) => func());
    this.destroy = [];
  }

  sizeTableToWindow(table: keyof typeof Tables) {
    const state = this.state as ManagerState;
    if (table === 'language') return;
    const prop = Tables[table][2];
    const columnWidths = state[prop];
    const { tableRef } = this;
    if (tableRef[table].current) {
      const atable = tableRef[table].current as HTMLDivElement | null;
      if (atable) {
        const w = atable.clientWidth;
        const t = columnWidths.reduce((p, c) => (p + c === -1 ? 0 : c), 0);
        const newColumnWidths = columnWidths.map((cw) => {
          return w * (cw / t);
        });
        this.setTableState(table, {
          [prop]: newColumnWidths,
        });
      }
    }
  }

  onColumnWidthChanged(
    table: keyof typeof Tables,
    index: number,
    size: number
  ): void {
    const state = this.state as ManagerState;
    if (table === 'language') return;
    const prop = Tables[table][2];
    const newColumnWidths = state[prop].slice();
    newColumnWidths[index] = size;
    this.setTableState(table, {
      [prop]: newColumnWidths,
    });
    this.sizeTableToWindow(table);
  }

  onCellEdited(row: number, col: number, value: string) {
    const state = clone(this.state) as ManagerState;
    const { repoTableData, customRepos } = state;
    const crindex = customRepos.findIndex(
      (r) => downloadKey(r) === downloadKey(repoTableData[row][0].repo)
    );
    if (crindex !== -1) {
      customRepos.splice(crindex, 1);
    }
    repoTableData[row][col] = value;
    customRepos.push(repoTableData[row][0].repo);
    this.setState({ repoTableData, customRepos });
    if ((col === 1 || col === 2) && repoTableData[row][RepCol.iState] === OFF) {
      setTimeout(() => this.switchRepo([row], true), 100);
    }
  }

  // Load the repository table with built-in repositories, then user-custom
  // repositories, and then others passed in as repos[]. It returns the array
  // of repositories used to create the table.
  loadRepositoryTable(repos?: Repository[]): Repository[] {
    const { customRepos, disabledRepos } = this.state as ManagerState;
    const repoTableData: TRepositoryTableRow[] = [];
    const builtinRepos: Repository[] = [
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
        name: 'Profile',
        domain: 'file://',
        path: G.Dirs.path.xsModsUser,
        file: '',
        builtin: true,
        disabled: false,
        custom: false,
      },
    ];
    customRepos.forEach((cr) => {
      cr.custom = true;
    });
    const allrepos = builtinRepos.concat(customRepos, repos || []);
    allrepos.forEach((repo) => {
      let disabled = false;
      if (!repo.builtin) {
        disabled = disabledRepos.includes(downloadKey(repo));
      }
      repo.disabled = disabled;
      const canedit = repo.custom ? editable() : false;
      const isloading = repo.disabled ? false : loading(3);
      repoTableData.push([
        { loading: isloading, editable: canedit, repo },
        repo.name || '',
        repo.domain,
        repo.path,
        repo.disabled ? OFF : ON,
      ]);
    });
    this.setTableState('repository', { repoTableData });
    return allrepos;
  }

  // Update raw module data and the repository table after receiving repositoryListing.
  // It returns updated rawModuleData.
  updateRepositoryLists(rawModuleData: RepositoryListing[]) {
    const { repoTableData } = this.state as ManagerState;
    rawModuleData.forEach((listing, i) => {
      if (listing !== null) {
        ModuleManager.saved.rawModuleData[i] = listing;
        if (repoTableData[i][RepCol.iState] === ON) {
          repoTableData[i][0].intent = intent(3, 'primary');
          if (typeof listing === 'string' && listing !== 'mods.d') {
            repoTableData[i][0].intent = intent(3, 'danger');
            if (listing) {
              this.addToast({ message: listing });
            }
          }
        } else repoTableData[i][0].intent = intent(3, 'none');
      }
    });
    this.setTableState('repository', { repoTableData });
    return rawModuleData;
  }

  // Load language table with all languages found in the raw data, keeping
  // the selected language the same or else selecting the first one. It
  // returns the selected language code, or null if the table is empty.
  loadLanguageTable(rawModuleData: RepositoryListing[]): string | null {
    const { language, langTableData } = this.state as ManagerState;
    const row = (language && regionsToRows(language)) || [];
    const code = row.length && langTableData[row[0]][0];
    const langs: Set<string> = new Set();
    rawModuleData.forEach((reporow) => {
      if (reporow && typeof reporow !== 'string') {
        reporow.forEach((c) =>
          langs.add((c.Lang && c.Lang.replace(/-.*$/, '')) || '?')
        );
      }
    });
    const newTableData = [Array.from(langs).sort()];
    let sel = (code && newTableData.findIndex((r) => r[0] === code)) || 0;
    if (sel === -1) sel = 0;
    this.setTableState('language', {
      langTableData: newTableData,
      language: [{ rows: [sel, sel] }],
    } as Partial<ManagerState>);
    return code || null;
  }

  // Load the module table with modules sharing the language code,
  // or else with all modules if the code is null or undefined.
  loadModuleTable(fcode: string | null, rawModuleData: RepositoryListing[]) {
    const data: TModuleTableRow[] = [];
    const hostedRepoMods = rawModuleData
      .map((rmd) => {
        if (typeof rmd === 'string') return '';
        return (rmd && rmd.map((c) => c.module)) || null;
      })
      .flat()
      .filter(Boolean);
    const uniqueElements = new Set(hostedRepoMods);
    const multiples = hostedRepoMods.filter((item) => {
      if (uniqueElements.has(item)) {
        uniqueElements.delete(item);
        return false;
      }
      return true;
    });
    multiples.forEach((m) => {
      this.addToast({
        message: `Found more than one ${m} module.`,
      });
    });
    const { repoTableData } = this.state as ManagerState;
    rawModuleData.forEach((listing, i) => {
      if (listing && typeof listing !== 'string') {
        listing.forEach((c) => {
          const code = (c.Lang && c.Lang.replace(/-.*$/, '')) || '?';
          if (
            (!fcode || fcode !== code) &&
            (!isRepoLocal(c.sourceRepository) ||
              !hostedRepoMods.includes(c.module))
          ) {
            data.push([
              { repo: repoTableData[i][0].repo },
              c.moduleType,
              (c.Description &&
                (c.Description[i18n.language] || c.Description.en)) ||
                '?',
              c.module,
              c.sourceRepository.name ||
                `${c.sourceRepository.domain}/${c.sourceRepository.path}`,
              c.Version || '?',
              (c.InstallSize && c.InstallSize.toString()) || '?',
              (c.Feature && c.Feature.join(' ')) || '?',
              c.Versification || 'KJV',
              c.Scope || '?',
              (c.Copyright && (c.Copyright[i18n.language] || c.Copyright.en)) ||
                '?',
              c.DistributionLicense || '?',
              c.SourceType || '?',
              c.shared ? ON : OFF,
              c.installed ? ON : OFF,
            ]);
          }
        });
      }
    });
    const taborder = [C.BIBLE, C.COMMENTARY, C.GENBOOK, C.DICTIONARY];
    const modTableData = data.sort((a, b) => {
      const ta = taborder.indexOf(a[ModCol.iType] as ModTypes);
      const tb = taborder.indexOf(b[ModCol.iType] as ModTypes);
      if (ta > tb) return 1;
      if (ta < tb) return -1;
      return a[2].localeCompare(b[2]);
    });
    this.setTableState('module', { modTableData } as Partial<ManagerState>);
    return true;
  }

  rowSelect(e: React.MouseEvent, table: keyof typeof Tables, row: number) {
    const tableSel = table;
    this.setState((prevState: ManagerState) => {
      const selection = prevState[tableSel];
      const isSelected = selection?.find((r) => r.rows[0] === row);
      const selected =
        e.ctrlKey && !isSelected && selection ? clone(selection) : [];
      if (!isSelected) selected.push({ rows: [row, row] });
      return { [tableSel]: selected };
    });
  }

  // Enable or disable a repository. If onOrOff is undefined it will be toggled.
  // If onOrOff is true it will be enabled, otherwise disabled.
  switchRepo(rows: number[], onOrOff?: boolean) {
    const { disabledRepos: dr, repoTableData: repoTableDataWas } = this
      .state as ManagerState;
    const repoTableData = clone(repoTableDataWas);
    const disabledRepos = dr.slice();
    const reload = repoTableData.map(() => false);
    rows.forEach((r) => {
      const unswitchable = repoTableDataWas[r][0].repo.builtin;
      if (!unswitchable && repoTableDataWas[r][RepCol.iState] === ON) {
        const rowkey = downloadKey(repoTableDataWas[r][0].repo);
        const disabledIndex = disabledRepos.findIndex((drs) => {
          return drs === rowkey;
        });
        if (onOrOff === true || repoTableDataWas[r][RepCol.iState] === OFF) {
          repoTableData[r][RepCol.iState] = ON;
          if (disabledIndex !== -1) disabledRepos.splice(disabledIndex, 1);
          repoTableData[r][0].loading = true;
          reload[r] = true;
        } else {
          if (repoTableData[r][0].loading) {
            G.Downloader.ftpCancel();
            repoTableData[r][0].loading = false;
          }
          if (disabledIndex === -1) disabledRepos.push(rowkey);
          repoTableData[r][RepCol.iState] = OFF;
        }
      }
    });
    this.setTableState('repository', {
      repoTableData,
      disabledRepos,
    });
    if (reload.some((r) => r)) {
      const repos = repoTableData.map((r, i) => (reload[i] ? r[0].repo : null));
      G.Downloader.repositoryListing(repos)
        .then((listing) => {
          const data = this.updateRepositoryLists(listing);
          const code = this.loadLanguageTable(data);
          return this.loadModuleTable(code, data);
        })
        .catch((er) => log.warn(er));
    }
  }

  eventHandler(this: ModuleManager, ev: SyntheticEvent) {
    switch (ev.type) {
      case 'click': {
        const e = ev as React.MouseEvent;
        switch (e.currentTarget.id) {
          case 'cancel': {
            G.Window.close();
            break;
          }
          case 'ok': {
            const { repoTableData } = this.state as ManagerState;
            const sharedDir = G.Dirs.path.xsModsCommon;
            const appmodDir = G.Dirs.path.xsModsUser;
            // Get list of all modules found in local repositories.
            const installed: SwordConfType[] = [];
            repoTableData.forEach((rtd, i) => {
              if (isRepoLocal(rtd[0].repo)) {
                const data = ModuleManager.saved.rawModuleData[i];
                if (Array.isArray(data)) data.forEach((c) => installed.push(c));
              }
            });
            // Remove modules
            Action.remove.forEach((module) => {
              const conf = installed.find((c) => c.module === module);
              if (conf) {
                if (!G.Module.remove(module, conf.sourceRepository.path)) {
                  log.warn(
                    `Failed to remove ${module} from ${conf.sourceRepository.path}`
                  );
                }
              }
            });
            // Move modules
            Object.entries(Action.share).forEach((entry) => {
              const [module, isShared] = entry;
              const conf = installed.find((c) => c.module === module);
              const dir = isShared ? sharedDir : appmodDir;
              if (conf && conf.sourceRepository.path !== dir) {
                if (!G.Module.move(module, conf.sourceRepository.path, dir)) {
                  log.warn(
                    `Failed to move ${module} from ${conf.sourceRepository.path} to ${dir}`
                  );
                }
              }
            });
            // Install downloaded modules
            return Promise.allSettled(Object.values(Action.download))
              .then((results) => {
                results.forEach((result) => {
                  if (result.status !== 'fulfilled') log.warn(result.reason);
                });
                Object.keys(Action.download).forEach((module) => {
                  const path = Action.share[module] ? sharedDir : appmodDir;
                  G.Module.saveDownload(path, module);
                });
                return G.Window.close();
              })
              .catch((er) => log.warn(er));
          }
          case 'repoAdd': {
            const state = this.state as ManagerState;
            const { customRepos, repoTableData } = state as ManagerState;
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
            row[0].classes = ['custom-repo'];
            repoTableData.unshift(row);
            customRepos.push(repo);
            this.setTableState('repository', {
              customRepos,
              repoTableData,
            });
            break;
          }
          case 'repoDelete': {
            const { customRepos, repoTableData, repository } = this
              .state as ManagerState;
            const newTableData = clone(repoTableData);
            const newCustomRepos = clone(customRepos);
            const rawdata = ModuleManager.saved.rawModuleData;
            const rows = (repository && regionsToRows(repository)) || [];
            rows.reverse().forEach((r) => {
              if (repoTableData[r][0].repo.custom) {
                newTableData.splice(r, 1);
                rawdata.splice(r, 1);
                const crIndex = customRepos.findIndex(
                  (ro) =>
                    downloadKey(ro) === downloadKey(repoTableData[r][0].repo)
                );
                if (crIndex !== -1) {
                  newCustomRepos.splice(crIndex, 1);
                }
              }
            });
            this.setTableState('repository', {
              customRepos: newCustomRepos,
              repoTableData: newTableData,
            });
            const code = this.loadLanguageTable(rawdata);
            this.loadModuleTable(code, rawdata);
            break;
          }
          case 'repoCancel':
          case 'moduleCancel': {
            G.Downloader.ftpCancel();
            break;
          }
          default:
        }
        // Handle table cell clicks
        const cell = ofClass(['bp4-table-cell'], e.target);
        if (cell) {
          const rowm = cell.element.className.match(
            /bp4-table-cell-row-(\d+)\b/
          );
          const row = rowm ? Number(rowm[1]) : -1;
          const colm = cell.element.className.match(
            /bp4-table-cell-col-(\d+)\b/
          );
          const col = colm ? Number(colm[1]) : -1;
          if (row !== -1 && col !== -1) {
            const table = ofClass(
              ['languagetable', 'moduletable', 'repositorytable'],
              cell.element
            );
            if (table && table.type === 'repositorytable') {
              // RepositoryTable
              if (row > -1 && col < 3) this.rowSelect(e, 'repository', row);
              if (col === 3) this.switchRepo([row]);
            } else if (table && table.type === 'languagetable') {
              // LanguageTable
              this.rowSelect(e, 'language', row);
              const { langTableData } = this.state as ManagerState;
              const data = ModuleManager.saved.rawModuleData;
              const code = langTableData[row][0];
              this.loadModuleTable(code, data);
            } else if (table && table.type === 'moduletable') {
              // ModuleTable
              this.rowSelect(e, 'module', row);
              const state = this.state as ManagerState;
              const { modTableData } = state as ManagerState;
              const module = modTableData[row][ModCol.iName] as string;
              const was = modTableData[row][col];
              const is = was === ON ? OFF : ON;
              if (col === ModCol.iInstalled) {
                // Column: installed
                modTableData[row][col] = is;
                const { repo } = modTableData[row][0];
                if (is === OFF) {
                  Action.remove.add(module);
                  if (module in Action.download) {
                    G.Module.clearDownload(module);
                    delete Action.download[module];
                    modTableData[row][0].loading = false;
                    modTableData[row][0].intent = intent(13, 'none');
                  }
                } else {
                  Action.share[module] =
                    modTableData[row][ModCol.iShared] === ON;
                  if (Action.remove.has(module)) Action.remove.delete(module);
                  modTableData[row][0].loading = loading(13);
                  Action.download[module] = G.Module.download(
                    module,
                    repo
                  ).then((dl) => {
                    modTableData[row][0].intent = intent(
                      13,
                      dl ? 'primary' : 'danger'
                    );
                    return dl;
                  });
                }
                this.setTableState('module', {
                  modTableData,
                } as Partial<ManagerState>);
              } else if (col === ModCol.iShared) {
                // Column: shared
                modTableData[row][col] = is;
                Action.share[module] = is === ON;
                this.setTableState('module', {
                  modTableData,
                } as Partial<ManagerState>);
              }
            }
          }
        }
        break;
      }
      default:
        throw Error(`Unhandled moddown event type ${ev.type}`);
    }
    return true;
  }

  // Set table state, save the data for window re-renders, and re-render the table.
  setTableState(table: keyof typeof Tables, s?: Partial<ManagerState>) {
    // Two steps must be used for statePrefs to be written to Prefs
    // before the reset will read them.
    if (s) this.setState(s);
    this.setState((prevState: ManagerState) => {
      const renderTable = Tables[table][0];
      const tableData = Tables[table][1];
      let render = prevState[renderTable];
      ModuleManager.saved[tableData] = prevState[tableData] as any;
      render += 1;
      return {
        [renderTable]: render,
      };
    });
  }

  refHandlers = {
    toaster: (ref: Toaster) => {
      this.toaster = ref;
    },
  };

  addToast(toast: IToastProps) {
    toast.timeout = 5000;
    toast.intent = 'warning';
    if (this.toaster) this.toaster.show(toast);
  }

  render() {
    const state = this.state as ManagerState;
    const props = this.props as ManagerProps;
    const {
      language,
      langTableData,
      languageTableOpen,
      languageTableWidth,
      renderLangTable,

      module,
      modTableData,
      modColumnWidths,
      showModuleInfo,
      renderModTable,

      repository,
      repoTableOpen,
      repoTableHeight,
      repoColumnWidths,
      repoTableData,
      renderRepoTable,
    } = state;
    const {
      eventHandler,
      onCellEdited,
      onRepoColumnWidthChanged,
      onModColumnWidthChanged,
      tableRef,
    } = this;

    const disable = {
      moduleInfo: !module,
      moduleInfoBack: false,
      moduleCancel: !modTableData.find((r) => r[0].loading),
      repoAdd: false,
      repoDelete:
        !repository ||
        !regionsToRows(repository).every(
          (r) => repoTableData[r] && repoTableData[r][0].repo.custom
        ),
      repoCancel: !modTableData.find((r) => r[0].loading),
    };

    return (
      <Vbox {...addClass('modulemanager', props)} flex="1" height="100%">
        <Toaster
          canEscapeKeyClear
          position={Position.TOP}
          usePortal
          ref={this.refHandlers.toaster}
        />
        <Hbox className="language-pane" flex="1">
          {languageTableOpen && (
            <>
              <Groupbox
                caption={i18n.t('menu.options.language')}
                orient="vertical"
                width={languageTableWidth}
              >
                <Box flex="1" onClick={eventHandler}>
                  <Table
                    key={renderLangTable}
                    data={langTableData}
                    selectedRegions={language}
                  />
                </Box>
                <Button
                  id="languageListClose"
                  icon="chevron-left"
                  fill
                  onClick={() => this.setState({ languageListOpen: false })}
                />
              </Groupbox>
              <DragSizer
                onDragStart={() => state.languageTableWidth}
                onDragging={(_e: React.MouseEvent, v: DragSizerVal) =>
                  this.setState({ languageListPanelWidth: v.sizerPos })
                }
                min={75}
                max={250}
                orient="vertical"
              />
            </>
          )}
          {!languageTableOpen && (
            <Groupbox orient="vertical">
              <Vbox flex="1">
                <Button
                  id="languageListOpen"
                  icon="chevron-right"
                  style={{ height: '100%' }}
                  onClick={() => this.setState({ languageListOpen: true })}
                />
              </Vbox>
            </Groupbox>
          )}

          <Groupbox
            caption={i18n.t('menu.addNewModule.label')}
            orient="horizontal"
            flex="1"
          >
            <Hbox flex="1">
              {showModuleInfo && <div id="moduleInfo">Module Information</div>}
              {!showModuleInfo && (
                <Box flex="1">
                  <Table
                    className="module-table"
                    key={renderModTable}
                    data={modTableData}
                    selectedRegions={module}
                    columnWidths={modColumnWidths}
                    domref={tableRef.module}
                    onColumnWidthChanged={onModColumnWidthChanged}
                    onClick={eventHandler}
                  />
                </Box>
              )}
            </Hbox>
            <Vbox className="button-stack" pack="center">
              {!showModuleInfo && (
                <Button
                  id="moduleInfo"
                  icon="info-sign"
                  intent="primary"
                  disabled={disable.moduleInfo}
                  onClick={eventHandler}
                />
              )}
              {showModuleInfo && (
                <Button
                  id="moduleInfoBack"
                  intent="primary"
                  disabled={disable.moduleInfoBack}
                  onClick={eventHandler}
                >
                  {i18n.t('back.label')}
                </Button>
              )}
              <Button
                id="moduleCancel"
                intent="primary"
                disabled={disable.moduleCancel}
                onClick={eventHandler}
              >
                {i18n.t('cancel.label')}
              </Button>
            </Vbox>
          </Groupbox>
        </Hbox>

        {repoTableOpen && (
          <div>
            <DragSizer
              onDragStart={() => state.repoTableHeight}
              onDragEnd={(_e: React.MouseEvent, v: DragSizerVal) =>
                this.setState({ repoListPanelHeight: v.sizerPos })
              }
              orient="horizontal"
              shrink
            />
            <Groupbox
              caption={i18n.t('moduleSources.label')}
              height={repoTableHeight}
              orient="horizontal"
              flex="1"
            >
              <Box flex="1">
                {!!repoTableData.length && (
                  <Table
                    className="repository-table"
                    key={renderRepoTable}
                    data={repoTableData}
                    selectedRegions={repository}
                    columnWidths={repoColumnWidths}
                    domref={tableRef.repository}
                    onClick={eventHandler}
                    onColumnWidthChanged={onRepoColumnWidthChanged}
                    onEditableCellChanged={onCellEdited}
                  />
                )}
              </Box>
              <Vbox className="button-stack" pack="center">
                <Button
                  id="repoAdd"
                  icon="add"
                  intent="primary"
                  disabled={disable.repoAdd}
                  onClick={eventHandler}
                />
                <Button
                  id="repoDelete"
                  icon="delete"
                  intent="primary"
                  disabled={disable.repoDelete}
                  onClick={eventHandler}
                />
                <Button
                  id="repoCancel"
                  intent="primary"
                  disabled={disable.repoCancel}
                  onClick={eventHandler}
                >
                  {i18n.t('cancel.label')}
                </Button>
              </Vbox>
            </Groupbox>
          </div>
        )}

        <Hbox className="dialogbuttons" pack="end" align="end">
          {repoTableOpen && (
            <Button onClick={() => this.setState({ repoListOpen: false })}>
              {i18n.t('less.label')}
            </Button>
          )}
          {!repoTableOpen && (
            <Button onClick={() => this.setState({ repoListOpen: true })}>
              {i18n.t('moduleSources.label')}
            </Button>
          )}
          <Spacer flex="1" />
          <Button id="cancel" onClick={eventHandler}>
            {i18n.t('cancel.label')}
          </Button>
          <Button id="ok" onClick={eventHandler}>
            {i18n.t('ok.label')}
          </Button>
        </Hbox>
      </Vbox>
    );
  }
}
ModuleManager.defaultProps = defaultProps;
ModuleManager.propTypes = propTypes;
ModuleManager.saved = {
  repoTableData: [],
  modTableData: [],
  langTableData: [],
  rawModuleData: [],
};

renderToRoot(<ModuleManager id="downloader" />);
