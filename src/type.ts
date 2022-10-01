/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { BrowserWindow } from 'electron';
import type ElectronLog from 'electron-log';
import React from 'react';

declare global {
  export interface Window {
    api: { i18nextElectronBackend: any };
    ipc: WinIpcType;
    main: WinMainType;
  }
}
type RendererChannels =
  | 'global'
  | 'did-finish-render'
  | 'close'
  | 'resize'
  | 'progress'
  | 'modal'
  | 'update-state-from-pref'
  | 'component-reset'
  | 'cache-reset'
  | 'dynamic-stylesheet-reset'
  | 'publish-subscription';
export type WinIpcType = {
  renderer: {
    send: (channel: RendererChannels, ...args: any[]) => void;
    invoke: (channel: RendererChannels, ...args: any[]) => any;
    sendSync: (channel: RendererChannels, ...args: any[]) => any;
    on: (
      channel: RendererChannels,
      func: (...args: any[]) => any
    ) => () => void;
    once: (
      channel: RendererChannels,
      func: (...args: any[]) => any
    ) => () => void;
  };
};
export type WinMainType = {
  process: {
    NODE_ENV: () => string;
    XULSWORD_ENV: () => string;
    argv: () => string[];
  };
};

export type WindowRegistryType = (WindowDescriptorType | null)[];

export type WindowDescriptorType = {
  type:
    | 'xulsword'
    | 'splash'
    | 'viewportWin'
    | 'popupWin'
    | 'chooseFont'
    | 'moduleManager'
    | 'removeModule'
    | 'search';
  id?: number;
  category?:
    | 'window' // Parent optional, persisted, resizable
    | 'dialog' // Has parent, not persisted, size is fit-to-content, not-resizable
    | 'dialog-window'; // Has parent, not persisted, resizable
  options?: Electron.BrowserWindowConstructorOptions;
};

export type WindowArgType =
  | BrowserWindow
  | Partial<WindowDescriptorType>
  | 'all'
  | 'parent'
  | 'self'
  | 'not-self'
  | 'children';

export type ModalType = 'off' | 'darkened' | 'transparent';

// - skipTextUpdate allows a speedup when Atext content does not need to be updated,
// such as verseAt bottom: only the target panel needs to be fully rendered, then
// a verseAt top scroll is done for all other Atext instances. NOTE: skipTextUpdate
// only applies to the calling window; if skipTextUpdate is sent to other windows,
// it will be removed and will have no effect.
// - skipWindowUpdate prevents temporary states from being saved to Prefs or broadcast
// to other windows.
export type ScrollType = {
  verseAt: 'top' | 'center' | 'bottom';
  skipTextUpdate?: boolean[];
  skipWindowUpdate?: boolean;
} | null;

// Default values for these keys must be set in the default
// JSON Pref file or an error will be thrown. These values
// are always kept in sync between Prefs, the application menu
// the main xulsword window state.
export interface XulswordStatePref {
  location: LocationVKType | null;
  selection: LocationVKType | null;
  scroll: ScrollType;

  keys: (string | null)[];

  history: HistoryVKType[];
  historyIndex: number;

  show: ShowType;
  place: PlaceType;

  showChooser: boolean;
  tabs: (string[] | null)[];
  panels: (string | null)[];
  ilModules: (string | null)[];
  mtModules: (string | null)[];

  isPinned: boolean[];
  noteBoxHeight: number[];
  maximizeNoteBox: boolean[];
}

export type AtextPropsType = Pick<
  XulswordStatePref,
  'location' | 'selection' | 'scroll' | 'show' | 'place'
> & {
  modkey: string;

  module: string | undefined;
  ilModule: string | undefined;
  ilModuleOption: string[];

  isPinned: boolean;
  noteBoxHeight: number;
  maximizeNoteBox: boolean;

  panelIndex: number;
  columns: number;
  ownWindow: boolean;
  bbDragEnd: (e: React.MouseEvent, value: any) => void;
  xulswordState: (s: XulswordStateArgType) => void;
};

export type AtextStateType = {
  pin: PinPropsType | null;
  versePerLine: boolean;
  maxNoteBoxHeight: number | null;
};

