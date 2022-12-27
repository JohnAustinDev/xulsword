/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-nested-ternary */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import {
  Intent,
  IToastProps,
  Position,
  ProgressBar,
  Toaster,
} from '@blueprintjs/core';
import {
  diff,
  downloadKey,
  drop,
  isRepoLocal,
  modrepKey,
  selectionToRows,
  repositoryKey,
} from '../../common';
import C from '../../constant';
import G from '../rg';
import log from '../log';
import { getStatePref, onSetWindowState, getLangReadable } from '../rutil';
import {
  addClass,
  xulDefaultProps,
  XulProps,
  xulPropTypes,
} from '../libxul/xul';
import Button from '../libxul/button';
import { Hbox, Vbox, Box } from '../libxul/boxes';
import Groupbox from '../libxul/groupbox';
import VKSelect from '../libxul/vkselect';
import Table from '../libxul/table';
import Spacer from '../libxul/spacer';
import Label from '../libxul/label';
import DragSizer, { DragSizerVal } from '../libxul/dragsizer';
import Checkbox from '../libxul/checkbox';
import Dialog from '../libxul/dialog';
import Modinfo, {
  modinfoParentInitialState,
  modinfoParentHandler as modinfoParentHandlerH,
} from '../libxul/modinfo';
import * as H from './managerH';
import './manager.css';

import type {
  ModTypes,
  PrefObject,
  Repository,
  RepositoryListing,
  RowSelection,
  SwordConfAudioChapters,
  SwordConfType,
} from '../../type';
import type {
  TLanguageTableRow,
  TModuleTableRow,
  TRepositoryTableRow,
} from './managerH';
import type {
  TonCellClick,
  TonColumnHide,
  TonColumnsReordered,
  TonColumnWidthChanged,
  TonEditableCellChanged,
  TonRowsReordered,
  TinitialRowSort,
} from '../libxul/table';
import type { VKSelectProps, SelectVKMType } from '../libxul/vkselect';
import type { ModinfoParent } from '../libxul/modinfo';

G.Module.cancel();

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
  modules: [] as string[],
  progress: null as number[] | null,
  showAudioDialog: [] as {
    conf: SwordConfType;
    selection: SelectVKMType;
    initialVKM: VKSelectProps['initialVKM'];
    options: VKSelectProps['options'];
    chapters: SwordConfAudioChapters;
    callback: (result: SelectVKMType | null) => void;
  }[],
  tables: {
    language: {
      data: [] as TLanguageTableRow[],
      render: 0,
    },

    module: {
      data: [] as TModuleTableRow[],
      render: 0,
    },

    repository: {
      data: [] as TRepositoryTableRow[],
      render: 0,
    },
  },
  internetPermission: false as boolean,
};

export interface ManagerStatePref {
  language: {
    open: boolean;
    selection: RowSelection;
    rowSort: TinitialRowSort;
    width: number;
  };
  module: {
    selection: RowSelection;
    rowSort: TinitialRowSort;
    visibleColumns: number[];
    columnWidths: number[];
  };
  repository: {
    open: boolean;
    selection: RowSelection;
    rowSort: TinitialRowSort;
    visibleColumns: number[];
    columnWidths: number[];
    height: number;
  } | null;
  repositories: {
    xulsword: Repository[];
    custom: Repository[];
    disabled: string[] | null;
  } | null;
}

export type ManagerState = ManagerStatePref &
  typeof notStatePref &
  typeof modinfoParentInitialState;

