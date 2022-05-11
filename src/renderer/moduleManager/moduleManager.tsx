/* eslint-disable @typescript-eslint/no-use-before-define */
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
  modrepKey,
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
// TODO!: support remote repos w/o mods.d.tar.gz

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
  language: ['renderLangTable', 'langTableData', null],
  module: ['renderModTable', 'modTableData', 'modColumnWidths'],
} as const;

type TLanguageTableRow = [TCellInfo, string];

const LanguageTableHeadings = [''];

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
  () => typeof ON | typeof OFF | '',
  typeof ON | typeof OFF
];

const ModuleTableHeadings = [
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

type TRepositoryTableRow = [
  TRepCellInfo,
  string,
  string,
  string,
  typeof ON | typeof OFF | typeof ALWAYS_ON
];

const RepositoryTableHeadings = ['', '', '', ''];

type TRepCellInfo = TCellInfo & {
  repo: Repository;
};

type TModCellInfo = TCellInfo & {
  shared: boolean;
  repo: Repository;
};

const ON = '☑';
const OFF = '☐';
const ALWAYS_ON = '￭';
const LanCol = {
  iCode: 1,
} as const;
const ModCol = {
  iType: 1,
  iAbout: 2,
  iModule: 3,
  iRepoName: 4,
  iVersion: 5,
  iSize: 6,
  iFeatures: 7,
  iVersification: 8,
  iScope: 9,
  iCopyright: 10,
  iLicense: 11,
  iSourceType: 12,
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
    name: '',
    domain: 'file://',
    path: G.Dirs.path.xsModsUser,
    file: '',
    builtin: true,
    disabled: false,
    custom: false,
  },
];

G.Module.clearDownload();
const Downloads: {
  [modrepoKey: string]: {
    nfiles: Promise<number | null>;
    failed: boolean;
  };
} = {};

