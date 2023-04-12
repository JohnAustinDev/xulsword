/* eslint-disable import/order */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-nested-ternary */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import PropTypes from 'prop-types';
import {
  Intent,
  IToastProps,
  Position,
  ProgressBar,
  Toaster,
} from '@blueprintjs/core';
import {
  downloadKey,
  isRepoLocal,
  selectionToTableRows,
  repositoryKey,
  tableRowsToSelection,
  clone,
  builtinRepos,
  repositoryModuleKey,
  stringHash,
} from '../../common';
import C from '../../constant';
import S from '../../defaultPrefs';
import G from '../rg';
import log from '../log';
import {
  getStatePref,
  getLangReadable,
  setStatePref,
  windowArguments,
} from '../rutil';
import {
  addClass,
  xulDefaultProps,
  XulProps,
  xulPropTypes,
} from '../libxul/xul';
import Button from '../libxul/button';
import { Hbox, Vbox, Box } from '../libxul/boxes';
import Groupbox from '../libxul/groupbox';
import SelectVK from '../libxul/selectVK';
import SelectOR, { SelectORProps, SelectORMType } from '../libxul/selectOR';
import Table, { TablePropColumn } from '../libxul/table';
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
  Repository,
  RepositoryListing,
  RowSelection,
  SwordConfType,
} from '../../type';
import type {
  TLanguageTableRow,
  TModuleTableRow,
  TRepositoryTableRow,
} from './managerH';
import type {
  TonCellClick,
  TonEditableCellChanged,
  TonRowsReordered,
} from '../libxul/table';
import type { SelectVKProps, SelectVKType } from '../libxul/selectVK';
import type { ModinfoParent } from '../libxul/modinfo';
import { WindowRootState } from 'renderer/renderer';

G.Module.cancel();

let MasterRepoListDownloaded = false;
let resetOnResize = false;
const windowDescriptor = windowArguments();

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
  id: PropTypes.oneOf(['moduleManager', 'removeModule']),
};

export type ManagerProps = XulProps & {
  id: 'moduleManager' | 'removeModule';
};

