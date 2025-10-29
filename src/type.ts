/* eslint-disable @typescript-eslint/consistent-type-definitions */
/* eslint-disable @typescript-eslint/naming-convention */
import type { TreeNodeInfo } from '@blueprintjs/core';
import type {
  BrowserWindowConstructorOptions,
  clipboard,
  Shell,
} from 'electron';
import type i18next from 'i18next';
import type { getProcessInfo } from './preload.ts';
import type getIPC from './preload.ts';
import type C from './constant.ts';
import type S from './defaultPrefs.ts';
import type { PrefsGType } from './prefs.ts';
import type {
  resetMain,
  getSystemFonts,
  getBooksInVKModule,
  getBooks,
  getBook,
  getTabs,
  getTab,
  getConfig,
  getAudioConf,
  getLocaleConfigs,
  localeConfig,
  getModuleConfigDefault,
  getModuleFonts,
  getFeatureModules,
  getBkChsInV11n,
  getBooksInVKModules,
  getLocaleDigits,
  inlineFile,
  inlineAudioFile,
  getAllDictionaryKeyList,
  genBookTreeNodes,
  getLanguageName,
  getAudioConfs,
  getModuleConfs,
  getModuleConf,
  getBuiltInRepos,
  getBooksLocalized,
  getBooksLocalizedAll,
} from './servers/common.ts';
import type { LocationVKTextG } from './servers/versetext.ts';
import type { publishSubscription } from './servers/app/components/window.ts';
import type DiskCache from './servers/components/diskcache.ts';
import type Commands from './servers/app/components/commands.ts';
import type Data from './servers/components/data.ts';
import type Module from './servers/app/components/module.ts';
import type Window from './servers/app/components/window.ts';
import type {
  DirsMainType,
  DirsRendererType,
} from './servers/components/dirs.ts';
import type LibSword from './servers/components/libsword.ts';
import type { canRedo, canUndo } from './servers/components/bookmarks.ts';
import type { CallBatch } from './servers/handleG.ts';
import type { AtextPropsType } from './clients/components/atext/atext.tsx';
import type RenderPromise from './clients/renderPromise.ts';
import type { SelectVKType } from './clients/components/libxul/selectVK.tsx';
import type { SelectORMType } from './clients/components/libxul/selectOR.tsx';

// This file contains global TypeScript types used throughout xulsword.

declare global {
  // These are available anywhere 'window' is defined (ie. browser, renderers):
  export interface Window {
    IPC: ReturnType<typeof getIPC>;
    ProcessInfo: ReturnType<typeof getProcessInfo>;
    WebAppClient: 'BibleBrowser' | 'Widgets';
    WebAppTextScroll: number;
    RenderPromises: readonly RenderPromise[];
  }

  // These are available everywhere:
  var Build: {
    isPackaged: boolean;
    isProduction: boolean;
    isDevelopment: boolean;
    isElectronApp: boolean;
    isWebApp: boolean;
    isClient: boolean;
    isServer: boolean;
  };

  var WebAppSkipModules: string;
}

export type QuerablePromise<T> = Promise<T> & {
  isFulfilled: boolean;
  isPending: boolean;
  isRejected: boolean;
  reject: (er: any) => void;
};

export type WindowRegistryType = Array<WindowDescriptorType | null>;

export type WindowTypes =
  | 'xulswordWin'
  | 'splashWin'
  | 'viewportWin'
  | 'popupWin'
  | 'chooseFontWin'
  | 'moduleManagerWin'
  | 'removeModuleWin'
  | 'searchWin'
  | 'searchHelpWin'
  | 'aboutWin'
  | 'printPassageWin'
  | 'copyPassageWin'
  | 'bmPropertiesWin'
  | 'bmManagerWin';

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
  additionalArguments?: Record<string, PrefValue>;
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

export type WindowPrefsType = Record<
  string,
  WindowDescriptorPrefType | Record<string, never>
>;

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
  file: AudioPlayerSelectionVK | AudioPlayerSelectionGB | null;
  defaults?: { [swordModule: string]: string };
};

export type PinPropsType = Pick<AtextPropsType, (typeof C.PinProps)[number]>;

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
  (typeof C.SupportedBooks)[keyof typeof C.SupportedBooks][number];

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
  lang: string;
  description: SwordConfLocalized;
  audioCodes: string[];
  tabType: TabTypes;
  type: ModTypes;
  xsmType: XSModTypes;
  isVerseKey: boolean;
  direction: 'ltr' | 'rtl';
  features: SwordFeatures[];
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
    History?: Array<[string, SwordConfLocalized]>;
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
  locale: string;
  en: string;
  [alocale: string]: string;
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

