import React from 'react';
import PropTypes from 'prop-types';
import {
  Intent,
  OverlayToaster,
  Position,
  ProgressBar,
} from '@blueprintjs/core';
import {
  downloadKey,
  isRepoLocal,
  selectionToTableRows,
  repositoryKey,
  tableRowsToSelection,
  repositoryModuleKey,
  localizeString,
  isRepoCustom,
} from '../../../../common.ts';
import S from '../../../../defaultPrefs.ts';
import C from '../../../../constant.ts';
import { G } from '../../../G.ts';
import log from '../../../log.ts';
import {
  getStatePref,
  getLangReadable,
  setStatePref,
  windowArguments,
} from '../../../common.tsx';
import { addClass, xulPropTypes } from '../../../components/libxul/xul.tsx';
import Button from '../../../components/libxul/button.tsx';
import { Hbox, Vbox, Box } from '../../../components/libxul/boxes.tsx';
import Groupbox from '../../../components/libxul/groupbox.tsx';
import SelectVK from '../../../components/libxul/selectVK.tsx';
import SelectOR from '../../../components/libxul/selectOR.tsx';
import Table from '../../../components/libxul/table.tsx';
import Spacer from '../../../components/libxul/spacer.tsx';
import Label from '../../../components/libxul/label.tsx';
import DragSizer from '../../../components/libxul/dragsizer.tsx';
import Checkbox from '../../../components/libxul/checkbox.tsx';
import Dialog from '../../../components/libxul/dialog.tsx';
import Modinfo, {
  modinfoParentInitialState,
  modinfoParentHandler as modinfoParentHandlerH,
} from '../../../components/libxul/modinfo.tsx';
import * as H from './moduleManagerH.ts';
import './moduleManager.css';

import type { Toaster, ToastProps } from '@blueprintjs/core';
import type {
  ModTypes,
  Repository,
  RepositoryListing,
  RowSelection,
  SwordConfType,
} from '../../../../type.ts';
import type {
  TLanguageTableRow,
  TModuleTableRow,
  TRepositoryTableRow,
} from './moduleManagerH.ts';
import type {
  TableColumnInfo,
  TableProps,
} from '../../../components/libxul/table.tsx';
import type {
  SelectVKProps,
  SelectVKType,
} from '../../../components/libxul/selectVK.tsx';
import type {
  SelectORProps,
  SelectORMType,
} from '../../../components/libxul/selectOR.tsx';
import type { ModinfoParent } from '../../../components/libxul/modinfo.tsx';
import type { XulProps } from '../../../components/libxul/xul.tsx';
import type { DragSizerVal } from '../../../components/libxul/dragsizer.tsx';
import type { ControllerState } from '../../../controller.tsx';

G.Module.cancel().catch((er) => {
  log.error(er);
});

let MasterRepoListDownloaded = false;
let resetOnResize = false;

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
  showAudioDialog: [] as Array<H.VersekeyDialog | H.GenBookDialog>,
  tables: {
    language: {
      data: [] as TLanguageTableRow[],
      tableToDataRowMap: [] as number[],
      render: 0,
      remount: 0,
    },

    module: {
      data: [] as TModuleTableRow[],
      tableToDataRowMap: [] as number[],
      modules: null as {
        allmodules: TModuleTableRow[];
        [code: string]: TModuleTableRow[];
      } | null,
      render: 0,
      remount: 0,
    },

    repository: {
      data: [] as TRepositoryTableRow[],
      tableToDataRowMap: [] as number[],
      repositoryListings: [] as RepositoryListing[],
      render: 0,
      remount: 0,
    },
  },
};

export type ManagerStatePref =
  | typeof S.prefs.moduleManager
  | typeof S.prefs.removeModule;

export type ManagerState = ManagerStatePref &
  typeof notStatePref &
  typeof modinfoParentInitialState;

let ModuleManagerUnmountState: ManagerState | null = null;