export type RowSelection = { rows: [number, number] }[];

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
  language: [] as RowSelection,
  langTableData: [] as TLanguageTableRow[],
  renderLangTable: 0,

  module: [] as RowSelection,
  modTableData: [] as TModuleTableRow[],
  renderModTable: 0,
  showModuleInfo: false,

  repository: [] as RowSelection,
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
    repositoryListings: RepositoryListing[];
    moduleData: { [module: string]: TModuleTableRow };
    moduleLangData: { [langcode: string]: TModuleTableRow[] };
    modTableData: TModuleTableRow[];
    langTableData: TLanguageTableRow[];
  };

  destroy: (() => void)[];

  toaster: Toaster | undefined;

  tableRef: {
    repository: React.RefObject<HTMLDivElement>;
    module: React.RefObject<HTMLDivElement>;
  };

  onRepoColumnWidthChanged;

  onModColumnWidthChanged;

  sState: (
    s: Partial<ManagerState> | ((prevState: ManagerState) => void)
  ) => void;

  constructor(props: ManagerProps) {
    super(props);

    if (props.id !== 'downloader') throw Error(`ID must be 'downloader'`);
    const s: ManagerState = {
      ...notStatePref,
      ...(getStatePref(props.id) as ManagerStatePref),
      langTableData: ModuleManager.saved.langTableData,
      modTableData: ModuleManager.saved.modTableData,
      repoTableData: ModuleManager.saved.repoTableData,
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
    this.sState = this.setState.bind(this);
    this.moduleTableData = this.moduleTableData.bind(this);
  }

  componentDidMount() {
    // Download data for the repository and module tables
    if (!ModuleManager.saved.repoTableData.length) {
      ModuleManager.saved.repoTableData = [];
      ModuleManager.saved.repositoryListings = [];
      G.Downloader.crossWireMasterRepoList()
        .then((repos) => {
          if (!repos) throw new Error(`Canceled`);
          const allrepos = this.loadRepositoryTable(repos);
          return G.Downloader.repositoryListing(allrepos);
        })
        .then((listing) => {
          if (!listing) throw new Error(`Canceled`);
          this.updateRepositoryLists(listing);
          return this.loadModuleTable(this.loadLanguageTable());
        })
        .catch((er: Error) => {
          this.addToast({
            message: `Unable to download Master Repository List (${er.message})`,
          });
          // Failed to load master list, so just load local repos.
          ModuleManager.saved.repoTableData = [];
          ModuleManager.saved.repositoryListings = [];
          // eslint-disable-next-line promise/no-nesting
          G.Downloader.repositoryListing(this.loadRepositoryTable())
            .then((listing) => {
              if (!listing) throw new Error(`Canceled`);
              this.updateRepositoryLists(listing);
              return this.loadModuleTable(this.loadLanguageTable());
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
          const module = r[ModCol.iModule];
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
        const t = columnWidths.reduce((p, c) => p + (c === -1 ? 0 : c), 0);
        const newColumnWidths = columnWidths.map((cw) => {
          return cw === -1 ? -1 : w * (cw / t);
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
    this.sState({ repoTableData, customRepos });
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
      const css = classes([RepCol.iState], ['checkbox-column']);
      const canedit = repo.custom ? editable() : false;
      const isloading = repo.disabled ? false : loading(RepCol.iState);
      const on = repo.builtin ? ALWAYS_ON : ON;
      repoTableData.push([
        { loading: isloading, editable: canedit, classes: css, repo },
        repo.name || '',
        repo.domain,
        repo.path,
        repo.disabled ? OFF : on,
      ]);
    });
    this.setTableState('repository', { repoTableData });
    return allrepos;
  }

  // Update raw module data and the repository table after receiving repositoryListing.
  // It returns updated rawModuleData.
  updateRepositoryLists(rawModuleData: RepositoryListing[]) {
    const { repoTableData } = this.state as ManagerState;
    const { repositoryListings } = ModuleManager.saved;
    rawModuleData.forEach((listing, i) => {
      if (listing === null) return;
      if (typeof listing === 'string') {
        this.addToast({ message: listing });
        repoTableData[i][0].intent = intent(RepCol.iState, 'danger');
        if (!Array.isArray(repositoryListings[i])) repositoryListings[i] = null;
        return;
      }
      if (Array.isArray(listing)) {
        repositoryListings[i] = listing;
        if ([ON, ALWAYS_ON].includes(repoTableData[i][RepCol.iState])) {
          repoTableData[i][0].intent = intent(RepCol.iState, 'success');
        }
      }
    });
    this.setTableState('repository', { repoTableData });
    return true;
  }

  // Load language table with all languages found in the saved repositoryListings
  // data, keeping the selection the same when possible. It returns the new
  // selection.
  loadLanguageTable(): RowSelection {
    const state = this.state as ManagerState;
    const { language, langTableData, repoTableData } = state;
    const { repositoryListings } = ModuleManager.saved;
    const selectedRowIndexes = regionsToRows(language);
    const selectedcodes = langTableData
      .filter((_r, i) => selectedRowIndexes.includes(i))
      .map((r) => r[LanCol.iCode]);
    const langs: Set<string> = new Set();
    repositoryListings.forEach((listing, i) => {
      if (Array.isArray(listing) && repoTableData[i][RepCol.iState] === ON) {
        listing.forEach((c) => {
          const l = c.Lang || 'en';
          langs.add(l.replace(/-.*$/, ''));
        });
      }
    });
    const langlist = Array.from(langs).sort();
    const newTableData: TLanguageTableRow[] = [];
    langlist.forEach((l) => newTableData.push([{}, l]));
    const newlanguage: RowSelection = [];
    newTableData.forEach((r, i) => {
      if (selectedcodes?.includes(r[LanCol.iCode])) {
        newlanguage.push({ rows: [i, i] });
      }
    });
    this.setTableState('language', {
      langTableData: newTableData,
      language: newlanguage,
    } as Partial<ManagerState>);
    return newlanguage;
  }

  // Load the module table with modules sharing the language code,
  // or else with all modules if the code is null.
  loadModuleTable(languageSelection: RowSelection) {
    // Insure there is one moduleData row object for each module in
    // each repository. The same object should be reused throughout
    // the lifetime of the window, so user interactions will be recorded.
    const { repoTableData } = this.state as ManagerState;
    ModuleManager.saved.moduleLangData = { allmodules: [] };
    const { moduleData, moduleLangData, repositoryListings } =
      ModuleManager.saved;
    const externModules: { [modunique: string]: string } = {};
    const localModules: { [modunique: string]: string } = {};
    repositoryListings.forEach((listing, i) => {
      if (Array.isArray(listing)) {
        listing.forEach((c) => {
          const { repo } = repoTableData[i][0];
          const repokey = downloadKey(repo);
          const modkey = [repokey, c.module].join('.');
          const modunique = [c.module, c.Version].join('.');
          const repoIsLocal = isRepoLocal(c.sourceRepository);
          if (repoIsLocal) localModules[modunique] = repokey;
          else externModules[modunique] = repokey;
          if (!(modkey in moduleData)) {
            const d = [] as unknown as TModuleTableRow;
            d[0] = {
              repo,
              shared: repokey === downloadKey(builtinRepos[0]),
              classes: classes(
                [ModCol.iShared, ModCol.iInstalled],
                ['checkbox-column']
              ),
            };
            d[ModCol.iType] = c.moduleType;
            d[ModCol.iAbout] =
              (c.Description &&
                (c.Description[i18n.language] || c.Description.en)) ||
              '?';
            d[ModCol.iModule] = c.module;
            d[ModCol.iRepoName] = repo.name || `${repo.domain}/${repo.path}`;
            d[ModCol.iVersion] = c.Version || '?';
            d[ModCol.iSize] =
              (c.InstallSize && c.InstallSize.toString()) || '?';
            d[ModCol.iFeatures] = (c.Feature && c.Feature.join(', ')) || '?';
            d[ModCol.iVersification] = c.Versification || 'KJV';
            d[ModCol.iScope] = c.Scope || '?';
            d[ModCol.iCopyright] =
              (c.Copyright && (c.Copyright[i18n.language] || c.Copyright.en)) ||
              '?';
            d[ModCol.iLicense] = c.DistributionLicense || '?';
            d[ModCol.iSourceType] = c.SourceType || '?';
            d[ModCol.iShared] = () => {
              if (d[ModCol.iInstalled] === OFF) return '';
              return d[0].shared ? ON : OFF;
            };
            d[ModCol.iInstalled] = repoIsLocal ? ON : OFF;
            moduleData[modkey] = d;
          }
        });
      }
    });
    // Installed modules (ie those in local repos) which are from enabled
    // remote repositories are not included in moduleLangData. Rather the
    // 'installed' box is checked on the corresponding remote repository
    //  module. Also, modules in disabled repositories are not included.
    repositoryListings.forEach((listing, i) => {
      if (Array.isArray(listing) && repoTableData[i][RepCol.iState] === ON) {
        listing.forEach((c) => {
          const { repo } = repoTableData[i][0];
          const repokey = downloadKey(repo);
          const modkey = [repokey, c.module].join('.');
          const modrow = moduleData[modkey];
          const modunique = [
            modrow[ModCol.iModule],
            modrow[ModCol.iVersion],
          ].join('.');
          const repoIsLocal = isRepoLocal(repo);
          if (repoIsLocal && modunique in externModules) return;
          if (!repoIsLocal && modunique in localModules) {
            modrow[ModCol.iInstalled] = ON;
          }
          const code = (c.Lang && c.Lang.replace(/-.*$/, '')) || 'en';
          if (!(code in moduleLangData)) moduleLangData[code] = [];
          moduleLangData[code].push(modrow);
          moduleLangData.allmodules.push(modrow);
        });
      }
    });
    let { language } = this.state as ManagerState;
    if (languageSelection) language = languageSelection;
    this.setTableState('module', {
      modTableData: this.moduleTableData(language),
    });
    return true;
  }

  moduleTableData(languageSelection: RowSelection): TModuleTableRow[] {
    const { langTableData } = this.state as ManagerState;
    const rows = regionsToRows(languageSelection);
    const codes: string[] = [];
    rows.forEach((r) => {
      codes.push(langTableData[r][LanCol.iCode]);
    });
    const { moduleLangData } = ModuleManager.saved;
    // Select the appropriate moduleLangData lists.
    let tableData: TModuleTableRow[] = moduleLangData.allmodules;
    if (codes.length) {
      tableData = Object.entries(moduleLangData)
        .filter((ent) => codes.includes(ent[0]))
        .map((ent) => ent[1])
        .flat();
    }
    // Return sorted rows.
    const taborder = [C.BIBLE, C.COMMENTARY, C.GENBOOK, C.DICTIONARY];
    return tableData.sort((a: TModuleTableRow, b: TModuleTableRow) => {
      const ta = taborder.indexOf(a[ModCol.iType] as ModTypes);
      const tb = taborder.indexOf(b[ModCol.iType] as ModTypes);
      if (ta > tb) return 1;
      if (ta < tb) return -1;
      return a[ModCol.iModule].localeCompare(b[ModCol.iModule]);
    });
  }

  rowSelect(e: React.MouseEvent, table: keyof typeof Tables, row: number) {
    const tableSel = table;
    let newselection: RowSelection = [];
    this.sState((prevState) => {
      const selection = prevState[tableSel];
      const isSelected = selection?.find((r) => r.rows[0] === row);
      const selected =
        e.ctrlKey && !isSelected && selection ? clone(selection) : [];
      if (!isSelected) selected.push({ rows: [row, row] });
      newselection = clone(selected);
      return { [tableSel]: selected };
    });
    return newselection;
  }

  // Enable or disable a repository. If onOrOff is undefined it will be toggled.
  // If onOrOff is true it will be enabled, otherwise disabled.
  switchRepo(rows: number[], onOrOff?: boolean) {
    const { disabledRepos: dr, repoTableData: repoTableDataWas } = this
      .state as ManagerState;
    const repoTableData = clone(repoTableDataWas);
    const disabledRepos = dr.slice();
    rows.forEach((r) => {
      const unswitchable = repoTableDataWas[r][0].repo.builtin;
      if (!unswitchable) {
        const rowkey = downloadKey(repoTableDataWas[r][0].repo);
        const disabledIndex = disabledRepos.findIndex((drs) => {
          return drs === rowkey;
        });
        if (onOrOff === true || repoTableDataWas[r][RepCol.iState] === OFF) {
          repoTableData[r][RepCol.iState] = ON;
          repoTableData[r][0].repo.disabled = false;
          if (disabledIndex !== -1) disabledRepos.splice(disabledIndex, 1);
          repoTableData[r][0].loading = loading(3);
        } else {
          repoTableData[r][RepCol.iState] = OFF;
          repoTableData[r][0].repo.disabled = true;
          if (disabledIndex === -1) disabledRepos.push(rowkey);
          if (repoTableData[r][0].loading) {
            G.Downloader.ftpCancel();
            repoTableData[r][0].loading = false;
          }
          repoTableData[r][0].intent = intent(RepCol.iState, 'none');
        }
      }
    });
    this.setTableState('repository', {
      repoTableData,
      disabledRepos,
    });
    const repos = repoTableData.map((r, i) =>
      rows.includes(i) ? r[0].repo : null
    );
    G.Downloader.repositoryListing(repos)
      .then((listing) => {
        if (!listing) throw new Error(`Canceled`);
        this.updateRepositoryLists(listing);
        return this.loadModuleTable(this.loadLanguageTable());
      })
      .catch((er) => log.warn(er));
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
            const { moduleData } = ModuleManager.saved;
            // Get a list of all currently installed modules (those found in any
            // enabled local repository).
            const installed: SwordConfType[] = [];
            repoTableData.forEach((rtd, i) => {
              if (isRepoLocal(rtd[0].repo)) {
                const listing = ModuleManager.saved.repositoryListings[i];
                if (Array.isArray(listing)) {
                  listing.forEach((c) => installed.push(c));
                }
              }
            });
            // Remove modules
            Object.values(moduleData).forEach((row) => {
              if (row[ModCol.iInstalled] === OFF) {
                const module = row[ModCol.iModule];
                const { repo } = row[0];
                const modrepok = modrepKey(module, repo);
                const conf = installed.find((c) => c.module === module);
                if (modrepok in Downloads) {
                  if (!G.Module.clearDownload(module, repo)) {
                    log.warn(`Failed to clear ${module} from downloads`);
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
              const { shared } = row[0];
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
            // Install downloaded modules
            const downloadKeys = Object.keys(Downloads);
            return Promise.allSettled(Object.values(Downloads.nfiles))
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
                        downloadKey(r[0].repo) === repokey &&
                        r[ModCol.iModule] === module
                      );
                    });
                    if (row && row[ModCol.iInstalled]) {
                      saves.push({
                        module: row[ModCol.iModule],
                        fromRepo: row[0].repo,
                        toRepo: builtinRepos[row[0].shared ? 0 : 1],
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
            row[0].classes = classes(
              [RepCol.iState],
              ['checkbox-column'],
              ['custom-repo']
            );
            row[0].editable = editable();
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
            const rawdata = ModuleManager.saved.repositoryListings;
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
            this.loadModuleTable(this.loadLanguageTable());
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
          const colm = cell.element.className.match(/data-column-(\d+)\b/);
          const col = colm ? Number(colm[1]) : -1;
          if (row !== -1 && col !== -1) {
            const table = ofClass(
              ['language', 'module', 'repository'],
              cell.element
            );
            if (table && table.type === 'repository') {
              // RepositoryTable
              if (col === RepCol.iState) this.switchRepo([row]);
              else if (row > -1 && col < RepCol.iState) {
                this.rowSelect(e, 'repository', row);
              }
            } else if (table && table.type === 'language') {
              // LanguageTable
              this.loadModuleTable(this.rowSelect(e, 'language', row));
            } else if (table && table.type === 'module') {
              // ModuleTable
              const state = this.state as ManagerState;
              const { modTableData } = state as ManagerState;
              if (col === ModCol.iInstalled && !modTableData[row][0].loading) {
                const was = modTableData[row][col];
                const is = was === ON ? OFF : ON;
                // Column: installed
                if (is === ON) {
                  const k = modrepKey(
                    modTableData[row][ModCol.iModule],
                    modTableData[row][0].repo
                  );
                  if (k in Downloads && !Downloads[k].failed) {
                    modTableData[row][ModCol.iInstalled] = ON;
                    this.setTableState('module', { modTableData });
                  } else this.download(row);
                } else {
                  modTableData[row][col] = OFF;
                  modTableData[row][0].intent = intent(
                    ModCol.iInstalled,
                    'none'
                  );
                  this.setTableState('module', { modTableData });
                }
              } else if (col === ModCol.iShared) {
                // Column: shared
                modTableData[row][0].shared = !modTableData[row][0].shared;
                this.setTableState('module', {
                  modTableData,
                } as Partial<ManagerState>);
              } else {
                this.rowSelect(e, 'module', row);
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

  download(row: number): void {
    const { modTableData } = ModuleManager.saved;
    const module = modTableData[row][ModCol.iModule] as string;
    const { repo } = modTableData[row][0];
    modTableData[row][0].loading = loading(ModCol.iInstalled);
    this.setTableState('module', { modTableData });
    const modrepk = modrepKey(module, repo);
    const nfiles = G.Module.download(module, repo)
      .then((dl) => {
        modTableData[row][0].loading = false;
        let newintent: Intent = 'success';
        if (dl === null) {
          this.addToast({ message: `Canceled` });
          newintent = 'danger';
        } else {
          modTableData[row][ModCol.iInstalled] = ON;
          Downloads[modrepk].failed = false;
        }
        modTableData[row][0].intent = intent(ModCol.iInstalled, newintent);
        this.setTableState('module', { modTableData });
        return dl;
      })
      .catch((er) => {
        log.error(er);
        modTableData[row][0].loading = false;
        modTableData[row][0].intent = intent(ModCol.iInstalled, 'danger');
        this.setTableState('module', { modTableData });
        return null;
      });
    Downloads[modrepk] = { nfiles, failed: true };
  }

  // Set table state, save the data for window re-renders, and re-render the table.
  setTableState(table: keyof typeof Tables, s?: Partial<ManagerState>) {
    const renderTable = Tables[table][0];
    const tableData = Tables[table][1];
    const state = this.state as ManagerState;
    // Two steps must be used for statePrefs to be written to Prefs
    // before the reset will read them.
    if (s) this.sState(s);
    const tableDataVal = ((s && s[tableData]) || state[tableData]) as any;
    ModuleManager.saved[tableData] = tableDataVal;
    this.sState((prevState) => {
      let render = prevState[renderTable];
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
      repoCancel: !repoTableData.find((r) => r[0].loading),
    };

    return (
      <Vbox {...addClass('modulemanager', props)} flex="1" height="100%">
        <Toaster
          canEscapeKeyClear
          position={Position.TOP}
          usePortal
          ref={this.refHandlers.toaster}
        />
        <Hbox flex="1">
          {languageTableOpen && (
            <>
              <Groupbox
                caption={i18n.t('menu.options.language')}
                orient="vertical"
                width={languageTableWidth}
              >
                <Box flex="1" onClick={eventHandler}>
                  <Table
                    className="language"
                    key={renderLangTable}
                    columnHeadings={LanguageTableHeadings}
                    data={langTableData}
                    selectedRegions={language}
                  />
                </Box>
                <Button
                  id="languageListClose"
                  icon="chevron-left"
                  fill
                  onClick={() => this.sState({ languageTableOpen: false })}
                />
              </Groupbox>
              <DragSizer
                onDragStart={() => state.languageTableWidth}
                onDragEnd={(_e: React.MouseEvent, v: DragSizerVal) =>
                  this.sState({ languageTableWidth: v.sizerPos })
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
                  onClick={() => this.sState({ languageTableOpen: true })}
                />
              </Vbox>
            </Groupbox>
          )}

          <Groupbox
            caption={i18n.t('chooseModule.label')}
            orient="horizontal"
            flex="1"
          >
            <Hbox flex="1">
              {showModuleInfo && <div id="moduleInfo">Module Information</div>}
              {!showModuleInfo && (
                <Table
                  flex="1"
                  className="module"
                  key={renderModTable}
                  data={modTableData}
                  selectedRegions={module}
                  columnHeadings={ModuleTableHeadings}
                  columnWidths={modColumnWidths}
                  domref={tableRef.module}
                  onColumnWidthChanged={onModColumnWidthChanged}
                  onClick={eventHandler}
                />
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
                this.sState({ repoTableHeight: v.sizerPos })
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
                    flex="1"
                    className="repository"
                    key={renderRepoTable}
                    data={repoTableData}
                    selectedRegions={repository}
                    columnHeadings={RepositoryTableHeadings}
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
            <Button onClick={() => this.sState({ repoTableOpen: false })}>
              {i18n.t('less.label')}
            </Button>
          )}
          {!repoTableOpen && (
            <Button onClick={() => this.sState({ repoTableOpen: true })}>
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
  repositoryListings: [],
  moduleData: {},
  moduleLangData: {},
};

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

function classes(
  columnIndexArray: number[],
  theClasses: string[],
  wholeRowClasses?: string[]
) {
  return (_ri: number, ci: number) => {
    const cs = wholeRowClasses || [];
    if (columnIndexArray.includes(ci))
      theClasses.forEach((c) => {
        if (!cs.includes(c)) cs.push(c);
      });
    return cs;
  };
}

renderToRoot(<ModuleManager id="downloader" />);
