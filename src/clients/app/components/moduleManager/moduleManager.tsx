import React from 'react';
import PropTypes from 'prop-types';
import { Intent, ProgressBar } from '@blueprintjs/core';
import {
  downloadKey,
  isRepoLocal,
  repositoryKey,
  repositoryModuleKey,
  localizeString,
  stringHash,
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
  topToaster,
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
import * as H from './moduleManagerH.tsx';
import './moduleManager.css';

import type { ToastProps } from '@blueprintjs/core';
import type { Table2 } from '@blueprintjs/table';
import type {
  ModTypes,
  Repository,
  RepositoryListing,
  SwordConfType,
} from '../../../../type.ts';
import type {
  TLanguageTableRow,
  TModuleTableRow,
  TRepositoryTableRow,
} from './moduleManagerH.tsx';
import type {
  TableColumnInfo,
  TableProps,
} from '../../../components/libxul/table.tsx';
import type { SelectVKType } from '../../../components/libxul/selectVK.tsx';
import type { SelectORMType } from '../../../components/libxul/selectOR.tsx';
import type { ModinfoParent } from '../../../components/libxul/modinfo.tsx';
import type { XulProps } from '../../../components/libxul/xul.tsx';
import type { DragSizerVal } from '../../../components/libxul/dragsizer.tsx';
import type { ControllerState } from '../../../controller.tsx';

G.LibSword.stopBackgroundSearchIndexer();

G.Module.cancel().catch((er) => {
  log.error(er);
});

export function onunload() {
  // close all FTP connections
  G.Module.cancel().catch((er) => {
    log.error(er);
  });
}

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
      render: 0,
      remount: 0,
      modules: null as {
        allmodules: TModuleTableRow[];
        [code: string]: TModuleTableRow[];
      } | null,
    },

    repository: {
      data: [] as TRepositoryTableRow[],
      tableToDataRowMap: [] as number[],
      render: 0,
      remount: 0,
      repositoryListings: [] as RepositoryListing[],
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

  modinfoParentHandler: typeof modinfoParentHandlerH;

  sState: (
    // sState is just for better TypeScript functionality
    s:
      | Partial<ManagerState>
      | ((prevState: ManagerState) => Partial<ManagerState> | null),
    callback?: () => void,
  ) => void;

  tableDomRefs: {
    [table in (typeof H.Tables)[number]]: React.RefObject<HTMLDivElement>;
  };

  tableComponentRefs: {
    [table in (typeof H.Tables)[number]]: React.RefObject<Table2>;
  };

  modinfoRefs: {
    textarea: React.RefObject<HTMLTextAreaElement>;
    container: React.RefObject<HTMLDivElement>;
  };

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

    H.Progressing.ids = [];

    this.state = s;

    this.tableDomRefs = {} as typeof this.tableDomRefs;
    this.tableComponentRefs = {} as typeof this.tableComponentRefs;
    H.Tables.forEach((t: (typeof H.Tables)[number]) => {
      this.tableDomRefs[t] = React.createRef();
      this.tableComponentRefs[t] = React.createRef();
    });
    this.modinfoRefs = {
      textarea: React.createRef(),
      container: React.createRef(),
    };

    this.destroy = [];

    this.lastStatePref = null;

    this.onRowsReordered = {
      language: H.onRowsReordered.bind(this, 'language'),
      module: H.onRowsReordered.bind(this, 'module'),
      repository: H.onRowsReordered.bind(this, 'repository'),
    };
    this.loadRepositoryTable = this.loadRepositoryTable.bind(this);
    this.loadModuleTable = this.loadModuleTable.bind(this);
    this.onRepoCellClick = H.onRepoCellClick.bind(this);
    this.onLangCellClick = H.onLangCellClick.bind(this);
    this.onModCellClick = H.onModCellClick.bind(this);
    this.onCustomRepositoryEdited = H.onCustomRepositoryCellEdited.bind(this);
    this.eventHandler = H.eventHandler.bind(this);
    this.modinfoParentHandler = modinfoParentHandlerH.bind(this);
    this.handleColumns = this.handleColumns.bind(this);
    this.audioDialogChange = this.audioDialogChange.bind(this);
    this.audioDialogClose = this.audioDialogClose.bind(this);
    this.audioDialogAccept = this.audioDialogAccept.bind(this);
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
    };
  }

  componentWillUnmount() {
    this.destroy.forEach((func) => func());
    this.destroy = [];
  }

  async loadTables(): Promise<void> {
    let state = this.state as ManagerState;
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
          state.progress = [9, 10];
          this.sState(state);
          const result = await G.Module.crossWireMasterRepoList();
          state = this.state as ManagerState;
          state.progress = null;
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
          }).catch((er) => log.error(er));
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
          // Set individual repository progress bars
          const { repository, module } = newstate.tables;
          const repoIndex = repository.data.findIndex(
            (r) => id === downloadKey(H.listDownload(r[H.RepCol.iInfo].repo)),
          );
          const drow = repository.data[repoIndex];
          if (drow && prog === -1 && drow[H.RepCol.iInfo].loading) {
            drow[H.RepCol.iInfo].loading = false;
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
                H.tableUpdate(newstate, 'module');
              });
          }
          // Update main progress bar (shows module downloads only)
          if (repoIndex === -1) H.updateDownloadProgress(newstate, id, prog);
          this.sState(newstate);
        }
      }),
    );
  }

  // Load the repository table using an array of repositories.
  loadRepositoryTable(state: ManagerState, repos: Repository[]): void {
    const { tables } = state;
    const { repository } = tables;
    repository.data = repos.map((repo) => {
      const repoIsCustom = H.isRepoCustom(state, repo);
      return H.repositoryToRow(state, repo, repoIsCustom);
    });
    H.tableUpdate(state, 'repository', 'rowmap');
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
    Array.from(langs).forEach((code) => {
      let r = H.findTableRow(code, 'language');
      if (!r) {
        r = H.findTableRow(code, 'language', [getLangReadable(code), { code }]);
      }
      if (r) newTableData.push(r);
    });
    language.data = newTableData.sort((a, b) => a[0].localeCompare(b[0]));
    H.scrollToSelection(this, state, 'language');
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
          let r = H.findTableRow(modrepkey, 'module') as TModuleTableRow;
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
              shadowedRows: [],
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
            if (repoIsLocal) {
              r[H.ModCol.iShared] =
                repositoryKey(r[H.ModCol.iInfo].repo) === builtInRepoKeys[0]
                  ? H.ON
                  : H.OFF;
              r[H.ModCol.iInstalled] = H.ON;
              r[H.ModCol.iRemove] = H.OFF;
            } else {
              r[H.ModCol.iShared] = H.modCheckbox;
              r[H.ModCol.iInstalled] = H.modCheckbox;
              r[H.ModCol.iRemove] = H.modCheckbox;
            }
            H.findTableRow(modrepkey, 'module', r); // sets new module row
          }
          modtable.data.push(r);
        });
      }
    });
    // Modules in a local file system repository which are found in an enabled
    // remote repository (meaning they have same name and version) are not
    // included in the table, but are shadowed by the remote module. Then the
    // remote module's shared, installed and remove checkbox values are copied
    // from the shadowed module. Local members of XSM modules are only shadowed
    // when all local members are installed. Also, SWORD modules in remote
    // repositories which are part of an XSM module are also shadowed.
    if (!modtable.modules) {
      // modtable.modules is set to null by handleListings() so modules are
      // untouched here if only the language selection changes.
      modtable.modules = {
        allmodules: [] as TModuleTableRow[],
      };
      const { modules } = modtable;
      repositoryListings.forEach((listing, i) => {
        const reprow = repotable.data[i];
        if (reprow && Array.isArray(listing)) {
          listing.forEach((c) => {
            const modkey = repositoryModuleKey(c);
            const modrow = H.findTableRow(modkey, 'module') as TModuleTableRow;
            if (modrow) {
              modrow[H.ModCol.iInfo].shadowedRows = [];

              // NOTE: XSM modules are only remote, since once installed they
              // are simply multiple local regular modules.
              const isLocal = isRepoLocal(c.sourceRepository);
              const isRemote = !isLocal;

              // NOTE: In variable names, XSM refers only to type=XSM (not
              // type=XSM_audio).
              const foundInstalledXSMs: SwordConfType[] = [];
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
                  if (mcc) foundInstalledXSMs?.push(mcc);
                  return mcc;
                });

              const foundInLocalNonXSM = localUser
                .concat(localShared)
                .concat(localOther)
                .concat(localAudio)
                .find(
                  (ci) =>
                    c.xsmType === ci.xsmType &&
                    c.module === ci.module &&
                    // Audio modules are unversioned
                    (c.xsmType === 'XSM_audio' || c.Version === ci.Version),
                );

              const foundInLocals = foundInLocalNonXSM
                ? [foundInLocalNonXSM]
                : isInstalledXSM
                  ? foundInstalledXSMs
                  : [];

              const isRemoteNotInstalledToBeInstalled =
                isRemote && !foundInLocals.length
                  ? H.Downloads.finished.includes(modkey)
                  : false;

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

              const isShadowed =
                (isLocal && foundInRemote) ||
                (isRemoteSWORD && foundInRemoteXSM);

              const doShow =
                reprow[H.RepCol.iState] !== H.OFF &&
                (isRemoteNotInstalledToBeInstalled || !isShadowed);

              if (doShow && isRemote && foundInLocals.length) {
                const shadowedRows = foundInLocals
                  .map(
                    (conf) =>
                      H.findTableRow(
                        repositoryModuleKey(conf),
                        'module',
                      ) as TModuleTableRow,
                  )
                  .filter(Boolean) as H.TModuleTableRow[];
                if (shadowedRows.length)
                  modrow[H.ModCol.iInfo].shadowedRows = shadowedRows;
              }

              if (doShow) {
                const code = c.Lang?.replace(/-.*$/, '') || 'en';
                if (!(code in modules)) modules[code] = [];
                modules[code].push(modrow);
                modules.allmodules.push(modrow);
              }

              // If a remote audio repo has files that are not installed
              // locally, then iInstalled must be OFF to allow them to be
              // installed.
              if (isLocal && c.xsmType === 'XSM_audio')
                modrow[H.ModCol.iInstalled] =
                  !foundInRemote ||
                  H.allAudioInstalled(
                    c.AudioChapters,
                    foundInRemote.AudioChapters,
                  )
                    ? H.ON
                    : H.OFF;
            }
          });
        }
      });
    }
    log.debug(
      `loadModuleTable: ${modtable.modules?.allmodules.length} modules`,
    );

    H.filterModuleTable(state);
  }

  handleColumns(tableName: (typeof H.Tables)[number]) {
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

  audioDialogChange(selection: SelectVKType | SelectORMType | undefined) {
    const newstate = this.state as ManagerState;
    const { showAudioDialog: sad } = newstate;
    const showAudioDialog = sad.slice();
    if (showAudioDialog.length) {
      showAudioDialog[0] = {
        ...showAudioDialog[0],
        selection,
      } as H.VersekeyDialog | H.GenBookDialog;
      if (showAudioDialog[0].type === 'versekey') {
        const [vkdialog] = showAudioDialog;
        const { options, chapters } = vkdialog;
        const { book } = selection as SelectVKType;
        if (book && options) {
          const af = chapters[book];
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

  async addToast(message: ToastProps) {
    (await topToaster).show(message);
  }

  render() {
    const state = this.state as ManagerState;
    const props = this.props as ManagerProps;
    const {
      onRowsReordered,
      eventHandler,
      modinfoParentHandler,
      onCustomRepositoryEdited,
      onLangCellClick,
      onModCellClick,
      onRepoCellClick,
      handleColumns,
      audioDialogClose,
      audioDialogAccept,
      audioDialogChange,
      tableDomRefs,
      tableComponentRefs,
      modinfoRefs,
    } = this;
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
    const { id } = props;
    const {
      language: langtable,
      module: modtable,
      repository: repotable,
    } = state.tables;

    const selectedRepoDataRows = H.selectionToDataRows(
      state,
      'repository',
    ) as TRepositoryTableRow[];

    const numReposLoading = repotable.data.reduce(
      (p, c) => (c[H.RepCol.iInfo].loading ? p + 1 : p),
      0,
    );

    const disable = {
      moduleInfo: !H.selectionToDataRows(state, 'module').length,
      moduleInfoBack: false,
      moduleCancel:
        !modtable.data.find((r) => r[H.ModCol.iInfo].loading) ||
        !progress?.length ||
        infoConfigs.length > 0,
      repoAdd:
        !repositories ||
        repotable.data.findIndex(
          (r) =>
            repositoryKey(r[H.RepCol.iInfo].repo) === H.DefaultCustomRepoKey,
        ) !== -1,
      repoDelete:
        !selectedRepoDataRows.length ||
        selectedRepoDataRows.length > 1 ||
        (typeof selectedRepoDataRows[0] !== 'undefined' &&
          !H.isRepoCustom(state, selectedRepoDataRows[0][H.RepCol.iInfo].repo)),
      repoCancel: numReposLoading === 0,
    };

    // Accurate repository total progress is unnecessary and problematic,
    // however, the main progress bar must show if any repositories are
    // loading. For instance, dictionary auto-install may open the manager
    // while the repository table is hidden, and the user needs to be made
    // aware that they need to wait.
    const progress2 =
      progress ??
      (numReposLoading && repotable.data.length
        ? [repotable.data.length - numReposLoading, repotable.data.length]
        : null);

    // Set one or the other or neither (never both)
    let vkAudioDialog;
    let gbAudioDialog;
    const [nextDialog] = showAudioDialog;
    if (nextDialog) {
      if (nextDialog.type === 'versekey') vkAudioDialog = nextDialog;
      else gbAudioDialog = nextDialog;
    }

    // The removeModule window does not (must not!) access Internet, otherwise
    // Internet permission is required.
    if (id === 'removeModule' || H.Permission.internet) {
      if (!resetOnResize) {
        const { id } = windowArguments();
        resetOnResize = true;
        G.publishSubscription(
          'setControllerState',
          { renderers: { id } },
          {
            resetOnResize,
          } as Partial<ControllerState>,
          false,
        );
      }
      return (
        <Vbox {...addClass('modulemanager', props)} flex="1" height="100%">
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
                        key={stringHash(vkAudioDialog.initial)}
                        initialVK={vkAudioDialog.initial}
                        options={vkAudioDialog.options}
                        allowNotInstalled
                        onSelection={audioDialogChange}
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
                        onSelection={audioDialogChange}
                      />
                    </>
                  )}
                </Groupbox>
              }
              buttons={
                <Hbox className="dialog-buttons" pack="end" align="end">
                  <Spacer flex="10" />
                  <Button
                    id="cancel"
                    flex="1"
                    fill="x"
                    onClick={audioDialogClose}
                  >
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
                    onClick={audioDialogAccept}
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
                      selectedRegions={H.selectionToBPSelection(
                        state,
                        'language',
                      )}
                      onCellClick={onLangCellClick}
                      onRowsReordered={onRowsReordered.language}
                      domref={tableDomRefs.language}
                      tableCompRef={tableComponentRefs.language}
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
                    selectedRegions={H.selectionToBPSelection(state, 'module')}
                    tableToDataRowMap={modtable.tableToDataRowMap}
                    onCellClick={onModCellClick}
                    onColumnsReordered={handleColumns('module')}
                    onColumnHide={handleColumns('module')}
                    onColumnWidthChanged={handleColumns('module')}
                    onRowsReordered={onRowsReordered.module}
                    domref={tableDomRefs.module}
                    tableCompRef={tableComponentRefs.module}
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
                      selectedRegions={H.selectionToBPSelection(
                        state,
                        'repository',
                      )}
                      tableToDataRowMap={repotable.tableToDataRowMap}
                      onEditableCellChanged={onCustomRepositoryEdited}
                      onRowsReordered={onRowsReordered.repository}
                      onCellClick={onRepoCellClick}
                      onColumnWidthChanged={handleColumns('repository')}
                      domref={tableDomRefs.repository}
                      tableCompRef={tableComponentRefs.repository}
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
            {!progress2 && <Spacer flex="10" />}
            {progress2 && (
              <Hbox className="progress-container" align="center" flex="10">
                <ProgressBar
                  value={progress2[0] / progress2[1]}
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
