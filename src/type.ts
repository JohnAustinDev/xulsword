/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { BrowserWindow } from 'electron';

declare global {
  interface Window {
    api: any;
    ipc: any;
    shell: any;
  }
}

export type WindowType = {
  id: number;
  name: string;
  type: string;
  options: Electron.BrowserWindowConstructorOptions;
};

// Default values for these keys must be set in the default
// JSON Pref file or an error will be thrown.
export interface XulswordStatePref {
  location: LocationVKType | null;
  selection: LocationVKType | null;

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

  flagScroll: number[];
  isPinned: boolean[];
  noteBoxHeight: number[];
  maximizeNoteBox: number[];
}

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
  v11n: V11nType;
  book: string;
  chapter: number;
  verse?: number | null;
  lastverse?: number | null;
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
  noParagraphs: string[]; // should be typeset as verse-per-line
  // xulsword features
  greek: string[];
  hebrew: string[];
};

export type ModTypes =
  | 'Biblical Texts'
  | 'Commentaries'
  | 'Lexicons / Dictionaries'
  | 'Generic Books';

export type TabTypes = 'Texts' | 'Comms' | 'Dicts' | 'Genbks';

export type TabType = {
  module: string;
  type: ModTypes;
  version: string;
  lang: string;
  dir: string;
  v11n: V11nType | '';
  label: string;
  labelClass: string;
  tabType: TabTypes;
  isCommDir: boolean;
  isVerseKey: boolean;
  isRTL: boolean;
  index: number;
  description: string;
  conf: string;
  audio: { [index: string]: string };
  audioCode: string;
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
  xsLocale: string;
  xsModsCommon: string;
};

// Dummy func used as place holder
const func = () => {};

const PrefsPublic = {
  getPrefOrCreate: func as unknown as (
    key: string,
    type: 'string' | 'number' | 'boolean' | 'complex',
    defval: any,
    aStore?: string
  ) => any,
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
  getComplexValue: func as unknown as (key: string, aStore?: string) => any,
  setComplexValue: func as unknown as (
    key: string,
    value: any,
    aStore?: string
  ) => boolean,
  clearUserPref: func as unknown as (key: string, aStore?: string) => boolean,
  getStore: func as unknown as (aStore?: string) => { [s: string]: any },
  writeAllStores: func as unknown as () => void,
};

const LibSwordPublic = {
  initLibsword: func as unknown as () => boolean,
  libSwordReady: func as unknown as (caller: string) => boolean,
  hasBible: func as unknown as () => boolean,
  getMaxChapter: func as unknown as (
    v11n: V11nType,
    vkeytext: string
  ) => number,
  getMaxVerse: func as unknown as (v11n: V11nType, vkeytext: string) => number,
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
  getVerseSystem: func as unknown as (modname: string) => V11nType,
  convertLocation: func as unknown as (
    fromv11n: V11nType,
    vkeytext: string,
    tov11n: V11nType
  ) => string,
  quitLibsword: func as unknown as () => void,
  pause: func as unknown as (callback: any) => void,
  resume: func as unknown as () => void,
  getIntroductions: func as unknown as (
    vkeymod: string,
    bname: string
  ) => string,
  getDictionaryEntry: func as unknown as (
    lexdictmod: string,
    key: string,
    options?: { [key in SwordFilterType]?: SwordFilterValueType }
  ) => string,
  getAllDictionaryKeys: func as unknown as (lexdictmod: string) => string,
  getGenBookChapterText: func as unknown as (
    gbmod: string,
    treekey: string,
    options?: { [key in SwordFilterType]?: SwordFilterValueType }
  ) => string,
  getGenBookTableOfContents: func as unknown as (gbmod: string) => string,
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
  searchIndexBuild: func as unknown as (modname: string) => void,
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
  getModuleList: func as unknown as () => string,
  getModuleInformation: func as unknown as (
    modname: string,
    paramname: string
  ) => string,
  uncompressTarGz: func as unknown as (
    tarGzPath: string,
    aDirPath: string
  ) => void,
  translate: func as unknown as (text: string, localeName: string) => string,
};

const CommandsPublic = {
  addRepositoryModule: func as unknown as () => void,
  addLocalModule: func as unknown as () => void,
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
  openFontsColors: func as unknown as (
    module: string,
    window?: BrowserWindow | null
  ) => void,
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
    flagScroll?: number
  ) => void,
};

// This GPublic object will be used at runtime to create two different
// types of G objects sharing the same GType interface: one will be
// available in the main process and the other in renderer processes.
// The main process G properties access functions and data directly. But
// renderer process G properties request data through IPC from the main
// process G object. All getter data of the Renderer G object is cached.
// This cached data can be cleared by G.reset() in the renderer or
// Cache.reset() in the main process.
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
  ModuleConfigs:       'getter' as unknown as { [i: string]: ConfigType },
  ModuleConfigDefault: 'getter' as unknown as ConfigType,
  FontFaceConfigs:     'getter' as unknown as { [i: string]: string },
  FeatureModules:      'getter' as unknown as FeatureType,
  BooksInModule:       'getter' as unknown as { [i: string]: string[] },
  BkChsInV11n:         'getter' as unknown as { [key in V11nType]: { [i: string]: number }; },
  OPSYS:               'getter' as unknown as NodeJS.Platform,
  /* eslint-enable prettier/prettier */

  // GLOBAL FUNCTIONS
  // ----------------
  resolveHtmlPath: func as unknown as (htmlfile: string) => string,
  inlineFile: func as unknown as (
    path: string,
    encoding: 'base64' | 'utf8'
  ) => string,
  setGlobalMenuFromPref: func as unknown as (menu?: Electron.Menu) => void,
  // Caller win is overwritten when setGlobalStateFromPref is invoked by main process.
  setGlobalStateFromPref: func as unknown as (
    win: null,
    prefs?: string | string[],
    unfocusedUpdate?: boolean
  ) => void,
  openWindow: func as unknown as (
    type: string,
    params: Electron.BrowserWindowConstructorOptions
  ) => number,
  openDialog: func as unknown as (
    type: string,
    params: Electron.BrowserWindowConstructorOptions
  ) => any,
  globalReset: func as unknown as (
    window?: Partial<WindowType> | 'parent' | 'self' | 'children',
    caller?: BrowserWindow | null
  ) => void,
  getSystemFonts: func as unknown as () => Promise<string[]>,

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
    write: func as unknown as (name: string, data: any) => void,
    read: func as unknown as (name: string) => any,
    readAndDelete: func as unknown as (name: string) => any,
  },
};

export type GType = typeof GPublic;

// The Renderer G object caches its returned data
// and the cache can be cleared (reset).
export type GTypeR = typeof GPublic & {
  cache: { [i: string]: any };
  reset: () => void;
};
