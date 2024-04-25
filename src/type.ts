/* eslint-disable import/no-duplicates */
import S from './defaultPrefs.ts';

import type { TreeNodeInfo } from '@blueprintjs/core';
import type {
  BrowserWindowConstructorOptions,
  clipboard,
  Shell,
} from 'electron';
import type React from 'react';
import type C from './constant.ts';
import type {
  resetMain,
  getSystemFonts,
  getBooksInVKModule,
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
  GCachePreloadType,
  GetBooksInVKModules,
  getLocaleDigits,
  getLocalizedBooks,
  inlineFile,
  inlineAudioFile,
} from './main/minit.ts';
import type {
  publishSubscription,
  resolveHtmlPath,
} from './main/components/window.ts';
import type Prefs from './main/components/prefs.ts';
import type DiskCache from './main/components/diskcache.ts';
import type Commands from './main/components/commands.ts';
import type Data from './main/components/data.ts';
import type Module from './main/components/module.ts';
import type Window from './main/components/window.ts';
import type { DirsRendererType } from './main/components/dirs.ts';
import type LibSword from './main/components/libsword.ts';
import type { canRedo, canUndo } from './main/bookmarks.ts';
import type Viewport from './main/components/viewport.ts';

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
      ) => void;
    };
    processR: {
      [envar in EnvironmentVars]: () => string;
    } & {
      argv: () => string[];
      platform: string;
    };
    renderPromises: RenderPromiseComponent['renderPromise'][];
  }

  function ToUpperCase(str: string): string;

  function ReportSearchIndexerProgress(percent: number): void;
}

type RendererChannels =
  | 'global'
  | 'did-finish-render'
  | 'log'
  | 'error-report'
  | 'resize'
  | 'progress'
  | 'modal'
  | 'update-state-from-pref'
  | 'component-reset'
  | 'cache-reset'
  | 'dynamic-stylesheet-reset'
  | 'publish-subscription';

/*
type Shift<T extends any[]> = T extends [infer _, ...infer Elements]
  ? Elements
  : [];
*/
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

export type WindowTypes =
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
  | 'copyPassage'
  | 'bmProperties'
  | 'bmManager';