export type PinPropsType = Pick<
  AtextPropsType,
  | 'location'
  | 'selection'
  | 'scroll'
  | 'show'
  | 'place'
  | 'module'
  | 'ilModule'
  | 'modkey'
>;

export type XulswordStateArgType =
  | Partial<XulswordStatePref>
  | ((s: XulswordStatePref) => Partial<XulswordStatePref>);

// Default values for these keys must be set in the default
// JSON Pref file or an error will be thrown. These values
// are always kept in sync between Prefs, the application menu
// and all window states.
export type GlobalPrefType = {
  global: {
    fontSize: number;
    locale: string;
    locales: [string, string, string][];
    popup: {
      selection: {
        [k in keyof FeatureType]: string;
      };
    };
  };
  xulsword: {
    location: LocationVKType | null;
    selection: LocationVKType | null;
    scroll: ScrollType;
    show: ShowType;
  };
};

export type SwordFilterType =
  | 'Headings'
  | 'Footnotes'
  | 'Cross-references'
  | 'Reference Material Links'
  | "Strong's Numbers"
  | 'Morphological Tags'
  | 'Verse Numbers'
  | 'Hebrew Cantillation'
  | 'Hebrew Vowel Points'
  | 'Words of Christ in Red';

export type SwordFilterValueType = 'Off' | 'On';

export type ShowType = {
  headings: boolean;
  versenums: boolean;
  usernotes: boolean;
  footnotes: boolean;
  crossrefs: boolean;
  dictlinks: boolean;
  strongs: boolean;
  morph: boolean;
  hebcantillation: boolean;
  hebvowelpoints: boolean;
  redwords: boolean;
};

export type PlaceType = {
  footnotes: 'notebox' | 'popup';
  crossrefs: 'notebox' | 'popup';
  usernotes: 'notebox' | 'popup';
};

export type SearchType = {
  module: string;
  searchtext: string;
  type:
    | 'SearchAnyWord'
    | 'SearchSimilar'
    | 'SearchExactText'
    | 'SearchAdvanced';
  scope?: 'SearchAll' | string;
};

export type V11nType =
  | 'KJV'
  | 'German'
  | 'KJVA'
  | 'Synodal'
  | 'Leningrad'
  | 'NRSVA'
  | 'Luther'
  | 'Vulg'
  | 'SynodalProt'
  | 'Orthodox'
  | 'LXX'
  | 'NRSV'
  | 'MT'
  | 'Catholic'
  | 'Catholic2'
  | 'Calvin'
  | 'DarbyFr'
  | 'NRSV'
  | 'Segond';

export type LocationVKType = {
  book: string;
  chapter: number;
  v11n: V11nType | null;
  verse?: number | null;
  lastverse?: number | null;
  subid?: string | null;
};

export type TextVKType = {
  location: LocationVKType;
  module: string;
  text: string;
};

export type HistoryVKType = {
  location: LocationVKType;
  selection: LocationVKType | null;
};

export type AudioFile = {
  audioCode: string;
  book: string;
  chapter: number;
  file: string;
  type: 'mp3' | 'ogg';
};

export type GenBookAudioFile = {
  audioCode: string;
  path: string[];
  file: string;
  type: 'mp3' | 'ogg';
  genbook: true;
};

export type LookupInfo = {
  companion: boolean;
  userpref: boolean;
  alternate: boolean;
  anytab: boolean;
  possibleV11nMismatch: boolean;
};

export type ContextData = {
  search: SearchType | null;
  locationVK: LocationVKType | null;
  module: string | null;
  tab: string | null;
  lemma: string | null;
  panelIndex: number | null;
  bookmark: unknown | null;
  isPinned: boolean;
  selection: string | null;
  selectionParsedVK: LocationVKType | null;
};

export type BookGroupType =
  | 'ot'
  | 'nt'
  | 'Apocrypha'
  | 'Apostolic_Fathers'
  | 'Armenian_Orthodox_Canon_Additions'
  | 'Ethiopian_Orthodox_Canon'
  | 'Peshitta_Syriac_Orthodox_Canon'
  | 'Rahlfs_LXX'
  | 'Rahlfs_variant_books'
  | 'Vulgate_and_other_later_Latin_mss'
  | 'Other';

export type BookType = {
  code: string;
  name: string;
  longname: string;
  index: number;
  bookGroup: BookGroupType;
  indexInBookGroup: number;
};

