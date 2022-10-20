/* eslint-disable no-nested-ternary */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import i18n from 'i18next';
import {
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
import Button from '../libxul/button';
import { Hbox, Vbox, Box } from '../libxul/boxes';
import Groupbox from '../libxul/groupbox';
import Bibleselect, {
  BibleselectChangeEvents,
  BibleselectOptions,
  BibleselectSelection,
} from '../libxul/bibleselect';
import Table from '../libxul/table';
import Spacer from '../libxul/spacer';
import Label from '../libxul/label';
import DragSizer, { DragSizerVal } from '../libxul/dragsizer';
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
  okdisabled: false,
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
    disabled: string[] | null;
  } | null;
}

export type ManagerState = ManagerStatePref & typeof notStatePref;

export default class ModuleManager extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  destroy: (() => void)[];

  toaster: Toaster | undefined;

  tableRef: {
    [table in typeof H.Tables[number]]: React.RefObject<HTMLDivElement>;
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
    s.tables.language.data = H.Saved.language.data;
    s.tables.module.data = H.Saved.module.data;
    s.tables.repository.data = H.Saved.repository.data;
    this.state = s;

    this.tableRef = {} as typeof this.tableRef;
    H.Tables.forEach((t: typeof H.Tables[number]) => {
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
      H.Saved.repository.data = [];
      H.Saved.repositoryListings = [];
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
    if (!H.Saved.repository.data.length) {
      const { repositories } = this.state as ManagerState;
      if (repositories) {
        H.Saved.repository.data = [];
        H.Saved.repositoryListings = [];
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
          (r) => downloadKey(r[H.RepCol.iInfo].repo) === id
        );
        const repdrow = repository.data[repoIndex];
        if (
          id &&
          repoIndex !== -1 &&
          repdrow &&
          prog === -1 &&
          repdrow[H.RepCol.iInfo].loading
        ) {
          repdrow[H.RepCol.iInfo].loading = false;
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
          const { repo } = r[H.ModCol.iInfo];
          const mod = r[H.ModCol.iModule];
          return [downloadKey(repo), mod].join('.') === id;
        });
        const moddrow = module.data[modIndex];
        if (id && modIndex !== -1 && moddrow && prog === -1) {
          if (moddrow[H.ModCol.iInfo].conf.DataPath) {
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
          repo.disabled = disabled.includes(downloadKey(repo)) || false;
        }
        const css = H.classes([H.RepCol.iState], ['checkbox-column']);
        const canedit = repo.custom ? H.editable() : false;
        const isloading = repo.disabled ? false : H.loading(H.RepCol.iState);
        const on = repo.builtin ? H.ALWAYS_ON : H.ON;
        let lng = i18n.language;
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
      this.setTableState('repository', null, repoTableData, false);
    }
    return allrepos;
  }

  // Update the repository table after receiving new repositoryListings.
  updateRepositoryLists(rawModuleData: RepositoryListing[]) {
    const state = this.state as ManagerState;
    const { progress } = state;
    const { repository } = state.tables;
    const { repositoryListings } = H.Saved;
    rawModuleData.forEach((listing, i) => {
      if (listing === null) return;
      const drow = repository.data[i];
      if (drow) {
        if (typeof listing === 'string') {
          this.addToast({ message: listing });
          if (drow[H.RepCol.iState] !== H.OFF) this.switchRepo([i], false);
          drow[H.RepCol.iInfo].intent = H.intent(H.RepCol.iState, 'danger');
          drow[H.RepCol.iInfo].loading = false;
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
          if ([H.ON, H.ALWAYS_ON].includes(drow[H.RepCol.iState])) {
            drow[H.RepCol.iInfo].intent = H.intent(H.RepCol.iState, 'success');
          }
        }
      }
    });
    this.setTableState('repository', null, repository.data, false);
    return true;
  }

  // Load language table with all languages found in the saved repositoryListings
  // data, keeping the selection the same if possible. It returns the new
  // selection.
  loadLanguageTable(): RowSelection {
    const state = this.state as ManagerState;
    const { language: langtable, repository: repotable } = state.tables;
    const { selection } = state.language;
    const { repositoryListings } = H.Saved;
    const selectedRowIndexes = this.selectionToDataRows('language', selection);
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
    const langlist = Array.from(langs).sort();
    const newTableData: TLanguageTableRow[] = [];
    langlist.forEach((l) =>
      newTableData.push([getLangReadable(l), { code: l }])
    );
    const newlanguage: RowSelection = [];
    newTableData.forEach((r, i) => {
      if (selectedcodes?.includes(r[H.LanCol.iInfo].code)) {
        newlanguage.push({ rows: [i, i] });
      }
    });
    this.setTableState(
      'language',
      { selection: newlanguage },
      newTableData,
      true
    );
    return newlanguage;
  }

  // Load the module table with modules sharing the language code,
  // or else with all modules if the code is null.
  loadModuleTable(languageSelection?: RowSelection) {
    const state = this.state as ManagerState;
    // Insure there is one moduleData row object for each module in
    // each repository (local and remote). The same object should be reused
    // throughout the lifetime of the window, so user interactions will be recorded.
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
          const repokey = downloadKey(repo);
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
              mtype = `XSM ${i18n.t(
                C.SupportedModuleTypes[mtype as ModTypes]
              )}`;
            } else if (c.xsmType === 'XSM_audio') {
              mtype = `XSM ${i18n.t('audio.label')}`;
            }
            const d = [] as unknown as TModuleTableRow;
            d[H.ModCol.iInfo] = {
              repo,
              shared: repokey === downloadKey(H.builtinRepos()[0]),
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
                (c.Description[i18n.language] || c.Description.en)) ||
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
              (c.Copyright && (c.Copyright[i18n.language] || c.Copyright.en)) ||
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
      okdisabled,
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
      moduleCancel: !modtable.data.find((r) => r[H.ModCol.iInfo].loading),
      repoAdd: false,
      repoDelete:
        !repository?.selection.length ||
        !selectionToDataRows('repository', repository.selection).every(
          (r) =>
            repotable.data[r] && repotable.data[r][H.RepCol.iInfo]?.repo?.custom
        ),
      repoCancel: !repotable.data.find((r) => r[H.RepCol.iInfo].loading),
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
                <Button onClick={dialogClose}>{i18n.t('cancel.label')}</Button>
                <Button onClick={dialogAccept}>{i18n.t('ok.label')}</Button>
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
              {!showModuleInfo && (
                <Button
                  id="moduleInfo"
                  icon="info-sign"
                  intent="primary"
                  fill="x"
                  disabled={disable.moduleInfo}
                  onClick={eventHandler}
                />
              )}
              {showModuleInfo && (
                <Button
                  id="moduleInfoBack"
                  intent="primary"
                  fill="x"
                  disabled={disable.moduleInfoBack}
                  onClick={eventHandler}
                >
                  {i18n.t('back.label')}
                </Button>
              )}
              <Button
                id="moduleCancel"
                intent="primary"
                fill="x"
                disabled={disable.moduleCancel}
                onClick={eventHandler}
              >
                {i18n.t('cancel.label')}
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
                  {i18n.t('cancel.label')}
                </Button>
              </Vbox>
            </Groupbox>
          </div>
        )}

        <Hbox className="dialogbuttons" pack="end" align="end">
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
              {i18n.t('less.label')}
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
              {i18n.t('moduleSources.label')}
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
            {i18n.t('cancel.label')}
          </Button>
          <Button
            id="ok"
            disabled={okdisabled}
            flex="1"
            fill="x"
            onClick={eventHandler}
          >
            {i18n.t('ok.label')}
          </Button>
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