export type ModulesCache = Record<
  string,
  {
    toc: GenBookKeys;
    keylist: string[];
    treenodes: TreeNodeInfo[];
  }
>;

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
export type GenBookAudio = { [gbkey: string]: AudioPath };

// GenBookAudioConf is similar to GenBookAudio but is short and readable for
// use in config files. Ex: { '000 Title/002 Title/': ['0-10', '12'] }
// NOTE: parentPath is composed of C.GBSEP delineated segments that MUST begin
// with a three digit index number, but the title is optional.
export type GenBookAudioConf = Record<string, string[]>;

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

export type AudioPlayerSelectionVK = {
  swordModule: string;
  book?: OSISBookType;
  chapter?: number;
  audioModule?: string;
  path?: AudioPath;
};

export type AudioPlayerSelectionGB = {
  swordModule: string;
  key?: string;
  audioModule?: string;
  path?: AudioPath;
};

export type RowSelection = Array<{ rows: [number, number] }>;

export type NewModuleReportType = { warning?: string; error?: string };

export type NewModulesType = {
  modules: SwordConfType[];
  nokeymods: SwordConfType[];
  audio: SwordConfType[];
  fonts: string[];
  bookmarks: string[];
  reports: NewModuleReportType[];
};

export type Repository = {
  name: string | 'i18n:lookup';
  domain: string;
  path: string;
};

export type RepositoryOperation = {
  module: string | Download;
  sourceRepository?: Repository;
  destRepository: Repository;
  // 'remove' removes module from destRepository
  operation: 'copy' | 'move' | 'remove' | 'install';
};

export type RepoDisabled = string[] | null;

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
  confname?: string;
  data?: SelectVKType | SelectORMType;
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

export type PrefStoreType = 'prefs' | 'bookmarks' | 'style' | 'windows';

export type PrefPrimative = number | string | boolean | null | undefined;
export type PrefObject = Record<string, PrefValue>;
export type PrefValue =
  | PrefPrimative
  | { [k: string]: PrefValue }
  | PrefValue[];
export type PrefRoot = {
  [rootkey in keyof typeof S]: PrefObject;
};

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
  labelLocale: (typeof C.Locales)[number][0] | ''; // locale of name
  note: string | 'i18n:lookup'; // default is empty; editable
  noteLocale: (typeof C.Locales)[number][0] | ''; // locale of note
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

export type ServerWait = {
  pleaseWait: 'TOO BUSY' | 'RATE LIMITED' | '';
};

export type ParamShift<T extends unknown[]> = T extends [any, ...infer U]
  ? U
  : never;

export type MethodAddWindowId<M extends (...args: any[]) => any> = (
  ...args2: [...Parameters<M>, windowId: number]
) => ReturnType<M>;

export type ObjectAddWindowId<
  T extends Record<string, (...args: any[]) => any>,
> = {
  [K in keyof T]: MethodAddWindowId<T[K]>;
};

export type GAddWindowId = {
  [obj in (typeof GBuilder)['includeCallingWindow'][number]]: ObjectAddWindowId<
    GType[obj]
  >;
};

type RenderPromiseArgs<FUNC extends (...args: any[]) => any> = [
  ReturnType<FUNC>,
  RenderPromise | undefined | null,
  ...Parameters<FUNC>,
];

export type GCallType = [keyof GType, string | null, any[] | undefined];