export type ConfigType = {
  [key in
    | 'direction'
    | 'fontFamily'
    | 'fontSizeAdjust'
    | 'lineHeight'
    | 'fontSize'
    | 'color'
    | 'background'
    | 'AssociatedModules'
    | 'AssociatedLocale'
    | 'PreferredCSSXHTML']: string | null;
};

export type FontFaceType = {
  fontFamily: string;
  path?: string;
  url?: string;
};

export type FeatureType = {
  // SWORD standard
  strongsNumbers: string[];
  greekDef: string[];
  hebrewDef: string[];
  greekParse: string[];
  hebrewParse: string[];
  dailyDevotion: { [i: string]: string };
  glossary: string[];
  images: string[];
  noParagraphs: string[];
  // xulsword features
  greek: string[];
  hebrew: string[];
};

export type ModTypes =
  | 'Biblical Texts'
  | 'Commentaries'
  | 'Lexicons / Dictionaries'
  | 'Generic Books';

export type XSModTypes = 'XSM' | 'XSM_audio' | 'none';

export type SwordConfLocalized = {
  [locale: string]: string;
};

export type SwordConfAudioChapters = {
  bk: string;
  ch1: number;
  ch2: number;
}[];

export type SwordConfType = {
  DataPath: string;
  DistributionLicense?: string;
  Lang?: string;
  MinimumVersion?: string;
  PreferredCSSXHTML?: string;
  KeySort?: string;
  Scope?: string;
  SourceType?: string;
  TextSource?: string;
  Version?: string;
  About?: SwordConfLocalized;
  Abbreviation?: SwordConfLocalized;
  Description?: SwordConfLocalized;
  Copyright?: SwordConfLocalized;
  CopyrightHolder?: SwordConfLocalized;
  CopyrightDate?: SwordConfLocalized;
  CopyrightNotes?: SwordConfLocalized;
  CopyrightContactName?: SwordConfLocalized;
  CopyrightContactNotes?: SwordConfLocalized;
  CopyrightContactAddress?: SwordConfLocalized;
  CopyrightContactEmail?: SwordConfLocalized;
  ShortPromo?: SwordConfLocalized;
  ShortCopyright?: SwordConfLocalized;
  DistributionNotes?: SwordConfLocalized;
  UnlockInfo?: SwordConfLocalized;
  ModDrv:
    | 'RawText'
    | 'RawText4'
    | 'zText'
    | 'zText4'
    | 'RawCom'
    | 'RawCom4'
    | 'zCom'
    | 'zCom4'
    | 'HREFCom'
    | 'RawFiles'
    | 'RawLD'
    | 'RawLD4'
    | 'zLD'
    | 'RawGenBook';
  DisplayLevel?: number;
  InstallSize?: number;
  Versification?: V11nType;
  Obsoletes?: string[];
  Feature?: string[];
  GlobalOptionFilter?: string[];
  History?: [string, SwordConfLocalized][];

  // Non-standard XSM (xulsword modules) have 'name.xsm' for DataPath
  // NameXSM?: string;
  // SwordModules?: string[];
  // SwordVersions?: string[];

  // Non-standard XSM audio module entries. These modules also have
  // ModDrv as 'audio' and DataPath as a URL value.
  AudioChapters?: SwordConfAudioChapters;

  // Extra helper additions
  module: string;
  errors: string[];
  sourceRepository: Repository;
  moduleType: ModTypes;
  xsmType: XSModTypes;
  filename: string;
};

export type TabTypes = 'Texts' | 'Comms' | 'Dicts' | 'Genbks';

export type TabType = {
  module: string;
  type: ModTypes;
  version: string;
  config: ConfigType;
  lang: string;
  direction: 'ltr' | 'rtl';
  v11n: V11nType | '';
  label: string;
  labelClass: string;
  tabType: TabTypes;
  isCommDir: boolean;
  isVerseKey: boolean;
  index: number;
  description: string;
  directory: string;
  confPath: string;
  audio: { [index: string]: string };
  audioCode: string;
  obsoletes: string[];
};

export type RowSelection = { rows: [number, number] }[];

