/* eslint-disable no-nested-ternary */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import i18n from 'i18next';
import {
  Button as BPButton,
  Classes,
  Dialog,
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
  sanitizeHTML,
} from '../../common';
import C from '../../constant';
import G from '../rg';
import { log, getStatePref, onSetWindowState, getLangReadable } from '../rutil';
import {
  addClass,
  xulDefaultProps,
  XulProps,
  xulPropTypes,
} from '../libxul/xul';
import { Hbox, Vbox, Box } from '../libxul/boxes';
import Groupbox from '../libxul/groupbox';
import Bibleselect, {
  BibleselectChangeEvents,
  BibleselectOptions,
  BibleselectSelection,
} from '../libxul/bibleselect';
import Table, {
  TonCellClick,
  TonColumnHide,
  TonColumnsReordered,
  TonColumnWidthChanged,
  TonEditableCellChanged,
  TonRowsReordered,
  TinitialRowSort,
} from '../libxul/table';
import Spacer from '../libxul/spacer';
import Label from '../libxul/label';
import DragSizer, { DragSizerVal } from '../libxul/dragsizer';
import * as H from './managerH';
import './manager.css';

// TODO!: showModuleInfo CSS
// TODO!: ModuleNanager Locale
// TODO!: ModuleManager RTL

import type {
  ModTypes,
  PrefObject,
  Repository,
  RepositoryListing,
  RowSelection,
  SwordConfAudioChapters,
  SwordConfType,
} from '../../type';
import {
  ALWAYS_ON,
  builtinRepos,
  classes,
  editable,
  intent,
  LanCol,
  LanguageTableHeadings,
  loading,
  modclasses,
  ModCol,
  ModuleTableHeadings,
  OFF,
  ON,
  RepCol,
  RepositoryTableHeadings,
  Saved,
  Tables,
  TLanguageTableRow,
  TModuleTableRow,
  tooltip,
  TRepositoryTableRow,
} from './managerH';

G.Module.clearDownload();

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
  progress: null as number[] | null,
  showModuleInfo: '',
  showChapterDialog: null as {
    conf: SwordConfType;
    selection: BibleselectSelection;
    initialSelection: BibleselectSelection;
    options: BibleselectOptions;
    chapters: SwordConfAudioChapters;
    callback: (result: BibleselectSelection | null) => void;
  } | null,
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
    disabled: string[];
  } | null;
}

export type ManagerState = ManagerStatePref & typeof notStatePref;