export default class ModuleManager
  extends React.Component
  implements ModinfoParent
{
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  destroy: (() => void)[];

  tableRef: {
    [table in typeof H.Tables[number]]: React.RefObject<HTMLDivElement>;
  };

  modinfoRefs: {
    textarea: React.RefObject<HTMLTextAreaElement>;
    container: React.RefObject<HTMLDivElement>;
  };

  toaster: Toaster | undefined;

  refHandlers = {
    toaster: (ref: Toaster) => {
      this.toaster = ref;
    },
  };

  onRowsReordered: { [table: string]: TonRowsReordered };

  onColumnWidthChanged: { [table: string]: TonColumnWidthChanged };

  onColumnHide: TonColumnHide;

  onColumnsReordered: TonColumnsReordered;

  onRepoCellClick: TonCellClick;

  onLangCellClick: TonCellClick;

  onModCellClick: TonCellClick;

  onCellEdited: TonEditableCellChanged;

  eventHandler;

  audioDialogOnChange: VKSelectProps['onSelectionChange'];

  modinfoParentHandler: typeof modinfoParentHandlerH;

  sState: (
    // sState is just for better TypeScript functionality
    s:
      | Partial<ManagerState>
      | ((prevState: ManagerState) => Partial<ManagerState> | null)
  ) => void;

  constructor(props: ManagerProps) {
    super(props);

    if (!props.id) throw Error(`Manager must have an ID`);
    const s: ManagerState = {
      ...modinfoParentInitialState,
      ...notStatePref,
      ...(getStatePref(props.id) as ManagerStatePref),
    };
    s.tables.language.data = H.Saved.language.data;
    s.tables.module.data = H.Saved.module.data;
    s.tables.repository.data = H.Saved.repository.data;
    s.internetPermission = G.Prefs.getBoolPref('global.InternetPermission');
    this.state = s;

    this.tableRef = {} as typeof this.tableRef;
    H.Tables.forEach((t: typeof H.Tables[number]) => {
      this.tableRef[t] = React.createRef();
    });

    this.modinfoRefs = {
      textarea: React.createRef(),
      container: React.createRef(),
    };

    this.destroy = [];

    this.loadRepositoryTable = this.loadRepositoryTable.bind(this);
    this.loadModuleTable = this.loadModuleTable.bind(this);
    this.filterModuleTable = this.filterModuleTable.bind(this);
    this.onColumnHide = H.onColumnHide.bind(this);
    this.onColumnsReordered = H.onColumnsReordered.bind(this);
    this.onRepoCellClick = H.onRepoCellClick.bind(this);
    this.onLangCellClick = H.onLangCellClick.bind(this);
    this.onModCellClick = H.onModCellClick.bind(this);
    this.onCellEdited = H.onCellEdited.bind(this);
    this.eventHandler = H.eventHandler.bind(this);
    this.modinfoParentHandler = modinfoParentHandlerH.bind(this);
    this.onRowsReordered = {
      language: H.onRowsReordered.bind(this, 'language'),
      module: H.onRowsReordered.bind(this, 'module'),
      repository: H.onRowsReordered.bind(this, 'repository'),
    };
    this.onColumnWidthChanged = {
      language: H.columnWidthChanged.bind(this, 'language'),
      module: H.columnWidthChanged.bind(this, 'module'),
      repository: H.columnWidthChanged.bind(this, 'repository'),
    };
    this.sizeTableToParent = this.sizeTableToParent.bind(this);
    this.audioDialogOnChange = audioDialogOnChange.bind(this);
    this.audioDialogClose = this.audioDialogClose.bind(this);
    this.audioDialogAccept = this.audioDialogAccept.bind(this);
    this.sState = this.setState.bind(this);
  }

  componentDidMount() {
    const state = this.state as ManagerState;
    const { repositories } = state;
    // If we are managing external repositories, Internet is required.
    if (repositories && !state.internetPermission) return;
    this.loadTables();
  }

  componentDidUpdate(_prevProps: any, prevState: ManagerState) {
    const state = this.state as ManagerState;
    if (!state.internetPermission) return;
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

  async loadTables(): Promise<void> {
    const { repositories } = this.state as ManagerState;
    const loadLocalRepos = async () => {
      H.Saved.repository.data = [];
      H.Saved.repositoryListings = [];
      let listing: (RepositoryListing | string)[] = [];
      try {
        listing = await G.Module.repositoryListing(
          this.loadRepositoryTable().map((r) => {
            return { ...r, file: C.SwordRepoManifest };
          })
        );
      } catch (err) {
        log.warn(err);
      }
      H.handleListings(this, listing);
    };
    // Download data for the repository and module tables
    if (!H.Saved.repository.data.length) {
      if (repositories) {
        H.Saved.repository.data = [];
        H.Saved.repositoryListings = [];
        try {
          if (!navigator.onLine) throw new Error(`No Internet connection.`);
          const repos = await G.Module.crossWireMasterRepoList();
          if (typeof repos === 'string') throw new Error(repos);
          // Calling loadRepositoryTable on all repos at onces causes the
          // module table to remain empty until all repository listings have
          // been downloaded, and certain repos may take a long time. So
          // instead it is called on each repo separately.
          this.loadRepositoryTable(repos)
            .map((r) => {
              return { ...r, file: C.SwordRepoManifest };
            })
            .forEach(async (l, i, a) => {
              const [list] = await G.Module.repositoryListing([l]);
              H.handleListings(
                this,
                a.map((_lr, ir) => (ir === i ? list : null))
              );
            });
        } catch (er: any) {
          // Failed to load the master list, so just load local repos.
          log.warn(er);
          const msg = (typeof er === 'object' && er.message) || '';
          this.addToast({
            message: `Unable to download Master Repository List.\n${msg}`,
            timeout: 5000,
            intent: Intent.WARNING,
          });
          loadLocalRepos();
        }
      } else loadLocalRepos();
    }
    this.destroy.push(onSetWindowState(this));
    // Instantiate progress handler
    const progressing = {
      downloads: [] as [string, number][], // [id, percent]
    };
    this.destroy.push(
      window.ipc.on('progress', (prog: number, id?: string) => {
        const state = this.state as ManagerState;
        if (id) {
          // Set total progress bar
          let { downloads } = progressing;
          const di = downloads.findIndex((d) => d[0] === id);
          if (di === -1) downloads.push([id, prog]);
          else downloads[di][1] = prog;
          if (downloads.every((d) => d[1] === -1)) downloads = [];
          const progress = !downloads.length
            ? null
            : [
                downloads.reduce((p, c) => p + (c[1] === -1 ? 1 : c[1]), 0),
                downloads.length,
              ];
          this.sState({ progress });
          log.silly(`Total progress: ${progress}`, downloads);
          progressing.downloads = downloads;
          // Set individual repository progress bars
          const { repository, module } = state.tables;
          const repoIndex = repository.data.findIndex(
            (r) =>
              downloadKey({
                ...r[H.RepCol.iInfo].repo,
                file: C.SwordRepoManifest,
              }) === id
          );
          const repdrow = repository.data[repoIndex];
          if (repdrow && prog === -1 && repdrow[H.RepCol.iInfo].loading) {
            repdrow[H.RepCol.iInfo].loading = false;
            H.setTableState(this, 'repository', null, repository.data, false);
          }
          // Set individual module progress bars
          const modIndex = module.data.findIndex((r) => {
            const { repo } = r[H.ModCol.iInfo];
            const mod = r[H.ModCol.iModule];
            return downloadKey({ ...repo, file: mod }) === id;
          });
          const moddrow = module.data[modIndex];
          if (moddrow && prog === -1) {
            if (moddrow[H.ModCol.iInfo].conf.xsmType !== 'none') {
              Object.values(module.data)
                .filter((r) => {
                  return (
                    r[H.ModCol.iInfo].conf.DataPath ===
                    moddrow[H.ModCol.iInfo].conf.DataPath
                  );
                })
                .forEach((r: TModuleTableRow) => {
                  r[H.ModCol.iInfo].loading = false;
                });
            } else moddrow[H.ModCol.iInfo].loading = false;
            H.setTableState(this, 'module');
          }
        }
      })
    );
    this.sizeTableToParent('repository');
    this.sizeTableToParent('module');
  }

  sizeTableToParent(table: typeof H.Tables[number]) {
    const state = this.state as ManagerState;
    if (table === 'language') return;
    const tbl = state[table];
    if (tbl) {
      const { visibleColumns } = tbl;
      let { columnWidths } = tbl;
      const { tableRef } = this;
      if (tableRef[table].current) {
        const atable = tableRef[table].current as HTMLDivElement | null;
        if (atable) {
          const w = atable.clientWidth;
          const t = columnWidths
            .filter((_w, i) => !visibleColumns || visibleColumns.includes(i))
            .reduce((p, c) => p + c, 0);
          if (Math.abs(w - t) > 2) {
            columnWidths = columnWidths.map((cw, i) => {
              return !visibleColumns || visibleColumns.includes(i)
                ? w * (cw / t)
                : cw;
            });
            H.setTableState(this, table, { columnWidths }, null, true);
          }
        }
      }
    }
  }

  // Load the repository table with all built-in repositories, xulsword
  // repositories, user-custom repositories, and those passed in repos
  // (which normally come from the CrossWire Master Repository List).
  // It returns the array of repositories that was used to create the
  // table data.
  loadRepositoryTable(repos?: Repository[]): Repository[] {
    const state = this.state as ManagerState;
    const { repositories } = state;
    let disabled: string[] | null = [];
    let allrepos = H.builtinRepos();
    if (repositories) {
      disabled = repositories.disabled;
      const { xulsword, custom } = repositories;
      custom.forEach((cr) => {
        cr.custom = true;
      });
      repos?.forEach((rr) => {
        rr.disabled = true;
      });
      allrepos = allrepos.concat(xulsword, custom, repos || []);
    }
    if ('repository' in state) {
      const repoTableData: TRepositoryTableRow[] = [];
      allrepos.forEach((repo) => {
        if (disabled && !repo.builtin) {
          repo.disabled = disabled.includes(repositoryKey(repo)) || false;
        }
        const css = H.classes([H.RepCol.iState], ['checkbox-column']);
        const canedit = repo.custom ? H.editable() : false;
        const isloading = repo.disabled ? false : H.loading(H.RepCol.iState);
        const on = repo.builtin ? H.ALWAYS_ON : H.ON;
        let lng = G.i18n.language;
        if (!['en', 'ru'].includes(lng)) lng = C.FallbackLanguage[lng];
        const reponame =
          repo.name && repo.name.includes(' | ')
            ? repo.name.split(' | ')[lng === 'ru' ? 1 : 0]
            : repo.name || '';
        repoTableData.push([
          reponame,
          repo.domain,
          repo.path,
          repo.disabled ? H.OFF : on,
          {
            loading: isloading,
            editable: canedit,
            classes: css,
            repo,
            tooltip: H.tooltip('VALUE', [H.RepCol.iState]),
          },
        ]);
      });
      H.setTableState(this, 'repository', null, repoTableData, false);
    }
    return allrepos;
  }

  // Load language table with all languages found in the saved repositoryListings
  // data, keeping the selection the same if possible. It returns the new
  // selection.
  loadLanguageTable(): RowSelection {
    const state = this.state as ManagerState;
    const { language: langtable, repository: repotable } = state.tables;
    const { selection } = state.language;
    const { repositoryListings } = H.Saved;
    const selectedRowIndexes = H.selectionToDataRows('language', selection);
    const selectedcodes = langtable.data
      .filter((_r, i) => selectedRowIndexes.includes(i))
      .map((r) => r[H.LanCol.iInfo].code);
    const langs: Set<string> = new Set();
    repositoryListings.forEach((listing, i) => {
      if (
        Array.isArray(listing) &&
        repotable.data[i] &&
        repotable.data[i][H.RepCol.iState] !== H.OFF
      ) {
        listing.forEach((c) => {
          const l = c.Lang || 'en';
          langs.add(l.replace(/-.*$/, ''));
        });
      }
    });
    let newTableData: TLanguageTableRow[] = [];
    Array.from(langs).forEach((l) =>
      newTableData.push([getLangReadable(l), { code: l }])
    );
    newTableData = newTableData.sort((a, b) => a[0].localeCompare(b[0]));
    const newlanguage: RowSelection = [];
    newTableData.forEach((r, i) => {
      if (selectedcodes?.includes(r[H.LanCol.iInfo].code)) {
        newlanguage.push({ rows: [i, i] });
      }
    });
    H.setTableState(
      this,
      'language',
      { selection: newlanguage },
      newTableData,
      true
    );
    return newlanguage;
  }

  // Load the module table with modules sharing the language code,
  // or else with all modules if the code is null.
  loadModuleTable(languageSelection?: RowSelection): void {
    const state = this.state as ManagerState;
    // Insure there is one moduleData row object for each module in
    // each repository (local and remote). The same object should be reused
    // throughout the lifetime of the window, so user interactions will be
    // recorded.
    const { repository: repotable } = state.tables;
    H.Saved.moduleLangData = { allmodules: [] };
    const { moduleData, moduleLangData, repositoryListings } = H.Saved;
    const enabledExternRepoMods: { [modunique: string]: string } = {};
    const enabledXulswordRepoMods: { [modunique: string]: string } = {};
    const localModules: { [modunique: string]: string } = {};
    repositoryListings.forEach((listing, i) => {
      const drow = repotable.data[i];
      if (drow && Array.isArray(listing)) {
        listing.forEach((c) => {
          const { repo } = drow[H.RepCol.iInfo];
          const repokey = repositoryKey(repo);
          const modrepk = modrepKey(c.module, repo);
          // Different audio and SWORD modules might share the same name,
          // so include XSM_audio in key.
          const modunique = [
            c.module,
            c.Version,
            c.xsmType === 'XSM_audio',
          ].join('.');
          const repoIsLocal = isRepoLocal(c.sourceRepository);
          if (repoIsLocal && drow[H.RepCol.iState] !== H.OFF)
            localModules[modunique] = repokey;
          else if (drow[H.RepCol.iState] !== H.OFF) {
            enabledExternRepoMods[modunique] = repokey;
            if (c.xsmType !== 'none') {
              enabledXulswordRepoMods[modunique] = repokey;
            }
          }
          if (!(modrepk in moduleData)) {
            let mtype: string = c.moduleType;
            if (c.xsmType === 'XSM') {
              mtype = `XSM ${G.i18n.t(
                C.SupportedModuleTypes[mtype as ModTypes]
              )}`;
            } else if (c.xsmType === 'XSM_audio') {
              mtype = `XSM ${G.i18n.t('audio.label')}`;
            }
            const d = [] as unknown as TModuleTableRow;
            d[H.ModCol.iInfo] = {
              repo,
              shared: repokey === repositoryKey(H.builtinRepos()[0]),
              classes: H.modclasses(),
              tooltip: H.tooltip('VALUE', [
                H.ModCol.iShared,
                H.ModCol.iInstalled,
                H.ModCol.iRemove,
              ]),
              conf: c,
            };
            d[H.ModCol.iType] = mtype;
            d[H.ModCol.iAbout] =
              (c.Description &&
                (c.Description[G.i18n.language] || c.Description.en)) ||
              '';
            d[H.ModCol.iModule] = c.module;
            d[H.ModCol.iRepoName] =
              repo.name ||
              (repoIsLocal ? repo.path : `${repo.domain}/${repo.path}`);
            d[H.ModCol.iVersion] = c.Version || '';
            d[H.ModCol.iSize] =
              (c.InstallSize && c.InstallSize.toString()) || '';
            d[H.ModCol.iFeatures] = (c.Feature && c.Feature.join(', ')) || '';
            d[H.ModCol.iVersification] = c.Versification || 'KJV';
            d[H.ModCol.iScope] = c.Scope || '';
            d[H.ModCol.iCopyright] =
              (c.Copyright &&
                (c.Copyright[G.i18n.language] || c.Copyright.en)) ||
              '';
            d[H.ModCol.iLicense] = c.DistributionLicense || '';
            d[H.ModCol.iSourceType] = c.SourceType || '';
            d[H.ModCol.iShared] = (dataRow: number) => {
              return H.Saved.module.data[dataRow][H.ModCol.iInfo].shared
                ? H.ON
                : H.OFF;
            };
            d[H.ModCol.iInstalled] = repoIsLocal ? H.ON : H.OFF;
            d[H.ModCol.iRemove] = H.OFF;
            moduleData[modrepk] = d;
          }
        });
      }
    });
    // Installed modules (ie those in local repos) which are from enabled
    // remote repositories are not included in moduleLangData. Rather their
    // 'installed' and 'shared' checkboxes are applied to the corresponding
    // remote repository module. Also, modules in disabled repositories
    // are not included. If a xulsword module repository is enabled, any
    // correpsonding modules in regular repositories will not be listed.
    repositoryListings.forEach((listing, i) => {
      const drow = repotable.data[i];
      if (drow && Array.isArray(listing) && drow[H.RepCol.iState] !== H.OFF) {
        listing.forEach((c) => {
          const { repo } = drow[H.RepCol.iInfo];
          const modrepk = modrepKey(c.module, repo);
          const modrow = moduleData[modrepk];
          const modunique = [
            c.module,
            c.Version,
            c.xsmType === 'XSM_audio',
          ].join('.');
          const repoIsLocal = isRepoLocal(repo);
          const remoteSrcOfLocalMod = !repoIsLocal && modunique in localModules;
          if (remoteSrcOfLocalMod) {
            modrow[H.ModCol.iInstalled] = H.ON;
            const modrepok = `${localModules[modunique]}.${c.module}`;
            if (modrepok in moduleData) {
              modrow[H.ModCol.iInfo].shared =
                moduleData[modrepok][H.ModCol.iInfo].shared;
            }
          }
          const localModFromRemote =
            repoIsLocal &&
            (modunique in enabledExternRepoMods ||
              modunique in enabledXulswordRepoMods);
          const regularModWithXSM =
            modunique in enabledXulswordRepoMods && c.xsmType === 'none';
          if (!localModFromRemote && !regularModWithXSM) {
            const code = (c.Lang && c.Lang.replace(/-.*$/, '')) || 'en';
            if (!(code in moduleLangData)) moduleLangData[code] = [];
            moduleLangData[code].push(modrow);
            moduleLangData.allmodules.push(modrow);
          }
        });
      }
    });
    H.setTableState(
      this,
      'module',
      null,
      this.filterModuleTable(languageSelection),
      true
    );
  }

  // Return sorted and filtered (by language selection) module table data.
  filterModuleTable(filter?: RowSelection): TModuleTableRow[] {
    const state = this.state as ManagerState;
    const { language: langtable } = state.tables;
    const rows = H.selectionToDataRows('language', filter || []);
    const codes: string[] = [];
    rows.forEach((r) => {
      if (langtable.data[r]) {
        codes.push(langtable.data[r][H.LanCol.iInfo].code);
      }
    });
    const { moduleLangData } = H.Saved;
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
      const ta = taborder.indexOf(a[H.ModCol.iType] as ModTypes);
      const tb = taborder.indexOf(b[H.ModCol.iType] as ModTypes);
      if (ta > tb) return 1;
      if (ta < tb) return -1;
      const ma = a[H.ModCol.iModule];
      const mb = b[H.ModCol.iModule];
      return (ma && mb && ma.localeCompare(mb)) || 0;
    });
  }

  audioDialogClose() {
    this.sState((prevState) => {
      const { showAudioDialog } = prevState;
      if (showAudioDialog.length) {
        const done = showAudioDialog.shift();
        if (done) done.callback(null);
        return { showAudioDialog };
      }
      return null;
    });
  }

  audioDialogAccept() {
    this.sState((prevState) => {
      const { showAudioDialog } = prevState;
      if (showAudioDialog.length) {
        const done = showAudioDialog.shift();
        if (done) {
          const { selection } = done;
          done.callback(selection);
        }
        return { showAudioDialog };
      }
      return null;
    });
  }

  addToast(toast: IToastProps) {
    if (this.toaster) this.toaster.show(toast);
  }

  render() {
    const state = this.state as ManagerState;
    const props = this.props as ManagerProps;
    const {
      language,
      module,
      modules,
      showConf,
      editConf,
      repository,
      showAudioDialog,
      progress,
      repositories,
      internetPermission,
    } = state;
    const {
      language: langtable,
      module: modtable,
      repository: repotable,
    } = state.tables;
    const {
      eventHandler,
      modinfoParentHandler,
      onCellEdited,
      onColumnHide,
      onColumnsReordered,
      onLangCellClick,
      onModCellClick,
      onRepoCellClick,
      onRowsReordered,
      onColumnWidthChanged,
      audioDialogClose: dialogClose,
      audioDialogAccept: dialogAccept,
      tableRef,
      modinfoRefs,
      audioDialogOnChange: dialogOnChange,
    } = this;

    const disable = {
      moduleInfo: !selectionToRows(module.selection).length,
      moduleInfoBack: false,
      moduleCancel: !modtable.data.find((r) => r[H.ModCol.iInfo].loading),
      repoAdd: false,
      repoDelete:
        !repository?.selection.length ||
        !H.selectionToDataRows('repository', repository.selection).every(
          (r) =>
            repotable.data[r] && repotable.data[r][H.RepCol.iInfo]?.repo?.custom
        ),
      repoCancel: !repotable.data.find((r) => r[H.RepCol.iInfo].loading),
    };

    // If we are managing external repositories, Internet permission is required.
    if (!repositories || internetPermission)
      return (
        <Vbox {...addClass('modulemanager', props)} flex="1" height="100%">
          <Toaster
            canEscapeKeyClear
            position={Position.TOP}
            usePortal
            ref={this.refHandlers.toaster}
          />
          {showAudioDialog.length > 0 && (
            <Dialog
              body={
                <Vbox>
                  <Label value={showAudioDialog[0].conf.module} />
                  <div>{showAudioDialog[0].conf.Description?.locale}</div>
                  <VKSelect
                    height="2em"
                    initialVKM={showAudioDialog[0].initialVKM}
                    options={showAudioDialog[0].options}
                    onSelectionChange={dialogOnChange}
                  />
                </Vbox>
              }
              buttons={
                <>
                  <Spacer flex="10" />
                  <Button id="cancel" flex="1" fill="x" onClick={dialogClose}>
                    {G.i18n.t('cancel.label')}
                  </Button>
                  <Button id="ok" flex="1" fill="x" onClick={dialogAccept}>
                    {G.i18n.t('ok.label')}
                  </Button>
                </>
              }
            />
          )}
          <Hbox
            flex="1"
            className={`langsmods ${language.open ? 'lt-open' : 'lt-closed'}`}
          >
            {language.open && (
              <>
                <Groupbox
                  caption={G.i18n.t('menu.options.language')}
                  orient="vertical"
                  width={language.width}
                >
                  <Box flex="1">
                    <Table
                      id="language"
                      key={langtable.render}
                      columnHeadings={H.LanguageTableHeadings}
                      initialRowSort={language.rowSort}
                      data={langtable.data}
                      selectedRegions={language.selection}
                      domref={tableRef.language}
                      onRowsReordered={onRowsReordered.language}
                      onCellClick={onLangCellClick}
                    />
                  </Box>
                  <Button
                    id="languageListClose"
                    icon="chevron-left"
                    fill="x"
                    onClick={eventHandler}
                  />
                </Groupbox>
                <DragSizer
                  onDragStart={() => state.language.width}
                  onDragEnd={(_e: React.MouseEvent, v: DragSizerVal) =>
                    this.sState({
                      language: { ...state.language, width: v.sizerPos },
                    })
                  }
                  min={75}
                  max={250}
                  orient="vertical"
                />
              </>
            )}
            {!language.open && (
              <Groupbox caption=" " orient="vertical">
                <Vbox flex="1">
                  <Button
                    id="languageListOpen"
                    icon="chevron-right"
                    fill="y"
                    style={{ height: '100%' }}
                    onClick={eventHandler}
                  />
                </Vbox>
              </Groupbox>
            )}

            <Groupbox
              caption={G.i18n.t('chooseModule.label')}
              orient="horizontal"
              flex="1"
            >
              <Hbox className="module-deck" flex="1">
                {modules.length > 0 && (
                  <Modinfo
                    modules={modules}
                    showConf={showConf}
                    editConf={editConf}
                    configs={modules.map((m) => {
                      const mr = modtable.data.find(
                        (r) => r[H.ModCol.iModule] === m
                      );
                      return (mr && mr[H.ModCol.iInfo].conf) || null;
                    })}
                    buttonHandler={modinfoParentHandler}
                    refs={modinfoRefs}
                  />
                )}
                {modules.length === 0 && (
                  <Table
                    flex="1"
                    id="module"
                    key={modtable.render}
                    data={modtable.data}
                    selectedRegions={module.selection}
                    columnHeadings={H.ModuleTableHeadings()}
                    visibleColumns={module.visibleColumns}
                    columnWidths={module.columnWidths}
                    initialRowSort={module.rowSort}
                    enableColumnReordering
                    domref={tableRef.module}
                    onColumnsReordered={onColumnsReordered}
                    onColumnHide={onColumnHide}
                    onCellClick={onModCellClick}
                    onColumnWidthChanged={onColumnWidthChanged.module}
                    onRowsReordered={onRowsReordered.module}
                  />
                )}
              </Hbox>
              <Vbox className="button-stack" pack="center">
                {modules.length === 0 && (
                  <Button
                    id="moduleInfo"
                    icon="info-sign"
                    intent="primary"
                    fill="x"
                    disabled={disable.moduleInfo}
                    onClick={eventHandler}
                  />
                )}
                {modules.length > 0 && (
                  <Button
                    id="moduleInfoBack"
                    intent="primary"
                    fill="x"
                    disabled={disable.moduleInfoBack}
                    onClick={eventHandler}
                  >
                    {G.i18n.t('back.label')}
                  </Button>
                )}
                <Button
                  id="moduleCancel"
                  intent="primary"
                  fill="x"
                  disabled={disable.moduleCancel}
                  onClick={eventHandler}
                >
                  {G.i18n.t('cancel.label')}
                </Button>
              </Vbox>
            </Groupbox>
          </Hbox>

          {repository && repository.open && (
            <div>
              <DragSizer
                onDragStart={() => repository.height}
                onDragEnd={(_e: React.MouseEvent, v: DragSizerVal) =>
                  this.sState({
                    repository: { ...repository, height: v.sizerPos },
                  })
                }
                orient="horizontal"
                min={200}
                shrink
              />
              <Groupbox
                caption={G.i18n.t('moduleSources.label')}
                height={repository.height}
                orient="horizontal"
                flex="1"
              >
                <Box flex="1">
                  {!!repotable.data.length && (
                    <Table
                      flex="1"
                      id="repository"
                      key={repotable.render}
                      data={repotable.data}
                      selectedRegions={repository.selection}
                      columnHeadings={H.RepositoryTableHeadings}
                      columnWidths={repository.columnWidths}
                      initialRowSort={repository.rowSort}
                      domref={tableRef.repository}
                      onEditableCellChanged={onCellEdited}
                      onCellClick={onRepoCellClick}
                      onRowsReordered={onRowsReordered.repository}
                      onColumnWidthChanged={onColumnWidthChanged.repository}
                    />
                  )}
                </Box>
                <Vbox className="button-stack" pack="center">
                  <Button
                    id="repoAdd"
                    icon="add"
                    intent="primary"
                    fill="x"
                    disabled={disable.repoAdd}
                    onClick={eventHandler}
                  />
                  <Button
                    id="repoDelete"
                    icon="delete"
                    intent="primary"
                    fill="x"
                    disabled={disable.repoDelete}
                    onClick={eventHandler}
                  />
                  <Button
                    id="repoCancel"
                    intent="primary"
                    fill="x"
                    disabled={disable.repoCancel}
                    onClick={eventHandler}
                  >
                    {G.i18n.t('cancel.label')}
                  </Button>
                </Vbox>
              </Groupbox>
            </div>
          )}

          <Hbox className="dialog-buttons" pack="end" align="end">
            {repository && repository.open && (
              <Button
                flex="1"
                fill="x"
                onClick={() =>
                  this.sState({
                    repository: { ...repository, open: false },
                  })
                }
              >
                {G.i18n.t('less.label')}
              </Button>
            )}
            {repository && !repository.open && (
              <Button
                flex="1"
                fill="x"
                onClick={() =>
                  this.sState({ repository: { ...repository, open: true } })
                }
              >
                {G.i18n.t('moduleSources.label')}
              </Button>
            )}
            {!progress && <Spacer flex="10" />}
            {progress && (
              <Hbox className="progress-container" align="center" flex="10">
                <ProgressBar
                  value={progress[0] / progress[1]}
                  intent="primary"
                  animate
                  stripes
                />
              </Hbox>
            )}
            <Button id="cancel" flex="1" fill="x" onClick={eventHandler}>
              {G.i18n.t('cancel.label')}
            </Button>
            <Button
              id="ok"
              disabled={progress !== null}
              flex="1"
              fill="x"
              onClick={eventHandler}
            >
              {G.i18n.t('ok.label')}
            </Button>
          </Hbox>
        </Vbox>
      );
    // If Internet permission is needed but has not been granted, then ask for it.
    return (
      <Vbox {...addClass('modulemanager', props)} flex="1" height="100%">
        <Dialog
          body={
            <Vbox>
              <Label value={G.i18n.t('allowInternet.title')} />
              <Label value={G.i18n.t('allowInternet.message')} />
              <Label value={G.i18n.t('allowInternet.continue')} />
            </Vbox>
          }
          buttons={
            <>
              <Spacer width="10px" />
              <Checkbox
                id="internet.rememberChoice"
                initial={false}
                label={G.i18n.t('rememberChoice.label')}
              />
              <Spacer flex="10" />
              <Button
                id="internet.yes"
                flex="1"
                fill="x"
                onClick={eventHandler}
              >
                {G.i18n.t('yes.label')}
              </Button>
              <Button id="internet.no" flex="1" fill="x" onClick={eventHandler}>
                {G.i18n.t('no.label')}
              </Button>
            </>
          }
        />
      </Vbox>
    );
  }
}
ModuleManager.defaultProps = defaultProps;
ModuleManager.propTypes = propTypes;