const notStatePref = {
  infoConfigs: [] as SwordConfType[],
  progress: null as number[] | null,
  showAudioDialog: [] as (H.VersekeyDialog | H.GenBookDialog)[],
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

export type ManagerStatePref =
  | typeof S.prefs.moduleManager
  | typeof S.prefs.removeModule;

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

  languageTableCompRef;

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

  onRepoCellClick: TonCellClick;

  onLangCellClick: TonCellClick;

  onModCellClick: TonCellClick;

  onCellEdited: TonEditableCellChanged;

  eventHandler;

  audioDialogOnChange:
    | SelectVKProps['onSelection']
    | SelectORProps['onSelection'];

  modinfoParentHandler: typeof modinfoParentHandlerH;

  sState: (
    // sState is just for better TypeScript functionality
    s:
      | Partial<ManagerState>
      | ((prevState: ManagerState) => Partial<ManagerState> | null)
  ) => void;

  constructor(props: ManagerProps) {
    super(props);
    const { id } = props;

    const s: ManagerState = {
      ...modinfoParentInitialState,
      ...notStatePref,
      ...(getStatePref('prefs', id) as ManagerStatePref),
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

    this.languageTableCompRef = React.createRef();

    this.modinfoRefs = {
      textarea: React.createRef(),
      container: React.createRef(),
    };

    this.destroy = [];

    this.loadRepositoryTable = this.loadRepositoryTable.bind(this);
    this.loadModuleTable = this.loadModuleTable.bind(this);
    this.filterModuleTable = this.filterModuleTable.bind(this);
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
    this.audioDialogOnChange = audioDialogOnChange.bind(this);
    this.audioDialogClose = this.audioDialogClose.bind(this);
    this.audioDialogAccept = this.audioDialogAccept.bind(this);
    this.languageCodesToTableSelection =
      this.languageCodesToTableSelection.bind(this);
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
    const props = this.props as ManagerProps;
    const state = this.state as ManagerState;
    const { id } = props;
    setStatePref('prefs', id, prevState, state);
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
            return { ...r, file: C.SwordRepoManifest, type: 'ftp' };
          })
        );
      } catch (err) {
        log.warn(err);
      }
      H.handleListings(this, listing);
    };
    // Download data for the repository and module tables
    if (!MasterRepoListDownloaded) {
      MasterRepoListDownloaded = true;
      let remoteRepos: string | Repository[] = [];
      if (repositories) {
        H.Saved.repository.data = [];
        H.Saved.repositoryListings = [];
        try {
          if (!navigator.onLine) throw new Error(`No Internet connection.`);
          remoteRepos = await G.Module.crossWireMasterRepoList();
          if (typeof remoteRepos === 'string') throw new Error(remoteRepos);
        } catch (er: any) {
          remoteRepos = [];
          // Failed to load the master list, so just load local repos.
          log.warn(er);
          const msg = (typeof er === 'object' && er.message) || '';
          this.addToast({
            message: `Unable to download Master Repository List.\n${msg}`,
            timeout: 5000,
            intent: Intent.WARNING,
          });
        }
      }
      if (remoteRepos.length) {
        // Calling loadRepositoryTable on all repos at once causes the
        // module table to remain empty until all repository listings have
        // been downloaded, and certain repos may take a long time. So
        // instead it is called on each repo separately.
        this.loadRepositoryTable(remoteRepos).map(async (r, i, a) => {
          return G.Module.repositoryListing([
            { ...r, file: C.SwordRepoManifest, type: 'ftp' },
          ])
            .then((list) => {
              H.handleListings(
                this,
                a.map((_lr, ir) => (ir === i ? list[0] : null))
              );
              return true;
            })
            .catch((er) => {
              log.error(er);
            });
        });
      } else loadLocalRepos();
    }

    // Instantiate progress handler
    this.destroy.push(
      window.ipc.on('progress', (prog: number, id?: string) => {
        const state = this.state as ManagerState;
        if (id) {
          H.setDownloadProgress(this, id, prog);
          // Set individual repository progress bars
          const { repository, module } = state.tables;
          const repoIndex = repository.data.findIndex(
            (r) =>
              downloadKey({
                ...r[H.RepCol.iInfo].repo,
                file: C.SwordRepoManifest,
                type: 'ftp',
              }) === id
          );
          const repdrow = repository.data[repoIndex];
          if (repdrow && prog === -1 && repdrow[H.RepCol.iInfo].loading) {
            repdrow[H.RepCol.iInfo].loading = false;
            H.setTableState(this, 'repository', null, repository.data, true);
          }
          // Set individual module progress bars
          const modIndex = module.data.findIndex((r) => {
            const { repo, conf } = r[H.ModCol.iInfo];
            const mod = r[H.ModCol.iModule];
            return (
              downloadKey({
                ...repo,
                module: mod,
                confname: conf.filename,
                type: 'module',
              }) === id
            );
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
  }

  // Load the repository table with all built-in repositories, xulsword
  // repositories, user-custom repositories, and those passed in repos
  // (which normally come from the CrossWire Master Repository List).
  // It returns the array of repositories that was used to create the
  // table data.
  loadRepositoryTable(repos?: Repository[]): Repository[] {
    const state = this.state as ManagerState;
    const { repositories } = state;
    let allrepos = builtinRepos(G.i18n, G.Dirs.path);
    if (repositories) {
      const { xulsword, custom } = repositories;
      allrepos = allrepos.concat(xulsword, custom, repos || []);
    }
    const repoTableData: TRepositoryTableRow[] = [];
    allrepos.forEach((repo) => {
      if (repositories && repositories.disabled !== null && !repo.builtin) {
        repo.disabled =
          repositories.disabled.includes(repositoryKey(repo)) || false;
      }
      const css = H.classes([H.RepCol.iState], ['checkbox-column']);
      const canedit = repo.custom ? H.editable() : false;
      const isloading = repo.disabled ? false : H.loading(H.RepCol.iState);
      const on = repo.builtin ? H.ALWAYS_ON : H.ON;
      let reponame = repo.name;
      const opts = { ns: 'branding' };
      if (G.i18n.exists(`${repo.name}.repository.label`, opts)) {
        reponame = G.i18n.t(`${repo.name}.repository.label`, opts);
      }
      let lng = G.i18n.language;
      if (!['en', 'ru'].includes(lng)) lng = C.FallbackLanguage[lng];
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
    H.setTableState(this, 'repository', null, repoTableData, true);
    return allrepos;
  }

  // Load the language table with all languages found in all currently enabled
  // repositories that are present in the saved repositoryListings and scroll
  // to the first selected language if there is one.
  loadLanguageTable() {
    const state = this.state as ManagerState;
    const { repository: repotable } = state.tables;
    const { repositoryListings } = H.Saved;
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
    H.setTableState(this, 'language', null, newTableData, true);

    const { selection } = state.language;
    if (selection.length) {
      const selectedRegions = this.languageCodesToTableSelection(selection);
      const firstSelectedRegion = selectedRegions[0];
      if (firstSelectedRegion) {
        const { languageTableCompRef } = this;
        const tc = languageTableCompRef.current;
        if (
          tc &&
          typeof tc === 'object' &&
          'scrollToRegion' in tc &&
          typeof tc.scrollToRegion === 'function'
        ) {
          tc.scrollToRegion(firstSelectedRegion);
        }
      }
    }
  }

  // Convert the language table string array selection to a current language table
  // row selection.
  languageCodesToTableSelection(codes: string[]): RowSelection {
    const state = this.state as ManagerState;
    const { data } = state.tables.language;
    return tableRowsToSelection(
      codes
        .map((code) => {
          return data.findIndex((r) => r[H.LanCol.iInfo].code === code);
        })
        .filter((r) => r !== -1)
    );
  }

  // Create and save moduleData data taken from all listings found in saved
  // repositoryListings. Create and save moduleLangData as the language to
  // moduleData mapping. Then load the module table with all modules that
  // share any language code found in the current language selection (or
  // languageSelection argument if provided), or else with all modules if
  // no codes are selected.
  loadModuleTable(languageSelection?: string[]): void {
    const state = this.state as ManagerState;
    // Insure there is one moduleData row object for each module in
    // each repository (local and remote). The same object should be reused
    // throughout the lifetime of the window, so that user interactions will
    // be recorded.
    const { repository: repotable } = state.tables;
    H.Saved.moduleLangData = { allmodules: [] };
    const { moduleData, moduleLangData, repositoryListings } = H.Saved;
    const repoType = {
      localXulsword: [] as SwordConfType[],
      localShared: [] as SwordConfType[],
      localAudio: [] as SwordConfType[],
      remoteSWORD: [] as SwordConfType[],
      remoteAudio: [] as SwordConfType[],
      remoteXSM: [] as SwordConfType[],
    };
    repositoryListings.forEach((listing, i) => {
      const drow = repotable.data[i];
      // The repoType data is re-collected every time listings change.
      if (drow && Array.isArray(listing)) {
        listing.forEach((c) => {
          const modkey = repositoryModuleKey(c);
          const repoIsLocal = isRepoLocal(c.sourceRepository) || false;
          if (drow[H.RepCol.iState] !== H.OFF) {
            if (c.sourceRepository.path === G.Dirs.path.xsModsUser)
              repoType.localXulsword.push(c);
            if (c.sourceRepository.path === G.Dirs.path.xsModsCommon)
              repoType.localShared.push(c);
            if (c.sourceRepository.path === G.Dirs.path.xsAudio)
              repoType.localAudio.push(c);
            if (!repoIsLocal && c.xsmType === 'none')
              repoType.remoteSWORD.push(c);
            if (!repoIsLocal && c.xsmType === 'XSM_audio')
              repoType.remoteAudio.push(c);
            if (!repoIsLocal && c.xsmType === 'XSM') repoType.remoteXSM.push(c);
          }
          // But moduleData is only collected once.
          if (!(modkey in moduleData)) {
            let mtype: string = c.moduleType;
            if (c.xsmType === 'XSM') {
              mtype = `XSM ${G.i18n.t(C.SupportedTabTypes[mtype as ModTypes])}`;
            } else if (c.xsmType === 'XSM_audio') {
              mtype = `XSM ${G.i18n.t('audio.label')}`;
            }
            let reponame = c.sourceRepository.name;
            const opts = { ns: 'branding' };
            if (
              G.i18n.exists(`${c.sourceRepository.name}.repository.label`, opts)
            ) {
              reponame = G.i18n.t(
                `${c.sourceRepository.name}.repository.label`,
                opts
              );
            }
            const d = [] as unknown as TModuleTableRow;
            d[H.ModCol.iInfo] = {
              repo: c.sourceRepository,
              shared:
                c.sourceRepository.path ===
                builtinRepos(G.i18n, G.Dirs.path)[0].path,
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
              reponame ||
              (repoIsLocal
                ? c.sourceRepository.path
                : `${c.sourceRepository.domain}/${c.sourceRepository.path}`);
            d[H.ModCol.iVersion] = c.Version || '';
            d[H.ModCol.iLang] = c.Lang || '?';
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
            moduleData[modkey] = d;
          }
        });
      }
    });
    // Modules in the local xulsword repository and local audio repository
    // which are from enabled remote repositories are not included in
    // moduleLangData. Rather they are left off the list and their 'installed'
    // and 'shared' checkboxes are applied to the corresponding remote
    // repository module. Also, if an XSM module is listed, any corresponding
    // module in a repository at the same domain will not be listed.
    const { localXulsword, localAudio, remoteSWORD, remoteAudio, remoteXSM } =
      repoType;
    repositoryListings.forEach((listing, i) => {
      const drow = repotable.data[i];
      if (drow && Array.isArray(listing) && drow[H.RepCol.iState] !== H.OFF) {
        listing.forEach((c) => {
          const modkey = repositoryModuleKey(c);
          const modrow = moduleData[modkey];
          const repoIsRemote = !isRepoLocal(c.sourceRepository);
          const modInLocalXulswordOrAudio = localXulsword
            .concat(localAudio)
            .find(
              (ci) =>
                c.module === ci.module &&
                c.Version === ci.Version &&
                c.xsmType === ci.xsmType
            );
          if (repoIsRemote && modInLocalXulswordOrAudio) {
            const localModKey = repositoryModuleKey(modInLocalXulswordOrAudio);
            if (localModKey in moduleData) {
              modrow[H.ModCol.iInfo].shared =
                moduleData[localModKey][H.ModCol.iInfo].shared;
              modrow[H.ModCol.iInstalled] =
                moduleData[localModKey][H.ModCol.iInstalled];
              if (c.xsmType === 'XSM_audio') {
                const inst = H.allAudioInstalled(c) ? H.ON : H.OFF;
                modrow[H.ModCol.iInstalled] = inst;
                moduleData[localModKey][H.ModCol.iInstalled] = inst;
              }
            }
          }

          if (
            // not if in xsModsUser or xsAudio and a remote match is listed.
            ((c.sourceRepository.path !== G.Dirs.path.xsModsUser &&
              c.sourceRepository.path !== G.Dirs.path.xsAudio) ||
              !remoteSWORD
                .concat(remoteXSM)
                .concat(remoteAudio)
                .find(
                  (ci) =>
                    c.module === ci.module &&
                    c.Version === ci.Version &&
                    c.xsmType === ci.xsmType
                )) &&
            // and not if in remote-non-xsm and a remote XSM is listed.
            (!repoIsRemote ||
              c.xsmType !== 'none' ||
              !remoteXSM.find(
                (ci) => c.module === ci.module && c.Version === ci.Version
              ))
          ) {
            const code = (c.Lang && c.Lang.replace(/-.*$/, '')) || 'en';
            if (!(code in moduleLangData)) moduleLangData[code] = [];
            moduleLangData[code].push(modrow);
            moduleLangData.allmodules.push(modrow);
          }
        });
      }
    });
    log.debug(`Total modules available: ${moduleLangData.allmodules.length}`);
    H.setTableState(
      this,
      'module',
      null,
      this.filterModuleTable(languageSelection, null),
      true
    );
  }

  // Return sorted and filtered (by language selection) module table data.
  filterModuleTable(
    languageSelection?: string[] | null,
    langTableOpen?: boolean | null
  ): TModuleTableRow[] {
    const state = this.state as ManagerState;
    const codes = languageSelection ?? state.language.selection;
    const { open } = state.language;
    const { moduleLangData } = H.Saved;
    const isOpen = langTableOpen ?? open;
    // Select the appropriate moduleLangData lists.
    let tableData: TModuleTableRow[] = [];
    if (isOpen && codes?.length) {
      tableData = Object.entries(moduleLangData)
        .filter((ent) => codes.includes(ent[0]))
        .map((ent) => ent[1])
        .flat();
    }
    if (!tableData.length) tableData = moduleLangData.allmodules;
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
      const { showAudioDialog } = clone(prevState);
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
      repository,
      infoConfigs,
      showConf,
      editConf,
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
      onLangCellClick,
      onModCellClick,
      onRepoCellClick,
      onRowsReordered,
      audioDialogClose: dialogClose,
      audioDialogAccept: dialogAccept,
      tableRef,
      modinfoRefs,
      audioDialogOnChange: dialogOnChange,
      languageCodesToTableSelection: selectedRegions,
      languageTableCompRef,
    } = this;

    const disable = {
      moduleInfo: !selectionToTableRows(module.selection).length,
      moduleInfoBack: false,
      moduleCancel:
        !modtable.data.find((r) => r[H.ModCol.iInfo].loading) &&
        !progress?.length,
      repoAdd: false,
      repoDelete:
        !repository?.selection.length ||
        !H.selectionToDataRows('repository', repository.selection).every(
          (r) =>
            repotable.data[r] && repotable.data[r][H.RepCol.iInfo]?.repo?.custom
        ),
      repoCancel: !repotable.data.find((r) => r[H.RepCol.iInfo].loading),
    };

    // Set one or the other or neither (never both)
    let vkAudioDialog;
    let gbAudioDialog;
    if (showAudioDialog[0]) {
      if (showAudioDialog[0].type === 'versekey')
        vkAudioDialog = showAudioDialog[0] as H.VersekeyDialog;
      else gbAudioDialog = showAudioDialog[0] as H.GenBookDialog;
    }

    const handleColumns = (table: typeof H.Tables[number]) => {
      return (columns: TablePropColumn[]) => {
        this.sState((prevState) => {
          const ptable = clone(prevState[table]);
          if (ptable) {
            ptable.columns = columns;
            return { [table]: ptable };
          }
          return null;
        });
      };
    };

    // If we are managing external repositories, Internet permission is required.
    if (!repositories || internetPermission) {
      if (!resetOnResize) {
        const { id } = windowDescriptor;
        resetOnResize = true;
        G.publishSubscription(
          'setRendererRootState',
          { renderers: { id }, main: false },
          {
            resetOnResize,
          } as Partial<WindowRootState>
        );
      }
      return (
        <Vbox {...addClass('modulemanager', props)} flex="1" height="100%">
          <Toaster
            canEscapeKeyClear
            position={Position.TOP}
            usePortal
            ref={this.refHandlers.toaster}
          />
          {(vkAudioDialog || gbAudioDialog) && (
            <Dialog
              body={
                <Vbox>
                  {vkAudioDialog && (
                    <>
                      <Label value={vkAudioDialog.conf.module} />
                      <div>{vkAudioDialog.conf.Description?.locale}</div>
                      <SelectVK
                        height="2em"
                        initialVK={vkAudioDialog.initial}
                        options={vkAudioDialog.options}
                        allowNotInstalled
                        onSelection={dialogOnChange}
                      />
                    </>
                  )}
                  {gbAudioDialog && (
                    <>
                      <Label value={gbAudioDialog.conf.module} />
                      <SelectOR
                        key={[
                          gbAudioDialog.selection.otherMod,
                          ...gbAudioDialog.selection.keys,
                        ].join('.')}
                        initialORM={gbAudioDialog.selection}
                        otherMods={[]}
                        nodeLists={gbAudioDialog.options.nodeLists}
                        enableMultipleSelection
                        onSelection={dialogOnChange}
                      />
                    </>
                  )}
                </Vbox>
              }
              buttons={
                <>
                  <Spacer flex="10" />
                  <Button id="cancel" flex="1" fill="x" onClick={dialogClose}>
                    {G.i18n.t('cancel.label')}
                  </Button>
                  <Button
                    id="ok"
                    disabled={
                      (gbAudioDialog && !gbAudioDialog.selection.keys.length) ||
                      (vkAudioDialog && !vkAudioDialog.selection.chapter)
                    }
                    flex="1"
                    fill="x"
                    onClick={dialogAccept}
                  >
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
                      key={stringHash(language.columns, langtable.render)}
                      data={langtable.data}
                      columns={language.columns}
                      initialRowSort={language.rowSort}
                      selectedRegions={selectedRegions(language.selection)}
                      domref={tableRef.language}
                      tableCompRef={languageTableCompRef}
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
              <Button
                id="languageListOpen"
                icon="chevron-right"
                fill="y"
                onClick={eventHandler}
              />
            )}

            <Groupbox
              caption={G.i18n.t('chooseModule.label')}
              orient="horizontal"
              flex="1"
            >
              <Hbox className="module-deck" flex="1">
                {infoConfigs.length > 0 && (
                  <Modinfo
                    configs={infoConfigs}
                    showConf={showConf}
                    editConf={editConf}
                    buttonHandler={modinfoParentHandler}
                    refs={modinfoRefs}
                  />
                )}
                {infoConfigs.length === 0 && (
                  <Table
                    flex="1"
                    id="module"
                    key={stringHash(module.columns, modtable.render)}
                    data={modtable.data}
                    columns={module.columns}
                    selectedRegions={module.selection}
                    initialRowSort={module.rowSort}
                    enableColumnReordering
                    domref={tableRef.module}
                    onCellClick={onModCellClick}
                    onColumnsReordered={handleColumns('module')}
                    onColumnHide={handleColumns('module')}
                    onColumnWidthChanged={handleColumns('module')}
                    onRowsReordered={onRowsReordered.module}
                  />
                )}
              </Hbox>
              <Vbox className="button-stack" pack="center">
                {infoConfigs.length === 0 && (
                  <Button
                    id="moduleInfo"
                    icon="info-sign"
                    intent="primary"
                    fill="x"
                    disabled={disable.moduleInfo}
                    onClick={eventHandler}
                  />
                )}
                {infoConfigs.length > 0 && (
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
                      key={stringHash(repository.columns, repotable.render)}
                      data={repotable.data}
                      columns={repository.columns}
                      selectedRegions={repository.selection}
                      initialRowSort={repository.rowSort}
                      domref={tableRef.repository}
                      onEditableCellChanged={onCellEdited}
                      onRowsReordered={onRowsReordered.repository}
                      onCellClick={onRepoCellClick}
                      onColumnWidthChanged={handleColumns('repository')}
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
    }
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
            <Hbox pack="end" align="start" className="dialog-buttons">
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
            </Hbox>
          }
        />
      </Vbox>
    );
  }
}
ModuleManager.defaultProps = defaultProps;
ModuleManager.propTypes = propTypes;

function audioDialogOnChange(
  this: ModuleManager,
  selection: SelectVKType | SelectORMType | undefined
) {
  this.sState((prevState) => {
    const { showAudioDialog: sad } = prevState;
    const showAudioDialog = clone(sad);
    if (showAudioDialog.length) {
      showAudioDialog[0] = {
        ...showAudioDialog[0],
        selection,
      } as H.VersekeyDialog | H.GenBookDialog;
      if (showAudioDialog[0].type === 'versekey') {
        const dvk = showAudioDialog[0] as H.VersekeyDialog;
        const sel = selection as SelectVKType;
        if (sel.book) {
          const af = dvk.chapters[sel.book];
          let ch: number[] | undefined;
          if (af) {
            ch = af
              .map((n, i) => (n ? i : undefined))
              .filter(Boolean) as number[];
          }
          dvk.options.chapters = ch;
          dvk.options.lastchapters = ch;
        }
      }
      return { showAudioDialog };
    }
    return null;
  });
}

export function onunload() {
  G.Module.cancel(); // closes all FTP connections
}