export type WindowDescriptorType = {
  type: WindowTypes | 'all';
  id: number;
  dataID: string;
  options: BrowserWindowConstructorOptions;
  className?: string;
  typePersistBounds?: boolean;
  saveIfAppClosed?: boolean;
  notResizable?: boolean;
  fitToContent?: boolean;
  allowMultiple?: boolean;
  additionalArguments?: { [k: string]: PrefValue };
  openWithBounds?: {
    withinWindowID: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

// Some descriptor options are not PrefValues and cannot be cloned or serialized,
// so these properties must be removed before sending to a renderer for instance.
export type WindowDescriptorPrefType = Omit<WindowDescriptorType, 'options'> & {
  options?: {
    parent?: undefined;
    icon?: undefined;
    trafficLightPosition?: undefined;
    webPreferences?: undefined;
    titleBarOverlay?: undefined;
  };
} & {
  options?: Omit<
    BrowserWindowConstructorOptions,
    | 'parent'
    | 'icon'
    | 'trafficLightPosition'
    | 'webPreferences'
    | 'titleBarOverlay'
  >;
};

export type WindowPrefsType = {
  [wid: string]: WindowDescriptorPrefType | Record<string, never>;
};

export type WindowArgType =
  | Partial<WindowDescriptorType>
  | 'all'
  | 'parent'
  | 'self'
  | 'not-self'
  | 'children';

export type ModalType =
  | 'off'
  | 'darkened'
  | 'dropshadow'
  | 'outlined'
  | 'transparent';

// - skipWindowUpdate prevents temporary states from being saved to Prefs or broadcast
// to other windows.
export type ScrollType = {
  verseAt: 'top' | 'center' | 'bottom';
  skipWindowUpdate?: boolean;
} | null;

export type AudioPrefType = {
  open: boolean;
  file: VerseKeyAudioFile | GenBookAudioFile | null;
};

export type AtextPropsType = Pick<
  typeof S.prefs.xulsword,
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

export type PinPropsType = Pick<AtextPropsType, typeof C.PinProps[number]>;

export type XulswordStateArgType =
  | Partial<typeof S.prefs.xulsword>
  | ((s: typeof S.prefs.xulsword) => Partial<typeof S.prefs.xulsword> | null);

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
  scope?: string;
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

export type LocationTypes = {
  Texts: LocationVKType;
  Comms: LocationVKCommType;
  Genbks: LocationORType;
  Dicts: LocationORType;
};

export type LocationVKType = {
  book: OSISBookType;
  chapter: number;
  v11n: V11nType | null;
  verse?: number;
  lastverse?: number;
  subid?: string;
  vkMod?: string;
};

export type LocationVKCommType = LocationVKType & {
  commMod: string;
};

export type LocationORType = {
  otherMod: string;
  key: string;
  paragraph?: number; // Not implemented
};

export type TextVKType = {
  location: LocationVKType;
  vkMod: string;
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

export type ContextDataType = {
  type: 'general' | 'bookmarkManager';
  search?: SearchType;
  location?: LocationVKType;
  locationGB?: LocationORType;
  locationCOMM?: LocationVKCommType;
  context?: string;
  tab?: string;
  lemma?: string;
  panelIndex?: number;
  bookmark?: string;
  bookmarks?: string[];
  isPinned?: boolean;
  selection?: string;
  selectionParsedVK?: LocationVKType;
  windowDescriptor?: WindowDescriptorPrefType;
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
  code: OSISBookType;
  name: string;
  longname: string;
  index: number;
  bookGroup: BookGroupType;
  indexInBookGroup: number;
};

export type OSISBookType =
  typeof C.SupportedBooks[keyof typeof C.SupportedBooks][number];

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

export type TabTypes = 'Texts' | 'Comms' | 'Dicts' | 'Genbks';

export type TabType = {
  module: string;
  conf: SwordConfType;
  tabType: TabTypes;
  type: ModTypes;
  isVerseKey: boolean;
  direction: 'ltr' | 'rtl';
  v11n: V11nType | '';
  label: string;
  labelClass: string;
};

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
    Feature?: SwordFeatures[];
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

export type SwordFeatures =
  | 'StrongsNumbers'
  | 'GreekDef'
  | 'HebrewDef'
  | 'GreekParse'
  | 'HebrewParse'
  | 'DailyDevotion'
  | 'Glossary'
  | 'Images'
  | 'NoParagraphs';

export type XulswordFeatures = 'greek' | 'hebrew';

export type SwordFeatureMods = Record<SwordFeatures, string[]>;

export type XulswordFeatureMods = Record<XulswordFeatures, string[]>;

export type FeatureMods = SwordFeatureMods & XulswordFeatureMods;

export type ModulesCache = {
  [module: string]: {
    toc: GenBookKeys;
    keylist: string[];
    treenodes: TreeNodeInfo[];
  };
};

// GenBookTOC describes GenBooks structure (chapter names/order/hierarchy).
// Is output by LibSword but immediately converted to GenBookKeys.
export type GenBookTOC = {
  [title: string]: GenBookTOC | 1;
};

// GenBookKeys describes GenBooks structure (chapter names/order/hierarchy)
// as well as maps all GenBook keys. Key order is ctitical (each parent is
// followed by its children, in order). GenBook key separator is C.GBKSEP and
// parent nodes always end with C.GBKSEP.
export type GenBookKeys = string[];

// AudioPath describes a chapter's address on disk. IMPORTANT: only the first
// item may be an OSIS book abbreviation or number, all other items are numbers.
// Ex: [0, 2, 1] is the disk path 000/002/001.*
// Ex: ['Prov', 1] is the disk path Prov/001.*
export type AudioPath = [(number | OSISBookType)?, ...number[]];

// GenBookAudio describes audio chapter keys, existence, and disk address.
// Each gbkey is a key to a GenBook SWORD module entry.
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
// config files. Ex: { 'Prov': ['0-10', '12'] }
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
  name: string | 'i18n:lookup';
  domain: string;
  path: string;
  custom: boolean; // repository is created by user (and can be deleted)
  builtin: boolean; // repository cannot be disabled
  disabled?: boolean;
};

export type RepositoryListing = SwordConfType[] | null;

export type FTPDownload = {
  type: 'ftp';
  file: string;
} & Repository;

export type ModFTPDownload = {
  type: 'module';
  module: string;
  confname: string;
} & Repository;

export type HTTPDownload = {
  type: 'http';
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

export type PrefStoreType =
  | 'prefs'
  | 'bookmarks'
  | 'fonts'
  | 'style'
  | 'windows';

export type PrefPrimative = number | string | boolean | null | undefined;
export type PrefObject = {
  [i: string]: PrefValue;
};
export type PrefValue =
  | PrefPrimative
  | PrefObject
  | (PrefPrimative | PrefObject | PrefValue)[];

export type TreeNodeInfoPref = Pick<
  TreeNodeInfo,
  'id' | 'label' | 'className' | 'hasCaret' | 'isExpanded'
>;

export type BookmarkTreeNode = BMItem &
  TreeNodeInfo & {
    isCut: boolean;
    isCopy: boolean;
  };

export type BookmarkItem = BMItem &
  Pick<TreeNodeInfo, 'hasCaret' | 'isExpanded' | 'isSelected'>;

export type BMItem = {
  id: string; // unique id of item
  label: string | 'i18n:lookup'; // default is auto-generated; editable
  labelLocale: typeof C.Locales[number][0] | ''; // locale of name
  note: string | 'i18n:lookup'; // default is empty; editable
  noteLocale: typeof C.Locales[number][0] | ''; // locale of note
  creationDate: number; // ms epoch
  type?: 'bookmark' | 'folder';
  tabType?: TabTypes;
};

export type BookmarkTexts = BookmarkItem & {
  type: 'bookmark';
  tabType: 'Texts';
  location: LocationVKType;
  sampleText: string;
};

export type BookmarkComm = BookmarkItem & {
  type: 'bookmark';
  tabType: 'Comms';
  location: LocationVKCommType;
  sampleText: string;
};

export type BookmarkOther = BookmarkItem & {
  type: 'bookmark';
  tabType: 'Genbks' | 'Dicts';
  location: LocationORType;
  sampleText: string;
};

export type BookmarkFolderType = BookmarkItem & {
  type: 'folder';
  childNodes: BookmarkItemType[];
};

export type BookmarkType = BookmarkTexts | BookmarkComm | BookmarkOther;

export type BookmarkItemType = BookmarkFolderType | BookmarkType;

export type BookmarkItemTypes = ['folder', 'bookmark'];

export type TransactionType = {
  prefkey: string;
  value: PrefValue;
  store?: PrefStoreType;
};

export type MethodAddCaller<M extends (...args: any) => any> = (
  ...arg: [...Parameters<M>, number]
) => ReturnType<M>;

export type ObjectAddCaller<
  T extends { [k: string]: (...args: any[]) => any }
> = {
  [K in keyof T]: MethodAddCaller<T[K]>;
};

export type GAddCaller = {
  [obj in typeof GBuilder['includeCallingWindow'][number]]: ObjectAddCaller<
    GType[obj]
  >;
};

export interface RenderPromiseComponent {
  renderPromise: {
    self: React.Component;
    calls: GCallType[];
    uncacheableCalls: {
      [key: string]: {
        promise: Promise<any>;
        resolved: any;
      };
    }
  }
}

export type RenderPromiseState = {
  renderPromiseID: number;
}

export type GCallType = [
  keyof GType | keyof GAType,
  keyof GType[keyof GType] | keyof GAType[keyof GAType] | null,
  any[] | undefined
];

export type GType = {
  gtype: 'sync';

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
  GetBooksInVKModules: ReturnType<typeof GetBooksInVKModules>;

  // Functions
  resolveHtmlPath: typeof resolveHtmlPath;
  inlineFile: typeof inlineFile;
  inlineAudioFile: typeof inlineAudioFile;
  resetMain: typeof resetMain;
  getSystemFonts: typeof getSystemFonts;
  getBooksInVKModule: typeof getBooksInVKModule;
  getLocalizedBooks: typeof getLocalizedBooks;
  getLocaleDigits: typeof getLocaleDigits;
  publishSubscription: typeof publishSubscription;
  canUndo: typeof canUndo;
  canRedo: typeof canRedo;
  cachePreload: GCachePreloadType;

  // Objects
  i18n: {
    t: (k: string, opts?: any) => string;
    exists: (k: string, opts?: any) => boolean;
    language: string
  };
  clipboard: Pick<typeof clipboard, 'write'>;
  Prefs: typeof Prefs;
  DiskCache: typeof DiskCache;
  LibSword: typeof LibSword;
  Dirs: DirsRendererType;
  Commands: typeof Commands;
  Shell: Pick<Shell, 'beep'>;
  Data: typeof Data;
  Module: typeof Module;
  Viewport: typeof Viewport;
  Window: typeof Window;
};

export type GAType = { gtype: 'async' }
  & { [k in keyof Pick<GType,
        'Books' |
        'Book' |
        'Tabs' |
        'Tab' |
        'Config' |
        'AudioConfs' |
        'ProgramConfig' |
        'LocaleConfigs' |
        'ModuleConfigDefault' |
        'ModuleFonts' |
        'FeatureModules' |
        'BkChsInV11n' |
        'OPSYS' |
        'GetBooksInVKModules'>
      ]: Promise<GType[k]>
  }
  & { [k in keyof Pick<GType,
        'resolveHtmlPath' |
        'inlineFile' |
        'inlineAudioFile' |
        'resetMain' |
        'getSystemFonts' |
        'getBooksInVKModule' |
        'getLocalizedBooks' |
        'getLocaleDigits' |
        'publishSubscription' |
        'canUndo' |
        'canRedo' |
        'cachePreload'>
      ]: (...args: Parameters<GType[k]>) => Promise<ReturnType<GType[k]>>
  }
  & { [k in keyof Pick<GType,
        'i18n' |
        'clipboard' |
        'Prefs' |
        'DiskCache' |
        'LibSword' |
        'Dirs' |
        'Commands' |
        'Shell' |
        'Data' |
        'Module' |
        'Viewport' |
        'Window'>
      ]: unknown;
  };

// This GBuilder object will be used in the main/mg and renderer/rg
// modules at runtime to create different types of G objects sharing
// the same GType interface: one will be available in the main process
// and another in renderer processes. The main process G object accesses
// everything directly. But the renderer process G object requests
// everything through IPC from the main process G object. All getter and
// 'CACHEfunc' data of the renderer G object is cached in the renderer.
// GBuilder includeCallingWindow object methods will have an extra
// argument appended before they are executed in the main process which
// contains the calling window's id. IMPORTANT: async functions must be
// listed in asyncFuncs or runtime errors will result!
const func = () => {};
const CACHEfunc = () => 'cacheable';
if (typeof window !== 'undefined') window.renderPromises = [];
export const GBuilder: GType & {
  // IMPORTANT: Methods of includeCallingWindow classes must not use rest
  // parameters or default values in their function definition's argument
  // lists, nor may they be getter functions. This is because Function.length
  // is used to append the calling window by mg.ts, and Function.length does
  // not include rest parameters or default arguments. Additionally getter
  // functions have zero arguments or Function.length. Using rest parameters
  // or default arguments would result in overwriting the last argument by
  // the calling window id!
  includeCallingWindow: ['Prefs', 'Window', 'Commands', 'Module'];

  // async functions must be listed in asyncFuncs or runtime
  // errors will result!
  asyncFuncs: [
    [keyof GType, (keyof GType['getSystemFonts'])[]],
    [keyof GType, (keyof GType['cachePreload'])[]],
    [keyof GType, (keyof GType['Commands'])[]],
    [keyof GType, (keyof GType['Module'])[]],
    [keyof GType, (keyof GType['LibSword'])[]],
    [keyof GType, (keyof GType['Window'])[]]
  ];

  // Only these functions and object methods will be accessible via Internet.
  internetSafe: [
    [(keyof GType), (keyof GType['Books'])[]],
    [(keyof GType), (keyof GType['Book'])[]],
    [(keyof GType), (keyof GType['Tabs'])[]],
    [(keyof GType), (keyof GType['Tab'])[]],
    //[(keyof GAType), (keyof GType['Config'])[]],
    //[(keyof GAType), (keyof GType['AudioConfs'])[]],
    //[(keyof GAType), (keyof GType['ProgramConfig'])[]],
    //[(keyof GAType), (keyof GType['LocaleConfigs'])[]],
    //[(keyof GAType), (keyof GType['ModuleConfigDefault'])[]],
    [(keyof GType), (keyof GType['ModuleFonts'])[]],
    [(keyof GType), (keyof GType['FeatureModules'])[]],
    [(keyof GType), (keyof GType['BkChsInV11n'])[]],
    //[(keyof GAType), (keyof GType['getSystemFonts'])[]],
    [(keyof GType), (keyof GType['getBooksInVKModule'])[]],
    [(keyof GType), (keyof GType['getLocalizedBooks'])[]],
    [(keyof GType), (keyof GType['getLocaleDigits'])[]],
    [(keyof GType), (keyof GType['GetBooksInVKModules'])[]],
    [(keyof GType), (keyof GType['cachePreload'])[]],
    [(keyof GType), (keyof GType['i18n'])[]],
    [(keyof GType), (keyof GType['LibSword'])[]],
  ];
} = {
  includeCallingWindow: ['Prefs', 'Window', 'Commands', 'Module'],

  asyncFuncs: [
    ['getSystemFonts',
      []],
    ['cachePreload',
      []],
    ['Commands',
      ['installXulswordModules',
        'exportAudio',
        'importAudio',
        'importBookmarks',
        'exportBookmarks',
        'print']],
    ['Module',
      ['crossWireMasterRepoList',
        'repositoryListing',
        'download',
        'downloads',
        'cancelOngoingDownloads',
        'cancel',
        'installDownloads']],
    ['LibSword',
      ['searchIndexBuild',
        'search']],
    ['Window',
      ['print',
        'printToPDF']],
  ],

  internetSafe: [
    ['Books',
      []],
    ['Book',
      []],
    ['Tabs',
      []],
    ['Tab',
      []],
    /*['Config',
      []],
    ['AudioConfs',
      []],
    ['ProgramConfig',
      []],
    ['LocaleConfigs',
      []],
    ['ModuleConfigDefault',
      []],*/
    ['ModuleFonts',
      []],
    ['FeatureModules',
      []],
    ['BkChsInV11n',
      []],
    /*['getSystemFonts',
      []],*/
    ['getBooksInVKModule',
      []],
    ['getLocalizedBooks',
      []],
    ['getLocaleDigits',
      []],
    ['GetBooksInVKModules',
      []],
    ['cachePreload',
      []],
    ['i18n',
      ['t',
        'exists',
        'language']],
    ['LibSword',
      ['getMaxChapter',
      'getMaxVerse',
      'getChapterText',
      'getChapterTextMulti',
      'getFootnotes',
      'getCrossRefs',
      'getNotes',
      'getVerseText',
      'getVerseSystem',
      'convertLocation',
      'getIntroductions',
      'getDictionaryEntry',
      'getAllDictionaryKeys',
      'getGenBookChapterText',
      'getGenBookTableOfContents',
      'search',
      'getSearchResults']],
  ],

  gtype: 'sync',

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
  GetBooksInVKModules: 'getter' as any,

  // Functions
  resolveHtmlPath: CACHEfunc as any,
  inlineFile: CACHEfunc as any,
  inlineAudioFile: CACHEfunc as any,
  getSystemFonts: CACHEfunc as any,
  getBooksInVKModule: CACHEfunc as any,
  getLocalizedBooks: CACHEfunc as any,
  getLocaleDigits: CACHEfunc as any,
  resetMain: func as any,
  publishSubscription: func as any,
  canUndo: func as any,
  canRedo: func as any,
  cachePreload: func as any,

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
    // uses includeCallingWindow
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

  DiskCache: {
    has: func as any,
    read: CACHEfunc as any,
    write: func as any,
    delete: func as any,
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
    startBackgroundSearchIndexer: func as any,
    search: func as any,
    getSearchResults: func as any,
    searchIndexDelete: func as any,
    searchIndexCancel: func as any,
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
    // uses includeCallingWindow
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
    search: func as any,
    searchHelp: func as any,
    copyPassage: func as any,
    openFontsColors: func as any,
    openBookmarksManager: func as any,
    moveBookmarkItems: func as any,
    pasteBookmarkItems: func as any,
    deleteBookmarkItems: func as any,
    importBookmarks: func as any,
    exportBookmarks: func as any,
    openBookmarkProperties: func as any,
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
    delete: func as any,
    readAndDelete: func as any,
  },

  Module: {
    // uses includeCallingWindow
    crossWireMasterRepoList: func as any,
    repositoryListing: func as any,
    download: func as any,
    downloads: func as any,
    cancelOngoingDownloads: func as any,
    cancel: func as any,
    installDownloads: func as any,
    remove: func as any,
    move: func as any,
    writeConf: func as any,
    setCipherKeys: func as any,
  },

  Window: {
    // uses includeCallingWindow
    descriptions: func as any,
    open: func as any,
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
    print: func as any,
    printToPDF: func as any,
  },

  Viewport: {
    sortTabsByLocale: func as any,
    getTabChange: func as any,
    getPanelChange: func as any,
    getModuleChange: func as any,
    setXulswordTabs: func as any,
    setXulswordPanels: func as any,
  },
};