export default class ModuleManager extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  destroy: (() => void)[];

  toaster: Toaster | undefined;

  tableRef: {
    [table in typeof Tables[number]]: React.RefObject<HTMLDivElement>;
  };

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

  selectionToDataRows;

  rowSelect;

  switchRepo;

  download;

  eventHandler;

  setTableState;

  sState: (
    s:
      | Partial<ManagerState>
      | ((prevState: ManagerState) => Partial<ManagerState>)
  ) => void;

  constructor(props: ManagerProps) {
    super(props);

    if (!props.id) throw Error(`Manager must have an ID`);
    const s: ManagerState = {
      ...notStatePref,
      ...(getStatePref(props.id) as ManagerStatePref),
    };
    s.tables.language.data = Saved.language.data;
    s.tables.module.data = Saved.module.data;
    s.tables.repository.data = Saved.repository.data;
    this.state = s;

    this.tableRef = {} as typeof this.tableRef;
    Tables.forEach((t: typeof Tables[number]) => {
      this.tableRef[t] = React.createRef();
    });

    this.destroy = [];

    this.loadRepositoryTable = this.loadRepositoryTable.bind(this);
    this.updateRepositoryLists = this.updateRepositoryLists.bind(this);
    this.loadModuleTable = this.loadModuleTable.bind(this);
    this.moduleTableData = this.moduleTableData.bind(this);
    this.onColumnHide = H.onColumnHide.bind(this);
    this.onColumnsReordered = H.onColumnsReordered.bind(this);
    this.selectionToDataRows = H.selectionToDataRows.bind(this);
    this.rowSelect = H.rowSelect.bind(this);
    this.onRepoCellClick = H.onRepoCellClick.bind(this);
    this.onLangCellClick = H.onLangCellClick.bind(this);
    this.onModCellClick = H.onModCellClick.bind(this);
    this.onCellEdited = H.onCellEdited.bind(this);
    this.switchRepo = H.switchRepo.bind(this);
    this.download = H.download.bind(this);
    this.eventHandler = H.eventHandler.bind(this);
    this.setTableState = H.setTableState.bind(this);
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
    this.dialogOnChange = this.dialogOnChange.bind(this);
    this.dialogClose = this.dialogClose.bind(this);
    this.dialogAccept = this.dialogAccept.bind(this);
    this.sState = this.setState.bind(this);
  }

  componentDidMount() {
    const handleListing = (listing: RepositoryListing[]) => {
      this.updateRepositoryLists(listing);
      let langselection = this.loadLanguageTable();
      const { language } = this.state as ManagerState;
      if (!language.open) langselection = [];
      return this.loadModuleTable(langselection);
    };
    const loadLocalRepos = async () => {
      Saved.repository.data = [];
      Saved.repositoryListings = [];
      let listing: RepositoryListing[] = [];
      try {
        listing = await G.Downloader.repositoryListing(
          this.loadRepositoryTable()
        );
      } catch (err) {
        log.warn(err);
      }
      return handleListing(listing);
    };
    // Download data for the repository and module tables
    if (!Saved.repository.data.length) {
      const { repositories } = this.state as ManagerState;
      if (repositories) {
        Saved.repository.data = [];
        Saved.repositoryListings = [];
        G.Downloader.crossWireMasterRepoList()
          .then((repos) => {
            if (typeof repos === 'string') {
              const msg =
                repos === 'Canceled'
                  ? `Master Repository List canceled.`
                  : repos;
              throw new Error(msg);
            }
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
                      progress: [
                        p - arepo.filter(Boolean).length,
                        loads.length,
                      ],
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
            return loadLocalRepos();
          });
      } else loadLocalRepos();
    }
    this.destroy.push(onSetWindowState(this));
    // Instantiate progress handlers
    this.destroy.push(
      window.ipc.renderer.on('progress', (prog: number, id?: string) => {
        const state = this.state as ManagerState;
        const { progress } = state;
        const { repository, module } = state.tables;
        const repoIndex = repository.data.findIndex(
          (r) => downloadKey(r[RepCol.iInfo].repo) === id
        );
        const repdrow = repository.data[repoIndex];
        if (
          id &&
          repoIndex !== -1 &&
          repdrow &&
          prog === -1 &&
          repdrow[RepCol.iInfo].loading
        ) {
          repdrow[RepCol.iInfo].loading = false;
          let newprog = null;
          if (progress) {
            const [p, t] = progress;
            newprog = p + 1 === t ? null : [p + 1, t];
          }
          this.setTableState('repository', null, repository.data, false, {
            progress: newprog,
          });
        }
        const modIndex = module.data.findIndex((r) => {
          const { repo } = r[ModCol.iInfo];
          const mod = r[ModCol.iModule];
          return [downloadKey(repo), mod].join('.') === id;
        });
        const moddrow = module.data[modIndex];
        if (id && modIndex !== -1 && moddrow && prog === -1) {
          if (moddrow[ModCol.iInfo].conf.DataPath) {
            Object.values(module.data)
              .filter((r) => {
                return (
                  r[ModCol.iInfo].conf.DataPath ===
                  moddrow[ModCol.iInfo].conf.DataPath
                );
              })
              .forEach((r: TModuleTableRow) => {
                r[ModCol.iInfo].loading = false;
              });
          } else moddrow[ModCol.iInfo].loading = false;
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

  sizeTableToParent(table: typeof Tables[number]) {
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
            this.setTableState(table, { columnWidths }, null, true);
          }
        }
      }
    }
  }

  // Load the repository table with all built-in repositories, xulsword
  // repositories, user-custom repositories, and those passed in repos
  // (which normally come from the CrossWire Master Repository List).
  // It returns the array of repositories that was used to create the table.
  loadRepositoryTable(repos?: Repository[]): Repository[] {
    const state = this.state as ManagerState;
    const { repositories } = state;
    let disabled: string[] = [];
    let allrepos = builtinRepos;
    if (repositories) {
      disabled = repositories.disabled;
      const { xulsword, custom } = repositories;
      custom.forEach((cr) => {
        cr.custom = true;
      });
      allrepos = allrepos.concat(xulsword, custom, repos || []);
    }
    if ('repository' in state) {
      const repoTableData: TRepositoryTableRow[] = [];
      allrepos.forEach((repo) => {
        let dis = false;
        if (!repo.builtin) {
          dis = disabled.includes(downloadKey(repo));
        }
        repo.disabled = dis;
        const css = classes([RepCol.iState], ['checkbox-column']);
        const canedit = repo.custom ? editable() : false;
        const isloading = repo.disabled ? false : loading(RepCol.iState);
        const on = repo.builtin ? ALWAYS_ON : ON;
        repoTableData.push([
          repo.name || '',
          repo.domain,
          repo.path,
          repo.disabled ? OFF : on,
          {
            loading: isloading,
            editable: canedit,
            classes: css,
            repo,
            tooltip: tooltip('VALUE', [RepCol.iState]),
          },
        ]);
      });
      this.setTableState('repository', null, repoTableData, false);
    }
    return allrepos;
  }

  // Update raw module data and the repository table after receiving repositoryListing.
  // It returns updated rawModuleData.
  updateRepositoryLists(rawModuleData: RepositoryListing[]) {
    const state = this.state as ManagerState;
    const { progress } = state;
    const { repository } = state.tables;
    const { repositoryListings } = Saved;
    rawModuleData.forEach((listing, i) => {
      if (listing === null) return;
      const drow = repository.data[i];
      if (drow) {
        if (typeof listing === 'string') {
          this.addToast({ message: listing });
          if (drow[RepCol.iState] !== OFF) this.switchRepo([i], false);
          drow[RepCol.iInfo].intent = intent(RepCol.iState, 'danger');
          drow[RepCol.iInfo].loading = false;
          if (!Array.isArray(repositoryListings[i])) {
            repositoryListings[i] = null;
          }
          let newprog = null;
          if (progress) {
            const [p, t] = progress;
            newprog = p + 1 === t ? null : [p + 1, t];
          }
          this.sState({ progress: newprog });
          return;
        }
        if (Array.isArray(listing)) {
          repositoryListings[i] = listing;
          if ([ON, ALWAYS_ON].includes(drow[RepCol.iState])) {
            drow[RepCol.iInfo].intent = intent(RepCol.iState, 'success');
          }
        }
      }
    });
    this.setTableState('repository', null, repository.data, false);
    return true;
  }

  // Load language table with all languages found in the saved repositoryListings
  // data, keeping the selection the same when possible. It returns the new
  // selection.
  loadLanguageTable(): RowSelection {
    const state = this.state as ManagerState;
    const { language: langtable, repository: repotable } = state.tables;
    const { selection } = state.language;
    const { repositoryListings } = Saved;
    const selectedRowIndexes = this.selectionToDataRows('language', selection);
    const selectedcodes = langtable.data
      .filter((_r, i) => selectedRowIndexes.includes(i))
      .map((r) => r[LanCol.iInfo].code);
    const langs: Set<string> = new Set();
    repositoryListings.forEach((listing, i) => {
      if (
        Array.isArray(listing) &&
        repotable.data[i] &&
        repotable.data[i][RepCol.iState] !== OFF
      ) {
        listing.forEach((c) => {
          const l = c.Lang || 'en';
          langs.add(l.replace(/-.*$/, ''));
        });
      }
    });
    const langlist = Array.from(langs).sort();
    const newTableData: TLanguageTableRow[] = [];
    langlist.forEach((l) =>
      newTableData.push([getLangReadable(l), { code: l }])
    );
    const newlanguage: RowSelection = [];
    newTableData.forEach((r, i) => {
      if (selectedcodes?.includes(r[LanCol.iInfo].code)) {
        newlanguage.push({ rows: [i, i] });
      }
    });
    this.setTableState(
      'language',
      { selection: newlanguage },
      newTableData,
      false
    );
    return newlanguage;
  }

  // Load the module table with modules sharing the language code,
  // or else with all modules if the code is null.
  loadModuleTable(languageSelection?: RowSelection) {
    const state = this.state as ManagerState;
    // Insure there is one moduleData row object for each module in
    // each repository. The same object should be reused throughout
    // the lifetime of the window, so user interactions will be recorded.
    const { repository: repotable } = state.tables;
    Saved.moduleLangData = { allmodules: [] };
    const { moduleData, moduleLangData, repositoryListings } = Saved;
    const enabledExternRepoMods: { [modunique: string]: string } = {};
    const enabledXulswordRepoMods: { [modunique: string]: string } = {};
    const localModules: { [modunique: string]: string } = {};
    repositoryListings.forEach((listing, i) => {
      const drow = repotable.data[i];
      if (drow && Array.isArray(listing)) {
        listing.forEach((c) => {
          const { repo } = drow[RepCol.iInfo];
          const repokey = downloadKey(repo);
          const modrepk = modrepKey(c.module, repo);
          const modunique = [c.module, c.Version].join('.');
          const repoIsLocal = isRepoLocal(c.sourceRepository);
          if (repoIsLocal) localModules[modunique] = repokey;
          else if (drow[RepCol.iState] !== OFF) {
            enabledExternRepoMods[modunique] = repokey;
            if (c.moduleType.startsWith('XSM')) {
              enabledXulswordRepoMods[modunique] = repokey;
            }
          }
          if (!(modrepk in moduleData)) {
            const d = [] as unknown as TModuleTableRow;
            d[ModCol.iInfo] = {
              repo,
              shared: repokey === downloadKey(builtinRepos[0]),
              classes: modclasses(),
              tooltip: tooltip('VALUE', [ModCol.iShared, ModCol.iInstalled]),
              conf: c,
            };
            d[ModCol.iType] = c.moduleType;
            d[ModCol.iAbout] =
              (c.Description &&
                (c.Description[i18n.language] || c.Description.en)) ||
              '';
            d[ModCol.iModule] = c.module;
            d[ModCol.iRepoName] =
              repo.name ||
              (repoIsLocal ? repo.path : `${repo.domain}/${repo.path}`);
            d[ModCol.iVersion] = c.Version || '';
            d[ModCol.iSize] = (c.InstallSize && c.InstallSize.toString()) || '';
            d[ModCol.iFeatures] = (c.Feature && c.Feature.join(', ')) || '';
            d[ModCol.iVersification] = c.Versification || 'KJV';
            d[ModCol.iScope] = c.Scope || '';
            d[ModCol.iCopyright] =
              (c.Copyright && (c.Copyright[i18n.language] || c.Copyright.en)) ||
              '';
            d[ModCol.iLicense] = c.DistributionLicense || '';
            d[ModCol.iSourceType] = c.SourceType || '';
            d[ModCol.iShared] = () => {
              return d[ModCol.iInfo].shared ? ON : OFF;
            };
            d[ModCol.iInstalled] = repoIsLocal ? ON : OFF;
            moduleData[modrepk] = d;
          }
        });
      }
    });
    // Installed modules (ie those in local repos) which are from enabled
    // remote repositories are not included in moduleLangData. Rather their
    // 'installed' and 'shared' checkboxes are applied to the corresponding
    // remote repository module. Also, modules in disabled repositories
    // are not included. If a xulsword module repository is enabled, its
    // modules will replace the listings of modules having the same name in
    // regular repositories.
    repositoryListings.forEach((listing, i) => {
      const drow = repotable.data[i];
      if (drow && Array.isArray(listing) && drow[RepCol.iState] !== OFF) {
        listing.forEach((c) => {
          const { repo } = drow[RepCol.iInfo];
          const modrepk = modrepKey(c.module, repo);
          const modrow = moduleData[modrepk];
          const modunique = [
            modrow[ModCol.iModule],
            modrow[ModCol.iVersion],
          ].join('.');
          const repoIsLocal = isRepoLocal(repo);
          if (
            repoIsLocal &&
            (modunique in enabledExternRepoMods ||
              modunique in enabledXulswordRepoMods)
          )
            return;
          if (
            modunique in enabledXulswordRepoMods &&
            !c.moduleType.startsWith('XSM')
          ) {
            return;
          }
          if (!repoIsLocal && modunique in localModules) {
            modrow[ModCol.iInstalled] = ON;
            const modrepok = `${localModules[modunique]}.${c.module}`;
            if (modrepok in moduleData) {
              modrow[ModCol.iInfo].shared =
                moduleData[modrepok][ModCol.iInfo].shared;
            }
          }
          const code = (c.Lang && c.Lang.replace(/-.*$/, '')) || 'en';
          if (!(code in moduleLangData)) moduleLangData[code] = [];
          moduleLangData[code].push(modrow);
          moduleLangData.allmodules.push(modrow);
        });
      }
    });
    this.setTableState(
      'module',
      null,
      this.moduleTableData(languageSelection),
      true
    );
    return true;
  }

  // Return sorted and filtered (by language selection) module table data.
  moduleTableData(filter?: RowSelection): TModuleTableRow[] {
    const state = this.state as ManagerState;
    const { language: langtable } = state.tables;
    const rows = this.selectionToDataRows('language', filter || []);
    const codes: string[] = [];
    rows.forEach((r) => {
      if (langtable.data[r]) {
        codes.push(langtable.data[r][LanCol.iInfo].code);
      }
    });
    const { moduleLangData } = Saved;
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

  dialogOnChange(_e: BibleselectChangeEvents, selection: BibleselectSelection) {
    const { showChapterDialog } = this.state as ManagerState;
    if (showChapterDialog) {
      const { book, chapter, lastchapter } = selection;
      const { options, chapters: allchs } = showChapterDialog;
      const { trans, books, verses, lastverses } = options;
      if (book && chapter !== undefined && lastchapter !== undefined) {
        const newselection: BibleselectSelection = {
          book,
          chapter,
          lastchapter,
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
        const newoptions: BibleselectOptions = {
          trans,
          books,
          chapters,
          lastchapters,
          verses,
          lastverses,
        };
        this.sState({
          showChapterDialog: {
            ...showChapterDialog,
            selection: newselection,
            options: newoptions,
          },
        });
      }
    }
  }

  dialogClose() {
    const { showChapterDialog } = this.state as ManagerState;
    if (showChapterDialog) {
      showChapterDialog.callback(null);
      this.sState({ showChapterDialog: null });
    }
  }

  dialogAccept() {
    const { showChapterDialog } = this.state as ManagerState;
    if (showChapterDialog) {
      const { selection } = showChapterDialog;
      showChapterDialog.callback(selection);
      this.sState({ showChapterDialog: null });
    }
  }

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
      module,
      repository,
      showModuleInfo,
      showChapterDialog,
      progress,
    } = state;
    const {
      language: langtable,
      module: modtable,
      repository: repotable,
    } = state.tables;
    const {
      eventHandler,
      onCellEdited,
      onColumnHide,
      onColumnsReordered,
      onLangCellClick,
      onModCellClick,
      onRepoCellClick,
      onRowsReordered,
      onColumnWidthChanged,
      selectionToDataRows,
      dialogClose,
      dialogAccept,
      tableRef,
      dialogOnChange,
    } = this;

    const disable = {
      moduleInfo: !selectionToRows(module.selection).length,
      moduleInfoBack: false,
      moduleCancel: !modtable.data.find((r) => r[ModCol.iInfo].loading),
      repoAdd: false,
      repoDelete:
        !repository?.selection.length ||
        !selectionToDataRows('repository', repository.selection).every(
          (r) =>
            repotable.data[r] && repotable.data[r][RepCol.iInfo]?.repo?.custom
        ),
      repoCancel: !repotable.data.find((r) => r[RepCol.iInfo].loading),
    };

    let dialogmod = '';
    let dialogText = '';
    if (showChapterDialog) {
      dialogmod = showChapterDialog.conf.module;
      const ab = showChapterDialog.conf.Description;
      if (ab) dialogText = ab[i18n.language] || ab.en;
    }

    return (
      <Vbox {...addClass('modulemanager', props)} flex="1" height="100%">
        <Toaster
          canEscapeKeyClear
          position={Position.TOP}
          usePortal
          ref={this.refHandlers.toaster}
        />
        {showChapterDialog && (
          <Dialog isOpen>
            <div className={Classes.DIALOG_BODY}>
              <Vbox>
                <Label value={dialogmod} />
                <div>{dialogText}</div>
                <Bibleselect
                  height="2em"
                  initialSelection={showChapterDialog.initialSelection}
                  options={showChapterDialog.options}
                  onSelectionChange={dialogOnChange}
                />
              </Vbox>
            </div>
            <div className={Classes.DIALOG_FOOTER}>
              <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                <BPButton onClick={dialogClose}>
                  {i18n.t('cancel.label')}
                </BPButton>
                <BPButton onClick={dialogAccept}>{i18n.t('ok.label')}</BPButton>
              </div>
            </div>
          </Dialog>
        )}
        <Hbox
          flex="1"
          className={`language ${language.open ? 'open' : 'closed'}`}
        >
          {language.open && (
            <>
              <Groupbox
                caption={i18n.t('menu.options.language')}
                orient="vertical"
                width={language.width}
              >
                <Box flex="1">
                  <Table
                    id="language"
                    key={langtable.render}
                    columnHeadings={LanguageTableHeadings}
                    initialRowSort={language.rowSort}
                    data={langtable.data}
                    selectedRegions={language.selection}
                    domref={tableRef.language}
                    onRowsReordered={onRowsReordered.language}
                    onCellClick={onLangCellClick}
                  />
                </Box>
                <BPButton
                  id="languageListClose"
                  icon="chevron-left"
                  fill
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
                <BPButton
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
                  key={modtable.render}
                  data={modtable.data}
                  selectedRegions={module.selection}
                  columnHeadings={ModuleTableHeadings}
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
              {!showModuleInfo && (
                <BPButton
                  id="moduleInfo"
                  icon="info-sign"
                  intent="primary"
                  disabled={disable.moduleInfo}
                  onClick={eventHandler}
                />
              )}
              {showModuleInfo && (
                <BPButton
                  id="moduleInfoBack"
                  intent="primary"
                  disabled={disable.moduleInfoBack}
                  onClick={eventHandler}
                >
                  {i18n.t('back.label')}
                </BPButton>
              )}
              <BPButton
                id="moduleCancel"
                intent="primary"
                disabled={disable.moduleCancel}
                onClick={eventHandler}
              >
                {i18n.t('cancel.label')}
              </BPButton>
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
              shrink
            />
            <Groupbox
              caption={i18n.t('moduleSources.label')}
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
                    columnHeadings={RepositoryTableHeadings}
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
                <BPButton
                  id="repoAdd"
                  icon="add"
                  intent="primary"
                  disabled={disable.repoAdd}
                  onClick={eventHandler}
                />
                <BPButton
                  id="repoDelete"
                  icon="delete"
                  intent="primary"
                  disabled={disable.repoDelete}
                  onClick={eventHandler}
                />
                <BPButton
                  id="repoCancel"
                  intent="primary"
                  disabled={disable.repoCancel}
                  onClick={eventHandler}
                >
                  {i18n.t('cancel.label')}
                </BPButton>
              </Vbox>
            </Groupbox>
          </div>
        )}

        <Hbox className="dialogbuttons" pack="end" align="end">
          {repository && repository.open && (
            <BPButton
              onClick={() =>
                this.sState({
                  repository: { ...repository, open: false },
                })
              }
            >
              {i18n.t('less.label')}
            </BPButton>
          )}
          {repository && !repository.open && (
            <BPButton
              onClick={() =>
                this.sState({ repository: { ...repository, open: true } })
              }
            >
              {i18n.t('moduleSources.label')}
            </BPButton>
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
          <BPButton id="cancel" onClick={eventHandler}>
            {i18n.t('cancel.label')}
          </BPButton>
          <BPButton id="ok" onClick={eventHandler}>
            {i18n.t('ok.label')}
          </BPButton>
        </Hbox>
      </Vbox>
    );
  }
}
ModuleManager.defaultProps = defaultProps;
ModuleManager.propTypes = propTypes;

export function onunload() {
  G.Module.clearDownload(); // closes all FTP connections
}