function audioDialogOnChange(this: ModuleManager, selection: SelectVKMType) {
  this.sState((prevState) => {
    const { showAudioDialog } = prevState;
    if (showAudioDialog.length) {
      const { book, chapter, lastchapter, v11n } = selection;
      const { options, chapters: allchs } = showAudioDialog[0];
      const { vkmods, books, verses, lastverses } = options;
      if (book && chapter !== undefined && lastchapter !== undefined) {
        const newselection: SelectVKMType = {
          book,
          chapter,
          lastchapter,
          vkmod: '',
          v11n,
        };
        const chset: Set<number> = new Set();
        allchs.forEach((v) => {
          if (v.bk === book) {
            for (let x = v.ch1; x <= v.ch2; x += 1) {
              chset.add(x);
            }
          }
        });
        const chapters = Array.from(chset).sort((a, b) =>
          a > b ? 1 : a < b ? -1 : 0
        );
        const lastchapters = chapters.filter((c) => c >= chapter);
        const newoptions: VKSelectProps['options'] = {
          vkmods,
          books,
          chapters,
          lastchapters,
          verses,
          lastverses,
        };
        showAudioDialog[0] = {
          ...showAudioDialog[0],
          selection: newselection,
          options: newoptions,
        };
        return { showAudioDialog };
      }
    }
    return null;
  });
}

export function onunload() {
  G.Module.cancel(); // closes all FTP connections
}