export type GType = {
  // Getters. NOTE: no getter function result may depend on locale, instead
  // a regular function is required since WebApp clients differ.
  Tabs: ReturnType<typeof getTabs>;
  Tab: ReturnType<typeof getTab>;
  BooksLocalizedAll: ReturnType<typeof getBooksLocalizedAll>;
  Config: ReturnType<typeof getConfig>;
  ModuleConfs: ReturnType<typeof getModuleConfs>;
  AudioConfs: ReturnType<typeof getAudioConfs>;
  ProgramConfig: ReturnType<typeof localeConfig>;
  LocaleConfigs: ReturnType<typeof getLocaleConfigs>;
  ModuleConfigDefault: ReturnType<typeof getModuleConfigDefault>;
  ModuleFonts: ReturnType<typeof getModuleFonts>;
  FeatureModules: ReturnType<typeof getFeatureModules>;
  OPSYS: NodeJS.Platform;
  BuiltInRepos: ReturnType<typeof getBuiltInRepos>;
  BooksInVKModules: ReturnType<typeof getBooksInVKModules>;

  // Functions
  getBooks: typeof getBooks;
  getBook: typeof getBook;
  getBooksLocalized: typeof getBooksLocalized;
  inlineFile: typeof inlineFile;
  inlineAudioFile: typeof inlineAudioFile;
  getModuleConf: typeof getModuleConf;
  getAudioConf: typeof getAudioConf;
  resetMain: typeof resetMain;
  getSystemFonts: typeof getSystemFonts;
  getBooksInVKModule: typeof getBooksInVKModule;
  getBkChsInV11n: typeof getBkChsInV11n;
  getLocaleDigits: typeof getLocaleDigits;
  publishSubscription: typeof publishSubscription;
  canUndo: typeof canUndo;
  canRedo: typeof canRedo;
  // IMPORTANT: callBatch is not cacheable! Use RenderPromise instead.
  callBatch: (...args: Parameters<CallBatch>) => Promise<ReturnType<CallBatch>>;
  // IMPORTANT: callBatchSync is not cacheable! Use RenderPromise instead.
  callBatchSync: CallBatch;
  getAllDictionaryKeyList: typeof getAllDictionaryKeyList;
  genBookTreeNodes: typeof genBookTreeNodes;
  locationVKText: LocationVKTextG;
  getLanguageName: typeof getLanguageName;

  // Objects
  i18n: {
    t: (k: string, opts?: any) => string;
    exists: (k: string, opts?: any) => boolean;
    language: string;
  };
  clipboard: Pick<typeof clipboard, 'write'>;
  Prefs: PrefsGType;
  DiskCache: typeof DiskCache;
  LibSword: typeof LibSword;
  Dirs: DirsRendererType;
  Commands: typeof Commands;
  Shell: Pick<Shell, 'beep'>;
  Data: typeof Data;
  Module: typeof Module;
  Window: typeof Window;
};

export type GTypeMain = GType & { Dirs: DirsMainType; i18n: typeof i18next };

// Internet safe GI on clients require render-promise arguments:
export type GIType = {
  [name in keyof Pick<
    GType,
    | 'Tabs'
    | 'Tab'
    | 'BooksLocalizedAll'
    | 'Config'
    | 'ModuleConfs'
    | 'AudioConfs'
    | 'ProgramConfig'
    | 'LocaleConfigs'
    | 'ModuleConfigDefault'
    | 'ModuleFonts'
    | 'FeatureModules'
    | 'BooksInVKModules'
  >]: (a: GType[name], b: RenderPromise | null) => GType[name];
} & {
  [name in keyof Pick<
    GType,
    | 'getBooks'
    | 'getBook'
    | 'getBooksLocalized'
    | 'inlineFile'
    | 'inlineAudioFile'
    | 'getModuleConf'
    | 'getAudioConf'
    | 'getSystemFonts'
    | 'getBooksInVKModule'
    | 'getBkChsInV11n'
    | 'getLocaleDigits'
    | 'callBatch'
    | 'callBatchSync'
    | 'getAllDictionaryKeyList'
    | 'genBookTreeNodes'
    | 'locationVKText'
    | 'getLanguageName'
  >]: (...args: RenderPromiseArgs<GType[name]>) => ReturnType<GType[name]>;
} & {
  i18n: {
    [m in 'exists' | 't']: (
      ...args: RenderPromiseArgs<GType['i18n'][m]>
    ) => ReturnType<GType['i18n'][m]>;
  };
} & {
  LibSword: {
    [m in keyof GType['LibSword']]: (
      ...args: RenderPromiseArgs<GType['LibSword'][m]>
    ) => ReturnType<GType['LibSword'][m]>;
  };
};

// Internet safe GI on WebApp server...
export type GITypeMain = { [name in keyof GIType]: GType[name] };

// Internet safe G that is usable in absolutely any context, assuming
// cachePreload() has been called on WebApp clients.
export type Gsafe = Pick<
  GITypeMain,
  // Includes cache preloaded synchronous functions:
  | 'Tabs'
  | 'Tab'
  | 'getBooks'
  | 'getBook'
  | 'getBooksLocalized'
  | 'Config'
  | 'ModuleFonts'
  | 'FeatureModules'
  | 'LocaleConfigs'
  | 'ModuleConfigDefault'
  | 'ProgramConfig'
  | 'getLocaleDigits' // all locales are cached
  // Also includes asynchronous Internet G functions:
  | 'getSystemFonts'
  | 'callBatch'
