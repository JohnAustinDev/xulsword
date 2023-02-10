/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { clipboard, Shell } from 'electron';
import type i18n from 'i18next';
import type React from 'react';
import type C from './constant';
import type {
  resetMain,
  getSystemFonts,
  getBooksInModule,
  getBooks,
  getBook,
  getTabs,
  getTab,
  getConfig,
  getAudioConfs,
  getLocaleConfigs,
  localeConfig,
  getModuleConfigDefault,
  getModuleFonts,
  getFeatureModules,
  getBkChsInV11n,
} from './main/minit';
import type {
  publishSubscription,
  resolveHtmlPath,
} from './main/components/window';
import type { inlineFile, inlineAudioFile } from './main/components/localFile';
import type Prefs from './main/components/prefs';
import type Commands from './main/components/commands';
import type Data from './main/components/data';
import type Module from './main/components/module';
import type Window from './main/components/window';
import type { DirsRendererType } from './main/components/dirs';
import type LibSword from './main/components/libsword';
import type MainPrintHandler from './main/print';

declare global {
  export interface Window {
    ipc: {
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
    ipcTS: {
      printOrPreview: (
        ...args: Shift<Parameters<typeof MainPrintHandler>>
      ) => ReturnType<typeof MainPrintHandler>;
    };
    processR: {
      [envar in EnvironmentVars]: () => string;
    } & {
      argv: () => string[];
      platform: string;
    };
  }

  function ToUpperCase(str: string): string;

  function ReportSearchIndexerProgress(percent: number): void;
}

type RendererChannels =
  | 'global'
  | 'did-finish-render'
  | 'print-or-preview'
  | 'log'
  | 'close'
  | 'resize'
  | 'progress'
  | 'modal'
  | 'update-state-from-pref'
  | 'component-reset'
  | 'cache-reset'
  | 'dynamic-stylesheet-reset'
  | 'publish-subscription';

type Shift<T extends any[]> = T extends [infer _, ...infer Elements]
  ? Elements
  : [];

export type QuerablePromise<T> = Promise<T> & {
  isFulfilled: boolean;
  isPending: boolean;
  isRejected: boolean;
  reject: (er: any) => void;
};

export type EnvironmentVars =
  | 'NODE_ENV'
  | 'XULSWORD_ENV'
  | 'DEBUG_PROD'
  | 'LOGLEVEL';

export type WindowRegistryType = (WindowDescriptorType | null)[];

export type WindowDescriptorType = {
  id?: number;
  type?:
    | 'xulsword'
    | 'splash'
    | 'viewportWin'
    | 'popupWin'
    | 'chooseFont'
    | 'moduleManager'
    | 'removeModule'
    | 'search'
    | 'searchHelp'
    | 'about'
    | 'printPassage'
    | 'copyPassage';
  category?:
    | 'window' // Parent optional, persisted, resizable
    | 'dialog' // Has parent, not persisted, size is fit-to-content, not-resizable
    | 'dialog-window'; // Has parent, not persisted, resizable
  options?: Electron.BrowserWindowConstructorOptions;
};

export type WindowArgType =
  | Partial<WindowDescriptorType>
  | 'all'
  | 'parent'
  | 'self'
  | 'not-self'
  | 'children';

export type ModalType = 'off' | 'darkened' | 'outlined' | 'transparent';

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

export type AudioPrefType = {
  open: boolean;
  file: VerseKeyAudioFile | GenBookAudioFile | null;
};

// Default values for these keys must be set in the default
// JSON Pref file or an error will be thrown. These values
// are always kept in sync between Prefs, the application menu
// the main xulsword window state.
export interface XulswordStatePref {
  location: LocationVKType | null;
  selection: LocationVKType | null;
  scroll: ScrollType;

  keys: (string | null)[];

  audio: AudioPrefType;
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

export interface CopyPassageStatePref {
  checkboxes: {
    [k in keyof ShowType]?: boolean;
  };
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
  onAudioClick: (audio: VerseKeyAudioFile | GenBookAudioFile) => void;
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
    audio: AudioPrefType;
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

export type CipherKey = { conf: SwordConfType; cipherKey: string };

export type LocationGBType = {
  module: string;
  key: string;
};

export type LocationVKType = {
  book: OSISBookType;
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

export type OSISBookType =
  typeof C.SupportedBooks[keyof typeof C.SupportedBooks][number];

export type ModTypes =
  | 'Biblical Texts'
  | 'Commentaries'
  | 'Lexicons / Dictionaries'
  | 'Generic Books'
  | 'XSM_audio';

export type XSModTypes = 'XSM' | 'XSM_audio' | 'none';

export type XSMConfigEntries = {
  // XSM (xulsword modules) have <module>.xsm for DataPath
  // NameXSM?: string;
  SwordModules?: string[];
  SwordVersions?: string[];

  // XSM audio configs also have ModDrv as 'audio' and
  // DataPath as a URL value.
  AudioChapters?: VerseKeyAudio | GenBookAudioConf;
};

export type SwordConfXulsword = {
  AudioCode?: string[];
};

export type DepricatedSwordConfXulsword = {
  NoticeLink?: string;
  NoticeText?: string;
  TabLabel?: string;
  FontSizeAdjust?: string;
  LineHeight?: string;
  FontSize?: string;
  FontColor?: string;
  FontBackground?: string;
};

export type SwordConfigEntries = SwordConfXulsword &
  DepricatedSwordConfXulsword & {
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
    CipherKey?: string;
    Font?: string;
    Direction?: 'LtoR' | 'RtoL' | 'BiDi';
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
      | 'RawGenBook'
      | 'audio';
    Companion?: string[];
    DisplayLevel?: number;
    InstallSize?: number;
    Versification?: V11nType;
    Obsoletes?: string[];
    Feature?: string[];
    GlobalOptionFilter?: string[];
    History?: [string, SwordConfLocalized][];
  };

export type SwordConfType = SwordConfigEntries &
  XSMConfigEntries & {
    // Extra helper additions
    module: string;
    reports: NewModuleReportType[];
    sourceRepository: Repository;
    moduleType: ModTypes;
    xsmType: XSModTypes;
    filename: string;
  };

export type SwordConfLocalized = {
  [locale: string | 'locale' | 'en']: string;
};

// GenBookTOC describes GenBooks structure (chapter names/order/hierarchy).
// Is output by LibSword but immediately converted to GenBookKeys.
export type GenBookTOC = {
  [title: string]: GenBookTOC | 1;
};

// GenBookKeys describes GenBooks structure (chapter names/order/hierarchy)
// as well as maps all GenBook keys. Keys are dileneated by C.GBKSEP and keys
// ending with C.GBKSEP are parent nodes.
export type GenBookKeys = string[];

// AudioPath describes a chapter's address on disk. IMPORTANT: only the first
// item may be an OSIS book abbreviation or number, all other items are numbers.
// Ex: [0, 2, 1] is the disk path 000/002/001.*
// Ex: ['Prov', 1] is the disk path Prov/001.*
export type AudioPath = [(number | OSISBookType)?, ...number[]];

// GenBookAudio describes audio chapter keys, existence and disk address.
// NOTE: gbkey MUST be a key to a GenBook SWORD module.
export type GenBookAudio = {
  [gbkey: string]: AudioPath;
};

// GenBookAudioConf is similar to GenBookAudio but is short and readable for
// use in config files. Ex: { '000 Title/002 Title/': ['0-10', '12'] }
// NOTE: parentPath is composed of '/' delineated segments that MUST begin
// with a three digit index number, but the title is optional.
export type GenBookAudioConf = {
  [parentPath: string]: string[];
};

// VerseKeyAudio describes chapter existence and disk address.
// Ex: { Prov: [true,,true] } are disk paths Prov/000.mp3 and Prov/002.mp3
export type VerseKeyAudio = {
  [osisBookCode in OSISBookType]?: boolean[];
};

// VerseKeyAudioConf same as VerseKeyAudio but short and readable for
// config file. Ex: { 'Prov': ['0-10', '12'] }
export type VerseKeyAudioConf = {
  [osisBookCode in OSISBookType]?: string[];
};

// Was used to list audio for both VerseKey and GenBook in old audio config
// files, but VerseKeyAudioConf and GenBookAudioConf are used now.
export type DeprecatedAudioChaptersConf = {
  bk: OSISBookType | string;
  ch1: number;
  ch2: number;
};

export type VerseKeyAudioFile = {
  audioModule: string;
  book: OSISBookType;
  chapter: number;
  path: AudioPath;
  swordModule?: string;
};

export type GenBookAudioFile = {
  audioModule: string;
  key: string;
  path: AudioPath;
  swordModule?: string;
};

export type TabTypes = 'Texts' | 'Comms' | 'Dicts' | 'Genbks';

export type TabType = {
  module: string;
  type: ModTypes;
  version: string;
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
  conf: SwordConfType;
};

export type RowSelection = { rows: [number, number] }[];

export type NewModuleReportType = { warning?: string; error?: string };

export type NewModulesType = {
  modules: SwordConfType[];
  nokeymods: SwordConfType[];
  fonts: string[];
  bookmarks: string[];
  audio: (VerseKeyAudioFile | GenBookAudioFile)[];
  reports: NewModuleReportType[];
};

export type Repository = {
  name: string;
  domain: string;
  path: string;
  disabled?: boolean;
  custom?: boolean;
  builtin?: boolean;
};

export type RepositoryListing = SwordConfType[] | null;

export type FTPDownload = {
  file: string;
} & Repository;

export type ModFTPDownload = {
  module: string;
  confname: string;
} & Repository;

export type HTTPDownload = {
  http: string; // https?://...
  confname: string;
} & Repository;
export type Download = FTPDownload | ModFTPDownload | HTTPDownload;

export type DownloadKey = string;

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

export type PrefPrimative = number | string | boolean | null | undefined;
export type PrefObject = {
  [i: string]: PrefValue;
};
export type PrefValue =
  | PrefPrimative
  | PrefObject
  | (PrefPrimative | PrefObject | PrefValue)[];

export type GMethodAddCaller<M extends (...args: any) => any> = (
  ...arg: [...Parameters<M>, number]
) => ReturnType<M>;

export type GAddCaller<G extends { [k: string]: (...args: any[]) => any }> = {
  [K in keyof G]: GMethodAddCaller<G[K]>;
};

export type GType = {
  // Getters
  Books: ReturnType<typeof getBooks>;
  Book: ReturnType<typeof getBook>;
  Tabs: ReturnType<typeof getTabs>;
  Tab: ReturnType<typeof getTab>;
  Config: ReturnType<typeof getConfig>;
  AudioConfs: ReturnType<typeof getAudioConfs>;
  ProgramConfig: ReturnType<typeof localeConfig>;
  LocaleConfigs: ReturnType<typeof getLocaleConfigs>;
  ModuleConfigDefault: ReturnType<typeof getModuleConfigDefault>;
  ModuleFonts: ReturnType<typeof getModuleFonts>;
  FeatureModules: ReturnType<typeof getFeatureModules>;
  BkChsInV11n: ReturnType<typeof getBkChsInV11n>;
  OPSYS: NodeJS.Platform;

  // Functions
  resolveHtmlPath: typeof resolveHtmlPath;
  inlineFile: typeof inlineFile;
  inlineAudioFile: typeof inlineAudioFile;
  resetMain: typeof resetMain;
  getSystemFonts: typeof getSystemFonts;
  getBooksInModule: typeof getBooksInModule;
  publishSubscription: typeof publishSubscription;

  // Objects
  i18n: Pick<typeof i18n, 't' | 'exists' | 'language'>;
  clipboard: Pick<typeof clipboard, 'write'>;
  Prefs: typeof Prefs;
  LibSword: typeof LibSword;
  Dirs: DirsRendererType;
  Commands: typeof Commands;
  Shell: Pick<Shell, 'beep'>;
  Data: typeof Data;
  Module: typeof Module;
  Window: typeof Window;
};

export type AddCaller = {
  [obj in typeof GBuilder['includeCallingWindow'][number]]: GAddCaller<
    GType[obj]
  >;
};

// This GBuilder object will be used in the main/mg and renderer/rg
// modules at runtime to create two different types of G objects
// sharing the same GType interface: one will be available in the
// main process and the other in renderer processes. The main process
// G object accesses everything directly. But the renderer process
// G object requests everything through IPC from the main process G
// object. All getter and 'CACHEfunc' data of the renderer G object
// is cached in the renderer. IMPORTANT: async functions must be
// listed in asyncFuncs or runtime errors will result!
const func = () => {};
const CACHEfunc = () => 'cacheable';
export const GBuilder: GType & {
  // async functions must be listed in asyncFuncs or runtime
  // errors will result!
  asyncFuncs: [
    [keyof GType, (keyof GType['getSystemFonts'])[]],
    [keyof GType, (keyof GType['Commands'])[]],
    [keyof GType, (keyof GType['Module'])[]],
    [keyof GType, (keyof GType['LibSword'])[]]
  ];

  // Methods of includeCallingWindow classes must not use rest parameters
  // or default values in their function definition's argument lists. This
  // is because Function.length is used to append the calling window by
  // mg.ts, and Function.length does not include rest parameters or default
  // arguments. Using rest parameters or default arguments would thus
  // result in overwriting the last argument by the calling window id!
  includeCallingWindow: ['Prefs', 'Window', 'Commands', 'Module'];
} = {
  asyncFuncs: [
    ['getSystemFonts', []],
    ['Commands', ['installXulswordModules', 'exportAudio', 'importAudio']],
    [
      'Module',
      [
        'download',
        'installDownloads',
        'remove',
        'move',
        'crossWireMasterRepoList',
        'repositoryListing',
      ],
    ],
    ['LibSword', ['searchIndexBuild', 'search']],
  ],

  includeCallingWindow: ['Prefs', 'Window', 'Commands', 'Module'],

  // Getters
  Books: 'getter' as any,
  Book: 'getter' as any,
  Tabs: 'getter' as any,
  Tab: 'getter' as any,
  Config: 'getter' as any,
  AudioConfs: 'getter' as any,
  ProgramConfig: 'getter' as any,
  LocaleConfigs: 'getter' as any,
  ModuleConfigDefault: 'getter' as any,
  ModuleFonts: 'getter' as any,
  FeatureModules: 'getter' as any,
  BkChsInV11n: 'getter' as any,
  OPSYS: 'getter' as any,

  // Functions
  resolveHtmlPath: CACHEfunc as any,
  inlineFile: CACHEfunc as any,
  inlineAudioFile: CACHEfunc as any,
  getSystemFonts: CACHEfunc as any,
  getBooksInModule: CACHEfunc as any,
  resetMain: func as any,
  publishSubscription: func as any,

  // Objects
  i18n: {
    t: CACHEfunc as any,
    exists: CACHEfunc as any,
    language: 'getter' as any,
  },

  clipboard: {
    write: func as any,
  },

  Prefs: {
    has: func as any,
    getPrefOrCreate: func as any,
    getCharPref: func as any,
    setCharPref: func as any,
    getBoolPref: func as any,
    setBoolPref: func as any,
    getIntPref: func as any,
    setIntPref: func as any,
    getComplexValue: func as any,
    setComplexValue: func as any,
    mergeValue: func as any,
    deleteUserPref: func as any,
    writeAllStores: func as any,
  },

  LibSword: {
    init: func as any,
    quit: func as any,
    isReady: func as any,
    getMaxChapter: CACHEfunc as any,
    getMaxVerse: CACHEfunc as any,
    getChapterText: func as any,
    getChapterTextMulti: func as any,
    getFootnotes: func as any,
    getCrossRefs: func as any,
    getNotes: func as any,
    getVerseText: func as any,
    getVerseSystem: CACHEfunc as any,
    convertLocation: CACHEfunc as any,
    getIntroductions: func as any,
    getDictionaryEntry: func as any,
    getAllDictionaryKeys: CACHEfunc as any,
    getGenBookChapterText: func as any,
    getGenBookTableOfContents: CACHEfunc as any,
    luceneEnabled: func as any,
    search: func as any,
    getSearchResults: func as any,
    searchIndexDelete: func as any,
    searchIndexBuild: func as any,
    setGlobalOption: func as any,
    setGlobalOptions: func as any,
    getGlobalOption: func as any,
    getModuleList: CACHEfunc as any,
    getModuleInformation: CACHEfunc as any,
  },

  Dirs: {
    path: 'getter' as any,
  },

  Commands: {
    openModuleManager: func as any,
    installXulswordModules: func as any,
    removeModule: func as any,
    exportAudio: func as any,
    importAudio: func as any,
    playAudio: func as any,
    print: func as any,
    printPassage: func as any,
    edit: func as any,
    undo: func as any,
    redo: func as any,
    cut: func as any,
    copy: func as any,
    paste: func as any,
    search: func as any,
    searchHelp: func as any,
    copyPassage: func as any,
    openFontsColors: func as any,
    openBookmarksManager: func as any,
    openNewDbItemDialog: func as any,
    openDbItemPropertiesDialog: func as any,
    deleteDbItem: func as any,
    openAbout: func as any,
    goToLocationVK: func as any,
    goToLocationGB: func as any,
  },

  Shell: {
    beep: func as any,
  },

  Data: {
    has: func as any,
    write: func as any,
    read: func as any,
    readAndDelete: func as any,
  },

  Module: {
    crossWireMasterRepoList: func as any,
    repositoryListing: func as any,
    download: func as any,
    cancel: func as any,
    installDownloads: func as any,
    remove: func as any,
    move: func as any,
    writeConf: func as any,
    setCipherKeys: func as any,
  },

  Window: {
    // NOTE: Window cannot use getter functions, because its
    // G methods pass calling window as an extra argument.
    description: CACHEfunc as any,
    descriptions: func as any,
    open: func as any,
    openSingleton: func as any,
    setComplexValue: func as any,
    mergeValue: func as any,
    setContentSize: func as any,
    setTitle: func as any,
    tmpDir: func as any,
    reset: func as any,
    modal: func as any,
    moveToFront: func as any,
    moveToBack: func as any,
    close: func as any,
  },
};
