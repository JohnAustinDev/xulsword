/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type Electron from 'electron';

declare global {
  interface Window {
    ipc: any;
    shell: any;
  }
}

// Default values for these keys must be set in the default Pref file's
// xulsword object or an error will be thrown.
export interface XulswordStatePref {
  book: string;
  chapter: number;
  verse: number;
  keys: (string | null)[];
  selection: string;

  history: HistoryTypeVK[];
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
  footnotes: boolean;
  crossrefs: boolean;
  dictlinks: boolean;
  versenums: boolean;
  strongs: boolean;
  morph: boolean;
  usernotes: boolean;
  hebcantillation: boolean;
  hebvowelpoints: boolean;
  redwords: boolean;
};

export type PlaceType = {
  footnotes: 'notebox' | 'popup';
  crossrefs: 'notebox' | 'popup';
  usernotes: 'notebox' | 'popup';
};

export type HistoryTypeVK = {
  book: string;
  chapter: number;
  verse: number;
  selection: string;
  v11n: string;
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

export type LocationTypeVK = {
  book: string;
  chapter: number;
  verse: number | null;
  lastverse: number | null;
  version: string | null;
  v11n: string | null;
};

export type ContextData = {
  book: string | null;
  chapter: number | null;
  verse: number | null;
  lastverse: number | null;
  module: string | null;
  tab: string | null;
  lemma: string | null;
  panelIndex: number | null;
  bookmark: unknown | null;
  selection: string | null;
  selectedLocationVK: LocationTypeVK | null;
  search: SearchType | null;
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
  bookGroup: BookGroupType;
  index: number;
  indexInBookGroup: number;
};

export type ConfigType = {
  [index: string]: string;
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

export type TabTypes = 'Texts' | 'Comms' | 'Dicts' | 'Genbks';

export type ModTypes =
  | 'Biblical Texts'
  | 'Commentaries'
  | 'Lexicons / Dictionaries'
  | 'Generic Books';

export type TabType = {
  module: string;
  type: ModTypes;
  version: string;
  lang: string;
  dir: string;
  v11n: string;
  label: string;
  tabType: TabTypes;
  isCommDir: boolean;
  isVerseKey: boolean;
  isRTL: boolean;
  index: number;
  description: string;
  locName: string;
  conf: string;
  audio: { [index: string]: string };
  audioCode: string;
};

export const DirsPublic = {
  path: 'readonly' as unknown as DirsDirectories,
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

export const PrefsPublic = {
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
export const LibSwordPublic = {
  initLibsword: func as unknown as () => boolean,
  libSwordReady: func as unknown as (caller: string) => boolean,
  hasBible: func as unknown as () => boolean,
  getMaxChapter: func as unknown as (
    modname: string,
    vkeytext: string
  ) => number,
  getMaxVerse: func as unknown as (modname: string, vkeytext: string) => number,
  getChapterText: func as unknown as (
    modname: string,
    vkeytext: string
  ) => string,
  getChapterTextMulti: func as unknown as (
    modstrlist: string,
    vkeytext: string
  ) => string,
  getFootnotes: func as unknown as () => string,
  getCrossRefs: func as unknown as () => string,
  getNotes: func as unknown as () => string,
  getVerseText: func as unknown as (
    vkeymod: string,
    vkeytext: string,
    keepTextNotes: boolean
  ) => string,
  getVerseSystem: func as unknown as (modname: string) => string,
  convertLocation: func as unknown as (
    fromv11n: string,
    vkeytext: string,
    tov11n: string
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
    key: string
  ) => string,
  getAllDictionaryKeys: func as unknown as (lexdictmod: string) => string,
  getGenBookChapterText: func as unknown as (
    gbmod: string,
    treekey: string
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

export const CommandsPublic = {
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
  openFontsColors: func as unknown as (module?: string) => void,
  openBookmarksManager: func as unknown as () => void,
  openNewDbItemDialog: func as unknown as (
    userNote: boolean,
    mod: string,
    bk: string,
    ch: number,
    vs: number,
    lv?: number | null
  ) => void,
  openDbItemPropertiesDialog: func as unknown as (bookmark: unknown) => void,
  deleteDbItem: func as unknown as (bookmark: unknown) => void,
  openHelp: func as unknown as (module?: string) => void,
  goToBibleLocation: func as unknown as (
    v11n: string,
    bk: string,
    ch: number,
    vs?: number,
    sel?: string,
    flagScroll?: number
  ) => void,
};

// See electron shell api. Any electron shell property can be added
// here and it will become available in G.
export const ShellPublic = {
  beep: func as unknown as () => void,
};

// Make data available to both main and renderer processes.
export const DataPublic = {
  write: func as unknown as (data: any) => void,
  data: 'readonly' as unknown as any,
  read: func as unknown as () => any,
  readOnce: func as unknown as () => any,
};

// This GPublic object will be used at runtime to create two different
// types of G objects sharing the same GType interface: one will be
// available in the main process and the other in renderer processes.
// The main process G properties access functions and data directly. But
// renderer process G properties request data through IPC from the main
// process G object. All readonly data is cached. The cache can be
// cleared by G.reset().
export const GPublic = {
  // Global data for read only use
  Books: 'readonly',
  Book: 'readonly',
  Tabs: 'readonly',
  Tab: 'readonly',
  ProgramConfig: 'readonly',
  LocaleConfigs: 'readonly',
  ModuleConfigs: 'readonly',
  ModuleConfigDefault: 'readonly',
  FontFaceConfigs: 'readonly',
  FeatureModules: 'readonly',
  AvailableBooks: 'readonly',
  OPSYS: 'readonly',

  // Global functions
  resolveHtmlPath: func as unknown,
  inlineFile: func as unknown,
  setGlobalMenuFromPref: func as unknown,
  setGlobalStateFromPref: func as unknown,
  openWindow: func as unknown,
  openDialog: func as unknown,
  globalReset: func as unknown,

  // Global objects with methods and/or data
  Prefs: PrefsPublic,
  LibSword: LibSwordPublic,
  Dirs: DirsPublic,
  Commands: CommandsPublic,
  Shell: ShellPublic,
  Data: DataPublic,
};

export interface GType {
  Books: BookType[];
  Book: { [i: string]: BookType };
  Tabs: TabType[];
  Tab: { [i: string]: TabType };
  ProgramConfig: ConfigType;
  LocaleConfigs: { [i: string]: ConfigType };
  ModuleConfigs: { [i: string]: ConfigType };
  ModuleConfigDefault: ConfigType;
  FontFaceConfigs: ConfigType[];
  FeatureModules: FeatureType;
  AvailableBooks: { [i: string]: string[] };
  OPSYS: 'string';

  resolveHtmlPath: (htmlfile: string) => string;
  inlineFile: (path: string, encoding: 'base64' | 'utf8') => string;
  setGlobalMenuFromPref: (menu?: Electron.Menu) => void;
  // Caller win is overwritten when setGlobalStateFromPref is invoked by main process.
  setGlobalStateFromPref: (win: null, prefs?: string | string[]) => void;
  openWindow: (
    type: string,
    params: Electron.BrowserWindowConstructorOptions
  ) => number;
  openDialog: (
    type: string,
    params: Electron.BrowserWindowConstructorOptions
  ) => any;
  globalReset: () => void;

  Prefs: typeof PrefsPublic;
  LibSword: typeof LibSwordPublic;
  Dirs: typeof DirsPublic;
  Commands: typeof CommandsPublic;
  Shell: typeof ShellPublic;
  Data: typeof DataPublic;

  cache: { [i: string]: any };
  reset: () => void;
}