export type NewModulesType = {
  modules: SwordConfType[];
  fonts: string[];
  bookmarks: string[];
  audio: (AudioFile | GenBookAudioFile)[];
  errors: string[];
};

export type DirsDirectories = {
  TmpD: string;
  xsAsset: string;
  xsAsar: string;
  xsProgram: string;
  xsDefaults: string;
  xsPrefDefD: string;
  ProfD: string;
  xsPrefD: string;
  xsResD: string;
  xsModsUser: string;
  xsFonts: string;
  xsAudio: string;
  xsBookmarks: string;
  xsVideo: string;
  xsModsCommon: string;
};

export type Repository = Download & {
  disabled?: boolean;
  custom?: boolean;
  builtin?: boolean;
};

export type RepositoryListing = SwordConfType[] | string | null;

export type Download = {
  domain: string;
  path: string;
  file: string;
  name?: string;
};

export type ZipEntryType = {
  entryName: string;
  name: string;
  isDirectory: boolean;
  getData: () => Buffer;
  toString: () => string;
};

export type ResetType =
  | 'all'
  | 'cache-reset'
  | 'component-reset'
  | 'dynamic-stylesheet-reset';

// GPublic funcs used as descriptors/place-holders
const func = () => {};
const funcCACHE = () => 'cacheable';

export type PrefPrimative = number | string | boolean | null | undefined;
export type PrefObject = {
  [i: string]: PrefValue;
};
export type PrefValue =
  | PrefPrimative
  | PrefObject
  | (PrefPrimative | PrefObject | PrefValue)[];

const PrefsPublic = {
  has: func as unknown as (
    key: string,
    type: 'string' | 'number' | 'boolean' | 'complex' | 'any',
    aStore?: string
  ) => boolean,
  getPrefOrCreate: func as unknown as (
    key: string,
    type: 'string' | 'number' | 'boolean' | 'complex',
    defval: any,
    aStore?: string
  ) => PrefValue,
  getCharPref: func as unknown as (key: string, aStore?: string) => string,
  setCharPref: func as unknown as (
    key: string,
    value: string,
    aStore?: string
  ) => boolean,
  getBoolPref: func as unknown as (key: string, aStore?: string) => boolean,
  setBoolPref: func as unknown as (
    key: string,
    value: boolean,
    aStore?: string
  ) => boolean,
  getIntPref: func as unknown as (key: string, aStore?: string) => number,
  setIntPref: func as unknown as (
    key: string,
    value: number,
    aStore?: string
  ) => boolean,
  getComplexValue: func as unknown as (key: string, aStore?: string) => unknown,
  setComplexValue: func as unknown as (
    key: string,
    value: any,
    aStore?: string
  ) => boolean,
  mergeValue: func as unknown as (
    key: string,
    obj: { [i: string]: any },
    aStore?: string
  ) => void,
  deleteUserPref: func as unknown as (key: string, aStore?: string) => boolean,
  writeAllStores: func as unknown as () => void,
};

