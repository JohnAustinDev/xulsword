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
  ProgressBar,
  Toaster,
} from '@blueprintjs/core';
import {
  clone,
  diff,
  downloadKey,
  drop,
  isRepoLocal,
  modrepKey,
  moduleInfoHTML,
  ofClass,
  selectionToRows,
  sanitizeHTML,
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

// TODO!: showModuleInfo CSS
// TODO!: Add new custom repos and new modules are created!
// TODO!: Add XSM and audio support
// TODO!: return newmods
// TODO!: Fix column sort and add column selector to menu.s

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
  conf: SwordConfType;
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
    name: i18n.t('programTitle'),
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
  showModuleInfo: '',

  repository: [] as RowSelection,
  repoTableData: [] as TRepositoryTableRow[],
  renderRepoTable: 0,
  progress: null as number[] | null,
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
    moduleData: { [modrepKey: string]: TModuleTableRow };
    moduleLangData: { [langcode: string]: TModuleTableRow[] };
    modTableData: TModuleTableRow[];
    langTableData: TLanguageTableRow[];
    scrollTop: { repository: number; language: number; module: number };
  };

  destroy: (() => void)[];

  toaster: Toaster | undefined;

  tableRef: {
    repository: React.RefObject<HTMLDivElement>;
    module: React.RefObject<HTMLDivElement>;
    language: React.RefObject<HTMLDivElement>;
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
      language: React.createRef(),
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
    this.sizeTableToParent = this.sizeTableToParent.bind(this);
    this.setTableState = this.setTableState.bind(this);
    this.sState = this.setState.bind(this);
    this.moduleTableData = this.moduleTableData.bind(this);
  }

  componentDidMount() {
    const handleListing = (listing: RepositoryListing[]) => {
      this.updateRepositoryLists(listing);
      let language = this.loadLanguageTable();
      const { languageTableOpen } = this.state as ManagerState;
      if (!languageTableOpen) language = [];
      return this.loadModuleTable(language);
    };
    // Download data for the repository and module tables
    if (!ModuleManager.saved.repoTableData.length) {
      ModuleManager.saved.repoTableData = [];
      ModuleManager.saved.repositoryListings = [];
      G.Downloader.crossWireMasterRepoList()
        .then((repos) => {
          if (!repos) throw new Error(`Master Repository List canceled.`);
          const allrepos = this.loadRepositoryTable(repos);
          const loads = allrepos.filter((r) => r && !r.disabled);
          this.setState({ progress: [0, loads.length] });
          allrepos.forEach(async (_r, i) => {
            const arepo = allrepos.map((r, i2) => (i2 === i ? r : null));
            let listing: RepositoryListing[] = [];
            try {
              listing = await G.Downloader.repositoryListing(arepo);
            } catch (er) {
              log.warn(er);
              this.setState((prevState: ManagerState) => {
                const p = prevState.progress ? prevState.progress[0] : null;
                if (p) {
                  return {
                    progress: [p - arepo.filter(Boolean).length, loads.length],
                  };
                }
                return null;
              });
            }
            return handleListing(listing);
          });
          return repos;
        })
        .catch(async (er: Error) => {
          // Failed to load the master list, so just load local repos.
          log.warn(er);
          this.addToast({
            message: `Unable to download Master Repository List`,
          });
          ModuleManager.saved.repoTableData = [];
          ModuleManager.saved.repositoryListings = [];
          let listing: RepositoryListing[] = [];
          try {
            listing = await G.Downloader.repositoryListing(
              this.loadRepositoryTable()
            );
          } catch (err) {
            log.warn(err);
          }
          return handleListing(listing);
        });
    }
    this.destroy.push(onSetWindowState(this));
    // Initiate progress handlers
    this.destroy.push(
      window.ipc.renderer.on('progress', (prog: number, id?: string) => {
        const state = this.state as ManagerState;
        const { repoTableData, modTableData, progress } = state;
        const repoIndex = repoTableData.findIndex(
          (r) => downloadKey(r[0].repo) === id
        );
        const repdrow = repoTableData[repoIndex];
        if (
          id &&
          repoIndex !== -1 &&
          repdrow &&
          prog === -1 &&
          repdrow[0].loading
        ) {
          repdrow[0].loading = false;
          let newprog = null;
          if (progress) {
            const [p, t] = progress;
            newprog = p + 1 === t ? null : [p + 1, t];
          }
          this.setTableState('repository', {
            repoTableData,
            progress: newprog,
          });
        }
        const modIndex = modTableData.findIndex((r) => {
          const { repo } = r[0];
          const module = r[ModCol.iModule];
          return [downloadKey(repo), module].join('.') === id;
        });
        const moddrow = modTableData[modIndex];
        if (id && modIndex !== -1 && moddrow && prog === -1) {
          moddrow[0].loading = false;
          this.setTableState('module');
        }
      })
    );
    this.sizeTableToParent('repository');
    this.sizeTableToParent('module');
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
    this.sizeTableToParent('repository');
    this.sizeTableToParent('module');
  }

  componentWillUnmount() {
    this.destroy.forEach((func) => func());
    this.destroy = [];
  }

  sizeTableToParent(table: keyof typeof Tables) {
    const state = this.state as ManagerState;
    if (table === 'language') return;
    const columnWidthsProp = Tables[table][2];
    const columnWidths = state[columnWidthsProp];
    const { tableRef } = this;
    if (tableRef[table].current) {
      const atable = tableRef[table].current as HTMLDivElement | null;
      if (atable) {
        const w = atable.clientWidth;
        const t = columnWidths.reduce((p, c) => p + (c === -1 ? 0 : c), 0);
        if (Math.abs(w - t) > 2) {
          this.setTableState(table, {
            [columnWidthsProp]: columnWidths.map((cw) => {
              return cw === -1 ? -1 : w * (cw / t);
            }),
          });
        }
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
  }

  onCellEdited(row: number, col: number, value: string) {
    const state = clone(this.state) as ManagerState;
    const { repoTableData, customRepos } = state;
    const drow = repoTableData[row];
    if (drow) {
      const crindex = customRepos.findIndex(
        (r) => downloadKey(r) === downloadKey(drow[0].repo)
      );
      if (crindex !== -1) {
        customRepos.splice(crindex, 1);
      }
      drow[col] = value;
      customRepos.push(drow[0].repo);
      this.sState({ repoTableData, customRepos });
      if ((col === 1 || col === 2) && drow[RepCol.iState] === OFF) {
        setTimeout(() => this.switchRepo([row], true), 100);
      }
    }
  }

  // Load the repository table with built-in repositories, then user-custom
  // repositories, and then others passed in as repos[]. It returns the array
  // of repositories that was used to create the table.
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
        {
          loading: isloading,
          editable: canedit,
          classes: css,
          repo,
          tooltip: tooltip('VALUE', [RepCol.iState]),
        },
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
      const drow = repoTableData[i];
      if (drow) {
        if (typeof listing === 'string') {
          drow[0].repo.disabled = true;
          drow[RepCol.iState] = OFF;
          if (drow[0].loading) {
            this.addToast({ message: listing });
            drow[0].intent = intent(RepCol.iState, 'danger');
            drow[0].loading = false;
            if (!Array.isArray(repositoryListings[i])) {
              repositoryListings[i] = null;
            }
          } else log.warn(listing);
          return;
        }
        if (Array.isArray(listing)) {
          repositoryListings[i] = listing;
          if ([ON, ALWAYS_ON].includes(drow[RepCol.iState])) {
            drow[0].intent = intent(RepCol.iState, 'success');
          }
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
    const selectedRowIndexes = selectionToRows(language);
    const selectedcodes = langTableData
      .filter((_r, i) => selectedRowIndexes.includes(i))
      .map((r) => r[LanCol.iCode]);
    const langs: Set<string> = new Set();
    repositoryListings.forEach((listing, i) => {
      if (
        Array.isArray(listing) &&
        repoTableData[i] &&
        repoTableData[i][RepCol.iState] !== OFF
      ) {
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
  loadModuleTable(languageSelection?: RowSelection) {
    // Insure there is one moduleData row object for each module in
    // each repository. The same object should be reused throughout
    // the lifetime of the window, so user interactions will be recorded.
    const { repoTableData } = this.state as ManagerState;
    ModuleManager.saved.moduleLangData = { allmodules: [] };
    const { moduleData, moduleLangData, repositoryListings } =
      ModuleManager.saved;
    const enabledExternRepoMods: { [modunique: string]: string } = {};
    const localModules: { [modunique: string]: string } = {};
    repositoryListings.forEach((listing, i) => {
      const drow = repoTableData[i];
      if (drow && Array.isArray(listing)) {
        listing.forEach((c) => {
          const { repo } = drow[0];
          const repokey = downloadKey(repo);
          const modrepk = modrepKey(c.module, repo);
          const modunique = [c.module, c.Version].join('.');
          const repoIsLocal = isRepoLocal(c.sourceRepository);
          if (repoIsLocal) localModules[modunique] = repokey;
          else if (drow[RepCol.iState] !== OFF)
            enabledExternRepoMods[modunique] = repokey;
          if (!(modrepk in moduleData)) {
            const d = [] as unknown as TModuleTableRow;
            d[0] = {
              repo,
              shared: repokey === downloadKey(builtinRepos[0]),
              classes: classes(
                [ModCol.iShared, ModCol.iInstalled],
                ['checkbox-column']
              ),
              tooltip: tooltip('VALUE', [ModCol.iShared, ModCol.iInstalled]),
              conf: c,
            };
            d[ModCol.iType] = c.moduleType;
            d[ModCol.iAbout] =
              (c.Description &&
                (c.Description[i18n.language] || c.Description.en)) ||
              '?';
            d[ModCol.iModule] = c.module;
            d[ModCol.iRepoName] =
              repo.name ||
              (repoIsLocal ? repo.path : `${repo.domain}/${repo.path}`);
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
            moduleData[modrepk] = d;
          }
        });
      }
    });
    // Installed modules (ie those in local repos) which are from enabled
    // remote repositories are not included in moduleLangData. Rather the
    // 'installed' box is checked on the corresponding remote repository
    //  module. Also, modules in disabled repositories are not included.
    repositoryListings.forEach((listing, i) => {
      const drow = repoTableData[i];
      if (drow && Array.isArray(listing) && drow[RepCol.iState] !== OFF) {
        listing.forEach((c) => {
          const { repo } = drow[0];
          const modrepk = modrepKey(c.module, repo);
          const modrow = moduleData[modrepk];
          const modunique = [
            modrow[ModCol.iModule],
            modrow[ModCol.iVersion],
          ].join('.');
          const repoIsLocal = isRepoLocal(repo);
          if (repoIsLocal && modunique in enabledExternRepoMods) return;
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
    this.setTableState('module', {
      modTableData: this.moduleTableData(languageSelection),
    });
    return true;
  }

  // Return sorted and filtered (by language selection) module table data.
  moduleTableData(filter?: RowSelection): TModuleTableRow[] {
    const state = this.state as ManagerState;
    const { langTableData } = state;
    const rows = selectionToRows(filter || []);
    const codes: string[] = [];
    rows.forEach((r) => {
      if (langTableData[r]) {
        codes.push(langTableData[r][LanCol.iCode]);
      }
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
      const ma = a[ModCol.iModule];
      const mb = b[ModCol.iModule];
      return (ma && mb && ma.localeCompare(mb)) || 0;
    });
  }

  rowSelect(e: React.MouseEvent, table: keyof typeof Tables, row: number) {
    const state = this.state as ManagerState;
    const tableSel = table;
    const selection = state[tableSel];
    const isSelected = selection?.find((r) => r.rows[0] === row);
    const selected =
      e.ctrlKey && !isSelected && selection ? clone(selection) : [];
    if (!isSelected) selected.push({ rows: [row, row] });
    this.sState({ [tableSel]: selected });
    return selected;
  }

  // Enable or disable a repository. If onOrOff is undefined it will be toggled.
  // If onOrOff is true it will be enabled, otherwise disabled.
  switchRepo(rows: number[], onOrOff?: boolean) {
    const { disabledRepos: dr, repoTableData: repoTableDataWas } = this
      .state as ManagerState;
    const repoTableData = clone(repoTableDataWas);
    const disabledRepos = dr.slice();
    rows.forEach((r) => {
      const drowWas = repoTableDataWas[r];
      const drow = repoTableData[r];
      const unswitchable = !drowWas || drowWas[0].repo.builtin;
      if (drow && !unswitchable) {
        const rowkey = downloadKey(drowWas[0].repo);
        const disabledIndex = disabledRepos.findIndex((drs) => {
          return drs === rowkey;
        });
        if (onOrOff === true || drowWas[RepCol.iState] === OFF) {
          drow[RepCol.iState] = drow[0].repo.builtin ? ALWAYS_ON : ON;
          drow[0].repo.disabled = false;
          if (disabledIndex !== -1) disabledRepos.splice(disabledIndex, 1);
          drow[0].loading = loading(RepCol.iState);
        } else {
          drow[RepCol.iState] = OFF;
          drow[0].repo.disabled = true;
          if (disabledIndex === -1) disabledRepos.push(rowkey);
          if (drow[0].loading) {
            G.Downloader.ftpCancel();
            drow[0].loading = false;
          }
          drow[0].intent = intent(RepCol.iState, 'none');
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
        let language = this.loadLanguageTable();
        const { languageTableOpen } = this.state as ManagerState;
        if (!languageTableOpen) language = [];
        return this.loadModuleTable(language);
      })
      .catch((er) => log.warn(er));
  }

  eventHandler(this: ModuleManager, ev: SyntheticEvent) {
    switch (ev.type) {
      case 'click': {
        const e = ev as React.MouseEvent;
        switch (e.currentTarget.id) {
          case 'languageListClose': {
            this.setTableState('module', {
              languageTableOpen: false,
              modTableData: this.moduleTableData([]),
            });
            break;
          }
          case 'languageListOpen': {
            const { language } = this.state as ManagerState;
            this.setTableState('module', {
              languageTableOpen: true,
              modTableData: this.moduleTableData(language),
            });
            break;
          }
          case 'moduleInfo': {
            const div = document.getElementById('moduleInfo');
            if (div) {
              const { module, modTableData } = this.state as ManagerState;
              const confs = selectionToRows(module)
                .map((r) => {
                  return (modTableData[r] && modTableData[r][0].conf) || null;
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
            const rows = (repository && selectionToRows(repository)) || [];
            rows.reverse().forEach((r) => {
              const drow = repoTableData[r];
              if (drow && drow[0].repo.custom) {
                newTableData.splice(r, 1);
                rawdata.splice(r, 1);
                const crIndex = customRepos.findIndex(
                  (ro) => downloadKey(ro) === downloadKey(drow[0].repo)
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
          case 'repoCancel': {
            G.Downloader.ftpCancel();
            const { repoTableData } = this.state as ManagerState;
            repoTableData.forEach((r) => {
              if (r[0].loading) {
                r[0].loading = false;
                r[0].intent = intent(RepCol.iState, 'danger');
                r[0].repo.disabled = true;
                r[RepCol.iState] = OFF;
                this.setTableState('repository', { progress: null });
              }
            });
            break;
          }
          case 'moduleCancel': {
            G.Downloader.ftpCancel();
            ModuleManager.saved.moduleLangData.allmodules?.forEach((r) => {
              if (r[0].loading) {
                r[0].loading = false;
                r[0].intent = intent(ModCol.iInstalled, 'danger');
                r[ModCol.iInstalled] = OFF;
                const modrepk = modrepKey(r[ModCol.iModule], r[0].repo);
                if (modrepk in Downloads) Downloads[modrepk].failed = true;
                this.setTableState('module');
              }
            });
            break;
          }
          case 'repository': {
            const { repoTableData } = this.state as ManagerState;
            const [row, col] = clickedCell(e);
            const builtin =
              repoTableData[row] && repoTableData[row][0].repo.builtin;
            if (!builtin && col === RepCol.iState) this.switchRepo([row]);
            else if (row > -1 && col < RepCol.iState) {
              this.rowSelect(e, 'repository', row);
            }
            break;
          }
          case 'language': {
            const [row] = clickedCell(e);
            this.loadModuleTable(this.rowSelect(e, 'language', row));
            break;
          }
          case 'module': {
            const [row, col] = clickedCell(e);
            const state = this.state as ManagerState;
            const { modTableData } = state as ManagerState;
            const drow = modTableData[row];
            if (drow && col === ModCol.iInstalled && !drow[0].loading) {
              const was = drow[col];
              const is = was === ON ? OFF : ON;
              // Installed column clicks
              if (is === ON) {
                const k = modrepKey(drow[ModCol.iModule], drow[0].repo);
                if (k in Downloads && !Downloads[k].failed) {
                  drow[ModCol.iInstalled] = ON;
                  this.setTableState('module', { modTableData });
                } else this.download(row);
              } else {
                drow[col] = OFF;
                drow[0].intent = intent(ModCol.iInstalled, 'none');
                this.setTableState('module', { modTableData });
              }
            } else if (drow && col === ModCol.iShared) {
              // Shared column clicks
              drow[0].shared = !drow[0].shared;
              this.setTableState('module', {
                modTableData,
              } as Partial<ManagerState>);
            } else {
              this.rowSelect(e, 'module', row);
            }
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

  download(row: number): void {
    const { modTableData } = ModuleManager.saved;
    const drow = modTableData[row];
    if (drow) {
      const module = drow[ModCol.iModule] as string;
      const { repo } = drow[0];
      drow[0].loading = loading(ModCol.iInstalled);
      this.setTableState('module', { modTableData });
      const modrepk = modrepKey(module, repo);
      const nfiles = G.Module.download(module, repo)
        .then((dl) => {
          drow[0].loading = false;
          let newintent: Intent = 'success';
          if (dl === null) {
            this.addToast({ message: `Canceled` });
            newintent = 'danger';
          } else {
            drow[ModCol.iInstalled] = ON;
            Downloads[modrepk].failed = false;
          }
          drow[0].intent = intent(ModCol.iInstalled, newintent);
          this.setTableState('module', { modTableData });
          return dl;
        })
        .catch((er) => {
          log.warn(er);
          drow[0].loading = false;
          drow[0].intent = intent(ModCol.iInstalled, 'danger');
          this.setTableState('module', { modTableData });
          return null;
        });
      Downloads[modrepk] = { nfiles, failed: true };
    }
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
      progress,
    } = state;
    const {
      eventHandler,
      onCellEdited,
      onRepoColumnWidthChanged,
      onModColumnWidthChanged,
      tableRef,
    } = this;

    const disable = {
      moduleInfo: !selectionToRows(module).length,
      moduleInfoBack: false,
      moduleCancel: !modTableData.find((r) => r[0].loading),
      repoAdd: false,
      repoDelete:
        !repository ||
        !selectionToRows(repository).every(
          (r) => repoTableData[r] && repoTableData[r][0]?.repo?.custom
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
        <Hbox
          flex="1"
          className={`language ${languageTableOpen ? 'open' : 'closed'}`}
        >
          {languageTableOpen && (
            <>
              <Groupbox
                caption={i18n.t('menu.options.language')}
                orient="vertical"
                width={languageTableWidth}
              >
                <Box flex="1">
                  <Table
                    id="language"
                    key={renderLangTable}
                    columnHeadings={LanguageTableHeadings}
                    data={langTableData}
                    selectedRegions={language}
                    domref={tableRef.language}
                    onClick={eventHandler}
                  />
                </Box>
                <Button
                  id="languageListClose"
                  icon="chevron-left"
                  fill
                  onClick={eventHandler}
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
            <Groupbox caption=" " orient="vertical">
              <Vbox flex="1">
                <Button
                  id="languageListOpen"
                  icon="chevron-right"
                  style={{ height: '100%' }}
                  onClick={eventHandler}
                />
              </Vbox>
            </Groupbox>
          )}

          <Groupbox
            caption={i18n.t('chooseModule.label')}
            orient="horizontal"
            flex="1"
          >
            <Hbox className="module-deck" flex="1">
              {showModuleInfo && (
                <div
                  className="info"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHTML(showModuleInfo),
                  }}
                />
              )}
              {!showModuleInfo && (
                <Table
                  flex="1"
                  id="module"
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
                    id="repository"
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
          {!progress && <Spacer flex="1" />}
          {progress && (
            <Hbox className="progress-container" align="center" flex="1">
              <ProgressBar
                value={progress[0] / progress[1]}
                intent="primary"
                animate
                stripes
              />
            </Hbox>
          )}
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
  scrollTop: { repository: 0, language: 0, module: 0 },
};

function clickedCell(e: React.MouseEvent) {
  const cell = ofClass(['bp4-table-cell'], e.target);
  let row = -1;
  let col = -1;
  if (cell) {
    const rowm = cell.element.className.match(/bp4-table-cell-row-(\d+)\b/);
    row = rowm ? Number(rowm[1]) : -1;
    const colm = cell.element.className.match(/data-column-(\d+)\b/);
    col = colm ? Number(colm[1]) : -1;
  }
  return [row, col];
}

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
    return ci < RepCol.iState;
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
    const cs = wholeRowClasses?.slice() || [];
    if (columnIndexArray.includes(ci))
      theClasses.forEach((c) => {
        if (!cs.includes(c)) cs.push(c);
      });
    return cs;
  };
}

function tooltip(atooltip: string, slipColumnIndexArray: number[]) {
  return (_ri: number, ci: number) => {
    return slipColumnIndexArray.includes(ci) ? undefined : atooltip;
  };
}

renderToRoot(<ModuleManager id="downloader" />);