export default class ModuleManager
  extends React.Component
  implements ModinfoParent
{
  static propTypes: typeof propTypes;

  destroy: Array<() => void>;

  tableRef: {
    [table in (typeof H.Tables)[number]]: React.RefObject<HTMLDivElement>;
  };

  languageTableCompRef;

  modinfoRefs: {
    textarea: React.RefObject<HTMLTextAreaElement>;
    container: React.RefObject<HTMLDivElement>;
  };

  toaster: Toaster | undefined;

  refHandlers = {
    toaster: (ref: Toaster | null) => {
      if (ref) this.toaster = ref;
    },
  };

  lastStatePref: Partial<ManagerState> | null;

  onRowsReordered: Record<
    (typeof H.Tables)[number],
    TableProps['onRowsReordered']
  >;

  onRepoCellClick: TableProps['onCellClick'];

  onLangCellClick: TableProps['onCellClick'];

  onModCellClick: TableProps['onCellClick'];

  onCustomRepositoryEdited: TableProps['onEditableCellChanged'];

  eventHandler;

  audioDialogOnChange:
    | SelectVKProps['onSelection']
    | SelectORProps['onSelection'];

  modinfoParentHandler: typeof modinfoParentHandlerH;

  sState: (
    // sState is just for better TypeScript functionality
    s:
      | Partial<ManagerState>
      | ((prevState: ManagerState) => Partial<ManagerState> | null),
    callback?: () => void,
  ) => void;

  constructor(props: ManagerProps) {
    super(props);
    const { id } = props;

    let s: ManagerState;
    if (ModuleManagerUnmountState) s = ModuleManagerUnmountState;
    else {
      s = {
        ...modinfoParentInitialState,
        ...notStatePref,
        ...(getStatePref('prefs', id) as ManagerStatePref),
      };
      H.Permission.internet = G.Prefs.getBoolPref('global.InternetPermission');
    }

    // These repos don't work. Why??
    if (s.repositories?.disabled === null) {
      s.repositories.disabled = [
        '[STEP Bible][ftp.stepbible.org][/pub/sword]',
        '[Bible.org][ftp.bible.org][/sword]',
      ];
    }

    H.Progressing.ids = [];

    this.state = s;

    this.tableRef = {} as typeof this.tableRef;
    H.Tables.forEach((t: (typeof H.Tables)[number]) => {
      this.tableRef[t] = React.createRef();
    });

    this.languageTableCompRef = React.createRef();

    this.modinfoRefs = {
      textarea: React.createRef(),
      container: React.createRef(),
    };

    this.destroy = [];

    this.lastStatePref = null;

    this.loadRepositoryTable = this.loadRepositoryTable.bind(this);
    this.loadModuleTable = this.loadModuleTable.bind(this);
    this.filterModuleTable = this.filterModuleTable.bind(this);
    this.onRepoCellClick = H.onRepoCellClick.bind(this);
    this.onLangCellClick = H.onLangCellClick.bind(this);
    this.onModCellClick = H.onModCellClick.bind(this);
    this.onCustomRepositoryEdited = H.onCustomRepositoryEdited.bind(this);
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
    this.installProgressHandler = this.installProgressHandler.bind(this);
    this.sState = this.setState.bind(this);
  }

  componentDidMount() {
    const { id } = this.props as ManagerProps;
    const { installProgressHandler } = this;
    installProgressHandler();
    // The removeModule window does not (must not!) access Internet, otherwise
    // Internet permission is required.
    if (id === 'removeModule' || H.Permission.internet)
      this.loadTables().catch((er) => {
        log.error(er);
      });
  }

  componentDidUpdate(_prevProps: any, prevState: ManagerState) {
    const props = this.props as ManagerProps;
    const state = this.state as ManagerState;
    const { id } = props;
    const { repository: prev } = prevState;
    const { repository: next, tables } = state;
    const { repository } = tables;
    if (
      (!prev || !repository.data.length) &&
      next &&
      (id === 'removeModule' || H.Permission.internet)
    )
      this.loadTables().catch((er) => {
        log.error(er);
      });
    // Using prevState in setStatePref requires that prevState is never
    // modified during updates, which requires slow cloning of state
    // objects. Using lastStatePref allows prevState to be modified.
    this.lastStatePref = setStatePref('prefs', id, this.lastStatePref, state);
    ModuleManagerUnmountState = {
      ...(this.state as ManagerState),
      progress: null,
    };
  }

  componentWillUnmount() {
    this.destroy.forEach((func) => func());
    this.destroy = [];
  }

  async loadTables(): Promise<void> {
    const state = this.state as ManagerState;
    const { id } = this.props as ManagerProps;

    // Download data for the repository and module tables
    if (!MasterRepoListDownloaded) {
      MasterRepoListDownloaded = true;

      // In xulsword 4.1.0+, removeModule.repository was added, allowing each
      // module's file location to be seen. So do a prefs update if required.
      if (!state.repository && id === 'removeModule') {
        (state as any).repository = S.prefs.removeModule.repository;
      }

      // Build the list of all repositories;
      const xulswordRepos = H.getXulswordRepos(state);
      let crossWireRepos: Repository[] = [];
      // The removeModule window must not access Internet!!
      if (id !== 'removeModule') {
        try {
          if (!navigator.onLine) throw new Error(`No Internet connection.`);
          const result = await G.Module.crossWireMasterRepoList();
          if (typeof result === 'string') throw new Error(result);
          crossWireRepos = result;
        } catch (er: any) {
          crossWireRepos = [];
          // Failed to load the master list, so just load xulsword repos.
          log.warn(er);
          const msg = (typeof er === 'object' && er.message) || '';
          this.addToast({
            message: `Unable to download Master Repository List.\n${msg}`,
            timeout: 5000,
            intent: Intent.WARNING,
          });
        }
      }
      let allrepos = xulswordRepos.concat(crossWireRepos);

      // The removeModule window does not (must not!) access Internet,
      // otherwise Internet permission is required. So filter out all
      // remote repos if necessary.
      if (id === 'removeModule' || !H.Permission.internet)
        allrepos = allrepos.filter((r) => isRepoLocal(r));

      this.loadRepositoryTable(state, allrepos);
      this.sState(state);

      H.readReposAndUpdateTables(this, state, allrepos, true).catch((er) =>
        log.error(er),
      );
    }
  }

  installProgressHandler() {
    // Instantiate progress handler
    this.destroy.push(
      window.IPC.on('progress', (prog: number, id?: string) => {
        log.silly(`moduleManager progress: id=${id} prog=${prog}`);
        const newstate = this.state as ManagerState;
        if (id) {
          H.updateDownloadProgress(newstate, id, prog);
          // Set individual repository progress bars
          const { repository, module } = newstate.tables;
          const repoIndex = repository.data.findIndex(
            (r) =>
              id ===
              downloadKey({
                ...r[H.RepCol.iInfo].repo,
                file: C.SwordRepoManifest,
                type: 'ftp',
              }),
          );
          const repdrow = repository.data[repoIndex];
          if (repdrow && prog === -1 && repdrow[H.RepCol.iInfo].loading) {
            repdrow[H.RepCol.iInfo].loading = false;
            H.tableUpdate(newstate, 'repository');
          }
          // Set individual module progress bars
          if (prog === -1) {
            module.data
              .filter((r) => {
                const medl = H.getModuleDownload(
                  repositoryModuleKey(r[H.ModCol.iInfo].conf),
                );
                return medl ? downloadKey(medl) === id : false;
              })
              .forEach((r) => {
                r[H.ModCol.iInfo].loading = false;
                r[H.ModCol.iInstalled] = H.ON;
                H.tableUpdate(newstate, 'module');
              });
          }
          this.sState(newstate);
        }
      }),
    );
  }

  // Load the repository table using an array of repositories.
  loadRepositoryTable(state: ManagerState, repos: Repository[]): void {
    const { tables } = state;
    const { repository } = tables;
    const { custom } = state.repositories ?? {};
    repository.data = repos.map((repo) => {
      const repoIsCustom = isRepoCustom(custom ?? null, repo);
      return H.repositoryToRow(state, repo, repoIsCustom, true);
    });
    H.tableUpdate(state, 'repository');
  }

  // Load the language table with all languages found in all currently enabled
  // repositories that are present in the saved repositoryListings and scroll
  // to the first selected language if there is one.
  loadLanguageTable(state: ManagerState) {
    const { language, repository: repotable } = state.tables;
    const { repositoryListings } = repotable;
    const langs = new Set<string>();
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
    const newTableData: TLanguageTableRow[] = [];
    Array.from(langs).forEach((l) =>
      newTableData.push([getLangReadable(l), { code: l }]),
    );
    language.data = newTableData.sort((a, b) => a[0].localeCompare(b[0]));
    H.scrollToSelectedLanguage(this, state);
  }

  // Convert the language table string array selection to a current language table
  // row selection.
  languageCodesToTableSelection(
    state: ManagerState,
    codes: string[],
  ): RowSelection {
    const { data } = state.tables.language;
    return tableRowsToSelection(
      codes
        .map((code) => {
          return data.findIndex((r) => r[H.LanCol.iInfo].code === code);
        })
        .filter((r) => r !== -1),
    );
  }

  // Create and save moduleData data taken from all listings found in saved
  // repositoryListings. Create and save moduleLangData as the language to
  // moduleData mapping. Then load the module table with all modules that
  // share any language code found in the current language selection (or
  // languageSelection argument if provided), or else with all modules if
  // no codes are selected.
  loadModuleTable(state: ManagerState): void {
    // Insure there is one moduleData row object for each module in
    // each repository (local and remote).
    const { module, language } = state;
    const { repository: repotable, module: modtable } = state.tables;
    const { repositoryListings } = repotable;

    const localUser: SwordConfType[] = [];
    const localShared: SwordConfType[] = [];
    const localAudio: SwordConfType[] = [];
    const localOther: SwordConfType[] = [];
    const remoteSWORD: SwordConfType[] = [];
    const remoteAudio: SwordConfType[] = [];
    const remoteXSM: SwordConfType[] = [];

    const builtInRepoKeys = G.BuiltInRepos.map((r) => repositoryKey(r));

    modtable.data = [];
    repositoryListings.forEach((listing, i) => {
      const drow = repotable.data[i];
      if (drow && Array.isArray(listing)) {
        listing.forEach((c) => {
          const repoIsLocal = isRepoLocal(c.sourceRepository);
          if (drow[H.RepCol.iState] !== H.OFF) {
            if (repoIsLocal) {
              if (c.sourceRepository.path === G.Dirs.path.xsModsUser)
                localUser.push(c);
              else if (c.sourceRepository.path === G.Dirs.path.xsModsCommon)
                localShared.push(c);
              else if (c.sourceRepository.path === G.Dirs.path.xsAudio)
                localAudio.push(c);
              else localOther.push(c);
            } else if (c.xsmType === 'XSM_audio') remoteAudio.push(c);
            else if (c.xsmType === 'XSM') remoteXSM.push(c);
            else remoteSWORD.push(c);
          }
          let mtype: string = c.moduleType;
          if (c.xsmType === 'XSM') {
            mtype = `XSM ${G.i18n.t(C.SupportedTabTypes[mtype as ModTypes])}`;
          } else if (c.xsmType === 'XSM_audio') {
            mtype = `XSM ${G.i18n.t('audio.label')}`;
          }
          const reponame = localizeString(G, c.sourceRepository.name);
          const modrepkey = repositoryModuleKey(c);
          // Re-use module table rows across all module table loads, so that
          // user changes are not forgotten!
          let r = H.findModuleRow(modrepkey);
          if (!r) {
            r = [] as unknown as TModuleTableRow;
            r[H.ModCol.iInfo] = {
              repo: c.sourceRepository,
              classes: H.modclasses(),
              tooltip: H.tooltip('VALUE', [
                H.ModCol.iShared,
                H.ModCol.iInstalled,
                H.ModCol.iRemove,
              ]),
              conf: c,
            };
            r[H.ModCol.iType] = mtype;
            r[H.ModCol.iAbout] =
              (c.Description &&
                (c.Description[G.i18n.language] || c.Description.en)) ||
              '';
            r[H.ModCol.iModule] = c.module;
            r[H.ModCol.iRepoName] =
              reponame ||
              (repoIsLocal
                ? c.sourceRepository.path
                : `${c.sourceRepository.domain}/${c.sourceRepository.path}`);
            r[H.ModCol.iVersion] = c.Version || '';
            r[H.ModCol.iLang] = c.Lang || '?';
            r[H.ModCol.iSize] = c.InstallSize?.toString() || '';
            r[H.ModCol.iFeatures] = c.Feature?.join(', ') || '';
            r[H.ModCol.iVersification] = c.Versification || 'KJV';
            r[H.ModCol.iScope] = c.Scope || '';
            r[H.ModCol.iCopyright] =
              (c.Copyright &&
                (c.Copyright[G.i18n.language] || c.Copyright.en)) ||
              '';
            r[H.ModCol.iLicense] = c.DistributionLicense || '';
            r[H.ModCol.iSourceType] = c.SourceType || '';
            r[H.ModCol.iShared] =
              repositoryKey(r[H.ModCol.iInfo].repo) === builtInRepoKeys[0]
                ? H.ON
                : H.OFF;
            r[H.ModCol.iInstalled] = repoIsLocal
              ? H.ON
              : H.Downloads.finished.includes(modrepkey)
                ? H.ON
                : H.OFF;
            r[H.ModCol.iRemove] = H.OFF;
            H.findModuleRow(modrepkey, r); // sets it
          }
          modtable.data.push(r);
        });
      }
    });
    // Modules in a local file system repository which are found in an enabled
    // remote repository (meaning they have same name and version) are not
    // included in the table. Rather their 'installed' and 'shared' checkboxes
    // are applied to the remote repository module (but in the case of XSM
    // modules, this application only happens when all modules in the XSM are
    // installed). Also, SWORD modules in remote repositories which are part of
    // an XSM module are not listed.
    if (!modtable.modules) {
      modtable.modules = {
        allmodules: [] as TModuleTableRow[],
      };
      const { modules } = modtable;
      repositoryListings.forEach((listing, i) => {
        const drow = repotable.data[i];
        if (drow && Array.isArray(listing) && drow[H.RepCol.iState] !== H.OFF) {
          listing.forEach((c) => {
            const modkey = repositoryModuleKey(c);
            const modrow = H.findModuleRow(modkey);
            if (modrow) {
              // NOTE: XSM modules are only remote, since once installed they
              // are simply multiple local regular modules.

              const isLocal = isRepoLocal(c.sourceRepository);
              const isRemote = !isLocal;

              let foundSomeInstalledXSM: SwordConfType | undefined;
              const isInstalledXSM =
                c.xsmType === 'XSM' &&
                c.SwordModules?.every((m, i) => {
                  const mcc = localUser
                    .concat(localShared)
                    .concat(localOther)
                    .find(
                      (mc) =>
                        mc.module === m &&
                        c.SwordVersions &&
                        mc.Version === c.SwordVersions[i],
                    );
                  if (mcc) foundSomeInstalledXSM = mcc;
                  return mcc;
                });

              const foundInLocal =
                localUser
                  .concat(localShared)
                  .concat(localOther)
                  .concat(localAudio)
                  .find(
                    (ci) =>
                      c.xsmType === ci.xsmType &&
                      c.module === ci.module &&
                      // Audio modules are unversioned
                      (c.xsmType === 'XSM_audio' || c.Version === ci.Version),
                  ) ||
                (isInstalledXSM && foundSomeInstalledXSM);

              let isRemoteNotInstalledToBeInstalled = false;
              if (isRemote) {
                if (foundInLocal) {
                  const localModKey = repositoryModuleKey(foundInLocal);
                  const localrow = modtable.data.find(
                    (r) =>
                      repositoryModuleKey(r[H.ModCol.iInfo].conf) ===
                      localModKey,
                  );
                  if (localrow) {
                    // shared
                    modrow[H.ModCol.iShared] = localrow[H.ModCol.iShared];
                    // installed
                    modrow[H.ModCol.iInstalled] = localrow[H.ModCol.iInstalled];
                    // audio installed
                    if (c.xsmType === 'XSM_audio') {
                      const inst = H.allAudioInstalled(c) ? H.ON : H.OFF;
                      modrow[H.ModCol.iInstalled] = inst;
                      localrow[H.ModCol.iInstalled] = inst;
                    }
                  }
                } else {
                  isRemoteNotInstalledToBeInstalled = true;
                  modrow[H.ModCol.iShared] = H.OFF;
                  modrow[H.ModCol.iInstalled] = H.Downloads.finished.includes(
                    modkey,
                  )
                    ? H.ON
                    : H.OFF;
                }
              }

              const isRemoteSWORD = isRemote && c.xsmType === 'none';

              const foundInRemoteXSM = remoteXSM.find((ci) => {
                const i = ci.SwordModules?.indexOf(c.module) ?? -1;
                return (
                  i > -1 &&
                  'SwordVersions' in ci &&
                  ci.SwordVersions &&
                  c.Version === ci.SwordVersions[i]
                );
              });

              const foundInRemote =
                remoteSWORD.concat(remoteAudio).find(
                  (ci) =>
                    c.xsmType === ci.xsmType &&
                    c.module === ci.module &&
                    // Audio modules are unversioned
                    (c.xsmType === 'XSM_audio' || c.Version === ci.Version),
                ) || foundInRemoteXSM;

              if (
                isRemoteNotInstalledToBeInstalled ||
                (!(isLocal && foundInRemote) &&
                  !(isRemoteSWORD && foundInRemoteXSM))
              ) {
                const code = c.Lang?.replace(/-.*$/, '') || 'en';
                if (!(code in modules)) modules[code] = [];
                modules[code].push(modrow);
                modules.allmodules.push(modrow);
              }
            }
          });
        }
      });
    }
    log.debug(
      `loadModuleTable: ${modtable.modules?.allmodules.length} modules`,
    );

    module.selection = [];
    modtable.data = this.filterModuleTable(
      modtable.modules,
      language.selection,
      language.open,
    );
  }

  // Return sorted and filtered (by language selection) module table data.
  filterModuleTable(
    modules: ManagerState['tables']['module']['modules'],
    codes: string[] | null,
    isOpen: boolean | null,
  ): TModuleTableRow[] {
    // Select the appropriate moduleLangData lists.
    let tableData: TModuleTableRow[] = [];
    if (isOpen && codes?.length && modules) {
      tableData = Object.entries(modules)
        .filter((ent) => codes.includes(ent[0]))
        .map((ent) => ent[1])
        .flat();
    }
    if (!tableData.length && modules) tableData = modules.allmodules;
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
    const newstate = this.state as ManagerState;
    const { showAudioDialog } = newstate;
    if (showAudioDialog.length) {
      const done = showAudioDialog.shift();
      if (done) done.callback(null);
      this.sState(newstate);
    }
  }

  audioDialogAccept() {
    const newstate = this.state as ManagerState;
    const { showAudioDialog } = newstate;
    if (showAudioDialog.length) {
      const done = showAudioDialog.shift();
      if (done) {
        const { selection } = done;
        done.callback(selection);
      }
      this.sState({ showAudioDialog });
    }
  }

  addToast(toast: ToastProps) {
    if (this.toaster) this.toaster.show(toast);
  }

  render() {
    const state = this.state as ManagerState;
    const props = this.props as ManagerProps;
    const { id } = props;
    const {
      language,
      module,
      repository,
      repositories,
      infoConfigs,
      showConf,
      editConf,
      showAudioDialog,
      progress,
    } = state;
    const {
      language: langtable,
      module: modtable,
      repository: repotable,
    } = state.tables;
    const {
      eventHandler,
      modinfoParentHandler,
      onCustomRepositoryEdited,
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
    const { custom } = repositories ?? {};

    const disable = {
      moduleInfo: !selectionToTableRows(module.selection).length,
      moduleInfoBack: false,
      moduleCancel:
        !modtable.data.find((r) => r[H.ModCol.iInfo].loading) &&
        !progress?.length &&
        infoConfigs.length > 0,
      repoAdd:
        !repositories ||
        repotable.data.findIndex(
          (r) =>
            repositoryKey(r[H.RepCol.iInfo].repo) === H.DefaultCustomRepoKey,
        ) !== -1,
      repoDelete:
        !repository?.selection.length ||
        !H.selectionToDataRows(this, 'repository', repository.selection).every(
          (r) =>
            repotable.data[r] &&
            repotable.data[r][H.RepCol.iInfo]?.repo &&
            isRepoCustom(
              custom ?? null,
              repotable.data[r][H.RepCol.iInfo].repo,
            ),
        ),
      repoCancel: !repotable.data.find((r) => r[H.RepCol.iInfo].loading),
    };

    // Set one or the other or neither (never both)
    let vkAudioDialog;
    let gbAudioDialog;
    const [nextDialog] = showAudioDialog;
    if (nextDialog) {
      if (nextDialog.type === 'versekey') vkAudioDialog = nextDialog;
      else gbAudioDialog = nextDialog;
    }

    const handleColumns = (tableName: (typeof H.Tables)[number]) => {
      return (columns: TableColumnInfo[]) => {
        const newstate = this.state as ManagerState;
        const table = newstate[tableName];
        if (table) {
          const { rowSort } = table;
          const { propColumnIndex: tableColIndex } = rowSort;
          // make sure sorting row does not get hidden
          if (!(tableColIndex in columns)) {
            rowSort.propColumnIndex = columns.findIndex((tc) => tc.visible);
          }
          table.columns = columns;
          this.sState({ [tableName]: table });
        }
      };
    };

    // The removeModule window does not (must not!) access Internet, otherwise
    // Internet permission is required.
    if (id === 'removeModule' || H.Permission.internet) {
      if (!resetOnResize) {
        const { id } = windowArguments();
        resetOnResize = true;
        G.publishSubscription('setControllerState', { renderers: { id } }, {
          resetOnResize,
        } as Partial<ControllerState>);
      }
      return (
        <Vbox {...addClass('modulemanager', props)} flex="1" height="100%">
          <OverlayToaster
            canEscapeKeyClear
            position={Position.TOP}
            ref={this.refHandlers.toaster}
          />
          {(vkAudioDialog || gbAudioDialog) && (
            <Dialog
              body={
                <Groupbox
                  caption={
                    (vkAudioDialog ?? gbAudioDialog)?.conf.Description
                      ?.locale ?? ''
                  }
                >
                  {vkAudioDialog && (
                    <>
                      <Label value={vkAudioDialog.conf.module} />
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
                </Groupbox>
              }
              buttons={
                <Hbox className="dialog-buttons" pack="end" align="end">
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
                </Hbox>
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
                      key={[langtable.data.length, langtable.remount].join('.')}
                      cellRendererDependencies={[
                        language.columns,
                        langtable.data,
                        langtable.tableToDataRowMap,
                        langtable.render,
                      ]}
                      data={langtable.data}
                      tableColumns={language.columns}
                      tableToDataRowMap={langtable.tableToDataRowMap}
                      selectedRegions={selectedRegions(
                        state,
                        language.selection,
                      )}
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
                  onDragEnd={(_e: React.MouseEvent, v: DragSizerVal) => {
                    this.sState((prevState) => {
                      prevState.language.width = v.sizerPos;
                      H.tableUpdate(prevState, ['language', 'module']);
                      return prevState;
                    });
                  }}
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
                    key={[modtable.data.length, modtable.remount].join('.')}
                    cellRendererDependencies={[
                      module.columns,
                      modtable.data,
                      modtable.tableToDataRowMap,
                      modtable.render,
                    ]}
                    data={modtable.data}
                    tableColumns={module.columns}
                    selectedRegions={module.selection}
                    tableToDataRowMap={modtable.tableToDataRowMap}
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
                {module.columns.find(
                  (c) => c.datacolumn === H.ModCol.iInstalled,
                )?.visible && (
                  <Button
                    id="moduleCancel"
                    intent="primary"
                    fill="x"
                    disabled={disable.moduleCancel}
                    onClick={eventHandler}
                  >
                    {G.i18n.t('cancel.label')}
                  </Button>
                )}
              </Vbox>
            </Groupbox>
          </Hbox>

          {repository?.open && (
            <div>
              <DragSizer
                onDragStart={() => repository.height}
                onDragEnd={(_e: React.MouseEvent, v: DragSizerVal) => {
                  this.sState((prevState) => {
                    if (prevState.repository) {
                      const { repository } = prevState;
                      repository.height = v.sizerPos;
                      return { repository };
                    }
                    return null;
                  });
                }}
                orient="horizontal"
                min={160}
                max={window.innerHeight - 220}
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
                      key={[repotable.data.length, repotable.remount].join('.')}
                      cellRendererDependencies={[
                        repository.columns,
                        repotable.data,
                        repotable.tableToDataRowMap,
                        repotable.render,
                      ]}
                      data={repotable.data}
                      tableColumns={repository.columns}
                      selectedRegions={repository.selection}
                      tableToDataRowMap={repotable.tableToDataRowMap}
                      domref={tableRef.repository}
                      onEditableCellChanged={onCustomRepositoryEdited}
                      onRowsReordered={onRowsReordered.repository}
                      onCellClick={onRepoCellClick}
                      onColumnWidthChanged={handleColumns('repository')}
                    />
                  )}
                </Box>
                {(id === 'moduleManager' ||
                  !disable.repoAdd ||
                  !disable.repoDelete ||
                  !disable.repoCancel) && (
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
                )}
              </Groupbox>
            </div>
          )}

          <Hbox className="dialog-buttons" pack="end" align="center">
            {repository?.open && (
              <Button
                flex="1"
                fill="x"
                onClick={() => {
                  this.sState((prevState) => {
                    if (prevState.repository) {
                      const { repository } = prevState;
                      repository.open = false;
                      return { repository };
                    }
                    return null;
                  });
                }}
              >
                {G.i18n.t('less.label')}
              </Button>
            )}
            {repository && !repository.open && (
              <Button
                flex="1"
                fill="x"
                onClick={() => {
                  this.sState((prevState) => {
                    if (prevState.repository) {
                      const { repository } = prevState;
                      repository.open = true;
                      return { repository };
                    }
                    return null;
                  });
                }}
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
              <div className="allowInternet-message">
                {G.i18n.t('allowInternet.message')}
              </div>
              <Label value={G.i18n.t('allowInternet.continue')} />
            </Vbox>
          }
          buttons={
            <Hbox className="dialog-buttons" flex="1" pack="end" align="center">
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
ModuleManager.propTypes = propTypes;

function audioDialogOnChange(
  this: ModuleManager,
  selection: SelectVKType | SelectORMType | undefined,
) {
  const newstate = this.state as ManagerState;
  const { showAudioDialog: sad } = newstate;
  const showAudioDialog = sad.slice();
  if (showAudioDialog.length) {
    showAudioDialog[0] = {
      ...showAudioDialog[0],
      selection,
    } as H.VersekeyDialog | H.GenBookDialog;
    if (showAudioDialog[0].type === 'versekey') {
      const [dvk] = showAudioDialog;
      const { options } = dvk;
      const sel = selection as SelectVKType;
      if (sel.book && options) {
        const af = dvk.chapters[sel.book];
        let ch: number[] | undefined;
        if (af) {
          ch = af
            .map((n, i) => (n ? i : undefined))
            .filter(Boolean) as number[];
        }
        options.chapters = ch;
        options.lastchapters = ch;
      }
    }
    this.sState({ showAudioDialog });
  }
}

export function onunload() {
  // close all FTP connections
  G.Module.cancel().catch((er) => {
    log.error(er);
  });
}