const LibSwordPublic = {
  init: func as unknown as () => boolean,
  quit: func as unknown as () => void,
  isReady: func as unknown as () => boolean,
  getMaxChapter: funcCACHE as unknown as (
    v11n: V11nType,
    vkeytext: string
  ) => number,
  getMaxVerse: funcCACHE as unknown as (
    v11n: V11nType,
    vkeytext: string
  ) => number,
  getChapterText: func as unknown as (
    modname: string,
    vkeytext: string,
    options?: { [key in SwordFilterType]?: SwordFilterValueType }
  ) => string,
  getChapterTextMulti: func as unknown as (
    modstrlist: string,
    vkeytext: string,
    keepnotes?: boolean,
    options?: { [key in SwordFilterType]?: SwordFilterValueType }
  ) => string,
  getFootnotes: func as unknown as () => string,
  getCrossRefs: func as unknown as () => string,
  getNotes: func as unknown as () => string,
  getVerseText: func as unknown as (
    vkeymod: string,
    vkeytext: string,
    keepTextNotes: boolean
  ) => string,
  getVerseSystem: funcCACHE as unknown as (modname: string) => V11nType,
  convertLocation: funcCACHE as unknown as (
    fromv11n: V11nType,
    vkeytext: string,
    tov11n: V11nType
  ) => string,
  getIntroductions: func as unknown as (
    vkeymod: string,
    bname: string
  ) => string,
  getDictionaryEntry: func as unknown as (
    lexdictmod: string,
    key: string,
    options?: { [key in SwordFilterType]?: SwordFilterValueType }
  ) => string,
  getAllDictionaryKeys: funcCACHE as unknown as (lexdictmod: string) => string,
  getGenBookChapterText: func as unknown as (
    gbmod: string,
    treekey: string,
    options?: { [key in SwordFilterType]?: SwordFilterValueType }
  ) => string,
  getGenBookTableOfContents: funcCACHE as unknown as (gbmod: string) => string,
  luceneEnabled: func as unknown as (modname: string) => boolean,
  search: func as unknown as (
    modname: string,
    srchstr: string,
    scope: string,
    type: number,
    flags: number,
    newsearch: boolean
  ) => number,
  getSearchPointer: func as unknown as () => any,
  getSearchVerses: func as unknown as (modname: string) => void,
  getSearchResults: func as unknown as (
    modname: string,
    first: number,
    num: number,
    keepStrongs: boolean,
    searchPointer: any
  ) => string,
  searchIndexDelete: func as unknown as (modname: string) => void,
  searchIndexBuild: func as unknown as (modname: string) => Promise<boolean>,
  setGlobalOption: func as unknown as (
    option: SwordFilterType,
    setting: SwordFilterValueType
  ) => void,
  setGlobalOptions: func as unknown as (
    options: { [key in SwordFilterType]?: SwordFilterValueType }
  ) => void,
  getGlobalOption: func as unknown as (option: SwordFilterType) => string,
  setCipherKey: func as unknown as (
    modname: string,
    cipherKey: string,
    useSecModule: boolean
  ) => void,
  getModuleList: funcCACHE as unknown as () => string,
  getModuleInformation: funcCACHE as unknown as (
    modname: string,
    paramname: string
  ) => string,
  uncompressTarGz: func as unknown as (
    tarGzPath: string,
    aDirPath: string
  ) => void,
  translate: funcCACHE as unknown as (
    lookup: string,
    localeFile: string
  ) => string,
};

const CommandsPublic = {
  openModuleManager: func as unknown as () => void,
  installXulswordModules: func as unknown as (
    paths?: string[] | string, // file, file[], directory/*, directory or undefined: choose files
    toSharedModuleDir?: boolean
  ) => Promise<NewModulesType>,
  removeModule: func as unknown as () => void,
  exportAudio: func as unknown as () => void,
  importAudio: func as unknown as () => void,
  pageSetup: func as unknown as () => void,
  printPreview: func as unknown as () => void,
  printPassage: func as unknown as () => void,
  print: func as unknown as () => void,
  edit: func as unknown as (
    which: 'undo' | 'redo' | 'cut' | 'copy' | 'paste',
    ...args: any
  ) => boolean,
  undo: func as unknown as (...args: any) => boolean,
  redo: func as unknown as (...args: any) => boolean,
  cut: func as unknown as (...args: any) => boolean,
  copy: func as unknown as (...args: any) => boolean,
  paste: func as unknown as (...args: any) => boolean,
  search: func as unknown as (search: SearchType) => void,
  copyPassage: func as unknown as () => void,
  openFontsColors: func as unknown as (module: string) => void,
  openBookmarksManager: func as unknown as () => void,
  openNewDbItemDialog: func as unknown as (
    userNote: boolean,
    textvk: TextVKType
  ) => void,
  openDbItemPropertiesDialog: func as unknown as (bookmark: unknown) => void,
  deleteDbItem: func as unknown as (bookmark: unknown) => void,
  openHelp: func as unknown as (module?: string) => void,
  goToLocationVK: func as unknown as (
    location: LocationVKType,
    selection: LocationVKType,
    scroll?: ScrollType
  ) => void,
};