> & {
  // G handles Prefs specially, so this works anywhere.
  Prefs: GType['Prefs'];
} & {
  // G handles i18n.language specially, so language works anywhere and
  // locale_direction is cache preloaded.
  i18n: {
    language: GType['i18n']['language'];
    t: (s: 'locale_direction' | TabTypes) => string;
  };
} & {
  // And also includes these asynchronous Internet G method functions:
  LibSword: Pick<GITypeMain['LibSword'], 'search'>;
};

// This GBuilder object will be used to create the server and client G objects.
// Each is created at runtime resulting in different types of G objects sharing
// the same interface: The server process G object accesses data directly. But
// the client process G objects request everything through IPC from the server
// process G object. All getter and 'CACHEfunc' data of the client G object
// is cached in the client process. GBuilder includeCallingWindow object
// methods will have an extra argument appended before they are executed in the
// server process which contains the calling window's id. IMPORTANT: async
// functions must be listed in asyncFuncs or runtime errors will result!
const func = () => false;
const CACHEfunc = () => true;
export const GBuilder: GType & {
  // IMPORTANT: Using rest parameters, default values, or getters with methods
  // of includeCallingWindow classes will thus result in overwriting the last
  // argument with the calling window id! Optional parameters of TypeScript are
  // ok. Function.length is used to append the calling window in server G, and
  // Function.length does not include rest parameters or default arguments, and
  // getter functions have no Function.length.
  includeCallingWindow: ['Prefs', 'Window', 'Commands', 'Module'];

  // async functions must be listed in asyncFuncs or runtime
  // errors will result!
  asyncFuncs: [
    [keyof GType, Array<keyof GType['getSystemFonts']>],
    [keyof GType, Array<keyof GType['callBatch']>],
    [keyof GType, Array<keyof GType['Commands']>],
    [keyof GType, Array<keyof GType['Module']>],
    [keyof GType, Array<keyof GType['LibSword']>],
    [keyof GType, Array<keyof GType['Window']>],
  ];

  // Only these functions and object methods will be accessible via Internet.
  internetSafe: [
    [keyof GType, Array<keyof GType['Tabs']>],
    [keyof GType, Array<keyof GType['Tab']>],
    [keyof GType, Array<keyof GType['BooksLocalizedAll']>],
    [keyof GType, Array<keyof GType['Config']>],
    [keyof GType, Array<keyof GType['ModuleConfs']>],
    [keyof GType, Array<keyof GType['AudioConfs']>],
    [keyof GType, Array<keyof GType['ProgramConfig']>],
    [keyof GType, Array<keyof GType['LocaleConfigs']>],
    [keyof GType, Array<keyof GType['ModuleConfigDefault']>],
    [keyof GType, Array<keyof GType['ModuleFonts']>],
    [keyof GType, Array<keyof GType['FeatureModules']>],
    [keyof GType, Array<keyof GType['getBooks']>],
    [keyof GType, Array<keyof GType['getBook']>],
    [keyof GType, Array<keyof GType['getBooksLocalized']>],
    [keyof GType, Array<keyof GType['inlineFile']>],
    [keyof GType, Array<keyof GType['inlineAudioFile']>],
    [keyof GType, Array<keyof GType['getModuleConf']>],
    [keyof GType, Array<keyof GType['getAudioConf']>],
    [keyof GType, Array<keyof GType['getBooksInVKModule']>],
    [keyof GType, Array<keyof GType['getBkChsInV11n']>],
    [keyof GType, Array<keyof GType['getLocaleDigits']>],
    [keyof GType, Array<keyof GType['BooksInVKModules']>],
    [keyof GType, Array<keyof GType['callBatch']>],
    [keyof GType, Array<keyof GType['getAllDictionaryKeyList']>],
    [keyof GType, Array<keyof GType['genBookTreeNodes']>],
    [keyof GType, Array<keyof GType['locationVKText']>],
    [keyof GType, Array<keyof GType['getLanguageName']>],
    [keyof GType, Array<keyof GType['i18n']>],
    [keyof GType, Array<keyof GType['LibSword']>],
  ];
} = {
  includeCallingWindow: ['Prefs', 'Window', 'Commands', 'Module'],

  asyncFuncs: [
    ['getSystemFonts', []],
    ['callBatch', []],
    [
      'Commands',
      [
        'installXulswordModules',
        'exportAudio',
        'importAudio',
        'importBookmarks',
        'exportBookmarks',
        'print',
      ],
    ],
    [
      'Module',
      [
        'crossWireMasterRepoList',
        'repositoryListing',
        'download',
        'downloads',
        'cancelModuleDownloads',
        'cancel',
        'installDownloads',
      ],
    ],
    [
      'LibSword',
      ['searchIndexBuild', 'search', 'startBackgroundSearchIndexer'],
    ],
    ['Window', ['print', 'printToPDF']],
  ],

  internetSafe: [
    ['Tabs', []],
    ['Tab', []],
    ['BooksLocalizedAll', []],
    ['Config', []],
    ['ModuleConfs', []],
    ['AudioConfs', []],
    ['ProgramConfig', []],
    ['LocaleConfigs', []],
    ['ModuleConfigDefault', []],
    ['ModuleFonts', []],
    ['FeatureModules', []],
    ['getBooks', []],
    ['getBook', []],
    ['getBooksLocalized', []],
    ['inlineFile', []],
    ['inlineAudioFile', []],
    ['getModuleConf', []],
    ['getAudioConf', []],
    ['getBooksInVKModule', []],
    ['getBkChsInV11n', []],
    ['getLocaleDigits', []],
    ['BooksInVKModules', []],
    ['callBatch', []],
    ['getAllDictionaryKeyList', []],
    ['genBookTreeNodes', []],
    ['locationVKText', []],
    ['getLanguageName', []],
    ['i18n', ['t', 'exists', 'language']],
    [
      'LibSword',
      [
        'getMaxChapter',
        'getMaxVerse',
        'getChapterText',
        'getChapterTextMulti',
        'getVerseText',
        'getVerseSystem',
        'convertLocation',
        'getIntroductions',
        'getDictionaryEntry',
        'getFirstDictionaryEntry',
        'getAllDictionaryKeys',
        'getGenBookChapterText',
        'getGenBookTableOfContents',
        'search',
        'luceneEnabled',
        'getModuleInformation',
      ],
    ],
  ],

  // Getters
  Tabs: 'getter' as any,
  Tab: 'getter' as any,
  BooksLocalizedAll: 'getter' as any,
  Config: 'getter' as any,
  ModuleConfs: 'getter' as any,
  AudioConfs: 'getter' as any,
  ProgramConfig: 'getter' as any,
  LocaleConfigs: 'getter' as any,
  ModuleConfigDefault: 'getter' as any,
  ModuleFonts: 'getter' as any,
  FeatureModules: 'getter' as any,
  OPSYS: 'getter' as any,
  BuiltInRepos: 'getter' as any,
  BooksInVKModules: 'getter' as any,

  // Functions
  getBooks: CACHEfunc as any,
  getBook: CACHEfunc as any,
  getBooksLocalized: CACHEfunc as any,
  inlineFile: CACHEfunc as any,
  inlineAudioFile: CACHEfunc as any,
  getModuleConf: CACHEfunc as any,
  getAudioConf: CACHEfunc as any,
  getSystemFonts: CACHEfunc as any,
  getBooksInVKModule: CACHEfunc as any,
  getBkChsInV11n: CACHEfunc as any,
  getLocaleDigits: CACHEfunc as any,
  getAllDictionaryKeyList: CACHEfunc as any,
  genBookTreeNodes: CACHEfunc as any,
  locationVKText: CACHEfunc as any,
  getLanguageName: CACHEfunc as any,
  resetMain: func as any,
  publishSubscription: func as any,
  canUndo: func as any,
  canRedo: func as any,
  callBatch: func as any,
  callBatchSync: func as any,

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
    getStorageType: func as any,
    setStorageId: func as any,
    getStorageId: func as any,
    storeExists: func as any,
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
    getChapterText: CACHEfunc as any,
    getChapterTextMulti: CACHEfunc as any,
    getVerseText: CACHEfunc as any,
    getVerseSystem: CACHEfunc as any,
    convertLocation: CACHEfunc as any,
    getIntroductions: CACHEfunc as any,
    getDictionaryEntry: CACHEfunc as any,
    getFirstDictionaryEntry: CACHEfunc as any,
    getAllDictionaryKeys: CACHEfunc as any,
    getGenBookChapterText: CACHEfunc as any,
    getGenBookTableOfContents: CACHEfunc as any,
    search: CACHEfunc as any,
    luceneEnabled: (Build.isElectronApp ? func : CACHEfunc) as any,
    startBackgroundSearchIndexer: func as any,
    stopBackgroundSearchIndexer: func as any,
    searchIndexDelete: func as any,
    searchIndexCancel: func as any,
    searchIndexBuild: func as any,
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
    cancelModuleDownloads: func as any,
    cancel: func as any,
    installDownloads: func as any,
    remove: func as any,
    move: func as any,
    copy: func as any,
    writeConf: func as any,
    setCipherKeys: func as any,
  },

  Window: {
    // uses includeCallingWindow
    descriptions: func as any,
    open: func as any,
    getComplexValue: func as any,
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
};