// This GPublic object will be used at runtime to create two different
// types of G objects sharing the same GType interface: one will be
// available in the main process and the other in renderer processes.
// The main process G properties access functions and data directly. But
// renderer process G properties request data through IPC from the main
// process G object. All getter and cacheable data of the Renderer G
// object is cached.
export const GPublic = {
  // GLOBAL GETTER DATA
  // ------------------
  /* eslint-disable prettier/prettier */
  Books:               'getter' as unknown as BookType[],
  Book:                'getter' as unknown as { [i: string]: BookType },
  Tabs:                'getter' as unknown as TabType[],
  Tab:                 'getter' as unknown as { [i: string]: TabType },
  ProgramConfig:       'getter' as unknown as ConfigType,
  LocaleConfigs:       'getter' as unknown as { [i: string]: ConfigType },
  ModuleConfigDefault: 'getter' as unknown as ConfigType,
  ModuleFonts:         'getter' as unknown as FontFaceType[],
  FeatureModules:      'getter' as unknown as FeatureType,
  BkChsInV11n:         'getter' as unknown as { [key in V11nType]: { [i: string]: number }; },
  OPSYS:               'getter' as unknown as NodeJS.Platform,
  /* eslint-enable prettier/prettier */

  // GLOBAL FUNCTIONS
  // ----------------
  resolveHtmlPath: funcCACHE as unknown as (htmlfile: string) => string,
  inlineFile: funcCACHE as unknown as (
    path: string,
    encoding: BufferEncoding,
    noHeader?: boolean
  ) => string,
  resetMain: func as unknown as () => void,
  getSystemFonts: funcCACHE as unknown as () => Promise<string[]>,
  getBooksInModule: funcCACHE as unknown as (module: string) => string[],
  log: func as unknown as (type: ElectronLog.LogLevel, ...args: any) => void,
  publishSubscription: func as unknown as (
    arg: WindowDescriptorType | null,
    subscriptionName: string,
    ...args: any
  ) => void,

  // GLOBAL OBJECTS
  // --------------
  Prefs: PrefsPublic,
  LibSword: LibSwordPublic,
  Dirs: {
    path: 'getter' as unknown as DirsDirectories,
  },
  Commands: CommandsPublic,
  // See electron shell api. Any electron shell property can be added
  // here and it will become available in G.
  Shell: {
    beep: func as unknown as () => void,
  },
  // Make data available to all processes (main and renderer).
  Data: {
    has: func as unknown as (name: string) => boolean,
    write: func as unknown as (data: any, name: string) => void,
    read: func as unknown as (name: string) => any,
    readAndDelete: func as unknown as (name: string) => any,
  },
  Downloader: {
    crossWireMasterRepoList: func as unknown as () => Promise<
      Download[] | string
    >,
    repositoryListing: func as unknown as (
      repos: (Repository | null)[]
    ) => Promise<RepositoryListing[]>,
    ftpCancel: func as unknown as () => void,
  },
  Module: {
    download: func as unknown as (
      module: string,
      repository: Repository
    ) => Promise<number | string>,
    downloadXSM: func as unknown as (
      module: string,
      zipFileOrURL: string,
      repository: Repository
    ) => Promise<number | string>,
    saveDownloads: func as unknown as (
      saves: { module: string; fromRepo: Repository; toRepo: Repository }[]
    ) => Promise<NewModulesType>,
    clearDownload: func as unknown as (
      module?: string,
      repository?: Repository
    ) => boolean,
    remove: func as unknown as (module: string, repo: Repository) => boolean,
    move: func as unknown as (
      module: string,
      fromRepo: Repository,
      toRepo: Repository
    ) => boolean,
  },
  Window: {
    open: func as unknown as (arg: WindowDescriptorType) => number,
    setComplexValue: func as unknown as (argname: string, value: any) => void,
    mergeValue: func as unknown as (
      argname: string,
      value: { [i: string]: any }
    ) => void,
    setContentSize: func as unknown as (
      width: number,
      height: number,
      window?: WindowArgType
    ) => void,
    setTitle: func as unknown as (
      title: string,
      window?: WindowArgType
    ) => void,
    tmpDir: func as unknown as (window?: WindowArgType) => string,
    reset: func as unknown as (
      type?: ResetType,
      window?: WindowArgType
    ) => void,
    modal: func as unknown as (
      modal: ModalType,
      window?: WindowArgType
    ) => void,
    moveToFront: func as unknown as (window?: WindowArgType) => void,
    moveToBack: func as unknown as (window?: WindowArgType) => void,
    close: func as unknown as (window?: WindowArgType) => void,
  },
};

export type GType = typeof GPublic;
